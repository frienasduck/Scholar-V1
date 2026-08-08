"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { askAI } from "@/lib/ai";
import { toast } from "@/lib/notifications/notification-api";
import { Play, Loader2, Sparkles, BookOpen, ChevronRight, Terminal, Square, AlertCircle } from "lucide-react";

interface Lesson { id: string; title: string; desc: string; code: string; expected: string; }

const LESSONS: Lesson[] = [
  { id: "basics", title: "Python Basics", desc: "Print, variables, input", code: 'print("Hello, World!")\nname = "Student"\nprint("Welcome", name)\nage = 16\nprint("Age:", age)', expected: "Hello, World!\nWelcome Student\nAge: 16" },
  { id: "operators", title: "Operators & Expressions", desc: "Arithmetic, comparison, logical", code: 'a = 10\nb = 3\nprint("Sum:", a + b)\nprint("Division:", a / b)\nprint("Floor div:", a // b)\nprint("Power:", a ** b)\nprint("Modulo:", a % b)', expected: "Sum: 13\nDivision: 3.3333333333333335\nFloor div: 3\nPower: 1000\nModulo: 1" },
  { id: "control", title: "Control Flow", desc: "if/elif/else statements", code: 'score = 85\nif score >= 90:\n    print("Grade A")\nelif score >= 80:\n    print("Grade B")\nelif score >= 70:\n    print("Grade C")\nelse:\n    print("Grade D")', expected: "Grade B" },
  { id: "loops", title: "Loops", desc: "for and while loops", code: 'for i in range(5):\n    print("Iteration", i)\n\ncount = 0\nwhile count < 3:\n    print("Count:", count)\n    count += 1', expected: "Iteration 0\nIteration 1\nIteration 2\nIteration 3\nIteration 4\nCount: 0\nCount: 1\nCount: 2" },
  { id: "functions", title: "Functions", desc: "Define and call functions", code: 'def greet(name):\n    return "Hello, " + name + "!"\n\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(greet("Student"))\nprint("Factorial of 5:", factorial(5))', expected: "Hello, Student!\nFactorial of 5: 120" },
  { id: "strings", title: "Strings", desc: "String operations and methods", code: 'text = "Class 11 CBSE"\nprint("Length:", len(text))\nprint("Upper:", text.upper())\nprint("Lower:", text.lower())\nprint("Split:", text.split())\nprint("Replace:", text.replace("11", "Twelve"))\nprint("Slice:", text[0:5])', expected: "Length: 13\nUpper: CLASS 11 CBSE\nLower: class 11 cbse\nSplit: ['Class', '11', 'CBSE']\nReplace: Class Twelve CBSE\nSlice: Class" },
  { id: "lists", title: "Lists", desc: "List creation and operations", code: 'numbers = [10, 20, 30, 40, 50]\nprint("List:", numbers)\nprint("Length:", len(numbers))\nprint("Sum:", sum(numbers))\nprint("Max:", max(numbers))\nprint("Min:", min(numbers))\nnumbers.append(60)\nprint("After append:", numbers)\nprint("Sorted:", sorted(numbers, reverse=True))', expected: "List: [10, 20, 30, 40, 50]\nLength: 5\nSum: 150\nMax: 50\nMin: 10\nAfter append: [10, 20, 30, 40, 50, 60]\nSorted: [60, 50, 40, 30, 20, 10]" },
];

