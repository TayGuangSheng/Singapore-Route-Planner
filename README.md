# Singapore Route Planner

Mobile-first delivery route planner for Singapore locations (postal codes or addresses). Built with React + Vite and Google Maps APIs.

## Requirements

- Node.js 18+
- Google Maps API key with these APIs enabled:
  - Maps JavaScript API
  - Geocoding API
  - Distance Matrix API
  - Directions API

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your API key:

Create a `.env` file in the project root:

```bash
VITE_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
```

3. Start the dev server:

```bash
npm run dev
```

Open the local URL shown in the terminal. The app is optimized for mobile browsers.

## Notes

- Postal codes must be 6 digits (Singapore format), or you can enter full addresses.
- The app limits to 20 stops and disables optimization until at least 2 stops are provided.
- Navigation buttons open Google Maps or Waze directly via deep links.
- Drivers can save named common locations (for example `Home`, `Work`) and reuse them for Start/End; saved entries persist in browser storage.
