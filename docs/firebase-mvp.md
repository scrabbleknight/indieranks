# Firebase MVP Notes

## Firestore collections

Use these collections for the developer-ranking MVP:

`/devs/{handle}`

```json
{
  "handle": "levelsio",
  "displayName": "Pieter Levels",
  "avatarUrl": "https://api.dicebear.com/...",
  "bio": "Bootstrapped founder...",
  "followers": 265000,
  "category": "legend",
  "isLegendOverride": true,
  "xUserId": "levelsio",
  "website": "https://levels.io",
  "createdAt": "2026-03-23T08:00:00.000Z",
  "updatedAt": "2026-03-23T08:00:00.000Z"
}
```

`/devMetrics/{handle}`

```json
{
  "postsLast7d": 14,
  "repliesLast7d": 26,
  "avgLikesPerPost": 1800,
  "avgRepliesPerPost": 110,
  "avgRepostsPerPost": 92,
  "avgQuotesPerPost": 45,
  "engagementRate": 0.021,
  "momentum7d": 18,
  "productsShipped": 18,
  "activeProducts": 7,
  "launchesLast12m": 4,
  "productImpactScore": 98,
  "legendScore": 663.76,
  "contenderScore": 615.84,
  "rookieScore": 702.86,
  "overallCategory": "legend",
  "movement": "+1",
  "snapshotDate": "2026-03-23"
}
```

`/rankSnapshots/{date}/rows/{handle}`

```json
{
  "handle": "levelsio",
  "rank": 1,
  "category": "legend",
  "score": 663.76,
  "previousRank": 2,
  "movement": "+1"
}
```

## Hosting and Functions

- Hosting serves the static MVP pages directly from the repo root.
- `firebase.json` rewrites `/small-dev-leaderboard` to `small-dev-leaderboard.html`.
- `functions/index.js` exposes `refreshIndieDevRankings` as a simple POST endpoint for recalculating scores and snapshots.

## Seed and refresh commands

Run these from the `functions/` directory after `npm install`:

```bash
npm run seed:devs
npm run rank:refresh
```

Pass a custom seed file if needed:

```bash
node ./scripts/import-seed.js ../data/dev-seed.json
```

## What is mock vs ready

- Homepage, profile page, search, and all three boards work with the bundled seed dataset now.
- Firestore loading is already wired on the client. If `devs` and `devMetrics` exist, the front end will prefer them over the local seed file.
- If Firestore `projects` exist, the ranking refresh now folds that product data into each developer's shipping/build signal automatically.
- `assets/js/dev-ranks/xApi.js` is a placeholder service layer. Swap its internals for real X API calls later without rewriting the page renderers.
