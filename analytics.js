// ============ ANALYTICS APP ============

// State
let analyticsInitialized = false;
let currentTimeRange = 'week'; // week, month, year

// ============ DATA COLLECTION ============

function getAnalyticsData() {
    const pomodoroData = JSON.parse(localStorage.getItem('pomodoroData') || '{}');
    const dailyStats = JSON.parse(localStorage.getItem('pomodoroDailyStats') || '{}');
    const tasks = JSON.parse(localStorage.getItem('pomodoroTasks') || '[]');
    const habits = JSON.parse(localStorage.getItem('pomodoroHabits') || '[]');
    const habitCompletions = JSON.parse(localStorage.getItem('pomodoroHabitCompletions') || '{}');
    const focusHistory = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');

    return {
        pomodoroData,
        dailyStats,
        tasks,
        habits,
        habitCompletions,
        focusHistory
    };
}

function saveFocusSession(minutes, activity, date = new Date()) {
    const history = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');
    history.push({
        date: date.toISOString(),
        minutes,
        activity,
        timestamp: Date.now()
    });

    // Keep only last 365 days
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    const filtered = history.filter(h => h.timestamp > oneYearAgo);
    localStorage.setItem('pomodoroFocusHistory', JSON.stringify(filtered));
}

// ============ CHART CALCULATIONS ============

function getWeeklyData() {
    const history = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = Array(7).fill(0);

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    history.forEach(session => {
        const sessionDate = new Date(session.date);
        if (sessionDate >= weekStart) {
            const dayIndex = sessionDate.getDay();
            data[dayIndex] += session.minutes;
        }
    });

    return { labels: days, data };
}

function getMonthlyData() {
    const history = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const data = Array(daysInMonth).fill(0);

    history.forEach(session => {
        const sessionDate = new Date(session.date);
        if (sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear()) {
            const dayIndex = sessionDate.getDate() - 1;
            data[dayIndex] += session.minutes;
        }
    });

    return { labels, data };
}

function getYearlyData() {
    const history = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = Array(12).fill(0);

    history.forEach(session => {
        const sessionDate = new Date(session.date);
        if (sessionDate.getFullYear() === now.getFullYear()) {
            const monthIndex = sessionDate.getMonth();
            data[monthIndex] += session.minutes;
        }
    });

    return { labels: months, data };
}

function getActivityBreakdown() {
    const pomodoroData = JSON.parse(localStorage.getItem('pomodoroData') || '{}');
    const activities = pomodoroData.activityStats || {};

    const labels = [];
    const data = [];
    const colors = {
        work: '#ef4444',
        study: '#3b82f6',
        exercise: '#22c55e',
        reading: '#a855f7',
        coding: '#f97316',
        other: '#6b7280'
    };
    const backgroundColors = [];

    Object.entries(activities).forEach(([activity, stats]) => {
        if (stats.cycles > 0) {
            labels.push(activity.charAt(0).toUpperCase() + activity.slice(1));
            data.push(stats.cycles);
            backgroundColors.push(colors[activity] || '#6b7280');
        }
    });

    return { labels, data, backgroundColors };
}

function getHabitCompletionRate() {
    const completions = JSON.parse(localStorage.getItem('pomodoroHabitCompletions') || '{}');
    const habits = JSON.parse(localStorage.getItem('pomodoroHabits') || '[]').filter(h => !h.archived);

    if (habits.length === 0) return { rate: 0, data: [] };

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        let completed = 0;
        let total = habits.length;

        habits.forEach(habit => {
            const completion = completions[dateKey]?.[habit.id];
            if (completion && completion.count >= (habit.targetCount || 1)) {
                completed++;
            }
        });

        last7Days.push(total > 0 ? Math.round((completed / total) * 100) : 0);
    }

    const avgRate = Math.round(last7Days.reduce((a, b) => a + b, 0) / 7);
    return { rate: avgRate, data: last7Days };
}

