import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

export interface CourseDoc {
  id?: string;
  title: string;
  description: string;
  teacherId?: string;
  groupIds?: string[];
  courseIndexContext?: string;
  courseDetailedLatex?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ModuleDoc {
  id?: string;
  courseId: string;
  title: string;
  order: number;
  isVisible: boolean;
  teacherId?: string;
  groupIds?: string[];
  excludedStudentIds?: string[];
  moduleIndexContext?: string;
  moduleDetailedLatex?: string;
  createdAt?: any;
}

export interface ActivityStation {
  id: string;
  title: string;
  type?: "socratic" | "quiz" | "attachments" | "video" | "notes" | string;
  order: number;
  initialMessage?: string;
  systemPrompt?: string;
  content?: string;
  aiDirectives?: string;
  customIsolations?: any;
  isolatedStudentIds?: string[];
  targetAudience?: "all" | "specific_groups" | "specific_students" | string;
  targetIds?: string[];
  stationContextNote?: string;
  quizQuestions?: QuizQuestionItem[];
  attachments?: AttachmentItem[];
  referenceImageUrls?: string[];
}

export interface ActivityDoc {
  id?: string;
  courseId: string;
  moduleId: string;
  title: string;
  order: number;
  isVisible: boolean;
  description?: string;
  globalLatexSummary?: string;
  globalCustomIsolations?: any;
  hiddenTeacherDirectives?: string;
  teacherId?: string;
  groupIds?: string[];
  excludedStudentIds?: string[];
  globalContext?: string;
  referenceImageUrls?: string[];
  type?: string;
  activityMode?: "theoretical" | "interactive";
  activityType?: "theoretical" | "interactive";
  isInteractive?: boolean;
  requireSubmission?: boolean;
  hasQuiz?: boolean;
  quiz?: any;
  videos?: any[];
  attachments?: any[];
  stations?: ActivityStation[];
  createdAt?: any;
}

export interface QuizQuestionItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface AttachmentItem {
  id?: string;
  title: string;
  type: "pdf" | "video" | string;
  url: string;
  description?: string;
  latexContent?: string;
}

export interface TargetItem {
  targetType: "cohort" | "student";
  targetId: string;
}

export interface CustomIsolationRule {
  id: string;
  studentIds?: string[];
  groupIds?: string[];
  targets?: TargetItem[];
  specificContextNote: string;
  createdAt?: any;
}

export interface TargetingPreset {
  id?: string;
  name?: string;
  presetName?: string;
  targetAudience?: string;
  targetIds?: string[];
  isolatedStudentIds?: string[];
  customIsolations?: any;
  stationContextNote?: string;
  rule?: any;
  createdAt?: any;
}

/* ==========================================================================
   COURSES CRUD
   ========================================================================== */

export async function createCourse(data: Omit<CourseDoc, "id" | "createdAt">): Promise<string> {
  const currentUid = auth.currentUser?.uid;
  const ref = await addDoc(collection(db, "courses"), {
    ...data,
    teacherId: data.teacherId || currentUid || "admin",
    groupIds: data.groupIds || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCourses(teacherId?: string): Promise<CourseDoc[]> {
  const currentTeacherId = teacherId || auth.currentUser?.uid;

  try {
    const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const all = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<CourseDoc, "id">),
    }));

    if (currentTeacherId) {
      return all.filter((c) => !c.teacherId || c.teacherId === currentTeacherId);
    }
    return all;
  } catch (error) {
    console.warn("Index warning in getCourses, falling back to un-ordered query:", error);
    const snap = await getDocs(collection(db, "courses"));
    const all = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<CourseDoc, "id">),
    }));

    if (currentTeacherId) {
      return all.filter((c) => !c.teacherId || c.teacherId === currentTeacherId);
    }
    return all;
  }
}

export async function getCourseById(courseId: string): Promise<CourseDoc | null> {
  const docSnap = await getDoc(doc(db, "courses", courseId));
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CourseDoc, "id">),
  };
}

