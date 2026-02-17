"use client";
import { createContext, useContext } from "react";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

/**
 * Provides the Firebase app, Firestore, and Auth instances to the component tree.
 *
 * This provider should be used at the root of the client-side component tree.
 *
 * @see FirebaseClientProvider
 */
export function FirebaseProvider({
  children,
  ...value
}: {
  children: React.ReactNode;
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}) {
  return (
    <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>
  );
}

/**
 * Returns the Firebase app, Firestore, and Auth instances.
 *
 * This hook must be used within a FirebaseProvider.
 *
 * @returns The Firebase app, Firestore, and Auth instances.
 */
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider.");
  }
  return context;
}

/**
 * Returns the Firebase app instance.
 *
 * This hook must be used within a FirebaseProvider.
 *
 * @returns The Firebase app instance.
 */
export function useFirebaseApp() {
  return useFirebase().firebaseApp;
}

/**
 * Returns the Firestore instance.
 *
 * This hook must be used within a FirebaseProvider.
 *
 * @returns The Firestore instance.
 */
export function useFirestore() {
  return useFirebase().firestore;
}

/**
 * Returns the Auth instance.
 *
 * This hook must be used within a FirebaseProvider.
 *
 * @returns The Auth instance.
 */
export function useAuth() {
  return useFirebase().auth;
}
