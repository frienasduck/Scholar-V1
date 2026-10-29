"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight, BookOpen, Bookmark, CalendarDays, Check, CheckCheck,
  ChevronLeft, ChevronRight, FileText, FolderOpen, Globe2, Highlighter,
  Leaf, MessageCircle, PencilLine, ScanText, Search, Send, Users,
} from "lucide-react";
import { FeatureLink, GlassPanel, OrbitalArt, PreviewLabel, ShowcaseSection } from "./primitives";
import s from "./landing.module.css";
import k from "./knowledge.module.css";

const sampleResources = [
  { title: "The living cell", detail: "Scholar concept note · Biology", kind: "Scholar", icon: FileText },
  { title: "Energy in green leaves", detail: "Scholar reading sample · Biology", kind: "Scholar", icon: Leaf },
  { title: "Open textbook reading list", detail: "External reference · opens in the resource library", kind: "Reference", icon: Globe2 },
  { title: "Forces and free-body diagrams", detail: "Scholar concept note · Physics", kind: "Scholar", icon: BookOpen },
] as const;

function LeafDiagram({ compact = false }: { compact?: boolean }) {
  return (
    <svg viewBox="0 0 240 160" className={compact ? k.smallLeaf : k.leaf} role="img" aria-label="Illustration of a leaf with veins">
      <defs>
        <linearGradient id={compact ? "landing-leaf-small" : "landing-leaf"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#aebc72" /><stop offset="1" stopColor="#365148" />
        </linearGradient>
      </defs>
      <path d="M37 130C23 58 96 7 204 20C193 106 133 160 37 130Z" fill={`url(#${compact ? "landing-leaf-small" : "landing-leaf"})`} />
      <path d="M26 145L181 38M55 124L61 77M83 105L93 52M112 84L125 36M61 120L114 127M94 98L151 101M126 76L176 73" fill="none" stroke="#dbe4b0" strokeWidth="1.7" opacity=".66" />
      <text x="8" y="35" fill="currentColor" fontSize="11">light</text>
      <path d="M23 44L45 65M39 53L45 65L33 61" fill="none" stroke="currentColor" opacity=".65" />
    </svg>
  );
}

export function MaterialsShowcase() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All");
  const [extracted, setExtracted] = useState(false);
  const [resource, setResource] = useState<string | null>(null);
  const visible = sampleResources.filter((item) => (source === "All" || item.kind === source) && `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <ShowcaseSection id="materials" eyebrow="Materials & sources" title={<>Every resource.<br /><em>One learning space.</em></>} description="Bring your documents, study notes, and useful references closer to the ideas you are learning.">
      <div className={s.grid3}>
        <GlassPanel className={k.materialCard}>
          <div className={s.panelHeader}><span className={s.icon}><BookOpen size={22} /></span><span className={s.badge}>Read & study</span></div>
          <h3 className={s.featureTitle}>A little more clarity.</h3>
          <p className={s.muted}>A focused home for PDFs and the notes you want to keep beside them.</p>
          <div className={`${s.preview} ${k.documentPreview}`}>
            <div className={k.documentTop}><FileText size={14} /><span>Scholar field notes</span><span>01 / 03</span></div>
            <article className={k.materialPaper}>
              <span className={k.paperEyebrow}>BIOLOGY · A SCHOLAR SAMPLE</span>
              <h4>The living cell</h4>
              <p>Every cell is a small, organised system. Its membrane separates an inner environment from the world outside.</p>
              <p><mark>Structure helps a cell carry out its functions.</mark></p>
              <LeafDiagram compact />
            </article>
          </div>
          <FeatureLink href="/files">Explore your files</FeatureLink>
        </GlassPanel>

        <GlassPanel className={k.materialCard}>
          <div className={s.panelHeader}><span className={s.icon}><ScanText size={22} /></span><span className={s.badge}>Scans & notes</span></div>
          <h3 className={s.featureTitle}>Ideas, made readable.</h3>
          <p className={s.muted}>Inspect extracted text, check the source, and make it your own.</p>
          <div className={`${s.preview} ${k.scanPreview}`}>
            <div className={`${k.scanSheet} ${extracted ? k.scanSheetBack : ""}`}>
              <span>Photosynthesis</span>
              <LeafDiagram />
              <p>light + carbon dioxide + water</p>
              <p>↓ glucose + oxygen</p>
            </div>
            {extracted && <div className={k.extraction} aria-live="polite"><ScanText size={18} /><strong>Readable sample</strong><p>Plants use light energy to make carbohydrates from carbon dioxide and water.</p><small>Illustrative extraction. Review against the original.</small></div>}
          </div>
          <button type="button" className={s.button} aria-pressed={extracted} onClick={() => setExtracted(!extracted)}><ScanText size={16} />{extracted ? "View original sample" : "Inspect text sample"}</button>
        </GlassPanel>

        <GlassPanel className={k.materialCard}>
          <div className={s.panelHeader}><span className={s.icon}><FolderOpen size={22} /></span><span className={s.badge}>Find & organise</span></div>
          <h3 className={s.featureTitle}>Find the right next page.</h3>
          <p className={s.muted}>Keep authored learning material and external references clearly identified.</p>
          <div className={`${s.preview} ${k.resourcePreview}`}>
            <label className={k.searchField}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sample materials" aria-label="Search sample materials" /></label>
            <div className={s.tabs} aria-label="Sample material source">{["All", "Scholar", "Reference"].map((item) => <button type="button" key={item} className={source === item ? s.active : ""} aria-pressed={source === item} onClick={() => setSource(item)}>{item}</button>)}</div>
            <div className={k.resourceList} aria-live="polite">{visible.length ? visible.map((item) => <button type="button" className={`${k.resourceRow} ${resource === item.title ? k.resourceSelected : ""}`} key={item.title} onClick={() => setResource(item.title)}><item.icon size={19} /><span><strong>{item.title}</strong><small>{item.kind === "Reference" ? "External reference · not indexed" : "Scholar-written sample"}</small></span><ChevronRight size={16} /></button>) : <p className={s.muted}>No sample materials match. Try “cell” or choose All.</p>}</div>
            {resource && <p className={k.resourceDetail} role="status">Selected: {resource}. This preview uses public sample content.</p>}
          </div>
          <FeatureLink href="/exam-prep">Explore study materials</FeatureLink>
        </GlassPanel>
      </div>
      <PreviewLabel>Interactive samples · Scholar-written content · no uploads or AI requests</PreviewLabel>
    </ShowcaseSection>
  );
}

const roomTabs = ["Discussion", "Shared notes", "Resources"] as const;
type RoomTab = (typeof roomTabs)[number];
const openingMessages = [
  { name: "Mira", initials: "M", text: "Start with a free-body diagram. Which forces act on the book?" },
  { name: "Arun", initials: "A", text: "Weight acts downward. The table provides an upward normal force." },
  { name: "Jules", initials: "J", text: "They balance because the book has zero acceleration." },
];

export function GroupShowcase() {
  const [tab, setTab] = useState<RoomTab>("Discussion");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [notes, setNotes] = useState("A book rests on a horizontal table.\n\n• Weight = mg, downward\n• Normal reaction = N, upward\n• No vertical acceleration → N = mg\n\nThe forces act on the same book. They are not a Newton's third-law pair.");
  const [reveal, setReveal] = useState(false);
  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setMessages((previous) => [...previous.slice(-2), message.trim()]);
    setMessage("");
  };

  return (
    <ShowcaseSection id="group-study" eyebrow="Group study" title={<>Learn together.<br /><em>Keep your focus.</em></>} description="A shared place for discussion, study materials, room notes, and working through the difficult part together.">
      <GlassPanel className={k.room}>
        <div className={k.roomHeader}><span><Users size={18} /><strong>Class 11 · Physics</strong><span className={s.badge}>Sample room</span></span><div className={k.avatars} aria-label="Three illustrative participants"><i>M</i><i>A</i><i>J</i></div></div>
        <div className={k.roomGrid}>
          <div className={k.problem}>
            <span className={k.paperEyebrow}>THINK TOGETHER · LAWS OF MOTION</span>
            <h3>A book. A table.<br /><em>A useful question.</em></h3>
            <p>A book rests on a horizontal table. Its weight is 12 N. What is the normal force exerted by the table?</p>
            <div className={k.forceDiagram} role="img" aria-label="A book on a table, with an upward normal force and a downward weight"><span className={k.upForce}>↑ <small>N</small></span><span className={k.bookBlock}>BOOK</span><span className={k.tableLine} /><span className={k.downForce}>↓ <small>12 N</small></span></div>
            <button type="button" className={s.button} aria-expanded={reveal} onClick={() => setReveal(!reveal)}>{reveal ? "Hide reasoning" : "Compare your reasoning"}<ChevronRight size={16} /></button>
            {reveal && <p className={k.reasoning} role="status">The normal force is 12 N upward. With no vertical acceleration, the net vertical force is zero: N − 12 = 0.</p>}
          </div>
          <div className={k.roomSide}>
            <div className={s.tabs} aria-label="Sample study room view">{roomTabs.map((item) => <button type="button" key={item} className={tab === item ? s.active : ""} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
            {tab === "Discussion" && <div className={k.discussion}><div className={k.messageList}>{openingMessages.map((item) => <div className={k.message} key={item.name}><i>{item.initials}</i><div><strong>{item.name}<small>Sample participant</small></strong><p>{item.text}</p></div></div>)}{messages.map((item, index) => <div className={k.message} key={`${index}-${item}`}><i>You</i><div><strong>You<small>Local preview</small></strong><p>{item}</p></div></div>)}</div><form className={k.messageForm} onSubmit={sendMessage}><input aria-label="Write a local sample message" value={message} maxLength={240} onChange={(event) => setMessage(event.target.value)} placeholder="Try a sample message…" /><button type="submit" aria-label="Add message to local preview" disabled={!message.trim()}><Send size={17} /></button></form><small className={s.tiny}>Only added to this preview. No one receives a message.</small></div>}
            {tab === "Shared notes" && <div className={k.roomNotes}><label htmlFor="landing-room-notes">Try editing the sample room notes</label><textarea id="landing-room-notes" value={notes} maxLength={1800} onChange={(event) => setNotes(event.target.value)} /><span className={s.tiny}>Local preview · changes disappear on reload</span></div>}
            {tab === "Resources" && <div className={k.roomResources}><FileText size={26} /><h4>A common point of reference.</h4><p>Room members can study from shared materials. This sample uses an original Scholar question.</p><div className={s.tags}><span>Forces</span><span>Free-body diagrams</span><span>Class 11</span></div><FeatureLink href="/group-study">Explore Group Study</FeatureLink></div>}
          </div>
        </div>
      </GlassPanel>
      <div className={k.roomFeatures}><div><Users size={20} /><span><strong>Study rooms</strong><small>Join with a room code.</small></span></div><div><PencilLine size={20} /><span><strong>Shared thinking</strong><small>Notes and discussion in one place.</small></span></div><div><BookOpen size={20} /><span><strong>Common materials</strong><small>Keep the topic close to the conversation.</small></span></div></div>
      <div className={k.sectionFoot}><PreviewLabel>Interactive sample · illustrative participants · no live room connection</PreviewLabel><FeatureLink href="/group-study">Find your study group</FeatureLink></div>
      <p className={s.sampleCaption}>Group Study Beta · Plus hosting · invited guests can join with a room code.</p>
    </ShowcaseSection>
  );
}

const plannerDays = [
  { day: "Mon", date: 19, title: "Build understanding", tasks: [
    { id: "mon-1", time: "09:00", duration: "40 min", title: "Laws of Motion", kind: "Learn", color: "gold", detail: "Draw a free-body diagram before you write the equations." },
    { id: "mon-2", time: "10:00", duration: "25 min", title: "Practice with forces", kind: "Practice", color: "violet", detail: "Try three questions. Check the direction of each force." },
    { id: "mon-3", time: "16:00", duration: "15 min", title: "Recall without notes", kind: "Revision", color: "green", detail: "Explain Newton's laws from memory, then check your wording." },
  ] },
  { day: "Tue", date: 20, title: "Make the ideas connect", tasks: [
    { id: "tue-1", time: "09:30", duration: "35 min", title: "Energy & work", kind: "Learn", color: "gold", detail: "Connect force and displacement to the work done on a body." },
    { id: "tue-2", time: "14:00", duration: "25 min", title: "Mixed practice", kind: "Practice", color: "violet", detail: "Choose the useful principle before substituting numbers." },
    { id: "tue-3", time: "18:00", duration: "10 min", title: "Review one mistake", kind: "Revision", color: "green", detail: "Write why the mistake happened and one way to catch it." },
  ] },
  { day: "Wed", date: 21, title: "Strengthen and revisit", tasks: [
    { id: "wed-1", time: "10:00", duration: "30 min", title: "Motion in a plane", kind: "Learn", color: "gold", detail: "Resolve motion into independent horizontal and vertical components." },
    { id: "wed-2", time: "15:00", duration: "20 min", title: "Vector questions", kind: "Practice", color: "violet", detail: "Sketch each vector and choose a consistent sign convention." },
    { id: "wed-3", time: "18:30", duration: "15 min", title: "Formula recall", kind: "Revision", color: "green", detail: "Recall the formula, its units, and when it applies." },
  ] },
] as const;

export function PlannerShowcase() {
  const [dayIndex, setDayIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const day = plannerDays[dayIndex];
  const selectedTask = day.tasks[taskIndex];
  const chooseDay = (index: number) => { setDayIndex(index); setTaskIndex(0); };

  return (
    <ShowcaseSection id="planner" eyebrow="Planner & today" title={<>Turn ambition into<br /><em>a daily rhythm.</em></>} description="Give your next study session a place in the day. Balance learning, practice, and revisiting what matters.">
      <div className={k.plannerGrid}>
        <GlassPanel className={k.plannerMain}>
          <div className={s.panelHeader}><div className={k.titleIcon}><CalendarDays size={21} /><h3 className={s.featureTitle}>Your study plan</h3></div><span className={s.badge}>October 2026 · sample</span></div>
          <div className={k.weekNav}><button type="button" className={s.button} disabled={dayIndex === 0} aria-label="Previous sample day" onClick={() => chooseDay(dayIndex - 1)}><ChevronLeft size={17} /></button><div className={k.days}>{plannerDays.map((item, index) => <button type="button" key={item.date} aria-pressed={index === dayIndex} className={index === dayIndex ? k.selectedDay : ""} onClick={() => chooseDay(index)}><span>{item.day}</span><strong>{item.date}</strong></button>)}</div><button type="button" className={s.button} disabled={dayIndex === plannerDays.length - 1} aria-label="Next sample day" onClick={() => chooseDay(dayIndex + 1)}><ChevronRight size={17} /></button></div>
          <div className={k.schedule}>{day.tasks.map((item, index) => <div className={k.scheduleRow} key={item.id}><time>{item.time}</time><button type="button" className={`${k.studyBlock} ${k[item.color]} ${taskIndex === index ? k.studyBlockActive : ""}`} aria-pressed={taskIndex === index} onClick={() => setTaskIndex(index)}><span><strong>{item.title}</strong><small>{item.kind} · {item.duration}</small></span>{completed.includes(item.id) ? <CheckCheck size={19} /> : <ArrowRight size={18} />}</button></div>)}</div>
          <div className={k.planMotto}><span /><p>Make room for progress.<br /><em>Leave room to breathe.</em></p><OrbitalArt variant="quiet" className={k.plannerOrbit} /></div>
        </GlassPanel>
        <div className={k.plannerAside}>
          <GlassPanel className={k.agendaCard}>
            <span className={k.paperEyebrow}>{day.day.toUpperCase()} {day.date} OCT · SAMPLE AGENDA</span><h3 className={s.featureTitle}>{day.title}</h3>
            <div className={k.agendaList}>{day.tasks.map((item, index) => <button type="button" key={item.id} className={taskIndex === index ? k.agendaSelected : ""} onClick={() => setTaskIndex(index)} aria-pressed={taskIndex === index}><span className={completed.includes(item.id) ? k.doneDot : k.emptyDot}>{completed.includes(item.id) && <Check size={12} />}</span><span><strong>{item.title}</strong><small>{item.time} · {item.duration}</small></span></button>)}</div>
          </GlassPanel>
          <GlassPanel className={k.taskDetail}>
            <span className={s.badge}>{selectedTask.kind} · selected activity</span><h3>{selectedTask.title}</h3><p>{selectedTask.detail}</p><button type="button" className={s.button} aria-pressed={completed.includes(selectedTask.id)} onClick={() => setCompleted((previous) => previous.includes(selectedTask.id) ? previous.filter((id) => id !== selectedTask.id) : [...previous, selectedTask.id])}><Check size={16} />{completed.includes(selectedTask.id) ? "Undo sample completion" : "Mark sample complete"}</button><small className={s.tiny}>This changes the demonstration only.</small>
          </GlassPanel>
        </div>
      </div>
      <div className={k.sectionFoot}><PreviewLabel>Interactive sample schedule · no tasks added to your planner</PreviewLabel><FeatureLink href="/planner">Make a plan of your own</FeatureLink></div>
    </ShowcaseSection>
  );
}

const readerPages = [
  { title: "A small world, well organised", chapter: "01 · THE LIVING CELL", body: "A cell is the basic structural and functional unit of living organisms. It is bounded by a membrane that helps regulate exchange with its surroundings.", passage: "The organisation of a cell allows many processes to happen together, each contributing to the life of the whole.", end: "When we study a structure, a useful next question is: what does this structure help the cell do?" },
  { title: "Light becomes a starting point", chapter: "02 · PHOTOSYNTHESIS", body: "In photosynthesis, green plants use light energy to produce carbohydrates from carbon dioxide and water. Chlorophyll helps capture the energy required for this process.", passage: "Light supplies energy; it is not a material reactant that adds atoms to the glucose molecule.", end: "The oxygen released during photosynthesis comes from water. The balanced overall equation is a helpful summary, rather than a map of every reaction step." },
  { title: "From an idea to a question", chapter: "03 · ACTIVE READING", body: "Reading becomes more useful when we pause to explain an idea in our own words. A short question can reveal whether a paragraph has become an understanding.", passage: "Close the page for a moment. Can you explain the central idea without copying the sentence you just read?", end: "Return to the passage, compare your explanation, and note one point you would like to clarify. That question is a good place to continue learning." },
] as const;
type ReaderTool = "Highlights" | "Bookmarks" | "Notes";

export function ReadingShowcase() {
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<ReaderTool>("Highlights");
  const [highlights, setHighlights] = useState<number[]>([0]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [noteKept, setNoteKept] = useState(false);
  const page = readerPages[pageIndex];
  const toggleHighlight = () => { setTool("Highlights"); setHighlights((previous) => previous.includes(pageIndex) ? previous.filter((item) => item !== pageIndex) : [...previous, pageIndex]); };
  const toggleBookmark = () => { setTool("Bookmarks"); setBookmarks((previous) => previous.includes(pageIndex) ? previous.filter((item) => item !== pageIndex) : [...previous, pageIndex]); };

  return (
    <ShowcaseSection id="reading" eyebrow="E-books & reading" title={<>Read with attention.<br /><em>Keep the thought.</em></>} description="A calmer space for the page, the question in the margin, and the idea you want to return to.">
      <div className={k.readingComposition}>
        <aside className={k.readerTools}><div><Highlighter size={22} /><h3>Make it stand out.</h3><p>Try a sample highlight, then return to the passage.</p></div><div><Bookmark size={22} /><h3>Keep your place.</h3><p>Jump back to a bookmarked sample page.</p></div></aside>
        <GlassPanel className={k.reader}>
          <div className={k.readerToolbar}><span><BookOpen size={17} /><strong>Scholar reading notes</strong></span><div><button type="button" aria-label={highlights.includes(pageIndex) ? "Remove sample highlight" : "Highlight sample passage"} aria-pressed={highlights.includes(pageIndex)} className={highlights.includes(pageIndex) ? k.toolActive : ""} onClick={toggleHighlight}><Highlighter size={17} /></button><button type="button" aria-label={bookmarks.includes(pageIndex) ? "Remove sample bookmark" : "Bookmark sample page"} aria-pressed={bookmarks.includes(pageIndex)} className={bookmarks.includes(pageIndex) ? k.toolActive : ""} onClick={toggleBookmark}><Bookmark size={17} /></button></div></div>
          <div className={k.readerGrid}>
            <article className={k.readingPaper} key={pageIndex}><span className={k.paperEyebrow}>{page.chapter}</span><h3>{page.title}</h3><p>{page.body}</p><p><mark className={highlights.includes(pageIndex) ? k.highlighted : ""}>{page.passage}</mark></p><p>{page.end}</p><span className={k.paperFolio}>SCHOLAR · ORIGINAL READING SAMPLE</span></article>
            <aside className={k.annotation}>
              <div className={s.tabs} aria-label="Sample reader tools">{(["Highlights", "Bookmarks", "Notes"] as const).map((item) => <button type="button" key={item} className={tool === item ? s.active : ""} aria-pressed={tool === item} onClick={() => setTool(item)}>{item}</button>)}</div>
              {tool === "Highlights" && <div className={k.annotationsList}><span className={k.paperEyebrow}>YOUR SAMPLE HIGHLIGHTS</span>{highlights.length ? highlights.map((index) => <button type="button" key={index} onClick={() => setPageIndex(index)}><span className={k.highlightDot} /><p>{readerPages[index].passage}</p><small>Page {index + 1}</small></button>) : <p className={s.muted}>Use the highlighter above to mark this page’s key passage.</p>}</div>}
              {tool === "Bookmarks" && <div className={k.annotationsList}><span className={k.paperEyebrow}>YOUR SAMPLE BOOKMARKS</span>{bookmarks.length ? bookmarks.map((index) => <button type="button" key={index} onClick={() => setPageIndex(index)}><Bookmark size={15} /><p>{readerPages[index].title}</p><small>Page {index + 1}</small></button>) : <p className={s.muted}>Keep a page using the bookmark button above.</p>}</div>}
              {tool === "Notes" && <div className={k.readerNote}><label htmlFor="landing-reader-note">A thought for the margin</label><textarea id="landing-reader-note" placeholder="What would you like to remember?" value={note} maxLength={700} onChange={(event) => { setNote(event.target.value); setNoteKept(false); }} /><button type="button" className={s.button} disabled={!note.trim()} onClick={() => setNoteKept(true)}><PencilLine size={15} />Keep sample note</button><small role="status">{noteKept ? "Note kept in this preview only." : "Your sample note stays on this page until reload."}</small></div>}
            </aside>
          </div>
          <div className={k.readerPagination}><button type="button" className={s.button} disabled={pageIndex === 0} aria-label="Previous sample reading page" onClick={() => setPageIndex(pageIndex - 1)}><ChevronLeft size={16} />Previous</button><span aria-live="polite">{pageIndex + 1} / {readerPages.length}</span><button type="button" className={s.button} disabled={pageIndex === readerPages.length - 1} aria-label="Next sample reading page" onClick={() => setPageIndex(pageIndex + 1)}>Next<ChevronRight size={16} /></button></div>
        </GlassPanel>
      </div>
      <div className={k.readingFooter}><span><MessageCircle size={18} />Reader notes, page bookmarks, and OCR tools for scanned pages. Extracted text can need review.</span><FeatureLink href="/ebook">Open the library</FeatureLink></div>
      <PreviewLabel>Interactive reading sample · annotations stay in this preview · no private documents</PreviewLabel>
    </ShowcaseSection>
  );
}
