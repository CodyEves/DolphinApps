import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const rawName = params.name;
        const name =
          typeof rawName === "string" && rawName.trim().length > 0
            ? rawName.trim()
            : email.split("@")[0] || "Team member";

        return { email, name };
      },
    }),
  ],
});
