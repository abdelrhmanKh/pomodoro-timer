// ============ POMODORO TIMER APP ============

const timerEl = document.getElementById('timer');
const modeEl = document.getElementById('mode');
const startBtn = document.getElementById('start');
const restartBtn = document.getElementById('restart');
const activityTypeEl = document.getElementById('activityType');
const presetBtns = document.querySelectorAll('.preset-btn');
const cyclesBreakdownEl = document.getElementById('cyclesBreakdown');
const totalWorkTimeEl = document.getElementById('totalWorkTime');
const clearDataBtn = document.getElementById('clearDataBtn');
const clearModal = document.getElementById('clearModal');
const cancelClearBtn = document.getElementById('cancelClearBtn');
const confirmClearBtn = document.getElementById('confirmClearBtn');
const customModal = document.getElementById('customModal');
const closeCustomModal = document.getElementById('closeCustomModal');
const modalWorkTime = document.getElementById('modalWorkTime');
const modalRestTime = document.getElementById('modalRestTime');
const cancelCustomBtn = document.getElementById('cancelCustomBtn');
const confirmCustomBtn = document.getElementById('confirmCustomBtn');
const customPresetLabel = document.getElementById('customPresetLabel');
const customEditBtn = document.getElementById('customEditBtn');
const introModal = document.getElementById('introModal');
const skipIntroBtn = document.getElementById('skipIntroBtn');
const nextIntroBtn = document.getElementById('nextIntroBtn');
const reintroduceBtn = document.getElementById('reintroduceBtn');

// Default values
const DEFAULTS = { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60, sessionsBeforeLongBreak: 4 };

// Local storage keys
const STORAGE_KEY = 'pomodoroData';
const TIMER_SESSION_KEY = 'pomodoroSession';
const FIRST_TIME_KEY = 'pomodoroFirstTime';

// Firebase sync state
let pomodoroUnsubscribe = null;
let isSyncingFromFirebase = false;
let isInitialLoadComplete = false; // Prevent saving before Firebase data loads

// Introduction state
let currentIntroStep = 1;
const totalIntroSteps = 8;

// Introduction functions
function showIntroduction() {
    introModal.classList.remove('hidden');
    currentIntroStep = 1;
    updateIntroStep();
}

function hideIntroduction() {
    introModal.classList.add('hidden');
    localStorage.setItem(FIRST_TIME_KEY, 'false');
}

function updateIntroStep() {
    // Hide all steps
    document.querySelectorAll('.intro-step').forEach(step => {
        step.classList.remove('active');
    });

    // Show current step
    const currentStep = document.querySelector(`.intro-step[data-step="${currentIntroStep}"]`);
    if (currentStep) {
        currentStep.classList.add('active');
    }

    // Update dots
    document.querySelectorAll('.dot').forEach(dot => {
        dot.classList.remove('active');
    });
    const activeDot = document.querySelector(`.dot[data-dot="${currentIntroStep}"]`);
    if (activeDot) {
        activeDot.classList.add('active');
    }

    // Update button text
    if (currentIntroStep === totalIntroSteps) {
        nextIntroBtn.textContent = 'Get Started';
    } else {
        nextIntroBtn.textContent = 'Next';
    }
}

function nextIntroStep() {
    if (currentIntroStep < totalIntroSteps) {
        currentIntroStep++;
        updateIntroStep();
    } else {
        hideIntroduction();
    }
}

// Timer state
let remaining = DEFAULTS.work;
let mode = 'work';
let intervalId = null;
let isRunning = false;
let isTimerRunning = false; // Flag to track if timer is active (for floating timer)
let isWorkMode = true; // Flag to track current mode for floating timer
let workDuration = 25 * 60;  // in seconds
let restDuration = 5 * 60;   // in seconds
let currentActivityType = 'work';

// Timestamp-based timer tracking (to handle background tab throttling)
let timerStartTimestamp = null; // When the current timer segment started
let timerStartRemaining = null; // The remaining time when the timer started

// Web Worker for reliable background timing
let timerWorker = null;

// Initialize the timer worker
function initTimerWorker() {
    if (timerWorker) return timerWorker;

    try {
        timerWorker = new Worker('timer-worker.js');

        timerWorker.onmessage = function (e) {
            const { type, remaining: workerRemaining } = e.data;

            if (type === 'tick' && isRunning) {
                remaining = workerRemaining;
                updateDisplay();
                updateFloatingTimer();

                // Check if timer completed
                if (remaining <= 0) {
                    switchMode();
                    // Sync the new remaining time with worker
                    timerWorker.postMessage({ command: 'sync', remaining: remaining });
                }
            } else if (type === 'complete' && isRunning) {
                // Worker detected completion
                if (remaining <= 0) {
                    switchMode();
                    timerWorker.postMessage({ command: 'sync', remaining: remaining });
                }
            }
        };

        timerWorker.onerror = function (e) {
            console.warn('Timer worker error:', e);
            // Fallback to regular interval if worker fails
            timerWorker = null;
        };

        console.log('Timer worker initialized successfully');
    } catch (e) {
        console.warn('Could not create timer worker:', e);
        timerWorker = null;
    }

    return timerWorker;
}

