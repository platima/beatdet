/**
 * BeatDet autoresearch key-only benchmark.
 *
 * Use this for key-profile and chroma-only experiments. Confirm winning changes
 * with the combined benchmark before keeping them.
 */

import benchmarkShared from './benchmarkShared.cjs';
import algorithmLoader from './algorithmLoader.cjs';

const { runKeyBenchmark } = benchmarkShared;
const { loadAlgorithmModule } = algorithmLoader;
const { algorithmPath, algorithmModule } = await loadAlgorithmModule();

console.log(`Algorithm file: ${algorithmPath}`);

await runKeyBenchmark({
  detectKeyFromMono: algorithmModule.detectKeyFromMono,
  mixDownToMono: algorithmModule.mixDownToMono,
  camelotDistance: algorithmModule.camelotDistance,
});