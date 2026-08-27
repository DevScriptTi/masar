import { NextResponse } from "next/server";
import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { confirmKeyword, adminEmail } = body;

    // Strict Confirmation Check
    if (confirmKeyword !== "RESET") {
      return NextResponse.json(
        { success: false, error: "كلمة التأكيد غير صحيحة. يجب كتابة RESET للتأكيد." },
        { status: 400 }
      );
    }

    // Standard collections to wipe completely
    const collectionsToWipe = [
      "courses",
      "activities",
      "groups",
      "submissions",
      "notifications",
      "activation_keys",
      "stationChats",
      "system_logs",
    ];

    let totalDeletedDocs = 0;

    // 1. Delete standard content and activity collections
    for (const colName of collectionsToWipe) {
      try {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);

        if (snapshot.docs.length > 0) {
          for (let i = 0; i < snapshot.docs.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = snapshot.docs.slice(i, i + 400);
            chunk.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
            totalDeletedDocs += chunk.length;
          }
        }
      } catch (colErr) {
        console.error(`Error deleting collection ${colName}:`, colErr);
      }
    }

    // 2. Delete non-admin users from 'users' collection (PRESERVE ADMINS)
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      const nonAdminUsers = usersSnapshot.docs.filter((docSnap) => {
        const data = docSnap.data();
        const isUserAdmin =
          data.role === "admin" ||
          data.isAdmin === true ||
          (adminEmail && data.email === adminEmail);
        return !isUserAdmin;
      });

      if (nonAdminUsers.length > 0) {
        for (let i = 0; i < nonAdminUsers.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = nonAdminUsers.slice(i, i + 400);
          chunk.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
          totalDeletedDocs += chunk.length;
        }
      }
    } catch (usersErr) {
      console.error("Error wiping non-admin users:", usersErr);
    }

    return NextResponse.json({
      success: true,
      message: `تمت فرمتة قاعدة البيانات بنجاح ومسح ${totalDeletedDocs} عنصر بدون مساس بحساب الإدارة.`,
      deletedDocsCount: totalDeletedDocs,
    });
  } catch (error: any) {
    console.error("Factory Reset API Route Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "حدث خطأ أثناء إجراء الفرمتة الشاملة." },
      { status: 500 }
    );
  }
}
