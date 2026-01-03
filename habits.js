// ============ HABIT TRACKER APP ============

const HABITS_KEY = 'pomodoroHabits';
const HABIT_COMPLETIONS_KEY = 'pomodoroHabitCompletions';

// Firebase sync state
let habitsUnsubscribe = null;
let completionsUnsubscribe = null;
let isSyncingHabits = false;
let isSyncingCompletions = false;

// DOM Elements
const habitList = document.getElementById('habitList');
const habitFilters = document.querySelectorAll('.habit-filter-btn');
const clearHabitsBtn = document.getElementById('clearHabitsBtn');
const clearHabitsModal = document.getElementById('clearHabitsModal');
const cancelClearHabitsBtn = document.getElementById('cancelClearHabitsBtn');
const confirmClearHabitsBtn = document.getElementById('confirmClearHabitsBtn');

// Habit Modal Elements
const openAddHabitBtn = document.getElementById('openAddHabitBtn');
const addHabitModal = document.getElementById('addHabitModal');
const closeAddHabitModal = document.getElementById('closeAddHabitModal');
const cancelAddHabitBtn = document.getElementById('cancelAddHabitBtn');
const addHabitForm = document.getElementById('addHabitForm');
const habitNameInput = document.getElementById('habitName');

// State
let currentHabitFilter = 'all';
let habits = [];
let habitCompletions = {};
let selectedDate = new Date();
let editingHabitId = null;

// Habit Icons
const HABIT_ICONS = [
    '💪', '🏃', '📚', '💧', '🧘', '💤', '🥗', '💊',
    '✍️', '🎯', '🌅', '🚶', '🎵', '🧹', '💰', '📱',
    '🌿', '🍎', '☀️', '🧠', '❤️', '🔥', '⭐', '🎨'
];

// Categories
const HABIT_CATEGORIES = [
    { id: 'health', name: 'Health', color: '#22c55e' },
    { id: 'fitness', name: 'Fitness', color: '#ef4444' },
    { id: 'productivity', name: 'Productivity', color: '#6366f1' },
    { id: 'mindfulness', name: 'Mindfulness', color: '#a855f7' },
    { id: 'learning', name: 'Learning', color: '#f59e0b' },
    { id: 'social', name: 'Social', color: '#ec4899' },
    { id: 'finance', name: 'Finance', color: '#06b6d4' },
    { id: 'other', name: 'Other', color: '#6b7280' }
];

// Default Habit Templates
const HABIT_TEMPLATES = [
    { name: 'Drink Water', icon: '💧', category: 'health', frequency: 'daily', targetCount: 8, description: '8 glasses per day' },
    { name: 'Exercise', icon: '💪', category: 'fitness', frequency: 'daily', targetCount: 1, description: '30 min workout' },
    { name: 'Read', icon: '📚', category: 'learning', frequency: 'daily', targetCount: 1, description: '30 min reading' },
    { name: 'Meditate', icon: '🧘', category: 'mindfulness', frequency: 'daily', targetCount: 1, description: '10 min meditation' },
    { name: 'Walk 10,000 Steps', icon: '🚶', category: 'fitness', frequency: 'daily', targetCount: 1, description: 'Daily walking goal' },
    { name: 'Sleep 8 Hours', icon: '💤', category: 'health', frequency: 'daily', targetCount: 1, description: 'Get enough rest' },
    { name: 'Take Vitamins', icon: '💊', category: 'health', frequency: 'daily', targetCount: 1, description: 'Daily supplements' },
    { name: 'Study', icon: '🧠', category: 'learning', frequency: 'daily', targetCount: 1, description: '1 hour study session' },
    { name: 'Work on Project', icon: '🎯', category: 'productivity', frequency: 'daily', targetCount: 1, description: 'Progress on side project' },
    { name: 'No Social Media', icon: '📱', category: 'productivity', frequency: 'daily', targetCount: 1, description: 'Digital detox' },
    { name: 'Eat Healthy', icon: '🥗', category: 'health', frequency: 'daily', targetCount: 3, description: '3 healthy meals' },
    { name: 'Journal', icon: '✍️', category: 'mindfulness', frequency: 'daily', targetCount: 1, description: 'Write daily thoughts' },
    { name: 'Morning Routine', icon: '🌅', category: 'productivity', frequency: 'daily', targetCount: 1, description: 'Complete morning routine' },
    { name: 'Practice Coding', icon: '💻', category: 'learning', frequency: 'daily', targetCount: 1, description: '1 hour coding practice' },
    { name: 'Save Money', icon: '💰', category: 'finance', frequency: 'daily', targetCount: 1, description: 'Track daily savings' },
    { name: 'Call Family', icon: '❤️', category: 'social', frequency: 'weekly', targetDays: [0, 6], targetCount: 1, description: 'Stay connected' }
];

// Reminder Storage Key
const HABIT_REMINDERS_KEY = 'pomodoroHabitReminders';
let habitReminders = {};
let reminderIntervals = {};

// ============ UTILITY FUNCTIONS ============

function formatDateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function isToday(date) {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
}

