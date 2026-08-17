import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export interface GroupDoc {
  id?: string;
  name: string;
  description: string;
  studentCount?: number;
  status?: "active" | "archived";
  createdAt?: any;
}

/**
 * Create a new group in Firestore with status 'active'
 */
export async function createGroup(
  name: string,
  description: string
): Promise<string> {
  const groupsCollection = collection(db, "groups");
  const docRef = await addDoc(groupsCollection, {
    name: name.trim(),
    description: description.trim(),
    studentCount: 0,
    status: "active",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Fetch all groups from Firestore
 */
export async function fetchGroups(): Promise<GroupDoc[]> {
  const groupsCollection = collection(db, "groups");

  try {
    const q = query(groupsCollection, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...(data as Omit<GroupDoc, "id">),
        status: data.status || "active",
      };
    });
  } catch (error) {
    console.warn("Index notice, fallback query for groups:", error);
    const querySnapshot = await getDocs(groupsCollection);
    const groups = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...(data as Omit<GroupDoc, "id">),
        status: data.status || "active",
      };
    });

    return groups.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }
}

/**
 * Archive a group (soft delete) by setting status to 'archived'
 */
export async function archiveGroup(groupId: string): Promise<void> {
  if (!groupId) return;
  const groupDocRef = doc(db, "groups", groupId);
  await updateDoc(groupDocRef, { status: "archived" });
}

/**
 * Restore an archived group by setting status back to 'active'
 */
export async function restoreGroup(groupId: string): Promise<void> {
  if (!groupId) return;
  const groupDocRef = doc(db, "groups", groupId);
  await updateDoc(groupDocRef, { status: "active" });
}

/**
 * Update group details (name, description, etc.)
 */
export async function updateGroup(
  groupId: string,
  data: Partial<GroupDoc>
): Promise<void> {
  if (!groupId) return;
  const groupDocRef = doc(db, "groups", groupId);
  await updateDoc(groupDocRef, data);
}

/**
 * Delete a group document from Firestore permanently by ID
 */
export async function deleteGroup(groupId: string): Promise<void> {
  if (!groupId) return;
  const groupDocRef = doc(db, "groups", groupId);
  await deleteDoc(groupDocRef);
}

