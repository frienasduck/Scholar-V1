"use client";

// Genuinely interactive lab simulations for the Experiment Lab.
// Each sim: real controls affect real visuals and real calculated results.
// Completion only fires after the user has performed the sim + recorded
// at least one observation + checked at least one answer.

import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "@/lib/notifications/notification-api";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import {
  Play, Pause, RotateCcw, Check, Plus, Trash2, Calculator, Ruler,
  Activity, TrendingUp,
} from "lucide-react";

// ===== Shared completion tracking (profile-scoped, persistent) =====

const LS_KEY = "lab-completed-experiments";

export function loadCompletedExps(scholarClass: 9 | 11): string[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<string[]>(scholarClass, LS_KEY, []);
}

export function saveCompletedExp(scholarClass: 9 | 11, expId: string): string[] {
  const all = loadCompletedExps(scholarClass);
  if (!all.includes(expId)) all.push(expId);
  profileSetJSON(scholarClass, LS_KEY, all);
  return all;
}

// ===== Observation persistence (profile-scoped, per-experiment) =====
function obsKey(expId: string) { return `lab-observations:${expId}`; }

function loadObservations<T extends ObsRow>(scholarClass: 9 | 11, expId: string): T[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<T[]>(scholarClass, obsKey(expId), []);
}

function saveObservations<T extends ObsRow>(scholarClass: 9 | 11, expId: string, rows: T[]) {
  profileSetJSON(scholarClass, obsKey(expId), rows);
}

// ===== Structured duplicate detection =====
function vernierKey(r: ObsRow): string {
  return [String(r.msr ?? ""), String(r.vsr ?? ""), String(r.zeroErr ?? ""), String(r.corrected ?? "")].join("|");
}
function screwKey(r: ObsRow): string {
  return [String(r.psr ?? ""), String(r.csr ?? ""), String(r.zeroErr ?? ""), String(r.corrected ?? "")].join("|");
}
function pendulumKey(r: ObsRow): string {
  return [String(r.length ?? ""), String(r.oscillations ?? ""), String(r.time ?? "")].join("|");
}

// ===== Shared prop type used by lab.tsx's InteractiveSimRouter =====
export interface LabSimProps {
  onComplete: () => void;
  alreadyCompleted: boolean;
  scholarClass: 9 | 11;
}

// ===== Shared Observation Table component =====

interface ObsRow {
  id: string;
  trial: number;
  [key: string]: string | number;
}

