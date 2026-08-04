# HourTrack

Single-page PWA for logging FLL team hours, organized as two top-level tabs so it's easy to use on a phone:

- **📝 Entry** — Matrix Entry (grid of names × Robot/Project/Community, auto week, per-row + whole-save comments)
  or Single Entry, plus the full Entries list below it (filter, sort, edit, delete, export).
- **📊 Summary** — stats, hours by member (with activity breakdown), hours by activity (pie chart), weekly
  hours vs. target, and cumulative hours vs. target.

Data is stored in this browser's local storage — offline-first, no account needed, no backend.

## Deploy to GitHub Pages
1. Copy `index.html`, `app.js`, `manifest.json`, `sw.js` into a repo, e.g. `wangjia228-svg.github.io/HourTrack`.
2. Enable GitHub Pages on that branch.
3. Visit the Pages URL — "Add to Home Screen" installs it like a native app.

## Notes
- Column schema: Name, Date, Activity, Duration (hours), Comments (optional), Week.
- Week auto-calculates from date (Week 1 = 7/20/2026–7/26/2026).
- Weekly target = 8 hours × roster size (currently 7 kids = 56h/week).
