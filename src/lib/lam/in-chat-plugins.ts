import type { LamPlugin } from "@/lib/lam/plugin-registry";
import type { LamPluginExecution } from "@/lib/lam/types";

export function resolvePluginOutputType(pluginId: string): LamPluginExecution["outputType"] {
  if (pluginId.includes("quiz")) return "quiz";
  if (pluginId.includes("flashcard")) return "flashcards";
  if (pluginId.includes("slideshow")) return "slideshow";
  if (pluginId.includes("formula")) return "formula-sheet";
  if (pluginId.includes("pdf") || pluginId.includes("summarizer")) return "pdf";
  if (pluginId.includes("explainer") || pluginId.includes("coach") || pluginId.includes("concept")) return "explainer";
  return "generic";
}

export function generatePluginPayload(
  plugin: LamPlugin,
  prompt: string,
  subject: string,
  chapter: string,
  grade: number
): { content: string; execution: LamPluginExecution } {
  const cleanPrompt = prompt.trim();
  const topic = cleanPrompt || `${chapter || subject} — Core Syllabus Principles`;
  const pId = plugin.id;

  if (pId === "flashcard-maker" || pId === "flashcards" || pId.includes("flashcard")) {
    return {
      content: `I've prepared **${plugin.name}** active recall cards for **${topic}**. Review each card and click to flip!`,
      execution: {
        pluginId: plugin.id,
        pluginName: plugin.name,
        category: plugin.category,
        status: "ready",
        outputType: "flashcards",
        flashcards: [
          {
            front: `What is the core law/principle governing ${topic}?`,
            back: `It states that the rate of change or system equilibrium is directly proportional to the applied gradient or force, maintaining conservation of total energy.`,
            tip: "High-yield 2-mark question in CBSE board examinations."
          },
          {
            front: `What are the standard SI units and dimensional formula for this quantity?`,
            back: `SI units follow the MKS system. Always verify dimensional consistency using fundamental dimensions [M^a L^b T^c].`,
            tip: "Check unit conversions between CGS and SI carefully."
          },
          {
            front: `What is the primary condition or limitation where this principle applies?`,
            back: `Valid under ideal conditions (e.g. constant temperature, ohmic resistance, or negligible non-conservative friction).`,
            tip: "Mentioning boundary conditions is mandatory for full marks in CBSE."
          },
          {
            front: `How is this concept applied in practical numerical problems?`,
            back: `State given variables, write the governing formula explicitly before substituting values, and include proper units in the final result.`,
            tip: "Marks are deducted if units are omitted in the final answer."
          }
        ]
      }
    };
  }

  if (pId === "notes-to-quiz" || pId === "quiz-generator" || pId.includes("quiz")) {
    return {
      content: `Here is a targeted 3-question diagnostic quiz on **${topic}**. Click an option to check your knowledge with instant feedback!`,
      execution: {
        pluginId: plugin.id,
        pluginName: plugin.name,
        category: plugin.category,
        status: "ready",
        outputType: "quiz",
        quiz: [
          {
            question: `Which of the following statements is mathematically and conceptually TRUE regarding ${topic}?`,
            options: [
              `The magnitude is directly proportional to the square of the fundamental variable`,
              `It acts inversely with temperature under standard ambient conditions`,
              `The total quantity remains strictly conserved in any isolated closed system`,
              `It is independent of the surrounding dielectric medium or resistance`
            ],
            answer: `The total quantity remains strictly conserved in any isolated closed system`,
            explanation: `Conservation laws form the axiomatic foundation in physics and chemistry. The system remains invariant under transformation unless external work is done.`
          },
          {
            question: `In a standard CBSE exam numerical on ${topic}, if the initial magnitude is doubled, what happens to the resultant outcome?`,
            options: [
              `It decreases by half`,
              `It increases by a factor of 4`,
              `It doubles proportionally`,
              `It remains invariant`
            ],
            answer: `It doubles proportionally`,
            explanation: `According to the linear constitutive relation, direct proportionality means doubling the input doubles the output response.`
          },
          {
            question: `What is the primary source of error or limitation when verifying ${topic} experimentally?`,
            options: [
              `Thermal dissipation and internal resistance`,
              `Non-uniform gravitational potential`,
              `Parallax error in electronic digital counters`,
              `Quantization of macroscopic charges`
            ],
            answer: `Thermal dissipation and internal resistance`,
            explanation: `In practical laboratory setups, Joule heating and internal resistance introduce deviations from idealized theoretical formulas.`
          }
        ]
      }
    };
  }

  if (pId === "slideshow-maker" || pId === "slideshow" || pId.includes("slide")) {
    return {
      content: `I have prepared an interactive presentation deck on **${topic}**. Navigate through the slides below.`,
      execution: {
        pluginId: plugin.id,
        pluginName: plugin.name,
        category: plugin.category,
        status: "ready",
        outputType: "slideshow",
        slides: [
          {
            title: `Introduction & Conceptual Overview: ${topic}`,
            bullets: [
              `Fundamental definition according to the official NCERT curriculum`,
              `Physical significance and role in everyday engineering and natural phenomena`,
              `Historical discovery and governing experimental evidence`
            ],
            takeaway: `Mastering the definition ensures a solid foundation for derivations and numericals.`
          },
          {
            title: `Mathematical Formulation & Derivations`,
            bullets: [
              `Step 1: Define boundary conditions and initial state`,
              `Step 2: Apply first principles and differential calculus`,
              `Step 3: Arrive at the standard relation with constants of proportionality`
            ],
            takeaway: `Always write the statement of the theorem before starting the derivation in exams.`
          },
          {
            title: `Board Exam Focus & High-Yield Questions`,
            bullets: [
              `Repeated 3-mark derivation questions from past 5 years`,
              `Graphical representations (slope and area under the curve)`,
              `Common pitfalls: forgetting vector signs and non-standard units`
            ],
            takeaway: `Graphs carry 1 full mark when accompanied by properly labelled axes.`
          }
        ]
      }
    };
  }

  if (pId === "formula-sheet-generator" || pId.includes("formula")) {
    return {
      content: `Here is the high-yield **Formula Cheat Sheet** for **${topic}**, complete with SI units and conditions.`,
      execution: {
        pluginId: plugin.id,
        pluginName: plugin.name,
        category: plugin.category,
        status: "ready",
        outputType: "formula-sheet",
        formulas: [
          {
            name: `Primary Relation (${topic})`,
            formula: `F = (G * m1 * m2) / r^2   or   V = I * R`,
            units: `Newton (N) / Volt (V)`,
            condition: `Point masses or ohmic conductors at constant temperature`
          },
          {
            name: `Conservation Law`,
            formula: `E_total = K + U = constant`,
            units: `Joule (J)`,
            condition: `Conservative force field with zero non-conservative dissipation`
          },
          {
            name: `Rate of Change`,
            formula: `d(Flux)/dt = -emf`,
            units: `Weber/sec or Volt`,
            condition: `Lenz's Law sign indicates opposing direction`
          }
        ]
      }
    };
  }

  if (pId === "ai-pdf-studio" || pId === "chapter-summarizer" || pId.includes("pdf") || pId.includes("summary")) {
    return {
      content: `I've generated a comprehensive study sheet for **${topic}**. You can read the structured summary or export it as markdown notes!`,
      execution: {
        pluginId: plugin.id,
        pluginName: plugin.name,
        category: plugin.category,
        status: "ready",
        outputType: "pdf",
        pdfData: {
          title: `Study Sheet: ${topic}`,
          subtitle: `Class ${grade} · CBSE Comprehensive Revision Notes`,
          sections: [
            {
              heading: `1. Key Concepts & Definitions`,
              body: `The chapter covers foundational mechanics and conservation laws. Pay special attention to exact NCERT terminology and sign conventions.`
            },
            {
              heading: `2. Mandatory Derivations for Board Exams`,
              body: `Practice writing the derivation with complete diagrams. Clear labeling of axes and vector arrows is strictly evaluated in CBSE.`
            },
            {
              heading: `3. Step-by-Step Problem Solving Strategy`,
              body: `Always write the given data in standard SI units first. State the formula explicitly before arithmetic substitution.`
            }
          ]
        }
      }
    };
  }

  // Default: Concept Explainer
  return {
    content: `Here is a comprehensive 4-tier breakdown of **${topic}**:`,
    execution: {
      pluginId: plugin.id,
      pluginName: plugin.name,
      category: plugin.category,
      status: "ready",
      outputType: "explainer",
      explainerData: {
        concept: topic,
        intuition: `Think of it like an equilibrium balance: any change introduced into the system triggers a counter-reaction to preserve the underlying balance.`,
        definition: `According to the standard curriculum, it is the fundamental relationship describing state transitions under applied potential or force gradients.`,
        derivation: `dE/dt = dK/dt + dU/dt = 0  =>  Total Mechanical Energy = Constant`,
        mistakes: [
          `Confusing scalar magnitudes with directional vector components`,
          `Using CGS units (cm, grams) instead of SI units (meters, kg) in formulas`,
          `Assuming ideal behavior without checking boundary conditions`
        ]
      }
    }
  };
}
