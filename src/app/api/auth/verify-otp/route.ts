import { NextResponse } from "next/server";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { User, UserRole, AccountStatus } from "@/src/types/user";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      otp,
      password,
      displayName,
      role: requestedRole = "student",
      teacherId,
      inviteKey,
      groupId,
      profile,
    } = body;

    // 1. Basic Payload Validation
    if (!email || !otp || !password || !displayName) {
      return NextResponse.json(
        { success: false, error: "يرجى ملء كافة الحقول المطلوبة (البريد، كود التفعيل، كلمة المرور، الاسم الكامل)." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل." },
        { status: 400 }
      );
    }

    const targetRole: UserRole = requestedRole === "teacher" ? "teacher" : "student";
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    // 2. Strict Role Mandates & Key Verification
    let keyDocToBurn: any = null;
    let grantedQuota = 50;

    const rawTeacherKeyInput = (teacherId || inviteKey || "").trim();

    if (targetRole === "student") {
      if (!rawTeacherKeyInput) {
        return NextResponse.json(
          { success: false, error: "التسجيل كطالب يتطلب تزويد مفتاح تفعيل نشط وخاص بالفوج الدراسي (Closed Registration)." },
          { status: 400 }
        );
      }
    } else if (targetRole === "teacher") {
      if (!rawTeacherKeyInput) {
        return NextResponse.json(
          { success: false, error: "مفتاح الدعوة (Teacher Invite Key) إجباري لتسجيل حساب الأستاذ." },
          { status: 400 }
        );
      }

      const keysRef = collection(db, "teacher_keys");
      const q = query(keysRef, where("key", "==", rawTeacherKeyInput));
      const keySnap = await getDocs(q);

      if (keySnap.empty) {
        return NextResponse.json(
          { success: false, error: "مفتاح الدعوة غير صالح أو تم استخدامه سابقاً." },
          { status: 400 }
        );
      }

      const foundKeyDoc = keySnap.docs[0];
      const keyData = foundKeyDoc.data();

      if (keyData.status === "used" || keyData.status === "disabled") {
        return NextResponse.json(
          { success: false, error: "مفتاح الدعوة غير صالح أو تم استخدامه سابقاً." },
          { status: 400 }
        );
      }

      keyDocToBurn = foundKeyDoc;
      grantedQuota = keyData.quota || keyData.studentQuota || 100;
    }

    // 3. Resolve True Teacher Firebase Auth UID & Group ID if targetRole === 'student' Requirement 2
    let resolvedTeacherUid: string | null = null;
    let resolvedGroupId: string | null = groupId ? String(groupId).trim() : null;
    let activationKeyDocToBurn: any = null;

    if (targetRole === "student" && rawTeacherKeyInput) {
      // 3.0 SECURITY GUARD: Pre-check if activation key has already been used Requirement 2
      try {
        const actCheckSnap = await getDocs(query(collection(db, "activation_keys"), where("key", "==", rawTeacherKeyInput)));
        if (!actCheckSnap.empty) {
          const kDoc = actCheckSnap.docs[0];
          const kData = kDoc.data();

          if (kData.status === "used" || Boolean(kData.usedBy)) {
            return NextResponse.json(
              { success: false, error: "هذا المفتاح تم استخدامه من قبل." },
              { status: 400 }
            );
          }

          activationKeyDocToBurn = kDoc;
          const creator = kData.createdBy || kData.teacherId;
          if (creator && typeof creator === "string" && creator.length >= 20) {
            resolvedTeacherUid = creator.trim();
          }
          const gId = kData.groupId || kData.group;
          if (gId && typeof gId === "string") {
            const rawGId = gId.trim();
            // Resolve to strict Firestore Document ID if needed
            try {
              const grpSnap = await getDoc(doc(db, "groups", rawGId));
              if (grpSnap.exists()) {
                resolvedGroupId = rawGId;
              } else {
                const grpByNameSnap = await getDocs(
                  query(collection(db, "groups"), where("name", "==", rawGId))
                );
                if (!grpByNameSnap.empty) {
                  resolvedGroupId = grpByNameSnap.docs[0].id;
                } else {
                  resolvedGroupId = rawGId;
                }
              }
            } catch (err) {
              resolvedGroupId = rawGId;
            }
          }
        }
      } catch (e) {}

      // 3.1 Direct check: Is rawTeacherKeyInput already a valid Firebase Auth UID in users collection?
      if (!resolvedTeacherUid) {
        try {
          const directUserSnap = await getDoc(doc(db, "users", rawTeacherKeyInput));
          if (directUserSnap.exists()) {
            const uData = directUserSnap.data();
            if (uData.role === "teacher" || uData.role === "admin" || uData.role === "super_admin") {
              resolvedTeacherUid = rawTeacherKeyInput;
            }
          }
        } catch (e) {}
      }

      // 3.2 Query teacher_keys for key == rawTeacherKeyInput
      if (!resolvedTeacherUid || !resolvedGroupId) {
        try {
          const tchSnap = await getDocs(query(collection(db, "teacher_keys"), where("key", "==", rawTeacherKeyInput)));
          if (!tchSnap.empty) {
            const tkData = tchSnap.docs[0].data();
            if (tkData.status === "used" || Boolean(tkData.usedBy)) {
              return NextResponse.json(
                { success: false, error: "هذا المفتاح تم استخدامه من قبل." },
                { status: 400 }
              );
            }
            const creator = tkData.createdBy || tkData.teacherId;
            if (creator && typeof creator === "string" && creator.length >= 20) {
              resolvedTeacherUid = creator.trim();
            }
            const gId = tkData.groupId || tkData.group;
            if (gId && typeof gId === "string") {
              resolvedGroupId = gId.trim();
            }
          }
        } catch (e) {}
      }

      // 3.4 Query groups for id/code == rawTeacherKeyInput
      if (!resolvedTeacherUid || !resolvedGroupId) {
        try {
          const groupDocSnap = await getDoc(doc(db, "groups", rawTeacherKeyInput));
          if (groupDocSnap.exists()) {
            const gData = groupDocSnap.data();
            resolvedGroupId = groupDocSnap.id;
            if (gData.teacherId && typeof gData.teacherId === "string") {
              resolvedTeacherUid = gData.teacherId.trim();
            }
          } else {
            const groupQuerySnap = await getDocs(query(collection(db, "groups"), where("code", "==", rawTeacherKeyInput)));
            if (!groupQuerySnap.empty) {
              const gData = groupQuerySnap.docs[0].data();
              resolvedGroupId = groupQuerySnap.docs[0].id;
              if (gData.teacherId && typeof gData.teacherId === "string") {
                resolvedTeacherUid = gData.teacherId.trim();
              }
            }
          }
        } catch (e) {}
      }

      // 3.5 Fallback for resolvedGroupId: If teacher UID is resolved but no groupId, pick teacher's first group
      if (resolvedTeacherUid && !resolvedGroupId) {
        try {
          const tGroupsSnap = await getDocs(query(collection(db, "groups"), where("teacherId", "==", resolvedTeacherUid)));
          if (!tGroupsSnap.empty) {
            resolvedGroupId = tGroupsSnap.docs[0].id;
          }
        } catch (e) {}
      }

      // Fallback for teacher UID if none could be resolved
      if (!resolvedTeacherUid) {
        resolvedTeacherUid = rawTeacherKeyInput;
      }
    }

    // 4. Verify OTP from Firestore 'otps' collection
    const otpDocRef = doc(db, "otps", cleanEmail);
    const otpDocSnap = await getDoc(otpDocRef);

    if (!otpDocSnap.exists()) {
      return NextResponse.json(
        { success: false, error: "كود التفعيل غير متاح أو انتهت صلاحيته. يرجى طلب كود جديد." },
        { status: 400 }
      );
    }

    const otpData = otpDocSnap.data();

    // Check Code Match
    if (otpData.code !== cleanOtp) {
      return NextResponse.json(
        { success: false, error: "كود التفعيل المدخل غير صحيح. يرجى التثبت وإعادة المحاولة." },
        { status: 400 }
      );
    }

    // Check Expiration
    if (otpData.expiresAt && Date.now() > otpData.expiresAt) {
      await deleteDoc(otpDocRef);
      return NextResponse.json(
        { success: false, error: "انتهت صلاحية كود التفعيل. يرجى طلب رمز جديد." },
        { status: 400 }
      );
    }

    // 5. Create User in Firebase Authentication
    let userUid: string;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      userUid = userCredential.user.uid;
    } catch (authError: any) {
      console.error("Firebase Auth User Creation Error:", authError);
      if (authError.code === "auth/email-already-in-use") {
        return NextResponse.json(
          { success: false, error: "هذا البريد الإلكتروني مسجل بالفعل في النظام." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: authError.message || "فشل إنشاء الحساب في نظام الهوية." },
        { status: 400 }
      );
    }

    // 6. Build User Document Object with Two-Way Binding & Audit Trail Requirement 2
    const accountStatus: AccountStatus = "active";

    const newUserData: User & {
      studentQuota?: number;
      inviteKey?: string;
      usedActivationKey?: string;
      groupId?: string;
    } = {
      uid: userUid,
      email: cleanEmail,
      displayName: displayName.trim(),
      role: targetRole,
      status: accountStatus,
      ...(targetRole === "student" && resolvedTeacherUid ? { teacherId: resolvedTeacherUid } : {}),
      ...(targetRole === "student" && resolvedGroupId ? { groupId: resolvedGroupId } : {}),
      ...(targetRole === "student" && rawTeacherKeyInput
        ? { inviteKey: rawTeacherKeyInput, usedActivationKey: rawTeacherKeyInput }
        : {}),
      ...(targetRole === "teacher" ? { studentQuota: grantedQuota } : {}),
      ...(profile && typeof profile === "object" ? profile : {}),
      createdAt: Date.now(),
    };

    // 7. Save User Document in Firestore 'users/{uid}'
    await setDoc(doc(db, "users", userUid), newUserData);

    // 7.1 Create Enrollment Document in 'enrollments' collection Requirement 2 & 3
    if (targetRole === "student" && resolvedGroupId) {
      try {
        await addDoc(collection(db, "enrollments"), {
          studentId: userUid,
          teacherId: resolvedTeacherUid,
          groupId: resolvedGroupId,
          joinedAt: Date.now(),
          status: "active",
          keyUsed: rawTeacherKeyInput,
        });
      } catch (enrollErr) {
        console.error("Error creating student enrollment document:", enrollErr);
      }
    }

    // 8. Burn/Bind Activation Key Requirement 2 (Update status to 'used' & usedBy to student UID)
    if (activationKeyDocToBurn) {
      try {
        await updateDoc(doc(db, "activation_keys", activationKeyDocToBurn.id), {
          status: "used",
          usedBy: userUid,
          usedAt: Date.now(),
        });
      } catch (burnErr) {
        console.error("Error updating activation key used status:", burnErr);
      }
    }

    // Burn Teacher Invite Key if applicable
    if (keyDocToBurn) {
      try {
        await updateDoc(doc(db, "teacher_keys", keyDocToBurn.id), {
          status: "used",
          usedBy: userUid,
          usedAt: Date.now(),
        });
      } catch (burnErr) {
        console.error("Error burning teacher key:", burnErr);
      }
    }

    // 9. Clean up OTP Document
    await deleteDoc(otpDocRef);

    return NextResponse.json({
      success: true,
      message: targetRole === "teacher"
        ? "تم تفعيل مفتاح الدعوة وإنشاء حساب الأستاذ بنجاح!"
        : "تم تفعيل وإنشاء حساب الطالب بنجاح!",
      user: newUserData,
    });
  } catch (error: any) {
    console.error("Verify OTP API Route Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "حدث خطأ غير متوقع أثناء تفعيل الحساب." },
      { status: 500 }
    );
  }
}
