"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAI } from "@/lib/ai";
import { useStore } from "@/lib/store";
import {
  FlaskConical, Atom, Microscope, Dna, Globe, Calculator, Telescope, Cpu,
  Brain, Search, Sparkles, Play, RotateCcw, X, ChevronRight, Clock,
  Zap, Award, TrendingUp, Beaker, Waves, Magnet, Thermometer, Wind,
  Send, Loader2, BookOpen, Target, Lightbulb, Volume2, Settings,
  Home, Star, Bookmark, Download, Eye, Activity, Flame, Droplet,
  ShieldAlert, ListChecks, Sigma,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { Markdown } from "@/lib/shared";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import {
  VernierCalipersSim, ScrewGaugeSim, SimplePendulumSim,
  loadCompletedExps, saveCompletedExp,
  type LabSimProps,
} from "@/components/views/lab-interactive";
import { Construction, Gauge } from "lucide-react";

// ===== Lab completion persistence (profile-scoped) =====
const LAB_COMPLETED_KEY = "lab-completed-experiments";

// ===== Experiment categories =====
interface Experiment {
  id: string;
  title: string;
  category: string;
  icon: string;
  difficulty: "Easy" | "Medium" | "Hard";
  duration: string;
  description: string;
  subject: string;
  color: string;
}

// ===== Interactive experiment registry =====
// Only these 3 experiments are genuinely interactive. All others show a
// "Coming Soon" panel honestly instead of a fake passive animation.
const INTERACTIVE_IDS = new Set(["vernier-calipers", "screw-gauge", "pendulum"]);

function isInteractive(experiment: Experiment): boolean {
  return INTERACTIVE_IDS.has(experiment.id);
}

// ===== Interactive sim router =====
function InteractiveSimRouter({
  experiment, alreadyCompleted, onComplete, scholarClass,
}: { experiment: Experiment; alreadyCompleted: boolean; onComplete: () => void; scholarClass: 9 | 11 }) {
  const props: LabSimProps = { onComplete, alreadyCompleted, scholarClass };
  switch (experiment.id) {
    case "vernier-calipers": return <VernierCalipersSim {...props} />;
    case "screw-gauge": return <ScrewGaugeSim {...props} />;
    case "pendulum": return <SimplePendulumSim {...props} />;
    default: return null;
  }
}

// ===== Coming Soon panel for not-yet-interactive experiments =====
function ComingSoonPanel({ experiment }: { experiment: Experiment }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-6 py-10">
      <div className="grid place-items-center h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 mb-4">
        <Construction className="h-8 w-8 text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold text-white lab-font mb-2">Coming Soon</h2>
      <p className="text-sm text-white/60 lab-font max-w-md mb-5">
        This experiment is not yet interactive. The full Scholar Experiment Lab
        vision includes hands-on versions of every simulation, but right now
        only <span className="text-emerald-300 font-medium">Vernier Calipers</span>,{" "}
        <span className="text-emerald-300 font-medium">Screw Gauge</span>, and{" "}
        <span className="text-emerald-300 font-medium">Pendulum Motion</span> are
        genuinely interactive.
      </p>
      <p className="text-xs text-white/40 lab-font">{experiment.title} — preview only.</p>
    </div>
  );
}

const CATEGORIES = [
  { id: "chemistry", name: "Chemistry", icon: FlaskConical, emoji: "🧪", color: "#10b981" },
  { id: "physics", name: "Physics", icon: Atom, emoji: "⚛️", color: "#6366f1" },
  { id: "biology", name: "Biology", icon: Dna, emoji: "🧬", color: "#f43f5e" },
  { id: "geography", name: "Geography", icon: Globe, emoji: "🌍", color: "#f59e0b" },
  { id: "maths", name: "Mathematics", icon: Calculator, emoji: "📐", color: "#8b5cf6" },
  { id: "astronomy", name: "Astronomy", icon: Telescope, emoji: "🌌", color: "#06b6d4" },
];

const EXPERIMENTS: Experiment[] = [
  { id: "acid-metal", title: "Acid + Metal Reaction", category: "chemistry", icon: "🧪", difficulty: "Easy", duration: "5 min", description: "Drag hydrochloric acid onto magnesium and watch hydrogen bubbles form. Learn about single displacement reactions.", subject: "Science", color: "#10b981" },
  { id: "acid-base", title: "Acid + Base Neutralization", category: "chemistry", icon: "⚗️", difficulty: "Easy", duration: "5 min", description: "Mix HCl with NaOH and observe the color change with phenolphthalein indicator.", subject: "Science", color: "#10b981" },
  { id: "electrolysis", title: "Electrolysis of Water", category: "chemistry", icon: "⚡", difficulty: "Medium", duration: "8 min", description: "Split water into hydrogen and oxygen using electricity. See gases collect at electrodes.", subject: "Science", color: "#10b981" },
  { id: "ph-scale", title: "pH Scale Explorer", category: "chemistry", icon: "📊", difficulty: "Easy", duration: "5 min", description: "Test different substances and see where they fall on the pH scale.", subject: "Science", color: "#10b981" },
  { id: "periodic", title: "Periodic Table Explorer", category: "chemistry", icon: "🧮", difficulty: "Medium", duration: "10 min", description: "Interactive periodic table — click any element to see properties, electron config, and uses.", subject: "Science", color: "#10b981" },
  { id: "projectile", title: "Projectile Motion", category: "physics", icon: "🚀", difficulty: "Medium", duration: "7 min", description: "Launch objects at different angles and velocities. Watch trajectories and measure range.", subject: "Science", color: "#6366f1" },
  { id: "gravity", title: "Gravity Simulator", category: "physics", icon: "🌍", difficulty: "Easy", duration: "5 min", description: "Adjust gravity and mass. Drop objects and see how fast they fall on different planets.", subject: "Science", color: "#6366f1" },
  { id: "circuit", title: "Electric Circuit Builder", category: "physics", icon: "💡", difficulty: "Medium", duration: "10 min", description: "Build circuits with batteries, bulbs, and switches. Measure voltage and current.", subject: "Science", color: "#6366f1" },
  { id: "pendulum", title: "Pendulum Motion", category: "physics", icon: "⚖️", difficulty: "Easy", duration: "5 min", description: "Adjust length and angle. Observe periodic motion and calculate time period.", subject: "Science", color: "#6366f1" },
  { id: "vernier-calipers", title: "Vernier Calipers", category: "physics", icon: "📏", difficulty: "Easy", duration: "8 min", description: "Drag the movable jaw, read MSR & VSR, apply zero correction, and measure object width.", subject: "Science", color: "#10b981" },
  { id: "screw-gauge", title: "Screw Gauge", category: "physics", icon: "🔧", difficulty: "Medium", duration: "8 min", description: "Rotate the circular scale, read PSR & CSR, apply zero correction, and measure wire thickness.", subject: "Science", color: "#8b5cf6" },
  { id: "wave", title: "Wave Motion", category: "physics", icon: "🌊", difficulty: "Medium", duration: "7 min", description: "Visualize transverse and longitudinal waves. Adjust frequency and amplitude.", subject: "Science", color: "#6366f1" },
  { id: "heart", title: "Human Heart Explorer", category: "biology", icon: "🫀", difficulty: "Medium", duration: "10 min", description: "Interactive heart — see blood flow through chambers. Zoom and rotate.", subject: "Science", color: "#f43f5e" },
  { id: "photosynthesis", title: "Photosynthesis Lab", category: "biology", icon: "🌿", difficulty: "Easy", duration: "7 min", description: "Adjust light intensity and CO₂. Watch glucose production and oxygen release.", subject: "Science", color: "#f43f5e" },
  { id: "cell", title: "Cell Explorer", category: "biology", icon: "🔬", difficulty: "Easy", duration: "8 min", description: "Zoom into a cell. Click organelles to learn their functions.", subject: "Science", color: "#f43f5e" },
  { id: "dna", title: "DNA Structure", category: "biology", icon: "🧬", difficulty: "Hard", duration: "10 min", description: "Rotate and explore the DNA double helix. Learn about base pairing.", subject: "Science", color: "#f43f5e" },
  { id: "earthquake", title: "Earthquake Simulator", category: "geography", icon: "🌋", difficulty: "Medium", duration: "7 min", description: "Adjust magnitude and depth. See seismic waves spread across a landscape.", subject: "SST", color: "#f59e0b" },
  { id: "climate", title: "Climate Change Simulator", category: "geography", icon: "🌡️", difficulty: "Medium", duration: "8 min", description: "Adjust CO₂ levels and see temperature, sea level, and ice cap changes over time.", subject: "SST", color: "#f59e0b" },
  { id: "volcano", title: "Volcano Eruption", category: "geography", icon: "🏔️", difficulty: "Easy", duration: "5 min", description: "Trigger a volcanic eruption. See lava flow, ash clouds, and pyroclastic flows.", subject: "SST", color: "#f59e0b" },
  { id: "graph", title: "Graph Plotter", category: "maths", icon: "📈", difficulty: "Easy", duration: "5 min", description: "Plot any function. Adjust coefficients and see the graph update in real-time.", subject: "Maths", color: "#8b5cf6" },
  { id: "pythagoras", title: "Pythagoras Visualizer", category: "maths", icon: "📐", difficulty: "Easy", duration: "5 min", description: "Drag the triangle vertices and see the Pythagorean theorem in action.", subject: "Maths", color: "#8b5cf6" },
  { id: "probability", title: "Probability Simulator", category: "maths", icon: "🎲", difficulty: "Medium", duration: "7 min", description: "Flip coins, roll dice, draw cards. See experimental vs theoretical probability.", subject: "Maths", color: "#8b5cf6" },
  { id: "solar", title: "Solar System Explorer", category: "astronomy", icon: "🪐", difficulty: "Easy", duration: "8 min", description: "Fly through the solar system. Click planets to learn facts. Adjust time speed.", subject: "Science", color: "#06b6d4" },
  { id: "moon", title: "Moon Phases", category: "astronomy", icon: "🌕", difficulty: "Easy", duration: "5 min", description: "See how the moon's phases change as it orbits Earth. Drag the moon around.", subject: "Science", color: "#06b6d4" },
  { id: "blackhole", title: "Black Hole Simulator", category: "astronomy", icon: "⚫", difficulty: "Hard", duration: "10 min", description: "Throw objects at a black hole. See gravitational lensing and event horizon.", subject: "Science", color: "#06b6d4" },
];

