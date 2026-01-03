// ============ CANVAS / WHITEBOARD APP ============

// Canvas State
let fabricCanvas = null;
let currentCanvasId = null;
let canvases = [];
let currentTool = 'select';
let currentColor = '#1e293b';
let currentStrokeWidth = 2;
let isPanning = false;
let lastPosX, lastPosY;
let zoomLevel = 1;
let saveTimeout = null;
let widgets = [];
let canvasInitialized = false;
let toolbarEventsInitialized = false;

// Firebase sync state for canvas
let canvasesUnsubscribe = null;
let currentCanvasUnsubscribe = null;
let isSyncingCanvas = false;
let isSaving = false;
let pendingSave = false;

// DOM Elements - will be initialized after DOM loads
let canvasContainer;
let canvasDropdown;
let zoomLevelDisplay;

// ============ INITIALIZATION ============

function initCanvas() {
    // Prevent double initialization
    if (canvasInitialized) return;

    canvasContainer = document.getElementById('canvasContainer');
    canvasDropdown = document.getElementById('canvasDropdown');
    zoomLevelDisplay = document.getElementById('zoomLevel');

    if (!canvasContainer) return;

    // Create Fabric.js canvas
    const canvasEl = document.getElementById('mainCanvas');
    if (!canvasEl) return;

    // Set canvas size
    resizeCanvas();

    // Initialize Fabric.js
    fabricCanvas = new fabric.Canvas('mainCanvas', {
        isDrawingMode: false,
        selection: true,
        backgroundColor: '#f8f9fa',
        width: canvasContainer.clientWidth,
        height: canvasContainer.clientHeight
    });

    // Set up event listeners
    setupCanvasEvents();
    setupToolbarEvents();
    setupKeyboardShortcuts();

    // Load canvases from database
    loadCanvases();

    // Handle window resize
    window.addEventListener('resize', debounce(resizeCanvas, 250));

    canvasInitialized = true;
}

function resizeCanvas() {
    if (!canvasContainer) return;

    // Get the actual container dimensions
    const containerWidth = window.innerWidth - 500;
    console.log('Resizing canvas to width:', containerWidth);
    const containerHeight = canvasContainer.offsetHeight || canvasContainer.clientHeight || window.innerHeight - 70;

    if (fabricCanvas) {
        fabricCanvas.setWidth(containerWidth);
        fabricCanvas.setHeight(containerHeight);
        fabricCanvas.renderAll();
    }
}

// ============ CANVAS EVENTS ============

