import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      // The default GitHub provider only keeps id/name/email/image from the
      // profile response, dropping the actual GitHub handle (`login`) since
      // `name` can be a display name instead. Carry `login` through as an
      // extra field so afterUserCreatedOrUpdated below can persist it.
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubUsername: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, profile }) {
      const githubUsername = profile.githubUsername;
      if (typeof githubUsername === "string" && githubUsername.length > 0) {
        await ctx.db.patch(userId, { githubUsername });
      }
    },
  },
});
