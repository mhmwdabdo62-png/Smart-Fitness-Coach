/**
 * Smart-Fitness-Coach - Firebase Configuration & Real-Time Sync Manager
 * Supports Google Firebase (Auth, Firestore, Cloud Storage) with live cloud sync
 * and resilient local caching for offline gym environments.
 */

// Load saved credentials from localStorage or use placeholder
export const getFirebaseConfig = () => ({
  apiKey: localStorage.getItem("sfc_fb_api_key") || "",
  authDomain: localStorage.getItem("sfc_fb_auth_domain") || "",
  projectId: localStorage.getItem("sfc_fb_project_id") || "",
  storageBucket: localStorage.getItem("sfc_fb_storage_bucket") || "",
  messagingSenderId: localStorage.getItem("sfc_fb_msg_sender_id") || "",
  appId: localStorage.getItem("sfc_fb_app_id") || ""
});

// Firestore Collections Constants
export const COLLECTIONS = {
  USERS: 'users',
  WORKOUTS: 'workouts',
  MEALS: 'meals',
  SUPPLEMENTS: 'supplements',
  PHYSIQUE_LOGS: 'physique_logs',
  DAILY_LOGS: 'daily_logs'
};

/**
 * Local Cache and Fallback DB
 */
class LocalStorageMockDB {
  constructor() {
    this.prefix = 'sfc_db_';
  }

  _getKey(collection, docId) {
    return `${this.prefix}${collection}_${docId}`;
  }

  async getDoc(collection, docId) {
    const raw = localStorage.getItem(this._getKey(collection, docId));
    return raw ? JSON.parse(raw) : null;
  }

  async setDoc(collection, docId, data, merge = true) {
    const key = this._getKey(collection, docId);
    let finalData = data;
    if (merge) {
      const existing = await this.getDoc(collection, docId) || {};
      finalData = { ...existing, ...data, updatedAt: new Date().toISOString() };
    }
    localStorage.setItem(key, JSON.stringify(finalData));
    return finalData;
  }

