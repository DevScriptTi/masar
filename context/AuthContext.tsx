"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

export interface UserDocument {
  uid: string;
  email: string | null;
  role: "admin" | "student" | string;
  displayName?: string | null;
  createdAt?: any;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserDocument | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // STRICT RULE: Initial state MUST be null. No mock data.
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          // Fetch user document from Firestore 'users' collection
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data() as UserDocument);
          } else {
            // User exists in Auth, but has no Firestore document
            setUserData(null);
          }
        } else {
          // Not logged in
          setUser(null);
          setUserData(null);
        }
      } catch (error) {
        console.error("Error fetching user data from Firestore:", error);
        setUserData(null);
      } finally {
        // ALWAYS called in finally block to prevent infinite loading state
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
