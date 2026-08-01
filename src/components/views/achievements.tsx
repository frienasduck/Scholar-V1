"use client";

import { useStore, getLevelInfo } from "@/lib/store";
import { useUserName } from "@/lib/use-user-name";
import { Button } from "@/components/ui/button";
import { Badge as UiBadge } from "@/components/ui/badge";
import { SectionHeader, ProgressRing } from "@/lib/shared";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Award,
  Flame,
  Zap,
  Coins,
  Crown,
  Star,
  Lock,
  Gift,
  Sparkles,
  Check,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useEffect, useMemo } from "react";
import { profileGetJSON, profileSetJSON, profileGetItem, profileSetItem } from "@/lib/profile-storage";

// 8 wheel segments — last one is XP instead of coins
const WHEEL_SEGMENTS = [
  { label: "10", value: 10, color: "#6366f1", type: "coins" as const },
  { label: "5", value: 5, color: "#14b8a6", type: "coins" as const },
  { label: "50", value: 50, color: "#f59e0b", type: "coins" as const },
  { label: "0", value: 0, color: "#64748b", type: "coins" as const },
  { label: "25", value: 25, color: "#ec4899", type: "coins" as const },
  { label: "100", value: 100, color: "#8b5cf6", type: "coins" as const },
  { label: "15", value: 15, color: "#10b981", type: "coins" as const },
  { label: "100 XP", value: 100, color: "#ef4444", type: "xp" as const },
];

const FAKE_CLASSMATES = [
  { name: "Kabir Singh", avatar: "🦁", xp: 2150, isNeha: false },
  { name: "Ananya Reddy", avatar: "🦊", xp: 1820, isNeha: false },
  { name: "Diya Patel", avatar: "🦢", xp: 1610, isNeha: false },
  { name: "Meera Iyer", avatar: "🦌", xp: 1490, isNeha: false },
  { name: "Aarav Sharma", avatar: "🐯", xp: 1280, isNeha: false },
  { name: "Ishaan Verma", avatar: "🐼", xp: 980, isNeha: false },
  { name: "Sara Khan", avatar: "🦄", xp: 760, isNeha: false },
];

const LUCKY_KEY = "achievements-lucky";

export function AchievementsView() {
  const xp = useStore((s) => s.xp);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const coins = useStore((s) => s.coins);
  const streak = useStore((s) => s.streak);
  const badges = useStore((s) => s.badges);
  const user = useStore((s) => s.user);
  const { name: displayName } = useUserName();
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const li = getLevelInfo(xp);
  const earnedCount = badges.filter((b) => b.earned).length;
  // Defensive: if li.needed is 0/undefined (corrupted migrated profile), fall back to 0
  // to avoid passing NaN into ProgressRing.
  const xpPct = Number.isFinite(li.needed) && li.needed > 0
    ? Math.min(100, Math.max(0, (li.intoLevel / li.needed) * 100))
    : 0;

  // ===== Leaderboard =====
  const leaderboard = useMemo(() => {
    const all = [
      ...FAKE_CLASSMATES,
      { name: displayName || user.name, avatar: user.avatar, xp, isNeha: true },
    ];
    return all
      .sort((a, b) => b.xp - a.xp)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }, [xp, user]);

  // ===== Lucky Wheel =====
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prize, setPrize] = useState<
    { label: string; value: number; type: string } | null
  >(null);
  const [canSpin, setCanSpin] = useState(() => {
    if (typeof window === "undefined") return false;
    const last = profileGetItem(scholarClass, LUCKY_KEY);
    const today = new Date().toISOString().slice(0, 10);
    return last !== today;
  });

  function spin() {
    if (!canSpin || spinning) return;
    setSpinning(true);
    setPrize(null);
    const idx = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    const segAngle = 360 / WHEEL_SEGMENTS.length;
    // Bring segment idx to the top (under pointer)
    const restingAngle = (360 - idx * segAngle) % 360;
    const minTarget = rotation + 360 * 6;
    const adjust = (restingAngle - (minTarget % 360) + 360) % 360;
    const target = minTarget + adjust;
    setRotation(target);

    setTimeout(() => {
      setSpinning(false);
      const won = WHEEL_SEGMENTS[idx];
      setPrize(won);
      if (won.type === "coins") {
        addCoins(won.value);
        pushActivity({
          type: "reward",
          text: `Won ${won.value} coins from the lucky wheel!`,
          icon: "🎁",
        });
        if (won.value > 0) {
          toast.success(`🎉 You won ${won.value} coins! 🎊`, {
            description: "Spun on the daily Lucky Wheel.",
          });
        } else {
          toast.info("Better luck next time! 🍀");
        }
      } else {
        addXP(won.value);
        pushActivity({
          type: "reward",
          text: `Won ${won.value} XP from the lucky wheel!`,
          icon: "🎁",
        });
        toast.success(`🎉 You won ${won.value} XP! 🎊`, {
          description: "Spun on the daily Lucky Wheel.",
        });
      }
      const today = new Date().toISOString().slice(0, 10);
      profileSetItem(scholarClass, LUCKY_KEY, today);
      setCanSpin(false);
    }, 4000);
  }

  // ===== Milestones =====
  const milestones = [
    {
      id: "m1",
      label: "Streak 30 days",
      current: Math.min(streak, 30),
      target: 30,
      icon: "🔥",
      color: "#f59e0b",
    },
    {
      id: "m2",
      label: "Reach Level 20",
      current: Math.min(li.level, 20),
      target: 20,
      icon: "🎓",
      color: "#6366f1",
    },
    {
      id: "m3",
      label: "Earn all badges",
      current: earnedCount,
      target: badges.length,
      icon: "🏆",
      color: "#ec4899",
    },
    {
      id: "m4",
      label: "Collect 5,000 coins",
      current: Math.min(coins, 5000),
      target: 5000,
      icon: "💎",
      color: "#14b8a6",
    },
  ];

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
  .cinema-glass input, .cinema-glass textarea, .cinema-glass select {
    background: rgba(255,255,255,0.05) !important;
    border-color: rgba(255,255,255,0.15) !important;
    color: white !important;
  }
  .cinema-glass .bg-muted { background: rgba(255,255,255,0.05) !important; }
  .cinema-glass .border-border { border-color: rgba(255,255,255,0.1) !important; }