function isSameDay(date1, date2) {
    return formatDateKey(date1) === formatDateKey(date2);
}

function getDayOfWeek(date) {
    return date.getDay(); // 0 = Sunday, 6 = Saturday
}

function getWeekDates(date) {
    const week = [];
    const current = new Date(date);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    current.setDate(diff);

    for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return week;
}

// ============ LOAD/SAVE FUNCTIONS ============

function loadHabits() {
    try {
        const stored = localStorage.getItem(HABITS_KEY);
        habits = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading habits:', e);
        habits = [];
    }
}

function saveHabits() {
    try {
        localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
        syncHabitsToFirebase();
    } catch (e) {
        console.error('Error saving habits:', e);
    }
}

function loadCompletions() {
    try {
        const stored = localStorage.getItem(HABIT_COMPLETIONS_KEY);
        habitCompletions = stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error loading completions:', e);
        habitCompletions = {};
    }
}

function saveCompletions() {
    try {
        localStorage.setItem(HABIT_COMPLETIONS_KEY, JSON.stringify(habitCompletions));
        syncCompletionsToFirebase();
    } catch (e) {
        console.error('Error saving completions:', e);
    }
}

// ============ REMINDER FUNCTIONS ============

function loadReminders() {
    try {
        const stored = localStorage.getItem(HABIT_REMINDERS_KEY);
        habitReminders = stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error loading reminders:', e);
        habitReminders = {};
    }
}

function saveReminders() {
    try {
        localStorage.setItem(HABIT_REMINDERS_KEY, JSON.stringify(habitReminders));
    } catch (e) {
        console.error('Error saving reminders:', e);
    }
}

function setHabitReminder(habitId, reminderConfig) {
    // reminderConfig: { type: 'specific' | 'interval', times: ['10:00', '14:00'] | null, intervalHours: 2, startHour: 10, endHour: 20 }
    habitReminders[habitId] = reminderConfig;
    saveReminders();
    scheduleReminder(habitId);
}

function removeHabitReminder(habitId) {
    delete habitReminders[habitId];
    saveReminders();
    if (reminderIntervals[habitId]) {
        clearInterval(reminderIntervals[habitId]);
        delete reminderIntervals[habitId];
    }
}

function scheduleReminder(habitId) {
    const habit = habits.find(h => h.id === habitId);
    const reminder = habitReminders[habitId];
    if (!habit || !reminder) return;

    // Clear existing interval
    if (reminderIntervals[habitId]) {
        clearInterval(reminderIntervals[habitId]);
    }

    if (reminder.type === 'interval') {
        // Interval-based reminder (e.g., every 2 hours from 10 AM to 8 PM)
        const checkInterval = setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();

            if (currentHour >= reminder.startHour && currentHour < reminder.endHour) {
                // Check if we should show notification (at the start of each interval)
                const hoursSinceStart = currentHour - reminder.startHour;
                if (hoursSinceStart % reminder.intervalHours === 0 && currentMinutes < 5) {
                    showHabitNotification(habit);
                }
            }
        }, 60000); // Check every minute

        reminderIntervals[habitId] = checkInterval;
    } else if (reminder.type === 'specific' && reminder.times) {
        // Specific time reminder
        const checkInterval = setInterval(() => {
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            if (reminder.times.includes(currentTime)) {
                showHabitNotification(habit);
            }
        }, 60000); // Check every minute

        reminderIntervals[habitId] = checkInterval;
    }
}

function showHabitNotification(habit) {
    // Check if habit is already completed today
    if (isHabitCompletedForDate(habit.id)) return;

    // Request notification permission if needed
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification(`⏰ Habit Reminder: ${habit.icon} ${habit.name}`, {
                body: `Don't forget to complete your habit!`,
                icon: '/assets/logo.svg',
                tag: `habit-${habit.id}`,
                requireInteraction: false
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showHabitNotification(habit);
                }
            });
        }
    }
}

