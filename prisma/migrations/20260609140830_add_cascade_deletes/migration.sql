-- DropForeignKey
ALTER TABLE "PlayerAnswer" DROP CONSTRAINT "PlayerAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerAnswer" DROP CONSTRAINT "PlayerAnswer_sessionPlayerId_fkey";

-- DropForeignKey
ALTER TABLE "QuizSession" DROP CONSTRAINT "QuizSession_quizId_fkey";

-- DropForeignKey
ALTER TABLE "SessionPlayer" DROP CONSTRAINT "SessionPlayer_sessionId_fkey";

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAnswer" ADD CONSTRAINT "PlayerAnswer_sessionPlayerId_fkey" FOREIGN KEY ("sessionPlayerId") REFERENCES "SessionPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAnswer" ADD CONSTRAINT "PlayerAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
