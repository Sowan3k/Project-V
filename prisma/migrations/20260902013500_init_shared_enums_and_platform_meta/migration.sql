-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FieldCategory" AS ENUM ('requirement', 'procedure', 'document', 'contact', 'address', 'link', 'cost', 'deadline', 'duration', 'community_experience', 'warning');

-- CreateEnum
CREATE TYPE "SourceClass" AS ENUM ('official', 'institutional_public', 'community_confirmed', 'community_submission', 'disputed_under_review');

-- CreateEnum
CREATE TYPE "RouteLifecycleState" AS ENUM ('experimental', 'developing', 'established', 'quiet', 'stale', 'disputed', 'dormant', 'archived', 'removed');

-- CreateEnum
CREATE TYPE "ChangeSeverity" AS ENUM ('informational', 'relevant', 'important', 'critical');

-- CreateEnum
CREATE TYPE "LinkTrustClass" AS ENUM ('trusted', 'community_submitted', 'quarantined');

-- CreateEnum
CREATE TYPE "ChallengeReason" AS ENUM ('obsolete', 'incorrect', 'broken_link', 'wrong_contact_or_address', 'duplicate_information', 'unsafe_or_scam', 'personal_information_or_harassment', 'other');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('phishing_or_scam', 'adult_content', 'malware_or_download', 'impersonation', 'harassment_or_personal_information', 'malicious_contact', 'spam', 'other_serious_concern');

-- CreateTable
CREATE TABLE "platform_meta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_meta_pkey" PRIMARY KEY ("key")
);

