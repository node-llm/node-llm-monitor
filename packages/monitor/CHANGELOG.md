# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-11-10

### Features

- **Fit the dashboard into your app.** A new `ui` option sets the title, subtitle, logo, accent color and theme, a `context` badge (such as the tenant shown), a link back to your app, and hides the GitHub link, language switcher or footer. See [docs/EMBEDDING.md](../../docs/EMBEDDING.md).
- **Embedded mode.** With `ui.embedded`, the dashboard sits inside your own page in a same-origin frame: no header, footer or page background, and it posts its height to its own origin so the frame fits its content.
- **Serve the build from any stack.** `injectDashboardConfig` adds the `ui` and i18n options to the page safely, for hosts that serve `dashboard/build` and answer `./api/*` themselves.
- **Tag filters.** Label calls with plain tags, such as a project or environment (`new Monitor({ tags })`, or `monitorTags` per call), and filter metrics, tokens and traces by them from a filter bar. The API takes `tag.<key>=<value>` and lists tags at `./api/tags`; `ui.tagFilters` picks the keys and labels. Prisma needs `migrations/003_add_tags.sql`. See [docs/TAGS.md](../../docs/TAGS.md).

### Security

- Values injected into the dashboard page (the i18n options and the new `ui` options) are escaped so they can't close the script tag.

### Changed

- Dark mode is now class-based, following the system setting unless `ui.theme` says otherwise.

### Fixed

- **Tool arguments no longer stored without content capture.** With `captureContent: false` (the default), `tool.start` events kept the full tool call, arguments included. They now keep only the call id and tool name. With capture on, arguments are scrubbed like messages.
- **Tool results are scrubbed.** With `captureContent: true`, tool results went to the store unscrubbed. They now pass through the PII and secret scrubber.
- **Error stacks only with content capture.** `request.error` events kept `error.stack`, which shows file paths and code, even with capture off.
- **The answering model is recorded.** `request.end` events now use the model and provider from the response, so a call that NodeLLM's fallbacks moved to another model is no longer filed under the requested one.

### Internal

- `@node-llm/monitor-otel` now type-checks cleanly; fixed a test that passed `customPatterns` outside `scrubbing`.

## [0.4.2] - 2026-07-04

### Features

- **Extended Token Accounting**: Extract and store cache, cache-creation, reasoning, and image token counts (previously only prompt/completion totals were tracked).
  - Normalizes naming across the Vercel AI SDK, OpenAI, Anthropic/OTel GenAI semantic conventions, and NodeLLM's own usage shape.
  - Surfaced in `PrismaAdapter`, trace filtering, and time-series aggregation.

## [0.2.0] - 2026-02-02

### Features

- **Trace Filtering**: Added comprehensive filtering capabilities to the Dashboard and API.
  - Filter by **Request ID**, **Status** (success/error), **Provider**, and **Model**.
  - **Numeric Filters**: Added support for filtering by **Minimum Cost** and **Minimum Latency**.
  - **Date Ranges**: Robust support for `from` and `to` date filters across all adapters.
- **Enhanced Dashboard**: Introduced a new Filter Bar component for real-time trace search.
- **Adapter Upgrades**: Implemented advanced filtering logic in `PrismaAdapter`, `MemoryAdapter`, and `FileAdapter`.

## [0.1.1] - 2026-02-01

### Improvements

- **Dependency Enforcement**: Added `peerDependencies` to ensure compatibility with `@node-llm/core >= 1.10.0` and `@node-llm/orm >= 0.4.0`.

## [0.1.0] - 2026-02-01

### Features

- **Initial Release**: Production-grade observability layer for NodeLLM.
- **Embedded Dashboard**: High-performance Preact-based dashboard for real-time trace analysis.
- **Stable Adapters**: First-class support for **Prisma**, **In-Memory**, and **File-based** (JSONL) storage.
- **Middleware Integration**: Native integration with NodeLLM's middleware stack for zero-overhead tracking.
- **Content Scrubbing**: Integrated PII scrubbers and metadata enrichment utilities.
- **Lazy Validation**: Smart adapter initialization that supports modern frameworks like Next.js and Fastify.