// Notification and audio support
let notificationPermission = 'default';
let audioContext = null;

// Initialize AudioContext on first user interaction (required by browsers)
function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Immediately try to resume in case it starts suspended
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        } catch (e) {
            console.warn('AudioContext not supported:', e);
        }
    }
    return audioContext;
}

// Request notification permission with better UX
function requestNotificationPermission() {
    if ('Notification' in window) {
        notificationPermission = Notification.permission;
        if (Notification.permission === 'default') {
            // Will be requested on first timer start for better UX
            console.log('Notification permission will be requested when timer starts');
        }
    } else {
        console.warn('Notifications not supported in this browser');
    }
}

// Actually request permission (called when user starts timer)
async function ensureNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        try {
            const permission = await Notification.requestPermission();
            notificationPermission = permission;
            return permission === 'granted';
        } catch (e) {
            console.warn('Could not request notification permission:', e);
            return false;
        }
    }
    return Notification.permission === 'granted';
}

// Show notification (works even when tab is in background)
function showNotification(title, body, tag) {
    // Try standard Notification API first
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const notification = new Notification(title, {
                body: body,
                icon: '/assets/track.png',
                badge: '/assets/track.png',
                tag: tag,
                requireInteraction: true,
                silent: false,
                vibrate: [200, 100, 200] // Vibration pattern for mobile
            });

            setTimeout(() => notification.close(), 15000);

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            return true;
        } catch (e) {
            console.warn('Notification failed:', e);
        }
    }

    // Fallback: Try Service Worker notification (better background support)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title: title,
                body: body,
                tag: tag
            });
            return true;
        } catch (e) {
            console.warn('Service Worker notification failed:', e);
        }
    }

    // Final fallback: Update page title to alert user
    const originalTitle = document.title;
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        document.title = flashCount % 2 === 0 ? `⏰ ${title}` : originalTitle;
        flashCount++;
        if (flashCount > 10 || document.visibilityState === 'visible') {
            clearInterval(flashInterval);
            document.title = originalTitle;
        }
    }, 500);

    return false;
}

// Resume AudioContext if suspended (browsers suspend it when tab is backgrounded)
async function resumeAudioContext() {
    if (audioContext) {
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
            } catch (e) {
                console.warn('Could not resume AudioContext:', e);
            }
        }
        // Double check it's running
        if (audioContext.state !== 'running') {
            // Create a new context if the old one is broken
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Could not create new AudioContext:', e);
            }
        }
    }
}

// Track cycles and work time per activity type
let activityStats = {
    work: { cycles: 0, totalWorkTime: 0 },
    study: { cycles: 0, totalWorkTime: 0 },
    exercise: { cycles: 0, totalWorkTime: 0 },
    reading: { cycles: 0, totalWorkTime: 0 },
    coding: { cycles: 0, totalWorkTime: 0 },
    other: { cycles: 0, totalWorkTime: 0 }
};

// Daily stats tracking
let dailyStats = {
    date: new Date().toDateString(),
    sessionsToday: 0,
    minutesToday: 0,
    streak: 0,
    lastActiveDate: null,
    dailyGoal: 120, // Default daily goal in minutes
    activityBreakdown: {
        work: 0,
        study: 0,
        exercise: 0,
        reading: 0,
        coding: 0,
        other: 0
    }
};

// DOM elements for new stats
const sessionsTodayEl = document.getElementById('sessionsToday');
const currentStreakEl = document.getElementById('currentStreak');
const dailyGoalTextEl = document.getElementById('dailyGoalText');
const dailyGoalFillEl = document.getElementById('dailyGoalFill');

// Check if it's a new day and reset daily stats
function checkAndResetDailyStats() {
    const today = new Date().toDateString();

    if (dailyStats.date !== today) {
        // It's a new day - check if streak continues
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (dailyStats.lastActiveDate === yesterday.toDateString() && dailyStats.minutesToday >= 5) {
            // User was active yesterday, continue streak
            dailyStats.streak++;
        } else if (dailyStats.lastActiveDate !== today) {
            // Streak broken
            dailyStats.streak = 0;
        }

        // Reset daily counters
        dailyStats.date = today;
        dailyStats.sessionsToday = 0;
        dailyStats.minutesToday = 0;
        // Reset daily activity breakdown
        dailyStats.activityBreakdown = {
            work: 0,
            study: 0,
            exercise: 0,
            reading: 0,
            coding: 0,
            other: 0
        };
    }
}

