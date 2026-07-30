"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { askAI } from "@/lib/ai";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { toast } from "sonner";
import { BookMarked, Search, ChevronRight, ChevronDown, Sparkles, Loader2, Download, CheckCircle2, Circle } from "lucide-react";
import { profileGetJSON, profileSetJSON, profileGetItem, profileSetItem } from "@/lib/profile-storage";

interface Derivation { id: string; subject: "Physics" | "Mathematics"; title: string; difficulty: "Medium" | "Hard"; steps: string[]; formula: string; applications: string[]; }

const DERIVATIONS: Derivation[] = [
  { id: "d1", subject: "Physics", title: "Equations of Motion (v = u + at)", difficulty: "Medium", steps: ["Acceleration a = dv/dt", "Integrate: ∫dv = ∫a dt", "v - u = a(t - 0)", "v = u + at"], formula: "v = u + at", applications: ["Finding final velocity", "Calculating acceleration", "Motion analysis"] },
  { id: "d2", subject: "Physics", title: "Second Equation of Motion (s = ut + ½at²)", difficulty: "Medium", steps: ["Velocity v = ds/dt", "ds = v dt = (u + at) dt", "Integrate: s = ∫(u + at) dt", "s = ut + ½at²"], formula: "s = ut + ½at²", applications: ["Displacement calculation", "Free fall problems", "Projectile motion"] },
  { id: "d3", subject: "Physics", title: "Work-Energy Theorem", difficulty: "Medium", steps: ["Work W = F·dx", "F = ma = m(dv/dt)", "W = ∫m(dv/dt)dx = ∫mv dv", "W = ½mv² - ½mu² = ΔKE"], formula: "W = ΔKE = ½mv² - ½mu²", applications: ["Energy conservation", "Stopping distance", "Rolling objects"] },
  { id: "d4", subject: "Physics", title: "Conservation of Momentum", difficulty: "Medium", steps: ["Newton's 3rd Law: F₁₂ = -F₂₁", "F = dp/dt", "dp₁/dt = -dp₂/dt", "d(p₁ + p₂)/dt = 0", "p₁ + p₂ = constant"], formula: "m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂", applications: ["Collisions", "Explosions", "Rocket propulsion"] },
  { id: "d5", subject: "Physics", title: "Gravitational Potential Energy", difficulty: "Medium", steps: ["Force of gravity F = GMm/r²", "Work done dW = -F dr", "U = -∫(GMm/r²) dr from ∞ to r", "U = -GMm/r"], formula: "U = -GMm/r", applications: ["Satellite orbits", "Escape velocity", "Planetary motion"] },
  { id: "d6", subject: "Physics", title: "Escape Velocity", difficulty: "Hard", steps: ["Total energy at surface: KE + PE = ½mv² - GMm/R", "At infinity: KE = 0, PE = 0", "For escape: ½mv² - GMm/R = 0", "v_e = √(2GM/R) = √(2gR)"], formula: "v_e = √(2GM/R) = √(2gR)", applications: ["Rocket launches", "Space missions", "Black holes"] },
  { id: "d7", subject: "Physics", title: "Orbital Velocity", difficulty: "Hard", steps: ["Centripetal force = Gravitational force", "mv²/r = GMm/r²", "v² = GM/r", "v_o = √(GM/r) = √(gR)"], formula: "v_o = √(GM/r)", applications: ["Satellites", "ISS orbit", "Geostationary orbit"] },
  { id: "d8", subject: "Physics", title: "Simple Harmonic Motion Equation", difficulty: "Hard", steps: ["Restoring force F = -kx", "F = ma → a = -kx/m = -ω²x", "d²x/dt² = -ω²x", "Solution: x = A sin(ωt + φ)"], formula: "x = A sin(ωt + φ); T = 2π√(m/k)", applications: ["Pendulum", "Spring oscillator", "Wave motion"] },
  { id: "d9", subject: "Physics", title: "Wave Equation", difficulty: "Hard", steps: ["Displacement y = f(x - vt)", "∂²y/∂t² = v² ∂²y/∂x²", "For sinusoidal: y = A sin(kx - ωt)", "v = ω/k = λf"], formula: "v = λf = √(T/μ)", applications: ["Sound waves", "Light waves", "String vibrations"] },
  { id: "d10", subject: "Physics", title: "Boyle's Law (PV = constant)", difficulty: "Medium", steps: ["For isothermal process: T = constant", "Kinetic theory: P = ⅓ρv²", "At constant T, v² is constant", "P ∝ 1/ρ ∝ 1/V", "PV = constant"], formula: "P₁V₁ = P₂V₂ (at constant T)", applications: ["Gas compression", "Diving physics", "Air bags"] },
  { id: "d11", subject: "Physics", title: "Bernoulli's Principle", difficulty: "Hard", steps: ["Work-energy conservation for fluid flow", "Work done by pressure: (P₁ - P₂)dV", "Change in KE: ½ρv₂²dV - ½ρv₁²dV", "Change in PE: ρg(h₂ - h₁)dV", "P₁ + ½ρv₁² + ρgh₁ = P₂ + ½ρv₂² + ρgh₂"], formula: "P + ½ρv² + ρgh = constant", applications: ["Airplane wings", "Venturi meter", "Blood flow"] },
  { id: "d12", subject: "Physics", title: "Terminal Velocity", difficulty: "Hard", steps: ["Viscous force F = 6πηrv (Stokes' Law)", "Weight - Buoyancy = Viscous force at terminal velocity", "mg - ρσVg = 6πηrv_t", "v_t = 2r²(ρ-σ)g / 9η"], formula: "v_t = 2r²(ρ-σ)g / 9η", applications: ["Raindrop fall", "Sedimentation", "Parachute design"] },
  { id: "d13", subject: "Physics", title: "Doppler Effect", difficulty: "Medium", steps: ["Apparent frequency changes with relative motion", "Source moving toward observer: f' = f(v/(v-v_s))", "Source moving away: f' = f(v/(v+v_s))", "Observer moving: f' = f((v+v_o)/v)"], formula: "f' = f(v ± v_o)/(v ∓ v_s)", applications: ["Radar guns", "Astronomy redshift", "Medical ultrasound"] },
  { id: "d14", subject: "Physics", title: "Lens Formula", difficulty: "Medium", steps: ["For convex lens: 1/v - 1/u = 1/f", "Magnification m = v/u = h'/h", "Using sign convention", "1/f = 1/v - 1/u"], formula: "1/f = 1/v - 1/u; m = h'/h = v/u", applications: ["Cameras", "Eyeglasses", "Microscopes"] },
  { id: "d15", subject: "Physics", title: "Stefan's Law", difficulty: "Hard", steps: ["Energy radiated per unit area per second: E = σT⁴", "σ = Stefan's constant = 5.67×10⁻⁸ W/m²K⁴", "For body with emissivity e: E = eσT⁴", "Net power: P = eσA(T⁴ - T₀⁴)"], formula: "E = σT⁴; P = eσA(T⁴ - T₀⁴)", applications: ["Stars", "Heat radiation", "Thermal imaging"] },
  { id: "d16", subject: "Mathematics", title: "Quadratic Formula", difficulty: "Medium", steps: ["ax² + bx + c = 0", "Divide by a: x² + (b/a)x + c/a = 0", "Complete the square: (x + b/2a)² = (b²-4ac)/4a²", "x + b/2a = ±√(b²-4ac)/2a", "x = (-b ± √(b²-4ac)) / 2a"], formula: "x = (-b ± √(b²-4ac)) / 2a", applications: ["Finding roots", "Projectile motion", "Optimization"] },
  { id: "d17", subject: "Mathematics", title: "Distance Formula", difficulty: "Medium", steps: ["Two points P(x₁,y₁) and Q(x₂,y₂)", "Using Pythagorean theorem", "d² = (x₂-x₁)² + (y₂-y₁)²", "d = √((x₂-x₁)² + (y₂-y₁)²)"], formula: "d = √((x₂-x₁)² + (y₂-y₁)²)", applications: ["Coordinate geometry", "Navigation", "Computer graphics"] },
  { id: "d18", subject: "Mathematics", title: "Section Formula", difficulty: "Medium", steps: ["Point P divides AB in ratio m:n", "Using similar triangles", "x = (mx₂ + nx₁)/(m+n)", "y = (my₂ + ny₁)/(m+n)"], formula: "P = ((mx₂+nx₁)/(m+n), (my₂+ny₁)/(m+n))", applications: ["Finding midpoints", "Centroid", "Coordinate proofs"] },
  { id: "d19", subject: "Mathematics", title: "Sum of Arithmetic Progression", difficulty: "Medium", steps: ["AP: a, a+d, a+2d, ..., a+(n-1)d", "S = a + (a+d) + ... + (a+(n-1)d)", "Reverse: S = (a+(n-1)d) + ... + a", "2S = n(2a + (n-1)d)", "S = n/2(2a + (n-1)d)"], formula: "S_n = n/2(2a + (n-1)d) = n/2(a + l)", applications: ["Series sums", "Loan payments", "Seating arrangements"] },
  { id: "d20", subject: "Mathematics", title: "Sum of Geometric Progression", difficulty: "Medium", steps: ["GP: a, ar, ar², ..., arⁿ⁻¹", "S = a(rⁿ - 1)/(r - 1) for r > 1", "S = a(1 - rⁿ)/(1 - r) for r < 1", "Sum to infinity: S = a/(1-r) for |r| < 1"], formula: "S_n = a(rⁿ-1)/(r-1); S_∞ = a/(1-r)", applications: ["Compound interest", "Population growth", "Series convergence"] },
  { id: "d21", subject: "Mathematics", title: "Binomial Theorem", difficulty: "Hard", steps: ["(a+b)ⁿ = Σ C(n,r) aⁿ⁻ʳ bʳ", "Proof by induction:", "Base: (a+b)¹ = C(1,0)a + C(1,1)b = a+b ✓", "Assume (a+b)ⁿ = Σ C(n,r) aⁿ⁻ʳ bʳ", "Multiply by (a+b) and use Pascal's rule", "C(n,r) + C(n,r-1) = C(n+1,r)"], formula: "(a+b)ⁿ = Σⁿᵣ₌₀ C(n,r) aⁿ⁻ʳ bʳ", applications: ["Expanding polynomials", "Probability", "Approximations"] },
  { id: "d22", subject: "Mathematics", title: "Derivative of xⁿ", difficulty: "Hard", steps: ["f(x) = xⁿ", "f'(x) = lim(h→0) [(x+h)ⁿ - xⁿ]/h", "Using binomial expansion: (x+h)ⁿ = xⁿ + nxⁿ⁻¹h + ...", "(x+h)ⁿ - xⁿ ≈ nxⁿ⁻¹h for small h", "f'(x) = lim(h→0) nxⁿ⁻¹h/h = nxⁿ⁻¹"], formula: "d/dx(xⁿ) = nxⁿ⁻¹", applications: ["Rate of change", "Optimization", "Physics velocity/acceleration"] },
  { id: "d23", subject: "Mathematics", title: "Equation of Circle", difficulty: "Medium", steps: ["Center (h,k), radius r", "Distance from center to any point (x,y) = r", "√((x-h)² + (y-k)²) = r", "(x-h)² + (y-k)² = r²"], formula: "(x-h)² + (y-k)² = r²", applications: ["Geometry", "Orbital paths", "Computer graphics"] },
  { id: "d24", subject: "Mathematics", title: "Slope of a Line", difficulty: "Medium", steps: ["Two points P(x₁,y₁) and Q(x₂,y₂)", "Slope = rise/run = Δy/Δx", "m = (y₂-y₁)/(x₂-x₁)", "Angle: θ = tan⁻¹(m)"], formula: "m = (y₂-y₁)/(x₂-x₁)", applications: ["Linear equations", "Rate of change", "Parallel/perpendicular lines"] },
  { id: "d25", subject: "Mathematics", title: "Limit of sin(x)/x as x→0", difficulty: "Hard", steps: ["Consider unit circle with angle x (radians)", "Area of triangle < Area of sector < Area of large triangle", "sin(x) < x < tan(x)", "Divide by sin(x): 1 < x/sin(x) < 1/cos(x)", "cos(x) < sin(x)/x < 1", "As x→0, cos(x)→1", "By squeeze theorem: lim sin(x)/x = 1"], formula: "lim(x→0) sin(x)/x = 1", applications: ["Derivative of sin(x)", "Taylor series", "Calculus foundations"] },
];

