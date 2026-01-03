// ============ NOTES/JOURNAL APP ============

const NOTES_KEY = 'pomodoroNotes';
const JOURNAL_KEY = 'pomodoroJournal';

// State
let notes = [];
let journalEntries = [];
let currentNoteId = null;
let notesInitialized = false;
let currentView = 'notes'; // 'notes' or 'journal'

// Mood options
const MOODS = [
    { id: 'great', emoji: '😄', label: 'Great', color: '#22c55e' },
    { id: 'good', emoji: '🙂', label: 'Good', color: '#84cc16' },
    { id: 'okay', emoji: '😐', label: 'Okay', color: '#f59e0b' },
    { id: 'bad', emoji: '😕', label: 'Bad', color: '#f97316' },
    { id: 'terrible', emoji: '😢', label: 'Terrible', color: '#ef4444' }
];

// ============ LOAD/SAVE ============

function loadNotes() {
    try {
        notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
        journalEntries = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
    } catch (e) {
        console.error('Error loading notes:', e);
        notes = [];
        journalEntries = [];
    }
}

function saveNotes() {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function saveJournal() {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(journalEntries));
}

// ============ NOTES CRUD ============

function createNote(title = 'Untitled Note', content = '') {
    const note = {
        id: Date.now().toString(),
        title,
        content,
        color: '#ffffff',
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    notes.unshift(note);
    saveNotes();
    renderNotesList();
    return note;
}

function updateNote(id, updates) {
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) {
        notes[index] = { ...notes[index], ...updates, updatedAt: new Date().toISOString() };
        saveNotes();
        renderNotesList();
    }
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    if (currentNoteId === id) {
        currentNoteId = null;
        closeNoteEditor();
    }
    renderNotesList();
}

function togglePinNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.pinned = !note.pinned;
        saveNotes();
        renderNotesList();
    }
}

// ============ JOURNAL CRUD ============

function createJournalEntry(mood, content, tags = []) {
    const entry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        mood,
        content,
        tags,
        productivityScore: calculateDayProductivity()
    };
    journalEntries.unshift(entry);
    saveJournal();
    renderJournalList();
    return entry;
}

function updateJournalEntry(id, updates) {
    const index = journalEntries.findIndex(e => e.id === id);
    if (index !== -1) {
        journalEntries[index] = { ...journalEntries[index], ...updates };
        saveJournal();
        renderJournalList();
    }
}

function deleteJournalEntry(id) {
    journalEntries = journalEntries.filter(e => e.id !== id);
    saveJournal();
    renderJournalList();
}

function calculateDayProductivity() {
    try {
        const dailyStats = JSON.parse(localStorage.getItem('pomodoroDailyStats') || '{}');
        const today = new Date().toDateString();
        if (dailyStats.date === today) {
            const goal = dailyStats.dailyGoal || 120;
            return Math.min(100, Math.round((dailyStats.minutesToday / goal) * 100));
        }
    } catch (e) { }
    return 0;
}

// ============ RENDER FUNCTIONS ============

function renderNotesApp() {
    if (currentView === 'notes') {
        renderNotesList();
    } else {
        renderJournalList();
    }
}