// Update daily stats when a session is completed
function updateDailyStats(minutesWorked, sessionCompleted = false) {
    checkAndResetDailyStats();

    // Ensure minutesToday is a valid number before adding (fix NaN issue)
    dailyStats.minutesToday = (Number(dailyStats.minutesToday) || 0) + (Number(minutesWorked) || 0);
    if (sessionCompleted) {
        dailyStats.sessionsToday = (Number(dailyStats.sessionsToday) || 0) + 1;
    }
    dailyStats.lastActiveDate = new Date().toDateString();

    // If this is first activity today, start/continue streak
    if (dailyStats.minutesToday >= 5 && (Number(dailyStats.streak) || 0) === 0) {
        dailyStats.streak = 1;
    }

    updateDailyStatsDisplay();
    saveDailyStats();
}

// Update the daily stats display
function updateDailyStatsDisplay() {
    // Ensure values are valid numbers (fix NaN issue)
    const minutesToday = Number(dailyStats.minutesToday) || 0;
    const dailyGoal = Number(dailyStats.dailyGoal) || 60;
    const sessionsToday = Number(dailyStats.sessionsToday) || 0;
    const streak = Number(dailyStats.streak) || 0;

    if (sessionsTodayEl) {
        sessionsTodayEl.textContent = sessionsToday;
    }
    if (currentStreakEl) {
        currentStreakEl.textContent = streak;
    }
    if (dailyGoalTextEl) {
        dailyGoalTextEl.textContent = `${minutesToday} / ${dailyGoal} min`;
    }
    if (dailyGoalFillEl) {
        const percentage = Math.min((minutesToday / dailyGoal) * 100, 100);
        dailyGoalFillEl.style.width = `${percentage}%`;

        if (percentage >= 100) {
            dailyGoalFillEl.classList.add('complete');
        } else {
            dailyGoalFillEl.classList.remove('complete');
        }
    }
}

// Save daily stats to localStorage
function saveDailyStats() {
    // Validate numeric fields before saving to prevent NaN issues
    dailyStats.minutesToday = Number(dailyStats.minutesToday) || 0;
    dailyStats.dailyGoal = Number(dailyStats.dailyGoal) || 60;
    dailyStats.sessionsToday = Number(dailyStats.sessionsToday) || 0;
    dailyStats.streak = Number(dailyStats.streak) || 0;

    localStorage.setItem('pomodoroDailyStats', JSON.stringify(dailyStats));

    // Also sync to Firebase if logged in
    if (window.firebaseApp && window.firebaseApp.currentUser) {
        saveDailyStatsToFirebase();
    }
}

// Load daily stats from localStorage
function loadDailyStats() {
    const saved = localStorage.getItem('pomodoroDailyStats');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            dailyStats = { ...dailyStats, ...parsed };
            // Validate numeric fields to prevent NaN issues
            dailyStats.minutesToday = Number(dailyStats.minutesToday) || 0;
            dailyStats.dailyGoal = Number(dailyStats.dailyGoal) || 60;
            dailyStats.sessionsToday = Number(dailyStats.sessionsToday) || 0;
            dailyStats.streak = Number(dailyStats.streak) || 0;
        } catch (e) {
            console.warn('Failed to parse daily stats:', e);
        }
    }
    checkAndResetDailyStats();
    updateDailyStatsDisplay();
}

// Firebase sync for daily stats
async function saveDailyStatsToFirebase() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const dailyStatsRef = window.firebaseApp.db.collection('users')
            .doc(window.firebaseApp.currentUser.uid)
            .collection('dailyStats')
            .doc('current');

        // Validate numeric fields before saving to prevent NaN in Firebase
        const validatedStats = {
            ...dailyStats,
            minutesToday: Number(dailyStats.minutesToday) || 0,
            dailyGoal: Number(dailyStats.dailyGoal) || 60,
            sessionsToday: Number(dailyStats.sessionsToday) || 0,
            streak: Number(dailyStats.streak) || 0,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await dailyStatsRef.set(validatedStats, { merge: true });
    } catch (e) {
        console.error('Error saving daily stats to Firebase:', e);
    }
}

async function loadDailyStatsFromFirebase() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const dailyStatsRef = window.firebaseApp.db.collection('users')
            .doc(window.firebaseApp.currentUser.uid)
            .collection('dailyStats')
            .doc('current');

        const doc = await dailyStatsRef.get();
        if (doc.exists) {
            const data = doc.data();

            // Store current local values before merging (to preserve if Firebase has NaN)
            const localMinutes = Number(dailyStats.minutesToday) || 0;
            const localGoal = Number(dailyStats.dailyGoal) || 60;
            const localSessions = Number(dailyStats.sessionsToday) || 0;
            const localStreak = Number(dailyStats.streak) || 0;

            // Check if Firebase data is valid (not NaN)
            const firebaseMinutes = Number(data.minutesToday);
            const firebaseGoal = Number(data.dailyGoal);
            const firebaseSessions = Number(data.sessionsToday);
            const firebaseStreak = Number(data.streak);

            // Only use Firebase value if it's valid, otherwise keep local value
            // This prevents corrupted NaN data from Firebase from overwriting good local data
            dailyStats = { ...dailyStats, ...data };
            dailyStats.minutesToday = !isNaN(firebaseMinutes) ? firebaseMinutes : localMinutes;
            dailyStats.dailyGoal = !isNaN(firebaseGoal) && firebaseGoal > 0 ? firebaseGoal : localGoal;
            dailyStats.sessionsToday = !isNaN(firebaseSessions) ? firebaseSessions : localSessions;
            dailyStats.streak = !isNaN(firebaseStreak) ? firebaseStreak : localStreak;

            // If Firebase had NaN values, fix them by saving valid data back
            if (isNaN(firebaseMinutes) || isNaN(firebaseGoal) || isNaN(firebaseSessions) || isNaN(firebaseStreak)) {
                console.warn('Firebase had corrupted NaN values, fixing...');
                saveDailyStatsToFirebase(); // Save fixed values back to Firebase
            }

            localStorage.setItem('pomodoroDailyStats', JSON.stringify(dailyStats));
        }
    } catch (e) {
        console.error('Error loading daily stats from Firebase:', e);
    }

    checkAndResetDailyStats();
    updateDailyStatsDisplay();
}

