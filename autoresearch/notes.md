# Autoresearch Notes

Date: 2026-04-18
Branch: autoresearch/apr17
Current best commit: 1b457de

This file is a detailed working note for the BeatDet GiantSteps autoresearch run.
It is intentionally more verbose than the TSV ledgers. The TSV files remain the
machine-readable record of individual results; this file is the narrative and
engineering interpretation layer.

It also exists as a deliberate exception to the usual routine-search rule in
autoresearch/program.md that only autoresearch/algorithm.mjs should be edited.
The search itself still followed that rule. This file was created only because
the human explicitly requested a durable written record.

## 1. Current Snapshot

- Best combined score so far: 636/990 = 64.24%
- Best key score so far: 371/604 = 61.42%
- Best tempo score so far: 265/386 = 68.65%
- Tempo has not improved during the most recent continuation pass.
- The latest major improvement came entirely from the key-detection side.
- The current benchmark mirror in autoresearch/algorithm.mjs is materially ahead
  of the production TypeScript implementation in src/lib/keyDetection.ts and
  src/lib/beatDetection.ts. The wins have not yet been ported back.
- The branch-switch / stash incident did not damage the tracked winning baseline,
  but it did appear to wipe the local split ledgers. Those were restored from
  rerun baselines before continuing.

## 2. Current Best Algorithm State

The current accepted benchmark mirror in autoresearch/algorithm.mjs is:

```js
export const SETTINGS = {
  hopSize: 512,
  useSpectralFlux: true,
  smoothingWindow: 8,
  peakThreshold: 0.15,
  minBeatGap: 0.3,
  bpmMin: 55,
  bpmMax: 200,
};

export const BPM_PARAMS = {
  bpmRes: 0.5,
  sigma: 2.5,
  absMinHeight: 0.14,
  medianWindow: 16,
  slowTempoFloor: 80,
  strictHalfThreshold: 0.95,
  defaultDownThreshold: 0.30,
  sesqThreshold: 0.45,
  tripleThreshold: 0.70,
};

export const KEY_PARAMS = {
  fftSize: 8192,
  hopSize: 4096,
  fMin: 150,
  fMax: 2100,
  hpssH: 13,
  hpssP: 35,
  minorPriorBoost: 1.20,
};

export const KEY_MAJOR = [
  16.80, 0.86, 12.95, 1.41, 16.00, 11.93,
   1.25, 20.28,  1.80,  8.04,  0.62, 10.57,
];

export const KEY_MINOR = [
  22.00, 0.69, 12.99, 13.34, 1.07, 11.15,
  1.38, 21.07,  7.49,  1.53, 10.21,  0.92,
];
```

Important interpretation notes:

- Tempo is still driven by the earlier accepted improvements, not by the recent
  key-side work.
- The big current key win is not a profile tweak. It is a representation change:
  higher chroma FFT resolution plus retuned HPSS windows.
- The current high-resolution key configuration is both more accurate and faster
  than the immediately previous accepted baseline, because the chroma hop was
  doubled from 2048 to 4096 even while the FFT size increased.

## 3. Accepted Keep Timeline

The table below lists only accepted improvements from the combined ledger.

