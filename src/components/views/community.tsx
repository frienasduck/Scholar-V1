"use client";

import { useStore } from "@/lib/store";
import { useUserName } from "@/lib/use-user-name";
import { askAI } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge as UiBadge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SectionHeader, EmptyState } from "@/lib/shared";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  MessageCircle,
  HelpCircle,
  Send,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

// AI persona classmates — each with subject speciality and personality.
// `id` maps to the server-side persona `classmate-<id>` defined in /api/ai/route.ts.
const AI_PERSONAS = [
  {
    id: "kabir",
    name: "Kabir Singh",
    avatar: "🦁",
    subject: "maths",
    personality: "Maths whiz",
  },
  {
    id: "ananya",
    name: "Ananya Reddy",
    avatar: "🦊",
    subject: "science",
    personality: "Science lover",
  },
  {
    id: "diya",
    name: "Diya Patel",
    avatar: "🦢",
    subject: "english",
    personality: "English nerd",
  },
  {
    id: "meera",
    name: "Meera Iyer",
    avatar: "🦌",
    subject: "sst",
    personality: "SST buff",
  },
  {
    id: "aarav",
    name: "Aarav Sharma",
    avatar: "🐯",
    subject: "all",
    personality: "all-rounder",
  },
];

function pickPersonas(subject: string, n = 1) {
  const subjectId = subject.toLowerCase();
  const matches = AI_PERSONAS.filter(
    (p) => p.subject === subjectId || p.subject === "all"
  );
  const pool =
    matches.length >= n
      ? matches
      : [...matches, ...AI_PERSONAS.filter((p) => !matches.includes(p))];
  // Shuffle and take n
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const SUBJECTS_CLASS9 = ["Maths", "Science", "English", "SST", "Hindi"];
const SUBJECTS_CLASS11 = ["Physics", "Chemistry", "Mathematics", "Computer Science", "English"];

function TypingIndicator({
  name,
  avatar,
}: {
  name: string;
  avatar: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-2 ml-12"
    >
      <div className="grid place-items-center h-7 w-7 rounded-full bg-muted text-sm shrink-0">
        {avatar}
      </div>
      <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-muted">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1.5">
            {name} is typing
          </span>
          {[0, 0.15, 0.3].map((d, i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: d }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function CommunityView() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .cinema-glass {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 80px -12px rgba(0,0,0,0.3);
          color: white;
        }
        .cinema-glass:hover { background: rgba(255,255,255,0.05); }
        .cinema-font-serif { font-family: 'Instrument Serif', serif; }
        .cinema-font-body { font-family: 'Inter', sans-serif; }
        .cinema-glass .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
        .cinema-glass input, .cinema-glass textarea {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.15) !important;
          color: white !important;
        }
        .cinema-glass .bg-muted { background: rgba(255,255,255,0.05) !important; }
        .cinema-glass .border-border { border-color: rgba(255,255,255,0.1) !important; }
      `}</style>
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-30">
        <source src="https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8" type="application/vnd.apple.mpegurl" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/60" />
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
        <h1 className="cinema-font-serif text-4xl text-white mb-6">A new way to learn <em>together</em></h1>
        <div className="space-y-6">
          <SectionHeader
            title="Community"
            subtitle="Forum, Q&A and study groups — your classmates are here (some are AI)."
          />
          <Tabs defaultValue="forum" className="w-full">
        <TabsList className="flex flex-wrap h-auto w-full sm:w-fit">
          <TabsTrigger value="forum" className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            Forum
          </TabsTrigger>
          <TabsTrigger value="qa" className="gap-1.5">
            <HelpCircle className="h-4 w-4" />
            Q&A
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <Users className="h-4 w-4" />
            Study Groups
          </TabsTrigger>
        </TabsList>
        <TabsContent value="forum" className="mt-4">
          <ForumTab />
        </TabsContent>
        <TabsContent value="qa" className="mt-4">
          <QATab />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <GroupsTab />
        </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}

type ForumPostLite = { subject: string; title: string; body: string };
type QALite = { subject: string; question: string };

function ForumTab() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const forumPosts = useStore((s) => s.forumPosts).filter((p) => (p.scholarClass ?? 9) === scholarClass);
  const addForumPost = useStore((s) => s.addForumPost);
  const replyForumPost = useStore((s) => s.replyForumPost);
  const pushActivity = useStore((s) => s.pushActivity);
  const addXP = useStore((s) => s.addXP);
  const { name: myName } = useUserName();
  const SUBJECTS = scholarClass === 11 ? SUBJECTS_CLASS11 : SUBJECTS_CLASS9;

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(() => scholarClass === 11 ? "Mathematics" : "Maths");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [typing, setTyping] = useState<
    Record<string, { name: string; avatar: string } | null>
  >({});

  function submitPost() {
    if (!title.trim() || !body.trim()) return;
    const payload = {
      author: myName,
      avatar: "🦋",
      subject,
      title: title.trim(),
      body: body.trim(),
    };
    addForumPost(payload);
    addXP(5);
    pushActivity({
      type: "community",
      text: `Posted in ${subject} forum: ${title.trim()}`,
      icon: "💬",
    });
    toast.success("Posted to forum (+5 XP)");
    setOpen(false);
    setTitle("");
    setBody("");

    // Trigger AI auto-replies on the newly-added post (forumPosts[0] after add)
    const newPost = useStore.getState().forumPosts[0];
    if (newPost) {
      triggerAIReply(newPost.id, {
        subject: newPost.subject,
        title: newPost.title,
        body: newPost.body,
      });
    }
  }

  function submitReply(postId: string, post: ForumPostLite) {
    const text = replyInputs[postId]?.trim();
    if (!text) return;
    replyForumPost(postId, {
      author: myName,
      avatar: "🦋",
      body: text,
    });
    addXP(2);
    setReplyInputs({ ...replyInputs, [postId]: "" });
    triggerAIReply(postId, post, text);
  }

  function triggerAIReply(postId: string, post: ForumPostLite, latestStudentMessage?: string) {
    const personas = pickPersonas(post.subject, 1 + Math.floor(Math.random() * 2));
    personas.forEach((persona, idx) => {
      const startDelay = idx * 3500 + 1500 + Math.random() * 1500;
      const respondDelay = startDelay + 1500 + Math.random() * 1000;
      setTimeout(() => {
        setTyping((s) => ({
          ...s,
          [postId]: { name: persona.name, avatar: persona.avatar },
        }));
      }, startDelay);
      setTimeout(async () => {
        try {
          // Use the server-side persona `classmate-<id>` so the LLM stays
          // in-character as a real teenage classmate (not an AI tutor).
          const personaId = `classmate-${persona.id}`;
          const livePost = useStore.getState().forumPosts.find((item) => item.id === postId);
          const recentThread = livePost?.replies
            .slice(-8)
            .map((reply) => `${reply.author}${reply.isAI ? " (AI classmate)" : ""}: ${reply.body}`)
            .join("\n") ?? "No replies yet.";
          const latestMessage = latestStudentMessage
            ?? [...(livePost?.replies ?? [])].reverse().find((reply) => !reply.isAI)?.body
            ?? post.body;
          const prompt = `You are replying inside an existing CBSE ${post.subject} forum thread as YOURSELF — a real teenage classmate, not a tutor or moderator.

Read the original post and the live discussion. Respond directly to the LATEST STUDENT MESSAGE. Do not ignore it and do not pretend it asked the original question. If it is off-topic, react naturally and briefly, then gently suggest making a separate thread or returning to the topic. If it asks about the academic topic, answer helpfully in your own casual voice. Stay coherent with the prior replies. Use 1-3 short sentences and emojis sparingly.

ORIGINAL TITLE: ${post.title}
ORIGINAL POST: ${post.body}

RECENT THREAD:
${recentThread}

LATEST STUDENT MESSAGE:
${latestMessage}`;
          const ai = await askAI(prompt, personaId, { temperature: 0.85, mode: "community-persona" });
          replyForumPost(postId, {
            author: persona.name,
            avatar: persona.avatar,
            body: ai,
            isAI: true,
          });
        } catch {
          replyForumPost(postId, {
            author: persona.name,
            avatar: persona.avatar,
            body: "hmm let me think abt this one",
            isAI: true,
          });
        } finally {
          setTyping((s) => ({ ...s, [postId]: null }));
        }
      }, respondDelay);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New post
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New forum post</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Subject
                </label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="A short, clear title"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Body
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="Describe your question or thought…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitPost}>Post</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {forumPosts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No posts yet"
          description="Be the first to start a conversation."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New post
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {forumPosts.map((p) => {
            const t = typing[p.id];
            const isOpen = expanded === p.id;
            return (
              <div
                key={p.id}
                className={`cinema-glass rounded-2xl p-4 transition-colors ${
                  isOpen ? "ring-1 ring-primary/30" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  className="flex items-start gap-3 w-full text-left rounded-lg -m-1 p-1 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-expanded={isOpen}
                >
                  <div className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-teal-500/20 text-lg shrink-0">
                    {p.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{p.author}</span>
                      <UiBadge variant="secondary" className="text-[10px]">
                        {p.subject}
                      </UiBadge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {timeAgo(p.at)}
                      </span>
                    </div>
                    <h3 className="font-semibold leading-tight">{p.title}</h3>
                    <p
                      className={`text-sm text-muted-foreground mt-1 ${
                        isOpen ? "" : "line-clamp-2"
                      }`}
                    >
                      {p.body}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>
                        {p.replies.length}{" "}
                        {p.replies.length === 1 ? "reply" : "replies"}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-0.5"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 -rotate-90" />
                      </motion.span>
                    </div>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                        {p.replies.length === 0 && (
                          <p className="ml-12 text-xs text-muted-foreground italic">
                            no replies yet — be the first to respond
                          </p>
                        )}
                        {p.replies.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-start gap-2.5 ml-12"
                          >
                            <div className="grid place-items-center h-7 w-7 rounded-full bg-muted text-sm shrink-0">
                              {r.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium">
                                  {r.author}
                                </span>
                                {r.isAI && (
                                  <UiBadge
                                    variant="outline"
                                    className="text-[9px] py-0 px-1 text-fuchsia-400 border-fuchsia-400/30"
                                  >
                                    AI
                                  </UiBadge>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {timeAgo(r.at)}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
                                {r.body}
                              </p>
                            </div>
                          </div>
                        ))}
                        <AnimatePresence>
                          {t && (
                            <TypingIndicator
                              name={t.name}
                              avatar={t.avatar}
                            />
                          )}
                        </AnimatePresence>
                        {/* Clicking inside the reply input must NOT toggle the post. */}
                        <div
                          className="ml-12 flex gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={replyInputs[p.id] ?? ""}
                            onChange={(e) =>
                              setReplyInputs({
                                ...replyInputs,
                                [p.id]: e.target.value,
                              })
                            }
                            placeholder="Write a reply…"
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                submitReply(p.id, {
                                  subject: p.subject,
                                  title: p.title,
                                  body: p.body,
                                });
                            }}
                          />
                          <Button
                            size="icon"
                            onClick={() =>
                              submitReply(p.id, {
                                subject: p.subject,
                                title: p.title,
                                body: p.body,
                              })
                            }
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QATab() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const qaItems = useStore((s) => s.qaItems).filter((p) => (p.scholarClass ?? 9) === scholarClass);
  const addQA = useStore((s) => s.addQA);
  const answerQA = useStore((s) => s.answerQA);
  const pushActivity = useStore((s) => s.pushActivity);
  const addXP = useStore((s) => s.addXP);
  const { name: myName } = useUserName();
  const SUBJECTS = scholarClass === 11 ? SUBJECTS_CLASS11 : SUBJECTS_CLASS9;

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(() => scholarClass === 11 ? "Physics" : "Science");
  const [question, setQuestion] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [typing, setTyping] = useState<
    Record<string, { name: string; avatar: string } | null>
  >({});

  function submitQ() {
    if (!question.trim()) return;
    const payload = {
      author: myName,
      avatar: "🦋",
      subject,
      question: question.trim(),
    };
    addQA(payload);
    addXP(3);
    pushActivity({
      type: "community",
      text: `Asked a ${subject} question`,
      icon: "❓",
    });
    toast.success("Question posted (+3 XP)");
    setOpen(false);
    setQuestion("");

    const newQ = useStore.getState().qaItems[0];
    if (newQ) {
      triggerAIAnswer(newQ.id, {
        subject: newQ.subject,
        question: newQ.question,
      });
    }
  }

  function submitAnswer(qaId: string, qa: QALite) {
    const text = answerInputs[qaId]?.trim();
    if (!text) return;
    answerQA(qaId, { author: myName, avatar: "🦋", body: text });
    addXP(2);
    setAnswerInputs({ ...answerInputs, [qaId]: "" });
    triggerAIAnswer(qaId, qa);
  }

  function triggerAIAnswer(qaId: string, qa: QALite) {
    const personas = pickPersonas(qa.subject, 1 + Math.floor(Math.random() * 2));
    personas.forEach((persona, idx) => {
      const startDelay = idx * 3500 + 1500 + Math.random() * 1500;
      const respondDelay = startDelay + 1500 + Math.random() * 1000;
      setTimeout(() => {
        setTyping((s) => ({
          ...s,
          [qaId]: { name: persona.name, avatar: persona.avatar },
        }));
      }, startDelay);
      setTimeout(async () => {
        try {
          // Use the server-side persona `classmate-<id>` so the LLM stays
          // in-character as a real teenage classmate (not an AI tutor).
          const personaId = `classmate-${persona.id}`;
          const prompt = `A CBSE student asked this ${qa.subject} question. Reply as YOURSELF — a real teenager answering a classmate. Don't be a tutor. Be casual, lowercase, can crack a joke. If you actually know the answer, give it but in your own voice (not textbook style). 1-3 sentences.\n\nQuestion: ${qa.question}`;
          const ai = await askAI(prompt, personaId, { temperature: 0.85, mode: "community-persona" });
          answerQA(qaId, {
            author: persona.name,
            avatar: persona.avatar,
            body: ai,
            isAI: true,
          });
        } catch {
          answerQA(qaId, {
            author: persona.name,
            avatar: persona.avatar,
            body: "no idea lol. lemme check and get back to u",
            isAI: true,
          });
        } finally {
          setTyping((s) => ({ ...s, [qaId]: null }));
        }
      }, respondDelay);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Ask question
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ask a question</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Subject
                </label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Question
                </label>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                  placeholder="What's on your mind?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitQ}>Ask</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {qaItems.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No questions yet"
          description="Ask your first question — AI classmates will help."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Ask question
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {qaItems.map((q) => {
            const t = typing[q.id];
            const isOpen = expanded === q.id;
            return (
              <div
                key={q.id}
                className={`cinema-glass rounded-2xl p-4 transition-colors ${
                  isOpen ? "ring-1 ring-primary/30" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : q.id)}
                  className="flex items-start gap-3 w-full text-left rounded-lg -m-1 p-1 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-expanded={isOpen}
                >
                  <div className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-lg shrink-0">
                    {q.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{q.author}</span>
                      <UiBadge variant="secondary" className="text-[10px]">
                        {q.subject}
                      </UiBadge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {timeAgo(q.at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{q.question}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>
                        {q.answers.length}{" "}
                        {q.answers.length === 1 ? "answer" : "answers"}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-0.5"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 -rotate-90" />
                      </motion.span>
                    </div>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                        {q.answers.length === 0 && (
                          <p className="ml-12 text-xs text-muted-foreground italic">
                            no answers yet — be the first to respond
                          </p>
                        )}
                        {q.answers.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-start gap-2.5 ml-12"
                          >
                            <div className="grid place-items-center h-7 w-7 rounded-full bg-muted text-sm shrink-0">
                              {a.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium">
                                  {a.author}
                                </span>
                                {a.isAI && (
                                  <UiBadge
                                    variant="outline"
                                    className="text-[9px] py-0 px-1 text-fuchsia-400 border-fuchsia-400/30"
                                  >
                                    AI
                                  </UiBadge>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {timeAgo(a.at)}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
                                {a.body}
                              </p>
                            </div>
                          </div>
                        ))}
                        <AnimatePresence>
                          {t && (
                            <TypingIndicator
                              name={t.name}
                              avatar={t.avatar}
                            />
                          )}
                        </AnimatePresence>
                        {/* Clicking inside the answer input must NOT toggle the Q&A. */}
                        <div
                          className="ml-12 flex gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={answerInputs[q.id] ?? ""}
                            onChange={(e) =>
                              setAnswerInputs({
                                ...answerInputs,
                                [q.id]: e.target.value,
                              })
                            }
                            placeholder="Write an answer…"
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                submitAnswer(q.id, {
                                  subject: q.subject,
                                  question: q.question,
                                });
                            }}
                          />
                          <Button
                            size="icon"
                            onClick={() =>
                              submitAnswer(q.id, {
                                subject: q.subject,
                                question: q.question,
                              })
                            }
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupsTab() {
  const studyGroups = useStore((s) => s.studyGroups);
  const sendGroupMsg = useStore((s) => s.sendGroupMsg);
  const pushActivity = useStore((s) => s.pushActivity);
  const { name: myName } = useUserName();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState<{
    name: string;
    avatar: string;
  } | null>(null);

  const active = studyGroups.find((g) => g.id === activeId);

  function send() {
    if (!input.trim() || !active) return;
    const msg = input.trim();
    sendGroupMsg(active.id, {
      author: myName,
      avatar: "🦋",
      body: msg,
    });
    pushActivity({
      type: "community",
      text: `Messaged ${active.name}`,
      icon: "👥",
    });
    setInput("");

    const persona =
      AI_PERSONAS[Math.floor(Math.random() * AI_PERSONAS.length)];
    setTyping({ name: persona.name, avatar: persona.avatar });
    setTimeout(async () => {
      try {
        // Use the server-side persona `classmate-<id>` so the LLM stays
        // in-character as a real teenage classmate (not an AI tutor).
        const personaId = `classmate-${persona.id}`;
        const prompt = `You're in a group chat called "${active.name}" (subject: ${active.subject}). The student just said: "${msg}". Reply as YOURSELF — a real teenager in a group chat with classmates. Short, casual, lowercase. Can be a joke, can be off-topic, can double-text. Don't be a tutor. 1-2 sentences max.`;
        const ai = await askAI(prompt, personaId, { temperature: 0.85, mode: "community-persona" });
        sendGroupMsg(active.id, {
          author: persona.name,
          avatar: persona.avatar,
          body: ai,
          isAI: true,
        });
      } catch {
        sendGroupMsg(active.id, {
          author: persona.name,
          avatar: persona.avatar,
          body: "lol true",
          isAI: true,
        });
      } finally {
        setTyping(null);
      }
    }, 1500 + Math.random() * 2000);
  }

  if (active) {
    return (
      <div
        className="cinema-glass rounded-2xl p-0 overflow-hidden flex flex-col"
        style={{ height: "70vh", maxHeight: 600 }}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border/60">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveId(null)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-white font-semibold shrink-0">
            {active.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{active.name}</p>
            <p className="text-xs text-muted-foreground">
              {active.members} members · {active.subject}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {active.messages.map((m) => {
            const mine = m.author === myName;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[80%] ${
                    mine ? "flex-row-reverse" : ""
                  }`}
                >
                  <div className="grid place-items-center h-7 w-7 rounded-full bg-muted text-sm shrink-0">
                    {m.avatar}
                  </div>
                  <div
                    className={`px-3 py-2 rounded-2xl ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    {!mine && (
                      <p className="text-[10px] font-medium mb-0.5 opacity-80">
                        {m.author}
                        {m.isAI && " · AI"}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <AnimatePresence>
            {typing && (
              <TypingIndicator name={typing.name} avatar={typing.avatar} />
            )}
          </AnimatePresence>
        </div>
        <div className="p-3 border-t border-border/60 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${active.name}…`}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <Button size="icon" onClick={send}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {studyGroups.map((g) => {
        const last = g.messages[g.messages.length - 1];
        return (
          <div
            key={g.id}
            className="cinema-glass rounded-2xl premium-card-hover p-5 cursor-pointer"
            onClick={() => setActiveId(g.id)}
          >
            <div className="flex items-start gap-3">
              <div className="grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white font-bold text-lg shrink-0">
                {g.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight">{g.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {g.subject}
                </p>
                <div className="flex items-center gap-1.5 mt-3">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {g.members} members
                  </span>
                  <UiBadge variant="secondary" className="ml-auto text-[10px]">
                    {g.messages.length} msgs
                  </UiBadge>
                </div>
              </div>
            </div>
            {last && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60 line-clamp-1">
                <span className="font-medium">{last.author}:</span> {last.body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