const SNIPPETS = [
  { title: "Hello World", code: 'print("Hello, World!")' },
  { title: "Sum of Two Numbers", code: 'a = 5\nb = 10\nprint("Sum:", a + b)' },
  { title: "Even or Odd", code: 'n = 7\nif n % 2 == 0:\n    print(n, "is even")\nelse:\n    print(n, "is odd")' },
  { title: "Fibonacci Series", code: 'n = 10\na, b = 0, 1\nfor i in range(n):\n    print(a, end=" ")\n    a, b = b, a + b' },
  { title: "Factorial", code: 'n = 5\nfact = 1\nfor i in range(1, n+1):\n    fact *= i\nprint("Factorial:", fact)' },
  { title: "Prime Check", code: 'n = 17\nis_prime = True\nfor i in range(2, n):\n    if n % i == 0:\n        is_prime = False\n        break\nif is_prime:\n    print(n, "is prime")\nelse:\n    print(n, "is not prime")' },
  { title: "Palindrome", code: 'word = "radar"\nif word == word[::-1]:\n    print(word, "is palindrome")\nelse:\n    print(word, "is not palindrome")' },
  { title: "Reverse a String", code: 'text = "Python"\nprint("Reversed:", text[::-1])' },
  { title: "Count Vowels", code: 'text = "Education"\nvowels = "aeiouAEIOU"\ncount = 0\nfor char in text:\n    if char in vowels:\n        count += 1\nprint("Vowels:", count)' },
  { title: "Multiplication Table", code: 'n = 7\nfor i in range(1, 11):\n    print(f"{n} x {i} = {n * i}")' },
  { title: "Bubble Sort", code: 'arr = [64, 34, 25, 12, 22, 11, 90]\nfor i in range(len(arr)):\n    for j in range(0, len(arr)-i-1):\n        if arr[j] > arr[j+1]:\n            arr[j], arr[j+1] = arr[j+1], arr[j]\nprint("Sorted:", arr)' },
  { title: "Linear Search", code: 'arr = [10, 20, 30, 40, 50]\ntarget = 30\nfound = False\nfor i in range(len(arr)):\n    if arr[i] == target:\n        print("Found at index", i)\n        found = True\n        break\nif not found:\n    print("Not found")' },
  { title: "ASCII Value", code: 'char = "A"\nprint("ASCII of", char, "is", ord(char))' },
  { title: "Simple Calculator", code: 'a = 15\nop = "+" \nb = 5\nif op == "+":\n    print(a + b)\nelif op == "-":\n    print(a - b)\nelif op == "*":\n    print(a * b)\nelif op == "/":\n    print(a / b)' },
  { title: "Sum of Digits", code: 'n = 12345\ntotal = 0\nwhile n > 0:\n    total += n % 10\n    n = n // 10\nprint("Sum of digits:", total)' },
  { title: "GCD", code: 'a = 48\nb = 18\nwhile b:\n    a, b = b, a % b\nprint("GCD:", a)' },
  { title: "Leap Year", code: 'year = 2024\nif (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):\n    print(year, "is a leap year")\nelse:\n    print(year, "is not a leap year")' },
  { title: "Swapping", code: 'a = 5\nb = 10\na, b = b, a\nprint("a =", a, "b =", b)' },
  { title: "List Comprehension", code: 'squares = [x**2 for x in range(1, 6)]\nprint("Squares:", squares)\nevens = [x for x in range(20) if x % 2 == 0]\nprint("Evens:", evens)' },
  { title: "Dictionary", code: 'student = {"name": "Student", "class": 11, "subjects": ["Physics", "Chemistry", "Maths"]}\nprint("Name:", student["name"])\nprint("Subjects:", student["subjects"])\nfor key, value in student.items():\n    print(key, ":", value)' },
];

/* ------------------------------------------------------------------ */
/* Pyodide runtime integration                                         */
/* ------------------------------------------------------------------ */

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
const RUN_TIMEOUT_MS = 10000;

// Module-level cache so the runtime survives re-renders / re-mounts.
let pyodideReadyPromise: Promise<any> | null = null;

async function loadPyodideOnce(): Promise<any> {
  if (pyodideReadyPromise) return pyodideReadyPromise;

  const promise = (async () => {
    // Inject the Pyodide loader script (idempotent).
    if (!(window as any).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${PYODIDE_CDN}"]`,
        );
        if (existing) {
          // Script tag exists but loadPyodide isn't ready yet — wait for it.
          if ((window as any).loadPyodide) return resolve();
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () =>
            reject(
              new Error(
                "Failed to load Pyodide from CDN. Please check your internet connection and try again.",
              ),
            ),
          );
          return;
        }
        const script = document.createElement("script");
        script.src = PYODIDE_CDN;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(
            new Error(
              "Failed to load Pyodide from CDN. Please check your internet connection and try again.",
            ),
          );
        document.head.appendChild(script);
      });
    }

    // Boot the interpreter.
    const py = await (window as any).loadPyodide();
    return py;
  })();

  pyodideReadyPromise = promise;

  // If loading fails, clear the cache so a subsequent Run can retry
  // instead of permanently rejecting.
  promise.catch(() => {
    if (pyodideReadyPromise === promise) pyodideReadyPromise = null;
  });

  return promise;
}

interface RunOptions {
  /** A promise that rejects to abort execution early (Stop button). */
  stopSignal?: Promise<never>;
  /** Called once the Pyodide runtime is ready and before code executes. */
  onReady?: () => void;
}

