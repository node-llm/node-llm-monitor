import { Monitor } from "./Monitor.js";
import type { MonitorOptions } from "./types.js";
import { PrismaAdapter } from "./adapters/prisma/PrismaAdapter.js";

/**
 * Creates a Monitor instance pre-configured with a PrismaAdapter.
 * 
 * @param prisma - The PrismaClient instance
 * @param options - Additional monitor options (captureContent, onError, etc)
 * @returns A Monitor instance
 */
export function createPrismaMonitor(prisma: any, options?: Omit<MonitorOptions, 'store'>): Monitor {
  return new Monitor({
    ...options,
    store: new PrismaAdapter(prisma)
  });
}
