import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Extends Convex Auth's built-in users table (name, image, email,
  // emailVerificationTime, phone, phoneVerificationTime, isAnonymous)
  // with our app-specific field. githubUsername is normally filled in
  // automatically from the GitHub profile on first sign-in (see
  // convex/auth.ts), but stays user-editable as a fallback/override.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    githubUsername: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

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
