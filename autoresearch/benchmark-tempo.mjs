/**
 * BeatDet autoresearch tempo-only benchmark.
 *
 * Use this for onset, beat, and BPM-only experiments. Confirm winning changes
 * with the combined benchmark before keeping them.
 */

import benchmarkShared from './benchmarkShared.cjs';
import algorithmLoader from './algorithmLoader.cjs';

const { runTempoBenchmark } = benchmarkShared;
const { loadAlgorithmModule } = algorithmLoader;
const { algorithmPath, algorithmModule } = await loadAlgorithmModule();

console.log(`Algorithm file: ${algorithmPath}`);

await runTempoBenchmark({
  detectBpmFromMono: algorithmModule.detectBpmFromMono,
  mixDownToMono: algorithmModule.mixDownToMono,
});