export function DerivationsView() {
  const addXP = useStore((s) => s.addXP);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Physics" | "Mathematics">("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [studied, setStudied] = useState<string[]>([]);
  const [explainId, setExplainId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = profileGetJSON<string[]>(scholarClass, "dv-studied", []);
    if (Array.isArray(s)) setStudied(s);
  }, [scholarClass]);

  const filtered = useMemo(() => {
    let list = DERIVATIONS;
    if (filter !== "All") list = list.filter(d => d.subject === filter);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(d => d.title.toLowerCase().includes(q) || d.formula.toLowerCase().includes(q)); }
    return list;
  }, [search, filter]);

  const markStudied = (id: string, title: string) => {
    if (studied.includes(id)) return;
    const next = [...studied, id];
    setStudied(next);
    profileSetJSON(scholarClass, "dv-studied", next);
    addXP(5);
    toast.success(`${title} studied · +5 XP`);
  };

  const explain = async (d: Derivation) => {
    setExplainId(d.id); setLoading(true); setExplanation(null);
    try {
      const r = await askAI(`Explain this derivation step by step in simple terms for a Class 11 student:\n\nTitle: ${d.title}\nSteps:\n${d.steps.map((s,i)=>`${i+1}. ${s}`).join("\n")}\n\nFinal formula: ${d.formula}\n\nUse markdown. Explain each step clearly.`, "default");
      setExplanation(r);
    } catch (e: any) { toast.error("Failed", { description: e?.message }); }
    finally { setLoading(false); }
  };

  const exportAll = () => {
    const md = `# Derivation Library\n\n**Class 11 CBSE — Physics & Mathematics**\n\n${DERIVATIONS.map((d, i) => `## ${i+1}. ${d.title}\n**Subject:** ${d.subject} | **Difficulty:** ${d.difficulty}\n\n**Derivation:**\n${d.steps.map((s, j) => `${j+1}. ${s}`).join("\n")}\n\n**Formula:** ${d.formula}\n\n**Applications:**\n${d.applications.map(a => `- ${a}`).join("\n")}\n`).join("\n---\n\n")}`;
    exportPDF({ title: "Derivation Library", subtitle: `Class ${scholarClass} CBSE — PCM`, bodyHtml: mdToHtml(md), accent: "#3b82f6", scholarClass });
    toast.success("Opening derivation library PDF…");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap'); .dv-glass { background:rgba(255,255,255,0.04); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.12); border-radius:1rem; } .dv-glass-strong { background:rgba(255,255,255,0.07); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.16); border-radius:1rem; } .dv-serif { font-family:'Instrument Serif',serif; font-style:italic; }`}</style>
      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0"><source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4" type="video/mp4" /></video>
      <div className="absolute inset-0 z-0 bg-black/55" />
      <div className="relative z-10 p-4 md:p-8 text-white">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Class 11 • PCM Derivations</p>
              <h1 className="dv-serif text-4xl md:text-5xl text-white leading-tight">Derivation Library</h1>
              <p className="text-sm text-white/50 mt-2">{DERIVATIONS.length} step-by-step derivations for Physics & Mathematics.</p>
            </div>
            <button onClick={exportAll} className="dv-glass-strong px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 hover:scale-105 transition-transform"><Download className="h-3.5 w-3.5" /> Export</button>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[{ label: "Total", value: DERIVATIONS.length }, { label: "Studied", value: studied.length }, { label: "Physics", value: DERIVATIONS.filter(d=>d.subject==="Physics").length }, { label: "Maths", value: DERIVATIONS.filter(d=>d.subject==="Mathematics").length }].map((s, i) => (
              <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1*i }} className="dv-glass p-3 text-center"><p className="text-2xl font-bold">{s.value}</p><p className="text-[10px] text-white/50 uppercase tracking-wide">{s.label}</p></motion.div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" /><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search derivations…" className="dv-glass w-full pl-9 pr-4 py-2 rounded-full text-sm text-white placeholder-white/40 outline-none" /></div>
            <div className="flex gap-2">{(["All","Physics","Mathematics"] as const).map(f => <button key={f} onClick={()=>setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter===f?"dv-glass-strong text-white":"dv-glass text-white/60 hover:text-white"}`}>{f}</button>)}</div>
          </div>
          <div className="space-y-3">
            {filtered.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.03*i }} className="dv-glass overflow-hidden">
                <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} className="w-full p-4 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.subject==="Physics"?"bg-blue-500/20 text-blue-300":"bg-indigo-500/20 text-indigo-300"}`}>{d.subject}</span>
                    <div><h3 className="text-sm font-semibold">{d.title}</h3><p className="text-xs text-white/40">{d.difficulty} • {d.formula}</p></div>
                  </div>
                  <div className="flex items-center gap-2">{studied.includes(d.id) && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}{expanded===d.id?<ChevronDown className="h-4 w-4 text-white/40"/>:<ChevronRight className="h-4 w-4 text-white/40"/>}</div>
                </button>
                <AnimatePresence>
                  {expanded === d.id && (
                    <motion.div initial={{ height:0 }} animate={{ height:"auto" }} exit={{ height:0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-2">{d.steps.map((s, j) => <div key={j} className="flex gap-3 items-start"><span className="dv-glass-strong grid place-items-center h-6 w-6 rounded-full text-xs font-bold shrink-0">{j+1}</span><p className="text-sm text-white/70 pt-0.5">{s}</p></div>)}</div>
                        <div className="dv-glass-strong p-3"><p className="text-xs text-white/50 mb-1">Final Formula:</p><p className="font-mono text-emerald-300">{d.formula}</p></div>
                        <div><p className="text-xs text-white/50 mb-1">Applications:</p><div className="flex flex-wrap gap-1.5">{d.applications.map((a, j) => <span key={j} className="dv-glass px-2 py-1 rounded-full text-[11px] text-white/60">{a}</span>)}</div></div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => explain(d)} disabled={loading && explainId===d.id} className="dv-glass-strong px-3 py-1.5 rounded-full text-xs flex items-center gap-1 hover:scale-105 transition-transform disabled:opacity-50">{loading && explainId===d.id?<Loader2 className="h-3 w-3 animate-spin"/>:<Sparkles className="h-3 w-3"/>} Explain Step</button>
                          {!studied.includes(d.id) && <button onClick={() => markStudied(d.id, d.title)} className="dv-glass px-3 py-1.5 rounded-full text-xs flex items-center gap-1 hover:scale-105 transition-transform"><Circle className="h-3 w-3"/> Mark Studied</button>}
                        </div>
                        {explainId === d.id && explanation && <div className="dv-glass p-3 mt-2"><div className="text-sm text-white/70 space-y-1">{explanation.split("\n").map((l, j) => <p key={j}>{l}</p>)}</div></div>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export default DerivationsView;
