/**
 * OnsetChart: line chart showing the onset strength curve over time,
 * with vertical markers indicating detected beat positions.
 *
 * Built with Chart.js / react-chartjs-2.
 */

'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ChartData } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { AnalysisResult } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SOLARISED_ACCENT: Record<string, string> = {
  yellow:  '#b58900',
  orange:  '#cb4b16',
  red:     '#dc322f',
  magenta: '#d33682',
  violet:  '#6c71c4',
  blue:    '#268bd2',
  cyan:    '#2aa198',
  green:   '#859900',
};

interface OnsetChartProps {
  result: AnalysisResult;
}

/** Downsample an array to at most maxPoints for chart performance. */
function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0);
}

export function OnsetChart({ result }: OnsetChartProps) {
  const { onsetTimes, onsetStrengths, beats } = result;
  const displaySettings = useSettingsStore((s) => s.settings.display);

  const MAX_POINTS = 600;
  const times = downsample(onsetTimes, MAX_POINTS);
  const strengths = downsample(onsetStrengths, MAX_POINTS);

  const beatColour = SOLARISED_ACCENT[displaySettings.beatMarkerColour] ?? '#cb4b16';

  // Build vertical annotation lines for beats (as a dataset of vertical lines).
  // Chart.js doesn't support vertical lines natively in the Line chart type,
  // so we use a fill dataset trick or just add beat positions as extra annotations.
  // For simplicity, add beat times as tick marks on x-axis data points.

  const labels = times.map((t) => t.toFixed(2));

  // Add beat marker points as a scatter dataset
  const beatDataPoints = beats.map((beat) => {
    // Find nearest onset index to match x-axis position
    const idx = times.findIndex((t) => t >= beat.time);
    return {
      x: idx >= 0 ? labels[idx] : beat.time.toFixed(2),
      y: idx >= 0 ? strengths[idx] : beat.confidence,
    };
  });

  const data: ChartData<'line', number[], string> = {
    labels,
    datasets: [
      {
        label: 'Onset strength',
        data: strengths,
        borderColor: 'rgba(38, 139, 210, 0.9)',
        backgroundColor: 'rgba(38, 139, 210, 0.12)',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Beat',
        data: beatDataPoints.map((p) => p.y),
        borderColor: beatColour,
        backgroundColor: beatColour,
        borderWidth: 0,
        pointRadius: 4,
        pointStyle: 'triangle' as const,
        fill: false,
        tension: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: 'var(--text-muted)',
          font: { size: 11 },
          boxWidth: 12,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'var(--bg-panel)',
        titleColor: 'var(--text-heading)',
        bodyColor: 'var(--text-body)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        callbacks: {
          title: (ctx: { label: string }[]) => `t = ${ctx[0].label} s`,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time (seconds)',
          color: 'var(--text-muted)',
          font: { size: 11 },
        },
        ticks: {
          color: 'var(--text-muted)',
          maxTicksLimit: 10,
          font: { size: 10 },
        },
        grid: { color: 'var(--border)', lineWidth: 0.5 },
      },
      y: {
        title: {
          display: true,
          text: 'Onset strength',
          color: 'var(--text-muted)',
          font: { size: 11 },
        },
        ticks: { color: 'var(--text-muted)', font: { size: 10 } },
        grid: { color: 'var(--border)', lineWidth: 0.5 },
        min: 0,
        max: 1,
      },
    },
  };

  return (
    <div
      className="ui-panel rounded-xl p-4"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      <p className="ui-section-heading text-xs font-medium uppercase tracking-widest mb-3"
        style={{ color: 'var(--text-muted)' }}>
        Onset Strength &amp; Beat Markers
      </p>
      <div className="h-52">
        <Line data={data} options={options} />
      </div>
      {/* Screen-reader summary */}
      <p className="sr-only">
        Onset strength chart over {result.duration.toFixed(1)} seconds
        with {result.beats.length} beat markers.
      </p>
    </div>
  );
}
