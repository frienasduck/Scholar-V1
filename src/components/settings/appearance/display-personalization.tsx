"use client";

import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Accessibility, BookOpen, Check, ChevronDown, Download, Eye, Gauge, Image as ImageIcon,
  LayoutPanelLeft, Monitor, Moon, Palette, PanelsTopLeft, RefreshCw, Save, Search,
  SlidersHorizontal, Sparkles, Sun, Trash2, Type, Upload, WandSparkles,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useStore, type Settings } from "@/lib/store";
import { DEFAULT_APPEARANCE, migrateAppearance } from "@/lib/appearance/appearance-defaults";
import { APPEARANCE_PRESETS, applyPreset } from "@/lib/appearance/appearance-presets";
import {
  APPEARANCE_PAGES, appearanceCore, type AppearanceCoreSettings, type ScholarAppearanceSettings,
  type ScholarAppearanceProfile,
} from "@/lib/appearance/appearance-schema";
import { contrastRatio, improveAccentContrast, resolveThemeMode, safeHex } from "@/lib/appearance/appearance-tokens";
import { storeWallpaper } from "@/lib/appearance/wallpaper-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const FONT_OPTIONS = [
  ["scholar", "Scholar Default"], ["system", "System"], ["modern", "Modern Sans"],
  ["humanist", "Humanist Sans"], ["rounded", "Rounded"], ["serif", "Serif"],
  ["book", "Book Serif"], ["mono", "Monospace"], ["accessible", "Accessible"],
] as const;

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", files: "Files", ebook: "E-Books", notes: "Notes", "ai-tools": "AI Tools",
  "ai-tutor": "AI Tutor", canvas: "Canvas", slides: "Slides", "auto-lecture": "Auto-Lecture",
  quiz: "Quizzes", "mock-exam": "Mock Exams", community: "Community", resources: "Resources",
  downloads: "Downloads", settings: "Settings",
};

const WALLPAPER_OPTIONS = [
  ["none", "None"], ["deep-space", "Deep Space"], ["aurora", "Aurora"], ["warm-study", "Warm Study"],
  ["cool-focus", "Cool Focus"], ["paper", "Paper"], ["abstract", "Abstract"], ["scholar-cinematic", "Scholar Cinematic Video"],
] as const;

function legacyPatch(appearance: ScholarAppearanceSettings): Partial<Settings> {
  const resolved = resolveThemeMode(appearance);
  const scale = [90, 100, 110, 120].reduce((best, value) => Math.abs(value - appearance.typography.textScale) < Math.abs(best - appearance.typography.textScale) ? value : best, 100);
  return {
    appearance,
    theme: resolved === "light" ? "light" : "dark",
    fontScale: String(scale) as Settings["fontScale"],
    density: appearance.density === "compact" ? "compact" : appearance.density === "spacious" ? "spacious" : "comfortable",
    highContrast: appearance.accessibility.highContrast,
    readableFont: appearance.typography.bodyFont === "accessible",
    reduceMotion: appearance.accessibility.reduceMotion || appearance.motion.level === "off",
    pageTransitions: appearance.motion.pageTransitions,
  };
}

function ControlGroup({ id, icon, title, description, keywords, query, children, defaultOpen = false }: {
  id: string; icon: ReactNode; title: string; description: string; keywords: string; query: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const match = !query || `${title} ${description} ${keywords}`.toLowerCase().includes(query);
  if (!match) return null;
  return (
    <details id={id} className="appearance-group" open={defaultOpen || Boolean(query)}>
      <summary>
        <span className="appearance-group-icon">{icon}</span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <ChevronDown className="appearance-chevron" size={17} />
      </summary>
      <div className="appearance-group-body">{children}</div>
    </details>
  );
}

function Field({ label, description, children, vertical = false }: { label: string; description?: string; children: ReactNode; vertical?: boolean }) {
  return <div className={cn("appearance-field", vertical && "is-vertical")}><span><strong>{label}</strong>{description ? <small>{description}</small> : null}</span><div>{children}</div></div>;
}

function NativeSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>;
}

