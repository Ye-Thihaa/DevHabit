import { afterEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { generateText } from "./llm.js";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function anthropicReply(text) {
  return jsonResponse({ content: [{ type: "text", text }], stop_reason: "end_turn" });
}

function groqReply(text) {
  return jsonResponse({ choices: [{ message: { content: text }, finish_reason: "stop" }] });
}

const ask = () => generateText({ prompt: "hi", maxTokens: 64, label: "summarize this data" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("generateText provider chain", () => {
  test("returns null when neither key is set, so callers can fall back to their mock", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await ask()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("uses Anthropic and never touches Groq when Anthropic answers", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    const fetchSpy = vi.fn().mockResolvedValue(anthropicReply("from claude"));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await ask();
    expect(result).toMatchObject({ text: "from claude", provider: "Claude" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
  });

  // The whole point of the fallback: a billing/quota rejection from
  // Anthropic must not reach the user when Groq can answer.
  test.each([401, 402, 429, 500])(
    "falls back to Groq when Anthropic answers %i",
    async (status) => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("GROQ_API_KEY", "gsk-test");
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ error: "nope" }, { ok: false, status }))
        .mockResolvedValueOnce(groqReply("from groq"));
      vi.stubGlobal("fetch", fetchSpy);

      const result = await ask();
      expect(result).toMatchObject({ text: "from groq", provider: "Groq" });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [url, init] = fetchSpy.mock.calls[1];
      expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
      expect(init.headers.authorization).toBe("Bearer gsk-test");
    },
  );

  test("falls back to Groq when the Anthropic request itself throws", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(groqReply("from groq"));
    vi.stubGlobal("fetch", fetchSpy);

    expect(await ask()).toMatchObject({ provider: "Groq" });
  });

  test("uses Groq directly when only the Groq key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    const fetchSpy = vi.fn().mockResolvedValue(groqReply("from groq"));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await ask();
    expect(result).toMatchObject({ provider: "Groq", model: "llama-3.3-70b-versatile" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("honours a GROQ_MODEL override", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqReply("ok")));

    const result = await ask();
    expect(result.model).toBe("openai/gpt-oss-120b");
  });

  test("throws with both failures named when every provider is down", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, { ok: false, status: 429 })),
    );

    await expect(ask()).rejects.toThrow(ConvexError);
    await expect(ask()).rejects.toThrow(/Claude: HTTP 429.*Groq: HTTP 429/s);
  });

  // A refusal is an answer about the prompt, not an outage — retrying the
  // same prompt elsewhere would just be shopping for a compliant model.
  test("a refusal stops the chain instead of falling through to Groq", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ content: [], stop_reason: "refusal" }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(ask()).rejects.toThrow("Claude declined to summarize this data.");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("an empty Groq completion is an error, not silently empty text", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqReply("   ")));

    await expect(ask()).rejects.toThrow("returned no text content");
  });
});
