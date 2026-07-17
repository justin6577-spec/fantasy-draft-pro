-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "TurnNotificationStatus" AS ENUM ('pending', 'processing', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnNotificationOutbox" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "pickIndex" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TurnNotificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expoTicketIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurnNotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_installationId_key" ON "PushToken"("installationId");

-- CreateIndex
CREATE INDEX "PushToken_userId_enabled_idx" ON "PushToken"("userId", "enabled");

-- CreateIndex
CREATE INDEX "TurnNotificationOutbox_status_nextAttemptAt_idx" ON "TurnNotificationOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "TurnNotificationOutbox_userId_idx" ON "TurnNotificationOutbox"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TurnNotificationOutbox_draftId_pickIndex_userId_key" ON "TurnNotificationOutbox"("draftId", "pickIndex", "userId");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnNotificationOutbox" ADD CONSTRAINT "TurnNotificationOutbox_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnNotificationOutbox" ADD CONSTRAINT "TurnNotificationOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
