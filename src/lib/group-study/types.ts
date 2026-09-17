export type RoomStatus = "waiting" | "active" | "paused" | "ended";
export type ParticipantStatus = "pending" | "approved" | "denied" | "removed" | "left";
export type RoomMember = {
  id: string; role: "host" | "participant"; status: ParticipantStatus;
  displayName: string; handRaised: boolean; chatMuted: boolean; joinedAt?: string;
};
export type RoomQuiz = {
  id: string; title: string; revealed: boolean; responseCount: number;
  questions: Array<{ id: string; question: string; options: string[]; correctAnswer?: number; explanation?: string }>;
  myAnswers: Record<string, number>;
  results?: Array<{ participantId: string; displayName: string; score: number; total: number }>;
  distribution?: Record<string, number[]>;
  correctPercent?: number;
};
export type RoomSnapshot = {
  room: {
    id: string; name: string; subject: string; topic: string; status: RoomStatus;
    locked: boolean; requireApproval: boolean; aiEnabled: boolean; chatEnabled: boolean;
    pdfEnabled: boolean; participantUploads: boolean; notesEditable: boolean; maxParticipants: number;
    code?: string; activeResourceId: string | null; page: number; followHost: boolean;
    announcement: string; createdAt: string; startedAt: string | null; expiresAt: string;
  };
  me: RoomMember;
  participants: Array<RoomMember & { online: boolean; lastSeenAt: string }>;
  messages: Array<{ id: string; author: string; authorId?: string; authorRole?: string; kind: "chat" | "ai" | "announcement" | "system"; body: string; createdAt: string; delivery?: "sending" | "failed" }>;
  resources: Array<{ id: string; name: string; mimeType: string; sizeBytes: number; pageCount: number; uploadedBy?: string; createdAt?: string; analysisStatus?: "ready" | "needs-ocr" }>;
  quiz: RoomQuiz | null;
  poll: { id: string; question: string; options: string[]; counts: number[]; myVote: number | null } | null;
  focus: { status: "running" | "paused" | "completed"; durationSeconds: number; remainingSeconds: number; endsAt: string | null } | null;
  notes: string;
  revision: number;
  notesRevision?: number;
  version?: string;
  activity?: Array<{ id: string; type: string; createdAt: string }>;
};
export type GroupStudyOverview = {
  canHost: boolean; roomId?: string;
  recentRooms: Array<{ id: string; name: string; status: RoomStatus; createdAt: string }>;
};
