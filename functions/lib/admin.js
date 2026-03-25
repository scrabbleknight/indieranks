import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAppInstance() {
  if (!getApps().length) {
    initializeApp();
  }

  return getApps()[0];
}

export function getDb() {
  const app = getAppInstance();

  return getFirestore(app);
}

export function getAdminAuth() {
  const app = getAppInstance();
  return getAuth(app);
}