// Daily Goal Modal Elements
const dailyGoalModal = document.getElementById('dailyGoalModal');
const editDailyGoalBtn = document.getElementById('editDailyGoal');
const closeDailyGoalModal = document.getElementById('closeDailyGoalModal');
const dailyGoalInput = document.getElementById('dailyGoalInput');
const cancelDailyGoalBtn = document.getElementById('cancelDailyGoal');
const confirmDailyGoalBtn = document.getElementById('confirmDailyGoal');
const goalPresetBtns = document.querySelectorAll('.goal-preset-btn');

// Open daily goal modal
if (editDailyGoalBtn) {
    editDailyGoalBtn.addEventListener('click', () => {
        dailyGoalInput.value = dailyStats.dailyGoal;
        updateGoalPresetButtons(dailyStats.dailyGoal);
        dailyGoalModal.classList.remove('hidden');
    });
}

// Close modal handlers
if (closeDailyGoalModal) {
    closeDailyGoalModal.addEventListener('click', () => {
        dailyGoalModal.classList.add('hidden');
    });
}

if (cancelDailyGoalBtn) {
    cancelDailyGoalBtn.addEventListener('click', () => {
        dailyGoalModal.classList.add('hidden');
    });
}

// Close modal when clicking outside
if (dailyGoalModal) {
    dailyGoalModal.addEventListener('click', (e) => {
        if (e.target === dailyGoalModal) {
            dailyGoalModal.classList.add('hidden');
        }
    });
}

// Goal preset buttons
goalPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const goal = parseInt(btn.dataset.goal);
        dailyGoalInput.value = goal;
        updateGoalPresetButtons(goal);
    });
});

// Update input when typing
if (dailyGoalInput) {
    dailyGoalInput.addEventListener('input', () => {
        const goal = parseInt(dailyGoalInput.value) || 0;
        updateGoalPresetButtons(goal);
    });
}

// Update preset button active states
function updateGoalPresetButtons(goal) {
    goalPresetBtns.forEach(btn => {
        if (parseInt(btn.dataset.goal) === goal) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Save daily goal
if (confirmDailyGoalBtn) {
    confirmDailyGoalBtn.addEventListener('click', () => {
        const newGoal = parseInt(dailyGoalInput.value);
        if (newGoal >= 15 && newGoal <= 480) {
            dailyStats.dailyGoal = newGoal;
            saveDailyStats();
            updateDailyStatsDisplay();
            dailyGoalModal.classList.add('hidden');
        } else {
            alert('Please enter a goal between 15 and 480 minutes');
        }
    });
}

// Save timer session to localStorage
function saveTimerSession() {
    if (isRunning) {
        const session = {
            remaining: remaining,
            mode: mode,
            sessionStartTime: Date.now(), // When we're saving this session
            isRunning: true,
            workDuration: workDuration,
            restDuration: restDuration
        };
        localStorage.setItem(TIMER_SESSION_KEY, JSON.stringify(session));
    }
}

// Restore timer session from localStorage
function restoreTimerSession() {
    const sessionData = localStorage.getItem(TIMER_SESSION_KEY);
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            const currentTime = Date.now();
            const elapsedSeconds = Math.floor((currentTime - session.sessionStartTime) / 1000);

            // Calculate new remaining time based on elapsed time
            remaining = Math.max(0, session.remaining - elapsedSeconds);
            mode = session.mode;
            // Validate workDuration and restDuration from session (fix NaN issue)
            const sessionWork = Number(session.workDuration);
            const sessionRest = Number(session.restDuration);
            workDuration = isNaN(sessionWork) || sessionWork <= 0 ? 25 * 60 : sessionWork;
            restDuration = isNaN(sessionRest) || sessionRest <= 0 ? 5 * 60 : sessionRest;

            updateDisplay();

            if (remaining <= 0) {
                // Timer ran out while away - switch mode and play sound
                switchMode();
                if (mode === 'work') {
                    playBreakEndSound();
                } else {
                    playWorkEndSound();
                }
            } else if (session.isRunning) {
                // Resume the timer with timestamp tracking
                isRunning = true;
                isTimerRunning = true;
                startBtn.textContent = 'Pause';

                // Initialize timestamp tracking for resumed session
                timerStartTimestamp = Date.now();
                timerStartRemaining = remaining;

                if (!intervalId) intervalId = setInterval(tick, 1000);
                updateFloatingTimer();
            }

            // Clear the session data
            localStorage.removeItem(TIMER_SESSION_KEY);
        } catch (e) {
            console.error('Error restoring timer session:', e);
        }
    }
}

// Initialize from local storage
function loadFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            activityStats = parsed.activityStats || activityStats;
            currentActivityType = parsed.activityType || 'work';
            // Ensure workDuration and restDuration are valid numbers (fix NaN issue)
            const parsedWork = Number(parsed.workDuration);
            const parsedRest = Number(parsed.restDuration);
            workDuration = (isNaN(parsedWork) || parsedWork <= 0 ? 25 : parsedWork) * 60;
            restDuration = (isNaN(parsedRest) || parsedRest <= 0 ? 5 : parsedRest) * 60;
        } catch (e) {
            console.error('Error loading data from storage:', e);
        }
    }
}