function setupCanvasEvents() {
    // Object modified - mark as unsaved
    fabricCanvas.on('object:modified', () => {
        markUnsaved();
    });

    fabricCanvas.on('object:added', () => {
        if (!fabricCanvas._isLoading) {
            markUnsaved();
        }
    });

    fabricCanvas.on('object:removed', () => {
        markUnsaved();
    });

    // Drawing events
    fabricCanvas.on('path:created', (e) => {
        // Apply eraser composite operation to eraser strokes
        if (currentTool === 'eraser' && e.path) {
            e.path.globalCompositeOperation = 'destination-out';
            e.path.stroke = '#000000';
            fabricCanvas.renderAll();
        }
        markUnsaved();
    });

    // Mouse wheel for zoom
    fabricCanvas.on('mouse:wheel', function (opt) {
        const delta = opt.e.deltaY;
        let zoom = fabricCanvas.getZoom();
        zoom *= 0.999 ** delta;
        zoom = Math.min(Math.max(0.1, zoom), 5);

        fabricCanvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        zoomLevel = zoom;
        updateZoomDisplay();

        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    // Panning
    fabricCanvas.on('mouse:down', function (opt) {
        if (currentTool === 'pan' || opt.e.altKey) {
            isPanning = true;
            fabricCanvas.selection = false;
            lastPosX = opt.e.clientX;
            lastPosY = opt.e.clientY;
            canvasContainer.classList.add('grabbing');
        }
    });

    fabricCanvas.on('mouse:move', function (opt) {
        if (isPanning) {
            const vpt = fabricCanvas.viewportTransform;
            vpt[4] += opt.e.clientX - lastPosX;
            vpt[5] += opt.e.clientY - lastPosY;
            fabricCanvas.requestRenderAll();
            lastPosX = opt.e.clientX;
            lastPosY = opt.e.clientY;
        }
    });

    fabricCanvas.on('mouse:up', function () {
        isPanning = false;
        fabricCanvas.selection = currentTool === 'select';
        canvasContainer.classList.remove('grabbing');
    });
}

// ============ TOOLBAR EVENTS ============

function setupToolbarEvents() {
    // Prevent duplicate event listeners
    if (toolbarEventsInitialized) return;
    toolbarEventsInitialized = true;

    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            setTool(btn.dataset.tool);
        });
    });

    // Color picker
    const colorInput = document.getElementById('brushColor');
    const colorPreview = document.getElementById('colorPreview');

    if (colorInput && colorPreview) {
        colorInput.addEventListener('change', (e) => {
            currentColor = e.target.value;
            colorPreview.style.backgroundColor = currentColor;
            if (fabricCanvas && fabricCanvas.isDrawingMode) {
                fabricCanvas.freeDrawingBrush.color = currentColor;
            }
        });
    }

    // Stroke width
    const strokeInput = document.getElementById('strokeWidth');
    if (strokeInput) {
        strokeInput.addEventListener('change', (e) => {
            currentStrokeWidth = parseInt(e.target.value) || 2;
            if (fabricCanvas && fabricCanvas.isDrawingMode) {
                // Apply zoom-adjusted stroke width
                fabricCanvas.freeDrawingBrush.width = getZoomAdjustedSize(currentStrokeWidth);
            }
        });
    }

    // Zoom controls
    document.getElementById('zoomIn')?.addEventListener('click', () => {
        zoomLevel = Math.min(zoomLevel * 1.2, 5);
        fabricCanvas.setZoom(zoomLevel);
        updateZoomDisplay();
    });

    document.getElementById('zoomOut')?.addEventListener('click', () => {
        zoomLevel = Math.max(zoomLevel / 1.2, 0.1);
        fabricCanvas.setZoom(zoomLevel);
        updateZoomDisplay();
    });

    document.getElementById('zoomReset')?.addEventListener('click', () => {
        zoomLevel = 1;
        fabricCanvas.setZoom(1);
        fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        updateZoomDisplay();
    });

    // Canvas actions
    document.getElementById('saveCanvasBtn')?.addEventListener('click', () => {
        manualSave();
    });

    document.getElementById('newCanvasBtn')?.addEventListener('click', () => {
        openNewCanvasModal();
    });

    document.getElementById('deleteCanvasBtn')?.addEventListener('click', () => {
        deleteCurrentCanvas();
    });

    document.getElementById('clearCanvasBtn')?.addEventListener('click', () => {
        clearCanvas();
    });

    // Fullscreen button
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn && !fullscreenBtn.hasAttribute('data-listener')) {
        fullscreenBtn.setAttribute('data-listener', 'true');
        fullscreenBtn.addEventListener('click', () => {
            toggleFullscreen();
        });
    }

    // Canvas dropdown
    canvasDropdown?.addEventListener('change', (e) => {
        loadCanvas(e.target.value);
    });

    // Add widgets - only add once
    const addTimerBtn = document.getElementById('addTimerWidget');
    if (addTimerBtn && !addTimerBtn.hasAttribute('data-listener')) {
        addTimerBtn.setAttribute('data-listener', 'true');
        addTimerBtn.addEventListener('click', () => {
            addTimerWidget();
        });
    }

    const addCounterBtn = document.getElementById('addCounterWidget');
    if (addCounterBtn && !addCounterBtn.hasAttribute('data-listener')) {
        addCounterBtn.setAttribute('data-listener', 'true');
        addCounterBtn.addEventListener('click', () => {
            addCounterWidget();
        });
    }

    const addStickyBtn = document.getElementById('addStickyNote');
    if (addStickyBtn && !addStickyBtn.hasAttribute('data-listener')) {
        addStickyBtn.setAttribute('data-listener', 'true');
        addStickyBtn.addEventListener('click', () => {
            addStickyNote();
        });
    }

    // Add image - reset input after each upload to allow same file
    const addImageBtn = document.getElementById('addImageBtn');
    const imageUpload = document.getElementById('imageUpload');

    if (addImageBtn && !addImageBtn.hasAttribute('data-listener')) {
        addImageBtn.setAttribute('data-listener', 'true');
        addImageBtn.addEventListener('click', () => {
            imageUpload?.click();
        });
    }

    if (imageUpload && !imageUpload.hasAttribute('data-listener')) {
        imageUpload.setAttribute('data-listener', 'true');
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                addImageToCanvas(file);
                // Reset input to allow uploading same file again
                e.target.value = '';
            }
        });
    }

    // Shape buttons
    document.querySelectorAll('.shape-btn[data-shape]').forEach(btn => {
        if (!btn.hasAttribute('data-listener')) {
            btn.setAttribute('data-listener', 'true');
            btn.addEventListener('click', () => {
                addShape(btn.dataset.shape);
            });
        }
    });
}

// ============ TOOL MANAGEMENT ============

