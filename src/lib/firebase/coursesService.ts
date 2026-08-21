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
import { db } from "@/lib/firebase/config";

export interface CourseDoc {
  id?: string;
  title: string;
  description: string;
  groupIds?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface ModuleDoc {
  id?: string;
  courseId: string;
  title: string;
  order: number;
  isVisible: boolean;
  groupIds?: string[];
  excludedStudentIds?: string[];
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
  type: "pdf" | "video";
  url: string;
  description?: string;
  latexContent?: string;
}

export interface ActivityDoc {
  id?: string;
  moduleId: string;
  courseId: string;
  type: "lesson" | "practice" | "exam";
  title: string;
  description?: string;
  isVisible: boolean;
  order: number;
  videos?: string[];
  attachments?: (string | AttachmentItem)[];
  requireSubmission?: boolean;
  hasQuiz?: boolean;
  quiz?: QuizQuestionItem[];
  allowedStudentIds?: string[];
  groupIds?: string[];
  excludedStudentIds?: string[];
  deadline?: string;
  isSubmissionsPaused?: boolean;
  hiddenTeacherDirectives?: string;
  createdAt?: any;
}

/* ==========================================================================
   COURSES CRUD
   ========================================================================== */

export async function createCourse(data: Omit<CourseDoc, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "courses"), {
    ...data,
    groupIds: data.groupIds || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCourses(): Promise<CourseDoc[]> {
  try {
    const q = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<CourseDoc, "id">),
    }));
  } catch (error) {
    // Fallback if index not ready
    console.warn("Index warning in getCourses, falling back to un-ordered query:", error);
    const snap = await getDocs(collection(db, "courses"));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<CourseDoc, "id">),
    }));
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
  const ref = await addDoc(collection(db, "modules"), {
    ...data,
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

export async function updateModuleVisibility(moduleId: string, isVisible: boolean): Promise<void> {
  const docRef = doc(db, "modules", moduleId);
  await updateDoc(docRef, { isVisible });
}

export async function updateModule(moduleId: string, data: Partial<ModuleDoc>): Promise<void> {
  const docRef = doc(db, "modules", moduleId);
  await updateDoc(docRef, data);
}

export async function deleteModule(moduleId: string): Promise<void> {
  await deleteDoc(doc(db, "modules", moduleId));
}

/* ==========================================================================
   ACTIVITIES CRUD
   ========================================================================== */

export async function createActivity(data: Omit<ActivityDoc, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "activities"), {
    ...data,
    videos: data.videos || [],
    attachments: data.attachments || [],
    requireSubmission: data.requireSubmission || false,
    hasQuiz: data.hasQuiz || false,
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

export async function updateActivityVisibility(activityId: string, isVisible: boolean): Promise<void> {
  const docRef = doc(db, "activities", activityId);
  await updateDoc(docRef, { isVisible });
}

export async function updateActivity(activityId: string, data: Partial<ActivityDoc>): Promise<void> {
  const docRef = doc(db, "activities", activityId);
  await updateDoc(docRef, data);
}

export async function deleteActivity(activityId: string): Promise<void> {
  await deleteDoc(doc(db, "activities", activityId));
}
