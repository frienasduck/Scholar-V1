"use client";
import { useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { DEFAULT_LAM_IDENTITY, LAM_AVATARS, getLamAvatar, type LamAvatarState, type LamIdentityPreferences } from "@/lib/lam/identity";
import { getLamPresence, serverLamPresence, subscribeLamPresence, setLamEnvironment } from "@/lib/lam/presence";
import { LamAvatar } from "./lam-avatar";
import { LamScene } from "./lam-scene";
import styles from "./lam-identity.module.css";

const previews: { label: string; state: LamAvatarState }[] = [{ label: "Idle", state: "idle" }, { label: "Listening", state: "listening" }, { label: "Thinking", state: "thinking" }, { label: "Teaching", state: "teaching" }, { label: "Happy", state: "happy" }, { label: "Greeting", state: "greeting" }, { label: "Peek", state: "peek_right" }, { label: "Sleep", state: "sleeping" }, { label: "Wake", state: "wake" }];
export function LamIdentitySettings() {
  const prefs = useStore(s => s.settings.lamIdentity);
  const updateSettings = useStore(s => s.updateSettings);
  const guest = useStore(s => s.guestMode);
  const [preview, setPreview] = useState(prefs.avatarId);
  const [state, setState] = useState<LamAvatarState>("idle");
  const [revision, setRevision] = useState(0);
  const sessionMuted = useSyncExternalStore(subscribeLamPresence, () => getLamPresence().sessionMuted, () => serverLamPresence().sessionMuted);
  const selected = getLamAvatar(preview);
  const patch = (change: Partial<LamIdentityPreferences>) => updateSettings({ lamIdentity: { ...prefs, ...change } });
  return <section className={styles.gallery} aria-labelledby="lam-identity-title">
    <h3 id="lam-identity-title">Your LAM · Living forms</h3><p>Different forms. The same study companion. Avatar choice changes LAM’s appearance, never its intelligence or teaching personality.</p>
    <div className={styles.preview}>
      <div className={styles.previewIdentity}><LamScene key={`${preview}:${revision}`} avatarId={preview} placement="gallery" state={state} size={144} target={state === "listening" ? "input" : state === "teaching" ? "formula" : "none"}/><div><h4>{selected.name}</h4><p>{selected.description}{selected.id === "aurora" ? " · Scholar’s canonical form" : ""}</p><div className={styles.previewControls} role="group" aria-label="Preview LAM animation">{previews.map(p => <button key={p.state} type="button" aria-pressed={state === p.state} onClick={() => { setState(p.state); setRevision(r => r + 1); }}>{p.label}</button>)}</div></div></div>
      <button type="button" className={styles.use} onClick={() => patch({ avatarId: preview })}>{prefs.avatarId === preview ? "This is your LAM ✓" : "Use this LAM"}</button>
    </div>
    <div className={styles.grid} role="group" aria-label="Approved LAM avatars">{LAM_AVATARS.map(a => <button type="button" key={a.id} className={styles.card} aria-pressed={preview === a.id} aria-label={`Preview ${a.name}`} onClick={() => { setPreview(a.id); setRevision(r => r + 1); }}>
      {prefs.avatarId === a.id && <span className={styles.selected}>IN USE</span>}<LamAvatar avatarId={a.id} state="idle" placement="gallery" size={100} animate={false}/><strong>{a.name}</strong><small>{a.signature === "warm" ? "Warm light" : a.signature === "faceted" ? "Crystal & light" : a.signature === "mentor" ? "Quiet presence" : a.signature === "companion" ? "Study companion" : "Cosmic presence"}</small>
    </button>)}</div>
    <div className={styles.options}>
      <label className={styles.option}><span>LAM presence</span><select aria-label="LAM presence level" value={prefs.presence} onChange={e => patch({ presence: e.target.value as LamIdentityPreferences["presence"] })}><option value="quiet">Quiet</option><option value="balanced">Balanced · recommended</option><option value="lively">Lively</option></select></label>
      {([ ["animations", "Character animation"], ["ambient", "Ambient appearances"], ["peeks", "Rare edge peeks"], ["celebrations", "Celebration reactions"], ["idleReactions", "Gentle idle reactions"], ["cursorAwareness", "Desktop cursor awareness"], ["reducedMotion", "Reduce character motion"] ] as const).map(([key, label]) => <label key={key} className={styles.option}><span>{label}</span><input type="checkbox" checked={prefs[key]} onChange={e => patch({ [key]: e.target.checked })}/></label>)}
      <label className={styles.option}><span>Motion intensity</span><select aria-label="LAM character motion intensity" value={prefs.intensity} onChange={e => patch({ intensity: e.target.value as LamIdentityPreferences["intensity"] })}><option value="subtle">Subtle</option><option value="normal">Normal</option><option value="expressive">Expressive</option></select></label>
    </div>
    <p className="mt-4">Balanced permits up to 3 peeks per session, at least 5 minutes apart, only in clear desktop margins. Quiet disables peeks. Reading, typing, tests, urgent preparation, dialogs and fullscreen take priority. Device and Scholar reduced-motion settings always win.</p>
    <button type="button" className={styles.reset} aria-pressed={sessionMuted} onClick={() => setLamEnvironment({ sessionMuted: !sessionMuted })}>{sessionMuted ? "Resume LAM motion this session" : "Quiet LAM for this session"}</button>
    <button type="button" className={styles.reset} onClick={() => { updateSettings({ lamIdentity: { ...DEFAULT_LAM_IDENTITY } }); setPreview(DEFAULT_LAM_IDENTITY.avatarId); setState("idle"); }}>Reset LAM appearance</button>
    {process.env.NODE_ENV === "development" && <button type="button" className="ml-2" onClick={() => window.dispatchEvent(new Event("scholar:lam-test-peek"))}>Preview safe edge peek</button>}
    {process.env.NODE_ENV === "development" && <details className="mt-3"><summary>Development · behavior checks</summary><div className={styles.previewControls}>{["sleepy","sleeping","wake","success","thinking"].map(s => <button type="button" key={s} onClick={() => window.dispatchEvent(new CustomEvent("scholar:lam-test-state", { detail: s }))}>{s}</button>)}</div></details>}
    <p className="mt-3">{guest ? "Saved only in this browser’s isolated Guest workspace." : "Saved in your account’s local workspace on this browser. Appearance sync across devices is not available yet."}</p>
  </section>;
}
