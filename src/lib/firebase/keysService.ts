import {
  collection,
  doc,
  writeBatch,
  getDocs,
  deleteDoc,
  updateDoc,
  deleteField,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

export interface ActivationKeyDoc {
  id?: string;
  key: string;
  groupId: string;
  teacherId?: string;
  status: "active" | "used" | "disabled";
  usedBy: string | null;
  createdAt?: any;
}

// Generate random uppercase alphanumeric string of specified length
function generateRandomCode(length: number = 5): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous characters
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate and batch-save activation keys to Firestore with teacherId
 */
export async function generateKeys(
  groupId: string,
  quantity: number,
  groupName?: string
): Promise<ActivationKeyDoc[]> {
  const cleanTag = (groupName || groupId).trim().replace(/\s+/g, "_").toUpperCase().slice(0, 10);
  const validQuantity = Math.min(Math.max(quantity, 1), 50);
  const currentUid = auth.currentUser?.uid;

  const batch = writeBatch(db);
  const keysCollection = collection(db, "activation_keys");
  const newKeys: ActivationKeyDoc[] = [];

  for (let i = 0; i < validQuantity; i++) {
    const randomChars = generateRandomCode(5);
    const keyCode = `BAC27-${cleanTag}-${randomChars}`;
    const newDocRef = doc(keysCollection);

    const keyData: Omit<ActivationKeyDoc, "id"> = {
      key: keyCode,
      groupId: groupId.trim(), // Strict Firestore document ID string
      teacherId: currentUid || "admin",
      status: "active",
      usedBy: null,
      createdAt: serverTimestamp(),
    };

    batch.set(newDocRef, keyData);
    newKeys.push({ id: newDocRef.id, ...keyData });
  }

  await batch.commit();
  return newKeys;
}

/**
 * Fetch activation keys from Firestore (filtered by current teacherId if available)
 */
export async function fetchKeys(teacherId?: string): Promise<ActivationKeyDoc[]> {
  const keysCollection = collection(db, "activation_keys");
  const currentTeacherId = teacherId || auth.currentUser?.uid;

  try {
    const q = query(keysCollection, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const allKeys = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ActivationKeyDoc, "id">),
    }));

    if (currentTeacherId) {
      return allKeys.filter(
        (k) => !k.teacherId || k.teacherId === currentTeacherId
      );
    }

    return allKeys;
  } catch (error) {
    console.warn("Index notice, fallback query for keys:", error);
    const querySnapshot = await getDocs(keysCollection);
    const keys = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ActivationKeyDoc, "id">),
    }));

    const sorted = keys.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    if (currentTeacherId) {
      return sorted.filter(
        (k) => !k.teacherId || k.teacherId === currentTeacherId
      );
    }

    return sorted;
  }
}

/**
 * Toggle key status between 'active' and 'disabled'.
 */
export async function toggleKeyStatus(
  keyId: string,
  currentStatus: "active" | "used" | "disabled"
): Promise<void> {
  if (currentStatus === "used") return;
  const newStatus = currentStatus === "active" ? "disabled" : "active";
  const keyDocRef = doc(db, "activation_keys", keyId);
  await updateDoc(keyDocRef, { status: newStatus });
}

/**
 * Delete a single key document permanently
 */
export async function deleteKey(keyId: string): Promise<void> {
  const keyDocRef = doc(db, "activation_keys", keyId);
  await deleteDoc(keyDocRef);
}

/**
 * Delete multiple keys permanently in a single writeBatch
 */
export async function deleteBatchKeys(keyIds: string[]): Promise<void> {
  if (!keyIds || keyIds.length === 0) return;
  const batch = writeBatch(db);
  keyIds.forEach((id) => {
    const ref = doc(db, "activation_keys", id);
    batch.delete(ref);
  });
  await batch.commit();
}
