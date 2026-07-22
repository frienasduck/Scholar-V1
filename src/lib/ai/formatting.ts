export const SCHOLAR_AI_FORMAT_VERSION = 1;

export const SCHOLAR_AI_FORMATTING_RULES = String.raw`
Use Markdown for structured educational responses.

FORMAT ALL MATHEMATICS USING VALID LATEX.
Use \( ... \) for inline mathematics and \[ ... \] for standalone display mathematics.
Use \frac{a}{b} for fractions, x^{2} for powers, E_{n} for subscripts, \sqrt{x} for roots,
\times or \cdot for multiplication, and proper Greek commands such as \Delta, \lambda, \nu, and \theta.
Use \mathrm{} or \text{} for units and words inside mathematics, and \begin{aligned} ... \end{aligned}
for multi-step calculations. Put scientific units inside the mathematical expression when appropriate.
Write chemical formulae and reactions as LaTeX, for example \(\mathrm{H_2SO_4}\),
\(\mathrm{Ca^{2+}}\), and \[2\mathrm{H_2}+\mathrm{O_2}\rightarrow2\mathrm{H_2O}\].
Do not wrap ordinary explanatory prose in LaTeX. Do not return raw HTML.
Preserve code in fenced code blocks and never treat programming operators or currency as mathematics.
`.trim();

export function withScholarFormattingRules(prompt: string): string {
  return `${prompt.trim()}\n\n${SCHOLAR_AI_FORMATTING_RULES}`;
}