`}</style>
      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
        <h1 className="cinema-font-serif text-4xl text-white mb-6">Level Up <em>Faster</em></h1>
        <div className="space-y-6">
      <SectionHeader
        title="Achievements"
        subtitle="Track your XP, badges and climb the leaderboard."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Level card */}
        <div className="cinema-glass rounded-2xl p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row gap-6 items-center relative">
            <div className="relative grid place-items-center shrink-0">
              <ProgressRing
                value={xpPct}
                size={140}
                stroke={10}
                color="#6366f1"
                label={
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Level
                    </p>
                    <p className="text-3xl font-bold text-gradient leading-none mt-0.5">
                      {li.level}
                    </p>
                  </div>
                }
              />
              <Crown className="absolute -top-1 h-6 w-6 text-amber-400 drop-shadow" />
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-2xl font-semibold">Level {li.level}</h3>
                <span className="text-sm text-muted-foreground">Scholar</span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="tabular-nums">
                    {li.intoLevel} / {li.needed} XP
                  </span>
                  <span className="tabular-nums">{Math.round(xpPct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-teal-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <MiniStat
                  label="Total XP"
                  value={xp.toLocaleString()}
                  icon={<Zap className="h-3.5 w-3.5 text-indigo-400" />}
                />
                <MiniStat
                  label="Badges"
                  value={`${earnedCount}/${badges.length}`}
                  icon={<Award className="h-3.5 w-3.5 text-pink-400" />}
                />
                <MiniStat
                  label="Streak"
                  value={`${streak}d`}
                  icon={<Flame className="h-3.5 w-3.5 text-orange-500" />}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lucky Wheel */}
        <div className="cinema-glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4 text-fuchsia-400" />
                Lucky Wheel
              </h3>
              <UiBadge variant="secondary" className="text-[10px]">
                Daily
              </UiBadge>
            </div>
            <div className="relative mx-auto w-44 h-44 mb-4">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow" />
              <motion.div
                animate={{ rotate: rotation }}
                transition={{
                  duration: spinning ? 4 : 0,
                  ease: spinning ? "easeOut" : "linear",
                }}
                className="w-full h-full"
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  className="drop-shadow-lg"
                >
                  {WHEEL_SEGMENTS.map((seg, i) => {
                    const n = WHEEL_SEGMENTS.length;
                    const a1 = (-90 - 180 / n + (i * 360) / n) * (Math.PI / 180);
                    const a2 = (-90 + 180 / n + (i * 360) / n) * (Math.PI / 180);
                    const r = 48;
                    const x1 = 50 + r * Math.cos(a1);
                    const y1 = 50 + r * Math.sin(a1);
                    const x2 = 50 + r * Math.cos(a2);
                    const y2 = 50 + r * Math.sin(a2);
                    const mid = (-90 + (i * 360) / n) * (Math.PI / 180);
                    const tx = 50 + 30 * Math.cos(mid);
                    const ty = 50 + 30 * Math.sin(mid);
                    return (
                      <g key={i}>
                        <path
                          d={`M50,50 L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z`}
                          fill={seg.color}
                          stroke="rgba(0,0,0,0.25)"
                          strokeWidth="0.4"
                        />
                        <text
                          x={tx}
                          y={ty}
                          fill="white"
                          fontSize="6"
                          fontWeight="700"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${
                            (-90 + (i * 360) / n + 90) % 360
                          }, ${tx}, ${ty})`}
                        >
                          {seg.label}
                        </text>
                      </g>
                    );
                  })}
                  <circle
                    cx="50"
                    cy="50"
                    r="6"
                    fill="#0f172a"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                </svg>
              </motion.div>
            </div>
            <Button
              onClick={spin}
              disabled={!canSpin || spinning}
              className="w-full"
            >
              {spinning ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Spinning…
                </>
              ) : canSpin ? (
                <>
                  <Gift className="h-4 w-4" />
                  Spin for free
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Come back tomorrow
                </>
              )}
            </Button>
            <AnimatePresence>
              {prize && !spinning && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm mt-3 text-fuchsia-400 font-medium"
                >
                  You won {prize.label}
                  {prize.type === "coins" ? " coins" : " XP"}! 🎉
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div>
        <SectionHeader
          title="Badges"
          subtitle={`${earnedCount} of ${badges.length} earned`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {badges.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <div
                className={`cinema-glass rounded-2xl p-4 text-center relative overflow-hidden ${
                  !b.earned ? "opacity-70" : ""
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${b.color} ${
                    !b.earned ? "opacity-10" : "opacity-25"
                  }`}
                />
                <div className="relative">
                  <div
                    className={`text-3xl mb-2 ${
                      !b.earned ? "grayscale opacity-60" : ""
                    }`}
                  >
                    {b.icon}
                  </div>
                  <p className="text-xs font-semibold leading-tight">
                    {b.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 min-h-[28px]">
                    {b.description}
                  </p>
                  {b.earned ? (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                      <Check className="h-3 w-3" />
                      {b.earnedAt
                        ? new Date(b.earnedAt).toLocaleDateString()
                        : "Earned"}
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Locked
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <SectionHeader
          title="Next Milestones"
          subtitle="Progress toward unearned rewards."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {milestones.map((m) => {
            const pct = (() => {
              const safeTarget = Number.isFinite(m.target) && m.target > 0 ? m.target : 1;
              const safeCurrent = Number.isFinite(m.current) ? Math.max(0, m.current) : 0;
              return Math.min(100, (safeCurrent / safeTarget) * 100);
            })();
            return (
              <div key={m.id} className="cinema-glass rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{m.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {m.current.toLocaleString()} / {m.target.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <ProgressRing
                    value={pct}
                    size={44}
                    stroke={4}
                    color={m.color}
                    label={
                      <span className="text-[10px] font-bold">
                        {Math.round(pct)}%
                      </span>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <SectionHeader
          title="Class Leaderboard"
          subtitle="Weekly XP ranking among your classmates."
        />
        <div className="cinema-glass rounded-2xl p-2 sm:p-4">
          <div className="space-y-1">
            {leaderboard.map((p, i) => (
              <motion.div
                key={p.name + i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  p.isNeha
                    ? "bg-gradient-to-r from-indigo-500/15 to-teal-500/10 ring-1 ring-indigo-500/30"
                    : "hover:bg-muted/50"
                }`}
              >
                <div
                  className={`grid place-items-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                    p.rank === 1
                      ? "bg-amber-500/20 text-amber-400"
                      : p.rank === 2
                      ? "bg-slate-400/20 text-slate-300"
                      : p.rank === 3
                      ? "bg-orange-700/20 text-orange-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.rank === 1 ? (
                    <Crown className="h-3.5 w-3.5" />
                  ) : (
                    p.rank
                  )}
                </div>
                <div className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-teal-500/20 text-lg shrink-0">
                  {p.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      p.isNeha ? "text-gradient" : ""
                    }`}
                  >
                    {p.name}
                    {p.isNeha && " (you)"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold tabular-nums">
                    {p.xp.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>
  </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/40">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
