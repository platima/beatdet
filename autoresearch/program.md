# beatdet-autoresearch

AI-driven parameter optimisation for BeatDet's beat detection and key detection algorithms.
Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch).

---

## Setup

To set up a new experiment run:

1. **Agree on a run tag**: propose a tag based on today's date (e.g. `apr17`).
   The branch `autoresearch/<tag>` must not already exist.
2. **Create the branch**: `git checkout -b autoresearch/<tag>` from current main.
3. **Read the in-scope files**:
   - `autoresearch/program.md` — this file.
   - `autoresearch/algorithm.mjs` — the file you modify.
   - `autoresearch/benchmark.mjs` — the fixed evaluation harness (do NOT modify).
   - `src/lib/beatDetection.ts` — TypeScript source (read for context; update after wins).
   - `src/lib/keyDetection.ts` — TypeScript source (read for context; update after wins).
4. **Verify datasets exist**:
   - `testfiles/giantsteps-key-dataset/audio/` — 604 `.LOFI.mp3` files
   - `testfiles/giantsteps-tempo-dataset/audio/` — ~388 `.wav` files
   - If either directory is empty, the benchmark will still run but scores will be 0.
5. **Initialise results log**: create `autoresearch/results.tsv` with the header row
   (see "Logging results" below) if it does not already exist.
6. **Confirm and go**: establish the baseline score by running the benchmark as-is.

---

## What you can and cannot do

**You CAN:**
- Modify `autoresearch/algorithm.mjs` — this is the ONLY file you edit.
  Everything in it is fair game: algorithm logic, constants, tuning parameters,
  signal-processing steps, key profiles, BPM estimation strategy, etc.

**You CANNOT:**
- Modify `autoresearch/benchmark.mjs`. It is the fixed evaluation harness.
- Modify `autoresearch/program.md`. It is the instruction set.
- Modify `src/lib/beatDetection.ts` or `src/lib/keyDetection.ts` during experiments.
  These are kept in sync with the winning `algorithm.mjs` only AFTER a run concludes.
- Install new npm packages. Only packages already in `package.json` (`node-web-audio-api`
  is the key one) are available to the benchmark.

---

## The metric

Run the benchmark with:

```
node autoresearch/benchmark.mjs > run.log 2>&1
```

Extract the score:

```
Select-String "^SCORE" run.log
```

The output looks like:

```
SCORE key_correct=512/604 tempo_correct=280/388 combined=792/992 pct=79.84
```

**Goal: maximise `pct`** — the combined percentage of tracks where both key detection
(exact match) and tempo detection (within ±4%, P-score style) are correct.

