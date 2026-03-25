import { getXUsage } from "../lib/x-api.js";

const daysArg = Number(process.argv[2] || 30);
const days = Number.isFinite(daysArg) && daysArg > 0 ? Math.min(daysArg, 90) : 30;
const usage = await getXUsage({ days });
const projectCap = Number(usage.projectCap || 0);
const projectUsage = Number(usage.projectUsage || 0);
const remaining = Math.max(0, projectCap - projectUsage);
const usageRatio = projectCap > 0 ? projectUsage / projectCap : 0;

let recommendation = "Full legend refresh is available.";
if (usageRatio >= 0.9) {
  recommendation = "Freeze full legend syncs and only audit one handle at a time until reset.";
} else if (usageRatio >= 0.75) {
  recommendation = "Use shortlist syncs only (top 10) until the cap resets.";
} else if (usageRatio >= 0.5) {
  recommendation = "Prefer profile refreshes and targeted shortlist syncs over full legend sweeps.";
}

console.log(`Days inspected: ${days}`);
console.log(`Project cap: ${projectCap}`);
console.log(`Project usage: ${projectUsage}`);
console.log(`Remaining usage: ${remaining}`);
console.log(`Cap reset day: ${usage.capResetDay || "unknown"}`);
console.log(`Recommendation: ${recommendation}`);