/**
 * Execute Python `code` in the shared Pyodide instance and return everything
 * written to stdout / stderr (including tracebacks). Execution is bounded by
 * a 10-second timeout and an optional stop signal.
 */
async function runPythonCode(
  code: string,
  opts: RunOptions = {},
): Promise<string> {
  const py = await loadPyodideOnce();
  opts.onReady?.();

  let output = "";

  // Redirect Python stdout / stderr into our buffer. Pyodide's `batched`
  // callback is invoked with strings that already include their trailing
  // newline (it flushes on `\n`), so we append verbatim — this makes
  // `for i in range(5): print(i)` produce `0\n1\n2\n3\n4\n` exactly.
  py.setStdout({ batched: (s: string) => { output += s; } });
  py.setStderr({ batched: (s: string) => { output += s; } });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            "Execution timed out after 10 seconds. Your code may contain an infinite loop. Very long or infinite programs may require refreshing the page.",
          ),
        ),
      RUN_TIMEOUT_MS,
    );
  });

  // Capture any exception from the Python side without rejecting the race
  // prematurely (so a timeout / stop still wins). We render it into the
  // output after the race rather than throwing.
  let execError: unknown = null;
  const execPromise = py.runPythonAsync(code).catch((e: unknown) => {
    execError = e;
  });

  const racers: Promise<unknown>[] = [execPromise, timeoutPromise];
  if (opts.stopSignal) racers.push(opts.stopSignal);

  let raceError: unknown = null;
  try {
    await Promise.race(racers);
  } catch (e) {
    // timeout or stop signal — the runtime itself is still healthy.
    raceError = e;
  }

  const append = (msg: string, prefix = "") => {
    output += output && !output.endsWith("\n") ? "\n" : "";
    output += prefix + msg;
  };

  if (raceError) {
    append((raceError as any)?.message || String(raceError), "[Aborted] ");
  } else if (execError) {
    append((execError as any)?.message || String(execError));
  }
  return output;
}

/* ------------------------------------------------------------------ */
/* View component                                                      */
/* ------------------------------------------------------------------ */

type PyodideStatus = "idle" | "loading" | "ready" | "error";

