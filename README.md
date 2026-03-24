# IndieRanks

IndieRanks is now an MVP for ranking indie developers on X, not just indie projects.

## What ships in this repo

- New homepage with three always-visible buckets: Legends, Contenders, and Rookies
- Developer profile pages at `dev.html?handle=levelsio`
- Original project leaderboard moved to `small-dev-leaderboard.html`
- Shared scoring engine and config in `shared/`
- Seed data in `data/dev-seed.json`
- Firebase Hosting + Firestore-ready client store
- Seed import and ranking refresh tooling in `functions/`
- Developer scoring now blends X performance with product shipping/build signals

## Local run

Serve the repo with any static server:

```bash
python3 -m http.server 4173
```

Then open:

- `http://localhost:4173/index.html`
- `http://localhost:4173/small-dev-leaderboard.html`
- `http://localhost:4173/dev.html?handle=levelsio`

## Firebase setup

Client config lives in `assets/js/firebase-config.js`.

1. Create or select your Firebase project.
2. Replace the client config values in `assets/js/firebase-config.js`, or inject `window.INDIERANKS_FIREBASE_CONFIG` before it loads.
3. Review `firestore.rules`.
4. Deploy hosting, Firestore rules, and functions with the Firebase CLI.

The front end will use Firestore if `devs` and `devMetrics` exist. Otherwise it falls back to the bundled seed JSON.

## Functions and seed tooling

Install dependencies inside `functions/`:

```bash
cd functions
npm install
```

Seed the mock directory into Firestore:

```bash
npm run seed:devs
```

Recalculate scores and rank snapshots from Firestore:

```bash
npm run rank:refresh
```

## Firestore schema notes

See [docs/firebase-mvp.md](./docs/firebase-mvp.md) for the collection structure, hosting notes, and how the snapshot documents are written.