// Save to local storage and Firebase
// Debounce utility for reducing Firebase writes
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedSavePomodoroToFirebase = debounce(savePomodoroToFirebase, 500);

function saveToStorage() {
    if (isSyncingFromFirebase) return; // Don't save while syncing from Firebase

    // Ensure durations are valid numbers before saving (fix NaN issue)
    const workMin = Math.floor(workDuration / 60);
    const restMin = Math.floor(restDuration / 60);

    const data = {
        activityStats: activityStats,
        activityType: currentActivityType,
        workDuration: isNaN(workMin) || workMin <= 0 ? 25 : workMin,
        restDuration: isNaN(restMin) || restMin <= 0 ? 5 : restMin
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Sync to Firebase if user is logged in (debounced)
    debouncedSavePomodoroToFirebase(data);
}

// Firebase sync functions
async function savePomodoroToFirebase(data) {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const pomodoroRef = window.firebaseApp.getPomodoroRef();
        await pomodoroRef.set({
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error saving to Firebase:', e);
    }
}

function setupPomodoroSync() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    // Unsubscribe from previous listener if exists
    if (pomodoroUnsubscribe) {
        pomodoroUnsubscribe();
    }

    const pomodoroRef = window.firebaseApp.getPomodoroRef();

    pomodoroUnsubscribe = pomodoroRef.onSnapshot((doc) => {
        if (doc.exists) {
            isSyncingFromFirebase = true;
            const data = doc.data();

            console.log('Pomodoro: Loaded data from Firebase:', data);

            // Update activity stats
            if (data.activityStats) {
                activityStats = data.activityStats;
            }

            // Update activity type
            if (data.activityType) {
                currentActivityType = data.activityType;
                if (activityTypeEl) {
                    activityTypeEl.value = currentActivityType;
                }
            }

            // Update durations (only if timer is not running)
            if (!isRunning) {
                if (data.workDuration) {
                    const parsedWork = Number(data.workDuration);
                    workDuration = (isNaN(parsedWork) || parsedWork <= 0 ? 25 : parsedWork) * 60;
                }
                if (data.restDuration) {
                    const parsedRest = Number(data.restDuration);
                    restDuration = (isNaN(parsedRest) || parsedRest <= 0 ? 5 : parsedRest) * 60;
                }
                remaining = mode === 'work' ? workDuration : restDuration;
                updateDisplay();
            }

            updateCustomPresetLabel();
            updateSummary(false); // Don't save back to storage during sync

            // Save to localStorage for offline access
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

            isSyncingFromFirebase = false;

            // Mark initial load as complete after first Firebase sync
            if (!isInitialLoadComplete) {
                isInitialLoadComplete = true;
                console.log('Pomodoro: Initial load complete from Firebase');
            }
        } else {
            // No document exists in Firebase, mark load complete so new data can be saved
            if (!isInitialLoadComplete) {
                isInitialLoadComplete = true;
                console.log('Pomodoro: No Firebase data, using local data');
            }
        }
    }, (error) => {
        console.error('Pomodoro sync error:', error);
        // On error, still allow saving
        if (!isInitialLoadComplete) {
            isInitialLoadComplete = true;
        }
    });
}

// Listen for auth state changes
window.addEventListener('authStateChanged', (e) => {
    console.log('Pomodoro: authStateChanged event received, user:', e.detail.user?.email);
    if (e.detail.user) {
        // Small delay to ensure firebaseApp.currentUser is updated
        setTimeout(() => {
            setupPomodoroSync();
        }, 100);
    } else if (pomodoroUnsubscribe) {
        pomodoroUnsubscribe();
        pomodoroUnsubscribe = null;
    }
});

// Update custom preset label
function updateCustomPresetLabel() {
    // Ensure valid numbers to prevent NaN display
    const workMin = isNaN(workDuration) || workDuration <= 0 ? 25 : Math.floor(workDuration / 60);
    const restMin = isNaN(restDuration) || restDuration <= 0 ? 5 : Math.floor(restDuration / 60);
    customPresetLabel.textContent = `${workMin}/${restMin}`;
}

function formatTime(s) {
    // Ensure s is a valid number to prevent NaN display
    const validSeconds = isNaN(s) || s < 0 ? 0 : Math.floor(s);
    const m = Math.floor(validSeconds / 60);
    const sec = validSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateDisplay() {
    timerEl.textContent = formatTime(remaining);
    modeEl.textContent = mode === 'work' ? 'Work' : 'Break';
    document.body.dataset.mode = mode;
}

function updateSummary(shouldSave = true) {
    const stats = activityStats[currentActivityType];

    // Update cycles breakdown for all activities
    Object.keys(activityStats).forEach(activity => {
        const cycleElement = cyclesBreakdownEl.querySelector(`[data-activity="${activity}"]`);
        if (cycleElement) {
            cycleElement.textContent = activityStats[activity].cycles;
        }
    });

    // Calculate total work time across all activities
    let totalMinutes = 0;
    Object.keys(activityStats).forEach(activity => {
        totalMinutes += Math.floor(activityStats[activity].totalWorkTime / 60);
    });
    totalWorkTimeEl.textContent = totalMinutes > 0 ? `${totalMinutes}m` : '0m';

    // Update daily stats display
    updateDailyStatsDisplay();

    // Only save if explicitly requested and initial load is complete
    if (shouldSave && isInitialLoadComplete) {
        saveToStorage();
    }
}

async function playWorkEndSound() {
    // Show notification (works even when tab is in background)
    showNotification(
        '🎉 Work Session Complete!',
        `Great job! Time to take a ${Math.floor(restDuration / 60)} minute break.`,
        'pomodoro-work-end'
    );

    // Ring sound for work end (higher pitched, pleasant notification)
    try {
        const ctx = initAudioContext();
        if (!ctx) return;

        await resumeAudioContext();

        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 1200;
        g.gain.value = 0.1;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.warn('Sound playback failed:', e);
    }
}

async function playBreakEndSound() {
    // Show notification (works even when tab is in background)
    showNotification(
        '⏰ Break Over!',
        `Time to get back to ${currentActivityType}. You got this!`,
        'pomodoro-break-end'
    );

    // Beep sound for break end (double beep, lower pitched)
    try {
        const ctx = initAudioContext();
        if (!ctx) return;

        await resumeAudioContext();

        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 800;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.15);

        // Second beep
        const o2 = ctx.createOscillator();
        o2.frequency.value = 800;
        o2.connect(g);
        o2.start(ctx.currentTime + 0.2);
        o2.stop(ctx.currentTime + 0.35);
    } catch (e) {
        console.warn('Sound playback failed:', e);
    }
}

function switchMode() {
    if (mode === 'work') {
        // Switched from work to break, increment cycle and add work time
        activityStats[currentActivityType].cycles++;
        activityStats[currentActivityType].totalWorkTime += workDuration;

        // Update daily stats - session completed
        const minutesWorked = Math.floor(workDuration / 60);
        updateDailyStats(minutesWorked, true);

        // Update daily activity breakdown
        if (dailyStats.activityBreakdown[currentActivityType] !== undefined) {
            dailyStats.activityBreakdown[currentActivityType]++;
            saveDailyStats();
        }

        remaining = restDuration;
        mode = 'break';
        isWorkMode = false; // Update work mode flag
        playWorkEndSound(); // Play ring sound when work ends
    } else {
        // Switched from break to work
        mode = 'work';
        remaining = workDuration;
        isWorkMode = true; // Update work mode flag
        playBreakEndSound(); // Play beep sound when break ends
    }

    // Reset timestamp tracking for the new timer segment
    timerStartTimestamp = Date.now();
    timerStartRemaining = remaining;

    // Sync the worker with the new remaining time
    if (timerWorker && isRunning) {
        timerWorker.postMessage({ command: 'sync', remaining: remaining });
    }

    updateDisplay();
    updateSummary();
    updateFloatingTimer(); // Update floating timer when mode switches
}

function tick() {
    // Use timestamp-based calculation to handle background tab throttling
    if (timerStartTimestamp && timerStartRemaining !== null) {
        const elapsedSeconds = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        remaining = Math.max(0, timerStartRemaining - elapsedSeconds);
    }

    if (remaining <= 0) {
        switchMode();
        return;
    }
    updateDisplay();
    updateFloatingTimer(); // Update floating timer on each tick
}
updateDisplay();


function startTimer() {
    if (isRunning) { pauseTimer(); return; }
    isRunning = true;
    isTimerRunning = true; // Set timer running flag
    startBtn.textContent = 'Pause';

    // Initialize AudioContext on user interaction (required by browsers)
    initAudioContext();

    // Request notification permission on first timer start (better UX)
    ensureNotificationPermission();

    // Initialize timestamp tracking
    timerStartTimestamp = Date.now();
    timerStartRemaining = remaining;

    // Start the Web Worker timer (reliable background timing)
    const worker = initTimerWorker();
    if (worker) {
        worker.postMessage({ command: 'start', remaining: remaining });
    }

    // Also keep the regular interval as fallback (for display updates)
    if (!intervalId) intervalId = setInterval(tick, 1000);
    updateFloatingTimer(); // Update floating timer when starting
}

function pauseTimer() {
    isRunning = false;
    isTimerRunning = false; // Clear timer running flag
    startBtn.textContent = 'Start';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    if (floatingTimer) floatingTimer.classList.add('hidden'); // Hide floating timer when paused

    // Stop the Web Worker timer
    if (timerWorker) {
        timerWorker.postMessage({ command: 'stop' });
    }

    // Clear timestamp tracking
    timerStartTimestamp = null;
    timerStartRemaining = null;
}

function resetTimer() {
    // If in work mode and at least 5 minutes have been spent, add to total work time
    if (mode === 'work') {
        const timeSpent = workDuration - remaining;
        const minThreshold = 5 * 60; // 5 minutes in seconds

        if (timeSpent >= minThreshold) {
            activityStats[currentActivityType].totalWorkTime += timeSpent;

            // Update daily stats - partial work (no session completion)
            const minutesWorked = Math.floor(timeSpent / 60);
            updateDailyStats(minutesWorked, false);
        }
    }

    pauseTimer();
    mode = 'work';
    remaining = workDuration;
    isTimerRunning = false; // Clear timer running flag
    if (floatingTimer) floatingTimer.classList.add('hidden'); // Hide floating timer
    updateDisplay();
    updateSummary();
}

// Activity type change
activityTypeEl.addEventListener('change', (e) => {
    currentActivityType = e.target.value;
    updateSummary();
});

// Preset button handling
presetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Don't open modal if clicking the edit button
        if (e.target === customEditBtn) return;

        // Remove active class from all buttons
        presetBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');

        const work = btn.dataset.work;
        const rest = btn.dataset.rest;

        if (work === 'custom' || rest === 'custom') {
            // Just apply the saved custom times without opening modal
            // The modal only opens when clicking the pencil icon
        } else {
            workDuration = parseInt(work) * 60;
            restDuration = parseInt(rest) * 60;
        }

        // Reset timer with new values
        if (!isRunning) {
            remaining = workDuration;
            updateDisplay();
        }
        saveToStorage();
    });
});