export async function updateCourse(courseId: string, data: Partial<CourseDoc>): Promise<void> {
  const docRef = doc(db, "courses", courseId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  await deleteDoc(doc(db, "courses", courseId));
}

/* ==========================================================================
   MODULES CRUD
   ========================================================================== */

export async function createModule(data: Omit<ModuleDoc, "id" | "createdAt">): Promise<string> {
  const currentUid = auth.currentUser?.uid;
  const ref = await addDoc(collection(db, "modules"), {
    ...data,
    teacherId: data.teacherId || currentUid || "admin",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getModulesByCourse(courseId: string): Promise<ModuleDoc[]> {
  try {
    const q = query(
      collection(db, "modules"),
      where("courseId", "==", courseId),
      orderBy("order", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ModuleDoc, "id">),
    }));
  } catch (error) {
    console.warn("Index fallback for getModulesByCourse:", error);
    const q = query(collection(db, "modules"), where("courseId", "==", courseId));
    const snap = await getDocs(q);
    const list = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ModuleDoc, "id">),
    }));
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

export async function getModuleById(moduleId: string): Promise<ModuleDoc | null> {
  const docRef = doc(db, "modules", moduleId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ModuleDoc, "id">),
  };
}

export async function updateModule(moduleId: string, data: Partial<ModuleDoc>): Promise<void> {
  const docRef = doc(db, "modules", moduleId);
  await updateDoc(docRef, data);
}

export async function updateModuleVisibility(moduleId: string, isVisible: boolean): Promise<void> {
  const docRef = doc(db, "modules", moduleId);
  await updateDoc(docRef, { isVisible });
}

export async function deleteModule(moduleId: string): Promise<void> {
  await deleteDoc(doc(db, "modules", moduleId));
}

/* ==========================================================================
   ACTIVITIES CRUD
   ========================================================================== */

export async function createActivity(data: Omit<ActivityDoc, "id" | "createdAt">): Promise<string> {
  const currentUid = auth.currentUser?.uid;
  const ref = await addDoc(collection(db, "activities"), {
    ...data,
    teacherId: data.teacherId || currentUid || "admin",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getActivitiesByCourse(courseId: string): Promise<ActivityDoc[]> {
  try {
    const q = query(
      collection(db, "activities"),
      where("courseId", "==", courseId),
      orderBy("order", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ActivityDoc, "id">),
    }));
  } catch (error) {
    console.warn("Index fallback for getActivitiesByCourse:", error);
    const q = query(collection(db, "activities"), where("courseId", "==", courseId));
    const snap = await getDocs(q);
    const list = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ActivityDoc, "id">),
    }));
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

export async function getActivityById(activityId: string): Promise<ActivityDoc | null> {
  const docRef = doc(db, "activities", activityId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ActivityDoc, "id">),
  };
}

export async function updateActivity(activityId: string, data: Partial<ActivityDoc>): Promise<void> {
  const docRef = doc(db, "activities", activityId);
  await updateDoc(docRef, data);
}

export async function updateActivityVisibility(activityId: string, isVisible: boolean): Promise<void> {
  const docRef = doc(db, "activities", activityId);
  await updateDoc(docRef, { isVisible });
}

export async function deleteActivity(activityId: string): Promise<void> {
  await deleteDoc(doc(db, "activities", activityId));
}

export async function getTargetingPresets(): Promise<CustomIsolationRule[]> {
  try {
    const snap = await getDocs(collection(db, "targetingPresets"));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<CustomIsolationRule, "id">),
    }));
  } catch (error) {
    console.warn("getTargetingPresets warning:", error);
    return [];
  }
}

export async function fetchTargetingPresets(): Promise<TargetingPreset[]> {
  try {
    const snap = await getDocs(collection(db, "targetingPresets"));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<TargetingPreset, "id">),
    }));
  } catch (error) {
    console.warn("fetchTargetingPresets warning:", error);
    return [];
  }
}

export async function saveTargetingPreset(
  nameOrData: string | Omit<TargetingPreset, "id" | "createdAt">,
  rule?: CustomIsolationRule
): Promise<string> {
  let payload: any;
  if (typeof nameOrData === "string") {
    payload = {
      name: nameOrData,
      rule,
      createdAt: serverTimestamp(),
    };
  } else {
    payload = {
      ...nameOrData,
      createdAt: serverTimestamp(),
    };
  }

  const ref = await addDoc(collection(db, "targetingPresets"), payload);
  return ref.id;
}
