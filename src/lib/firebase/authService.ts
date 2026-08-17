import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase/config";

export interface StudentRegisterInput {
  fullName: string;
  email: string;
  password: string;
  activationKey: string;
  dob: string;
  level: string;
  year: string;
  stream: string;
  avatar: string;
  avatarFile?: File | null;
}

/**
 * Register a new student:
 * 1. Validates activation key status in Firestore.
 * 2. Creates Firebase Auth user.
 * 3. Uploads custom avatar to Firebase Storage if a File is provided.
 * 4. Executes a Firestore WriteBatch to create the user document and mark activation_key as used.
 */
export async function registerStudent(formData: StudentRegisterInput): Promise<string> {
  const cleanKey = formData.activationKey.trim().toUpperCase();

  // 1. Step 1: Validate Key in Firestore
  const keysCollection = collection(db, "activation_keys");
  const keyQuery = query(keysCollection, where("key", "==", cleanKey));
  const keySnapshot = await getDocs(keyQuery);

  if (keySnapshot.empty) {
    throw new Error("مفتاح التفعيل غير صالح أو غير موجود.");
  }

  const keyDocSnap = keySnapshot.docs[0];
  const keyData = keyDocSnap.data();

  if (keyData.status !== "active") {
    throw new Error("مفتاح التفعيل غير صالح أو مستعمل مسبقاً.");
  }

  const keyDocId = keyDocSnap.id;
  const groupId = keyData.groupId || "default_group";

  // 2. Step 2: Create Firebase Auth User
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    formData.email.trim(),
    formData.password
  );
  const user = userCredential.user;

  // 3. Step 3: Handle Avatar Storage Upload if File is provided
  let finalAvatarUrl = formData.avatar;

  if (formData.avatarFile) {
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      const uploadSnapshot = await uploadBytes(storageRef, formData.avatarFile);
      finalAvatarUrl = await getDownloadURL(uploadSnapshot.ref);
    } catch (storageError) {
      console.warn("Avatar upload failed, falling back to string indicator:", storageError);
    }
  }

  // 4. Step 4: Database WriteBatch (User Doc + Key Doc Update)
  const batch = writeBatch(db);

  // User Document Reference
  const userDocRef = doc(db, "users", user.uid);
  batch.set(userDocRef, {
    uid: user.uid,
    email: formData.email.trim(),
    fullName: formData.fullName.trim(),
    dob: formData.dob,
    level: formData.level,
    year: formData.year || null,
    stream: formData.stream || null,
    avatar: finalAvatarUrl,
    role: "student",
    enrollments: {
      [groupId]: {
        keyUsed: cleanKey,
        enrolledAt: serverTimestamp(),
      },
    },
    createdAt: serverTimestamp(),
  });

  // Key Document Reference -> Mark as 'used'
  const keyDocRef = doc(db, "activation_keys", keyDocId);
  batch.update(keyDocRef, {
    status: "used",
    usedBy: user.uid,
  });

  await batch.commit();

  return user.uid;
}
