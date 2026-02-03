import type { ContentScrubbingOptions } from "./types.js";

/**
 * Built-in patterns for PII detection
 */
const PII_PATTERNS = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, name: "email" },
  // Phone numbers (various formats)
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, name: "phone" },
  // SSN
  { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, name: "ssn" },
  // Credit card numbers
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, name: "credit_card" },
  // IP addresses
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, name: "ip_address" },
  // Date of birth patterns
  { pattern: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g, name: "dob" }
];

/**
 * Built-in patterns for secret detection
 */
const SECRET_PATTERNS = [
  // API keys (common formats)
  { pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/g, name: "openai_key" },
  { pattern: /\b(sk-proj-[a-zA-Z0-9_-]{20,})\b/g, name: "openai_project_key" },
  { pattern: /\b(sk-ant-[a-zA-Z0-9_-]{20,})\b/g, name: "anthropic_key" },
  { pattern: /\b(AIza[a-zA-Z0-9_-]{35})\b/g, name: "google_api_key" },
  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9_-]{20,}/gi, name: "bearer_token" },
  // Generic API key patterns
  { pattern: /\b(api[_-]?key)[=:]\s*["']?([a-zA-Z0-9_-]{16,})["']?/gi, name: "api_key" },
  // AWS keys
  { pattern: /\b(AKIA[0-9A-Z]{16})\b/g, name: "aws_access_key" },
  // GitHub tokens
  { pattern: /\b(gh[pousr]_[a-zA-Z0-9]{36,})\b/g, name: "github_token" },
  // Private keys (partial)
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END/g, name: "private_key" }
];

/**
 * Content scrubber for removing sensitive data from monitoring payloads.
 */
export class ContentScrubber {
  private readonly options: Required<ContentScrubbingOptions>;
  private readonly allPatterns: Array<{ pattern: RegExp; replacement: string; name: string }>;

  constructor(options: ContentScrubbingOptions = {}) {
    this.options = {
      pii: options.pii ?? true,
      secrets: options.secrets ?? true,
      customPatterns: options.customPatterns ?? [],
      excludeFields: options.excludeFields ?? [],
      maskWith: options.maskWith ?? "[REDACTED]"
    };

    // Build combined pattern list
    this.allPatterns = [];

    if (this.options.pii) {
      this.allPatterns.push(
        ...PII_PATTERNS.map((p) => ({
          pattern: p.pattern,
          replacement: `[${p.name.toUpperCase()}]`,
          name: p.name
        }))
      );
    }

    if (this.options.secrets) {
      this.allPatterns.push(
        ...SECRET_PATTERNS.map((p) => ({
          pattern: p.pattern,
          replacement: `[${p.name.toUpperCase()}]`,
          name: p.name
        }))
      );
    }

    for (const custom of this.options.customPatterns) {
      this.allPatterns.push({
        pattern: custom.pattern,
        replacement: custom.replacement ?? this.options.maskWith,
        name: custom.name ?? "custom"
      });
    }
  }

  /**
   * Scrub sensitive content from a string
   */
  scrubString(text: string): string {
    if (!text || typeof text !== "string") return text;

    let result = text;
    for (const { pattern, replacement } of this.allPatterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  /**
   * Scrub sensitive content from an object (deep)
   * Handles circular references to prevent stack overflow
   */
  scrubObject<T extends Record<string, any>>(obj: T, seen = new WeakSet()): T {
    if (!obj || typeof obj !== "object") return obj;

    // Prevent circular references
    if (seen.has(obj)) {
      return "[Circular]" as any;
    }
    seen.add(obj);

    const scrubbed: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip excluded fields
      if (this.options.excludeFields.includes(key)) {
        scrubbed[key] = this.options.maskWith;
        continue;
      }

      // Skip functions and symbols
      if (typeof value === "function" || typeof value === "symbol") {
        continue;
      }

      if (typeof value === "string") {
        scrubbed[key] = this.scrubString(value);
      } else if (Array.isArray(value)) {
        scrubbed[key] = value.map((item) =>
          typeof item === "object" && item !== null
            ? this.scrubObject(item, seen)
            : typeof item === "string"
              ? this.scrubString(item)
              : item
        );
      } else if (value && typeof value === "object") {
        scrubbed[key] = this.scrubObject(value, seen);
      } else {
        scrubbed[key] = value;
      }
    }

    return scrubbed;
  }

  /**
   * Scrub messages array (common LLM format)
   */
  scrubMessages(messages: any[]): any[] {
    if (!Array.isArray(messages)) return messages;

    return messages.map((msg) => {
      if (!msg || typeof msg !== "object") return msg;

      const scrubbed: any = { ...msg };

      // Scrub content field
      if (typeof scrubbed.content === "string") {
        scrubbed.content = this.scrubString(scrubbed.content);
      } else if (Array.isArray(scrubbed.content)) {
        scrubbed.content = scrubbed.content.map((part: any) => {
          if (typeof part === "string") return this.scrubString(part);
          if (part?.text) return { ...part, text: this.scrubString(part.text) };
          return part;
        });
      }

      return scrubbed;
    });
  }
}

/**
 * Create a content scrubber with default settings
 */
export function createScrubber(options?: ContentScrubbingOptions): ContentScrubber {
  return new ContentScrubber(options);
}
