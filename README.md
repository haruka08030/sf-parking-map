# SF Parking Map

An interactive web application for visualizing San Francisco parking regulations with time-based filtering.

## Features

- **Interactive Map**: View parking regulations on an interactive map powered by Leaflet and Mapbox
- **Time-Based Filtering**: Three viewing modes to help plan your parking
  - **At Mode** (default): Check parking availability at a specific date and time
  - **Range Mode**: See parking coverage over a time range
  - **Rules Mode**: View all parking regulations by type
- **Real-Time Data**: Loads parking regulation data from San Francisco Open Data API
- **Current Location**: Quickly jump to your current location on the map
- **Smart Classification**: Automatically categorizes regulations

## Technology Stack

- React 19 with Hooks
- Leaflet + react-leaflet for mapping
- Mapbox tiles for basemap
- SF Open Data (Socrata API)
- Vite for build tooling

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Mapbox API token ([Get free token](https://account.mapbox.com/))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sf-parking-map
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Mapbox token:
```bash
cp .env.example .env
# Edit .env and add your token
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173)

## Usage

### Viewing Modes

**At Mode** - Check parking availability at a specific time
- Blue = Can park (no restrictions or time-limited parking)
- Red = Cannot park (active no parking regulation)

**Range Mode** - See availability over a time range
- Blue = 100% free to park
- Yellow = Partially available
- Red = No parking allowed

**Rules Mode** - View regulation classifications
- Blue = No regulation
- Yellow = Time limited parking
- Red = Cannot park
- Grey = Unknown/Other

### Controls

- Pan/Zoom: Mouse or touch gestures
- Click line: View detailed regulation information
- Location button: Center map on your position
- Time panel: Change viewing mode and time

## Project Structure

```
sf-parking-map/
├── src/
│   ├── main.jsx              # App entry point
│   ├── SfParkingMap.jsx      # Main map component
│   ├── TimeFilterControl.jsx # Time filter UI
│   └── time-parser.js        # Time/day parsing logic
├── .env.example              # Environment template
└── package.json              # Dependencies
```

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## License

MIT License
