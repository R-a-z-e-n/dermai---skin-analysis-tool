import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  Auth, 
  browserPopupRedirectResolver, 
  setPersistence, 
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;

// Helper to check if config is valid
const isConfigValid = (config: any) => {
  return config.apiKey && 
         config.apiKey !== "undefined" && 
         config.apiKey !== "" &&
         config.authDomain && 
         config.authDomain !== "undefined" &&
         config.authDomain !== "";
};

if (isConfigValid(firebaseConfig)) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    
    // Set persistence to local (persists across sessions)
    setPersistence(auth, browserLocalPersistence)
      .catch(err => console.error("Firebase persistence setup failed:", err));

    googleProvider = new GoogleAuthProvider();
    // Ensure the provider is always fresh and has the right parameters
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export { auth, googleProvider, browserPopupRedirectResolver };