| Commit | Key | Tempo | Combined % | Accepted change |
|---|---:|---:|---:|---|
| 52f8292 | 250/604 | 253/386 | 50.81 | Baseline |
| 861954b | 300/604 | 253/386 | 55.86 | Swap b7 / leading-tone in Bellman-Budge minor profile |
| 3fa3361 | 300/604 | 259/386 | 56.46 | absMinHeight 0.25 -> 0.15 |
| df82051 | 327/604 | 259/386 | 59.19 | minorPriorBoost 1.10 |
| 0e265c8 | 330/604 | 259/386 | 59.49 | minorPriorBoost 1.15 |
| 2411ccf | 337/604 | 259/386 | 60.20 | minorPriorBoost 1.20 |
| 5bd1dd4 | 337/604 | 260/386 | 60.30 | defaultDownThreshold 0.40 -> 0.30 and sesqThreshold 0.60 -> 0.45 |
| 408fffc | 342/604 | 260/386 | 60.81 | minor root weight 18.16 -> 22.0 |
| 039f37d | 342/604 | 261/386 | 60.91 | sigma 1.5 -> 2.0 |
| 4570573 | 342/604 | 264/386 | 61.21 | sigma 2.0 -> 2.5 |
| 0234711 | 346/604 | 264/386 | 61.62 | hpssH 17 -> 25 |
| b1aa7ba | 349/604 | 262/386 | 61.72 | major third weight 13.49 -> 16.0 |
| 246624d | 349/604 | 264/386 | 61.92 | restore absMinHeight 0.10 -> 0.15 on newer stack |
| 1b992df | 349/604 | 265/386 | 62.02 | absMinHeight 0.15 -> 0.14 |
| 96549e2 | 350/604 | 265/386 | 62.12 | hpssH 25 -> 27 |
| 210f042 | 351/604 | 265/386 | 62.22 | hpssP 17 -> 19 |
| 1b457de | 371/604 | 265/386 | 64.24 | chroma FFT 8192, hop 4096, hpssH 13, hpssP 35 |

Key observations from the keep timeline:

- The early gains came from getting the minor-mode prior and the BPM harmonic
  correction logic into a better place.
- The mid-run gains came from HPSS and profile tuning.
- The latest and largest gain came from a higher-resolution chroma
  representation, not another profile-weight nudge.
- The tempo side has effectively been frozen at 265/386 since 1b992df.
- The jump from 210f042 to 1b457de is the single biggest recent leap:
  +20 exact key matches with tempo unchanged.

## 4. Program Workflow Notes

The search was run in the spirit of autoresearch/program.md:

- The tracked experiment file remained autoresearch/algorithm.mjs.
- The benchmark harness files were treated as fixed.
- Candidate branches of the algorithm were explored through ignored files under
  autoresearch/candidates/ so that parallel runs did not dirty the accepted
  baseline.
- Key-only and tempo-only split harnesses were used for fast search.
- Any targeted key-side or tempo-side winner was still gated by the combined
  benchmark before promotion.
- Results TSVs were kept local and not committed.

Important practical notes:

- After the branch switch / stash event, the live baseline was re-verified from
  git HEAD and autoresearch/algorithm.mjs rather than trusting old ledgers.
- key-baseline.log and tempo-baseline.log are historical snapshots from the
  restored 96549e2 baseline. They are useful context, but they are not the
  current HEAD behaviour anymore.
- On this Windows machine, node-web-audio-api benchmarking must construct
  AudioContext with sinkId: { type: 'none' } or decode-only runs may fail with
  DeviceNotAvailable.

## 5. Branch-Switch Recovery Notes

When the branch was switched away and back again:

- The tracked benchmark baseline survived intact.
- The branch remained usable and eventually advanced from 96549e2 to 210f042 and
  then to 1b457de.
- The missing local split ledgers were recreated from rerun baselines.

Restored live split baseline at the time of recovery:

- Key baseline: 350/604 exact, 105/604 close, 149/604 far, 57.95%
- Tempo baseline: 265/386 correct, 16/386 half, 28/386 double, 77/386 wrong,
  68.65%

Why this mattered:

- It proved that the search could continue safely without guessing.
- It avoided contaminating the later notes with stale or partially overwritten
  local files.

## 6. Detailed Recent Chronology

### 6.1 Restored Baseline Diagnostics at 96549e2

Key-only baseline snapshot:

- Exact: 350/604 (57.95%)
- Close: 105/604 (17.4%)
- Far: 149/604 (24.7%)
- Same-root mode flips: 29
- Cross-root mode flips: 90
- Same-mode wrong-root misses: 135

Top key confusions at that point:

