import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export interface MasterProfile {
  studentId: string;
  skillTags: Record<string, string>; // e.g. { "توحيد_المقامات": "ممتاز", "الاشتقاق": "متوسط" }
  commonMistakes: string[];
  preferredLearningStyle?: string;
  lastUpdated: string;
}

const DEFAULT_PROFILE: MasterProfile = {
  studentId: "",
  skillTags: {},
  commonMistakes: [],
  preferredLearningStyle: "",
  lastUpdated: new Date().toISOString(),
};

/**
 * Fetch a student's cumulative Master Profile from Firestore (master_profiles collection)
 * Non-blocking: Returns fallback default profile on error or missing doc
 */
export async function getStudentMasterProfile(userId: string): Promise<MasterProfile> {
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return { ...DEFAULT_PROFILE, studentId: userId || "" };
  }

  try {
    const docRef = doc(db, "master_profiles", userId.trim());
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        studentId: userId,
        skillTags: data.skillTags && typeof data.skillTags === "object" ? data.skillTags : {},
        commonMistakes: Array.isArray(data.commonMistakes) ? data.commonMistakes : [],
        preferredLearningStyle: data.preferredLearningStyle || "",
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn(`Could not fetch MasterProfile for user "${userId}":`, error);
  }

  return { ...DEFAULT_PROFILE, studentId: userId };
}

/**
 * Merge updates into a student's Master Profile using setDoc merge: true
 */
export async function updateStudentMasterProfile(
  userId: string,
  data: Partial<MasterProfile>
): Promise<boolean> {
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return false;
  }

  try {
    const docRef = doc(db, "master_profiles", userId.trim());
    const payload = {
      ...data,
      studentId: userId.trim(),
      lastUpdated: new Date().toISOString(),
    };

    await setDoc(docRef, payload, { merge: true });
    console.log(`✅ MasterProfile updated successfully for user "${userId}"`);
    return true;
  } catch (error) {
    console.warn(`Failed to update MasterProfile for user "${userId}":`, error);
    return false;
  }
}
