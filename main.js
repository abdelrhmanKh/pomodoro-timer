// ============ APP INITIALIZATION ============
let isAuthenticated = false;
let appsInitialized = false;

// Register Service Worker for offline caching and faster loads
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker registered:', registration.scope);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000); // Check every hour
            })
            .catch((error) => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// Check authentication state
window.addEventListener('authStateChanged', (e) => {
    if (e.detail.user) {
        isAuthenticated = true;
        showUserProfile(e.detail.user);
        if (!appsInitialized) {
            appsInitialized = true;
            initializeApps();
        }
    } else {
        isAuthenticated = false;
        // firebase-config.js handles the redirect
    }
});

// Show user profile in nav
function showUserProfile(user) {
    const userProfile = document.getElementById('userProfile');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userProfile) {
        userProfile.classList.remove('hidden');

        if (userAvatar) {
            const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
            userAvatar.textContent = initial;
        }

        if (userName) {
            userName.textContent = user.displayName || 'User';
        }

        if (userEmail) {
            userEmail.textContent = user.email || '';
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                // Save canvas before logout
                if (window.canvasApp?.saveBeforeLeave) {
                    window.canvasApp.saveBeforeLeave();
                }
                await window.firebaseApp.signOutUser();
            });
        }
    }
}

function initializeApps() {
    initFloatingTimer();
    initializeButtonVisibility();

    // Initialize canvas when needed
    if (window.canvasApp) {
        window.canvasApp.init();
    }
}

// ============ APP SWITCHING ============
const navItems = document.querySelectorAll('.nav-item');
const appSections = document.querySelectorAll('.app-section');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const appName = item.getAttribute('data-app');
        switchApp(appName);
    });
});