function setTool(tool) {
    currentTool = tool;

    // Update UI
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Configure canvas based on tool
    switch (tool) {
        case 'select':
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = true;
            canvasContainer.style.cursor = 'default';
            break;

        case 'draw':
            fabricCanvas.isDrawingMode = true;
            // Reset to normal drawing brush
            if (!fabricCanvas.drawingBrush) {
                fabricCanvas.drawingBrush = new fabric.PencilBrush(fabricCanvas);
            }
            fabricCanvas.freeDrawingBrush = fabricCanvas.drawingBrush;
            fabricCanvas.freeDrawingBrush.color = currentColor;
            // Adjust brush width for zoom so strokes appear consistent
            fabricCanvas.freeDrawingBrush.width = getZoomAdjustedSize(currentStrokeWidth);
            fabricCanvas.freeDrawingBrush.globalCompositeOperation = 'source-over';
            canvasContainer.style.cursor = 'crosshair';
            break;

        case 'eraser':
            fabricCanvas.isDrawingMode = true;
            // Create eraser brush that uses destination-out compositing
            if (!fabricCanvas.eraserBrush) {
                fabricCanvas.eraserBrush = new fabric.PencilBrush(fabricCanvas);
            }
            fabricCanvas.freeDrawingBrush = fabricCanvas.eraserBrush;
            fabricCanvas.freeDrawingBrush.color = '#ffffff';
            fabricCanvas.freeDrawingBrush.width = getZoomAdjustedSize(currentStrokeWidth * 3);
            // Set global composite for true erasing
            fabricCanvas.freeDrawingBrush.globalCompositeOperation = 'destination-out';
            canvasContainer.style.cursor = 'crosshair';
            break;

        case 'pan':
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = false;
            canvasContainer.classList.add('grab');
            break;

        case 'text':
            fabricCanvas.isDrawingMode = false;
            fabricCanvas.selection = true;
            canvasContainer.style.cursor = 'text';
            addTextBox();
            break;

        default:
            fabricCanvas.isDrawingMode = false;
    }

    if (tool !== 'pan') {
        canvasContainer.classList.remove('grab');
    }
}

// ============ SHAPE & OBJECT FUNCTIONS ============

// Get the center of the visible viewport (accounting for zoom and pan)
function getViewportCenter() {
    const zoom = fabricCanvas.getZoom();
    const vpt = fabricCanvas.viewportTransform;
    const canvasWidth = fabricCanvas.getWidth();
    const canvasHeight = fabricCanvas.getHeight();

    // Calculate the center point in canvas coordinates
    const centerX = (-vpt[4] + canvasWidth / 2) / zoom;
    const centerY = (-vpt[5] + canvasHeight / 2) / zoom;

    return { x: centerX, y: centerY };
}

// Get size adjusted for current zoom (so objects appear same visual size)
function getZoomAdjustedSize(baseSize) {
    const zoom = fabricCanvas.getZoom();
    return baseSize / zoom;
}

function addShape(shape) {
    let object;
    const center = getViewportCenter();
    const zoom = fabricCanvas.getZoom();

    // Adjust sizes based on zoom so objects appear consistent visual size
    const baseSize = 100;
    const size = getZoomAdjustedSize(baseSize);
    const strokeWidth = getZoomAdjustedSize(currentStrokeWidth);

    switch (shape) {
        case 'rect':
            object = new fabric.Rect({
                left: center.x - size / 2,
                top: center.y - size / 2,
                fill: 'transparent',
                stroke: currentColor,
                strokeWidth: strokeWidth,
                width: size,
                height: size
            });
            break;

        case 'circle':
            object = new fabric.Circle({
                left: center.x - size / 2,
                top: center.y - size / 2,
                fill: 'transparent',
                stroke: currentColor,
                strokeWidth: strokeWidth,
                radius: size / 2
            });
            break;

        case 'line':
            object = new fabric.Line([center.x - size / 2, center.y, center.x + size / 2, center.y], {
                stroke: currentColor,
                strokeWidth: strokeWidth
            });
            break;

        case 'arrow':
            // Create arrow using path - scale the path based on zoom
            const arrowScale = size / 100;
            const arrowPath = `M 0 0 L ${size} 0 L ${size - 10 * arrowScale} ${-10 * arrowScale} M ${size} 0 L ${size - 10 * arrowScale} ${10 * arrowScale}`;
            object = new fabric.Path(arrowPath, {
                left: center.x - size / 2,
                top: center.y,
                fill: 'transparent',
                stroke: currentColor,
                strokeWidth: strokeWidth
            });
            break;
    }

    if (object) {
        fabricCanvas.add(object);
        fabricCanvas.setActiveObject(object);
        setTool('select');
    }
}

