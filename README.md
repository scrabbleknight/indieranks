# IndieRanks

Scrappy static MVP for a dark-mode indie hacker leaderboard built with plain HTML, Tailwind CDN, custom CSS, vanilla JavaScript, Firebase Auth stubs, and Firestore-backed reads/writes.

## Local run

Serve the folder with any static server:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173/index.html](http://localhost:4173/index.html).

## Firebase setup

1. The repo is already pointed at Firebase project `indieranks-681f1` in `.firebaserc`.
2. The web app config is embedded in `assets/js/firebase-config.js`.
3. If you need to swap projects later, override it by setting `window.INDIERANKS_FIREBASE_CONFIG` before that file loads.
4. Review `firestore.rules` before deploying.
5. Deploy with:

```bash
firebase deploy
```

## Collections used

- `projects`
- `founders`
- `submissions`
- `tinyWins`

The UI now reads only from Firestore. If the database is empty, the leaderboard shows empty states until the first real submission is written.