- G minor -> Eb minor: 8
- C minor -> G minor: 7
- D minor -> A minor: 7
- Bb minor -> Eb minor: 6
- Ab minor -> Eb minor: 5
- B minor -> F# minor: 5
- C# minor -> E major: 5
- D minor -> Eb minor: 5

Tempo-only baseline snapshot:

- Correct: 265/386 (68.65%)
- Half: 16/386 (4.1%)
- Double: 28/386 (7.3%)
- Slow: 33/386 (8.5%)
- Fast: 44/386 (11.4%)

Largest tempo misses at that point:

- 210560: 158 vs 78, double, 102.6% error
- 3194652: 176 vs 87, double, 102.3% error
- 3343760: 176 vs 87, double, 102.3% error
- 3733281: 141 vs 70, double, 101.4% error
- 4091609: 161 vs 80, double, 101.3% error
- 172384: 169 vs 84, double, 101.2% error
- 3313129: 171 vs 85, double, 101.2% error
- 3649527: 181 vs 90, double, 101.1% error

Interpretation at that stage:

- Key still had obvious headroom.
- Tempo looked more plateaued and still skewed toward double / fast errors.
- Same-mode wrong-root minor confusions were the clearest key-side target.

### 6.2 Batch A: HPSS Vertical Sweep and Minor Flat-7 Probes

This batch tested whether the current local optimum still had a little more room
in HPSS vertical suppression or in the swapped minor b7 weight.

| Candidate | Key result | Decision | Note |
|---|---:|---|---|
| hpssP 17 -> 19 | 351/604, 58.11% | Targeted keep | Only real gain in batch |
| hpssP 17 -> 21 | 347/604, 57.45% | Discard | Regressed |
| minor flat-7 10.21 -> 10.80 | 350/604, 57.95% | Discard | Tied exact score |
| minor flat-7 10.21 -> 11.00 | 350/604, 57.95% | Discard | Tied exact score, fewer close hits |

Combined validation for the sole winner:

- Candidate: key-hpssP-19.mjs
- Combined score: 616/990 = 62.22%
- Key exact: 351/604
- Tempo correct: 265/386
- Runtime: 834.3 s

Outcome:

- Promoted into autoresearch/algorithm.mjs
- Committed as 210f042, "exp: raise autoresearch hpssP to 19"

Interpretation:

- The old horizontal HPSS gain at hpssH 27 still had a little remaining value on
  the vertical side.
- The minor flat-7 family was not the next productive axis.

### 6.3 Batch B: Minor-Profile Rebalance on 210f042

Once hpssP 19 became the new baseline, several minor-profile ideas that had been
promising conceptually were re-tested on the stronger stack.

| Candidate | Key result | Decision | Note |
|---|---:|---|---|
| minor root 22.00 -> 23.00 | 342/604, 56.62% | Discard | Strong regression |
| minor fifth 21.07 -> 20.50 | 344/604, 56.95% | Discard | Regression |
| root 23.00 plus fifth 20.50 | 342/604, 56.62% | Discard | Regression |
| minor third 13.34 -> 14.00 | 346/604, 57.28% | Discard | Still worse than baseline |

Interpretation:

- The scalar Bellman-Budge minor-profile neighbourhood around the accepted stack
  appears locally exhausted.
- The remaining errors were not simply fixed by pushing tonic / dominant / third
  weights around.

### 6.4 Batch C: Small Structural Ranking and Normalisation Heuristics

This batch tested whether the remaining errors came from result ranking rather
than from the chroma representation itself.

| Candidate | Key result | Decision | Note |
|---|---:|---|---|
| Tonic tie-break epsilon 0.005 | 346/604, 57.28% | Discard | Worse |
| Tonic tie-break epsilon 0.010 | 343/604, 56.79% | Discard | Worse |
| Frame-normalised chroma accumulation | 345/604, 57.12% | Discard | Worse |
| Frame-normalised chroma plus tie-break | 344/604, 56.95% | Discard | Worse |