function addTextBox() {
    const center = getViewportCenter();
    const fontSize = getZoomAdjustedSize(24); // Base font size 24px

    const text = new fabric.IText('Click to edit', {
        left: center.x - getZoomAdjustedSize(60),
        top: center.y - getZoomAdjustedSize(15),
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: fontSize,
        fill: currentColor
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    text.enterEditing();
}

function addImageToCanvas(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        fabric.Image.fromURL(e.target.result, function (img) {
            // Scale image to fit reasonably - adjust for zoom
            const maxVisualSize = 400; // Visual size on screen
            const maxSize = getZoomAdjustedSize(maxVisualSize);

            if (img.width > maxSize || img.height > maxSize) {
                const scale = maxSize / Math.max(img.width, img.height);
                img.scale(scale);
            }

            const center = getViewportCenter();
            img.set({
                left: center.x - img.getScaledWidth() / 2,
                top: center.y - img.getScaledHeight() / 2
            });

            fabricCanvas.add(img);
            fabricCanvas.setActiveObject(img);
        });
    };
    reader.readAsDataURL(file);
}

// ============ WIDGET FUNCTIONS ============

function addTimerWidget() {
    // Position at center of visible canvas container
    const containerRect = canvasContainer.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const widgetId = 'timer-' + Date.now();

    const widget = document.createElement('div');
    widget.className = 'canvas-widget timer-widget';
    widget.id = widgetId;
    widget.style.left = (centerX - 90) + 'px';
    widget.style.top = (centerY - 60) + 'px';

    widget.innerHTML = `
        <div class="widget-header">
            <span class="widget-title">⏱️ Timer</span>
            <button class="widget-close" onclick="removeWidget('${widgetId}')">×</button>
        </div>
        <div class="timer-widget-content">
            <div class="timer-widget-display" id="${widgetId}-display">25:00</div>
            <div class="timer-widget-controls">
                <button class="timer-widget-btn start" onclick="toggleWidgetTimer('${widgetId}')">Start</button>
                <button class="timer-widget-btn reset" onclick="resetWidgetTimer('${widgetId}')">Reset</button>
            </div>
        </div>
    `;

    canvasContainer.appendChild(widget);
    makeWidgetDraggable(widget);

    widgets.push({
        id: widgetId,
        type: 'timer',
        time: 25 * 60,
        running: false,
        interval: null
    });

    markUnsaved();
}

function addCounterWidget() {
    // Position at center of visible canvas container
    const containerRect = canvasContainer.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const widgetId = 'counter-' + Date.now();

    const widget = document.createElement('div');
    widget.className = 'canvas-widget counter-widget';
    widget.id = widgetId;
    widget.style.left = (centerX - 75) + 'px';
    widget.style.top = (centerY - 60) + 'px';

    widget.innerHTML = `
        <div class="widget-header">
            <span class="widget-title">🔢 Counter</span>
            <button class="widget-close" onclick="removeWidget('${widgetId}')">×</button>
        </div>
        <div class="counter-widget-content">
            <div class="counter-widget-display" id="${widgetId}-display">0</div>
            <div class="counter-widget-controls">
                <button class="counter-btn minus" onclick="updateCounter('${widgetId}', -1)">−</button>
                <button class="counter-btn plus" onclick="updateCounter('${widgetId}', 1)">+</button>
            </div>
        </div>
    `;

    canvasContainer.appendChild(widget);
    makeWidgetDraggable(widget);

    widgets.push({
        id: widgetId,
        type: 'counter',
        value: 0
    });

    markUnsaved();
}

function addStickyNote(color = 'yellow') {
    // Position at center of visible canvas container
    const containerRect = canvasContainer.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const widgetId = 'sticky-' + Date.now();

    const widget = document.createElement('div');
    widget.className = `canvas-widget sticky-note ${color}`;
    widget.id = widgetId;
    widget.style.left = (centerX - 100) + 'px';
    widget.style.top = (centerY - 75) + 'px';

    widget.innerHTML = `
        <div class="widget-header">
            <span class="widget-title">📝 Note</span>
            <button class="widget-close" onclick="removeWidget('${widgetId}')">×</button>
        </div>
        <div class="sticky-note-content">
            <textarea class="sticky-note-textarea" placeholder="Type your note..." onchange="updateStickyNote('${widgetId}', this.value)"></textarea>
        </div>
    `;

    canvasContainer.appendChild(widget);
    makeWidgetDraggable(widget);

    widgets.push({
        id: widgetId,
        type: 'sticky',
        color: color,
        content: ''
    });

    markUnsaved();
}

function removeWidget(widgetId) {
    const widgetEl = document.getElementById(widgetId);
    if (widgetEl) {
        widgetEl.remove();
    }

    const widget = widgets.find(w => w.id === widgetId);
    if (widget && widget.interval) {
        clearInterval(widget.interval);
    }

    widgets = widgets.filter(w => w.id !== widgetId);
    markUnsaved();
}

function makeWidgetDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    const header = element.querySelector('.widget-header');

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.widget-close')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = element.offsetLeft;
        initialY = element.offsetTop;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        element.style.left = (initialX + dx) + 'px';
        element.style.top = (initialY + dy) + 'px';
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        markUnsaved();
    }
}

