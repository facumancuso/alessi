
import { getApp, getApps, initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFirebaseConfig } from './config';

export * from './provider';

/**
 * Initializes the Firebase app, Firestore, and Auth instances.
 *
 * This function should be called once at the root of the client-side component tree.
 *
 * @returns The Firebase app, Firestore, and Auth instances.
 */
export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  const firebaseApp = !getApps().length
    ? initializeApp(getFirebaseConfig())
    : getApp();
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  // Connect to emulators in development
  if (process.env.NODE_ENV === 'development') {
    // Es importante verificar que no nos conectemos múltiples veces
    // @ts-ignore - _isInitialized is a private property but useful here
    if (!auth._isInitialized) {
      try {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        console.log("Auth Emulator connected");
      } catch (e) {
        console.error("Auth Emulator connection failed. Is it running?", e);
      }
    }
    
    // @ts-ignore
    if (!firestore._isInitialized) {
       try {
        connectFirestoreEmulator(firestore, 'localhost', 8081);
        console.log("Firestore Emulator connected");
       } catch (e) {
        // No hacer nada, si falla, es probable que ya esté conectado.
       }
    }
  }

  return { firebaseApp, firestore, auth };
}
