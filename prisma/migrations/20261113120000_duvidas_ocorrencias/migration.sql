-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_incidents" (
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
    "doubts" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_incidents" ("archive_reason", "archivedAt", "articleCategory", "author", "category", "contentHash", "data_period", "engagement", "first_reported_at", "flags", "freguesiaSlug", "geographic_area", "geographic_area_type", "hasConflict", "hasTime", "heldForReview", "id", "incidentEnd", "incidentStart", "independenceKey", "key", "last_checked_at", "latitude", "longitude", "phase", "placeName", "precision", "publication_date", "radiusM", "retrieval_date", "reviewReasons", "review_status", "sourceChanged", "sourceLinkNote", "sourceLinkPublic", "sourceName", "sourceRemovedAt", "source_id", "source_tier", "source_url", "summary", "tags", "textFingerprint", "titleFingerprint", "update_status", "verification_status") SELECT "archive_reason", "archivedAt", "articleCategory", "author", "category", "contentHash", "data_period", "engagement", "first_reported_at", "flags", "freguesiaSlug", "geographic_area", "geographic_area_type", "hasConflict", "hasTime", "heldForReview", "id", "incidentEnd", "incidentStart", "independenceKey", "key", "last_checked_at", "latitude", "longitude", "phase", "placeName", "precision", "publication_date", "radiusM", "retrieval_date", "reviewReasons", "review_status", "sourceChanged", "sourceLinkNote", "sourceLinkPublic", "sourceName", "sourceRemovedAt", "source_id", "source_tier", "source_url", "summary", "tags", "textFingerprint", "titleFingerprint", "update_status", "verification_status" FROM "incidents";
DROP TABLE "incidents";
ALTER TABLE "new_incidents" RENAME TO "incidents";
CREATE UNIQUE INDEX "incidents_key_key" ON "incidents"("key");
CREATE INDEX "incidents_incidentStart_idx" ON "incidents"("incidentStart");
CREATE INDEX "incidents_freguesiaSlug_idx" ON "incidents"("freguesiaSlug");
CREATE INDEX "incidents_verification_status_idx" ON "incidents"("verification_status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Registos anteriores guardavam só o indício «ambiguo»: passam a ter uma dúvida, para continuarem retidos.
UPDATE "incidents" SET "doubts" = 'área ou categoria ambígua' WHERE (',' || "flags" || ',') LIKE '%,ambiguo,%';
UPDATE "incidents" SET "flags" = trim(replace(replace(',' || "flags" || ',', ',ambiguo,', ','), ',,', ','), ',') WHERE (',' || "flags" || ',') LIKE '%,ambiguo,%';
