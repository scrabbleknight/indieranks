function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

const seedProductSignals = {
  levelsio: { productsShipped: 18, activeProducts: 7, launchesLast12m: 4, productImpactScore: 98 },
  marclou: { productsShipped: 14, activeProducts: 6, launchesLast12m: 5, productImpactScore: 94 },
  dannypostmaa: { productsShipped: 12, activeProducts: 5, launchesLast12m: 4, productImpactScore: 90 },
  arvidkahl: { productsShipped: 8, activeProducts: 3, launchesLast12m: 2, productImpactScore: 78 },
  yongfook: { productsShipped: 7, activeProducts: 2, launchesLast12m: 2, productImpactScore: 82 },
  dagorenouf: { productsShipped: 10, activeProducts: 4, launchesLast12m: 3, productImpactScore: 80 },
  tibo_maker: { productsShipped: 9, activeProducts: 4, launchesLast12m: 4, productImpactScore: 79 },
  patwalls: { productsShipped: 5, activeProducts: 2, launchesLast12m: 2, productImpactScore: 88 },
  buildwithnina: { productsShipped: 7, activeProducts: 3, launchesLast12m: 4, productImpactScore: 74 },
  datadexter: { productsShipped: 6, activeProducts: 3, launchesLast12m: 3, productImpactScore: 70 },
  evanknowsgrowth: { productsShipped: 5, activeProducts: 2, launchesLast12m: 3, productImpactScore: 68 },
  makermaxwell: { productsShipped: 6, activeProducts: 3, launchesLast12m: 5, productImpactScore: 66 },
  julesbuilds: { productsShipped: 5, activeProducts: 2, launchesLast12m: 4, productImpactScore: 63 },
  noahsideproject: { productsShipped: 4, activeProducts: 2, launchesLast12m: 3, productImpactScore: 61 },
  shipfastsam: { productsShipped: 7, activeProducts: 3, launchesLast12m: 5, productImpactScore: 69 },
  hannahlaunches: { productsShipped: 4, activeProducts: 2, launchesLast12m: 4, productImpactScore: 60 },
  openloopdan: { productsShipped: 4, activeProducts: 2, launchesLast12m: 3, productImpactScore: 59 },
  microlaunchleo: { productsShipped: 6, activeProducts: 3, launchesLast12m: 5, productImpactScore: 64 },
  backendbenji: { productsShipped: 4, activeProducts: 2, launchesLast12m: 3, productImpactScore: 58 },
  pixelandprofit: { productsShipped: 4, activeProducts: 2, launchesLast12m: 3, productImpactScore: 57 },
  buildwitheva: { productsShipped: 4, activeProducts: 2, launchesLast12m: 4, productImpactScore: 55 },
  monobuilds: { productsShipped: 5, activeProducts: 2, launchesLast12m: 5, productImpactScore: 54 },
  leahships: { productsShipped: 4, activeProducts: 2, launchesLast12m: 4, productImpactScore: 52 },
  mikedebugs: { productsShipped: 3, activeProducts: 1, launchesLast12m: 4, productImpactScore: 50 },
  tinywinskai: { productsShipped: 3, activeProducts: 1, launchesLast12m: 3, productImpactScore: 47 },
  apiashley: { productsShipped: 4, activeProducts: 2, launchesLast12m: 3, productImpactScore: 49 },
  bootstrapbao: { productsShipped: 3, activeProducts: 1, launchesLast12m: 3, productImpactScore: 46 },
  launchlina: { productsShipped: 3, activeProducts: 2, launchesLast12m: 4, productImpactScore: 48 },
  shipwithsol: { productsShipped: 3, activeProducts: 1, launchesLast12m: 4, productImpactScore: 45 },
  indieowen: { productsShipped: 2, activeProducts: 1, launchesLast12m: 3, productImpactScore: 44 },
  devdahlia: { productsShipped: 3, activeProducts: 1, launchesLast12m: 3, productImpactScore: 43 },
  quietquestdev: { productsShipped: 2, activeProducts: 1, launchesLast12m: 2, productImpactScore: 42 },
  fullstackflo: { productsShipped: 3, activeProducts: 1, launchesLast12m: 4, productImpactScore: 44 },
  tinylabsrio: { productsShipped: 2, activeProducts: 1, launchesLast12m: 3, productImpactScore: 41 },
  nightbuildnico: { productsShipped: 2, activeProducts: 1, launchesLast12m: 3, productImpactScore: 40 },
};

export function getSeedProductSignals(handle) {
  return seedProductSignals[normalizeHandle(handle)] || null;
}

export { seedProductSignals };
