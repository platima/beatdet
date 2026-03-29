/**
 * Diagnostic probe — runs spectral-flux beat detection on all testfiles
 * and prints the top-5 BPM candidates so we can tune the algorithm.
 *
 * Run: node probe.mjs
 */
import { createRequire } from 'module';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { AudioContext } = require('node-web-audio-api');
const __dirname = dirname(fileURLToPath(import.meta.url));

/* ---- Inline pure functions (mirrors beatDetection.ts) ---- */

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len >> 1; j++) {
        const uRe = re[i+j], uIm = im[i+j];
        const vRe = re[i+j+(len>>1)]*curRe - im[i+j+(len>>1)]*curIm;
        const vIm = re[i+j+(len>>1)]*curIm + im[i+j+(len>>1)]*curRe;
        re[i+j] = uRe+vRe; im[i+j] = uIm+vIm;
        re[i+j+(len>>1)] = uRe-vRe; im[i+j+(len>>1)] = uIm-vIm;
        const nr = curRe*wRe - curIm*wIm; curIm = curRe*wIm + curIm*wRe; curRe = nr;
      }
    }
  }
}

function spectralFlux(mono, sr, hopSize, loHz = 0, hiHz) {
  const fftSize = hopSize * 2;
  const halfBins = fftSize >> 1;
  const binHz = sr / fftSize;
  const loBin = Math.max(0, Math.floor(loHz / binHz));
  const hiBin = hiHz !== undefined ? Math.min(halfBins, Math.ceil(hiHz / binHz)) : halfBins;
  const numHops = Math.floor((mono.length - fftSize) / hopSize);
  if (numHops <= 0) return new Float32Array(0);
  const onsets = new Float32Array(numHops);
  const reB = new Float64Array(fftSize), imB = new Float64Array(fftSize);
  let prevMags = new Float32Array(hiBin - loBin);
  for (let hop = 0; hop < numHops; hop++) {
    const start = hop * hopSize;
    for (let n = 0; n < fftSize; n++) {
      const w = 0.5 * (1 - Math.cos(2*Math.PI*n/(fftSize-1)));
      reB[n] = mono[start+n]*w; imB[n] = 0;
    }
    fft(reB, imB);
    const mags = new Float32Array(hiBin - loBin);
    for (let k = loBin; k < hiBin; k++) mags[k-loBin] = Math.sqrt(reB[k]*reB[k]+imB[k]*imB[k]);
    if (hop > 0) { let flux = 0; for (let k = 0; k < mags.length; k++) { const d = mags[k]-prevMags[k]; if (d>0) flux+=d; } onsets[hop]=flux; }
    prevMags = mags;
  }
  return onsets;
}

function smooth(arr, w) {
  if (w<=1) return arr;
  const half = Math.floor(w/2), out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s=0,c=0; for (let j=Math.max(0,i-half); j<Math.min(arr.length,i+half+1); j++){s+=arr[j];c++;} out[i]=s/c;
  }
  return out;
}

function normalise(arr) {
  let max = 0; for (const v of arr) if (v>max) max=v;
  if (max===0) return arr;
  return arr.map(v => v/max);
}

function pickPeaks(onsets, thresh, minGap, absMin = 0.25) {
  const peaks = [], mw = 16; let last = -minGap;
  for (let i = 1; i < onsets.length-1; i++) {
    const v = onsets[i];
    if (v<=onsets[i-1]||v<=onsets[i+1]) continue;
    if (v < absMin) continue;   // absolute floor
    const ws=Math.max(0,i-mw), we=Math.min(onsets.length,i+mw);
    const win=[]; for(let j=ws;j<we;j++) win.push(onsets[j]); win.sort((a,b)=>a-b);
    const med = win[Math.floor(win.length/2)];
    if (v < med*(1+thresh)) continue;
    if (i-last < minGap) continue;
    peaks.push(i); last=i;
  }
  return peaks;
}

function estimateBpm(beatTimes, bpmMin, bpmMax) {
  if (beatTimes.length < 2) return { bpm: 0, candidates: [] };
  const minIoi=60/bpmMax, maxIoi=60/bpmMin;
  const weighted=[];
  for (let lag=1; lag<=3; lag++) {
    const lw=1/lag;
    for (let i=lag; i<beatTimes.length; i++) {
      const ioi=(beatTimes[i]-beatTimes[i-lag])/lag;
      if (ioi<minIoi||ioi>maxIoi) continue;
      weighted.push({bpm:60/ioi, weight:lw});
    }
  }
  if (weighted.length===0) return {bpm:0, candidates:[]};
  const bpmRes=0.5, sigma=1.5, numBins=Math.round((bpmMax-bpmMin)/bpmRes)+1;
  const hist=new Float64Array(numBins);
  const sigBins=sigma/bpmRes, rad=Math.ceil(sigBins*3);
  for (const {bpm,weight} of weighted) {
    const bc=(bpm-bpmMin)/bpmRes;
    for (let b=Math.max(0,Math.round(bc-rad)); b<=Math.min(numBins-1,Math.round(bc+rad)); b++) {
      hist[b]+=weight*Math.exp(-0.5*((b-bc)/sigBins)**2);
    }
  }
  const cands=[];
  for (let b=1;b<numBins-1;b++) if(hist[b]>hist[b-1]&&hist[b]>=hist[b+1]) cands.push({bpm:bpmMin+b*bpmRes,score:hist[b]});
  if (!cands.length) { let best=0; for(let b=1;b<numBins;b++) if(hist[b]>hist[best]) best=b; cands.push({bpm:bpmMin+best*bpmRes,score:hist[best]}); }
  cands.sort((a,b)=>b.score-a.score);
  return { bpm: Math.round(cands[0].bpm), candidates: cands.slice(0,8).map(c=>({bpm:Math.round(c.bpm),score:c.score.toFixed(2)})) };
}

