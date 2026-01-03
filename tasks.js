// ============ TASK MANAGER APP ============

const TASKS_KEY = 'pomodoroTasks';
const TRACKERS_KEY = 'pomodoroTrackers';
const CUSTOM_TAG_COLORS_KEY = 'pomodoroTagColors';
const RECURRING_TASKS_KEY = 'pomodoroRecurringTasks';
const RECURRING_HISTORY_KEY = 'pomodoroRecurringHistory';

// Firebase sync state
let tasksUnsubscribe = null;
let trackersUnsubscribe = null;
let tagColorsUnsubscribe = null;
let isSyncingTasks = false;
let isSyncingTrackers = false;
let isSyncingTagColors = false;

// DOM Elements
const taskList = document.getElementById('taskList');
const taskFilters = document.querySelectorAll('.filter-btn');
const clearTasksBtn = document.getElementById('clearTasksBtn');
const clearTasksModal = document.getElementById('clearTasksModal');
const cancelClearTasksBtn = document.getElementById('cancelClearTasksBtn');
const confirmClearTasksBtn = document.getElementById('confirmClearTasksBtn');
const totalTasksEl = document.getElementById('totalTasks');
const completedTasksEl = document.getElementById('completedTasks');

// Task Modal Elements
const openAddTaskBtn = document.getElementById('openAddTaskBtn');
const addTaskModal = document.getElementById('addTaskModal');
const closeAddTaskModal = document.getElementById('closeAddTaskModal');
const cancelAddTaskBtn = document.getElementById('cancelAddTaskBtn');
const addTaskForm = document.getElementById('addTaskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskDescriptionInput = document.getElementById('taskDescription');
const taskDueDateInput = document.getElementById('taskDueDate');
const taskDeadlineInput = document.getElementById('taskDeadline');
const taskMediaInput = document.getElementById('taskMedia');
const fileBtn = document.querySelector('.file-btn');
const fileNameDisplay = document.querySelector('.file-name');
const tagDropdownBtn = document.getElementById('tagDropdownBtn');
const tagDropdown = document.getElementById('tagDropdown');
const selectedTagsContainer = document.getElementById('selectedTags');
const newTagInput = document.getElementById('newTagInput');

// State
let currentTaskFilter = 'all';
let tasks = [];
let trackers = [];
let customTagColors = {};
let selectedTags = [];
let editingTaskId = null;
let recurringTasks = [];
let recurringHistory = {};
const MAX_TAGS = 5;

// Default tag colors
const DEFAULT_TAG_COLORS = {
    work: { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.4)', color: '#3b82f6' },
    study: { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(168, 85, 247, 0.4)', color: '#a855f7' },
    personal: { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.4)', color: '#22c55e' },
    urgent: { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' },
    coding: { bg: 'rgba(6, 182, 212, 0.2)', border: 'rgba(6, 182, 212, 0.4)', color: '#06b6d4' },
    reading: { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' },
    exercise: { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgba(236, 72, 153, 0.4)', color: '#ec4899' }
};

// Color palette for custom tags
const COLOR_PALETTE = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Gray', value: '#6b7280' }
];

// ============ LOAD/SAVE FUNCTIONS ============

function loadTasks() {
    try {
        const stored = localStorage.getItem(TASKS_KEY);
        tasks = stored ? JSON.parse(stored) : [];
        // Migrate old tasks to new state system
        tasks = tasks.map(task => ({
            ...task,
            state: task.state || (task.completed ? 'done' : 'todo')
        }));
    } catch (e) {
        console.error('Error loading tasks:', e);
        tasks = [];
    }
}

function loadTrackers() {
    try {
        const stored = localStorage.getItem(TRACKERS_KEY);
        trackers = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading trackers:', e);
        trackers = [];
    }
}

function loadCustomTagColors() {
    try {
        const stored = localStorage.getItem(CUSTOM_TAG_COLORS_KEY);
        customTagColors = stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error loading tag colors:', e);
        customTagColors = {};
    }
}

function loadRecurringTasks() {
    try {
        const stored = localStorage.getItem(RECURRING_TASKS_KEY);
        recurringTasks = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading recurring tasks:', e);
        recurringTasks = [];
    }
}

function loadRecurringHistory() {
    try {
        const stored = localStorage.getItem(RECURRING_HISTORY_KEY);
        recurringHistory = stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error loading recurring history:', e);
        recurringHistory = {};
    }
}

function saveRecurringTasks() {
    localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(recurringTasks));
    debouncedSaveRecurringTasksToFirebase();
}

function saveRecurringHistory() {
    localStorage.setItem(RECURRING_HISTORY_KEY, JSON.stringify(recurringHistory));
    debouncedSaveRecurringHistoryToFirebase();
}

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

// Debounced Firebase save functions (300ms delay to batch rapid changes)
const debouncedSaveTasksToFirebase = debounce(saveTasksToFirebaseImpl, 300);
const debouncedSaveTrackersToFirebase = debounce(saveTrackersToFirebaseImpl, 300);
const debouncedSaveTagColorsToFirebase = debounce(saveTagColorsToFirebaseImpl, 300);
const debouncedSaveRecurringTasksToFirebase = debounce(saveRecurringTasksToFirebaseImpl, 300);
const debouncedSaveRecurringHistoryToFirebase = debounce(saveRecurringHistoryToFirebaseImpl, 300);

function saveTasks() {
    if (isSyncingTasks) return;
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    updateTaskStats();
    updateTrackersDisplay();
    updateDoingTasksInPomodoro();
    debouncedSaveTasksToFirebase();
}

function saveTrackers() {
    if (isSyncingTrackers) return;
    localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
    debouncedSaveTrackersToFirebase();
}

function saveCustomTagColors() {
    if (isSyncingTagColors) return;
    localStorage.setItem(CUSTOM_TAG_COLORS_KEY, JSON.stringify(customTagColors));
    debouncedSaveTagColorsToFirebase();
}

// ============ FIREBASE SYNC FUNCTIONS ============

async function saveTasksToFirebaseImpl() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const tasksRef = window.firebaseApp.getTasksRef();
        const batch = firebase.firestore().batch();

        // Get existing tasks to delete removed ones
        const snapshot = await tasksRef.get();
        const existingIds = new Set(snapshot.docs.map(doc => doc.id));
        const currentIds = new Set(tasks.map(t => t.id.toString()));

        // Delete tasks that no longer exist
        snapshot.docs.forEach(doc => {
            if (!currentIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        // Update/create tasks
        tasks.forEach(task => {
            const taskRef = tasksRef.doc(task.id.toString());
            batch.set(taskRef, {
                ...task,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
    } catch (e) {
        console.error('Error saving tasks to Firebase:', e);
    }
}

async function saveTrackersToFirebaseImpl() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const trackersRef = window.firebaseApp.getTrackersRef();
        const batch = firebase.firestore().batch();

        // Get existing trackers
        const snapshot = await trackersRef.get();
        const currentIds = new Set(trackers.map(t => t.id.toString()));

        // Delete removed trackers
        snapshot.docs.forEach(doc => {
            if (!currentIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        // Update/create trackers
        trackers.forEach(tracker => {
            const trackerRef = trackersRef.doc(tracker.id.toString());
            batch.set(trackerRef, {
                ...tracker,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
    } catch (e) {
        console.error('Error saving trackers to Firebase:', e);
    }
}

async function saveTagColorsToFirebaseImpl() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const userRef = window.firebaseApp.getUserRef();
        await userRef.set({
            tagColors: customTagColors,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error saving tag colors to Firebase:', e);
    }
}

async function saveRecurringTasksToFirebaseImpl() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const userRef = window.firebaseApp.getUserRef();
        await userRef.set({
            recurringTasks: recurringTasks,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error saving recurring tasks to Firebase:', e);
    }
}

async function saveRecurringHistoryToFirebaseImpl() {
    if (!window.firebaseApp || !window.firebaseApp.currentUser) return;

    try {
        const userRef = window.firebaseApp.getUserRef();
        await userRef.set({
            recurringHistory: recurringHistory,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error saving recurring history to Firebase:', e);
    }
}

// Old sync function removed - using setupTasksSyncAsync instead

// Listen for auth state changes (for logout handling)
window.addEventListener('authStateChanged', (e) => {
    console.log('Tasks: authStateChanged event received, user:', e.detail.user?.email);

    // Only handle logout here - login is handled in initializeTasks
    if (!e.detail.user) {
        // Unsubscribe from all listeners
        if (tasksUnsubscribe) tasksUnsubscribe();
        if (trackersUnsubscribe) trackersUnsubscribe();
        if (tagColorsUnsubscribe) tagColorsUnsubscribe();
        tasksUnsubscribe = null;
        trackersUnsubscribe = null;
        tagColorsUnsubscribe = null;
        // Clear tasks display for logged out user
        tasks = [];
        trackers = [];
        customTagColors = {};
        updateTaskDisplay();
        updateTrackersDisplay();
    } else if (initialDataLoaded && !tasksUnsubscribe) {
        // User logged in after initial load, set up sync
        setupTasksSyncAsync();
    }
});

// ============ TAG COLOR FUNCTIONS ============

function getTagColor(tag) {
    const lowerTag = tag.toLowerCase();
    if (DEFAULT_TAG_COLORS[lowerTag]) {
        return DEFAULT_TAG_COLORS[lowerTag];
    }
    if (customTagColors[lowerTag]) {
        const hex = customTagColors[lowerTag];
        return {
            bg: `${hex}33`,
            border: `${hex}66`,
            color: hex
        };
    }
    // Default gray for unknown tags
    return { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.4)', color: '#6b7280' };
}

function getTagStyle(tag) {
    const colors = getTagColor(tag);
    return `background: ${colors.bg}; border-color: ${colors.border}; color: ${colors.color};`;
}

function isCustomTag(tag) {
    const lowerTag = tag.toLowerCase();
    return !DEFAULT_TAG_COLORS[lowerTag];
}

// ============ TASK MODAL FUNCTIONS ============

function openAddTaskModalFunc(taskId = null) {
    editingTaskId = taskId;
    const modalTitle = document.querySelector('#addTaskModal .modal-title');
    const submitBtn = document.querySelector('#addTaskModal .modal-btn.confirm');

    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            modalTitle.textContent = 'Edit Task';
            submitBtn.textContent = 'Save Changes';
            taskTitleInput.value = task.title;
            taskDescriptionInput.value = task.description || '';
            taskDueDateInput.value = task.dueDate || '';
            taskDeadlineInput.value = task.deadline || '';
            selectedTags = [...(task.tags || [])];

            // Preserve existing media (handle both array and single object for backwards compatibility)
            if (task.media) {
                if (Array.isArray(task.media)) {
                    currentMediaData = [...task.media];
                } else {
                    // Convert old single media format to array
                    currentMediaData = [task.media];
                }
            } else {
                currentMediaData = [];
            }
            updateSelectedFilesList();
        }
    } else {
        modalTitle.textContent = 'Create New Task';
        submitBtn.textContent = 'Create Task';
        selectedTags = [];
        currentMediaData = [];
        updateSelectedFilesList();
    }

    renderTagBadges();
    addTaskModal.classList.remove('hidden');
    taskTitleInput.focus();
}

function closeAddTaskModalFunc() {
    addTaskModal.classList.add('hidden');
    resetTaskForm();
    editingTaskId = null;
}

function resetTaskForm() {
    addTaskForm.reset();
    selectedTags = [];
    currentMediaData = [];
    updateSelectedFilesList();
    renderTagBadges();
    resetRecurringForm();
}

// ============ TAG MANAGEMENT ============

function renderTagBadges() {
    selectedTagsContainer.innerHTML = selectedTags.map(tag => {
        const style = getTagStyle(tag);
        const isCustom = isCustomTag(tag);
        return `
            <span class="tag-badge" data-tag="${tag}" style="${style}">
                ${escapeHtml(tag)} 
                ${isCustom ? `<button type="button" class="tag-color-btn" onclick="openTagColorPicker('${tag}')" title="Change color">🎨</button>` : ''}
                <button type="button" class="tag-remove">×</button>
            </span>
        `;
    }).join('');

    document.querySelectorAll('#selectedTags .tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tag = btn.closest('.tag-badge').getAttribute('data-tag');
            selectedTags = selectedTags.filter(t => t !== tag);
            renderTagBadges();
        });
    });
}

function addTag(tag) {
    if (selectedTags.length >= MAX_TAGS) return;
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !selectedTags.includes(normalizedTag)) {
        selectedTags.push(normalizedTag);
        renderTagBadges();
    }
    tagDropdown.classList.add('hidden');
    newTagInput.value = '';
}

function openTagColorPicker(tag) {
    const existingPicker = document.querySelector('.tag-color-picker');
    if (existingPicker) existingPicker.remove();

    const picker = document.createElement('div');
    picker.className = 'tag-color-picker';
    picker.innerHTML = `
        <div class="color-picker-header">
            <span>Choose color for "${tag}"</span>
            <button class="color-picker-close">×</button>
        </div>
        <div class="color-palette">
            ${COLOR_PALETTE.map(c => `
                <button class="color-option" data-color="${c.value}" style="background: ${c.value};" title="${c.name}"></button>
            `).join('')}
        </div>
    `;

    document.body.appendChild(picker);

    picker.querySelector('.color-picker-close').onclick = () => picker.remove();
    picker.querySelectorAll('.color-option').forEach(btn => {
        btn.onclick = () => {
            customTagColors[tag.toLowerCase()] = btn.dataset.color;
            saveCustomTagColors();
            renderTagBadges();
            updateTaskDisplay();
            picker.remove();
        };
    });
}

// ============ TASK CRUD OPERATIONS ============

function createTask(taskData) {
    const task = {
        id: Date.now(),
        title: taskData.title,
        description: taskData.description || '',
        dueDate: taskData.dueDate || '',
        deadline: taskData.deadline || '',
        tags: taskData.tags || [],
        media: taskData.media || null,
        state: 'todo', // todo, doing, done
        createdAt: new Date().toISOString()
    };
    tasks.unshift(task);
    saveTasks();
    return task;
}

function updateTask(taskId, updates) {
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates };
        saveTasks();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    updateTaskDisplay();
}

function changeTaskState(id, newState) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.state = newState;
        saveTasks();
        updateTaskDisplay();
    }
}

// ============ TASK DISPLAY ============

function updateTaskDisplay() {
    const filteredTasks = tasks.filter(task => {
        if (currentTaskFilter === 'all') return true;
        if (currentTaskFilter === 'recurring') return task.isRecurringInstance;
        return task.state === currentTaskFilter;
    });

    if (filteredTasks.length === 0) {
        const emptyMessages = {
            'all': 'No tasks yet. Add one to get started! 📋',
            'todo': 'No tasks to do. Great job! 🎉',
            'doing': 'No tasks in progress. Start working on something! 💪',
            'done': 'No completed tasks yet. Keep going! 🚀',
            'recurring': 'No recurring tasks. Create one to build habits! 🔁'
        };
        taskList.innerHTML = `<p class="empty-state">${emptyMessages[currentTaskFilter]}</p>`;
        return;
    }

    taskList.innerHTML = filteredTasks.map(task => {
        // Handle media display (both array and single object for backwards compatibility)
        let mediaCount = 0;
        if (task.media) {
            mediaCount = Array.isArray(task.media) ? task.media.length : 1;
        }

        // Recurring task info
        const isRecurring = task.isRecurringInstance;
        let recurringBadge = '';
        let recurringStats = '';
        let recurringActions = '';

        if (isRecurring) {
            const recurringTask = recurringTasks.find(rt => rt.id === task.recurringTaskId);
            if (recurringTask) {
                const scheduleText = getRecurringScheduleText(recurringTask);
                const stats = getRecurringTaskStats(task.recurringTaskId);

                recurringBadge = `
                    <span class="task-recurring-badge">
                        🔁 ${scheduleText}
                        ${task.occurrenceNumber ? `(${task.occurrenceNumber}/${task.totalForPeriod})` : ''}
                    </span>
                `;

                if (stats) {
                    recurringStats = `
                        <div class="recurring-stats">
                            <span class="recurring-stat">
                                ✅ <span class="recurring-stat-value">${stats.totalCompleted}</span> done
                            </span>
                            <span class="recurring-stat">
                                🔥 <span class="recurring-stat-value recurring-streak">${stats.currentStreak}</span> streak
                            </span>
                            <span class="recurring-stat">
                                📊 <span class="recurring-stat-value">${stats.completionRate}%</span>
                            </span>
                            ${stats.totalMissed > 0 ? `
                                <span class="recurring-stat">
                                    ❌ <span class="recurring-stat-value recurring-missed">${stats.totalMissed}</span> missed
                                </span>
                            ` : ''}
                        </div>
                    `;
                }

                if (task.state !== 'done') {
                    recurringActions = `
                        <div class="recurring-actions" onclick="event.stopPropagation()">
                            ${task.state === 'todo' ? `
                                <button class="recurring-action-btn doing-btn" onclick="startRecurringOccurrence('${task.id}')" title="Start working on this">
                                    🔄 Start
                                </button>
                            ` : ''}
                            ${task.state === 'doing' ? `
                                <button class="recurring-action-btn stop-btn" onclick="stopRecurringOccurrence('${task.id}')" title="Stop and continue later">
                                    ⏸️ Stop
                                </button>
                            ` : ''}
                            <button class="recurring-action-btn complete-btn" onclick="completeRecurringOccurrence('${task.id}')" title="Complete this occurrence">
                                ✅ Done
                            </button>
                            <button class="recurring-action-btn skip-btn" onclick="showSkipModal('${task.id}')" title="Skip this time">
                                ⏭️ Skip
                            </button>
                        </div>
                    `;
                }
            }
        }

        // Handle task ID for onclick - wrap strings in quotes
        const taskIdAttr = typeof task.id === 'string' ? `'${task.id}'` : task.id;

        return `
        <div class="task-item task-state-${task.state} ${isRecurring ? 'recurring-task' : ''}" data-task-id="${task.id}">
            <div class="task-state-indicator ${task.state}"></div>
            <div class="task-content" onclick="viewTaskDetails(${taskIdAttr})" style="cursor: pointer;">
                <div class="task-header-row">
                    <span class="task-text">${escapeHtml(task.title)}${recurringBadge}</span>
                    <div class="task-actions" onclick="event.stopPropagation()">
                        <button class="task-action-btn view-btn" onclick="viewTaskDetails(${taskIdAttr})" title="View">👁️</button>
                        ${!isRecurring ? `<button class="task-action-btn edit-btn" onclick="openAddTaskModalFunc(${taskIdAttr})" title="Edit">✏️</button>` : ''}
                        <button class="task-action-btn delete-btn" onclick="${isRecurring ? `deleteTaskOccurrence(${taskIdAttr})` : `deleteTask(${taskIdAttr})`}" title="Delete">🗑️</button>
                    </div>
                </div>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description).substring(0, 100)}${task.description.length > 100 ? '...' : ''}</p>` : ''}
                ${task.dueDate ? `<span class="task-date">📅 ${task.dueDate}${task.deadline ? ' ' + task.deadline : ''}</span>` : ''}
                ${mediaCount > 0 ? `<span class="task-media-indicator">📎 ${mediaCount} file${mediaCount > 1 ? 's' : ''}</span>` : ''}
                ${task.tags && task.tags.length > 0 ? `
                    <div class="task-tags">
                        ${task.tags.map(tag => `<span class="task-tag" style="${getTagStyle(tag)}">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                ${isRecurring ? recurringStats : ''}
                ${isRecurring && task.state !== 'done' ? recurringActions : ''}
                ${!isRecurring ? `
                <div class="task-state-selector" onclick="event.stopPropagation()">
                    <button class="state-btn ${task.state === 'todo' ? 'active' : ''}" onclick="changeTaskState(${taskIdAttr}, 'todo')" title="To Do">
                        📋 To Do
                    </button>
                    <button class="state-btn ${task.state === 'doing' ? 'active' : ''}" onclick="changeTaskState(${taskIdAttr}, 'doing')" title="Doing">
                        🔄 Doing
                    </button>
                    <button class="state-btn ${task.state === 'done' ? 'active' : ''}" onclick="changeTaskState(${taskIdAttr}, 'done')" title="Done">
                        ✅ Done
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `}).join('');
}

// Delete just the task occurrence (not the recurring template)
function deleteTaskOccurrence(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.isRecurringInstance) {
        showDeleteOccurrenceModal(taskId);
    } else {
        deleteTask(taskId);
    }
}

// Show custom delete modal for recurring occurrence
function showDeleteOccurrenceModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let deleteModal = document.getElementById('deleteOccurrenceModal');
    if (!deleteModal) {
        deleteModal = document.createElement('div');
        deleteModal.className = 'modal';
        deleteModal.id = 'deleteOccurrenceModal';
        document.body.appendChild(deleteModal);
    }

    // Store taskId for confirm function
    deleteModal.dataset.taskId = taskId;

    deleteModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Delete Occurrence</h2>
                <button class="modal-close" onclick="closeDeleteOccurrenceModal()">&times;</button>
            </div>
            <p class="modal-message">Delete this occurrence of "${escapeHtml(task.title)}"?</p>
            <p style="font-size: 12px; color: rgba(230, 238, 248, 0.6); margin-top: 8px;">
                The recurring task will still generate future occurrences.
            </p>
            <div class="modal-buttons">
                <button class="modal-btn cancel" onclick="closeDeleteOccurrenceModal()">Cancel</button>
                <button class="modal-btn confirm" onclick="confirmDeleteOccurrence()">Delete</button>
            </div>
        </div>
    `;

    deleteModal.classList.remove('hidden');
}

function closeDeleteOccurrenceModal() {
    const modal = document.getElementById('deleteOccurrenceModal');
    if (modal) modal.classList.add('hidden');
}

function confirmDeleteOccurrence() {
    const modal = document.getElementById('deleteOccurrenceModal');
    const taskId = modal?.dataset.taskId;
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (task && task.isRecurringInstance) {
        // Mark this occurrence as deleted in history so it won't be regenerated
        const historyEntry = {
            date: new Date().toISOString().split('T')[0],
            periodKey: task.periodKey,
            status: 'deleted',
            timestamp: new Date().toISOString(),
            taskId: taskId
        };

        if (!recurringHistory[task.recurringTaskId]) {
            recurringHistory[task.recurringTaskId] = [];
        }
        recurringHistory[task.recurringTaskId].push(historyEntry);
        saveRecurringHistory();
    }

    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks();
    updateTaskDisplay();
    closeDeleteOccurrenceModal();
}

window.showDeleteOccurrenceModal = showDeleteOccurrenceModal;
window.closeDeleteOccurrenceModal = closeDeleteOccurrenceModal;
window.confirmDeleteOccurrence = confirmDeleteOccurrence;

// Show delete recurring task modal (for deleting the entire recurring task template)
function showDeleteRecurringTaskModal(recurringTaskId) {
    const recurringTask = recurringTasks.find(rt => rt.id === recurringTaskId);
    if (!recurringTask) return;

    let deleteModal = document.getElementById('deleteRecurringTaskModal');
    if (!deleteModal) {
        deleteModal = document.createElement('div');
        deleteModal.className = 'modal';
        deleteModal.id = 'deleteRecurringTaskModal';
        document.body.appendChild(deleteModal);
    }

    deleteModal.dataset.recurringTaskId = recurringTaskId;

    deleteModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Delete Recurring Task</h2>
                <button class="modal-close" onclick="closeDeleteRecurringTaskModal()">&times;</button>
            </div>
            <p class="modal-message">Delete "${escapeHtml(recurringTask.title)}" and all its occurrences?</p>
            <p style="font-size: 12px; color: rgba(230, 238, 248, 0.6); margin-top: 8px;">
                This will permanently delete the recurring task template and all generated occurrences. This action cannot be undone.
            </p>
            <div class="modal-buttons">
                <button class="modal-btn cancel" onclick="closeDeleteRecurringTaskModal()">Cancel</button>
                <button class="modal-btn confirm" onclick="confirmDeleteRecurringTask()" style="background: linear-gradient(180deg, #ef4444, #dc2626);">Delete All</button>
            </div>
        </div>
    `;

    deleteModal.classList.remove('hidden');
}

function closeDeleteRecurringTaskModal() {
    const modal = document.getElementById('deleteRecurringTaskModal');
    if (modal) modal.classList.add('hidden');
}

function confirmDeleteRecurringTask() {
    const modal = document.getElementById('deleteRecurringTaskModal');
    const recurringTaskId = modal?.dataset.recurringTaskId;
    if (!recurringTaskId) return;

    deleteRecurringTask(recurringTaskId);
    closeDeleteRecurringTaskModal();
    closeViewTaskModal();
}

window.showDeleteRecurringTaskModal = showDeleteRecurringTaskModal;
window.closeDeleteRecurringTaskModal = closeDeleteRecurringTaskModal;
window.confirmDeleteRecurringTask = confirmDeleteRecurringTask;

// Show skip modal for recurring tasks
function showSkipModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let skipModal = document.getElementById('skipTaskModal');
    if (!skipModal) {
        skipModal = document.createElement('div');
        skipModal.className = 'modal';
        skipModal.id = 'skipTaskModal';
        document.body.appendChild(skipModal);
    }

    // Store taskId for confirm function
    skipModal.dataset.taskId = taskId;

    skipModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Skip Occurrence</h2>
                <button class="modal-close" onclick="closeSkipModal()">&times;</button>
            </div>
            <p class="modal-message">Skip "${escapeHtml(task.title)}" for today?</p>
            <p class="skip-info" style="font-size: 12px; color: rgba(230, 238, 248, 0.6); margin-top: 8px;">
                This will mark today's occurrence as skipped. It won't count against your streak, but will appear in your history.
            </p>
            <div class="form-group" style="margin-top: 16px;">
                <label for="skipReason">Reason (optional)</label>
                <input type="text" id="skipReason" class="form-input" placeholder="e.g., Feeling sick, traveling...">
            </div>
            <div class="modal-buttons">
                <button class="modal-btn cancel" onclick="closeSkipModal()">Cancel</button>
                <button class="modal-btn confirm" onclick="confirmSkip()" style="background: linear-gradient(180deg, #f59e0b, #d97706);">Skip</button>
            </div>
        </div>
    `;

    skipModal.classList.remove('hidden');
}

function closeSkipModal() {
    const modal = document.getElementById('skipTaskModal');
    if (modal) modal.classList.add('hidden');
}

function confirmSkip() {
    const modal = document.getElementById('skipTaskModal');
    const taskId = modal?.dataset.taskId;
    if (!taskId) return;

    const reason = document.getElementById('skipReason')?.value || '';
    skipRecurringOccurrence(taskId, reason);
    closeSkipModal();
}

window.deleteTaskOccurrence = deleteTaskOccurrence;
window.showSkipModal = showSkipModal;
window.closeSkipModal = closeSkipModal;
window.confirmSkip = confirmSkip;

// ============ TASK STATS & TRACKERS ============

function updateTaskStats() {
    const total = tasks.length;
    const done = tasks.filter(t => t.state === 'done').length;
    const doing = tasks.filter(t => t.state === 'doing').length;
    const todo = tasks.filter(t => t.state === 'todo').length;
    const recurring = tasks.filter(t => t.isRecurringInstance).length;

    totalTasksEl.textContent = total;
    completedTasksEl.textContent = done;

    // Update additional stats if elements exist
    const doingTasksEl = document.getElementById('doingTasks');
    const todoTasksEl = document.getElementById('todoTasks');
    const recurringTasksEl = document.getElementById('recurringTasks');
    if (doingTasksEl) doingTasksEl.textContent = doing;
    if (todoTasksEl) todoTasksEl.textContent = todo;
    if (recurringTasksEl) recurringTasksEl.textContent = recurring;
}

function updateTrackersDisplay() {
    const trackersContainer = document.getElementById('customTrackers');
    if (!trackersContainer) return;

    trackersContainer.innerHTML = trackers.map(tracker => {
        const count = tasks.filter(t =>
            t.tags && t.tags.some(tag => tag.toLowerCase() === tracker.tag.toLowerCase()) &&
            (tracker.countState === 'all' || t.state === tracker.countState)
        ).length;

        const tagColors = getTagColor(tracker.tag);

        return `
            <div class="tracker-item" style="border-color: ${tagColors.border};">
                <span class="tracker-label" style="color: ${tagColors.color};">${escapeHtml(tracker.name)}</span>
                <span class="tracker-value" style="color: ${tagColors.color};">${count}</span>
                <button class="tracker-remove" onclick="removeTracker('${tracker.id}')" title="Remove tracker">×</button>
            </div>
        `;
    }).join('');
}

function addTracker(name, tag, countState = 'all') {
    const tracker = {
        id: Date.now().toString(),
        name,
        tag,
        countState
    };
    trackers.push(tracker);
    saveTrackers();
    updateTrackersDisplay();
}

function removeTracker(id) {
    trackers = trackers.filter(t => t.id !== id);
    saveTrackers();
    updateTrackersDisplay();
}

// ============ DOING TASKS IN POMODORO ============

function updateDoingTasksInPomodoro() {
    const doingTasksPanel = document.getElementById('doingTasksPanel');
    if (!doingTasksPanel) return;

    const doingTasks = tasks.filter(t => t.state === 'doing');
    const doingCountEl = document.getElementById('doingTasksCount');

    if (doingCountEl) {
        doingCountEl.textContent = doingTasks.length;
    }

    if (doingTasks.length === 0) {
        doingTasksPanel.classList.add('hidden');
        return;
    }

    doingTasksPanel.classList.remove('hidden');
    const tasksList = doingTasksPanel.querySelector('.doing-tasks-list');

    if (tasksList) {
        tasksList.innerHTML = doingTasks.map(task => `
            <div class="doing-task-item" data-task-id="${task.id}">
                <div class="doing-task-info">
                    <span class="doing-task-title">${escapeHtml(task.title)}</span>
                    ${task.tags && task.tags.length > 0 ? `
                        <div class="doing-task-tags">
                            ${task.tags.slice(0, 2).map(tag => `<span class="mini-tag" style="${getTagStyle(tag)}">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <button class="mark-done-btn" onclick="markTaskDoneFromPomodoro(${task.id})" title="Mark as done">✓</button>
            </div>
        `).join('');
    }
}

function markTaskDoneFromPomodoro(id) {
    changeTaskState(id, 'done');
    updateDoingTasksInPomodoro();
}

// Make functions globally available
window.changeTaskState = changeTaskState;
window.deleteTask = deleteTask;
window.openAddTaskModalFunc = openAddTaskModalFunc;
window.openTagColorPicker = openTagColorPicker;
window.removeTracker = removeTracker;
window.markTaskDoneFromPomodoro = markTaskDoneFromPomodoro;

// ============ EVENT LISTENERS ============

// Task Form Submission
addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = taskTitleInput.value.trim();
    if (!title) {
        alert('Task title is required');
        return;
    }

    const taskData = {
        title: title,
        description: taskDescriptionInput.value.trim(),
        dueDate: taskDueDateInput.value,
        deadline: taskDeadlineInput.value,
        tags: [...selectedTags],
        media: currentMediaData.length > 0 ? [...currentMediaData] : null
    };

    // Check if this is a recurring task
    const isRecurring = taskRecurringCheckbox && taskRecurringCheckbox.checked;

    if (isRecurring && !editingTaskId) {
        // Create recurring task
        const endTypeRadio = document.querySelector('input[name="recurringEnd"]:checked');
        const recurringData = {
            amount: parseInt(recurringAmount?.value) || 1,
            unit: recurringUnit?.value || 'day',
            timesPerPeriod: parseInt(recurringTimesPerPeriod?.value) || 1,
            timesPeriod: recurringTimesPeriod?.value || 'day',
            startDate: recurringStartDate?.value || new Date().toISOString().split('T')[0],
            endType: endTypeRadio?.value || 'never',
            endDate: endTypeRadio?.value === 'date' ? recurringEndDateInput?.value : null,
            maxOccurrences: endTypeRadio?.value === 'occurrences' ? parseInt(recurringOccurrencesInput?.value) : null
        };

        createRecurringTask(taskData, recurringData);
    } else if (editingTaskId) {
        updateTask(editingTaskId, taskData);
    } else {
        createTask(taskData);
    }

    // Reset media data
    currentMediaData = [];
    resetRecurringForm();

    updateTaskDisplay();
    closeAddTaskModalFunc();
});

// Modal controls
openAddTaskBtn.addEventListener('click', () => openAddTaskModalFunc());
closeAddTaskModal.addEventListener('click', closeAddTaskModalFunc);
cancelAddTaskBtn.addEventListener('click', closeAddTaskModalFunc);

addTaskModal.addEventListener('click', (e) => {
    if (e.target === addTaskModal) {
        closeAddTaskModalFunc();
    }
});

// File input handling
fileBtn.addEventListener('click', () => taskMediaInput.click());

// Store files as base64 array
let currentMediaData = [];

taskMediaInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        fileNameDisplay.textContent = `${files.length} file(s) selected`;

        // Convert all files to base64
        const mediaPromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        data: event.target.result
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        const newMedia = await Promise.all(mediaPromises);
        // Add to existing media instead of replacing
        currentMediaData = [...currentMediaData, ...newMedia];
        updateSelectedFilesList();
    }
});

function updateSelectedFilesList() {
    const listEl = document.getElementById('selectedFilesList');
    if (!listEl) return;

    if (currentMediaData.length === 0) {
        listEl.innerHTML = '';
        fileNameDisplay.textContent = 'No files chosen';
        return;
    }

    fileNameDisplay.textContent = `${currentMediaData.length} file(s) selected`;
    listEl.innerHTML = currentMediaData.map((file, index) => `
        <div class="selected-file-item">
            <span class="selected-file-name">${getFileIcon(file.type)} ${escapeHtml(file.name)}</span>
            <button type="button" class="selected-file-remove" onclick="removeSelectedFile(${index})">×</button>
        </div>
    `).join('');
}

function getFileIcon(type) {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('document')) return '📄';
    return '📎';
}

window.removeSelectedFile = function (index) {
    currentMediaData.splice(index, 1);
    updateSelectedFilesList();
};

// Tag dropdown handling
tagDropdownBtn.addEventListener('click', (e) => {
    e.preventDefault();
    tagDropdown.classList.toggle('hidden');
});

document.querySelectorAll('.tag-option').forEach(option => {
    option.addEventListener('click', () => {
        const tag = option.getAttribute('data-value');
        addTag(tag);
    });
});

newTagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const newTag = newTagInput.value.trim();
        if (newTag) {
            addTag(newTag);
        }
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.tag-selector')) {
        tagDropdown.classList.add('hidden');
    }
});

// Filter tasks
taskFilters.forEach(btn => {
    btn.addEventListener('click', () => {
        taskFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTaskFilter = btn.getAttribute('data-filter');
        updateTaskDisplay();
    });
});

// Clear all tasks
if (clearTasksBtn) {
    clearTasksBtn.addEventListener('click', () => {
        if (tasks.length === 0) return;
        clearTasksModal.classList.remove('hidden');
    });
}

if (cancelClearTasksBtn) {
    cancelClearTasksBtn.addEventListener('click', () => {
        clearTasksModal.classList.add('hidden');
    });
}

if (confirmClearTasksBtn) {
    confirmClearTasksBtn.addEventListener('click', () => {
        tasks = [];
        saveTasks();
        updateTaskDisplay();
        clearTasksModal.classList.add('hidden');
    });
}

// Add Tracker Modal
const addTrackerBtn = document.getElementById('addTrackerBtn');
const addTrackerModal = document.getElementById('addTrackerModal');

if (addTrackerBtn && addTrackerModal) {
    const closeTrackerModal = document.getElementById('closeTrackerModal');
    const cancelTrackerBtn = document.getElementById('cancelTrackerBtn');
    const trackerForm = document.getElementById('addTrackerForm');
    const trackerTagOptions = document.getElementById('trackerTagOptions');

    // Populate tracker tag options
    function populateTrackerTagOptions() {
        if (!trackerTagOptions) return;

        const allTags = new Set();
        Object.keys(DEFAULT_TAG_COLORS).forEach(tag => allTags.add(tag));
        tasks.forEach(task => {
            if (task.tags) {
                task.tags.forEach(tag => allTags.add(tag.toLowerCase()));
            }
        });
        Object.keys(customTagColors).forEach(tag => allTags.add(tag));

        trackerTagOptions.innerHTML = Array.from(allTags).map(tag => {
            const style = getTagStyle(tag);
            return `
                <label class="tracker-tag-option" style="${style}">
                    <input type="radio" name="trackerTag" value="${tag}">
                    ${tag.charAt(0).toUpperCase() + tag.slice(1)}
                </label>
            `;
        }).join('');
    }

    addTrackerBtn.addEventListener('click', () => {
        populateTrackerTagOptions();
        addTrackerModal.classList.remove('hidden');
    });

    if (closeTrackerModal) {
        closeTrackerModal.addEventListener('click', () => addTrackerModal.classList.add('hidden'));
    }
    if (cancelTrackerBtn) {
        cancelTrackerBtn.addEventListener('click', () => addTrackerModal.classList.add('hidden'));
    }

    if (trackerForm) {
        trackerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('trackerName').value.trim();
            const tagRadio = trackerForm.querySelector('input[name="trackerTag"]:checked');

            if (name && tagRadio) {
                addTracker(name, tagRadio.value, 'all');
                trackerForm.reset();
                addTrackerModal.classList.add('hidden');
            } else {
                alert('Please enter a name and select a tag to track.');
            }
        });
    }

    addTrackerModal.addEventListener('click', (e) => {
        if (e.target === addTrackerModal) {
            addTrackerModal.classList.add('hidden');
        }
    });
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    if (e.target === clearTasksModal) {
        clearTasksModal.classList.add('hidden');
    }
});

// Escape HTML helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to generate media section HTML for task view
function getMediaSection(task) {
    // Handle both array format and legacy single media format
    let mediaArray = [];

    if (Array.isArray(task.media)) {
        mediaArray = task.media;
    } else if (task.media && task.media.data) {
        // Legacy single media format - convert to array
        mediaArray = [task.media];
    }

    if (mediaArray.length === 0) return '';

    const mediaItems = mediaArray.map((media, index) => {
        if (media.type && media.type.startsWith('image/')) {
            return `
                <div class="media-gallery-item">
                    <img src="${media.data}" alt="${escapeHtml(media.name)}" class="media-image" onclick="openMediaFullscreen('${media.data}', '${escapeHtml(media.name)}')">
                    <span class="media-filename">${escapeHtml(media.name)}</span>
                </div>
            `;
        } else {
            const icon = getMediaIcon(media.type);
            return `
                <div class="media-gallery-item file-item">
                    <a href="${media.data}" download="${escapeHtml(media.name)}" class="media-download">
                        <span class="file-icon">${icon}</span>
                        <span class="media-filename">${escapeHtml(media.name)}</span>
                    </a>
                </div>
            `;
        }
    }).join('');

    return `
        <div class="view-task-section">
            <h4>📎 Attachments (${mediaArray.length})</h4>
            <div class="task-media-gallery">
                ${mediaItems}
            </div>
        </div>
    `;
}

// Get icon based on file type
function getMediaIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('document')) return '📘';
    if (type.includes('sheet') || type.includes('excel')) return '📗';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return '📦';
    return '📄';
}

// Open media in fullscreen modal
function openMediaFullscreen(src, name) {
    let fullscreenModal = document.getElementById('mediaFullscreenModal');
    if (!fullscreenModal) {
        fullscreenModal = document.createElement('div');
        fullscreenModal.className = 'modal media-fullscreen-modal';
        fullscreenModal.id = 'mediaFullscreenModal';
        fullscreenModal.onclick = function (e) {
            if (e.target === fullscreenModal) {
                closeMediaFullscreen();
            }
        };
        document.body.appendChild(fullscreenModal);
    }

    fullscreenModal.innerHTML = `
        <div class="fullscreen-media-content">
            <button class="fullscreen-close" onclick="closeMediaFullscreen()">&times;</button>
            <img src="${src}" alt="${name}">
            <p class="fullscreen-caption">${name}</p>
        </div>
    `;

    fullscreenModal.classList.remove('hidden');
}

window.openMediaFullscreen = openMediaFullscreen;

function closeMediaFullscreen() {
    const modal = document.getElementById('mediaFullscreenModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

window.closeMediaFullscreen = closeMediaFullscreen;

// ============ VIEW TASK DETAILS ============

function viewTaskDetails(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Create modal if it doesn't exist
    let viewModal = document.getElementById('viewTaskModal');
    if (!viewModal) {
        viewModal = document.createElement('div');
        viewModal.className = 'modal';
        viewModal.id = 'viewTaskModal';
        document.body.appendChild(viewModal);
    }

    const stateLabels = {
        'todo': '📋 To Do',
        'doing': '🔄 In Progress',
        'done': '✅ Completed'
    };

    // Recurring task section
    let recurringSection = '';
    if (task.isRecurringInstance) {
        const recurringTask = recurringTasks.find(rt => rt.id === task.recurringTaskId);
        if (recurringTask) {
            const stats = getRecurringTaskStats(task.recurringTaskId);
            const scheduleText = getRecurringScheduleText(recurringTask);

            // Generate occurrence history dots
            let historyDots = '';
            if (stats && stats.history) {
                historyDots = stats.history.map(h => {
                    let dotClass = '';
                    let title = '';
                    switch (h.status) {
                        case 'completed':
                            dotClass = 'completed';
                            title = `Completed on ${h.date}`;
                            break;
                        case 'missed':
                            dotClass = 'missed';
                            title = `Missed on ${h.date}`;
                            break;
                        case 'skipped':
                            dotClass = 'skipped';
                            title = `Skipped on ${h.date}${h.reason ? ': ' + h.reason : ''}`;
                            break;
                    }
                    return `<div class="occurrence-dot ${dotClass}" title="${title}"></div>`;
                }).join('');
            }

            recurringSection = `
                <div class="recurring-view-section">
                    <div class="recurring-view-header">
                        <span class="recurring-view-title">🔁 Recurring Task</span>
                        ${recurringTask.active ?
                    `<button class="recurring-action-btn" onclick="pauseRecurringTask('${recurringTask.id}'); closeViewTaskModal();" style="padding: 4px 8px; font-size: 11px;">⏸️ Pause</button>` :
                    `<button class="recurring-action-btn" onclick="resumeRecurringTask('${recurringTask.id}'); closeViewTaskModal();" style="padding: 4px 8px; font-size: 11px;">▶️ Resume</button>`
                }
                    </div>
                    <p class="recurring-schedule">📅 ${scheduleText}</p>
                    
                    ${stats ? `
                        <div class="recurring-progress">
                            <div class="progress-stat">
                                <span class="progress-label">Completed</span>
                                <span class="progress-value success">${stats.totalCompleted}</span>
                            </div>
                            <div class="progress-stat">
                                <span class="progress-label">Current Streak</span>
                                <span class="progress-value info">${stats.currentStreak} 🔥</span>
                            </div>
                            <div class="progress-stat">
                                <span class="progress-label">Best Streak</span>
                                <span class="progress-value info">${stats.bestStreak} ⭐</span>
                            </div>
                            <div class="progress-stat">
                                <span class="progress-label">Completion Rate</span>
                                <span class="progress-value ${stats.completionRate >= 80 ? 'success' : stats.completionRate >= 50 ? 'warning' : 'danger'}">${stats.completionRate}%</span>
                            </div>
                            ${stats.totalMissed > 0 ? `
                                <div class="progress-stat">
                                    <span class="progress-label">Missed</span>
                                    <span class="progress-value danger">${stats.totalMissed}</span>
                                </div>
                            ` : ''}
                            ${stats.totalSkipped > 0 ? `
                                <div class="progress-stat">
                                    <span class="progress-label">Skipped</span>
                                    <span class="progress-value warning">${stats.totalSkipped}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${historyDots ? `
                            <div style="margin-top: 12px;">
                                <span class="progress-label" style="margin-bottom: 8px; display: block;">Recent History</span>
                                <div class="occurrence-history">${historyDots}</div>
                                <div style="margin-top: 6px; font-size: 10px; color: rgba(230, 238, 248, 0.5);">
                                    <span style="margin-right: 10px;">🟢 Done</span>
                                    <span style="margin-right: 10px;">🔴 Missed</span>
                                    <span>🟠 Skipped</span>
                                </div>
                            </div>
                        ` : ''}
                    ` : ''}
                    
                    <div class="recurring-actions" style="margin-top: 16px;">
                        <button class="recurring-action-btn" onclick="showDeleteRecurringTaskModal('${task.recurringTaskId}')" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #ef4444;">
                            🗑️ Delete Recurring Task
                        </button>
                    </div>
                </div>
            `;
        }
    }

    viewModal.innerHTML = `
        <div class="modal-content view-task-modal">
            <div class="modal-header">
                <h2 class="modal-title">${escapeHtml(task.title)}</h2>
                <button class="modal-close" onclick="closeViewTaskModal()">&times;</button>
            </div>
            <div class="view-task-content">
                <div class="view-task-status">
                    <span class="task-state-badge ${task.state}">${stateLabels[task.state] || task.state}</span>
                    ${task.isRecurringInstance ? '<span class="recurring-indicator"><span class="recurring-icon">🔁</span> Recurring</span>' : ''}
                </div>
                
                ${task.description ? `
                    <div class="view-task-section">
                        <h4>📝 Description</h4>
                        <p>${escapeHtml(task.description)}</p>
                    </div>
                ` : ''}
                
                ${task.dueDate ? `
                    <div class="view-task-section">
                        <h4>📅 Due Date</h4>
                        <p>${task.dueDate}${task.deadline ? ' at ' + task.deadline : ''}</p>
                    </div>
                ` : ''}
                
                ${task.tags && task.tags.length > 0 ? `
                    <div class="view-task-section">
                        <h4>🏷️ Tags</h4>
                        <div class="task-tags">
                            ${task.tags.map(tag => `<span class="task-tag" style="${getTagStyle(tag)}">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${getMediaSection(task)}
                
                ${recurringSection}
                
                <div class="view-task-section">
                    <h4>📊 Created</h4>
                    <p>${new Date(task.createdAt).toLocaleString()}</p>
                </div>
            </div>
            <div class="modal-buttons">
                <button class="modal-btn cancel" onclick="closeViewTaskModal()">Close</button>
                ${!task.isRecurringInstance ? `<button class="modal-btn confirm" onclick="closeViewTaskModal(); openAddTaskModalFunc(${typeof task.id === 'string' ? `'${task.id}'` : task.id});">Edit Task</button>` : ''}
            </div>
        </div>
    `;

    viewModal.classList.remove('hidden');
}

window.viewTaskDetails = viewTaskDetails;

function closeViewTaskModal() {
    const viewModal = document.getElementById('viewTaskModal');
    if (viewModal) {
        viewModal.classList.add('hidden');
    }
}

window.closeViewTaskModal = closeViewTaskModal;

// ============ RECURRING TASK SYSTEM ============

// Recurring task DOM elements
const taskRecurringCheckbox = document.getElementById('taskRecurring');
const recurringOptions = document.getElementById('recurringOptions');
const recurringAmount = document.getElementById('recurringAmount');
const recurringUnit = document.getElementById('recurringUnit');
const recurringTimesPerPeriod = document.getElementById('recurringTimesPerPeriod');
const recurringTimesPeriod = document.getElementById('recurringTimesPeriod');
const recurringStartDate = document.getElementById('recurringStartDate');
const recurringEndDateInput = document.getElementById('recurringEndDate');
const recurringOccurrencesInput = document.getElementById('recurringOccurrences');

// Set up recurring task toggle
if (taskRecurringCheckbox) {
    taskRecurringCheckbox.addEventListener('change', () => {
        if (recurringOptions) {
            recurringOptions.classList.toggle('hidden', !taskRecurringCheckbox.checked);
        }
        // Set default start date to today if empty
        if (taskRecurringCheckbox.checked && recurringStartDate && !recurringStartDate.value) {
            recurringStartDate.value = new Date().toISOString().split('T')[0];
        }
    });
}

// Set up recurring end options
document.querySelectorAll('input[name="recurringEnd"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (recurringEndDateInput) {
            recurringEndDateInput.disabled = e.target.value !== 'date';
        }
        if (recurringOccurrencesInput) {
            recurringOccurrencesInput.disabled = e.target.value !== 'occurrences';
        }
    });
});

// Create a recurring task template
function createRecurringTask(taskData, recurringData) {
    const recurringTask = {
        id: 'recurring_' + Date.now(),
        title: taskData.title,
        description: taskData.description || '',
        tags: taskData.tags || [],
        media: taskData.media || null,
        recurring: {
            amount: recurringData.amount || 1,
            unit: recurringData.unit || 'day', // day, week, month, year
            timesPerPeriod: recurringData.timesPerPeriod || 1,
            timesPeriod: recurringData.timesPeriod || 'day', // day, week, month
            startDate: recurringData.startDate || new Date().toISOString().split('T')[0],
            endType: recurringData.endType || 'never', // never, date, occurrences
            endDate: recurringData.endDate || null,
            maxOccurrences: recurringData.maxOccurrences || null
        },
        stats: {
            totalCompleted: 0,
            totalMissed: 0,
            totalSkipped: 0,
            currentStreak: 0,
            bestStreak: 0,
            lastCompletedDate: null
        },
        createdAt: new Date().toISOString(),
        active: true
    };

    recurringTasks.push(recurringTask);
    saveRecurringTasks();

    // Initialize history for this recurring task
    if (!recurringHistory[recurringTask.id]) {
        recurringHistory[recurringTask.id] = [];
    }
    saveRecurringHistory();

    // Generate initial occurrences
    processRecurringTasks();

    return recurringTask;
}

// Calculate next occurrence date
function getNextOccurrenceDate(recurringTask, fromDate = new Date()) {
    const { amount, unit } = recurringTask.recurring;
    const date = new Date(fromDate);

    switch (unit) {
        case 'day':
            date.setDate(date.getDate() + amount);
            break;
        case 'week':
            date.setDate(date.getDate() + (amount * 7));
            break;
        case 'month':
            date.setMonth(date.getMonth() + amount);
            break;
        case 'year':
            date.setFullYear(date.getFullYear() + amount);
            break;
    }

    return date;
}

// Check if a recurring task should generate an occurrence for today
function shouldGenerateOccurrence(recurringTask, date = new Date()) {
    const today = date.toISOString().split('T')[0];
    const startDate = recurringTask.recurring.startDate;

    // Not started yet
    if (today < startDate) return false;

    // Check end conditions
    if (recurringTask.recurring.endType === 'date' && recurringTask.recurring.endDate) {
        if (today > recurringTask.recurring.endDate) return false;
    }

    if (recurringTask.recurring.endType === 'occurrences') {
        const totalOccurrences = recurringTask.stats.totalCompleted +
            recurringTask.stats.totalMissed +
            recurringTask.stats.totalSkipped;
        if (totalOccurrences >= recurringTask.recurring.maxOccurrences) return false;
    }

    // Check if task is active
    if (!recurringTask.active) return false;

    return true;
}

// Get how many times task should be done in current period
function getTimesNeededInPeriod(recurringTask) {
    return recurringTask.recurring.timesPerPeriod || 1;
}

// Get the current period key (for grouping occurrences)
function getPeriodKey(recurringTask, date = new Date()) {
    const { timesPeriod } = recurringTask.recurring;
    const d = new Date(date);

    switch (timesPeriod) {
        case 'day':
            return d.toISOString().split('T')[0];
        case 'week':
            // Get start of week (Sunday)
            const dayOfWeek = d.getDay();
            d.setDate(d.getDate() - dayOfWeek);
            return 'week_' + d.toISOString().split('T')[0];
        case 'month':
            return `month_${d.getFullYear()}_${d.getMonth() + 1}`;
        default:
            return d.toISOString().split('T')[0];
    }
}

// Get completions in current period
function getCompletionsInPeriod(recurringTaskId, periodKey) {
    const history = recurringHistory[recurringTaskId] || [];
    return history.filter(h => h.periodKey === periodKey && h.status === 'completed').length;
}

// Get skips in current period
function getSkipsInPeriod(recurringTaskId, periodKey) {
    const history = recurringHistory[recurringTaskId] || [];
    return history.filter(h => h.periodKey === periodKey && h.status === 'skipped').length;
}

// Get deletions in current period
function getDeletionsInPeriod(recurringTaskId, periodKey) {
    const history = recurringHistory[recurringTaskId] || [];
    return history.filter(h => h.periodKey === periodKey && h.status === 'deleted').length;
}

// Process all recurring tasks and generate occurrences
function processRecurringTasks() {
    // Skip if we're in the middle of syncing from Firebase to prevent infinite loops
    if (isSyncingTasks) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let tasksChanged = false;

    recurringTasks.forEach(recurringTask => {
        if (!shouldGenerateOccurrence(recurringTask, today)) return;

        const periodKey = getPeriodKey(recurringTask, today);
        const timesNeeded = getTimesNeededInPeriod(recurringTask);
        const completedInPeriod = getCompletionsInPeriod(recurringTask.id, periodKey);
        const skippedInPeriod = getSkipsInPeriod(recurringTask.id, periodKey);
        const deletedInPeriod = getDeletionsInPeriod(recurringTask.id, periodKey);
        const handledInPeriod = completedInPeriod + skippedInPeriod + deletedInPeriod;

        // Check if we need to create more occurrences for this period
        const remainingForPeriod = timesNeeded - handledInPeriod;

        // Check if there's already an active task for this recurring task
        const existingActiveTask = tasks.find(t =>
            t.recurringTaskId === recurringTask.id &&
            t.state !== 'done' &&
            t.periodKey === periodKey
        );

        if (remainingForPeriod > 0 && !existingActiveTask) {
            // Create a new task occurrence
            const taskOccurrence = {
                id: 'task_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                title: recurringTask.title,
                description: recurringTask.description,
                tags: [...(recurringTask.tags || [])],
                media: recurringTask.media,
                state: 'todo',
                createdAt: new Date().toISOString(),
                dueDate: todayStr,
                // Recurring task metadata
                isRecurringInstance: true,
                recurringTaskId: recurringTask.id,
                periodKey: periodKey,
                occurrenceNumber: completedInPeriod + skippedInPeriod + deletedInPeriod + 1,
                totalForPeriod: timesNeeded
            };

            tasks.unshift(taskOccurrence);
            tasksChanged = true;
        }
    });

    // Check for missed occurrences from previous periods
    const missedChanged = checkMissedOccurrences();
    tasksChanged = tasksChanged || missedChanged;

    // Only save if tasks actually changed
    if (tasksChanged) {
        saveTasks();
    }
    updateTaskDisplay();
}

// Check for missed occurrences
function checkMissedOccurrences() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let changed = false;

    recurringTasks.forEach(recurringTask => {
        const startDate = new Date(recurringTask.recurring.startDate);
        if (startDate > today) return;

        // For daily tasks, check previous day
        if (recurringTask.recurring.timesPeriod === 'day') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = getPeriodKey(recurringTask, yesterday);

            // Only check if start date is before yesterday
            if (yesterday >= startDate) {
                const timesNeeded = getTimesNeededInPeriod(recurringTask);
                const completedYesterday = getCompletionsInPeriod(recurringTask.id, yesterdayKey);
                const skippedYesterday = getSkipsInPeriod(recurringTask.id, yesterdayKey);
                const totalHandled = completedYesterday + skippedYesterday;

                // Mark missed occurrences
                if (totalHandled < timesNeeded) {
                    const missed = timesNeeded - totalHandled;
                    for (let i = 0; i < missed; i++) {
                        const historyEntry = {
                            date: yesterday.toISOString().split('T')[0],
                            periodKey: yesterdayKey,
                            status: 'missed',
                            timestamp: new Date().toISOString()
                        };

                        // Check if we already recorded this miss
                        const existingMiss = (recurringHistory[recurringTask.id] || []).find(h =>
                            h.periodKey === yesterdayKey && h.status === 'missed'
                        );

                        if (!existingMiss) {
                            if (!recurringHistory[recurringTask.id]) {
                                recurringHistory[recurringTask.id] = [];
                            }
                            recurringHistory[recurringTask.id].push(historyEntry);
                            changed = true;

                            // Update stats
                            const rtIndex = recurringTasks.findIndex(rt => rt.id === recurringTask.id);
                            if (rtIndex !== -1) {
                                recurringTasks[rtIndex].stats.totalMissed++;
                                recurringTasks[rtIndex].stats.currentStreak = 0;
                            }
                        }
                    }
                }
            }
        }
    });

    if (changed) {
        saveRecurringHistory();
        saveRecurringTasks();
    }

    return changed;
}

