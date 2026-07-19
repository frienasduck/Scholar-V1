"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { CURRICULUM } from "@/lib/curriculum";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { StatCard, EmptyState, ProgressRing } from "@/lib/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ClipboardList, Clock, CheckCircle2, AlertCircle, Sparkles, Plus, Download,
  Calendar, ChevronLeft, ChevronRight, BookOpen, Brain, Trophy, Zap, Save,
  Send, ListChecks, Filter, X, Award, CalendarDays, Flame,
} from "lucide-react";

// ============================================================================
// Assignment Center — Scholar
// ============================================================================

type AssignmentStatus = "pending" | "draft" | "submitted" | "graded";

interface AssignmentQuestion {
  id: string;
  type: "mcq" | "short" | "long";
  question: string;
  options?: string[];
  modelAnswer: string;
  marks: number;
}

interface Assignment {
  id: string;
  title: string;
  subject: string;
  chapter?: string;
  description: string;
  dueAt: number;          // ms timestamp
  totalMarks: number;
  questions: AssignmentQuestion[];
  status: AssignmentStatus;
  answers: Record<string, string>;       // questionId -> student answer
  aiFeedback?: {
    perQuestion: { questionId: string; marks: number; maxMarks: number; feedback: string }[];
    totalMarks: number;
    grade: string;
    overallFeedback: string;
    strengths: string[];
    improvements: string[];
    checkedAt: number;
  };
  createdAt: number;
  submittedAt?: number;
  source: "system" | "custom";
}

