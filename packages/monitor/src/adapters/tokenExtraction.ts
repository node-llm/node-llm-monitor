export interface ExtractedTokenUsage {
  prompt: number;
  completion: number;
  cached: number;
  cacheCreation: number;
  reasoning: number;
  image: number;
}

/**
 * Extract token counts from an event payload. Handles multiple naming
 * conventions from different providers/SDKs:
 * - Vercel AI SDK: promptTokens/completionTokens/cachedInputTokens/reasoningTokens
 * - OpenAI snake_case: prompt_tokens/completion_tokens
 * - Anthropic/industry (OTel GenAI semconv): input_tokens/output_tokens/
 *   cache_read_input_tokens/cache_creation_input_tokens/reasoning_output_tokens
 * - NodeLLM: inputTokens/outputTokens/cached_tokens/cache_creation_tokens/
 *   reasoning_tokens/image_tokens
 */
export function extractTokenUsage(payload: any): ExtractedTokenUsage {
  const usage = payload?.usage ?? payload ?? {};

  const pick = (...keys: string[]): number => {
    for (const key of keys) {
      const value = usage[key];
      if (typeof value === "number" && value > 0) return value;
    }
    return 0;
  };

  return {
    prompt: pick("promptTokens", "prompt_tokens", "inputTokens", "input_tokens"),
    completion: pick("completionTokens", "completion_tokens", "outputTokens", "output_tokens"),
    cached: pick(
      "cachedTokens",
      "cached_tokens",
      "cachedInputTokens",
      "cacheReadTokens",
      "cache_read_tokens",
      "cache_read_input_tokens"
    ),
    cacheCreation: pick(
      "cacheCreationTokens",
      "cache_creation_tokens",
      "cacheCreationInputTokens",
      "cache_creation_input_tokens"
    ),
    reasoning: pick("reasoningTokens", "reasoning_tokens", "reasoning_output_tokens"),
    image: pick("imageTokens", "image_tokens")
  };
}
