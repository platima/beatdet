/**
 * ChangelogRenderer: client component that renders parsed changelog entries.
 * Separated from the server page so the page can stay a server component.
 */

'use client';

interface Release {
  version: string;
  date: string;
  sections: Array<{ heading: string; items: string[] }>;
}

interface ChangelogRendererProps {
  releases: Release[];
}

const SECTION_COLOURS: Record<string, string> = {
  Added:   'var(--sol-green)',
  Changed: 'var(--sol-blue)',
  Fixed:   'var(--sol-cyan)',
  Removed: 'var(--sol-red)',
};

/** Render inline bold from **text** patterns. */
function renderItem(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text-heading)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function ChangelogRenderer({ releases }: ChangelogRendererProps) {
  return (
    <div className="space-y-8 py-4">
      {releases.map((release, ri) => (
        <div key={release.version}>
          {/* Release header */}
          <div className="flex items-baseline gap-3 mb-4">
            <span
              className="text-xl font-bold font-mono"
              style={{ color: ri === 0 ? 'var(--accent)' : 'var(--text-heading)' }}
            >
              v{release.version}
            </span>
            {ri === 0 && (
              <span
                className="rounded px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}
              >
                Latest
              </span>
            )}
            <span className="text-xs font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>
              {release.date}
            </span>
          </div>

          {/* Sections */}
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)' }}
          >
            {release.sections.map((section) => (
              <div key={section.heading}>
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: SECTION_COLOURS[section.heading] ?? 'var(--text-muted)' }}
                >
                  {section.heading}
                </p>
                <ul className="space-y-1.5">
                  {section.items.map((item, ii) => (
                    <li
                      key={ii}
                      className="flex gap-2 text-sm"
                      style={{ color: 'var(--text-body)' }}
                    >
                      <span style={{ color: 'var(--accent)', flexShrink: 0 }}>–</span>
                      <span>{renderItem(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
