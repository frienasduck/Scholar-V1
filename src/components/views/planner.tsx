"use client";

import { useStore, type Task } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import type { Subject } from "@/lib/curriculum";
import { askAIJSON } from "@/lib/ai";
import { StatCard, SectionHeader, EmptyState, Pill, ProgressRing } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Clock, Sparkles, CalendarDays, ListTodo, Check, ChevronLeft, ChevronRight,
  Zap, Target, AlertCircle, Calendar as CalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useCallback } from "react";

// ===== Helpers =====
const todayStr = () => new Date().toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const getSubjectAccent = (curriculum: { id: string; accent: string }[]): Record<string, string> =>
  Object.fromEntries(curriculum.map((s) => [s.id, s.accent]));

const TYPE_LABEL: Record<Task["type"], string> = {
  study: "Study", assignment: "Assignment", exam: "Exam", revision: "Revision", other: "Other",
};

const PRIORITY_STYLE: Record<Task["priority"], { label: string; cls: string; dot: string }> = {
  high: { label: "High", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30", dot: "bg-rose-500" },
  medium: { label: "Med", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", dot: "bg-amber-500" },
  low: { label: "Low", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", dot: "bg-emerald-500" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ===== Main =====
export function PlannerView() {
  const tasks = useStore((s) => s.tasks);
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const SUBJECT_ACCENT = getSubjectAccent(CURRICULUM);
  const addTask = useStore((s) => s.addTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [newOpen, setNewOpen] = useState(false);
  const [aiOpen, setAIOpen] = useState(false);
  const [aiGoal, setAIGoal] = useState("");
  const [aiLoading, setAILoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [cursor, setCursor] = useState(() => new Date());

  // Stats
  const today = todayStr();
  const todays = tasks.filter((t) => t.date === today && !t.done);
  const overdue = tasks.filter((t) => t.date < today && !t.done);
  const completed = tasks.filter((t) => t.done).length;
  const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const handleToggle = useCallback(
    (t: Task) => {
      toggleTask(t.id);
      if (!t.done) {
        addXP(10);
        addCoins(3);
        pushActivity({ type: "task", text: `Completed: ${t.title}`, icon: "✅" });
        toast.success("Task completed!", { description: `+10 XP · +3 coins` });
      }
    },
    [toggleTask, addXP, addCoins, pushActivity]
  );

  const runAISchedule = useCallback(async () => {
    if (!aiGoal.trim()) {
      toast.error("Tell the coach your goal for the week.");
      return;
    }
    setAILoading(true);
    try {
      const subjectEnum = CURRICULUM.map((s) => `"${s.id}"`).join("|");
      const prompt = `Create a 7-day CBSE Class ${scholarClass} study plan. Goal from student: "${aiGoal}". Today is ${today}. Return ONLY JSON in this exact shape: { "tasks": [{ "title": string, "subject": ${subjectEnum}, "date": "YYYY-MM-DD", "time": "HH:MM", "type": "study"|"revision"|"assignment"|"exam"|"other", "priority": "low"|"medium"|"high" }] }. Use the next 7 days starting today (${today}). Keep titles concise. 1-3 tasks per day.`;
      const data = await askAIJSON<{ tasks: Partial<Task>[] }>(prompt, "academic-coach");
      if (!data?.tasks?.length) {
        toast.error("Couldn't generate a schedule. Try again.");
        return;
      }
      let added = 0;
      for (const t of data.tasks) {
        if (!t.title) continue;
        addTask({
          title: t.title,
          subject: t.subject,
          date: t.date ?? today,
          time: t.time,
          type: t.type ?? "study",
          priority: t.priority ?? "medium",
        });
        added++;
      }
      pushActivity({ type: "ai", text: `AI generated ${added} study tasks`, icon: "✨" });
      toast.success(`Added ${added} tasks to your planner`, { description: "AI coach built a 7-day plan." });
      setAIOpen(false);
      setAIGoal("");
      setView("week");
    } catch {
      toast.error("AI request failed. Please retry.");
    } finally {
      setAILoading(false);
    }
  }, [aiGoal, today, addTask, pushActivity]);

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
        .cinema-glass input::placeholder, .cinema-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .cinema-glass button { color: white; }
        .cinema-glass .bg-muted { background: rgba(255,255,255,0.05) !important; }
        .cinema-glass .border-border { border-color: rgba(255,255,255,0.1) !important; }
      `}</style>
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
      <h1 className="cinema-font-serif text-4xl text-white mb-6">Plan Your <em>Success</em></h1>
      <div className="view-enter space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planner</h1>
          <p className="text-sm text-muted-foreground mt-1">Organise your week, beat procrastination.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={aiOpen} onOpenChange={setAIOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="premium-card-hover bg-card/60">
                <Sparkles className="h-4 w-4 mr-2 text-indigo-400" /> AI Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="premium-card">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> AI Study Schedule
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tell your AI academic coach what you want to achieve this week — it&apos;ll build a 7-day CBSE plan for you.
                </p>
                <Textarea
                  value={aiGoal}
                  onChange={(e) => setAIGoal(e.target.value)}
                  placeholder="e.g. Prepare for my Science unit test on Motion and finish my Maths revision."
                  rows={3}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={runAISchedule} disabled={aiLoading}>
                  {aiLoading ? (
                    <>
                      <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin mr-2" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" /> Generate plan
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <NewTaskDialog onAdd={addTask} open={newOpen} onOpenChange={setNewOpen} curriculum={CURRICULUM} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Target} label="Today" value={todays.length} sub={`${overdue.length} overdue`} accent="#6366f1" />
        <StatCard icon={AlertCircle} label="Overdue" value={overdue.length} sub="Needs attention" accent="#f43f5e" />
        <StatCard icon={Check} label="Completed" value={completed} sub="all time" accent="#14b8a6" />
        <StatCard icon={Zap} label="Completion" value={`${completionRate}%`} sub="of all tasks" accent="#f59e0b" />
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="month"><CalendarDays className="h-4 w-4 mr-1.5" /> Month</TabsTrigger>
            <TabsTrigger value="week"><CalIcon className="h-4 w-4 mr-1.5" /> Week</TabsTrigger>
            <TabsTrigger value="list"><ListTodo className="h-4 w-4 mr-1.5" /> List</TabsTrigger>
          </TabsList>
          {view !== "list" && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - (view === "month" ? 1 : 0), cursor.getDate() - 7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setCursor(new Date()); setSelectedDate(today); }}>Today</Button>
              <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + (view === "month" ? 1 : 0), cursor.getDate() + 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="month" className="mt-4">
          <MonthView
            cursor={cursor}
            setCursor={setCursor}
            tasks={tasks}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onToggle={handleToggle}
            onDelete={deleteTask}
            curriculum={CURRICULUM}
          />
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <WeekView cursor={cursor} tasks={tasks} onToggle={handleToggle} onDelete={deleteTask} curriculum={CURRICULUM} />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <ListView tasks={tasks} onToggle={handleToggle} onDelete={deleteTask} curriculum={CURRICULUM} />
        </TabsContent>
      </Tabs>
      </div>
      </div>
      </div>
  );
}

// ===== New Task Dialog =====
function NewTaskDialog({
  onAdd, open, onOpenChange, curriculum,
}: {
  onAdd: (t: Partial<Task>) => void; open: boolean; onOpenChange: (v: boolean) => void; curriculum: Subject[];
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("maths");
  const [type, setType] = useState<Task["type"]>("study");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("17:00");
  const [priority, setPriority] = useState<Task["priority"]>("medium");

  const submit = () => {
    if (!title.trim()) {
      toast.error("Please give the task a title.");
      return;
    }
    onAdd({ title: title.trim(), subject, type, date, time, priority });
    toast.success("Task added");
    setTitle("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent className="premium-card">
        <DialogHeader>
          <DialogTitle>Add a new task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Revise Polynomials — Chapter 2" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {curriculum.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as Task["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button onClick={submit}>Add task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Month View =====
function MonthView({
  cursor, setCursor, tasks, selectedDate, setSelectedDate, onToggle, onDelete, curriculum,
}: {
  cursor: Date; setCursor: (d: Date) => void;
  tasks: Task[]; selectedDate: string; setSelectedDate: (d: string) => void;
  onToggle: (t: Task) => void; onDelete: (id: string) => void; curriculum: Subject[];
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const SUBJECT_ACCENT = getSubjectAccent(curriculum);

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const tasksByDate = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) (m[t.date] ??= []).push(t);
    return m;
  }, [tasks]);

  const selectedTasks = tasksByDate[selectedDate] ?? [];
  const isToday = (d: Date) => ymd(d) === todayStr();
  const isSelected = (d: Date) => ymd(d) === selectedDate;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="cinema-glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{MONTHS[month]} {year}</h3>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCursor(new Date()); setSelectedDate(todayStr()); }}>Today</Button>
            <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-[10px] uppercase tracking-wider text-muted-foreground text-center font-medium py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square rounded-lg bg-muted/30" />;
            const ds = ymd(d);
            const dayTasks = tasksByDate[ds] ?? [];
            const subjectColors = Array.from(new Set(dayTasks.map((t) => t.subject).filter(Boolean)));
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(ds)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-start p-1.5 text-xs transition-all relative
                  ${isSelected(d) ? "bg-indigo-500/20 ring-1 ring-indigo-500/40" : "hover:bg-muted/60"}
                  ${isToday(d) ? "ring-1 ring-teal-500/40" : ""}
                `}
              >
                <span className={`font-medium ${isToday(d) ? "text-teal-500" : ""}`}>{d.getDate()}</span>
                <div className="flex gap-0.5 mt-auto mb-0.5 flex-wrap justify-center">
                  {subjectColors.slice(0, 4).map((sid) => (
                    <span key={sid} className="h-1.5 w-1.5 rounded-full" style={{ background: SUBJECT_ACCENT[sid ?? ""] ?? "#6366f1" }} />
                  ))}
                  {dayTasks.length > 4 && <span className="text-[9px] text-muted-foreground">+{dayTasks.length - 4}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side panel for selected day */}
      <div className="cinema-glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
          </h3>
          <Badge variant="secondary" className="text-[11px]">{selectedTasks.length} tasks</Badge>
        </div>
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="space-y-2">
            <AnimatePresence>
              {selectedTasks.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No tasks" description="Pick another day or add a new task." />
              ) : (
                selectedTasks.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} compact curriculum={curriculum} />
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ===== Week View =====
function WeekView({
  cursor, tasks, onToggle, onDelete, curriculum,
}: {
  cursor: Date; tasks: Task[];
  onToggle: (t: Task) => void; onDelete: (id: string) => void; curriculum: Subject[];
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const tasksByDate = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) (m[t.date] ??= []).push(t);
    return m;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
      {days.map((d) => {
        const ds = ymd(d);
        const dayTasks = (tasksByDate[ds] ?? []).slice().sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
        const isToday = ds === todayStr();
        return (
          <div key={ds} className={`cinema-glass rounded-2xl p-3 flex flex-col min-h-[200px] ${isToday ? "ring-1 ring-teal-500/40" : ""}`}>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/50">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{WEEKDAYS[d.getDay()]}</p>
                <p className={`text-lg font-semibold leading-none ${isToday ? "text-teal-500" : ""}`}>{d.getDate()}</p>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5">{dayTasks.length}</Badge>
            </div>
            <div className="space-y-1.5 flex-1">
              {dayTasks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Free day</p>
              ) : (
                dayTasks.map((t) => (
                  <WeekTaskCard key={t.id} task={t} onToggle={() => onToggle(t)} onDelete={() => onDelete(t.id)} curriculum={curriculum} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekTaskCard({ task, onToggle, onDelete, curriculum }: { task: Task; onToggle: () => void; onDelete: () => void; curriculum: Subject[] }) {
  const subj = task.subject ? curriculum.find((s) => s.id === task.subject) ?? null : null;
  const accent = subj?.accent ?? "#6366f1";
  const ps = PRIORITY_STYLE[task.priority];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`group relative rounded-lg p-2 border border-border/50 ${task.done ? "opacity-50" : ""}`}
      style={{ background: `${accent}10`, borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-start gap-1.5">
        <button
          onClick={onToggle}
          className={`mt-0.5 grid place-items-center h-4 w-4 rounded-full border ${task.done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/40 hover:border-foreground"}`}
        >
          {task.done && <Check className="h-2.5 w-2.5 text-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium leading-snug ${task.done ? "line-through" : ""}`}>{task.title}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {task.time && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{task.time}</span>}
            <span className={`h-1 w-1 rounded-full ${ps.dot}`} />
          </div>
        </div>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-rose-500" />
        </button>
      </div>
    </motion.div>
  );
}

// ===== List View =====
function ListView({
  tasks, onToggle, onDelete, curriculum,
}: {
  tasks: Task[]; onToggle: (t: Task) => void; onDelete: (id: string) => void; curriculum: Subject[];
}) {
  const today = todayStr();
  const groups = useMemo(() => {
    const overdue: Task[] = [];
    const todays: Task[] = [];
    const upcoming: Task[] = [];
    const completed: Task[] = [];
    for (const t of tasks) {
      if (t.done) completed.push(t);
      else if (t.date < today) overdue.push(t);
      else if (t.date === today) todays.push(t);
      else upcoming.push(t);
    }
    overdue.sort((a, b) => a.date.localeCompare(b.date));
    todays.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
    completed.sort((a, b) => b.date.localeCompare(a.date));
    return { overdue, todays, upcoming, completed };
  }, [tasks, today]);

  const sections: { key: string; label: string; items: Task[]; color: string }[] = [
    { key: "overdue", label: "Overdue", items: groups.overdue, color: "#f43f5e" },
    { key: "today", label: "Today", items: groups.todays, color: "#6366f1" },
    { key: "upcoming", label: "Upcoming", items: groups.upcoming, color: "#14b8a6" },
    { key: "completed", label: "Completed", items: groups.completed, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-5">
      {sections.map((sec) => (
        <div key={sec.key}>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full" style={{ background: sec.color }} />
            <h3 className="text-sm font-semibold">{sec.label}</h3>
            <Badge variant="secondary" className="text-[10px]">{sec.items.length}</Badge>
          </div>
          {sec.items.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-4 italic">Nothing here.</p>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence>
                {sec.items.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} curriculum={curriculum} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== Task Row =====
function TaskRow({
  task, onToggle, onDelete, compact, curriculum,
}: {
  task: Task; onToggle: (t: Task) => void; onDelete: (id: string) => void; compact?: boolean; curriculum: Subject[];
}) {
  const subj = task.subject ? curriculum.find((s) => s.id === task.subject) ?? null : null;
  const accent = subj?.accent ?? "#6366f1";
  const ps = PRIORITY_STYLE[task.priority];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className={`group flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-3 ${compact ? "py-2" : "py-2.5"} ${task.done ? "opacity-60" : ""}`}
    >
      <Checkbox checked={task.done} onCheckedChange={() => onToggle(task)} className="border-muted-foreground/40 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium leading-snug truncate ${task.done ? "line-through" : ""}`}>{task.title}</p>
        {!compact && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {subj && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5" style={{ color: accent, borderColor: `${accent}40` }}>
                {subj.icon} {subj.name}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <CalendarDays className="h-3 w-3" />
              {new Date(task.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
            {task.time && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" />{task.time}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{TYPE_LABEL[task.type]}</span>
          </div>
        )}
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${ps.cls}`}>{ps.label}</span>
      <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1">
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-rose-500" />
      </button>
    </motion.div>
  );
}

export default PlannerView;
