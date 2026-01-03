console.log('sounds.js STARTING TO LOAD');
// ============ FOCUS SOUNDS - Web Audio API Based ============

// Sound definitions
const SOUNDS = [
    { id: 'rain', name: 'Rain', icon: '🌧️', type: 'rain' },
    { id: 'ocean', name: 'Ocean Waves', icon: '🌊', type: 'ocean' },
    { id: 'wind', name: 'Wind', icon: '💨', type: 'wind' },
    { id: 'fire', name: 'Fireplace', icon: '🔥', type: 'fire' },
    { id: 'white', name: 'White Noise', icon: '📻', type: 'white' },
    { id: 'pink', name: 'Pink Noise', icon: '🎀', type: 'pink' },
    { id: 'brown', name: 'Brown Noise', icon: '🟤', type: 'brown' },
    { id: 'binaural', name: 'Focus Binaural', icon: '🧠', type: 'binaural' }
];

// Sound presets
const SOUND_PRESETS = {
    nature: ['rain', 'wind'],
    ocean: ['ocean'],
    cozy: ['fire', 'brown'],
    focus: ['pink', 'binaural'],
    sleep: ['brown', 'rain']
};

const SOUNDS_KEY = 'pomodoroSoundSettings';

// Audio Context for Sounds (renamed to avoid conflict with pomodoro.js)
let soundsAudioContext = null;

// State
let soundsState = {
    activeSounds: {},
    masterVolume: 50,
    isPlaying: false,
    autoPlayDuringFocus: true
};

let soundsInitialized = false;

// ============ AUDIO CONTEXT ============

function getAudioContext() {
    if (!soundsAudioContext) {
        soundsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (soundsAudioContext.state === 'suspended') {
        soundsAudioContext.resume();
    }
    return soundsAudioContext;
}

// ============ NOISE GENERATORS ============

function createWhiteNoise(ctx) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

function createPinkNoise(ctx) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

function createBrownNoise(ctx) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

function createRainSound(ctx) {
    const bufferSize = 4 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const output = buffer.getChannelData(channel);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.1 * white)) / 1.1;
            const drop = Math.random() > 0.9997 ? (Math.random() * 0.5) : 0;
            const mod = 0.8 + 0.2 * Math.sin(i / ctx.sampleRate * 0.3);
            output[i] = (lastOut * 2 + drop) * mod;
        }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

function createOceanSound(ctx) {
    const bufferSize = 8 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const output = buffer.getChannelData(channel);
        const offset = channel * 0.3;
        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            const wave1 = Math.sin((t + offset) * 0.5) * 0.5 + 0.5;
            const wave2 = Math.sin((t + offset) * 0.23) * 0.5 + 0.5;
            const wave3 = Math.sin((t + offset) * 0.11) * 0.5 + 0.5;
            const waveEnv = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
            const noise = (Math.random() * 2 - 1) * 0.3;
            output[i] = noise * waveEnv;
        }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

function createWindSound(ctx) {
    const bufferSize = 6 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const output = buffer.getChannelData(channel);
        let lastOut = 0;
        const offset = channel * 1.7;
        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            const gust = 0.5 + 0.5 * Math.sin((t + offset) * 0.4) * Math.sin((t + offset) * 0.17);
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.05 * white)) / 1.05;
            output[i] = lastOut * 4 * gust;
        }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

function createFireSound(ctx) {
    const bufferSize = 4 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const output = buffer.getChannelData(channel);
        for (let i = 0; i < bufferSize; i++) {
            const crackle = Math.random() > 0.997 ? Math.random() * 0.8 : 0;
            const rumble = (Math.random() * 2 - 1) * 0.15;
            const mod = 0.7 + 0.3 * Math.sin(i / ctx.sampleRate * 2);
            output[i] = (rumble + crackle) * mod;
        }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
}

function createBinauralBeat(ctx) {
    const baseFreq = 200;
    const beatFreq = 14;
    const oscillatorL = ctx.createOscillator();
    const oscillatorR = ctx.createOscillator();
    oscillatorL.frequency.value = baseFreq;
    oscillatorR.frequency.value = baseFreq + beatFreq;
    oscillatorL.type = 'sine';
    oscillatorR.type = 'sine';
    const merger = ctx.createChannelMerger(2);
    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.value = 0.3;
    gainR.gain.value = 0.3;
    oscillatorL.connect(gainL);
    oscillatorR.connect(gainR);
    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 1);
    return {
        source: merger,
        oscillators: [oscillatorL, oscillatorR],
        start: function () {
            oscillatorL.start();
            oscillatorR.start();
        },
        stop: function () {
            try {
                oscillatorL.stop();
                oscillatorR.stop();
            } catch (e) { }
        }
    };
}

