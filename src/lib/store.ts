"use client";

import { create } from "zustand";
import { CURRICULUM } from "./curriculum";
import type { StartupLoadingMode } from "./startup/startup-modes";

// ===== Types =====
export interface User {
  name: string;
  username: string;
  bio: string;
  school: string;
  class: string;
  avatar: string; // emoji or base64
  email: string;
  scholarClass: 9 | 11;
  jeeMode: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  color: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  versions: { content: string; at: number }[];
}

export interface Folder {
  id: string;
  name: string;
  subject?: string;
  color: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  box: number; // 1..5 Leitner
  lastReviewed: number;
  ease: number;
}

export interface Deck {
  id: string;
  name: string;
  subject?: string;
  color: string;
}

export interface QuizQuestion {
  id: string;
  type: "mcq" | "true-false" | "fill";
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  subject?: string;
  chapter?: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuizAttempt {
  id: string;
  subject?: string;
  title: string;
  questions: QuizQuestion[];
  responses: Record<string, string>;
  score: number;
  total: number;
  startedAt: number;
  finishedAt: number;
  timeSpent: number;
}

export interface Task {
  id: string;
  title: string;
  subject?: string;
  type: "study" | "assignment" | "exam" | "revision" | "other";
  date: string; // YYYY-MM-DD
  time?: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  note?: string;
}

export interface FocusSession {
  id: string;
  type: "pomodoro" | "short" | "long";
  duration: number; // seconds
  completedAt: number;
  subject?: string;
}

export interface Activity {
  id: string;
  type: string;
  text: string;
  at: number;
  icon?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: number;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  persona?: string;
}

export interface ChatThread {
  id: string;
  persona: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  /** Original browser-reported MIME type. The previewer also checks the extension. */
  mimeType?: string;
  /** Optional authenticated/signed storage URL used by hosted deployments. */
  url?: string;
  tags: string[];
  uploadedAt: number;
}

export interface ForumPost {
  id: string;
  author: string;
  avatar: string;
  subject: string;
  title: string;
  body: string;
  at: number;
  scholarClass?: 9 | 11;
  replies: { id: string; author: string; avatar: string; body: string; at: number; isAI?: boolean }[];
}

export interface QAItem {
  id: string;
  author: string;
  avatar: string;
  subject: string;
  question: string;
  at: number;
  scholarClass?: 9 | 11;
  answers: { id: string; author: string; avatar: string; body: string; at: number; isAI?: boolean }[];
}

export interface GroupMessage {
  id: string;
  author: string;
  avatar: string;
  body: string;
  at: number;
  isAI?: boolean;
}

export interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  members: number;
  messages: GroupMessage[];
}

export interface Purchase {
  id: string;
  name: string;
  category: string;
  at: number;
  price: number;
}

export interface Settings {
  theme: "dark" | "light";
  startupLoadingMode: StartupLoadingMode;
  reduceMotion: boolean;
  elamEnabled: boolean;
  elamCompact: boolean;
  sound: boolean;
  transitionMusic: boolean;
  transitionVolume: number;
  loginIntroMusic: boolean;
  academicSwitchMusic: boolean;
  autoArchive: boolean;
  fontScale: "90" | "100" | "110" | "120";
  density: "compact" | "comfortable" | "spacious";
  highContrast: boolean;
  readableFont: boolean;
  backgroundPattern: boolean;
  sidebarBehavior: "remember" | "open" | "closed";
  pageTransitions: boolean;
  leaderboard: boolean;
  communityMessages: boolean;
  profileVisibility: "public" | "friends" | "private";
  allowFriendRequests: boolean;
  shareStudyActivity: boolean;
  showOnlineStatus: boolean;
  lamPageContext: boolean;
  lamSelectedText: boolean;
  includeProfileInAI: boolean;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  type: "kpop" | "student";
  korean?: string;
  position?: string;
  status: "stranger" | "pending" | "friend" | "rejected";
  messagesSent: number;
  chat: { id: string; from: "neha" | "them"; text: string; at: number }[];
  lastActive: number;
  scholarClass?: 9 | 11;
}

export interface FriendRequest {
  id: string;
  friendId: string;
  name: string;
  avatar: string;
  at: number;
  status: "pending" | "accepted" | "rejected";
}

export interface DailyChallenge {
  date: string; // YYYY-MM-DD
  completed: boolean;
  streak: number;
}

// Class profile data — stored separately for Class 9 and Class 11
export interface ClassProfileData {
  xp: number;
  level: number;
  coins: number;
  streak: number;
  lastStudyDay: string | null;
  mastery: Record<string, number>;
  studyProgress: Record<string, number>;
  notes: Note[];
  folders: Folder[];
  decks: Deck[];
  flashcards: Flashcard[];
  tasks: Task[];
  quizAttempts: QuizAttempt[];
  sessions: FocusSession[];
  activity: Activity[];
  chatThreads: ChatThread[];
  files: FileItem[];
  bookmarks: string[];
  badges: Badge[];
  purchases: Purchase[];
  dailyChallenge: DailyChallenge;
}

interface AppState {
  // Auth / onboarding
  authed: boolean;
  onboarded: boolean;
  user: User;

  // Gamification
  xp: number;
  level: number;
  coins: number;
  streak: number;
  lastStudyDay: string | null;
  badges: Badge[];
  purchases: Purchase[];
  dailyChallenge: DailyChallenge;

  // Subject mastery
  mastery: Record<string, number>; // subjectId -> 0..100
  studyProgress: Record<string, number>; // chapterId -> 0..100

  // Modules
  notes: Note[];
  folders: Folder[];
  decks: Deck[];
  flashcards: Flashcard[];
  tasks: Task[];
  quizAttempts: QuizAttempt[];
  sessions: FocusSession[];
  activity: Activity[];
  chatThreads: ChatThread[];
  files: FileItem[];
  forumPosts: ForumPost[];
  qaItems: QAItem[];
  studyGroups: StudyGroup[];
  bookmarks: string[]; // chapter ids

  // Friends
  friends: Friend[];
  friendRequests: FriendRequest[];

  // Settings
  settings: Settings;
  devMode: boolean;

  // Class profiles (dual data storage)
  class9Data: ClassProfileData | null;
  class11Data: ClassProfileData | null;

  // ===== Actions =====
  setAuthed: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;
  updateUser: (u: Partial<User>) => void;
  setScholarClass: (cls: 9 | 11) => void;
  toggleJeeMode: () => void;
  switchClass: (cls: 9 | 11) => void;

  addXP: (n: number) => void;
  addCoins: (n: number) => void;
  setStreak: (n: number) => void;
  bumpStreak: () => void;
  setMastery: (subject: string, v: number) => void;
  setStudyProgress: (chapter: string, v: number) => void;
  unlockBadge: (id: string) => void;
  completeDailyChallenge: () => void;
  setDevMode: (v: boolean) => void;

  // Notes
  addNote: (n: Partial<Note>) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addFolder: (f: Partial<Folder>) => void;

  // Flashcards
  addDeck: (d: Partial<Deck>) => string;
  addFlashcard: (f: Partial<Flashcard>) => void;
  reviewFlashcard: (id: string, quality: "again" | "hard" | "good" | "easy") => void;

  // Quiz
  addQuizAttempt: (a: QuizAttempt) => void;

