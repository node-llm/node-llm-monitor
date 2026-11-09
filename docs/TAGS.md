# Filter calls by tags

Tags are plain labels on each call, such as the project, feature, customer or environment it belongs to. Every view of the dashboard (metrics, tokens and traces) can be filtered by them, from one filter bar.

One monitor, sliced many ways: there's no need for a separate dashboard per project.

## Tag your calls

**With NodeLLM:** tags on the Monitor apply to every call it records, and a call's own `monitorTags` add to them, winning on the same key.

```ts
const monitor = new Monitor({ store, tags: { service: "billing", env: "staging" } });
const llm = createLLM({ provider: "openai", model: "gpt-4o", middlewares: [monitor] });

await llm.ask("Summarize this invoice", { monitorTags: { project: "Checkout" } });
```

**With OpenTelemetry:** set span attributes named `llm.tag.<key>`. With the Vercel AI SDK, use telemetry metadata `tag.<key>`:

```ts
await generateText({
  model,
  prompt,
  experimental_telemetry: { isEnabled: true, metadata: { "tag.project": "Checkout" } }
});
```

Tags are short plain strings: keys up to 64 characters, values up to 200. Empty values are dropped.

> Tags are for grouping, not content. Never put prompts, user data or secrets in a tag: they're stored and shown without the content scrubbing that `captureContent` applies.

## Store them

- **Memory and File adapters:** nothing to do.
- **Prisma:** add `tags Json?` to the model, or run `migrations/003_add_tags.sql`. It also adds a GIN index for filtering. Tables without the column keep working until a call carries tags.
- **A custom store:** read `event.tags` in `saveEvent`, honor `tags` in the filters of `getStats`, `getMetrics` and `listTraces` (a call must carry every given tag), and implement `listTags({ from, to })`, returning each key with its values:

  ```ts
  async listTags(): Promise<Record<string, string[]>> {
    return { project: ["Checkout", "Search"], env: ["production", "staging"] };
  }
  ```

  Without `listTags`, the dashboard simply shows no tag filters.

## Filter in the dashboard

The filter bar shows one dropdown per tag key. Choosing values filters every view, and the choice is kept in the page address, such as `?tag.project=Checkout`, so a filtered view can be bookmarked or shared.

Choose which keys to offer, in order, with friendly labels:

```ts
createMonitorMiddleware(store, {
  ui: {
    tagFilters: [
      { key: "project", label: "Project" },
      { key: "purpose", label: "Used for" }
    ]
  }
});
```

Without `tagFilters`, every key seen is offered, with its name in title case.

## The API

Every endpoint takes tag filters as `tag.<key>=<value>`, and several combine:

```
GET ./api/metrics?from=…&tag.project=Checkout&tag.env=staging
GET ./api/traces?tag.project=Checkout
GET ./api/tags?from=…        →  { "project": ["Checkout", "Search"], "env": ["staging"] }
```

A host serving the dashboard from another stack (see [Fit the dashboard into your app](EMBEDDING.md)) answers the same parameters from its own data.

## Example: Qadet

Qadet tags each AI call with its **project** and its **purpose** (exploring, repairing, planning, embedding…), and offers both as filters. A team can see what one project's testing costs, or why one project's runs are slow, in the same organization-wide monitor.