// Widget functions
window.toggleWidgetTimer = function (widgetId) {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) {
        console.error('Widget not found:', widgetId);
        return;
    }

    // Find the button by looking for the first button in controls (more reliable)
    const widgetEl = document.getElementById(widgetId);
    if (!widgetEl) {
        console.error('Widget element not found:', widgetId);
        return;
    }

    const btn = widgetEl.querySelector('.timer-widget-controls button:first-child');
    if (!btn) {
        console.error('Timer button not found for widget:', widgetId);
        return;
    }

    if (widget.running) {
        // Pause the timer
        if (widget.interval) {
            clearInterval(widget.interval);
            widget.interval = null;
        }
        widget.running = false;
        btn.textContent = 'Start';
        btn.className = 'timer-widget-btn start';
    } else {
        // Start the timer
        // Clear any leftover interval first
        if (widget.interval) {
            clearInterval(widget.interval);
            widget.interval = null;
        }

        widget.running = true;
        btn.textContent = 'Pause';
        btn.className = 'timer-widget-btn pause';

        // Make sure time is valid
        if (!widget.time || widget.time <= 0) {
            widget.time = 25 * 60;
        }

        widget.interval = setInterval(() => {
            if (!widget.running) {
                clearInterval(widget.interval);
                widget.interval = null;
                return;
            }

            widget.time--;
            updateTimerDisplay(widgetId, widget.time);

            if (widget.time <= 0) {
                clearInterval(widget.interval);
                widget.interval = null;
                widget.running = false;
                widget.time = 25 * 60;
                btn.textContent = 'Start';
                btn.className = 'timer-widget-btn start';
                updateTimerDisplay(widgetId, widget.time);
            }
        }, 1000);
    }
};

window.resetWidgetTimer = function (widgetId) {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) {
        console.error('Widget not found for reset:', widgetId);
        return;
    }

    // Clear any existing interval
    if (widget.interval) {
        clearInterval(widget.interval);
        widget.interval = null;
    }

    // Reset state
    widget.running = false;
    widget.time = 25 * 60;

    // Update button - find it reliably
    const widgetEl = document.getElementById(widgetId);
    if (widgetEl) {
        const btn = widgetEl.querySelector('.timer-widget-controls button:first-child');
        if (btn) {
            btn.textContent = 'Start';
            btn.className = 'timer-widget-btn start';
        }
    }

    // Update display
    updateTimerDisplay(widgetId, widget.time);
};

function updateTimerDisplay(widgetId, seconds) {
    const display = document.getElementById(`${widgetId}-display`);
    if (display) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

window.updateCounter = function (widgetId, delta) {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    widget.value = Math.max(0, widget.value + delta);
    const display = document.getElementById(`${widgetId}-display`);
    if (display) {
        display.textContent = widget.value;
    }
    markUnsaved();
};

window.updateStickyNote = function (widgetId, content) {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
        widget.content = content;
        markUnsaved();
    }
};

window.removeWidget = removeWidget;

// ============ CANVAS MANAGEMENT ============

// Setup real-time sync for canvas list
function setupCanvasSync() {
    if (!window.firebaseApp?.currentUser) return;

    const canvasesRef = window.firebaseApp.getCanvasesRef();
    if (!canvasesRef) return;

    // Unsubscribe from previous listener
    if (canvasesUnsubscribe) {
        canvasesUnsubscribe();
    }

    // Listen for canvas list changes in real-time
    canvasesUnsubscribe = canvasesRef.orderBy('updatedAt', 'desc').onSnapshot((snapshot) => {
        const previousCanvasCount = canvases.length;
        canvases = [];

        snapshot.forEach(doc => {
            canvases.push({ id: doc.id, ...doc.data() });
        });

        updateCanvasDropdown();

        // If no canvases exist, create a default one
        if (canvases.length === 0 && previousCanvasCount === 0) {
            createNewCanvas('My First Canvas');
        } else if (canvases.length > 0 && !currentCanvasId) {
            // Load first canvas if none selected
            loadCanvas(canvases[0].id);
        }
    }, (error) => {
        console.error('Canvas list sync error:', error);
    });
}

async function loadCanvases() {
    if (!window.firebaseApp?.currentUser) return;

    // Setup real-time sync instead of one-time load
    setupCanvasSync();
}

function updateCanvasDropdown() {
    if (!canvasDropdown) return;

    canvasDropdown.innerHTML = canvases.map(c =>
        `<option value="${c.id}" ${c.id === currentCanvasId ? 'selected' : ''}>${c.name}</option>`
    ).join('');
}

