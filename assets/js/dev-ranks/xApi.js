import { normalizeHandle } from "../../../shared/ranking-engine.mjs";
import { getHomeDataset, searchDevs } from "./store.js";

const POST_TEMPLATES = {
  levelsio: [
    "Shipping > planning. The internet still rewards velocity when the product is useful.",
    "A small product with strong distribution still beats a bigger idea with no audience.",
    "If your launch copy feels generic, your product probably does too.",
  ],
  marclou: [
    "Every launch gets easier once your audience trusts your taste, not just your product.",
    "The fastest way to grow is still shipping something people can describe in one sentence.",
    "Good products compound. Good distribution compounds faster.",
  ],
  dannypostmaa: [
    "People love AI demos. Customers pay for reliable workflows.",
    "Posting progress works best when the product keeps getting better in public too.",
    "The best launch asset is a result screenshot that needs no explanation.",
  ],
};

function compactPostNumber(value, multiplier) {
  return Math.max(1, Math.round((Number(value) || 0) * multiplier));
}

function getFallbackTemplates(dev) {
  return [
    `${dev.displayName} is sharing a sharp build-in-public update about ${dev.overallCategory === "rookie" ? "early traction" : "momentum and execution"}.`,
    `A practical lesson from ${dev.displayName}'s last 7 days of shipping, posting, and talking to users.`,
    `${dev.displayName} broke down what actually moved the needle this week and what they are changing next.`,
  ];
}

function buildPost(dev, text, index) {
  const postedAt = new Date(Date.now() - (index + 1) * 36 * 60 * 60 * 1000).toISOString();

  return {
    id: `${dev.handle}-${index + 1}`,
    text,
    postedAt,
    likes: compactPostNumber(dev.metrics.avgLikesPerPost, 0.92 - index * 0.08),
    replies: compactPostNumber(dev.metrics.avgRepliesPerPost, 0.96 - index * 0.07),
    reposts: compactPostNumber(dev.metrics.avgRepostsPerPost, 0.95 - index * 0.08),
    quotes: compactPostNumber(dev.metrics.avgQuotesPerPost, 0.9 - index * 0.08),
    url: `https://x.com/${dev.handle}`,
  };
}

export async function getUserByHandle(handle) {
  const dataset = await getHomeDataset();
  return dataset.byHandle[normalizeHandle(handle)] || null;
}

export async function getUserPosts(xUserId) {
  const dev = await getUserByHandle(xUserId);

  if (!dev) {
    return [];
  }

  const templates = POST_TEMPLATES[dev.handle] || getFallbackTemplates(dev);
  return templates.slice(0, 3).map((text, index) => buildPost(dev, text, index));
}

export async function searchIndieDevs(query) {
  return searchDevs(query);
}
