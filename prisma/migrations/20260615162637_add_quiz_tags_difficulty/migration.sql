-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'Средне',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