Interpretation:

- Simple tie-break rules based on tonic energy were not enough.
- Per-frame L1-style normalisation did not improve the real confusion pattern.
- This made it more likely that the limiting factor was chroma representation,
  not result sorting.

### 6.5 Batch D: Local fMin Sweep and FFT-Bin Quantisation Insight

This batch tested whether the stronger HPSS stack could tolerate slightly more
low-frequency tonic content.

| Candidate | Key result | Decision | Note |
|---|---:|---|---|
| fMin 150 -> 145 | 351/604, 58.11% | Discard | Exact tie; effectively same active-bin floor |
| fMin 150 -> 140 | 316/604, 52.32% | Discard | Catastrophic |
| fMin 150 -> 135 | 316/604, 52.32% | Discard | Same catastrophic result as 140 |
| fMin 150 -> 130 | 316/604, 52.32% | Discard | Same catastrophic result as 140 |

Important insight:

- At the current FFT configuration, 145 Hz behaved the same as 150 Hz because it
  mapped to the same effective FFT-bin floor.
- Dropping to 140 Hz or lower moved the active-bin start by one effective bin and
  reintroduced enough low-frequency contamination to collapse key accuracy.

Interpretation:

- The existing 150 Hz cutoff was already positioned correctly relative to the
  FFT-bin grid.
- This killed the idea that a gentle fMin nudge was the next easy win.

### 6.6 Batch E: Dominant-Confusion Heuristics

Because the leading errors still looked like wrong-root minor confusions, this
batch tried to damp strong secondary fourth / fifth peaks or to penalise
candidate keys whose tonic was weaker than their dominant / fourth.

| Candidate | Key result | Decision | Note |
|---|---:|---|---|
| Dampen secondary fourth / fifth to 0.90 | 346/604, 57.28% | Discard | Worse |
| Dampen secondary fourth / fifth to 0.85 | 347/604, 57.45% | Discard | Worse |
| Root-clarity penalty | 344/604, 56.95% | Discard | Worse |
| Combined dampening plus clarity penalty | 343/604, 56.79% | Discard | Worse |

Interpretation:

- The confusion pattern was not solved by these relatively blunt tonic-versus-
  dominant heuristics.
- These experiments were still useful because they reduced the chance of wasting
  more time on that exact theory family.

### 6.7 Batch F: High-Resolution Chroma

This was the decisive batch.

The working idea was that the remaining same-mode wrong-root confusions might be
caused by insufficient chroma frequency resolution rather than by bad profile
weights. Two candidates were tested.

| Candidate | Key result | Runtime | Decision | Note |
|---|---:|---:|---|---|
| fftSize 8192, hopSize 4096, hpssH 13, hpssP 35 | 371/604, 61.42% | 424.4 s | Targeted keep | Massive gain, fast |
| fftSize 8192, hopSize 2048, hpssH 27, hpssP 35 | 371/604, 61.42% | 881.8 s | Discard | Equal score, far slower |

Why the faster variant won the gate:

- It matched the exact key score of the denser-hop variant.
- It ran in less than half the time for the key-only benchmark.
- It also ran much faster than the previous combined keep while improving
  accuracy.

Combined validation for the faster variant:

- Candidate: key-fft8192-hop4096-h13-p35-from210f042.mjs
- Combined score: 636/990 = 64.24%
- Key exact: 371/604
- Tempo correct: 265/386
- Combined runtime: 586.7 s

Compared with the previous accepted combined baseline 210f042:

- Combined score: 62.22% -> 64.24%
- Key exact: 351/604 -> 371/604
- Tempo correct: 265/386 -> 265/386
- Combined runtime: 834.3 s -> 586.7 s

Outcome:

- Promoted into autoresearch/algorithm.mjs
- Committed as 1b457de, "exp: raise chroma FFT to 8192"

This is the most important current note in the entire run.

