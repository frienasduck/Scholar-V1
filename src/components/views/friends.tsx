"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { askAI } from "@/lib/ai";
import { SectionHeader, EmptyState } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, Send, MessageCircle, Check, X, Star, User as UserIcon,
  Heart, Clock, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

type ReplyHistory = { role: "user" | "assistant"; content: string }[];
type FailedReply = { friendId: string; text: string; history: ReplyHistory };

export function FriendsView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const privacySettings = useStore((s) => s.settings);
  const friends = (useStore((s) => s.friends) ?? []).filter((f) => (f.scholarClass ?? 9) === scholarClass);
  const friendRequests = useStore((s) => s.friendRequests) ?? [];
  const sendFriendMessage = useStore((s) => s.sendFriendMessage);
  const receiveFriendMessage = useStore((s) => s.receiveFriendMessage);
  const addFriendRequest = useStore((s) => s.addFriendRequest);
  const acceptFriendRequest = useStore((s) => s.acceptFriendRequest);
  const rejectFriendRequest = useStore((s) => s.rejectFriendRequest);
  const pushActivity = useStore((s) => s.pushActivity);
  const addXP = useStore((s) => s.addXP);

  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [failedReply, setFailedReply] = useState<FailedReply | null>(null);
  const [tab, setTab] = useState<"all" | "friends" | "requests">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeFriend = useMemo(
    () => friends.find((f) => f.id === activeFriendId) ?? null,
    [friends, activeFriendId]
  );

  const pendingRequests = friendRequests.filter((r) => r.status === "pending");
  const realFriends = friends.filter((f) => f.status === "friend");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [activeFriend?.chat.length, typing]);

  async function handleSend() {
  const text = input.trim();
  if (!text || !activeFriend) return;
  if (privacySettings.communityMessages === false) {
    toast.error("Community messages are disabled", { description: "Enable them in Settings → Privacy to send or receive friend messages." });
    return;
  }
    sendFriendMessage(activeFriend.id, text);
    setInput("");
    setTyping(true);
    setFailedReply(null);
    const history: ReplyHistory = activeFriend.chat.slice(-8).map((message) => ({
      role: message.from === "neha" ? "user" : "assistant",
      content: message.text,
    }));

    // If the student has sent 2 messages and this friend is still a stranger → trigger friend request
    const newCount = activeFriend.messagesSent + 1;
    if (privacySettings.allowFriendRequests !== false && activeFriend.status === "stranger" && newCount >= 2) {
      setTimeout(() => {
        addFriendRequest({ friendId: activeFriend.id, name: activeFriend.name, avatar: activeFriend.avatar });
        toast(`🎁 ${activeFriend.name} sent you a friend request!`, { description: "Check the Requests tab." });
      }, 800);
    }

    try {
      // Use the friend-specific persona for realistic human-like replies
      const personaId = `friend-${activeFriend.id.replace("f-", "")}`;
      const reply = await askAI(text, personaId, {
        history,
        temperature: 0.85,
        mode: "friend-chat",
      });
      // Use a tiny delay to make typing feel real
      setTimeout(() => {
        receiveFriendMessage(activeFriend.id, reply);
        setTyping(false);
        setFailedReply(null);
        addXP(1);
      }, 600 + Math.random() * 800);
    } catch {
      setTyping(false);
      setFailedReply({ friendId: activeFriend.id, text, history });
      toast.error("Couldn't reach " + activeFriend.name);
    }
  }

  async function retryFriendReply() {
    if (!failedReply || !activeFriend || failedReply.friendId !== activeFriend.id) return;
    setTyping(true);
    try {
      const personaId = `friend-${activeFriend.id.replace("f-", "")}`;
      const reply = await askAI(failedReply.text, personaId, {
        history: failedReply.history,
        temperature: 0.85,
        mode: "friend-chat",
      });
      receiveFriendMessage(activeFriend.id, reply);
      setFailedReply(null);
      addXP(1);
    } catch {
      toast.error("Couldn't reach " + activeFriend.name);
    } finally {
      setTyping(false);
    }
  }

  const filteredFriends = useMemo(() => {
    if (tab === "friends") return realFriends;
    if (tab === "requests") return [];
    return friends;
  }, [tab, friends, realFriends]);

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
        <h1 className="cinema-font-serif text-4xl text-white mb-6">Meet your study <em>squad</em></h1>
        <div className="space-y-6">
          <SectionHeader
            title="Friends"
            subtitle={`Chat with ${friends.length} amazing people — send 2 messages to unlock a friend request`}
        action={
          pendingRequests.length > 0 && (
            <Badge className="bg-pink-500 text-white">
              <Heart className="h-3 w-3 mr-1" /> {pendingRequests.length} new
            </Badge>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1.5">
        {([
          { id: "all", label: "Discover", icon: Sparkles },
          { id: "friends", label: `Friends (${realFriends.length})`, icon: UserIcon },
          { id: "requests", label: `Requests (${pendingRequests.length})`, icon: Heart },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Requests tab */}
      {tab === "requests" && (
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No friend requests yet"
              description="Send 2 messages to someone in Discover to receive a friend request."
            />
          ) : (
            pendingRequests.map((req) => {
              const f = friends.find((x) => x.id === req.friendId);
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="cinema-glass rounded-2xl p-4 flex items-center gap-4">
                    <div className="grid place-items-center h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-500 text-2xl shrink-0">
                      {req.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{req.name}</p>
                      <p className="text-xs text-muted-foreground">{f?.bio ?? "Wants to be your friend"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(req.at)} ago</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          acceptFriendRequest(req.id);
                          addXP(10);
                          pushActivity({ type: "friend", text: `Now friends with ${req.name}`, icon: "💖" });
                          toast.success(`You're now friends with ${req.name}!`);
                        }}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                      >
                        <Check className="h-4 w-4 mr-1" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          rejectFriendRequest(req.id);
                          toast("Request declined");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Friends grid / Discover */}
      {tab !== "requests" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredFriends.map((f) => (
              <motion.div
                key={f.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <div className="cinema-glass rounded-2xl premium-card-hover p-5 lift-on-hover card-highlight relative overflow-hidden">
                  {/* status dot */}
                  <div className={`absolute top-3 right-3 h-2.5 w-2.5 rounded-full ${Date.now() - f.lastActive < 3600000 ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />

                  <div className="flex items-start gap-3 mb-3">
                    <div className="grid place-items-center h-14 w-14 rounded-2xl text-3xl shrink-0 bg-gradient-to-br from-pink-500 to-rose-500">
                      {f.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold truncate">{f.name}</p>
                      </div>
                      {f.korean && <p className="text-xs text-fuchsia-400/80">{f.korean} · {f.position}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.bio}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {f.status === "friend" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        <Heart className="h-3 w-3 mr-1 fill-emerald-400" /> Friends
                      </Badge>
                    ) : f.status === "stranger" ? (
                      <Badge variant="secondary" className="text-xs">
                        {f.messagesSent}/2 messages to unlock
                      </Badge>
                    ) : (
                      <Badge variant="outline">{f.status}</Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setActiveFriendId(f.id)}
                      className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Chat modal */}
      <Dialog open={!!activeFriend} onOpenChange={(o) => !o && setActiveFriendId(null)}>
        <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden h-[85vh] max-h-[700px] flex flex-col">
          {activeFriend && (
            <>
              <DialogHeader className="px-4 py-3 border-b border-border/60 flex-row items-center gap-3 space-y-0">
                <div className="grid place-items-center h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-xl shrink-0">
                  {activeFriend.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base flex items-center gap-1.5">
                    {activeFriend.name}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {activeFriend.status === "friend" ? "You're friends" : `${activeFriend.messagesSent}/2 messages sent`}
                  </p>
                </div>
              </DialogHeader>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {activeFriend.chat.length === 0 && (
                  <div className="text-center py-8">
                    <div className="mx-auto grid place-items-center h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-3xl mb-3">
                      {activeFriend.avatar}
                    </div>
                    <p className="font-medium">Say hi to {activeFriend.name}!</p>
                    <p className="text-xs text-muted-foreground mt-1">Send 2 messages to unlock a friend request.</p>
                  </div>
                )}
                <AnimatePresence mode="popLayout">
                  {activeFriend.chat.map((m) => (
                    <motion.div
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.from === "neha" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                          m.from === "neha"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {typing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                      {[0, 0.15, 0.3].map((d, i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
                          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
                {failedReply?.friendId === activeFriend.id && !typing && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-xs text-amber-100">{activeFriend.name}'s reply could not be loaded. No reply was fabricated.</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={retryFriendReply}>Retry</Button>
                      <Button size="sm" variant="ghost" onClick={() => setFailedReply(null)}>Clear</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-border/60 flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${activeFriend.name}…`}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || typing}
                  className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
