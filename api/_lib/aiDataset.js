// AI Sense — flattens the dashboard's raw per-tab KV data (design, std,
// process, social, stdtracker) into the normalized `datasets` map that
// aiQuery.js filters/aggregates over. Kept separate from aiQuery.js so the
// "what data exists" concern (this file) stays independent of the "how do we
// query it" concern (aiQuery.js).

import { getData } from './kv.js';

export async function buildDatasets() {
  const [design, std, process, social, stdtracker] = await Promise.all([
    getData('design'),
    getData('std'),
    getData('process'),
    getData('social'),
    getData('stdtracker'),
  ]);

  return {
    design: Array.isArray(design) ? design : [],

    // std sheet is fetched as two streams from the same spreadsheet:
    // BAU (business-as-usual UATs) and JLV (new product/launch UATs).
    std_bau: Array.isArray(std?.bau) ? std.bau : [],
    std_jlv: Array.isArray(std?.jlv) ? std.jlv : [],

    // process sheet is pre-aggregated by parseProcessSheet.js into four
    // blocks; expose each as its own queryable source.
    process_counts: Array.isArray(process?.counts) ? process.counts : [],
    process_productivity: Array.isArray(process?.teamProductivity) ? process.teamProductivity : [],
    process_tat: Array.isArray(process?.tat) ? process.tat : [],
    process_bvs: process?.bvs ? [process.bvs] : [],

    social: Array.isArray(social) ? social : [],
    stdtracker: Array.isArray(stdtracker) ? stdtracker : [],
  };
}
