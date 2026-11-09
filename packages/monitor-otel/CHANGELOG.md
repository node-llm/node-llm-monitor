# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-11-10

### Features

- **Tags from spans.** `llm.tag.<key>` span attributes, and the Vercel AI SDK's telemetry metadata `tag.<key>`, become the call's tags, for the dashboard's tag filters in `@node-llm/monitor` 0.5.0.

## [0.1.1] - 2026-07-04

### Features

- **Extended Token Accounting**: Extract and store cache, cache-creation, reasoning, and image token counts in `NodeLLMSpanProcessor`, matching the same accounting added to `@node-llm/monitor` 0.4.2.
