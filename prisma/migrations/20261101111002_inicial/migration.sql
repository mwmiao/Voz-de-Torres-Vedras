-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Body" AS ENUM ('ASSEMBLEIA_MUNICIPAL', 'EXECUTIVO_MUNICIPAL');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('CONVOCADA', 'REALIZADA');

-- CreateEnum
CREATE TYPE "AgendaStatus" AS ENUM ('NAO_PUBLICADA', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('APROVADO', 'REPROVADO', 'ADIADO', 'RETIRADO', 'TOMADA_CONHECIMENTO', 'REMETIDO', 'POR_PUBLICAR');

-- CreateEnum
CREATE TYPE "VoteMode" AS ENUM ('UNANIMIDADE', 'MAIORIA', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('FAVOR', 'CONTRA', 'ABSTENCAO');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'ENCERRADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SUBMETIDA', 'A_RECOLHER_APOIOS', 'EM_REVISAO', 'PROMOVIDA', 'RECUSADA', 'DUPLICADA');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ATA', 'MINUTA', 'VIDEO', 'AGENDA', 'EDITAL', 'DOCUMENTO_PDF', 'ORCAMENTO', 'CONTRATO', 'DIARIO_REPUBLICA', 'PAGINA_OFICIAL', 'DATASET');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('RESIDENTES', 'REGISTO_OFICIAL', 'CONTEXTO_EDITORIAL');

-- CreateEnum
CREATE TYPE "BudgetKind" AS ENUM ('RECEITA', 'DESPESA', 'SITUACAO_FINANCEIRA');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('ABERTA', 'RESOLVIDA', 'REJEITADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'RASCUNHO',
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueOption" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "exampleCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IssueOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueDate" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "IssueDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicProposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'SUBMETIDA',
    "authorId" TEXT,
    "issueId" TEXT,
    "duplicateOf" TEXT,
    "moderatorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSupport" (
    "userId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSupport_pkey" PRIMARY KEY ("userId","proposalId")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" "Body" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hasTime" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'REALIZADA',
    "agendaStatus" "AgendaStatus" NOT NULL DEFAULT 'PUBLICADA',
    "participation" TEXT,
    "isExample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "itemNumber" TEXT,
    "proposalRef" TEXT,
    "title" TEXT NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "voteMode" "VoteMode" NOT NULL DEFAULT 'NAO_APLICAVEL',
    "votesFor" INTEGER,
    "votesAgainst" INTEGER,
    "abstentions" INTEGER,
    "isExample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteRecord" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "officialId" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,

    CONSTRAINT "VoteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Official" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" "Body" NOT NULL,
    "party" TEXT,
    "parish" TEXT,
    "portfolios" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Official_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" "Body" NOT NULL,

    CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMembership" (
    "committeeId" TEXT NOT NULL,
    "officialId" TEXT NOT NULL,
    "isChair" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CommitteeMembership_pkey" PRIMARY KEY ("committeeId","officialId")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "official" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "excerpt" TEXT,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "importRunId" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL DEFAULT 'CONTEXTO_EDITORIAL',
    "issueId" TEXT,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
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
    "priceEur" DECIMAL(14,2) NOT NULL,
    "signedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "durationDays" INTEGER,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "importRunId" TEXT,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetEntry" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" "BudgetKind" NOT NULL,
    "label" TEXT NOT NULL,
    "amountEur" DECIMAL(14,2) NOT NULL,
    "asOf" TIMESTAMP(3),
    "note" TEXT,
    "isExample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BudgetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'ABERTA',
    "reporterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IssueToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IssueToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MeetingToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MeetingToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DecisionToIssue" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DecisionToIssue_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DecisionToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DecisionToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_OfficialToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OfficialToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CommitteeToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CommitteeToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ClaimToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ClaimToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContractToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContractToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BudgetEntryToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BudgetEntryToSource_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "LoginToken_tokenHash_key" ON "LoginToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginToken_emailHash_idx" ON "LoginToken"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_slug_key" ON "Issue"("slug");

-- CreateIndex
CREATE INDEX "Issue_status_category_idx" ON "Issue"("status", "category");

-- CreateIndex
CREATE INDEX "IssueOption_issueId_idx" ON "IssueOption"("issueId");

-- CreateIndex
CREATE INDEX "IssueDate_issueId_idx" ON "IssueDate"("issueId");

-- CreateIndex
CREATE INDEX "Position_issueId_optionId_idx" ON "Position"("issueId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_issueId_key" ON "Position"("userId", "issueId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicProposal_issueId_key" ON "TopicProposal"("issueId");

-- CreateIndex
CREATE INDEX "TopicProposal_status_idx" ON "TopicProposal"("status");

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
CREATE INDEX "BudgetEntry_year_kind_idx" ON "BudgetEntry"("year", "kind");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "ModerationEvent_createdAt_idx" ON "ModerationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "_IssueToSource_B_index" ON "_IssueToSource"("B");

-- CreateIndex
CREATE INDEX "_MeetingToSource_B_index" ON "_MeetingToSource"("B");

-- CreateIndex
CREATE INDEX "_DecisionToIssue_B_index" ON "_DecisionToIssue"("B");

-- CreateIndex
CREATE INDEX "_DecisionToSource_B_index" ON "_DecisionToSource"("B");

-- CreateIndex
CREATE INDEX "_OfficialToSource_B_index" ON "_OfficialToSource"("B");

-- CreateIndex
CREATE INDEX "_CommitteeToSource_B_index" ON "_CommitteeToSource"("B");

-- CreateIndex
CREATE INDEX "_ClaimToSource_B_index" ON "_ClaimToSource"("B");

-- CreateIndex
CREATE INDEX "_ContractToSource_B_index" ON "_ContractToSource"("B");

-- CreateIndex
CREATE INDEX "_BudgetEntryToSource_B_index" ON "_BudgetEntryToSource"("B");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueOption" ADD CONSTRAINT "IssueOption_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueDate" ADD CONSTRAINT "IssueDate_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "IssueOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProposal" ADD CONSTRAINT "TopicProposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProposal" ADD CONSTRAINT "TopicProposal_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSupport" ADD CONSTRAINT "ProposalSupport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSupport" ADD CONSTRAINT "ProposalSupport_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TopicProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "Official"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMembership" ADD CONSTRAINT "CommitteeMembership_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "Official"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IssueToSource" ADD CONSTRAINT "_IssueToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IssueToSource" ADD CONSTRAINT "_IssueToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingToSource" ADD CONSTRAINT "_MeetingToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingToSource" ADD CONSTRAINT "_MeetingToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionToIssue" ADD CONSTRAINT "_DecisionToIssue_A_fkey" FOREIGN KEY ("A") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionToIssue" ADD CONSTRAINT "_DecisionToIssue_B_fkey" FOREIGN KEY ("B") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionToSource" ADD CONSTRAINT "_DecisionToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionToSource" ADD CONSTRAINT "_DecisionToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfficialToSource" ADD CONSTRAINT "_OfficialToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Official"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfficialToSource" ADD CONSTRAINT "_OfficialToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommitteeToSource" ADD CONSTRAINT "_CommitteeToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommitteeToSource" ADD CONSTRAINT "_CommitteeToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClaimToSource" ADD CONSTRAINT "_ClaimToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClaimToSource" ADD CONSTRAINT "_ClaimToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractToSource" ADD CONSTRAINT "_ContractToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractToSource" ADD CONSTRAINT "_ContractToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BudgetEntryToSource" ADD CONSTRAINT "_BudgetEntryToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "BudgetEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BudgetEntryToSource" ADD CONSTRAINT "_BudgetEntryToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
