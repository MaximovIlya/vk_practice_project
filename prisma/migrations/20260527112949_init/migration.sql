-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ORGANIZER', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "timePerQuestion" INTEGER NOT NULL DEFAULT 30,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE',
    "order" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAnswer" (
    "id" TEXT NOT NULL,
    "sessionPlayerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCorrect" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AnswerToPlayerAnswer" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "QuizSession_roomCode_key" ON "QuizSession"("roomCode");

-- CreateIndex
CREATE UNIQUE INDEX "_AnswerToPlayerAnswer_AB_unique" ON "_AnswerToPlayerAnswer"("A", "B");

-- CreateIndex
CREATE INDEX "_AnswerToPlayerAnswer_B_index" ON "_AnswerToPlayerAnswer"("B");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPlayer" ADD CONSTRAINT "SessionPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAnswer" ADD CONSTRAINT "PlayerAnswer_sessionPlayerId_fkey" FOREIGN KEY ("sessionPlayerId") REFERENCES "SessionPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAnswer" ADD CONSTRAINT "PlayerAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnswerToPlayerAnswer" ADD CONSTRAINT "_AnswerToPlayerAnswer_A_fkey" FOREIGN KEY ("A") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnswerToPlayerAnswer" ADD CONSTRAINT "_AnswerToPlayerAnswer_B_fkey" FOREIGN KEY ("B") REFERENCES "PlayerAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
