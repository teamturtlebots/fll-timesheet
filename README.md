# HourTrack

Offline-first PWA for logging FLL team hours (Name, Date, Activity, Duration, Comments, Week), exportable to `.xlsx` / `.csv`.

## Deploy to GitHub Pages
1. Create a new repo (or a folder in an existing one, e.g. `wangjia228-svg.github.io/HourTrack`).
2. Copy `index.html`, `app.js`, `manifest.json`, `sw.js` into it.
3. Push, then enable GitHub Pages on the `main` branch (root or `/docs`, whichever you push to).
4. Visit the Pages URL — "Add to Home Screen" on phones installs it like an app.

## Notes
- All data is stored locally per-device in `localStorage` — no backend, works offline once loaded.
- If you want cross-device sync later (like BARP has with Firestore), that's a clean next step — the entry schema (`name/date/activity/duration/comments/week`) is already flat and Firestore-friendly.
- Export matches your original sheet columns exactly: Name, Date, Activity, Duration (hours), Comments (optional), Week.