// ============================================================================
// Seed: 10 assignments
// ============================================================================
const now = Date.now();
const dayMs = 86_400_000;
function seedAssignments(): Assignment[] {
  return [
    {
      id: "asg-1", title: "Algebra Identities Worksheet",
      subject: "maths", chapter: "m2",
      description: "Solve all 4 questions on polynomial identities. Show full working.",
      dueAt: now + 2 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "Expand (x + 7)(x + 7) using identity.",
          options: ["x² + 14x + 49", "x² + 7x + 49", "x² + 14x + 7", "x² + 49"],
          modelAnswer: "x² + 14x + 49 — Using (a+b)² = a² + 2ab + b² with a=x, b=7: x² + 2(x)(7) + 7² = x² + 14x + 49.",
          marks: 2 },
        { id: "q2", type: "short", question: "Factorise: x² - 9.",
          modelAnswer: "x² - 9 = (x)² - (3)² = (x + 3)(x - 3). Using the identity a² - b² = (a+b)(a-b).",
          marks: 3 },
        { id: "q3", type: "long", question: "Evaluate 103 × 97 using a suitable identity, showing all steps.",
          modelAnswer: "103 × 97 = (100 + 3)(100 - 3) = 100² - 3² (using a² - b² = (a+b)(a-b)) = 10000 - 9 = 9991.",
          marks: 5 },
        { id: "q4", type: "long", question: "If x + 1/x = 5, find x² + 1/x² and x³ + 1/x³.",
          modelAnswer: "x² + 1/x² = (x + 1/x)² - 2 = 25 - 2 = 23. x³ + 1/x³ = (x + 1/x)³ - 3(x + 1/x) = 125 - 15 = 110.",
          marks: 10 },
      ],
      status: "pending", answers: {}, createdAt: now - 3 * dayMs, source: "system",
    },
    {
      id: "asg-2", title: "Newton's Laws — Numericals",
      subject: "science", chapter: "s2",
      description: "Apply Newton's three laws to solve real-world problems.",
      dueAt: now + 4 * dayMs, totalMarks: 25,
      questions: [
        { id: "q1", type: "mcq", question: "Which law explains why you lurch forward when a car brakes suddenly?",
          options: ["First Law", "Second Law", "Third Law", "None"],
          modelAnswer: "First Law (Law of Inertia) — a body in motion stays in motion unless acted on by an external force. Your body tends to keep moving when the car stops.",
          marks: 2 },
        { id: "q2", type: "short", question: "State Newton's Second Law and write its mathematical form.",
          modelAnswer: "The rate of change of momentum of a body is directly proportional to the applied force and takes place in the direction of the force. F = ma (Force = mass × acceleration).",
          marks: 3 },
        { id: "q3", type: "long", question: "A 1500 kg car accelerates from rest to 20 m/s in 5 s. Find (a) acceleration, (b) force applied, (c) distance covered.",
          modelAnswer: "(a) a = (v - u)/t = (20 - 0)/5 = 4 m/s². (b) F = ma = 1500 × 4 = 6000 N. (c) s = ut + ½at² = 0 + ½(4)(25) = 50 m.",
          marks: 10 },
        { id: "q4", type: "long", question: "Explain why a cricket player pulls his hands backwards while catching a fast ball. Which law applies?",
          modelAnswer: "By pulling his hands back, the player increases the time taken for the ball to stop. From F = Δp/Δt, increasing Δt decreases F (the impulse force on his hands). This is an application of Newton's Second Law.",
          marks: 10 },
      ],
      status: "pending", answers: {}, createdAt: now - 2 * dayMs, source: "system",
    },
    {
      id: "asg-3", title: "French Revolution — Source Analysis",
      subject: "sst", chapter: "h1",
      description: "Read the given primary sources and answer the contextual questions.",
      dueAt: now + 1 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "short", question: "Why was the storming of the Bastille on 14 July 1789 considered a symbolic act?",
          modelAnswer: "The Bastille was a royal fortress and prison — a symbol of the King's absolute and arbitrary power. Its fall represented the people's defiance of royal authority and the start of the Revolution.",
          marks: 5 },
        { id: "q2", type: "long", question: "Explain the three main causes of the French Revolution — social, economic, and political.",
          modelAnswer: "Social: rigid estate system with the Third Estate bearing all taxes. Economic: France bankrupt from wars and lavish spending; bread prices soaring. Political: absolute monarchy, no representation for commoners, Enlightenment ideas inspiring equality.",
          marks: 10 },
        { id: "q3", type: "short", question: "What was the Declaration of the Rights of Man and Citizen (1789)?",
          modelAnswer: "A fundamental document of the French Revolution declaring that 'men are born and remain free and equal in rights'. It established liberty, property, security, and resistance to oppression as natural rights.",
          marks: 5 },
      ],
      status: "pending", answers: {}, createdAt: now - 1 * dayMs, source: "system",
    },
    {
      id: "asg-4", title: "Beehive Ch. 5 — Comprehension",
      subject: "english",
      description: "Answer comprehension questions on 'The Snake and the Mirror'.",
      dueAt: now + 5 * dayMs, totalMarks: 15,
      questions: [
        { id: "q1", type: "mcq", question: "What was the doctor's profession in the story?",
          options: ["Surgeon", "Homeopath", "Cardiologist", "Dentist"],
          modelAnswer: "Homeopath — the narrator was a homeopathic doctor who had just started his practice.",
          marks: 2 },
        { id: "q2", type: "short", question: "Why did the doctor sit in his chair 'as if he was a stone statue'?",
          modelAnswer: "Because a snake had coiled around his arm and he was afraid that any movement would provoke the snake to bite him. He sat still, frozen in fear.",
          marks: 5 },
        { id: "q3", type: "long", question: "Describe the doctor's feelings when the snake looked into the mirror. What does this reveal about him?",
          modelAnswer: "The doctor felt that the snake was admiring its own beauty in the mirror, just as he had been doing moments earlier. This reveals the doctor's vanity and self-love, which the author uses ironically — the snake too seems to share this vanity.",
          marks: 8 },
      ],
      status: "pending", answers: {}, createdAt: now - 4 * dayMs, source: "system",
    },
    {
      id: "asg-5", title: "Tissues — Diagram Labelling",
      subject: "science", chapter: "b2",
      description: "Label the tissue diagrams and explain their functions.",
      dueAt: now + 6 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "short", question: "Differentiate between xylem and phloem in a tabular form.",
          modelAnswer: "Xylem: transports water/minerals, unidirectional (root to leaf), dead cells (tracheids, vessels). Phloem: transports food (sucrose), bidirectional, living cells (sieve tubes, companion cells).",
          marks: 5 },
        { id: "q2", type: "long", question: "Describe the structure and function of neurons (nerve cells).",
          modelAnswer: "Neurons have three parts: (1) Dendrites — short branched fibres that receive impulses; (2) Cell body (cyton) — contains nucleus; (3) Axon — long fibre that transmits impulses away. Function: transmit electrical signals (nerve impulses) rapidly across the body for coordination and response.",
          marks: 10 },
        { id: "q3", type: "short", question: "Where is squamous epithelium found in the human body?",
          modelAnswer: "Squamous epithelium is found in the lining of the mouth, oesophagus, and blood vessels — anywhere a smooth, flat, protective surface is needed.",
          marks: 5 },
      ],
      status: "pending", answers: {}, createdAt: now - 5 * dayMs, source: "system",
    },
    {
      id: "asg-6", title: "Linear Equations — Word Problems",
      subject: "maths", chapter: "m4",
      description: "Translate and solve 4 word problems using linear equations.",
      dueAt: now + 3 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "short", question: "The sum of two numbers is 35 and their difference is 7. Find the numbers.",
          modelAnswer: "Let x + y = 35 and x - y = 7. Adding: 2x = 42, x = 21. y = 35 - 21 = 14. Numbers are 21 and 14.",
          marks: 5 },
        { id: "q2", type: "long", question: "Five years ago, Aarav's age was 3 times his son's age. Ten years from now, his age will be twice his son's. Find their present ages.",
          modelAnswer: "Let son's present age = x. Five years ago: Aarav = 3(x-5), son = (x-5). So Aarav present = 3(x-5) + 5 = 3x - 10. Ten years later: Aarav = 3x, son = x + 10. 3x = 2(x+10), 3x = 2x + 20, x = 20. Son = 20, Aarav = 50.",
          marks: 10 },
        { id: "q3", type: "short", question: "Find two solutions of 2x + 3y = 12.",
          modelAnswer: "If x = 0: 3y = 12, y = 4 → (0, 4). If y = 0: 2x = 12, x = 6 → (6, 0).",
          marks: 5 },
      ],
      status: "pending", answers: {}, createdAt: now - 6 * dayMs, source: "system",
    },
    {
      id: "asg-7", title: "Climate — Long Answer Practice",
      subject: "sst", chapter: "g2",
      description: "Practice 4 long-answer questions on Indian climate.",
      dueAt: now + 7 * dayMs, totalMarks: 24,
      questions: [
        { id: "q1", type: "long", question: "Why is the monsoon considered a 'unifying bond' for India? Explain.",
          modelAnswer: "The monsoon unifies India because its rhythm affects every part of the country — agriculture, economy, culture, festivals, and even literature revolve around it. From Kerala's onset in June to its withdrawal from Rajasthan in September, the entire subcontinent's life cycle is tied to these winds.",
          marks: 6 },
        { id: "q2", type: "long", question: "Explain the mechanism of the monsoon. How does the ITCZ shift?",
          modelAnswer: "The monsoon mechanism involves: (1) Differential heating of land and sea creates low pressure over land; (2) The Inter Tropical Convergence Zone (ITCZ) shifts northward over the Ganga plain in summer; (3) The trade winds from the southeast pick up moisture over the Indian Ocean and blow in as the southwest monsoon; (4) The Himalayas block them, causing heavy rainfall.",
          marks: 8 },
        { id: "q3", type: "long", question: "Describe the four seasons of India.",
          modelAnswer: "(1) Winter (Dec-Feb): cold, dry, low temperature in north. (2) Summer (Mar-May): hot, dry, loo winds. (3) Advancing Monsoon (Jun-Sep): southwest monsoon, heavy rainfall. (4) Retreating Monsoon (Oct-Nov): warm, moist, cyclones in east coast.",
          marks: 6 },
        { id: "q4", type: "short", question: "What is 'Loo'? Where is it experienced?",
          modelAnswer: "The Loo is a hot, dry, dusty wind that blows over northern India in summer (May-June), especially in the afternoons. It can cause heat strokes.",
          marks: 4 },
      ],
      status: "pending", answers: {}, createdAt: now - 7 * dayMs, source: "system",
    },
    {
      id: "asg-8", title: "Atoms & Molecules — Conceptual",
      subject: "science", chapter: "c1",
      description: "Practice mole concept and atomic theory questions.",
      dueAt: now - 1 * dayMs, totalMarks: 18, // overdue
      questions: [
        { id: "q1", type: "mcq", question: "The atomic mass of carbon is 12 u. What is the mass of 1 mole of carbon atoms?",
          options: ["12 g", "1 g", "6 g", "12 mg"],
          modelAnswer: "12 g — 1 mole of any substance has a mass equal to its atomic/molecular mass in grams. So 1 mole of C = 12 g.",
          marks: 2 },
        { id: "q2", type: "short", question: "State the law of constant proportions with an example.",
          modelAnswer: "In a chemical substance, elements are always present in definite proportions by mass. E.g., water (H₂O) always contains hydrogen and oxygen in the ratio 1:8 by mass, regardless of the source.",
          marks: 4 },
        { id: "q3", type: "long", question: "Calculate the number of molecules in 22 g of CO₂. (Atomic masses: C=12, O=16)",
          modelAnswer: "Molar mass of CO₂ = 12 + 2(16) = 44 g/mol. Moles in 22 g = 22/44 = 0.5 mol. Number of molecules = 0.5 × 6.022 × 10²³ = 3.011 × 10²³ molecules.",
          marks: 8 },
        { id: "q4", type: "short", question: "What is an ion? Give one example each of a cation and an anion.",
          modelAnswer: "An ion is a charged particle formed when an atom gains or loses electrons. Cation (positive): Na⁺. Anion (negative): Cl⁻.",
          marks: 4 },
      ],
      status: "pending", answers: {}, createdAt: now - 10 * dayMs, source: "system",
    },
    {
      id: "asg-9", title: "Constitutional Design — Q&A",
      subject: "sst", chapter: "c1",
      description: "Answer questions on the making of the Indian Constitution.",
      dueAt: now + 9 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "short", question: "Who was the Chairman of the Drafting Committee of the Indian Constitution?",
          modelAnswer: "Dr. B.R. Ambedkar was the Chairman of the Drafting Committee. He is often called the 'Father of the Indian Constitution'.",
          marks: 4 },
        { id: "q2", type: "long", question: "Why was the Constitution drafted by the Constituent Assembly acceptable to all? Give 3 reasons.",
          modelAnswer: "(1) The Assembly represented all regions, religions, and communities through elections. (2) It deliberated for nearly 3 years (1946-1949), allowing thorough debate and consensus. (3) The draft borrowed the best features from constitutions worldwide but adapted them to Indian conditions.",
          marks: 8 },
        { id: "q3", type: "long", question: "Explain the meaning of the Preamble's key terms: Sovereign, Socialist, Secular, Democratic, Republic.",
          modelAnswer: "Sovereign: India is free from external control. Socialist: wealth should be distributed equitably. Secular: all religions are equal. Democratic: government is elected by the people. Republic: head of state is an elected person, not a hereditary monarch.",
          marks: 8 },
      ],
      status: "pending", answers: {}, createdAt: now - 8 * dayMs, source: "system",
    },
    {
      id: "asg-10", title: "Lines & Angles — Proofs",
      subject: "maths", chapter: "m6",
      description: "Prove 3 theorems on parallel lines and transversals.",
      dueAt: now + 8 * dayMs, totalMarks: 15,
      questions: [
        { id: "q1", type: "long", question: "Prove that vertically opposite angles are equal.",
          modelAnswer: "Given: Two lines AB and CD intersect at O, forming ∠AOC and ∠BOD (vertically opposite). ∠AOC + ∠AOD = 180° (linear pair). ∠AOD + ∠BOD = 180° (linear pair). So ∠AOC + ∠AOD = ∠AOD + ∠BOD. Subtracting ∠AOD from both sides: ∠AOC = ∠BOD. Hence proved.",
          marks: 5 },
        { id: "q2", type: "long", question: "If a transversal intersects two parallel lines, prove that alternate interior angles are equal.",
          modelAnswer: "Given: l ∥ m cut by transversal t, with ∠3 and ∠5 as alternate interior angles. ∠1 = ∠3 (vertically opposite). ∠1 = ∠5 (corresponding angles, since l ∥ m). From transitivity: ∠3 = ∠5. Hence alternate interior angles are equal. Proved.",
          marks: 5 },
        { id: "q3", type: "long", question: "Prove that the sum of angles of a triangle is 180°.",
          modelAnswer: "Given: △ABC. Through A, draw XY ∥ BC. ∠XAB = ∠ABC (alternate angles). ∠YAC = ∠ACB (alternate angles). ∠XAB + ∠BAC + ∠YAC = 180° (angles on a straight line). Substituting: ∠ABC + ∠BAC + ∠ACB = 180°. Hence proved.",
          marks: 5 },
      ],
      status: "pending", answers: {}, createdAt: now - 9 * dayMs, source: "system",
    },
  ];
}

