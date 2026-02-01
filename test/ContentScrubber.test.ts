import { describe, it, expect } from "vitest";
import { ContentScrubber, createScrubber } from "../src/scrubber.js";

describe("ContentScrubber", () => {
  describe("scrubString", () => {
    it("should scrub email addresses", () => {
      const scrubber = new ContentScrubber();
      const text = "Contact me at john.doe@example.com for details";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[EMAIL]");
      expect(result).not.toContain("john.doe@example.com");
    });

    it("should scrub phone numbers in various formats", () => {
      const scrubber = new ContentScrubber();
      const formats = ["(555) 123-4567", "555-123-4567", "555.123.4567", "+1 (555) 123-4567"];

      formats.forEach((format) => {
        const result = scrubber.scrubString(`Call me at ${format}`);
        expect(result).toContain("[PHONE]");
        expect(result).not.toContain(format);
      });
    });

    it("should scrub SSN patterns", () => {
      const scrubber = new ContentScrubber();
      const text = "SSN: 123-45-6789";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[SSN]");
      expect(result).not.toContain("123-45-6789");
    });

    it("should scrub credit card numbers", () => {
      const scrubber = new ContentScrubber();
      const text = "Card: 4532-1234-5678-9010";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[CREDIT_CARD]");
      expect(result).not.toContain("4532-1234-5678-9010");
    });

    it("should scrub IP addresses", () => {
      const scrubber = new ContentScrubber();
      const text = "Server running on 192.168.1.100";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[IP_ADDRESS]");
      expect(result).not.toContain("192.168.1.100");
    });

    it("should scrub OpenAI API keys", () => {
      const scrubber = new ContentScrubber();
      const text = "API key: sk-1234567890abcdefghij";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[OPENAI_KEY]");
      expect(result).not.toContain("sk-1234567890abcdefghij");
    });

    it("should scrub Bearer tokens", () => {
      const scrubber = new ContentScrubber();
      const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[BEARER_TOKEN]");
    });

    it("should scrub AWS access keys", () => {
      const scrubber = new ContentScrubber();
      const text = "AWS Key: AKIAIOSFODNN7EXAMPLE";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[AWS_ACCESS_KEY]");
      expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });

    it("should respect pii: false option", () => {
      const scrubber = new ContentScrubber({ pii: false, secrets: true });
      const text = "Email: test@example.com with key sk-1234567890abcdefghij";
      const result = scrubber.scrubString(text);
      expect(result).toContain("test@example.com"); // PII not scrubbed
      expect(result).toContain("[OPENAI_KEY]"); // Secrets still scrubbed
    });

    it("should respect secrets: false option", () => {
      const scrubber = new ContentScrubber({ pii: true, secrets: false });
      const text = "Email: test@example.com with key sk-1234567890abcdefghij";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[EMAIL]"); // PII still scrubbed
      expect(result).toContain("sk-1234567890abcdefghij"); // Secrets not scrubbed
    });

    it("should use custom mask text for custom patterns", () => {
      const scrubber = new ContentScrubber({
        customPatterns: [{ pattern: /custom_secret_\w+/g, name: "custom" }],
        maskWith: "***HIDDEN***"
      });
      const text = "secret: custom_secret_abc123";
      const result = scrubber.scrubString(text);
      expect(result).toContain("***HIDDEN***");
      expect(result).not.toContain("custom_secret_abc123");
    });

    it("should handle empty strings", () => {
      const scrubber = new ContentScrubber();
      expect(scrubber.scrubString("")).toBe("");
    });

    it("should handle non-string input", () => {
      const scrubber = new ContentScrubber();
      expect(scrubber.scrubString(null as any)).toBe(null);
      expect(scrubber.scrubString(undefined as any)).toBe(undefined);
    });

    it("should scrub multiple matches in single string", () => {
      const scrubber = new ContentScrubber();
      const text =
        "Email: john@example.com and phone: 555-123-4567 with key sk-1234567890abcdefghij";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[EMAIL]");
      expect(result).toContain("[PHONE]");
      expect(result).toContain("[OPENAI_KEY]");
    });
  });

  describe("scrubObject", () => {
    it("should scrub string values in objects", () => {
      const scrubber = new ContentScrubber();
      const obj = {
        email: "test@example.com",
        name: "John Doe"
      };
      const result = scrubber.scrubObject(obj);
      expect(result.email).toContain("[EMAIL]");
      expect(result.name).toBe("John Doe");
    });

    it("should scrub nested objects", () => {
      const scrubber = new ContentScrubber();
      const obj = {
        user: {
          email: "test@example.com",
          profile: {
            phone: "555-123-4567"
          }
        }
      };
      const result = scrubber.scrubObject(obj);
      expect(result.user.email).toContain("[EMAIL]");
      expect(result.user.profile.phone).toContain("[PHONE]");
    });

    it("should scrub arrays of strings", () => {
      const scrubber = new ContentScrubber();
      const obj = {
        emails: ["john@example.com", "jane@example.com"]
      };
      const result = scrubber.scrubObject(obj);
      expect(result.emails[0]).toContain("[EMAIL]");
      expect(result.emails[1]).toContain("[EMAIL]");
    });

    it("should scrub arrays of objects", () => {
      const scrubber = new ContentScrubber();
      const obj = {
        users: [{ email: "john@example.com" }, { email: "jane@example.com" }]
      };
      const result = scrubber.scrubObject(obj);
      expect(result.users[0].email).toContain("[EMAIL]");
      expect(result.users[1].email).toContain("[EMAIL]");
    });

    it("should handle circular references", () => {
      const scrubber = new ContentScrubber();
      const obj: any = {
        email: "test@example.com",
        self: null
      };
      obj.self = obj; // Create circular reference

      expect(() => scrubber.scrubObject(obj)).not.toThrow();
      const result = scrubber.scrubObject(obj);
      expect(result.email).toContain("[EMAIL]");
      expect(result.self).toBe("[Circular]");
    });

    it("should exclude specified fields", () => {
      const scrubber = new ContentScrubber({ excludeFields: ["password"] });
      const obj = {
        email: "test@example.com",
        password: "secret123"
      };
      const result = scrubber.scrubObject(obj);
      expect(result.email).toContain("[EMAIL]");
      expect(result.password).toBe("[REDACTED]");
    });

    it("should skip functions and symbols", () => {
      const scrubber = new ContentScrubber();
      const obj = {
        email: "test@example.com",
        fn: () => "test",
        sym: Symbol("test")
      };
      const result = scrubber.scrubObject(obj);
      expect(result.email).toContain("[EMAIL]");
      expect(result).not.toHaveProperty("fn");
      expect(result).not.toHaveProperty("sym");
    });

    it("should preserve non-string primitive types", () => {
      const scrubber = new ContentScrubber();
      const obj = {
        count: 42,
        active: true,
        value: null
      };
      const result = scrubber.scrubObject(obj);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.value).toBe(null);
    });

    it("should handle non-object input", () => {
      const scrubber = new ContentScrubber();
      expect(scrubber.scrubObject(null as any)).toBe(null);
      expect(scrubber.scrubObject(undefined as any)).toBe(undefined);
      expect(scrubber.scrubObject("string" as any)).toBe("string");
    });

    it("should preserve array structure", () => {
      const scrubber = new ContentScrubber();
      const obj = {
        items: ["test@example.com", "safe text", { email: "another@example.com" }]
      };
      const result = scrubber.scrubObject(obj);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBe(3);
      expect(result.items[0]).toContain("[EMAIL]");
      expect(result.items[1]).toBe("safe text");
      expect(result.items[2].email).toContain("[EMAIL]");
    });
  });

  describe("scrubMessages", () => {
    it("should scrub content in LLM messages", () => {
      const scrubber = new ContentScrubber();
      const messages = [
        { role: "user", content: "My email is test@example.com" },
        { role: "assistant", content: "Got it, your API key is sk-1234567890abcdefghij" }
      ];
      const result = scrubber.scrubMessages(messages);
      expect(result[0].content).toContain("[EMAIL]");
      expect(result[1].content).toContain("[OPENAI_KEY]");
    });

    it("should scrub array content fields", () => {
      const scrubber = new ContentScrubber();
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: "Email: test@example.com" },
            { type: "image", url: "https://example.com/image.jpg" }
          ]
        }
      ];
      const result = scrubber.scrubMessages(messages);
      expect(result[0].content[0].text).toContain("[EMAIL]");
      expect(result[0].content[1].url).toBe("https://example.com/image.jpg");
    });

    it("should preserve non-array content", () => {
      const scrubber = new ContentScrubber();
      const messages = [
        { role: "user", content: "Normal text" },
        { role: "assistant", content: null }
      ];
      const result = scrubber.scrubMessages(messages);
      expect(result[0].content).toBe("Normal text");
      expect(result[1].content).toBe(null);
    });

    it("should handle non-array input", () => {
      const scrubber = new ContentScrubber();
      expect(scrubber.scrubMessages(null as any)).toBe(null);
      expect(scrubber.scrubMessages("not an array" as any)).toBe("not an array");
    });

    it("should preserve message structure", () => {
      const scrubber = new ContentScrubber();
      const messages = [
        {
          role: "user",
          content: "test@example.com",
          timestamp: 1234567890,
          metadata: { key: "value" }
        }
      ];
      const result = scrubber.scrubMessages(messages);
      expect(result[0].role).toBe("user");
      expect(result[0].timestamp).toBe(1234567890);
      expect(result[0].metadata.key).toBe("value");
      expect(result[0].content).toContain("[EMAIL]");
    });

    it("should scrub mixed content types", () => {
      const scrubber = new ContentScrubber();
      const messages = [
        {
          role: "user",
          content: [
            "Direct text with test@example.com",
            { type: "text", text: "Text with phone 555-123-4567" }
          ]
        }
      ];
      const result = scrubber.scrubMessages(messages);
      expect(result[0].content[0]).toContain("[EMAIL]");
      expect(result[0].content[1].text).toContain("[PHONE]");
    });
  });

  describe("custom patterns", () => {
    it("should support custom patterns", () => {
      const scrubber = new ContentScrubber({
        customPatterns: [
          { pattern: /\buser_id:\s*(\d+)/g, name: "user_id", replacement: "[USER_ID]" }
        ]
      });
      const text = "Request from user_id: 12345";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[USER_ID]");
      expect(result).not.toContain("12345");
    });

    it("should use custom replacement text", () => {
      const scrubber = new ContentScrubber({
        customPatterns: [{ pattern: /secret_token_\w+/g, name: "token", replacement: "***" }]
      });
      const text = "token: secret_token_abc123";
      const result = scrubber.scrubString(text);
      expect(result).toContain("***");
      expect(result).not.toContain("secret_token_abc123");
    });

    it("should combine built-in and custom patterns", () => {
      const scrubber = new ContentScrubber({
        customPatterns: [
          { pattern: /internal_id:\s*(\d+)/g, name: "internal_id", replacement: "[INTERNAL_ID]" }
        ]
      });
      const text = "Email: test@example.com and internal_id: 999";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[EMAIL]");
      expect(result).toContain("[INTERNAL_ID]");
    });
  });

  describe("createScrubber factory", () => {
    it("should create scrubber with default options", () => {
      const scrubber = createScrubber();
      const text = "test@example.com";
      const result = scrubber.scrubString(text);
      expect(result).toContain("[EMAIL]");
    });

    it("should create scrubber with custom options", () => {
      const scrubber = createScrubber({ pii: false });
      const text = "test@example.com";
      const result = scrubber.scrubString(text);
      expect(result).toBe("test@example.com");
    });
  });

  describe("disable all scrubbing", () => {
    it("should not scrub when both pii and secrets are disabled", () => {
      const scrubber = new ContentScrubber({ pii: false, secrets: false });
      const text = "Email: test@example.com with key sk-1234567890abcdefghij";
      const result = scrubber.scrubString(text);
      expect(result).toBe(text);
    });
  });
});