function ObservationTable({
  title, columns, rows, onDelete,
}: {
  title: string;
  columns: { key: string; label: string; unit?: string }[];
  rows: ObsRow[];
  onDelete?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50 text-center">
        No observations recorded yet. Perform the experiment and add a reading.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-3 py-2 bg-white/5 text-xs font-semibold text-white/80 flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-teal-400" /> {title} ({rows.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-white/60">
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-1.5 text-left font-medium">
                  {c.label}{c.unit ? <span className="text-white/40"> ({c.unit})</span> : null}
                </th>
              ))}
              {onDelete && <th className="px-2 py-1.5"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 text-white/80 tabular-nums">{r[c.key]}</td>
                ))}
                {onDelete && (
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => onDelete(r.id)} aria-label="Delete observation"
                      className="p-1 rounded hover:bg-rose-500/15 text-rose-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 1. VERNIER CALIPERS
// ============================================================================

const VERNIER_LC_MM = 0.1;
const VERNIER_RANGE_MM = 50;

export function VernierCalipersSim({ onComplete, scholarClass }: LabSimProps) {
  const [jawPos, setJawPos] = useState(12.3);
  const [zeroError, setZeroError] = useState<"none" | "positive" | "negative">("none");
  const [zeroErrorMag, setZeroErrorMag] = useState(0.2);
  const [userReading, setUserReading] = useState("");
  const [checked, setChecked] = useState(false);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations<ObsRow>(scholarClass, "vernier-calipers"));
  const [movedJaw, setMovedJaw] = useState(false);
  const [recordedObs, setRecordedObs] = useState(observations.length > 0);
  const [checkedAnswer, setCheckedAnswer] = useState(false);

  // Persist observations whenever they change
  useEffect(() => {
    saveObservations(scholarClass, "vernier-calipers", observations);
  }, [observations, scholarClass]);

  const msr = Math.floor(jawPos);
  const vernierOffset = jawPos - msr;
  const vsr = Math.round(vernierOffset / VERNIER_LC_MM);
  const instrumentReading = msr + vsr * VERNIER_LC_MM;
  const correctedReading =
    zeroError === "positive" ? instrumentReading - zeroErrorMag
    : zeroError === "negative" ? instrumentReading + zeroErrorMag
    : instrumentReading;

  const handleCheck = () => {
    setChecked(true); setCheckedAnswer(true);
    const userVal = parseFloat(userReading);
    if (Number.isFinite(userVal)) {
      const diff = Math.abs(userVal - correctedReading);
      if (diff < 0.05) toast.success("✓ Correct! Your reading matches the corrected value.");
      else toast.error(`✗ Off by ${diff.toFixed(2)} mm. Corrected reading = ${correctedReading.toFixed(2)} mm.`);
    } else toast.error("Enter a valid number for your reading.");
  };

  const handleAddObservation = () => {
    const userVal = parseFloat(userReading);
    if (!userReading.trim()) {
      toast.error("Enter and check your reading first.");
      return;
    }
    if (!Number.isFinite(userVal)) {
      toast.error("The entered value is not valid.");
      return;
    }
    const newRow: ObsRow = {
      id: `obs-${Date.now()}`, trial: observations.length + 1,
      msr: msr.toFixed(0), vsr: vsr.toFixed(0), lc: VERNIER_LC_MM.toFixed(2),
      zeroErr: zeroError === "none" ? "0" : `${zeroError === "positive" ? "+" : "−"}${zeroErrorMag.toFixed(2)}`,
      corrected: correctedReading.toFixed(2),
      userReading: userVal.toFixed(2),
    };
    // Structured duplicate detection
    const newKey = vernierKey(newRow);
    if (observations.some((o) => vernierKey(o) === newKey)) {
      toast.info("This observation is already recorded. Change a control to add a new one.");
      return;
    }
    setObservations((prev) => [...prev, newRow]);
    setRecordedObs(true);
    toast.success(`Observation #${newRow.trial} recorded.`);
  };

  useEffect(() => {
    if (movedJaw && recordedObs && checkedAnswer) onComplete();
  }, [movedJaw, recordedObs, checkedAnswer, onComplete]);

  const reset = () => {
    setJawPos(12.3); setZeroError("none"); setZeroErrorMag(0.2);
    setUserReading(""); setChecked(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="relative h-16 mb-2">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-900/30 to-amber-800/20 rounded-md border border-amber-700/30">
              {Array.from({ length: VERNIER_RANGE_MM + 1 }, (_, i) => {
                const isMajor = i % 10 === 0;
                const isHalf = i % 5 === 0;
                return (
                  <div key={i} className="absolute bottom-0 bg-white/80"
                    style={{ left: `${(i / VERNIER_RANGE_MM) * 100}%`, width: "1px", height: isMajor ? "20px" : isHalf ? "14px" : "8px" }}>
                    {isMajor && <span className="absolute -top-4 -translate-x-1/2 text-[9px] text-white/70 tabular-nums">{i}</span>}
                  </div>
                );
              })}
              <span className="absolute top-1 right-2 text-[9px] text-white/40">mm</span>
            </div>
          </div>
          <div className="relative h-12 mb-2">
            <div className="absolute left-0 top-0 w-2 h-full bg-amber-600/60 rounded-l"></div>
            <div className="absolute top-1 h-10 bg-gradient-to-b from-sky-500/40 to-sky-600/30 border border-sky-400/40 rounded"
              style={{ left: "8px", width: `${(jawPos / VERNIER_RANGE_MM) * 100 * 6}px`, maxWidth: "100%" }}>
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-sky-300 whitespace-nowrap">Object: {jawPos.toFixed(2)} mm</span>
            </div>
            <div className="absolute top-0 w-2 h-full bg-amber-500/70 rounded-r transition-all"
              style={{ left: `calc(${(jawPos / VERNIER_RANGE_MM) * 100 * 6}px + 8px)` }}></div>
          </div>
          <div className="relative h-8">
            <div className="absolute top-0 h-full bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 rounded-md border border-emerald-700/30 transition-all"
              style={{ left: `calc(${(jawPos / VERNIER_RANGE_MM) * 100 * 6}px + 8px)`, width: "60px" }}>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="absolute bottom-0"
                  style={{ left: `${i * 6}px`, width: "1px", height: i === vsr ? "16px" : i === 5 ? "12px" : "8px", backgroundColor: i === vsr ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>
                  {i === vsr && <span className="absolute -top-3.5 -translate-x-1/2 text-[9px] text-amber-300 font-bold">▼{i}</span>}
                </div>
              ))}
              <span className="absolute top-0.5 left-1 text-[8px] text-emerald-300/70">Vernier</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5" /> Movable jaw position</span>
            <span className="font-mono text-white">{jawPos.toFixed(2)} mm</span>
          </label>
          <input type="range" min={1} max={VERNIER_RANGE_MM} step={0.1} value={jawPos}
            onChange={(e) => { setJawPos(parseFloat(e.target.value)); setChecked(false); setMovedJaw(true); }}
            className="w-full accent-sky-500 h-6" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 mb-2 block">Zero error</label>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setZeroError("none"); setChecked(false); }} className={`px-2.5 py-1.5 rounded-lg text-xs ${zeroError === "none" ? "bg-sky-500 text-white" : "bg-white/5 text-white/60"}`}>None</button>
            <button onClick={() => { setZeroError("positive"); setChecked(false); }} className={`px-2.5 py-1.5 rounded-lg text-xs ${zeroError === "positive" ? "bg-emerald-500 text-white" : "bg-white/5 text-white/60"}`}>+ Positive</button>
            <button onClick={() => { setZeroError("negative"); setChecked(false); }} className={`px-2.5 py-1.5 rounded-lg text-xs ${zeroError === "negative" ? "bg-rose-500 text-white" : "bg-white/5 text-white/60"}`}>− Negative</button>
          </div>
          {zeroError !== "none" && (
            <div className="mt-2">
              <label className="text-[10px] text-white/50">Magnitude (mm): {zeroErrorMag.toFixed(2)}</label>
              <input type="range" min={0.05} max={0.5} step={0.05} value={zeroErrorMag}
                onChange={(e) => { setZeroErrorMag(parseFloat(e.target.value)); setChecked(false); }}
                className="w-full accent-amber-500 h-5" />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 mb-2">
          <Calculator className="h-3.5 w-3.5 text-violet-400" /> Calculated Readings
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg bg-white/5 p-2"><p className="text-white/50 text-[10px] uppercase">MSR</p><p className="text-white font-mono">{msr.toFixed(0)} mm</p></div>
          <div className="rounded-lg bg-white/5 p-2"><p className="text-white/50 text-[10px] uppercase">VSR</p><p className="text-amber-300 font-mono">{vsr}</p></div>
          <div className="rounded-lg bg-white/5 p-2"><p className="text-white/50 text-[10px] uppercase">Least Count</p><p className="text-white font-mono">{VERNIER_LC_MM.toFixed(2)} mm</p></div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2"><p className="text-emerald-300/70 text-[10px] uppercase">Corrected</p><p className="text-emerald-300 font-mono font-bold">{correctedReading.toFixed(2)} mm</p></div>
        </div>
        <p className="text-[10px] text-white/40 mt-2">Formula: True Reading = MSR + (VSR × LC){zeroError !== "none" && ` ${zeroError === "positive" ? "−" : "+"} Zero Error`}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <label className="text-xs text-white/60 mb-2 block">Enter your observed reading (mm)</label>
        <div className="flex gap-2">
          <input type="number" step="0.01" value={userReading}
            onChange={(e) => { setUserReading(e.target.value); setChecked(false); }}
            placeholder="e.g. 12.30"
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white h-10" />
          <button onClick={handleCheck} className="px-3 py-2 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 h-10 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" /> Check
          </button>
          <button onClick={handleAddObservation} className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 h-10 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add to Table
          </button>
        </div>
        {checked && (
          <p className="text-[11px] text-white/60 mt-2">
            Corrected reading = {correctedReading.toFixed(2)} mm · Zero error = {zeroError === "none" ? "none" : `${zeroError === "positive" ? "+" : "−"}${zeroErrorMag.toFixed(2)} mm`}
          </p>
        )}
      </div>

      <ObservationTable title="Observation Table"
        columns={[{ key: "trial", label: "Trial" }, { key: "msr", label: "MSR", unit: "mm" }, { key: "vsr", label: "VSR" }, { key: "lc", label: "LC", unit: "mm" }, { key: "zeroErr", label: "Zero Err", unit: "mm" }, { key: "corrected", label: "Corrected", unit: "mm" }]}
        rows={observations}
        onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))} />

      <div className="flex justify-end">
        <button onClick={reset} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 h-10 flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 2. SCREW GAUGE
// ============================================================================

const SG_PITCH_MM = 1;
const SG_DIVISIONS = 50;
const SG_LC_MM = SG_PITCH_MM / SG_DIVISIONS;

export function ScrewGaugeSim({ onComplete, scholarClass }: LabSimProps) {
  const [circularDiv, setCircularDiv] = useState(12);
  const [mainScaleReading, setMainScaleReading] = useState(3);
  const [objectThickness, setObjectThickness] = useState<"wire-thin" | "wire-thick" | "glass-slide">("wire-thin");
  const [zeroError, setZeroError] = useState<"none" | "positive" | "negative">("none");
  const [zeroErrorMag, setZeroErrorMag] = useState(2);
  const [userReading, setUserReading] = useState("");
  const [checked, setChecked] = useState(false);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations<ObsRow>(scholarClass, "screw-gauge"));
  const [rotated, setRotated] = useState(false);
  const [recordedObs, setRecordedObs] = useState(observations.length > 0);
  const [checkedAnswer, setCheckedAnswer] = useState(false);

  // Persist observations
  useEffect(() => {
    saveObservations(scholarClass, "screw-gauge", observations);
  }, [observations, scholarClass]);

  const objectMm = objectThickness === "wire-thin" ? 2.5 : objectThickness === "wire-thick" ? 4.0 : 1.15;
  const psr = mainScaleReading;
  const csr = circularDiv;
  const instrumentReading = psr + csr * SG_LC_MM;
  const zeroErrorMm = zeroError === "none" ? 0 : (zeroError === "positive" ? -1 : 1) * zeroErrorMag * SG_LC_MM;
  const correctedReading = instrumentReading - zeroErrorMm;

  const handleCheck = () => {
    setChecked(true); setCheckedAnswer(true);
    const userVal = parseFloat(userReading);
    if (Number.isFinite(userVal)) {
      const diff = Math.abs(userVal - correctedReading);
      if (diff < 0.02) toast.success("✓ Correct!");
      else toast.error(`✗ Off by ${diff.toFixed(3)} mm. Corrected = ${correctedReading.toFixed(3)} mm.`);
    } else toast.error("Enter a valid number.");
  };

  const handleAddObservation = () => {
    const userVal = parseFloat(userReading);
    if (!userReading.trim()) {
      toast.error("Enter and check your reading first.");
      return;
    }
    if (!Number.isFinite(userVal)) {
      toast.error("The entered value is not valid.");
      return;
    }
    const newRow: ObsRow = {
      id: `obs-${Date.now()}`, trial: observations.length + 1,
      psr: psr.toFixed(1), csr: csr.toFixed(0), lc: SG_LC_MM.toFixed(3),
      zeroErr: zeroError === "none" ? "0" : `${zeroError === "positive" ? "+" : "−"}${(zeroErrorMag * SG_LC_MM).toFixed(3)}`,
      corrected: correctedReading.toFixed(3),
      userReading: userVal.toFixed(3),
    };
    // Structured duplicate detection
    const newKey = screwKey(newRow);
    if (observations.some((o) => screwKey(o) === newKey)) {
      toast.info("This observation is already recorded. Change a control to add a new one.");
      return;
    }
    setObservations((prev) => [...prev, newRow]);
    setRecordedObs(true);
    toast.success(`Observation #${newRow.trial} recorded.`);
  };

  useEffect(() => {
    if (rotated && recordedObs && checkedAnswer) onComplete();
  }, [rotated, recordedObs, checkedAnswer, onComplete]);

  const reset = () => {
    setCircularDiv(12); setMainScaleReading(3); setObjectThickness("wire-thin");
    setZeroError("none"); setZeroErrorMag(2); setUserReading(""); setChecked(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="relative h-10 mb-2">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-700/40 to-slate-600/30 rounded border border-slate-500/30">
              {Array.from({ length: 11 }, (_, i) => (
                <div key={i} className="absolute top-0 bg-white/70" style={{ left: `${i * 10}%`, width: "1px", height: i % 5 === 0 ? "16px" : "10px" }}>
                  {i % 5 === 0 && <span className="absolute -bottom-4 -translate-x-1/2 text-[9px] text-white/70">{i}</span>}
                </div>
              ))}
              <span className="absolute top-1 right-2 text-[9px] text-white/40">mm (sleeve)</span>
            </div>
          </div>
          <div className="relative h-12 mb-2 flex items-center">
            <div className="absolute left-2 w-3 h-8 bg-slate-500/60 rounded-l"></div>
            <div className="absolute left-6 h-6 bg-sky-500/30 border border-sky-400/40 rounded" style={{ width: `${objectMm * 8}px` }}>
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-sky-300 whitespace-nowrap">{objectMm.toFixed(2)} mm</span>
            </div>
            <div className="absolute bg-amber-500/60 rounded-r h-8 transition-all" style={{ left: `calc(${6 + objectMm * 8}px)`, width: `${40 - circularDiv * 0.5}px` }}></div>
          </div>
          <div className="relative h-16 flex items-center justify-center">
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-amber-800/30 to-amber-700/20 border border-amber-600/40">
              {Array.from({ length: 50 }, (_, i) => {
                const angle = (i / 50) * 360;
                const isCurrent = i === csr;
                return (
                  <div key={i} className="absolute left-1/2 top-1/2 origin-bottom"
                    style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)`, height: "56px" }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2"
                      style={{ width: "1px", height: i % 5 === 0 ? "12px" : "7px", backgroundColor: isCurrent ? "#fbbf24" : "rgba(255,255,255,0.4)" }} />
                    {isCurrent && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-amber-300 font-bold whitespace-nowrap">▼ {i}</div>}
                  </div>
                );
              })}
              <div className="absolute inset-0 grid place-items-center text-xs text-amber-200/70 font-mono">Div: {csr}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Circular scale rotation</span>
            <span className="font-mono text-white">Div {csr} / 50</span>
          </label>
          <input type="range" min={0} max={49} step={1} value={circularDiv}
            onChange={(e) => { setCircularDiv(parseInt(e.target.value)); setChecked(false); setRotated(true); }}
            className="w-full accent-amber-500 h-6" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 mb-2 block">Object</label>
          <select value={objectThickness} onChange={(e) => setObjectThickness(e.target.value as any)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white h-10">
            <option value="wire-thin">Thin wire (~2.5 mm)</option>
            <option value="wire-thick">Thick wire (~4.0 mm)</option>
            <option value="glass-slide">Glass slide (~1.15 mm)</option>
          </select>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 mb-2 block">Pitch scale reading (PSR, mm)</label>
          <input type="range" min={0} max={10} step={1} value={mainScaleReading}
            onChange={(e) => { setMainScaleReading(parseInt(e.target.value)); setChecked(false); }}
            className="w-full accent-sky-500 h-6" />
          <p className="text-[10px] text-white/40 mt-1">Current: {psr} mm</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 mb-2 block">Zero error</label>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setZeroError("none"); setChecked(false); }} className={`px-2.5 py-1.5 rounded-lg text-xs ${zeroError === "none" ? "bg-sky-500 text-white" : "bg-white/5 text-white/60"}`}>None</button>
            <button onClick={() => { setZeroError("positive"); setChecked(false); }} className={`px-2.5 py-1.5 rounded-lg text-xs ${zeroError === "positive" ? "bg-emerald-500 text-white" : "bg-white/5 text-white/60"}`}>+ Pos</button>
            <button onClick={() => { setZeroError("negative"); setChecked(false); }} className={`px-2.5 py-1.5 rounded-lg text-xs ${zeroError === "negative" ? "bg-rose-500 text-white" : "bg-white/5 text-white/60"}`}>− Neg</button>
          </div>
          {zeroError !== "none" && (
            <div className="mt-2">
              <label className="text-[10px] text-white/50">Magnitude (divisions): {zeroErrorMag}</label>
              <input type="range" min={1} max={10} step={1} value={zeroErrorMag}
                onChange={(e) => { setZeroErrorMag(parseInt(e.target.value)); setChecked(false); }}
                className="w-full accent-amber-500 h-5" />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 mb-2">
          <Calculator className="h-3.5 w-3.5 text-violet-400" /> Calculated Readings
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg bg-white/5 p-2"><p className="text-white/50 text-[10px] uppercase">Pitch</p><p className="text-white font-mono">{SG_PITCH_MM} mm</p></div>
          <div className="rounded-lg bg-white/5 p-2"><p className="text-white/50 text-[10px] uppercase">Least Count</p><p className="text-white font-mono">{SG_LC_MM.toFixed(3)} mm</p></div>
          <div className="rounded-lg bg-white/5 p-2"><p className="text-white/50 text-[10px] uppercase">PSR + (CSR×LC)</p><p className="text-white font-mono">{instrumentReading.toFixed(3)} mm</p></div>
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2"><p className="text-emerald-300/70 text-[10px] uppercase">Corrected</p><p className="text-emerald-300 font-mono font-bold">{correctedReading.toFixed(3)} mm</p></div>
        </div>
        <p className="text-[10px] text-white/40 mt-2">LC = Pitch ÷ Divisions = {SG_PITCH_MM} ÷ {SG_DIVISIONS} = {SG_LC_MM.toFixed(3)} mm</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <label className="text-xs text-white/60 mb-2 block">Enter your observed reading (mm)</label>
        <div className="flex gap-2">
          <input type="number" step="0.001" value={userReading}
            onChange={(e) => { setUserReading(e.target.value); setChecked(false); }}
            placeholder="e.g. 3.240" className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white h-10" />
          <button onClick={handleCheck} className="px-3 py-2 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 h-10 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Check</button>
          <button onClick={handleAddObservation} className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 h-10 flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add to Table</button>
        </div>
      </div>

      <ObservationTable title="Observation Table"
        columns={[{ key: "trial", label: "Trial" }, { key: "psr", label: "PSR", unit: "mm" }, { key: "csr", label: "CSR" }, { key: "lc", label: "LC", unit: "mm" }, { key: "zeroErr", label: "Zero Err", unit: "mm" }, { key: "corrected", label: "Corrected", unit: "mm" }]}
        rows={observations}
        onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))} />

      <div className="flex justify-end">
        <button onClick={reset} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 h-10 flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
      </div>
    </div>
  );
}

// ============================================================================
// 3. SIMPLE PENDULUM
// ============================================================================

const G_EARTH = 9.81;

export function SimplePendulumSim({ onComplete, scholarClass }: LabSimProps) {
  const [length, setLength] = useState(1.0);
  const [amplitudeDeg, setAmplitudeDeg] = useState(15);
  const [bobMass, setBobMass] = useState(0.5);
  const [oscillations, setOscillations] = useState(10);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations<ObsRow>(scholarClass, "pendulum"));
  const [changedParams, setChangedParams] = useState(false);
  const [recordedObs, setRecordedObs] = useState(observations.length > 0);

  // Persist observations
  useEffect(() => {
    saveObservations(scholarClass, "pendulum", observations);
  }, [observations, scholarClass]);

  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastPhaseRef = useRef<number>(0);
  const oscCountRef = useRef<number>(0);
  const [liveOscCount, setLiveOscCount] = useState(0);

  const theoreticalT = useMemo(() => 2 * Math.PI * Math.sqrt(length / G_EARTH), [length]);
  const omega = Math.sqrt(G_EARTH / length);

  useEffect(() => {
    if (!running) return;
    startTimeRef.current = performance.now() - elapsed * 1000;
    lastPhaseRef.current = omega * elapsed;
    oscCountRef.current = 0;
    const tick = () => {
      const now = performance.now();
      const t = (now - startTimeRef.current) / 1000;
      setElapsed(t);
      // Count oscillations by detecting phase crossings (each 2π = one oscillation)
      const phase = omega * t;
      const phaseDelta = phase - lastPhaseRef.current;
      if (phaseDelta >= 2 * Math.PI) {
        const newCount = Math.floor(phase / (2 * Math.PI));
        if (newCount > oscCountRef.current) {
          oscCountRef.current = newCount;
          setLiveOscCount(newCount);
        }
        lastPhaseRef.current = phase;
      }
      // Auto-stop when the selected oscillation count is reached
      if (oscCountRef.current >= oscillations) {
        setRunning(false);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [running]);

  const currentAngle = (amplitudeDeg * Math.PI / 180) * Math.cos(omega * (running ? elapsed : 0));

  // Use the live phase-crossing count (from the animation loop) as the primary
  // source of completed oscillations. This is "Option A — Deterministic physics
  // simulation": the bob's animated phase is calculated from angular frequency,
  // and oscillations are counted from actual phase crossings (each 2π = one
  // complete oscillation). The stopwatch measures the actual simulation clock.
  const completedOscillations = liveOscCount;
  const oscillationsComplete = completedOscillations >= oscillations;

  const handleStart = () => { setRunning(true); setChangedParams(true); setLiveOscCount(0); oscCountRef.current = 0; };
  const handlePause = () => setRunning(false);
  const handleReset = () => { setRunning(false); setElapsed(0); setLiveOscCount(0); oscCountRef.current = 0; };

  const handleRecordTrial = () => {
    // Validate: oscillations must be complete
    if (!oscillationsComplete) {
      toast.error(`Only ${completedOscillations} of ${oscillations} oscillations completed. Let the pendulum finish.`);
      return;
    }
    // Validate: finite positive values
    if (!Number.isFinite(length) || length <= 0) { toast.error("Length must be a positive finite value."); return; }
    if (!Number.isFinite(elapsed) || elapsed <= 0) { toast.error("Elapsed time must be positive."); return; }
    const measuredT = elapsed / oscillations;
    if (!Number.isFinite(measuredT) || measuredT <= 0) { toast.error("Time period calculation failed."); return; }
    const calculatedG = (4 * Math.PI * Math.PI * length) / (measuredT * measuredT);
    if (!Number.isFinite(calculatedG) || calculatedG <= 0) { toast.error("Gravity calculation failed."); return; }

    // Warn if g is far outside expected range (educational sanity check)
    let warning = "";
    if (calculatedG < 5 || calculatedG > 15) {
      warning = " (⚠ unusual value — check your timing)";
    }

    const newRow: ObsRow = {
      id: `obs-${Date.now()}`, trial: observations.length + 1,
      length: length.toFixed(2), oscillations, time: elapsed.toFixed(2),
      period: measuredT.toFixed(3), g: calculatedG.toFixed(2),
    };
    // Structured duplicate detection
    const newKey = pendulumKey(newRow);
    if (observations.some((o) => pendulumKey(o) === newKey)) {
      toast.info("This trial is already recorded. Change a parameter to add a new one.");
      return;
    }
    setObservations((prev) => [...prev, newRow]);
    setRecordedObs(true);
    setRunning(false); setElapsed(0);
    toast.success(`Trial recorded: T = ${measuredT.toFixed(3)} s, g ≈ ${calculatedG.toFixed(2)} m/s²${warning}`);
  };

  useEffect(() => {
    if (changedParams && recordedObs) onComplete();
  }, [changedParams, recordedObs, onComplete]);

  const plotData = observations.map((o) => ({
    L: parseFloat(String(o.length)),
    T2: Math.pow(parseFloat(String(o.period)), 2),
  }));
  const maxL = Math.max(2.0, ...plotData.map((p) => p.L));
  const maxT2 = Math.max(5, ...plotData.map((p) => p.T2));

  const pivotX = 150, pivotY = 20;
  const pixelLength = Math.min(180, length * 100);
  const bobX = pivotX + pixelLength * Math.sin(currentAngle);
  const bobY = pivotY + pixelLength * Math.cos(currentAngle);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 flex justify-center">
        <svg width={300} height={260} className="max-w-full">
          <line x1={pivotX - 25} y1={pivotY} x2={pivotX + 25} y2={pivotY} stroke="#94a3b8" strokeWidth={3} />
          <line x1={pivotX} y1={pivotY} x2={bobX} y2={bobY} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          <circle cx={bobX} cy={bobY} r={10 + bobMass * 8} fill="url(#bobGrad)" stroke="#fbbf24" strokeWidth={1.5} />
          <line x1={pivotX} y1={pivotY} x2={pivotX} y2={pivotY + pixelLength + 20} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={pivotX + 5} y={pivotY + 15} fill="rgba(255,255,255,0.5)" fontSize={10} fontFamily="monospace">θ = {(currentAngle * 180 / Math.PI).toFixed(1)}°</text>
          <defs>
            <radialGradient id="bobGrad"><stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#d97706" /></radialGradient>
          </defs>
        </svg>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1">Elapsed Time</p>
        <p className="text-3xl font-mono font-bold text-amber-300 tabular-nums">{elapsed.toFixed(2)} s</p>
        <p className="text-[10px] text-white/50 mt-1">
          Theoretical T = {theoreticalT.toFixed(3)} s · {oscillations} osc = {(theoreticalT * oscillations).toFixed(2)} s expected
        </p>
        <p className={`text-xs font-semibold mt-1 ${oscillationsComplete ? "text-emerald-400" : "text-amber-300"}`}>
          {completedOscillations} / {oscillations} oscillations {oscillationsComplete ? "✓ Complete" : "in progress…"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 flex items-center justify-between mb-2"><span>Length (L)</span><span className="font-mono text-white">{length.toFixed(2)} m</span></label>
          <input type="range" min={0.1} max={2.0} step={0.05} value={length} onChange={(e) => { setLength(parseFloat(e.target.value)); setChangedParams(true); }} className="w-full accent-sky-500 h-6" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 flex items-center justify-between mb-2"><span>Amplitude (θ₀)</span><span className="font-mono text-white">{amplitudeDeg}°</span></label>
          <input type="range" min={5} max={30} step={1} value={amplitudeDeg} onChange={(e) => setAmplitudeDeg(parseInt(e.target.value))} className="w-full accent-violet-500 h-6" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 flex items-center justify-between mb-2"><span>Bob mass (cosmetic — does NOT affect T)</span><span className="font-mono text-white">{bobMass.toFixed(2)} kg</span></label>
          <input type="range" min={0.1} max={2.0} step={0.1} value={bobMass} onChange={(e) => setBobMass(parseFloat(e.target.value))} className="w-full accent-amber-500 h-6" />
          <p className="text-[10px] text-amber-300/70 mt-1">⚠ Mass does not affect the period of an ideal pendulum.</p>
          <p className="text-[9px] text-white/40 mt-1">This simulation uses the ideal pendulum equation to generate motion. The calculated value of g demonstrates the relationship between length, time period, and gravity; it is not an independent physical measurement.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <label className="text-xs text-white/60 mb-2 block">Oscillations to count</label>
          <div className="flex gap-2">
            {[5, 10, 20].map((n) => (
              <button key={n} onClick={() => setOscillations(n)} className={`px-3 py-1.5 rounded-lg text-xs ${oscillations === n ? "bg-sky-500 text-white" : "bg-white/5 text-white/60"}`}>{n} osc</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-center flex-wrap">
        {!running ? (
          <button onClick={handleStart} className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 h-11 flex items-center gap-1.5"><Play className="h-4 w-4 fill-white" /> Start</button>
        ) : (
          <button onClick={handlePause} className="px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 h-11 flex items-center gap-1.5"><Pause className="h-4 w-4" /> Pause</button>
        )}
        <button onClick={handleReset} className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 h-11 flex items-center gap-1.5"><RotateCcw className="h-4 w-4" /> Reset</button>
        <button onClick={handleRecordTrial} disabled={!oscillationsComplete} className="px-4 py-2.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-200 text-sm font-semibold hover:bg-violet-500/25 h-11 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"><Plus className="h-4 w-4" /> {oscillationsComplete ? "Record Trial" : `${completedOscillations}/${oscillations} osc`}</button>
      </div>

      <ObservationTable title="Observation Table"
        columns={[{ key: "trial", label: "Trial" }, { key: "length", label: "L", unit: "m" }, { key: "oscillations", label: "n" }, { key: "time", label: "Time", unit: "s" }, { key: "period", label: "T = t/n", unit: "s" }, { key: "g", label: "g = 4π²L/T²", unit: "m/s²" }]}
        rows={observations}
        onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))} />

      {plotData.length >= 1 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-teal-400" /> T² vs L Plot (from your observations)
          </div>
          <svg viewBox="0 0 320 220" className="w-full max-w-md mx-auto">
            <line x1={40} y1={10} x2={40} y2={180} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
            <line x1={40} y1={180} x2={310} y2={180} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
            <text x={170} y={210} fill="rgba(255,255,255,0.6)" fontSize={11} textAnchor="middle">L (m)</text>
            <text x={15} y={95} fill="rgba(255,255,255,0.6)" fontSize={11} textAnchor="middle" transform="rotate(-90 15 95)">T² (s²)</text>
            <text x={40} y={195} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="middle">0</text>
            <text x={310} y={195} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="middle">{maxL.toFixed(1)}</text>
            <text x={35} y={184} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">0</text>
            <text x={35} y={14} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">{maxT2.toFixed(1)}</text>
            {plotData.map((p, i) => {
              const x = 40 + (p.L / maxL) * 270;
              const y = 180 - (p.T2 / maxT2) * 170;
              return (
                <g key={i}>
                  {i > 0 && (
                    <line x1={40 + (plotData[i - 1].L / maxL) * 270} y1={180 - (plotData[i - 1].T2 / maxT2) * 170} x2={x} y2={y} stroke="#14b8a6" strokeWidth={1.5} />
                  )}
                  <circle cx={x} cy={y} r={4} fill="#2dd4bf" stroke="#0f766e" strokeWidth={1} />
                </g>
              );
            })}
          </svg>
          <p className="text-[10px] text-white/40 mt-2 text-center">Slope of T² vs L = 4π²/g. A steeper slope means lower g.</p>
        </div>
      )}
    </div>
  );
}
