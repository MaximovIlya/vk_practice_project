import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ORGANIZER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, category, timePerQuestion, pointsPerQuestion } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const quiz = await prisma.quiz.create({
    data: {
      title: title.trim(),
      description: description?.trim() ?? "",
      category: category ?? "General",
      timePerQuestion: timePerQuestion ?? 30,
      pointsPerQuestion: pointsPerQuestion ?? 1000,
      authorId: session.user.id,
    },
  });

  return NextResponse.json(quiz, { status: 201 });
}
