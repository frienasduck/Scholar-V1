// Scholar-authored public examples. No user records or provider responses.
export const practiceExamples = [
  { topic: "Straight-line motion", question: "A bicycle speeds up uniformly from 4 m/s to 16 m/s in 3 seconds. What is its acceleration?", options: ["4 m/s²", "12 m/s²", "6 m/s²", "48 m/s²"], correct: 0, explanation: "Acceleration is the change in velocity divided by time: a = (16 − 4) / 3 = 4 m/s². Use the change in velocity, not the final velocity alone.", misconception: "Start with the change in velocity: 16 − 4 = 12 m/s. Now divide by the 3-second interval." },
  { topic: "Uniform motion", question: "A train travels at a constant speed of 12 m/s for 5 seconds. How far does it travel?", options: ["2.4 m", "17 m", "60 m", "120 m"], correct: 2, explanation: "For constant speed, distance = speed × time = 12 × 5 = 60 m. The units also agree: (m/s) × s = m.", misconception: "At constant speed, every second adds 12 metres. Add that distance five times, or use distance = speed × time." },
] as const;

export function checkPractice(questionIndex: number, selected: number) {
  const item = practiceExamples[questionIndex];
  if (!item || selected < 0 || selected >= item.options.length) return null;
  return { correct: selected === item.correct, text: selected === item.correct ? item.explanation : item.misconception };
}

export const chapterExamples = {
  Physics: [
    { title: "Units & Measurements", concept: "Make every measurement meaningful.", detail: "Dimensions, significant figures, and measurement uncertainty.", formula: "[velocity] = L T⁻¹", tags: ["Dimensions", "Uncertainty", "SI units"] },
    { title: "Motion in a Straight Line", concept: "Understand how motion changes.", detail: "Connect position, velocity, acceleration, and the shapes of their graphs.", formula: "v = u + at", tags: ["Velocity", "Graphs", "Acceleration"] },
    { title: "Motion in a Plane", concept: "Break motion into clearer pieces.", detail: "Explore vectors and the independent horizontal and vertical parts of projectile motion.", formula: "R = u² sin(2θ) / g", tags: ["Vectors", "Projectiles", "Components"] },
  ],
  Mathematics: [
    { title: "Sets", concept: "Bring order to collections.", detail: "Explore sets, subsets, unions, intersections, and Venn diagrams.", formula: "n(A ∪ B) = n(A) + n(B) − n(A ∩ B)", tags: ["Union", "Intersection", "Subsets"] },
    { title: "Relations & Functions", concept: "See how quantities connect.", detail: "Understand domain, codomain, range, and the defining rule of a function.", formula: "f(x) = x²", tags: ["Domain", "Range", "Mappings"] },
    { title: "Trigonometric Functions", concept: "Find patterns in every angle.", detail: "Connect the unit circle to identities and trigonometric functions.", formula: "sin²θ + cos²θ = 1", tags: ["Unit circle", "Identities", "Angles"] },
  ],
} as const;
