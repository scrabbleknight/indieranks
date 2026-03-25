const rankingConfig = {
  thresholds: {
    rookieMaxFollowers: 5000,
    legendMinFollowers: 50000,
  },
  leaderboardSizes: {
    legends: 8,
    contenders: 10,
    rookies: 12,
  },
  search: {
    maxResults: 8,
  },
  movement: {
    unchangedLabel: "-",
  },
  legendOverrides: [],
  legacyBonus: [],
  candidatePool: {
    collection: "devCandidates",
    submissionCollection: "candidateSubmissions",
    defaultLegendPool: "legend",
    fullSyncSize: 40,
    shortlistSize: 10,
  },
  xBudget: {
    monthlySpendLimitUsd: 75,
    softTargetUsd: 55,
    shortlistOnlyUsageRatio: 0.75,
    freezeUsageRatio: 0.9,
  },
  scoreWeights: {
    legend: {
      shippingScore: 0.48,
      reachScore: 0.28,
      consistencyScore: 0.18,
      momentumScore: 0.06,
    },
    contender: {
      shippingScore: 0.4,
      reachScore: 0.2,
      consistencyScore: 0.28,
      momentumScore: 0.12,
    },
    rookie: {
      shippingScore: 0.42,
      consistencyScore: 0.4,
      momentumScore: 0.18,
    },
  },
  sections: {
    legend: {
      title: "Legends",
      eyebrow: "All-time indie names",
      copy: "The top 40 approved indie-dev candidates, ranked by real Product Hunt launch history, reach, recent output pace, and output momentum.",
    },
    contender: {
      title: "Contenders",
      eyebrow: "Momentum in motion",
      copy: "Mid-sized indie devs pairing public launches with strong output pace and visible momentum.",
    },
    rookie: {
      title: "Rookies",
      eyebrow: "Early before the breakout",
      copy: "Low-follower developers already shipping real products and outperforming their current audience size.",
    },
  },
};

export default rankingConfig;
export { rankingConfig };