// Custom modal handlers
customEditBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modalWorkTime.value = Math.floor(workDuration / 60);
    modalRestTime.value = Math.floor(restDuration / 60);
    customModal.classList.remove('hidden');
});

closeCustomModal.addEventListener('click', () => {
    customModal.classList.add('hidden');
});

cancelCustomBtn.addEventListener('click', () => {
    customModal.classList.add('hidden');
});

confirmCustomBtn.addEventListener('click', () => {
    const parsedWork = parseInt(modalWorkTime.value, 10);
    const parsedRest = parseInt(modalRestTime.value, 10);

    // Validate input values - use defaults if invalid (fix NaN issue)
    const newWorkDuration = (isNaN(parsedWork) || parsedWork <= 0 ? 25 : parsedWork) * 60;
    const newRestDuration = (isNaN(parsedRest) || parsedRest <= 0 ? 5 : parsedRest) * 60;

    workDuration = newWorkDuration;
    restDuration = newRestDuration;

    // Update the custom preset button to show new times
    updateCustomPresetLabel();

    // Reset timer with new values
    if (!isRunning) {
        remaining = workDuration;
        updateDisplay();
    }

    // Mark custom button as active
    presetBtns.forEach(b => b.classList.remove('active'));
    const customBtn = document.querySelector('.custom-preset');
    customBtn.classList.add('active');

    saveToStorage();
    customModal.classList.add('hidden');
});

