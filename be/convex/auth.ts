import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, createAccount } from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import type { DataModel } from "./_generated/dataModel";
import { verifyGoogleIdToken } from "./model/auth/google";
import { authorizePassword } from "./model/auth/password";
import { SesOtp } from "./model/auth/sesOtp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials<DataModel>({
      id: "google",
      authorize: async (params, ctx) => {
        if (typeof params.idToken !== "string") {
          throw new Error("GOOGLE_ID_TOKEN_REQUIRED");
        }
        const google = await verifyGoogleIdToken(params.idToken);
        const { user } = await createAccount(ctx, {
          provider: "google",
          account: { id: google.accountId },
          profile: google.profile,
          shouldLinkViaEmail: true,
        });
        if (user.archivedAt !== undefined) throw new Error("ACCOUNT_DISABLED");
        return { userId: user._id };
      },
    }),
    ConvexCredentials<DataModel>({
      id: "password",
      authorize: authorizePassword,
      crypto: {
        async hashSecret(password: string) {
          return await new Scrypt().hash(password);
        },
        async verifySecret(password: string, hash: string) {
          return await new Scrypt().verify(hash, password);
        },
      },
      extraProviders: [SesOtp],
    }),
  ],
});