// Start working on a recurring task occurrence (move to "doing")
function startRecurringOccurrence(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.isRecurringInstance) return;

    task.state = 'doing';
    task.startedAt = new Date().toISOString();

    saveTasks();
    updateTaskDisplay();
}

window.startRecurringOccurrence = startRecurringOccurrence;

// Stop working on a recurring task occurrence (move back to "todo")
function stopRecurringOccurrence(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.isRecurringInstance) return;

    task.state = 'todo';
    task.stoppedAt = new Date().toISOString();

    saveTasks();
    updateTaskDisplay();
}

window.stopRecurringOccurrence = stopRecurringOccurrence;

// Complete a recurring task occurrence
function completeRecurringOccurrence(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.isRecurringInstance) return;

    const recurringTask = recurringTasks.find(rt => rt.id === task.recurringTaskId);
    if (!recurringTask) return;

    // Add to history
    const historyEntry = {
        date: new Date().toISOString().split('T')[0],
        periodKey: task.periodKey,
        status: 'completed',
        timestamp: new Date().toISOString(),
        taskId: taskId
    };

    if (!recurringHistory[task.recurringTaskId]) {
        recurringHistory[task.recurringTaskId] = [];
    }
    recurringHistory[task.recurringTaskId].push(historyEntry);

    // Update stats
    const rtIndex = recurringTasks.findIndex(rt => rt.id === task.recurringTaskId);
    if (rtIndex !== -1) {
        recurringTasks[rtIndex].stats.totalCompleted++;
        recurringTasks[rtIndex].stats.currentStreak++;
        recurringTasks[rtIndex].stats.lastCompletedDate = new Date().toISOString();

        if (recurringTasks[rtIndex].stats.currentStreak > recurringTasks[rtIndex].stats.bestStreak) {
            recurringTasks[rtIndex].stats.bestStreak = recurringTasks[rtIndex].stats.currentStreak;
        }
    }

    // Mark task as done
    task.state = 'done';
    task.completedAt = new Date().toISOString();

    saveRecurringHistory();
    saveRecurringTasks();
    saveTasks();
    updateTaskDisplay();

    // Check if we need to generate another occurrence for this period
    setTimeout(() => processRecurringTasks(), 100);
}

