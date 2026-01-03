// ============ THEMES MODULE ============

const THEMES_KEY = 'pomodoroTheme';

// Available themes
const THEMES = {
    // Light themes
    'light-default': {
        name: 'Light Default',
        category: 'light',
        colors: {
            '--bg-primary': '#ffffff',
            '--bg-secondary': '#f5f5f5',
            '--text-primary': '#1a1a1a',
            '--text-secondary': '#666666',
            '--accent': '#6366f1',
            '--accent-hover': '#4f46e5',
            '--accent-light': '#eef2ff',
            '--border-color': '#e5e5e5',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    'light-ocean': {
        name: 'Ocean Breeze',
        category: 'light',
        colors: {
            '--bg-primary': '#f0f9ff',
            '--bg-secondary': '#e0f2fe',
            '--text-primary': '#0c4a6e',
            '--text-secondary': '#0369a1',
            '--accent': '#0ea5e9',
            '--accent-hover': '#0284c7',
            '--accent-light': '#e0f2fe',
            '--border-color': '#bae6fd',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    'light-forest': {
        name: 'Forest',
        category: 'light',
        colors: {
            '--bg-primary': '#f0fdf4',
            '--bg-secondary': '#dcfce7',
            '--text-primary': '#14532d',
            '--text-secondary': '#166534',
            '--accent': '#22c55e',
            '--accent-hover': '#16a34a',
            '--accent-light': '#dcfce7',
            '--border-color': '#bbf7d0',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    'light-rose': {
        name: 'Rose Garden',
        category: 'light',
        colors: {
            '--bg-primary': '#fff1f2',
            '--bg-secondary': '#ffe4e6',
            '--text-primary': '#881337',
            '--text-secondary': '#be123c',
            '--accent': '#f43f5e',
            '--accent-hover': '#e11d48',
            '--accent-light': '#ffe4e6',
            '--border-color': '#fecdd3',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    'light-amber': {
        name: 'Warm Amber',
        category: 'light',
        colors: {
            '--bg-primary': '#fffbeb',
            '--bg-secondary': '#fef3c7',
            '--text-primary': '#78350f',
            '--text-secondary': '#92400e',
            '--accent': '#f59e0b',
            '--accent-hover': '#d97706',
            '--accent-light': '#fef3c7',
            '--border-color': '#fde68a',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },

    // Dark themes
    'dark-default': {
        name: 'Dark Default',
        category: 'dark',
        colors: {
            '--bg-primary': '#1a1a2e',
            '--bg-secondary': '#252541',
            '--text-primary': '#f5f5f5',
            '--text-secondary': '#c0c0d0',
            '--accent': '#6366f1',
            '--accent-hover': '#818cf8',
            '--accent-light': '#312e81',
            '--border-color': '#3a3a5a',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    'dark-midnight': {
        name: 'Midnight',
        category: 'dark',
        colors: {
            '--bg-primary': '#0f172a',
            '--bg-secondary': '#1e293b',
            '--text-primary': '#f1f5f9',
            '--text-secondary': '#b0bfd0',
            '--accent': '#3b82f6',
            '--accent-hover': '#60a5fa',
            '--accent-light': '#1e3a5f',
            '--border-color': '#334155',
            '--success': '#22c55e',
            '--warning': '#f59e0b',
            '--danger': '#ef4444'
        }
    },
    'dark-dracula': {
        name: 'Dracula',
        category: 'dark',
        colors: {
            '--bg-primary': '#282a36',
            '--bg-secondary': '#44475a',
            '--text-primary': '#f8f8f2',
            '--text-secondary': '#b0b8d0',
            '--accent': '#bd93f9',
            '--accent-hover': '#ff79c6',
            '--accent-light': '#44475a',
            '--border-color': '#6272a4',
            '--success': '#50fa7b',
            '--warning': '#f1fa8c',
            '--danger': '#ff5555'
        }
    },
    'dark-nord': {
        name: 'Nord',
        category: 'dark',
        colors: {
            '--bg-primary': '#2e3440',
            '--bg-secondary': '#3b4252',
            '--text-primary': '#eceff4',
            '--text-secondary': '#c8ced9',
            '--accent': '#88c0d0',
            '--accent-hover': '#8fbcbb',
            '--accent-light': '#434c5e',
            '--border-color': '#4c566a',
            '--success': '#a3be8c',
            '--warning': '#ebcb8b',
            '--danger': '#bf616a'
        }
    },
    'dark-monokai': {
        name: 'Monokai',
        category: 'dark',
        colors: {
            '--bg-primary': '#272822',
            '--bg-secondary': '#3e3d32',
            '--text-primary': '#f8f8f2',
            '--text-secondary': '#c6c6a0',
            '--accent': '#a6e22e',
            '--accent-hover': '#f92672',
            '--accent-light': '#3e3d32',
            '--border-color': '#75715e',
            '--success': '#a6e22e',
            '--warning': '#e6db74',
            '--danger': '#f92672'
        }
    },
    'dark-coffee': {
        name: 'Coffee',
        category: 'dark',
        colors: {
            '--bg-primary': '#1c1410',
            '--bg-secondary': '#2c2218',
            '--text-primary': '#f0e0d4',
            '--text-secondary': '#d0b4a0',
            '--accent': '#d4915e',
            '--accent-hover': '#e8a06c',
            '--accent-light': '#3c2e22',
            '--border-color': '#4a3c2e',
            '--success': '#7cb36a',
            '--warning': '#e8c468',
            '--danger': '#d46060'
        }
    }
};

// State
let currentTheme = 'light-default';
let themesInitialized = false;

// ============ LOAD/SAVE ============

function loadTheme() {
    try {
        const saved = localStorage.getItem(THEMES_KEY);
        if (saved && THEMES[saved]) {
            currentTheme = saved;
        } else {
            // Detect system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                currentTheme = 'dark-default';
            }
        }
    } catch (e) {
        console.error('Error loading theme:', e);
    }
}

function saveTheme() {
    localStorage.setItem(THEMES_KEY, currentTheme);
}

// ============ THEME APPLICATION ============

function applyTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;

    currentTheme = themeId;

    // Apply CSS variables
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });

    // Map theme colors to main.css variables
    const isDark = theme.category === 'dark';
    root.style.setProperty('--bg', theme.colors['--bg-primary']);
    root.style.setProperty('--bg-secondary', theme.colors['--bg-secondary']);
    root.style.setProperty('--panel', theme.colors['--bg-secondary']);
    root.style.setProperty('--panel-hover', isDark ? lighten(theme.colors['--bg-secondary'], 10) : darken(theme.colors['--bg-secondary'], 5));
    root.style.setProperty('--text', theme.colors['--text-primary']);
    root.style.setProperty('--text-secondary', theme.colors['--text-secondary']);
    root.style.setProperty('--text-muted', theme.colors['--text-secondary']);
    root.style.setProperty('--border', theme.colors['--border-color']);
    root.style.setProperty('--border-light', theme.colors['--border-color']);
    root.style.setProperty('--accent-bg', theme.colors['--accent-light']);

    // Apply background color directly to body and html
    document.body.style.backgroundColor = theme.colors['--bg-primary'];
    document.documentElement.style.backgroundColor = theme.colors['--bg-primary'];

    // Update body class for category-specific styles
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme.category}`);

    // Save preference
    saveTheme();

    // Update UI
    updateThemeUI();
}

// Helper to lighten a hex color
function lighten(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Helper to darken a hex color
function darken(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function toggleDarkMode() {
    const currentCategory = THEMES[currentTheme]?.category;

    if (currentCategory === 'light') {
        applyTheme('dark-default');
    } else {
        applyTheme('light-default');
    }
}

// ============ RENDER ============

function renderThemeSelector() {
    const container = document.getElementById('themeSelector');
    if (!container) return;

    const lightThemes = Object.entries(THEMES).filter(([_, t]) => t.category === 'light');
    const darkThemes = Object.entries(THEMES).filter(([_, t]) => t.category === 'dark');

    container.innerHTML = `
        <div class="theme-category">
            <h4>☀️ Light Themes</h4>
            <div class="theme-grid">
                ${lightThemes.map(([id, theme]) => renderThemeCard(id, theme)).join('')}
            </div>
        </div>
        <div class="theme-category">
            <h4>🌙 Dark Themes</h4>
            <div class="theme-grid">
                ${darkThemes.map(([id, theme]) => renderThemeCard(id, theme)).join('')}
            </div>
        </div>
    `;
}

function renderThemeCard(id, theme) {
    const isActive = id === currentTheme;

    return `
        <button class="theme-card ${isActive ? 'active' : ''}" onclick="applyTheme('${id}')">
            <div class="theme-preview" style="
                background: ${theme.colors['--bg-primary']};
                border: 2px solid ${theme.colors['--border-color']};
            ">
                <div class="theme-preview-header" style="background: ${theme.colors['--bg-secondary']}"></div>
                <div class="theme-preview-content">
                    <div class="theme-preview-text" style="background: ${theme.colors['--text-primary']}"></div>
                    <div class="theme-preview-accent" style="background: ${theme.colors['--accent']}"></div>
                </div>
            </div>
            <span class="theme-name">${theme.name}</span>
            ${isActive ? '<span class="theme-check">✓</span>' : ''}
        </button>
    `;
}

function updateThemeUI() {
    // Update theme selector
    renderThemeSelector();

    // Update dark mode toggle in settings
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.checked = THEMES[currentTheme]?.category === 'dark';
    }
}

// ============ SYSTEM PREFERENCE LISTENER ============

function setupSystemPreferenceListener() {
    if (!window.matchMedia) return;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    darkModeQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually selected a theme
        const saved = localStorage.getItem(THEMES_KEY);
        if (!saved) {
            applyTheme(e.matches ? 'dark-default' : 'light-default');
        }
    });
}

// ============ INITIALIZATION ============

function initThemes() {
    if (themesInitialized) {
        updateThemeUI();
        return;
    }

    loadTheme();
    applyTheme(currentTheme);
    setupSystemPreferenceListener();
    themesInitialized = true;
}

// Auto-init on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemes);
} else {
    initThemes();
}

// Make functions globally available
window.initThemes = initThemes;
window.applyTheme = applyTheme;
window.toggleDarkMode = toggleDarkMode;
window.THEMES = THEMES;
