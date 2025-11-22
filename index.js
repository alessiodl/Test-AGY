import { generateMockData, COUNTRIES, DISEASES, Severity, SEVERITY_COLORS } from './constants.js';
import { initMap, updateMapData, toggleDrawMode, toggleBufferMode, clearSelection, resizeMap, createBuffer } from './map.js';
import { renderCharts } from './charts.js';

// State
let allData = [];
let activeFilters = {
    disease: 'All', // Single string, 'All' means no filter
    severity: 'All',
    spatialIds: null // null means no spatial filter, Array means filtered
};
let tempBufferCenter = null;

// DOM Elements
const kpiTotal = document.getElementById('kpi-total');
const kpiCritical = document.getElementById('kpi-critical');
const diseaseFilterGroup = document.getElementById('disease-filter-group');
const diseaseFilter = document.getElementById('disease-filter');
const refreshBtn = document.getElementById('refresh-btn');
const drawBtn = document.getElementById('draw-poly-btn');
const bufferBtn = document.getElementById('buffer-btn');
const clearBtn = document.getElementById('clear-poly-btn');

// Modal Elements
const bufferModal = document.getElementById('buffer-modal');
const bufferConfirmBtn = document.getElementById('buffer-confirm-btn');
const bufferCancelBtn = document.getElementById('buffer-cancel-btn');
const bufferInput = document.getElementById('buffer-radius-input');

function init() {
    // 1. Initialize Map with Callback for Spatial Filter
    initMap('map', handleSpatialFilter);

    // 2. Populate Filter Dropdown
    // Add "All" option first
    const allItem = document.createElement('calcite-dropdown-item');
    allItem.value = 'All';
    allItem.innerText = 'All Diseases';
    allItem.selected = true;
    diseaseFilterGroup.appendChild(allItem);

    DISEASES.sort().forEach(disease => {
        const item = document.createElement('calcite-dropdown-item');
        item.value = disease;
        item.innerText = disease;
        diseaseFilterGroup.appendChild(item);
    });

    // 3. Render Legend
    renderLegend();

    // 4. Load Initial Data
    loadData();

    // 4. Event Listeners
    setupListeners();
    setupFullScreen();

    // 5. Handle Resize for Plotly
    window.addEventListener('resize', () => {
        const charts = ['chart-bar', 'chart-pie', 'chart-line'];
        charts.forEach(id => {
            try { Plotly.Plots.resize(document.getElementById(id)); } catch (e) { }
        });
    });
}

function loadData() {
    allData = generateMockData(200);
    updateDashboard();
}

function updateDashboard() {
    // 1. Apply Global Filters (Disease & Severity) to get Base Data for Map
    const globalFilteredData = allData.filter(d => {
        const matchDisease = activeFilters.disease === 'All' || d.disease === activeFilters.disease;
        const matchSeverity = activeFilters.severity === 'All' || d.severity === activeFilters.severity;
        return matchDisease && matchSeverity;
    });

    // 2. Update Map
    // updateMapData returns the list of selected IDs if a polygon exists, or null if not.
    // We use this to sync the spatial filter with new data without triggering the callback loop.
    const currentSpatialIds = updateMapData(globalFilteredData);

    if (currentSpatialIds) {
        activeFilters.spatialIds = currentSpatialIds;
    }

    // 3. Apply Spatial Filter for Charts/KPIs
    let finalChartData = globalFilteredData;

    if (activeFilters.spatialIds) {
        finalChartData = globalFilteredData.filter(d => activeFilters.spatialIds.includes(d.id));
    }

    // 4. Update Charts
    renderCharts(finalChartData, handleChartFilter);

    // 5. Update KPIs
    const totalCases = finalChartData.reduce((acc, curr) => acc + curr.cases, 0);
    const criticalCases = finalChartData
        .filter(d => d.severity === Severity.CRITICAL)
        .reduce((acc, curr) => acc + curr.cases, 0);

    kpiTotal.textContent = totalCases.toLocaleString();
    kpiCritical.textContent = criticalCases.toLocaleString();

    // Sync Dropdown UI (Optional, but good for reset)
    const items = diseaseFilterGroup.querySelectorAll('calcite-dropdown-item');
    items.forEach(item => {
        item.selected = item.value === activeFilters.disease;
    });
}

// Handler for Spatial Filter from Map (User Action)
function handleSpatialFilter(selectedIds) {
    activeFilters.spatialIds = selectedIds;

    // Enable/Disable Clear Button
    if (selectedIds) {
        clearBtn.disabled = false;
        drawBtn.appearance = "outline";
        bufferBtn.appearance = "outline";
    } else {
        clearBtn.disabled = true;
    }

    updateDashboard();
}

// Handler for clicks coming from Plotly
function handleChartFilter(type, value) {
    if (type === 'country') {
        // Country filter removed from main UI, but we could still support it if we added it back to state.
        // For now, ignoring country clicks to respect the new requirement.
        console.log('Country filter disabled in favor of disease filter');
    } else if (type === 'severity') {
        activeFilters.severity = (activeFilters.severity === value) ? 'All' : value;
    }

    updateDashboard();
}

