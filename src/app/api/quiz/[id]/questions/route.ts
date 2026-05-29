import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: params.id },
    include: { questions: { select: { id: true } } },
  });
  if (!quiz || quiz.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { text, type, imageUrl } = await req.json();
  const order = quiz.questions.length + 1;

  const question = await prisma.question.create({
    data: {
      quizId: params.id,
      text: text ?? "",
      type: type ?? "SINGLE",
      imageUrl: imageUrl ?? null,
      order,
    },
    include: { answers: true },
  });

  return NextResponse.json(question, { status: 201 });
}
