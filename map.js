import { SEVERITY_COLORS, hexToRgba } from './constants.js';

let map;
let vectorSource;
let drawSource; // Source for the polygon
let drawLayer;  // Layer for the polygon
let overlay;
let drawInteraction;
let onSpatialFilterCallback = null;
let isDrawingActive = false;

// Style for the Buffer Center Point (White center with #C227F5 Border)
const bufferCenterStyle = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: '#ffffff' }), // White center for contrast
        stroke: new ol.style.Stroke({ color: '#C227F5', width: 3 }) // Requested Violet Border
    }),
    zIndex: 100 // Ensure it is on top
});

// Style for the Polygon Area (Violet Theme #C227F5)
const polygonStyle = new ol.style.Style({
    fill: new ol.style.Fill({
        color: 'rgba(194, 39, 245, 0.15)' // Translucent version of #C227F5
    }),
    stroke: new ol.style.Stroke({
        color: '#C227F5', // Requested Violet Border
        width: 2
    })
});

export function initMap(targetId, onSpatialFilter) {
    onSpatialFilterCallback = onSpatialFilter;

    // 1. Create Data Vector Source
    vectorSource = new ol.source.Vector();

    // 2. Create Drawing Source & Layer
    drawSource = new ol.source.Vector();
    drawLayer = new ol.layer.Vector({
        source: drawSource,
        // ROBUST STYLE FUNCTION: Checks geometry type directly
        style: function (feature) {
            const geometryType = feature.getGeometry().getType();
            if (geometryType === 'Point') {
                return bufferCenterStyle;
            }
            return polygonStyle;
        },
        zIndex: 999 // Ensure drawing layer is always on top of data points
    });

    // 3. Create Data Layer with Smart Style Function
    const vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: function (feature) {
            const severity = feature.get('severity');
            const cases = feature.get('cases');
            const dimmed = feature.get('dimmed'); // Check if feature is dimmed

            const baseColor = SEVERITY_COLORS[severity] || '#ffffff';

            // If dimmed, use 0.25 opacity (75% transparency)
            const finalColor = dimmed ? hexToRgba(baseColor, 0.25) : baseColor;
            const strokeColor = dimmed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)';

            // Dynamic size based on cases
            const radius = Math.max(4, Math.min(cases / 15, 12));

            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: radius,
                    fill: new ol.style.Fill({ color: finalColor }),
                    stroke: new ol.style.Stroke({ color: strokeColor, width: 1.5 })
                }),
                zIndex: dimmed ? 1 : 10 // Bring selected items to front
            });
        }
    });

    // 4. Create Overlay for Popup
    const container = document.getElementById('popup');
    const content = document.getElementById('popup-content');

    overlay = new ol.Overlay({
        element: container,
        autoPan: false,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -10]
    });

    // 5. Initialize Map
    map = new ol.Map({
        target: targetId,
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM(),
                className: 'map-dark-filter'
            }),
            vectorLayer,
            drawLayer // Add draw layer on top
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([15, 50]),
            zoom: 4
        }),
        overlays: [overlay]
    });

    // 6. Interaction (Hover)
    map.on('pointermove', function (evt) {
        if (isDrawingActive) return; // Disable hover while drawing

        const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
            const geomType = feature.getGeometry().getType();
            // Ignore the polygon area and the buffer center point for popups
            if (geomType === 'Polygon' || (geomType === 'Point' && drawSource.hasFeature(feature))) {
                // It's likely our buffer point or polygon, ignore it for popup
                return null;
            }
            return feature;
        });

        if (feature) {
            // Don't show popup for dimmed (unselected) items if a selection exists
            if (feature.get('dimmed')) {
                map.getTargetElement().style.cursor = 'default';
                overlay.setPosition(undefined);
                container.classList.add('hidden');
                return;
            }

            const props = feature.getProperties();
            const coords = feature.getGeometry().getCoordinates();

            content.innerHTML = `
                <div class="font-bold text-sm text-white">${props.disease}</div>
                <div class="text-xs text-gray-300">${props.country}</div>
                <div class="mt-1 pt-1 border-t border-gray-600 flex justify-between items-center">
                    <span class="text-xs font-mono">Cases: ${props.cases}</span>
                    <span class="text-[10px] px-1 rounded text-black font-bold" style="background-color: ${SEVERITY_COLORS[props.severity]}">${props.severity}</span>
                </div>
            `;

            overlay.setPosition(coords);
            container.classList.remove('hidden');
            map.getTargetElement().style.cursor = 'pointer';
        } else {
            overlay.setPosition(undefined);
            container.classList.add('hidden');
            map.getTargetElement().style.cursor = '';
        }
    });
}

