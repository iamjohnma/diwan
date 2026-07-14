// Server-only. Local-dev seeding support: creates (or refreshes) a
// password-provider login so a fresh anonymous deployment has a usable
// account without the manual insert ritual. The secret arrives pre-hashed
// (lucia Scrypt, matching auth.ts's password provider crypto) so no raw
// password ever reaches the deployment logs.
//
// Firm provisioning stays in internal/provisioning:createFirmWithOwner —
// this only handles the credential half and reports whether the user still
// needs a firm (activeFirmId === null).
import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

export const ensureLogin = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    secret: v.string(),
  },
  returns: v.object({
    userId: v.id('users'),
    activeFirmId: v.union(v.id('firms'), v.null()),
    createdUser: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();
    const now = Date.now();

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    const userId =
      existingUser?._id ??
      (await ctx.db.insert('users', {
        email,
        name: args.name,
        emailVerificationTime: now,
      }));
    // A pre-existing user may predate verification; sign-in falls into the
    // (locally unconfigured) OTP path without this.
    if (existingUser && existingUser.emailVerificationTime === undefined) {
      await ctx.db.patch('users', userId, { emailVerificationTime: now });
    }

    const existingAccount = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) =>
        q.eq('provider', 'password').eq('providerAccountId', email)
      )
      .unique();
    if (existingAccount) {
      await ctx.db.patch('authAccounts', existingAccount._id, {
        secret: args.secret,
      });
    } else {
      await ctx.db.insert('authAccounts', {
        userId,
        provider: 'password',
        providerAccountId: email,
        secret: args.secret,
      });
    }

    const user = existingUser ?? (await ctx.db.get('users', userId));
    return {
      userId,
      activeFirmId: user?.activeFirmId ?? null,
      createdUser: existingUser === null,
    };
  },
});
