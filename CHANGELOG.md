# Changelog

All notable changes to this project will be documented in this file.

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