// Skip a recurring task occurrence
function skipRecurringOccurrence(taskId, reason = '') {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.isRecurringInstance) return;

    const recurringTask = recurringTasks.find(rt => rt.id === task.recurringTaskId);
    if (!recurringTask) return;

    // Add to history
    const historyEntry = {
        date: new Date().toISOString().split('T')[0],
        periodKey: task.periodKey,
        status: 'skipped',
        reason: reason,
        timestamp: new Date().toISOString(),
        taskId: taskId
    };

    if (!recurringHistory[task.recurringTaskId]) {
        recurringHistory[task.recurringTaskId] = [];
    }
    recurringHistory[task.recurringTaskId].push(historyEntry);

    // Update stats
    const rtIndex = recurringTasks.findIndex(rt => rt.id === task.recurringTaskId);
    if (rtIndex !== -1) {
        recurringTasks[rtIndex].stats.totalSkipped++;
        // Skipping doesn't break streak, but doesn't count as completion
    }

    // Remove the task from active tasks (it will show as skipped in history)
    tasks = tasks.filter(t => t.id !== taskId);

    saveRecurringHistory();
    saveRecurringTasks();
    saveTasks();

    // Generate next occurrence if needed
    setTimeout(() => processRecurringTasks(), 100);

    updateTaskDisplay();
}