function getProductivityTrend() {
    const history = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');
    const last14Days = [];

    for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        const dayMinutes = history
            .filter(s => {
                const sessionDate = new Date(s.date);
                return sessionDate >= date && sessionDate < nextDay;
            })
            .reduce((sum, s) => sum + s.minutes, 0);

        last14Days.push(dayMinutes);
    }

    // Calculate trend (positive or negative)
    const firstHalf = last14Days.slice(0, 7).reduce((a, b) => a + b, 0);
    const secondHalf = last14Days.slice(7).reduce((a, b) => a + b, 0);
    const trend = secondHalf - firstHalf;

    return {
        data: last14Days,
        trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
        percentage: firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0
    };
}

function getTaskCompletionStats() {
    const tasks = JSON.parse(localStorage.getItem('pomodoroTasks') || '[]');

    const total = tasks.length;
    const done = tasks.filter(t => t.state === 'done').length;
    const doing = tasks.filter(t => t.state === 'doing').length;
    const todo = tasks.filter(t => t.state === 'todo' || !t.state).length;

    return { total, done, doing, todo, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
}

// ============ RENDER FUNCTIONS ============

function renderAnalytics() {
    renderSummaryCards();
    renderFocusChart();
    renderActivityChart();
    renderHabitChart();
    renderInsights();
}

function renderSummaryCards() {
    const data = getAnalyticsData();
    const trend = getProductivityTrend();
    const taskStats = getTaskCompletionStats();
    const habitRate = getHabitCompletionRate();

    // Total focus time - use pomodoroData.totalMinutes if focusHistory is empty
    let totalMinutes = 0;
    const history = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');
    if (history.length > 0) {
        totalMinutes = history.reduce((sum, s) => sum + (s.minutes || 0), 0);
    } else if (data.pomodoroData.totalMinutes) {
        totalMinutes = data.pomodoroData.totalMinutes;
    }

    const focusEl = document.getElementById('totalFocusTime');
    if (focusEl) focusEl.textContent = `${Math.round(totalMinutes / 60 * 10) / 10}h`;

    const tasksEl = document.getElementById('totalTasksCompleted');
    if (tasksEl) tasksEl.textContent = taskStats.done;

    const habitEl = document.getElementById('habitCompletionRate');
    if (habitEl) habitEl.textContent = `${habitRate.rate}%`;

    // Productivity score
    const pomodoroScore = Math.min(100, Math.round((totalMinutes / 120) * 100)); // Based on 2h daily goal
    const taskScore = taskStats.rate;
    const habitScore = habitRate.rate;
    const productivityScoreValue = Math.round((pomodoroScore + taskScore + habitScore) / 3);

    const scoreEl = document.getElementById('productivityScore');
    if (scoreEl) scoreEl.textContent = productivityScoreValue;
}

function renderFocusChart() {
    const canvas = document.getElementById('focusChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Get actual canvas dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio || 400;
    canvas.height = rect.height * window.devicePixelRatio || 200;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const displayWidth = rect.width || 400;
    const displayHeight = rect.height || 200;

    // Get data based on time range
    let data;
    const history = JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]');

    if (history.length > 0) {
        // Use focus history data
        if (currentTimeRange === 'year') {
            data = getYearlyData();
        } else if (currentTimeRange === 'month') {
            data = getMonthlyData();
        } else {
            data = getWeeklyData();
        }
    } else {
        // Fallback to dailyStats when no history exists
        const dailyStats = JSON.parse(localStorage.getItem('pomodoroDailyStats') || '{}');

        if (currentTimeRange === 'year') {
            // Show months with only today's data in current month
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const chartData = Array(12).fill(0);
            if (dailyStats.date === new Date().toDateString() && dailyStats.minutesToday) {
                chartData[new Date().getMonth()] = Number(dailyStats.minutesToday) || 0;
            }
            data = { labels: months, data: chartData };
        } else if (currentTimeRange === 'month') {
            // Show days of month with only today's data
            const now = new Date();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const chartData = Array(daysInMonth).fill(0);
            if (dailyStats.date === new Date().toDateString() && dailyStats.minutesToday) {
                chartData[now.getDate() - 1] = Number(dailyStats.minutesToday) || 0;
            }
            data = { labels, data: chartData };
        } else {
            // Week view (default)
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const todayIndex = new Date().getDay();
            const chartData = Array(7).fill(0);
            if (dailyStats.date === new Date().toDateString() && dailyStats.minutesToday) {
                chartData[todayIndex] = Number(dailyStats.minutesToday) || 0;
            }
            data = { labels: days, data: chartData };
        }
    }

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const padding = 50;
    const chartWidth = displayWidth - padding * 2;
    const chartHeight = displayHeight - padding * 1.5;
    const maxValue = Math.max(...data.data, 30); // Min 30 minutes for scale
    const barWidth = chartWidth / data.labels.length * 0.6;
    const gap = chartWidth / data.labels.length * 0.4;

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(displayWidth - padding, y);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = '#9ca3af';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        const value = Math.round(maxValue - (maxValue / 4) * i);
        ctx.fillText(`${value}m`, padding - 8, y + 4);
    }

    // Draw bars
    data.data.forEach((value, index) => {
        const x = padding + index * (barWidth + gap) + gap / 2;
        const height = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
        const y = padding + chartHeight - height;

        // Bar gradient
        const gradient = ctx.createLinearGradient(x, y, x, padding + chartHeight);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#818cf8');

        ctx.fillStyle = value > 0 ? gradient : '#e5e7eb';
        ctx.beginPath();

        // Draw bar with rounded top corners
        const radius = 4;
        const barHeight = Math.max(height, 2); // Minimum height for visibility
        const barY = padding + chartHeight - barHeight;

        ctx.moveTo(x + radius, barY);
        ctx.lineTo(x + barWidth - radius, barY);
        ctx.quadraticCurveTo(x + barWidth, barY, x + barWidth, barY + radius);
        ctx.lineTo(x + barWidth, padding + chartHeight);
        ctx.lineTo(x, padding + chartHeight);
        ctx.lineTo(x, barY + radius);
        ctx.quadraticCurveTo(x, barY, x + radius, barY);
        ctx.closePath();
        ctx.fill();

        // X-axis labels
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.labels[index], x + barWidth / 2, displayHeight - 10);
    });

    // Show "No data" message if all values are 0
    if (data.data.every(v => v === 0)) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Start a focus session to see data here', displayWidth / 2, displayHeight / 2);
    }
}

function renderActivityChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Get actual canvas dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 300) * (window.devicePixelRatio || 1);
    canvas.height = (rect.height || 200) * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const displayWidth = rect.width || 300;
    const displayHeight = rect.height || 200;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const data = getActivityBreakdown();

    if (data.data.length === 0) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Complete focus sessions', displayWidth / 2, displayHeight / 2 - 10);
        ctx.fillText('to see activity breakdown', displayWidth / 2, displayHeight / 2 + 10);
        return;
    }

    const total = data.data.reduce((a, b) => a + b, 0);
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;
    const radius = Math.min(centerX, centerY) - 40;

    let startAngle = -Math.PI / 2;

    data.data.forEach((value, index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = data.backgroundColors[index];
        ctx.fill();

        // Label
        const midAngle = startAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(midAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(midAngle) * (radius * 0.7);

        if (sliceAngle > 0.3) { // Only show label if slice is big enough
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round((value / total) * 100)}%`, labelX, labelY);
        }

        startAngle += sliceAngle;
    });

    // Center hole (donut)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary') || '#ffffff';
    ctx.fill();

    // Center text
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#1f2937';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(total, centerX, centerY - 5);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('cycles', centerX, centerY + 12);
}

function renderActivityLegend(data) {
    const legendEl = document.getElementById('activityLegend');
    if (!legendEl) return;

    legendEl.innerHTML = data.labels.map((label, i) => `
        <div class="legend-item">
            <span class="legend-color" style="background: ${data.backgroundColors[i]}"></span>
            <span class="legend-label">${label}</span>
            <span class="legend-value">${data.data[i]}</span>
        </div>
    `).join('');
}

function renderHabitChart() {
    const canvas = document.getElementById('habitTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Get actual canvas dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = (rect.width || 800) * (window.devicePixelRatio || 1);
    canvas.height = (rect.height || 200) * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const displayWidth = rect.width || 800;
    const displayHeight = rect.height || 200;

    const habitData = getHabitCompletionRate();

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const padding = 40;
    const chartWidth = displayWidth - padding * 2;
    const chartHeight = displayHeight - padding * 1.5;
    const days = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(displayWidth - padding, y);
        ctx.stroke();

        // Y-axis labels (percentage)
        ctx.fillStyle = '#9ca3af';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        const value = 100 - (100 / 4) * i;
        ctx.fillText(`${value}%`, padding - 8, y + 4);
    }

    // Check if there's any data
    const hasData = habitData.data.some(v => v > 0);

    if (!hasData) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Create habits and mark them complete to see trends', displayWidth / 2, displayHeight / 2);
        return;
    }

    // Draw area fill
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);

    habitData.data.forEach((value, index) => {
        const x = padding + (index / 6) * chartWidth;
        const y = padding + chartHeight - (value / 100) * chartHeight;
        ctx.lineTo(x, y);
    });

    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    habitData.data.forEach((value, index) => {
        const x = padding + (index / 6) * chartWidth;
        const y = padding + chartHeight - (value / 100) * chartHeight;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw points
    habitData.data.forEach((value, index) => {
        const x = padding + (index / 6) * chartWidth;
        const y = padding + chartHeight - (value / 100) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary') || 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // X-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    days.forEach((day, i) => {
        const x = padding + (i / 6) * chartWidth;
        ctx.fillText(day, x, displayHeight - 10);
    });
}

function renderInsights() {
    const insightsEl = document.getElementById('insightsGrid');
    if (!insightsEl) return;

    const insights = generateInsights();

    if (insights.length === 0) {
        insightsEl.innerHTML = `
            <div class="insight-card neutral">
                <span class="insight-icon">💡</span>
                <div class="insight-content">
                    <div class="insight-title">Get Started</div>
                    <div class="insight-text">Complete focus sessions, tasks, and habits to see personalized insights here.</div>
                </div>
            </div>
        `;
        return;
    }

    insightsEl.innerHTML = insights.map(insight => `
        <div class="insight-card ${insight.type}">
            <span class="insight-icon">${insight.icon}</span>
            <div class="insight-content">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-text">${insight.text}</div>
            </div>
        </div>
    `).join('');
}

function generateInsights() {
    const insights = [];
    const trend = getProductivityTrend();
    const weekData = getWeeklyData();
    const habitRate = getHabitCompletionRate();
    const taskStats = getTaskCompletionStats();

    // Productivity trend insight
    if (trend.trend === 'up' && trend.percentage > 10) {
        insights.push({
            type: 'positive',
            icon: '🚀',
            title: 'Great Progress!',
            text: `Your focus time increased by ${trend.percentage}% compared to last week. Keep it up!`
        });
    } else if (trend.trend === 'down' && trend.percentage < -10) {
        insights.push({
            type: 'warning',
            icon: '💪',
            title: 'Room for Improvement',
            text: `Your focus time decreased by ${Math.abs(trend.percentage)}%. Try to schedule more focus sessions.`
        });
    }

    // Best day insight
    const maxDay = Math.max(...weekData.data);
    const bestDayIndex = weekData.data.indexOf(maxDay);
    if (maxDay > 0) {
        insights.push({
            type: 'info',
            icon: '📅',
            title: 'Best Day',
            text: `${weekData.labels[bestDayIndex]} was your most productive day with ${maxDay} minutes of focus time.`
        });
    }

    // Habit streak insight
    if (habitRate.rate >= 80) {
        insights.push({
            type: 'positive',
            icon: '⭐',
            title: 'Habit Master!',
            text: `Amazing! You completed ${habitRate.rate}% of your habits this week.`
        });
    } else if (habitRate.rate < 50 && habitRate.rate > 0) {
        insights.push({
            type: 'warning',
            icon: '🎯',
            title: 'Build Consistency',
            text: `Your habit completion is at ${habitRate.rate}%. Try focusing on 2-3 key habits.`
        });
    }

    // Task insight
    if (taskStats.doing > 3) {
        insights.push({
            type: 'warning',
            icon: '📋',
            title: 'Too Many in Progress',
            text: `You have ${taskStats.doing} tasks in progress. Consider finishing some before starting new ones.`
        });
    }

    if (insights.length === 0) {
        insights.push({
            type: 'info',
            icon: '📊',
            title: 'Start Tracking',
            text: 'Complete more sessions to see personalized insights about your productivity patterns.'
        });
    }

    return insights;
}

// ============ EVENT LISTENERS ============

function initAnalyticsListeners() {
    // Period selector dropdown
    const periodSelect = document.getElementById('analyticsPeriod');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            currentTimeRange = e.target.value;
            renderFocusChart();
            renderHabitChart();
        });
    }

    // Export button
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
}

// ============ EXPORT FUNCTION ============

function exportData() {
    const data = getAnalyticsData();
    const weekData = getWeeklyData();
    const taskStats = getTaskCompletionStats();
    const habitRate = getHabitCompletionRate();

    const exportObj = {
        exportDate: new Date().toISOString(),
        summary: {
            totalFocusTimeMinutes: weekData.data.reduce((a, b) => a + b, 0),
            totalCycles: Object.values(data.pomodoroData.activityStats || {}).reduce((sum, a) => sum + (a.cycles || 0), 0),
            tasksCompleted: taskStats.done,
            habitCompletionRate: habitRate.rate,
            currentStreak: data.dailyStats.streak || 0
        },
        weeklyFocusTime: weekData,
        activityBreakdown: getActivityBreakdown(),
        tasks: data.tasks,
        habits: data.habits
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============ INITIALIZATION ============

function initAnalytics() {
    if (analyticsInitialized) {
        renderAnalytics();
        return;
    }

    initAnalyticsListeners();
    renderAnalytics();
    analyticsInitialized = true;
}

// Export all app data
function exportAllData() {
    const allData = {
        exportDate: new Date().toISOString(),
        version: '2.0',
        pomodoro: {
            data: JSON.parse(localStorage.getItem('pomodoroData') || '{}'),
            dailyStats: JSON.parse(localStorage.getItem('pomodoroDailyStats') || '{}'),
            focusHistory: JSON.parse(localStorage.getItem('pomodoroFocusHistory') || '[]')
        },
        tasks: JSON.parse(localStorage.getItem('pomodoroTasks') || '[]'),
        habits: {
            list: JSON.parse(localStorage.getItem('pomodoroHabits') || '[]'),
            completions: JSON.parse(localStorage.getItem('pomodoroHabitCompletions') || '{}'),
            reminders: JSON.parse(localStorage.getItem('pomodoroHabitReminders') || '[]')
        },
        notes: {
            notes: JSON.parse(localStorage.getItem('pomodoroNotes') || '[]'),
            journal: JSON.parse(localStorage.getItem('pomodoroJournal') || '[]')
        },
        settings: {
            theme: localStorage.getItem('pomodoroTheme'),
            sounds: JSON.parse(localStorage.getItem('pomodoroSoundSettings') || '{}'),
            shortcuts: JSON.parse(localStorage.getItem('pomodoroKeyboardSettings') || '{}')
        }
    };

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity-hub-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function confirmClearAllData() {
    if (confirm('⚠️ WARNING: This will delete ALL your data including:\n\n• Pomodoro history and statistics\n• All tasks\n• All habits and completions\n• All notes and journal entries\n• Settings and preferences\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
        if (confirm('Last chance! Type "DELETE" mentally and click OK to confirm.')) {
            clearAllData();
        }
    }
}

function clearAllData() {
    // Clear all localStorage keys
    const keysToRemove = [
        'pomodoroData', 'pomodoroDailyStats', 'pomodoroFocusHistory',
        'pomodoroTasks', 'pomodoroHabits', 'pomodoroHabitCompletions',
        'pomodoroHabitReminders', 'pomodoroNotes', 'pomodoroJournal',
        'pomodoroSoundSettings', 'pomodoroKeyboardSettings', 'pomodoroTheme'
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    alert('All data has been cleared. The page will now reload.');
    window.location.reload();
}

// Make functions available globally
window.initAnalytics = initAnalytics;
window.saveFocusSession = saveFocusSession;
window.exportData = exportData;
window.exportAllData = exportAllData;
window.confirmClearAllData = confirmClearAllData;
