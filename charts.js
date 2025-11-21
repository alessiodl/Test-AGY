import { SEVERITY_COLORS, Severity } from './constants.js';

// Common layout for dark theme charts
const darkLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#9ca3af', family: 'sans-serif' },
    margin: { t: 30, b: 30, l: 40, r: 10 },
    showlegend: false,
    xaxis: {
        gridcolor: '#333',
        linecolor: '#555'
    },
    yaxis: {
        gridcolor: '#333',
        linecolor: '#555'
    },
    autosize: true,
    clickmode: 'event' // Enable click events
};

export function renderCharts(data, onFilterChange) {
    renderBarChart(data, onFilterChange);
    renderPieChart(data, onFilterChange);
    renderLineChart(data);
}

function renderBarChart(data, onFilterChange) {
    const containerId = 'chart-bar';
    const casesByCountry = {};

    data.forEach(d => {
        casesByCountry[d.country] = (casesByCountry[d.country] || 0) + d.cases;
    });

    const countries = Object.keys(casesByCountry);
    const cases = Object.values(casesByCountry);

    // Sort
    const sorted = countries.map((c, i) => ({ c, v: cases[i] }))
        .sort((a, b) => b.v - a.v);

    const trace = {
        x: sorted.map(i => i.c),
        y: sorted.map(i => i.v),
        type: 'bar',
        marker: {
            color: '#C227F5',
            line: { width: 0 }
        },
        hovertemplate: '<b>%{x}</b><br>Cases: %{y}<extra></extra>'
    };

    Plotly.react(containerId, [trace], {
        ...darkLayout,
        title: { text: 'CASES BY COUNTRY', font: { size: 12, color: '#6b7280' }, x: 0 },
        margin: { t: 30, b: 40, l: 40, r: 10 }
    }, { displayModeBar: false, responsive: true });

    // Add Click Listener
    const plotDiv = document.getElementById(containerId);
    plotDiv.removeAllListeners('plotly_click');
    plotDiv.on('plotly_click', function (data) {
        if (data.points.length > 0) {
            const country = data.points[0].x;
            onFilterChange('country', country);
        }
    });
}

function renderPieChart(data, onFilterChange) {
    const containerId = 'chart-pie';
    const sevCount = { [Severity.LOW]: 0, [Severity.MEDIUM]: 0, [Severity.HIGH]: 0, [Severity.CRITICAL]: 0 };

    data.forEach(d => {
        if (sevCount[d.severity] !== undefined) sevCount[d.severity]++;
    });

    const labels = Object.keys(sevCount);
    const values = Object.values(sevCount);
    const colors = labels.map(l => SEVERITY_COLORS[l]);

    const trace = {
        labels: labels,
        values: values,
        type: 'pie',
        hole: 0.5,
        textinfo: 'label+percent',
        textposition: 'inside',
        marker: {
            colors: colors
        },
        hoverinfo: 'label+value',
        hovertemplate: '<b>%{label}</b><br>Count: %{value}<extra></extra>'
    };

    Plotly.react(containerId, [trace], {
        ...darkLayout,
        title: { text: 'SEVERITY SHARE', font: { size: 12, color: '#6b7280' }, x: 0 },
        showlegend: true,
        legend: { orientation: 'h', y: -0.1, font: { size: 10 } },
        margin: { t: 30, b: 0, l: 0, r: 0 }
    }, { displayModeBar: false, responsive: true });

    // Add Click Listener
    const plotDiv = document.getElementById(containerId);
    plotDiv.removeAllListeners('plotly_click');
    plotDiv.on('plotly_click', function (data) {
        if (data.points.length > 0) {
            const severity = data.points[0].label;
            onFilterChange('severity', severity);
        }
    });
}

function renderLineChart(data) {
    const containerId = 'chart-line';
    // Group by Date
    const dateMap = {};
    data.forEach(d => {
        dateMap[d.dateStr] = (dateMap[d.dateStr] || 0) + d.cases;
    });

    const sortedDates = Object.keys(dateMap).sort();
    const sortedCases = sortedDates.map(d => dateMap[d]);

    const trace = {
        x: sortedDates,
        y: sortedCases,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#C227F5', width: 2 },
        marker: { size: 6, color: '#C227F5' },
        hovertemplate: '<b>%{x}</b><br>Total Cases: %{y}<extra></extra>'
    };

    Plotly.react(containerId, [trace], {
        ...darkLayout,
        title: { text: 'TIMELINE', font: { size: 12, color: '#6b7280' }, x: 0 },
        xaxis: { ...darkLayout.xaxis, type: 'date', tickformat: '%b %d' }
    }, { displayModeBar: false, responsive: true });
}