// Get recurring task stats for display
function getRecurringTaskStats(recurringTaskId) {
    const recurringTask = recurringTasks.find(rt => rt.id === recurringTaskId);
    if (!recurringTask) return null;

    const history = recurringHistory[recurringTaskId] || [];
    const total = recurringTask.stats.totalCompleted +
        recurringTask.stats.totalMissed +
        recurringTask.stats.totalSkipped;

    const completionRate = total > 0
        ? Math.round((recurringTask.stats.totalCompleted / total) * 100)
        : 0;

    return {
        totalCompleted: recurringTask.stats.totalCompleted,
        totalMissed: recurringTask.stats.totalMissed,
        totalSkipped: recurringTask.stats.totalSkipped,
        currentStreak: recurringTask.stats.currentStreak,
        bestStreak: recurringTask.stats.bestStreak,
        completionRate: completionRate,
        lastCompleted: recurringTask.stats.lastCompletedDate,
        history: history.slice(-14) // Last 14 entries for display
    };
}

// Get schedule description
function getRecurringScheduleText(recurringTask) {
    const { amount, unit, timesPerPeriod, timesPeriod } = recurringTask.recurring;

    let scheduleText = '';

    if (timesPerPeriod > 1) {
        scheduleText = `${timesPerPeriod}x per ${timesPeriod}`;
    } else if (amount === 1) {
        scheduleText = `Every ${unit}`;
    } else {
        scheduleText = `Every ${amount} ${unit}s`;
    }

    return scheduleText;
}

