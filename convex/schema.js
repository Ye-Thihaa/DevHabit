import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    githubUsername: v.optional(v.string()),
    tokenIdentifier: v.optional(v.string()),
    deviceId: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_device", ["deviceId"]),

  dailyLogs: defineTable({
    userId: v.id("users"),
    date: v.string(), // ISO date, e.g. "2026-08-07"
    codingHours: v.number(),
    sleepHours: v.number(),
    coffeeIntake: v.number(),
    githubCommits: v.number(),
    aiToolUsageMinutes: v.number(),
    problemsSolved: v.number(),
    taskDifficulty: v.number(), // 1-5
    experienceLevel: v.number(), // 1-5
    programmingScore: v.number(), // 1-10
  })
    .index("by_user_and_date", ["userId", "date"])
    .index("by_user", ["userId"]),
});
