// ============ DASHBOARD APP ============

// Dashboard state
let dashboardInitialized = false;

// ============ UTILITY FUNCTIONS ============

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function formatTodayDate() {
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// ============ DATA AGGREGATION ============

function getPomodoroStats() {
    // Get daily stats from pomodoroDailyStats (same as Pomodoro app uses)
    let totalWorkTime = 0;
    let sessionsToday = 0;
    let currentStreak = 0;
    let dailyGoal = 120;
    let activityBreakdown = {
        work: 0,
        study: 0,
        exercise: 0,
        reading: 0,
        coding: 0,
        other: 0
    };

    try {
        // Get daily stats (minutesToday, sessionsToday, streak, activityBreakdown)
        const dailyStatsData = localStorage.getItem('pomodoroDailyStats');
        if (dailyStatsData) {
            const dailyStats = JSON.parse(dailyStatsData);
            // Check if it's today's data
            const today = new Date().toDateString();
            if (dailyStats.date === today) {
                totalWorkTime = dailyStats.minutesToday || 0;
                sessionsToday = dailyStats.sessionsToday || 0;
                // Get today's activity breakdown
                if (dailyStats.activityBreakdown) {
                    activityBreakdown = {
                        work: dailyStats.activityBreakdown.work || 0,
                        study: dailyStats.activityBreakdown.study || 0,
                        exercise: dailyStats.activityBreakdown.exercise || 0,
                        reading: dailyStats.activityBreakdown.reading || 0,
                        coding: dailyStats.activityBreakdown.coding || 0,
                        other: dailyStats.activityBreakdown.other || 0
                    };
                }
            }
            currentStreak = dailyStats.streak || 0;
            dailyGoal = dailyStats.dailyGoal || 120;
        }
    } catch (e) {
        console.error('Error getting pomodoro stats:', e);
    }

    return {
        totalWorkTime, // Already in minutes
        sessionsToday,
        currentStreak,
        dailyGoal,
        activityBreakdown
    };
}

function getTasksStats() {
    let todoCount = 0;
    let doingCount = 0;
    let doneCount = 0;
    let overdueCount = 0;
    let urgentTasks = [];
    let doingTasks = [];
    let todayTasks = [];

    try {
        const tasksData = localStorage.getItem('pomodoroTasks');
        if (tasksData) {
            const tasks = JSON.parse(tasksData);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            tasks.forEach(task => {
                const state = task.state || (task.completed ? 'done' : 'todo');

                if (state === 'todo') todoCount++;
                else if (state === 'doing') {
                    doingCount++;
                    doingTasks.push(task);
                }
                else if (state === 'done') doneCount++;

                // Check for overdue
                if (task.dueDate && state !== 'done') {
                    const dueDate = new Date(task.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    if (dueDate < today) {
                        overdueCount++;
                    } else if (dueDate.getTime() === today.getTime()) {
                        todayTasks.push(task);
                    }
                }

                // Check for urgent
                if (task.tags && task.tags.includes('urgent') && state !== 'done') {
                    urgentTasks.push(task);
                }
            });
        }
    } catch (e) {
        console.error('Error getting tasks stats:', e);
    }

    return {
        todoCount,
        doingCount,
        doneCount,
        overdueCount,
        urgentTasks: urgentTasks.slice(0, 3),
        doingTasks: doingTasks.slice(0, 3),
        todayTasks: todayTasks.slice(0, 3)
    };
}

function getHabitsStats() {
    let totalHabits = 0;
    let completedToday = 0;
    let todayHabits = [];

    try {
        const habitsData = localStorage.getItem('pomodoroHabits');
        const completionsData = localStorage.getItem('pomodoroHabitCompletions');

        if (habitsData) {
            const habits = JSON.parse(habitsData).filter(h => !h.archived);
            const completions = completionsData ? JSON.parse(completionsData) : {};

            const today = new Date();
            const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const dayOfWeek = today.getDay();

            habits.forEach(habit => {
                // Check if habit is for today
                const isForToday = habit.frequency === 'daily' ||
                    (habit.targetDays && habit.targetDays.includes(dayOfWeek));

                if (isForToday) {
                    totalHabits++;
                    const completion = completions[todayKey]?.[habit.id];
                    const targetCount = habit.targetCount || 1;
                    const currentCount = completion?.count || 0;
                    const isCompleted = currentCount >= targetCount;

                    if (isCompleted) {
                        completedToday++;
                    }

                    todayHabits.push({
                        ...habit,
                        isCompleted,
                        currentCount,
                        targetCount
                    });
                }
            });
        }
    } catch (e) {
        console.error('Error getting habits stats:', e);
    }

    return {
        totalHabits,
        completedToday,
        todayHabits: todayHabits.slice(0, 5),
        completionRate: totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0
    };
}

function calculateProductivityScore() {
    const pomodoroStats = getPomodoroStats();
    const tasksStats = getTasksStats();
    const habitsStats = getHabitsStats();

    let score = 0;
    let factors = 0;

    // Pomodoro factor (0-100 based on daily goal from Pomodoro app)
    const dailyGoal = pomodoroStats.dailyGoal;
    const pomodoroScore = Math.min(100, (pomodoroStats.totalWorkTime / dailyGoal) * 100);
    score += pomodoroScore;
    factors++;

    // Tasks factor (based on completion and doing ratio)
    const totalTasks = tasksStats.todoCount + tasksStats.doingCount + tasksStats.doneCount;
    if (totalTasks > 0) {
        const taskScore = (tasksStats.doneCount / totalTasks) * 100;
        score += taskScore;
        factors++;
    }

    // Habits factor
    if (habitsStats.totalHabits > 0) {
        score += habitsStats.completionRate;
        factors++;
    }

    const finalScore = factors > 0 ? Math.round(score / factors) : 0;

    let rating = 'low';
    let description = 'Keep going! Every step counts.';

    if (finalScore >= 80) {
        rating = 'excellent';
        description = 'Outstanding! You\'re crushing it today! 🏆';
    } else if (finalScore >= 60) {
        rating = 'good';
        description = 'Great progress! Keep up the momentum! 💪';
    } else if (finalScore >= 40) {
        rating = 'average';
        description = 'Good start! Push a little more! 🎯';
    }

    return { score: finalScore, rating, description };
}

// ============ RENDER FUNCTIONS ============

function renderDashboard() {
    renderWelcomeBanner();
    renderPomodoroCard();
    renderTasksCard();
    renderHabitsCard();
    renderProductivityScore();
    renderGoalsProgress();
}

function renderWelcomeBanner() {
    const greetingEl = document.getElementById('dashboardGreeting');
    const dateEl = document.getElementById('dashboardDate');
    const focusTimeEl = document.getElementById('welcomeFocusTime');
    const tasksCompletedEl = document.getElementById('welcomeTasksCompleted');
    const habitsCompletedEl = document.getElementById('welcomeHabitsCompleted');

    const pomodoroStats = getPomodoroStats();
    const tasksStats = getTasksStats();
    const habitsStats = getHabitsStats();

    // Get user name
    let userName = 'there';
    if (window.firebaseApp?.currentUser?.displayName) {
        userName = window.firebaseApp.currentUser.displayName.split(' ')[0];
    }

    if (greetingEl) greetingEl.textContent = `${getGreeting()}, ${userName}! 👋`;
    if (dateEl) dateEl.textContent = formatTodayDate();
    if (focusTimeEl) focusTimeEl.textContent = `${pomodoroStats.totalWorkTime}m`;
    if (tasksCompletedEl) tasksCompletedEl.textContent = tasksStats.doneCount;
    if (habitsCompletedEl) habitsCompletedEl.textContent = `${habitsStats.completedToday}/${habitsStats.totalHabits}`;
}

function renderPomodoroCard() {
    const stats = getPomodoroStats();

    // Update stats
    const focusTimeEl = document.getElementById('dashFocusTime');
    const sessionsEl = document.getElementById('dashSessions');
    const streakEl = document.getElementById('dashStreak');

    if (focusTimeEl) focusTimeEl.textContent = `${stats.totalWorkTime}m`;
    if (sessionsEl) sessionsEl.textContent = stats.sessionsToday;
    if (streakEl) streakEl.textContent = stats.currentStreak;

    // Render daily goal progress bar and activity breakdown for today
    const breakdownEl = document.getElementById('activityBreakdown');
    if (breakdownEl) {
        const dailyGoal = stats.dailyGoal;
        const progress = Math.min((stats.totalWorkTime / dailyGoal) * 100, 100);
        const isComplete = progress >= 100;

        // Calculate total today's cycles for percentage calculations
        const breakdown = stats.activityBreakdown;
        const totalTodayCycles = Object.values(breakdown).reduce((a, b) => a + b, 0);

        // Activity colors matching the Pomodoro app
        const activityColors = {
            work: '#ef4444',
            study: '#3b82f6',
            exercise: '#22c55e',
            reading: '#a855f7',
            coding: '#f97316',
            other: '#6b7280'
        };

        // Build activity breakdown HTML (only show activities with cycles > 0)
        let activityBarsHTML = '';
        const activeActivities = Object.entries(breakdown).filter(([_, cycles]) => cycles > 0);

        if (activeActivities.length > 0) {
            activityBarsHTML = `
                <div class="activity-breakdown-dash">
                    <div class="activity-breakdown-title-dash">Today's Cycles</div>
                    <div class="activity-bars-dash">
                        ${activeActivities.map(([activity, cycles]) => {
                const percentage = totalTodayCycles > 0 ? (cycles / totalTodayCycles) * 100 : 0;
                const activityName = activity.charAt(0).toUpperCase() + activity.slice(1);
                return `
                                <div class="activity-bar-item-dash">
                                    <div class="activity-bar-label-dash">
                                        <span class="activity-name-dash">${activityName}</span>
                                        <span class="activity-count-dash">${cycles}</span>
                                    </div>
                                    <div class="activity-bar-track-dash">
                                        <div class="activity-bar-fill-dash" style="width: ${percentage}%; background-color: ${activityColors[activity]}"></div>
                                    </div>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        breakdownEl.innerHTML = `
            <div class="daily-goal-dashboard">
                <div class="daily-goal-header-dash">
                    <span class="daily-goal-label-dash">Daily Goal</span>
                    <span class="daily-goal-progress-dash">${stats.totalWorkTime} / ${dailyGoal} min</span>
                </div>
                <div class="daily-goal-bar-dash">
                    <div class="daily-goal-fill-dash ${isComplete ? 'complete' : ''}" style="width: ${progress}%"></div>
                </div>
            </div>
            ${activityBarsHTML}
        `;
    }
}

function renderTasksCard() {
    const stats = getTasksStats();

    // Update mini stats
    const todoEl = document.getElementById('dashTodo');
    const doingEl = document.getElementById('dashDoing');
    const doneEl = document.getElementById('dashDone');
    const overdueEl = document.getElementById('dashOverdue');

    if (todoEl) todoEl.textContent = stats.todoCount;
    if (doingEl) doingEl.textContent = stats.doingCount;
    if (doneEl) doneEl.textContent = stats.doneCount;
    if (overdueEl) overdueEl.textContent = stats.overdueCount;

    // Render task preview list
    const previewEl = document.getElementById('taskPreviewList');
    if (previewEl) {
        // Combine urgent, doing, and today tasks
        const previewTasks = [];

        stats.urgentTasks.forEach(t => previewTasks.push({ ...t, type: 'urgent' }));
        stats.doingTasks.forEach(t => {
            if (!previewTasks.find(p => p.id === t.id)) {
                previewTasks.push({ ...t, type: 'doing' });
            }
        });
        stats.todayTasks.forEach(t => {
            if (!previewTasks.find(p => p.id === t.id)) {
                previewTasks.push({ ...t, type: 'today' });
            }
        });

        if (previewTasks.length === 0) {
            previewEl.innerHTML = `
                <div class="empty-preview">
                    <div class="empty-preview-icon">✅</div>
                    <p>No urgent tasks. Great job!</p>
                </div>
            `;
        } else {
            previewEl.innerHTML = previewTasks.slice(0, 4).map(task => {
                const stateIcon = task.type === 'doing' ? '🔄' : (task.type === 'urgent' ? '🔥' : '📅');
                const dueText = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
                return `
                    <div class="task-preview-item ${task.type}">
                        <span class="task-preview-state">${stateIcon}</span>
                        <div class="task-preview-content">
                            <div class="task-preview-title">${escapeHTML(task.title)}</div>
                            ${dueText ? `<div class="task-preview-due">${dueText}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

function renderHabitsCard() {
    const stats = getHabitsStats();

    // Update progress ring
    const progressValueEl = document.getElementById('habitsProgressValue');
    const progressLabelEl = document.getElementById('habitsProgressLabel');
    const progressFillEl = document.getElementById('habitsProgressFill');

    if (progressValueEl) progressValueEl.textContent = `${stats.completionRate}%`;
    if (progressLabelEl) progressLabelEl.textContent = `${stats.completedToday}/${stats.totalHabits} done`;

    if (progressFillEl) {
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (stats.completionRate / 100) * circumference;
        progressFillEl.style.strokeDasharray = circumference;
        progressFillEl.style.strokeDashoffset = offset;
    }

    // Render habits preview list (clickable)
    const previewEl = document.getElementById('habitsPreviewList');
    if (previewEl) {
        if (stats.todayHabits.length === 0) {
            previewEl.innerHTML = `
                <div class="empty-preview">
                    <div class="empty-preview-icon">🎯</div>
                    <p>No habits for today</p>
                </div>
            `;
        } else {
            previewEl.innerHTML = stats.todayHabits.map(habit => `
                <div class="habit-preview-item clickable ${habit.isCompleted ? 'completed' : ''}" 
                     data-habit-id="${habit.id}" 
                     onclick="toggleHabitFromDashboard('${habit.id}')"
                     title="Click to toggle completion">
                    <span class="habit-preview-icon">${habit.icon}</span>
                    <span class="habit-preview-name">${escapeHTML(habit.name)}</span>
                    <span class="habit-preview-status ${habit.isCompleted ? 'done' : ''}">${habit.currentCount}/${habit.targetCount}</span>
                </div>
            `).join('');
        }
    }
}

// Toggle habit completion from dashboard
function toggleHabitFromDashboard(habitId) {
    // Call the habits.js function if available
    if (typeof window.toggleHabitCompletion === 'function') {
        window.toggleHabitCompletion(habitId);
        // Refresh dashboard after a short delay to allow state to update
        setTimeout(() => {
            renderHabitsCard();
            renderWelcomeBanner();
            renderProductivityScore();
            renderGoalsProgress();
        }, 100);
    }
}

// Make function globally available
window.toggleHabitFromDashboard = toggleHabitFromDashboard;

function renderProductivityScore() {
    const { score, rating, description } = calculateProductivityScore();

    const scoreValueEl = document.getElementById('productivityScoreValue');
    const scoreFillEl = document.getElementById('productivityScoreFill');
    const scoreLabelEl = document.getElementById('productivityScoreLabel');
    const scoreDescEl = document.getElementById('productivityScoreDesc');

    if (scoreValueEl) scoreValueEl.textContent = score;
    if (scoreLabelEl) scoreLabelEl.textContent = rating.charAt(0).toUpperCase() + rating.slice(1);
    if (scoreDescEl) scoreDescEl.textContent = description;

    if (scoreFillEl) {
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (score / 100) * circumference;
        scoreFillEl.style.strokeDasharray = circumference;
        scoreFillEl.style.strokeDashoffset = offset;
        scoreFillEl.className.baseVal = `score-circle-fill ${rating}`;
    }
}

function renderGoalsProgress() {
    const pomodoroStats = getPomodoroStats();
    const habitsStats = getHabitsStats();

    const goalsEl = document.getElementById('goalsList');
    if (!goalsEl) return;

    // Daily focus goal (use the same dailyGoal from Pomodoro app)
    const dailyGoal = pomodoroStats.dailyGoal;
    const focusProgress = Math.min(100, (pomodoroStats.totalWorkTime / dailyGoal) * 100);

    // Habits goal
    const habitsProgress = habitsStats.completionRate;

    goalsEl.innerHTML = `
        <div class="goal-item">
            <div class="goal-header">
                <span class="goal-name">🎯 Daily Focus Goal</span>
                <span class="goal-progress-text">${pomodoroStats.totalWorkTime}/${dailyGoal} min</span>
            </div>
            <div class="goal-bar">
                <div class="goal-bar-fill ${focusProgress >= 100 ? 'completed' : ''}" style="width: ${focusProgress}%"></div>
            </div>
        </div>
        <div class="goal-item">
            <div class="goal-header">
                <span class="goal-name">✅ Complete All Habits</span>
                <span class="goal-progress-text">${habitsStats.completedToday}/${habitsStats.totalHabits}</span>
            </div>
            <div class="goal-bar">
                <div class="goal-bar-fill ${habitsProgress >= 100 ? 'completed' : ''}" style="width: ${habitsProgress}%"></div>
            </div>
        </div>
    `;
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============ QUICK ACTIONS ============

function setupQuickActions() {
    document.querySelectorAll('.quick-action-card').forEach(card => {
        card.addEventListener('click', () => {
            const app = card.dataset.app;
            if (app && typeof switchApp === 'function') {
                switchApp(app);
            }
        });
    });

    // Card action buttons
    document.querySelectorAll('.card-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const app = btn.dataset.app;
            if (app && typeof switchApp === 'function') {
                switchApp(app);
            }
        });
    });
}

// ============ INITIALIZATION ============

function initDashboard() {
    if (dashboardInitialized) return;

    setupQuickActions();
    renderDashboard();

    dashboardInitialized = true;
}

// Refresh dashboard when it becomes visible
function refreshDashboard() {
    if (document.getElementById('app-dashboard')?.classList.contains('active')) {
        renderDashboard();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Refresh every minute when dashboard is active
    setInterval(refreshDashboard, 60000);
});

// Listen for app switches to refresh dashboard
window.addEventListener('dashboardActivated', refreshDashboard);

// Export for use in other modules
window.dashboardApp = {
    init: initDashboard,
    refresh: refreshDashboard
};
