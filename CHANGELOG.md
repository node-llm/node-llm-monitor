# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-02-01

### Features

- **Lazy Adapter Validation**: Refactored `PrismaAdapter` to validate the Prisma client on first use rather than at construction. This improves compatibility with frameworks that initialize database clients asynchronously (e.g., Next.js).
- **Improved Build scripts**: Updated `dev` and `build` scripts to correctly externalize core peer dependencies.

### Improvements

- **Stability**: Enhanced internal scrubbers and error handling for production environments.
- **Developer Experience**: Added new integration tests for `PrismaMonitor` and content scrubbing logic.
