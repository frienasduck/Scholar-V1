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
                      className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 grid place-items-center p-2 sm:p-1 rounded hover:bg-rose-500/15 text-rose-400">
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
            <button onClick={() => { setZeroError("none"); setChecked(false); }} className={`min-h-11 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs ${zeroError === "none" ? "bg-sky-500 text-white" : "bg-white/5 text-white/60"}`}>None</button>
            <button onClick={() => { setZeroError("positive"); setChecked(false); }} className={`min-h-11 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs ${zeroError === "positive" ? "bg-emerald-500 text-white" : "bg-white/5 text-white/60"}`}>+ Positive</button>
            <button onClick={() => { setZeroError("negative"); setChecked(false); }} className={`min-h-11 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs ${zeroError === "negative" ? "bg-rose-500 text-white" : "bg-white/5 text-white/60"}`}>− Negative</button>
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
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <input type="number" step="0.01" value={userReading}
            onChange={(e) => { setUserReading(e.target.value); setChecked(false); }}
            placeholder="e.g. 12.30"
            className="w-full sm:w-auto flex-1 min-h-11 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-base sm:text-sm text-white" />
          <button onClick={handleCheck} className="flex-1 sm:flex-initial justify-center px-3 py-2 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 min-h-11 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" /> Check
          </button>
          <button onClick={handleAddObservation} className="flex-1 sm:flex-initial justify-center px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 min-h-11 flex items-center gap-1.5">
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
        <button onClick={reset} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 min-h-11 sm:min-h-10 flex items-center gap-1.5">
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
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-base sm:text-sm text-white min-h-11">
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
            <button onClick={() => { setZeroError("none"); setChecked(false); }} className={`min-h-11 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs ${zeroError === "none" ? "bg-sky-500 text-white" : "bg-white/5 text-white/60"}`}>None</button>
            <button onClick={() => { setZeroError("positive"); setChecked(false); }} className={`min-h-11 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs ${zeroError === "positive" ? "bg-emerald-500 text-white" : "bg-white/5 text-white/60"}`}>+ Pos</button>
            <button onClick={() => { setZeroError("negative"); setChecked(false); }} className={`min-h-11 sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs ${zeroError === "negative" ? "bg-rose-500 text-white" : "bg-white/5 text-white/60"}`}>− Neg</button>
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
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <input type="number" step="0.001" value={userReading}
            onChange={(e) => { setUserReading(e.target.value); setChecked(false); }}
            placeholder="e.g. 3.240" className="w-full sm:w-auto flex-1 min-h-11 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-base sm:text-sm text-white" />
          <button onClick={handleCheck} className="flex-1 sm:flex-initial justify-center px-3 py-2 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 min-h-11 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Check</button>
          <button onClick={handleAddObservation} className="flex-1 sm:flex-initial justify-center px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 min-h-11 flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add to Table</button>
        </div>
      </div>

      <ObservationTable title="Observation Table"
        columns={[{ key: "trial", label: "Trial" }, { key: "psr", label: "PSR", unit: "mm" }, { key: "csr", label: "CSR" }, { key: "lc", label: "LC", unit: "mm" }, { key: "zeroErr", label: "Zero Err", unit: "mm" }, { key: "corrected", label: "Corrected", unit: "mm" }]}
        rows={observations}
        onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))} />

      <div className="flex justify-end">
        <button onClick={reset} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 min-h-11 sm:min-h-10 flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
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
        <svg viewBox="0 0 300 260" className="w-full max-w-[300px] h-auto">
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
              <button key={n} onClick={() => setOscillations(n)} className={`min-h-11 sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs ${oscillations === n ? "bg-sky-500 text-white" : "bg-white/5 text-white/60"}`}>{n} osc</button>
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


