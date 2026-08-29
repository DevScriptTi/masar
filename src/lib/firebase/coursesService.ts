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
  writeBatch,
  DocumentReference,
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
  challenge?: string; // نص التمرين (The Challenge)
  content?: string; // Backwards compatible with challenge
  groundTruth?: string; // الحل النموذجي (Ground Truth)
  pedagogyRules?: string; // التوصيات البيداغوجية وقواعد الوكيل (Pedagogy & Guardrails)
  aiDirectives?: string; // Backwards compatible with pedagogyRules
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

/* ==========================================================================
   DEEP CASCADING DELETION HELPERS (Cloudinary Cleanup & Batch Chunking)
   ========================================================================== */

function harvestAssetUrlsFromObject(obj: any, urlsSet: Set<string>): void {
  if (!obj) return;
  if (typeof obj === "string") {
    if (obj.includes("cloudinary.com")) {
      urlsSet.add(obj);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item) => harvestAssetUrlsFromObject(item, urlsSet));
    return;
  }
  if (typeof obj === "object") {
    Object.values(obj).forEach((val) => harvestAssetUrlsFromObject(val, urlsSet));
  }
}

async function cleanupCloudinaryAssets(urls: string[]): Promise<void> {
  const validUrls = urls.filter((u) => typeof u === "string" && u.includes("cloudinary.com"));
  if (validUrls.length === 0) return;

  try {
    const res = await fetch("/api/cloudinary/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: validUrls }),
    });
    const result = await res.json();
    console.log("Deep Cascading Cloudinary Cleanup Result:", result);
  } catch (err) {
    console.warn("Failed to trigger Cloudinary deletion API:", err);
  }
}

async function commitBatchDeletions(docRefs: DocumentReference[]): Promise<void> {
  if (docRefs.length === 0) return;

  const uniqueRefsMap = new Map<string, DocumentReference>();
  docRefs.forEach((ref) => uniqueRefsMap.set(ref.path, ref));
  const uniqueRefs = Array.from(uniqueRefsMap.values());

  const CHUNK_SIZE = 450;
  for (let i = 0; i < uniqueRefs.length; i += CHUNK_SIZE) {
    const chunk = uniqueRefs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function harvestAndGatherActivityDeleteQueue(
  activityId: string,
  urlsSet: Set<string>,
  docRefsToDelete: DocumentReference[]
): Promise<void> {
  const activityRef = doc(db, "activities", activityId);
  const activitySnap = await getDoc(activityRef);

  if (activitySnap.exists()) {
    harvestAssetUrlsFromObject(activitySnap.data(), urlsSet);
    docRefsToDelete.push(activityRef);
  }

  // 1. Submissions for this activity
  try {
    const subQuery = query(collection(db, "submissions"), where("activityId", "==", activityId));
    const subSnap = await getDocs(subQuery);
    subSnap.docs.forEach((d) => {
      harvestAssetUrlsFromObject(d.data(), urlsSet);
      docRefsToDelete.push(d.ref);
    });
  } catch (err) {
    console.warn("Error querying submissions for deletion:", err);
  }

  // 2. Chat Sessions for this activity
  try {
    const chatQuery = query(collection(db, "chatSessions"), where("activityId", "==", activityId));
    const chatSnap = await getDocs(chatQuery);
    chatSnap.docs.forEach((d) => {
      harvestAssetUrlsFromObject(d.data(), urlsSet);
      docRefsToDelete.push(d.ref);
    });
  } catch (err) {
    console.warn("Error querying chatSessions for deletion:", err);
  }

  // 3. Messages for this activity
  try {
    const msgQuery = query(collection(db, "messages"), where("activityId", "==", activityId));
    const msgSnap = await getDocs(msgQuery);
    msgSnap.docs.forEach((d) => {
      harvestAssetUrlsFromObject(d.data(), urlsSet);
      docRefsToDelete.push(d.ref);
    });
  } catch (err) {
    console.warn("Error querying messages for deletion:", err);
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  const urlsSet = new Set<string>();
  const docRefsToDelete: DocumentReference[] = [];

  // Harvest Course doc
  const courseRef = doc(db, "courses", courseId);
  const courseSnap = await getDoc(courseRef);
  if (courseSnap.exists()) {
    harvestAssetUrlsFromObject(courseSnap.data(), urlsSet);
    docRefsToDelete.push(courseRef);
  }

  // Harvest Child Modules
  try {
    const modQuery = query(collection(db, "modules"), where("courseId", "==", courseId));
    const modSnap = await getDocs(modQuery);
    modSnap.docs.forEach((d) => {
      harvestAssetUrlsFromObject(d.data(), urlsSet);
      docRefsToDelete.push(d.ref);
    });
  } catch (err) {
    console.warn("Error querying modules for course deletion:", err);
  }

  // Harvest Child Activities & all subcomponents
  try {
    const actQuery = query(collection(db, "activities"), where("courseId", "==", courseId));
    const actSnap = await getDocs(actQuery);
    for (const actDoc of actSnap.docs) {
      await harvestAndGatherActivityDeleteQueue(actDoc.id, urlsSet, docRefsToDelete);
    }
  } catch (err) {
    console.warn("Error querying activities for course deletion:", err);
  }

  // 1. Delete Cloudinary assets FIRST
  await cleanupCloudinaryAssets(Array.from(urlsSet));

  // 2. Perform Firestore WriteBatch Delete
  await commitBatchDeletions(docRefsToDelete);
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
  const urlsSet = new Set<string>();
  const docRefsToDelete: DocumentReference[] = [];

  // Harvest Module doc
  const moduleRef = doc(db, "modules", moduleId);
  const moduleSnap = await getDoc(moduleRef);
  if (moduleSnap.exists()) {
    harvestAssetUrlsFromObject(moduleSnap.data(), urlsSet);
    docRefsToDelete.push(moduleRef);
  }

  // Harvest Child Activities
  try {
    const actQuery = query(collection(db, "activities"), where("moduleId", "==", moduleId));
    const actSnap = await getDocs(actQuery);
    for (const actDoc of actSnap.docs) {
      await harvestAndGatherActivityDeleteQueue(actDoc.id, urlsSet, docRefsToDelete);
    }
  } catch (err) {
    console.warn("Error querying activities for module deletion:", err);
  }

  // 1. Delete Cloudinary assets FIRST
  await cleanupCloudinaryAssets(Array.from(urlsSet));

  // 2. Perform Firestore WriteBatch Delete
  await commitBatchDeletions(docRefsToDelete);
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
  const urlsSet = new Set<string>();
  const docRefsToDelete: DocumentReference[] = [];

  await harvestAndGatherActivityDeleteQueue(activityId, urlsSet, docRefsToDelete);

  // 1. Delete Cloudinary assets FIRST
  await cleanupCloudinaryAssets(Array.from(urlsSet));

  // 2. Perform Firestore WriteBatch Delete
  await commitBatchDeletions(docRefsToDelete);
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
