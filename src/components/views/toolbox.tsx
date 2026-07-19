"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Search, Star, Clock, Calculator, FlaskConical, Ruler, Atom, Timer, Globe,
  LineChart, Dices, Zap, Beaker, Sigma, X,
  Play, Pause, ArrowLeftRight, Maximize2, ChevronRight,
  Hash, Cpu,
} from "lucide-react";

// ===== Liquid-glass styles (tb- prefix) =====
const TB_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
.tb-font { font-family: 'Inter', system-ui, sans-serif; }
.tb-serif { font-family: 'Instrument Serif', Georgia, serif; }
.tb-glass { background:rgba(255,255,255,0.04); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.12); box-shadow:inset 0 1px 1px rgba(255,255,255,0.08); }
.tb-glass-strong { background:rgba(255,255,255,0.07); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.16); }
.tb-scroll::-webkit-scrollbar { width:6px; height:6px; }
.tb-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:3px; }
.tb-scroll::-webkit-scrollbar-track { background:transparent; }
`;

// ===== Types =====
type Category = "all" | "math" | "science" | "convert" | "time" | "productivity" | "random";

interface Tool {
  id: string;
  name: string;
  short: string;
  desc: string;
  category: Exclude<Category, "all">;
  icon: typeof Calculator;
  accent: string;
}

// ===== Tools metadata =====
const TOOLS: Tool[] = [
  { id: "std-calc", name: "Standard Calculator", short: "Basic", desc: "Arithmetic with memory and history.", category: "math", icon: Calculator, accent: "#6366f1" },
  { id: "sci-calc", name: "Scientific Calculator", short: "Scientific", desc: "Trig, log, powers, factorial — safe parser, no eval().", category: "math", icon: Sigma, accent: "#14b8a6" },
  { id: "unit-conv", name: "Unit Converter", short: "Convert", desc: "10 categories, live conversion, swap units.", category: "convert", icon: Ruler, accent: "#f97316" },
  { id: "periodic", name: "Periodic Table", short: "Elements", desc: "All 118 elements, color-coded, detail panel.", category: "science", icon: Atom, accent: "#a855f7" },
  { id: "stopwatch", name: "Stopwatch", short: "Stopwatch", desc: "Millisecond precision, laps, fullscreen mode.", category: "time", icon: Timer, accent: "#ef4444" },
  { id: "countdown", name: "Countdown Timer", short: "Timer", desc: "Presets, progress ring, Web Audio beep.", category: "time", icon: Timer, accent: "#ec4899" },
  { id: "world-clock", name: "World Clock", short: "World", desc: "Six cities, 12/24-hour toggle, live updates.", category: "time", icon: Globe, accent: "#3b82f6" },
  { id: "graph-plotter", name: "Graph Plotter", short: "Graph", desc: "Canvas plot, zoom/pan, 3 functions, safe parser.", category: "math", icon: LineChart, accent: "#22c55e" },
  { id: "random", name: "Random Generators", short: "Random", desc: "Number, dice, coin, color, password, student picker.", category: "random", icon: Dices, accent: "#eab308" },
  { id: "physics", name: "Physics Calculator", short: "Physics", desc: "Projectile, Ohm's law, Force, KE, PE.", category: "science", icon: Zap, accent: "#06b6d4" },
  { id: "chemistry", name: "Chemistry Calculator", short: "Chem", desc: "Molar mass, pH, dilution, ideal gas law.", category: "science", icon: Beaker, accent: "#84cc16" },
  { id: "math-util", name: "Math Utilities", short: "Utils", desc: "Prime, LCM, HCF, factorial, statistics, quadratic.", category: "math", icon: Hash, accent: "#f59e0b" },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "math", label: "Math" },
  { id: "science", label: "Science" },
  { id: "convert", label: "Convert" },
  { id: "time", label: "Time" },
  { id: "productivity", label: "Productivity" },
  { id: "random", label: "Random" },
];

const FAV_KEY = "tb-favorites";
const RECENT_KEY = "tb-recent";

// ===== Safe math parser (no eval) =====
class SafeParser {
  private pos = 0;
  private src = "";
  parse(expr: string): number {
    this.src = expr.replace(/\s+/g, "").replace(/π/g, "pi").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\^/g, "**");
    this.pos = 0;
    if (this.src.length === 0) return 0;
    const v = this.parseExpr();
    if (this.pos < this.src.length) throw new Error(`Unexpected: ${this.src[this.pos]}`);
    return v;
  }
  private peek(): string { return this.src[this.pos]; }
  private parseExpr(): number {
    let v = this.parseTerm();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.src[this.pos++];
      const r = this.parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  private parseTerm(): number {
    let v = this.parseFactor();
    while (this.peek() === "*" || this.peek() === "/" || this.peek() === "%") {
      const op = this.src[this.pos++];
      const r = this.parseFactor();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }
  private parseFactor(): number {
    let v = this.parseUnary();
    while (this.peek() === "*" && this.src[this.pos + 1] === "*") {
      this.pos += 2;
      const r = this.parseUnary();
      v = Math.pow(v, r);
    }
    return v;
  }
  private parseUnary(): number {
    if (this.peek() === "-") { this.pos++; return -this.parseUnary(); }
    if (this.peek() === "+") { this.pos++; return this.parseUnary(); }
    return this.parsePrimary();
  }
  private parsePrimary(): number {
    if (this.peek() === "(") {
      this.pos++;
      const v = this.parseExpr();
      if (this.peek() !== ")") throw new Error("Expected )");
      this.pos++;
      return v;
    }
    // function or constant
    let name = "";
    while (this.pos < this.src.length && /[a-z]/i.test(this.src[this.pos])) {
      name += this.src[this.pos++];
    }
    if (name) {
      const lower = name.toLowerCase();
      if (lower === "pi") return Math.PI;
      if (lower === "e") return Math.E;
      if (lower === "tau") return Math.PI * 2;
      // factorial: e.g. 5! handled elsewhere; function call
      if (this.peek() === "(") {
        this.pos++;
        const arg = this.parseExpr();
        if (this.peek() !== ")") throw new Error("Expected )");
        this.pos++;
        const fns: Record<string, (x: number) => number> = {
          sin: Math.sin, cos: Math.cos, tan: Math.tan,
          asin: Math.asin, acos: Math.acos, atan: Math.atan,
          sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
          sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
          ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
          round: Math.round, floor: Math.floor, ceil: Math.ceil,
          fact: (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; },
        };
        const fn = fns[lower];
        if (!fn) throw new Error(`Unknown function: ${name}`);
        return fn(arg);
      }
      throw new Error(`Unknown: ${name}`);
    }
    // number
    let num = "";
    while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) {
      num += this.src[this.pos++];
    }
    if (num === "") throw new Error(`Expected number at ${this.pos}`);
    const v = parseFloat(num);
    // factorial postfix
    while (this.peek() === "!") {
      this.pos++;
      let r = 1; for (let i = 2; i <= v; i++) r *= i;
      return r;
    }
    return v;
  }
}
const parser = new SafeParser();
function safeEval(expr: string): number {
  try { return parser.parse(expr); } catch (e) { return NaN; }
}

// ===== Periodic table data (118 elements) =====
interface PElement { n: number; sym: string; name: string; mass: number; cat: string; }
const ELEMENT_CATS: Record<string, { label: string; color: string }> = {
  alkali: { label: "Alkali metal", color: "#ef4444" },
  alkaline: { label: "Alkaline earth", color: "#f97316" },
  transition: { label: "Transition metal", color: "#fbbf24" },
  post: { label: "Post-transition", color: "#84cc16" },
  metalloid: { label: "Metalloid", color: "#22c55e" },
  nonmetal: { label: "Nonmetal", color: "#14b8a6" },
  halogen: { label: "Halogen", color: "#06b6d4" },
  noble: { label: "Noble gas", color: "#3b82f6" },
  lanthanide: { label: "Lanthanide", color: "#a855f7" },
  actinide: { label: "Actinide", color: "#ec4899" },
  unknown: { label: "Unknown", color: "#64748b" },
};
const ELEMENTS: PElement[] = [
  { n: 1, sym: "H", name: "Hydrogen", mass: 1.008, cat: "nonmetal" },
  { n: 2, sym: "He", name: "Helium", mass: 4.003, cat: "noble" },
  { n: 3, sym: "Li", name: "Lithium", mass: 6.941, cat: "alkali" },
  { n: 4, sym: "Be", name: "Beryllium", mass: 9.012, cat: "alkaline" },
  { n: 5, sym: "B", name: "Boron", mass: 10.81, cat: "metalloid" },
  { n: 6, sym: "C", name: "Carbon", mass: 12.011, cat: "nonmetal" },
  { n: 7, sym: "N", name: "Nitrogen", mass: 14.007, cat: "nonmetal" },
  { n: 8, sym: "O", name: "Oxygen", mass: 15.999, cat: "nonmetal" },
  { n: 9, sym: "F", name: "Fluorine", mass: 18.998, cat: "halogen" },
  { n: 10, sym: "Ne", name: "Neon", mass: 20.180, cat: "noble" },
  { n: 11, sym: "Na", name: "Sodium", mass: 22.990, cat: "alkali" },
  { n: 12, sym: "Mg", name: "Magnesium", mass: 24.305, cat: "alkaline" },
  { n: 13, sym: "Al", name: "Aluminium", mass: 26.982, cat: "post" },
  { n: 14, sym: "Si", name: "Silicon", mass: 28.085, cat: "metalloid" },
  { n: 15, sym: "P", name: "Phosphorus", mass: 30.974, cat: "nonmetal" },
  { n: 16, sym: "S", name: "Sulfur", mass: 32.06, cat: "nonmetal" },
  { n: 17, sym: "Cl", name: "Chlorine", mass: 35.45, cat: "halogen" },
  { n: 18, sym: "Ar", name: "Argon", mass: 39.948, cat: "noble" },
  { n: 19, sym: "K", name: "Potassium", mass: 39.098, cat: "alkali" },
  { n: 20, sym: "Ca", name: "Calcium", mass: 40.078, cat: "alkaline" },
  { n: 21, sym: "Sc", name: "Scandium", mass: 44.956, cat: "transition" },
  { n: 22, sym: "Ti", name: "Titanium", mass: 47.867, cat: "transition" },
  { n: 23, sym: "V", name: "Vanadium", mass: 50.942, cat: "transition" },
  { n: 24, sym: "Cr", name: "Chromium", mass: 51.996, cat: "transition" },
  { n: 25, sym: "Mn", name: "Manganese", mass: 54.938, cat: "transition" },
  { n: 26, sym: "Fe", name: "Iron", mass: 55.845, cat: "transition" },
  { n: 27, sym: "Co", name: "Cobalt", mass: 58.933, cat: "transition" },
  { n: 28, sym: "Ni", name: "Nickel", mass: 58.693, cat: "transition" },
  { n: 29, sym: "Cu", name: "Copper", mass: 63.546, cat: "transition" },
  { n: 30, sym: "Zn", name: "Zinc", mass: 65.38, cat: "transition" },
  { n: 31, sym: "Ga", name: "Gallium", mass: 69.723, cat: "post" },
  { n: 32, sym: "Ge", name: "Germanium", mass: 72.63, cat: "metalloid" },
  { n: 33, sym: "As", name: "Arsenic", mass: 74.922, cat: "metalloid" },
  { n: 34, sym: "Se", name: "Selenium", mass: 78.96, cat: "nonmetal" },
  { n: 35, sym: "Br", name: "Bromine", mass: 79.904, cat: "halogen" },
  { n: 36, sym: "Kr", name: "Krypton", mass: 83.798, cat: "noble" },
  { n: 37, sym: "Rb", name: "Rubidium", mass: 85.468, cat: "alkali" },
  { n: 38, sym: "Sr", name: "Strontium", mass: 87.62, cat: "alkaline" },
  { n: 39, sym: "Y", name: "Yttrium", mass: 88.906, cat: "transition" },
  { n: 40, sym: "Zr", name: "Zirconium", mass: 91.224, cat: "transition" },
  { n: 41, sym: "Nb", name: "Niobium", mass: 92.906, cat: "transition" },
  { n: 42, sym: "Mo", name: "Molybdenum", mass: 95.95, cat: "transition" },
  { n: 43, sym: "Tc", name: "Technetium", mass: 98, cat: "transition" },
  { n: 44, sym: "Ru", name: "Ruthenium", mass: 101.07, cat: "transition" },
  { n: 45, sym: "Rh", name: "Rhodium", mass: 102.906, cat: "transition" },
  { n: 46, sym: "Pd", name: "Palladium", mass: 106.42, cat: "transition" },
  { n: 47, sym: "Ag", name: "Silver", mass: 107.868, cat: "transition" },
  { n: 48, sym: "Cd", name: "Cadmium", mass: 112.411, cat: "transition" },
  { n: 49, sym: "In", name: "Indium", mass: 114.818, cat: "post" },
  { n: 50, sym: "Sn", name: "Tin", mass: 118.71, cat: "post" },
  { n: 51, sym: "Sb", name: "Antimony", mass: 121.76, cat: "metalloid" },
  { n: 52, sym: "Te", name: "Tellurium", mass: 127.6, cat: "metalloid" },
  { n: 53, sym: "I", name: "Iodine", mass: 126.904, cat: "halogen" },
  { n: 54, sym: "Xe", name: "Xenon", mass: 131.293, cat: "noble" },
  { n: 55, sym: "Cs", name: "Caesium", mass: 132.905, cat: "alkali" },
  { n: 56, sym: "Ba", name: "Barium", mass: 137.327, cat: "alkaline" },
  { n: 57, sym: "La", name: "Lanthanum", mass: 138.905, cat: "lanthanide" },
  { n: 58, sym: "Ce", name: "Cerium", mass: 140.116, cat: "lanthanide" },
  { n: 59, sym: "Pr", name: "Praseodymium", mass: 140.908, cat: "lanthanide" },
  { n: 60, sym: "Nd", name: "Neodymium", mass: 144.242, cat: "lanthanide" },
  { n: 61, sym: "Pm", name: "Promethium", mass: 145, cat: "lanthanide" },
  { n: 62, sym: "Sm", name: "Samarium", mass: 150.36, cat: "lanthanide" },
  { n: 63, sym: "Eu", name: "Europium", mass: 151.964, cat: "lanthanide" },
  { n: 64, sym: "Gd", name: "Gadolinium", mass: 157.25, cat: "lanthanide" },
  { n: 65, sym: "Tb", name: "Terbium", mass: 158.925, cat: "lanthanide" },
  { n: 66, sym: "Dy", name: "Dysprosium", mass: 162.5, cat: "lanthanide" },
  { n: 67, sym: "Ho", name: "Holmium", mass: 164.93, cat: "lanthanide" },
  { n: 68, sym: "Er", name: "Erbium", mass: 167.259, cat: "lanthanide" },
  { n: 69, sym: "Tm", name: "Thulium", mass: 168.934, cat: "lanthanide" },
  { n: 70, sym: "Yb", name: "Ytterbium", mass: 173.054, cat: "lanthanide" },
  { n: 71, sym: "Lu", name: "Lutetium", mass: 174.967, cat: "lanthanide" },
  { n: 72, sym: "Hf", name: "Hafnium", mass: 178.49, cat: "transition" },
  { n: 73, sym: "Ta", name: "Tantalum", mass: 180.948, cat: "transition" },
  { n: 74, sym: "W", name: "Tungsten", mass: 183.84, cat: "transition" },
  { n: 75, sym: "Re", name: "Rhenium", mass: 186.207, cat: "transition" },
  { n: 76, sym: "Os", name: "Osmium", mass: 190.23, cat: "transition" },
  { n: 77, sym: "Ir", name: "Iridium", mass: 192.217, cat: "transition" },
  { n: 78, sym: "Pt", name: "Platinum", mass: 195.084, cat: "transition" },
  { n: 79, sym: "Au", name: "Gold", mass: 196.967, cat: "transition" },
  { n: 80, sym: "Hg", name: "Mercury", mass: 200.59, cat: "transition" },
  { n: 81, sym: "Tl", name: "Thallium", mass: 204.383, cat: "post" },
  { n: 82, sym: "Pb", name: "Lead", mass: 207.2, cat: "post" },
  { n: 83, sym: "Bi", name: "Bismuth", mass: 208.98, cat: "post" },
  { n: 84, sym: "Po", name: "Polonium", mass: 209, cat: "post" },
  { n: 85, sym: "At", name: "Astatine", mass: 210, cat: "halogen" },
  { n: 86, sym: "Rn", name: "Radon", mass: 222, cat: "noble" },
  { n: 87, sym: "Fr", name: "Francium", mass: 223, cat: "alkali" },
  { n: 88, sym: "Ra", name: "Radium", mass: 226, cat: "alkaline" },
  { n: 89, sym: "Ac", name: "Actinium", mass: 227, cat: "actinide" },
  { n: 90, sym: "Th", name: "Thorium", mass: 232.038, cat: "actinide" },
  { n: 91, sym: "Pa", name: "Protactinium", mass: 231.036, cat: "actinide" },
  { n: 92, sym: "U", name: "Uranium", mass: 238.029, cat: "actinide" },
  { n: 93, sym: "Np", name: "Neptunium", mass: 237, cat: "actinide" },
  { n: 94, sym: "Pu", name: "Plutonium", mass: 244, cat: "actinide" },
  { n: 95, sym: "Am", name: "Americium", mass: 243, cat: "actinide" },
  { n: 96, sym: "Cm", name: "Curium", mass: 247, cat: "actinide" },
  { n: 97, sym: "Bk", name: "Berkelium", mass: 247, cat: "actinide" },
  { n: 98, sym: "Cf", name: "Californium", mass: 251, cat: "actinide" },
  { n: 99, sym: "Es", name: "Einsteinium", mass: 252, cat: "actinide" },
  { n: 100, sym: "Fm", name: "Fermium", mass: 257, cat: "actinide" },
  { n: 101, sym: "Md", name: "Mendelevium", mass: 258, cat: "actinide" },
  { n: 102, sym: "No", name: "Nobelium", mass: 259, cat: "actinide" },
  { n: 103, sym: "Lr", name: "Lawrencium", mass: 262, cat: "actinide" },
  { n: 104, sym: "Rf", name: "Rutherfordium", mass: 267, cat: "transition" },
  { n: 105, sym: "Db", name: "Dubnium", mass: 268, cat: "transition" },
  { n: 106, sym: "Sg", name: "Seaborgium", mass: 271, cat: "transition" },
  { n: 107, sym: "Bh", name: "Bohrium", mass: 272, cat: "transition" },
  { n: 108, sym: "Hs", name: "Hassium", mass: 270, cat: "transition" },
  { n: 109, sym: "Mt", name: "Meitnerium", mass: 276, cat: "unknown" },
  { n: 110, sym: "Ds", name: "Darmstadtium", mass: 281, cat: "unknown" },
  { n: 111, sym: "Rg", name: "Roentgenium", mass: 282, cat: "unknown" },
  { n: 112, sym: "Cn", name: "Copernicium", mass: 285, cat: "unknown" },
  { n: 113, sym: "Nh", name: "Nihonium", mass: 286, cat: "unknown" },
  { n: 114, sym: "Fl", name: "Flerovium", mass: 289, cat: "unknown" },
  { n: 115, sym: "Mc", name: "Moscovium", mass: 290, cat: "unknown" },
  { n: 116, sym: "Lv", name: "Livermorium", mass: 293, cat: "unknown" },
  { n: 117, sym: "Ts", name: "Tennessine", mass: 294, cat: "unknown" },
  { n: 118, sym: "Og", name: "Oganesson", mass: 294, cat: "unknown" },
];

// 30-element DB for chemistry calculator (subset of common elements with masses)
const CHEM_DB: Record<string, { name: string; mass: number }> = {
  H: { name: "Hydrogen", mass: 1.008 }, He: { name: "Helium", mass: 4.003 },
  Li: { name: "Lithium", mass: 6.941 }, Be: { name: "Beryllium", mass: 9.012 },
  B: { name: "Boron", mass: 10.81 }, C: { name: "Carbon", mass: 12.011 },
  N: { name: "Nitrogen", mass: 14.007 }, O: { name: "Oxygen", mass: 15.999 },
  F: { name: "Fluorine", mass: 18.998 }, Ne: { name: "Neon", mass: 20.180 },
  Na: { name: "Sodium", mass: 22.990 }, Mg: { name: "Magnesium", mass: 24.305 },
  Al: { name: "Aluminium", mass: 26.982 }, Si: { name: "Silicon", mass: 28.085 },
  P: { name: "Phosphorus", mass: 30.974 }, S: { name: "Sulfur", mass: 32.06 },
  Cl: { name: "Chlorine", mass: 35.45 }, Ar: { name: "Argon", mass: 39.948 },
  K: { name: "Potassium", mass: 39.098 }, Ca: { name: "Calcium", mass: 40.078 },
  Fe: { name: "Iron", mass: 55.845 }, Cu: { name: "Copper", mass: 63.546 },
  Zn: { name: "Zinc", mass: 65.38 }, Ag: { name: "Silver", mass: 107.868 },
  Au: { name: "Gold", mass: 196.967 }, Hg: { name: "Mercury", mass: 200.59 },
  Pb: { name: "Lead", mass: 207.2 }, U: { name: "Uranium", mass: 238.029 },
  Br: { name: "Bromine", mass: 79.904 }, I: { name: "Iodine", mass: 126.904 },
};

// ===== Unit converter data =====
interface UnitDef { label: string; toBase: number; }
const UNITS: Record<string, { name: string; base: string; units: UnitDef[] }> = {
  length: { name: "Length", base: "m", units: [
    { label: "nm", toBase: 1e-9 }, { label: "μm", toBase: 1e-6 }, { label: "mm", toBase: 1e-3 },
    { label: "cm", toBase: 1e-2 }, { label: "m", toBase: 1 }, { label: "km", toBase: 1000 },
    { label: "in", toBase: 0.0254 }, { label: "ft", toBase: 0.3048 }, { label: "yd", toBase: 0.9144 },
    { label: "mi", toBase: 1609.344 },
  ]},
  mass: { name: "Mass", base: "kg", units: [
    { label: "mg", toBase: 1e-6 }, { label: "g", toBase: 1e-3 }, { label: "kg", toBase: 1 },
    { label: "t", toBase: 1000 }, { label: "oz", toBase: 0.0283495 }, { label: "lb", toBase: 0.453592 },
    { label: "ton (US)", toBase: 907.185 }, { label: "ton (UK)", toBase: 1016.05 },
  ]},
  temperature: { name: "Temperature", base: "C", units: [
    { label: "°C", toBase: 1 }, { label: "°F", toBase: 1 }, { label: "K", toBase: 1 },
  ]},
  time: { name: "Time", base: "s", units: [
    { label: "ms", toBase: 1e-3 }, { label: "s", toBase: 1 }, { label: "min", toBase: 60 },
    { label: "h", toBase: 3600 }, { label: "day", toBase: 86400 }, { label: "week", toBase: 604800 },
    { label: "month", toBase: 2629800 }, { label: "year", toBase: 31557600 },
  ]},
  area: { name: "Area", base: "m²", units: [
    { label: "mm²", toBase: 1e-6 }, { label: "cm²", toBase: 1e-4 }, { label: "m²", toBase: 1 },
    { label: "ha", toBase: 10000 }, { label: "km²", toBase: 1e6 }, { label: "in²", toBase: 0.00064516 },
    { label: "ft²", toBase: 0.092903 }, { label: "acre", toBase: 4046.86 }, { label: "mi²", toBase: 2589988.11 },
  ]},
  volume: { name: "Volume", base: "L", units: [
    { label: "mL", toBase: 0.001 }, { label: "L", toBase: 1 }, { label: "m³", toBase: 1000 },
    { label: "cm³", toBase: 0.001 }, { label: "in³", toBase: 0.0163871 }, { label: "ft³", toBase: 28.3168 },
    { label: "gal (US)", toBase: 3.78541 }, { label: "gal (UK)", toBase: 4.54609 }, { label: "cup", toBase: 0.236588 },
  ]},
  speed: { name: "Speed", base: "m/s", units: [
    { label: "m/s", toBase: 1 }, { label: "km/h", toBase: 0.277778 }, { label: "mph", toBase: 0.44704 },
    { label: "ft/s", toBase: 0.3048 }, { label: "knot", toBase: 0.514444 },
  ]},
  data: { name: "Digital", base: "B", units: [
    { label: "bit", toBase: 0.125 }, { label: "B", toBase: 1 }, { label: "KB", toBase: 1024 },
    { label: "MB", toBase: 1048576 }, { label: "GB", toBase: 1073741824 }, { label: "TB", toBase: 1099511627776 },
  ]},
  pressure: { name: "Pressure", base: "Pa", units: [
    { label: "Pa", toBase: 1 }, { label: "kPa", toBase: 1000 }, { label: "bar", toBase: 100000 },
    { label: "atm", toBase: 101325 }, { label: "mmHg", toBase: 133.322 }, { label: "psi", toBase: 6894.76 },
  ]},
  energy: { name: "Energy", base: "J", units: [
    { label: "J", toBase: 1 }, { label: "kJ", toBase: 1000 }, { label: "cal", toBase: 4.184 },
    { label: "kcal", toBase: 4184 }, { label: "Wh", toBase: 3600 }, { label: "kWh", toBase: 3600000 },
    { label: "eV", toBase: 1.602e-19 }, { label: "BTU", toBase: 1055.06 },
  ]},
};

function convertTemp(val: number, from: string, to: string): number {
  let c: number;
  if (from === "°C") c = val;
  else if (from === "°F") c = (val - 32) * 5 / 9;
  else c = val - 273.15;
  if (to === "°C") return c;
  if (to === "°F") return c * 9 / 5 + 32;
  return c + 273.15;
}

// ===== World clock cities =====
const CITIES = [
  { name: "New Delhi", tz: "Asia/Kolkata" },
  { name: "London", tz: "Europe/London" },
  { name: "New York", tz: "America/New_York" },
  { name: "Tokyo", tz: "Asia/Tokyo" },
  { name: "Sydney", tz: "Australia/Sydney" },
  { name: "Dubai", tz: "Asia/Dubai" },
];

// ===== Helpers =====
const loadArr = (key: string): string[] => {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
};
const saveArr = (key: string, arr: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* */ }
};

// ===== Component =====
export function ToolboxView() {
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);
  const scholarClass = useStore((s) => s.user.scholarClass);

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [favorites, setFavorites] = useState<string[]>(() => loadArr(FAV_KEY));
  const [recent, setRecent] = useState<string[]>(() => loadArr(RECENT_KEY));
  const [openTool, setOpenTool] = useState<string | null>(null);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveArr(FAV_KEY, next);
      return next;
    });
  }, []);

  const recordRecent = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 6);
      saveArr(RECENT_KEY, next);
      return next;
    });
  }, []);

  const openToolDialog = useCallback((id: string) => {
    setOpenTool(id);
    recordRecent(id);
    const t = TOOLS.find((x) => x.id === id);
    if (t) {
      addXP(1);
      pushActivity({ type: "toolbox", icon: "🛠", text: `Opened ${t.name}` });
    }
  }, [recordRecent, addXP, pushActivity]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return TOOLS.filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.short.toLowerCase().includes(q);
    });
  }, [query, cat]);

  const favTools = useMemo(() => TOOLS.filter((t) => favorites.includes(t.id)), [favorites]);
  const recentTools = useMemo(() => recent.map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean) as Tool[], [recent]);

  return (
    <div className="-m-4 lg:-m-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black min-h-[calc(100vh-4rem)] tb-font">
      <style dangerouslySetInnerHTML={{ __html: TB_STYLE }} />
      <div className="max-w-6xl mx-auto px-4 py-6 lg:px-8 lg:py-10">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="w-10 h-10 rounded-xl tb-glass-strong flex items-center justify-center">
              <Cpu className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tb-serif italic">Toolbox</h1>
              <p className="text-xs text-white/50">Premium utilities for CBSE Class {scholarClass} scholars.</p>
            </div>
          </motion.div>
        </div>

        {/* Search */}
        <div className="tb-glass rounded-2xl p-3 mb-4">
          <div className="flex items-center gap-2 px-2">
            <Search className="w-4 h-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools — calculators, converters, generators…"
              className="bg-transparent text-white text-sm outline-none flex-1 placeholder:text-white/30"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-white/40 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs transition-all tb-font",
                cat === c.id
                  ? "bg-amber-400 text-zinc-900 font-medium"
                  : "tb-glass text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Favorites row */}
        {favTools.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 text-xs text-white/50 uppercase tracking-wider">
              <Star className="w-3 h-3 text-amber-400" /> Favorites
            </div>
            <div className="flex flex-wrap gap-2">
              {favTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openToolDialog(t.id)}
                  className="tb-glass rounded-xl px-3 py-2 flex items-center gap-2 hover:bg-white/10 transition-all"
                >
                  <t.icon className="w-3.5 h-3.5" style={{ color: t.accent }} />
                  <span className="text-xs text-white/80">{t.short}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent row */}
        {recentTools.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 text-xs text-white/50 uppercase tracking-wider">
              <Clock className="w-3 h-3 text-teal-400" /> Recent
            </div>
            <div className="flex flex-wrap gap-2">
              {recentTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openToolDialog(t.id)}
                  className="tb-glass rounded-xl px-3 py-2 flex items-center gap-2 hover:bg-white/10 transition-all"
                >
                  <t.icon className="w-3.5 h-3.5" style={{ color: t.accent }} />
                  <span className="text-xs text-white/80">{t.short}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tools grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((t, i) => (
            <motion.div
              key={t.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${t.short} tool`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => openToolDialog(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openToolDialog(t.id);
                }
              }}
              className="group tb-glass rounded-2xl p-4 text-left hover:bg-white/8 transition-all relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <div
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl pointer-events-none"
                style={{ background: t.accent }}
              />
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${t.accent}22`, border: `1px solid ${t.accent}44` }}
                >
                  <t.icon className="w-5 h-5" style={{ color: t.accent }} />
                </div>
                <button
                  type="button"
                  aria-label={favorites.includes(t.id) ? `Remove ${t.short} from favorites` : `Add ${t.short} to favorites`}
                  onClick={(e) => { e.stopPropagation(); toggleFav(t.id); }}
                  className="p-1 rounded hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                >
                  <Star
                    className={cn("w-3.5 h-3.5 transition-all", favorites.includes(t.id) ? "text-amber-400 fill-amber-400" : "text-white/30")}
                  />
                </button>
              </div>
              <div className="text-sm font-medium text-white mb-0.5">{t.short}</div>
              <div className="text-[10px] text-white/40 line-clamp-2 leading-tight">{t.desc}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[9px] text-white/30 uppercase tracking-wider">{t.category}</span>
                <ChevronRight className="w-3 h-3 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No tools match "{query}"</p>
          </div>
        )}
      </div>

      {/* ===== Tool Dialog ===== */}
      <Dialog open={!!openTool} onOpenChange={(o) => !o && setOpenTool(null)}>
        <DialogContent className="bg-zinc-950/95 border-white/10 backdrop-blur-xl max-w-4xl tb-font text-white max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-white tb-serif italic text-xl flex items-center gap-2">
              {(() => {
                const t = TOOLS.find((x) => x.id === openTool);
                if (!t) return null;
                return <t.icon className="w-5 h-5" style={{ color: t.accent }} />;
              })()}
              {TOOLS.find((t) => t.id === openTool)?.name || ""}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              {TOOLS.find((t) => t.id === openTool)?.desc || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto tb-scroll -mx-6 px-6 pb-6">
            {openTool === "std-calc" && <StandardCalc />}
            {openTool === "sci-calc" && <ScientificCalc />}
            {openTool === "unit-conv" && <UnitConverter />}
            {openTool === "periodic" && <PeriodicTable />}
            {openTool === "stopwatch" && <Stopwatch />}
            {openTool === "countdown" && <Countdown />}
            {openTool === "world-clock" && <WorldClock />}
            {openTool === "graph-plotter" && <GraphPlotter />}
            {openTool === "random" && <RandomTools />}
            {openTool === "physics" && <PhysicsCalc />}
            {openTool === "chemistry" && <ChemistryCalc />}
            {openTool === "math-util" && <MathUtilities />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Shared small components
// ============================================================
function CalcBtn({ label, onClick, variant = "default" }: { label: string; onClick: () => void; variant?: "default" | "op" | "eq" | "fn" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-12 rounded-xl text-sm font-medium transition-all active:scale-95 tb-font",
        variant === "default" && "bg-white/5 hover:bg-white/10 text-white border border-white/5",
        variant === "op" && "bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30",
        variant === "eq" && "bg-amber-400 hover:bg-amber-300 text-zinc-900 font-bold",
        variant === "fn" && "bg-white/5 hover:bg-white/10 text-teal-300 border border-white/5 text-xs",
      )}
    >
      {label}
    </button>
  );
}

function ToolRow({ label, val, setVal, unit }: { label: string; val: number; setVal: (n: number) => void; unit?: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className={cn("text-xs text-white/60", unit ? "w-28" : "w-16")}>{label}</label>
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono outline-none focus:border-amber-400/50"
      />
      {unit && <span className="text-xs text-white/40 w-14">{unit}</span>}
    </div>
  );
}

function ToolResult({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
      <span className="text-xs text-white/60">{label}</span>
      <span className="text-sm font-mono text-amber-300">{value}{unit ? ` ${unit}` : ""}</span>
    </div>
  );
}

// ============================================================
// Standard Calculator
// ============================================================
function StandardCalc() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  const inputDigit = (d: string) => {
    if (overwrite) { setDisplay(d); setOverwrite(false); }
    else setDisplay(display === "0" ? d : display + d);
  };
  const inputDot = () => {
    if (overwrite) { setDisplay("0."); setOverwrite(false); return; }
    if (!display.includes(".")) setDisplay(display + ".");
  };
  const clear = () => { setDisplay("0"); setPrev(null); setOp(null); setOverwrite(true); };
  const negate = () => setDisplay((d) => (parseFloat(d) === 0 ? d : d.startsWith("-") ? d.slice(1) : "-" + d));
  const percent = () => setDisplay((d) => String(parseFloat(d) / 100));

  const compute = (a: number, b: number, o: string): number => {
    switch (o) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const chooseOp = (nextOp: string) => {
    const v = parseFloat(display);
    if (prev === null) setPrev(v);
    else if (op && !overwrite) {
      const r = compute(prev, v, op);
      setPrev(r);
      setDisplay(String(r));
      setHistory((h) => [`${prev} ${op} ${v} = ${r}`, ...h].slice(0, 20));
    }
    setOp(nextOp);
    setOverwrite(true);
  };

  const equals = () => {
    if (op === null || prev === null) return;
    const v = parseFloat(display);
    const r = compute(prev, v, op);
    setHistory((h) => [`${prev} ${op} ${v} = ${r}`, ...h].slice(0, 20));
    setDisplay(String(r));
    setPrev(null); setOp(null); setOverwrite(true);
  };

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (/[0-9]/.test(k)) inputDigit(k);
      else if (k === ".") inputDot();
      else if (k === "+") chooseOp("+");
      else if (k === "-") chooseOp("-");
      else if (k === "*") chooseOp("×");
      else if (k === "/") { e.preventDefault(); chooseOp("÷"); }
      else if (k === "Enter" || k === "=") { e.preventDefault(); equals(); }
      else if (k === "Escape") clear();
      else if (k === "Backspace") setDisplay((d) => d.length > 1 ? d.slice(0, -1) : "0");
      else if (k === "%") percent();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="tb-glass rounded-xl p-4 mb-3">
          <div className="text-right text-3xl font-mono text-white break-all min-h-[2.5rem]">{display}</div>
          {op && prev !== null && (
            <div className="text-right text-xs text-white/40 font-mono mt-1">{prev} {op}</div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <CalcBtn label="MC" variant="fn" onClick={() => setMemory(0)} />
          <CalcBtn label="MR" variant="fn" onClick={() => { setDisplay(String(memory)); setOverwrite(true); }} />
          <CalcBtn label="M+" variant="fn" onClick={() => setMemory((m) => m + parseFloat(display))} />
          <CalcBtn label="M−" variant="fn" onClick={() => setMemory((m) => m - parseFloat(display))} />

          <CalcBtn label="C" variant="fn" onClick={clear} />
          <CalcBtn label="±" variant="fn" onClick={negate} />
          <CalcBtn label="%" variant="fn" onClick={percent} />
          <CalcBtn label="÷" variant="op" onClick={() => chooseOp("÷")} />

          <CalcBtn label="7" onClick={() => inputDigit("7")} />
          <CalcBtn label="8" onClick={() => inputDigit("8")} />
          <CalcBtn label="9" onClick={() => inputDigit("9")} />
          <CalcBtn label="×" variant="op" onClick={() => chooseOp("×")} />

          <CalcBtn label="4" onClick={() => inputDigit("4")} />
          <CalcBtn label="5" onClick={() => inputDigit("5")} />
          <CalcBtn label="6" onClick={() => inputDigit("6")} />
          <CalcBtn label="−" variant="op" onClick={() => chooseOp("-")} />

          <CalcBtn label="1" onClick={() => inputDigit("1")} />
          <CalcBtn label="2" onClick={() => inputDigit("2")} />
          <CalcBtn label="3" onClick={() => inputDigit("3")} />
          <CalcBtn label="+" variant="op" onClick={() => chooseOp("+")} />

          <CalcBtn label="0" onClick={() => inputDigit("0")} />
          <CalcBtn label="." onClick={inputDot} />
          <CalcBtn label="⌫" variant="fn" onClick={() => setDisplay((d) => d.length > 1 ? d.slice(0, -1) : "0")} />
          <CalcBtn label="=" variant="eq" onClick={equals} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs text-white/60 uppercase tracking-wider">History</h3>
          {history.length > 0 && (
            <button onClick={() => setHistory([])} className="text-[10px] text-white/40 hover:text-white">clear</button>
          )}
        </div>
        <div className="tb-glass rounded-xl p-3 max-h-72 overflow-y-auto tb-scroll space-y-1">
          {history.length === 0 ? (
            <div className="text-white/30 text-xs text-center py-8">No calculations yet</div>
          ) : history.map((h, i) => (
            <div key={i} className="text-xs font-mono text-white/70 py-1 border-b border-white/5 last:border-0">{h}</div>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-white/30">
          Memory: <span className="font-mono text-white/60">{memory}</span> · Keyboard supported (0-9, +, -, *, /, Enter, Esc)
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Scientific Calculator
// ============================================================
function ScientificCalc() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [angle, setAngle] = useState<"deg" | "rad">("deg");

  const append = (s: string) => { setExpr((e) => e + s); setResult(""); };
  const clear = () => { setExpr(""); setResult(""); };
  const back = () => setExpr((e) => e.slice(0, -1));

  const evaluate = () => {
    if (!expr.trim()) return;
    // Wrap trig args based on angle mode
    let processed = expr;
    if (angle === "deg") {
      processed = processed
        .replace(/sin\(/g, "sin((pi/180)*")
        .replace(/cos\(/g, "cos((pi/180)*")
        .replace(/tan\(/g, "tan((pi/180)*")
        .replace(/asin\(/g, "asin(") // inverse — leave; we convert result
        .replace(/acos\(/g, "acos(")
        .replace(/atan\(/g, "atan(");
    }
    let r = safeEval(processed);
    if (angle === "deg" && /a(sin|cos|tan)\(/.test(expr)) {
      // convert inverse trig result to degrees
      r = r * 180 / Math.PI;
    }
    if (isNaN(r) || !isFinite(r)) {
      setResult("Error");
    } else {
      const rs = String(Math.round(r * 1e10) / 1e10);
      setResult(rs);
      setHist((h) => [`${expr} = ${rs}`, ...h].slice(0, 20));
    }
  };

  const keys: { label: string; ins?: string; act?: () => void; cls?: string }[] = [
    { label: "sin", ins: "sin(" }, { label: "cos", ins: "cos(" }, { label: "tan", ins: "tan(" },
    { label: "asin", ins: "asin(" }, { label: "acos", ins: "acos(" }, { label: "atan", ins: "atan(" },
    { label: "ln", ins: "ln(" }, { label: "log", ins: "log(" }, { label: "eˣ", ins: "exp(" },
    { label: "√", ins: "sqrt(" }, { label: "x²", ins: "^2" }, { label: "xʸ", ins: "^" },
    { label: "π", ins: "pi" }, { label: "e", ins: "e" }, { label: "n!", ins: "!" },
    { label: "(", ins: "(" }, { label: ")", ins: ")" }, { label: "1/x", ins: "1/(" },
    { label: "7", ins: "7" }, { label: "8", ins: "8" }, { label: "9", ins: "9" },
    { label: "4", ins: "4" }, { label: "5", ins: "5" }, { label: "6", ins: "6" },
    { label: "1", ins: "1" }, { label: "2", ins: "2" }, { label: "3", ins: "3" },
    { label: "0", ins: "0" }, { label: ".", ins: "." }, { label: ",", ins: "," },
    { label: "+", ins: "+" }, { label: "−", ins: "-" }, { label: "×", ins: "*" },
    { label: "÷", ins: "/" }, { label: "%", ins: "%" }, { label: "abs", ins: "abs(" },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setAngle((a) => a === "deg" ? "rad" : "deg")}
            className="tb-glass rounded-lg px-2 py-1 text-[10px] text-white/80 uppercase"
          >
            {angle}
          </button>
          <span className="text-[10px] text-white/40">{angle === "deg" ? "Degrees" : "Radians"}</span>
        </div>
        <div className="tb-glass rounded-xl p-4 mb-3">
          <div className="text-right text-sm text-white/60 font-mono break-all min-h-[1.5rem]">{expr || "0"}</div>
          <div className="text-right text-2xl font-mono text-amber-300 break-all min-h-[2rem]">{result}</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          <button onClick={clear} className="h-9 rounded-lg bg-rose-400/15 text-rose-300 text-xs hover:bg-rose-400/25 border border-rose-400/30">C</button>
          <button onClick={back} className="h-9 rounded-lg bg-white/5 text-white/80 text-xs hover:bg-white/10 border border-white/5">⌫</button>
          <button onClick={evaluate} className="h-9 rounded-lg bg-amber-400 text-zinc-900 font-bold text-xs hover:bg-amber-300">=</button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {keys.map((k) => (
            <button
              key={k.label}
              onClick={() => k.act ? k.act() : append(k.ins || k.label)}
              className="h-9 rounded-lg bg-white/5 text-white/80 text-xs hover:bg-white/10 border border-white/5 active:scale-95"
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs text-white/60 uppercase tracking-wider">History</h3>
          {hist.length > 0 && (
            <button onClick={() => setHist([])} className="text-[10px] text-white/40 hover:text-white">clear</button>
          )}
        </div>
        <div className="tb-glass rounded-xl p-3 max-h-72 overflow-y-auto tb-scroll space-y-1">
          {hist.length === 0 ? (
            <div className="text-white/30 text-xs text-center py-8">No calculations yet</div>
          ) : hist.map((h, i) => (
            <div key={i} className="text-xs font-mono text-white/70 py-1 border-b border-white/5 last:border-0">{h}</div>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-white/40 leading-relaxed">
          Supported: <span className="text-teal-300 font-mono">sin cos tan asin acos atan ln log exp sqrt ^ ! pi e abs</span>
          <br />Safe recursive-descent parser — no eval().
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Unit Converter
// ============================================================
function UnitConverter() {
  const cats = Object.keys(UNITS);
  const [cat, setCat] = useState(cats[0]);
  const [from, setFrom] = useState(0);
  const [fromUnit, setFromUnit] = useState(UNITS[cat].units[0].label);
  const [toUnit, setToUnit] = useState(UNITS[cat].units[1].label);

  const cat_ = UNITS[cat];
  const convert = (): number => {
    if (cat === "temperature") return convertTemp(from, fromUnit, toUnit);
    const fU = cat_.units.find((u) => u.label === fromUnit)!;
    const tU = cat_.units.find((u) => u.label === toUnit)!;
    return (from * fU.toBase) / tU.toBase;
  };
  const swap = () => { setFromUnit(toUnit); setToUnit(fromUnit); };

  const selectCat = (c: string) => {
    setCat(c);
    setFromUnit(UNITS[c].units[0].label);
    setToUnit(UNITS[c].units[1].label);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => selectCat(c)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] transition-all",
              cat === c ? "bg-amber-400 text-zinc-900 font-medium" : "tb-glass text-white/70 hover:bg-white/10",
            )}
          >
            {UNITS[c].name}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div className="tb-glass rounded-xl p-3">
          <label className="text-[10px] text-white/50 uppercase tracking-wider">From</label>
          <input
            type="number"
            value={from}
            onChange={(e) => setFrom(parseFloat(e.target.value) || 0)}
            className="w-full bg-transparent text-2xl text-white font-mono outline-none my-1"
          />
          <select
            value={fromUnit}
            onChange={(e) => setFromUnit(e.target.value)}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-2 py-1.5 outline-none border border-white/10"
          >
            {cat_.units.map((u) => <option key={u.label} value={u.label} className="bg-zinc-900">{u.label}</option>)}
          </select>
        </div>
        <button
          onClick={swap}
          className="tb-glass rounded-xl w-10 h-10 mx-auto flex items-center justify-center hover:bg-white/10 transition-all"
          title="Swap units"
        >
          <ArrowLeftRight className="w-4 h-4 text-amber-400" />
        </button>
        <div className="tb-glass rounded-xl p-3">
          <label className="text-[10px] text-white/50 uppercase tracking-wider">To</label>
          <div className="text-2xl text-amber-300 font-mono my-1 break-all">{convert().toPrecision(8).replace(/\.?0+$/, "")}</div>
          <select
            value={toUnit}
            onChange={(e) => setToUnit(e.target.value)}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-2 py-1.5 outline-none border border-white/10"
          >
            {cat_.units.map((u) => <option key={u.label} value={u.label} className="bg-zinc-900">{u.label}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4 tb-glass rounded-xl p-3 text-xs text-white/60">
        <span className="text-amber-300 font-mono">{from}</span> <span className="text-white/40">{fromUnit}</span> = <span className="text-amber-300 font-mono">{convert().toPrecision(8).replace(/\.?0+$/, "")}</span> <span className="text-white/40">{toUnit}</span>
      </div>
    </div>
  );
}

// ============================================================
// Periodic Table
// ============================================================
function PeriodicTable() {
  const [selected, setSelected] = useState<PElement | null>(null);
  const [filter, setFilter] = useState("");

  // Position lookup (period, group). Lanthanides/actinides shown separately.
  const POS: Record<number, { row: number; col: number }> = {
    1: { row: 1, col: 1 }, 2: { row: 1, col: 18 },
    3: { row: 2, col: 1 }, 4: { row: 2, col: 2 },
    5: { row: 2, col: 13 }, 6: { row: 2, col: 14 }, 7: { row: 2, col: 15 }, 8: { row: 2, col: 16 }, 9: { row: 2, col: 17 }, 10: { row: 2, col: 18 },
    11: { row: 3, col: 1 }, 12: { row: 3, col: 2 },
    13: { row: 3, col: 13 }, 14: { row: 3, col: 14 }, 15: { row: 3, col: 15 }, 16: { row: 3, col: 16 }, 17: { row: 3, col: 17 }, 18: { row: 3, col: 18 },
    19: { row: 4, col: 1 }, 20: { row: 4, col: 2 }, 21: { row: 4, col: 3 }, 22: { row: 4, col: 4 }, 23: { row: 4, col: 5 }, 24: { row: 4, col: 6 }, 25: { row: 4, col: 7 }, 26: { row: 4, col: 8 }, 27: { row: 4, col: 9 }, 28: { row: 4, col: 10 }, 29: { row: 4, col: 11 }, 30: { row: 4, col: 12 }, 31: { row: 4, col: 13 }, 32: { row: 4, col: 14 }, 33: { row: 4, col: 15 }, 34: { row: 4, col: 16 }, 35: { row: 4, col: 17 }, 36: { row: 4, col: 18 },
    37: { row: 5, col: 1 }, 38: { row: 5, col: 2 }, 39: { row: 5, col: 3 }, 40: { row: 5, col: 4 }, 41: { row: 5, col: 5 }, 42: { row: 5, col: 6 }, 43: { row: 5, col: 7 }, 44: { row: 5, col: 8 }, 45: { row: 5, col: 9 }, 46: { row: 5, col: 10 }, 47: { row: 5, col: 11 }, 48: { row: 5, col: 12 }, 49: { row: 5, col: 13 }, 50: { row: 5, col: 14 }, 51: { row: 5, col: 15 }, 52: { row: 5, col: 16 }, 53: { row: 5, col: 17 }, 54: { row: 5, col: 18 },
    55: { row: 6, col: 1 }, 56: { row: 6, col: 2 },
    72: { row: 6, col: 3 }, 73: { row: 6, col: 4 }, 74: { row: 6, col: 5 }, 75: { row: 6, col: 6 }, 76: { row: 6, col: 7 }, 77: { row: 6, col: 8 }, 78: { row: 6, col: 9 }, 79: { row: 6, col: 10 }, 80: { row: 6, col: 11 }, 81: { row: 6, col: 12 }, 82: { row: 6, col: 13 }, 83: { row: 6, col: 14 }, 84: { row: 6, col: 15 }, 85: { row: 6, col: 16 }, 86: { row: 6, col: 17 }, 87: { row: 6, col: 18 },
    88: { row: 7, col: 2 },
    104: { row: 7, col: 3 }, 105: { row: 7, col: 4 }, 106: { row: 7, col: 5 }, 107: { row: 7, col: 6 }, 108: { row: 7, col: 7 }, 109: { row: 7, col: 8 }, 110: { row: 7, col: 9 }, 111: { row: 7, col: 10 }, 112: { row: 7, col: 11 }, 113: { row: 7, col: 12 }, 114: { row: 7, col: 13 }, 115: { row: 7, col: 14 }, 116: { row: 7, col: 15 }, 117: { row: 7, col: 16 }, 118: { row: 7, col: 17 },
  };
  // fix duplicates
  POS[87] = { row: 7, col: 1 };
  POS[88] = { row: 7, col: 2 };

  const main = ELEMENTS.filter((e) => POS[e.n]);
  const lanth = ELEMENTS.filter((e) => e.n >= 57 && e.n <= 71);
  const actin = ELEMENTS.filter((e) => e.n >= 89 && e.n <= 103);

  const matches = (e: PElement) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.sym.toLowerCase().includes(q) || String(e.n).includes(q);
  };

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search element by name, symbol, or number…"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none mb-3 focus:border-amber-400/50"
      />
      <div className="tb-glass rounded-xl p-3 overflow-x-auto tb-scroll">
        <div className="grid gap-1 min-w-[800px]" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
          {Array.from({ length: 7 * 18 }).map((_, i) => {
            const row = Math.floor(i / 18) + 1;
            const col = (i % 18) + 1;
            const el = main.find((e) => POS[e.n]?.row === row && POS[e.n]?.col === col);
            if (!el) return <div key={i} />;
            const cat = ELEMENT_CATS[el.cat] || ELEMENT_CATS.unknown;
            const dim = !matches(el);
            return (
              <button
                key={i}
                onClick={() => setSelected(el)}
                className={cn(
                  "aspect-square rounded-md p-0.5 flex flex-col items-center justify-center transition-all hover:scale-110 hover:z-10 relative",
                  dim && "opacity-20",
                )}
                style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}55` }}
                title={el.name}
              >
                <span className="text-[7px] text-white/50 leading-none">{el.n}</span>
                <span className="text-[10px] font-bold text-white leading-none mt-0.5">{el.sym}</span>
                <span className="text-[6px] text-white/40 leading-none mt-0.5 hidden lg:block truncate w-full text-center">{el.name}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-white/40">Lanthanides</div>
        <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
          {lanth.map((el) => {
            const cat = ELEMENT_CATS[el.cat];
            return (
              <button
                key={el.n}
                onClick={() => setSelected(el)}
                className={cn("aspect-square rounded-md p-0.5 flex flex-col items-center justify-center hover:scale-110 transition-all", !matches(el) && "opacity-20")}
                style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}55` }}
              >
                <span className="text-[7px] text-white/50 leading-none">{el.n}</span>
                <span className="text-[10px] font-bold text-white leading-none">{el.sym}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-white/40">Actinides</div>
        <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
          {actin.map((el) => {
            const cat = ELEMENT_CATS[el.cat];
            return (
              <button
                key={el.n}
                onClick={() => setSelected(el)}
                className={cn("aspect-square rounded-md p-0.5 flex flex-col items-center justify-center hover:scale-110 transition-all", !matches(el) && "opacity-20")}
                style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}55` }}
              >
                <span className="text-[7px] text-white/50 leading-none">{el.n}</span>
                <span className="text-[10px] font-bold text-white leading-none">{el.sym}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3">
        {Object.entries(ELEMENT_CATS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-[10px] text-white/60">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
            {v.label}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 tb-glass-strong rounded-xl p-4"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-xl flex flex-col items-center justify-center"
                style={{ background: `${ELEMENT_CATS[selected.cat].color}22`, border: `1px solid ${ELEMENT_CATS[selected.cat].color}` }}
              >
                <span className="text-[10px] text-white/60">{selected.n}</span>
                <span className="text-2xl font-bold text-white">{selected.sym}</span>
                <span className="text-[9px] text-white/60">{selected.mass}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">{selected.name}</h3>
                <div className="text-xs text-white/60 mb-2">{ELEMENT_CATS[selected.cat].label}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-white/40">Atomic No:</span> <span className="text-white font-mono">{selected.n}</span></div>
                  <div><span className="text-white/40">Atomic Mass:</span> <span className="text-white font-mono">{selected.mass} u</span></div>
                  <div><span className="text-white/40">Symbol:</span> <span className="text-white font-mono">{selected.sym}</span></div>
                  <div><span className="text-white/40">Category:</span> <span className="text-white">{ELEMENT_CATS[selected.cat].label}</span></div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Stopwatch
// ============================================================
function Stopwatch() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    const tick = () => {
      setMs(baseRef.current + (performance.now() - startRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const start = () => { baseRef.current = ms; setRunning(true); };
  const stop = () => { setRunning(false); baseRef.current = ms; };
  const reset = () => { setRunning(false); setMs(0); baseRef.current = 0; setLaps([]); };
  const lap = () => setLaps((l) => [ms, ...l]);

  const fmt = (t: number) => {
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const cs = Math.floor((t % 1000) / 10);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  return (
    <div className={cn(fullscreen && "fixed inset-0 z-50 bg-black flex flex-col items-center justify-center -m-6 p-6")}>
      {fullscreen && (
        <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
          <Maximize2 className="w-5 h-5 rotate-90" />
        </button>
      )}
      <div className="tb-glass-strong rounded-3xl p-8 text-center w-full max-w-md mx-auto">
        <div className={cn("font-mono text-white tabular-nums", fullscreen ? "text-8xl" : "text-5xl")}>
          {fmt(ms)}
        </div>
        <div className="flex gap-2 justify-center mt-6">
          {!running ? (
            <button onClick={start} className="px-5 py-2.5 rounded-xl bg-emerald-400 text-zinc-900 font-medium text-sm flex items-center gap-1.5">
              <Play className="w-4 h-4" /> Start
            </button>
          ) : (
            <button onClick={stop} className="px-5 py-2.5 rounded-xl bg-rose-400 text-zinc-900 font-medium text-sm flex items-center gap-1.5">
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          <button onClick={lap} disabled={!running} className="px-4 py-2.5 rounded-xl tb-glass text-white text-sm disabled:opacity-40">Lap</button>
          <button onClick={reset} className="px-4 py-2.5 rounded-xl tb-glass text-white text-sm">Reset</button>
          {!fullscreen && (
            <button onClick={() => setFullscreen(true)} className="px-3 py-2.5 rounded-xl tb-glass text-white/80">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {laps.length > 0 && (
        <div className="mt-4 max-w-md mx-auto w-full">
          <h3 className="text-xs text-white/60 uppercase tracking-wider mb-2">Laps ({laps.length})</h3>
          <div className="tb-glass rounded-xl p-3 max-h-48 overflow-y-auto tb-scroll space-y-1">
            {laps.map((l, i) => (
              <div key={i} className="flex justify-between text-xs font-mono text-white/70 py-1 border-b border-white/5 last:border-0">
                <span className="text-white/40">Lap {laps.length - i}</span>
                <span>{fmt(l)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Countdown Timer
// ============================================================
function Countdown() {
  const [seconds, setSeconds] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const presets = [30, 60, 300, 600, 1500, 3600];

  const beep = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* */ }
  };

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          beep();
          toast.success("⏰ Time's up!");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const start = () => {
    if (remaining === 0) setRemaining(seconds);
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setRemaining(seconds); };
  const setPreset = (s: number) => { setSeconds(s); setRemaining(s); setRunning(false); };

  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const progress = seconds > 0 ? (remaining / seconds) * 100 : 0;
  const R = 90, C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="220" height="220" className="-rotate-90">
          <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle
            cx="110" cy="110" r={R} fill="none" stroke="#ec4899" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (C * progress) / 100}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-mono text-white tabular-nums">{fmt(remaining)}</div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{running ? "running" : "paused"}</div>
        </div>
      </div>

      <div className="flex gap-1.5 mt-4 flex-wrap justify-center">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px]",
              seconds === p ? "bg-pink-400 text-zinc-900 font-medium" : "tb-glass text-white/70 hover:bg-white/10",
            )}
          >
            {p < 60 ? `${p}s` : p < 3600 ? `${p / 60}m` : `${p / 3600}h`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4">
        <label className="text-xs text-white/50">Custom (s):</label>
        <input
          type="number"
          value={seconds}
          onChange={(e) => setPreset(parseInt(e.target.value) || 0)}
          className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white outline-none font-mono"
        />
      </div>

      <div className="flex gap-2 mt-4">
        {!running ? (
          <button onClick={start} className="px-5 py-2 rounded-xl bg-emerald-400 text-zinc-900 text-sm font-medium flex items-center gap-1.5">
            <Play className="w-4 h-4" /> Start
          </button>
        ) : (
          <button onClick={pause} className="px-5 py-2 rounded-xl bg-rose-400 text-zinc-900 text-sm font-medium flex items-center gap-1.5">
            <Pause className="w-4 h-4" /> Pause
          </button>
        )}
        <button onClick={reset} className="px-4 py-2 rounded-xl tb-glass text-white text-sm">Reset</button>
        <button onClick={beep} className="px-4 py-2 rounded-xl tb-glass text-white/80 text-sm">Test beep</button>
      </div>
    </div>
  );
}

// ============================================================
// World Clock
// ============================================================
function WorldClock() {
  const [now, setNow] = useState(new Date());
  const [h24, setH24] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: !h24,
      }).format(now);
    } catch {
      return "—";
    }
  };
  const fmtDate = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz, weekday: "short", month: "short", day: "numeric",
      }).format(now);
    } catch {
      return "—";
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setH24((v) => !v)}
          className="tb-glass rounded-lg px-3 py-1.5 text-xs text-white/80"
        >
          {h24 ? "24-hour" : "12-hour"}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CITIES.map((c) => {
          const h = now.getUTCHours(); // for day/night detection
          return (
            <div key={c.name} className="tb-glass rounded-xl p-4 relative overflow-hidden">
              <div className={cn(
                "absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-30",
              )} style={{ background: h >= 6 && h < 18 ? "#fbbf24" : "#6366f1" }} />
              <div className="flex items-center gap-1.5 mb-1">
                <Globe className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/60">{c.name}</span>
              </div>
              <div className="text-xl font-mono text-white tabular-nums">{fmtTime(c.tz)}</div>
              <div className="text-[10px] text-white/40 mt-0.5">{fmtDate(c.tz)}</div>
              <div className="text-[9px] text-white/30 mt-1 font-mono">{c.tz}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Graph Plotter
// ============================================================
function GraphPlotter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [funcs, setFuncs] = useState<string[]>(["sin(x)", "x^2/10", "cos(x*2)"]);
  const [scale, setScale] = useState(40);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const colors = ["#6366f1", "#14b8a6", "#fbbf24"];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2 + offset.x;
    const cy = h / 2 + offset.y;

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = cx % scale; x < w; x += scale) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = cy % scale; y < h; y += scale) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    // labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px Inter, monospace";
    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue;
      const x = cx + i * scale;
      const y = cy + i * scale;
      if (x > 0 && x < w) ctx.fillText(String(i), x - 3, cy + 12);
      if (y > 0 && y < h) ctx.fillText(String(-i), cx + 5, y + 3);
    }

    // plot
    funcs.forEach((f, idx) => {
      if (!f.trim()) return;
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      let first = true;
      for (let px = 0; px < w; px++) {
        const xVal = (px - cx) / scale;
        const expr = f.replace(/x/g, `(${xVal})`);
        const y = safeEval(expr);
        if (isNaN(y) || !isFinite(y)) { first = true; continue; }
        const py = cy - y * scale;
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
  }, [funcs, scale, offset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = 320;
    draw();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(8, Math.min(200, s * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
  };
  const onDown = (e: React.PointerEvent) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onUp = () => { dragging.current = false; };

  return (
    <div>
      <div className="tb-glass rounded-xl p-3 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {funcs.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: colors[i] }} />
              <span className="text-[10px] text-white/40 font-mono">y =</span>
              <input
                value={f}
                onChange={(e) => setFuncs((arr) => arr.map((x, idx) => idx === i ? e.target.value : x))}
                className="bg-white/5 text-white text-xs font-mono px-2 py-1 rounded outline-none flex-1 border border-white/10 focus:border-amber-400/50"
                placeholder="e.g. sin(x)"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
          <span>Scale: <span className="font-mono text-white/60">{scale}px/unit</span></span>
          <button onClick={() => { setScale(40); setOffset({ x: 0, y: 0 }); }} className="text-amber-400 hover:underline">
            reset view
          </button>
          <span>· drag to pan · wheel to zoom · safe parser (sin/cos/tan/log/sqrt/^/abs)</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="w-full rounded-xl tb-glass cursor-grab active:cursor-grabbing touch-none"
        style={{ height: 320 }}
      />
    </div>
  );
}

// ============================================================
// Random Generators
// ============================================================
function RandomTools() {
  const [tab, setTab] = useState("number");
  const [numMin, setNumMin] = useState(1);
  const [numMax, setNumMax] = useState(100);
  const [numResult, setNumResult] = useState(0);
  const [dice, setDice] = useState(1);
  const [coin, setCoin] = useState<"Heads" | "Tails" | null>(null);
  const [color, setColor] = useState("#6366f1");
  const [pwLen, setPwLen] = useState(12);
  const [password, setPassword] = useState("");
  const [students, setStudents] = useState("Aarav,Diya,Vivaan,Ananya,Reyansh,Ira,Kabir,Myra");
  const [picked, setPicked] = useState("");

  const tabs = [
    { id: "number", label: "Number" }, { id: "dice", label: "Dice" }, { id: "coin", label: "Coin" },
    { id: "color", label: "Color" }, { id: "password", label: "Password" }, { id: "student", label: "Student" },
  ];

  const rollNumber = () => setNumResult(Math.floor(Math.random() * (numMax - numMin + 1)) + numMin);
  const rollDice = () => setDice(Math.floor(Math.random() * 6) + 1);
  const flipCoin = () => setCoin(Math.random() < 0.5 ? "Heads" : "Tails");
  const rollColor = () => setColor("#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"));
  const genPw = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}";
    let p = "";
    for (let i = 0; i < pwLen; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
  };
  const pickStudent = () => {
    const arr = students.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
    if (arr.length === 0) return;
    setPicked(arr[Math.floor(Math.random() * arr.length)]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs transition-all",
              tab === t.id ? "bg-amber-400 text-zinc-900 font-medium" : "tb-glass text-white/70 hover:bg-white/10",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "number" && (
        <div className="tb-glass rounded-xl p-6 text-center">
          <div className="text-5xl font-mono text-amber-300 mb-4">{numResult}</div>
          <div className="flex gap-2 justify-center mb-4">
            <div>
              <label className="text-[10px] text-white/40">Min</label>
              <input type="number" value={numMin} onChange={(e) => setNumMin(parseInt(e.target.value) || 0)} className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center" />
            </div>
            <div>
              <label className="text-[10px] text-white/40">Max</label>
              <input type="number" value={numMax} onChange={(e) => setNumMax(parseInt(e.target.value) || 0)} className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center" />
            </div>
          </div>
          <button onClick={rollNumber} className="px-5 py-2 rounded-xl bg-amber-400 text-zinc-900 font-medium text-sm">Generate</button>
        </div>
      )}

      {tab === "dice" && (
        <div className="tb-glass rounded-xl p-6 text-center">
          <div className="w-32 h-32 mx-auto rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center mb-4">
            <span className="text-7xl">{["⚀","⚁","⚂","⚃","⚄","⚅"][dice - 1]}</span>
          </div>
          <button onClick={rollDice} className="px-5 py-2 rounded-xl bg-amber-400 text-zinc-900 font-medium text-sm">Roll Dice</button>
        </div>
      )}

      {tab === "coin" && (
        <div className="tb-glass rounded-xl p-6 text-center">
          <div className={cn(
            "w-32 h-32 mx-auto rounded-full border-4 flex items-center justify-center mb-4 transition-all",
            coin === "Heads" ? "bg-amber-400/30 border-amber-400" : coin === "Tails" ? "bg-teal-400/30 border-teal-400" : "bg-white/5 border-white/20",
          )}>
            <span className="text-2xl font-bold text-white">{coin || "—"}</span>
          </div>
          <button onClick={flipCoin} className="px-5 py-2 rounded-xl bg-amber-400 text-zinc-900 font-medium text-sm">Flip Coin</button>
        </div>
      )}

      {tab === "color" && (
        <div className="tb-glass rounded-xl p-6 text-center">
          <div className="w-32 h-32 mx-auto rounded-2xl mb-4 border-2 border-white/20" style={{ background: color }} />
          <div className="text-lg font-mono text-white mb-4">{color}</div>
          <button onClick={rollColor} className="px-5 py-2 rounded-xl bg-amber-400 text-zinc-900 font-medium text-sm">Random Color</button>
        </div>
      )}

      {tab === "password" && (
        <div className="tb-glass rounded-xl p-6 text-center">
          <div className="text-xl font-mono text-amber-300 mb-4 break-all px-4">{password || "—"}</div>
          <div className="flex items-center gap-2 justify-center mb-4">
            <label className="text-xs text-white/50">Length:</label>
            <input type="number" min={4} max={64} value={pwLen} onChange={(e) => setPwLen(parseInt(e.target.value) || 12)} className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center" />
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={genPw} className="px-5 py-2 rounded-xl bg-amber-400 text-zinc-900 font-medium text-sm">Generate</button>
            {password && (
              <button onClick={() => { navigator.clipboard.writeText(password); toast.success("Copied"); }} className="px-4 py-2 rounded-xl tb-glass text-white text-sm">Copy</button>
            )}
          </div>
        </div>
      )}

      {tab === "student" && (
        <div className="tb-glass rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-white mb-4 min-h-[3rem]">{picked || "—"}</div>
          <textarea
            value={students}
            onChange={(e) => setStudents(e.target.value)}
            rows={3}
            placeholder="Enter names, comma separated"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none mb-3"
          />
          <button onClick={pickStudent} className="px-5 py-2 rounded-xl bg-amber-400 text-zinc-900 font-medium text-sm">Pick Random Student</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Physics Calculator
// ============================================================
function PhysicsCalc() {
  const [tab, setTab] = useState("projectile");
  const tabs = [
    { id: "projectile", label: "Projectile" },
    { id: "ohms", label: "Ohm's Law" },
    { id: "force", label: "Force (F=ma)" },
    { id: "ke", label: "Kinetic Energy" },
    { id: "pe", label: "Potential Energy" },
  ];
  // Projectile
  const [v0, setV0] = useState(20);
  const [angle, setAngle] = useState(45);
  const [g, setG] = useState(9.8);
  const rad = (angle * Math.PI) / 180;
  const range = (v0 * v0 * Math.sin(2 * rad)) / g;
  const maxH = (v0 * v0 * Math.sin(rad) ** 2) / (2 * g);
  const tFlight = (2 * v0 * Math.sin(rad)) / g;
  // Ohm's
  const [v, setV] = useState(12);
  const [r, setR] = useState(4);
  const i = v / r;
  // Force
  const [m, setM] = useState(5);
  const [a, setA] = useState(2);
  const force = m * a;
  // KE
  const [keM, setKeM] = useState(2);
  const [keV, setKeV] = useState(10);
  const ke = 0.5 * keM * keV * keV;
  // PE
  const [peM, setPeM] = useState(2);
  const [peH, setPeH] = useState(10);
  const [peG, setPeG] = useState(9.8);
  const pe = peM * peG * peH;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-3 py-1.5 rounded-full text-xs", tab === t.id ? "bg-amber-400 text-zinc-900 font-medium" : "tb-glass text-white/70 hover:bg-white/10")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "projectile" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="Initial velocity" val={v0} setVal={setV0} unit="m/s" />
            <ToolRow label="Angle" val={angle} setVal={setAngle} unit="°" />
            <ToolRow label="Gravity" val={g} setVal={setG} unit="m/s²" />
          </div>
          <div className="space-y-2">
            <ToolResult label="Range (R)" value={range.toFixed(2)} unit="m" />
            <ToolResult label="Max height (H)" value={maxH.toFixed(2)} unit="m" />
            <ToolResult label="Time of flight" value={tFlight.toFixed(2)} unit="s" />
            <div className="text-[10px] text-white/40 mt-2 p-2 bg-white/5 rounded-lg">
              R = v₀²·sin(2θ)/g · H = v₀²·sin²(θ)/(2g) · T = 2·v₀·sin(θ)/g
            </div>
          </div>
        </div>
      )}

      {tab === "ohms" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="Voltage" val={v} setVal={setV} unit="V" />
            <ToolRow label="Resistance" val={r} setVal={setR} unit="Ω" />
          </div>
          <div className="space-y-2">
            <ToolResult label="Current (I)" value={i.toFixed(3)} unit="A" />
            <ToolResult label="Power (P)" value={(v * i).toFixed(3)} unit="W" />
            <div className="text-[10px] text-white/40 mt-2 p-2 bg-white/5 rounded-lg">V = I·R · P = V·I</div>
          </div>
        </div>
      )}

      {tab === "force" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="Mass" val={m} setVal={setM} unit="kg" />
            <ToolRow label="Acceleration" val={a} setVal={setA} unit="m/s²" />
          </div>
          <div className="space-y-2">
            <ToolResult label="Force (F)" value={force.toFixed(2)} unit="N" />
            <div className="text-[10px] text-white/40 mt-2 p-2 bg-white/5 rounded-lg">Newton's 2nd law: F = m·a</div>
          </div>
        </div>
      )}

      {tab === "ke" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="Mass" val={keM} setVal={setKeM} unit="kg" />
            <ToolRow label="Velocity" val={keV} setVal={setKeV} unit="m/s" />
          </div>
          <div className="space-y-2">
            <ToolResult label="Kinetic Energy" value={ke.toFixed(2)} unit="J" />
            <div className="text-[10px] text-white/40 mt-2 p-2 bg-white/5 rounded-lg">KE = ½·m·v²</div>
          </div>
        </div>
      )}

      {tab === "pe" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="Mass" val={peM} setVal={setPeM} unit="kg" />
            <ToolRow label="Height" val={peH} setVal={setPeH} unit="m" />
            <ToolRow label="Gravity" val={peG} setVal={setPeG} unit="m/s²" />
          </div>
          <div className="space-y-2">
            <ToolResult label="Potential Energy" value={pe.toFixed(2)} unit="J" />
            <div className="text-[10px] text-white/40 mt-2 p-2 bg-white/5 rounded-lg">PE = m·g·h</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Chemistry Calculator
// ============================================================
function ChemistryCalc() {
  const [tab, setTab] = useState("molar");
  const tabs = [
    { id: "molar", label: "Molar Mass" }, { id: "ph", label: "pH" },
    { id: "dilution", label: "Dilution" }, { id: "gas", label: "Ideal Gas" },
  ];

  const [formula, setFormula] = useState("H2O");
  const molarMass = useMemo(() => {
    // parse formula like H2O, C6H12O6, NaCl, Ca(OH)2
    const parse = (s: string): number => {
      let mass = 0;
      let i = 0;
      const recurse = (str: string): number => {
        let m = 0;
        let j = 0;
        while (j < str.length) {
          if (str[j] === "(") {
            let depth = 1; let end = j + 1;
            while (end < str.length && depth > 0) {
              if (str[end] === "(") depth++;
              else if (str[end] === ")") depth--;
              end++;
            }
            const inner = recurse(str.slice(j + 1, end - 1));
            j = end;
            let mult = "";
            while (j < str.length && /[0-9]/.test(str[j])) { mult += str[j]; j++; }
            m += inner * (mult ? parseInt(mult) : 1);
          } else if (/[A-Z]/.test(str[j])) {
            let sym = str[j++];
            while (j < str.length && /[a-z]/.test(str[j])) sym += str[j++];
            let mult = "";
            while (j < str.length && /[0-9]/.test(str[j])) { mult += str[j]; j++; }
            const el = CHEM_DB[sym];
            if (!el) throw new Error(`Unknown: ${sym}`);
            m += el.mass * (mult ? parseInt(mult) : 1);
          } else { j++; }
        }
        return m;
      };
      try { mass = recurse(s); } catch { mass = NaN; }
      return mass;
    };
    return parse(formula);
  }, [formula]);

  // pH
  const [phMode, setPhMode] = useState<"h" | "oh">("h");
  const [phInput, setPhInput] = useState(0.001);
  const phValue = phMode === "h" ? -Math.log10(phInput) : 14 + Math.log10(phInput);

  // Dilution
  const [c1, setC1] = useState(12);
  const [v1, setV1] = useState(100);
  const [c2, setC2] = useState(1);
  const v2 = (c1 * v1) / c2;

  // Gas
  const [p, setP] = useState(101325);
  const [vol, setVol] = useState(0.0224);
  const [t, setT] = useState(273.15);
  const n = (p * vol) / (8.314 * t);

  const Row = ({ label, val, setVal, unit }: { label: string; val: number; setVal: (n: number) => void; unit: string }) => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-white/60 w-28">{label}</label>
      <input type="number" value={val} onChange={(e) => setVal(parseFloat(e.target.value) || 0)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono outline-none focus:border-amber-400/50" />
      <span className="text-xs text-white/40 w-14">{unit}</span>
    </div>
  );
  const Result = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
      <span className="text-xs text-white/60">{label}</span>
      <span className="text-sm font-mono text-amber-300">{value} {unit}</span>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-3 py-1.5 rounded-full text-xs", tab === t.id ? "bg-amber-400 text-zinc-900 font-medium" : "tb-glass text-white/70 hover:bg-white/10")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "molar" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4">
            <label className="text-xs text-white/60 mb-2 block">Chemical Formula</label>
            <input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-lg text-white font-mono outline-none focus:border-amber-400/50"
              placeholder="e.g. H2O, C6H12O6, Ca(OH)2"
            />
            <div className="mt-3 text-[10px] text-white/40">
              DB has 30 common elements. Try: H2SO4, NaCl, CH4, NH3
            </div>
          </div>
          <div className="space-y-2">
            <ToolResult label="Molar Mass" value={isNaN(molarMass) ? "—" : molarMass.toFixed(3)} unit="g/mol" />
            <div className="text-[10px] text-white/40 p-2 bg-white/5 rounded-lg">
              Sum of (atomic mass × count) for each element in the formula.
            </div>
          </div>
        </div>
      )}

      {tab === "ph" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <div className="flex gap-1.5">
              <button onClick={() => setPhMode("h")} className={cn("px-3 py-1 rounded text-xs", phMode === "h" ? "bg-amber-400 text-zinc-900" : "bg-white/5 text-white/70")}>[H⁺]</button>
              <button onClick={() => setPhMode("oh")} className={cn("px-3 py-1 rounded text-xs", phMode === "oh" ? "bg-amber-400 text-zinc-900" : "bg-white/5 text-white/70")}>[OH⁻]</button>
            </div>
            <ToolRow label={phMode === "h" ? "[H⁺]" : "[OH⁻]"} val={phInput} setVal={setPhInput} unit="mol/L" />
          </div>
          <div className="space-y-2">
            <ToolResult label="pH" value={phValue.toFixed(3)} unit="" />
            <div className="text-[10px] text-white/40 p-2 bg-white/5 rounded-lg">
              {phMode === "h" ? "pH = -log₁₀[H⁺]" : "pH = 14 + log₁₀[OH⁻]"}
            </div>
          </div>
        </div>
      )}

      {tab === "dilution" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="C₁ (stock)" val={c1} setVal={setC1} unit="mol/L" />
            <ToolRow label="V₁ (stock)" val={v1} setVal={setV1} unit="mL" />
            <ToolRow label="C₂ (final)" val={c2} setVal={setC2} unit="mol/L" />
          </div>
          <div className="space-y-2">
            <ToolResult label="V₂ (final volume)" value={v2.toFixed(2)} unit="mL" />
            <div className="text-[10px] text-white/40 p-2 bg-white/5 rounded-lg">
              C₁V₁ = C₂V₂ · Dilution equation
            </div>
          </div>
        </div>
      )}

      {tab === "gas" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="Pressure" val={p} setVal={setP} unit="Pa" />
            <ToolRow label="Volume" val={vol} setVal={setVol} unit="m³" />
            <ToolRow label="Temperature" val={t} setVal={setT} unit="K" />
          </div>
          <div className="space-y-2">
            <ToolResult label="Moles (n)" value={n.toFixed(4)} unit="mol" />
            <div className="text-[10px] text-white/40 p-2 bg-white/5 rounded-lg">
              PV = nRT · R = 8.314 J/(mol·K)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Math Utilities
// ============================================================
function MathUtilities() {
  const [tab, setTab] = useState("prime");
  const tabs = [
    { id: "prime", label: "Prime" }, { id: "lcmhcf", label: "LCM/HCF" },
    { id: "factorial", label: "Factorial" }, { id: "stats", label: "Statistics" },
    { id: "quadratic", label: "Quadratic" },
  ];

  // Prime
  const [primeN, setPrimeN] = useState(17);
  const isPrime = (n: number): boolean => {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
    return true;
  };
  const primeResult = isPrime(primeN);
  const primesUpTo = useMemo(() => {
    const arr: number[] = [];
    for (let i = 2; i <= primeN; i++) if (isPrime(i)) arr.push(i);
    return arr;
  }, [primeN]);

  // LCM/HCF
  const [a, setA] = useState(12);
  const [b, setB] = useState(18);
  const hcf = (x: number, y: number): number => { while (y) { [x, y] = [y, x % y]; } return x; };
  const lcm = Math.abs(a * b) / (hcf(a, b) || 1);

  // Factorial
  const [factN, setFactN] = useState(10);
  const fact = useMemo(() => { let r = 1; for (let i = 2; i <= factN; i++) r *= i; return r; }, [factN]);

  // Stats
  const [statsInput, setStatsInput] = useState("4, 8, 15, 16, 23, 42");
  const statsResult = useMemo(() => {
    const arr = statsInput.split(/[,，\s]+/).map((x) => parseFloat(x)).filter((x) => !isNaN(x));
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = arr.reduce((s, x) => s + x, 0);
    const mean = sum / arr.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const freq: Record<number, number> = {};
    arr.forEach((x) => freq[x] = (freq[x] || 0) + 1);
    const maxFreq = Math.max(...Object.values(freq));
    const modes = Object.entries(freq).filter(([, v]) => v === maxFreq && maxFreq > 1).map(([k]) => k);
    const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
    return {
      count: arr.length, sum, mean, median,
      modes: modes.length ? modes : ["none"],
      min: sorted[0], max: sorted[sorted.length - 1],
      range: sorted[sorted.length - 1] - sorted[0],
      stdDev: Math.sqrt(variance),
    };
  }, [statsInput]);

  // Quadratic
  const [qa, setQa] = useState(1);
  const [qb, setQb] = useState(-5);
  const [qc, setQc] = useState(6);
  const quadraticResult = useMemo(() => {
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) {
      const real = -qb / (2 * qa);
      const imag = Math.sqrt(-disc) / (2 * qa);
      return { disc, roots: [`${real.toFixed(3)} + ${imag.toFixed(3)}i`, `${real.toFixed(3)} - ${imag.toFixed(3)}i`] };
    }
    if (disc === 0) {
      return { disc, roots: [(-qb / (2 * qa)).toFixed(3)] };
    }
    const r1 = (-qb + Math.sqrt(disc)) / (2 * qa);
    const r2 = (-qb - Math.sqrt(disc)) / (2 * qa);
    return { disc, roots: [r1.toFixed(3), r2.toFixed(3)] };
  }, [qa, qb, qc]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-3 py-1.5 rounded-full text-xs", tab === t.id ? "bg-amber-400 text-zinc-900 font-medium" : "tb-glass text-white/70 hover:bg-white/10")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "prime" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="n" val={primeN} setVal={setPrimeN} />
            <ToolResult label="Is prime?" value={primeResult ? "Yes ✅" : "No ❌"} />
          </div>
          <div className="tb-glass rounded-xl p-4">
            <div className="text-xs text-white/60 mb-2">Primes up to {primeN} ({primesUpTo.length}):</div>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto tb-scroll">
              {primesUpTo.map((p) => (
                <span key={p} className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-xs rounded font-mono">{p}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "lcmhcf" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="a" val={a} setVal={setA} />
            <ToolRow label="b" val={b} setVal={setB} />
          </div>
          <div className="space-y-2">
            <ToolResult label="HCF (GCD)" value={String(hcf(a, b))} />
            <ToolResult label="LCM" value={String(lcm)} />
            <div className="text-[10px] text-white/40 p-2 bg-white/5 rounded-lg">
              HCF via Euclid's algorithm · LCM = |a·b| / HCF(a,b)
            </div>
          </div>
        </div>
      )}

      {tab === "factorial" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <ToolRow label="n" val={factN} setVal={setFactN} />
            <div className="text-[10px] text-white/40">Max recommended: 170 (JS double range)</div>
          </div>
          <div className="space-y-2">
            <ToolResult label={`${factN}!`} value={fact.toExponential(6)} />
            <ToolResult label="Exact" value={fact > 1e15 ? fact.toExponential(6) : String(fact)} />
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <label className="text-xs text-white/60">Values (comma separated)</label>
            <textarea
              value={statsInput}
              onChange={(e) => setStatsInput(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 font-mono"
            />
          </div>
          <div className="space-y-2">
            {statsResult ? (
              <>
                <ToolResult label="Count" value={String(statsResult.count)} />
                <ToolResult label="Sum" value={statsResult.sum.toFixed(3)} />
                <ToolResult label="Mean" value={statsResult.mean.toFixed(3)} />
                <ToolResult label="Median" value={statsResult.median.toFixed(3)} />
                <ToolResult label="Mode" value={statsResult.modes.join(", ")} />
                <ToolResult label="Min" value={String(statsResult.min)} />
                <ToolResult label="Max" value={String(statsResult.max)} />
                <ToolResult label="Range" value={String(statsResult.range)} />
                <ToolResult label="Std Dev" value={statsResult.stdDev.toFixed(3)} />
              </>
            ) : <div className="text-white/40 text-sm text-center py-8">Enter values</div>}
          </div>
        </div>
      )}

      {tab === "quadratic" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="tb-glass rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white/80">ax² + bx + c = 0</h3>
            <ToolRow label="a" val={qa} setVal={setQa} />
            <ToolRow label="b" val={qb} setVal={setQb} />
            <ToolRow label="c" val={qc} setVal={setQc} />
          </div>
          <div className="space-y-2">
            <ToolResult label="Discriminant (b²-4ac)" value={quadraticResult.disc.toFixed(3)} />
            {quadraticResult.disc > 0 && <div className="text-xs text-teal-300 px-2">Two real roots</div>}
            {quadraticResult.disc === 0 && <div className="text-xs text-amber-300 px-2">One real root</div>}
            {quadraticResult.disc < 0 && <div className="text-xs text-rose-300 px-2">Two complex roots</div>}
            {quadraticResult.roots.map((r, i) => (
              <ToolResult key={i} label={`Root ${i + 1}`} value={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolboxView;