function createSoundSource(ctx, type) {
    switch (type) {
        case 'white': return createWhiteNoise(ctx);
        case 'pink': return createPinkNoise(ctx);
        case 'brown': return createBrownNoise(ctx);
        case 'rain': return createRainSound(ctx);
        case 'ocean': return createOceanSound(ctx);
        case 'wind': return createWindSound(ctx);
        case 'fire': return createFireSound(ctx);
        case 'binaural': return createBinauralBeat(ctx);
        default: return createWhiteNoise(ctx);
    }
}

// ============ LOAD/SAVE ============

function loadSoundSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SOUNDS_KEY) || '{}');
        soundsState.masterVolume = saved.masterVolume ?? 50;
        soundsState.autoPlayDuringFocus = saved.autoPlayDuringFocus ?? true;
    } catch (e) {
        console.error('Error loading sound settings:', e);
    }
}

function saveSoundSettings() {
    const config = {
        masterVolume: soundsState.masterVolume,
        autoPlayDuringFocus: soundsState.autoPlayDuringFocus,
        activeSoundsConfig: Object.entries(soundsState.activeSounds).map(([id, data]) => ({
            id,
            volume: data.volume
        }))
    };
    localStorage.setItem(SOUNDS_KEY, JSON.stringify(config));
}

// ============ SOUND CONTROL ============

function toggleSound(soundId) {
    console.log('toggleSound called:', soundId);
    if (soundsState.activeSounds[soundId]) {
        stopSound(soundId);
    } else {
        playSound(soundId);
    }
    renderSoundsPanel();
    saveSoundSettings();
}

function playSound(soundId, volume = 50) {
    const sound = SOUNDS.find(s => s.id === soundId);
    if (!sound) {
        console.error('Sound not found:', soundId);
        return;
    }

    console.log('Playing sound:', soundId);

    if (soundsState.activeSounds[soundId]) {
        stopSound(soundId);
    }

    try {
        const ctx = getAudioContext();
        const gainNode = ctx.createGain();
        const calculatedVolume = (volume / 100) * (soundsState.masterVolume / 100);
        gainNode.gain.value = calculatedVolume;
        gainNode.connect(ctx.destination);

        const soundData = createSoundSource(ctx, sound.type);

        if (sound.type === 'binaural') {
            soundData.source.connect(gainNode);
            soundData.start();
            soundsState.activeSounds[soundId] = {
                gainNode,
                volume,
                binaural: soundData
            };
        } else {
            soundData.connect(gainNode);
            soundData.start();
            soundsState.activeSounds[soundId] = {
                source: soundData,
                gainNode,
                volume
            };
        }

        soundsState.isPlaying = Object.keys(soundsState.activeSounds).length > 0;
        console.log('Sound started successfully:', soundId);

    } catch (e) {
        console.error('Error playing sound:', e);
    }
}

function stopSound(soundId) {
    if (soundsState.activeSounds[soundId]) {
        const soundData = soundsState.activeSounds[soundId];
        try {
            if (soundData.binaural) {
                soundData.binaural.stop();
            } else if (soundData.source) {
                soundData.source.stop();
            }
            soundData.gainNode.disconnect();
        } catch (e) { }
        delete soundsState.activeSounds[soundId];
    }
    soundsState.isPlaying = Object.keys(soundsState.activeSounds).length > 0;
}

function setSoundVolume(soundId, volume) {
    if (soundsState.activeSounds[soundId]) {
        soundsState.activeSounds[soundId].volume = volume;
        const calculatedVolume = (volume / 100) * (soundsState.masterVolume / 100);
        soundsState.activeSounds[soundId].gainNode.gain.value = calculatedVolume;
        saveSoundSettings();
    }
}

function setMasterVolume(volume) {
    soundsState.masterVolume = volume;
    Object.entries(soundsState.activeSounds).forEach(([id, data]) => {
        const calculatedVolume = (data.volume / 100) * (volume / 100);
        data.gainNode.gain.value = calculatedVolume;
    });
    saveSoundSettings();

    const masterValue = document.getElementById('masterVolumeValue');
    if (masterValue) masterValue.textContent = `${volume}%`;
}

function stopAllSounds() {
    Object.keys(soundsState.activeSounds).forEach(stopSound);
    soundsState.isPlaying = false;
    renderSoundsPanel();
}

function pauseAllSounds() {
    Object.values(soundsState.activeSounds).forEach(data => {
        data.gainNode.gain.value = 0;
    });
}

function resumeAllSounds() {
    Object.entries(soundsState.activeSounds).forEach(([id, data]) => {
        const calculatedVolume = (data.volume / 100) * (soundsState.masterVolume / 100);
        data.gainNode.gain.value = calculatedVolume;
    });
}

