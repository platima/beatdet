/**
 * Unit tests for the WhatsNewBanner version helpers.
 *
 * The banner must show the newest curated entry the user has not seen yet,
 * and must not surface anything (beyond the changelog fallback) when no
 * entry covers the upgrade, so patch releases without their own entry
 * still behave sensibly.
 */

import { compareSemver, latestUnseenEntry } from '@/components/WhatsNewBanner';

describe('compareSemver', () => {
  it('orders versions numerically, not lexically', () => {
    expect(compareSemver('0.7.15', '0.7.5')).toBeGreaterThan(0);
    expect(compareSemver('0.7.5', '0.7.15')).toBeLessThan(0);
    expect(compareSemver('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '0.99.99')).toBeGreaterThan(0);
    expect(compareSemver('0.7.15', '0.7.15')).toBe(0);
  });
});

describe('latestUnseenEntry', () => {
  const entries = {
    '0.2.0': ['two'],
    '0.3.0': ['three'],
    '0.7.5': ['seven-five'],
    '0.7.15': ['seven-fifteen'],
  };

  it('picks the newest entry between last-seen and current', () => {
    expect(latestUnseenEntry('0.7.17', '0.7.5', entries)).toEqual(['seven-fifteen']);
  });

  it('still surfaces the newest crossed entry on patch releases without their own entry', () => {
    // User upgrades 0.7.4 -> 0.7.20; 0.7.5 and 0.7.15 were both crossed,
    // newest wins even though 0.7.20 has no entry of its own.
    expect(latestUnseenEntry('0.7.20', '0.7.4', entries)).toEqual(['seven-fifteen']);
  });

  it('returns null when the user has already seen the newest entry', () => {
    expect(latestUnseenEntry('0.7.16', '0.7.15', entries)).toBeNull();
  });

  it('ignores entries newer than the running version', () => {
    expect(latestUnseenEntry('0.3.5', '0.2.0', entries)).toEqual(['three']);
  });

  it('returns null for unparseable stored versions instead of throwing', () => {
    expect(latestUnseenEntry('0.7.17', 'garbage', entries)).toBeNull();
  });

  it('has a real entry for the current release line in the production map', () => {
    // Guard against the regression where VERSION moves on but WHATS_NEW is
    // forgotten: an upgrade from the previous minor must find an entry.
    expect(latestUnseenEntry('0.7.99', '0.6.0')).not.toBeNull();
  });
});