// Reset recurring task form fields
function resetRecurringForm() {
    if (taskRecurringCheckbox) taskRecurringCheckbox.checked = false;
    if (recurringOptions) recurringOptions.classList.add('hidden');
    if (recurringAmount) recurringAmount.value = '1';
    if (recurringUnit) recurringUnit.value = 'day';
    if (recurringTimesPerPeriod) recurringTimesPerPeriod.value = '1';
    if (recurringTimesPeriod) recurringTimesPeriod.value = 'day';
    if (recurringStartDate) recurringStartDate.value = '';
    if (recurringEndDateInput) recurringEndDateInput.value = '';
    if (recurringOccurrencesInput) recurringOccurrencesInput.value = '10';

    // Reset radio buttons
    const neverRadio = document.querySelector('input[name="recurringEnd"][value="never"]');
    if (neverRadio) neverRadio.checked = true;
    if (recurringEndDateInput) recurringEndDateInput.disabled = true;
    if (recurringOccurrencesInput) recurringOccurrencesInput.disabled = true;
}

// Pause a recurring task
function pauseRecurringTask(recurringTaskId) {
    const index = recurringTasks.findIndex(rt => rt.id === recurringTaskId);
    if (index !== -1) {
        recurringTasks[index].active = false;
        saveRecurringTasks();
    }
}

