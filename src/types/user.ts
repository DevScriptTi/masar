export type UserRole = "super_admin" | "teacher" | "student";
export type AccountStatus = "pending" | "active" | "suspended";

export interface User {
  uid: string; // Matches Firebase Auth UID
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  teacherId?: string; // MANDATORY if role is 'student'
  createdAt: number; // Timestamp
}
