-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