// ===== Simulation type mapping =====
function getSimulationType(experiment: Experiment): string {
  return experiment.id;
}

// ===== Experiment details (materials / safety / formula / steps) =====
type ExperimentDetails = {
  materials: string[];
  safety: string[];
  formula: string;
  steps: string[];
};

function getExperimentDetails(experiment: Experiment): ExperimentDetails {
  const D: Record<string, ExperimentDetails> = {
    "acid-metal": {
      materials: ["Dilute Hydrochloric Acid (HCl)", "Magnesium ribbon", "Test tube", "Burning candle", "Test tube holder"],
      safety: ["Wear safety goggles", "Do not inhale gases directly", "Handle acid with care", "Keep away from open flames"],
      formula: "Mg + 2HCl → MgCl₂ + H₂↑",
      steps: [
        "Take a clean test tube and add dilute HCl to about 1/3rd",
        "Drop a small piece of magnesium ribbon into the acid",
        "Observe brisk effervescence — bubbles of hydrogen gas forming",
        "Bring a burning candle near the mouth — a 'pop' sound confirms H₂",
      ],
    },
    "acid-base": {
      materials: ["Dilute HCl", "Dilute NaOH", "Phenolphthalein indicator", "Conical flask", "Dropper"],
      safety: ["Wear safety goggles", "Add acid to water, never reverse", "Avoid contact with skin"],
      formula: "HCl + NaOH → NaCl + H₂O",
      steps: [
        "Take dilute NaOH in a conical flask",
        "Add 2–3 drops of phenolphthalein — solution turns pink",
        "Add dilute HCl drop by drop while stirring",
        "Pink color disappears — neutralization is complete",
      ],
    },
    "electrolysis": {
      materials: ["Water acidified with H₂SO₄", "Hofmann voltameter", "Two platinum electrodes", "6V battery", "Connecting wires"],
      safety: ["Wear safety goggles", "Use only low-voltage DC (≤6V)", "Ensure proper ventilation for H₂"],
      formula: "2H₂O → 2H₂↑ + O₂↑  (H₂ : O₂ = 2 : 1)",
      steps: [
        "Fill the voltameter with acidified water",
        "Connect electrodes to a 6V battery",
        "Switch on and observe gas collecting at both electrodes",
        "Test gases — H₂ pops with a flame, O₂ relights a glowing splint",
      ],
    },
    "ph-scale": {
      materials: ["pH paper strips", "Sample solutions (lemon, milk, soap)", "Glass rod", "pH color chart"],
      safety: ["Avoid touching chemicals with bare hands", "Do not taste any sample"],
      formula: "pH = −log₁₀[H⁺]   (range 0–14)",
      steps: [
        "Place a drop of sample solution on pH paper",
        "Observe the color change",
        "Match the color with the pH chart",
        "Record pH — <7 acidic, =7 neutral, >7 basic",
      ],
    },
    "periodic": {
      materials: ["Periodic table chart", "Element reference cards", "Notebook"],
      safety: ["No safety risks — reference study"],
      formula: "Period = principal shell;  Group = valence electrons",
      steps: [
        "Observe the layout — 18 groups, 7 periods",
        "Note group 1 (alkali metals) and group 18 (noble gases)",
        "Identify metals, non-metals, and metalloids",
        "Find trends: atomic size ↓ across a period, ↑ down a group",
      ],
    },
    "projectile": {
      materials: ["Projectile launcher", "Steel ball", "Measuring tape", "Protractor", "Carbon paper & target sheet"],
      safety: ["Wear safety goggles", "Never look into the launcher barrel", "Clear the launch area"],
      formula: "Range R = (v² · sin 2θ) / g",
      steps: [
        "Set the launcher to a 45° angle",
        "Load the steel ball and fire",
        "Measure the horizontal range",
        "Repeat at 30° and 60° — compare ranges",
      ],
    },
    "gravity": {
      materials: ["Different masses (ball, paper, feather)", "Vacuum tube (Guinea & feather)", "Stopwatch", "Measuring tape"],
      safety: ["Drop objects safely away from feet"],
      formula: "g ≈ 9.8 m/s²  (Earth)   |   F = m·g",
      steps: [
        "Drop a ball from a known height",
        "Measure time to fall; compute g = 2h / t²",
        "Compare gravity on Moon (g/6) and Jupiter (2.5g)",
        "Note: in a vacuum, all objects fall at the same rate",
      ],
    },
    "circuit": {
      materials: ["Battery (3V or 6V)", "Connecting wires", "Bulb", "Switch", "Bulb holder"],
      safety: ["Check polarity before connecting", "Do not short-circuit the battery", "Wires must be insulated"],
      formula: "Ohm's Law:  V = I · R",
      steps: [
        "Connect battery positive to switch via wire",
        "Connect switch to bulb holder",
        "Complete the loop back to battery negative",
        "Close the switch — the bulb glows",
      ],
    },
    "pendulum": {
      materials: ["String (~1 m)", "Bob (small metal ball)", "Stand with clamp", "Stopwatch", "Protractor"],
      safety: ["Ensure the stand is stable — clamp firmly"],
      formula: "T = 2π · √(L / g)",
      steps: [
        "Suspend the bob from a fixed clamp",
        "Pull the bob to a small angle (<15°) and release",
        "Time 20 oscillations and divide by 20",
        "Compare with T = 2π√(L/g)",
      ],
    },
    "wave": {
      materials: ["Ripple tank", "Water", "Vibrator or dropper", "Stroboscope (optional)", "White paper screen"],
      safety: ["Care with electrical equipment near water"],
      formula: "v = f · λ",
      steps: [
        "Fill the ripple tank with shallow water",
        "Create waves using the vibrator",
        "Observe the wave pattern on the screen below",
        "Measure wavelength and frequency; verify v = fλ",
      ],
    },
    "heart": {
      materials: ["3D heart model", "Anatomy chart", "Stethoscope (optional)"],
      safety: ["No biological risks — use models only"],
      formula: "Cardiac Output = Heart Rate × Stroke Volume",
      steps: [
        "Identify the 4 chambers — RA, RV, LA, LV",
        "Trace blood flow: body → RA → RV → lungs → LA → LV → body",
        "Note the valves (tricuspid, bicuspid, semilunar)",
        "Compare oxygenated vs deoxygenated sides",
      ],
    },
    "photosynthesis": {
      materials: ["Potted plant (e.g., hydrilla)", "Beaker", "Funnel", "Test tube", "Water"],
      safety: ["Handle glassware carefully"],
      formula: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂↑",
      steps: [
        "Place hydrilla twigs in a beaker of water",
        "Cover with an inverted funnel",
        "Invert a water-filled test tube over the funnel",
        "Place in sunlight — O₂ bubbles collect in the tube",
      ],
    },
    "cell": {
      materials: ["Microscope", "Onion bulb", "Slide & coverslip", "Iodine stain", "Forceps"],
      safety: ["Handle the microscope carefully", "Iodine stains — avoid contact"],
      formula: "Cell = membrane + cytoplasm + nucleus",
      steps: [
        "Peel a thin layer of onion epidermis",
        "Mount on a slide with a drop of water",
        "Add iodine stain and coverslip",
        "Observe under microscope — note nucleus, cell wall, cytoplasm",
      ],
    },
    "dna": {
      materials: ["DNA model kit (or 3D software)", "Anatomy chart"],
      safety: ["No biological risks — model only"],
      formula: "A=T,  G≡C   (Chargaff's rule)",
      steps: [
        "Identify the sugar-phosphate backbone",
        "Note base pairs: Adenine-Thymine, Guanine-Cytosine",
        "Observe the antiparallel double helix",
        "Understand replication: strands unzip and copy",
      ],
    },
    "earthquake": {
      materials: ["Seismograph model", "Tray with sand", "Small building blocks", "Ruler"],
      safety: ["Stable table — don't shake the table itself"],
      formula: "Richter magnitude M = log₁₀(A) + f(d)",
      steps: [
        "Set up model buildings on a sand tray",
        "Tap the tray lightly to simulate a quake",
        "Observe which buildings shake most",
        "Discuss how magnitude, depth, and soil affect damage",
      ],
    },
    "climate": {
      materials: ["Two sealed jars", "Thermometers", "Heat lamp (or sunlight)", "CO₂ source (vinegar + baking soda)"],
      safety: ["Heat lamp gets hot — do not touch", "Wear goggles when handling vinegar"],
      formula: "ΔT ∝ ΔCO₂   (greenhouse effect)",
      steps: [
        "Fill both jars with air; add CO₂ to one",
        "Insert thermometers and seal both jars",
        "Place both under a heat lamp for 10 minutes",
        "Compare temperatures — the CO₂ jar is warmer",
      ],
    },
    "volcano": {
      materials: ["Model volcano (clay cone)", "Baking soda", "Vinegar", "Red food coloring", "Dish soap"],
      safety: ["Wear goggles", "Do this outdoors or over a tray"],
      formula: "NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂↑",
      steps: [
        "Place baking soda inside the volcano crater",
        "Add red food coloring + dish soap",
        "Pour vinegar into the crater",
        "Watch the 'lava' erupt — CO₂ bubbles expand the foam",
      ],
    },
    "graph": {
      materials: ["Graph paper", "Pencil", "Ruler", "Calculator"],
      safety: ["No risks"],
      formula: "y = f(x),  e.g., y = ax² + bx + c",
      steps: [
        "Choose a function (e.g., y = x²)",
        "Make a table of x and y values",
        "Plot points on graph paper",
        "Connect points to draw the curve",
      ],
    },
    "pythagoras": {
      materials: ["Graph paper", "Ruler", "Right triangle cut-outs", "Colored paper squares"],
      safety: ["No risks"],
      formula: "a² + b² = c²",
      steps: [
        "Draw a right triangle with legs a and b",
        "Construct squares on each side",
        "Measure the areas of squares on a and b",
        "Their sum equals the area of the square on hypotenuse (c²)",
      ],
    },
    "probability": {
      materials: ["Two dice", "Coins", "Deck of cards", "Notebook for tally"],
      safety: ["No risks"],
      formula: "P(E) = favorable outcomes / total outcomes",
      steps: [
        "Roll two dice 50 times, record sums",
        "Tally frequencies of each sum (2–12)",
        "Compare experimental vs theoretical probability",
        "Repeat with coin flips — P(heads) should approach 0.5",
      ],
    },
    "solar": {
      materials: ["Solar system model or chart", "Planet fact cards"],
      safety: ["No risks"],
      formula: "Kepler's 3rd Law:  T² ∝ R³",
      steps: [
        "Identify the 8 planets in order from the Sun",
        "Note differences in size, distance, and composition",
        "Compare terrestrial vs gas giants",
        "Discuss orbital periods and Kepler's laws",
      ],
    },
    "moon": {
      materials: ["Lamp (sun)", "Styrofoam ball (moon)", "Earth globe", "Dark room"],
      safety: ["Lamp gets hot — let it cool before touching"],
      formula: "Lunar cycle = 29.5 days",
      steps: [
        "Place the Earth globe in the center",
        "Orbit the moon ball around Earth",
        "Observe the lit portion from Earth's view",
        "Identify 8 phases: New, Waxing Crescent, First Quarter, Waxing Gibbous, Full, Waning Gibbous, Last Quarter, Waning Crescent",
      ],
    },
    "blackhole": {
      materials: ["Stretchy fabric (spandex)", "Heavy ball (massive object)", "Small marbles (particles)"],
      safety: ["Stretchy fabric may snap — handle with care"],
      formula: "Schwarzschild radius:  Rs = 2GM / c²",
      steps: [
        "Stretch fabric over a frame",
        "Place heavy ball in center — creates a 'well'",
        "Roll marbles around — they spiral inward",
        "Observe event-horizon behavior",
      ],
    },
  };
  return (
    D[experiment.id] || {
      materials: ["Standard lab equipment"],
      safety: ["Wear safety goggles", "Follow lab instructions"],
      formula: "—",
      steps: ["Follow the procedure as guided by your instructor"],
    }
  );
}

