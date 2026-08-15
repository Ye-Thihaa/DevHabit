import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";
import schema from "./schema";

async function signInAs(t, userId) {
  return t.withIdentity({ subject: userId });
}

async function makeUser(t, fields = {}) {
  return await t.run(async (ctx) => ctx.db.insert("users", fields));
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function repo(fullName) {
  return { full_name: fullName, pushed_at: "2026-08-01T00:00:00Z" };
}

function commit(message) {
  return { commit: { message } };
}

function anthropicReply(text) {
  return jsonResponse({ content: [{ type: "text", text }], stop_reason: "end_turn" });
}

// Routes a single fetch spy across the two different APIs this action
// calls: GitHub's REST API and whichever LLM provider generateText picks.
function fetchRouter({ repos, commitsByRepo, llmReply }) {
  return vi.fn(async (url) => {
    const href = String(url);
    if (href.includes("/user/repos")) return jsonResponse(repos);
    if (href.includes("api.anthropic.com")) return llmReply ?? anthropicReply("mock llm reply");
    for (const [name, commits] of Object.entries(commitsByRepo)) {
      if (href.includes(`/repos/${name}/commits`)) return jsonResponse(commits);
    }
    return jsonResponse([]);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getCommitMessageFeedback", () => {
  test("throws when signed out, without calling fetch", async () => {
    const t = convexTest(schema);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(t.action(api.commitCoach.getCommitMessageFeedback, {})).rejects.toThrow(
      "Not signed in",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("throws when no GitHub username is linked", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t);
    const asUser = await signInAs(t, userId);
    vi.stubGlobal("fetch", vi.fn());

    await expect(asUser.action(api.commitCoach.getCommitMessageFeedback, {})).rejects.toThrow(
      "Link a GitHub username",
    );
  });

  test("throws when GITHUB_TOKEN is not configured on this deployment", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { githubUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(asUser.action(api.commitCoach.getCommitMessageFeedback, {})).rejects.toThrow(
      "No GITHUB_TOKEN set",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("throws a clear error when no commits are found anywhere", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { githubUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubEnv("GITHUB_TOKEN", "ghp_test");
    vi.stubGlobal("fetch", fetchRouter({ repos: [repo("octocat/empty")], commitsByRepo: {} }));

    await expect(asUser.action(api.commitCoach.getCommitMessageFeedback, {})).rejects.toThrow(
      "No recent commits found",
    );
  });

  test("skips 409/404 repos without failing the whole request", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { githubUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubEnv("GITHUB_TOKEN", "ghp_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

    const fetchSpy = vi.fn(async (url) => {
      const href = String(url);
      if (href.includes("/user/repos")) {
        return jsonResponse([repo("octocat/empty-repo"), repo("octocat/real-repo")]);
      }
      if (href.includes("/repos/octocat/empty-repo/commits")) {
        return jsonResponse({}, { ok: false, status: 409 });
      }
      if (href.includes("/repos/octocat/real-repo/commits")) {
        return jsonResponse([commit("fix bug\n\nlonger body here")]);
      }
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await asUser.action(api.commitCoach.getCommitMessageFeedback, {});
    expect(result.messagesReviewed).toBe(1);
  });

  test("only the subject line is used, not the full multi-paragraph message", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { githubUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubEnv("GITHUB_TOKEN", "ghp_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

    let capturedFeedback = null;
    vi.stubGlobal(
      "fetch",
      fetchRouter({
        repos: [repo("octocat/repo")],
        commitsByRepo: { "octocat/repo": [commit("fix bug\n\nDetailed explanation nobody reads.")] },
      }),
    );

    const result = await asUser.action(api.commitCoach.getCommitMessageFeedback, {});
    capturedFeedback = result.feedback;
    expect(capturedFeedback).toContain("fix");
    expect(capturedFeedback).not.toContain("Detailed explanation");
  });

  test("falls back to mock feedback with no LLM provider configured", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { githubUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubEnv("GITHUB_TOKEN", "ghp_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      fetchRouter({
        repos: [repo("octocat/repo")],
        commitsByRepo: { "octocat/repo": [commit("wip"), commit("Add real feature description")] },
      }),
    );

    const result = await asUser.action(api.commitCoach.getCommitMessageFeedback, {});
    expect(result.feedback).toContain("Mock feedback");
    expect(result.messagesReviewed).toBe(2);
  });

  test("uses a real LLM reply when a provider key is set", async () => {
    const t = convexTest(schema);
    const userId = await makeUser(t, { githubUsername: "octocat" });
    const asUser = await signInAs(t, userId);
    vi.stubEnv("GITHUB_TOKEN", "ghp_test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubGlobal(
      "fetch",
      fetchRouter({
        repos: [repo("octocat/repo")],
        commitsByRepo: { "octocat/repo": [commit("fix stuff")] },
        llmReply: anthropicReply("Your messages could be more descriptive."),
      }),
    );

    const result = await asUser.action(api.commitCoach.getCommitMessageFeedback, {});
    expect(result.feedback).toBe("Your messages could be more descriptive.");
  });
});
