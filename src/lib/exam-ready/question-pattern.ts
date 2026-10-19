/** Client-safe pattern key. Number changes alone are not a new transfer task. */
export function questionPattern(question:string) {
  return question.normalize("NFKC").toLowerCase().replace(/[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,"#").replace(/\s+/g," ").trim();
}
