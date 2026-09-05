-- Drop the OAuth credential columns from `accounts` — audit F13.
--
-- WHY
--
-- The standard Auth.js account table stores the provider's access token, refresh token and
-- id token alongside the scope, token type and expiry, and `PrismaAdapter.linkAccount`
-- writes every one of them. This application never calls Google's API on a user's behalf:
-- `getUserByAccount` resolves (provider, providerAccountId) to a user and reads nothing
-- else, which is the whole of how a returning person is recognised.
--
-- So these columns held sensitive material — the id token is a signed JWT carrying the name
-- and photograph the `users` table deliberately does not keep — for no purpose, while the
-- sign-in page told people "your email address ... nothing else" (§24.2, §24.3, invariant 7).
--
-- WHAT THIS DESTROYS, AND WHY THAT IS THE POINT
--
-- Expired OAuth tokens, and nothing else. No route, step, field, edge, revision,
-- confirmation, challenge, report, journey, note or contributor attribution is touched. The
-- account links themselves survive: `userId`, `type`, `provider` and `providerAccountId`
-- remain, so every existing sign-in continues to resolve to the same person and nobody is
-- signed out or unlinked.
--
-- This is the one shape of deletion the invariants ask for rather than forbid. Invariants 1
-- and 4 protect shared *knowledge* from destruction; §24.2 requires that personal data we do
-- not need is not held. Dropping a credential we never read serves both.
--
-- The adapter in src/server/auth/config.ts also stopped writing these in the same change, so
-- the guarantee is stated twice and neither statement depends on the other.
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "refresh_token";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "access_token";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "expires_at";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "token_type";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "scope";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "id_token";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "session_state";
