/**
 * BpmHistogram: bar chart showing the distribution of inter-beat intervals
 * converted to BPM, built with Chart.js via react-chartjs-2.
 *
 * Solarised colours are used throughout.
 */

'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { AnalysisResult } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface BpmHistogramProps {
  result: AnalysisResult;
}

/** Build histogram buckets from beat IOIs. */
function buildHistogram(
  beats: AnalysisResult['beats'],
  bins: number
): { labels: string[]; counts: number[] } {
  if (beats.length < 2) return { labels: [], counts: [] };

  // Compute IOIs → BPMs
  const bpms: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    const ioi = beats[i].time - beats[i - 1].time;
    if (ioi > 0) bpms.push(60 / ioi);
  }

  const binMin = 40;
  const binMax = 240;
  const binWidth = (binMax - binMin) / bins;

  const counts = new Array<number>(bins).fill(0);
  for (const bpm of bpms) {
    const idx = Math.floor((bpm - binMin) / binWidth);
    if (idx >= 0 && idx < bins) counts[idx]++;
  }

  const labels = Array.from({ length: bins }, (_, i) =>
    Math.round(binMin + i * binWidth).toString()
  );

  return { labels, counts };
}

export function BpmHistogram({ result }: BpmHistogramProps) {
  const bins = useSettingsStore((s) => s.settings.display.histogramBins);

  const { labels, counts } = buildHistogram(result.beats, bins);

  if (labels.length === 0) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-xl"
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <p className="text-sm">Not enough beats for histogram.</p>
      </div>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: 'Beat count',
        data: counts,
        backgroundColor: 'rgba(38, 139, 210, 0.7)',    // --sol-blue
        borderColor: 'rgba(38, 139, 210, 1)',
        borderWidth: 1,
        borderRadius: 3,
        hoverBackgroundColor: 'rgba(42, 161, 152, 0.8)', // --sol-cyan
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          title: (ctx: { label: string }[]) => `~${ctx[0].label} BPM`,
          label: (ctx: { parsed: { y: number } }) =>
            `${ctx.parsed.y} beat${ctx.parsed.y !== 1 ? 's' : ''}`,
        },
        backgroundColor: 'var(--bg-panel)',
        titleColor: 'var(--text-heading)',
        bodyColor: 'var(--text-body)',
        borderColor: 'var(--border)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'BPM (inter-beat interval)',
          color: 'var(--text-muted)',
          font: { size: 11 },
        },
        ticks: {
          color: 'var(--text-muted)',
          maxTicksLimit: 12,
          font: { size: 10 },
        },
        grid: { color: 'var(--border)', lineWidth: 0.5 },
      },
      y: {
        title: {
          display: true,
          text: 'Count',
          color: 'var(--text-muted)',
          font: { size: 11 },
        },
        ticks: {
          color: 'var(--text-muted)',
          font: { size: 10 },
          precision: 0,
        },
        grid: { color: 'var(--border)', lineWidth: 0.5 },
        beginAtZero: true,
      },
    },
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      <p className="text-xs font-medium uppercase tracking-widest mb-3"
        style={{ color: 'var(--text-muted)' }}>
        BPM Distribution Histogram
      </p>
      <div className="h-52">
        <Bar data={data} options={options as Parameters<typeof Bar>[0]['options']} />
      </div>
    </div>
  );
}