// ===== Canvas draw helpers =====
type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, color: string) => void;

function alphaHex(a: number): string {
  const v = Math.max(0, Math.min(255, Math.floor(a * 255)));
  return v.toString(16).padStart(2, "0");
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---------- Chemistry ----------
const drawAcidMetal: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2 + 10;
  const bw = 90, bh = 120;
  // Beaker
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, cy - bh / 2);
  ctx.lineTo(cx - bw / 2 + 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2 - 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2, cy - bh / 2);
  ctx.stroke();
  // Rim
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 - 6, cy - bh / 2);
  ctx.lineTo(cx + bw / 2 + 6, cy - bh / 2);
  ctx.stroke();
  // Acid (pale yellow)
  const liquidTop = cy - 10;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + 6, liquidTop);
  ctx.lineTo(cx - bw / 2 + 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2 - 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2 - 6, liquidTop);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,240,150,0.35)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,150,0.6)";
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + 6, liquidTop);
  ctx.lineTo(cx + bw / 2 - 6, liquidTop);
  ctx.stroke();
  // Magnesium strip
  ctx.fillStyle = "rgba(180,180,190,0.9)";
  ctx.fillRect(cx - 18, cy + bh / 2 - 24, 36, 8);
  ctx.fillStyle = "rgba(220,220,230,0.5)";
  ctx.fillRect(cx - 18, cy + bh / 2 - 24, 36, 2);
  // Rising H2 bubbles
  for (let i = 0; i < 14; i++) {
    const phase = (t * 1.5 + i * 0.4) % 2.5;
    const y = cy + bh / 2 - 18 - phase * 30;
    if (y < liquidTop) continue;
    const x = cx + Math.sin(t * 2 + i) * 15;
    const size = 2 + Math.sin(phase * 4) * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(230,230,240,${0.7 - phase * 0.2})`;
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("H₂ ↑", cx, cy - bh / 2 - 12);
};

const drawAcidBase: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2 + 10;
  const bw = 90, bh = 120;
  const cycle = (Math.sin(t * 0.6) + 1) / 2;
  // Beaker
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, cy - bh / 2);
  ctx.lineTo(cx - bw / 2 + 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2 - 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2, cy - bh / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 - 6, cy - bh / 2);
  ctx.lineTo(cx + bw / 2 + 6, cy - bh / 2);
  ctx.stroke();
  // Liquid — clear → pink
  const liquidTop = cy - 15;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + 6, liquidTop);
  ctx.lineTo(cx - bw / 2 + 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2 - 8, cy + bh / 2);
  ctx.lineTo(cx + bw / 2 - 6, liquidTop);
  ctx.closePath();
  ctx.fillStyle = `rgba(244,${Math.floor(180 - cycle * 80)},${Math.floor(200 - cycle * 40)},${0.2 + cycle * 0.55})`;
  ctx.fill();
  // Swirl
  ctx.strokeStyle = `rgba(255,255,255,${0.3 * cycle})`;
  ctx.lineWidth = 1;
  for (let r = 5; r < 25; r += 6) {
    ctx.beginPath();
    ctx.arc(cx + Math.sin(t * 2) * 4, cy + 20, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Drop falling from pipette
  const dropY = cy - bh / 2 - 30 + ((t * 60) % 30);
  ctx.beginPath();
  ctx.arc(cx, dropY, 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(244,100,160,0.8)";
  ctx.fill();
  // Pipette
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - bh / 2 - 35);
  ctx.lineTo(cx + 5, cy - bh / 2 - 35);
  ctx.lineTo(cx + 2, cy - bh / 2 - 25);
  ctx.lineTo(cx - 2, cy - bh / 2 - 25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(cycle > 0.5 ? "Pink = Basic" : "Clear = Acidic", cx, cy + bh / 2 + 22);
};

const drawElectrolysis: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2 + 10;
  const bw = 140, bh = 130;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
  // Water
  ctx.fillStyle = "rgba(100,180,255,0.2)";
  ctx.fillRect(cx - bw / 2 + 2, cy - bh / 2 + 30, bw - 4, bh - 32);
  // Electrodes
  const leftX = cx - 30, rightX = cx + 30;
  ctx.strokeStyle = "rgba(180,180,200,0.8)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(leftX, cy - bh / 2 + 10);
  ctx.lineTo(leftX, cy + bh / 2 - 10);
  ctx.moveTo(rightX, cy - bh / 2 + 10);
  ctx.lineTo(rightX, cy + bh / 2 - 10);
  ctx.stroke();
  // Wires
  ctx.strokeStyle = "rgba(220,80,80,0.8)";
  ctx.beginPath();
  ctx.moveTo(leftX, cy - bh / 2 + 10);
  ctx.lineTo(leftX, cy - bh / 2 - 25);
  ctx.lineTo(cx - 15, cy - bh / 2 - 25);
  ctx.stroke();
  ctx.strokeStyle = "rgba(80,80,220,0.8)";
  ctx.beginPath();
  ctx.moveTo(rightX, cy - bh / 2 + 10);
  ctx.lineTo(rightX, cy - bh / 2 - 25);
  ctx.lineTo(cx + 15, cy - bh / 2 - 25);
  ctx.stroke();
  // Battery
  ctx.fillStyle = "rgba(40,40,40,0.9)";
  ctx.fillRect(cx - 18, cy - bh / 2 - 35, 36, 14);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("+  −", cx, cy - bh / 2 - 25);
  // H2 bubbles (left, more)
  for (let i = 0; i < 12; i++) {
    const phase = (t * 1.2 + i * 0.3) % 2.5;
    const y = cy + bh / 2 - 15 - phase * 35;
    if (y < cy - bh / 2 + 30) continue;
    const x = leftX + Math.sin(t * 3 + i) * 6;
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.sin(phase * 5) * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,220,230,${0.7 - phase * 0.2})`;
    ctx.fill();
  }
  // O2 bubbles (right, fewer — 2:1 ratio)
  for (let i = 0; i < 6; i++) {
    const phase = (t * 1.2 + i * 0.6) % 2.5;
    const y = cy + bh / 2 - 15 - phase * 35;
    if (y < cy - bh / 2 + 30) continue;
    const x = rightX + Math.sin(t * 3 + i) * 6;
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + Math.sin(phase * 5) * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(150,200,255,${0.7 - phase * 0.2})`;
    ctx.fill();
  }
  ctx.fillStyle = "rgba(220,220,230,0.7)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("H₂ (2 vol)", leftX, cy + bh / 2 + 16);
  ctx.fillText("O₂ (1 vol)", rightX, cy + bh / 2 + 16);
};

const drawPhScale: DrawFn = (ctx, w, h, t) => {
  const padding = 30;
  const barW = (w - padding * 2) / 14;
  const baseY = h - 50;
  const maxH = h - 100;
  const phColors = [
    "#ff3b30", "#ff5e3a", "#ff9500", "#ffcc00", "#fcff00", "#d4ff00", "#a3ff00",
    "#34c759",
    "#00d4a3", "#00c7be", "#5ac8fa", "#007aff", "#5856d6", "#af52de",
  ];
  for (let i = 0; i < 14; i++) {
    const x = padding + i * barW;
    const pulse = (Math.sin(t * 2 + i * 0.4) + 1) / 2;
    const barH = maxH * (0.4 + pulse * 0.4);
    ctx.fillStyle = phColors[i];
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x + 2, baseY - barH, barW - 4, barH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${i}`, x + barW / 2, baseY + 14);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, baseY);
  ctx.lineTo(w - padding, baseY);
  ctx.stroke();
  // Moving indicator
  const indicatorPh = (t * 1.5) % 14;
  const ix = padding + indicatorPh * barW + barW / 2;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(ix, baseY - maxH - 12);
  ctx.lineTo(ix - 6, baseY - maxH - 22);
  ctx.lineTo(ix + 6, baseY - maxH - 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`pH = ${Math.floor(indicatorPh)}`, ix, baseY - maxH - 28);
  ctx.fillStyle = "rgba(255,80,80,0.7)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("← Acidic", padding, baseY + 30);
  ctx.fillStyle = "rgba(80,80,255,0.7)";
  ctx.textAlign = "right";
  ctx.fillText("Basic →", w - padding, baseY + 30);
};