// Load canvas content from data (used by both initial load and real-time sync)
function loadCanvasContent(canvas) {
    if (!fabricCanvas || !canvas) return;

    // Clear current canvas
    fabricCanvas._isLoading = true;
    fabricCanvas.clear();
    fabricCanvas.setBackgroundColor('#f8f9fa', fabricCanvas.renderAll.bind(fabricCanvas));

    // Remove existing widgets
    widgets.forEach(w => {
        const el = document.getElementById(w.id);
        if (el) el.remove();
        if (w.interval) clearInterval(w.interval);
    });
    widgets = [];

    // Load canvas data - parse if it's a string (new format) or use directly (old format)
    if (canvas.fabricData) {
        let fabricData = canvas.fabricData;
        if (typeof fabricData === 'string') {
            try {
                fabricData = JSON.parse(fabricData);
            } catch (e) {
                console.error('Error parsing fabricData:', e);
                fabricData = null;
            }
        }
        if (fabricData) {
            fabricCanvas.loadFromJSON(fabricData, () => {
                fabricCanvas._isLoading = false;
                fabricCanvas.renderAll();
            });
        } else {
            fabricCanvas._isLoading = false;
        }
    } else {
        fabricCanvas._isLoading = false;
    }

    // Load widgets
    if (canvas.widgets && Array.isArray(canvas.widgets)) {
        canvas.widgets.forEach(w => {
            if (w.type === 'timer') {
                addTimerWidget();
                const widget = widgets[widgets.length - 1];
                widget.time = w.time || 25 * 60;
                updateTimerDisplay(widget.id, widget.time);
            } else if (w.type === 'counter') {
                addCounterWidget();
                const widget = widgets[widgets.length - 1];
                widget.value = w.value || 0;
                document.getElementById(`${widget.id}-display`).textContent = widget.value;
            } else if (w.type === 'sticky') {
                addStickyNote(w.color || 'yellow');
                const widget = widgets[widgets.length - 1];
                widget.content = w.content || '';
                document.querySelector(`#${widget.id} .sticky-note-textarea`).value = widget.content;
            }
        });
    }

    // Load viewport - parse if it's a string (new format) or use directly (old format)
    if (canvas.viewport) {
        let viewport = canvas.viewport;
        if (typeof viewport === 'string') {
            try {
                viewport = JSON.parse(viewport);
            } catch (e) {
                console.error('Error parsing viewport:', e);
                viewport = null;
            }
        }
        if (viewport && Array.isArray(viewport)) {
            fabricCanvas.viewportTransform = viewport;
        }
        zoomLevel = canvas.zoom || 1;
        updateZoomDisplay();
    }

    updateSaveStatus('saved');
}

// Setup real-time listener for specific canvas content
function setupCurrentCanvasSync(canvasId) {
    if (!window.firebaseApp?.currentUser) return;

    const canvasesRef = window.firebaseApp.getCanvasesRef();
    if (!canvasesRef) return;

    // Unsubscribe from previous canvas listener
    if (currentCanvasUnsubscribe) {
        currentCanvasUnsubscribe();
    }

    // Listen for changes to the current canvas in real-time
    currentCanvasUnsubscribe = canvasesRef.doc(canvasId).onSnapshot((doc) => {
        // Skip if we're currently saving (to avoid reload loops)
        if (isSyncingCanvas) return;

        if (doc.exists) {
            const canvasData = { id: doc.id, ...doc.data() };

            // Update the canvas in our local list
            const index = canvases.findIndex(c => c.id === canvasId);
            if (index !== -1) {
                canvases[index] = canvasData;
            }

            // Only reload if this is the currently viewed canvas
            if (currentCanvasId === canvasId) {
                loadCanvasContent(canvasData);
            }
        }
    }, (error) => {
        console.error('Canvas content sync error:', error);
    });
}

async function loadCanvas(canvasId) {
    if (!fabricCanvas) return;

    currentCanvasId = canvasId;
    const canvas = canvases.find(c => c.id === canvasId);

    if (!canvas) return;

    // Load the canvas content
    loadCanvasContent(canvas);

    // Setup real-time sync for this canvas
    setupCurrentCanvasSync(canvasId);

    updateCanvasDropdown();
}

