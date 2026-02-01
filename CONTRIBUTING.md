# Contributing to NodeLLM Monitor

## Did you find a bug?

- **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/node-llm/node-llm-monitor/issues).

- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/node-llm/node-llm-monitor/issues/new). Include a **title and clear description**, relevant information, and a **code sample** demonstrating the issue.

- **Verify it's a NodeLLM Monitor bug**, not your application code, before opening an issue.

## Did you write a patch that fixes a bug?

- Open a new GitHub pull request with the patch.

- Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable.

- Ensure tests pass by running `pnpm test`.

## Do you intend to add a new feature or change an existing one?

- **First check if this belongs in NodeLLM Monitor or your application:**
  - ✅ Core monitoring functionality (event capture, metrics, dashboards)
  - ✅ New storage adapters (Redis, MongoDB, etc.)
  - ✅ Dashboard improvements
  - ❌ Application-specific monitoring logic
  - ❌ Provider-specific integrations (those belong in @node-llm/core)

- Start by opening an issue to discuss the feature and its design.

## Quick Start

```bash
git clone https://github.com/node-llm/node-llm-monitor.git
cd node-llm-monitor
pnpm install
# make changes, add tests
pnpm test
```

## Development

```bash
# Build the server
pnpm run build:server

# Build the dashboard
pnpm run build:dashboard

# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Lint code
pnpm run lint

# Format code
pnpm run format
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:coverage
```

## Important Notes

- **Keep it simple** - if it needs extensive documentation, reconsider the approach.
- **Performance First** - monitoring should have minimal overhead on the application.
- **Privacy by Default** - `captureContent` is `false` by default to protect PII.

## Support

If NodeLLM Monitor helps you, considerations for sponsorship or just spreading the word are appreciated!

Go ship observable AI apps!