// Close modal when clicking outside
customModal.addEventListener('click', (e) => {
    if (e.target === customModal) {
        customModal.classList.add('hidden');
    }
});

// Button event listeners
startBtn.addEventListener('click', startTimer);
restartBtn.addEventListener('click', () => {
    resetTimer();
});

// Initialize with proper data loading
async function initializePomodoro() {
    console.log('initializePomodoro called');
    // Load from localStorage first (instant cache)
    loadFromStorage();
    loadDailyStats(); // Load daily stats
    activityTypeEl.value = currentActivityType;

    // Update custom preset label on load
    updateCustomPresetLabel();

    remaining = workDuration;
    updateDisplay();
    updateSummary(false); // Don't save during initialization

    // Request notification permission
    requestNotificationPermission();

    // Restore timer session if one was running
    restoreTimerSession();

    // Wait for Firebase auth to be ready
    console.log('Pomodoro: Waiting for auth...');
    const user = await window.firebaseApp.waitForAuth();
    console.log('Pomodoro: Auth ready, user:', user?.email);

    if (user) {
        console.log('Pomodoro: Setting up Firebase sync...');
        setupPomodoroSync();
        loadDailyStatsFromFirebase(); // Load daily stats from Firebase
    } else {
        // No user logged in, allow saving to localStorage
        isInitialLoadComplete = true;
        console.log('Pomodoro: No user, using local storage only');
    }
}

