"use client";

import { initializeFirebase } from ".";
import { FirebaseProvider } from "./provider";

/**
 * Provides the Firebase app, Firestore, and Auth instances to the client-side of the app.
 *
 * This provider should be used at the root of the client-side component tree.
 */
export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FirebaseProvider {...initializeFirebase()}>{children}</FirebaseProvider>;
}
