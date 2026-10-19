// Verified 2026-10-12 through CBSE's current curriculum index. Metadata only:
// these links are NOT indexed teaching passages or redistributed textbooks.
export const officialCurriculumIndex = "https://cbseacademic.nic.in/curriculum_2027.html";
export const officialTextbookIndex = "https://ncert.nic.in/textbook.php";
const subjectSyllabi: Record<string, string> = {
    physics: "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Physics_SecP2_2026-27.pdf",
    chemistry: "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Chemistry_SecP2_2026-27.pdf",
    maths: "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Maths_SecP2_2026-27.pdf",
    cs: "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Computer_Science_SecP2_2026-27.pdf",
};
// Short original scope annotations, not copied lessons or official question keys.
const additions: Record<string, string[]> = {
    "11:physics:p5": ["Impulse and momentum change", "Equilibrium of concurrent forces", "Circular-road dynamics and banking"],
    "11:physics:p6": ["Work under a varying force", "Spring energy and conservative forces", "Energy conditions in a vertical circle", "Elastic and inelastic collision analysis"],
    "11:chemistry:c4": ["Bond parameters and polarity", "Molecular orbital occupancy, bond order and magnetic behaviour"],
    "11:chemistry:c7": ["Using reaction quotient to predict direction", "Gibbs energy and equilibrium", "Weak-acid and weak-base ionisation", "Buffer response and solubility equilibria"],
    "11:maths:m8": ["Pascal triangle and proof of the positive-integer expansion"],
};
const scopeWarnings: Record<string, string> = {
    "11:physics:p1": "This standalone chapter is not listed in the 2026–27 theory chapter table. Confirm your teacher's exam scope; do not assert a board weightage.",
    "11:chemistry:c5": "Gas-state material is listed for formative learning in 2026–27. Confirm whether your school examination includes it.",
    "11:chemistry:c10": "s-block material is formative in 2026–27, not a separate summative unit.",
    "11:chemistry:c11": "p-block material is formative in 2026–27, not a separate summative unit.",
    "11:chemistry:c9": "Not a separate unit in the current Class XI theory table; teacher-provided scope is required.",
    "11:chemistry:c14": "Not a separate unit in the current Class XI theory table; teacher-provided scope is required.",
    "11:maths:m4": "Induction is listed for formative learning in 2026–27. Confirm your school's assessment scope.",
    "11:maths:m14": "Not a separate unit in the current Class XI theory table. Confirm school scope.",
    "11:cs:cs13": "User-defined functions are listed in Class XII. Use only when your Class XI teacher explicitly assigns them.",
    "11:cs:cs14": "File handling is listed in Class XII. Use only when your Class XI teacher explicitly assigns it.",
};
export function sourceGuidance(grade: 9 | 11, subjectId: string, chapterId: string) {
    const key = `${grade}:${subjectId}:${chapterId}`;
    return { curriculumUrl: grade === 11 ? subjectSyllabi[subjectId] ?? officialCurriculumIndex : officialCurriculumIndex, textbookUrl: officialTextbookIndex, retrievedAt: "2026-10-12", availability: "LINK_ONLY" as const, licenseDecision: "No permission to redistribute assumed; metadata and original scope annotations only.", additionalObjectives: additions[key] ?? [], warning: scopeWarnings[key] ?? (grade === 9 ? "Scholar's legacy chapter registry needs alignment review against the revised 2026–27 Grade IX syllabus; confirm the selected school scope." : "Confirm the selected scope with your teacher; supplementary topics are not guaranteed exam questions.") };
}
