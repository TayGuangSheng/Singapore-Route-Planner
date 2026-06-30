# Singapore Route Planner

Mobile-first delivery route planner for Singapore locations (postal codes or addresses). Built with React + Vite, Leaflet, and OneMap APIs.

## Requirements

- Node.js 18+
- OneMap account for exact drive routing
- Android Studio / Android SDK for native Android builds and AdMob testing

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

## Native Android and AdMob

AdMob banner ads run only in native Android/iOS builds, not in the Vercel web app. This project includes a Capacitor Android shell and a bottom banner integration through `@capacitor-community/admob`.

During development, the app uses Google's demo AdMob IDs when no production IDs are provided. Before publishing, replace them with your own AdMob app and banner IDs:

```bash
ADMOB_ANDROID_APP_ID=ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
VITE_ADMOB_ANDROID_BANNER_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
VITE_ADMOB_IOS_BANNER_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
VITE_ADMOB_USE_TEST_ADS=false
```

Build and sync the Android app:

```bash
npm run native:sync
npm run native:open:android
```

The banner is positioned at the bottom of the native app. When a route summary is visible, the summary bar is lifted above the ad so the banner does not cover route information.

If Gradle cannot find the Android SDK, set `ANDROID_HOME` or create `android/local.properties` with your SDK path, for example `sdk.dir=C\:\\Users\\YOUR_NAME\\AppData\\Local\\Android\\Sdk`.

## Notes

- Postal codes must be 6 digits (Singapore format), or you can enter full addresses.
- Locations are resolved through public OneMap Search. Full pasted Singapore addresses are resolved postal-first, then ranked by the address text.
- Exact drive route legs are requested through `/api/onemap-route`, which keeps the OneMap route token server-side.
- If OneMap drive routing is unavailable, the app falls back to approximate straight-line-based distance/time estimates so route planning still works.
- Do not put OneMap credentials in `VITE_*` variables. `VITE_*` values are public in browser builds.
- The app limits to 20 stops and enables optimization when you enter a start plus at least 1 stop or an end location.
- Navigation buttons open Google Maps or Waze directly via deep links.
- Drivers can save named common locations (for example `Home`, `Work`) and reuse them for Start/End; saved entries persist in browser storage.
- Web builds do not show AdMob because Google AdMob is a native mobile ads SDK. Use AdSense or another web ad product if you need ads on the hosted browser URL.
