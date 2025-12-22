import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, onSnapshot } from "firebase/firestore";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDcFkBP_jfuWAAW8NwUzO0UpcifIcfb6iM",
  authDomain: "iic-nst.firebaseapp.com",
  databaseURL: "https://iic-nst-default-rtdb.firebaseio.com",
  projectId: "iic-nst",
  storageBucket: "iic-nst.appspot.com", // ✅ Corrected
  messagingSenderId: "984309241322",
  appId: "1:984309241322:web:2687c7b06bd8da3ee64e93",
};

// 🔥 Initialize app
export const app = initializeApp(firebaseConfig);

// 🔑 Services
export const auth = getAuth(app);
export const rtdb = getDatabase(app);    // Realtime Database: Notes/MCQ ke liye (Mapped to rtdb for existing code)
export const db = getFirestore(app);     // Firestore: User list ke liye (Mapped to db for existing code)

// Helper for Realtime Connection Check (Matches existing usage)
let isConnected = false;
const connectedRef = ref(rtdb, ".info/connected");
onValue(connectedRef, (snap) => {
    isConnected = !!snap.val();
});

export const checkFirebaseConnection = (): boolean => {
    return isConnected;
};

export const subscribeToConnection = (callback: (connected: boolean) => void) => {
    const connectedRef = ref(rtdb, ".info/connected");
    const unsub = onValue(connectedRef, (snap) => {
        const status = !!snap.val();
        isConnected = status;
        callback(status);
    });
    return unsub;
};

// Symbols saaf karne ke liye helper function
const sanitize = (key: string) => key.replace(/[.#$\[\]]/g, '_');

// --- 3. FIRESTORE FUNCTIONS (User Management ke liye) ---

// Naya user live database mein save karne ke liye
export const saveUserToLive = async (userData: any) => {
    try {
        // We use userData.id as doc ID
        await setDoc(doc(db, "users", userData.id), {
            ...userData,
            lastSeen: new Date().toISOString(),
            updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("✅ User Full Data Synced to Live!");
    } catch (e) {
        console.error("Firestore Error:", e);
    }
};

export const subscribeToUsers = (onUpdate: (users: any[]) => void) => {
    const q = collection(db, "users");
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users: any[] = [];
        querySnapshot.forEach((doc) => {
            users.push(doc.data());
        });
        onUpdate(users);
    });
    return unsubscribe;
};

export const updateUserStatus = async (userId: string, activeSeconds: number) => {
    try {
        await setDoc(doc(db, "users", userId), {
            lastSeen: new Date().toISOString(),
            dailyActiveSeconds: activeSeconds
        }, { merge: true });
    } catch (e) {
        console.error("Status Update Error:", e);
    }
};

export const saveTestResult = async (userId: string, result: any) => {
    try {
        const userRef = doc(db, "users", userId);
        // We use arrayUnion to add the new test result to the 'testHistory' array
        await updateDoc(userRef, {
            testHistory: arrayUnion(result),
            lastTestTaken: new Date().toISOString()
        });
        console.log("✅ Test Result Synced to Firestore!");
    } catch (e: any) {
        console.error("Test Sync Error:", e);
        // Fallback: If document doesn't exist or other error, try setDoc with merge
        if (e.code === 'not-found' || e.message.includes('No document to update')) {
             await setDoc(doc(db, "users", userId), {
                testHistory: [result],
                lastTestTaken: new Date().toISOString()
            }, { merge: true });
        }
    }
};

// --- NEW: FIRESTORE CONTENT FUNCTIONS (Requested by User) ---

export const saveContentToFirestore = async (key: string, data: any) => {
    try {
        // We use the key as the Document ID in 'content' collection
        // Also flattening the data to match requested schema if possible, or keeping structure
        await setDoc(doc(db, "content", sanitize(key)), {
            ...data,
            // Ensure these fields exist if not present
            premium: data.premiumLink || data.premiumVideoLink ? true : (data.premium || false),
            title: data.title || key,
            updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("✅ Content Saved to Firestore!");
    } catch (e) {
        console.error("Firestore Content Save Error:", e);
    }
};

export const getContentFromFirestore = async (key: string) => {
    try {
        const docRef = doc(db, "content", sanitize(key));
        const snap = await getDoc(docRef); // You need to import getDoc
        if (snap.exists()) {
            const val = snap.data();
            localStorage.setItem(key, JSON.stringify(val));
            return val;
        }
    } catch (e) {
        console.error("Firestore Content Read Error:", e);
    }
    return null;
};

// Notes/Content save karne ke liye (Legacy Support + Firestore Forwarding)
export const saveChapterData = async (key: string, data: any) => {
    // 1. Save to Firestore (Primary now)
    await saveContentToFirestore(key, data);

    // 2. Also save to RTDB for backward compatibility if needed, or fallback
    if (!rtdb) return;
    try {
        // @ts-ignore
        const { set, ref } = await import("firebase/database");
        await set(ref(rtdb, 'nst_content/' + sanitize(key)), data);
    } catch (e) {
        console.error("RTDB Save Error:", e);
        localStorage.setItem(key, JSON.stringify(data)); 
    }
};

// Cloud se data wapas dashboard mein laane ke liye
export const getChapterData = async (key: string) => {
    const local = localStorage.getItem(key);
    
    // 1. Try LocalStorage First (Optimization for lower reads)
    if (local) {
        // We return local immediately to save a DB read.
        // User can clear cache/re-login if they really need fresh content.
        return JSON.parse(local);
    }
    
    // 2. Try Firestore
    const firestoreData = await getContentFromFirestore(key);
    if (firestoreData) return firestoreData;

    // 3. Fallback to RTDB
    if (rtdb) {
        try {
            // @ts-ignore
            const { get, child, ref } = await import("firebase/database");
            const snapshot = await get(child(ref(rtdb), 'nst_content/' + sanitize(key)));
            if (snapshot.exists()) {
                const val = snapshot.val();
                localStorage.setItem(key, JSON.stringify(val)); 
                return val;
            }
        } catch (e) {
            console.error("Firebase Read Error:", e);
        }
    }
    
    return null;
};

// Bulk (ek saath bahut saara) data upload ke liye
export const bulkSaveLinks = async (updates: Record<string, any>) => {
    if (!rtdb) return;
    try {
        // @ts-ignore
        const { set, ref } = await import("firebase/database");
        const promises = Object.keys(updates).map(key => {
            return set(ref(rtdb, 'nst_content/' + sanitize(key)), updates[key]);
        });
        await Promise.all(promises);
        console.log("🚀 Bulk Upload Complete!");
    } catch (e) {
        console.error("Bulk Sync Error:", e);
    }
};

// --- 5. SYSTEM SETTINGS SYNC ---

export const saveSystemSettings = async (settings: any) => {
    if (!rtdb) return;
    try {
        // @ts-ignore
        const { set, ref } = await import("firebase/database");
        await set(ref(rtdb, 'nst_system_settings'), settings);
        console.log("✅ Settings Cloud Sync!");
    } catch (e) {
        console.error("Settings Sync Error:", e);
    }
};

export const subscribeToSettings = (onUpdate: (settings: any) => void) => {
    if (!rtdb) return () => {};
    const settingsRef = ref(rtdb, 'nst_system_settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            onUpdate(data);
            // Also update local storage for fallback
            localStorage.setItem('nst_system_settings', JSON.stringify(data));
        }
    });
    return unsubscribe;
};
