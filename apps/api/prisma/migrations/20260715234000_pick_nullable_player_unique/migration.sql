-- Allow playerId to be null on Pick (represents a skipped pick with no
-- player selected, per DraftSettings.autoPickOnExpiry = false -> skip path).
ALTER TABLE "Pick" ALTER COLUMN "playerId" DROP NOT NULL;

-- Prevent the same player from being drafted twice within a draft
-- (defense in depth alongside the application-level check inside the
-- transactional pick-submission lock).
CREATE UNIQUE INDEX "Pick_draftId_playerId_key" ON "Pick"("draftId", "playerId");