function setupListeners() {
    // Calcite Dropdown Change (Disease Filter)
    // Trying calciteDropdownItemSelect which fires on the item but bubbles
    diseaseFilterGroup.addEventListener('calciteDropdownItemSelect', (e) => {
        // In single select mode, the target is the selected item
        const selectedItem = e.target;

        if (selectedItem) {
            activeFilters.disease = selectedItem.value;
        } else {
            activeFilters.disease = 'All';
        }
        updateDashboard();

        // Close the dropdown (optional, but good UX if it doesn't close auto)
        diseaseFilter.open = false;
    });

    // Refresh Button
    refreshBtn.addEventListener('click', () => {
        refreshBtn.loading = true;
        activeFilters = { disease: 'All', severity: 'All', spatialIds: null };
        // Reset dropdown selection visually
        const items = diseaseFilterGroup.querySelectorAll('calcite-dropdown-item');
        items.forEach(i => i.selected = (i.value === 'All'));
        clearSelection(); // Clear map polygon

        setTimeout(() => {
            loadData();
            refreshBtn.loading = false;
        }, 500);
    });

    // Draw Polygon Button
    drawBtn.addEventListener('click', () => {
        const isActive = drawBtn.appearance === 'solid';
        if (isActive) {
            toggleDrawMode(false);
            drawBtn.appearance = 'outline';
        } else {
            // Disable buffer mode if active
            bufferBtn.appearance = 'outline';
            toggleDrawMode(true);
            drawBtn.appearance = 'solid';
        }
    });

    // Buffer Button (Activates point drawing)
    bufferBtn.addEventListener('click', () => {
        const isActive = bufferBtn.appearance === 'solid';
        if (isActive) {
            toggleBufferMode(false);
            bufferBtn.appearance = 'outline';
        } else {
            // Disable draw mode if active
            drawBtn.appearance = 'outline';
            toggleBufferMode(true);
            bufferBtn.appearance = 'solid';
        }
    });

    // Clear Button
    clearBtn.addEventListener('click', () => {
        clearSelection();
        activeFilters.spatialIds = null;
        drawBtn.appearance = 'outline';
        bufferBtn.appearance = 'outline';
        updateDashboard();
    });

    // Listen for auto-end of drawing (from map.js)
    window.addEventListener('drawended', () => {
        drawBtn.appearance = 'outline';
        bufferBtn.appearance = 'outline';
    });

    // --- BUFFER MODAL LOGIC ---

    // Listen for point selection from map
    window.addEventListener('buffer-point-selected', (e) => {
        tempBufferCenter = e.detail.center;
        bufferModal.classList.remove('hidden');
        bufferInput.focus();
    });

    bufferConfirmBtn.addEventListener('click', () => {
        const radius = parseFloat(bufferInput.value);
        if (tempBufferCenter && radius > 0) {
            createBuffer(tempBufferCenter, radius);
            bufferModal.classList.add('hidden');
            tempBufferCenter = null;
        }
    });

    bufferCancelBtn.addEventListener('click', () => {
        bufferModal.classList.add('hidden');
        tempBufferCenter = null;
        drawBtn.appearance = 'outline';
        bufferBtn.appearance = 'outline';
    });
}

function setupFullScreen() {
    const widgets = [
        { btnId: 'map-fullscreen-btn', containerId: 'map-container', type: 'map' },
        { btnId: 'bar-fullscreen-btn', containerId: 'bar-container', type: 'chart' },
        { btnId: 'pie-fullscreen-btn', containerId: 'pie-container', type: 'chart' },
        { btnId: 'line-fullscreen-btn', containerId: 'line-container', type: 'chart' }
    ];

    widgets.forEach(w => {
        const btn = document.getElementById(w.btnId);
        const container = document.getElementById(w.containerId);

        btn.addEventListener('click', () => {
            toggleFullScreen(container, btn, w.type);
        });
    });
}

function toggleFullScreen(container, btn, type) {
    const isFull = container.classList.contains('widget-fullscreen');

    if (isFull) {
        container.classList.remove('widget-fullscreen');
        btn.icon = 'maximize';
        btn.text = 'Maximize';
    } else {
        container.classList.add('widget-fullscreen');
        btn.icon = 'minimize';
        btn.text = 'Minimize';
    }

    // Trigger Resize
    if (type === 'map') {
        resizeMap();
    } else {
        // Plotly resize
        const plotDiv = container.querySelector('.js-plotly-plot'); // Plotly adds this class
        if (plotDiv) Plotly.Plots.resize(plotDiv);
        else {
            // Fallback if direct selector fails, use IDs known
            const id = container.querySelector('div[id^="chart-"]')?.id;
            if (id) Plotly.Plots.resize(document.getElementById(id));
        }
    }
}

function renderLegend() {
    const container = document.getElementById('legend-items');
    container.innerHTML = ''; // Clear existing

    Object.values(Severity).forEach(severity => {
        const color = SEVERITY_COLORS[severity];

        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';

        const dot = document.createElement('span');
        dot.className = 'w-3 h-3 rounded-full';
        dot.style.backgroundColor = color;

        const label = document.createTextNode(severity);

        row.appendChild(dot);
        row.appendChild(label);
        container.appendChild(row);
    });
}

// Start the app
init();