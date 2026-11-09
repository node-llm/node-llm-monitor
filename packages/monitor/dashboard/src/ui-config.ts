/**
 * How a host app customizes the dashboard so it fits in: its name and logo, accent color,
 * theme, a link back to the host, and which built-in extras to hide.
 *
 * The server injects it as `window.__MONITOR_UI__` (see MonitorDashboardOptions.ui). A host that
 * serves the static build itself can inject the same object before the dashboard's script.
 */
export interface MonitorUiConfig {
  /** Header title. Default: "NodeLLM Monitor" (or the i18n title). */
  title?: string;
  /** Header subtitle. */
  subtitle?: string;
  /** Logo image URL shown instead of the NodeLLM Monitor mark. */
  logoUrl?: string;
  /** Accent color as a hex value, such as "#f2a93b". */
  accentColor?: string;
  /** "light", "dark" or "system" (default). */
  theme?: "light" | "dark" | "system";
  /** A label for what is being monitored, such as a tenant or environment, shown in the header. */
  context?: string;
  /** A link back to the host app, shown at the start of the header. */
  backLink?: { label: string; href: string };
  /** Hide the GitHub link. */
  hideGithubLink?: boolean;
  /** Hide the language switcher. */
  hideLanguageSwitcher?: boolean;
  /** Hide the footer. */
  hideFooter?: boolean;
  /** Browser tab title. Default: the header title. */
  documentTitle?: string;
}

export const uiConfig: MonitorUiConfig =
  (globalThis as { __MONITOR_UI__?: MonitorUiConfig }).__MONITOR_UI__ ?? {};

const hexToChannels = (hex: string): string | undefined => {
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const value =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : match[1];
  const n = parseInt(value, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** Applies the theme, accent color and tab title to the page. */
export function applyUiConfig(
  config: MonitorUiConfig = uiConfig,
  root: HTMLElement = document.documentElement
): void {
  const accent = config.accentColor && hexToChannels(config.accentColor);
  if (accent) {
    root.style.setProperty("--monitor-accent-rgb", accent);
    root.style.setProperty("--monitor-accent-light-rgb", accent);
  }

  const theme = config.theme ?? "system";
  const media =
    typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : undefined;
  const update = () =>
    root.classList.toggle("dark", theme === "dark" || (theme === "system" && !!media?.matches));
  update();
  if (theme === "system") media?.addEventListener?.("change", update);

  const title = config.documentTitle ?? config.title;
  if (title) document.title = title;
}

export { hexToChannels };
