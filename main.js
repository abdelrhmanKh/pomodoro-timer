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

// Local storage key
const STORAGE_KEY = 'pomodoroData';
const TIMER_SESSION_KEY = 'pomodoroSession';
const FIRST_TIME_KEY = 'pomodoroFirstTime';

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
let workDuration = 25 * 60;  // in seconds
let restDuration = 5 * 60;   // in seconds
let currentActivityType = 'work';

// Track cycles and work time per activity type
let activityStats = {
    work: { cycles: 0, totalWorkTime: 0 },
    study: { cycles: 0, totalWorkTime: 0 },
    exercise: { cycles: 0, totalWorkTime: 0 },
    reading: { cycles: 0, totalWorkTime: 0 },
    coding: { cycles: 0, totalWorkTime: 0 },
    other: { cycles: 0, totalWorkTime: 0 }
};

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
            workDuration = session.workDuration;
            restDuration = session.restDuration;

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
                // Resume the timer
                isRunning = true;
                startBtn.textContent = 'Pause';
                if (!intervalId) intervalId = setInterval(tick, 1000);
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
            workDuration = (parsed.workDuration || 25) * 60;
            restDuration = (parsed.restDuration || 5) * 60;
        } catch (e) {
            console.error('Error loading data from storage:', e);
        }
    }
}

// Save to local storage
function saveToStorage() {
    const data = {
        activityStats: activityStats,
        activityType: currentActivityType,
        workDuration: Math.floor(workDuration / 60),
        restDuration: Math.floor(restDuration / 60)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Update custom preset label
function updateCustomPresetLabel() {
    const workMin = Math.floor(workDuration / 60);
    const restMin = Math.floor(restDuration / 60);
    customPresetLabel.textContent = `${workMin}/${restMin}`;
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateDisplay() {
    timerEl.textContent = formatTime(remaining);
    modeEl.textContent = mode === 'work' ? 'Work' : 'Break';
    document.body.dataset.mode = mode;
}

function updateSummary() {
    const stats = activityStats[currentActivityType];

    // Update cycles breakdown for all activities
    Object.keys(activityStats).forEach(activity => {
        const cycleElement = cyclesBreakdownEl.querySelector(`[data-activity="${activity}"]`);
        if (cycleElement) {
            cycleElement.textContent = activityStats[activity].cycles;
        }
    });

    const workMinutes = Math.floor(stats.totalWorkTime / 60);
    totalWorkTimeEl.textContent = workMinutes > 0 ? `${workMinutes}m` : '0m';
    saveToStorage();
}

function playWorkEndSound() {
    // Ring sound for work end (higher pitched, pleasant notification)
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 1200;
        g.gain.value = 0.1;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        setTimeout(() => { o.stop(); ctx.close(); }, 300);
    } catch (e) { }
}

function playBreakEndSound() {
    // Beep sound for break end (double beep, lower pitched)
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    } catch (e) { }
}

function switchMode() {
    if (mode === 'work') {
        // Switched from work to break, increment cycle and add work time
        activityStats[currentActivityType].cycles++;
        activityStats[currentActivityType].totalWorkTime += workDuration;
        remaining = restDuration;
        mode = 'break';
        playWorkEndSound(); // Play ring sound when work ends
    } else {
        // Switched from break to work
        mode = 'work';
        remaining = workDuration;
        playBreakEndSound(); // Play beep sound when break ends
    }
    updateDisplay();
    updateSummary();
}

function tick() {
    if (remaining <= 0) {
        switchMode();
        return;
    }
    remaining--;
    updateDisplay();
}
updateDisplay();


function startTimer() {
    if (isRunning) { pauseTimer(); return; }
    isRunning = true;
    startBtn.textContent = 'Pause';
    if (!intervalId) intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
    isRunning = false;
    startBtn.textContent = 'Start';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function resetTimer() {
    // If in work mode and at least 5 minutes have been spent, add to total work time
    if (mode === 'work') {
        const timeSpent = workDuration - remaining;
        const minThreshold = 5 * 60; // 5 minutes in seconds

        if (timeSpent >= minThreshold) {
            activityStats[currentActivityType].totalWorkTime += timeSpent;
        }
    }

    pauseTimer();
    mode = 'work';
    remaining = workDuration;
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
    const newWorkDuration = parseInt(modalWorkTime.value) * 60;
    const newRestDuration = parseInt(modalRestTime.value) * 60;

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

// Initialize
loadFromStorage();
activityTypeEl.value = currentActivityType;

// Update custom preset label on load
updateCustomPresetLabel();

remaining = workDuration;
updateDisplay();
updateSummary();

// Restore timer session if one was running
restoreTimerSession();

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
    localStorage.removeItem(STORAGE_KEY);
    updateSummary();
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