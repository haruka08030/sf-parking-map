import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMapEvents, useMap } from "react-leaflet";
import TimeFilterControl from './TimeFilterControl';
import { isActiveAt, intersectsRange, calculateCoverage } from './time-parser';
import "leaflet/dist/leaflet.css";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const DATASET_ID = "hi6h-neyh"; // Use the source dataset ID
const GEOM_FIELD = "shape";

// Helper to format a date for datetime-local input
const toLocalISOString = (date) => {
    const tzoffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
    return localISOTime;
};

// Debounce Hook
function useDebouncedCallback(cb, delay = 300) {
    const timer = useRef(null);
    return (...args) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => cb(...args), delay);
    };
}

// Regulation Classification and Styling
function classifyRegulation(props) {
    const text = (props?.regulation || "").toLowerCase();
    const hasTimeLimit = !!(props?.hrlimit || props?.hours);

    // Category 1: Cannot Park (Red)
    if (/no\s*parking|tow-?away/.test(text)) return "CannotPark";
    if (/commercial|truck|taxi|permit\s*only|loading/.test(text)) return "CannotPark";

    // Category 2: Time Limited (Yellow) - Check time limit first, regardless of RPP
    if (hasTimeLimit || /time\s*limit|\b\d+\s*(min|hour|hr|h)\b/.test(text)) return "TimeLimit";

    // Category 3: No Regulation (Blue) - if no restrictions detected
    if (!text || text.trim() === "") return "NoRegulation";

    // Category 4: Unknown (Grey)
    return "Unknown";
}

function styleForFeature(feature, showInactiveDim, isRangeMode, isAtMode) {
    const props = feature.properties;
    const cls = classifyRegulation(props);

    // In range mode, use coverage-based coloring
    if (isRangeMode && props._coverage !== undefined) {
        const coverage = props._coverage;
        let color;

        if (coverage >= 1.0) {
            // Full coverage: Blue (can park here the entire time)
            color = "#2196F3";
        } else if (coverage > 0) {
            // Partial coverage: Yellow (can only park for part of the time)
            color = "#FFC107";
        } else {
            // No coverage: Red (cannot park at all)
            color = "#d73027";
        }

        return { color, weight: 3, opacity: 1.0 };
    }

    // In At mode, use simple parking availability coloring
    if (isAtMode) {
        // If regulation is not active, you can always park
        if (!props._isActive) {
            return { color: "#2196F3", weight: 3, opacity: 1.0 }; // Blue - can park
        }

        // If regulation is active, check if it's a "Cannot Park" type
        if (cls === "CannotPark") {
            return { color: "#d73027", weight: 3, opacity: 1.0 }; // Red - cannot park
        }

        // If it's TimeLimit or other types, you can still park (with restrictions)
        return { color: "#2196F3", weight: 3, opacity: 1.0 }; // Blue - can park with time limit
    }

    // Now mode: simplified classification-based styling
    const baseStyle = (() => {
        switch (cls) {
            case "CannotPark": return { color: "#d73027", weight: 4 }; // Red - Cannot park
            case "TimeLimit": return { color: "#FFC107", weight: 3 };  // Yellow - Time limited
            case "NoRegulation": return { color: "#2196F3", weight: 3 }; // Blue - No regulation
            default: return { color: "#999999", weight: 2 };           // Grey - Unknown
        }
    })();

    if (showInactiveDim && !props._isActive) {
        return { ...baseStyle, opacity: 0.3, dashArray: '5, 5' };
    }
    return baseStyle;
}

