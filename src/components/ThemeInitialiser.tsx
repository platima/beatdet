/**
 * ThemeInitialiser — runs a tiny inline script before the first paint to
 * prevent the flash of un-themed content (FOUC) when using the system or
 * stored theme preference.
 *
 * This component renders a <script> tag that reads localStorage immediately
 * and sets data-theme on <html> before React hydrates.
 */

export function ThemeInitialiser() {
  const script = `
    (function() {
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
            // 'system' or unset — check media query
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
              theme = 'dark';
            }
          }
        } else {
          // No stored preference — use system
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            theme = 'dark';
          }
        }
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {}
    })();
  `.trim();

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