## 7. Key Diagnostics Before and After the Latest Big Win

### 7.1 Before: Restored 96549e2 Baseline

- Exact: 350/604
- Close: 105/604
- Far: 149/604
- Same-root mode flips: 29
- Cross-root mode flips: 90
- Same-mode wrong-root: 135

Top confusions:

- G minor -> Eb minor: 8
- C minor -> G minor: 7
- D minor -> A minor: 7
- Bb minor -> Eb minor: 6
- Ab minor -> Eb minor: 5
- B minor -> F# minor: 5
- C# minor -> E major: 5
- D minor -> Eb minor: 5

### 7.2 After: High-Resolution 1b457de Candidate

Key-only run for the accepted high-resolution candidate:

- Exact: 371/604
- Close: 97/604
- Far: 136/604
- Same-root mode flips: 28
- Cross-root mode flips: 90
- Same-mode wrong-root: 115

Top confusions:

- Ab minor -> Eb minor: 7
- D minor -> A minor: 7
- C minor -> G minor: 6
- G minor -> Bb major: 6
- Bb minor -> Eb minor: 5
- C# minor -> E major: 5
- G minor -> Eb minor: 5
- A minor -> E minor: 4

### 7.3 Interpretation of the Delta

Compared with the restored 96549e2 key baseline:

- Exact improved by 21 tracks.
- Close decreased by 8 tracks.
- Far decreased by 13 tracks.
- Same-root mode flips improved only slightly, 29 -> 28.
- Cross-root mode flips were roughly unchanged, 90 -> 90.
- Same-mode wrong-root errors improved sharply, 135 -> 115.

The most important inference is this:

- The high-resolution chroma win mostly attacked wrong-root errors within the
  same mode, which is exactly what the confusion pattern suggested was still
  hurting the old baseline.

Secondary interpretation:

- Some former close misses became exact hits.
- The new representation also changed the shape of the residual mistakes. For
  example, G minor -> Eb minor became less dominant, while G minor -> Bb major
  became a more visible residual confusion.

## 8. Tempo Notes

### 8.1 Current Stable Tempo State

Tempo performance has remained unchanged through the latest accepted key wins:

- Correct: 265/386 = 68.65%
- Half: 16/386 = 4.1%
- Double: 28/386 = 7.3%
- Wrong (slow + fast): 77/386 = 19.9%

Stable current benchmark tempo constants:

- bpmRes: 0.5
- sigma: 2.5
- absMinHeight: 0.14
- medianWindow: 16
- slowTempoFloor: 80
- strictHalfThreshold: 0.95
- defaultDownThreshold: 0.30
- sesqThreshold: 0.45
- tripleThreshold: 0.70

Current tempo miss character:

- More double errors than half errors.
- More fast errors than slow errors.
- Several of the largest misses are clean octave mistakes around 2x.

### 8.2 Earlier Tempo-Lane Findings Worth Preserving

These notes come from the split-tempo lane and the running repo memory.

- absMinHeight 0.15 -> 0.14 was a real improvement and became part of the
  accepted baseline.
- absMinHeight 0.14 -> 0.13 was a real regression because it admitted too many
  weak onset peaks.
- defaultDownThreshold 0.35 tied the combined score and was not kept.
- defaultDownThreshold 0.25 regressed on the split tempo lane.
- slowTempoFloor 75 tied the baseline.
- peakThreshold 0.16 regressed.
- strictHalfThreshold 0.90 and 0.85 did not produce an accepted gain.
- medianWindow 14 and 18 did not improve tempo.
- hopSize 256 and 1024 were bad tempo candidates, effectively catastrophic
  relative to the current accepted setting.
- bpmRes 0.25 and 1.0 did not produce an accepted gain.

Working conclusion on tempo:

- The remaining tempo headroom is probably not in small scalar threshold nudges.
- The more likely future tempo wins are structural, for example onset signal
  design, histogram weighting, or harmonic correction logic.

