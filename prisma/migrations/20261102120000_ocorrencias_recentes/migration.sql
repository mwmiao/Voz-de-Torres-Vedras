-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "titleFingerprint" TEXT NOT NULL DEFAULT '',
    "textFingerprint" TEXT NOT NULL DEFAULT '',
    "sourceName" TEXT NOT NULL,
    "source_tier" TEXT NOT NULL,
    "independenceKey" TEXT NOT NULL,
    "author" TEXT,
    "articleCategory" TEXT,
    "sourceLinkPublic" BOOLEAN NOT NULL DEFAULT true,
    "sourceLinkNote" TEXT,
    "incidentStart" DATETIME NOT NULL,
    "incidentEnd" DATETIME,
    "hasTime" BOOLEAN NOT NULL DEFAULT false,
    "phase" TEXT,
    "verification_status" TEXT NOT NULL,
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "flags" TEXT NOT NULL DEFAULT '',
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "first_reported_at" DATETIME NOT NULL,
    "last_checked_at" DATETIME NOT NULL,
    "review_status" TEXT NOT NULL DEFAULT 'NAO_NECESSARIA',
    "reviewReasons" TEXT NOT NULL DEFAULT '',
    "heldForReview" BOOLEAN NOT NULL DEFAULT false,
    "sourceRemovedAt" DATETIME,
    "sourceChanged" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "archive_reason" TEXT,
    "freguesiaSlug" TEXT NOT NULL,
    "placeName" TEXT NOT NULL,
    "precision" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "radiusM" INTEGER,
    "contentHash" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME NOT NULL,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL,
    "geographic_area_type" TEXT NOT NULL DEFAULT 'FREGUESIA',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW'
);

-- CreateTable
CREATE TABLE "incident_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "source_tier" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "independenceKey" TEXT NOT NULL,
    "author" TEXT,
    "articleCategory" TEXT,
    "publication_date" DATETIME NOT NULL,
    "claim" TEXT NOT NULL,
    "agreement" TEXT NOT NULL,
    "duplicateOfUrl" TEXT,
    "titleFingerprint" TEXT NOT NULL DEFAULT '',
    "linkPublic" BOOLEAN NOT NULL DEFAULT true,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "removedAt" DATETIME,
    "source_id" TEXT NOT NULL,
    "retrieval_date" DATETIME NOT NULL,
    CONSTRAINT "incident_references_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incident_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "duplicateOfKey" TEXT,
    "source_id" TEXT NOT NULL,
    "retrieval_date" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "incidents_key_key" ON "incidents"("key");

-- CreateIndex
CREATE INDEX "incidents_incidentStart_idx" ON "incidents"("incidentStart");

-- CreateIndex
CREATE INDEX "incidents_freguesiaSlug_idx" ON "incidents"("freguesiaSlug");

-- CreateIndex
CREATE INDEX "incidents_verification_status_idx" ON "incidents"("verification_status");

-- CreateIndex
CREATE INDEX "incident_references_url_idx" ON "incident_references"("url");

-- CreateIndex
CREATE UNIQUE INDEX "incident_references_incidentId_url_key" ON "incident_references"("incidentId", "url");

-- CreateIndex
CREATE INDEX "incident_logs_retrieval_date_idx" ON "incident_logs"("retrieval_date");

-- CreateIndex
CREATE INDEX "incident_logs_source_url_idx" ON "incident_logs"("source_url");

