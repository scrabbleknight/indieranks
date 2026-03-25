import { normalizeHandle } from "../../../shared/ranking-engine.mjs";

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
