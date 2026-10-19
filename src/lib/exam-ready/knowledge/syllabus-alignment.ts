/** Compared with the official 2026–27 Class XI theory tables on 2026-10-14.
 * Stable Scholar chapter/objective IDs are retained. Chapter-table matching is
 * NOT certification of every legacy objective inside that chapter.
 */
export function syllabusAlignment(grade: 9 | 11, subjectId: string, chapterId: string) {
  const docs: Record<string,string> = { physics:"Physics", chemistry:"Chemistry", maths:"Maths" };
  const url = docs[subjectId] && grade===11 ? `https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/${docs[subjectId]}_SecP2_2026-27.pdf` : "https://cbseacademic.nic.in/curriculum_2027.html";
  const formative = ["chemistry:c5","chemistry:c10","chemistry:c11","maths:m4"];
  const notListed = ["physics:p1","chemistry:c9","chemistry:c14","maths:m14"];
  const key=`${subjectId}:${chapterId}`;
  const status = grade!==11 || !docs[subjectId] ? "ALIGNMENT_PENDING" : formative.includes(key) ? "FORMATIVE_ONLY" : notListed.includes(key) ? "NOT_SEPARATE_THEORY_UNIT" : "THEORY_CHAPTER_MATCH";
  const extensions:Record<string,number[]> = {
    "physics:p7":[3,8], // axis-theorem detail not in the current theory topic list
    "physics:p12":[3,4,8,9], // Carnot/COP and detailed entropy treatment
    "physics:p15":[4], // Doppler extension
    "maths:m9":[0,5], // AP and special sums not in the current XI list
  };
  return { academicYear:"2026–27",checkedAt:"2026-10-14",status,url,
    objectiveReview:"PARTIAL: legacy concept/objective wording retained; not a complete textbook-deletion audit",
    extensionObjectiveIndexes:extensions[key]??[],
    warning:status==="THEORY_CHAPTER_MATCH"?"Chapter matches the official table; inspect objective annotations and textbook exclusions before claiming complete current-year alignment.":status==="FORMATIVE_ONLY"?"Listed for formative learning, not a separate summative chapter; confirm teacher-assigned examination scope.":status==="NOT_SEPARATE_THEORY_UNIT"?"Legacy standalone entry not in the current theory table; retained for saved-session compatibility, not asserted compulsory assessment.":"Current-year chapter/objective alignment is still pending for this curriculum." };
}
