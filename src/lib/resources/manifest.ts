import { CURRICULUM_CLASS11 } from "@/lib/curriculum-class11";
import { contentHash, licensePolicy, validateMapping } from "./engine";
import type { ResourceRecord } from "./types";

const mapping = (subjectId: string, chapterId = "") => validateMapping({ curriculumId: "cbse", grade: 11, subjectId, chapterId });
function source(title: string, url: string, subjectId: string, chapterIds: string[], type: string, publisher: string, license = "LINK_ONLY"): ResourceRecord {
  return {
    id: `builtin-${contentHash(url).slice(0, 20)}`, title, description: `${publisher} ${type.replace(/-/g, " ")} · ${title}. Open the original source for complete material.`,
    resourceType: type, sourceType: "curated", canonicalUrl: url, publisher, language: "en", licenseType: license,
    licenseUrl: license === "CC-BY-SA-4.0" ? "https://creativecommons.org/licenses/by-sa/4.0/" : null,
    attributionText: license === "CC-BY-SA-4.0" ? `${title} by Wikibooks contributors. Text licensed CC BY-SA 4.0. Source/history linked; Scholar formatting and derived aids are adaptations under the same license.` : `${title} — ${publisher}. Copyright belongs to its publisher; Scholar links to the original and does not reproduce it.`,
    ...licensePolicy(license, "GLOBAL"), visibility: "GLOBAL", ownerUserId: null, state: "DISCOVERED", qualityStatus: publisher === "NCERT" || publisher === "CBSE Academic" ? "verified-official" : "supplemental", mappings: chapterIds.map(id => mapping(subjectId, id)),
    sourceMetadata: { review: "Curated for Scholar's existing Class 11 chapter taxonomy; verify against your school's current syllabus." },
  };
}
// Explicit textbook mappings: Scholar preserves older chapter IDs, whereas
// rationalised NCERT textbooks have different numbering. Never infer file numbers.
const TEXTBOOKS: [string, string, string][] = [
  ["p2", "physics", "keph101"], ["p3", "physics", "keph102"], ["p4", "physics", "keph103"], ["p5", "physics", "keph104"], ["p6", "physics", "keph105"], ["p7", "physics", "keph106"], ["p8", "physics", "keph107"],
  ["p9", "physics", "keph201"], ["p10", "physics", "keph202"], ["p11", "physics", "keph203"], ["p12", "physics", "keph204"], ["p13", "physics", "keph205"], ["p14", "physics", "keph206"], ["p15", "physics", "keph207"],
  ["c1", "chemistry", "kech101"], ["c2", "chemistry", "kech102"], ["c3", "chemistry", "kech103"], ["c4", "chemistry", "kech104"], ["c6", "chemistry", "kech105"], ["c7", "chemistry", "kech106"], ["c8", "chemistry", "kech201"], ["c12", "chemistry", "kech202"], ["c13", "chemistry", "kech203"],
  ["m1", "maths", "kemh101"], ["m2", "maths", "kemh102"], ["m3", "maths", "kemh103"], ["m5", "maths", "kemh104"], ["m6", "maths", "kemh105"], ["m7", "maths", "kemh106"], ["m8", "maths", "kemh107"], ["m9", "maths", "kemh108"], ["m10", "maths", "kemh109"], ["m11", "maths", "kemh110"], ["m12", "maths", "kemh111"], ["m13", "maths", "kemh112"], ["m15", "maths", "kemh113"], ["m16", "maths", "kemh114"],
];
const WIKIBOOKS: [string, string[], string][] = [
  ["physics", ["p2"], "Physics_Study_Guide/Basic_Units"], ["physics", ["p3", "p4"], "Physics_Study_Guide/Linear_Motion"], ["physics", ["p5"], "Physics_Study_Guide/Force"], ["physics", ["p5"], "Physics_Study_Guide/Normal_Force_and_Friction"], ["physics", ["p5", "p7"], "Physics_Study_Guide/Momentum"], ["physics", ["p6"], "Physics_Study_Guide/Work"], ["physics", ["p6"], "Physics_Study_Guide/Energy"], ["physics", ["p8"], "Physics_Study_Guide/Gravity"], ["physics", ["p7"], "Physics_Study_Guide/Torque"], ["physics", ["p14"], "Physics_Study_Guide/Periodic_Motion"], ["physics", ["p15"], "Physics_Study_Guide/Waves"], ["physics", ["p10"], "Physics_Study_Guide/Fluids"], ["physics", ["p12"], "Physics_Study_Guide/Thermodynamics"],
  ["chemistry", ["c1"], "General_Chemistry/Stoichiometry"], ["chemistry", ["c1"], "General_Chemistry/Limiting_Reactants_and_Percent_Yield"], ["chemistry", ["c2"], "General_Chemistry/Atomic_Structure/History_of_Atomic_Structure"], ["chemistry", ["c4"], "General_Chemistry/Overview_of_bonding"], ["chemistry", ["c8"], "General_Chemistry/Redox_Reactions/Oxidation_and_Reduction_equations"], ["chemistry", ["c7"], "General_Chemistry/Chemical_Equilibria/Equilibrium"], ["chemistry", ["c5"], "General_Chemistry/Gas_Laws"],
  ["maths", ["m6"], "Algebra/Chapter_4"], ["maths", ["m5"], "Algebra/Chapter_9"], ["maths", ["m3"], "Algebra/Chapter_14"], ["maths", ["m9"], "Algebra/Chapter_15"], ["maths", ["m7", "m16"], "Algebra/Chapter_16"], ["maths", ["m11"], "Algebra/Chapter_17"], ["maths", ["m5"], "Algebra/Chapter_20"], ["maths", ["m13"], "Algebra/Chapter_24"],
];
export function manifest(): ResourceRecord[] {
  const records = TEXTBOOKS.map(([chapterId, subjectId, code]) => {
    const title = CURRICULUM_CLASS11.find(s => s.id === subjectId)!.chapters.find(c => c.id === chapterId)!.title;
    return source(`${title} — NCERT textbook`, `https://ncert.nic.in/textbook/pdf/${code}.pdf`, subjectId, [chapterId], "textbook", "NCERT");
  });
  for (const subject of CURRICULUM_CLASS11.filter(s => ["physics", "chemistry", "maths"].includes(s.id))) {
    const code = { physics: "keep3", chemistry: "keep5", maths: "keep2" }[subject.id as "physics"];
    const folder = subject.id === "maths" ? "mathematics" : subject.id;
    for (const chapter of subject.chapters) {
      const number = chapter.id.replace(/\D/g, "").padStart(2, "0");
      records.push(source(`${chapter.title} — NCERT Exemplar`, `https://ncert.nic.in/pdf/publication/exemplarproblem/classXI/${folder}/${code}${number}.pdf`, subject.id, [chapter.id], "question-bank", "NCERT"));
    }
  }
  for (const [subject, ids, path] of WIKIBOOKS) records.push(source(path.replace(/_/g, " ").replace(/\//g, " · "), `https://en.wikibooks.org/wiki/${path}`, subject, ids, "notes", "Wikibooks contributors", "CC-BY-SA-4.0"));
  for (const [path, title, ids] of [
    ["week-1-kinematics", "Kinematics", ["p3", "p4"]], ["week-2-newtons-laws", "Newton's laws", ["p5"]], ["week-3-circular-motion", "Circular motion", ["p4", "p5"]],
    ["week-5-momentum-and-impulse", "Momentum and impulse", ["p5", "p7"]], ["week-7-kinetic-energy-and-work", "Kinetic energy and work", ["p6"]], ["week-8-potential-energy-and-energy-conservation", "Energy conservation", ["p6"]],
    ["week-10-rotational-motion", "Rotational motion", ["p7"]], ["week-11-angular-momentum", "Angular momentum", ["p7"]],
  ] as [string, string, string[]][]) {
    const entry = source(`${title} — lecture videos and worked examples`, `https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/pages/${path}/`, "physics", ids, "video", "MIT OpenCourseWare");
    entry.licenseType = "CC-BY-NC-SA · LINK_ONLY"; entry.licenseUrl = "https://ocw.mit.edu/pages/privacy-and-terms-of-use/"; entry.qualityStatus = "trusted";
    entry.description = "MIT 8.01SC teaching materials. Undergraduate supplemental explanation, not a CBSE paper. Watch at the original source; no transcript or media copy is claimed.";
    records.push(entry);
  }
  for (const [subject, name] of [["physics", "Physics"], ["chemistry", "Chemistry"], ["maths", "Maths"]]) records.push(source(`${name} — CBSE 2026–27 syllabus`, `https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/${name}_SecP2_2026-27.pdf`, subject, [""], "syllabus", "CBSE Academic"));
  for (const [id, subject, chapters] of [["forces-and-motion-basics", "physics", ["p5"]], ["energy-skate-park-basics", "physics", ["p6"]], ["gravity-force-lab-basics", "physics", ["p8"]], ["molecule-shapes", "chemistry", ["c4"]], ["balancing-chemical-equations", "chemistry", ["c1"]]] as [string, string, string[]][]) records.push(source(id.replace(/-/g, " "), `https://phet.colorado.edu/en/simulations/${id}`, subject, chapters, "simulation", "PhET · University of Colorado Boulder"));
  return records;
}
