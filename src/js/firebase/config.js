import { initializeApp as initFirebaseApp } from "firebase/app";
import { initializeAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, inMemoryPersistence } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

window.showToast = function(msg, isError = true) {
    const toast = document.getElementById('toast-notification');
    toast.innerText = msg;
    toast.style.background = isError ? 'var(--error-border)' : 'var(--grammar-border)';
    toast.style.top = '20px';
    setTimeout(() => { toast.style.top = '-100px'; }, 4000);
}

export function setupFirebase() {
    let db = null;
    let currentUser = null;
    let appId = 'default-app-id';
    let previousUid = null;

    try {
        let firebaseConfig = null;
        let isExternalConfig = false;

        if (window.EXTERNAL_FIREBASE_CONFIG && window.EXTERNAL_FIREBASE_CONFIG.apiKey && window.EXTERNAL_FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
            firebaseConfig = window.EXTERNAL_FIREBASE_CONFIG;
            appId = 'my-external-app';
            isExternalConfig = true;
        } else if (typeof __firebase_config !== 'undefined' && __firebase_config) {
            try {
                const parsedConfig = JSON.parse(__firebase_config);
                if (parsedConfig && parsedConfig.apiKey) {
                    firebaseConfig = parsedConfig;
                    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                }
            } catch (e) { console.warn("Could not parse environment Firebase config."); }
        }

        if (firebaseConfig) {
            const app = initFirebaseApp(firebaseConfig);
            
            const auth = initializeAuth(app, {
                persistence: inMemoryPersistence
            });
            
            db = getFirestore(app);

            const initAuth = async () => {
                try {
                    if (!isExternalConfig && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Auth Init Error:", e);
                    setTimeout(() => {
                        if (e.code === 'auth/operation-not-allowed') {
                            window.showToast("Setup Required: Enable 'Anonymous' Sign-in in Firebase Console.");
                        } else if (e.code === 'auth/configuration-not-found') {
                            window.showToast("Setup Required: Click 'Get Started' in Firebase Console > Authentication.");
                        } else {
                            window.showToast("Auth Error: " + e.message);
                        }
                    }, 1500);
                }
            };
            initAuth();
            
            onAuthStateChanged(auth, user => { 
                currentUser = user; 
                window.currentUser = user;
                if (previousUid && user && previousUid !== user.uid) {
                    if (typeof window.startNewProject === 'function') window.startNewProject(true);
                }
                if (user) {
                    previousUid = user.uid;
                    if (typeof window.loadCustomDictionary === 'function') window.loadCustomDictionary();
                }
            });

            window.db = db;
            window.auth = auth;
            window.firebaseDoc = doc; window.firebaseSetDoc = setDoc; window.firebaseGetDoc = getDoc;
            window.firebaseCollection = collection; window.firebaseGetDocs = getDocs; window.firebaseDeleteDoc = deleteDoc;
            window.firebaseCreateUser = createUserWithEmailAndPassword; window.firebaseSignIn = signInWithEmailAndPassword;
            window.firebaseSignOut = signOut; window.firebaseSignInAnon = signInAnonymously;
            window.appId = appId;
        } else {
            console.warn("Running externally: Please insert your Firebase config to enable cloud saving.");
        }
    } catch (e) {
        console.error("Firebase setup failed:", e);
    }
}
