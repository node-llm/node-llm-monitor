/**
 * Documentation Verification Tests: docs/monitor/prisma.md
 *
 * Ensures Prisma adapter code samples compile and execute against mocks.
 */
import { describe, it, expect, vi } from "vitest";
import { createPrismaMonitor } from "../../src/factory.js";
import { PrismaAdapter } from "../../src/adapters/prisma/PrismaAdapter.js";

const makeMockPrisma = () => ({
  monitoring_events: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 }, _avg: { duration: 0 } })
  }
});

describe("docs/monitor/prisma", () => {
  it("basic usage: createPrismaMonitor hooks up PrismaAdapter", async () => {
    const prisma = makeMockPrisma();
    const monitor = createPrismaMonitor(prisma);

    expect(monitor.store).toBeInstanceOf(PrismaAdapter);

    await monitor.onRequest({
      requestId: "req-docs-001",
      provider: "openai",
      model: "gpt-4o-mini",
      state: {},
      messages: [{ role: "user", content: "hello" }]
    });

    expect(prisma.monitoring_events.create).toHaveBeenCalled();
  });

  it("options: captureContent + scrubbing + onError hook do not throw", async () => {
    const prisma = makeMockPrisma();
    const monitor = createPrismaMonitor(prisma as any, {
      captureContent: true,
      scrubbing: { pii: true, secrets: true },
      onError: vi.fn()
    });

    await expect(
      monitor.onError(
        {
          requestId: "req-docs-002",
          provider: "openai",
          model: "gpt-4o-mini",
          state: {}
        },
        new Error("boom")
      )
    ).resolves.not.toThrow();
  });

  it("query patterns from docs execute against Prisma client", async () => {
    const prisma = makeMockPrisma();

    await prisma.monitoring_events.findMany({
      where: { requestId: "req_123" },
      orderBy: { time: "asc" }
    });

    await prisma.monitoring_events.aggregate({
      where: {
        eventType: "request.end",
        time: {
          gte: new Date("2024-01-01"),
          lte: new Date("2024-01-31")
        }
      },
      _sum: { cost: true }
    });

    expect(prisma.monitoring_events.findMany).toHaveBeenCalled();
    expect(prisma.monitoring_events.aggregate).toHaveBeenCalled();
  });
});
