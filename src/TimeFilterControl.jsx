import React from 'react';

const controlBoxStyle = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    zIndex: 1000,
    background: 'rgba(255,255,255,0.95)',
    padding: '16px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: '280px',
};

const toggleContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '2px solid #e0e0e0',
};

const toggleLabelStyle = {
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#333',
};

const toggleSwitchStyle = {
    position: 'relative',
    width: '48px',
    height: '24px',
    cursor: 'pointer',
};

const segmentControlStyle = {
    display: 'flex',
    background: '#f0f0f0',
    borderRadius: '6px',
    padding: '2px',
    gap: '2px',
};

const segmentButtonStyle = (isActive) => ({
    flex: 1,
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    background: isActive ? '#2196F3' : 'transparent',
    color: isActive ? 'white' : '#666',
    fontWeight: isActive ? 'bold' : 'normal',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '13px',
});

const inputGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
};

const inputLabelStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#555',
};

const inputStyle = {
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
};

const checkboxGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 0',
};

export default function TimeFilterControl({ filters, setFilters, status }) {
    const { simulationEnabled, simulationMode, atTime, rangeStart, rangeEnd, respectRPP, showInactiveDim } = filters;

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleToggleSimulation = () => {
        handleFilterChange('simulationEnabled', !simulationEnabled);
    };

    return (
        <div style={controlBoxStyle}>
            {/* Simulation Toggle */}
            <div style={toggleContainerStyle}>
                <span style={toggleLabelStyle}>Simulation</span>
                <label style={toggleSwitchStyle}>
                    <input
                        type="checkbox"
                        checked={simulationEnabled}
                        onChange={handleToggleSimulation}
                        style={{ display: 'none' }}
                    />
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: simulationEnabled ? '#2196F3' : '#ccc',
                        borderRadius: '12px',
                        position: 'relative',
                        transition: 'background 0.3s',
                    }}>
                        <div style={{
                            width: '20px',
                            height: '20px',
                            background: 'white',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: simulationEnabled ? '26px' : '2px',
                            transition: 'left 0.3s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }} />
                    </div>
                </label>
            </div>

            {/* Simulation Controls - Only show when enabled */}
            {simulationEnabled && (
                <>
                    {/* Mode Selector */}
                    <div style={segmentControlStyle}>
                        <button
                            style={segmentButtonStyle(simulationMode === 'at')}
                            onClick={() => handleFilterChange('simulationMode', 'at')}
                        >
                            At
                        </button>
                        <button
                            style={segmentButtonStyle(simulationMode === 'range')}
                            onClick={() => handleFilterChange('simulationMode', 'range')}
                        >
                            Range
                        </button>
                    </div>

                    {/* At Mode Input */}
                    {simulationMode === 'at' && (
                        <div style={inputGroupStyle}>
                            <label style={inputLabelStyle}>Select Time:</label>
                            <input
                                type="datetime-local"
                                value={atTime}
                                onChange={(e) => handleFilterChange('atTime', e.target.value)}
                                style={inputStyle}
                            />
                        </div>
                    )}

                    {/* Range Mode Inputs */}
                    {simulationMode === 'range' && (
                        <>
                            <div style={inputGroupStyle}>
                                <label style={inputLabelStyle}>From:</label>
                                <input
                                    type="datetime-local"
                                    value={rangeStart}
                                    onChange={(e) => handleFilterChange('rangeStart', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={inputGroupStyle}>
                                <label style={inputLabelStyle}>To:</label>
                                <input
                                    type="datetime-local"
                                    value={rangeEnd}
                                    onChange={(e) => handleFilterChange('rangeEnd', e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Additional Options */}
            <hr style={{border: 'none', borderTop: '1px solid #e0e0e0', margin: '4px 0'}}/>

            <div style={checkboxGroupStyle}>
                <input
                    type="checkbox"
                    id="respectRPP"
                    checked={respectRPP}
                    onChange={(e) => handleFilterChange('respectRPP', e.target.checked)}
                />
                <label htmlFor="respectRPP" style={{fontSize: '13px', color: '#333'}}>
                    Assume RPP Permit
                </label>
            </div>

            <div style={checkboxGroupStyle}>
                <input
                    type="checkbox"
                    id="showInactiveDim"
                    checked={showInactiveDim}
                    onChange={(e) => handleFilterChange('showInactiveDim', e.target.checked)}
                />
                <label htmlFor="showInactiveDim" style={{fontSize: '13px', color: '#333'}}>
                    Show Inactive (Dimmed)
                </label>
            </div>

            {/* Status */}
            <div style={{fontSize: '11px', textAlign: 'center', opacity: 0.6, marginTop: '4px'}}>
                {status}
            </div>
        </div>
    );
}