// ===== Class 11 seed assignments (Physics + Chemistry + Maths + CS + English) =====
function seedAssignmentsClass11(): Assignment[] {
  return [
    {
      id: "c11-asg-1", title: "Kinematics — Equations of Motion",
      subject: "physics", chapter: "p3",
      description: "Solve 4 numericals on uniformly accelerated motion using the kinematic equations.",
      dueAt: now + 2 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "The SI unit of acceleration is:",
          options: ["m/s", "m/s²", "m²/s", "N·s"],
          modelAnswer: "m/s² — acceleration is the rate of change of velocity (m/s) per unit time (s), giving m/s².",
          marks: 2 },
        { id: "q2", type: "short", question: "A ball is thrown vertically upward with 20 m/s. Find the time to reach maximum height (g = 10 m/s²).",
          modelAnswer: "At max height, v = 0. Using v = u + at: 0 = 20 + (-10)t → t = 2 s.",
          marks: 5 },
        { id: "q3", type: "long", question: "A car starts from rest and accelerates uniformly at 2 m/s² for 5 s, then moves with constant velocity for 10 s, then decelerates at 4 m/s² until it stops. Find (a) maximum velocity, (b) total distance covered.",
          modelAnswer: "(a) After 5 s: v = u + at = 0 + 2×5 = 10 m/s. (b) Phase 1: s₁ = ½at² = ½(2)(25) = 25 m. Phase 2: s₂ = v×t = 10×10 = 100 m. Phase 3: deceleration time t₃ = (v-0)/a = 10/4 = 2.5 s; s₃ = v²/(2a) = 100/8 = 12.5 m. Total = 25 + 100 + 12.5 = 137.5 m.",
          marks: 10 },
        { id: "q4", type: "short", question: "Derive v² = u² + 2as from the kinematic equations.",
          modelAnswer: "From v = u + at → t = (v-u)/a. Substitute in s = ut + ½at²: s = u(v-u)/a + ½a(v-u)²/a² = (v²-u²)/(2a). Rearranging: v² = u² + 2as.",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 1 * dayMs, source: "system",
    },
    {
      id: "c11-asg-2", title: "Newton's Laws — Free Body Diagrams",
      subject: "physics", chapter: "p5",
      description: "Draw FBDs and solve 4 problems on Newton's laws of motion.",
      dueAt: now + 3 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "short", question: "A 2 kg block accelerates at 5 m/s² on a frictionless surface. Find the net force.",
          modelAnswer: "F = ma = 2 × 5 = 10 N.",
          marks: 3 },
        { id: "q2", type: "long", question: "Two blocks of mass 3 kg and 2 kg are connected by a string over a frictionless pulley. Find (a) acceleration of the system, (b) tension in the string (g = 10 m/s²).",
          modelAnswer: "This is an Atwood machine. (a) a = (m₁-m₂)g/(m₁+m₂) = (3-2)×10/(3+2) = 2 m/s². (b) For the 2 kg block (going up): T - 2g = 2a → T = 2(10) + 2(2) = 24 N. Verify with 3 kg: 3g - T = 3a → 30 - T = 6 → T = 24 N ✓.",
          marks: 10 },
        { id: "q3", type: "short", question: "State Newton's third law. Give one example.",
          modelAnswer: "For every action, there is an equal and opposite reaction. Example: When a rocket expels gas downward (action), the gas exerts an equal upward force on the rocket (reaction), propelling it forward.",
          marks: 4 },
        { id: "q4", type: "mcq", question: "The unit of impulse is:",
          options: ["N·s", "kg·m/s²", "Joule", "Watt"],
          modelAnswer: "N·s — Impulse = Force × time = N·s. It equals change in momentum (kg·m/s).",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 2 * dayMs, source: "system",
    },
    {
      id: "c11-asg-3", title: "Atomic Structure — Quantum Numbers",
      subject: "chemistry", chapter: "c2",
      description: "Practice 4 questions on quantum numbers and electronic configuration.",
      dueAt: now + 4 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "The maximum number of electrons in a d-subshell is:",
          options: ["2", "6", "10", "14"],
          modelAnswer: "10 — A d-subshell has 5 orbitals (m = -2,-1,0,+1,+2), each holding 2 electrons, so 5×2 = 10 electrons.",
          marks: 2 },
        { id: "q2", type: "short", question: "Write the electronic configuration of sulphur (Z = 16).",
          modelAnswer: "1s² 2s² 2p⁶ 3s² 3p⁴. Sulphur has 16 electrons, distributed as 2+2+6+2+4 = 16.",
          marks: 4 },
        { id: "q3", type: "long", question: "State the four quantum numbers. For the 3d orbital, list all possible values of n, l, and m.",
          modelAnswer: "Four quantum numbers: (1) Principal (n) — energy level; (2) Azimuthal (l) — shape of orbital (0 to n-1); (3) Magnetic (m) — orientation (-l to +l); (4) Spin (s) — ±½. For 3d: n = 3, l = 2 (since d), m = -2, -1, 0, +1, +2 (5 values). Each m value corresponds to one d-orbital; each orbital holds 2 electrons of opposite spin.",
          marks: 10 },
        { id: "q4", type: "short", question: "State Pauli's exclusion principle.",
          modelAnswer: "No two electrons in an atom can have all four quantum numbers identical. In other words, an orbital can hold at most two electrons, and they must have opposite spins.",
          marks: 4 },
      ],
      status: "pending", answers: {}, createdAt: now - 3 * dayMs, source: "system",
    },
    {
      id: "c11-asg-4", title: "Chemical Bonding — Lewis Structures",
      subject: "chemistry", chapter: "c4",
      description: "Draw Lewis structures and predict shapes using VSEPR theory.",
      dueAt: now + 5 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "The shape of CH₄ molecule is:",
          options: ["Tetrahedral", "Trigonal planar", "Pyramidal", "Linear"],
          modelAnswer: "Tetrahedral — Carbon has 4 bond pairs and 0 lone pairs. The 4 pairs arrange tetrahedrally with bond angle 109.5°.",
          marks: 2 },
        { id: "q2", type: "short", question: "Draw the Lewis structure of water (H₂O) and state its shape.",
          modelAnswer: "O has 6 valence electrons, bonds with 2 H atoms (sharing 1 electron each). The Lewis structure: H—O—H with 2 lone pairs on O. With 2 bond pairs and 2 lone pairs, the shape is bent (V-shaped) with bond angle 104.5°.",
          marks: 5 },
        { id: "q3", type: "long", question: "Explain hybridization in BF₃ and SF₆. State the hybridization type and shape in each case.",
          modelAnswer: "BF₃: Boron has 3 valence electrons, all forming 3 B-F bonds. 3 bond pairs, 0 lone pairs → sp² hybridization, trigonal planar, bond angle 120°. SF₆: Sulphur (expanded octet) forms 6 S-F bonds. 6 bond pairs, 0 lone pairs → sp³d² hybridization, octahedral, bond angle 90°.",
          marks: 10 },
        { id: "q4", type: "short", question: "Why is the H-N-H bond angle in NH₃ (107°) less than the tetrahedral angle (109.5°)?",
          modelAnswer: "Because N has 1 lone pair in addition to 3 bond pairs. Lone pair-bond pair repulsion is greater than bond pair-bond pair repulsion, compressing the H-N-H angle from 109.5° to 107°.",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 4 * dayMs, source: "system",
    },
    {
      id: "c11-asg-5", title: "Trigonometric Identities — Practice",
      subject: "maths", chapter: "m3",
      description: "Prove 4 trigonometric identities and solve equations.",
      dueAt: now + 6 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "The value of sin(75°) is:",
          options: ["(√3+1)/(2√2)", "(√3-1)/(2√2)", "(√6+√2)/4", "(√6-√2)/4"],
          modelAnswer: "(√6+√2)/4 — Using sin(45°+30°) = sin45 cos30 + cos45 sin30 = (1/√2)(√3/2) + (1/√2)(1/2) = (√3+1)/(2√2) = (√6+√2)/4.",
          marks: 2 },
        { id: "q2", type: "short", question: "Prove that (1 + tan²θ)·cos²θ = 1.",
          modelAnswer: "LHS = (1 + tan²θ)·cos²θ = sec²θ·cos²θ (since 1+tan²θ = sec²θ) = (1/cos²θ)·cos²θ = 1 = RHS. Proved.",
          marks: 4 },
        { id: "q3", type: "long", question: "Prove the identity sin 3x = 3 sin x - 4 sin³x. Hence find the general solution of sin 3x = 0.",
          modelAnswer: "sin 3x = sin(2x+x) = sin2x cosx + cos2x sinx = (2 sinx cosx)cosx + (1-2sin²x)sinx = 2 sinx cos²x + sinx - 2sin³x. Using cos²x = 1-sin²x: = 2 sinx(1-sin²x) + sinx - 2sin³x = 2 sinx - 2sin³x + sinx - 2sin³x = 3 sinx - 4sin³x. Setting sin 3x = 0: sinx(3-4sin²x) = 0 → sinx = 0 (x = nπ) or sinx = ±√3/2 (x = nπ ± π/3, nπ ± 2π/3).",
          marks: 10 },
        { id: "q4", type: "short", question: "Find the principal value of sin⁻¹(½).",
          modelAnswer: "sin⁻¹(½) = π/6 (30°), since sin(π/6) = ½ and π/6 lies in the principal range [-π/2, π/2].",
          marks: 4 },
      ],
      status: "pending", answers: {}, createdAt: now - 5 * dayMs, source: "system",
    },
    {
      id: "c11-asg-6", title: "Complex Numbers — Modulus & Argument",
      subject: "maths", chapter: "m5",
      description: "Find modulus, argument, and polar form of complex numbers.",
      dueAt: now + 7 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "The modulus of z = 3 + 4i is:",
          options: ["3", "4", "5", "7"],
          modelAnswer: "5 — |z| = √(3² + 4²) = √25 = 5.",
          marks: 2 },
        { id: "q2", type: "short", question: "Express z = 1 + i in polar form.",
          modelAnswer: "|z| = √2, arg(z) = tan⁻¹(1/1) = π/4. So z = √2·(cos(π/4) + i·sin(π/4)) = √2·e^(iπ/4).",
          marks: 5 },
        { id: "q3", type: "long", question: "Find the square roots of -15 - 8i.",
          modelAnswer: "Let (a+bi)² = -15-8i → a²-b² = -15 and 2ab = -8 → ab = -4 → b = -4/a. Substituting: a² - 16/a² = -15 → a⁴ + 15a² - 16 = 0 → (a²+16)(a²-1) = 0 → a² = 1 → a = ±1. If a = 1, b = -4 → √ = 1-4i. If a = -1, b = 4 → √ = -1+4i. So √(-15-8i) = ±(1-4i).",
          marks: 10 },
        { id: "q4", type: "short", question: "If z₁ = 2+3i and z₂ = 1-i, find |z₁·z₂|.",
          modelAnswer: "|z₁·z₂| = |z₁|·|z₂| = √(4+9) × √(1+1) = √13 × √2 = √26.",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 6 * dayMs, source: "system",
    },
    {
      id: "c11-asg-7", title: "Python — Control Flow & Functions",
      subject: "cs", chapter: "cs7",
      description: "Write Python programs using conditionals, loops, and functions.",
      dueAt: now + 8 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "Which keyword is used to exit a loop prematurely in Python?",
          options: ["exit", "break", "stop", "return"],
          modelAnswer: "break — It immediately terminates the innermost loop and transfers control to the statement after the loop.",
          marks: 2 },
        { id: "q2", type: "short", question: "Write a Python function to check whether a number is prime.",
          modelAnswer: "def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n**0.5)+1):\n        if n % i == 0:\n            return False\n    return True",
          marks: 5 },
        { id: "q3", type: "long", question: "Write a Python program to print the Fibonacci series up to n terms using recursion. Include a docstring and handle edge cases.",
          modelAnswer: "def fib(n):\n    \"\"\"Return the n-th Fibonacci number (n >= 0).\"\"\"\n    if n < 0:\n        raise ValueError('n must be non-negative')\n    if n == 0: return 0\n    if n == 1: return 1\n    return fib(n-1) + fib(n-2)\n\n# Print first 10 terms:\nfor i in range(10):\n    print(fib(i), end=' ')\n# Output: 0 1 1 2 3 5 8 13 21 34",
          marks: 10 },
        { id: "q4", type: "short", question: "What is the difference between `=` and `==` in Python?",
          modelAnswer: "`=` is the assignment operator (assigns a value to a variable, e.g. x = 5). `==` is the equality comparison operator (returns True if both operands are equal, e.g. x == 5 returns True).",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 7 * dayMs, source: "system",
    },
    {
      id: "c11-asg-8", title: "Python — Lists & Dictionaries",
      subject: "cs", chapter: "cs9",
      description: "Practice list operations, list comprehension, and dictionary methods.",
      dueAt: now + 9 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "What does `len([1, 2, [3, 4]])` return?",
          options: ["3", "4", "5", "Error"],
          modelAnswer: "3 — The list contains 3 elements: 1, 2, and [3, 4]. len() counts top-level elements only.",
          marks: 2 },
        { id: "q2", type: "short", question: "Write a list comprehension to generate squares of even numbers from 1 to 20.",
          modelAnswer: "[x**2 for x in range(1, 21) if x % 2 == 0] → [4, 16, 36, 64, 100, 144, 196, 256, 324, 400]",
          marks: 5 },
        { id: "q3", type: "long", question: "Write a Python program that takes a dictionary of students with their marks, and returns a list of students who scored above 75, sorted by marks (descending).",
          modelAnswer: "def top_students(marks_dict, threshold=75):\n    filtered = [(name, marks) for name, marks in marks_dict.items() if marks > threshold]\n    filtered.sort(key=lambda x: x[1], reverse=True)\n    return [name for name, _ in filtered]\n\n# Example:\n# marks = {'Aarav': 88, 'Diya': 72, 'Kabir': 95, 'Meera': 80}\n# top_students(marks) → ['Kabir', 'Aarav', 'Meera']",
          marks: 10 },
        { id: "q4", type: "short", question: "Difference between list.append() and list.extend()?",
          modelAnswer: "append(x) adds x as a single element to the end of the list. extend(iterable) appends each element of the iterable separately. Example: [1,2].append([3,4]) → [1,2,[3,4]]; [1,2].extend([3,4]) → [1,2,3,4].",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 8 * dayMs, source: "system",
    },
    {
      id: "c11-asg-9", title: "Hornbill — The Portrait of a Lady",
      subject: "english", chapter: "e1",
      description: "Answer comprehension and analytical questions on Khushwant Singh's story.",
      dueAt: now + 4 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "The Portrait of a Lady is written by:",
          options: ["Ruskin Bond", "Khushwant Singh", "R.K. Narayan", "Mulk Raj Anand"],
          modelAnswer: "Khushwant Singh — The Portrait of a Lady is an autobiographical account by Khushwant Singh about his grandmother.",
          marks: 2 },
        { id: "q2", type: "short", question: "Why did the grandmother stop talking to the narrator in the city?",
          modelAnswer: "Because she could no longer accompany him to school (English-medium school) and disapproved of the new subjects — music, science, English — which had no place for God and scriptures. She withdrew into her rosary and spinning wheel in silent disapproval.",
          marks: 5 },
        { id: "q3", type: "long", question: "Describe the three phases of the narrator's relationship with his grandmother.",
          modelAnswer: "Phase 1 (Village childhood): They were inseparable companions — she woke him, bathed him, dressed him, fed him a stale chapatti with butter and sugar, walked him to the village school where she read scriptures while he studied. Phase 2 (City life): They moved to the city to live with his parents. She could no longer accompany him to school and disapproved of the English-medium education. She stopped talking to him, withdrew into her rosary, and spent time feeding sparrows and stray dogs. Phase 3 (Abroad & return): When he went abroad for higher studies, she came to the station calmly to see him off. When he returned five years later, she was frail but celebrated his homecoming by singing and beating an old drum. That night she died peacefully, surrounded by mourning sparrows.",
          marks: 10 },
        { id: "q4", type: "short", question: "What do the sparrows symbolize in the story?",
          modelAnswer: "The sparrows symbolize the grandmother's quiet, faithful love — they came to mourn her death in thousands, sitting silently without chirping, and flew away without touching the bread crumbs offered. Their grief mirrors the universal love she inspired.",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 9 * dayMs, source: "system",
    },
    {
      id: "c11-asg-10", title: "Limits & Derivatives — First Principle",
      subject: "maths", chapter: "m13",
      description: "Find derivatives using the first principle and standard formulas.",
      dueAt: now + 10 * dayMs, totalMarks: 20,
      questions: [
        { id: "q1", type: "mcq", question: "The derivative of f(x) = x³ is:",
          options: ["x²", "3x", "3x²", "x⁴/4"],
          modelAnswer: "3x² — Using the power rule: d/dx(xⁿ) = n·xⁿ⁻¹, so d/dx(x³) = 3x².",
          marks: 2 },
        { id: "q2", type: "short", question: "Using the first principle, find the derivative of f(x) = 5x - 7.",
          modelAnswer: "f'(x) = lim(h→0) [f(x+h) - f(x)]/h = lim(h→0) [5(x+h)-7 - (5x-7)]/h = lim(h→0) [5h]/h = 5.",
          marks: 5 },
        { id: "q3", type: "long", question: "Using the first principle, derive the derivative of f(x) = sin x. Hence deduce d/dx(cos x).",
          modelAnswer: "f'(x) = lim(h→0) [sin(x+h) - sin x]/h. Using sin(A+B) = sin A cos B + cos A sin B: = lim(h→0) [sin x (cos h - 1) + cos x · sin h]/h = sin x · lim(h→0)(cos h - 1)/h + cos x · lim(h→0)(sin h/h). Using the standard limits lim(h→0)(sin h/h) = 1 and lim(h→0)(cos h - 1)/h = 0: f'(x) = sin x · 0 + cos x · 1 = cos x. So d/dx(sin x) = cos x. For cos x: write cos x = sin(π/2 - x), so d/dx(cos x) = cos(π/2 - x) · d/dx(π/2 - x) = sin x · (-1) = -sin x.",
          marks: 10 },
        { id: "q4", type: "short", question: "Find d/dx(x² · sin x) using the product rule.",
          modelAnswer: "Using product rule (uv)' = u'v + uv': d/dx(x²·sin x) = (2x)(sin x) + (x²)(cos x) = 2x sin x + x² cos x.",
          marks: 3 },
      ],
      status: "pending", answers: {}, createdAt: now - 10 * dayMs, source: "system",
    },
  ];
}

