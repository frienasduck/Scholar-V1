"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useUserName } from "@/lib/use-user-name";
import { askAIJSON } from "@/lib/ai";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { toast } from "sonner";
import { FlaskRound, CheckCircle2, Circle, Loader2, Download, Sparkles, BookOpen, ChevronRight } from "lucide-react";

interface Experiment { id: string; subject: "Physics" | "Chemistry" | "Computer Science"; title: string; apparatus: string[]; procedure: string[]; formula: string; viva: string[]; }

const EXPERIMENTS: Experiment[] = [
  { id: "p1", subject: "Physics", title: "Vernier Caliper — Measure Dimensions", apparatus: ["Vernier Caliper", "Cylinder/Sphere", "Lab manual"], procedure: ["Find least count (LC = 1 MSD - 1 VSD)", "Measure length with jaws", "Measure diameter with lower jaws", "Repeat 3 times, take mean", "Calculate volume = πr²h"], formula: "LC = 1 MSD - 1 VSD; Volume = πr²h", viva: ["What is least count?", "Define vernier constant.", "Why zero error correction is needed?", "What is the range of the vernier?", "Define significant figures."] },
  { id: "p2", subject: "Physics", title: "Screw Gauge — Measure Wire Diameter", apparatus: ["Screw Gauge", "Wire", "Lab manual"], procedure: ["Find pitch and least count", "Find zero error", "Place wire between anvil and spindle", "Read main scale + circular scale", "Subtract zero error"], formula: "LC = Pitch / No. of divisions; d = MSR + (CSR × LC) - Zero Error", viva: ["Define pitch of screw gauge.", "What is least count?", "How to find zero error?", "What is backlash error?", "Why ratchet is used?"] },
  { id: "p3", subject: "Physics", title: "Simple Pendulum — Find g", apparatus: ["Pendulum bob", "String", "Stopwatch", "Stand", "Meter scale"], procedure: ["Measure length L from point of suspension to center of bob", "Displace bob < 15°", "Time 20 oscillations, find T = t/20", "Repeat for different lengths", "Plot T² vs L graph, find g = 4π²/slope"], formula: "T = 2π√(L/g); g = 4π²L/T²", viva: ["What is an ideal pendulum?", "Why amplitude should be small?", "Define time period.", "Why 20 oscillations are timed?", "What factors affect g?"] },
  { id: "p4", subject: "Physics", title: "Spring Constant — Hooke's Law", apparatus: ["Spring", "Slotted weights", "Stand", "Ruler"], procedure: ["Suspend spring on stand", "Note initial length", "Add weights in steps", "Note extension for each weight", "Plot F vs x graph, find k = slope"], formula: "F = kx; k = F/x", viva: ["State Hooke's Law.", "Define spring constant.", "What is elastic limit?", "Why graph passes through origin?", "Unit of spring constant?"] },
  { id: "p5", subject: "Physics", title: "Boyle's Law — P-V Relationship", apparatus: ["Boyle's law apparatus", "Mercury", "Meter scale"], procedure: ["Note atmospheric pressure", "Measure mercury column heights", "Calculate pressure P = P₀ + h", "Measure volume V of trapped gas", "Verify P×V = constant"], formula: "P₁V₁ = P₂V₂ (constant temperature)", viva: ["State Boyle's Law.", "What is isothermal process?", "Why temperature must be constant?", "Unit of pressure?", "Define absolute pressure."] },
  { id: "p6", subject: "Physics", title: "Ohm's Law — V-I Relationship", apparatus: ["Resistor", "Voltmeter", "Ammeter", "Battery", "Rheostat"], procedure: ["Connect circuit: battery, rheostat, resistor, ammeter in series; voltmeter parallel to resistor", "Vary voltage using rheostat", "Note V and I readings", "Plot V vs I graph", "Find R = slope"], formula: "V = IR; R = V/I", viva: ["State Ohm's Law.", "Define resistance.", "Why rheostat is used?", "Unit of resistance?", "What is ohmic device?"] },
  { id: "p7", subject: "Physics", title: "Meter Bridge — Find Unknown Resistance", apparatus: ["Meter bridge", "Known resistance", "Unknown resistance", "Galvanometer", "Jockey"], procedure: ["Connect known resistance S in one gap, unknown X in other", "Find null point", "Calculate X = R(l₁/l₂)", "Interchange gaps and repeat", "Take mean"], formula: "X = R × (l₁ / (100 - l₁))", viva: ["What is meter bridge?", "Principle of meter bridge?", "Define null point.", "Why gaps are interchanged?", "What is end error?"] },
  { id: "p8", subject: "Physics", title: "Galvanometer to Ammeter/Voltmeter", apparatus: ["Galvanometer", "Shunt resistance", "Series resistance", "Battery", "Ammeter/Voltmeter"], procedure: ["Find galvanometer resistance G and figure of merit k", "For ammeter: connect shunt S = G/(n-1) in parallel", "For voltmeter: connect series R = (n-1)G in series", "Verify readings with standard instruments"], formula: "S = IG/(I-IG); R = (V/IG) - G", viva: ["What is figure of merit?", "Define shunt resistance.", "Why shunt is in parallel for ammeter?", "Why series resistance for voltmeter?", "What is resistance of ideal ammeter?"] },
  { id: "p9", subject: "Physics", title: "Refraction through Glass Slab", apparatus: ["Glass slab", "Drawing board", "Pins", "Protractor", "Sheet"], procedure: ["Place glass slab on paper, trace outline", "Fix two pins on one side", "Look from other side, fix two more pins", "Remove slab and pins, draw rays", "Measure angle of incidence and refraction, find n = sin(i)/sin(r)"], formula: "n = sin(i) / sin(r); n = c/v", viva: ["State Snell's Law.", "Define refractive index.", "What is lateral displacement?", "Why pins are placed 5cm apart?", "Define critical angle."] },
  { id: "p10", subject: "Physics", title: "Inclined Plane — Friction Coefficient", apparatus: ["Inclined plane", "Block", "Protractor"], procedure: ["Place block on inclined plane", "Slowly increase angle", "Note angle θ when block just starts sliding", "Calculate μ = tan(θ)", "Repeat for different surfaces"], formula: "μ = tan(θ) at angle of repose", viva: ["Define angle of repose.", "What is coefficient of friction?", "State laws of friction.", "Why block slides at angle of repose?", "Does friction depend on area?"] },
  { id: "c1", subject: "Chemistry", title: "Acid-Base Titration", apparatus: ["Burette", "Pipette", "Conical flask", "NaOH solution", "HCl solution", "Phenolphthalein"], procedure: ["Fill burette with HCl", "Pipette 25mL NaOH into flask", "Add 2-3 drops phenolphthalein (pink)", "Titrate with HCl until colorless", "Note burette reading, repeat 3 times"], formula: "N₁V₁ = N₂V₂; Normality = (Volume × N) / Volume taken", viva: ["What is titration?", "Define endpoint.", "Why phenolphthalein is used?", "What is indicator?", "Define molarity vs normality."] },
  { id: "c2", subject: "Chemistry", title: "Redox Titration — KMnO₄ vs Oxalic Acid", apparatus: ["Burette", "Pipette", "Conical flask", "KMnO₄ solution", "Oxalic acid", "Dilute H₂SO₄"], procedure: ["Fill burette with KMnO₄", "Pipette oxalic acid + dilute H₂SO₄ into flask", "Warm to 60-70°C", "Titrate with KMnO₄ until permanent pink", "Note reading, repeat"], formula: "2KMnO₄ + 5H₂C₂O₄ + 3H₂SO₄ → K₂SO₄ + 2MnSO₄ + 10CO₂ + 8H₂O", viva: ["Why KMnO₄ is self-indicator?", "Why solution is warmed?", "Why dilute H₂SO₄ is used?", "What is redox reaction?", "Define oxidizing agent."] },
  { id: "c3", subject: "Chemistry", title: "Salt Analysis — Cation & Anion", apparatus: ["Salt sample", "Dilute HCl", "Dilute HNO₃", "BaCl₂", "AgNO₃", "Test tubes", "Bunsen burner"], procedure: ["Perform dry tests (flame test)", "Perform wet tests for cations (Group I-V)", "Perform acid tests for anions", "Confirm with specific reagents", "Record observations and identify salt"], formula: "Salt = Cation + Anion (identified through group analysis)", viva: ["What is flame test?", "Define group reagent.", "What is dry test vs wet test?", "How to test for NH₄⁺?", "What is confirmatory test?"] },
  { id: "c4", subject: "Chemistry", title: "Molar Mass by Colligative Properties", apparatus: ["Beckmann thermometer", "Solvent", "Solute", "Test tube", "Beaker"], procedure: ["Measure freezing point of pure solvent", "Add known mass of solute", "Measure freezing point of solution", "Calculate ΔTf", "Find molar mass M = (Kf × w × 1000) / (ΔTf × W)"], formula: "ΔTf = Kf × m; M = (Kf × w × 1000) / (ΔTf × W)", viva: ["Define colligative properties.", "What is Kf?", "State Raoult's Law.", "Define molality.", "Why freezing point depression?"] },
  { id: "c5", subject: "Chemistry", title: "pH Determination", apparatus: ["pH meter", "Buffer solutions", "Sample solutions", "Beakers", "Wash bottle"], procedure: ["Calibrate pH meter with buffer (pH 4, 7, 10)", "Rinse electrode with distilled water", "Dip electrode in sample solution", "Note pH reading", "Repeat for all samples"], formula: "pH = -log[H⁺]; pOH = 14 - pH", viva: ["Define pH.", "What is buffer solution?", "Range of pH scale?", "Define acidic, basic, neutral.", "What is ionic product of water?"] },
  { id: "c6", subject: "Chemistry", title: "Conductivity of Solutions", apparatus: ["Conductivity meter", "Beakers", "NaCl, KCl, CH₃COOH solutions", "Distilled water"], procedure: ["Calibrate conductivity cell", "Measure conductivity of distilled water", "Measure strong electrolyte (NaCl)", "Measure weak electrolyte (CH₃COOH)", "Compare and tabulate"], formula: "κ = G × (l/A); Λm = κ × 1000 / c", viva: ["Define conductivity.", "What is molar conductivity?", "Difference between strong and weak electrolyte?", "What is cell constant?", "Define Kohlrausch's Law."] },
  { id: "c7", subject: "Chemistry", title: "Rate of Reaction", apparatus: ["Sodium thiosulphate", "Dilute HCl", "Stopwatch", "Conical flask", "White paper with cross mark"], procedure: ["Mark cross on white paper, place flask on top", "Add Na₂S₂O₃ to flask", "Add HCl and start stopwatch", "Note time when cross disappears", "Repeat at different concentrations, calculate rate = 1/t"], formula: "Rate = 1/time; Na₂S₂O₃ + 2HCl → 2NaCl + S + SO₂ + H₂O", viva: ["Define rate of reaction.", "Why cross disappears?", "What is order of reaction?", "Factors affecting rate?", "Define rate constant."] },
  { id: "c8", subject: "Chemistry", title: "Paper Chromatography", apparatus: ["Whatman filter paper", "Ink/dye mixture", "Solvent (water/alcohol)", "Beaker", "Capillary tube"], procedure: ["Draw baseline on filter paper", "Spot ink sample at center", "Suspend paper in solvent in beaker", "Allow solvent to rise by capillary action", "Calculate Rf = distance moved by spot / distance moved by solvent"], formula: "Rf = (distance traveled by component) / (distance traveled by solvent)", viva: ["Define chromatography.", "What is Rf value?", "Define stationary and mobile phase.", "Types of chromatography?", "Why Rf is always < 1?"] },
  // ===== Computer Science Practicals (Python) =====
  { id: "cs1", subject: "Computer Science", title: "Python Basics — Input, Output & Data Types", apparatus: ["Python 3.x installed", "IDLE / VS Code", "Terminal"], procedure: ["Open Python IDLE or VS Code", "Write a program that takes name and age as input", "Print a greeting using f-strings", "Check the type of each variable using type()", "Convert age to float and print"], formula: "input() → str; type(x) → type; int(x), float(x), str(x) → conversions", viva: ["What is a variable in Python?", "Difference between int and float?", "What does input() return by default?", "What is dynamic typing?", "What is f-string formatting?"] },
  { id: "cs2", subject: "Computer Science", title: "Conditional & Iterative Statements", apparatus: ["Python 3.x", "IDLE / VS Code"], procedure: ["Write a program to check if a number is prime using for-else", "Use a while loop to print the Fibonacci series up to n terms", "Use nested loops to print a multiplication table", "Demonstrate break and continue", "Test edge cases (n=0, n=1, negative)"], formula: "for var in range(start, stop, step): ...; while condition: ...; for-else: else runs if no break", viva: ["Difference between for and while loop?", "What does range(2, 10, 2) return?", "Explain the for-else construct.", "What is an infinite loop?", "Difference between break and continue?"] },
  { id: "cs3", subject: "Computer Science", title: "String Manipulation", apparatus: ["Python 3.x", "IDLE / VS Code"], procedure: ["Take a sentence as input", "Count vowels, consonants, words", "Reverse the string using slicing [::-1]", "Check if the string is a palindrome", "Use split(), join(), upper(), lower() methods"], formula: "len(s); s[i:j:k]; s.split(sep); sep.join(list); s.upper(), s.lower(), s.replace(a,b)", viva: ["What is string slicing?", "Difference between split() and join()?", "Are strings mutable in Python?", "What is the time complexity of len(s)?", "What does s[::-1] do?"] },
  { id: "cs4", subject: "Computer Science", title: "List & Tuple Operations", apparatus: ["Python 3.x", "IDLE / VS Code"], procedure: ["Create a list of 10 numbers", "Use list comprehension to filter evens", "Sort the list in descending order using sorted()", "Create a tuple of the same numbers", "Demonstrate that tuples are immutable (try to modify)"], formula: "[expr for x in iterable if cond]; sorted(list, reverse=True); tuple(iterable); list.append, list.remove, list.pop", viva: ["Difference between list and tuple?", "What is list comprehension?", "Why are tuples immutable?", "What does list.append() return?", "Time complexity of list indexing?"] },
  { id: "cs5", subject: "Computer Science", title: "Dictionary Operations", apparatus: ["Python 3.x", "IDLE / VS Code"], procedure: ["Create a dictionary mapping student names to marks", "Add a new entry and update an existing one", "Use .get(), .keys(), .values(), .items()", "Iterate using items() and compute the average", "Sort the dictionary by value using sorted(d, key=)"], formula: "d[key]; d.get(key, default); d.keys(); d.values(); d.items(); sorted(d.items(), key=lambda x: x[1])", viva: ["What is a dictionary in Python?", "Difference between dict and list?", "What is the time complexity of d[k]?", "What does .get() return if key not found?", "Are dictionaries ordered in Python 3.7+?"] },
  { id: "cs6", subject: "Computer Science", title: "Functions & Recursion", apparatus: ["Python 3.x", "IDLE / VS Code"], procedure: ["Define a function factorial(n) using iteration", "Define a recursive version factorial_rec(n)", "Define a function is_prime(n) returning bool", "Write a function with default arguments and *args", "Test all functions with edge cases"], formula: "def name(params): ...; return value; default args: def f(a, b=10); recursion: f(n-1) inside f(n)", viva: ["What is recursion?", "What is a base case?", "Difference between arguments and parameters?", "What are default arguments?", "What is *args in Python?"] },
  { id: "cs7", subject: "Computer Science", title: "File Handling — Read, Write, Append", apparatus: ["Python 3.x", "IDLE / VS Code", "A sample text file"], procedure: ["Open a file in write mode and write 5 lines", "Open the same file in read mode and print contents", "Count lines, words, and characters", "Append a new line using 'a' mode", "Use 'with open(...)' context manager throughout"], formula: "open(path, mode); modes: 'r','w','a','r+','rb','wb'; with open(...) as f: ...", viva: ["Difference between 'w' and 'a' mode?", "Why use 'with open'?", "What does readline() return at EOF?", "What is a context manager?", "How to read a binary file?"] },
  { id: "cs8", subject: "Computer Science", title: "Modules — math, random, statistics", apparatus: ["Python 3.x", "IDLE / VS Code"], procedure: ["Import math and compute sqrt, factorial, gcd", "Import random and generate 10 random integers", "Use statistics.mean, median, mode on a list", "Create your own module mymath.py with a function", "Import your module in another file and use it"], formula: "import math; math.sqrt(x); import random; random.randint(a,b); import statistics; statistics.mean(list)", viva: ["What is a module in Python?", "Difference between import and from...import?", "What is __name__ == '__main__'?", "What does random.seed() do?", "Name 5 built-in Python modules."] },
];

