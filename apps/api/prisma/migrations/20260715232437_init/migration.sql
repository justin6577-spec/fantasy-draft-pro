-- CreateEnum
CREATE TYPE "LeaguePlatform" AS ENUM ('native', 'yahoo', 'sleeper', 'espn');

-- CreateEnum
CREATE TYPE "LeagueLinkStatus" AS ENUM ('active', 'expired', 'disconnected');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('scheduled', 'in_progress', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "PickSource" AS ENUM ('manual', 'auto', 'skip');

-- CreateEnum
CREATE TYPE "EntitlementTier" AS ENUM ('free', 'premium');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('active', 'expired', 'grace_period', 'revoked');

-- CreateEnum
CREATE TYPE "NewsImpactTag" AS ENUM ('out', 'questionable', 'role_change', 'breakout', 'neutral');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "authProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "EntitlementTier" NOT NULL DEFAULT 'free',
    "seasonId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'revenuecat',
    "status" "EntitlementStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "LeaguePlatform" NOT NULL,
    "externalLeagueId" TEXT,
    "credentialsEnc" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "status" "LeagueLinkStatus" NOT NULL DEFAULT 'active',
    "leagueId" TEXT,

    CONSTRAINT "LeagueLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "LeaguePlatform" NOT NULL,
    "seasonId" TEXT NOT NULL,
    "scoringSettings" JSONB NOT NULL,
    "rosterSettings" JSONB NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "order" TEXT[],
    "currentPickIndex" INTEGER NOT NULL DEFAULT 0,
    "clockSecondsRemaining" INTEGER NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'scheduled',
    "settings" JSONB NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "pickIndex" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "madeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "PickSource" NOT NULL DEFAULT 'manual',

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "byeWeek" INTEGER,
    "externalIds" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectionRanking" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "scoringType" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "projectedPoints" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectionRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "rawText" TEXT NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSummary" (
    "id" TEXT NOT NULL,
    "articleClusterId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "impactTag" "NewsImpactTag" NOT NULL DEFAULT 'neutral',
    "citedSources" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleId" TEXT,

    CONSTRAINT "NewsSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("userId","playerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Entitlement_userId_idx" ON "Entitlement"("userId");

-- CreateIndex
CREATE INDEX "LeagueLink_userId_idx" ON "LeagueLink"("userId");

-- CreateIndex
CREATE INDEX "Draft_leagueId_idx" ON "Draft"("leagueId");

-- CreateIndex
CREATE INDEX "Pick_draftId_idx" ON "Pick"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_draftId_pickIndex_key" ON "Pick"("draftId", "pickIndex");

-- CreateIndex
CREATE INDEX "ProjectionRanking_playerId_idx" ON "ProjectionRanking"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectionRanking_playerId_seasonId_scoringType_key" ON "ProjectionRanking"("playerId", "seasonId", "scoringType");

-- CreateIndex
CREATE INDEX "NewsArticle_playerId_idx" ON "NewsArticle"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSummary_articleClusterId_key" ON "NewsSummary"("articleClusterId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSummary_articleId_key" ON "NewsSummary"("articleId");

-- CreateIndex
CREATE INDEX "NewsSummary_playerId_idx" ON "NewsSummary"("playerId");

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueLink" ADD CONSTRAINT "LeagueLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueLink" ADD CONSTRAINT "LeagueLink_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectionRanking" ADD CONSTRAINT "ProjectionRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSummary" ADD CONSTRAINT "NewsSummary_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistEntry" ADD CONSTRAINT "WatchlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistEntry" ADD CONSTRAINT "WatchlistEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