Scoring detail:
- **Key — correct**: detected key matches annotated key (enharmonic-normalised;
  Db→C#, Gb→F# are treated as equivalent).
- **Tempo — correct**: detected BPM is within ±4% of the v2-annotated BPM.
- **Tempo — octave**: within ±4% of 2× or 0.5× the annotated BPM. These are counted
  separately and do NOT contribute to the combined `pct`. Reducing octave errors
  into exact-correct detections is worth pursuing.

Benchmark runtime on a modern laptop: approximately 10–20 minutes for all ~992 tracks.
If a run is clearly catastrophic (pct < 30%) after 200 tracks, kill it and discard.

---

## Logging results

`results.tsv` is tab-separated (NOT comma-separated). Columns:

```
commit	key	tempo	combined_pct	status	description
```

1. `commit` — git short hash (7 chars)
2. `key` — key_correct/604 (e.g. `512/604`)
3. `tempo` — tempo_correct/M (e.g. `280/388`)
4. `combined_pct` — the `pct` value from the SCORE line (e.g. `79.84`)
5. `status` — `keep`, `discard`, or `crash`
6. `description` — short text describing the experiment

Example:

```
commit	key	tempo	combined_pct	status	description
a1b2c3d	512/604	280/388	79.84	keep	baseline
b2c3d4e	519/604	283/388	81.10	keep	fMin 150→120 Hz
c3d4e5f	508/604	278/388	78.97	discard	KEY_MAJOR profile flatten
```

Do NOT commit `results.tsv` — leave it untracked.

---

## The experiment loop

LOOP FOREVER:

1. Inspect the current state of `algorithm.mjs` and `results.tsv`.
2. Form a hypothesis: what single change might improve the score?
   Good candidates:
   - Frequency bounds (`fMin`, `fMax`) for chroma extraction
   - HPSS kernel sizes (`hpssH`, `hpssP`)
   - Key profiles (`KEY_MAJOR`, `KEY_MINOR`) — small perturbations or alternative
     published profiles (Krumhansl-Kessler, Temperley, etc.)
   - Beat detection defaults: `hopSize`, `smoothingWindow`, `peakThreshold`
   - BPM estimation constants: `sigma`, `bpmRes`, correction thresholds
   - Novel signal-processing steps (e.g. spectral whitening before chroma,
     different windowing, onset detection variants)
3. Apply the change to `algorithm.mjs`.
4. `git commit` the change (so you can revert cleanly).
5. Run: `node autoresearch/benchmark.mjs > run.log 2>&1`
6. Check:
   ```
   Select-String "^SCORE" run.log
   ```
   If the grep returns nothing, the run crashed. Check `Select-Object -Last 50 run.log`.
7. Log the result to `results.tsv`.
8. **If `pct` improved** → advance (keep the commit).
9. **If `pct` equal or worse** → revert: `git reset --hard HEAD~1`.

**NEVER STOP**: Once the loop has started, do not pause to ask whether to continue.
The human may be away. Run indefinitely until manually interrupted.
If you run out of obvious ideas, try: re-reading the academic literature referenced in
`src/lib/keyDetection.ts` (Bellman 2005, Budge 1943), trying minor profile variants,
experimenting with chroma normalisation schemes (L1, L2, log), or revisiting the BPM
harmonic correction logic.

**Simplicity criterion**: a small improvement from a simple change is better than the
same improvement from a complex one. A simplification that loses no accuracy is a win.

**Crashes**: if the run errors out, fix the obvious bug and re-run. If the idea is
fundamentally broken, log `crash` and move on without reverting the fix.

---

## After the run

When you are done (or interrupted), port the winning `algorithm.mjs` constants back
to the TypeScript source files:

- Constants in Section A → update matching constants in `src/lib/beatDetection.ts`
  and `src/lib/keyDetection.ts`.
- Algorithmic changes in Sections C–E → port the logic to the TypeScript equivalents.
- Run `npm test` to confirm the existing test suite still passes.
- Commit the TypeScript changes on `main` with message `perf: autoresearch <tag> wins`.

---

## Tuning reference

Key parameters and their expected sensitivity:

| Parameter        | Section | Sensitivity | Notes |
|------------------|---------|-------------|-------|
| `KEY_MAJOR[12]`  | A       | HIGH        | Core correlation template; try Krumhansl-Kessler, Temperley variants |
| `KEY_MINOR[12]`  | A       | HIGH        | As above |
| `fMin`           | A       | MEDIUM      | Lower = more bass content; risk of kick bleed below 100 Hz |
| `fMax`           | A       | LOW         | Upper harmonics; rarely decisive for key |
| `hpssH`          | A       | MEDIUM      | Larger = more aggressive harmonic filtering |
| `hpssP`          | A       | MEDIUM      | Larger = broader percussive suppression |
| `peakThreshold`  | A       | MEDIUM      | Higher = fewer but more confident beats |
| `sigma`          | A       | LOW–MEDIUM  | Wider Gaussian = smoother BPM histogram |
| `sesqThreshold`  | A       | MEDIUM      | Controls ×1.5 octave correction aggressiveness |
| `strictHalfThreshold` | A  | MEDIUM      | Controls ×0.5 correction below 80 BPM |
