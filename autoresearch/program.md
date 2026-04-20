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
  - `autoresearch/benchmark.mjs` — combined acceptance harness.
  - `autoresearch/benchmark-key.mjs` — key-only harness for targeted key runs.
  - `autoresearch/benchmark-tempo.mjs` — tempo-only harness for targeted tempo runs.
  - `autoresearch/benchmarkShared.cjs` — shared fixed scoring and diagnostics.
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
- Modify `autoresearch/benchmark.mjs`, `benchmark-key.mjs`, `benchmark-tempo.mjs`,
  or `benchmarkShared.cjs` during routine search runs. They are fixed harnesses.
- Modify `autoresearch/program.md`. It is the instruction set.
- Modify `src/lib/beatDetection.ts` or `src/lib/keyDetection.ts` during experiments.
  These are kept in sync with the winning `algorithm.mjs` only AFTER a run concludes.
- Install new npm packages. Only packages already in `package.json` (`node-web-audio-api`
  is the key one) are available to the benchmark.

---

## The metric

Run the combined acceptance benchmark with:

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

For targeted runs, use:

```powershell
node autoresearch/benchmark-key.mjs > key.log 2>&1
node autoresearch/benchmark-tempo.mjs > tempo.log 2>&1
```

For parallel candidate runs, point a harness at a different algorithm file:

```powershell
$env:AUTORESEARCH_ALGORITHM = 'autoresearch/candidates/tempo-candidate-a.mjs'
node autoresearch/benchmark-tempo.mjs > candidate-a.log 2>&1
```

or pass the path as the first argument:

```powershell
node autoresearch/benchmark-key.mjs autoresearch/candidates/key-candidate-a.mjs > candidate-a.log 2>&1
```

Use the split harnesses to explore one subsystem at a time, but always confirm any
candidate keep with the combined benchmark before advancing.

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

Use three local TSV logs:

- `results-combined.tsv` for combined acceptance runs
- `results-key.tsv` for key-only targeted runs
- `results-tempo.tsv` for tempo-only targeted runs

Each file is tab-separated (NOT comma-separated). Baseline columns:

```
commit	key	tempo	combined_pct	status	description
```

Suggested split columns:

