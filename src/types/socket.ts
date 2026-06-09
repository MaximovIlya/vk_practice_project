export type Player = {
  userId: string;
  name: string;
  score: number;
  sessionPlayerId: string;
};

export type AnswerVotes = Record<string, number>; // answerId → count

export interface ServerToClientEvents {
  "player-joined":    (player: Player) => void;
  "player-left":      (userId: string) => void;
  "quiz-started":     (data: { questionIndex: number }) => void;
  "question-started": (data: { questionIndex: number; endsAt: number }) => void;
  "answer-received":  (data: { votes: AnswerVotes; totalAnswered: number }) => void;
  "answer-result":    (data: { points: number; isCorrect: boolean }) => void;
  "question-ended":   (data: { correctAnswerIds: string[]; votes: AnswerVotes; questionIndex?: number }) => void;
  "score-update":     (players: Player[]) => void;
  "quiz-finished":    (players: Player[]) => void;
  "error":            (msg: string) => void;
}

export interface ClientToServerEvents {
  "organizer-join": (data: { sessionId: string }) => void;
  "join-room":     (data: { roomCode: string; userId: string; name: string }) => void;
  "start-quiz":    (data: { sessionId: string }) => void;
  "next-question": (data: { sessionId: string }) => void;
  "end-question":  (data: { sessionId: string }) => void;
  "submit-answer": (data: { sessionId: string; questionId: string; answerIds: string[]; userId: string }) => void;
}
