import { ConvexError } from "convex/values";

// One place for every LLM call in the app, so the two AI features
// (weekly summary, burnout assessment) share the same provider chain
// instead of each hard-coding Anthropic.
//
// Order: Anthropic first when its key is set, Groq as the fallback, and
// no provider at all if neither key is configured — callers handle that
// last case by returning their own mock text, exactly as before.
//
// The point of the fallback is billing/quota outages: if Anthropic
// answers 401/402/429/5xx (or the fetch itself fails), the call moves on
// to Groq rather than surfacing an error to the user. A refusal or an
// unparseable response is a real answer, not an outage, so it stops the
// chain.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-opus-5";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

// Thrown when a provider couldn't answer for reasons that have nothing to
// do with the prompt — the next provider in the chain gets a turn.
class ProviderUnavailable extends Error {
  constructor(provider, detail) {
    super(`${provider}: ${detail}`);
    this.provider = provider;
    this.detail = detail;
  }
}

async function callAnthropic({ apiKey, prompt, maxTokens, label }) {
  let response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        output_config: { effort: "low" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    throw new ProviderUnavailable("Claude", `request failed (${err.message})`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ProviderUnavailable("Claude", `HTTP ${response.status} — ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  if (data.stop_reason === "refusal") {
    throw new ConvexError(`Claude declined to ${label}.`);
  }

  const textBlock = data.content?.find((block) => block.type === "text");
  if (!textBlock) {
    throw new ConvexError("Claude returned no text content.");
  }
  return { text: textBlock.text, provider: "Claude", model: ANTHROPIC_MODEL };
}

async function callGroq({ apiKey, prompt, maxTokens, label }) {
  const model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    throw new ProviderUnavailable("Groq", `request failed (${err.message})`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ProviderUnavailable("Groq", `HTTP ${response.status} — ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  // Groq exposes a refusal as an OpenAI-style finish_reason rather than a
  // dedicated stop_reason.
  if (choice?.finish_reason === "content_filter") {
    throw new ConvexError(`The model declined to ${label}.`);
  }

  const text = choice?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new ConvexError("The model returned no text content.");
  }
  return { text, provider: "Groq", model };
}

// Returns { text, provider, model }, or null when no provider is
// configured at all — the caller's cue to return its mock.
export async function generateText({ prompt, maxTokens, label }) {
  const chain = [];
  if (process.env.ANTHROPIC_API_KEY) {
    chain.push(() =>
      callAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY, prompt, maxTokens, label }),
    );
  }
  if (process.env.GROQ_API_KEY) {
    chain.push(() => callGroq({ apiKey: process.env.GROQ_API_KEY, prompt, maxTokens, label }));
  }
  if (chain.length === 0) {
    return null;
  }

  const outages = [];
  for (const [index, call] of chain.entries()) {
    try {
      return await call();
    } catch (err) {
      if (!(err instanceof ProviderUnavailable)) {
        throw err;
      }
      outages.push(err.message);
      if (index === chain.length - 1) {
        throw new ConvexError(`Every AI provider failed. ${outages.join(" | ")}`);
      }
      // Otherwise fall through to the next provider.
    }
  }
}