export function PythonView() {
  const addXP = useStore((s) => s.addXP);
  const [code, setCode] = useState('print("Hello, World!")');
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [pyodideStatus, setPyodideStatus] = useState<PyodideStatus>("idle");
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  // Holds the reject fn for the current run's stop signal, if any.
  const stopRejectRef = useRef<((err: Error) => void) | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("py-code");
      if (s) setCode(s);
    } catch {
      /* ignore */
    }
  }, []);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setOutput("");
    try {
      localStorage.setItem("py-code", code);
    } catch {
      /* ignore */
    }

    // Wire up the stop signal for this run.
    let stopReject: (err: Error) => void = () => {};
    const stopSignal = new Promise<never>((_, reject) => {
      stopReject = reject;
    });
    stopRejectRef.current = stopReject;

    if (pyodideStatus === "idle" || pyodideStatus === "error") {
      setPyodideStatus("loading");
    }

    try {
      const result = await runPythonCode(code, {
        stopSignal,
        onReady: () => setPyodideStatus("ready"),
      });
      setOutput(result || "(no output)");
      addXP(3);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setOutput(`Failed to run code.\n${msg}`);
      setPyodideStatus("error");
      toast.error("Python runtime error", { description: msg });
    } finally {
      setRunning(false);
      stopRejectRef.current = null;
    }
  }, [code, addXP, running, pyodideStatus]);

  const stop = useCallback(() => {
    if (stopRejectRef.current) {
      stopRejectRef.current(new Error("Execution stopped by user."));
    }
  }, []);

  const explainCode = async () => {
    setExplaining(true);
    setExplanation(null);
    try {
      const r = await askAI(
        `Explain this Python code step by step for a Class 11 student. Use markdown.\n\nCode:\n\`\`\`python\n${code}\n\`\`\``,
        "cs-11",
      );
      setExplanation(r);
    } catch (e: any) {
      toast.error("Failed to explain", { description: e?.message });
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap'); .py-glass { background:rgba(255,255,255,0.04); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.12); border-radius:1rem; } .py-glass-strong { background:rgba(255,255,255,0.07); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.16); border-radius:1rem; } .py-serif { font-family:'Instrument Serif',serif; font-style:italic; } .py-mono { font-family:'Courier New',monospace; }`}</style>
      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />
      <div className="relative z-10 p-4 md:p-8 text-white">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-[10px] uppercase tracking-widest text-white/40">Class 11 • Computer Science</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-200">
                <Sparkles className="h-2.5 w-2.5" /> Scholar Plus
              </span>
            </div>
            <h1 className="py-serif text-4xl md:text-5xl text-white leading-tight">Python Workspace</h1>
            <p className="text-sm text-white/50 mt-2">Write, run, and learn Python — powered by a real CPython runtime in your browser.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Editor + Output */}
            <div className="lg:col-span-2 space-y-4">
              <div className="py-glass p-4">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium">Code Editor</span>
                    {pyodideStatus === "ready" && (
                      <span className="ml-2 text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Python ready
                      </span>
                    )}
                    {pyodideStatus === "loading" && (
                      <span className="ml-2 text-[10px] text-amber-400 flex items-center gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        Loading runtime…
                      </span>
                    )}
                    {pyodideStatus === "error" && (
                      <span className="ml-2 text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        Runtime error
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={explainCode}
                      disabled={explaining}
                      className="py-glass px-3 py-1.5 rounded-full text-xs flex items-center gap-1 hover:scale-105 transition-transform disabled:opacity-50"
                    >
                      {explaining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Explain
                    </button>
                    {running && (
                      <button
                        onClick={stop}
                        className="px-3 py-1.5 rounded-full text-xs flex items-center gap-1 hover:scale-105 transition-transform bg-red-500/20 border border-red-500/40 text-red-200"
                        title="Stop execution"
                      >
                        <Square className="h-3 w-3" /> Stop
                      </button>
                    )}
                    <button
                      onClick={run}
                      disabled={running}
                      className="py-glass-strong px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 hover:scale-105 transition-transform disabled:opacity-50"
                    >
                      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run
                    </button>
                  </div>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="py-mono w-full h-64 bg-black/40 text-green-300 p-3 rounded-lg text-sm resize-none outline-none border border-white/10 focus:border-purple-400/50 transition-colors"
                  spellCheck={false}
                  placeholder="# Write Python here…"
                />
              </div>

              <div className="py-glass p-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" /> Output
                </p>
                {running && pyodideStatus !== "ready" ? (
                  // First run — Pyodide is still booting.
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                    <p className="text-sm text-white/70">Initializing Python runtime…</p>
                    <p className="text-[10px] text-white/40 text-center max-w-xs">
                      The first load downloads CPython + the standard library (~10&nbsp;MB) and takes 5–10 seconds. Subsequent runs are instant.
                    </p>
                  </div>
                ) : running ? (
                  // Runtime is ready, code is executing.
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span className="text-sm text-white/50">Executing…</span>
                  </div>
                ) : (
                  <pre className="py-mono text-sm text-emerald-300 min-h-[80px] whitespace-pre-wrap">
                    {output || "(click Run to execute)"}
                  </pre>
                )}
              </div>

              {explanation && (
                <div className="py-glass p-4">
                  <p className="text-sm font-medium mb-2 text-purple-300">AI Explanation</p>
                  <div className="text-sm text-white/70 prose-invert">
                    {explanation.split("\n").map((l, i) => (
                      <p key={i} className="mb-1">{l}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lessons + Snippets */}
            <div className="space-y-4">
              <div className="py-glass p-4">
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-400" /> Lessons
                </p>
                <div className="space-y-1">
                  {LESSONS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setActiveLesson(l);
                        setCode(l.code);
                        setOutput("");
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        activeLesson?.id === l.id ? "py-glass-strong" : "hover:bg-white/5"
                      }`}
                    >
                      <p className="font-medium">{l.title}</p>
                      <p className="text-white/40 text-[10px]">{l.desc}</p>
                    </button>
                  ))}
                </div>
                {activeLesson && (
                  <div className="mt-3 py-glass p-3">
                    <p className="text-xs text-white/60 mb-1">Expected output:</p>
                    <pre className="py-mono text-[11px] text-emerald-300 whitespace-pre-wrap">
                      {activeLesson.expected}
                    </pre>
                  </div>
                )}
              </div>
              <div className="py-glass p-4">
                <p className="text-sm font-medium mb-3">Snippets</p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {SNIPPETS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setCode(s.code)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <ChevronRight className="h-3 w-3 text-white/30" /> {s.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PythonView;