async function createNewCanvas(name) {
    if (!window.firebaseApp?.currentUser) return;

    const canvasesRef = window.firebaseApp.getCanvasesRef();
    if (!canvasesRef) return;

    try {
        const newCanvas = {
            name: name,
            fabricData: null,
            widgets: [],
            viewport: JSON.stringify([1, 0, 0, 1, 0, 0]),
            zoom: 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await canvasesRef.add(newCanvas);
        newCanvas.id = docRef.id;
        canvases.unshift(newCanvas);

        loadCanvas(docRef.id);
        updateCanvasDropdown();

        closeNewCanvasModal();
    } catch (error) {
        console.error('Error creating canvas:', error);
    }
}

async function saveCanvas() {
    if (!currentCanvasId || !fabricCanvas || !window.firebaseApp?.currentUser) return;

    // If already saving, mark as pending and return
    if (isSaving) {
        pendingSave = true;
        return;
    }

    const canvasesRef = window.firebaseApp.getCanvasesRef();
    if (!canvasesRef) return;

    isSaving = true;
    updateSaveStatus('saving');

    // Set sync flag to prevent reload loop
    isSyncingCanvas = true;

    try {
        // Stringify fabricData and viewport to avoid nested arrays issue in Firestore
        const fabricDataStr = JSON.stringify(fabricCanvas.toJSON());
        const viewportStr = JSON.stringify(fabricCanvas.viewportTransform);

        await canvasesRef.doc(currentCanvasId).update({
            fabricData: fabricDataStr,
            widgets: widgets.map(w => ({
                type: w.type,
                ...(w.type === 'timer' && { time: w.time }),
                ...(w.type === 'counter' && { value: w.value }),
                ...(w.type === 'sticky' && { color: w.color, content: w.content })
            })),
            viewport: viewportStr,
            zoom: zoomLevel,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        hasUnsavedChanges = false;
        updateSaveStatus('saved');

        // Reset sync flag after a short delay
        setTimeout(() => {
            isSyncingCanvas = false;
        }, 1000);
    } catch (error) {
        console.error('Error saving canvas:', error);
        updateSaveStatus('error');
        isSyncingCanvas = false;
    } finally {
        isSaving = false;
    }
}

// Track if there are unsaved changes
let hasUnsavedChanges = false;

function markUnsaved() {
    hasUnsavedChanges = true;
    updateSaveStatus('unsaved');
}

function manualSave() {
    if (hasUnsavedChanges) {
        saveCanvas();
    }
}

// Save canvas before leaving (called from main.js)
function saveBeforeLeave() {
    if (hasUnsavedChanges && currentCanvasId && fabricCanvas) {
        saveCanvas();
    }
}

async function deleteCurrentCanvas() {
    if (!currentCanvasId || canvases.length <= 1) {
        alert('Cannot delete the only canvas');
        return;
    }

    if (!confirm('Are you sure you want to delete this canvas?')) return;

    const canvasesRef = window.firebaseApp.getCanvasesRef();
    if (!canvasesRef) return;

    try {
        await canvasesRef.doc(currentCanvasId).delete();
        canvases = canvases.filter(c => c.id !== currentCanvasId);

        if (canvases.length > 0) {
            loadCanvas(canvases[0].id);
        }
    } catch (error) {
        console.error('Error deleting canvas:', error);
    }
}

function clearCanvas() {
    if (!confirm('Clear all objects from this canvas?')) return;

    fabricCanvas.clear();
    fabricCanvas.setBackgroundColor('#f8f9fa', fabricCanvas.renderAll.bind(fabricCanvas));

    // Remove widgets
    widgets.forEach(w => {
        const el = document.getElementById(w.id);
        if (el) el.remove();
        if (w.interval) clearInterval(w.interval);
    });
    widgets = [];

    markUnsaved();
}

// ============ FULLSCREEN MODE ============

let isFullscreen = false;

function toggleFullscreen() {
    const canvasSection = document.getElementById('app-canvas');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    if (!canvasSection) return;

    isFullscreen = !isFullscreen;

    if (isFullscreen) {
        // Enter fullscreen
        canvasSection.classList.add('fullscreen-mode');
        fullscreenBtn.innerHTML = '✕ Exit';
        fullscreenBtn.title = 'Exit Fullscreen (Esc)';

        // Try native fullscreen for better tablet experience
        if (canvasSection.requestFullscreen) {
            canvasSection.requestFullscreen().catch(() => {
                // If native fullscreen fails, CSS fallback is already applied
            });
        } else if (canvasSection.webkitRequestFullscreen) {
            canvasSection.webkitRequestFullscreen();
        } else if (canvasSection.msRequestFullscreen) {
            canvasSection.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        canvasSection.classList.remove('fullscreen-mode');
        fullscreenBtn.innerHTML = '⛶ Fullscreen';
        fullscreenBtn.title = 'Toggle Fullscreen (F11)';

        // Exit native fullscreen if active
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => { });
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    // Resize canvas after a small delay to allow DOM updates
    setTimeout(() => {
        resizeCanvasFullscreen();
    }, 100);
}

function resizeCanvasFullscreen() {
    if (!canvasContainer || !fabricCanvas) return;

    let containerWidth, containerHeight;

    if (isFullscreen) {
        containerWidth = window.innerWidth;
        containerHeight = window.innerHeight - 70; // Account for toolbar
    } else {
        containerWidth = window.innerWidth - 500;
        containerHeight = canvasContainer.offsetHeight || canvasContainer.clientHeight || window.innerHeight - 70;
    }

    fabricCanvas.setWidth(containerWidth);
    fabricCanvas.setHeight(containerHeight);
    fabricCanvas.renderAll();
}

// Listen for native fullscreen changes (e.g., user presses Esc)
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
    const canvasSection = document.getElementById('app-canvas');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // If exited fullscreen via Esc key or browser controls
    if (!document.fullscreenElement && !document.webkitFullscreenElement && isFullscreen) {
        isFullscreen = false;
        canvasSection?.classList.remove('fullscreen-mode');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '⛶ Fullscreen';
            fullscreenBtn.title = 'Toggle Fullscreen (F11)';
        }
        setTimeout(() => resizeCanvasFullscreen(), 100);
    }
}

// ============ UI HELPERS ============

function updateZoomDisplay() {
    if (zoomLevelDisplay) {
        zoomLevelDisplay.textContent = Math.round(zoomLevel * 100) + '%';
    }
}

function updateSaveStatus(status) {
    const saveStatus = document.getElementById('saveStatus');
    const saveBtn = document.getElementById('saveCanvasBtn');
    if (!saveStatus) return;

    saveStatus.className = 'save-status ' + status;

    const text = saveStatus.querySelector('.save-text');
    if (text) {
        switch (status) {
            case 'unsaved':
                text.textContent = 'Unsaved';
                if (saveBtn) saveBtn.style.display = 'inline-flex';
                break;
            case 'saving':
                text.textContent = 'Saving...';
                if (saveBtn) saveBtn.style.display = 'none';
                break;
            case 'saved':
                text.textContent = 'Saved';
                if (saveBtn) saveBtn.style.display = 'none';
                break;
            case 'error':
                text.textContent = 'Error saving';
                if (saveBtn) saveBtn.style.display = 'inline-flex';
                break;
        }
    }
}

function openNewCanvasModal() {
    const modal = document.getElementById('newCanvasModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('newCanvasName')?.focus();
    }
}

function closeNewCanvasModal() {
    const modal = document.getElementById('newCanvasModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ============ KEYBOARD SHORTCUTS ============

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only handle if canvas section is active
        const canvasSection = document.getElementById('app-canvas');
        if (!canvasSection || !canvasSection.classList.contains('active')) return;

        // Don't handle if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Fullscreen shortcuts
        if (e.key === 'F11') {
            e.preventDefault();
            toggleFullscreen();
            return;
        }

        if (e.key === 'Escape' && isFullscreen) {
            e.preventDefault();
            toggleFullscreen();
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject) {
                fabricCanvas.remove(activeObject);
            }
        }

        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    // Undo - would need history implementation
                    break;
                case 's':
                    e.preventDefault();
                    saveCanvas();
                    break;
            }
        }

        // Tool shortcuts
        switch (e.key) {
            case 'v':
                setTool('select');
                break;
            case 'b':
                setTool('draw');
                break;
            case 'e':
                setTool('eraser');
                break;
            case 't':
                setTool('text');
                break;
            case ' ':
                if (!isPanning) {
                    e.preventDefault();
                    setTool('pan');
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === ' ' && currentTool === 'pan') {
            setTool('select');
        }
    });
}

