-- Legacy Yahoo credentials were only base64-obfuscated. They cannot be migrated safely without
-- exposing plaintext, so erase them and require a fresh managed link request.
UPDATE "LeagueLink"
SET "credentialsEnc" = NULL,
    "lastSyncedAt" = NULL,
    "status" = 'expired'
WHERE "platform" = 'yahoo'
  AND "credentialsEnc" IS NOT NULL;

-- Remove exact duplicate link identities before enforcing idempotent link creation.
-- Keep one deterministic link record; associated shared League/Draft data is not deleted.
DELETE FROM "LeagueLink" duplicate
USING "LeagueLink" keeper
WHERE duplicate."userId" = keeper."userId"
  AND duplicate."platform" = keeper."platform"
  AND duplicate."externalLeagueId" = keeper."externalLeagueId"
  AND duplicate."externalLeagueId" IS NOT NULL
  AND duplicate."id" > keeper."id";

-- CreateIndex
CREATE UNIQUE INDEX "LeagueLink_userId_platform_externalLeagueId_key"
ON "LeagueLink"("userId", "platform", "externalLeagueId");
