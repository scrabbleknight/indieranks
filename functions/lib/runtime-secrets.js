import { defineSecret } from "firebase-functions/params";

export const X_BEARER_TOKEN_SECRET = defineSecret("X_BEARER_TOKEN");
export const TWITTER_BEARER_TOKEN_SECRET = defineSecret("TWITTER_BEARER_TOKEN");

export function readSecretValue(secret) {
  try {
    return String(secret.value() || "").trim();
  } catch (error) {
    return "";
  }
}