const drawPeriodic: DrawFn = (ctx, w, h, t) => {
  const cols = 18, rows = 7;
  const padding = 20;
  const cellW = (w - padding * 2) / cols;
  const cellH = (h - padding * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isOccupied =
        (r === 0 && (c === 0 || c === 17)) ||
        (r === 1 && (c === 0 || c === 1 || (c >= 12 && c <= 17))) ||
        (r >= 2 && r <= 3 && (c === 0 || c === 1 || (c >= 12 && c <= 17) || (c >= 2 && c <= 11))) ||
        (r >= 4 && r <= 5 && (c === 0 || c === 1 || c === 17 || c === 16 || (c >= 2 && c <= 11))) ||
        (r === 6 && c >= 2 && c <= 11);
      if (!isOccupied) continue;
      const x = padding + c * cellW;
      const y = padding + r * cellH;
      let cellColor = "#444";
      if (c === 0) cellColor = "#ff6b6b";
      else if (c === 1) cellColor = "#ffa94d";
      else if (c === 17) cellColor = "#9775fa";
      else if (c === 16) cellColor = "#4dabf7";
      else if (c >= 2 && c <= 11 && r >= 3 && r <= 5) cellColor = "#ffd43b";
      else if (c >= 12 && c <= 16 && r >= 2 && r <= 4) cellColor = "#a9e34b";
      else cellColor = "#69db7c";
      const pulse = (Math.sin(t * 1.5 + c * 0.3 + r * 0.5) + 1) / 2;
      ctx.fillStyle = cellColor;
      ctx.globalAlpha = 0.3 + pulse * 0.5;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Periodic Table of Elements", w / 2, padding - 6);
};

// ---------- Physics ----------
const drawProjectile: DrawFn = (ctx, w, h, t, color) => {
  const groundY = h - 40;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
  const launchX = 50;
  const launchY = groundY - 20;
  const angle = Math.PI / 4;
  const v0 = 80;
  const g = 30;
  // Trajectory (dashed)
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let dt = 0; dt < 8; dt += 0.05) {
    const x = launchX + v0 * Math.cos(angle) * dt * (w / 200);
    const y = launchY - (v0 * Math.sin(angle) * dt - 0.5 * g * dt * dt) * (h / 200);
    if (x > w || y > groundY) break;
    if (dt === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Moving ball with trail
  const cycle = 4;
  const dt = t % cycle;
  const x = launchX + v0 * Math.cos(angle) * dt * (w / 200);
  const y = launchY - (v0 * Math.sin(angle) * dt - 0.5 * g * dt * dt) * (h / 200);
  for (let i = 0; i < 8; i++) {
    const sdt = dt - i * 0.05;
    if (sdt < 0) break;
    const sx = launchX + v0 * Math.cos(angle) * sdt * (w / 200);
    const sy = launchY - (v0 * Math.sin(angle) * sdt - 0.5 * g * sdt * sdt) * (h / 200);
    if (sy > groundY) break;
    ctx.beginPath();
    ctx.arc(sx, sy, 4 - i * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = color + alphaHex(1 - i / 8);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(Math.min(x, w - 10), Math.min(y, groundY - 5), 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  // Cannon
  ctx.save();
  ctx.translate(launchX, launchY);
  ctx.rotate(-angle);
  ctx.fillStyle = "rgba(180,180,200,0.8)";
  ctx.fillRect(0, -5, 30, 10);
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("θ = 45°", launchX + 50, launchY - 25);
};

const drawGravity: DrawFn = (ctx, w, h, t) => {
  const groundY = h - 40;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
  const balls = [
    { x: w * 0.25, color: "#10b981", g: 0.3, size: 8, label: "Earth g" },
    { x: w * 0.5, color: "#f59e0b", g: 0.12, size: 6, label: "Moon g/6" },
    { x: w * 0.75, color: "#ef4444", g: 0.7, size: 10, label: "Jupiter 2.5g" },
  ];
  balls.forEach((b, idx) => {
    const cycle = 2.5;
    const dt = (t + idx * 0.5) % cycle;
    const startY = 30;
    const y = startY + (b.g * 1000 * dt * dt) / 2;
    const clampedY = Math.min(y, groundY - b.size);
    for (let i = 1; i < 6; i++) {
      const trailY = clampedY - i * 8;
      if (trailY < startY) break;
      ctx.beginPath();
      ctx.arc(b.x, trailY, b.size - i * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = b.color + alphaHex(1 - i / 6);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(b.x, clampedY, b.size, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.label, b.x, groundY + 18);
  });
};

const drawCircuit: DrawFn = (ctx, w, h, t, color) => {
  const cx = w / 2, cy = h / 2;
  const cw = Math.min(w * 0.7, 280);
  const ch = Math.min(h * 0.5, 150);
  const left = cx - cw / 2, top = cy - ch / 2, right = cx + cw / 2, bottom = cy + ch / 2;
  ctx.strokeStyle = "rgba(220,180,80,0.6)";
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, cw, ch);
  // Battery
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left - 8, cy - 10);
  ctx.lineTo(left + 8, cy - 10);
  ctx.moveTo(left - 4, cy + 10);
  ctx.lineTo(left + 4, cy + 10);
  ctx.stroke();
  // Bulb
  const pulse = (Math.sin(t * 4) + 1) / 2;
  const grad = ctx.createRadialGradient(right, cy, 5, right, cy, 40);
  grad.addColorStop(0, `rgba(255,220,100,${0.3 * pulse})`);
  grad.addColorStop(1, "rgba(255,220,100,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(right, cy, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(right, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,${200 + pulse * 55},${100 + pulse * 100},${0.4 + pulse * 0.5})`;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,220,100,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Flowing electrons
  const numE = 8;
  const perimeter = 2 * (cw + ch);
  for (let i = 0; i < numE; i++) {
    const dist = (t * 80 + i * (perimeter / numE)) % perimeter;
    let ex = 0, ey = 0;
    if (dist < cw) { ex = left + dist; ey = top; }
    else if (dist < cw + ch) { ex = right; ey = top + (dist - cw); }
    else if (dist < 2 * cw + ch) { ex = right - (dist - cw - ch); ey = bottom; }
    else { ex = left; ey = bottom - (dist - 2 * cw - ch); }
    ctx.beginPath();
    ctx.arc(ex, ey, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100,180,255,0.9)";
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Battery", left, bottom + 18);
  ctx.fillText("Bulb", right, bottom + 18);
  ctx.fillText("Electron flow →", cx, top - 12);
};

const drawPendulum: DrawFn = (ctx, w, h, t, color) => {
  const pivotX = w / 2, pivotY = 60;
  const length = Math.min(h - 130, 220);
  const angle = Math.sin(t * 1.5) * 0.7;
  const bobX = pivotX + Math.sin(angle) * length;
  const bobY = pivotY + Math.cos(angle) * length;
  // Arc trace
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, length, Math.PI / 2 - 0.7, Math.PI / 2 + 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  // Ceiling
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pivotX - 30, 40);
  ctx.lineTo(pivotX + 30, 40);
  ctx.stroke();
  for (let i = -28; i < 30; i += 6) {
    ctx.beginPath();
    ctx.moveTo(pivotX + i, 40);
    ctx.lineTo(pivotX + i - 4, 36);
    ctx.stroke();
  }
  // Pivot
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
  ctx.fill();
  // String
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.stroke();
  // Bob
  const grad = ctx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, 16);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color + "80");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(bobX, bobY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`θ = ${(angle * 180 / Math.PI).toFixed(0)}°`, pivotX, 24);
};

const drawWave: DrawFn = (ctx, w, h, t, color) => {
  const cy = h / 2;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();
  const waves = [
    { freq: 0.02, amp: 40, speed: 2, color, lw: 2.5 },
    { freq: 0.04, amp: 20, speed: 3, color: "#f59e0b", lw: 1.5 },
    { freq: 0.015, amp: 30, speed: -1.5, color: "#06b6d4", lw: 1.5 },
  ];
  waves.forEach((wv) => {
    ctx.strokeStyle = wv.color;
    ctx.lineWidth = wv.lw;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = cy + Math.sin(x * wv.freq + t * wv.speed) * wv.amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * w;
    const y = cy + Math.sin(x * 0.02 + t * 2) * 40;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("λ (wavelength)", 20, cy - 50);
};

// ---------- Biology ----------
const drawHeart: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2 - 10;
  const pulse = Math.pow(Math.sin(t * 3), 2);
  const scale = 1 + pulse * 0.15;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-30, -10, -40, 20, 0, 50);
  ctx.bezierCurveTo(40, 20, 30, -10, 0, 30);
  ctx.closePath();
  const grad = ctx.createRadialGradient(-5, 5, 5, 0, 20, 50);
  grad.addColorStop(0, "#ff6b8a");
  grad.addColorStop(1, "#c81e3a");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // Blood particles
  for (let i = 0; i < 10; i++) {
    const phase = (t * 2 + i * 0.5) % 2;
    const ang = (i / 10) * Math.PI * 2;
    const dist = 60 + phase * 60;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    if (phase > 1.5) continue;
    ctx.beginPath();
    ctx.arc(x, y, 3 * (1 - phase / 1.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,40,60,${0.6 - phase * 0.3})`;
    ctx.fill();
  }
  // ECG line
  ctx.strokeStyle = "rgba(80,220,120,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < w; x += 2) {
    const tx = (x / w) * 4 - t * 2;
    let y = h - 30;
    const sp = ((tx % 1) + 1) % 1;
    if (sp > 0.4 && sp < 0.45) y -= 5;
    else if (sp >= 0.45 && sp < 0.48) y -= 30;
    else if (sp >= 0.48 && sp < 0.5) y += 20;
    else if (sp >= 0.5 && sp < 0.53) y -= 10;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`❤ ${Math.round(72 + pulse * 8)} BPM`, cx, h - 8);
};

const drawPhotosynthesis: DrawFn = (ctx, w, h, t) => {
  const groundY = h - 30;
  ctx.fillStyle = "rgba(120,80,40,0.6)";
  ctx.fillRect(0, groundY, w, 30);
  ctx.strokeStyle = "rgba(180,120,80,0.4)";
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
  // Sun
  const sunX = w - 60, sunY = 50;
  const sunPulse = (Math.sin(t * 2) + 1) / 2;
  ctx.strokeStyle = `rgba(255,220,80,${0.4 + sunPulse * 0.3})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(sunX + Math.cos(a) * 22, sunY + Math.sin(a) * 22);
    ctx.lineTo(sunX + Math.cos(a) * (32 + sunPulse * 4), sunY + Math.sin(a) * (32 + sunPulse * 4));
    ctx.stroke();
  }
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 22);
  sunGrad.addColorStop(0, "#fff8b0");
  sunGrad.addColorStop(1, "#fbbf24");
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 20, 0, Math.PI * 2);
  ctx.fill();
  // Plant
  const plantX = w / 2;
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(plantX, groundY);
  ctx.quadraticCurveTo(plantX - 5, groundY - 60, plantX, groundY - 100);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const ly = groundY - 30 - i * 25;
    const side = i % 2 === 0 ? -1 : 1;
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.ellipse(plantX + side * 18, ly, 18, 8, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Flower
  ctx.fillStyle = "#ec4899";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t;
    ctx.beginPath();
    ctx.arc(plantX + Math.cos(a) * 8, groundY - 100 + Math.sin(a) * 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(plantX, groundY - 100, 4, 0, Math.PI * 2);
  ctx.fill();
  // O2 bubbles
  for (let i = 0; i < 8; i++) {
    const phase = (t * 1.2 + i * 0.5) % 3;
    const ly = groundY - 30 - (i % 3) * 25;
    const side = (i % 2 === 0 ? -1 : 1) * 18;
    const x = plantX + side + Math.sin(t + i) * 5;
    const y = ly - phase * 40;
    if (y < 30) continue;
    ctx.beginPath();
    ctx.arc(x, y, 3 + Math.sin(phase * 4) * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,240,200,${0.7 - phase * 0.2})`;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("O₂", x, y - 4);
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", 12, 20);
};

const drawCell: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.35;
  ctx.fillStyle = "rgba(180,220,255,0.15)";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,180,220,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Cytoplasm shimmer
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.5;
    const r = R * 0.7;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fill();
  }
  // Nucleus
  const nucR = R * 0.3;
  ctx.fillStyle = "rgba(120,80,180,0.6)";
  ctx.beginPath();
  ctx.arc(cx, cy, nucR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(180,140,220,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(80,40,120,0.8)";
  ctx.beginPath();
  ctx.arc(cx + 5, cy - 3, nucR * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Mitochondria
  const mitoPos = [
    { x: cx - R * 0.55, y: cy - R * 0.3, r: 0 },
    { x: cx + R * 0.5, y: cy + R * 0.35, r: 0.5 },
    { x: cx - R * 0.4, y: cy + R * 0.45, r: 1 },
  ];
  mitoPos.forEach((m, i) => {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.r + Math.sin(t + i) * 0.2);
    ctx.fillStyle = "rgba(220,80,60,0.6)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,150,100,0.5)";
    ctx.lineWidth = 1;
    for (let j = -1; j <= 1; j++) {
      ctx.beginPath();
      ctx.moveTo(j * 5, -6);
      ctx.lineTo(j * 5, 6);
      ctx.stroke();
    }
    ctx.restore();
  });
  // Small vesicles
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.3;
    const r = R * 0.6;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100,200,180,0.5)";
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Nucleus", cx, cy + nucR + 14);
  ctx.fillStyle = "rgba(220,120,100,0.8)";
  ctx.fillText("Mitochondria", cx - R * 0.55, cy - R * 0.3 - 12);
};

const drawDna: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2;
  const amp = Math.min(w * 0.15, 60);
  const phase = t * 2;
  // Two helix strands
  for (let strand = 0; strand < 2; strand++) {
    const offset = strand * Math.PI;
    ctx.beginPath();
    for (let y = 20; y < h - 20; y += 2) {
      const x = cx + Math.sin(y * 0.04 + phase + offset) * amp;
      if (y === 20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = strand === 0 ? "#06b6d4" : "#a855f7";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // Base-pair rungs
  const bpColors = ["#10b981", "#f59e0b", "#ec4899", "#3b82f6"];
  for (let y = 20; y < h - 20; y += 16) {
    const x1 = cx + Math.sin(y * 0.04 + phase) * amp;
    const x2 = cx + Math.sin(y * 0.04 + phase + Math.PI) * amp;
    const bpIdx = Math.floor(y / 16) % 4;
    ctx.strokeStyle = bpColors[bpIdx];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.fillStyle = bpColors[bpIdx];
    ctx.beginPath();
    ctx.arc(x1, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x2, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("A-T  G-C  base pairing", 12, 18);
};

// ---------- Geography ----------
const drawEarthquake: DrawFn = (ctx, w, h, t, color) => {
  const cx = w / 2, cy = h / 2 - 10;
  for (let i = 0; i < 6; i++) {
    const phase = (t * 0.8 + i * 0.5) % 3;
    const r = phase * Math.min(w, h) * 0.3;
    if (r < 5) continue;
    const alpha = Math.max(0, 1 - phase / 3);
    ctx.strokeStyle = color + alphaHex(alpha * 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2 + 0.1; a += 0.1) {
      const wobble = Math.sin(a * 8 + t * 5) * 3;
      const wr = r + wobble;
      const x = cx + Math.cos(a) * wr;
      const y = cy + Math.sin(a) * wr;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = color + alphaHex(alpha * 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Epicenter
  const pulse = (Math.sin(t * 4) + 1) / 2;
  ctx.fillStyle = `rgba(255,80,40,${0.6 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 8 + pulse * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,220,80,0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  // Buildings shaking
  for (let i = 0; i < 5; i++) {
    const x = 30 + (i * (w - 60)) / 4;
    const bH = 30 + (i % 3) * 15;
    const shake = Math.sin(t * 8 + i) * 3;
    ctx.fillStyle = "rgba(120,120,140,0.7)";
    ctx.fillRect(x - 8 + shake, h - 30 - bH, 16, bH);
    ctx.fillStyle = "rgba(255,220,100,0.4)";
    ctx.fillRect(x - 5 + shake, h - 25 - bH, 3, 3);
    ctx.fillRect(x + 1 + shake, h - 25 - bH, 3, 3);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.moveTo(0, h - 30);
  ctx.lineTo(w, h - 30);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Seismic waves from epicenter", cx, 20);
};

const drawClimate: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2 - 60;
  const topY = 40, botY = h - 80;
  const thermoH = botY - topY;
  const thermoW = 16;
  // Thermometer
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - thermoW / 2, topY);
  ctx.lineTo(cx - thermoW / 2, botY);
  ctx.arc(cx, botY, thermoW / 2 + 8, Math.PI, 0, true);
  ctx.lineTo(cx + thermoW / 2, topY);
  ctx.stroke();
  ctx.fillStyle = "rgba(60,60,80,0.5)";
  ctx.beginPath();
  ctx.arc(cx, botY + 8, thermoW / 2 + 8, 0, Math.PI * 2);
  ctx.fill();
  // Mercury
  const level = (Math.sin(t * 0.5) + 1) / 2;
  const mercTop = botY - level * thermoH * 0.8;
  const mercGrad = ctx.createLinearGradient(0, mercTop, 0, botY);
  mercGrad.addColorStop(0, "#ef4444");
  mercGrad.addColorStop(1, "#dc2626");
  ctx.fillStyle = mercGrad;
  ctx.fillRect(cx - thermoW / 2 + 2, mercTop, thermoW - 4, botY - mercTop);
  ctx.beginPath();
  ctx.arc(cx, botY + 8, thermoW / 2 + 5, 0, Math.PI * 2);
  ctx.fill();
  // Scale
  for (let i = 0; i <= 10; i++) {
    const y = botY - (i / 10) * thermoH * 0.8;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + thermoW / 2, y);
    ctx.lineTo(cx + thermoW / 2 + 5, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${10 + i * 5}°`, cx + thermoW / 2 + 8, y + 3);
  }
  ctx.fillStyle = "rgba(255,180,80,0.9)";
  ctx.font = "bold 18px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${(10 + level * 50).toFixed(0)}°C`, cx, h - 20);
  // CO2 chart
  const chartX = w / 2 + 40;
  const chartW = w - chartX - 30;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chartX, topY);
  ctx.lineTo(chartX, botY);
  ctx.lineTo(chartX + chartW, botY);
  ctx.stroke();
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 50; i++) {
    const px = chartX + (i / 50) * chartW;
    const co2 = 280 + (i / 50) * 130 + Math.sin(t + i * 0.3) * 5;
    const py = botY - ((co2 - 280) / 150) * thermoH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CO₂ (ppm)", chartX + chartW / 2, botY + 16);
  ctx.fillText("Rising Temperature ↑", cx, topY - 10);
};

const drawVolcano: DrawFn = (ctx, w, h, t) => {
  const groundY = h - 30;
  const peakX = w / 2;
  const peakY = h * 0.4;
  ctx.fillStyle = "rgba(80,50,30,0.6)";
  ctx.fillRect(0, groundY, w, 30);
  // Mountain
  ctx.fillStyle = "#52525b";
  ctx.beginPath();
  ctx.moveTo(peakX - 110, groundY);
  ctx.lineTo(peakX - 20, peakY + 10);
  ctx.lineTo(peakX + 20, peakY + 10);
  ctx.lineTo(peakX + 110, groundY);
  ctx.closePath();
  ctx.fill();
  // Lava streams
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 4;
  for (let i = -1; i <= 1; i += 2) {
    const phase = (t * 0.8 + (i + 1)) % 2;
    if (phase > 1.5) continue;
    ctx.beginPath();
    ctx.moveTo(peakX + i * 15, peakY + 10);
    ctx.lineTo(peakX + i * (30 + phase * 40), peakY + 30 + phase * 50);
    ctx.stroke();
  }
  // Erupting particles
  const colors = ["#fbbf24", "#f97316", "#dc2626"];
  for (let i = 0; i < 20; i++) {
    const phase = (t * 1.2 + i * 0.3) % 2.5;
    if (phase > 2) continue;
    const ang = -Math.PI / 2 + (i / 20 - 0.5) * 1.4;
    const v = 80 + (i % 3) * 30;
    const px = peakX + Math.cos(ang) * v * phase;
    const py = peakY + Math.sin(ang) * v * phase + phase * phase * 50;
    if (py > groundY) continue;
    const size = 2 + (1 - phase / 2.5) * 3;
    ctx.fillStyle = colors[i % 3];
    ctx.globalAlpha = Math.max(0, 1 - phase / 2.5);
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Ash cloud
  for (let i = 0; i < 5; i++) {
    const cx2 = peakX + (i - 2) * 20;
    const cy2 = peakY - 20 - Math.sin(t + i) * 5;
    ctx.fillStyle = `rgba(80,80,80,${0.4 - i * 0.05})`;
    ctx.beginPath();
    ctx.arc(cx2, cy2, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  // Crater glow
  const glowPulse = (Math.sin(t * 3) + 1) / 2;
  const glowGrad = ctx.createRadialGradient(peakX, peakY, 2, peakX, peakY, 30);
  glowGrad.addColorStop(0, `rgba(255,180,40,${0.8 + glowPulse * 0.2})`);
  glowGrad.addColorStop(1, "rgba(255,80,0,0)");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(peakX, peakY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🌋 Volcanic Eruption", w / 2, 20);
};

// ---------- Maths ----------
const drawGraph: DrawFn = (ctx, w, h, t, color) => {
  const cx = w / 2, cy = h / 2;
  const unit = Math.min(w, h) / 8;
  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * unit, 0);
    ctx.lineTo(cx + i * unit, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, cy + i * unit);
    ctx.lineTo(w, cy + i * unit);
    ctx.stroke();
  }
  // Axes
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.stroke();
  // Arrows
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.moveTo(w - 5, cy);
  ctx.lineTo(w - 12, cy - 4);
  ctx.lineTo(w - 12, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, 5);
  ctx.lineTo(cx - 4, 12);
  ctx.lineTo(cx + 4, 12);
  ctx.closePath();
  ctx.fill();
  // Function curve
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const phase = t * 1.5;
  for (let x = 0; x <= w; x += 2) {
    const xi = (x - cx) / unit;
    const yi = Math.sin(xi + phase) * 2 + Math.sin(xi * 0.5 + phase * 0.7);
    const y = cy - yi * unit;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Moving point
  const px = cx + Math.sin(t * 0.5) * unit * 3;
  const pxi = (px - cx) / unit;
  const py = cy - (Math.sin(pxi + phase) * 2 + Math.sin(pxi * 0.5 + phase * 0.7)) * unit;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("y", cx - 6, 16);
  ctx.textAlign = "left";
  ctx.fillText("x", w - 14, cy - 8);
  ctx.textAlign = "center";
  ctx.fillText("f(x) = sin(x) + ½sin(x/2)", cx, h - 12);
};

const drawPythagoras: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2 - 30, cy = h / 2 + 20;
  const a = 70, b = 55;
  const A = { x: cx, y: cy };
  const B = { x: cx + a, y: cy };
  const C = { x: cx, y: cy - b };
  const hyp = Math.sqrt(a * a + b * b);
  const Bp = { x: B.x + b, y: B.y - a };
  const Cp = { x: C.x + b, y: C.y - a };
  const pulse = (Math.sin(t * 1.5) + 1) / 2;
  // Square on a (bottom)
  ctx.fillStyle = `rgba(16,185,129,${0.18 + pulse * 0.15})`;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(B.x, B.y + a);
  ctx.lineTo(A.x, A.y + a);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Square on b (left)
  ctx.fillStyle = `rgba(245,158,11,${0.18 + pulse * 0.15})`;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(C.x, C.y);
  ctx.lineTo(C.x - b, C.y);
  ctx.lineTo(A.x - b, A.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Square on hypotenuse
  ctx.fillStyle = `rgba(168,85,247,${0.18 + pulse * 0.15})`;
  ctx.beginPath();
  ctx.moveTo(B.x, B.y);
  ctx.lineTo(C.x, C.y);
  ctx.lineTo(Cp.x, Cp.y);
  ctx.lineTo(Bp.x, Bp.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Triangle
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(C.x, C.y);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Right-angle indicator
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(A.x + 8, A.y);
  ctx.lineTo(A.x + 8, A.y - 8);
  ctx.lineTo(A.x, A.y - 8);
  ctx.stroke();
  // Labels
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(16,185,129,0.95)";
  ctx.fillText(`a²=${a * a}`, A.x + a / 2, A.y + a / 2);
  ctx.fillStyle = "rgba(245,158,11,0.95)";
  ctx.fillText(`b²=${b * b}`, A.x - b / 2, A.y - b / 2);
  ctx.fillStyle = "rgba(168,85,247,0.95)";
  ctx.fillText(`c²=${Math.round(hyp * hyp)}`, (B.x + Cp.x) / 2, (B.y + Cp.y) / 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("a² + b² = c²", w / 2, 20);
};

const drawProbability: DrawFn = (ctx, w, h, t) => {
  const dice = [
    { x: w / 2 - 55, y: h / 2 },
    { x: w / 2 + 55, y: h / 2 },
  ];
  const dotPositions: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-12, -12], [12, 12]],
    3: [[-12, -12], [0, 0], [12, 12]],
    4: [[-12, -12], [12, -12], [-12, 12], [12, 12]],
    5: [[-12, -12], [12, -12], [0, 0], [-12, 12], [12, 12]],
    6: [[-12, -12], [12, -12], [-12, 0], [12, 0], [-12, 12], [12, 12]],
  };
  let sum = 0;
  dice.forEach((d, idx) => {
    const face = Math.floor((t + idx * 0.5) / 1) % 6 + 1;
    sum += face;
    const rollAnim = (t + idx * 0.5) % 1;
    const rollShake = rollAnim < 0.3 ? Math.sin(rollAnim * 30) * 3 : 0;
    const rollRot = rollAnim < 0.3 ? Math.sin(rollAnim * 20) * 0.3 : 0;
    ctx.save();
    ctx.translate(d.x + rollShake, d.y);
    ctx.rotate(rollRot);
    const size = 56;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    roundedRect(ctx, -size / 2, -size / 2, size, size, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(50,50,50,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    (dotPositions[face] || []).forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  });
  // Spinning coin at top
  const coinPhase = t * 2;
  const coinX = w / 2, coinY = 50;
  const coinW = Math.abs(Math.cos(coinPhase)) * 30 + 5;
  ctx.fillStyle = "#fbbf24";
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(coinX, coinY, coinW, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (coinW > 22) {
    ctx.fillStyle = "#92400e";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("$", coinX, coinY + 4);
  }
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Sum of dice: ${sum}`, w / 2, h - 40);
  ctx.fillText("P(event) = favorable / total", w / 2, h - 20);
};

// ---------- Astronomy ----------
const drawSolar: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2;
  // Stars
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137) % w;
    const sy = (i * 73) % h;
    const twinkle = (Math.sin(t * 2 + i) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + twinkle * 0.4})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sun
  const sunR = 18;
  const sunGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, sunR * 2);
  sunGrad.addColorStop(0, "#fff8b0");
  sunGrad.addColorStop(0.4, "#fbbf24");
  sunGrad.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, sunR * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8b0";
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Planets
  const planets = [
    { dist: 50, size: 3, speed: 1.5, color: "#a8a29e" },
    { dist: 75, size: 5, speed: 1.0, color: "#fbbf24" },
    { dist: 105, size: 5, speed: 0.7, color: "#3b82f6" },
    { dist: 140, size: 4, speed: 0.5, color: "#ef4444" },
    { dist: 185, size: 12, speed: 0.25, color: "#d97706" },
  ];
  planets.forEach((p, i) => {
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, p.dist, 0, Math.PI * 2);
    ctx.stroke();
    const ang = t * p.speed + i;
    const px = cx + Math.cos(ang) * p.dist;
    const py = cy + Math.sin(ang) * p.dist;
    // Trail
    for (let j = 1; j < 8; j++) {
      const ta = ang - j * 0.05;
      const tx = cx + Math.cos(ta) * p.dist;
      const ty = cy + Math.sin(ta) * p.dist;
      ctx.beginPath();
      ctx.arc(tx, ty, p.size * (1 - j / 8), 0, Math.PI * 2);
      ctx.fillStyle = p.color + alphaHex(1 - j / 8);
      ctx.fill();
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
    // Earth's moon
    if (i === 2) {
      const moonAng = t * 4;
      const mx = px + Math.cos(moonAng) * 12;
      const my = py + Math.sin(moonAng) * 12;
      ctx.fillStyle = "#d1d5db";
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("☀ Solar System", cx, 20);
};

const drawMoon: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2;
  // Stars
  for (let i = 0; i < 20; i++) {
    const sx = (i * 137) % w;
    const sy = (i * 73) % h;
    const twinkle = (Math.sin(t * 2 + i) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + twinkle * 0.3})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Earth atmosphere
  const earthR = 28;
  const atmGrad = ctx.createRadialGradient(cx, cy, earthR, cx, cy, earthR + 8);
  atmGrad.addColorStop(0, "rgba(100,180,255,0.4)");
  atmGrad.addColorStop(1, "rgba(100,180,255,0)");
  ctx.fillStyle = atmGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, earthR + 8, 0, Math.PI * 2);
  ctx.fill();
  // Earth body
  const earthGrad = ctx.createRadialGradient(cx - 8, cy - 8, 5, cx, cy, earthR);
  earthGrad.addColorStop(0, "#3b82f6");
  earthGrad.addColorStop(0.6, "#1e40af");
  earthGrad.addColorStop(1, "#0c1e3d");
  ctx.fillStyle = earthGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
  ctx.fill();
  // Continents
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy - 5, 8, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy + 8, 6, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Moon orbit
  const moonDist = 90;
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, moonDist, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Moon
  const moonAng = t * 0.6;
  const mx = cx + Math.cos(moonAng) * moonDist;
  const my = cy + Math.sin(moonAng) * moonDist;
  const moonR = 11;
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.arc(mx, my, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.arc(mx - 2, my - 1, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mx + 3, my + 2, 1, 0, Math.PI * 2);
  ctx.fill();
  // Phase shadow
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, moonR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(15,23,42,0.85)";
  const offset = (1 - Math.cos(moonAng)) * moonR;
  ctx.beginPath();
  ctx.arc(mx + offset, my, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Phase label
  const phase = ((moonAng / (Math.PI * 2)) % 1 + 1) % 1;
  const phaseName =
    phase < 0.125 || phase > 0.875 ? "New Moon" :
    phase < 0.375 ? "Waxing Crescent" :
    phase < 0.625 ? "Full Moon" :
    "Waning Crescent";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`🌙 ${phaseName}`, cx, 20);
};

const drawBlackhole: DrawFn = (ctx, w, h, t) => {
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.12;
  // Stars
  for (let i = 0; i < 50; i++) {
    const sx = (i * 137) % w;
    const sy = (i * 73) % h;
    const twinkle = (Math.sin(t + i) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + twinkle * 0.3})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Accretion disk rings
  for (let i = 0; i < 5; i++) {
    const ringR = R * (1.5 + i * 0.4);
    const grad = ctx.createRadialGradient(cx, cy, Math.max(1, ringR - 5), cx, cy, ringR + 5);
    grad.addColorStop(0, "rgba(255,150,80,0)");
    grad.addColorStop(0.5, `rgba(255,${150 + i * 20},${80 + i * 30},${0.3 - i * 0.05})`);
    grad.addColorStop(1, "rgba(255,80,40,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR + 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,180,80,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  // Event horizon
  const bhGrad = ctx.createRadialGradient(cx, cy, Math.max(1, R * 0.7), cx, cy, R);
  bhGrad.addColorStop(0, "#000");
  bhGrad.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.fillStyle = bhGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  // Particles spiraling in
  const colors = ["#fbbf24", "#f97316", "#ec4899", "#06b6d4"];
  for (let i = 0; i < 20; i++) {
    const startAng = (i / 20) * Math.PI * 2;
    const phase = (t * 0.6 + i * 0.2) % 3;
    if (phase > 2.8) continue;
    const ang = startAng + phase * 4;
    const dist = R * 4 - phase * R * 1.5;
    if (dist < R) continue;
    const px = cx + Math.cos(ang) * dist;
    const py = cy + Math.sin(ang) * dist;
    const size = 1.5 + (1 - phase / 3) * 2;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % 4];
    ctx.fill();
    for (let j = 1; j < 5; j++) {
      const ta = ang - j * 0.1;
      const td = dist + j * 3;
      if (td > R * 5) continue;
      const tx = cx + Math.cos(ta) * td;
      const ty = cy + Math.sin(ta) * td;
      ctx.beginPath();
      ctx.arc(tx, ty, size * (1 - j / 5), 0, Math.PI * 2);
      ctx.fillStyle = colors[i % 4] + alphaHex(1 - j / 5);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚫ Event Horizon", cx, 20);
};

const DRAW_MAP: Record<string, DrawFn> = {
  "acid-metal": drawAcidMetal,
  "acid-base": drawAcidBase,
  "electrolysis": drawElectrolysis,
  "ph-scale": drawPhScale,
  "periodic": drawPeriodic,
  "projectile": drawProjectile,
  "gravity": drawGravity,
  "circuit": drawCircuit,
  "pendulum": drawPendulum,
  "wave": drawWave,
  "heart": drawHeart,
  "photosynthesis": drawPhotosynthesis,
  "cell": drawCell,
  "dna": drawDna,
  "earthquake": drawEarthquake,
  "climate": drawClimate,
  "volcano": drawVolcano,
  "graph": drawGraph,
  "pythagoras": drawPythagoras,
  "probability": drawProbability,
  "solar": drawSolar,
  "moon": drawMoon,
  "blackhole": drawBlackhole,
};

// ===== Experiment info panel =====
function ExperimentInfoPanel({ experiment }: { experiment: Experiment }) {
  const details = getExperimentDetails(experiment);
  return (
    <div className="lab-glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white lab-font">Lab Briefing</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-white/40 lab-font">{experiment.subject}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Materials */}
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-3.5 w-3.5 text-emerald-400" />
            <h4 className="text-xs font-semibold text-white/80 lab-font uppercase tracking-wide">Materials</h4>
          </div>
          <ul className="space-y-1">
            {details.materials.map((m, i) => (
              <li key={i} className="text-xs text-white/60 lab-font flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5 leading-none">•</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Safety */}
        <div className="rounded-xl bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <h4 className="text-xs font-semibold text-white/80 lab-font uppercase tracking-wide">Safety</h4>
          </div>
          <ul className="space-y-1">
            {details.safety.map((s, i) => (
              <li key={i} className="text-xs text-white/60 lab-font flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5 leading-none">!</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Formula */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-3 border border-emerald-500/20">
        <div className="flex items-center gap-2 mb-1.5">
          <Sigma className="h-3.5 w-3.5 text-emerald-300" />
          <h4 className="text-xs font-semibold text-white/80 lab-font uppercase tracking-wide">Key Formula / Concept</h4>
        </div>
        <p className="text-sm text-emerald-200 lab-font font-mono break-words">{details.formula}</p>
      </div>
      {/* Steps */}
      <div className="rounded-xl bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-3.5 w-3.5 text-indigo-300" />
          <h4 className="text-xs font-semibold text-white/80 lab-font uppercase tracking-wide">Step-by-step Procedure</h4>
        </div>
        <ol className="space-y-2">
          {details.steps.map((step, i) => (
            <li key={i} className="text-xs text-white/70 lab-font flex gap-2">
              <span className="grid place-items-center h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex-shrink-0">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ===== Experiment Lab View =====
export function LabView() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedExp, setSelectedExp] = useState<Experiment | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [aiChat, setAiChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [savedExps, setSavedExps] = useState<string[]>([]);
  const [completedExps, setCompletedExps] = useState<string[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [expLoading, setExpLoading] = useState(false);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  // Load completed experiments from profile-scoped storage when scholarClass changes.
  // This also clears stale state from the other profile on class switch.
  useEffect(() => {
    setCompletedExps(loadCompletedExps(scholarClass));
    // Clear any selected experiment from the previous profile to avoid
    // showing stale content after a class switch.
    setSelectedExp(null);
    setShowLanding(true);
  }, [scholarClass]);

  const filtered = useMemo(() => {
    let list = EXPERIMENTS;
    if (activeCategory !== "all") list = list.filter((e) => e.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
    }
    return list;
  }, [search, activeCategory]);

  function openExperiment(exp: Experiment) {
    setSelectedExp(exp);
    setShowLanding(false);
    setAiExplanation(null);
    // Opening an experiment no longer awards XP — only real completion does.
    pushActivity({ type: "lab", text: `Started: ${exp.title}`, icon: "🧪" });
  }

  function completeExperiment(exp: Experiment) {
    if (!completedExps.includes(exp.id)) {
      const updated = saveCompletedExp(scholarClass, exp.id);
      setCompletedExps(updated);
      addXP(20);
      addCoins(10);
      toast.success("Experiment completed! +20 XP, +10 coins 🎉");
      pushActivity({ type: "lab", text: `Completed: ${exp.title}`, icon: "✅" });
    }
  }

  async function askAIAssistant(question: string) {
    if (!question.trim() || aiLoading) return;
    setAiChat((prev) => [...prev, { role: "user", text: question }]);
    setAiInput("");
    setAiLoading(true);
    try {
      const context = selectedExp
        ? `The student is doing the "${selectedExp.title}" experiment in the ${selectedExp.category} lab. ${selectedExp.description}`
        : "The student is browsing the Experiment Lab.";
      const reply = await askAI(
        `${context}\n\nStudent question: ${question}\n\nAnswer as a friendly lab assistant. Keep it concise and educational. Use markdown for formulas or key points.`,
        "dr-meera"
      );
      setAiChat((prev) => [...prev, { role: "ai", text: reply }]);
    } catch {
      setAiChat((prev) => [...prev, { role: "ai", text: "I couldn't process that. Try again!" }]);
    } finally {
      setAiLoading(false);
    }
  }

  async function getAIExplanation(exp: Experiment) {
    setExpLoading(true);
    setAiExplanation(null);
    try {
      const explanation = await askAI(
        `Explain the science behind this Class ${scholarClass} experiment in a student-friendly way.\n\nExperiment: ${exp.title}\nSubject: ${exp.subject}\nDescription: ${exp.description}\n\nInclude:\n1. What happens and why\n2. Key concept/formula\n3. Real-world application\n4. CBSE exam tip\n5. Common mistake to avoid\n\nUse markdown with clear headings.`,
        "dr-meera"
      );
      setAiExplanation(explanation);
    } catch {
      toast.error("AI explanation failed. Try again.");
    } finally {
      setExpLoading(false);
    }
  }

  // ===== Landing Screen =====
  if (showLanding && !selectedExp) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
          .lab-glass { background: rgba(255,255,255,0.01); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border: none; box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); position: relative; overflow: hidden; }
          .lab-glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px; background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
          .lab-glass-strong { background: rgba(20,20,20,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); }
          .lab-font { font-family: 'Inter', sans-serif; }
          .lab-serif { font-family: 'Instrument Serif', serif; }
        `}</style>

        {/* Ambient background */}
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-black via-[#001008] to-black" />
        <div className="fixed top-1/4 left-1/3 w-96 h-96 bg-emerald-500/10 blur-[120px] pointer-events-none z-0" />
        <div className="fixed bottom-1/4 right-1/3 w-96 h-96 bg-teal-500/10 blur-[120px] pointer-events-none z-0" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[150px] pointer-events-none z-0" />

        {/* Floating particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none z-0"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              background: ["#10b981", "#6366f1", "#06b6d4"][i % 3],
            }}
            animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.2 }}
          />
        ))}

        <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
          {/* Logo + Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto grid place-items-center h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl mb-6"
            >
              <FlaskConical className="h-10 w-10 text-white" />
            </motion.div>
            <h1 className="lab-serif italic text-5xl md:text-7xl text-white leading-tight mb-3">
              Scholar <span className="text-emerald-400">Experiment Lab</span>
            </h1>
            <p className="lab-font text-sm md:text-base text-white/50 max-w-md mx-auto">
              Learn by experimenting, not memorizing. Drag, mix, build, and discover science come alive.
            </p>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl w-full mb-8"
          >
            {[
              { label: "Continue Experiment", icon: Play, color: "from-emerald-500 to-teal-600", action: () => setShowLanding(false) },
              { label: "Browse Labs", icon: Microscope, color: "from-indigo-500 to-violet-600", action: () => setShowLanding(false) },
              { label: "Daily Challenge", icon: Target, color: "from-amber-500 to-orange-600", action: () => { setShowLanding(false); toast.info("Daily challenge coming soon!"); } },
              { label: "AI Guided Experiment", icon: Sparkles, color: "from-fuchsia-500 to-purple-600", action: () => { setShowLanding(false); toast.info("AI will guide your experiment!"); } },
              { label: "Free Exploration", icon: Telescope, color: "from-cyan-500 to-blue-600", action: () => setShowLanding(false) },
              { label: "Saved Experiments", icon: Bookmark, color: "from-rose-500 to-pink-600", action: () => { setShowLanding(false); setActiveCategory("all"); } },
            ].map((btn) => (
              <motion.button
                key={btn.label}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={btn.action}
                className={`lab-glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 text-center hover:bg-white/5 transition-all`}
              >
                <div className={`grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br ${btn.color}`}>
                  <btn.icon className="h-5 w-5 text-white" />
                </div>
                <span className="lab-font text-xs text-white/80 font-medium">{btn.label}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex gap-3 flex-wrap justify-center"
          >
            {[
              { label: "Experiments", value: EXPERIMENTS.length, icon: FlaskConical },
              { label: "Categories", value: CATEGORIES.length, icon: Microscope },
              { label: "Completed", value: completedExps.length, icon: Award },
              { label: "Saved", value: savedExps.length, icon: Bookmark },
            ].map((s) => (
              <div key={s.label} className="lab-glass rounded-full px-4 py-2 flex items-center gap-2">
                <s.icon className="h-4 w-4 text-white/60" />
                <span className="lab-font text-sm text-white font-semibold">{s.value}</span>
                <span className="lab-font text-xs text-white/40">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    );
  }

  // ===== Experiment View =====
  if (selectedExp) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden">
        <style>{`
          .lab-glass { background: rgba(255,255,255,0.01); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border: none; box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); position: relative; overflow: hidden; }
          .lab-glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px; background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
          .lab-glass-strong { background: rgba(20,20,20,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); }
          .lab-font { font-family: 'Inter', sans-serif; }
        `}</style>

        <div className="fixed inset-0 z-0 bg-gradient-to-br from-black via-[#000a06] to-black" />
        <div className="fixed top-0 left-1/4 w-96 h-96 blur-[120px] pointer-events-none z-0" style={{ background: `${selectedExp.color}15` }} />

        <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            <button
              onClick={() => { setSelectedExp(null); setShowLanding(false); }}
              className="lab-glass rounded-full px-4 py-2 flex items-center gap-2 text-sm text-white/70 hover:text-white"
            >
              <ChevronRight className="h-4 w-4 rotate-180" /> Back to Lab
            </button>
            <div className="flex items-center gap-2">
              <span className="lab-glass rounded-full px-3 py-1.5 text-xs text-white/60 lab-font">{selectedExp.difficulty}</span>
              <span className="lab-glass rounded-full px-3 py-1.5 text-xs text-white/60 lab-font">{selectedExp.duration}</span>
              {isInteractive(selectedExp) && (
                <button
                  onClick={() => completeExperiment(selectedExp)}
                  disabled={completedExps.includes(selectedExp.id)}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium lab-font disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-4 w-4 inline mr-1" /> {completedExps.includes(selectedExp.id) ? "Completed" : "Complete"}
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="px-4 md:px-8 mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white lab-font">
              <span className="mr-2">{selectedExp.icon}</span>{selectedExp.title}
            </h1>
            <p className="text-sm text-white/50 lab-font mt-1">{selectedExp.description}</p>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 px-4 md:px-8 pb-4">
            {/* Left: Simulation + Info Panel */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="lab-glass-strong rounded-2xl p-4 sm:p-6 flex flex-col items-stretch justify-start min-h-[400px] relative overflow-hidden">
                {/* Big emoji visual (decorative, only for non-interactive) */}
                {!isInteractive(selectedExp) && (
                  <div className="absolute top-4 left-4 text-3xl opacity-25 pointer-events-none select-none">{selectedExp.icon}</div>
                )}
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[10px] text-white/60 lab-font uppercase tracking-wider pointer-events-none z-10">{selectedExp.category}</div>

                {isInteractive(selectedExp) ? (
                  <InteractiveSimRouter
                    experiment={selectedExp}
                    alreadyCompleted={completedExps.includes(selectedExp.id)}
                    onComplete={() => completeExperiment(selectedExp)}
                    scholarClass={scholarClass}
                  />
                ) : (
                  <ComingSoonPanel experiment={selectedExp} />
                )}
              </div>

              {/* Info Panel: Materials / Safety / Formula / Steps */}
              <ExperimentInfoPanel experiment={selectedExp} />
            </div>

            {/* AI Panel */}
            <div className="flex flex-col gap-4">
              {/* AI Explanation */}
              <div className="lab-glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white lab-font">AI Explanation</h3>
                </div>
                {!aiExplanation && !expLoading && (
                  <button
                    onClick={() => getAIExplanation(selectedExp)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium lab-font"
                  >
                    Explain This Experiment
                  </button>
                )}
                {expLoading && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                    <span className="text-sm text-white/60 lab-font">AI is analyzing...</span>
                  </div>
                )}
                {aiExplanation && (
                  <div className="text-sm text-white/70 max-h-64 overflow-y-auto lab-font">
                    <Markdown content={aiExplanation} />
                  </div>
                )}
              </div>

              {/* AI Chat */}
              <div className="lab-glass rounded-2xl p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white lab-font">AI Lab Assistant</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-48 mb-3">
                  {aiChat.length === 0 && (
                    <p className="text-xs text-white/40 lab-font text-center py-4">
                      Ask anything about this experiment!
                    </p>
                  )}
                  {aiChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm lab-font ${msg.role === "user" ? "bg-white/10 text-white rounded-br-sm" : "bg-white/5 text-white/70 rounded-bl-sm"}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                        {[0, 0.15, 0.3].map((d, i) => (
                          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-white/50" animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: d }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") askAIAssistant(aiInput); }}
                    placeholder="Ask the lab assistant..."
                    className="flex-1 bg-white/5 rounded-full px-4 py-2 text-sm text-white placeholder-white/40 outline-none lab-font"
                  />
                  <button
                    onClick={() => askAIAssistant(aiInput)}
                    disabled={aiLoading || !aiInput.trim()}
                    className="grid place-items-center h-9 w-9 rounded-full bg-white/10 text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Browse Labs View =====
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden">
      <style>{`
        .lab-glass { background: rgba(255,255,255,0.01); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border: none; box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); position: relative; overflow: hidden; }
        .lab-glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px; background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
        .lab-glass-strong { background: rgba(20,20,20,0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); }
        .lab-font { font-family: 'Inter', sans-serif; }
        .lab-serif { font-family: 'Instrument Serif', serif; }
      `}</style>

      <div className="fixed inset-0 z-0 bg-gradient-to-br from-black via-[#000a06] to-black" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-emerald-500/10 blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-4 md:px-8 py-4 lab-font">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Experiment Lab</h1>
              <p className="text-[10px] text-white/40">Learn by experimenting</p>
            </div>
          </div>
          <button
            onClick={() => setShowLanding(true)}
            className="lab-glass rounded-full px-4 py-2 text-sm text-white/70 hover:text-white"
          >
            <Home className="h-4 w-4 inline mr-1" /> Home
          </button>
        </nav>

        {/* Search */}
        <div className="px-4 md:px-8 pb-4">
          <div className="lab-glass rounded-full px-4 py-2.5 flex items-center gap-2 max-w-md">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search experiments... (e.g., 'gravity', 'acids', 'DNA')"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40 lab-font"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="px-4 md:px-8 pb-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeCategory === "all" ? "bg-white text-black" : "lab-glass text-white/70"}`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat.id ? "text-white" : "lab-glass text-white/70"}`}
              style={activeCategory === cat.id ? { background: cat.color } : undefined}
            >
              <span>{cat.emoji}</span> {cat.name}
            </button>
          ))}
        </div>

        {/* Experiment grid */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <FlaskConical className="h-12 w-12 text-white/20 mb-4" />
              <p className="text-white/40 lab-font">No experiments found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((exp, i) => {
                const cat = CATEGORIES.find((c) => c.id === exp.category);
                const isCompleted = completedExps.includes(exp.id);
                return (
                  <motion.div
                    key={exp.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => openExperiment(exp)}
                    className="lab-glass rounded-2xl overflow-hidden cursor-pointer group hover:scale-[1.02] transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video grid place-items-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${exp.color}15, ${exp.color}05)` }}>
                      <span className="text-5xl group-hover:scale-110 transition-transform">{exp.icon}</span>
                      {isCompleted && (
                        <div className="absolute top-2 right-2 grid place-items-center h-6 w-6 rounded-full bg-emerald-500">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] lab-font">{exp.duration}</span>
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] lab-font" style={{ background: `${exp.color}30`, color: exp.color }}>
                        {exp.difficulty}
                      </span>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-white/40 lab-font">{cat?.emoji} {cat?.name}</span>
                      </div>
                      <h3 className="text-sm font-medium text-white lab-font line-clamp-1">{exp.title}</h3>
                      <p className="text-xs text-white/40 lab-font mt-1 line-clamp-2">{exp.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Simulation Canvas (animated visual for each experiment) =====
function SimulationCanvas({ experiment }: { experiment: Experiment }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();

    const resize = () => {
      canvas.width = canvas.offsetWidth || 1;
      canvas.height = canvas.offsetHeight || 1;
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      const t = (performance.now() - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const type = getSimulationType(experiment);
      const fn = DRAW_MAP[type];
      if (fn) fn(ctx, w, h, t, experiment.color);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [experiment]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full absolute inset-0"
    />
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default LabView;