function ChoiceRow({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return <div className="appearance-choice-row" role="radiogroup" aria-label={label}>{options.map((option) => <button key={option} type="button" role="radio" aria-checked={value === option} data-selected={value === option} onClick={() => onChange(option)}>{option.replaceAll("-", " ")}</button>)}</div>;
}

function RangeControl({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return <div className="appearance-range"><div><label>{label}</label><output>{value}{suffix}</output></div><Slider aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} /></div>;
}

function ColorControl({ label, value, background, onChange }: { label: string; value: string; background: string; onChange: (value: string) => void }) {
  const contrast = contrastRatio(safeHex(value, "#818cf8"), background);
  return (
    <label className="appearance-color">
      <span>{label}{contrast < 3 ? <em title="Low contrast">Low contrast</em> : null}</span>
      <span><input type="color" value={safeHex(value, "#818cf8")} onChange={(event) => onChange(event.target.value)} /><Input aria-label={`${label} hex value`} value={value} maxLength={7} onChange={(event) => onChange(event.target.value)} /></span>
    </label>
  );
}

function AppearancePreview({ appearance }: { appearance: ScholarAppearanceSettings }) {
  return (
    <div className="appearance-preview" style={{ "--preview-accent": safeHex(appearance.colors.primary, "#818cf8"), "--preview-radius": `${appearance.surfaces.buttonRadius}px` } as React.CSSProperties}>
      <aside><Sparkles size={17} /><i /><i /><i /></aside>
      <section>
        <header><span>Display preview</span><button type="button">Selected</button></header>
        <div className="appearance-preview-card">
          <small>STRUCTURE OF ATOM</small><h3>Scholar adapts to you.</h3>
          <p>Matter consists of particles whose properties can be studied experimentally.</p>
          <div className="appearance-preview-formula">E<sub>n</sub> = −13.6Z²/n² eV</div>
          <div className="appearance-preview-actions"><button type="button">Continue</button><input aria-label="Preview input" readOnly value="Focus on the next concept" /></div>
        </div>
      </section>
    </div>
  );
}

export function DisplayPersonalization() {
  const stored = useStore((state) => state.settings.appearance);
  const updateSettings = useStore((state) => state.updateSettings);
  const initialRef = useRef(structuredClone(stored));
  const importRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => structuredClone(stored));
  const [applyMode, setApplyMode] = useState<"live" | "preview">("live");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLowerCase());

  const persist = (next: ScholarAppearanceSettings) => updateSettings(legacyPatch(next));
  const change = (recipe: (current: ScholarAppearanceSettings) => ScholarAppearanceSettings) => {
    setDraft((current) => {
      const next = recipe(structuredClone(current));
      next.preset = next.preset === "scholar-default" ? "custom" : next.preset;
      if (applyMode === "live") persist(next);
      return next;
    });
  };
  const setAppearance = (next: ScholarAppearanceSettings, forcePersist = applyMode === "live") => {
    setDraft(next);
    if (forcePersist) persist(next);
  };
  const updateCore = <K extends keyof ScholarAppearanceSettings>(key: K, value: ScholarAppearanceSettings[K]) => change((next) => ({ ...next, [key]: value }));
  const updateNested = <K extends "colors" | "wallpaper" | "typography" | "surfaces" | "navigation" | "motion" | "reading" | "accessibility" | "mobile">(key: K, patch: Partial<ScholarAppearanceSettings[K]>) => change((next) => ({ ...next, [key]: { ...next[key], ...patch } }));
  const darkBackground = draft.themeMode === "light" ? "#ffffff" : "#0a0a0b";

  const selectPreset = (id: string) => {
    const preset = APPEARANCE_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const currentCore = appearanceCore(draft);
    const nextCore = applyPreset(currentCore, preset);
    const next: ScholarAppearanceSettings = {
      ...nextCore,
      customProfiles: draft.customProfiles,
      previousCustom: draft.preset === "custom" ? currentCore : draft.previousCustom,
    };
    setAppearance(next);
    toast.success(`${preset.name} selected`);
  };

  const uploadWallpaper = async (file: File | undefined) => {
    if (!file) return;
    try {
      const record = await storeWallpaper(file);
      updateNested("wallpaper", { kind: record.type === "video" ? "video" : "custom-image", value: "custom", mediaId: record.id, mediaName: record.name });
      toast.success(`${record.type === "video" ? "Video" : "Image"} wallpaper saved`, { description: "The original stays in private browser storage, not localStorage." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wallpaper could not be saved.");
    }
  };

  const exportAppearance = () => {
    const blob = new Blob([JSON.stringify({ type: "scholar-appearance", schemaVersion: 1, appearance: draft }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `scholar-appearance-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Appearance profile exported");
  };

  const importAppearance = (file: File | undefined) => {
    if (!file || file.size > 512_000) return toast.error("Choose an appearance JSON file under 500 KB.");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const value = JSON.parse(String(reader.result));
        if (value?.type !== "scholar-appearance" || value?.schemaVersion !== 1 || !value?.appearance) throw new Error("Invalid Scholar appearance profile.");
        const next = migrateAppearance(value.appearance);
        setAppearance(next);
        toast.success("Appearance profile imported");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Invalid appearance profile."); }
    };
    reader.readAsText(file);
  };

  const saveProfile = () => {
    const name = window.prompt("Name this appearance profile", "My Scholar Theme")?.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const profile: ScholarAppearanceProfile = { id: crypto.randomUUID(), name: name.slice(0, 60), config: appearanceCore(draft), createdAt: now, updatedAt: now, schemaVersion: 1 };
    setAppearance({ ...draft, customProfiles: [profile, ...draft.customProfiles].slice(0, 24) });
    toast.success("Custom appearance saved");
  };

  const restoreDefault = () => {
    const profile = draft.customProfiles.find((item) => item.isDefault);
    setAppearance(profile
      ? { ...profile.config, customProfiles: draft.customProfiles, previousCustom: appearanceCore(draft) }
      : { ...structuredClone(DEFAULT_APPEARANCE), customProfiles: draft.customProfiles, previousCustom: appearanceCore(draft) });
  };

  return (
    <section className="appearance-control-center" aria-labelledby="display-personalization-title">
      <header className="appearance-heading">
        <span><Palette size={20} /></span>
        <div><p>Appearance</p><h2 id="display-personalization-title">Display & Personalization</h2><small>A real-time visual control centre for Scholar.</small></div>
      </header>

      <div className="appearance-preview-shell">
        <div className="appearance-preview-toolbar">
          <div><strong>Live preview</strong><small>Sidebar, text, surface, accent, input and mathematics.</small></div>
          <div className="appearance-apply-mode" role="radiogroup" aria-label="Appearance update behaviour">
            <button type="button" role="radio" aria-checked={applyMode === "live"} data-selected={applyMode === "live"} onClick={() => setApplyMode("live")}>Live Apply</button>
            <button type="button" role="radio" aria-checked={applyMode === "preview"} data-selected={applyMode === "preview"} onClick={() => setApplyMode("preview")}>Preview First</button>
          </div>
        </div>
        <AppearancePreview appearance={draft} />
        <div className="appearance-apply-bar">
          <Button onClick={() => { persist(draft); toast.success("Appearance applied across Scholar"); }}><Check size={15} />Apply to Scholar</Button>
          <Button variant="outline" onClick={() => { const previous = structuredClone(initialRef.current); setDraft(previous); persist(previous); toast.info("Appearance changes cancelled"); }}>Cancel changes</Button>
          {draft.previousCustom ? <Button variant="ghost" onClick={() => setAppearance({ ...draft.previousCustom!, customProfiles: draft.customProfiles, previousCustom: appearanceCore(draft) })}><RefreshCw size={14} />Restore previous</Button> : null}
        </div>
      </div>

      <label className="appearance-search"><Search size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search font, wallpaper, blur, sidebar, contrast…" /></label>

      <ControlGroup id="appearance-presets" icon={<WandSparkles />} title="Quick Presets" description="Coordinated visual profiles with a safe custom restore point." keywords="default midnight space minimal oled aurora warm cool paper exam contrast" query={query} defaultOpen>
        <div className="appearance-presets">{APPEARANCE_PRESETS.map((preset) => <button type="button" key={preset.id} data-selected={draft.preset === preset.id} onClick={() => selectPreset(preset.id)}><i style={{ background: preset.swatch }} /><span><strong>{preset.name}</strong><small>{preset.description}</small></span>{draft.preset === preset.id ? <Check size={15} /> : null}</button>)}</div>
      </ControlGroup>

      <ControlGroup id="appearance-theme" icon={<Moon />} title="Theme" description="System, light, dark, OLED or scheduled appearance." keywords="system light dark oled schedule sunrise sunset time" query={query} defaultOpen>
        <ChoiceRow label="Theme mode" value={draft.themeMode} onChange={(value) => updateCore("themeMode", value as ScholarAppearanceSettings["themeMode"])} options={["system", "light", "dark", "oled", "schedule"]} />
        {draft.themeMode === "schedule" ? <div className="appearance-two"><Field label="Light from"><Input type="time" value={draft.scheduleLight} onChange={(event) => updateCore("scheduleLight", event.target.value)} /></Field><Field label="Dark from"><Input type="time" value={draft.scheduleDark} onChange={(event) => updateCore("scheduleDark", event.target.value)} /></Field></div> : null}
        <Field label="Use sunrise and sunset" description="Uses a privacy-safe local daylight approximation (06:30–18:30); Scholar never requests location."><Switch checked={draft.sunriseSunset} onCheckedChange={(value) => updateCore("sunriseSunset", value)} /></Field>
      </ControlGroup>

      <ControlGroup id="appearance-colours" icon={<Palette />} title="Colours" description="Semantic accents with contrast feedback." keywords="accent primary secondary success warning error selection link focus hex rgb hsl contrast" query={query}>
        <div className="appearance-colors">
          {(Object.keys(draft.colors) as Array<keyof typeof draft.colors>).filter((key) => key !== "deriveSupporting").map((key) => <ColorControl key={key} label={key[0].toUpperCase() + key.slice(1)} value={String(draft.colors[key])} background={darkBackground} onChange={(value) => updateNested("colors", { [key]: value })} />)}
        </div>
        <Field label="Automatically derive supporting colours" description="Creates harmonious hover, pressed, muted and glow tones."><Switch checked={draft.colors.deriveSupporting} onCheckedChange={(value) => updateNested("colors", { deriveSupporting: value })} /></Field>
        <div className="appearance-profile-actions"><Button variant="outline" onClick={() => updateNested("colors", { primary: improveAccentContrast(draft.colors.primary, draft.themeMode !== "light"), link: improveAccentContrast(draft.colors.link, draft.themeMode !== "light") })}>Improve contrast automatically</Button><Button variant="outline" onClick={() => updateNested("colors", DEFAULT_APPEARANCE.colors)}>Restore colour defaults</Button></div>
      </ControlGroup>

      <ControlGroup id="appearance-wallpaper" icon={<ImageIcon />} title="Wallpaper & Background" description="Static, gradient, Scholar, uploaded image or video backgrounds." keywords="wallpaper background image video upload crop position zoom fit blur brightness saturation overlay parallax poster wifi" query={query}>
        <Field label="Background type"><ChoiceRow label="Background type" value={draft.wallpaper.kind} onChange={(value) => updateNested("wallpaper", { kind: value as ScholarAppearanceSettings["wallpaper"]["kind"], value: value === "none" ? "none" : draft.wallpaper.value })} options={["none", "solid", "gradient", "scholar", "custom-image", "video"]} /></Field>
        <Field label="Scholar background"><NativeSelect label="Scholar background" value={draft.wallpaper.value} onChange={(value) => updateNested("wallpaper", { value, kind: value === "none" ? "none" : value === "scholar-cinematic" ? "video" : "scholar" })} options={WALLPAPER_OPTIONS} /></Field>
        <div className="appearance-upload-row"><input ref={uploadRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm" onChange={(event) => { void uploadWallpaper(event.target.files?.[0]); event.target.value = ""; }} /><Button variant="outline" onClick={() => uploadRef.current?.click()}><Upload size={14} />Upload image or video</Button>{draft.wallpaper.mediaName ? <span>{draft.wallpaper.mediaName}</span> : null}</div>
        <div className="appearance-two"><Field label="Fit"><NativeSelect label="Wallpaper fit" value={draft.wallpaper.fit} onChange={(value) => updateNested("wallpaper", { fit: value as ScholarAppearanceSettings["wallpaper"]["fit"] })} options={[["cover","Fill"],["contain","Fit"],["fill","Stretch"],["tile","Tile"],["center","Centre"]]} /></Field><Field label="Attachment"><NativeSelect label="Background attachment" value={draft.wallpaper.attachment} onChange={(value) => updateNested("wallpaper", { attachment: value as ScholarAppearanceSettings["wallpaper"]["attachment"] })} options={[["fixed","Fixed"],["scroll","Scrolls"],["parallax","Subtle parallax"]]} /></Field></div>
        <div className="appearance-ranges"><RangeControl label="Horizontal position" value={draft.wallpaper.positionX} min={0} max={100} suffix="%" onChange={(value) => updateNested("wallpaper", { positionX: value })} /><RangeControl label="Vertical position" value={draft.wallpaper.positionY} min={0} max={100} suffix="%" onChange={(value) => updateNested("wallpaper", { positionY: value })} /><RangeControl label="Zoom" value={draft.wallpaper.zoom} min={100} max={180} suffix="%" onChange={(value) => updateNested("wallpaper", { zoom: value })} /><RangeControl label="Opacity" value={draft.wallpaper.opacity} min={10} max={100} suffix="%" onChange={(value) => updateNested("wallpaper", { opacity: value })} /><RangeControl label="Blur" value={draft.wallpaper.blur} min={0} max={24} suffix="px" onChange={(value) => updateNested("wallpaper", { blur: value })} /><RangeControl label="Brightness" value={draft.wallpaper.brightness} min={35} max={140} suffix="%" onChange={(value) => updateNested("wallpaper", { brightness: value })} /><RangeControl label="Saturation" value={draft.wallpaper.saturation} min={0} max={180} suffix="%" onChange={(value) => updateNested("wallpaper", { saturation: value })} /><RangeControl label="Contrast" value={draft.wallpaper.contrast} min={50} max={160} suffix="%" onChange={(value) => updateNested("wallpaper", { contrast: value })} /><RangeControl label="Overlay darkness" value={draft.wallpaper.overlay} min={0} max={90} suffix="%" onChange={(value) => updateNested("wallpaper", { overlay: value })} /><RangeControl label="Video speed" value={draft.wallpaper.videoSpeed} min={0.5} max={1.5} step={0.1} suffix="×" onChange={(value) => updateNested("wallpaper", { videoSpeed: value })} /></div>
        <ColorControl label="Overlay colour" value={draft.wallpaper.overlayColor} background={darkBackground} onChange={(value) => updateNested("wallpaper", { overlayColor: value })} />
        <div className="appearance-two"><Field label="Background transition"><NativeSelect label="Background transition" value={draft.wallpaper.transition} onChange={(value) => updateNested("wallpaper", { transition: value as ScholarAppearanceSettings["wallpaper"]["transition"] })} options={[["instant","Instant"],["crossfade","Crossfade"],["blur","Blur fade"],["dissolve","Gentle dissolve"]]} /></Field><Field label="Video quality"><NativeSelect label="Video quality" value={draft.wallpaper.videoQuality} onChange={(value) => updateNested("wallpaper", { videoQuality: value as ScholarAppearanceSettings["wallpaper"]["videoQuality"] })} options={[["auto","Auto"],["low","Low"],["medium","Medium"],["high","High"],["original","Original"]]} /></Field></div>
        <div className="appearance-switch-grid"><Field label="Background video"><Switch checked={draft.wallpaper.videoEnabled} onCheckedChange={(value) => updateNested("wallpaper", { videoEnabled: value })} /></Field><Field label="Loop video"><Switch checked={draft.wallpaper.loop} onCheckedChange={(value) => updateNested("wallpaper", { loop: value })} /></Field><Field label="Mute video"><Switch checked={draft.wallpaper.muted} onCheckedChange={(value) => updateNested("wallpaper", { muted: value })} /></Field><Field label="Pause when hidden"><Switch checked={draft.wallpaper.pauseWhenHidden} onCheckedChange={(value) => updateNested("wallpaper", { pauseWhenHidden: value })} /></Field><Field label="Pause in battery saver"><Switch checked={draft.wallpaper.pauseOnBatterySaver} onCheckedChange={(value) => updateNested("wallpaper", { pauseOnBatterySaver: value })} /></Field><Field label="Prefer still on mobile"><Switch checked={draft.wallpaper.stillOnMobile} onCheckedChange={(value) => updateNested("wallpaper", { stillOnMobile: value })} /></Field><Field label="Use video only on Wi-Fi"><Switch checked={draft.wallpaper.wifiOnly} onCheckedChange={(value) => updateNested("wallpaper", { wifiOnly: value })} /></Field></div>
        <Button variant="outline" onClick={() => updateNested("wallpaper", DEFAULT_APPEARANCE.wallpaper)}>Reset wallpaper</Button>
      </ControlGroup>

      <ControlGroup id="appearance-typography" icon={<Type />} title="Typography" description="Interface, headings, body, reading, mathematics, code and Canvas fonts." keywords="font typography text size heading line height letter spacing paragraph math code canvas scale" query={query}>
        <div className="appearance-font-grid">{(["interfaceFont","headingFont","bodyFont","readingFont","mathematicsFont","codeFont","canvasFont"] as const).map((key) => <Field key={key} label={key.replace("Font", " font")}><NativeSelect label={key} value={draft.typography[key]} onChange={(value) => updateNested("typography", { [key]: value })} options={FONT_OPTIONS} /></Field>)}</div>
        <div className="appearance-ranges"><RangeControl label="Text size" value={draft.typography.textScale} min={85} max={130} suffix="%" onChange={(value) => updateNested("typography", { textScale: value })} /><RangeControl label="Heading scale" value={draft.typography.headingScale} min={85} max={135} suffix="%" onChange={(value) => updateNested("typography", { headingScale: value })} /><RangeControl label="Line height" value={draft.typography.lineHeight} min={1.2} max={2} step={0.05} onChange={(value) => updateNested("typography", { lineHeight: value })} /><RangeControl label="Letter spacing" value={draft.typography.letterSpacing} min={-0.02} max={0.08} step={0.005} suffix="em" onChange={(value) => updateNested("typography", { letterSpacing: value })} /><RangeControl label="Paragraph spacing" value={draft.typography.paragraphSpacing} min={0.3} max={1.8} step={0.05} suffix="rem" onChange={(value) => updateNested("typography", { paragraphSpacing: value })} /><RangeControl label="Font weight" value={draft.typography.fontWeight} min={300} max={700} step={50} onChange={(value) => updateNested("typography", { fontWeight: value })} /></div>
        <Field label="Interface scale"><ChoiceRow label="Interface scale" value={draft.typography.interfaceScale} onChange={(value) => updateNested("typography", { interfaceScale: value as ScholarAppearanceSettings["typography"]["interfaceScale"] })} options={["compact","default","comfortable","large"]} /></Field>
        <Button variant="outline" onClick={() => updateNested("typography", DEFAULT_APPEARANCE.typography)}>Reset typography</Button>
      </ControlGroup>

      <ControlGroup id="appearance-layout" icon={<LayoutPanelLeft />} title="Interface Layout" description="Density, content width and responsive profiles." keywords="layout density compact balanced comfortable spacious content width narrow wide full mobile desktop touch" query={query}>
        <Field label="Interface density"><ChoiceRow label="Interface density" value={draft.density} onChange={(value) => updateCore("density", value as ScholarAppearanceSettings["density"])} options={["compact","balanced","comfortable","spacious"]} /></Field>
        <Field label="Content width"><ChoiceRow label="Content width" value={draft.contentWidth} onChange={(value) => updateCore("contentWidth", value as ScholarAppearanceSettings["contentWidth"])} options={["narrow","balanced","wide","full"]} /></Field>
        <Field label="Responsive appearance"><ChoiceRow label="Responsive appearance" value={draft.responsiveMode} onChange={(value) => updateCore("responsiveMode", value as ScholarAppearanceSettings["responsiveMode"])} options={["same","separate"]} /></Field>
        {draft.responsiveMode === "separate" ? <div className="appearance-switch-grid"><Field label="Static mobile wallpaper"><Switch checked={draft.mobile.stillWallpaper} onCheckedChange={(value) => updateNested("mobile", { stillWallpaper: value })} /></Field><Field label="Reduce mobile glass"><Switch checked={draft.mobile.reduceGlass} onCheckedChange={(value) => updateNested("mobile", { reduceGlass: value })} /></Field><Field label="Simplify mobile motion"><Switch checked={draft.mobile.simplifyMotion} onCheckedChange={(value) => updateNested("mobile", { simplifyMotion: value })} /></Field><Field label="Larger touch targets"><Switch checked={draft.mobile.largeTargets} onCheckedChange={(value) => updateNested("mobile", { largeTargets: value })} /></Field></div> : null}
      </ControlGroup>

      <ControlGroup id="appearance-surfaces" icon={<PanelsTopLeft />} title="Panels & Surfaces" description="Shared glass, transparency, card, border, corner and input tokens." keywords="glass blur transparency opacity panel card corners border shadow glow button input surface" query={query}>
        <Field label="Glass style"><ChoiceRow label="Glass style" value={draft.surfaces.glassStyle} onChange={(value) => updateNested("surfaces", { glassStyle: value as ScholarAppearanceSettings["surfaces"]["glassStyle"] })} options={["off","subtle","balanced","strong","ultra","custom"]} /></Field>
        <div className="appearance-ranges"><RangeControl label="Surface opacity" value={draft.surfaces.opacity} min={35} max={100} suffix="%" onChange={(value) => updateNested("surfaces", { opacity: value, glassStyle: "custom" })} /><RangeControl label="Backdrop blur" value={draft.surfaces.blur} min={0} max={40} suffix="px" onChange={(value) => updateNested("surfaces", { blur: value, glassStyle: "custom" })} /><RangeControl label="Saturation" value={draft.surfaces.saturation} min={80} max={180} suffix="%" onChange={(value) => updateNested("surfaces", { saturation: value })} /><RangeControl label="Brightness" value={draft.surfaces.brightness} min={70} max={140} suffix="%" onChange={(value) => updateNested("surfaces", { brightness: value })} /><RangeControl label="Glass highlight" value={draft.surfaces.highlight} min={0} max={100} suffix="%" onChange={(value) => updateNested("surfaces", { highlight: value })} /><RangeControl label="Edge light" value={draft.surfaces.edge} min={0} max={100} suffix="%" onChange={(value) => updateNested("surfaces", { edge: value })} /><RangeControl label="Refraction" value={draft.surfaces.refraction} min={0} max={100} suffix="%" onChange={(value) => updateNested("surfaces", { refraction: value })} /><RangeControl label="Texture noise" value={draft.surfaces.noise} min={0} max={30} suffix="%" onChange={(value) => updateNested("surfaces", { noise: value })} /><RangeControl label="Glow strength" value={draft.surfaces.glow} min={0} max={100} suffix="%" onChange={(value) => updateNested("surfaces", { glow: value })} /><RangeControl label="Focus glow" value={draft.surfaces.focusGlow} min={0} max={100} suffix="%" onChange={(value) => updateNested("surfaces", { focusGlow: value })} /></div>
        <div className="appearance-two"><Field label="Panel style"><NativeSelect label="Panel style" value={draft.surfaces.panelStyle} onChange={(value) => updateNested("surfaces", { panelStyle: value as ScholarAppearanceSettings["surfaces"]["panelStyle"] })} options={[["solid","Solid"],["translucent","Translucent"],["glass","Glass"],["border","Border only"],["minimal","Minimal"]]} /></Field><Field label="Card elevation"><NativeSelect label="Card elevation" value={draft.surfaces.elevation} onChange={(value) => updateNested("surfaces", { elevation: value as ScholarAppearanceSettings["surfaces"]["elevation"] })} options={[["flat","Flat"],["subtle","Subtle"],["medium","Medium"],["floating","Floating"]]} /></Field><Field label="Corner style"><NativeSelect label="Corner style" value={draft.surfaces.corners} onChange={(value) => updateNested("surfaces", { corners: value as ScholarAppearanceSettings["surfaces"]["corners"] })} options={[["square","Square"],["slight","Slight"],["rounded","Rounded"],["extra","Extra rounded"],["capsule","Capsule"]]} /></Field><Field label="Border strength"><NativeSelect label="Border strength" value={draft.surfaces.border} onChange={(value) => updateNested("surfaces", { border: value as ScholarAppearanceSettings["surfaces"]["border"] })} options={[["none","None"],["subtle","Subtle"],["medium","Medium"],["strong","Strong"]]} /></Field><Field label="Shadow strength"><NativeSelect label="Shadow strength" value={draft.surfaces.shadow} onChange={(value) => updateNested("surfaces", { shadow: value as ScholarAppearanceSettings["surfaces"]["shadow"] })} options={[["none","None"],["subtle","Subtle"],["medium","Medium"],["strong","Strong"]]} /></Field><Field label="Button style"><NativeSelect label="Button style" value={draft.surfaces.buttonStyle} onChange={(value) => updateNested("surfaces", { buttonStyle: value as ScholarAppearanceSettings["surfaces"]["buttonStyle"] })} options={[["solid","Solid"],["soft","Soft"],["outline","Outline"],["glass","Glass"],["minimal","Minimal"]]} /></Field><Field label="Input style"><NativeSelect label="Input style" value={draft.surfaces.inputStyle} onChange={(value) => updateNested("surfaces", { inputStyle: value as ScholarAppearanceSettings["surfaces"]["inputStyle"] })} options={[["filled","Filled"],["outline","Outline"],["glass","Glass"],["minimal","Minimal"]]} /></Field></div>
        <div className="appearance-ranges"><RangeControl label="Button radius" value={draft.surfaces.buttonRadius} min={0} max={28} suffix="px" onChange={(value) => updateNested("surfaces", { buttonRadius: value })} /><RangeControl label="Input radius" value={draft.surfaces.inputRadius} min={0} max={28} suffix="px" onChange={(value) => updateNested("surfaces", { inputRadius: value })} /></div>
      </ControlGroup>

      <ControlGroup id="appearance-navigation" icon={<Monitor />} title="Navigation" description="Sidebar, top navigation, icons and labels." keywords="sidebar width transparency icon only floating auto hide progress labels top navigation search profile notifications" query={query}>
        <Field label="Sidebar style"><ChoiceRow label="Sidebar style" value={draft.navigation.sidebarStyle} onChange={(value) => updateNested("navigation", { sidebarStyle: value as ScholarAppearanceSettings["navigation"]["sidebarStyle"] })} options={["default","compact","icons","floating","autohide"]} /></Field>
        <div className="appearance-ranges"><RangeControl label="Sidebar width" value={draft.navigation.sidebarWidth} min={200} max={340} suffix="px" onChange={(value) => updateNested("navigation", { sidebarWidth: value })} /><RangeControl label="Sidebar transparency" value={draft.navigation.sidebarOpacity} min={40} max={100} suffix="%" onChange={(value) => updateNested("navigation", { sidebarOpacity: value })} /></div>
        <div className="appearance-switch-grid"><Field label="Section labels"><Switch checked={draft.navigation.showSectionLabels} onCheckedChange={(value) => updateNested("navigation", { showSectionLabels: value })} /></Field><Field label="Navigation icons"><Switch checked={draft.navigation.showNavigationIcons} onCheckedChange={(value) => updateNested("navigation", { showNavigationIcons: value })} /></Field><Field label="Progress card"><Switch checked={draft.navigation.showProgressCard} onCheckedChange={(value) => updateNested("navigation", { showProgressCard: value })} /></Field><Field label="Expand on hover"><Switch checked={draft.navigation.expandOnHover} onCheckedChange={(value) => updateNested("navigation", { expandOnHover: value })} /></Field></div>
        <Field label="Top navigation style"><ChoiceRow label="Top navigation style" value={draft.navigation.topStyle} onChange={(value) => updateNested("navigation", { topStyle: value as ScholarAppearanceSettings["navigation"]["topStyle"] })} options={["default","minimal","floating","hidden"]} /></Field>
        <div className="appearance-switch-grid"><Field label="Show search"><Switch checked={draft.navigation.showSearch} onCheckedChange={(value) => updateNested("navigation", { showSearch: value })} /></Field><Field label="Show page title"><Switch checked={draft.navigation.showPageTitle} onCheckedChange={(value) => updateNested("navigation", { showPageTitle: value })} /></Field><Field label="Show profile"><Switch checked={draft.navigation.showProfile} onCheckedChange={(value) => updateNested("navigation", { showProfile: value })} /></Field><Field label="Show status"><Switch checked={draft.navigation.showNotifications} onCheckedChange={(value) => updateNested("navigation", { showNotifications: value })} /></Field><Field label="Transparent top bar"><Switch checked={draft.navigation.transparentTop} onCheckedChange={(value) => updateNested("navigation", { transparentTop: value })} /></Field><Field label="Compact top bar"><Switch checked={draft.navigation.compactTop} onCheckedChange={(value) => updateNested("navigation", { compactTop: value })} /></Field></div>
        <div className="appearance-two"><Field label="Icon style"><NativeSelect label="Icon style" value={draft.navigation.iconStyle} onChange={(value) => updateNested("navigation", { iconStyle: value as ScholarAppearanceSettings["navigation"]["iconStyle"] })} options={[["outline","Outline"],["rounded","Rounded"],["filled","Filled"],["automatic","Automatic"]]} /></Field><Field label="Icon size"><NativeSelect label="Icon size" value={draft.navigation.iconSize} onChange={(value) => updateNested("navigation", { iconSize: value as ScholarAppearanceSettings["navigation"]["iconSize"] })} options={[["small","Small"],["default","Default"],["large","Large"]]} /></Field><Field label="Icon labels"><NativeSelect label="Icon labels" value={draft.navigation.iconLabels} onChange={(value) => updateNested("navigation", { iconLabels: value as ScholarAppearanceSettings["navigation"]["iconLabels"] })} options={[["always","Always"],["hover","On hover"],["never","Never"]]} /></Field></div>
        <Button variant="outline" onClick={() => updateNested("navigation", DEFAULT_APPEARANCE.navigation)}>Reset navigation</Button>
      </ControlGroup>

      <ControlGroup id="appearance-motion" icon={<Sparkles />} title="Motion & Effects" description="Animation intensity, transitions, pointer effects and visual performance." keywords="motion animation transition hover reveal parallax shimmer background loading speed pointer performance battery saver" query={query}>
        <Field label="Motion level"><ChoiceRow label="Motion level" value={draft.motion.level} onChange={(value) => updateNested("motion", { level: value as ScholarAppearanceSettings["motion"]["level"] })} options={["off","reduced","balanced","expressive","custom"]} /></Field>
        <div className="appearance-switch-grid"><Field label="Page transitions"><Switch checked={draft.motion.pageTransitions} onCheckedChange={(value) => updateNested("motion", { pageTransitions: value })} /></Field><Field label="Panel transitions"><Switch checked={draft.motion.panelTransitions} onCheckedChange={(value) => updateNested("motion", { panelTransitions: value })} /></Field><Field label="Hover motion"><Switch checked={draft.motion.hoverMotion} onCheckedChange={(value) => updateNested("motion", { hoverMotion: value })} /></Field><Field label="Content reveal"><Switch checked={draft.motion.contentReveal} onCheckedChange={(value) => updateNested("motion", { contentReveal: value })} /></Field><Field label="Parallax"><Switch checked={draft.motion.parallax} onCheckedChange={(value) => updateNested("motion", { parallax: value })} /></Field><Field label="Glass shimmer"><Switch checked={draft.motion.glassShimmer} onCheckedChange={(value) => updateNested("motion", { glassShimmer: value })} /></Field><Field label="Background animation"><Switch checked={draft.motion.backgroundAnimation} onCheckedChange={(value) => updateNested("motion", { backgroundAnimation: value })} /></Field><Field label="Loading animation"><Switch checked={draft.motion.loadingAnimation} onCheckedChange={(value) => updateNested("motion", { loadingAnimation: value })} /></Field><Field label="Button hover glow"><Switch checked={draft.motion.buttonHoverGlow} onCheckedChange={(value) => updateNested("motion", { buttonHoverGlow: value })} /></Field></div>
        <div className="appearance-two"><Field label="Animation speed"><NativeSelect label="Animation speed" value={draft.motion.speed} onChange={(value) => updateNested("motion", { speed: value as ScholarAppearanceSettings["motion"]["speed"] })} options={[["faster","Faster"],["default","Default"],["slower","Slower"]]} /></Field><Field label="Pointer effect"><NativeSelect label="Pointer effect" value={draft.motion.pointer} onChange={(value) => updateNested("motion", { pointer: value as ScholarAppearanceSettings["motion"]["pointer"] })} options={[["off","Off"],["highlight","Highlight"],["glow","Glow"]]} /></Field><Field label="Visual performance"><NativeSelect label="Visual performance" value={draft.performance} onChange={(value) => updateCore("performance", value as ScholarAppearanceSettings["performance"])} options={[["automatic","Automatic"],["quality","Maximum quality"],["balanced","Balanced"],["battery","Battery saver"],["performance","Maximum performance"]]} /></Field></div>
      </ControlGroup>

      <ControlGroup id="appearance-reading" icon={<BookOpen />} title="Reading Appearance" description="Ebooks, notes, long AI answers, equations and code blocks." keywords="reading paper warm sepia dark oled font line spacing width alignment focus equation latex code theme line numbers wrap" query={query}>
        <Field label="Reading theme"><ChoiceRow label="Reading theme" value={draft.reading.theme} onChange={(value) => updateNested("reading", { theme: value as ScholarAppearanceSettings["reading"]["theme"] })} options={["match","paper","warm","sepia","dark","oled"]} /></Field>
        <div className="appearance-ranges"><RangeControl label="Reading font size" value={draft.reading.fontSize} min={13} max={26} suffix="px" onChange={(value) => updateNested("reading", { fontSize: value })} /><RangeControl label="Reading line height" value={draft.reading.lineHeight} min={1.2} max={2.2} step={0.05} onChange={(value) => updateNested("reading", { lineHeight: value })} /><RangeControl label="Paragraph spacing" value={draft.reading.paragraphSpacing} min={0.3} max={2} step={0.05} suffix="rem" onChange={(value) => updateNested("reading", { paragraphSpacing: value })} /><RangeControl label="Reading text width" value={draft.reading.width} min={45} max={100} suffix="ch" onChange={(value) => updateNested("reading", { width: value })} /><RangeControl label="Equation size" value={draft.reading.equationSize} min={80} max={145} suffix="%" onChange={(value) => updateNested("reading", { equationSize: value })} /><RangeControl label="Code font size" value={draft.reading.codeFontSize} min={11} max={22} suffix="px" onChange={(value) => updateNested("reading", { codeFontSize: value })} /><RangeControl label="Code line height" value={draft.reading.codeLineHeight} min={1.2} max={2} step={0.05} onChange={(value) => updateNested("reading", { codeLineHeight: value })} /></div>
        <div className="appearance-two"><Field label="Reading font"><NativeSelect label="Reading font" value={draft.reading.font} onChange={(value) => updateNested("reading", { font: value })} options={FONT_OPTIONS} /></Field><Field label="Text alignment"><NativeSelect label="Text alignment" value={draft.reading.alignment} onChange={(value) => updateNested("reading", { alignment: value as ScholarAppearanceSettings["reading"]["alignment"] })} options={[["left","Left"],["justify","Justified"]]} /></Field><Field label="Equation surface"><NativeSelect label="Equation surface" value={draft.reading.equationStyle} onChange={(value) => updateNested("reading", { equationStyle: value as ScholarAppearanceSettings["reading"]["equationStyle"] })} options={[["plain","Plain"],["soft","Soft"],["outlined","Outlined"],["glass","Glass"]]} /></Field><Field label="Code theme"><NativeSelect label="Code theme" value={draft.reading.codeTheme} onChange={(value) => updateNested("reading", { codeTheme: value as ScholarAppearanceSettings["reading"]["codeTheme"] })} options={[["scholar","Scholar"],["midnight","Midnight"],["paper","Paper"],["high-contrast","High contrast"]]} /></Field></div>
        <div className="appearance-switch-grid"><Field label="Focus reading mode"><Switch checked={draft.reading.focusMode} onCheckedChange={(value) => updateNested("reading", { focusMode: value })} /></Field><Field label="Equation scroll indicator"><Switch checked={draft.reading.equationScrollIndicator} onCheckedChange={(value) => updateNested("reading", { equationScrollIndicator: value })} /></Field><Field label="Code line numbers"><Switch checked={draft.reading.codeLineNumbers} onCheckedChange={(value) => updateNested("reading", { codeLineNumbers: value })} /></Field><Field label="Code word wrap"><Switch checked={draft.reading.codeWrap} onCheckedChange={(value) => updateNested("reading", { codeWrap: value })} /></Field><Field label="Highlight current line"><Switch checked={draft.reading.codeCurrentLine} onCheckedChange={(value) => updateNested("reading", { codeCurrentLine: value })} /></Field></div>
      </ControlGroup>

      <ControlGroup id="appearance-accessibility" icon={<Accessibility />} title="Accessibility" description="Contrast, transparency, motion, links, focus, touch and colour-vision support." keywords="accessibility high contrast reduce transparency motion text underline links focus touch color blind protanopia deuteranopia tritanopia grayscale" query={query}>
        <div className="appearance-switch-grid"><Field label="High contrast"><Switch checked={draft.accessibility.highContrast} onCheckedChange={(value) => updateNested("accessibility", { highContrast: value })} /></Field><Field label="Reduce transparency"><Switch checked={draft.accessibility.reduceTransparency} onCheckedChange={(value) => updateNested("accessibility", { reduceTransparency: value })} /></Field><Field label="Reduce motion"><Switch checked={draft.accessibility.reduceMotion} onCheckedChange={(value) => updateNested("accessibility", { reduceMotion: value })} /></Field><Field label="Increase text contrast"><Switch checked={draft.accessibility.increaseTextContrast} onCheckedChange={(value) => updateNested("accessibility", { increaseTextContrast: value })} /></Field><Field label="Underline links"><Switch checked={draft.accessibility.underlineLinks} onCheckedChange={(value) => updateNested("accessibility", { underlineLinks: value })} /></Field><Field label="Thicker focus"><Switch checked={draft.accessibility.thickFocus} onCheckedChange={(value) => updateNested("accessibility", { thickFocus: value })} /></Field><Field label="Larger touch targets"><Switch checked={draft.accessibility.largeTargets} onCheckedChange={(value) => updateNested("accessibility", { largeTargets: value })} /></Field><Field label="Avoid colour-only status"><Switch checked={draft.accessibility.avoidColorOnly} onCheckedChange={(value) => updateNested("accessibility", { avoidColorOnly: value })} /></Field></div>
        <Field label="Colour-vision support"><NativeSelect label="Colour-vision support" value={draft.accessibility.colorVision} onChange={(value) => updateNested("accessibility", { colorVision: value as ScholarAppearanceSettings["accessibility"]["colorVision"] })} options={[["default","Default"],["protanopia","Protanopia support"],["deuteranopia","Deuteranopia support"],["tritanopia","Tritanopia support"],["grayscale","Grayscale assistance"]]} /></Field>
      </ControlGroup>

      <ControlGroup id="appearance-pages" icon={<SlidersHorizontal />} title="Per-Page Appearance" description="Optional wallpaper overrides without changing approved defaults." keywords="per page dashboard files ebook notes ai tutor canvas slides quiz community settings override" query={query}>
        <div className="appearance-page-grid">{APPEARANCE_PAGES.map((page) => <Field key={page} label={PAGE_LABELS[page]}><NativeSelect label={`${PAGE_LABELS[page]} wallpaper`} value={draft.pageOverrides[page] ?? "global"} onChange={(value) => change((next) => ({ ...next, pageOverrides: { ...next.pageOverrides, [page]: value } }))} options={[["global","Use global wallpaper"],...WALLPAPER_OPTIONS]} /></Field>)}</div>
        <Button variant="outline" onClick={() => updateCore("pageOverrides", {})}>Reset all page overrides</Button>
      </ControlGroup>

      <ControlGroup id="appearance-profiles" icon={<Save />} title="Reset, Import & Export" description="Safe custom profiles, reversible resets and validated JSON." keywords="reset restore save custom theme profile duplicate rename delete import export json" query={query}>
        <div className="appearance-profile-actions"><Button onClick={saveProfile}><Save size={14} />Save current appearance</Button><Button variant="outline" onClick={exportAppearance}><Download size={14} />Export profile</Button><Button variant="outline" onClick={() => importRef.current?.click()}><Upload size={14} />Import profile</Button><Button variant="destructive" onClick={() => { if (window.confirm("Reset all appearance settings? Other Scholar preferences will not be changed.")) restoreDefault(); }}><RefreshCw size={14} />Reset all appearance</Button></div>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { importAppearance(event.target.files?.[0]); event.target.value = ""; }} />
        {draft.customProfiles.length ? <><div className="appearance-two"><Field label="Scheduled profile"><NativeSelect label="Scheduled appearance profile" value={draft.scheduledProfileId} onChange={(value) => updateCore("scheduledProfileId", value)} options={[["off","Off"], ...draft.customProfiles.map((profile) => [profile.id, profile.name] as const)]} /></Field><Field label="Apply daily at"><Input type="time" disabled={draft.scheduledProfileId === "off"} value={draft.scheduledProfileTime} onChange={(event) => updateCore("scheduledProfileTime", event.target.value)} /></Field></div><div className="appearance-saved-profiles">{draft.customProfiles.map((profile) => <div key={profile.id}><span><strong>{profile.name}{profile.isDefault ? " · Default" : ""}</strong><small>Updated {new Date(profile.updatedAt).toLocaleDateString()}</small></span><Button size="sm" variant="outline" onClick={() => setAppearance({ ...profile.config, customProfiles: draft.customProfiles, previousCustom: appearanceCore(draft) })}>Apply</Button><Button size="sm" variant="ghost" onClick={() => { const name = window.prompt("Rename appearance profile", profile.name)?.trim(); if (name) updateCore("customProfiles", draft.customProfiles.map((item) => item.id === profile.id ? { ...item, name: name.slice(0, 60), updatedAt: new Date().toISOString() } : item)); }}>Rename</Button><Button size="sm" variant="ghost" onClick={() => updateCore("customProfiles", draft.customProfiles.map((item) => ({ ...item, isDefault: item.id === profile.id })))}>Default</Button><Button size="icon" variant="ghost" aria-label={`Duplicate ${profile.name}`} onClick={() => { const now = new Date().toISOString(); const copy = { ...profile, id: crypto.randomUUID(), name: `${profile.name} Copy`, createdAt: now, updatedAt: now, isDefault: false }; setAppearance({ ...draft, customProfiles: [copy, ...draft.customProfiles] }); }}><Save size={14} /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${profile.name}`} onClick={() => setAppearance({ ...draft, scheduledProfileId: draft.scheduledProfileId === profile.id ? "off" : draft.scheduledProfileId, customProfiles: draft.customProfiles.filter((item) => item.id !== profile.id) })}><Trash2 size={14} /></Button></div>)}</div></> : <p className="appearance-empty">No custom appearance profiles yet.</p>}
      </ControlGroup>

      {!query || "focus exam scheduled rotate wallpaper".includes(query) ? <div className="appearance-mode-cards"><button type="button" data-selected={draft.focusAppearance} onClick={() => updateCore("focusAppearance", !draft.focusAppearance)}><Eye /><span><strong>Focus appearance</strong><small>Dim peripheral navigation and calm surfaces.</small></span></button><button type="button" data-selected={draft.examAppearance} onClick={() => updateCore("examAppearance", !draft.examAppearance)}><Gauge /><span><strong>Exam appearance</strong><small>Static, readable and distraction-reduced.</small></span></button><div><Field label="Rotate wallpapers"><NativeSelect label="Rotate wallpapers" value={draft.rotateWallpapers} onChange={(value) => updateCore("rotateWallpapers", value as ScholarAppearanceSettings["rotateWallpapers"])} options={[["off","Off"],["launch","Every launch"],["daily","Daily"],["weekly","Weekly"],["page","Each page"]]} /></Field></div></div> : null}
    </section>
  );
}
