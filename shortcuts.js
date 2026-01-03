// ============ KEYBOARD SHORTCUTS ============

const SHORTCUTS_KEY = 'pomodoroKeyboardSettings';

// Default shortcuts configuration
const DEFAULT_SHORTCUTS = {
    // Timer controls
    'startPauseTimer': { key: 'Space', ctrlKey: false, altKey: false, description: 'Start/Pause Timer' },
    'resetTimer': { key: 'r', ctrlKey: true, altKey: false, description: 'Reset Timer' },
    'skipTimer': { key: 's', ctrlKey: true, altKey: false, description: 'Skip to Next' },

    // Navigation
    'navPomodoro': { key: '1', ctrlKey: false, altKey: true, description: 'Go to Pomodoro' },
    'navTasks': { key: '2', ctrlKey: false, altKey: true, description: 'Go to Tasks' },
    'navHabits': { key: '3', ctrlKey: false, altKey: true, description: 'Go to Habits' },
    'navDashboard': { key: '4', ctrlKey: false, altKey: true, description: 'Go to Dashboard' },
    'navAnalytics': { key: '5', ctrlKey: false, altKey: true, description: 'Go to Analytics' },
    'navNotes': { key: '6', ctrlKey: false, altKey: true, description: 'Go to Notes' },
    'navSounds': { key: '7', ctrlKey: false, altKey: true, description: 'Go to Sounds' },
    'navSettings': { key: ',', ctrlKey: true, altKey: false, description: 'Go to Settings' },

    // Quick actions
    'newTask': { key: 't', ctrlKey: true, altKey: false, description: 'New Task' },
    'newNote': { key: 'n', ctrlKey: true, altKey: false, description: 'New Note' },
    'toggleSounds': { key: 'm', ctrlKey: true, altKey: false, description: 'Mute/Unmute Sounds' },
    'showShortcuts': { key: '?', ctrlKey: false, altKey: false, description: 'Show Shortcuts' }
};

// State
let shortcuts = {};
let shortcutsEnabled = true;
let shortcutsInitialized = false;

// ============ LOAD/SAVE ============

function loadShortcutSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SHORTCUTS_KEY) || '{}');
        shortcuts = { ...DEFAULT_SHORTCUTS, ...saved.shortcuts };
        shortcutsEnabled = saved.enabled !== false;
    } catch (e) {
        console.error('Error loading shortcuts:', e);
        shortcuts = { ...DEFAULT_SHORTCUTS };
    }
}

function saveShortcutSettings() {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify({
        shortcuts,
        enabled: shortcutsEnabled
    }));
}

// ============ SHORTCUT HANDLING ============

function handleKeyDown(e) {
    if (!shortcutsEnabled) return;

    // Don't trigger when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        // Allow specific shortcuts even in inputs
        if (e.key === 'Escape') {
            closeAllModals();
        }
        return;
    }

    const matchedAction = Object.entries(shortcuts).find(([action, config]) => {
        const keyMatch = e.key.toLowerCase() === config.key.toLowerCase() ||
            (config.key === 'Space' && e.code === 'Space');
        const ctrlMatch = e.ctrlKey === config.ctrlKey;
        const altMatch = e.altKey === config.altKey;
        return keyMatch && ctrlMatch && altMatch;
    });

    if (matchedAction) {
        e.preventDefault();
        executeShortcut(matchedAction[0]);
    }
}

function executeShortcut(action) {
    switch (action) {
        // Timer controls
        case 'startPauseTimer':
            if (typeof toggleTimer === 'function') toggleTimer();
            break;
        case 'resetTimer':
            if (typeof resetTimer === 'function') resetTimer();
            break;
        case 'skipTimer':
            if (typeof skipTimer === 'function') skipTimer();
            break;

        // Navigation
        case 'navPomodoro':
            navigateToApp('pomodoro');
            break;
        case 'navTasks':
            navigateToApp('tasks');
            break;
        case 'navHabits':
            navigateToApp('habits');
            break;
        case 'navDashboard':
            navigateToApp('dashboard');
            break;
        case 'navAnalytics':
            navigateToApp('analytics');
            break;
        case 'navNotes':
            navigateToApp('notes');
            break;
        case 'navSounds':
            navigateToApp('sounds');
            break;
        case 'navSettings':
            navigateToApp('settings');
            break;

        // Quick actions
        case 'newTask':
            openNewTaskModal();
            break;
        case 'newNote':
            if (typeof createAndOpenNote === 'function') createAndOpenNote();
            break;
        case 'toggleSounds':
            toggleAllSounds();
            break;
        case 'showShortcuts':
            showShortcutsModal();
            break;
    }
}

