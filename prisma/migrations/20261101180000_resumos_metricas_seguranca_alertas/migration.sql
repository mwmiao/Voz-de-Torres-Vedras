-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "simple" TEXT,
    "meaning" TEXT,
    "decidedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" DATETIME,
    "href" TEXT,
    "contentHash" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW'
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW'
);

-- CreateTable
CREATE TABLE "crime_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 100,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW'
);

-- CreateTable
CREATE TABLE "crime_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryCode" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "count" INTEGER,
    "confidential" BOOLEAN NOT NULL DEFAULT false,
    "officialRate" REAL,
    "calculatedRate" REAL,
    "populationYear" INTEGER,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW',
    CONSTRAINT "crime_records_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "crime_categories" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "freguesias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'FREGUESIA',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW'
);

-- CreateTable
CREATE TABLE "population_estimates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW'
);

-- CreateTable
CREATE TABLE "alert_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW'
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "hasOfficialEnd" BOOLEAN NOT NULL DEFAULT false,
    "hasTime" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" DATETIME NOT NULL,
    "contentHash" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Concelho de Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'NEW',
    CONSTRAINT "alerts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "alert_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "data_update_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "source_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "publication_date" DATETIME,
    "retrieval_date" DATETIME NOT NULL,
    "geographic_area" TEXT NOT NULL DEFAULT 'Torres Vedras',
    "geographic_area_type" TEXT NOT NULL DEFAULT 'CONCELHO',
    "data_period" TEXT NOT NULL DEFAULT '',
    "update_status" TEXT NOT NULL DEFAULT 'UNCHANGED'
);

-- CreateIndex
CREATE INDEX "summaries_date_idx" ON "summaries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "summaries_entityType_entityKey_key" ON "summaries"("entityType", "entityKey");

-- CreateIndex
CREATE INDEX "metrics_key_idx" ON "metrics"("key");

-- CreateIndex
CREATE UNIQUE INDEX "metrics_key_dimension_period_key" ON "metrics"("key", "dimension", "period");

-- CreateIndex
CREATE UNIQUE INDEX "crime_categories_code_key" ON "crime_categories"("code");

-- CreateIndex
CREATE INDEX "crime_records_year_idx" ON "crime_records"("year");

-- CreateIndex
CREATE UNIQUE INDEX "crime_records_categoryCode_geographic_area_data_period_key" ON "crime_records"("categoryCode", "geographic_area", "data_period");

-- CreateIndex
CREATE UNIQUE INDEX "freguesias_slug_key" ON "freguesias"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "population_estimates_geographic_area_year_key" ON "population_estimates"("geographic_area", "year");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_key_key" ON "alerts"("key");

-- CreateIndex
CREATE INDEX "alerts_endsAt_idx" ON "alerts"("endsAt");

-- CreateIndex
CREATE INDEX "alerts_type_idx" ON "alerts"("type");

-- CreateIndex
CREATE INDEX "data_update_logs_retrieval_date_idx" ON "data_update_logs"("retrieval_date");

