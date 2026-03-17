# IndieRanks

A public leaderboard for small indie apps.

IndieRanks is a lightweight web app for tracking traction, comparing progress by bracket, and helping small products get discovered.

## Live demo

[https://indieranks.com](https://indieranks.com)

## Local run

Serve the repo with any static file server:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173/index.html](http://localhost:4173/index.html).

## Firebase setup

This repo ships with placeholder Firebase values on purpose. Use your own Firebase project before enabling reads, auth, or writes.

1. Create or select a Firebase project you control.
2. Add a web app in Firebase and copy its client config.
3. Update the placeholder values in `assets/js/firebase-config.js`, or inject `window.INDIERANKS_FIREBASE_CONFIG` before that file loads.
4. Point the Firebase CLI at your own project:

```bash
firebase login
firebase use your-firebase-project-id
```

5. Review `firestore.rules` before turning on public writes.

Notes:

- Firebase web app config is public by design. Do not treat it like a server secret.
- Never paste private API keys or admin credentials into the client.
- The default Firestore rules in this repo allow public reads for leaderboard data and authenticated creates for submissions.

## Deployment warning

Before you deploy, make sure you are logged into the correct Firebase account and the CLI is targeting your own project.

```bash
firebase projects:list
firebase use your-firebase-project-id
firebase deploy
```

This repo should not be deployed while still pointed at someone else’s Firebase project.

## Get listed

Submit your app here: [https://indieranks.com](https://indieranks.com)
