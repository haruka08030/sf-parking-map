import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";


const DATASET_ID = "hi6h-neyh"; // Use the source dataset ID
const GEOM_FIELD = "shape";

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

function styleForClass(cls) {
    switch (cls) {
        case "NoParking": return { color: "#d32f2f", weight: 4 };
        case "TimeLimit": return { color: "#fb8c00", weight: 3 };
        case "RPP": return { color: "#1e88e5", weight: 3 };
        case "PermitOnly": return { color: "#8e24aa", weight: 3 };
        default: return { color: "#9e9e9e", dashArray: "4 4", weight: 2 };
    }
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

    // Use Socrata's within_box for server-side spatial filtering
    if (bounds) {
        const { _northEast, _southWest } = bounds;
        const whereClause = `within_box(${GEOM_FIELD}, ${_northEast.lat}, ${_southWest.lng}, ${_southWest.lat}, ${_northEast.lng})`;
        params.set("$where", whereClause);
    }

    params.set("$limit", String(limit || 5000));

    const url = `${base}?${params.toString()}`;
    console.log("[SODA] GET", url);

    const res = await fetch(url, {
        headers: token ? { "X-App-Token": token } : {},
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("[SODA] Error", res.status, text);
        // If the query fails, it might be too large.
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
        showNoParking: true,
        showTimeLimit: true,
        showRPP: true,
        showPermit: true,
        token: "",
        limit: 2000,
    });

    const debouncedLoad = useDebouncedCallback(async ({ bounds }) => {
        try {
            setStatus("Loading...");
            const data = await fetchGeojson({
                bounds,
                limit: filters.limit,
                token: filters.token,
            });
            setGeojson(data);
            setStatus(`Loaded (${data.features?.length || 0})`);
        } catch (err) {
            console.error(err);
            setStatus("Error loading data");
        }
    }, 300);

    const filtered = useMemo(() => {
        if (!geojson) return null;
        return {
            type: "FeatureCollection",
            features: geojson.features.filter((f) => {
                const cls = classifyRegulation(f.properties);
                if (cls === "NoParking" && !filters.showNoParking) return false;
                if (cls === "TimeLimit" && !filters.showTimeLimit) return false;
                if (cls === "RPP" && !filters.showRPP) return false;
                if (cls === "PermitOnly" && !filters.showPermit) return false;
                return true;
            }),
        };
    }, [geojson, filters]);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            <MapContainer center={[37.7749, -122.4194]} zoom={15} className="map" style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {filtered && (
                    <GeoJSON
                        data={filtered}
                        style={(f) => styleForClass(classifyRegulation(f.properties))}
                        onEachFeature={(f, layer) => {
                            const p = f.properties || {};
                            layer.bindPopup(`
                <b>${classifyRegulation(p)}</b><br/>
                ${p.regulation || "(no text)"}<br/>
                Days: ${p.days || ""}  Hours: ${p.hours || ""}<br/>
                Limit: ${p.hrlimit || ""}<br/>
                RPP: ${[p.rpparea1, p.rpparea2, p.rpparea3].filter(Boolean).join(", ") || p.rpp_sym || p.sym_rpp2 || ""}<br/>
                Detail: ${p.regdetails || ""}<br/>
                Exceptions: ${p.exceptions || ""}<br/>
                </div>
              `);
                        }}
                    />
                )}
                <ViewportListener onMove={(b) => debouncedLoad({ bounds: b })} />
            </MapContainer>

            {/* Legend and Status Display */}
            <Legend />
            <div style={{
                position: "absolute", right: 12, top: 12,
                background: "rgba(255,255,255,0.9)",
                padding: "6px 10px", borderRadius: 8, fontSize: 12,
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
            }}>
                {status}
            </div>
        </div>
    );
}