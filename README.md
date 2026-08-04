# HourTrack

Single-page PWA for logging FLL team hours — **Entry** tab (matrix/single entry + the entries list) and
**Summary** tab (charts). Data now lives in a shared Firebase database instead of local browser storage, so
everyone who opens the site sees the same, live-updating data — no login required.

## One-time setup (you do this once)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it
   anything (e.g. "hourtrack-turtlebots") → you can skip Google Analytics.
2. In the left sidebar: **Build → Firestore Database → Create database**. Choose a region close to you,
   start in **test mode** (we'll paste stricter-but-still-open rules next).
3. Still in Firestore, go to the **Rules** tab, delete what's there, and paste in the contents of
   `firestore.rules` from this folder. Click **Publish**.
4. Back in Project Overview, click the **`</>`** (web) icon to register a new web app (any nickname is fine,
   no need for Firebase Hosting). It'll show you a `firebaseConfig` object — copy it.
5. Open `firebase-config.js` in this folder and paste your copied values in over the `REPLACE_ME` placeholders.
6. Push everything to your repo and you're live.

## The access-control tradeoff

There's no sign-in — anyone who has the site's URL can view **and edit** the data, same as everyone using
one shared notebook. That's what makes setup this simple. If that ever becomes a problem (someone messing
with entries, etc.), the fix is tightening `firestore.rules` — worth asking me to add real login back if
that day comes.

## Deploy to GitHub Pages
1. Push `index.html`, `app.js`, `manifest.json`, `sw.js`, `firebase-config.js` (filled in) to a repo, e.g.
   `wangjia228-svg.github.io/HourTrack`. (`firestore.rules` doesn't need to be deployed — it only matters
   pasted into the Firebase Console, as in step 3 above.)
2. Enable GitHub Pages on that branch.
3. Share the link — everyone sees the same live data.

## Notes
- Column schema: Name, Date, Activity, Duration (hours), Comments (optional), Week.
- Week auto-calculates from date (Week 1 = 7/20/2026–7/26/2026).
- Weekly target = 8 hours × roster size (currently 7 kids = 56h/week).
- Firestore's client SDK caches data locally too, so the app still mostly works offline and syncs when
  back online.