// Dispatcher: returns the appropriate seed list for the active class.
function seedAssignmentsFor(scholarClass: 9 | 11): Assignment[] {
  return scholarClass === 11 ? seedAssignmentsClass11() : seedAssignments();
}

// ============================================================================
// Helpers
// ============================================================================
function loadAssignments(scholarClass: 9 | 11): Assignment[] {
  if (typeof window === "undefined") return seedAssignmentsFor(scholarClass);
  const seeded = seedAssignmentsFor(scholarClass);
  return profileGetJSON<Assignment[]>(scholarClass, "assignments", seeded);
}
function saveAssignments(list: Assignment[], scholarClass: 9 | 11) {
  profileSetJSON(scholarClass, "assignments", list);
}

function subjectName(id: string, curriculum: typeof CURRICULUM): string { return curriculum.find((s) => s.id === id)?.name ?? id; }
function subjectAccent(id: string, curriculum: typeof CURRICULUM): string { return curriculum.find((s) => s.id === id)?.accent ?? "#64748b"; }
function subjectIcon(id: string, curriculum: typeof CURRICULUM): string { return curriculum.find((s) => s.id === id)?.icon ?? "📘"; }
function chapterTitle(sid: string, cid: string | undefined, curriculum: typeof CURRICULUM): string | undefined {
  if (!cid) return undefined;
  return curriculum.find((s) => s.id === sid)?.chapters.find((c) => c.id === cid)?.title;
}