function renderNotesList() {
    const container = document.getElementById('notesList');
    if (!container) return;

    // Sort: pinned first, then by updatedAt
    const sortedNotes = [...notes].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    if (sortedNotes.length === 0) {
        container.innerHTML = `
            <div class="notes-empty">
                <div class="empty-icon">📝</div>
                <h3>No notes yet</h3>
                <p>Create your first note to get started</p>
                <button class="add-note-btn" onclick="createAndOpenNote()">+ New Note</button>
            </div>
        `;
        return;
    }

    container.innerHTML = sortedNotes.map(note => {
        const preview = note.content.substring(0, 100).replace(/<[^>]*>/g, '');
        const date = new Date(note.updatedAt).toLocaleDateString();

        return `
            <div class="note-card ${currentNoteId === note.id ? 'active' : ''}" 
                 style="border-left-color: ${note.color}"
                 onclick="openNoteEditor('${note.id}')">
                <div class="note-card-header">
                    <span class="note-title">${escapeHTML(note.title)}</span>
                    ${note.pinned ? '<span class="note-pin">📌</span>' : ''}
                </div>
                <div class="note-preview">${preview || 'Empty note'}</div>
                <div class="note-card-footer">
                    <span class="note-date">${date}</span>
                    <div class="note-actions">
                        <button class="note-action-btn" onclick="event.stopPropagation(); togglePinNote('${note.id}')" title="${note.pinned ? 'Unpin' : 'Pin'}">
                            ${note.pinned ? '📌' : '📍'}
                        </button>
                        <button class="note-action-btn delete" onclick="event.stopPropagation(); confirmDeleteNote('${note.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderJournalList() {
    const container = document.getElementById('journalList');
    if (!container) return;

    // Group by date
    const grouped = {};
    journalEntries.forEach(entry => {
        const dateKey = new Date(entry.date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
    });

    if (Object.keys(grouped).length === 0) {
        container.innerHTML = `
            <div class="notes-empty">
                <div class="empty-icon">📓</div>
                <h3>No journal entries</h3>
                <p>Start journaling to track your thoughts and mood</p>
                <button class="add-note-btn" onclick="openJournalModal()">+ New Entry</button>
            </div>
        `;
        return;
    }

    container.innerHTML = Object.entries(grouped).map(([date, entries]) => `
        <div class="journal-date-group">
            <div class="journal-date-header">${date}</div>
            ${entries.map(entry => {
        const mood = MOODS.find(m => m.id === entry.mood) || MOODS[2];
        return `
                    <div class="journal-entry-card">
                        <div class="journal-entry-header">
                            <div class="journal-mood" style="background: ${mood.color}20; color: ${mood.color}">
                                <span class="mood-emoji">${mood.emoji}</span>
                                <span class="mood-label">${mood.label}</span>
                            </div>
                            <div class="journal-productivity">
                                <span class="productivity-value">${entry.productivityScore}%</span>
                                <span class="productivity-label">Productive</span>
                            </div>
                        </div>
                        <div class="journal-content">${escapeHTML(entry.content)}</div>
                        ${entry.tags.length > 0 ? `
                            <div class="journal-tags">
                                ${entry.tags.map(tag => `<span class="journal-tag">#${tag}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="journal-entry-footer">
                            <span class="journal-time">${new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <button class="note-action-btn delete" onclick="confirmDeleteJournal('${entry.id}')">🗑️</button>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `).join('');
}

// ============ MODAL FUNCTIONS ============

function createAndOpenNote() {
    const note = createNote();
    openNoteEditor(note.id);
}

function openNoteEditor(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    currentNoteId = noteId;

    const editor = document.getElementById('noteEditor');
    const titleInput = document.getElementById('noteEditorTitle');
    const contentInput = document.getElementById('noteEditorContent');

    if (editor) editor.classList.add('active');
    if (titleInput) titleInput.value = note.title;
    if (contentInput) contentInput.value = note.content;

    renderNotesList();
}

function closeNoteEditor() {
    const editor = document.getElementById('noteEditor');
    if (editor) editor.classList.remove('active');
    currentNoteId = null;
    renderNotesList();
}

function saveCurrentNote() {
    if (!currentNoteId) return;

    const titleInput = document.getElementById('noteEditorTitle');
    const contentInput = document.getElementById('noteEditorContent');

    updateNote(currentNoteId, {
        title: titleInput?.value || 'Untitled',
        content: contentInput?.value || ''
    });
}

function openJournalModal() {
    const modal = document.getElementById('journalModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Reset form
        document.querySelectorAll('.mood-option').forEach(el => el.classList.remove('selected'));
        document.querySelector('.mood-option[data-mood="okay"]')?.classList.add('selected');
        document.getElementById('journalContent').value = '';
        document.getElementById('journalTags').value = '';
    }
}

function closeJournalModal() {
    const modal = document.getElementById('journalModal');
    if (modal) modal.classList.add('hidden');
}

function submitJournalEntry() {
    const selectedMood = document.querySelector('.mood-option.selected')?.dataset.mood || 'okay';
    const content = document.getElementById('journalContent')?.value.trim();
    const tagsInput = document.getElementById('journalTags')?.value || '';
    const tags = tagsInput.split(',').map(t => t.trim().replace('#', '')).filter(t => t);

    if (!content) {
        alert('Please write something for your journal entry.');
        return;
    }

    createJournalEntry(selectedMood, content, tags);
    closeJournalModal();
}

function confirmDeleteNote(id) {
    if (confirm('Delete this note? This cannot be undone.')) {
        deleteNote(id);
    }
}

function confirmDeleteJournal(id) {
    if (confirm('Delete this journal entry? This cannot be undone.')) {
        deleteJournalEntry(id);
    }
}

// ============ VIEW SWITCHING ============

function switchNotesView(view) {
    currentView = view;

    document.querySelectorAll('.notes-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    document.getElementById('notesSection').style.display = view === 'notes' ? 'grid' : 'none';
    document.getElementById('journalSection').style.display = view === 'journal' ? 'block' : 'none';

    // Toggle buttons
    const newNoteBtn = document.getElementById('newNoteBtn');
    const newJournalBtn = document.getElementById('newJournalBtn');
    if (newNoteBtn) newNoteBtn.style.display = view === 'notes' ? '' : 'none';
    if (newJournalBtn) newJournalBtn.style.display = view === 'journal' ? '' : 'none';

    renderNotesApp();
}

// ============ UTILITY ============

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ============ EVENT LISTENERS ============

function initNotesListeners() {
    // View toggle buttons
    document.querySelectorAll('.notes-view-btn').forEach(btn => {
        btn.addEventListener('click', () => switchNotesView(btn.dataset.view));
    });

    // Note editor auto-save
    const titleInput = document.getElementById('noteEditorTitle');
    const contentInput = document.getElementById('noteEditorContent');

    let saveTimeout;
    const autoSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveCurrentNote, 500);
    };

    if (titleInput) titleInput.addEventListener('input', autoSave);
    if (contentInput) contentInput.addEventListener('input', autoSave);

    // Close editor button
    const closeBtn = document.getElementById('closeNoteEditor');
    if (closeBtn) closeBtn.addEventListener('click', closeNoteEditor);

    // New note button
    const newNoteBtn = document.getElementById('newNoteBtn');
    if (newNoteBtn) newNoteBtn.addEventListener('click', createAndOpenNote);

    // New journal button
    const newJournalBtn = document.getElementById('newJournalBtn');
    if (newJournalBtn) newJournalBtn.addEventListener('click', openJournalModal);

    // Journal modal
    const closeJournalBtn = document.getElementById('closeJournalModal');
    if (closeJournalBtn) closeJournalBtn.addEventListener('click', closeJournalModal);

    const cancelJournalBtn = document.getElementById('cancelJournalBtn');
    if (cancelJournalBtn) cancelJournalBtn.addEventListener('click', closeJournalModal);

    const submitJournalBtn = document.getElementById('submitJournalBtn');
    if (submitJournalBtn) submitJournalBtn.addEventListener('click', submitJournalEntry);

    // Mood selection
    document.querySelectorAll('.mood-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mood-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
}

// ============ INITIALIZATION ============

function initNotes() {
    if (notesInitialized) {
        renderNotesApp();
        return;
    }

    loadNotes();
    initNotesListeners();
    renderNotesApp();
    notesInitialized = true;
}

// Make functions globally available
window.initNotes = initNotes;
window.createAndOpenNote = createAndOpenNote;
window.openNoteEditor = openNoteEditor;
window.closeNoteEditor = closeNoteEditor;
window.togglePinNote = togglePinNote;
window.confirmDeleteNote = confirmDeleteNote;
window.confirmDeleteJournal = confirmDeleteJournal;
window.openJournalModal = openJournalModal;
window.closeJournalModal = closeJournalModal;
window.submitJournalEntry = submitJournalEntry;
window.switchNotesView = switchNotesView;