  // Tasks
  addTask: (t: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // Focus
  addSession: (s: FocusSession) => void;

  // Activity
  pushActivity: (a: Omit<Activity, "id" | "at">) => void;

  // Chat
  addChatThread: (t: Partial<ChatThread>) => string;
  addChatMessage: (threadId: string, m: Omit<ChatMessage, "id" | "at">) => void;
  clearChatThread: (id: string) => void;

  // Files
  addFile: (f: Partial<FileItem>) => void;
  deleteFile: (id: string) => void;

  // Community
  addForumPost: (p: Omit<ForumPost, "id" | "at" | "replies">) => void;
  replyForumPost: (id: string, r: Omit<ForumPost["replies"][number], "id" | "at">) => void;
  addQA: (q: Omit<QAItem, "id" | "at" | "answers">) => void;
  answerQA: (id: string, a: Omit<QAItem["answers"][number], "id" | "at">) => void;
  sendGroupMsg: (groupId: string, m: Omit<GroupMessage, "id" | "at">) => void;

  // Bookmarks
  toggleBookmark: (chapterId: string) => void;

  // Friends
  sendFriendMessage: (friendId: string, text: string) => void;
  receiveFriendMessage: (friendId: string, text: string) => void;
  acceptFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
  addFriendRequest: (req: Omit<FriendRequest, "id" | "at" | "status">) => void;

  // Store / Dev
  purchaseItem: (id: string, price: number, name: string, category: string) => boolean;
  resetEverything: () => void;
  resetPart: (part: "notes" | "flashcards" | "tasks" | "quiz" | "activity" | "sessions" | "files" | "chat") => void;

  // Settings
  updateSettings: (s: Partial<Settings>) => void;
}

// ===== Helpers =====
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const today = () => new Date().toISOString().slice(0, 10);
// Deterministic ID for seed data (avoids SSR/CSR hydration mismatch)
let seedIdCounter = 0;
const seedId = () => `seed-${seedIdCounter++}`;

const xpForLevel = (lvl: number) => 100 + (lvl - 1) * 50;
const levelFromXP = (xp: number) => {
  let lvl = 1;
  let need = 0;
  while (xp >= need + xpForLevel(lvl)) {
    need += xpForLevel(lvl);
    lvl++;
  }
  return { level: lvl, intoLevel: xp - need, needed: xpForLevel(lvl) };
};

// ===== Seed =====
function seed() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return {
    user: {
      name: "Neha Salah",
      username: "neha_salah",
      bio: "CBSE scholar • Aspiring doctor • Loves chemistry",
      school: "Delhi Public School",
      class: "9 - CBSE",
      avatar: "🦋",
      email: "neha@scholar.app",
      scholarClass: 9 as 9 | 11,
      jeeMode: false,
    },
    xp: 1340,
    level: levelFromXP(1340).level,
    coins: 540,
    streak: 14,
    lastStudyDay: today(),
    mastery: { maths: 58, science: 72, english: 81, sst: 49, hindi: 65 },
    studyProgress: Object.fromEntries(
      CURRICULUM.flatMap((s) => s.chapters.map((c, ci) => [c.id, ((ci * 37 + s.id.length * 13) % 80)]))
    ),
    badges: [
      { id: "b1", name: "First Steps", description: "Completed onboarding", icon: "🌱", earned: true, earnedAt: now - 14 * day, color: "from-emerald-500 to-teal-500" },
      { id: "b2", name: "Streak Warrior", description: "7-day study streak", icon: "🔥", earned: true, earnedAt: now - 7 * day, color: "from-orange-500 to-red-500" },
      { id: "b3", name: "Note Taker", description: "Created 5 notes", icon: "📝", earned: true, earnedAt: now - 5 * day, color: "from-indigo-500 to-violet-500" },
      { id: "b4", name: "Quiz Master", description: "Completed 10 quizzes", icon: "🎯", earned: true, earnedAt: now - 2 * day, color: "from-fuchsia-500 to-pink-500" },
      { id: "b5", name: "Flash Pro", description: "Reviewed 50 flashcards", icon: "⚡", earned: false, color: "from-yellow-500 to-amber-500" },
      { id: "b6", name: "Marathon", description: "Study 5 hours in a day", icon: "🏃", earned: false, color: "from-cyan-500 to-blue-500" },
      { id: "b7", name: "Perfectionist", description: "Score 100% on a quiz", icon: "💎", earned: false, color: "from-purple-500 to-fuchsia-500" },
      { id: "b8", name: "Scholar", description: "Reach Level 20", icon: "🎓", earned: false, color: "from-rose-500 to-pink-500" },
      { id: "b9", name: "Daily Challenger", description: "7-day daily challenge streak", icon: "🏆", earned: false, color: "from-amber-500 to-orange-500" },
      { id: "b10", name: "Mind Mapper", description: "Explore all subjects in Mind Map", icon: "🧠", earned: false, color: "from-violet-500 to-indigo-500" },
    ] as Badge[],
    notes: [
      { id: uid(), title: "Photosynthesis — Quick Notes", content: "# Photosynthesis\nThe process by which **green plants** make food using sunlight, CO₂ and water.\n\n- **Equation:** 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂\n- Occurs in the **chloroplast**\n- Two phases: **light reaction** & **dark reaction (Calvin cycle)**\n\n> Chlorophyll absorbs mainly red and blue light, reflecting green.", folder: "Science", tags: ["biology", "chapter-7"], color: "emerald", pinned: true, createdAt: now - 3 * day, updatedAt: now - 1 * day, versions: [] },
      { id: uid(), title: "Linear Equations — Graph Method", content: "# Linear Equations in Two Variables\nAn equation of the form `ax + by + c = 0` is linear.\n\n## Graph\n1. Rearrange to y = mx + c\n2. Plot two points\n3. Draw the line\n\nExample: `2x + y = 6` passes through (0,6) and (3,0).", folder: "Maths", tags: ["algebra"], color: "indigo", pinned: false, createdAt: now - 5 * day, updatedAt: now - 4 * day, versions: [] },
      { id: uid(), title: "The French Revolution — Timeline", content: "# French Revolution\n- **1774:** Louis XVI becomes king\n- **1789:** Storming of the Bastille (14 July)\n- **1791:** Constitution drafted\n- **1792-93:** Republic, King executed\n- **1793-94:** Reign of Terror (Robespierre)\n- **1804:** Napoleon crowns himself Emperor", folder: "SST", tags: ["history"], color: "amber", pinned: false, createdAt: now - 6 * day, updatedAt: now - 6 * day, versions: [] },
    ] as Note[],
    folders: [
      { id: uid(), name: "Science", subject: "science", color: "emerald" },
      { id: uid(), name: "Maths", subject: "maths", color: "indigo" },
      { id: uid(), name: "SST", subject: "sst", color: "amber" },
      { id: uid(), name: "English", subject: "english", color: "rose" },
      { id: uid(), name: "Personal", color: "violet" },
    ] as Folder[],
    decks: [
      { id: "deck-science", name: "Science Basics", subject: "science", color: "emerald" },
      { id: "deck-maths", name: "Maths Formulas", subject: "maths", color: "indigo" },
    ] as Deck[],
    flashcards: [
      { id: uid(), deckId: "deck-science", front: "What is the SI unit of force?", back: "Newton (N)", box: 3, lastReviewed: now - 2 * day, ease: 2.5 },
      { id: uid(), deckId: "deck-science", front: "Define photosynthesis.", back: "Process by which green plants make food using sunlight, CO₂ and water.", box: 2, lastReviewed: now - 1 * day, ease: 2.3 },
      { id: uid(), deckId: "deck-science", front: "What is the powerhouse of the cell?", back: "Mitochondria", box: 4, lastReviewed: now - 3 * day, ease: 2.7 },
      { id: uid(), deckId: "deck-science", front: "Formula for acceleration?", back: "a = (v - u) / t", box: 1, lastReviewed: now, ease: 2.5 },
      { id: uid(), deckId: "deck-maths", front: "Heron's formula?", back: "Area = √(s(s-a)(s-b)(s-c)), s = (a+b+c)/2", box: 2, lastReviewed: now - 1 * day, ease: 2.4 },
      { id: uid(), deckId: "deck-maths", front: "(a+b)² expansion?", back: "a² + 2ab + b²", box: 5, lastReviewed: now - 7 * day, ease: 2.9 },
      { id: uid(), deckId: "deck-maths", front: "Sum of angles in a triangle?", back: "180°", box: 3, lastReviewed: now - 2 * day, ease: 2.6 },
      { id: uid(), deckId: "deck-maths", front: "Volume of a cylinder?", back: "πr²h", box: 2, lastReviewed: now - 1 * day, ease: 2.4 },
    ] as Flashcard[],
    tasks: [
      { id: uid(), title: "Revise Polynomials — Chapter 2", subject: "maths", type: "revision", date: today(), time: "17:00", done: false, priority: "high" },
      { id: uid(), title: "Science quiz on Motion", subject: "science", type: "study", date: today(), time: "19:00", done: false, priority: "medium" },
      { id: uid(), title: "Submit English essay draft", subject: "english", type: "assignment", date: new Date(now + 2 * day).toISOString().slice(0, 10), done: false, priority: "high" },
      { id: uid(), title: "SST map work — rivers of India", subject: "sst", type: "study", date: new Date(now + 1 * day).toISOString().slice(0, 10), done: false, priority: "medium" },
      { id: uid(), title: "Maths mock test", subject: "maths", type: "exam", date: new Date(now + 4 * day).toISOString().slice(0, 10), done: false, priority: "high" },
      { id: uid(), title: "Read Beehive Ch. 6", subject: "english", type: "study", date: new Date(now - 1 * day).toISOString().slice(0, 10), done: true, priority: "low" },
    ] as Task[],
    quizAttempts: [] as QuizAttempt[],
    sessions: Array.from({ length: 9 }, (_, i) => ({
      id: uid(),
      type: "pomodoro" as const,
      duration: 25 * 60,
      completedAt: now - i * day + (i * 3600000),
      subject: ["science", "maths", "english", "sst"][i % 4],
    })) as FocusSession[],
    activity: [
      { id: uid(), type: "quiz", text: "Scored 8/10 in Science — Motion quiz", at: now - 2 * 3600 * 1000, icon: "🎯" },
      { id: uid(), type: "note", text: "Updated note: Photosynthesis — Quick Notes", at: now - 6 * 3600 * 1000, icon: "📝" },
      { id: uid(), type: "flashcard", text: "Reviewed 12 flashcards", at: now - 26 * 3600 * 1000, icon: "⚡" },
      { id: uid(), type: "focus", text: "Completed a 25-min focus session", at: now - 28 * 3600 * 1000, icon: "🍅" },
      { id: uid(), type: "streak", text: "14-day streak! Keep going 🔥", at: now - 30 * 3600 * 1000, icon: "🔥" },
    ] as Activity[],
    chatThreads: [
      {
        id: uid(),
        persona: "dr-meera",
        title: "Photosynthesis doubt",
        updatedAt: now - 3 * 3600 * 1000,
        messages: [
          { id: uid(), role: "user", content: "Why are leaves green?", at: now - 3 * 3600 * 1000 - 60000, persona: "dr-meera" },
          { id: uid(), role: "assistant", content: "Lovely question! Leaves contain **chlorophyll**, a pigment that absorbs red and blue wavelengths of light for photosynthesis but reflects **green** — so that's the colour our eyes see. 🌿", at: now - 3 * 3600 * 1000, persona: "dr-meera" },
        ],
      },
    ] as ChatThread[],
    files: [
      { id: uid(), name: "Maths Formula Sheet.pdf", type: "pdf", size: 248000, tags: ["maths", "formulas"], uploadedAt: now - 10 * day },
      { id: uid(), name: "Periodic Table.png", type: "image", size: 96000, tags: ["science", "chemistry"], uploadedAt: now - 7 * day },
    ] as FileItem[],
    forumPosts: [
      // 1. Kabir — Science: periodic table
      { scholarClass: 9, id: uid(), author: "Kabir Singh", avatar: "🦁", subject: "Science", title: "best way to memorize periodic table first 20 elements", body: "i keep forgetting the first 20 elements. tried making a song but its so cringe i cant listen to it twice. any actual tricks that worked for u guys 😭", at: now - 2 * day, replies: [
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "i made flashcards. boring but it works. 10 mins a day for a week and ur done", at: now - 2 * day + 3600 * 1000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "theres a yt song abt it ngl i thought it was cringe too but its stuck in my head now and i literally cannot forget lithium anymore", at: now - 2 * day + 7200 * 1000, isAI: true },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "just memorize the atomic numbers tbh. the symbols follow", at: now - 2 * day + 10800 * 1000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "ok update: i watched the song. meera was wrong. lithium forever", at: now - 2 * day + 14400 * 1000 },
      ] },
      // 2. Meera — Maths: Heron's formula
      { scholarClass: 9, id: uid(), author: "Meera Iyer", avatar: "🦌", subject: "Maths", title: "Anyone else find Heron's formula easier than the regular triangle area?? 😭", body: "like if i have all 3 sides i just plug into heron's. why would i bother finding the height", at: now - 5 * day, replies: [
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "wait u said the same thing yesterday meera", at: now - 5 * day + 3600 * 1000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "ya i changed my mind. heron's actually superior", at: now - 5 * day + 5400 * 1000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "depends on the question lol. if they give u the height just use ½bh. heron's has that √ which is annoying to compute", at: now - 5 * day + 7200 * 1000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "kabir u literally copied heron's in the test and got it wrong", at: now - 5 * day + 9000 * 1000, isAI: true },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "that was ONE time bro", at: now - 5 * day + 10800 * 1000 },
      ] },
      // 3. Diya — English: Beehive
      { scholarClass: 9, id: uid(), author: "Diya Patel", avatar: "🦢", subject: "English", title: "WHY does Beehive have so many chapters", body: "we're on chapter 7 already and there's still like 4 more. plus moments. plus the poetry. i cant", at: now - 1 * day, replies: [
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "wait till u see the poem questions in the exam 💀", at: now - 1 * day + 3600 * 1000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "the chapters r actually short?? just read 1 a day", at: now - 1 * day + 5400 * 1000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "easy for u to say ur the english nerd", at: now - 1 * day + 7200 * 1000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "ngl the fun they had is lowkey good tho", at: now - 1 * day + 9000 * 1000, isAI: true },
      ] },
      // 4. Meera — SST: polity homework
      { scholarClass: 9, id: uid(), author: "Meera Iyer", avatar: "🦌", subject: "SST", title: "Did anyone finish the polity homework? I left 2 questions", body: "the constitutional amendment questions r so vague. like what does 'basic structure' even mean", at: now - 86400000, replies: [
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "the basic structure doctrine is from the kesavananda bharati case 1973. basically parliament cant amend the core of the constitution", at: now - 86400000 + 3600000, isAI: true },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "ok thanks but my teacher wants 5 lines per question 💀", at: now - 86400000 + 5400000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "i just copy pasted from the textbook lmaooo", at: now - 86400000 + 7200000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "kabir no 💀", at: now - 86400000 + 9000000 },
      ] },
      // 5. Aarav — Science: motion graphs
      { scholarClass: 9, id: uid(), author: "Aarav Sharma", avatar: "🐯", subject: "Science", title: "motion graphs are destroying me", body: "slope of velocity-time gives acceleration but then area gives displacement and i keep mixing them up. someone explain like im 5", at: now - 86400000 * 0.5, replies: [
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "slope = rate of change, area = accumulation. so slope of v-t = acceleration (how fast v changes), area under v-t = displacement (total v accumulated over time)", at: now - 86400000 * 0.5 + 3600000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "SLOPE = RATE, AREA = TOTAL. just memorize that", at: now - 86400000 * 0.5 + 5400000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "ananya ur scaring me. since when do u know calculus", at: now - 86400000 * 0.5 + 7200000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "i dont thats just how sir explained it lol", at: now - 86400000 * 0.5 + 9000000 },
      ] },
      // 6. Ananya — Science: study group
      { scholarClass: 9, id: uid(), author: "Ananya Reddy", avatar: "🦊", subject: "Science", title: "study group for tomorrow's science test???", body: "someone pls join me i cannot study alone anymore. chapters 1-5 motion, force, laws of motion, gravitation, work energy", at: now - 43200000, replies: [
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "im in. 8pm?", at: now - 43200000 + 1800000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "yes pls i need help with newton's 3rd law", at: now - 43200000 + 3600000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "i have tuition till 9. can we do 9:30", at: now - 43200000 + 5400000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "9:30 works. bringing snacks 🍿", at: now - 43200000 + 7200000, isAI: true },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "ok 9:30. aarav bring ur notes urs r actually good", at: now - 43200000 + 9000000 },
      ] },
      // 7. Meera — Science: distance vs displacement
      { scholarClass: 9, id: uid(), author: "Meera Iyer", avatar: "🦌", subject: "Science", title: "I keep mixing up distance and displacement help", body: "i know distance is total path and displacement is shortest but i still mess up in numericals. especially when the body comes back to start", at: now - 21600000, replies: [
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "if it comes back to start, displacement = 0. just memorize that one rule", at: now - 21600000 + 1800000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "another trick: displacement can be negative, distance is always positive. sign tells u direction", at: now - 21600000 + 3600000, isAI: true },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "ok that actually helps", at: now - 21600000 + 5400000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "wait til circular motion lol", at: now - 21600000 + 7200000 },
      ] },
      // 8. Aarav — SST: French Revolution dates
      { scholarClass: 9, id: uid(), author: "Aarav Sharma", avatar: "🐯", subject: "SST", title: "French Revolution dates are impossible to remember", body: "1774, 1789, 1791, 1792, 1793, 1794, 1795... like who decided this", at: now - 18000000, replies: [
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "make a timeline. seriously. draw it out on one page", at: now - 18000000 + 1800000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "1774 louis xvi ascends, 1789 bastille, 1791 constitution, 1792 france becomes republic, 1793 louis executed, 1794 robespierre, 1795 directory", at: now - 18000000 + 3600000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "ok diya ur a walking textbook", at: now - 18000000 + 5400000, isAI: true },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "diya how. just how", at: now - 18000000 + 7200000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "i made a song. dont ask", at: now - 18000000 + 9000000 },
      ] },
      // 9. Kabir — General: match tonight
      { scholarClass: 9, id: uid(), author: "Kabir Singh", avatar: "🦁", subject: "General", title: "anyone watching the match tonight instead of studying lol", body: "ind vs pak at 7. test is tmrw but who cares", at: now - 14400000, replies: [
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "BRO YES. test can wait", at: now - 14400000 + 1800000, isAI: true },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "kabir u failed the last test", at: now - 14400000 + 3600000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "this one is different meera trust", at: now - 14400000 + 5400000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "watch 1 hr then study. compromise", at: now - 14400000 + 7200000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "ananya trying to be the mom of the group as usual 😭", at: now - 14400000 + 9000000 },
      ] },
      // 10. Diya — SST: staying awake
      { scholarClass: 9, id: uid(), author: "Diya Patel", avatar: "🦢", subject: "SST", title: "how do you guys stay awake while reading SST", body: "no seriously. i open the textbook and 10 min later im asleep. history is fine but civics puts me out cold", at: now - 10800000, replies: [
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "read aloud. seriously. hard to fall asleep when ur talking", at: now - 10800000 + 1800000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "i draw the diagrams. even if they look bad it keeps u engaged", at: now - 10800000 + 3600000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "watch a video first then read. context helps a lot", at: now - 10800000 + 5400000, isAI: true },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "10 min reading + 2 min break. pomodoro but for sst", at: now - 10800000 + 7200000 },
      ] },
      // 11. Ananya — Maths: polynomials factoring
      { scholarClass: 9, id: uid(), author: "Ananya Reddy", avatar: "🦊", subject: "Maths", title: "polynomials factoring tricks??", body: "x²+5x+6 is easy. but what about x²-7x+12. and the ones with negative middle terms r killing me", at: now - 7200000, replies: [
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "find two numbers that multiply to the constant AND add to the middle coefficient. for x²-7x+12 its -3 and -4. so (x-3)(x-4)", at: now - 7200000 + 1800000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "wait kabir ur explaining maths? who are u", at: now - 7200000 + 3600000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "i have my moments 🦁", at: now - 7200000 + 5400000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "kabir w that energy in class challenge", at: now - 7200000 + 7200000, isAI: true },
      ] },
      // 12. Meera — English: Fun They Had
      { scholarClass: 9, id: uid(), author: "Meera Iyer", avatar: "🦌", subject: "English", title: "anyone got the theme of 'The Fun They Had'?", body: "i have an essay due tomorrow and i dont even know what to write", at: now - 5400000, replies: [
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "main theme: technology vs human connection in education. margie's mechanical teacher has no warmth. also nostalgia for community/school", at: now - 5400000 + 1800000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "diya ur a lifesaver", at: now - 5400000 + 3600000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "also mention how they romanticize 'real' school even tho they never went", at: now - 5400000 + 5400000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "should i write abt the diary entry format? its part of it right", at: now - 5400000 + 7200000, isAI: true },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "yes the date format (17 May 2157) tells u its futuristic. good catch aarav", at: now - 5400000 + 9000000 },
      ] },
      // 13. Aarav — Maths: linear equations
      { scholarClass: 9, id: uid(), author: "Aarav Sharma", avatar: "🐯", subject: "Maths", title: "linear equations in two variables — substitution or elimination?", body: "teacher said both work but which is faster for the exam", at: now - 3600000, replies: [
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "elimination. always elimination. just multiply to cancel one variable", at: now - 3600000 + 1800000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "substitution if one equation already has x= or y= isolated. otherwise elimination", at: now - 3600000 + 3600000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "graphical method if ur desperate lol", at: now - 3600000 + 5400000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "ok elimination it is", at: now - 3600000 + 7200000, isAI: true },
      ] },
      // 14. Diya — Hindi: sandhi
      { scholarClass: 9, id: uid(), author: "Diya Patel", avatar: "🦢", subject: "Hindi", title: "हिंदी व्याकरण — संधि और संधि विच्छेद कैसे याद रखें", body: "har baar exam mein galat ho jata hai. koi trick hai kya? swar/vyanjan/visarga sab mix ho jate hain", at: now - 2700000, replies: [
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "vowel+vowel = swar sandhi, consonant+vowel = vyanjan sandhi, consonant+consonant = vyanjan too. practice 10 examples of each type", at: now - 2700000 + 1800000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "make a chart. swar, vyanjan, visarga. stick it on ur wall. trust", at: now - 2700000 + 3600000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "or just guess and pray lmaooo", at: now - 2700000 + 5400000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "kabir pls 😭", at: now - 2700000 + 7200000, isAI: true },
      ] },
      // 15. Kabir — Science: sound chapter
      { scholarClass: 9, id: uid(), author: "Kabir Singh", avatar: "🦁", subject: "Science", title: "is it just me or is sound chapter confusing", body: "wavelength, frequency, amplitude, time period, pitch, loudness. there's like 7 things to remember", at: now - 1800000, replies: [
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "wavelength λ, frequency f, speed v. v = fλ. amplitude = loudness, frequency = pitch. that's basically it", at: now - 1800000 + 900000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "echo needs 17m minimum distance from reflecting surface. that one always comes", at: now - 1800000 + 1800000, isAI: true },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "and the sonic boom question. that comes too", at: now - 1800000 + 2700000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "ok nvm i was overcomplicating", at: now - 1800000 + 3600000 },
      ] },
      // ===== Class 11 forum posts =====
      { id: "fp-c11-1", scholarClass: 11, author: "Arjun Nair", avatar: "⚛️", subject: "Physics", title: "Why is displacement zero after returning to the starting point?", body: "In circular motion if I come back to the start, my textbook says displacement is zero but distance is the circumference. Conceptually I get it but in numericals I keep second-guessing myself. Anyone have a clean rule?", at: now - 1 * 3600000, replies: [
        { id: uid(), author: "Ethan Carter", avatar: "🚀", body: "displacement = Δposition vector. start == end → Δ = 0. always. distance = path length, always positive. don't overthink it", at: now - 1 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Rohan Mehta", avatar: "📐", body: "think of it as a number line. if u go +5 then -5 u r back at 0. displacement = 0 but distance = 10", at: now - 1 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-2", scholarClass: 11, author: "Meera Iyer", avatar: "🧪", subject: "Physics", title: "How do you choose the correct equation of motion?", body: "v=u+at, s=ut+½at², v²=u²+2as... 3 equations and I never know which one to use. is there a cheat code?", at: now - 2 * 3600000, replies: [
        { id: uid(), author: "Arjun Nair", avatar: "⚛️", body: "list what's given and what's asked. missing time → use v²=u²+2as. missing final velocity → use s=ut+½at². missing displacement → use v=u+at", at: now - 2 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Ananya Menon", avatar: "🎯", body: "^this. write down the 4 variables (u, v, a, t, s) and cross out what u have. the equation with the remaining ones is ur answer", at: now - 2 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-3", scholarClass: 11, author: "Rohan Mehta", avatar: "📐", subject: "Chemistry", title: "How do I identify the limiting reagent?", body: "every stoichiometry problem I get the wrong answer because I pick the wrong limiting reagent. what's the foolproof method?", at: now - 3 * 3600000, replies: [
        { id: uid(), author: "Meera Iyer", avatar: "🧪", body: "divide moles of each reactant by its stoichiometric coefficient. smallest one is the limiting reagent. that's it", at: now - 3 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Zayan Rahman", avatar: "🔬", body: "or u can calculate product from each reactant separately. whichever gives less product is limiting. same answer, more work", at: now - 3 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-4", scholarClass: 11, author: "Ananya Menon", avatar: "🎯", subject: "Chemistry", title: "Difference between sigma and pi bonds?", body: "I keep mixing them up in structure questions. is there a simple way to identify which is which?", at: now - 4 * 3600000, replies: [
        { id: uid(), author: "Meera Iyer", avatar: "🧪", body: "sigma = end-to-end overlap, strong, single bond. pi = side-by-side overlap, weaker, only in double/triple bonds. single bond = 1σ, double = 1σ+1π, triple = 1σ+2π", at: now - 4 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Zayan Rahman", avatar: "🔬", body: "count the bonds: single→1σ, double→1σ+1π, triple→1σ+2π. every bond has exactly 1 sigma, extras are pi", at: now - 4 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-5", scholarClass: 11, author: "Aarav Sharma", avatar: "💻", subject: "Mathematics", title: "How do I prove this set identity?", body: "(A∪B)' = A'∩B' (De Morgan). I know it's true but how do I actually prove it step by step in the exam?", at: now - 5 * 3600000, replies: [
        { id: uid(), author: "Sophia Chen", avatar: "🧮", body: "two-way proof. (→) take x∈(A∪B)' → x∉A∪B → x∉A AND x∉B → x∈A' AND x∈B' → x∈A'∩B'. (←) reverse it. done", at: now - 5 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Rohan Mehta", avatar: "📐", body: "or use Venn diagrams to sanity check, then write the formal proof. don't skip the formal part tho", at: now - 5 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-6", scholarClass: 11, author: "Diya Kapoor", avatar: "📚", subject: "Mathematics", title: "Confused between domain, codomain, and range.", body: "domain is inputs, range is outputs, but what's codomain? why is it different from range?", at: now - 6 * 3600000, replies: [
        { id: uid(), author: "Sophia Chen", avatar: "🧮", body: "domain = allowed inputs. codomain = declared set of possible outputs (the 'target'). range = ACTUAL outputs. range ⊆ codomain. e.g. f:R→R, f(x)=x². codomain=R but range=[0,∞)", at: now - 6 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Rohan Mehta", avatar: "📐", body: "think of codomain as the promise and range as what actually happens. range is always inside codomain", at: now - 6 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-7", scholarClass: 11, author: "Zayan Rahman", avatar: "🔬", subject: "Computer Science", title: "Why does input() return a string?", body: "even if I type a number, input() gives me a string. why doesn't it auto-detect the type?", at: now - 7 * 3600000, replies: [
        { id: uid(), author: "Aarav Sharma", avatar: "💻", body: "because Python can't read ur mind. user could type '5' meaning number or 'hello' meaning text. safer to always return string and let u convert with int()/float()/etc", at: now - 7 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Kavya Iyer", avatar: "🗂️", body: "explicit > implicit. u wrap with int(input()) when u want a number. keeps bugs out", at: now - 7 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-8", scholarClass: 11, author: "Kavya Iyer", avatar: "🗂️", subject: "Computer Science", title: "Difference between /, //, and %?", body: "three division operators in Python and I keep using the wrong one. quick reference?", at: now - 8 * 3600000, replies: [
        { id: uid(), author: "Aarav Sharma", avatar: "💻", body: "/ = true division (always float, e.g. 7/2=3.5). // = floor division (e.g. 7//2=3, -7//2=-4). % = remainder (e.g. 7%2=1). use // for ints, % for even/odd checks", at: now - 8 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Zayan Rahman", avatar: "🔬", body: "careful with negatives. -7//2 = -4 not -3. floor rounds toward -∞. common gotcha", at: now - 8 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-9", scholarClass: 11, author: "Ethan Carter", avatar: "🚀", subject: "Physics", title: "Best way to practice mechanics for JEE?", body: "kinematics + NLM + work-energy + rotation. which order and which books/sources actually helped?", at: now - 9 * 3600000, replies: [
        { id: uid(), author: "Arjun Nair", avatar: "⚛️", body: "order: kinematics → NLM → WPE → circular → rotation. each builds on the previous. HC Verma for concepts, DC Pandey for JEE practice. don't skip rotation it's heavy", at: now - 9 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Ananya Menon", avatar: "🎯", body: "do PYQs after every chapter. mechanics is 30%+ of JEE mains physics so don't rush it", at: now - 9 * 3600000 + 3600000 },
      ] },
      { id: "fp-c11-10", scholarClass: 11, author: "Sophia Chen", avatar: "🧮", subject: "Mathematics", title: "How to approach inequality problems in competitions?", body: "Olympiad inequalities like AM-GM, Cauchy-Schwarz — I can memorize them but struggle to spot when to apply which. any framework?", at: now - 10 * 3600000, replies: [
        { id: uid(), author: "Rohan Mehta", avatar: "📐", body: "AM-GM when u see sums of positive terms and want a lower bound. Cauchy-Schwarz when u see products of sums. practice spotting the structure, not just the formula", at: now - 10 * 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Diya Kapoor", avatar: "📚", body: "also try substitution to simplify first. sometimes a clever sub turns a hard inequality into AM-GM", at: now - 10 * 3600000 + 3600000 },
      ] },
    ] as ForumPost[],
    qaItems: [
      { id: uid(), author: "Diya Patel", avatar: "🦢", subject: "Science", question: "What is the difference between speed and velocity?", at: now - 1 * day, answers: [
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "speed is how fast (scalar, just magnitude). velocity is speed in a given direction (vector). so 50 km/h is speed; 50 km/h north is velocity.", at: now - 1 * day + 3600 * 1000, isAI: true },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "easy way to remember: velocity has direction. V has an arrow in physics ⃗v", at: now - 1 * day + 7200 * 1000 },
      ] },
      { id: uid(), author: "Kabir Singh", avatar: "🦁", subject: "Maths", question: "Why is anything to the power 0 equal to 1?", at: now - 43200000, answers: [
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "because a^m / a^m = a^(m-m) = a^0, and a^m / a^m = 1. so a^0 must be 1 for the laws of exponents to stay consistent", at: now - 43200000 + 3600000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "^this. its not that 0 of something = 1, its that the exponent rules force it", at: now - 43200000 + 5400000 },
      ] },
      { id: uid(), author: "Ananya Reddy", avatar: "🦊", subject: "SST", question: "What's the difference between a biome and an ecosystem?", at: now - 21600000, answers: [
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "an ecosystem is a community of living things + their physical environment (can be small, like a pond). a biome is a large region with similar climate + vegetation (like a desert or tropical rainforest). many ecosystems make up a biome", at: now - 21600000 + 5400000 },
      ] },
      { id: uid(), author: "Kabir Singh", avatar: "🦁", subject: "Maths", question: "how do i know when to use the quadratic formula vs factoring", at: now - 18000000, answers: [
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "try factoring first. if it doesn't factor nicely in like 30 seconds, use the formula. formula always works", at: now - 18000000 + 1800000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "or just memorize the formula. faster than thinking abt which method lol", at: now - 18000000 + 3600000 },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "ya im just gonna use the formula every time at this point", at: now - 18000000 + 5400000 },
      ] },
      { id: uid(), author: "Meera Iyer", avatar: "🦌", subject: "Science", question: "is weight the same as mass?? my teacher keeps using them interchangeably", at: now - 14400000, answers: [
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "no. mass is how much matter (kg, constant everywhere). weight is the force gravity exerts on that mass (Newtons, changes with g). W = mg. on the moon ur mass is the same but ur weight is 1/6", at: now - 14400000 + 1800000, isAI: true },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "^this. moon g is 1.6 m/s², earth g is 9.8. so ur weight on moon = mass × 1.6", at: now - 14400000 + 3600000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "ok that makes sense. was overcomplicating", at: now - 14400000 + 5400000 },
      ] },
      { id: uid(), author: "Diya Patel", avatar: "🦢", subject: "English", question: "whats the difference between metaphor and simile i keep mixing them up", at: now - 10800000, answers: [
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "simile uses 'like' or 'as'. metaphor doesn't. 'she runs like a cheetah' = simile. 'she is a cheetah' = metaphor. easy", at: now - 10800000 + 1800000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "kabir with the english W. unexpected", at: now - 10800000 + 3600000 },
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "ok that's actually the cleanest explanation ive heard", at: now - 10800000 + 5400000 },
      ] },
      { id: uid(), author: "Aarav Sharma", avatar: "🐯", subject: "SST", question: "why did the french revolution start in 1789 specifically?", at: now - 7200000, answers: [
        { id: uid(), author: "Diya Patel", avatar: "🦢", body: "long story but: years of bad harvests (1787-88), bread prices doubled, treasury empty from wars + palace spending, third estate refused the tax-only-on-poor system, estates general met in may 1789, third estate broke away → national assembly, then bastille on july 14", at: now - 7200000 + 1800000 },
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "diya who hurt u (positive)", at: now - 7200000 + 3600000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "ok tysm. my textbook just says 'economic crisis' and moves on", at: now - 7200000 + 5400000, isAI: true },
      ] },
      { id: uid(), author: "Kabir Singh", avatar: "🦁", subject: "Maths", question: "if a train leaves delhi at 60 km/h and another leaves mumbai at 80 km/h when do they meet", at: now - 3600000, answers: [
        { id: uid(), author: "Meera Iyer", avatar: "🦌", body: "kabir u literally cant post this and expect a serious answer", at: now - 3600000 + 900000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "assuming distance delhi-mumbai is ~1400 km, they approach at 140 km/h together (60+80). so 1400/140 = 10 hours. if they leave at the same time", at: now - 3600000 + 1800000, isAI: true },
        { id: uid(), author: "Kabir Singh", avatar: "🦁", body: "aarav ur the only one who took this seriously. respect", at: now - 3600000 + 2700000 },
        { id: uid(), author: "Ananya Reddy", avatar: "🦊", body: "aarav u forgot they have to leave at the same time AND in opposite directions", at: now - 3600000 + 3600000 },
        { id: uid(), author: "Aarav Sharma", avatar: "🐯", body: "ok fine assuming that too lol", at: now - 3600000 + 4500000 },
      ] },
    ] as QAItem[],
    studyGroups: [
      { id: "g1", name: "Science Squad", subject: "Science", members: 24, messages: [
        { id: uid(), author: "Kabir", avatar: "🦁", body: "Anyone up for a motion quiz tonight?", at: now - 7200 * 1000 },
        { id: uid(), author: "Ananya", avatar: "🦊", body: "Yes! 8pm?", at: now - 7100 * 1000 },
        { id: uid(), author: "Diya", avatar: "🦢", body: "Count me in 🙋‍♀️ I need to revise equations of motion", at: now - 7000 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "v = u + at, s = ut + ½at², v² = u² + 2as — there, saved you a search 😎", at: now - 6900 * 1000, isAI: true },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "Legend. See you at 8!", at: now - 6800 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "wait is the test on motion only or also gravitation", at: now - 6700 * 1000 },
        { id: uid(), author: "Ananya", avatar: "🦊", body: "both. sir said chapters 1-5", at: now - 6600 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "ofc he did. ok 8pm it is 🙃", at: now - 6500 * 1000 },
        { id: uid(), author: "Diya", avatar: "🦢", body: "wait do we have to draw the velocity-time graph too", at: now - 6400 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "ya always draw a graph if asked abt motion. easier marks", at: now - 6300 * 1000, isAI: true },
      ] },
      { id: "g2", name: "Mathletes", subject: "Mathematics", members: 31, messages: [
        { id: uid(), author: "Meera", avatar: "🦌", body: "Polynomials revision sheet shared 📎", at: now - 10800 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "Thanks! Q4 seems to have a typo — should it be x²-5x+6?", at: now - 10600 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "Yes good catch, fixed 🙏", at: now - 10400 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "btw did anyone solve the heron's word problem. the one with the field", at: now - 10200 * 1000, isAI: true },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "ya split it into two triangles. use heron's on each then add", at: now - 10000 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "wait thats what i did and got 360 m². anyone else", at: now - 9800 * 1000 },
        { id: uid(), author: "Ananya", avatar: "🦊", body: "i got 420 m². let me recheck", at: now - 9600 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "oh i got 420 too. meera check ur arithmetic", at: now - 9400 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "...i added wrong. its 420. fml", at: now - 9200 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "happens to the best of us lol", at: now - 9000 * 1000, isAI: true },
      ] },
      { id: "g3", name: "History Buffs", subject: "Social Science", members: 18, messages: [
        { id: uid(), author: "Diya", avatar: "🦢", body: "Did anyone watch that documentary on the French Revolution? So good.", at: now - 9000 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "Which one? There are like 5 😂", at: now - 8800 * 1000, isAI: true },
        { id: uid(), author: "Diya", avatar: "🦢", body: "the BBC one. 4 episodes", at: now - 8600 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "oh that one's good. robespierre gets his own episode", at: now - 8400 * 1000, isAI: true },
        { id: uid(), author: "Meera", avatar: "🦌", body: "wait is robespierre the reign of terror guy", at: now - 8200 * 1000 },
        { id: uid(), author: "Diya", avatar: "🦢", body: "ya literally the reason for the terror. then he got guillotined himself. karma", at: now - 8000 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "wait he killed people then got killed the same way? iconic", at: now - 7800 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "thats literally the french revolution in one sentence kabir 😭", at: now - 7600 * 1000, isAI: true },
      ] },
      { id: "g4", name: "Class 9 General", subject: "All", members: 47, messages: [
        { id: uid(), author: "Kabir", avatar: "🦁", body: "yo did anyone do the english hw", at: now - 5400 * 1000 },
        { id: uid(), author: "Ananya", avatar: "🦊", body: "which one we had 2", at: now - 5200 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "the diary entry one", at: now - 5000 * 1000 },
        { id: uid(), author: "Ananya", avatar: "🦊", body: "yes i did. its due friday right", at: now - 4800 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "...its due tomorrow", at: now - 4600 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "LMAOO kabir not again 💀", at: now - 4400 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "shut up meera u forgot ur geo notebook last week", at: now - 4200 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "thats different", at: now - 4000 * 1000 },
        { id: uid(), author: "Diya", avatar: "🦢", body: "sending u my diary entry kabir. just change the name + date", at: now - 3800 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "DIYA UR A SAINT 🙏🙏", at: now - 3600 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "for the record i told u guys abt this on monday", at: now - 3400 * 1000, isAI: true },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "nobody checks the group on monday aarav", at: now - 3200 * 1000 },
      ] },
      { id: "g5", name: "Last Minute Cram", subject: "Mixed", members: 23, messages: [
        { id: uid(), author: "Meera", avatar: "🦌", body: "test in 6 hours. who else is dying", at: now - 7200 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "me. been studying since 4pm and learned nothing", at: now - 7000 * 1000 },
        { id: uid(), author: "Ananya", avatar: "🦊", body: "focus. what r the most important topics", at: now - 6800 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "for science: motion equations, newton's laws, gravitation. those r guaranteed", at: now - 6600 * 1000, isAI: true },
        { id: uid(), author: "Diya", avatar: "🦢", body: "for maths: herons, polynomials, linear equations", at: now - 6400 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "what about english 😭", at: now - 6200 * 1000 },
        { id: uid(), author: "Diya", avatar: "🦢", body: "u cant cram english in 6 hours kabir. just read the chapter summaries", at: now - 6000 * 1000 },
        { id: uid(), author: "Kabir", avatar: "🦁", body: "fair", at: now - 5800 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "ok brb 5 min gonna get coffee", at: now - 5600 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "ok im back. dont ask", at: now - 2000 * 1000 },
        { id: uid(), author: "Ananya", avatar: "🦊", body: "meera u said 5 min. its been AN HOUR", at: now - 1800 * 1000 },
        { id: uid(), author: "Meera", avatar: "🦌", body: "the coffee became a nap 🙃", at: now - 1600 * 1000 },
        { id: uid(), author: "Aarav", avatar: "🐯", body: "ngl same. we r all going to fail together", at: now - 1400 * 1000, isAI: true },
      ] },
    ] as StudyGroup[],
    bookmarks: ["s8", "m2", "ss1"],
    purchases: [] as Purchase[],
    dailyChallenge: { date: today(), completed: false, streak: 3 },
    settings: {
      theme: "dark" as const,
      startupLoadingMode: "long" as const,
      reduceMotion: false,
      elamEnabled: true,
      elamCompact: false,
      sound: true,
      transitionMusic: true,
      transitionVolume: 65,
      loginIntroMusic: true,
      academicSwitchMusic: true,
      autoArchive: false,
      fontScale: "100" as const,
      density: "comfortable" as const,
      highContrast: false,
      readableFont: false,
      backgroundPattern: true,
      sidebarBehavior: "remember" as const,
      pageTransitions: true,
      leaderboard: true,
      communityMessages: true,
      profileVisibility: "friends" as const,
      allowFriendRequests: true,
      shareStudyActivity: true,
      showOnlineStatus: true,
      lamPageContext: true,
      lamSelectedText: true,
      includeProfileInAI: true,
    },
    devMode: false,
    class9Data: null,
    class11Data: null,
    friends: [
      // 5 students — Class 9
      { id: "f-lila", name: "Lila Rose", avatar: "🌷", bio: "Loves literature and sunflowers.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 3600000, scholarClass: 9 },
      { id: "f-mia", name: "Mia Belle", avatar: "🦋", bio: "Maths olympiad champ. Tea enthusiast.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 7200000, scholarClass: 9 },
      { id: "f-ava", name: "Ava Luna", avatar: "🌙", bio: "Astronomy nerd. Stargazes every night.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 1800000, scholarClass: 9 },
      { id: "f-zara", name: "Zara Joy", avatar: "⭐", bio: "Future biologist. Has 3 pets.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 5400000, scholarClass: 9 },
      { id: "f-nora", name: "Nora Elise", avatar: "🦌", bio: "History buff. Collects vintage maps.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 900000, scholarClass: 9 },
      // 10 Class 11 student personas
      { id: "f-arjun-11", name: "Arjun Nair", avatar: "⚛️", bio: "Physics enthusiast. Loves solving numericals.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 3600000, scholarClass: 11 },
      { id: "f-meera-11", name: "Meera Iyer", avatar: "🧪", bio: "Chemistry nerd. Reaction mechanisms are my jam.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 7200000, scholarClass: 11 },
      { id: "f-rohan-11", name: "Rohan Mehta", avatar: "📐", bio: "Calculus and trigonometry. Practice over talent.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 1800000, scholarClass: 11 },
      { id: "f-ananya-11", name: "Ananya Menon", avatar: "🎯", bio: "JEE 2026 aspirant. PCM all day, every day.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 5400000, scholarClass: 11 },
      { id: "f-aarav-11", name: "Aarav Sharma", avatar: "💻", bio: "Learning Python. Builds tiny projects on weekends.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 900000, scholarClass: 11 },
      { id: "f-diya-11", name: "Diya Kapoor", avatar: "📚", bio: "Boards-focused. Believes in steady revision.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 3600000, scholarClass: 11 },
      { id: "f-zayan-11", name: "Zayan Rahman", avatar: "🔬", bio: "Loves lab work. Salt analysis over theory any day.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 7200000, scholarClass: 11 },
      { id: "f-kavya-11", name: "Kavya Iyer", avatar: "🗂️", bio: "Organizes weekend study circles. The notes-keeper.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 1800000, scholarClass: 11 },
      { id: "f-ethan-11", name: "Ethan Carter", avatar: "🚀", bio: "Loves mechanics. Wants to study astrophysics.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 5400000, scholarClass: 11 },
      { id: "f-sophia-11", name: "Sophia Chen", avatar: "🧮", bio: "Competition math. Algebra and combinatorics.", type: "student", status: "stranger", messagesSent: 0, chat: [], lastActive: now - 900000, scholarClass: 11 },
    ] as Friend[],
    friendRequests: [] as FriendRequest[],
  };
}

// ===== Manual persistence (safer than persist middleware — guarantees arrays exist) =====
const STORAGE_KEY = "neha-scholar-v5";
const SCHEMA_VERSION = 5;

function hasClass9Leakage(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const profile = value as {
    mastery?: Record<string, unknown>;
    tasks?: Array<{ subject?: unknown }>;
    notes?: Array<{ title?: unknown; content?: unknown }>;
  };
  const class9Subjects = new Set(["science", "sst", "hindi"]);
  if (Object.keys(profile.mastery ?? {}).some((key) => class9Subjects.has(key.toLowerCase()))) return true;
  if ((profile.tasks ?? []).some((task) => typeof task.subject === "string" && class9Subjects.has(task.subject.toLowerCase()))) return true;
  return (profile.notes ?? []).some((note) => {
    const text = `${String(note.title ?? "")} ${String(note.content ?? "")}`.toLowerCase();
    return text.includes("photosynthesis") || text.includes("french revolution") || text.includes("beehive");
  });
}

function loadPersistedState(): Partial<AppState> | null {
  if (typeof window === "undefined") return null;
  try {
    // Clean up ALL old versions
    ["neha-scholar-v1", "neha-scholar-v2", "neha-scholar-v3", "neha-scholar-v4"].forEach((key) => {
      if (localStorage.getItem(key)) localStorage.removeItem(key);
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    // Schema version check — if mismatch, wipe and start fresh
    if (parsed.schema !== SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const state = parsed.state ?? parsed;
    const safe: Record<string, unknown> = {};
    const arrayFields = [
      "friends", "friendRequests", "forumPosts", "qaItems", "studyGroups",
      "files", "tasks", "notes", "flashcards", "decks", "folders", "sessions",
      "activity", "chatThreads", "quizAttempts", "bookmarks", "badges",
      "purchases",
    ];
    for (const f of arrayFields) {
      // Triple-check: must be an array, no exceptions
      const val = state[f];
      safe[f] = Array.isArray(val) ? val : [];
    }
    safe.friends = (safe.friends as Friend[]).filter((friend) => friend.type !== "kpop");
    const objFields = ["mastery", "studyProgress", "user", "dailyChallenge"];
    for (const f of objFields) {
      safe[f] = (state[f] !== undefined && state[f] !== null) ? state[f] : undefined;
    }
    // Merge settings so older saved profiles receive newly introduced preferences.
    safe.settings = { ...seed().settings, ...(state.settings ?? {}) };
    safe.authed = !!state.authed;
    safe.onboarded = !!state.onboarded;
    safe.xp = typeof state.xp === "number" ? state.xp : 0;
    safe.coins = typeof state.coins === "number" ? state.coins : 0;
    safe.streak = typeof state.streak === "number" ? state.streak : 0;
    safe.level = typeof state.level === "number" ? state.level : 1;
    safe.lastStudyDay = state.lastStudyDay ?? null;
    safe.devMode = !!state.devMode;
    safe.class9Data = state.class9Data ?? null;
    safe.class11Data = hasClass9Leakage(state.class11Data) ? null : (state.class11Data ?? null);
    // Ensure user has scholarClass and jeeMode
    if (safe.user && typeof (safe.user as Record<string, unknown>).scholarClass !== "number") {
      (safe.user as Record<string, unknown>).scholarClass = 9;
    }
    if (safe.user && typeof (safe.user as Record<string, unknown>).jeeMode !== "boolean") {
      (safe.user as Record<string, unknown>).jeeMode = false;
    }
    if ((safe.user as User | undefined)?.scholarClass === 11 && hasClass9Leakage(state)) {
      Object.assign(safe, {
        xp: 0,
        coins: 0,
        streak: 0,
        level: 1,
        lastStudyDay: null,
        mastery: {},
        studyProgress: {},
        notes: [],
        folders: [],
        decks: [],
        flashcards: [],
        tasks: [],
        quizAttempts: [],
        sessions: [],
        activity: [],
        chatThreads: [],
        files: [],
        bookmarks: [],
        badges: [],
        purchases: [],
        dailyChallenge: { date: today(), completed: false, streak: 0 },
      });
    }
    return safe as Partial<AppState>;
  } catch {
    return null;
  }
}

function savePersistedState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, schema: SCHEMA_VERSION }));
  } catch {
    /* ignore quota errors */
  }
}

const persistedState = loadPersistedState();

export const useStore = create<AppState>()(
  (set, get) => ({
    authed: false,
    onboarded: false,
    ...seed(),
    ...(persistedState as Partial<AppState>),

      setAuthed: (v) => set({ authed: v }),
      setOnboarded: (v) => set({ onboarded: v }),
      updateUser: (u) => set((s) => ({ user: { ...s.user, ...u } })),

      addXP: (n) =>
        set((s) => {
          const xp = s.xp + n;
          const lvl = levelFromXP(xp).level;
          return { xp, level: lvl };
        }),
      addCoins: (n) => set((s) => ({ coins: Math.max(0, s.coins + n) })),
      setStreak: (n) => set({ streak: Math.max(0, n) }),
      bumpStreak: () => {
        const t = today();
        const s = get();
        if (s.lastStudyDay === t) return;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const streak = s.lastStudyDay === yesterday ? s.streak + 1 : 1;
        set({ streak, lastStudyDay: t });
      },
      setMastery: (subject, v) =>
        set((s) => ({ mastery: { ...s.mastery, [subject]: Math.max(0, Math.min(100, v)) } })),
      setStudyProgress: (chapter, v) =>
        set((s) => ({ studyProgress: { ...s.studyProgress, [chapter]: Math.max(0, Math.min(100, v)) } })),
      unlockBadge: (id) =>
        set((s) => ({
          badges: s.badges.map((b) =>
            b.id === id && !b.earned ? { ...b, earned: true, earnedAt: Date.now() } : b
          ),
        })),
      completeDailyChallenge: () =>
        set((s) => {
          const t = today();
          const completed = s.dailyChallenge.date === t ? s.dailyChallenge.completed : false;
          if (completed) return {};
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const streak = s.dailyChallenge.date === yesterday ? s.dailyChallenge.streak + 1 : 1;
          return {
            dailyChallenge: { date: t, completed: true, streak },
            xp: s.xp + 30,
            coins: s.coins + 15,
          };
        }),
      setDevMode: (v) => set({ devMode: v }),

      setScholarClass: (cls) => get().switchClass(cls),

      toggleJeeMode: () => set((s) => {
        if (s.user.scholarClass !== 11) return {}; // JEE only for Class 11
        return { user: { ...s.user, jeeMode: !s.user.jeeMode } };
      }),

      switchClass: (cls) => set((s) => {
        const currentClass = s.user.scholarClass;
        if (currentClass === cls) return {}; // already on this class

        // Save current data to the appropriate profile
        const currentProfile: ClassProfileData = {
          xp: s.xp, level: s.level, coins: s.coins, streak: s.streak,
          lastStudyDay: s.lastStudyDay, mastery: s.mastery, studyProgress: s.studyProgress,
          notes: s.notes, folders: s.folders, decks: s.decks, flashcards: s.flashcards,
          tasks: s.tasks, quizAttempts: s.quizAttempts, sessions: s.sessions,
          activity: s.activity, chatThreads: s.chatThreads, files: s.files,
          bookmarks: s.bookmarks, badges: s.badges, purchases: s.purchases,
          dailyChallenge: s.dailyChallenge,
        };

        const targetProfile = cls === 9 ? s.class9Data : s.class11Data;
        const savedCurrent = currentClass === 9
          ? { class9Data: currentProfile }
          : { class11Data: currentProfile };

        if (targetProfile) {
          // Load existing profile data
          return {
            ...savedCurrent,
            user: {
              ...s.user,
              name: cls === 11 ? "Ishan" : "Neha Salah",
              username: cls === 11 ? "ishan" : "neha_salah",
              scholarClass: cls,
              jeeMode: cls === 9 ? false : s.user.jeeMode,
            },
            xp: targetProfile.xp, level: targetProfile.level, coins: targetProfile.coins,
            streak: targetProfile.streak, lastStudyDay: targetProfile.lastStudyDay,
            mastery: targetProfile.mastery, studyProgress: targetProfile.studyProgress,
            notes: targetProfile.notes, folders: targetProfile.folders,
            decks: targetProfile.decks, flashcards: targetProfile.flashcards,
            tasks: targetProfile.tasks, quizAttempts: targetProfile.quizAttempts,
            sessions: targetProfile.sessions, activity: targetProfile.activity,
            chatThreads: targetProfile.chatThreads, files: targetProfile.files,
            bookmarks: targetProfile.bookmarks, badges: targetProfile.badges,
            purchases: targetProfile.purchases, dailyChallenge: targetProfile.dailyChallenge,
          };
        } else {
          // Fresh profile — reset to defaults but keep user
          const freshMastery: Record<string, number> = {};
          const freshProgress: Record<string, number> = {};
          return {
            ...savedCurrent,
            user: {
              ...s.user,
              name: cls === 11 ? "Ishan" : "Neha Salah",
              username: cls === 11 ? "ishan" : "neha_salah",
              scholarClass: cls,
              jeeMode: cls === 9 ? false : s.user.jeeMode,
            },
            xp: 0, level: 1, coins: 0, streak: 0, lastStudyDay: null,
            mastery: freshMastery, studyProgress: freshProgress,
            notes: [], folders: [], decks: [], flashcards: [],
            tasks: [], quizAttempts: [], sessions: [], activity: [],
            chatThreads: [], files: [], bookmarks: [], badges: [],
            purchases: [], dailyChallenge: { date: today(), completed: false, streak: 0 },
          };
        }
      }),

      addNote: (n) => {
        const id = n.id ?? uid();
        const note: Note = {
          id,
          title: n.title ?? "Untitled",
          content: n.content ?? "",
          folder: n.folder ?? "Personal",
          tags: n.tags ?? [],
          color: n.color ?? "indigo",
          pinned: n.pinned ?? false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versions: [],
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return id;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? { ...n, ...patch, updatedAt: Date.now(), versions: patch.content ? [...n.versions, { content: n.content, at: Date.now() }].slice(-10) : n.versions }
              : n
          ),
        })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      addFolder: (f) =>
        set((s) => ({
          folders: [...s.folders, { id: uid(), name: f.name ?? "New Folder", color: f.color ?? "violet", subject: f.subject }],
        })),

      addDeck: (d) => {
        const id = d.id ?? uid();
        set((s) => ({
          decks: [...s.decks, { id, name: d.name ?? "New Deck", subject: d.subject, color: d.color ?? "indigo" }],
        }));
        return id;
      },
      addFlashcard: (f) =>
        set((s) => ({
          flashcards: [
            ...s.flashcards,
            {
              id: uid(),
              deckId: f.deckId ?? "deck-science",
              front: f.front ?? "",
              back: f.back ?? "",
              box: 1,
              lastReviewed: Date.now(),
              ease: 2.5,
            },
          ],
        })),
      reviewFlashcard: (id, quality) =>
        set((s) => ({
          flashcards: s.flashcards.map((c) => {
            if (c.id !== id) return c;
            let box = c.box;
            if (quality === "again") box = 1;
            else if (quality === "hard") box = Math.max(1, box);
            else if (quality === "good") box = Math.min(5, box + 1);
            else if (quality === "easy") box = Math.min(5, box + 2);
            return { ...c, box, lastReviewed: Date.now() };
          }),
        })),

      addQuizAttempt: (a) => set((s) => ({ quizAttempts: [a, ...s.quizAttempts].slice(0, 50) })),

      addTask: (t) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: uid(),
              title: t.title ?? "New task",
              subject: t.subject,
              type: t.type ?? "study",
              date: t.date ?? today(),
              time: t.time,
              done: false,
              priority: t.priority ?? "medium",
              note: t.note,
            },
          ],
        })),
      toggleTask: (id) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addSession: (sess) => set((s) => ({ sessions: [sess, ...s.sessions].slice(0, 200) })),

      pushActivity: (a) =>
        set((s) => ({ activity: [{ ...a, id: uid(), at: Date.now() }, ...s.activity].slice(0, 100) })),

      addChatThread: (t) => {
        const id = t.id ?? uid();
        set((s) => ({
          chatThreads: [
            { id, persona: t.persona ?? "dr-meera", title: t.title ?? "New chat", messages: t.messages ?? [], updatedAt: Date.now() },
            ...s.chatThreads,
          ],
        }));
        return id;
      },
      addChatMessage: (threadId, m) =>
        set((s) => ({
          chatThreads: s.chatThreads.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, { ...m, id: uid(), at: Date.now() }], updatedAt: Date.now() }
              : t
          ),
        })),
      clearChatThread: (id) =>
        set((s) => ({ chatThreads: s.chatThreads.map((t) => (t.id === id ? { ...t, messages: [] } : t)) })),

      addFile: (f) =>
        set((s) => ({
          files: [
            { id: uid(), name: f.name ?? "file", type: f.type ?? "file", mimeType: f.mimeType, url: f.url, size: f.size ?? 0, dataUrl: f.dataUrl, tags: f.tags ?? [], uploadedAt: Date.now() },
            ...s.files,
          ],
        })),
      deleteFile: (id) => set((s) => ({ files: s.files.filter((f) => f.id !== id) })),

      addForumPost: (p) =>
        set((s) => ({
          forumPosts: [{ ...p, scholarClass: s.user.scholarClass, id: uid(), at: Date.now(), replies: [] }, ...s.forumPosts],
        })),
      replyForumPost: (id, r) =>
        set((s) => ({
          forumPosts: s.forumPosts.map((p) =>
            p.id === id ? { ...p, replies: [...p.replies, { ...r, id: uid(), at: Date.now() }] } : p
          ),
        })),
      addQA: (q) =>
        set((s) => ({ qaItems: [{ ...q, scholarClass: s.user.scholarClass, id: uid(), at: Date.now(), answers: [] }, ...s.qaItems] })),
      answerQA: (id, a) =>
        set((s) => ({
          qaItems: s.qaItems.map((q) =>
            q.id === id ? { ...q, answers: [...q.answers, { ...a, id: uid(), at: Date.now() }] } : q
          ),
        })),
      sendGroupMsg: (groupId, m) =>
        set((s) => ({
          studyGroups: s.studyGroups.map((g) =>
            g.id === groupId ? { ...g, messages: [...g.messages, { ...m, id: uid(), at: Date.now() }] } : g
          ),
        })),

      toggleBookmark: (chapterId) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(chapterId)
            ? s.bookmarks.filter((c) => c !== chapterId)
            : [...s.bookmarks, chapterId],
        })),

      sendFriendMessage: (friendId, text) =>
        set((s) => ({
          friends: s.friends.map((f) =>
            f.id === friendId
              ? { ...f, chat: [...f.chat, { id: uid(), from: "neha", text, at: Date.now() }], messagesSent: f.messagesSent + 1 }
              : f
          ),
        })),
      receiveFriendMessage: (friendId, text) =>
        set((s) => ({
          friends: s.friends.map((f) =>
            f.id === friendId
              ? { ...f, chat: [...f.chat, { id: uid(), from: "them", text, at: Date.now() }], lastActive: Date.now() }
              : f
          ),
        })),
      addFriendRequest: (req) =>
        set((s) => ({
          friendRequests: [
            { ...req, id: uid(), at: Date.now(), status: "pending" },
            ...s.friendRequests,
          ],
        })),
      acceptFriendRequest: (requestId) =>
        set((s) => ({
          friendRequests: s.friendRequests.map((r) =>
            r.id === requestId ? { ...r, status: "accepted" } : r
          ),
          friends: s.friends.map((f) => {
            const req = s.friendRequests.find((r) => r.id === requestId);
            if (req && req.friendId === f.id) return { ...f, status: "friend" };
            return f;
          }),
        })),
      rejectFriendRequest: (requestId) =>
        set((s) => ({
          friendRequests: s.friendRequests.map((r) =>
            r.id === requestId ? { ...r, status: "rejected" } : r
          ),
        })),

      purchaseItem: (id, price, name, category) => {
        const s = get();
        if (s.coins < price) return false;
        if (s.purchases.some((p) => p.id === id)) return true;
        set({
          coins: s.coins - price,
          purchases: [...s.purchases, { id, name, category, at: Date.now(), price }],
        });
        return true;
      },

      resetEverything: () => {
        const fresh = seed();
        set({ ...fresh, authed: true, onboarded: true });
      },
      resetPart: (part) =>
        set((s) => {
          switch (part) {
            case "notes": return { notes: [], folders: s.folders };
            case "flashcards": return { flashcards: [], decks: s.decks };
            case "tasks": return { tasks: [] };
            case "quiz": return { quizAttempts: [] };
            case "activity": return { activity: [] };
            case "sessions": return { sessions: [] };
            case "files": return { files: [] };
            case "chat": return { chatThreads: [] };
            default: return {};
          }
        }),

      updateSettings: (st) => set((s) => ({ settings: { ...s.settings, ...st } })),
    })
);

// ===== Auto-save to localStorage on every state change =====
if (typeof window !== "undefined") {
  useStore.subscribe((state) => {
    savePersistedState(state);
  });
}

// Helper to compute level info from xp
export function getLevelInfo(xp: number) {
  return levelFromXP(xp);
}
