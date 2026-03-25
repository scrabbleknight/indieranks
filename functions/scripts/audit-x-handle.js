import { getDb } from "../lib/admin.js";
import { auditHandleActivityAgainstX } from "../lib/x-sync.js";

const handle = process.argv[2];

if (!handle) {
  throw new Error("Usage: npm run audit:x:handle -- <x-handle>");
}

const result = await auditHandleActivityAgainstX(getDb(), handle);

console.log(`Handle: @${result.handle}`);
console.log(`Followers: ${result.followers}`);
console.log(`Fetched tweets: ${result.fetchedTweets}`);
console.log(`Pages fetched: ${result.pagesFetched}${result.truncated ? " (truncated)" : ""}`);
console.log(`Window start: ${result.stopAt}`);
console.table([
  {
    source: "stored",
    postsLast7d: result.stored.postsLast7d,
    repliesLast7d: result.stored.repliesLast7d,
    authoredTweetsLast7d: result.stored.postsLast7d + result.stored.repliesLast7d,
    authoredTweetsPrevious7d: "—",
    engagementRate: result.stored.engagementRate,
    momentum7d: result.stored.momentum7d,
  },
  {
    source: "live",
    summarizedPostsLast7d: result.live.summarizedPostsLast7d,
    summarizedRepliesLast7d: result.live.summarizedRepliesLast7d,
    postsLast7d: result.live.postsLast7d,
    repliesLast7d: result.live.repliesLast7d,
    authoredTweetsLast7d: result.live.authoredTweetsLast7d,
    authoredTweetsPrevious7d: result.live.authoredTweetsPrevious7d,
    engagementRate: result.live.engagementRate,
    momentum7d: result.live.momentum7d,
  },
]);
