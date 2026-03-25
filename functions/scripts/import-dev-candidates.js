import { getDb } from "../lib/admin.js";
import { importCandidatePool } from "../lib/candidate-pool.js";

const result = await importCandidatePool(getDb());

console.log(`Imported candidates: ${result.candidates.length}`);
console.log(`Pool: ${result.pool}`);
if (result.notes) {
  console.log(`Notes: ${result.notes}`);
}
