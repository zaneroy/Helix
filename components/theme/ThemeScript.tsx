const themeScript = `
(function () {
  try {
    var STORAGE_KEY = "helix-theme-preference";

    /*
     * The public landing page always follows
     * the device / operating-system appearance.
     *
     * It ignores the saved portal preference,
     * but does NOT delete or overwrite it.
     */
    var systemOnly = window.location.pathname === "/";

    var stored = localStorage.getItem(STORAGE_KEY);

    var preference;

    if (systemOnly) {
      preference = "system";
    } else {
      preference =
        stored === "light" ||
        stored === "dark" ||
        stored === "system"
          ? stored
          : "light";
    }

    var resolvedTheme;

    if (preference === "system") {
      resolvedTheme = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches
        ? "dark"
        : "light";
    } else {
      resolvedTheme = preference;
    }

    var root = document.documentElement;

    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolvedTheme;
  } catch (error) {
    /*
     * Safe fallback:
     * authenticated Helix defaults to Light.
     */
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: themeScript,
      }}
    />
  );
}