// Legend Component
function Legend({ isRangeMode, isAtMode }) {
    const rangeItems = [
        ["#2196F3", "100% free to park"],
        ["#FFC107", "Partially available"],
        ["#d73027", "No parking allowed"],
    ];
    const atItems = [
        ["#2196F3", "Can park now"],
        ["#d73027", "Cannot park now"],
    ];
    const classificationItems = [
        ["#2196F3", "No regulation"],
        ["#FFC107", "Time limited parking"],
        ["#d73027", "Cannot park"],
        ["#999999", "Unknown/Other"],
    ];

    return (
        <div style={{
            position: "absolute", left: 12, bottom: 12,
            zIndex: 1000,
            background: "rgba(255,255,255,0.95)", borderRadius: 12,
            padding: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
        }}>
            {isRangeMode && (
                <>
                    <b style={{ fontSize: 13, color: '#333' }}>Parking Availability</b>
                    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 12px 0" }}>
                        {rangeItems.map(([color, label]) => (
                            <li key={label} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ width: 16, height: 4, background: color, marginRight: 8, borderRadius: 2 }}></span>
                                <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {isAtMode && (
                <>
                    <b style={{ fontSize: 13, color: '#333' }}>Parking Status</b>
                    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 12px 0" }}>
                        {atItems.map(([color, label]) => (
                            <li key={label} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ width: 16, height: 4, background: color, marginRight: 8, borderRadius: 2 }}></span>
                                <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {!isRangeMode && !isAtMode && (
                <>
                    <b style={{ fontSize: 13, color: '#333' }}>Regulation Types</b>
                    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0" }}>
                        {classificationItems.map(([color, label]) => (
                            <li key={label} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ width: 16, height: 4, background: color, marginRight: 8, borderRadius: 2 }}></span>
                                <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

// Viewport Listener
function ViewportListener({ onMove }) {
    useMapEvents({
        moveend: (e) => onMove(e.target.getBounds(), e.target.getZoom()),
    });
    return null;
}

// Location Button Component
function LocationButton({ onClick }) {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'absolute',
                bottom: '70px',
                right: '12px',
                zIndex: 1000,
                width: '50px',
                height: '50px',
                background: isHovered ? '#2196F3' : 'rgba(255,255,255,0.95)',
                border: 'none',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
            }}
            title="Go to current location"
        >
            <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isHovered ? 'white' : '#333'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
        </button>
    );
}

// Socrata API Fetcher
async function fetchGeojson({ bounds, limit = 5000, token }) {
    const base = `https://data.sfgov.org/resource/${DATASET_ID}.geojson`;
    const params = new URLSearchParams();

    if (bounds) {
        const { _northEast, _southWest } = bounds;
        const whereClause = `within_box(${GEOM_FIELD}, ${_northEast.lat}, ${_southWest.lng}, ${_southWest.lat}, ${_northEast.lng})`;
        params.set("$where", whereClause);
    }

    params.set("$limit", String(limit || 5000));
    const url = `${base}?${params.toString()}`;
    console.log("[SODA] GET", url);

    const res = await fetch(url, { headers: token ? { "X-App-Token": token } : {} });

    if (!res.ok) {
        const text = await res.text();
        console.error("[SODA] Error", res.status, text);
        if (res.status === 400 && text.includes("Query is too complex")) {
            throw new Error("Area too large or query too complex. Zoom in.");
        }
        throw new Error(`API Error ${res.status}: ${text}`);
    }
    return res.json();
}

// Main Map Component
export default function SfParkingMap() {
    const [geojson, setGeojson] = useState(null);
    const [status, setStatus] = useState("Idle");
    const [filters, setFilters] = useState({
        simulationEnabled: true,
        simulationMode: 'at',
        atTime: toLocalISOString(new Date()),
        rangeStart: toLocalISOString(new Date()),
        rangeEnd: toLocalISOString(new Date(Date.now() + 3600 * 1000)),
        showInactiveDim: true,
        token: "",
        limit: 2000,
    });
    const mapRef = useRef(null);

    const debouncedLoad = useDebouncedCallback(async ({ bounds }) => {
        try {
            setStatus("Loading...");
            const data = await fetchGeojson({ bounds, limit: filters.limit, token: filters.token });
            setGeojson(data);
            setStatus(`Loaded (${data.features?.length || 0})`);
        } catch (err) {
            console.error(err);
            setStatus("Error loading data");
        }
    }, 300);

    const handleGoToLocation = () => {
        if (navigator.geolocation) {
            setStatus("Getting location...");
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    if (mapRef.current) {
                        mapRef.current.setView([latitude, longitude], 15);
                        setStatus("Location found");
                    }
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setStatus("Location access denied");
                }
            );
        } else {
            setStatus("Geolocation not supported");
        }
    };

    const processedGeojson = useMemo(() => {
        if (!geojson) return null;

        const featuresWithStatus = geojson.features.map(f => {
            let isActive;
            let coverage;
            const props = f.properties;

            const currentMode = filters.simulationEnabled ? filters.simulationMode : 'now';

            if (currentMode === 'now') {
                isActive = true;
            } else if (currentMode === 'at') {
                isActive = isActiveAt(props, new Date(filters.atTime));
            } else if (currentMode === 'range') {
                isActive = intersectsRange(props, new Date(filters.rangeStart), new Date(filters.rangeEnd));
                coverage = calculateCoverage(props, new Date(filters.rangeStart), new Date(filters.rangeEnd));
            }

            return { ...f, properties: { ...props, _isActive: isActive, _coverage: coverage } };
        });

        const filteredFeatures = filters.showInactiveDim
            ? featuresWithStatus
            : featuresWithStatus.filter(f => f.properties._isActive);

        return { type: "FeatureCollection", features: filteredFeatures };
    }, [geojson, filters]);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            <MapContainer ref={mapRef} center={[37.7749, -122.4194]} zoom={15} className="map" style={{ height: "100%", width: "100%" }}>
                <TileLayer
                    url={`https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
                    attribution='© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    tileSize={512}
                    zoomOffset={-1}
                />
                {processedGeojson && (
                    <GeoJSON
                        key={JSON.stringify(filters)}
                        data={processedGeojson}
                        style={(f) => {
                            const currentMode = filters.simulationEnabled ? filters.simulationMode : 'now';
                            return styleForFeature(
                                f,
                                filters.showInactiveDim,
                                currentMode === 'range',
                                currentMode === 'at'
                            );
                        }}
                        onEachFeature={(f, layer) => {
                            const p = f.properties || {};
                            const statusText = p._isActive ? 'ACTIVE' : 'INACTIVE';
                            const coverageText = p._coverage !== undefined
                                ? `<br/>Coverage: ${(p._coverage * 100).toFixed(0)}%`
                                : '';
                            layer.bindPopup(`
                                <b>${classifyRegulation(p)} - ${statusText}</b><br/>
                                ${p.regulation || "(no text)"}<br/>
                                ${coverageText}
                                <hr/>
                                Days: ${p.days || ""}<br/>
                                Hours: ${p.hours || ""}<br/>
                                Limit: ${p.hrlimit || ""}<br/>
                                RPP: ${[p.rpparea1, p.rpparea2, p.rpparea3].filter(Boolean).join(", ") || p.rpp_sym || p.sym_rpp2 || ""}<br/>
                                Detail: ${p.regdetails || ""}<br/>
                                Exceptions: ${p.exceptions || ""}<br/>
                            `);
                        }}
                    />
                )}
                <ViewportListener onMove={(b) => debouncedLoad({ bounds: b })} />
            </MapContainer>

            <TimeFilterControl filters={filters} setFilters={setFilters} status={status} />

            <Legend
                isRangeMode={filters.simulationEnabled && filters.simulationMode === 'range'}
                isAtMode={filters.simulationEnabled && filters.simulationMode === 'at'}
            />

            <LocationButton onClick={handleGoToLocation} />
        </div>
    );
}