// ============================================================================
// 4. ACID-BASE NEUTRALIZATION SIMULATION (CBSE Class 10 / 11)
// ============================================================================
export function AcidBaseSim({ onComplete, alreadyCompleted, scholarClass }: LabSimProps) {
  const [volumeAdded, setVolumeAdded] = useState(0); // mL HCl added to 20 mL 0.1M NaOH
  const [stirring, setStirring] = useState(false);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations(scholarClass, "acid-base"));

  // Equivalence point is at 20.0 mL HCl
  const pH = useMemo(() => {
    if (volumeAdded < 19.5) return Number((12.5 - (volumeAdded / 20) * 2.5).toFixed(1));
    if (volumeAdded <= 20.5) return 7.0;
    return Number(Math.max(1.2, 7.0 - (volumeAdded - 20) * 0.9).toFixed(1));
  }, [volumeAdded]);

  // Phenolphthalein color: Pink above pH 8.3, colorless below
  const isPink = pH >= 8.2;
  const flaskColor = isPink ? "rgba(244, 63, 94, 0.75)" : "rgba(224, 242, 254, 0.25)";

  const handleRecord = () => {
    const newRow: ObsRow = {
      id: crypto.randomUUID(),
      trial: observations.length + 1,
      hclVolume: Number(volumeAdded.toFixed(1)),
      pH,
      indicatorColor: isPink ? "Pink" : "Colorless",
      state: pH === 7.0 ? "Neutralized" : pH > 7 ? "Basic" : "Acidic",
    };
    const next = [...observations, newRow];
    setObservations(next);
    saveObservations(scholarClass, "acid-base", next);
    saveCompletedExp(scholarClass, "acid-base");
    onComplete();
    toast.success("Titration reading recorded!", { description: `pH = ${pH} (${newRow.state})` });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Acid + Base Titration (HCl + NaOH)</h3>
            <p className="text-xs text-white/60">Equivalence point titration using phenolphthalein indicator</p>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
            pH {pH.toFixed(1)} · {pH === 7.0 ? "NEUTRAL" : pH > 7 ? "BASIC" : "ACIDIC"}
          </span>
        </div>

        {/* Visual Apparatus */}
        <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-white/10 bg-black/40">
            <svg viewBox="0 0 200 240" className="w-48 h-56">
              {/* Burette Tube */}
              <rect x="90" y="10" width="20" height="120" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" rx="2" />
              {/* Liquid inside burette */}
              <rect x="92" y={10 + (volumeAdded / 30) * 110} width="16" height={120 - (volumeAdded / 30) * 110} fill="rgba(103, 232, 249, 0.4)" />
              {/* Burette tip and tap */}
              <rect x="85" y="130" width="30" height="8" fill="#475569" rx="2" />
              <line x1="100" y1="138" x2="100" y2="155" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
              {/* Dripping drops */}
              {volumeAdded > 0 && volumeAdded < 30 && (
                <circle cx="100" cy="165" r="2.5" fill="rgba(103, 232, 249, 0.8)">
                  <animate attributeName="cy" from="155" to="185" dur="0.8s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Conical Flask */}
              <path d="M 85 185 L 115 185 L 145 230 L 55 230 Z" fill={flaskColor} stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
              <text x="100" y="215" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">
                {isPink ? "Pink (Base)" : "Clear (Neutral/Acid)"}
              </text>
            </svg>
            <p className="text-[11px] text-white/50 mt-2">20 mL 0.1 M NaOH with phenolphthalein</p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1.5 font-medium">
                <span>0.1 M HCl Added from Burette</span>
                <span className="font-mono text-cyan-300 font-bold">{volumeAdded.toFixed(1)} mL / 30.0 mL</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={volumeAdded}
                onChange={(e) => setVolumeAdded(parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-white/70">
                <span>Reaction Equation:</span>
                <span className="font-mono text-white font-semibold">HCl + NaOH → NaCl + H₂O</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Equivalence Point:</span>
                <span className="font-mono text-emerald-300 font-semibold">20.0 mL HCl (pH 7.0)</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Indicator Transition:</span>
                <span className="font-semibold text-rose-300">Pink → Colorless (pH 8.2)</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVolumeAdded(20.0)}
                className="flex-1 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                Go to Neutral Point (20 mL)
              </button>
              <button
                type="button"
                onClick={handleRecord}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-black shadow-lg hover:brightness-110"
              >
                + Record Observation
              </button>
            </div>
          </div>
        </div>

        <ObservationTable
          title="Titration Observations"
          columns={[
            { key: "trial", label: "Trial" },
            { key: "hclVolume", label: "HCl Added", unit: "mL" },
            { key: "pH", label: "pH" },
            { key: "indicatorColor", label: "Color" },
            { key: "state", label: "State" },
          ]}
          rows={observations}
          onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 5. pH SCALE EXPLORER (CBSE Class 10 / 11)
// ============================================================================
export function PhScaleSim({ onComplete, alreadyCompleted, scholarClass }: LabSimProps) {
  const [ph, setPh] = useState(7.0);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations(scholarClass, "ph-scale"));

  const SAMPLES = [
    { name: "Battery Acid", ph: 0.5, desc: "Extremely strong acid (H₂SO₄)" },
    { name: "Lemon Juice", ph: 2.2, desc: "Citric acid in citrus fruit" },
    { name: "Vinegar", ph: 2.8, desc: "Dilute acetic acid (CH₃COOH)" },
    { name: "Black Coffee", ph: 5.0, desc: "Mildly acidic organic acids" },
    { name: "Pure Water", ph: 7.0, desc: "Neutral at 25°C [H⁺] = [OH⁻]" },
    { name: "Human Blood", ph: 7.4, desc: "Slightly alkaline biological buffer" },
    { name: "Baking Soda", ph: 8.5, desc: "Sodium bicarbonate (NaHCO₃)" },
    { name: "Milk of Magnesia", ph: 10.5, desc: "Antacid suspension (Mg(OH)₂)" },
    { name: "Household Ammonia", ph: 11.5, desc: "Aqueous base (NH₄OH)" },
    { name: "Drain Cleaner / NaOH", ph: 13.8, desc: "Extremely strong alkaline base" },
  ];

  const getPhColor = (val: number) => {
    if (val < 3) return "#ef4444"; // red
    if (val < 6) return "#f97316"; // orange
    if (val <= 7.5) return "#22c55e"; // green
    if (val < 10) return "#06b6d4"; // cyan
    if (val < 12) return "#3b82f6"; // blue
    return "#8b5cf6"; // violet
  };

  const handleRecord = () => {
    const matched = SAMPLES.find((s) => Math.abs(s.ph - ph) <= 0.6)?.name || "Custom Solution";
    const newRow: ObsRow = {
      id: crypto.randomUUID(),
      trial: observations.length + 1,
      sample: matched,
      ph: Number(ph.toFixed(1)),
      hConc: `10^(-${ph.toFixed(1)})`,
      nature: ph < 6.8 ? "Acidic" : ph <= 7.4 ? "Neutral" : "Basic",
    };
    const next = [...observations, newRow];
    setObservations(next);
    saveObservations(scholarClass, "ph-scale", next);
    saveCompletedExp(scholarClass, "ph-scale");
    onComplete();
    toast.success("pH reading logged!", { description: `${matched}: pH ${ph.toFixed(1)}` });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">pH Scale & Universal Indicator Explorer</h3>
            <p className="text-xs text-white/60">Measure [H⁺] ion concentration across real chemicals</p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white shadow-md" style={{ background: getPhColor(ph) }}>
            pH {ph.toFixed(1)}
          </span>
        </div>

        {/* Universal Indicator Color Strip */}
        <div className="my-5">
          <div className="h-6 w-full rounded-xl bg-gradient-to-r from-red-600 via-orange-400 via-yellow-400 via-green-500 via-cyan-400 via-blue-600 to-purple-800 shadow-md relative">
            <span
              className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full bg-white border-2 border-black shadow-lg"
              style={{ left: `${(ph / 14) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/50 mt-1 font-mono">
            <span>0 (Strong Acid)</span>
            <span>7 (Neutral)</span>
            <span>14 (Strong Base)</span>
          </div>
        </div>

        {/* Quick Sample Selector */}
        <div className="my-4">
          <label className="text-xs font-semibold text-white/80 block mb-2">Test Standard Substances:</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {SAMPLES.slice(0, 10).map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setPh(s.ph)}
                className={`p-2 rounded-xl border text-left text-xs transition ${
                  Math.abs(s.ph - ph) < 0.2
                    ? "border-cyan-400 bg-cyan-400/20 text-white font-bold"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                <p className="truncate font-medium">{s.name}</p>
                <p className="text-[10px] text-white/50">pH {s.ph}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Slider & Details */}
        <div className="space-y-4 my-5">
          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1.5">
              <span>Adjust pH Value</span>
              <span className="font-mono text-cyan-300 font-bold">{ph.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="14"
              step="0.1"
              value={ph}
              onChange={(e) => setPh(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleRecord}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-xs font-bold text-black shadow-lg hover:brightness-110"
            >
              + Record Observation
            </button>
          </div>
        </div>

        <ObservationTable
          title="pH Scale Observations"
          columns={[
            { key: "trial", label: "Trial" },
            { key: "sample", label: "Sample" },
            { key: "ph", label: "Measured pH" },
            { key: "hConc", label: "[H⁺] Moles/L" },
            { key: "nature", label: "Nature" },
          ]}
          rows={observations}
          onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 6. PROJECTILE MOTION SIMULATION (CBSE Class 11 Physics)
// ============================================================================
export function ProjectileSim({ onComplete, alreadyCompleted, scholarClass }: LabSimProps) {
  const [angle, setAngle] = useState(45);
  const [velocity, setVelocity] = useState(25);
  const [fired, setFired] = useState(false);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations(scholarClass, "projectile"));

  const g = 9.8;
  const angleRad = (angle * Math.PI) / 180;
  const range = (Math.pow(velocity, 2) * Math.sin(2 * angleRad)) / g;
  const maxHeight = (Math.pow(velocity, 2) * Math.pow(Math.sin(angleRad), 2)) / (2 * g);
  const timeOfFlight = (2 * velocity * Math.sin(angleRad)) / g;

  const handleLaunch = () => {
    setFired(true);
    setTimeout(() => setFired(false), 1200);
  };

  const handleRecord = () => {
    const newRow: ObsRow = {
      id: crypto.randomUUID(),
      trial: observations.length + 1,
      angle,
      velocity,
      range: Number(range.toFixed(2)),
      height: Number(maxHeight.toFixed(2)),
      time: Number(timeOfFlight.toFixed(2)),
    };
    const next = [...observations, newRow];
    setObservations(next);
    saveObservations(scholarClass, "projectile", next);
    saveCompletedExp(scholarClass, "projectile");
    onComplete();
    toast.success("Trajectory recorded!", { description: `Range = ${range.toFixed(1)} m` });
  };

  // Trajectory points for SVG
  const pathD = useMemo(() => {
    const points: string[] = [];
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * timeOfFlight;
      const x = velocity * Math.cos(angleRad) * t;
      const y = velocity * Math.sin(angleRad) * t - 0.5 * g * Math.pow(t, 2);
      // scale for SVG viewBox 0 0 320 180
      const svgX = 20 + (x / 110) * 280;
      const svgY = 160 - (Math.max(0, y) / 35) * 140;
      points.push(`${i === 0 ? "M" : "L"} ${svgX} ${svgY}`);
    }
    return points.join(" ");
  }, [angleRad, timeOfFlight, velocity]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="rounded-2xl border border-indigo-500/20 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">2D Projectile Motion Lab</h3>
            <p className="text-xs text-white/60">Measure trajectory, range, max height and flight time under g = 9.8 m/s²</p>
          </div>
          <button
            onClick={handleLaunch}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-lg hover:brightness-110 active:scale-95 flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-white" /> Launch Cannon
          </button>
        </div>

        {/* Canvas Display */}
        <div className="my-5 rounded-xl border border-white/10 bg-black/50 p-4 relative overflow-hidden">
          <svg viewBox="0 0 320 180" className="w-full h-48">
            <line x1="20" y1="160" x2="310" y2="160" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <line x1="20" y1="20" x2="20" y2="160" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <path d={pathD} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeDasharray={fired ? "none" : "4 4"} />
            <circle cx="20" cy="160" r="5" fill="#6366f1" />
            <text x="160" y="175" fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="middle">Distance (m)</text>
            <text x="10" y="90" fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="middle" transform="rotate(-90 10 90)">Height (m)</text>
          </svg>

          {/* Real-time calculated telemetry */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Range (R)</span>
              <strong className="text-sm text-indigo-300 font-mono">{range.toFixed(2)} m</strong>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Max Height (H)</span>
              <strong className="text-sm text-violet-300 font-mono">{maxHeight.toFixed(2)} m</strong>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Flight Time (T)</span>
              <strong className="text-sm text-cyan-300 font-mono">{timeOfFlight.toFixed(2)} s</strong>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Launch Angle (θ)</span>
              <span className="font-mono text-indigo-300 font-bold">{angle}°</span>
            </div>
            <input
              type="range"
              min="15"
              max="75"
              value={angle}
              onChange={(e) => setAngle(parseInt(e.target.value))}
              className="w-full accent-indigo-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Initial Velocity (v)</span>
              <span className="font-mono text-violet-300 font-bold">{velocity} m/s</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              value={velocity}
              onChange={(e) => setVelocity(parseInt(e.target.value))}
              className="w-full accent-violet-400"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleRecord}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-lg hover:brightness-110"
          >
            + Record Trial Reading
          </button>
        </div>

        <ObservationTable
          title="Projectile Trajectory Observations"
          columns={[
            { key: "trial", label: "Trial" },
            { key: "angle", label: "Angle (θ)", unit: "°" },
            { key: "velocity", label: "Velocity (v)", unit: "m/s" },
            { key: "range", label: "Range (R)", unit: "m" },
            { key: "height", label: "Max Height (H)", unit: "m" },
            { key: "time", label: "Time (T)", unit: "s" },
          ]}
          rows={observations}
          onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 7. GRAVITY & FREE FALL SIMULATOR (CBSE Class 9 / 11)
// ============================================================================
export function GravitySim({ onComplete, alreadyCompleted, scholarClass }: LabSimProps) {
  const [planet, setPlanet] = useState<"earth" | "moon" | "mars" | "jupiter">("earth");
  const [height, setHeight] = useState(20);
  const [dropping, setDropping] = useState(false);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations(scholarClass, "gravity"));

  const PLANETS = {
    earth: { name: "Earth", g: 9.8, color: "#38bdf8" },
    moon: { name: "Moon", g: 1.62, color: "#94a3b8" },
    mars: { name: "Mars", g: 3.72, color: "#f87171" },
    jupiter: { name: "Jupiter", g: 24.79, color: "#fbbf24" },
  };

  const currentPlanet = PLANETS[planet];
  const time = Math.sqrt((2 * height) / currentPlanet.g);
  const finalVelocity = Math.sqrt(2 * currentPlanet.g * height);

  const handleDrop = () => {
    setDropping(true);
    setTimeout(() => setDropping(false), 900);
  };

  const handleRecord = () => {
    const newRow: ObsRow = {
      id: crypto.randomUUID(),
      trial: observations.length + 1,
      planet: currentPlanet.name,
      g: currentPlanet.g,
      height,
      time: Number(time.toFixed(2)),
      velocity: Number(finalVelocity.toFixed(2)),
    };
    const next = [...observations, newRow];
    setObservations(next);
    saveObservations(scholarClass, "gravity", next);
    saveCompletedExp(scholarClass, "gravity");
    onComplete();
    toast.success("Free-fall recorded!", { description: `${currentPlanet.name}: t = ${time.toFixed(2)}s` });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="rounded-2xl border border-sky-500/20 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Gravitational Acceleration & Free Fall</h3>
            <p className="text-xs text-white/60">Drop objects across celestial bodies (h = ½gt², v² = 2gh)</p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: currentPlanet.color }}>
            g = {currentPlanet.g} m/s²
          </span>
        </div>

        {/* Planet Selection */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
          {(Object.keys(PLANETS) as Array<keyof typeof PLANETS>).map((key) => {
            const p = PLANETS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPlanet(key)}
                className={`min-h-11 p-3 rounded-xl border text-center transition ${
                  planet === key
                    ? "border-sky-400 bg-sky-500/20 text-white font-bold"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
                }`}
              >
                <p className="text-xs font-semibold">{p.name}</p>
                <p className="text-[10px] text-white/50">{p.g} m/s²</p>
              </button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="my-5 rounded-xl border border-white/10 bg-black/50 p-4 text-center">
          <svg viewBox="0 0 200 160" className="w-48 h-40 mx-auto">
            {/* Tower */}
            <rect x="30" y="20" width="20" height="120" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" />
            <line x1="10" y1="140" x2="190" y2="140" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
            {/* Falling ball */}
            <circle cx="60" cy={dropping ? "135" : "25"} r="7" fill={currentPlanet.color} className="transition-all duration-700 ease-in" />
            <text x="100" y="80" fill="rgba(255,255,255,0.7)" fontSize="11" textAnchor="middle">
              Height: {height} m
            </text>
          </svg>

          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10 max-w-sm mx-auto">
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Time to Impact (t)</span>
              <strong className="text-sm text-sky-300 font-mono">{time.toFixed(2)} s</strong>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Impact Velocity (v)</span>
              <strong className="text-sm text-emerald-300 font-mono">{finalVelocity.toFixed(2)} m/s</strong>
            </div>
          </div>
        </div>

        {/* Height Slider */}
        <div className="my-4">
          <div className="flex justify-between text-xs text-white/70 mb-1">
            <span>Drop Height (h)</span>
            <span className="font-mono text-sky-300 font-bold">{height} m</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            value={height}
            onChange={(e) => setHeight(parseInt(e.target.value))}
            className="w-full accent-sky-400"
          />
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={handleDrop}
            className="px-4 py-2 rounded-xl bg-sky-500/20 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-sky-200" /> Drop Object
          </button>
          <button
            type="button"
            onClick={handleRecord}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-xs font-bold text-black shadow-lg hover:brightness-110"
          >
            + Record Drop Data
          </button>
        </div>

        <ObservationTable
          title="Free Fall Gravity Observations"
          columns={[
            { key: "trial", label: "Trial" },
            { key: "planet", label: "Celestial Body" },
            { key: "g", label: "g", unit: "m/s²" },
            { key: "height", label: "Height (h)", unit: "m" },
            { key: "time", label: "Time (t)", unit: "s" },
            { key: "velocity", label: "Velocity (v)", unit: "m/s" },
          ]}
          rows={observations}
          onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 8. ELECTRIC CIRCUIT BUILDER & OHM'S LAW (CBSE Class 10 / 12)
// ============================================================================
export function CircuitSim({ onComplete, alreadyCompleted, scholarClass }: LabSimProps) {
  const [voltage, setVoltage] = useState(6.0);
  const [resistance, setResistance] = useState(20);
  const [switchOn, setSwitchOn] = useState(true);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations(scholarClass, "circuit"));

  const current = switchOn ? voltage / resistance : 0;
  const power = current * voltage;

  const handleRecord = () => {
    const newRow: ObsRow = {
      id: crypto.randomUUID(),
      trial: observations.length + 1,
      voltage: Number(voltage.toFixed(1)),
      resistance,
      current: Number(current.toFixed(3)),
      power: Number(power.toFixed(2)),
    };
    const next = [...observations, newRow];
    setObservations(next);
    saveObservations(scholarClass, "circuit", next);
    saveCompletedExp(scholarClass, "circuit");
    onComplete();
    toast.success("Ohm's Law reading logged!", { description: `V = ${voltage}V, I = ${current.toFixed(2)}A` });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="rounded-2xl border border-amber-500/20 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Electric Circuit & Ohm's Law (V = IR)</h3>
            <p className="text-xs text-white/60">Build a DC circuit, observe current flow and bulb brightness</p>
          </div>
          <button
            type="button"
            onClick={() => setSwitchOn((s) => !s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              switchOn ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            }`}
          >
            Switch: {switchOn ? "CLOSED (ON)" : "OPEN (OFF)"}
          </button>
        </div>

        {/* Schematic Circuit Canvas */}
        <div className="my-5 rounded-xl border border-white/10 bg-black/50 p-4">
          <svg viewBox="0 0 300 160" className="w-full h-44">
            {/* Circuit loop wire */}
            <rect x="40" y="25" width="220" height="110" fill="none" stroke={switchOn ? "#fbbf24" : "rgba(255,255,255,0.2)"} strokeWidth="2.5" rx="10" />
            {/* Battery on left wire */}
            <rect x="35" y="65" width="10" height="30" fill="#0f172a" stroke="none" />
            <line x1="32" y1="72" x2="48" y2="72" stroke="#38bdf8" strokeWidth="3" />
            <line x1="36" y1="88" x2="44" y2="88" stroke="#38bdf8" strokeWidth="2" />
            <text x="24" y="83" fill="#38bdf8" fontSize="10" fontWeight="bold">+{voltage}V</text>
            {/* Resistor on top wire */}
            <rect x="120" y="20" width="60" height="10" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1" rx="2" />
            <text x="150" y="15" fill="#e2e8f0" fontSize="9" textAnchor="middle">{resistance} Ω</text>
            {/* Ammeter on right wire */}
            <circle cx="260" cy="80" r="14" fill="#0f172a" stroke="#22c55e" strokeWidth="2" />
            <text x="260" y="84" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">A</text>
            {/* Bulb on bottom wire */}
            <circle cx="150" cy="135" r="12" fill={switchOn ? "rgba(252, 211, 77, 0.9)" : "#334155"} stroke="#fbbf24" strokeWidth="1.5" />
            {switchOn && <circle cx="150" cy="135" r={Math.min(30, 14 + current * 12)} fill="rgba(252, 211, 77, 0.25)" />}
            <text x="150" y="158" fill="#fbbf24" fontSize="9" textAnchor="middle">Bulb ({power.toFixed(1)}W)</text>
          </svg>

          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10 text-center">
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Ammeter Reading (I = V/R)</span>
              <strong className="text-sm text-emerald-300 font-mono">{current.toFixed(3)} A</strong>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Electrical Power Dissipated</span>
              <strong className="text-sm text-amber-300 font-mono">{power.toFixed(2)} W</strong>
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>DC Voltage (V)</span>
              <span className="font-mono text-amber-300 font-bold">{voltage.toFixed(1)} V</span>
            </div>
            <input
              type="range"
              min="1.5"
              max="12"
              step="0.5"
              value={voltage}
              onChange={(e) => setVoltage(parseFloat(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Resistance (R)</span>
              <span className="font-mono text-emerald-300 font-bold">{resistance} Ω</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={resistance}
              onChange={(e) => setResistance(parseInt(e.target.value))}
              className="w-full accent-emerald-400"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleRecord}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-xs font-bold text-black shadow-lg hover:brightness-110"
          >
            + Record V-I Observation
          </button>
        </div>

        <ObservationTable
          title="Ohm's Law V-I Observations"
          columns={[
            { key: "trial", label: "Trial" },
            { key: "voltage", label: "Voltage (V)", unit: "V" },
            { key: "resistance", label: "Resistance (R)", unit: "Ω" },
            { key: "current", label: "Current (I)", unit: "A" },
            { key: "power", label: "Power (P)", unit: "W" },
          ]}
          rows={observations}
          onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 9. WAVE MOTION SIMULATOR (CBSE Class 9 / 11)
// ============================================================================
export function WaveSim({ onComplete, alreadyCompleted, scholarClass }: LabSimProps) {
  const [type, setType] = useState<"transverse" | "longitudinal">("transverse");
  const [frequency, setFrequency] = useState(3);
  const [amplitude, setAmplitude] = useState(25);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations(scholarClass, "wave"));

  const speed = 20; // m/s wave propagation
  const wavelength = speed / frequency;

  const handleRecord = () => {
    const newRow: ObsRow = {
      id: crypto.randomUUID(),
      trial: observations.length + 1,
      type: type === "transverse" ? "Transverse" : "Longitudinal",
      frequency,
      amplitude,
      wavelength: Number(wavelength.toFixed(2)),
      speed,
    };
    const next = [...observations, newRow];
    setObservations(next);
    saveObservations(scholarClass, "wave", next);
    saveCompletedExp(scholarClass, "wave");
    onComplete();
    toast.success("Wave data logged!", { description: `λ = ${wavelength.toFixed(2)} m (f = ${frequency} Hz)` });
  };

  const wavePath = useMemo(() => {
    const pts: string[] = [];
    for (let x = 0; x <= 280; x += 4) {
      const y = 80 + amplitude * Math.sin((x / 280) * (frequency * 2 * Math.PI));
      pts.push(`${x === 0 ? "M" : "L"} ${20 + x} ${y}`);
    }
    return pts.join(" ");
  }, [amplitude, frequency]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="rounded-2xl border border-teal-500/20 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Wave Motion & Frequency Lab (v = fλ)</h3>
            <p className="text-xs text-white/60">Visualize crests, troughs, compressions and rarefactions</p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setType("transverse")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                type === "transverse" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-white/60 hover:text-white"
              }`}
            >
              Transverse
            </button>
            <button
              type="button"
              onClick={() => setType("longitudinal")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                type === "longitudinal" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-white/60 hover:text-white"
              }`}
            >
              Longitudinal
            </button>
          </div>
        </div>

        {/* Wave Visual Canvas */}
        <div className="my-5 rounded-xl border border-white/10 bg-black/50 p-4">
          <svg viewBox="0 0 320 160" className="w-full h-40">
            <line x1="10" y1="80" x2="310" y2="80" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
            {type === "transverse" ? (
              <path d={wavePath} fill="none" stroke="#2dd4bf" strokeWidth="3" />
            ) : (
              // Longitudinal wave particle density
              Array.from({ length: 40 }).map((_, i) => {
                const xOffset = 20 + i * 7 + Math.sin(i * 0.4 * frequency) * (amplitude * 0.4);
                return <line key={i} x1={xOffset} y1="40" x2={xOffset} y2="120" stroke="#2dd4bf" strokeWidth="2" opacity={0.8} />;
              })
            )}
          </svg>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Frequency (f)</span>
              <strong className="text-sm text-teal-300 font-mono">{frequency} Hz</strong>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Wavelength (λ = v/f)</span>
              <strong className="text-sm text-cyan-300 font-mono">{wavelength.toFixed(2)} m</strong>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-2">
              <span className="text-[10px] text-white/50 block">Wave Speed (v)</span>
              <strong className="text-sm text-indigo-300 font-mono">{speed} m/s</strong>
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Wave Frequency (f)</span>
              <span className="font-mono text-teal-300 font-bold">{frequency} Hz</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={frequency}
              onChange={(e) => setFrequency(parseInt(e.target.value))}
              className="w-full accent-teal-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Wave Amplitude (A)</span>
              <span className="font-mono text-cyan-300 font-bold">{amplitude} px</span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              value={amplitude}
              onChange={(e) => setAmplitude(parseInt(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleRecord}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 text-xs font-bold text-black shadow-lg hover:brightness-110"
          >
            + Record Wave Parameters
          </button>
        </div>

        <ObservationTable
          title="Wave Parameters Observations"
          columns={[
            { key: "trial", label: "Trial" },
            { key: "type", label: "Wave Type" },
            { key: "frequency", label: "Frequency (f)", unit: "Hz" },
            { key: "amplitude", label: "Amplitude (A)", unit: "px" },
            { key: "wavelength", label: "Wavelength (λ)", unit: "m" },
            { key: "speed", label: "Wave Speed (v)", unit: "m/s" },
          ]}
          rows={observations}
          onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 10. ELECTROLYSIS OF WATER (CBSE Class 10 Chemistry)
// ============================================================================
export function ElectrolysisSim({ onComplete, alreadyCompleted, scholarClass }: LabSimProps) {
  const [current, setCurrent] = useState(1.5);
  const [powerOn, setPowerOn] = useState(true);
  const [seconds, setSeconds] = useState(10);
  const [observations, setObservations] = useState<ObsRow[]>(() => loadObservations(scholarClass, "electrolysis"));

  // 2H2O -> 2H2 + O2. Hydrogen volume is twice Oxygen volume
  const h2Vol = useMemo(() => (powerOn ? Number((seconds * current * 0.4).toFixed(1)) : 0), [current, powerOn, seconds]);
  const o2Vol = useMemo(() => (powerOn ? Number((h2Vol / 2).toFixed(1)) : 0), [h2Vol, powerOn]);

  const handleRecord = () => {
    const newRow: ObsRow = {
      id: crypto.randomUUID(),
      trial: observations.length + 1,
      current,
      duration: seconds,
      h2Vol,
      o2Vol,
      ratio: "2 : 1",
    };
    const next = [...observations, newRow];
    setObservations(next);
    saveObservations(scholarClass, "electrolysis", next);
    saveCompletedExp(scholarClass, "electrolysis");
    onComplete();
    toast.success("Electrolysis reading logged!", { description: `H₂: ${h2Vol} mL, O₂: ${o2Vol} mL (2:1 ratio)` });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      <div className="rounded-2xl border border-blue-500/20 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Electrolysis of Water (Hofmann Voltameter)</h3>
            <p className="text-xs text-white/60">Decomposition of acidified water: 2H₂O(l) → 2H₂(g) + O₂(g)</p>
          </div>
          <button
            type="button"
            onClick={() => setPowerOn((p) => !p)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              powerOn ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
            }`}
          >
            DC Power: {powerOn ? "ACTIVE" : "OFF"}
          </button>
        </div>

        {/* Voltameter Visual */}
        <div className="my-5 rounded-xl border border-white/10 bg-black/50 p-4">
          <svg viewBox="0 0 300 170" className="w-full h-44">
            {/* Electrolysis Tank */}
            <rect x="70" y="30" width="160" height="110" fill="rgba(14, 165, 233, 0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" rx="6" />
            {/* Cathode Tube (Hydrogen) */}
            <rect x="95" y="40" width="30" height="90" fill="rgba(255,255,255,0.05)" stroke="#38bdf8" strokeWidth="1.5" rx="2" />
            <text x="110" y="32" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">Cathode (-)</text>
            <text x="110" y="60" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">H₂: {h2Vol} mL</text>
            {/* Anode Tube (Oxygen) */}
            <rect x="175" y="40" width="30" height="90" fill="rgba(255,255,255,0.05)" stroke="#f43f5e" strokeWidth="1.5" rx="2" />
            <text x="190" y="32" fill="#f43f5e" fontSize="10" fontWeight="bold" textAnchor="middle">Anode (+)</text>
            <text x="190" y="60" fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">O₂: {o2Vol} mL</text>
            {/* Electrodes */}
            <rect x="107" y="100" width="6" height="35" fill="#475569" />
            <rect x="187" y="100" width="6" height="35" fill="#475569" />
            {/* Bubbles animation */}
            {powerOn && (
              <>
                <circle cx="110" cy="115" r="2" fill="#38bdf8"><animate attributeName="cy" from="125" to="70" dur="0.6s" repeatCount="indefinite" /></circle>
                <circle cx="190" cy="115" r="2" fill="#f43f5e"><animate attributeName="cy" from="125" to="70" dur="1.2s" repeatCount="indefinite" /></circle>
              </>
            )}
            <text x="150" y="160" fill="rgba(255,255,255,0.6)" fontSize="10" textAnchor="middle">
              Volumetric Ratio: H₂ : O₂ = 2 : 1
            </text>
          </svg>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>DC Current (I)</span>
              <span className="font-mono text-blue-300 font-bold">{current.toFixed(1)} A</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.5"
              value={current}
              onChange={(e) => setCurrent(parseFloat(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Run Duration</span>
              <span className="font-mono text-indigo-300 font-bold">{seconds} seconds</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={seconds}
              onChange={(e) => setSeconds(parseInt(e.target.value))}
              className="w-full accent-indigo-400"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleRecord}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-lg hover:brightness-110"
          >
            + Record Gas Volumes
          </button>
        </div>

        <ObservationTable
          title="Electrolysis Gas Volume Observations"
          columns={[
            { key: "trial", label: "Trial" },
            { key: "current", label: "Current (I)", unit: "A" },
            { key: "duration", label: "Time (t)", unit: "s" },
            { key: "h2Vol", label: "H₂ Volume", unit: "mL" },
            { key: "o2Vol", label: "O₂ Volume", unit: "mL" },
            { key: "ratio", label: "H₂ : O₂ Ratio" },
          ]}
          rows={observations}
          onDelete={(id) => setObservations((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>
    </div>
  );
}