// ============ UTILITY FUNCTIONS ============

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

// ============ AUTH STATE LISTENER ============
// Clean up canvas listeners when user signs out
window.addEventListener('authStateChanged', (e) => {
    if (e.detail.user) {
        // User signed in - sync will be setup when canvas is initialized
        if (canvasInitialized) {
            setupCanvasSync();
        }
    } else {
        // User signed out - clean up listeners
        if (canvasesUnsubscribe) {
            canvasesUnsubscribe();
            canvasesUnsubscribe = null;
        }
        if (currentCanvasUnsubscribe) {
            currentCanvasUnsubscribe();
            currentCanvasUnsubscribe = null;
        }
        // Reset state
        canvases = [];
        currentCanvasId = null;
    }
});

// ============ NEW CANVAS MODAL HANDLERS ============

document.addEventListener('DOMContentLoaded', () => {
    // New canvas form
    const newCanvasForm = document.getElementById('newCanvasForm');
    if (newCanvasForm) {
        newCanvasForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('newCanvasName')?.value.trim();
            if (name) {
                createNewCanvas(name);
            }
        });
    }

    // Close modal buttons
    document.getElementById('closeNewCanvasModal')?.addEventListener('click', closeNewCanvasModal);
    document.getElementById('cancelNewCanvasBtn')?.addEventListener('click', closeNewCanvasModal);

    // Close on backdrop click
    document.getElementById('newCanvasModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'newCanvasModal') {
            closeNewCanvasModal();
        }
    });
});

// Export for external use
window.canvasApp = {
    init: initCanvas,
    loadCanvases,
    createNewCanvas,
    saveCanvas,
    resize: resizeCanvas,
    manualSave,
    saveBeforeLeave
};
