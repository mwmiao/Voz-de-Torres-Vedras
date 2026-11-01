-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IssueDate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    CONSTRAINT "IssueDate_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hasTime" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REALIZADA',
    "agendaStatus" TEXT NOT NULL DEFAULT 'PUBLICADA',
    "participation" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSourceId" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'UNCHANGED'
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "itemNumber" TEXT,
    "proposalRef" TEXT,
    "title" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "voteMode" TEXT NOT NULL DEFAULT 'NAO_APLICAVEL',
    "votesFor" INTEGER,
    "votesAgainst" INTEGER,
    "abstentions" INTEGER,
    "voteNote" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchText" TEXT NOT NULL DEFAULT '',
    "dataSourceId" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'UNCHANGED',
    CONSTRAINT "Decision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoteRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "decisionId" TEXT NOT NULL,
    "officialId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    CONSTRAINT "VoteRecord_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoteRecord_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "Official" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Official" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "party" TEXT,
    "parish" TEXT,
    "portfolios" JSONB NOT NULL DEFAULT [],
    "order" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSourceId" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'UNCHANGED'
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CommitteeMembership" (
    "committeeId" TEXT NOT NULL,
    "officialId" TEXT NOT NULL,
    "isChair" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("committeeId", "officialId"),
    CONSTRAINT "CommitteeMembership_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeMembership_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "Official" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "official" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" DATETIME,
    "retrievedAt" DATETIME NOT NULL,
    "excerpt" TEXT,
    "data" JSONB,
    "contentHash" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchText" TEXT NOT NULL DEFAULT '',
    "dataSourceId" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'UNCHANGED',
    "importRunId" TEXT,
    CONSTRAINT "Source_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CONTEXTO_EDITORIAL',
    "issueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Claim_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "awardingBody" TEXT NOT NULL,
    "awardingNif" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierNif" TEXT,
    "supplierIsPerson" BOOLEAN NOT NULL DEFAULT false,
    "procedureType" TEXT NOT NULL,
    "contractType" TEXT,
    "cpvCode" TEXT,
    "cpvLabel" TEXT,
    "priceEur" DECIMAL NOT NULL,
    "signedAt" DATETIME,
    "publishedAt" DATETIME,
    "durationDays" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchText" TEXT NOT NULL DEFAULT '',
    "dataSourceId" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'UNCHANGED',
    "importRunId" TEXT,
    CONSTRAINT "Contract_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractModification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseId" TEXT NOT NULL,
    "date" DATETIME,
    "actType" TEXT,
    "grounds" TEXT,
    "newPriceEur" DECIMAL,
    "newDurationDays" INTEGER,
    "publishedAt" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "dataSourceId" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractModification_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Contract" ("baseId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountEur" DECIMAL NOT NULL,
    "approximate" BOOLEAN NOT NULL DEFAULT false,
    "asOf" DATETIME,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSourceId" TEXT,
    "updateStatus" TEXT NOT NULL DEFAULT 'UNCHANGED'
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataset" TEXT NOT NULL,
    "dataSourceId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "retrievedAt" DATETIME NOT NULL,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataSourceState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastRunAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastStatus" TEXT NOT NULL DEFAULT 'NUNCA_EXECUTADA',
    "lastError" TEXT,
    "revision" TEXT,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "UpdateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "runId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    CONSTRAINT "UpdateEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    CONSTRAINT "FieldChange_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "UpdateEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_IssueToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_IssueToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_IssueToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_MeetingToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MeetingToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MeetingToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DecisionToIssue" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DecisionToIssue_A_fkey" FOREIGN KEY ("A") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DecisionToIssue_B_fkey" FOREIGN KEY ("B") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_DecisionToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DecisionToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Decision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DecisionToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_OfficialToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_OfficialToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Official" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_OfficialToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CommitteeToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CommitteeToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CommitteeToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ClaimToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ClaimToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClaimToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ContractToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ContractToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ContractToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BudgetEntryToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BudgetEntryToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "BudgetEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BudgetEntryToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Issue_slug_key" ON "Issue"("slug");

-- CreateIndex
CREATE INDEX "Issue_category_idx" ON "Issue"("category");

-- CreateIndex
CREATE INDEX "IssueDate_issueId_idx" ON "IssueDate"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_slug_key" ON "Meeting"("slug");

-- CreateIndex
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_slug_key" ON "Decision"("slug");

-- CreateIndex
CREATE INDEX "Decision_meetingId_idx" ON "Decision"("meetingId");

-- CreateIndex
CREATE INDEX "Decision_outcome_idx" ON "Decision"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "VoteRecord_decisionId_officialId_key" ON "VoteRecord"("decisionId", "officialId");

-- CreateIndex
CREATE UNIQUE INDEX "Official_slug_key" ON "Official"("slug");

-- CreateIndex
CREATE INDEX "Official_body_order_idx" ON "Official"("body", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_slug_key" ON "Committee"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE INDEX "Source_type_idx" ON "Source"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_baseId_key" ON "Contract"("baseId");

-- CreateIndex
CREATE INDEX "Contract_signedAt_idx" ON "Contract"("signedAt");

-- CreateIndex
CREATE INDEX "Contract_awardingNif_idx" ON "Contract"("awardingNif");

-- CreateIndex
CREATE INDEX "Contract_procedureType_idx" ON "Contract"("procedureType");

-- CreateIndex
CREATE UNIQUE INDEX "ContractModification_baseId_date_actType_key" ON "ContractModification"("baseId", "date", "actType");

-- CreateIndex
CREATE INDEX "BudgetEntry_year_kind_idx" ON "BudgetEntry"("year", "kind");

-- CreateIndex
CREATE INDEX "UpdateEvent_occurredAt_idx" ON "UpdateEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "UpdateEvent_entityType_entityKey_idx" ON "UpdateEvent"("entityType", "entityKey");

-- CreateIndex
CREATE INDEX "FieldChange_eventId_idx" ON "FieldChange"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "_IssueToSource_AB_unique" ON "_IssueToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_IssueToSource_B_index" ON "_IssueToSource"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MeetingToSource_AB_unique" ON "_MeetingToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_MeetingToSource_B_index" ON "_MeetingToSource"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DecisionToIssue_AB_unique" ON "_DecisionToIssue"("A", "B");

-- CreateIndex
CREATE INDEX "_DecisionToIssue_B_index" ON "_DecisionToIssue"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_DecisionToSource_AB_unique" ON "_DecisionToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_DecisionToSource_B_index" ON "_DecisionToSource"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_OfficialToSource_AB_unique" ON "_OfficialToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_OfficialToSource_B_index" ON "_OfficialToSource"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CommitteeToSource_AB_unique" ON "_CommitteeToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_CommitteeToSource_B_index" ON "_CommitteeToSource"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ClaimToSource_AB_unique" ON "_ClaimToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_ClaimToSource_B_index" ON "_ClaimToSource"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ContractToSource_AB_unique" ON "_ContractToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_ContractToSource_B_index" ON "_ContractToSource"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_BudgetEntryToSource_AB_unique" ON "_BudgetEntryToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_BudgetEntryToSource_B_index" ON "_BudgetEntryToSource"("B");