// ============ PRESETS ============

function applyPreset(presetName) {
    console.log('applyPreset called:', presetName);
    const preset = SOUND_PRESETS[presetName];
    if (!preset) {
        console.error('Preset not found:', presetName);
        return;
    }

    stopAllSounds();

    preset.forEach(soundId => {
        playSound(soundId, 50);
    });

    renderSoundsPanel();
    saveSoundSettings();
}

// ============ FOCUS INTEGRATION ============

function handleFocusStart() {
    if (soundsState.autoPlayDuringFocus && Object.keys(soundsState.activeSounds).length > 0) {
        resumeAllSounds();
    }
}

function handleFocusEnd() {
    if (soundsState.autoPlayDuringFocus) {
        pauseAllSounds();
    }
}

// ============ RENDER ============

function renderSoundsPanel() {
    const container = document.getElementById('soundsGrid');
    if (!container) {
        console.log('soundsGrid container not found');
        return;
    }

    console.log('Rendering sounds panel with', SOUNDS.length, 'sounds');

    container.innerHTML = SOUNDS.map(sound => {
        const isActive = !!soundsState.activeSounds[sound.id];
        const volume = isActive ? soundsState.activeSounds[sound.id].volume : 50;

        return `
            <div class="sound-card ${isActive ? 'active' : ''}" data-sound-id="${sound.id}">
                <button class="sound-toggle" onclick="window.toggleSound('${sound.id}')">
                    <span class="sound-icon">${sound.icon}</span>
                    <span class="sound-name">${sound.name}</span>
                    <span class="sound-status">${isActive ? '🔊' : '🔇'}</span>
                </button>
                ${isActive ? `
                    <div class="sound-volume">
                        <input type="range" min="0" max="100" value="${volume}" 
                               class="volume-slider" 
                               oninput="window.setSoundVolume('${sound.id}', this.value)">
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function updateMiniPlayer() {
    const miniPlayer = document.getElementById('soundsMiniPlayer');
    if (!miniPlayer) return;

    const activeCount = Object.keys(soundsState.activeSounds).length;

    if (activeCount === 0) {
        miniPlayer.classList.add('hidden');
    } else {
        miniPlayer.classList.remove('hidden');
        const activeSoundNames = Object.keys(soundsState.activeSounds)
            .map(id => SOUNDS.find(s => s.id === id)?.icon || '')
            .join(' ');

        const label = miniPlayer.querySelector('.mini-player-label');
        if (label) label.textContent = activeSoundNames;
    }
}

// ============ EVENT LISTENERS ============

function initSoundsListeners() {
    const masterSlider = document.getElementById('masterVolumeSlider');
    if (masterSlider) {
        masterSlider.addEventListener('input', (e) => {
            setMasterVolume(parseInt(e.target.value));
        });
    }

    const autoPlayCheckbox = document.getElementById('autoPlaySounds');
    if (autoPlayCheckbox) {
        autoPlayCheckbox.addEventListener('change', (e) => {
            soundsState.autoPlayDuringFocus = e.target.checked;
            saveSoundSettings();
        });
    }

    const stopAllBtn = document.getElementById('stopAllSounds');
    if (stopAllBtn) {
        stopAllBtn.addEventListener('click', stopAllSounds);
    }

    const miniStopBtn = document.getElementById('miniPlayerStop');
    if (miniStopBtn) {
        miniStopBtn.addEventListener('click', stopAllSounds);
    }
}

// ============ INITIALIZATION ============

function initSounds() {
    console.log('initSounds called');

    if (soundsInitialized) {
        renderSoundsPanel();
        return;
    }

    loadSoundSettings();
    renderSoundsPanel();
    initSoundsListeners();
    soundsInitialized = true;

    console.log('Sounds initialized successfully');
}

// ============ GLOBAL EXPORTS ============
// Export all functions to window IMMEDIATELY so they're available for onclick handlers

(function () {
    window.initSounds = initSounds;
    window.toggleSound = toggleSound;
    window.playSound = playSound;
    window.stopSound = stopSound;
    window.setSoundVolume = setSoundVolume;
    window.setMasterVolume = setMasterVolume;
    window.stopAllSounds = stopAllSounds;
    window.applyPreset = applyPreset;
    window.handleFocusStart = handleFocusStart;
    window.handleFocusEnd = handleFocusEnd;
    window.renderSoundsPanel = renderSoundsPanel;
    console.log('sounds.js: Global exports complete, applyPreset:', typeof window.applyPreset);
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - checking for soundsGrid');
    const soundsGrid = document.getElementById('soundsGrid');
    if (soundsGrid) {
        console.log('soundsGrid found, rendering...');
        renderSoundsPanel();
    }
});

console.log('sounds.js fully loaded');
