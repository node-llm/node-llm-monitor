# Internationalization (i18n) Guide

The NodeLLM Monitor Dashboard uses `i18next` for internationalization. This document explains how to configure, extend, and override translations.

## 1. Internal Locales

Internal locales are stored as YAML files in `src/i18n/locales/*.yml`. These are automatically detected and loaded at build time using Vite's `import.meta.glob`.

Currently supported:

- English (`en.yml`) - **Default**
- Spanish (`es.yml`)
- Arabic (`ar.yml`) - **RTL Support**

## 2. Setting Default Language

You can set the default language at runtime using the `VITE_DEFAULT_LANGUAGE` environment variable.

In your `.env` file:

```env
VITE_DEFAULT_LANGUAGE=es
```

## 3. Configuration from Host Applications

If you are using this package in a host application (e.g., a Next.js app), you have full control over which languages are enabled and what translations are used.

### Restricting Supported Languages

By default, the dashboard enables all internal locales plus any added via `extendI18n`. If you want to limit the choice to specific languages:

```typescript
import { configureI18n } from "@nodellm/monitor-dashboard";

configureI18n({
  supportedLngs: ["en", "ar"], // Disable Spanish, only allow EN and AR
  fallbackLng: "en"
});
```

### Overriding Existing Languages

If you want to customize specific translations in internal languages (e.g., change the title on the EN dashboard), simply pass a partial YAML object.

```typescript
import { extendI18n } from "@nodellm/monitor-dashboard";

await extendI18n(`
en:
  dashboard:
    title: "Project Alpha Monitor"
  common:
    refresh: "Force Pull"
`);
```

### Reference: Translation Keys

When adding a new language, you should mirror the structure of the primary English file.

- **Primary Translation Reference**: [en.yml](file:///Users/shaiju.edakulangara/projects/mercer/node-llm-monitor/packages/monitor/dashboard/src/i18n/locales/en.yml)

### Example YAML structure

```yaml
common:
  refresh: "Refresh"
dashboard:
  title: "NodeLLM Monitor"
metrics:
  noData: "No data available"
```

## 5. RTL Support

The layout automatically detects the direction from `i18next`. When a RTL language like Arabic (`ar`) is selected:

- `i18n.dir()` returns `'rtl'`.
- The main container `div` sets `dir="rtl"`.
- Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`) ensure the layout flips correctly.

## 5. Adding Supported Languages in `config.ts`

If you want to add a permanent language to the repository:

1. Create `src/i18n/locales/[code].yml`.
2. Add your translations following the structure of `en.yml`.
3. Restart the development server. The dynamic loader will pick it up automatically.
