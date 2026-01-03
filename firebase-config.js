// ============ FIREBASE CONFIGURATION ============
// Replace these values with your Firebase project config
// Get these from: https://console.firebase.google.com > Project Settings > Your apps > Web app

const firebaseConfig = {
    apiKey: "AIzaSyAIBoDp4GadKl73-Z6cEecmiuBEMGqH7Sk",
    authDomain: "my-productive-hub-project.firebaseapp.com",
    projectId: "my-productive-hub-project",
    storageBucket: "my-productive-hub-project.firebasestorage.app",
    messagingSenderId: "205730777384",
    appId: "1:205730777384:web:68875558262cd603c0e81d",
    measurementId: "G-LPNYGQVB26"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence for Firestore (using newer settings API)
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true
});

// Enable persistence with multi-tab support
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence not available');
        }
    });

// ============ AUTH STATE MANAGEMENT ============
let currentUser = null;

// Auth state observer
let authStateResolved = false;
let authReadyResolve;
const authReadyPromise = new Promise((resolve) => {
    authReadyResolve = resolve;
});

auth.onAuthStateChanged((user) => {
    currentUser = user;

    // Resolve the promise on first auth state
    if (!authStateResolved) {
        authStateResolved = true;
        authReadyResolve(user);
    }

    if (user) {
        console.log('User signed in:', user.email);
        // Dispatch custom event for other scripts to listen to
        window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
    } else {
        console.log('User signed out');
        window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null } }));
        // Only redirect if not on login page and auth state has been checked
        const isLoginPage = window.location.pathname.includes('login.html') ||
            window.location.pathname.endsWith('login') ||
            window.location.href.includes('login.html');
        if (!isLoginPage) {
            window.location.href = 'login.html';
        }
    }
});

// ============ AUTH FUNCTIONS ============

async function signUp(email, password, displayName) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName });

        // Create user document in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            email: email,
            displayName: displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            settings: {
                theme: 'dark',
                defaultWorkTime: 25,
                defaultRestTime: 5
            }
        });

        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
}

async function signIn(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);

        // Check if new user, create document
        const userDoc = await db.collection('users').doc(result.user.uid).get();
        if (!userDoc.exists) {
            await db.collection('users').doc(result.user.uid).set({
                email: result.user.email,
                displayName: result.user.displayName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                settings: {
                    theme: 'dark',
                    defaultWorkTime: 25,
                    defaultRestTime: 5
                }
            });
        }

        return { success: true, user: result.user };
    } catch (error) {
        console.error('Google sign in error:', error);
        return { success: false, error: error.message };
    }
}

async function signOutUser() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

async function resetPassword(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, error: error.message };
    }
}

// ============ DATABASE HELPER FUNCTIONS ============

function getUserRef() {
    if (!currentUser) return null;
    return db.collection('users').doc(currentUser.uid);
}

function getTasksRef() {
    const userRef = getUserRef();
    if (!userRef) return null;
    return userRef.collection('tasks');
}

function getPomodoroRef() {
    const userRef = getUserRef();
    if (!userRef) return null;
    return userRef.collection('pomodoro').doc('state');
}

function getCanvasesRef() {
    const userRef = getUserRef();
    if (!userRef) return null;
    return userRef.collection('canvases');
}

function getTrackersRef() {
    const userRef = getUserRef();
    if (!userRef) return null;
    return userRef.collection('trackers');
}

function getTagColorsRef() {
    const userRef = getUserRef();
    if (!userRef) return null;
    return userRef.collection('tagColors');
}

// Function to wait for auth to be ready (with timeout)
async function waitForAuth() {
    // Return immediately if already resolved
    if (authStateResolved) {
        return currentUser;
    }

    // Wait for auth with a 3 second timeout
    return Promise.race([
        authReadyPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
}

// Function to hide loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContainer = document.getElementById('appContainer');

    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
    if (appContainer) {
        appContainer.style.display = 'flex';
    }
}

// ALWAYS hide loading screen after 2 seconds maximum (failsafe)
setTimeout(() => {
    hideLoadingScreen();
}, 2000);

// Export for use in other files
window.firebaseApp = {
    auth,
    db,
    storage,
    signUp,
    signIn,
    signInWithGoogle,
    signOutUser,
    resetPassword,
    getUserRef,
    getTasksRef,
    getPomodoroRef,
    getCanvasesRef,
    getTrackersRef,
    getTagColorsRef,
    waitForAuth,
    hideLoadingScreen,
    get currentUser() { return currentUser; },
    get isAuthResolved() { return authStateResolved; }
};