/* ---- Main ---- */

async function probe(filename, expectedBpm, hopSize = 512) {
  const filePath = join(__dirname, 'testfiles', filename);
  const raw = readFileSync(filePath);
  const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const ctx = new AudioContext();
  const buf = await ctx.decodeAudioData(ab);
  await ctx.close();

  const sr = buf.sampleRate;
  const ch = buf.numberOfChannels;
  const len = buf.length;

  // Mix to mono
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += d[i];
  }
  if (ch > 1) for (let i = 0; i < len; i++) mono[i] /= ch;

  const hopDur = hopSize / sr;
  const minGap025 = Math.max(1, Math.round(0.25 / hopDur));   // was 0.3
  const minGap030 = Math.max(1, Math.round(0.30 / hopDur));

  function run(label, loHz, hiHz, minGap) {
    const raw_onsets = spectralFlux(mono, sr, hopSize, loHz, hiHz);
    const smoothed = smooth(raw_onsets, 5);
    const normed = normalise(smoothed);
    const peaks = pickPeaks(normed, 0.15, minGap, 0.25);  // absMin=0.25
    const beatTimes = peaks.map(f => f * hopDur);
    const { bpm, candidates } = estimateBpm(beatTimes, 55, 215);
    const correct = Math.abs(bpm - expectedBpm) <= 5 ? '✓' : '✗';
    console.log(`  ${correct} [${label}] peaks=${peaks.length} → ${bpm} BPM  top: ${candidates.slice(0,5).map(c=>`${c.bpm}`).join('/')}`);

    // Tempogram check: DFT of onset curve at detected BPM and half-BPM
    if (bpm > 80) {
      const halfBpm = bpm / 2;
      const n = normed.length;
      const detFreq = bpm / 60; // Hz
      const halfFreq = halfBpm / 60;
      let rD = 0, iD = 0, rH = 0, iH = 0;
      for (let k = 0; k < n; k++) {
        const t = k * hopDur;
        rD += normed[k] * Math.cos(2 * Math.PI * detFreq * t);
        iD += normed[k] * Math.sin(2 * Math.PI * detFreq * t);
        rH += normed[k] * Math.cos(2 * Math.PI * halfFreq * t);
        iH += normed[k] * Math.sin(2 * Math.PI * halfFreq * t);
      }
      const magDet = Math.sqrt(rD*rD + iD*iD) / n;
      const magHalf = Math.sqrt(rH*rH + iH*iH) / n;
      const ratio = magHalf / Math.max(0.001, magDet);
      console.log(`    tempogram: mag@${bpm}=${magDet.toFixed(4)} mag@${halfBpm}=${magHalf.toFixed(4)} ratio=${ratio.toFixed(3)}`);
    }
    return bpm;
  }

  console.log(`\n${filename} (expected ${expectedBpm} BPM, gap025=${minGap025}f gap030=${minGap030}f):`);
  run('full flux h512, gap025', 0, undefined, minGap025);
  
  // Multi-resolution: larger hop merges close onsets, revealing structural beats
  const hopSize2 = 2048;
  const hopDur2 = hopSize2 / sr;
  const minGap2 = Math.max(1, Math.round(0.25 / hopDur2));
  const raw2 = spectralFlux(mono, sr, hopSize2);
  const sm2 = smooth(raw2, 3);
  const n2 = normalise(sm2);
  const pk2 = pickPeaks(n2, 0.15, minGap2, 0.25);
  const bt2 = pk2.map(f => f * hopDur2);
  const est2 = estimateBpm(bt2, 55, 215);
  console.log(`  [hop=2048] peaks=${pk2.length} → ${est2.bpm} BPM  top: ${est2.candidates.slice(0,5).map(c=>`${c.bpm}`).join('/')}`);
}

const files = [
  // Original 5
  ['Morning 60bpm.mp3', 60],
  ['Magic Escape Room 82bpm.mp3', 82],
  ['Southern Gothic 126bpm.mp3', 126],
  ['Boogie Party 178bpm.mp3', 178],
  ["Sergio's Magic Dustbin 204bpm.mp3", 204],
  // Batch 2
  ['Adeste Fideles Shorter 105bpm.mp3', 105],
  ['Burn The World Waltz 177bpm.mp3', 177],
  ['Dentaneosuchus Hunt 114bpm.mp3', 114],
  ['Evening 101bpm.mp3', 101],
  ['Grand Dark Waltz Trio Allegro 124bpm.mp3', 124],
  ['Grand Dark Waltz Trio Vivace 140bpm.mp3', 140],
  ['Lord of the Rangs 104bpm.mp3', 104],
  ['Paradise_Found 105bpm.mp3', 105],
  ['Valse Gymnopedie 77bpm.mp3', 77],
  ['Vibing Over Venus 94bpm.mp3', 94],
  // Batch 3
  ['Adventures in Adventureland 135bpm.mp3', 135],
  ['Aerosol of my Love 100bpm.mp3', 100],
  ['Canon In D For 8 Bit Synths 132bpm.mp3', 132],
  ['Flying Kerfuffle 144bpm.mp3', 144],
  ['Fox Tale Waltz Part 1 Instrumental 186bpm.mp3', 186],
  ['Funky Boxstep 95bpm.mp3', 95],
  ['I Got a Stick Arr Bryan Teoh 121bpm.mp3', 121],
  ['Mesmerizing Galaxy Loop 124bpm.mp3', 124],
  ['Nightdreams 54bpm.mp3', 54],
  ['Trouble with Tribals 135bpm.mp3', 135],
  ['Waltz Primordial 107bpm.mp3', 107],
];

for (const [file, bpm] of files) {
  await probe(file, bpm);
}
