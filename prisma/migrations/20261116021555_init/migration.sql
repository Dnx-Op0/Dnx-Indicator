-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('ANNOUNCED', 'CONFIRMED', 'REVISED', 'CANCELLED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "SyncMode" AS ENUM ('INCREMENTAL', 'FULL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'UNCONFIGURED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_DIVIDEND', 'DATE_CHANGE', 'DIVIDEND_CANCELLED', 'SYNC_FAILED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nseSymbol" TEXT,
    "bseCode" TEXT,
    "sector" TEXT,
    "description" TEXT,
    "marketCap" DECIMAL(20,2),
    "dividendYield" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sourceRecordKey" TEXT NOT NULL,
    "sourceAnnouncementUrl" TEXT,
    "amount" DECIMAL(14,4) NOT NULL,
    "percentage" DECIMAL(10,4),
    "type" TEXT NOT NULL,
    "financialYear" TEXT,
    "announcementDate" DATE NOT NULL,
    "sourcePublishedAt" TIMESTAMP(3),
    "exDate" DATE,
    "recordDate" DATE,
    "paymentDate" DATE,
    "sourceRetrievedAt" TIMESTAMP(3) NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DividendRevision" (
    "id" TEXT NOT NULL,
    "dividendId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DividendRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "mode" "SyncMode" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "companiesChecked" INTEGER NOT NULL DEFAULT 0,
    "detected" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperNotification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_nseSymbol_key" ON "Company"("nseSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "Company_bseCode_key" ON "Company"("bseCode");

-- CreateIndex
CREATE UNIQUE INDEX "Dividend_sourceRecordKey_key" ON "Dividend"("sourceRecordKey");

-- CreateIndex
CREATE INDEX "Dividend_companyId_announcementDate_idx" ON "Dividend"("companyId", "announcementDate");

-- CreateIndex
CREATE INDEX "Dividend_exDate_idx" ON "Dividend"("exDate");

-- CreateIndex
CREATE INDEX "Dividend_verificationStatus_idx" ON "Dividend"("verificationStatus");

-- CreateIndex
CREATE INDEX "Dividend_source_sourceReference_idx" ON "Dividend"("source", "sourceReference");

-- CreateIndex
CREATE INDEX "DividendRevision_dividendId_recordedAt_idx" ON "DividendRevision"("dividendId", "recordedAt");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_status_startedAt_idx" ON "SyncRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperNotification_dedupeKey_key" ON "DeveloperNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "DeveloperNotification_readAt_createdAt_idx" ON "DeveloperNotification"("readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendRevision" ADD CONSTRAINT "DividendRevision_dividendId_fkey" FOREIGN KEY ("dividendId") REFERENCES "Dividend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
