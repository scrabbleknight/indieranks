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

## Live X sync for Legends

The leaderboard UI already reads from Firestore. To make the Legends board live from X, sync the seeded legend handles into `devs` + `devMetrics`, then recalculate rankings.

From `functions/`:

```bash
npm install
export X_BEARER_TOKEN="your-x-bearer-token"
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/firebase-service-account.json"
npm run sync:x:legends
```

To sync only specific handles:

```bash
npm run sync:x:legends -- levelsio marclou
```

Notes:

- The homepage will now show live Firestore data for synced handles and keep the seed dataset as fallback for unsynced sections.
- X powers reach, activity, engagement, and momentum here. Shipping now comes only from real Firestore `projects`.
- `assets/js/dev-ranks/xApi.js` still uses placeholder profile posts, so the leaderboard can be live before the profile feed is.

## Product Hunt project import

Shipping now derives only from real `projects` in Firestore. To backfill those projects from Product Hunt, import launches where a tracked developer is explicitly listed as a maker and their Product Hunt maker profile exposes the same X handle.

From `functions/`:

```bash
npm install
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/firebase-service-account.json"
export PRODUCT_HUNT_BEARER_TOKEN="your-product-hunt-access-token"
npm run sync:product-hunt
```

You can also use Product Hunt OAuth client credentials instead of a bearer token:

```bash
export PRODUCT_HUNT_CLIENT_ID="your-client-id"
export PRODUCT_HUNT_CLIENT_SECRET="your-client-secret"
npm run sync:product-hunt
```

Useful options:

```bash
npm run sync:product-hunt -- levelsio marclou
npm run sync:product-hunt -- --posted-after 2020-01-01T00:00:00.000Z --max-pages 150
```

Notes:

- The importer is conservative by design: it only credits launches to developers who are explicitly listed as Product Hunt makers with a matching X handle.
- Imported projects are written into Firestore `projects`, stale importer-owned Product Hunt docs for the targeted handles are deleted, and rankings are recalculated afterward.
- Product Hunt data is now treated as a real verification source on the client and in Firestore rules.
- If Product Hunt redacts maker identities for your token, add verified launch slugs to `data/product-hunt-project-map.json`. The importer will fetch those launches directly by slug.

## Firestore schema notes

See [docs/firebase-mvp.md](./docs/firebase-mvp.md) for the collection structure, hosting notes, and how the snapshot documents are written.
