import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

export const saveExecution = mutation({
  args: {
    language: v.string(),
    code: v.string(),
    // we can get either one of them or both at the same time from piston
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not Authenticated");

    // check pro status
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id")
      .filter((u) => u.eq(u.field("userId"), identity.subject))
      .first();

    if (!user?.isPro && args.language !== "javascript") {
      throw new ConvexError(
        "Pro Subscription is required to run code in this language"
      );
    }

    await ctx.db.insert("codeExecutions", {
      ...args,
      userId: identity.subject,
    });
  },
});
