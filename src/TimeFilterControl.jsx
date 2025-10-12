import React from 'react';

const controlBoxStyle = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    zIndex: 1000, // Ensure it's on top of the map
    background: 'rgba(255,255,255,0.9)',
    padding: '12px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '300px',
};

const inputGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
};

const labelStyle = {
    fontWeight: 'bold',
    minWidth: '50px',
};

export default function TimeFilterControl({ filters, setFilters, status }) {
    const { mode, atTime, rangeStart, rangeEnd, respectRPP, showInactiveDim } = filters;

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div style={controlBoxStyle}>
            <div style={inputGroupStyle}>
                <label style={labelStyle}>Mode:</label>
                <select value={mode} onChange={(e) => handleFilterChange('mode', e.target.value)}>
                    <option value="now">Now</option>
                    <option value="at">At</option>
                    <option value="range">Range</option>
                </select>
            </div>

            {mode === 'at' && (
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>At:</label>
                    <input
                        type="datetime-local"
                        value={atTime}
                        onChange={(e) => handleFilterChange('atTime', e.target.value)}
                    />
                </div>
            )}

            {mode === 'range' && (
                <>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>From:</label>
                        <input
                            type="datetime-local"
                            value={rangeStart}
                            onChange={(e) => handleFilterChange('rangeStart', e.target.value)}
                        />
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>To:</label>
                        <input
                            type="datetime-local"
                            value={rangeEnd}
                            onChange={(e) => handleFilterChange('rangeEnd', e.target.value)}
                        />
                    </div>
                </>
            )}

            <div style={inputGroupStyle}>
                <input
                    type="checkbox"
                    id="respectRPP"
                    checked={respectRPP}
                    onChange={(e) => handleFilterChange('respectRPP', e.target.checked)}
                />
                <label htmlFor="respectRPP" style={{color: '#333'}}>Assume RPP Permit</label>
            </div>

            <div style={inputGroupStyle}>
                <input
                    type="checkbox"
                    id="showInactiveDim"
                    checked={showInactiveDim}
                    onChange={(e) => handleFilterChange('showInactiveDim', e.target.checked)}
                />
                <label htmlFor="showInactiveDim" style={{color: '#333'}}>Dim inactive rules</label>
            </div>

            <hr style={{border: 'none', borderTop: '1px solid #ccc', margin: '4px 0'}}/>
            <div style={{fontSize: '12px', textAlign: 'center', opacity: 0.7}}>{status}</div>
        </div>
    );
}