function initAllReminders() {
    loadReminders();
    Object.keys(habitReminders).forEach(habitId => {
        scheduleReminder(habitId);
    });
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ============ FIREBASE SYNC ============

async function syncHabitsToFirebase() {
    if (!window.firebaseApp?.db || !window.firebaseApp?.currentUser || isSyncingHabits) return;

    try {
        const userId = window.firebaseApp.currentUser.uid;
        await window.firebaseApp.db.collection('users').doc(userId).collection('habits').doc('data').set({
            habits: habits,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error('Error syncing habits to Firebase:', e);
    }
}

async function syncCompletionsToFirebase() {
    if (!window.firebaseApp?.db || !window.firebaseApp?.currentUser || isSyncingCompletions) return;

    try {
        const userId = window.firebaseApp.currentUser.uid;
        await window.firebaseApp.db.collection('users').doc(userId).collection('habits').doc('completions').set({
            completions: habitCompletions,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error('Error syncing completions to Firebase:', e);
    }
}

function setupHabitsFirebaseSync() {
    if (!window.firebaseApp?.db || !window.firebaseApp?.currentUser) return;

    const userId = window.firebaseApp.currentUser.uid;

    // Sync habits
    if (habitsUnsubscribe) habitsUnsubscribe();
    habitsUnsubscribe = window.firebaseApp.db.collection('users').doc(userId)
        .collection('habits').doc('data')
        .onSnapshot((doc) => {
            if (doc.exists) {
                isSyncingHabits = true;
                const data = doc.data();
                if (data.habits) {
                    habits = data.habits;
                    localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
                    updateHabitDisplay();
                }
                isSyncingHabits = false;
            }
        });

    // Sync completions
    if (completionsUnsubscribe) completionsUnsubscribe();
    completionsUnsubscribe = window.firebaseApp.db.collection('users').doc(userId)
        .collection('habits').doc('completions')
        .onSnapshot((doc) => {
            if (doc.exists) {
                isSyncingCompletions = true;
                const data = doc.data();
                if (data.completions) {
                    habitCompletions = data.completions;
                    localStorage.setItem(HABIT_COMPLETIONS_KEY, JSON.stringify(habitCompletions));
                    updateHabitDisplay();
                }
                isSyncingCompletions = false;
            }
        });
}

// ============ HABIT CRUD OPERATIONS ============

function createHabit(habitData) {
    const habit = {
        id: Date.now().toString(),
        name: habitData.name,
        icon: habitData.icon || '⭐',
        category: habitData.category || 'other',
        frequency: habitData.frequency || 'daily', // daily, weekly, custom
        targetDays: habitData.targetDays || [0, 1, 2, 3, 4, 5, 6], // Days of week (0=Sunday)
        targetCount: habitData.targetCount || 1, // Times per day
        reminder: habitData.reminder || null,
        createdAt: new Date().toISOString(),
        archived: false
    };

    habits.push(habit);
    saveHabits();
    updateHabitDisplay();
    return habit;
}

function updateHabit(id, updates) {
    const index = habits.findIndex(h => h.id === id);
    if (index !== -1) {
        habits[index] = { ...habits[index], ...updates };
        saveHabits();
        updateHabitDisplay();
    }
}

function deleteHabit(id) {
    habits = habits.filter(h => h.id !== id);
    // Also remove completions for this habit
    Object.keys(habitCompletions).forEach(dateKey => {
        if (habitCompletions[dateKey][id]) {
            delete habitCompletions[dateKey][id];
        }
    });
    saveHabits();
    saveCompletions();
    updateHabitDisplay();
}

function toggleHabitCompletion(habitId, date = selectedDate) {
    const dateKey = formatDateKey(date);
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!habitCompletions[dateKey]) {
        habitCompletions[dateKey] = {};
    }

    if (!habitCompletions[dateKey][habitId]) {
        habitCompletions[dateKey][habitId] = { count: 0 };
    }

    const current = habitCompletions[dateKey][habitId].count;
    const target = habit.targetCount || 1;

    if (current >= target) {
        habitCompletions[dateKey][habitId].count = 0;
    } else {
        habitCompletions[dateKey][habitId].count = current + 1;
    }

    saveCompletions();
    updateHabitDisplay();
}

function incrementHabitCount(habitId, date = selectedDate) {
    const dateKey = formatDateKey(date);
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!habitCompletions[dateKey]) {
        habitCompletions[dateKey] = {};
    }

    if (!habitCompletions[dateKey][habitId]) {
        habitCompletions[dateKey][habitId] = { count: 0 };
    }

    const current = habitCompletions[dateKey][habitId].count;
    const target = habit.targetCount || 1;

    if (current < target) {
        habitCompletions[dateKey][habitId].count = current + 1;
        saveCompletions();
        updateHabitDisplay();
    }
}

function decrementHabitCount(habitId, date = selectedDate) {
    const dateKey = formatDateKey(date);
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!habitCompletions[dateKey]) {
        habitCompletions[dateKey] = {};
    }

    if (!habitCompletions[dateKey][habitId]) {
        habitCompletions[dateKey][habitId] = { count: 0 };
    }

    const current = habitCompletions[dateKey][habitId].count;

    if (current > 0) {
        habitCompletions[dateKey][habitId].count = current - 1;
        saveCompletions();
        updateHabitDisplay();
    }
}

function isHabitCompletedForDate(habitId, date = selectedDate) {
    const dateKey = formatDateKey(date);
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return false;

    const completion = habitCompletions[dateKey]?.[habitId];
    return completion && completion.count >= (habit.targetCount || 1);
}

function getCompletionCount(habitId, date = selectedDate) {
    const dateKey = formatDateKey(date);
    return habitCompletions[dateKey]?.[habitId]?.count || 0;
}

// ============ STREAK CALCULATIONS ============

function calculateStreak(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return 0;

    let streak = 0;
    let currentDate = new Date();

    // Start from yesterday if today is not completed
    if (!isHabitCompletedForDate(habitId, currentDate)) {
        currentDate.setDate(currentDate.getDate() - 1);
    }

    while (true) {
        // Check if this day should have the habit
        const dayOfWeek = getDayOfWeek(currentDate);
        if (habit.frequency === 'daily' || habit.targetDays.includes(dayOfWeek)) {
            if (isHabitCompletedForDate(habitId, currentDate)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        } else {
            currentDate.setDate(currentDate.getDate() - 1);
        }

        // Safety limit
        if (streak > 365) break;
    }

    return streak;
}

function calculateLongestStreak(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return 0;

    let longestStreak = 0;
    let currentStreak = 0;

    // Get all completion dates sorted
    const dates = Object.keys(habitCompletions).sort();
    if (dates.length === 0) return 0;

    const startDate = new Date(habit.createdAt);
    const endDate = new Date();
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayOfWeek = getDayOfWeek(currentDate);
        if (habit.frequency === 'daily' || habit.targetDays.includes(dayOfWeek)) {
            if (isHabitCompletedForDate(habitId, currentDate)) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return longestStreak;
}

function getTotalCompletions(habitId) {
    let total = 0;
    Object.keys(habitCompletions).forEach(dateKey => {
        if (habitCompletions[dateKey][habitId]) {
            total += habitCompletions[dateKey][habitId].count;
        }
    });
    return total;
}

// ============ FILTER HABITS ============

function getFilteredHabits() {
    let filtered = habits.filter(h => !h.archived);

    const dayOfWeek = getDayOfWeek(selectedDate);

    switch (currentHabitFilter) {
        case 'today':
            filtered = filtered.filter(h =>
                h.frequency === 'daily' || h.targetDays.includes(dayOfWeek)
            );
            break;
        case 'completed':
            filtered = filtered.filter(h => isHabitCompletedForDate(h.id));
            break;
        case 'pending':
            filtered = filtered.filter(h => {
                const shouldDoToday = h.frequency === 'daily' || h.targetDays.includes(dayOfWeek);
                return shouldDoToday && !isHabitCompletedForDate(h.id);
            });
            break;
        case 'archived':
            filtered = habits.filter(h => h.archived);
            break;
    }

    return filtered;
}

// ============ UI RENDERING ============

function updateHabitDisplay() {
    updateDateNavigation();
    updateWeekView();
    updateHabitStats();
    renderHabitList();
}

function updateDateNavigation() {
    const currentDateEl = document.getElementById('currentDate');
    const todayBtn = document.getElementById('todayBtn');

    if (currentDateEl) {
        currentDateEl.textContent = formatDisplayDate(selectedDate);
    }

    if (todayBtn) {
        todayBtn.style.display = isToday(selectedDate) ? 'none' : 'block';
    }
}

function updateWeekView() {
    const weekView = document.getElementById('weekView');
    if (!weekView) return;

    const weekDates = getWeekDates(selectedDate);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    weekView.innerHTML = weekDates.map((date, index) => {
        const isActive = isSameDay(date, selectedDate);
        const isTodayDate = isToday(date);
        const completions = getDateCompletionStatus(date);

        return `
            <div class="week-day ${isActive ? 'active' : ''} ${isTodayDate ? 'today' : ''}"
                 data-date="${formatDateKey(date)}">
                <span class="day-name">${dayNames[index]}</span>
                <span class="day-number">${date.getDate()}</span>
                <span class="day-indicator ${completions.class}"></span>
            </div>
        `;
    }).join('');

    // Add click listeners
    weekView.querySelectorAll('.week-day').forEach(el => {
        el.addEventListener('click', () => {
            const dateKey = el.dataset.date;
            selectedDate = new Date(dateKey);
            updateHabitDisplay();
        });
    });
}

function getDateCompletionStatus(date) {
    const dayOfWeek = getDayOfWeek(date);
    const habitsForDay = habits.filter(h =>
        !h.archived && (h.frequency === 'daily' || h.targetDays.includes(dayOfWeek))
    );

    if (habitsForDay.length === 0) {
        return { class: '' };
    }

    const completed = habitsForDay.filter(h => isHabitCompletedForDate(h.id, date)).length;

    if (completed === habitsForDay.length) {
        return { class: 'has-completions' };
    } else if (completed > 0) {
        return { class: 'partial' };
    }
    return { class: '' };
}

function updateHabitStats() {
    const totalHabitsEl = document.getElementById('totalHabits');
    const completedTodayEl = document.getElementById('completedToday');
    const longestStreakEl = document.getElementById('longestStreakStat');
    const completionRateEl = document.getElementById('completionRate');

    const dayOfWeek = getDayOfWeek(selectedDate);
    const habitsForDay = habits.filter(h =>
        !h.archived && (h.frequency === 'daily' || h.targetDays.includes(dayOfWeek))
    );

    const completedCount = habitsForDay.filter(h => isHabitCompletedForDate(h.id)).length;
    const longestStreak = Math.max(...habits.map(h => calculateStreak(h.id)), 0);
    const completionRate = habitsForDay.length > 0
        ? Math.round((completedCount / habitsForDay.length) * 100)
        : 0;

    if (totalHabitsEl) totalHabitsEl.textContent = habits.filter(h => !h.archived).length;
    if (completedTodayEl) completedTodayEl.textContent = completedCount;
    if (longestStreakEl) longestStreakEl.textContent = longestStreak;
    if (completionRateEl) completionRateEl.textContent = `${completionRate}%`;
}

function renderHabitList() {
    if (!habitList) return;

    const filtered = getFilteredHabits();

    if (filtered.length === 0) {
        habitList.innerHTML = `
            <div class="habit-empty-state">
                <div class="empty-icon">🎯</div>
                <h3 class="empty-title">No habits yet</h3>
                <p class="empty-text">Start building good habits by adding your first one!</p>
                <button class="add-habit-btn" onclick="openAddHabitModal()">+ Add Habit</button>
            </div>
        `;
        return;
    }

    habitList.innerHTML = filtered.map(habit => {
        const isCompleted = isHabitCompletedForDate(habit.id);
        const completionCount = getCompletionCount(habit.id);
        const targetCount = habit.targetCount || 1;
        const streak = calculateStreak(habit.id);
        const progress = Math.min((completionCount / targetCount) * 100, 100);
        const circumference = 2 * Math.PI * 18;
        const strokeDashoffset = circumference - (progress / 100) * circumference;

        const category = HABIT_CATEGORIES.find(c => c.id === habit.category) || HABIT_CATEGORIES[7];

        return `
            <div class="habit-item ${isCompleted ? 'completed' : ''}" data-habit-id="${habit.id}">
                <button class="habit-check" onclick="toggleHabitCompletion('${habit.id}')">
                    ${isCompleted ? '✓' : ''}
                </button>
                <span class="habit-icon">${habit.icon}</span>
                <div class="habit-content">
                    <div class="habit-name">${escapeHTML(habit.name)}</div>
                    <div class="habit-meta">
                        <span class="habit-frequency">${getFrequencyText(habit)}</span>
                        ${streak > 0 ? `<span class="habit-streak-badge">🔥 ${streak} day${streak !== 1 ? 's' : ''}</span>` : ''}
                        <span class="habit-category" data-category="${habit.category}">${category.name}</span>
                    </div>
                </div>
                <div class="habit-progress">
                    ${targetCount > 1 ? `
                    <div class="habit-counter-controls">
                        <button class="counter-btn decrement" onclick="event.stopPropagation(); decrementHabitCount('${habit.id}')" title="Remove one">−</button>
                        <div class="progress-ring">
                            <svg width="48" height="48">
                                <circle class="progress-ring-bg" cx="24" cy="24" r="18"></circle>
                                <circle class="progress-ring-fill" cx="24" cy="24" r="18"
                                    stroke-dasharray="${circumference}"
                                    stroke-dashoffset="${strokeDashoffset}"></circle>
                            </svg>
                            <span class="progress-text">${completionCount}/${targetCount}</span>
                        </div>
                        <button class="counter-btn increment" onclick="event.stopPropagation(); incrementHabitCount('${habit.id}')" title="Add one">+</button>
                    </div>
                    ` : `
                    <div class="progress-ring">
                        <svg width="48" height="48">
                            <circle class="progress-ring-bg" cx="24" cy="24" r="18"></circle>
                            <circle class="progress-ring-fill" cx="24" cy="24" r="18"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${strokeDashoffset}"></circle>
                        </svg>
                        <span class="progress-text">${completionCount}/${targetCount}</span>
                    </div>
                    `}
                </div>
                <div class="habit-actions">
                    <button class="habit-action-btn" onclick="openEditHabitModal('${habit.id}')" title="Edit">✏️</button>
                    <button class="habit-action-btn" onclick="showHabitDetails('${habit.id}')" title="Details">📊</button>
                    <button class="habit-action-btn delete" onclick="confirmDeleteHabit('${habit.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function getFrequencyText(habit) {
    if (habit.frequency === 'daily') {
        return 'Every day';
    } else if (habit.frequency === 'weekly') {
        return `${habit.targetDays.length} days/week`;
    } else {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return habit.targetDays.map(d => dayNames[d]).join(', ');
    }
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============ MODAL FUNCTIONS ============

function openAddHabitModal() {
    editingHabitId = null;
    if (addHabitModal) addHabitModal.classList.remove('hidden');
    if (habitNameInput) habitNameInput.value = '';

    const modalTitle = document.getElementById('habitModalTitle');
    if (modalTitle) modalTitle.textContent = 'Create New Habit';

    const submitBtn = document.getElementById('submitHabitBtn');
    if (submitBtn) submitBtn.textContent = 'Create Habit';

    // Show templates section
    const templatesSection = document.getElementById('habitTemplatesSection');
    if (templatesSection) templatesSection.style.display = 'block';

    // Hide reminder section for new habits (will be shown in edit)
    const reminderSection = document.getElementById('habitReminderSection');
    if (reminderSection) reminderSection.style.display = 'none';

    // Reset form
    resetHabitForm();
    renderHabitTemplates();
}

function renderHabitTemplates() {
    const container = document.getElementById('habitTemplatesGrid');
    if (!container) return;

    container.innerHTML = HABIT_TEMPLATES.map((template, index) => `
        <button type="button" class="habit-template-btn" data-template-index="${index}">
            <span class="template-icon">${template.icon}</span>
            <div class="template-info">
                <span class="template-name">${template.name}</span>
                <span class="template-desc">${template.description}</span>
            </div>
        </button>
    `).join('');

    // Add click listeners
    container.querySelectorAll('.habit-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.templateIndex);
            applyHabitTemplate(HABIT_TEMPLATES[index]);
        });
    });
}

function applyHabitTemplate(template) {
    // Fill form with template data
    if (habitNameInput) habitNameInput.value = template.name;

    // Select icon
    document.querySelectorAll('.icon-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.icon === template.icon);
    });

    // Select category
    document.querySelectorAll('.category-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.category === template.category);
    });

    // Select frequency
    const freq = template.frequency || 'daily';
    document.querySelectorAll('.frequency-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.frequency === freq);
    });

    // Show/hide days selector
    const daysSelector = document.getElementById('daysSelector');
    if (daysSelector) {
        daysSelector.style.display = freq === 'daily' ? 'none' : 'flex';
    }

    // Select days if weekly
    if (template.targetDays) {
        document.querySelectorAll('.day-option').forEach(el => {
            el.classList.toggle('selected', template.targetDays.includes(parseInt(el.dataset.day)));
        });
    }

    // Set target count
    const targetCountInput = document.getElementById('habitTargetCount');
    if (targetCountInput) targetCountInput.value = template.targetCount || 1;

    // Hide templates section after selection
    const templatesSection = document.getElementById('habitTemplatesSection');
    if (templatesSection) templatesSection.style.display = 'none';
}

function openEditHabitModal(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    editingHabitId = habitId;
    if (addHabitModal) addHabitModal.classList.remove('hidden');

    const modalTitle = document.getElementById('habitModalTitle');
    if (modalTitle) modalTitle.textContent = 'Edit Habit';

    const submitBtn = document.getElementById('submitHabitBtn');
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    // Hide templates section for edit mode
    const templatesSection = document.getElementById('habitTemplatesSection');
    if (templatesSection) templatesSection.style.display = 'none';

    // Show reminder section for edit mode
    const reminderSection = document.getElementById('habitReminderSection');
    if (reminderSection) {
        reminderSection.style.display = 'block';
        loadReminderSettings(habitId);
    }

    // Fill form with habit data
    if (habitNameInput) habitNameInput.value = habit.name;

    // Select icon
    document.querySelectorAll('.icon-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.icon === habit.icon);
    });

    // Select category
    document.querySelectorAll('.category-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.category === habit.category);
    });

    // Select frequency
    document.querySelectorAll('.frequency-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.frequency === habit.frequency);
    });

    // Show/hide days selector based on frequency
    const daysSelector = document.getElementById('daysSelector');
    if (daysSelector) {
        daysSelector.style.display = habit.frequency === 'daily' ? 'none' : 'flex';
    }

    // Select days
    if (habit.frequency === 'weekly' || habit.frequency === 'custom') {
        document.querySelectorAll('.day-option').forEach(el => {
            el.classList.toggle('selected', habit.targetDays.includes(parseInt(el.dataset.day)));
        });
    }

    // Set target count
    const targetCountInput = document.getElementById('habitTargetCount');
    if (targetCountInput) targetCountInput.value = habit.targetCount || 1;
}

function loadReminderSettings(habitId) {
    const reminder = habitReminders[habitId];
    const enableCheckbox = document.getElementById('enableReminder');
    const reminderType = document.getElementById('reminderType');
    const specificTimesDiv = document.getElementById('specificTimesSection');
    const intervalDiv = document.getElementById('intervalSection');

    if (!enableCheckbox) return;

    if (reminder) {
        enableCheckbox.checked = true;
        if (reminderType) {
            reminderType.value = reminder.type;
            reminderType.disabled = false;
        }

        if (reminder.type === 'specific' && specificTimesDiv) {
            specificTimesDiv.style.display = 'block';
            intervalDiv.style.display = 'none';
            const timesInput = document.getElementById('reminderTimes');
            if (timesInput && reminder.times) {
                timesInput.value = reminder.times.join(', ');
            }
        } else if (reminder.type === 'interval' && intervalDiv) {
            intervalDiv.style.display = 'block';
            specificTimesDiv.style.display = 'none';
            document.getElementById('intervalHours').value = reminder.intervalHours || 2;
            document.getElementById('intervalStart').value = reminder.startHour || 10;
            document.getElementById('intervalEnd').value = reminder.endHour || 20;
        }
    } else {
        enableCheckbox.checked = false;
        if (reminderType) reminderType.disabled = true;
        if (specificTimesDiv) specificTimesDiv.style.display = 'none';
        if (intervalDiv) intervalDiv.style.display = 'none';
    }
}

function saveReminderSettings(habitId) {
    const enableCheckbox = document.getElementById('enableReminder');
    if (!enableCheckbox || !enableCheckbox.checked) {
        removeHabitReminder(habitId);
        return;
    }

    const reminderType = document.getElementById('reminderType')?.value || 'interval';

    if (reminderType === 'specific') {
        const timesInput = document.getElementById('reminderTimes')?.value || '';
        const times = timesInput.split(',').map(t => t.trim()).filter(t => /^\d{1,2}:\d{2}$/.test(t));
        if (times.length > 0) {
            setHabitReminder(habitId, { type: 'specific', times });
        }
    } else if (reminderType === 'interval') {
        const intervalHours = parseInt(document.getElementById('intervalHours')?.value) || 2;
        const startHour = parseInt(document.getElementById('intervalStart')?.value) || 10;
        const endHour = parseInt(document.getElementById('intervalEnd')?.value) || 20;
        setHabitReminder(habitId, { type: 'interval', intervalHours, startHour, endHour });
    }
}

function closeHabitModal() {
    if (addHabitModal) addHabitModal.classList.add('hidden');
    editingHabitId = null;
}

function resetHabitForm() {
    // Reset icon selection
    document.querySelectorAll('.icon-option').forEach((el, i) => {
        el.classList.toggle('selected', i === 0);
    });

    // Reset category
    document.querySelectorAll('.category-option').forEach((el, i) => {
        el.classList.toggle('selected', i === 0);
    });

    // Reset frequency
    document.querySelectorAll('.frequency-option').forEach((el, i) => {
        el.classList.toggle('selected', i === 0);
    });

    // Reset days
    document.querySelectorAll('.day-option').forEach(el => {
        el.classList.add('selected');
    });

    // Reset target count
    const targetCountInput = document.getElementById('habitTargetCount');
    if (targetCountInput) targetCountInput.value = 1;
}

function showHabitDetails(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const modal = document.getElementById('habitDetailsModal');
    if (!modal) return;

    const streak = calculateStreak(habitId);
    const longestStreak = calculateLongestStreak(habitId);
    const totalCompletions = getTotalCompletions(habitId);
    const category = HABIT_CATEGORIES.find(c => c.id === habit.category) || HABIT_CATEGORIES[7];

    document.getElementById('detailHabitName').textContent = habit.name;
    document.getElementById('detailHabitIcon').textContent = habit.icon;
    document.getElementById('detailCurrentStreak').textContent = streak;
    document.getElementById('detailLongestStreak').textContent = longestStreak;
    document.getElementById('detailTotalCompletions').textContent = totalCompletions;

    renderHabitCalendar(habitId);

    modal.classList.remove('hidden');
}

function renderHabitCalendar(habitId) {
    const calendarGrid = document.getElementById('habitCalendarGrid');
    if (!calendarGrid) return;

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startDay = firstDay.getDay();

    let html = '';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        html += `<div class="calendar-day other-month"></div>`;
    }

    // Days of month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(today.getFullYear(), today.getMonth(), day);
        const isCompleted = isHabitCompletedForDate(habitId, date);
        const isTodayDate = isToday(date);
        const completionCount = getCompletionCount(habitId, date);
        const habit = habits.find(h => h.id === habitId);
        const isPartial = completionCount > 0 && completionCount < (habit?.targetCount || 1);

        html += `
            <div class="calendar-day ${isCompleted ? 'completed' : ''} ${isPartial ? 'partial' : ''} ${isTodayDate ? 'today' : ''}">
                ${day}
            </div>
        `;
    }

    calendarGrid.innerHTML = html;
}

function confirmDeleteHabit(habitId) {
    if (confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
        deleteHabit(habitId);
    }
}

// ============ EVENT LISTENERS ============

function initHabitEventListeners() {
    // Add habit button
    if (openAddHabitBtn) {
        openAddHabitBtn.addEventListener('click', openAddHabitModal);
    }

    // Close modal buttons
    if (closeAddHabitModal) {
        closeAddHabitModal.addEventListener('click', closeHabitModal);
    }
    if (cancelAddHabitBtn) {
        cancelAddHabitBtn.addEventListener('click', closeHabitModal);
    }

    // Form submission
    if (addHabitForm) {
        addHabitForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = habitNameInput?.value.trim();
            if (!name) return;

            const selectedIcon = document.querySelector('.icon-option.selected')?.dataset.icon || '⭐';
            const selectedCategory = document.querySelector('.category-option.selected')?.dataset.category || 'other';
            const selectedFrequency = document.querySelector('.frequency-option.selected')?.dataset.frequency || 'daily';
            const selectedDays = Array.from(document.querySelectorAll('.day-option.selected'))
                .map(el => parseInt(el.dataset.day));
            const targetCount = parseInt(document.getElementById('habitTargetCount')?.value) || 1;

            const habitData = {
                name,
                icon: selectedIcon,
                category: selectedCategory,
                frequency: selectedFrequency,
                targetDays: selectedFrequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : selectedDays,
                targetCount
            };

            if (editingHabitId) {
                updateHabit(editingHabitId, habitData);
                // Save reminder settings when editing
                saveReminderSettings(editingHabitId);
            } else {
                const newHabit = createHabit(habitData);
                // If reminder was set during creation, save it
                if (document.getElementById('enableReminder')?.checked) {
                    saveReminderSettings(newHabit.id);
                }
            }

            closeHabitModal();
        });
    }

    // Filter buttons
    habitFilters?.forEach(btn => {
        btn.addEventListener('click', () => {
            habitFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHabitFilter = btn.dataset.filter;
            updateHabitDisplay();
        });
    });

    // Date navigation
    const prevDayBtn = document.getElementById('prevDay');
    const nextDayBtn = document.getElementById('nextDay');
    const todayBtn = document.getElementById('todayBtn');

    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', () => {
            selectedDate.setDate(selectedDate.getDate() - 1);
            updateHabitDisplay();
        });
    }

    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', () => {
            selectedDate.setDate(selectedDate.getDate() + 1);
            updateHabitDisplay();
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            selectedDate = new Date();
            updateHabitDisplay();
        });
    }

    // Clear habits
    if (clearHabitsBtn) {
        clearHabitsBtn.addEventListener('click', () => {
            if (clearHabitsModal) clearHabitsModal.classList.remove('hidden');
        });
    }

    if (cancelClearHabitsBtn) {
        cancelClearHabitsBtn.addEventListener('click', () => {
            if (clearHabitsModal) clearHabitsModal.classList.add('hidden');
        });
    }

    if (confirmClearHabitsBtn) {
        confirmClearHabitsBtn.addEventListener('click', () => {
            habits = [];
            habitCompletions = {};
            saveHabits();
            saveCompletions();
            updateHabitDisplay();
            if (clearHabitsModal) clearHabitsModal.classList.add('hidden');
        });
    }

    // Icon selection
    document.querySelectorAll('.icon-option').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
        });
    });

    // Category selection
    document.querySelectorAll('.category-option').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.category-option').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
        });
    });

    // Frequency selection
    document.querySelectorAll('.frequency-option').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.frequency-option').forEach(f => f.classList.remove('selected'));
            el.classList.add('selected');

            const daysSelector = document.getElementById('daysSelector');
            if (daysSelector) {
                daysSelector.style.display = el.dataset.frequency === 'daily' ? 'none' : 'flex';
            }
        });
    });

    // Day selection
    document.querySelectorAll('.day-option').forEach(el => {
        el.addEventListener('click', () => {
            el.classList.toggle('selected');
        });
    });

    // Close habit details modal
    const closeDetailsBtn = document.getElementById('closeHabitDetailsModal');
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', () => {
            document.getElementById('habitDetailsModal')?.classList.add('hidden');
        });
    }

    // Reminder toggle event listener
    const enableReminderCheckbox = document.getElementById('enableReminder');
    if (enableReminderCheckbox) {
        enableReminderCheckbox.addEventListener('change', (e) => {
            const reminderType = document.getElementById('reminderType');
            const specificTimesDiv = document.getElementById('specificTimesSection');
            const intervalDiv = document.getElementById('intervalSection');

            if (e.target.checked) {
                if (reminderType) reminderType.disabled = false;
                // Request notification permission
                requestNotificationPermission();
                // Show appropriate section
                const type = reminderType?.value || 'interval';
                if (type === 'specific' && specificTimesDiv) {
                    specificTimesDiv.style.display = 'block';
                    intervalDiv.style.display = 'none';
                } else if (intervalDiv) {
                    intervalDiv.style.display = 'block';
                    specificTimesDiv.style.display = 'none';
                }
            } else {
                if (reminderType) reminderType.disabled = true;
                if (specificTimesDiv) specificTimesDiv.style.display = 'none';
                if (intervalDiv) intervalDiv.style.display = 'none';
            }
        });
    }

    // Reminder type change listener
    const reminderTypeSelect = document.getElementById('reminderType');
    if (reminderTypeSelect) {
        reminderTypeSelect.addEventListener('change', (e) => {
            const specificTimesDiv = document.getElementById('specificTimesSection');
            const intervalDiv = document.getElementById('intervalSection');

            if (e.target.value === 'specific') {
                if (specificTimesDiv) specificTimesDiv.style.display = 'block';
                if (intervalDiv) intervalDiv.style.display = 'none';
            } else {
                if (intervalDiv) intervalDiv.style.display = 'block';
                if (specificTimesDiv) specificTimesDiv.style.display = 'none';
            }
        });
    }
}

// ============ INITIALIZATION ============

function initHabitTracker() {
    loadHabits();
    loadCompletions();
    loadReminders();
    initHabitEventListeners();
    updateHabitDisplay();

    // Initialize all scheduled reminders
    initAllReminders();

    // Request notification permission early
    requestNotificationPermission();

    // Setup Firebase sync when authenticated
    window.addEventListener('authStateChanged', (e) => {
        if (e.detail.user) {
            setupHabitsFirebaseSync();
        }
    });

    // Check if already authenticated
    if (window.firebaseApp?.currentUser) {
        setupHabitsFirebaseSync();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initHabitTracker);

// Make functions globally available
window.toggleHabitCompletion = toggleHabitCompletion;
window.incrementHabitCount = incrementHabitCount;
window.decrementHabitCount = decrementHabitCount;
window.openAddHabitModal = openAddHabitModal;
window.openEditHabitModal = openEditHabitModal;
window.showHabitDetails = showHabitDetails;
window.confirmDeleteHabit = confirmDeleteHabit;
