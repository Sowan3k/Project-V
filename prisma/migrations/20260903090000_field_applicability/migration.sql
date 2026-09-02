
-- CreateEnum
CREATE TYPE "FieldApplicability" AS ENUM ('route_wide', 'origin_specific', 'application_channel', 'institution', 'programme', 'intake');

-- AlterTable
ALTER TABLE "field_revisions" ADD COLUMN     "applicability" "FieldApplicability"[];