// Initialize AudioContext on first user interaction (browsers require this)
document.addEventListener('click', () => initAudioContext(), { once: true });
document.addEventListener('keydown', () => initAudioContext(), { once: true });

initializePomodoro();

// Check if this is the first time user opens the app
const isFirstTime = localStorage.getItem(FIRST_TIME_KEY) !== 'false';
if (isFirstTime) {
    showIntroduction();
}

// Save timer session when page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning) {
        saveTimerSession();
    }
});

// Save timer session before page unload
window.addEventListener('beforeunload', () => {
    if (isRunning) {
        saveTimerSession();
    }
});

// Also save session periodically every 10 seconds while running
setInterval(() => {
    if (isRunning) {
        saveTimerSession();
    }
}, 10000);

// Handle page visibility change - crucial for background tab timer accuracy
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isRunning) {
        // Page became visible again, recalculate remaining time
        if (timerStartTimestamp && timerStartRemaining !== null) {
            const elapsedSeconds = Math.floor((Date.now() - timerStartTimestamp) / 1000);
            remaining = Math.max(0, timerStartRemaining - elapsedSeconds);

            // Handle if timer completed while in background
            while (remaining <= 0 && isRunning) {
                // Calculate how much time passed beyond the timer end
                const overflowTime = Math.abs(remaining);

                if (mode === 'work') {
                    // Work session completed
                    activityStats[currentActivityType].cycles++;
                    activityStats[currentActivityType].totalWorkTime += workDuration;

                    // Update daily stats - session completed while in background
                    const minutesWorked = Math.floor(workDuration / 60);
                    updateDailyStats(minutesWorked, true);

                    // Update daily activity breakdown
                    if (dailyStats.activityBreakdown[currentActivityType] !== undefined) {
                        dailyStats.activityBreakdown[currentActivityType]++;
                        saveDailyStats();
                    }

                    mode = 'break';
                    isWorkMode = false;
                    remaining = restDuration - overflowTime;
                    playWorkEndSound();
                } else {
                    // Break completed
                    mode = 'work';
                    isWorkMode = true;
                    remaining = workDuration - overflowTime;
                    playBreakEndSound();
                }

                // Reset timestamp for new segment
                timerStartTimestamp = Date.now() - (remaining < 0 ? Math.abs(remaining) * 1000 : 0);
                timerStartRemaining = remaining > 0 ? remaining : (mode === 'work' ? workDuration : restDuration);

                if (remaining < 0) {
                    remaining = timerStartRemaining + remaining; // remaining is negative, so this subtracts
                }
            }

            remaining = Math.max(0, remaining);
            updateDisplay();
            updateSummary();
            updateFloatingTimer();
        }
    } else if (document.visibilityState === 'hidden' && isRunning) {
        // Page is being hidden, save the current state
        saveTimerSession();
    }
});

// Clear data functionality
clearDataBtn.addEventListener('click', () => {
    clearModal.classList.remove('hidden');
});

cancelClearBtn.addEventListener('click', () => {
    clearModal.classList.add('hidden');
});

confirmClearBtn.addEventListener('click', () => {
    // Clear all data
    activityStats = {
        work: { cycles: 0, totalWorkTime: 0 },
        study: { cycles: 0, totalWorkTime: 0 },
        exercise: { cycles: 0, totalWorkTime: 0 },
        reading: { cycles: 0, totalWorkTime: 0 },
        coding: { cycles: 0, totalWorkTime: 0 },
        other: { cycles: 0, totalWorkTime: 0 }
    };

    // Reset daily stats
    dailyStats = {
        date: new Date().toDateString(),
        sessionsToday: 0,
        minutesToday: 0,
        streak: 0,
        lastActiveDate: null,
        dailyGoal: 120
    };

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('pomodoroDailyStats');
    updateSummary();
    updateDailyStatsDisplay();
    clearModal.classList.add('hidden');
});

// Close modal when clicking outside of it
clearModal.addEventListener('click', (e) => {
    if (e.target === clearModal) {
        clearModal.classList.add('hidden');
    }
});

// Introduction event listeners
skipIntroBtn.addEventListener('click', () => {
    hideIntroduction();
});

nextIntroBtn.addEventListener('click', () => {
    nextIntroStep();
});

reintroduceBtn.addEventListener('click', () => {
    showIntroduction();
});

document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
        currentIntroStep = parseInt(e.target.dataset.dot);
        updateIntroStep();
    });
});

// Close introduction when clicking outside
introModal.addEventListener('click', (e) => {
    if (e.target === introModal) {
        hideIntroduction();
    }
});
