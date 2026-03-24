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
  legendOverrides: ["levelsio", "marclou", "dannypostmaa"],
  legacyBonus: [
    { minFollowers: 50000, points: 20 },
    { minFollowers: 20000, points: 10 },
  ],
  scoreWeights: {
    legend: {
      shippingScore: 0.4,
      reachScore: 0.2,
      engagementScore: 0.18,
      consistencyScore: 0.1,
      qualityScore: 0.07,
      momentumScore: 0.05,
    },
    contender: {
      shippingScore: 0.35,
      reachScore: 0.12,
      engagementScore: 0.18,
      consistencyScore: 0.14,
      qualityScore: 0.14,
      momentumScore: 0.07,
    },
    rookie: {
      shippingScore: 0.35,
      engagementScore: 0.22,
      consistencyScore: 0.18,
      qualityScore: 0.15,
      momentumScore: 0.1,
    },
  },
  sections: {
    legend: {
      title: "Legends",
      eyebrow: "All-time indie names",
      copy: "Established builders with real product output, proven reach, and a long track record of shipping in public.",
    },
    contender: {
      title: "Contenders",
      eyebrow: "Momentum in motion",
      copy: "Mid-sized indie devs pairing consistent product launches with strong engagement and visible momentum.",
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