function switchApp(appName) {
    // Save canvas before leaving if we're on canvas
    const currentApp = document.querySelector('.app-section.active')?.id;
    if (currentApp === 'app-canvas' && window.canvasApp?.saveBeforeLeave) {
        window.canvasApp.saveBeforeLeave();
    }

    // Update nav items
    navItems.forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-app="${appName}"]`)?.classList.add('active');

    // Update app sections
    appSections.forEach(section => section.classList.remove('active'));
    document.getElementById(`app-${appName}`)?.classList.add('active');

    // Update button visibility based on active app
    const clearDataBtn = document.getElementById('clearDataBtn');
    const clearTasksBtn = document.getElementById('clearTasksBtn');
    const clearCanvasNavBtn = document.getElementById('clearCanvasNavBtn');
    const clearHabitsBtn = document.getElementById('clearHabitsBtn');
    const reintroduceBtn = document.getElementById('reintroduceBtn');

    // Hide all buttons first
    clearDataBtn?.classList.add('hidden');
    clearTasksBtn?.classList.add('hidden');
    clearCanvasNavBtn?.classList.add('hidden');
    clearHabitsBtn?.classList.add('hidden');
    reintroduceBtn?.classList.add('hidden');

    if (appName === 'dashboard') {
        // Refresh dashboard when switching to it
        if (window.dashboardApp?.refresh) {
            window.dashboardApp.refresh();
        }
        window.dispatchEvent(new CustomEvent('dashboardActivated'));
    } else if (appName === 'pomodoro') {
        clearDataBtn?.classList.remove('hidden');
        reintroduceBtn?.classList.remove('hidden');
    } else if (appName === 'tasks') {
        clearTasksBtn?.classList.remove('hidden');
    } else if (appName === 'canvas') {
        clearCanvasNavBtn?.classList.remove('hidden');
        // Initialize canvas if not already done
        if (window.canvasApp && !window.canvasAppInitialized) {
            window.canvasApp.init();
            window.canvasAppInitialized = true;
        }
        // Resize canvas when switching to it
        setTimeout(() => {
            if (window.canvasApp && window.canvasApp.resize) {
                window.canvasApp.resize();
            }
        }, 100);
    } else if (appName === 'habits') {
        clearHabitsBtn?.classList.remove('hidden');
    } else if (appName === 'analytics') {
        // Initialize analytics when switching to it
        if (typeof initAnalytics === 'function') {
            initAnalytics();
        }
    } else if (appName === 'notes') {
        // Initialize notes when switching to it
        if (typeof initNotes === 'function') {
            initNotes();
        }
        // Show correct button based on view
        const newNoteBtn = document.getElementById('newNoteBtn');
        const newJournalBtn = document.getElementById('newJournalBtn');
        if (newNoteBtn) newNoteBtn.style.display = '';
        if (newJournalBtn) newJournalBtn.style.display = 'none';
    } else if (appName === 'sounds') {
        // Initialize sounds when switching to it
        if (typeof initSounds === 'function') {
            initSounds();
        }
    } else if (appName === 'settings') {
        // Initialize themes selector when switching to settings
        if (typeof initThemes === 'function') {
            initThemes();
        }
    }

    // Reset task list if switching to tasks
    if (appName === 'tasks' && typeof updateTaskDisplay === 'function') {
        updateTaskDisplay();
        updateFloatingTimer();
    }
}

// ============ FLOATING TIMER WIDGET ============
let floatingTimer = null;
let floatingTimerDisplay = null;
let floatingTimerMode = null;

// Initialize floating timer elements after DOM is ready
function initFloatingTimer() {
    if (floatingTimer) return; // Already initialized

    floatingTimer = document.getElementById('floatingTimer');
    floatingTimerDisplay = document.getElementById('floatingTimerDisplay');
    floatingTimerMode = document.getElementById('floatingTimerMode');

    if (floatingTimer) {
        floatingTimer.addEventListener('click', () => {
            switchApp('pomodoro');
        });
    }
}

function updateFloatingTimer() {
    // Make sure elements are initialized
    if (!floatingTimer) initFloatingTimer();
    if (!floatingTimer || !floatingTimerDisplay || !floatingTimerMode) return;

    // Get the tasks app element
    const tasksApp = document.getElementById('app-tasks');
    if (!tasksApp) return;

    // Show/hide floating timer based on timer state
    const tasksActive = tasksApp.classList.contains('active');

    if (typeof isTimerRunning !== 'undefined' && isTimerRunning && tasksActive) {
        floatingTimer.classList.remove('hidden');
        if (typeof isWorkMode !== 'undefined') {
            if (isWorkMode) {
                floatingTimer.classList.remove('break-mode');
            } else {
                floatingTimer.classList.add('break-mode');
            }
            if (floatingTimerMode) floatingTimerMode.textContent = isWorkMode ? 'Work' : 'Break';
        }
        if (floatingTimerDisplay && typeof remaining !== 'undefined' && typeof formatTime === 'function') {
            floatingTimerDisplay.textContent = formatTime(remaining);
        }
    } else {
        floatingTimer.classList.add('hidden');
    }
}

// Initialize button visibility on page load
function initializeButtonVisibility() {
    const clearDataBtn = document.getElementById('clearDataBtn');
    const clearTasksBtn = document.getElementById('clearTasksBtn');
    const clearCanvasNavBtn = document.getElementById('clearCanvasNavBtn');
    const clearHabitsBtn = document.getElementById('clearHabitsBtn');
    const reintroduceBtn = document.getElementById('reintroduceBtn');

    // Hide all buttons by default (dashboard is the active app on load)
    clearDataBtn?.classList.add('hidden');
    reintroduceBtn?.classList.add('hidden');
    clearTasksBtn?.classList.add('hidden');
    clearCanvasNavBtn?.classList.add('hidden');
    clearHabitsBtn?.classList.add('hidden');
}

// Initialize everything on page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        if (!isAuthenticated && window.firebaseApp) {
            // Check current auth state
            if (window.firebaseApp.currentUser) {
                isAuthenticated = true;
                showUserProfile(window.firebaseApp.currentUser);
                initializeApps();
            }
        }
    }, 500);
});