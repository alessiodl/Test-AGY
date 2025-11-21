export const DISEASES = ['Influenza B', 'Measles', 'Norovirus', 'Viral Meningitis', 'Legionnaires'];
export const COUNTRIES = ['France', 'Germany', 'Italy', 'Spain', 'Poland', 'Sweden', 'Romania', 'Greece'];

export const Severity = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical'
};

// Approximate bounding boxes or centers for demo purposes
const COUNTRY_COORDS = {
    'France': { lat: 46.2276, lng: 2.2137 },
    'Germany': { lat: 51.1657, lng: 10.4515 },
    'Italy': { lat: 41.8719, lng: 12.5674 },
    'Spain': { lat: 40.4637, lng: -3.7492 },
    'Poland': { lat: 51.9194, lng: 19.1451 },
    'Sweden': { lat: 60.1282, lng: 18.6435 },
    'Romania': { lat: 45.9432, lng: 24.9668 },
    'Greece': { lat: 39.0742, lng: 21.8243 },
};

export const SEVERITY_COLORS = {
    [Severity.LOW]: '#ed87ffff',
    [Severity.MEDIUM]: '#D627F5',
    [Severity.HIGH]: '#AB09C8',
    [Severity.CRITICAL]: '#860779'
};

// Helper to convert Hex to RGBA for opacity handling
export const hexToRgba = (hex, alpha = 1) => {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex; // Fallback
}

export const generateMockData = (count) => {
    const data = [];
    for (let i = 0; i < count; i++) {
        const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
        const disease = DISEASES[Math.floor(Math.random() * DISEASES.length)];
        const baseCoords = COUNTRY_COORDS[country];

        // Random scatter around the country center
        const lat = baseCoords.lat + (Math.random() - 0.5) * 6;
        const lng = baseCoords.lng + (Math.random() - 0.5) * 8;

        const cases = Math.floor(Math.random() * 500) + 10;

        let severity = Severity.LOW;
        if (cases > 100) severity = Severity.MEDIUM;
        if (cases > 300) severity = Severity.HIGH;
        if (cases > 450) severity = Severity.CRITICAL;

        // Recent date generation
        const date = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

        data.push({
            id: `evt-${i}`,
            disease,
            country,
            cases,
            severity,
            lat,
            lng,
            dateStr: date.toISOString().split('T')[0],
            dateObj: date
        });
    }
    return data;
};