export function updateMapData(data) {
    if (!vectorSource) return;

    vectorSource.clear();

    const features = data.map(item => {
        const feature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([item.lng, item.lat])),
            severity: item.severity,
            cases: item.cases,
            disease: item.disease,
            country: item.country,
            date: item.dateStr,
            id: item.id,
            dimmed: false // Default state
        });
        return feature;
    });

    vectorSource.addFeatures(features);

    // If we had a polygon, re-apply the filter logic to new data.
    // We filter specifically for Polygon type to ignore the buffer center point
    const polyFeatures = drawSource.getFeatures().filter(f => f.getGeometry().getType() === 'Polygon');

    if (polyFeatures.length > 0) {
        // Pass false to suppress the callback loop
        return applyPolygonFilter(polyFeatures[0].getGeometry(), false);
    }
    return null;
}

export function resizeMap() {
    if (map) {
        setTimeout(() => {
            map.updateSize();
        }, 300); // wait for transition
    }
}

// --- DRAWING TOOLS ---

export function toggleDrawMode(enable) {
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
    }
    isDrawingActive = enable;

    if (enable) {
        drawSource.clear();
        clearDimming();

        drawInteraction = new ol.interaction.Draw({
            source: drawSource,
            type: 'Polygon'
        });

        drawInteraction.on('drawend', (evt) => {
            const geometry = evt.feature.getGeometry();

            setTimeout(() => {
                applyPolygonFilter(geometry, true);
                toggleDrawMode(false);

                const event = new CustomEvent('drawended');
                window.dispatchEvent(event);
            }, 0);
        });

        map.addInteraction(drawInteraction);
        map.getTargetElement().style.cursor = 'crosshair';
    } else {
        map.getTargetElement().style.cursor = '';
    }
}

export function toggleBufferMode(enable) {
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
    }
    isDrawingActive = enable;

    if (enable) {
        drawSource.clear();
        clearDimming();

        drawInteraction = new ol.interaction.Draw({
            source: drawSource,
            type: 'Point'
        });

        drawInteraction.on('drawend', (evt) => {
            const pointGeom = evt.feature.getGeometry();
            const center = pointGeom.getCoordinates();

            setTimeout(() => {
                toggleBufferMode(false);
                const event = new CustomEvent('buffer-point-selected', { detail: { center: center } });
                window.dispatchEvent(event);
            }, 50);
        });

        map.addInteraction(drawInteraction);
        map.getTargetElement().style.cursor = 'crosshair';
    } else {
        map.getTargetElement().style.cursor = '';
    }
}

export function createBuffer(center, radiusKm) {
    if (!map || !center || !radiusKm) return;

    drawSource.clear();

    const pointResolution = ol.proj.getPointResolution('EPSG:3857', 1, center);
    const radiusMapUnits = (radiusKm * 1000) / pointResolution;

    // 1. Create Polygon
    const circle = new ol.geom.Circle(center, radiusMapUnits);
    const polygon = ol.geom.Polygon.fromCircle(circle);
    const polyFeature = new ol.Feature(polygon);

    // 2. Create Visible Center Point
    const centerPointFeature = new ol.Feature(new ol.geom.Point(center));
    // The style function in drawLayer will automatically use bufferCenterStyle because it is a Point

    drawSource.addFeatures([polyFeature, centerPointFeature]);

    applyPolygonFilter(polygon, true);

    const event = new CustomEvent('drawended');
    window.dispatchEvent(event);
}

export function clearSelection() {
    drawSource.clear();
    clearDimming();
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
    }
    isDrawingActive = false;

    if (onSpatialFilterCallback) {
        onSpatialFilterCallback(null);
    }
}

function applyPolygonFilter(polygonGeometry, notify = true) {
    const features = vectorSource.getFeatures();
    const selectedIds = [];

    features.forEach(feature => {
        const coord = feature.getGeometry().getCoordinates();
        if (polygonGeometry.intersectsCoordinate(coord)) {
            feature.set('dimmed', false);
            selectedIds.push(feature.get('id'));
        } else {
            feature.set('dimmed', true);
        }
    });

    vectorSource.changed();

    if (notify && onSpatialFilterCallback) {
        onSpatialFilterCallback(selectedIds);
    }

    return selectedIds;
}

function clearDimming() {
    vectorSource.getFeatures().forEach(feature => {
        feature.set('dimmed', false);
    });
    vectorSource.changed();
}