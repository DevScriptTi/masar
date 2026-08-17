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
import { db } from "@/lib/firebase/config";

export interface ActivationKeyDoc {
  id?: string;
  key: string;
  groupId: string;
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
 * Generate and batch-save activation keys to Firestore
 */
export async function generateKeys(
  groupId: string,
  quantity: number
): Promise<ActivationKeyDoc[]> {
  const cleanGroupTag = groupId.trim().replace(/\s+/g, "_").toUpperCase();
  const validQuantity = Math.min(Math.max(quantity, 1), 50);

  const batch = writeBatch(db);
  const keysCollection = collection(db, "activation_keys");
  const newKeys: ActivationKeyDoc[] = [];

  for (let i = 0; i < validQuantity; i++) {
    const randomChars = generateRandomCode(5);
    const keyCode = `BAC27-${cleanGroupTag}-${randomChars}`;
    const newDocRef = doc(keysCollection);

    const keyData: Omit<ActivationKeyDoc, "id"> = {
      key: keyCode,
      groupId: groupId.trim(),
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
 * Fetch all activation keys from Firestore
 */
export async function fetchKeys(): Promise<ActivationKeyDoc[]> {
  const keysCollection = collection(db, "activation_keys");

  try {
    const q = query(keysCollection, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ActivationKeyDoc, "id">),
    }));
  } catch (error) {
    console.warn("Index notice, fallback query for keys:", error);
    const querySnapshot = await getDocs(keysCollection);
    const keys = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ActivationKeyDoc, "id">),
    }));

    return keys.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }
}

/**
 * Toggle key status between 'active' and 'disabled'.
 * Cannot toggle if key status is 'used'.
 */
export async function toggleKeyStatus(
  keyId: string,
  currentStatus: "active" | "used" | "disabled"
): Promise<void> {
  if (!keyId) return;
  if (currentStatus === "used") {
    throw new Error("لا يمكن تغيير حالة مفتاح مستعمل.");
  }

  const newStatus = currentStatus === "active" ? "disabled" : "active";
  const keyDocRef = doc(db, "activation_keys", keyId);
  await updateDoc(keyDocRef, { status: newStatus });
}

/**
 * Safe Delete Key:
 * If key is 'used', uses a Batch Write to:
 * 1. Target users/${keyData.usedBy}
 * 2. Remove ONLY enrollments.${keyData.groupId} via deleteField() without deleting the user document.
 * 3. Delete the activation_key document.
 * If key is not 'used', deletes the key document directly.
 */
export async function deleteKey(
  keyId: string,
  keyData: ActivationKeyDoc
): Promise<void> {
  if (!keyId) return;

  if (keyData.status === "used" && keyData.usedBy) {
    const batch = writeBatch(db);

    // 1 & 2. Safely delete specific enrollment from user document
    const userDocRef = doc(db, "users", keyData.usedBy);
    batch.update(userDocRef, {
      [`enrollments.${keyData.groupId}`]: deleteField(),
    });

    // 3. Delete activation key doc
    const keyDocRef = doc(db, "activation_keys", keyId);
    batch.delete(keyDocRef);

    await batch.commit();
  } else {
    // Standard delete for unused keys
    const keyDocRef = doc(db, "activation_keys", keyId);
    await deleteDoc(keyDocRef);
  }
}

