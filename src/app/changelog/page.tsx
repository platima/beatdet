/**
 * Changelog page: renders CHANGELOG.md content in a readable format.
 * Linked from the version badge in the NavBar.
 */

import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ChangelogRenderer } from './ChangelogRenderer';

export const metadata: Metadata = {
  title: 'Changelog | BeatDet',
  description: 'Release notes and version history for BeatDet.',
};

function parseChangelog(raw: string): Array<{ version: string; date: string; sections: Array<{ heading: string; items: string[] }> }> {
  const releases: Array<{ version: string; date: string; sections: Array<{ heading: string; items: string[] }> }> = [];
  let current: (typeof releases)[0] | null = null;
  let currentSection: { heading: string; items: string[] } | null = null;

  for (const line of raw.split('\n')) {
    const releaseMatch = line.match(/^## \[(\d+\.\d+\.\d+)\] - (.+)/);
    const sectionMatch = line.match(/^### (.+)/);
    const itemMatch = line.match(/^- (.+)/);

    if (releaseMatch) {
      if (current) releases.push(current);
      current = { version: releaseMatch[1], date: releaseMatch[2].trim(), sections: [] };
      currentSection = null;
    } else if (sectionMatch && current) {
      currentSection = { heading: sectionMatch[1], items: [] };
      current.sections.push(currentSection);
    } else if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1]);
    }
  }
  if (current) releases.push(current);
  return releases;
}

export default function ChangelogPage() {
  const raw = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8');
  const releases = parseChangelog(raw);

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div className="space-y-1 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
          Changelog
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Release notes for every version of BeatDet.
        </p>
      </div>
      <ChangelogRenderer releases={releases} />
    </div>
  );
}
