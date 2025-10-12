import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from "react-leaflet";
import TimeFilterControl from './TimeFilterControl';
import { isActiveAt, intersectsRange } from './time-parser';
import "leaflet/dist/leaflet.css";

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
    const hasRpp =
        !!(props?.rpparea1 || props?.rpparea2 || props?.rpparea3 || props?.rpp_sym || props?.sym_rpp2);
    const hasTimeLimit = !!(props?.hrlimit || props?.hours);

    if (/no\s*parking|tow-?away/.test(text)) return "NoParking";
    if (/commercial|truck|taxi|permit\s*only|loading/.test(text)) return "PermitOnly";
    if (hasRpp) return "RPP";
    if (hasTimeLimit || /time\s*limit|\b\d+\s*(min|hour|hr|h)\b/.test(text)) return "TimeLimit";
    return "Unknown";
}

function styleForFeature(feature, showInactiveDim) {
    const props = feature.properties;
    const cls = classifyRegulation(props);
    const baseStyle = (() => {
        switch (cls) {
            case "NoParking": return { color: "#d73027", weight: 4 }; // Red
            case "TimeLimit": return { color: "#fc8d59", weight: 3 }; // Orange
            case "RPP": return { color: "#4575b4", weight: 3 };       // Blue
            case "PermitOnly": return { color: "#7b3294", weight: 3 };// Purple
            default: return { color: "#999999", weight: 2 };          // Grey
        }
    })();

    if (showInactiveDim && !props._isActive) {
        return { ...baseStyle, opacity: 0.3, dashArray: '5, 5' };
    }
    return baseStyle;
}

// Legend Component
function Legend() {
    const items = [
        ["#d32f2f", "No Parking / Tow-away"],
        ["#fb8c00", "Time Limit"],
        ["#1e88e5", "RPP"],
        ["#8e24aa", "Permit Only"],
        ["#9e9e9e", "Unknown/Other"],
    ];
    return (
        <div style={{
            position: "absolute", left: 12, bottom: 12,
            background: "rgba(255,255,255,0.9)", borderRadius: 12,
            padding: 10, fontSize: 12, boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
        }}>
            <b>Legend</b>
            <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0 0" }}>
                {items.map(([color, label]) => (
                    <li key={label} style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ width: 14, height: 6, background: color, marginRight: 6 }}></span>
                        {label}
                    </li>
                ))}
            </ul>
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
        mode: 'now',
        atTime: toLocalISOString(new Date()),
        rangeStart: toLocalISOString(new Date()),
        rangeEnd: toLocalISOString(new Date(Date.now() + 3600 * 1000)),
        respectRPP: false,
        showInactiveDim: true,
        token: "",
        limit: 2000,
    });

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

    const processedGeojson = useMemo(() => {
        if (!geojson) return null;

        const featuresWithStatus = geojson.features.map(f => {
            let isActive;
            const props = f.properties;

            if (filters.mode === 'now') {
                isActive = true; // In 'Now' mode, show everything as active
            } else if (filters.mode === 'at') {
                isActive = isActiveAt(props, new Date(filters.atTime));
            } else { // 'range'
                isActive = intersectsRange(props, new Date(filters.rangeStart), new Date(filters.rangeEnd));
            }

            // Handle RPP permit assumption
            const cls = classifyRegulation(props);
            if (filters.respectRPP && cls === 'RPP') {
                 const exceptions = (props.exceptions || '').toLowerCase();
                 if (exceptions.includes('rpp exempt')) {
                    isActive = false; // User can park here
                 }
            }

            return { ...f, properties: { ...props, _isActive: isActive } };
        });

        const filteredFeatures = filters.showInactiveDim
            ? featuresWithStatus
            : featuresWithStatus.filter(f => f.properties._isActive);

        return { type: "FeatureCollection", features: filteredFeatures };
    }, [geojson, filters]);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            <MapContainer center={[37.7749, -122.4194]} zoom={15} className="map" style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {processedGeojson && (
                    <GeoJSON
                        key={JSON.stringify(filters)} // Re-render when filters change
                        data={processedGeojson}
                        style={(f) => styleForFeature(f, filters.showInactiveDim)}
                        onEachFeature={(f, layer) => {
                            const p = f.properties || {};
                            const statusText = p._isActive ? 'ACTIVE' : 'INACTIVE';
                            layer.bindPopup(`
                                <b>${classifyRegulation(p)} - ${statusText}</b><br/>
                                ${p.regulation || "(no text)"}<br/>
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

            <Legend />
        </div>
    );
}