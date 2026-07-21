import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  EBOOK_SLIDESHOW_SOURCES,
  extractEbookPages,
  analyseSourcePages,
  recommendSlideCounts,
  allocateSlides,
  makeCoverageLedger,
  validateCoverage,
  normalizeSlideshowIntent,
  containsInstructionLeakage,
  finalizeSlides,
  isValidFormula,
  validateSlideFit,
  assessSlideshowQuality,
  repairSlideQuality,
} from "../src/lib/slideshow-pipeline";
import { newSlide, type SlideshowGenerationSettings } from "../src/lib/slideshow";
import { estimateNarrationDuration, validateNarrationResponse } from "../src/lib/narration";

const settings = (slideCount: number): SlideshowGenerationSettings => ({
  slideCount,
  density: "detailed",
  audience: "class-11",
  studyMode: "deep-study",
  includeDiagrams: true,
  includeExamples: true,
  includeSpeakerNotes: true,
  includeSummary: true,
  includeQuiz: true,
  includeSourceReferences: true,
});

function structureOfAtomSource() {
  const definition = EBOOK_SLIDESHOW_SOURCES.find((book) => book.id === "class11-chemistry-part1")!;
  const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public/content/ebooks/class11-chemistry-part1/book-v1.json"), "utf8"));
  return extractEbookPages({ definition, pageCount: 80, raw }, 38, 80, "structure-of-atom");
}

test("normalizes the Chemistry request without leaking the command", () => {
  const intent = normalizeSlideshowIntent({
    userInstruction: "Create a presentation on Class 11 Chemistry — Chapter: Structure of Atom",
    subject: "Chemistry",
    classLevel: "Class 11",
    chapter: "Structure of Atom",
  });
  expect(intent.title).toBe("Structure of Atom");
  expect(intent.subtitle).toBe("Class 11 Chemistry");
  expect(containsInstructionLeakage(intent.title)).toBeFalsy();
  const inferred = normalizeSlideshowIntent({ userInstruction: "Create a presentation on Class 11 Chemistry — Structure of Atom" });
  expect(inferred.title).toBe("Structure of Atom");
});

test("loads the complete clean chapter and plans detailed and compressed decks across both ends", () => {
  const pages = structureOfAtomSource();
  expect(pages[0].pageNumber).toBe(38);
  expect(pages.at(-1)?.pageNumber).toBe(80);
  const outline = analyseSourcePages(pages);
  expect(outline.length).toBeGreaterThan(20);
  const range = recommendSlideCounts(outline).detailed;
  expect(range.min).toBeGreaterThanOrEqual(25);
  expect(range.max).toBeLessThanOrEqual(45);

  const intent = normalizeSlideshowIntent({ subject: "Chemistry", classLevel: "Class 11", chapter: "Structure of Atom" });
  const detailed = allocateSlides(outline, settings(Math.round((range.min + range.max) / 2)), intent);
  expect(detailed.length).toBeGreaterThanOrEqual(25);
  const compressed = allocateSlides(outline, settings(5), intent);
  expect(compressed).toHaveLength(5);
  const mapped = new Set(compressed.flatMap((plan) => plan.sourcePages));
  expect(mapped.has(38)).toBeTruthy();
  expect(mapped.has(80)).toBeTruthy();
});

test("repairs instruction leakage, invalid formulas, duplicate titles, and visual overflow", () => {
  const slides = finalizeSlides([
    newSlide("title", { title: "Create a presentation on Structure of Atom", content: "Class 11 Chemistry", speakerNotes: "" }),
    newSlide("formula", { title: "Create a presentation on Atomic Models", content: "Create a presentation on this important chapter. ".repeat(20), bullets: Array(9).fill("This bullet is intentionally far too long and repeats generic presentation content without a useful visual hierarchy."), formula: "Create a presentation on Class 11 Chemistry", speakerNotes: "Create a presentation on this topic", sourcePages: [38], topicIds: ["start"] }),
    newSlide("concept", { title: "Atomic Models", content: "Rutherford used scattering evidence to infer a concentrated nucleus.", bullets: ["Most alpha particles passed through the foil."], speakerNotes: "", sourcePages: [50], topicIds: ["middle"] }),
  ], normalizeSlideshowIntent({ subject: "Chemistry", classLevel: "Class 11", chapter: "Structure of Atom" }));
  expect(slides[0].title).toBe("Structure of Atom");
  expect(slides[1].type).toBe("concept");
  expect(slides.every((slide) => !containsInstructionLeakage([slide.title, slide.content, slide.formula, slide.speakerNotes].join(" ")))).toBeTruthy();
  expect(slides.every((slide) => validateSlideFit(slide).fits)).toBeTruthy();
  expect(new Set(slides.map((slide) => slide.title.toLowerCase())).size).toBe(slides.length);
  expect(isValidFormula("Eₙ = −13.6 / n² eV")).toBeTruthy();
  expect(isValidFormula("Key concepts include atomic structure")).toBeFalsy();
});

