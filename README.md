# Singapore Route Planner

Mobile-first delivery route planner for Singapore locations (postal codes or addresses). Built with React + Vite, Leaflet, and OneMap APIs.

## Requirements

- Node.js 18+
- OneMap account for exact drive routing

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your OneMap credentials:

Create a `.env` file in the project root:

```bash
ONEMAP_EMAIL=YOUR_REGISTERED_ONEMAP_EMAIL
ONEMAP_EMAIL_PASSWORD=YOUR_ONEMAP_PASSWORD
```

3. Generate a server-side OneMap token:

```bash
npm run onemap:token
```

This writes `ONEMAP_API_TOKEN` to `.env`. OneMap tokens expire after 3 days, so rerun this command when the token expires. The token is used by the local `/api/onemap-route` proxy and is not exposed to browser code.

4. Start the dev server:

```bash
npm run dev
```

Open the local URL shown in the terminal. The app is optimized for mobile browsers.

## Checks

```bash
npm run check
```

This runs the regression tests and production build.

## Notes

- Postal codes must be 6 digits (Singapore format), or you can enter full addresses.
- Locations are resolved through public OneMap Search. Full pasted Singapore addresses are resolved postal-first, then ranked by the address text.
- Exact drive route legs are requested through `/api/onemap-route`, which keeps the OneMap route token server-side.
- If OneMap drive routing is unavailable, the app falls back to approximate straight-line-based distance/time estimates so route planning still works.
- Do not put OneMap credentials in `VITE_*` variables. `VITE_*` values are public in browser builds.
- The app limits to 20 stops and enables optimization when you enter a start plus at least 1 stop or an end location.
- Navigation buttons open Google Maps or Waze directly via deep links.
- Drivers can save named common locations (for example `Home`, `Work`) and reuse them for Start/End; saved entries persist in browser storage.