## 9. Production Sync Gap

The benchmark mirror is ahead of the production app code.

Current production key-detection state in src/lib/keyDetection.ts still reflects
older values, including:

- KEY_MAJOR[4] = 13.49, not 16.00
- KEY_MINOR root = 18.16, not 22.00
- Original minor profile ordering, not the swapped natural-minor emphasis used in
  the accepted benchmark mirror
- HPSS_H_KERNEL = 17, not 13 or 27 depending on the benchmark stage
- HPSS_P_KERNEL = 17, not 35
- No 8192 / 4096 chroma configuration

Current production tempo-detection state in src/lib/beatDetection.ts also still
reflects older values, including:

- sigma = 1.5, not 2.5
- No benchmark mirror of the accepted harmonic-correction thresholds now present
  in autoresearch/algorithm.mjs

Implication:

- The application code is currently behind the benchmark mirror.
- The run is not fully harvested until the accepted constants and logic are
  ported back into the TypeScript implementation.

Important follow-up consequence:

- Tests and lint were not the gating mechanism for these latest benchmark-only
  wins, because the latest accepted changes only touched autoresearch/algorithm.mjs.
- Once the values are ported to src/lib/keyDetection.ts and src/lib/beatDetection.ts,
  npm test and npm run lint should be re-run.

## 10. Practical Engineering Notes

- The split result ledgers are worth preserving because they accelerate search
  and make it obvious which hypothesis families are already exhausted.
- The key-only and tempo-only logs are snapshots-in-time. Their filenames do not
  imply they always match current HEAD.
- Candidate files under autoresearch/candidates/ were essential for using spare
  CPU without repeatedly mutating the tracked baseline.
- The high-resolution 8192 / 4096 key representation is not just more accurate.
  It is operationally nicer because it is faster than the immediately previous
  combined baseline.

## 11. Recommended Next Directions

### 11.1 If Continuing Autoresearch

The most sensible next key-side directions now appear to be representation-level
ideas rather than more Bellman-Budge scalar nudges.

Good next experiments:

- HPCP-style pitch-class accumulation instead of nearest-bin rounding.
- Fractional pitch-class binning or weighted interpolation between neighbouring
  pitch classes.
- Spectral-peak emphasis before chroma accumulation.
- Alternative chroma normalisation after the now-accepted 8192 / 4096 front end.
- Re-testing frequency bounds only if tied to the new 8192 FFT bin geometry,
  not as raw low-cut nudges.

### 11.2 If Porting Wins Back to the App

The immediate porting targets are:

- src/lib/keyDetection.ts
- src/lib/beatDetection.ts

Porting priority should be:

- Key-side representation change first, because it produced the biggest gain.
- Tempo-side accepted constants second, because they have been stable for a long
  time and do not need more rediscovery.

### 11.3 If Refocusing on Tempo

Tempo probably needs structural work rather than more parameter nibbling.

Promising structural ideas:

- Revisit onset-signal construction.
- Try spectral whitening or band weighting in the onset path.
- Revisit the downward and upward harmonic correction rules with more context
  from the largest persistent octave errors.

## 12. Compact Summary for Fast Re-Orientation

If returning to this work later, the minimum set of facts to remember is:

- Current best branch state is commit 1b457de on autoresearch/apr17.
- Current best combined score is 636/990 = 64.24%.
- Tempo is flat at 265/386 and still skewed toward double / fast misses.
- The latest big improvement was not another profile tweak. It was a higher-
  resolution chroma representation: fftSize 8192, hopSize 4096, hpssH 13,
  hpssP 35.
- That change improved key from 351/604 to 371/604 and also cut combined runtime
  from 834.3 s to 586.7 s versus the previous accepted combined baseline.
- Many nearby minor-profile, tie-break, normalisation, dominant-penalty, and
  low-cut experiments have already been ruled out.
- The production TypeScript implementation has not yet been updated to match the
  benchmark mirror.