test("coverage is weighted and cannot claim 100% when the final source is missing", () => {
  const outline = analyseSourcePages(structureOfAtomSource());
  const plans = allocateSlides(outline, settings(28), normalizeSlideshowIntent({ chapter: "Structure of Atom" }));
  const ledger = makeCoverageLedger(outline, plans);
  const onlyBeginning = [newSlide("concept", { title: "Beginning", content: "Discovery of subatomic particles", speakerNotes: "", sourcePages: [38], topicIds: [outline[0].id] })];
  const checked = validateCoverage(onlyBeginning, ledger, outline.flatMap((item) => item.sourcePages));
  expect(checked.report.percentage).toBeLessThan(100);
  expect(checked.report.missingPages).toContain(80);
});

test("quality and narration use independent, script-based validation", () => {
  const slide = newSlide("concept", { title: "Rutherford’s Nuclear Model", content: "Most of the atom is empty space, with positive charge concentrated in a small nucleus.", bullets: ["Scattering revealed the nucleus.", "The model could not explain atomic stability."], speakerNotes: "Connect the evidence to the model and then introduce its limitation.", sourcePages: [52], topicIds: ["rutherford"] });
  const quality = assessSlideshowQuality([slide], 100);
  expect(quality.overflowCount).toBe(0);
  const slideshow: any = { id: "s", title: "Structure of Atom", subject: "Chemistry", chapter: "Structure of Atom", language: "English", slides: [slide] };
  const script = "Rutherford interpreted the scattering pattern as evidence for a tiny, dense centre. This changed the picture of matter, although it still left atomic stability unexplained.";
  const narration = validateNarrationResponse({ narrations: [{ slideId: slide.id, script, caption: "Scattering revealed a dense nucleus", durationSec: 2 }] }, slideshow)!;
  expect(narration[0].script).not.toContain(slide.title);
  expect(narration[0].durationSec).toBe(estimateNarrationDuration(script, "concept"));
});

test("pages 40–45 do not create repeated Page 44 slides or OCR answer formulas", () => {
  const definition = EBOOK_SLIDESHOW_SOURCES.find((book) => book.id === "class11-chemistry-part1")!;
  const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public/content/ebooks/class11-chemistry-part1/book-v1.json"), "utf8"));
  const pages = extractEbookPages({ definition, pageCount: 80, raw }, 40, 45, "structure-of-atom");
  const outline = analyseSourcePages(pages);
  expect(outline.length).toBeGreaterThan(6);
  expect(outline.every((item) => !/keep it in mind|page\s*\d+\s*—\s*page/i.test(item.title))).toBeTruthy();
  expect(outline.flatMap((item) => item.formulas).every((formula) => !/^Answer\s*:/i.test(formula))).toBeTruthy();
  const plans = allocateSlides(outline, settings(27), normalizeSlideshowIntent({ subject: "Chemistry", classLevel: "Class 11", chapter: "Structure of Atom" }));
  expect(plans.length).toBeLessThanOrEqual(outline.length + 3);
  const repaired = repairSlideQuality([
    newSlide("concept", { title: "Structure of Atom — Page 44 — Page 44 — Page 44", content: "The Thomson model explained electrical neutrality.", bullets: ["Positive charge was spread through the atom."], speakerNotes: "", sourcePages: [44], topicIds: ["p44"] }),
    newSlide("concept", { title: "Structure of Atom — Page 44", content: "The Thomson model explained electrical neutrality.", bullets: ["Positive charge was spread through the atom."], speakerNotes: "", sourcePages: [44], topicIds: ["p44"] }),
  ]);
  expect(repaired).toHaveLength(1);
  expect(repaired[0].title).toBe("Structure of Atom — Page 44");
});