function navigateToApp(appId) {
    const navItem = document.querySelector(`[data-app="${appId}"]`);
    if (navItem) navItem.click();
}

function openNewTaskModal() {
    const taskInput = document.getElementById('taskInput');
    if (taskInput) {
        navigateToApp('tasks');
        setTimeout(() => taskInput.focus(), 100);
    }
}

function toggleAllSounds() {
    if (typeof stopAllSounds === 'function') {
        if (Object.keys(soundsState?.activeSounds || {}).length > 0) {
            stopAllSounds();
        }
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal, .habit-modal, .journal-modal').forEach(modal => {
        modal.classList.add('hidden');
    });

    // Close note editor
    if (typeof closeNoteEditor === 'function') closeNoteEditor();
}

// ============ SHORTCUTS MODAL ============

function showShortcutsModal() {
    let modal = document.getElementById('shortcutsModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shortcutsModal';
        modal.className = 'shortcuts-modal';
        document.body.appendChild(modal);
    }

    const shortcutGroups = {
        'Timer': ['startPauseTimer', 'resetTimer', 'skipTimer'],
        'Navigation': ['navPomodoro', 'navTasks', 'navHabits', 'navDashboard', 'navAnalytics', 'navNotes', 'navSounds', 'navSettings'],
        'Quick Actions': ['newTask', 'newNote', 'toggleSounds', 'showShortcuts']
    };

    modal.innerHTML = `
        <div class="shortcuts-modal-content">
            <div class="shortcuts-modal-header">
                <h3>⌨️ Keyboard Shortcuts</h3>
                <button class="shortcuts-modal-close" onclick="hideShortcutsModal()">×</button>
            </div>
            <div class="shortcuts-modal-body">
                ${Object.entries(shortcutGroups).map(([group, actions]) => `
                    <div class="shortcut-group">
                        <h4>${group}</h4>
                        <div class="shortcut-list">
                            ${actions.map(action => {
        const config = shortcuts[action];
        if (!config) return '';
        return `
                                    <div class="shortcut-item">
                                        <span class="shortcut-desc">${config.description}</span>
                                        <span class="shortcut-keys">${formatShortcut(config)}</span>
                                    </div>
                                `;
    }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="shortcuts-modal-footer">
                <label class="shortcuts-toggle">
                    <input type="checkbox" ${shortcutsEnabled ? 'checked' : ''} onchange="toggleShortcuts(this.checked)">
                    <span>Enable keyboard shortcuts</span>
                </label>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function hideShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) modal.classList.add('hidden');
}

function formatShortcut(config) {
    const parts = [];
    if (config.ctrlKey) parts.push('Ctrl');
    if (config.altKey) parts.push('Alt');
    parts.push(config.key === 'Space' ? '␣' : config.key.toUpperCase());
    return parts.map(p => `<kbd>${p}</kbd>`).join(' + ');
}

function toggleShortcuts(enabled) {
    shortcutsEnabled = enabled;
    saveShortcutSettings();
}

// ============ INITIALIZATION ============

function initKeyboardShortcuts() {
    if (shortcutsInitialized) return;

    loadShortcutSettings();

    // Add global keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    shortcutsInitialized = true;
    console.log('Keyboard shortcuts initialized');
}

// Auto-init on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKeyboardShortcuts);
} else {
    initKeyboardShortcuts();
}

// Make functions globally available
window.initKeyboardShortcuts = initKeyboardShortcuts;
window.showShortcutsModal = showShortcutsModal;
window.hideShortcutsModal = hideShortcutsModal;
window.toggleShortcuts = toggleShortcuts;
