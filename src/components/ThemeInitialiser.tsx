/**
 * ThemeInitialiser: injects an inline script into the document <head> via
 * next/script's beforeInteractive strategy. This runs before any Next.js
 * code or page hydration, preventing the flash of light theme that would
 * otherwise occur when the user prefers dark mode.
 *
 * It reads localStorage and the prefers-color-scheme media query, then sets
 * data-theme on <html> before the browser paints the first frame.
 */

import Script from 'next/script';

const THEME_SCRIPT = `(function() {
  try {
    var raw = localStorage.getItem('beatdet-settings');
    var theme = 'light';
    if (raw) {
      var settings = JSON.parse(raw);
      var pref = settings && settings.state && settings.state.settings &&
                 settings.state.settings.display &&
                 settings.state.settings.display.theme;
      if (pref === 'dark') {
        theme = 'dark';
      } else if (pref === 'light') {
        theme = 'light';
      } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          theme = 'dark';
        }
      }
    } else {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark';
      }
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();`;

export function ThemeInitialiser() {
  return (
    <Script
      id="theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