function daysLeft(dueAt: number): number {
  return Math.ceil((dueAt - Date.now()) / dayMs);
}
function statusColor(s: AssignmentStatus): string {
  return s === "graded" ? "#10b981" : s === "submitted" ? "#0ea5e9" : s === "draft" ? "#f59e0b" : "#6366f1";
}
function statusLabel(s: AssignmentStatus): string {
  return s === "graded" ? "Graded" : s === "submitted" ? "Submitted" : s === "draft" ? "Draft" : "Pending";
}

// ============================================================================
// Component
// ============================================================================
export function AssignmentsView() {
  const addXP = useStore((s) => s.addXP);
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const pushActivity = useStore((s) => s.pushActivity);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [tab, setTab] = useState("assignments");
  const [fSubject, setFSubject] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [aiChecking, setAiChecking] = useState(false);
  const [showAIResult, setShowAIResult] = useState(false);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fSubjectNew, setFSubjectNew] = useState("maths");
  const [fDesc, setFDesc] = useState("");
  const [fDueDays, setFDueDays] = useState(3);
  const [fQuestions, setFQuestions] = useState(1);
  const [fMarks, setFMarks] = useState(5);

  useEffect(() => { setAssignments(loadAssignments(scholarClass)); }, [scholarClass]);

  const update = (next: Assignment[]) => { setAssignments(next); saveAssignments(next, scholarClass); };

  const patchAssignment = (id: string, patch: Partial<Assignment>) => {
    const next = assignments.map((a) => a.id === id ? { ...a, ...patch } : a);
    update(next);
    if (activeAssignment?.id === id) setActiveAssignment((prev) => prev ? { ...prev, ...patch } : prev);
  };

  const setAnswer = (asgId: string, qId: string, val: string) => {
    const next = assignments.map((a) => {
      if (a.id !== asgId) return a;
      const newAnswers = { ...a.answers, [qId]: val };
      const anyAnswered = Object.values(newAnswers).some((v) => v && v.trim());
      return { ...a, answers: newAnswers, status: a.status === "pending" && anyAnswered ? "draft" : a.status };
    });
    update(next);
    if (activeAssignment?.id === asgId) {
      const updated = next.find((a) => a.id === asgId);
      if (updated) setActiveAssignment(updated);
    }
  };

  const saveDraft = (id: string) => {
    patchAssignment(id, { status: "draft" });
    toast.success("Draft saved");
  };

  const submitAssignment = (id: string) => {
    const a = assignments.find((x) => x.id === id);
    if (!a) return;
    const unanswered = a.questions.filter((q) => !a.answers[q.id]?.trim()).length;
    if (unanswered > 0) {
      toast.error(`${unanswered} question${unanswered === 1 ? "" : "s"} unanswered`, { description: "Answer all questions or save as draft." });
      return;
    }
    patchAssignment(id, { status: "submitted", submittedAt: Date.now() });
    addXP(10);
    pushActivity({ type: "achievement", text: `Submitted: ${a.title}`, icon: "📝" });
    toast.success("Assignment submitted! +10 XP", { description: "Click 'AI Check' to grade it instantly." });
  };

  // ===== AI Check =====
  const runAICheck = async (asg: Assignment) => {
    setAiChecking(true); setShowAIResult(false);
    try {
      const qBlock = asg.questions.map((q, i) => `Q${i + 1} [${q.type}, ${q.marks} marks]: ${q.question}
Model answer: ${q.modelAnswer}
Student's answer: ${asg.answers[q.id] || "(blank)"}`).join("\n\n");

      const prompt = `You are a strict CBSE Class ${scholarClass} examiner. Grade this assignment for the student.

Title: ${asg.title}
Subject: ${subjectName(asg.subject, CURRICULUM)}
Total marks: ${asg.totalMarks}

${qBlock}

Grade each question fairly — award full marks only for complete, correct answers with proper working. Penalise missing steps. For MCQs, full marks if correct, zero if wrong. For short/long, award partial marks for partially correct answers.

Return strict JSON:
{
  "perQuestion": [
    { "questionId": string, "marks": number, "maxMarks": number, "feedback": string }
  ],
  "totalMarks": number,
  "grade": string (one of "A+", "A", "B+", "B", "C", "D"),
  "overallFeedback": string (2-3 sentence summary),
  "strengths": [string] (2-3 specific strengths),
  "improvements": [string] (2-3 specific areas to improve)
}`;
      const res = await askAIJSON<typeof asg.aiFeedback>(prompt, "academic-coach");
      if (!res?.perQuestion) throw new Error("no result");
      patchAssignment(asg.id, {
        status: "graded",
        aiFeedback: { ...res, checkedAt: Date.now() },
      });
      addXP(25);
      pushActivity({ type: "achievement", text: `Graded: ${asg.title} — ${res.totalMarks}/${asg.totalMarks}`, icon: "🎓" });
      toast.success(`Graded: ${res.totalMarks}/${asg.totalMarks} (${res.grade}) +25 XP`);
      setShowAIResult(true);
    } catch {
      toast.error("AI grading failed. Try again.");
    } finally { setAiChecking(false); }
  };

  // ===== Create custom assignment =====
  const createAssignment = async () => {
    if (!fTitle.trim()) { toast.error("Give your assignment a title."); return; }
    // AI-generate questions based on the form
    toast.success("Generating questions…");
    try {
      const prompt = `You are a CBSE Class ${scholarClass} question paper setter. Create ${fQuestions} question(s) for an assignment titled "${fTitle}" in ${subjectName(fSubjectNew, CURRICULUM)}.

Description: ${fDesc || "General topic question"}
Each question should be worth ${fMarks} marks. Mix types: 30% MCQ, 40% short, 30% long.

Return strict JSON:
{
  "questions": [
    {
      "type": "mcq" | "short" | "long",
      "question": string,
      "options": [string] (only for mcq, 4 options),
      "modelAnswer": string (detailed solution/explanation),
      "marks": number (≤ ${fMarks})
    }
  ]
}`;
      const res = await askAIJSON<{ questions: any[] }>(prompt, "academic-coach");
      if (!res?.questions?.length) throw new Error("no result");
      const newAsg: Assignment = {
        id: "cus-" + Math.random().toString(36).slice(2) + Date.now().toString(36),
        title: fTitle.trim(),
        subject: fSubjectNew,
        description: fDesc.trim() || "Custom assignment",
        dueAt: Date.now() + fDueDays * dayMs,
        totalMarks: res.questions.reduce((a, q) => a + (q.marks || fMarks), 0),
        questions: res.questions.map((q, i) => ({
          id: `q-${i}-${Date.now()}`,
          type: q.type === "mcq" ? "mcq" : q.type === "short" ? "short" : "long",
          question: String(q.question),
          options: Array.isArray(q.options) ? q.options.map(String) : undefined,
          modelAnswer: String(q.modelAnswer),
          marks: Number(q.marks) || fMarks,
        })),
        status: "pending", answers: {}, createdAt: Date.now(), source: "custom",
      };
      update([newAsg, ...assignments]);
      addXP(5);
      toast.success(`Assignment created with ${newAsg.questions.length} AI-generated questions +5 XP`);
      setFTitle(""); setFDesc(""); setFDueDays(3); setFQuestions(1); setFMarks(5);
      setCreateOpen(false);
    } catch {
      toast.error("AI generation failed. Try again.");
    }
  };

  // ===== Filtering =====
  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (fSubject !== "all" && a.subject !== fSubject) return false;
      if (fStatus !== "all" && a.status !== fStatus) return false;
      return true;
    });
  }, [assignments, fSubject, fStatus]);

  const pendingList = filtered.filter((a) => a.status === "pending" || a.status === "draft");
  const gradedList = filtered.filter((a) => a.status === "graded");

  // ===== Stats =====
  const total = assignments.length;
  const pendingCount = assignments.filter((a) => a.status === "pending" || a.status === "draft").length;
  const submittedCount = assignments.filter((a) => a.status === "submitted").length;
  const gradedCount = assignments.filter((a) => a.status === "graded").length;
  const avgScore = gradedCount > 0
    ? Math.round(assignments.filter((a) => a.aiFeedback).reduce((acc, a) => acc + (a.aiFeedback!.totalMarks / a.totalMarks) * 100, 0) / gradedCount)
    : 0;

  // ===== Calendar =====
  const calAssignments = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    assignments.forEach((a) => {
      const key = new Date(a.dueAt).toISOString().slice(0, 10);
      (map[key] ??= []).push(a);
    });
    return map;
  }, [assignments]);

  const calGrid = useMemo(() => {
    const first = new Date(calMonth);
    const startDay = first.getDay(); // 0 = Sun
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calMonth]);

  // ===== Export =====
  const exportAssignments = () => {
    const md = `# Assignment Center — Scholar
Generated on ${new Date().toLocaleString()}

## Summary
- Total assignments: ${total}
- Pending/Draft: ${pendingCount}
- Submitted: ${submittedCount}
- Graded: ${gradedCount}
- Average score: ${avgScore}%

## All Assignments
${assignments.map((a, i) => `### ${i + 1}. ${a.title}
- **Subject:** ${subjectName(a.subject, CURRICULUM)}${a.chapter ? " • " + (chapterTitle(a.subject, a.chapter, CURRICULUM) ?? "") : ""}
- **Status:** ${statusLabel(a.status)}
- **Due:** ${new Date(a.dueAt).toLocaleString("en-IN")} (${daysLeft(a.dueAt)}d)
- **Marks:** ${a.aiFeedback ? `${a.aiFeedback.totalMarks}/${a.totalMarks}` : `${a.totalMarks}`}
- **Questions:** ${a.questions.length}
${a.aiFeedback ? `\n**AI Feedback:**\n- Overall: ${a.aiFeedback.overallFeedback}\n- Strengths: ${a.aiFeedback.strengths.join("; ")}\n- Improvements: ${a.aiFeedback.improvements.join("; ")}` : ""}`).join("\n\n---\n\n")}

> Generated by Scholar Assignment Center.`;
    exportPDF({ title: "Assignment Center Report", subtitle: `${total} assignments • ${gradedCount} graded • ${avgScore}% avg`, bodyHtml: mdToHtml(md), accent: "#14b8a6" });
    toast.success("Exporting assignment report…");
  };

  // ===== Card =====
  const AssignmentCard = ({ a }: { a: Assignment }) => {
    const accent = subjectAccent(a.subject, CURRICULUM);
    const dl = daysLeft(a.dueAt);
    const overdue = dl < 0 && a.status !== "graded" && a.status !== "submitted";
    const sc = statusColor(a.status);
    const answered = a.questions.filter((q) => a.answers[q.id]?.trim()).length;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25 }}
        whileHover={{ y: -2 }}
        onClick={() => { setActiveAssignment(a); setShowAIResult(!!a.aiFeedback); }}
        className="as-glass rounded-2xl p-4 cursor-pointer border-l-2"
        style={{ borderLeftColor: accent }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{subjectIcon(a.subject, CURRICULUM)}</span>
            <h4 className="text-white font-semibold text-sm leading-snug line-clamp-1">{a.title}</h4>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 shrink-0" style={{ background: `${sc}20`, color: sc, borderColor: `${sc}50` }}>
            {statusLabel(a.status)}
          </Badge>
        </div>
        <p className="text-white/60 text-xs leading-relaxed line-clamp-2 mb-3">{a.description}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}40` }}>
            {subjectName(a.subject, CURRICULUM)}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 bg-white/5 border-white/15 text-white/60">
            <ListChecks className="h-2.5 w-2.5 mr-0.5" />{a.questions.length}Q • {a.totalMarks}m
          </Badge>
          {a.status === "draft" && (
            <Badge variant="outline" className="text-[10px] px-1.5 bg-amber-500/15 border-amber-500/40 text-amber-200">
              {answered}/{a.questions.length} done
            </Badge>
          )}
          {a.status === "graded" && a.aiFeedback && (
            <Badge variant="outline" className="text-[10px] px-1.5 bg-emerald-500/15 border-emerald-500/40 text-emerald-200">
              <Award className="h-2.5 w-2.5 mr-0.5" />{a.aiFeedback.totalMarks}/{a.totalMarks} ({a.aiFeedback.grade})
            </Badge>
          )}
          <span className={cn("text-[10px] ml-auto flex items-center gap-1", overdue ? "text-rose-300" : dl <= 2 ? "text-amber-300" : "text-white/40")}>
            <Clock className="h-2.5 w-2.5" />
            {overdue ? `${Math.abs(dl)}d overdue` : dl === 0 ? "Today" : dl === 1 ? "Tomorrow" : `${dl}d left`}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .as-font-serif { font-family: 'Instrument Serif', serif; }
        .as-font-body { font-family: 'Inter', sans-serif; }
        .as-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .as-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .as-glass input, .as-glass textarea, .as-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .as-glass input::placeholder, .as-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
      `}</style>

      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 as-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-teal-500/30 to-emerald-500/30 text-teal-300 border border-white/10">
                <ClipboardList className="h-6 w-6" />
              </div>
              <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40">10 Assignments • AI Grading • Calendar</Badge>
            </div>
            <h1 className="as-font-serif text-5xl md:text-6xl text-white leading-tight">
              Assignment <em className="text-teal-300">Center</em>
            </h1>
            <p className="text-white/70 mt-3 max-w-2xl">
              Subject assignments with countdown timers, draft auto-save, instant AI grading (per-question marks + feedback),
              and a calendar view of all deadlines. +25 XP per graded submission.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="as-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportAssignments}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Assignment
            </Button>
          </div>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: ClipboardList, label: "Total", value: total, accent: "#14b8a6" },
            { icon: Clock, label: "Pending", value: pendingCount, accent: "#f59e0b" },
            { icon: CheckCircle2, label: "Submitted", value: submittedCount, accent: "#0ea5e9" },
            { icon: Trophy, label: "Avg Score", value: `${avgScore}%`, accent: "#10b981" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        {/* TABS */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="as-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="assignments" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Assignments {pendingCount > 0 && <span className="ml-1.5 text-xs bg-teal-500/30 text-teal-200 rounded-full px-1.5">{pendingCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Calendar</TabsTrigger>
            <TabsTrigger value="graded" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Graded {gradedCount > 0 && <span className="ml-1.5 text-xs bg-emerald-500/30 text-emerald-200 rounded-full px-1.5">{gradedCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">AI Feedback</TabsTrigger>
          </TabsList>

          {/* ===== ASSIGNMENTS ===== */}
          <TabsContent value="assignments" className="space-y-4">
            {/* Filters */}
            <div className="as-glass rounded-2xl p-3 flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-white/40" />
              <select value={fSubject} onChange={(e) => setFSubject(e.target.value)}
                className="text-xs p-1.5 rounded-md bg-white/5 border border-white/15 text-white">
                <option value="all">All subjects</option>
                {CURRICULUM.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
                className="text-xs p-1.5 rounded-md bg-white/5 border border-white/15 text-white">
                <option value="all">All status</option>
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="graded">Graded</option>
              </select>
              {(fSubject !== "all" || fStatus !== "all") && (
                <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-7 text-xs"
                  onClick={() => { setFSubject("all"); setFStatus("all"); }}>
                  <X className="h-3 w-3 mr-1" />Clear
                </Button>
              )}
            </div>
            {pendingList.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No active assignments" description="All caught up. Add a custom assignment or wait for new ones to be assigned." />
            ) : (
              <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {pendingList.map((a) => <AssignmentCard key={a.id} a={a} />)}
                </AnimatePresence>
              </motion.div>
            )}
          </TabsContent>

          {/* ===== CALENDAR ===== */}
          <TabsContent value="calendar" className="space-y-4">
            <div className="as-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10"
                  onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="as-font-serif text-2xl text-white">
                  {calMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </h3>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10"
                  onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-[10px] uppercase tracking-wider text-white/40 font-medium py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calGrid.map((d, i) => {
                  if (!d) return <div key={i} />;
                  const key = d.toISOString().slice(0, 10);
                  const items = calAssignments[key] ?? [];
                  const today = new Date().toISOString().slice(0, 10) === key;
                  return (
                    <div key={i} className={cn("min-h-[64px] rounded-lg p-1.5 border text-xs transition-all",
                      today ? "border-teal-500/40 bg-teal-500/10" : "border-white/10 bg-white/[0.03]",
                      items.length > 0 ? "cursor-pointer hover:bg-white/[0.07]" : "")}>
                      <div className={cn("text-[10px] font-medium mb-1", today ? "text-teal-300" : "text-white/60")}>
                        {d.getDate()}
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 2).map((a) => (
                          <div key={a.id} onClick={() => { setActiveAssignment(a); setShowAIResult(!!a.aiFeedback); }}
                            className="text-[9px] leading-tight px-1 py-0.5 rounded truncate" style={{ background: `${subjectAccent(a.subject, CURRICULUM)}30`, color: "white" }}>
                            {subjectIcon(a.subject, CURRICULUM)} {a.title}
                          </div>
                        ))}
                        {items.length > 2 && <div className="text-[9px] text-white/40">+{items.length - 2} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Upcoming deadlines list */}
            <div className="as-glass rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-300" /> Upcoming Deadlines</h3>
              <div className="space-y-2">
                {assignments.filter((a) => a.status !== "graded" && a.status !== "submitted").sort((a, b) => a.dueAt - b.dueAt).slice(0, 5).map((a) => {
                  const dl = daysLeft(a.dueAt);
                  return (
                    <div key={a.id} onClick={() => { setActiveAssignment(a); setShowAIResult(false); }}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.05] cursor-pointer">
                      <div className="grid place-items-center h-8 w-8 rounded-lg text-sm shrink-0" style={{ background: `${subjectAccent(a.subject, CURRICULUM)}22` }}>
                        {subjectIcon(a.subject, CURRICULUM)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{a.title}</p>
                        <p className="text-[10px] text-white/50">{subjectName(a.subject, CURRICULUM)} • {a.questions.length} questions</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 shrink-0",
                        dl < 0 ? "bg-rose-500/15 border-rose-500/40 text-rose-300" : dl <= 2 ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/15 text-white/60")}>
                        {dl < 0 ? `${Math.abs(dl)}d over` : dl === 0 ? "Today" : `${dl}d`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ===== GRADED ===== */}
          <TabsContent value="graded" className="space-y-3">
            {gradedList.length === 0 ? (
              <EmptyState icon={Trophy} title="No graded assignments yet" description="Submit an assignment and click 'AI Check' to get instant per-question marks, grade, and feedback. +25 XP per graded submission." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {gradedList.map((a) => <AssignmentCard key={a.id} a={a} />)}
              </div>
            )}
          </TabsContent>

          {/* ===== AI FEEDBACK ===== */}
          <TabsContent value="ai" className="space-y-4">
            {gradedList.length === 0 ? (
              <EmptyState icon={Brain} title="No AI feedback yet" description="Submit and AI-check an assignment to see detailed per-question feedback, strengths, and improvement areas here." />
            ) : (
              <div className="space-y-4">
                {gradedList.map((a) => a.aiFeedback && (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="as-glass rounded-2xl p-5 border-l-2" style={{ borderLeftColor: subjectAccent(a.subject, CURRICULUM) }}>
                    <div className="flex items-start gap-4 flex-wrap">
                      <ProgressRing value={(a.aiFeedback.totalMarks / a.totalMarks) * 100} size={90} stroke={8}
                        color={a.aiFeedback.totalMarks / a.totalMarks >= 0.75 ? "#10b981" : a.aiFeedback.totalMarks / a.totalMarks >= 0.5 ? "#f59e0b" : "#f43f5e"}
                        label={<div className="text-center">
                          <p className="text-lg font-bold text-white">{a.aiFeedback.totalMarks}</p>
                          <p className="text-[9px] text-white/50">/{a.totalMarks}</p>
                        </div>} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-semibold">{a.title}</h4>
                          <Badge variant="outline" className="text-[10px] px-1.5 bg-emerald-500/15 border-emerald-500/40 text-emerald-200">{a.aiFeedback.grade}</Badge>
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed mb-3">{a.aiFeedback.overallFeedback}</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-emerald-300 mb-1.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Strengths</p>
                            <ul className="space-y-1">
                              {a.aiFeedback.strengths.map((s, i) => (
                                <li key={i} className="text-xs text-white/80 flex items-start gap-1.5"><span className="text-emerald-300 mt-0.5">+</span>{s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Improvements</p>
                            <ul className="space-y-1">
                              {a.aiFeedback.improvements.map((s, i) => (
                                <li key={i} className="text-xs text-white/80 flex items-start gap-1.5"><span className="text-amber-300 mt-0.5">→</span>{s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ===== WORKSPACE DIALOG ===== */}
        <Dialog open={!!activeAssignment} onOpenChange={(o) => { if (!o) setActiveAssignment(null); }}>
          <DialogContent className="as-glass-strong !bg-black/60 !border-white/20 max-w-3xl max-h-[90vh] overflow-y-auto">
            {activeAssignment && (() => {
              const a = activeAssignment;
              const accent = subjectAccent(a.subject, CURRICULUM);
              const answered = a.questions.filter((q) => a.answers[q.id]?.trim()).length;
              const dl = daysLeft(a.dueAt);
              const overdue = dl < 0 && a.status !== "graded" && a.status !== "submitted";
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="grid place-items-center h-11 w-11 rounded-xl text-xl shrink-0" style={{ background: `${accent}22` }}>
                        {subjectIcon(a.subject, CURRICULUM)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="as-font-serif text-2xl text-white leading-snug">{a.title}</DialogTitle>
                        <DialogDescription className="text-white/60 mt-1">
                          {subjectName(a.subject, CURRICULUM)}{a.chapter ? " • " + (chapterTitle(a.subject, a.chapter, CURRICULUM) ?? "") : ""} • {a.totalMarks} marks
                        </DialogDescription>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 shrink-0" style={{ background: `${statusColor(a.status)}20`, color: statusColor(a.status), borderColor: `${statusColor(a.status)}50` }}>
                        {statusLabel(a.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn("flex items-center gap-1 px-2 py-1 rounded-md", overdue ? "bg-rose-500/15 text-rose-300" : dl <= 2 ? "bg-amber-500/15 text-amber-300" : "bg-white/5 text-white/60")}>
                        <Clock className="h-3 w-3" />
                        {overdue ? `${Math.abs(dl)}d overdue` : dl === 0 ? "Due today" : dl === 1 ? "Due tomorrow" : `${dl}d left`}
                      </span>
                      <span className="text-white/50">•</span>
                      <span className="text-white/60">{answered}/{a.questions.length} answered</span>
                    </div>
                  </DialogHeader>

                  <div className="space-y-4">
                    <p className="text-sm text-white/70 leading-relaxed">{a.description}</p>

                    {/* Questions */}
                    {a.questions.map((q, qi) => (
                      <div key={q.id} className="as-glass rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2">
                            <span className="grid place-items-center h-6 w-6 rounded-md text-xs font-bold shrink-0" style={{ background: `${accent}22`, color: accent }}>
                              {qi + 1}
                            </span>
                            <p className="text-sm text-white font-medium leading-snug">{q.question}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 bg-white/5 border-white/15 text-white/60">
                            {q.type === "mcq" ? "MCQ" : q.type === "short" ? "Short" : "Long"} • {q.marks}m
                          </Badge>
                        </div>

                        {/* Answer input */}
                        {q.type === "mcq" && q.options ? (
                          <div className="grid sm:grid-cols-2 gap-2 mt-3">
                            {q.options.map((opt, oi) => {
                              const selected = a.answers[q.id] === opt;
                              return (
                                <button key={oi} disabled={a.status === "graded"}
                                  onClick={() => setAnswer(a.id, q.id, opt)}
                                  className={cn("text-left text-sm p-2.5 rounded-lg border transition-all",
                                    selected ? "border-teal-400/60 bg-teal-500/15 text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]",
                                    a.status === "graded" && "opacity-70 cursor-not-allowed")}>
                                  <span className="text-[10px] font-bold mr-1.5" style={{ color: accent }}>{String.fromCharCode(65 + oi)}.</span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <Textarea
                            value={a.answers[q.id] ?? ""}
                            onChange={(e) => setAnswer(a.id, q.id, e.target.value)}
                            disabled={a.status === "graded"}
                            placeholder={`Write your ${q.type} answer…`}
                            rows={q.type === "short" ? 3 : 6}
                            className="bg-white/5 border-white/15 text-white mt-3" />
                        )}

                        {/* AI feedback per question (if graded) */}
                        {a.aiFeedback && (
                          <div className="mt-3 bg-white/[0.04] rounded-lg p-3 border-l-2"
                            style={{ borderLeftColor: (a.aiFeedback.perQuestion.find(p => p.questionId === q.id)?.marks ?? 0) >= q.marks * 0.75 ? "#10b981" : (a.aiFeedback.perQuestion.find(p => p.questionId === q.id)?.marks ?? 0) >= q.marks * 0.5 ? "#f59e0b" : "#f43f5e" }}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] uppercase tracking-wider text-white/50">AI Marking</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 bg-white/5 border-white/15 text-white/80">
                                {a.aiFeedback.perQuestion.find(p => p.questionId === q.id)?.marks ?? 0}/{q.marks}
                              </Badge>
                            </div>
                            <p className="text-xs text-white/80 leading-relaxed">
                              {a.aiFeedback.perQuestion.find(p => p.questionId === q.id)?.feedback ?? "No feedback."}
                            </p>
                            <details className="mt-2">
                              <summary className="text-[10px] text-white/40 cursor-pointer hover:text-white/70">Show model answer</summary>
                              <p className="text-xs text-white/60 mt-1 leading-relaxed italic">{q.modelAnswer}</p>
                            </details>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* AI result summary */}
                    {showAIResult && a.aiFeedback && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="as-glass-strong rounded-xl p-4 border-l-2 border-emerald-500/60">
                        <div className="flex items-center gap-3 mb-3">
                          <Brain className="h-5 w-5 text-emerald-300" />
                          <h4 className="text-white font-semibold">AI Overall Feedback</h4>
                          <Badge variant="outline" className="ml-auto bg-emerald-500/15 border-emerald-500/40 text-emerald-200">
                            Grade {a.aiFeedback.grade}
                          </Badge>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed mb-3">{a.aiFeedback.overallFeedback}</p>
                        <div className="grid sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-emerald-300 font-medium mb-1">Strengths</p>
                            <ul className="space-y-0.5">{a.aiFeedback.strengths.map((s, i) => <li key={i} className="text-white/80">+ {s}</li>)}</ul>
                          </div>
                          <div>
                            <p className="text-amber-300 font-medium mb-1">Improvements</p>
                            <ul className="space-y-0.5">{a.aiFeedback.improvements.map((s, i) => <li key={i} className="text-white/80">→ {s}</li>)}</ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <DialogFooter className="mt-4 flex items-center gap-2 flex-wrap">
                    {a.status === "graded" ? (
                      <Button variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10 ml-auto"
                        onClick={() => setActiveAssignment(null)}>
                        Close
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" className="bg-white/5 border-white/15 text-white hover:bg-white/10"
                          onClick={() => saveDraft(a.id)}>
                          <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
                        </Button>
                        {a.status === "submitted" ? (
                          <Button size="sm" className="bg-violet-500 hover:bg-violet-600 text-white ml-auto" disabled={aiChecking}
                            onClick={() => runAICheck(a)}>
                            {aiChecking ? (
                              <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles className="h-3.5 w-3.5 mr-1.5" /></motion.div>Grading…</>
                            ) : (
                              <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Check (+25 XP)</>
                            )}
                          </Button>
                        ) : (
                          <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white ml-auto"
                            onClick={() => submitAssignment(a.id)}>
                            <Send className="h-3.5 w-3.5 mr-1.5" /> Submit
                          </Button>
                        )}
                      </>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ===== CREATE DIALOG ===== */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="as-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="as-font-serif text-2xl text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-teal-300" /> Add Assignment
              </DialogTitle>
              <DialogDescription className="text-white/70">AI will generate questions based on your inputs. +5 XP for creating.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Title</Label>
                <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g. Trigonometry Basics Worksheet"
                  className="bg-white/5 border-white/15 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Subject</Label>
                  <select value={fSubjectNew} onChange={(e) => setFSubjectNew(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                    {CURRICULUM.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Due in (days)</Label>
                  <Input type="number" min={1} max={30} value={fDueDays} onChange={(e) => setFDueDays(Math.max(1, Math.min(30, Number(e.target.value))))}
                    className="bg-white/5 border-white/15 text-white" />
                </div>
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Description (optional)</Label>
                <Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)}
                  placeholder="Topic / context for the AI to generate questions"
                  rows={2}
                  className="bg-white/5 border-white/15 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Number of questions: {fQuestions}</Label>
                  <input type="range" min={1} max={8} value={fQuestions}
                    onChange={(e) => setFQuestions(Number(e.target.value))}
                    className="w-full accent-teal-400" />
                </div>
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Marks per question: {fMarks}</Label>
                  <input type="range" min={2} max={10} value={fMarks}
                    onChange={(e) => setFMarks(Number(e.target.value))}
                    className="w-full accent-teal-400" />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" className="text-white/70" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={createAssignment}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate & Create (+5 XP)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default AssignmentsView;