  async queryCollection(collection, filterFn = null) {
    const results = [];
    const collPrefix = `${this.prefix}${collection}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(collPrefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (!filterFn || filterFn(item)) {
            results.push(item);
          }
        } catch (e) {
          console.error("Local doc parse error", e);
        }
      }
    }
    return results;
  }
}

export const localDB = new LocalStorageMockDB();

/**
 * Main Firebase Manager
 */
export class FirebaseManager {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.storage = null;
    this.isLiveFirebase = false;
    this.currentUser = null;
    this.authListeners = [];
  }

  async initialize() {
    const config = getFirebaseConfig();

    if (window.firebase && config.apiKey && config.projectId) {
      try {
        if (!window.firebase.apps.length) {
          this.app = window.firebase.initializeApp(config);
        } else {
          this.app = window.firebase.app();
        }
        this.auth = window.firebase.auth();
        this.db = window.firebase.firestore();
        this.storage = window.firebase.storage();
        this.isLiveFirebase = true;
        console.log("🔥 Successfully connected to live Firebase Project:", config.projectId);

        // Listen for Auth state changes
        this.auth.onAuthStateChanged(async (firebaseUser) => {
          this.currentUser = firebaseUser;
          this.notifyAuthListeners(firebaseUser);
        });
      } catch (err) {
        console.warn("⚠️ Firebase Live initialization failed, operating in Local/Offline mode:", err.message);
        this.isLiveFirebase = false;
      }
    } else {
      console.log("ℹ️ Running in Local/Demo Mode. Connect Firebase in Settings anytime.");
      this.isLiveFirebase = false;
    }
    return this;
  }

  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    if (this.currentUser) callback(this.currentUser);
  }

  notifyAuthListeners(user) {
    this.authListeners.forEach(fn => {
      try { fn(user); } catch (e) { console.error("Auth listener error", e); }
    });
  }

  /**
   * Google Sign-in with Firebase Auth
   */
  async signInWithGoogle() {
    if (this.isLiveFirebase && this.auth && window.firebase) {
      try {
        const provider = new window.firebase.auth.GoogleAuthProvider();
        const result = await this.auth.signInWithPopup(provider);
        this.currentUser = result.user;
        return {
          uid: result.user.uid,
          name: result.user.displayName || "رياضي",
          email: result.user.email,
          photoURL: result.user.photoURL,
          isLive: true
        };
      } catch (err) {
        console.warn("Google Sign-in popup error, checking redirect or local fallback:", err);
        throw err;
      }
    } else {
      // Seamless Demo Google Sign-In Simulation
      const demoUser = {
        uid: "google_user_" + Date.now().toString(36),
        name: "محمود حسن",
        email: "mahmoud.gym@gmail.com",
        photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
        isLive: false
      };
      this.currentUser = demoUser;
      this.notifyAuthListeners(demoUser);
      return demoUser;
    }
  }

  /**
   * Guest / Offline Sign-in
   */
  signInAsGuest(customName = "كابتن") {
    const guestUser = {
      uid: "guest_" + Date.now().toString(36),
      name: customName,
      email: `${customName.toLowerCase()}@localgym.app`,
      photoURL: "",
      isLive: false,
      isGuest: true
    };
    this.currentUser = guestUser;
    this.notifyAuthListeners(guestUser);
    return guestUser;
  }

  async signOut() {
    if (this.isLiveFirebase && this.auth) {
      await this.auth.signOut();
    }
    this.currentUser = null;
    this.notifyAuthListeners(null);
  }

  /**
   * Save User Profile to Firestore (and Local Cache)
   */
  async saveUserProfile(userId, profileData) {
    await localDB.setDoc(COLLECTIONS.USERS, userId, profileData);

    if (this.isLiveFirebase && this.db) {
      try {
        await this.db.collection(COLLECTIONS.USERS).doc(userId).set(profileData, { merge: true });
        console.log("☁️ User profile synced to Cloud Firestore.");
      } catch (e) {
        console.warn("Firestore sync error (offline?):", e);
      }
    }
  }

  /**
   * Load User Profile from Firestore (or Local Cache)
   */
  async getUserProfile(userId) {
    if (this.isLiveFirebase && this.db) {
      try {
        const snap = await this.db.collection(COLLECTIONS.USERS).doc(userId).get();
        if (snap.exists) return snap.data();
      } catch (e) {
        console.warn("Firestore read error, reading local cache:", e);
      }
    }
    return await localDB.getDoc(COLLECTIONS.USERS, userId);
  }

  /**
   * Sync Daily Workout Session to Firestore
   */
  async saveWorkoutSession(workout) {
    const docId = workout.id || `w_${Date.now()}`;
    await localDB.setDoc(COLLECTIONS.WORKOUTS, docId, workout);

    if (this.isLiveFirebase && this.db) {
      try {
        await this.db.collection(COLLECTIONS.WORKOUTS).doc(docId).set(workout);
        console.log("☁️ Workout synced to Cloud Firestore.");
      } catch (e) {
        console.warn("Failed syncing workout to Firestore:", e);
      }
    }
  }

  /**
   * Save Logged Meal to Firestore
   */
  async saveMeal(meal) {
    const docId = meal.id || `m_${Date.now()}`;
    await localDB.setDoc(COLLECTIONS.MEALS, docId, meal);

    if (this.isLiveFirebase && this.db) {
      try {
        await this.db.collection(COLLECTIONS.MEALS).doc(docId).set(meal);
        console.log("☁️ Meal synced to Cloud Firestore.");
      } catch (e) {
        console.warn("Failed syncing meal to Firestore:", e);
      }
    }
  }

  /**
   * Save Weekly Physique Check-in to Firestore
   */
  async savePhysiqueCheckin(checkin) {
    const docId = checkin.id || `chk_${Date.now()}`;
    await localDB.setDoc(COLLECTIONS.PHYSIQUE_LOGS, docId, checkin);

    if (this.isLiveFirebase && this.db) {
      try {
        await this.db.collection(COLLECTIONS.PHYSIQUE_LOGS).doc(docId).set(checkin);
        console.log("☁️ Physique check-in synced to Cloud Firestore.");
      } catch (e) {
        console.warn("Failed syncing checkin to Firestore:", e);
      }
    }
  }

  /**
   * Save and Apply Firebase Credentials from UI
   */
  saveCredentials(config) {
    if (config.apiKey) localStorage.setItem("sfc_fb_api_key", config.apiKey.trim());
    if (config.authDomain) localStorage.setItem("sfc_fb_auth_domain", config.authDomain.trim());
    if (config.projectId) localStorage.setItem("sfc_fb_project_id", config.projectId.trim());
    if (config.storageBucket) localStorage.setItem("sfc_fb_storage_bucket", config.storageBucket.trim());
    if (config.appId) localStorage.setItem("sfc_fb_app_id", config.appId.trim());
    return this.initialize();
  }
}

export const fbManager = new FirebaseManager();