// Resume a recurring task
function resumeRecurringTask(recurringTaskId) {
    const index = recurringTasks.findIndex(rt => rt.id === recurringTaskId);
    if (index !== -1) {
        recurringTasks[index].active = true;
        saveRecurringTasks();
        processRecurringTasks();
    }
}

// Delete a recurring task and all its occurrences
function deleteRecurringTask(recurringTaskId) {
    // Remove from recurring tasks
    recurringTasks = recurringTasks.filter(rt => rt.id !== recurringTaskId);

    // Remove all task instances
    tasks = tasks.filter(t => t.recurringTaskId !== recurringTaskId);

    // Remove history
    delete recurringHistory[recurringTaskId];

    saveRecurringTasks();
    saveRecurringHistory();
    saveTasks();
    updateTaskDisplay();
}

// Make recurring functions globally available
window.skipRecurringOccurrence = skipRecurringOccurrence;
window.completeRecurringOccurrence = completeRecurringOccurrence;
window.pauseRecurringTask = pauseRecurringTask;
window.resumeRecurringTask = resumeRecurringTask;
window.deleteRecurringTask = deleteRecurringTask;
window.getRecurringTaskStats = getRecurringTaskStats;

// ============ INITIALIZATION ============

// Track if initial data load is complete
let initialDataLoaded = false;