interface VivaQA { q: string; a: string; }

export function PracticalsView() {
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const { name } = useUserName();
  const [tab, setTab] = useState<"Physics" | "Chemistry" | "Computer Science" | "Viva Prep" | "Lab Record">("Physics");
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedExp, setSelectedExp] = useState<Experiment | null>(null);
  const [vivaQA, setVivaQA] = useState<VivaQA[] | null>(null);
  const [vivaLoading, setVivaLoading] = useState(false);

  useEffect(() => {
    const s = profileGetJSON<string[]>(scholarClass, "pr-completed", []);
    if (Array.isArray(s)) setCompleted(s);
  }, [scholarClass]);

  const toggleComplete = (id: string, title: string) => {
    const isDone = completed.includes(id);
    const next = isDone ? completed.filter((x) => x !== id) : [...completed, id];
    setCompleted(next);
    profileSetJSON(scholarClass, "pr-completed", next);
    if (!isDone) { addXP(10); pushActivity({ type: "practical", text: `Completed: ${title}`, icon: "🧪" }); toast.success("Experiment completed · +10 XP"); }
  };

  const generateViva = async (exp: Experiment) => {
    setSelectedExp(exp); setVivaLoading(true); setVivaQA(null);
    try {
      const r = await askAIJSON<{ questions: VivaQA[] }>(`Generate 5 viva questions with detailed answers for the CBSE Class 11 practical: "${exp.title}" (${exp.subject}). Key topics: ${exp.viva.join(", ")}. JSON: {questions:[{q,a}]}`, "default");
      setVivaQA(r?.questions ?? null);
    } catch { toast.error("Failed to generate viva"); }
    finally { setVivaLoading(false); }
  };

  const exportLabRecord = () => {
    const md = `# Practical Lab Record\n\n**Student:** ${name} | **Class:** 11 CBSE (PCM + Computer Science)\n\n## Completed Experiments\n\n${EXPERIMENTS.filter(e => completed.includes(e.id)).map((e, i) => `### ${i+1}. ${e.title}\n**Subject:** ${e.subject}\n**Formula:** ${e.formula}\n**Apparatus:** ${e.apparatus.join(", ")}\n\n**Procedure:**\n${e.procedure.map((p, j) => `${j+1}. ${p}`).join("\n")}\n\n**Viva Questions:**\n${e.viva.map((v, j) => `Q${j+1}. ${v}`).join("\n")}\n`).join("\n---\n\n") || "No experiments completed yet."}`;
    exportPDF({ title: "Practical Lab Record", subtitle: "Class 11 CBSE — PCM + Computer Science", bodyHtml: mdToHtml(md), accent: "#10b981", scholarClass });
    toast.success("Opening lab record PDF…");
  };

  const filtered = tab === "Physics" ? EXPERIMENTS.filter(e => e.subject === "Physics") : tab === "Chemistry" ? EXPERIMENTS.filter(e => e.subject === "Chemistry") : tab === "Computer Science" ? EXPERIMENTS.filter(e => e.subject === "Computer Science") : EXPERIMENTS;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap'); .pr-glass { background:rgba(255,255,255,0.04); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.12); border-radius:1rem; } .pr-glass-strong { background:rgba(255,255,255,0.07); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.16); border-radius:1rem; } .pr-serif { font-family:'Instrument Serif',serif; font-style:italic; }`}</style>
      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0"><source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4" type="video/mp4" /></video>
      <div className="absolute inset-0 z-0 bg-black/55" />
      <div className="relative z-10 p-4 md:p-8 text-white">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Class 11 • PCM + CS Practical Lab</p>
            <h1 className="pr-serif text-4xl md:text-5xl text-white leading-tight">Practical Lab</h1>
            <p className="text-sm text-white/50 mt-2">Complete CBSE Class 11 practical experiments with viva preparation.</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[{ label: "Experiments", value: EXPERIMENTS.length }, { label: "Completed", value: completed.length }, { label: "Physics", value: EXPERIMENTS.filter(e=>e.subject==="Physics").length }, { label: "Chemistry", value: EXPERIMENTS.filter(e=>e.subject==="Chemistry").length }, { label: "CS", value: EXPERIMENTS.filter(e=>e.subject==="Computer Science").length }].map((s, i) => (
              <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1*i }} className="pr-glass p-3 text-center"><p className="text-2xl font-bold">{s.value}</p><p className="text-[10px] text-white/50 uppercase tracking-wide">{s.label}</p></motion.div>
            ))}
          </div>
          <div className="flex gap-2 mb-6 flex-wrap">
            {(["Physics", "Chemistry", "Computer Science", "Viva Prep", "Lab Record"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab===t?"pr-glass-strong text-white":"pr-glass text-white/60 hover:text-white"}`}>{t}</button>
            ))}
          </div>
          {tab === "Viva Prep" ? (
            <div className="pr-glass p-6">
              <h2 className="text-lg font-semibold mb-4">AI Viva Preparation</h2>
              <p className="text-sm text-white/60 mb-4">Select an experiment to generate viva questions with AI answers:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                {EXPERIMENTS.map(e => <button key={e.id} onClick={() => generateViva(e)} className={`pr-glass p-3 text-left hover:scale-[1.02] transition-transform ${selectedExp?.id===e.id?"ring-2 ring-emerald-400":""}`}><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-white/40">{e.subject}</p></button>)}
              </div>
              {vivaLoading && <div className="flex items-center gap-2 py-4 text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Generating viva questions…</div>}
              {vivaQA && <div className="space-y-3 mt-4">{vivaQA.map((qa, i) => <div key={i} className="pr-glass p-4"><p className="font-medium text-emerald-300">Q{i+1}. {qa.q}</p><p className="text-sm text-white/70 mt-2">{qa.a}</p></div>)}</div>}
            </div>
          ) : tab === "Lab Record" ? (
            <div className="pr-glass p-6 text-center">
              <BookOpen className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Lab Record Book</h2>
              <p className="text-sm text-white/60 mb-4">{completed.length} experiments completed. Export your practical file as PDF.</p>
              <button onClick={exportLabRecord} className="pr-glass-strong px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 mx-auto hover:scale-105 transition-transform"><Download className="h-4 w-4" /> Export Lab Record</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((exp, i) => (
                <motion.div key={exp.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05*i }} className="pr-glass p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1"><span className={`text-[10px] px-2 py-0.5 rounded-full ${exp.subject==="Physics"?"bg-blue-500/20 text-blue-300":exp.subject==="Chemistry"?"bg-emerald-500/20 text-emerald-300":"bg-violet-500/20 text-violet-300"}`}>{exp.subject}</span><h3 className="text-sm font-semibold mt-2">{exp.title}</h3></div>
                    <button onClick={() => toggleComplete(exp.id, exp.title)} className="shrink-0 ml-2">{completed.includes(exp.id)?<CheckCircle2 className="h-5 w-5 text-emerald-400"/>:<Circle className="h-5 w-5 text-white/30"/>}</button>
                  </div>
                  <details className="mt-2"><summary className="text-xs text-white/50 cursor-pointer hover:text-white">View details</summary>
                    <div className="mt-3 space-y-3 text-xs">
                      <div><p className="font-medium text-white/70 mb-1">Apparatus:</p><p className="text-white/50">{exp.apparatus.join(", ")}</p></div>
                      <div><p className="font-medium text-white/70 mb-1">Procedure:</p><ol className="text-white/50 space-y-1">{exp.procedure.map((p,j)=><li key={j}>{j+1}. {p}</li>)}</ol></div>
                      <div className="pr-glass p-2"><p className="font-mono text-emerald-300">{exp.formula}</p></div>
                      <div><p className="font-medium text-white/70 mb-1">Viva Questions:</p><ul className="text-white/50 space-y-0.5">{exp.viva.map((v,j)=><li key={j}>• {v}</li>)}</ul></div>
                      <button onClick={() => { setTab("Viva Prep"); generateViva(exp); }} className="pr-glass-strong px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 mt-2"><Sparkles className="h-3 w-3" /> AI Viva Prep</button>
                    </div>
                  </details>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default PracticalsView;
