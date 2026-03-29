# NodeLLM Monitor Dashboard 🛰️

A real-time, high-performance observability dashboard for LLM applications. Built with React, Tailwind CSS, and i18next.

|                    English (LTR)                     |                     Arabic (RTL)                     |
| :--------------------------------------------------: | :--------------------------------------------------: |
|                 **Metrics Overview**                 |              **نظرة عامة على المقاييس**              |
| ![](/assets/images/monitor/dashboard-metrics-en.png) | ![](/assets/images/monitor/dashboard-metrics-ar.png) |
|                 **Token Analytics**                  |                   **تحليل الرموز**                   |
| ![](/assets/images/monitor/dashboard-tokens-en.png)  | ![](/assets/images/monitor/dashboard-tokens-ar.png)  |
|                 **Execution Traces**                 |                  **تتبعات التنفيذ**                  |
| ![](/assets/images/monitor/dashboard-traces-en.png)  | ![](/assets/images/monitor/dashboard-traces-ar.png)  |

## ✨ Features

- 📊 **Real-time Metrics** - Visualize throughput, cost, latency, and error rates.
- 🔍 **Deep Tracing** - Inspect full execution flows, including tool calls and content.
- 🌍 **Internationalization (i18n)** - Multi-language support with dynamic YAML loading.
- ⬅️ **RTL Support** - Fully mirrored layout for Right-to-Left languages like Arabic.
- 🌓 **Dark Mode** - Professional dark and light themes.
- 🚀 **Zero Configuration** - Auto-detects and aggregates metrics from any `@node-llm/monitor` instance.

## 🌍 Localization

The dashboard is designed to be globally accessible and supports:

- **English (EN)** - Default
- **Spanish (ES)**
- **Arabic (AR)** - Full RTL support

### Extending Translations

You can easily add new languages or override existing translations without modifying the package.

```typescript
import { extendI18n, configureI18n } from "@node-llm/monitor-dashboard";

// 1. Add Portuguese from a remote file
await extendI18n("/locales/pt.yml");

// 2. Or override specific keys using YAML
await extendI18n(`
en:
  dashboard:
    title: "My Custom AI Monitor"
`);

// 3. Restrict available languages
configureI18n({
  supportedLngs: ["en", "ar"],
  fallbackLng: "en"
});
```

See the full **[Internationalization Guide](./I18N_GUIDE.md)** for more details.

## 🛠️ Tech Stack

- **Framework**: Vite + React
- **Styling**: Tailwind CSS (with Logical Properties for RTL)
- **Charts**: Recharts
- **i18n**: i18next + js-yaml
- **Icons**: Lucide-inspired SVG components

## 🚀 Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## 📜 License

MIT © [Shaiju Edakulangara](https://eshaiju.com)
