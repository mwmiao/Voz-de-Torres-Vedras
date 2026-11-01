-- Remove dados fictícios de instalações anteriores, antes de retirar as colunas que os assinalavam.
DELETE FROM "Issue" WHERE "isExample" = true;
DELETE FROM "Claim" WHERE "isExample" = true;
DELETE FROM "BudgetEntry" WHERE "isExample" = true;
DELETE FROM "Claim" WHERE "kind" = 'RESIDENTES';
-- AlterEnum
ALTER TYPE "BudgetKind" ADD VALUE 'RESUMO';

-- AlterEnum
BEGIN;
CREATE TYPE "ContentKind_new" AS ENUM ('REGISTO_OFICIAL', 'CONTEXTO_EDITORIAL');
ALTER TABLE "public"."Claim" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Claim" ALTER COLUMN "kind" TYPE "ContentKind_new" USING ("kind"::text::"ContentKind_new");
ALTER TYPE "ContentKind" RENAME TO "ContentKind_old";
ALTER TYPE "ContentKind_new" RENAME TO "ContentKind";
DROP TYPE "public"."ContentKind_old";
ALTER TABLE "Claim" ALTER COLUMN "kind" SET DEFAULT 'CONTEXTO_EDITORIAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "IssueOption" DROP CONSTRAINT "IssueOption_issueId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationEvent" DROP CONSTRAINT "ModerationEvent_actorId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_issueId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_optionId_fkey";

-- DropForeignKey
ALTER TABLE "Position" DROP CONSTRAINT "Position_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProposalSupport" DROP CONSTRAINT "ProposalSupport_proposalId_fkey";

-- DropForeignKey
ALTER TABLE "ProposalSupport" DROP CONSTRAINT "ProposalSupport_userId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "TopicProposal" DROP CONSTRAINT "TopicProposal_authorId_fkey";

-- DropForeignKey
ALTER TABLE "TopicProposal" DROP CONSTRAINT "TopicProposal_issueId_fkey";

-- DropIndex
DROP INDEX "Issue_status_category_idx";

-- AlterTable
ALTER TABLE "BudgetEntry" DROP COLUMN "isExample",
ADD COLUMN     "approximate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "isExample";

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "isExample",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Decision" DROP COLUMN "isExample",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "voteNote" TEXT;

-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "createdAt",
DROP COLUMN "isExample",
DROP COLUMN "status",
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "isExample",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Official" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Source" DROP COLUMN "isExample";

-- DropTable
DROP TABLE "AppSetting";

-- DropTable
DROP TABLE "IssueOption";

-- DropTable
DROP TABLE "LoginToken";

-- DropTable
DROP TABLE "ModerationEvent";

-- DropTable
DROP TABLE "Position";

-- DropTable
DROP TABLE "ProposalSupport";

-- DropTable
DROP TABLE "RateLimit";

-- DropTable
DROP TABLE "Report";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "TopicProposal";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "IssueStatus";

-- DropEnum
DROP TYPE "ProposalStatus";

-- DropEnum
DROP TYPE "ReportStatus";

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE INDEX "Issue_category_idx" ON "Issue"("category");

