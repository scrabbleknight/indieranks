import { normalizeHandle } from "../../../shared/ranking-engine.mjs";

const FUNCTION_REGION = "europe-west2";

function getFirebaseServices() {
  return (
    (window.IndieRanks &&
      typeof window.IndieRanks.getFirebaseServices === "function" &&
      window.IndieRanks.getFirebaseServices()) ||
    { db: null, auth: null }
  );
}

function normalizeWebsiteUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeProductHuntUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .slice(0, 80);
}

function getFunctionsBaseUrl() {
  const IndieRanks = window.IndieRanks || {};
  const override = String(window.INDIERANKS_FUNCTIONS_BASE_URL || IndieRanks.functionsBaseUrl || "").trim();
  if (override) {
    return override.replace(/\/+$/, "");
  }

  const projectId =
    IndieRanks.firebaseConfig &&
    typeof IndieRanks.firebaseConfig.projectId === "string" &&
    IndieRanks.firebaseConfig.projectId.trim();

  if (!projectId) {
    throw new Error("Firebase project config is missing, so the ranking sync endpoint could not be resolved.");
  }

  return `https://${FUNCTION_REGION}-${projectId}.cloudfunctions.net`;
}

function buildFunctionUrl(functionName) {
  return `${getFunctionsBaseUrl()}/${functionName}`;
}

async function ensureSignedIn(authHooks, auth) {
  if (auth && auth.currentUser) {
    return auth.currentUser;
  }

  if (!authHooks || typeof authHooks.signInAnonymously !== "function") {
    throw new Error("Firebase Auth is not available. Add your Firebase config before submitting a profile.");
  }

  const result = await authHooks.signInAnonymously();
  return result && result.user ? result.user : auth.currentUser;
}

export async function submitCandidateSubmission(formData = {}) {
  const handle = normalizeHandle(formData.handle);
  if (!handle) {
    throw new Error("Add a valid X handle first.");
  }

  const services = getFirebaseServices();
  if (!services.db || !services.auth || !window.firebase || !window.firebase.firestore) {
    throw new Error("Firestore is not available right now. Check the Firebase config and try again.");
  }

  const authHooks = window.IndieRanks && window.IndieRanks.authHooks;
  const currentUser = await ensureSignedIn(authHooks, services.auth);
  if (!currentUser || !currentUser.uid) {
    throw new Error("Could not sign you in to submit the profile.");
  }

  const submissionRef = services.db.collection("candidateSubmissions").doc();
  const serverTimestamp = window.firebase.firestore.FieldValue.serverTimestamp();
  await submissionRef.set({
    handle,
    note: String(formData.note || "").trim().slice(0, 400),
    websiteUrl: normalizeWebsiteUrl(formData.websiteUrl).slice(0, 300),
    productHuntUsername: normalizeProductHuntUsername(formData.productHuntUsername),
    status: "received",
    source: "homepage_add_profile",
    submitterUid: currentUser.uid,
    createdAt: serverTimestamp,
  });

  return {
    ok: true,
    handle,
    submissionId: submissionRef.id,
  };
}

export async function submitCandidateAndRank(formData = {}) {
  const handle = normalizeHandle(formData.handle);
  if (!handle) {
    throw new Error("Add a valid X handle first.");
  }

  const services = getFirebaseServices();
  if (!services.auth) {
    throw new Error("Firebase Auth is not available right now. Check the Firebase config and try again.");
  }

  const authHooks = window.IndieRanks && window.IndieRanks.authHooks;
  const currentUser = await ensureSignedIn(authHooks, services.auth);
  if (!currentUser || typeof currentUser.getIdToken !== "function") {
    throw new Error("Could not verify your sign-in session.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(buildFunctionUrl("submitCandidateProfileAndRank"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      handle,
      productHuntUsername: normalizeProductHuntUsername(formData.productHuntUsername),
      websiteUrl: normalizeWebsiteUrl(formData.websiteUrl).slice(0, 300),
      note: String(formData.note || "").trim().slice(0, 400),
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload && payload.error
        ? payload.error
        : "Could not fetch the profile from X right now."
    );
  }

  return {
    ok: true,
    handle,
    snapshotDate: payload.snapshotDate || "",
    cached: Boolean(payload.cached),
    ranked: payload.ranked || null,
    counts: payload.counts || null,
  };
}