```text
results-key.tsv:    commit	key_correct	key_close	key_far	key_pct	status	description
results-tempo.tsv:  commit	tempo_correct	tempo_half	tempo_double	tempo_wrong	tempo_pct	status	description
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

Do NOT commit result TSVs — leave them untracked.

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
5. Choose the right harness:
  - Key-only change: `node autoresearch/benchmark-key.mjs > key.log 2>&1`
  - Tempo-only change: `node autoresearch/benchmark-tempo.mjs > tempo.log 2>&1`
  - Shared preprocessing or uncertain scope: `node autoresearch/benchmark.mjs > run.log 2>&1`
  - For parallel search, clone `algorithm.mjs` into ignored candidate files and run
    multiple harnesses concurrently via `AUTORESEARCH_ALGORITHM` or the first CLI arg.
6. Check:
   ```
   Select-String "^SCORE" run.log
   ```
  If the grep returns nothing, the run crashed. Check the tail of the relevant log.
7. Log the result to the matching split TSV.
8. If the targeted metric improved, run the combined benchmark as the final gate.
9. **If combined `pct` improved** → advance (keep the commit).
10. **If the combined `pct` is equal or worse** → revert: `git reset --hard HEAD~1`.

**NEVER STOP**: Once the loop has started, do not pause to ask whether to continue.
The human may be away. Run indefinitely until manually interrupted.
If you run out of obvious ideas, try: re-reading the academic literature referenced in
`src/lib/keyDetection.ts` (Bellman 2005, Budge 1943), trying minor profile variants,
experimenting with chroma normalisation schemes (L1, L2, log), or revisiting the BPM
harmonic correction logic.

**Simplicity criterion**: a small improvement from a simple change is better than the
same improvement from a complex one. A simplification that loses no accuracy is a win.

**Diagnostics matter**: use the richer split-benchmark output to direct the next run.
Examples:
- Many `Tempo half` misses suggest the BPM estimate is landing too slow.
- Many `Tempo double` misses suggest it is landing too fast.
- Repeated key confusion pairs suggest profile weights or mode bias issues.

---

## Lessons from previous runs

### Run 1: apr17 (April 2026)

**Starting baseline:** 50.81% combined (250/604 key, 253/386 tempo)
**Final result:** 64.24% combined (371/604 key, 265/386 tempo)

#### What worked

- **Representation-level changes** produced the biggest single-step gains. The
  highest-impact change was raising chroma FFT from 4096 to 8192 (+20 key
  tracks in one step). Always consider whether a representation change could
  unlock more than scalar parameter nudges.
- **Split-lane harnesses** (key-only, tempo-only) were essential for fast
  iteration. A combined run takes 10-20 minutes; a split run takes 3-5 minutes.
- **Candidate files** under `autoresearch/candidates/` allowed parallel
  hypothesis testing without dirtying the tracked baseline. Clone
  `algorithm.mjs`, make the change, run the split harness, log the result.
- **Minor-prior boost** (1.20×) was a high-impact change that corrected the
  ~85% minor-key prevalence in the GiantSteps dataset.
- **Natural-minor profile swap** (b7/leading-tone weight swap) was a
  one-line fix that gained 50 key matches instantly.

#### What did not work (exhausted hypothesis families)

Do NOT re-run these experiments. They have already been explored and regressed
or tied the baseline. If you want to revisit any of these, you need a
structural change to the algorithm first, not another scalar nudge.

**Key-side exhausted:**
- Minor profile root weight beyond 22.00 (23.00 and 24.00 both regressed)
- Minor profile third weight beyond 13.34 (14.00 regressed)
- Minor profile fifth weight (20.50 and 21.50 both regressed or tied)
- Minor b7 weight nudges (10.80 and 11.00 both regressed)
- Minor Ab/A rebalancing (Dorian-style 5.0/4.5 regressed)
- Major root weight nudges (20.0 regressed)
- Major third weight beyond 16.00 (17.0 regressed)
- fMin below 150 Hz (145, 140, 135, 130 all regressed; 140 catastrophically)
- fMin above 150 Hz (175 regressed)
- fMax beyond 2100 Hz (2500 regressed)
- hpssH beyond 13 at the 8192 FFT (larger windows regressed)
- hpssP outside 35 at the 8192 FFT (both smaller and larger regressed)
- Tonic tie-break bonuses (0.05 and 0.10 both regressed)
- Fifth-dampen factors (0.85 and 0.90 both regressed)
- Root-clarity multipliers (0.92 regressed)
- Frame-level L1 chroma normalisation (regressed)
- minorPriorBoost above 1.20 (1.22 and 1.25 both regressed)
- Power spectrogram (squared magnitude) for chroma (regressed)

**Tempo-side exhausted:**
- absMinHeight outside 0.14 (0.13 regressed, 0.145 tied, 0.10 regressed)
- defaultDownThreshold outside 0.30 (0.25 regressed, 0.28 tied, 0.35 tied)
- strictHalfThreshold below 0.95 (0.90 and 0.85 did not improve)
- sigma outside 2.5 (1.0 and 3.0 both regressed, 2.0 is inferior)
- medianWindow outside 16 (14 and 18 both regressed or tied)
- hopSize outside 512 (256 and 1024 were catastrophic)
- bpmRes outside 0.5 (0.25 and 1.0 did not improve)
- peakThreshold 0.16 (regressed)
- smoothingWindow 12 (regressed)

#### What to try next

**Key-side (representation-level, not scalar nudges):**
- HPCP-style pitch-class accumulation (weighted interpolation between
  neighbouring pitch classes instead of nearest-bin rounding)
- Spectral peak emphasis before chroma accumulation
- Alternative chroma normalisation (L1, L2, log) with the 8192 FFT front end
- Re-test frequency bounds only if tied to new FFT bin geometry

**Tempo-side (structural, not threshold tweaking):**
- Band-limited spectral flux (e.g. 300-3000 Hz) to separate percussion from
  bass from treble
- Spectral whitening or band weighting in the onset signal path
- Rethink the harmonic correction rules specifically targeting the double-error
  cluster (28/386 = 7.3% of tracks falsely detected at 2× the true BPM)
- Autocorrelation-based BPM estimation as a verification layer
- Multi-resolution onset detection for waltzes and slow tracks

#### Practical notes for the next run

- **Recovery**: if you switch branches and come back, re-verify baselines from
  `git HEAD` and `algorithm.mjs` rather than trusting old local TSV files.
- **Runtime**: the combined benchmark (992 tracks) takes ~10-20 minutes. Kill
  catastrophic runs early (pct < 30% after 200 tracks).
- **HPSS retuning**: when the chroma FFT size changes, HPSS kernel sizes must
  be retuned because the time-frequency grid changed. Do not assume old kernel
  values transfer to a new FFT size.
- **Tempo is plateau'd**: do not spend more than 2-3 experiments on tempo
  threshold nudges. The remaining 121 tempo misses need structural work.
- **Port wins promptly**: after a run concludes, port winning constants back to
  src/lib/keyDetection.ts and src/lib/beatDetection.ts. Run `npm test` and
  `npm run lint` after porting. Update CLAUDE.md and README.md.
- **Notes file**: create `autoresearch/notes.md` at the end of every run
  documenting the journey, diagnostics, and exhausted families. This is
  invaluable for avoiding repeat work.

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