// Show loading state initially
function showTasksLoading() {
    if (taskList) {
        taskList.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading your tasks...</p></div>';
    }
}

// Initialize with proper data loading priority
async function initializeTasks() {
    console.log('initializeTasks called');
    showTasksLoading();

    // Load from localStorage first as cache
    loadTasks();
    loadTrackers();
    loadCustomTagColors();
    loadRecurringTasks();
    loadRecurringHistory();

    try {
        // Wait for Firebase auth to be ready (with timeout)
        console.log('Waiting for auth...');
        const user = await window.firebaseApp.waitForAuth();
        console.log('Auth ready, user:', user?.email);

        if (user) {
            // User is logged in, set up Firebase sync
            console.log('Setting up Firebase sync for tasks...');
            await setupTasksSyncAsync();
        } else {
            // No user, just show localStorage data
            console.log('No user, showing localStorage data');
            processRecurringTasks(); // Process recurring tasks on load
            updateTaskDisplay();
            updateTrackersDisplay();
            updateDoingTasksInPomodoro();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        // Show whatever we have from localStorage
        processRecurringTasks(); // Process recurring tasks even on error
        updateTaskDisplay();
        updateTrackersDisplay();
        updateDoingTasksInPomodoro();
    }

    initialDataLoaded = true;

    // Set up recurring task processing interval (every minute)
    setInterval(() => {
        processRecurringTasks();
    }, 60000);
}

// Async version that returns a promise when first data is loaded
function setupTasksSyncAsync() {
    return new Promise((resolve) => {
        console.log('setupTasksSyncAsync called, user:', window.firebaseApp?.currentUser?.email);

        if (!window.firebaseApp || !window.firebaseApp.currentUser) {
            console.warn('setupTasksSyncAsync: No user available');
            resolve();
            return;
        }

        // Unsubscribe from previous listeners
        if (tasksUnsubscribe) tasksUnsubscribe();
        if (trackersUnsubscribe) trackersUnsubscribe();
        if (tagColorsUnsubscribe) tagColorsUnsubscribe();

        const tasksRef = window.firebaseApp.getTasksRef();
        if (!tasksRef) {
            console.error('setupTasksSyncAsync: Could not get tasks reference');
            resolve();
            return;
        }

        let isFirstSnapshot = true;

        tasksUnsubscribe = tasksRef.onSnapshot((snapshot) => {
            isSyncingTasks = true;
            tasks = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: parseInt(doc.id) || doc.id
            }));
            // Sort by createdAt descending
            tasks.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA;
            });
            localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
            updateTaskDisplay();
            updateTaskStats();
            updateTrackersDisplay();
            updateDoingTasksInPomodoro();
            isSyncingTasks = false;

            // Resolve promise on first snapshot
            if (isFirstSnapshot) {
                isFirstSnapshot = false;
                resolve();
            }
        }, (error) => {
            console.error('Tasks sync error:', error);
            if (isFirstSnapshot) {
                isFirstSnapshot = false;
                resolve();
            }
        });

        // Set up trackers listener
        const trackersRef = window.firebaseApp.getTrackersRef();
        if (trackersRef) {
            trackersUnsubscribe = trackersRef.onSnapshot((snapshot) => {
                isSyncingTrackers = true;
                trackers = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id
                }));
                localStorage.setItem(TRACKERS_KEY, JSON.stringify(trackers));
                updateTrackersDisplay();
                isSyncingTrackers = false;
            }, (error) => {
                console.error('Trackers sync error:', error);
            });
        }

        // Set up tag colors listener
        const userRef = window.firebaseApp.getUserRef();
        if (userRef) {
            tagColorsUnsubscribe = userRef.onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();

                    // Sync tag colors
                    if (data.tagColors) {
                        isSyncingTagColors = true;
                        customTagColors = data.tagColors;
                        localStorage.setItem(CUSTOM_TAG_COLORS_KEY, JSON.stringify(customTagColors));
                        isSyncingTagColors = false;
                    }

                    // Sync recurring tasks
                    if (data.recurringTasks) {
                        recurringTasks = data.recurringTasks;
                        localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(recurringTasks));
                    }

                    // Sync recurring history
                    if (data.recurringHistory) {
                        recurringHistory = data.recurringHistory;
                        localStorage.setItem(RECURRING_HISTORY_KEY, JSON.stringify(recurringHistory));
                    }

                    // Process recurring tasks after syncing
                    processRecurringTasks();
                    updateTaskDisplay();
                    updateTrackersDisplay();
                }
            }, (error) => {
                console.error('User data sync error:', error);
            });
        }
    });
}

initializeTasks();
