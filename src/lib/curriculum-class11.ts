// CBSE Class 11 curriculum data (PCM + Computer Science + English) — full chapter lists
// with summaries, key concepts, formulas, practice questions, and rich per-chapter
// metadata (learning objectives, prerequisites, difficulty, board/JEE weightage,
// quick summary, important definitions, common mistakes, exam tips, etc.).

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  concepts: string[];
  formulas?: string[];
  questions: string[];
  // ===== Rich per-chapter metadata (optional — used by the Study detail view) =====
  overview?: string;
  learningObjectives?: string[];
  prerequisites?: string[];
  estimatedTime?: string;       // e.g. "6-8 hours"
  difficulty?: "Easy" | "Medium" | "Hard" | "Advanced";
  boardWeightage?: string;      // e.g. "8 marks"
  jeeWeightage?: string;        // e.g. "2-3 questions"
  quickSummary?: string[];
  importantDefinitions?: { term: string; definition: string }[];
  commonMistakes?: string[];
  examTips?: string[];
  frequentlyConfused?: { a: string; b: string; distinction: string }[];
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string; // gradient
  accent: string; // hex
  chapters: Chapter[];
}

export const CURRICULUM_CLASS11: Subject[] = [
  // ============================ PHYSICS ============================
  {
    id: "physics",
    name: "Physics",
    icon: "⚛️",
    color: "from-blue-500 to-cyan-500",
    accent: "#3b82f6",
    chapters: [
      {
        id: "p1",
        title: "Physical World",
        summary:
          "Introduces physics as the fundamental science exploring nature, its scope, and the connection between physics, technology, and society.",
        concepts: [
          "Scope and excitement of physics",
          "Physics, technology and society",
          "Fundamental forces in nature",
          "Hypothesis, axioms, principles and theories",
          "Conservation laws in physics",
        ],
        questions: [
          "Name the four fundamental forces in nature and rank them by strength.",
          "Differentiate between classical physics and quantum physics.",
          "State the principle of conservation of energy with one example.",
          "Give two examples where physics led to a major technological advancement.",
        ],

    overview: "Physics is the study of the basic laws of nature governing matter, energy, space, and time. This chapter introduces the scope of physics, its relationship with technology and society, the fundamental forces of nature, and the scientific method.",
    learningObjectives: [
      "Understand the scope and excitement of physics as a fundamental science",
      "Identify the connection between physics, technology, and society",
      "Describe the four fundamental forces in nature and their relative strengths",
      "Distinguish between hypotheses, axioms, principles, and theories",
      "Appreciate the role of conservation laws in physics",
    ],
    prerequisites: [
      "Basic science concepts from Class 10",
      "Elementary mathematics",
    ],
    estimatedTime: "3-4 hours",
    difficulty: "Easy",
    boardWeightage: "3 marks",
    jeeWeightage: "0-1 questions (conceptual)",
    quickSummary: [
      "Physics studies the fundamental laws of nature — matter, energy, space, and time",
      "Two domains: classical physics (macroscopic) and quantum physics (microscopic)",
      "Four fundamental forces: gravitational, electromagnetic, strong nuclear, weak nuclear",
      "Technology and physics are mutually reinforcing",
      "Conservation laws (energy, momentum, angular momentum, charge) are universal",
    ],
    importantDefinitions: [
      { term: "Physics", definition: "The study of the basic laws of nature governing matter, energy, space, and time." },
      { term: "Fundamental forces", definition: "The four basic forces: gravitational, electromagnetic, strong nuclear, and weak nuclear." },
      { term: "Conservation law", definition: "A principle stating that a specific quantity remains constant in an isolated system." },
      { term: "Hypothesis", definition: "A proposed explanation for a phenomenon that can be tested by experiment." },
      { term: "Theory", definition: "A well-substantiated explanation of natural phenomena, supported by evidence." },
    ],
    commonMistakes: [
      "Confusing strong nuclear force with electromagnetic force — strong force is ~100x stronger but acts only within the nucleus",
      "Thinking technology comes only from physics — it is a two-way street",
      "Mixing up conservation of energy with conservation of momentum — they are independent",
    ],
    examTips: [
      "Memorise the four fundamental forces and their relative strengths",
      "Give specific examples of physics-technology links",
      "This is a low-weightage chapter — focus on conceptual clarity",
    ],
    frequentlyConfused: [
      { a: "Classical physics", b: "Quantum physics", distinction: "Classical deals with macroscopic objects at low speeds; quantum deals with atomic/subatomic scales." },
      { a: "Hypothesis", b: "Theory", distinction: "A hypothesis is an untested proposal; a theory is a well-tested, evidence-backed explanation." },
    ],
      },
      {
        id: "p2",
        title: "Units and Measurements",
        summary:
          "Establishes the international system of units, accuracy of measurement, dimensional analysis, and significant figures.",
        concepts: [
          "SI base and derived units",
          "Significant figures and rounding",
          "Dimensional analysis and its applications",
          "Error analysis (absolute, relative, percentage)",
          "Order of magnitude and physical quantities",
        ],
        formulas: [
          "1 parsec = 3.086 × 10^16 m",
          "1 light year = 9.46 × 10^15 m",
          "Absolute error Δa = |a_i - ā|",
          "Relative error = Δa / ā",
          "Percentage error = (Δa / ā) × 100",
        ],
        questions: [
          "State the number of significant figures in 0.00700 m².",
          "Check the dimensional consistency of v² = u² + 2as.",
          "Convert 1 newton into dyne using dimensional analysis.",
          "Find the dimensional formula of the gravitational constant G.",
        ],

    overview: "This chapter establishes the International System of Units (SI), the foundation of all physical measurement. It covers dimensional analysis, significant figures, error analysis, and the measurement of physical quantities.",
    learningObjectives: [
      "Identify SI base and derived units for physical quantities",
      "Apply dimensional analysis to check equation consistency and convert units",
      "Determine significant figures and apply rounding rules",
      "Calculate absolute, relative, and percentage errors in measurements",
      "Understand the order of magnitude of physical quantities",
    ],
    prerequisites: [
      "Basic algebra",
      "Powers of 10 / scientific notation",
      "Class 10 measurement concepts",
    ],
    estimatedTime: "6-8 hours",
    difficulty: "Medium",
    boardWeightage: "5 marks",
    jeeWeightage: "1-2 questions",
    quickSummary: [
      "SI has 7 base units: metre, kilogram, second, ampere, kelvin, mole, candela",
      "Dimensional analysis checks consistency using [L], [M], [T], [I], [Theta], [N], [J]",
      "Significant figures reflect measurement precision",
      "Absolute error = |measured - true|; Relative error = absolute/true; Percentage error = relative x 100",
      "1 parsec = 3.086e16 m; 1 light year = 9.46e15 m; 1 angstrom = 1e-10 m",
    ],
    importantDefinitions: [
      { term: "SI unit", definition: "The internationally accepted system of units based on 7 base units." },
      { term: "Dimensional formula", definition: "An expression showing the powers of base quantities (M, L, T, etc.) that constitute a physical quantity." },
      { term: "Significant figures", definition: "The digits in a measurement that are known reliably plus the first uncertain digit." },
      { term: "Absolute error", definition: "The magnitude of the difference between an individual measurement and the true/mean value." },
      { term: "Least count", definition: "The smallest measurement that can be taken accurately with an instrument." },
    ],
    commonMistakes: [
      "Forgetting that dimensional analysis cannot check dimensionless constants",
      "Miscounting significant figures — leading zeros are NOT significant",
      "Mixing up addition/subtraction (least decimal places) with multiplication/division (least sig figs)",
      "Forgetting that dimensional formulas use [M], [L], [T] — not SI unit symbols",
    ],
    examTips: [
      "Practise converting between units using dimensional analysis (e.g., N to dyne)",
      "Memorise the 7 SI base units and their symbols",
      "For error propagation: addition/subtraction adds absolute errors; multiplication/division adds relative errors",
      "This is a high-yield JEE chapter — practise numericals on dimensional consistency",
    ],
    frequentlyConfused: [
      { a: "Precision", b: "Accuracy", distinction: "Precision = closeness of repeated measurements; Accuracy = closeness to true value." },
      { a: "Absolute error", b: "Relative error", distinction: "Absolute error has units; relative error is dimensionless (ratio)." },
    ],
      },
      {
        id: "p3",
        title: "Motion in a Straight Line",
        summary:
          "Describes rectilinear motion using displacement, velocity, and acceleration, and develops the kinematic equations for uniformly accelerated motion.",
        concepts: [
          "Frame of reference and position",
          "Displacement vs distance",
          "Average and instantaneous velocity & speed",
          "Uniform acceleration",
          "Relative velocity in one dimension",
        ],
        formulas: [
          "v = u + at",
          "s = ut + (1/2)at²",
          "v² = u² + 2as",
          "s_n = u + (a/2)(2n - 1)",
        ],
        questions: [
          "A ball is thrown vertically upward with 20 m/s. Find the time to reach max height (g = 10 m/s²).",
          "A car moving at 15 m/s decelerates at 2 m/s². Find the distance covered before stopping.",
          "Derive v = u + at graphically using a velocity-time graph.",
          "A train 100 m long crosses a pole in 5 s. Find its speed.",
        ],
    overview: "This chapter introduces kinematics — the description of motion without regard to causes. It covers displacement, velocity, acceleration, the equations of uniformly accelerated motion, and relative velocity in one dimension.",
    learningObjectives: [
      "Distinguish between distance, displacement, speed, and velocity",
      "Derive and apply the three kinematic equations for uniform acceleration",
      "Interpret position-time, velocity-time, and acceleration-time graphs",
      "Calculate relative velocity in one dimension",
      "Solve problems involving free fall under gravity",
    ],
    prerequisites: [
      "Basic calculus (limits, derivatives)",
      "Graph interpretation",
      "Algebra",
    ],
    estimatedTime: "6-8 hours",
    difficulty: "Medium",
    boardWeightage: "5 marks",
    jeeWeightage: "1-2 questions",
    quickSummary: [
      "Displacement is the shortest path from start to end (vector); distance is total path (scalar)",
      "Average velocity = displacement/time; Instantaneous velocity = dx/dt",
      "Kinematic equations: v=u+at, s=ut+1/2at^2, v^2=u^2+2as",
      "Under free fall: a = g = 9.8 m/s^2 downward",
      "Relative velocity: v_AB = v_A - v_B",
    ],
    importantDefinitions: [
      { term: "Displacement", definition: "The change in position of an object; a vector from initial to final position." },
      { term: "Instantaneous velocity", definition: "The velocity of an object at a specific instant; dx/dt." },
      { term: "Uniform acceleration", definition: "Constant acceleration — velocity changes by equal amounts in equal time intervals." },
      { term: "Relative velocity", definition: "The velocity of one object as observed from another: v_AB = v_A - v_B." },
      { term: "Free fall", definition: "Motion under gravity alone (no air resistance), a = g = 9.8 m/s^2." },
    ],
    commonMistakes: [
      "Confusing distance with displacement — returning to start gives zero displacement but non-zero distance",
      "Sign errors in free fall — if upward is positive, g = -9.8 m/s^2",
      "Forgetting that the area under a v-t graph gives displacement, not distance",
      "Using v = u + at when acceleration is NOT uniform",
    ],
    examTips: [
      "Always choose a sign convention and stick to it",
      "Draw a v-t graph for multi-stage motion problems",
      "For ball thrown upward: at max height v=0; time up = time down",
      "Practise relative velocity problems (trains passing each other)",
    ],
    frequentlyConfused: [
      { a: "Average speed", b: "Average velocity", distinction: "Average speed = total distance / total time (scalar); Average velocity = displacement / time (vector)." },
      { a: "Instantaneous velocity", b: "Average velocity", distinction: "Instantaneous is at one moment (dx/dt); average is over a time interval." },
    ],
      },
      {
        id: "p4",
        title: "Motion in a Plane",
        summary:
          "Extends motion to two dimensions using vector addition, projectile motion, and uniform circular motion.",
        concepts: [
          "Scalars and vectors",
          "Vector addition (triangle and parallelogram law)",
          "Projectile motion",
          "Uniform circular motion",
          "Relative velocity in two dimensions",
        ],
        formulas: [
          "R = (u² sin 2θ) / g",
          "H = (u² sin²θ) / (2g)",
          "T = (2u sinθ) / g",
          "a_c = v² / r",
        ],
        questions: [
          "Find the maximum range of a projectile launched at 45° with u = 20 m/s.",
          "A projectile is launched at 60° with speed 30 m/s. Find its time of flight.",
          "An object moves in a circle of radius 7 m with speed 14 m/s. Find the centripetal acceleration.",
          "Add two vectors of magnitudes 5 and 12 making 90° with each other.",
        ],
    overview: "Extends kinematics to two dimensions using vector algebra. Covers projectile motion, uniform circular motion, and relative velocity in two dimensions.",
    learningObjectives: [
      "Add and resolve vectors using triangle, parallelogram, and component methods",
      "Analyse projectile motion as independent horizontal and vertical motions",
      "Derive and apply equations for range, maximum height, and time of flight",
      "Describe uniform circular motion in terms of centripetal acceleration",
      "Calculate relative velocity in two dimensions",
    ],
    prerequisites: [
      "Motion in a Straight Line (p3)",
      "Basic trigonometry",
      "Pythagoras theorem",
    ],
    estimatedTime: "7-9 hours",
    difficulty: "Medium",
    boardWeightage: "5 marks",
    jeeWeightage: "2-3 questions",
    quickSummary: [
      "Vectors have magnitude and direction; scalars have magnitude only",
      "Projectile: horizontal (constant v) + vertical (constant a = -g) are independent",
      "Range R = u^2 sin(2theta)/g; Max height H = u^2 sin^2(theta)/2g; Time T = 2u sin(theta)/g",
      "Maximum range occurs at theta = 45 degrees",
      "Centripetal acceleration a_c = v^2/r, directed toward centre",
    ],
    importantDefinitions: [
      { term: "Vector", definition: "A quantity with both magnitude and direction, obeying the triangle/parallelogram law of addition." },
      { term: "Projectile", definition: "An object thrown into space that moves under gravity alone, following a parabolic path." },
      { term: "Centripetal acceleration", definition: "The acceleration of an object in circular motion, directed toward the centre: a_c = v^2/r." },
      { term: "Range of projectile", definition: "The horizontal distance travelled by a projectile: R = u^2 sin(2theta)/g." },
      { term: "Uniform circular motion", definition: "Motion in a circle at constant speed; velocity direction changes continuously." },
    ],
    commonMistakes: [
      "Treating horizontal and vertical motions as dependent — they are independent",
      "Using the wrong angle in range formula — it is sin(2theta), not sin(theta)",
      "Forgetting that centripetal acceleration is perpendicular to velocity",
      "Sign errors when resolving vectors — use consistent angle reference",
    ],
    examTips: [
      "Break projectile problems into horizontal (constant velocity) and vertical (constant acceleration) components",
      "Memorise R, H, T formulas — they appear in every exam",
      "For complementary angles (theta and 90-theta), ranges are equal",
      "JEE: practise projectile on an incline and from a height",
    ],
    frequentlyConfused: [
      { a: "Speed", b: "Velocity", distinction: "Speed = |velocity|, a scalar. In circular motion, speed is constant but velocity changes direction." },
      { a: "Centripetal force", b: "Centrifugal force", distinction: "Centripetal is real, directed inward; centrifugal is a pseudo-force in rotating frames, directed outward." },
    ],
      },
      {
        id: "p5",
        title: "Laws of Motion",
        summary:
          "Newton's three laws of motion, friction, and the principle of conservation of linear momentum.",
        concepts: [
          "Newton's first law (inertia)",
          "Newton's second law (F = ma)",
          "Newton's third law and action-reaction pairs",
          "Friction (static and kinetic)",
          "Conservation of linear momentum",
        ],
        formulas: [
          "F = ma",
          "F_friction = μN",
          "p = mv",
          "Impulse = FΔt = Δp",
          "T = m(g + a) for upward accelerating lift",
        ],
        questions: [
          "A 2 kg body accelerates at 5 m/s². Find the net force on it.",
          "State the law of conservation of linear momentum.",
          "A 5 kg block rests on a rough surface with μ = 0.2. Find the minimum force needed to just move it.",
          "Why is it difficult to walk on a perfectly frictionless surface?",
        ],
    overview: "Newton's three laws of motion form the foundation of classical mechanics. Covers inertia, force, momentum, friction, and conservation of linear momentum.",
    learningObjectives: [
      "State and apply Newton's three laws of motion",
      "Draw free-body diagrams and solve problems using them",
      "Analyse static and kinetic friction, including on inclined planes",
      "Apply the principle of conservation of linear momentum",
      "Solve problems involving pulleys, connected bodies, and circular motion",
    ],
    prerequisites: [
      "Motion in a Straight Line (p3)",
      "Motion in a Plane (p4)",
      "Vector algebra",
    ],
    estimatedTime: "8-10 hours",
    difficulty: "Hard",
    boardWeightage: "7 marks",
    jeeWeightage: "2-3 questions",
    quickSummary: [
      "First Law (Inertia): body stays at rest or in uniform motion unless net external force acts",
      "Second Law: F = ma = dp/dt",
      "Third Law: every action has an equal and opposite reaction (on different bodies)",
      "Friction: f_s <= mu_s N (static), f_k = mu_k N (kinetic)",
      "Conservation of momentum: if no external force, total momentum is constant",
      "Impulse = F*dt = dp (change in momentum)",
    ],
    importantDefinitions: [
      { term: "Inertia", definition: "The tendency of a body to resist changes in its state of rest or uniform motion." },
      { term: "Force", definition: "An external agency that changes or tends to change the state of rest or uniform motion of a body." },
      { term: "Momentum", definition: "The product of mass and velocity (p = mv); a vector quantity." },
      { term: "Friction", definition: "The contact force that opposes relative motion between two surfaces." },
      { term: "Impulse", definition: "The product of force and the time for which it acts; equals change in momentum." },
      { term: "Free-body diagram", definition: "A diagram showing all forces acting on a single isolated body." },
    ],
    commonMistakes: [
      "Forgetting that action and reaction act on DIFFERENT bodies — they don't cancel",
      "Confusing static friction (variable, up to mu_s N) with kinetic friction (constant, mu_k N)",
      "Not drawing free-body diagrams before writing equations",
      "Using N = mg on inclined planes — should be N = mg cos(theta)",
      "Using F = ma instead of F = dp/dt for variable-mass systems (rockets)",
    ],
    examTips: [
      "ALWAYS draw a free-body diagram before solving force problems",
      "On inclined plane: resolve weight into mg sin(theta) along plane and mg cos(theta) perpendicular",
      "For connected bodies (Atwood machine): write equations for EACH body separately",
      "Conservation of momentum is key for collision and explosion problems",
      "JEE: practise spring-block systems and pulley problems with friction",
    ],
    frequentlyConfused: [
      { a: "Mass", b: "Weight", distinction: "Mass = amount of matter (kg, scalar, constant); Weight = mg (N, vector, depends on g)." },
      { a: "Static friction", b: "Kinetic friction", distinction: "Static prevents motion (up to mu_s N); kinetic acts during motion (= mu_k N). mu_s > mu_k." },
    ],
      },
      {
        id: "p6",
        title: "Work, Energy and Power",
        summary:
          "Work-energy theorem, kinetic and potential energy, and the law of conservation of mechanical energy.",
        concepts: [
          "Work done by a constant and variable force",
          "Kinetic and potential energy",
          "Work-energy theorem",
          "Conservation of mechanical energy",
          "Power and efficiency",
        ],
        formulas: [
          "W = F · d cosθ",
          "KE = (1/2)mv²",
          "PE = mgh",
          "P = W/t = F · v",
          "E = mc²",
        ],
        questions: [
          "A 1 kg ball is dropped from 10 m. Find its KE just before hitting the ground.",
          "State and prove the work-energy theorem for a constant force.",
          "A motor pumps 100 kg of water per minute to a height of 10 m. Find its power output.",
          "Calculate the work done in moving a block 5 m by a 20 N force applied at 30° to the horizontal.",
        ],
    overview: "Explores work, kinetic energy, potential energy, and power. Covers the work-energy theorem, conservative and non-conservative forces, and collisions.",
    learningObjectives: [
      "Define and calculate work done by constant and variable forces",
      "State and prove the work-energy theorem",
      "Distinguish conservative and non-conservative forces with examples",
      "Apply conservation of mechanical energy to solve problems",
      "Analyse elastic and inelastic collisions in one and two dimensions",
    ],
    prerequisites: [
      "Laws of Motion (p5)",
      "Basic integration",
      "Motion in a Straight Line (p3)",
    ],
    estimatedTime: "7-9 hours",
    difficulty: "Hard",
    boardWeightage: "7 marks",
    jeeWeightage: "2-3 questions",
    quickSummary: [
      "Work W = F.d.cos(theta) (scalar product of force and displacement)",
      "Kinetic energy KE = 1/2 mv^2; Work-energy theorem: W_net = delta KE",
      "Potential energy: gravitational PE = mgh; spring PE = 1/2 kx^2",
      "Conservative force: work is path-independent (gravity, spring); non-conservative: friction",
      "Power P = W/t = F.v; SI unit: watt (W)",
      "Elastic collision: momentum AND KE conserved; Inelastic: only momentum",
    ],
    importantDefinitions: [
      { term: "Work", definition: "The scalar product of force and displacement: W = F.d.cos(theta). SI unit: joule (J)." },
      { term: "Kinetic energy", definition: "The energy possessed by a body due to its motion: KE = 1/2 mv^2." },
      { term: "Potential energy", definition: "The energy stored due to position or configuration (mgh, 1/2 kx^2)." },
      { term: "Conservative force", definition: "A force for which work done around any closed path is zero (gravity, spring force)." },
      { term: "Power", definition: "The rate of doing work: P = W/t. SI unit: watt (W) = J/s." },
      { term: "Elastic collision", definition: "A collision in which both momentum and kinetic energy are conserved." },
    ],
    commonMistakes: [
      "Forgetting work is zero when force is perpendicular to displacement (theta = 90)",
      "Confusing KE (1/2 mv^2) with momentum (mv) — KE is scalar, momentum is vector",
      "Applying conservation of energy when friction is present without accounting for energy loss",
      "Forgetting that in perfectly inelastic collision, bodies stick together",
      "Using P = W/t for variable power — should use P = dW/dt = F.v",
    ],
    examTips: [
      "Work-energy theorem is a shortcut — use it instead of kinematic equations for force-displacement problems",
      "For collisions: ALWAYS check if momentum is conserved (no external force)",
      "Elastic 1D formulas: v1 = (m1-m2)u1/(m1+m2), v2 = 2m1u1/(m1+m2)",
      "JEE: practise variable force work (integration), spring-block, and 2D collisions",
    ],
    frequentlyConfused: [
      { a: "Energy", b: "Power", distinction: "Energy = capacity to do work (J); Power = rate of energy transfer (W = J/s)." },
      { a: "Elastic collision", b: "Inelastic collision", distinction: "Elastic conserves both KE and momentum; inelastic conserves only momentum (KE is lost)." },
    ],
      },
      {
        id: "p7",
        title: "System of Particles and Rotational Motion",
        summary:
          "Center of mass, torque, angular momentum, and the rotational analogs of Newton's laws for rigid bodies.",
        concepts: [
          "Center of mass of a system",
          "Torque and angular momentum",
          "Moment of inertia and radius of gyration",
          "Theorems of parallel and perpendicular axes",
          "Rotational kinetic energy and rolling motion",
        ],
        formulas: [
          "τ = r × F",
          "L = Iω",
          "τ = Iα",
          "KE_rot = (1/2)Iω²",
          "I_axis = I_cm + Md² (parallel axis theorem)",
        ],
        questions: [
          "State the theorem of parallel axes.",
          "Define moment of inertia. Give its SI unit.",
          "Find the moment of inertia of a solid sphere about its diameter.",
          "State the law of conservation of angular momentum with an example.",
        ],
    overview: "Extends mechanics to systems of particles and rigid bodies. Covers centre of mass, torque, angular momentum, moment of inertia, and rotational dynamics.",
    learningObjectives: [
      "Locate the centre of mass of two-particle and symmetric rigid body systems",
      "Define and calculate torque and angular momentum",
      "Apply the rotational analogue of Newton's second law: tau = I*alpha",
      "Calculate moment of inertia for standard geometries using parallel and perpendicular axis theorems",
      "Apply conservation of angular momentum to solve problems",
    ],
    prerequisites: [
      "Laws of Motion (p5)",
      "Work, Energy and Power (p6)",
      "Vectors",
    ],
    estimatedTime: "10-12 hours",
    difficulty: "Hard",
    boardWeightage: "8 marks",
    jeeWeightage: "3-4 questions",
    quickSummary: [
      "Centre of mass: R_cm = sum(m_i r_i) / sum(m_i)",
      "Torque tau = r x F; angular momentum L = r x p = I*omega",
      "Rotational Newton's 2nd law: tau = I*alpha",
      "Moment of inertia: rod (mL^2/12), disc (mR^2/2), solid sphere (2mR^2/5)",
      "Parallel axis: I = I_cm + Md^2; Perpendicular axis (planar): I_z = I_x + I_y",
      "Conservation of angular momentum: if tau_ext = 0, L is constant",
    ],
    importantDefinitions: [
      { term: "Centre of mass", definition: "The point where the entire mass of a system can be assumed to be concentrated for translational motion." },
      { term: "Torque", definition: "The rotational analogue of force: tau = r x F. Causes angular acceleration." },
      { term: "Angular momentum", definition: "The rotational analogue of linear momentum: L = r x p = I*omega. Conserved if no external torque." },
      { term: "Moment of inertia", definition: "The rotational analogue of mass: I = sum(mr^2). Measures resistance to angular acceleration." },
      { term: "Radius of gyration", definition: "The distance k from axis where entire mass must be concentrated to give same I: I = Mk^2." },
    ],
    commonMistakes: [
      "Confusing centre of mass with centre of gravity — they coincide only in uniform field",
      "Forgetting that moment of inertia depends on the axis",
      "Not using the right I formula — memorise standard shapes",
      "Mixing up parallel axis (I = I_cm + Md^2) with perpendicular axis (I_z = I_x + I_y, planar only)",
      "Forgetting angular momentum conservation (skater pulling arms in: I decreases, omega increases)",
    ],
    examTips: [
      "Memorise standard moment of inertia formulas — needed in every rotational problem",
      "Parallel axis theorem: shifting from centre of mass to a parallel axis",
      "Conservation of angular momentum for spinning problems (skater, collapsing star)",
      "JEE: practise rolling without slipping (v = R*omega, KE = 1/2 mv^2 + 1/2 I*omega^2)",
    ],
    frequentlyConfused: [
      { a: "Torque", b: "Force", distinction: "Force causes linear acceleration (F=ma); torque causes angular acceleration (tau=I*alpha)." },
      { a: "Moment of inertia", b: "Mass", distinction: "Mass resists linear acceleration; I resists angular acceleration and depends on mass distribution AND axis." },
    ],
      },
      {
        id: "p8",
        title: "Gravitation",
        summary:
          "Newton's law of gravitation, variation of g with altitude and depth, orbital motion, and escape velocity.",
        concepts: [
          "Universal law of gravitation",
          "Acceleration due to gravity (g) and its variation",
          "Kepler's laws of planetary motion",
          "Gravitational potential and potential energy",
          "Escape and orbital velocity; satellites",
        ],
        formulas: [
          "F = G(m₁m₂)/r²",
          "g = GM/R²",
          "v_e = √(2gR)",
          "v_o = √(GM/r)",
          "T² ∝ r³ (Kepler's third law)",
        ],
        questions: [
          "State Kepler's third law of planetary motion.",
          "Find the escape velocity from Earth (g = 9.8 m/s², R = 6.4 × 10⁶ m).",
          "Why does a body weigh less at the equator than at the poles?",
          "Define the gravitational constant G. Give its value and SI unit.",
        ],
    overview: "Studies gravitational force. Covers Kepler's laws, Newton's law of universal gravitation, gravitational field and potential, escape velocity, orbital mechanics, and satellites.",
    learningObjectives: [
      "State and apply Kepler's three laws of planetary motion",
      "Derive and apply Newton's law of universal gravitation",
      "Calculate gravitational field and potential for point masses and shells",
      "Derive and apply expressions for escape velocity and orbital velocity",
      "Analyse satellite motion, including geostationary orbits",
    ],
    prerequisites: [
      "Laws of Motion (p5)",
      "Work, Energy and Power (p6)",
      "Circular motion (p4)",
    ],
    estimatedTime: "8-10 hours",
    difficulty: "Hard",
    boardWeightage: "6 marks",
    jeeWeightage: "2-3 questions",
    quickSummary: [
      "Newton's law: F = Gm1m2/r^2, G = 6.674e-11 N m^2/kg^2",
      "Kepler's 3rd law: T^2 proportional to r^3",
      "Gravitational field g = GM/r^2; potential V = -GM/r",
      "Escape velocity v_e = sqrt(2GM/R) = sqrt(2gR) = 11.2 km/s for Earth",
      "Orbital velocity v_o = sqrt(GM/r) = sqrt(gR) for near-Earth orbit",
      "Total energy of satellite = -GMm/(2r) (negative = bound state)",
    ],
    importantDefinitions: [
      { term: "Universal gravitation", definition: "Every particle attracts every other with F = Gm1m2/r^2 along the line joining them." },
      { term: "Gravitational field", definition: "The gravitational force per unit mass at a point: g = GM/r^2." },
      { term: "Gravitational potential", definition: "Work done per unit mass to bring a test mass from infinity: V = -GM/r." },
      { term: "Escape velocity", definition: "The minimum velocity to escape a gravitational field: v_e = sqrt(2GM/R)." },
      { term: "Geostationary orbit", definition: "An orbit at ~36,000 km with T = 24 h, appearing stationary relative to Earth." },
    ],
    commonMistakes: [
      "Forgetting that gravitational potential is negative (zero at infinity)",
      "Confusing escape velocity (sqrt(2GM/R)) with orbital velocity (sqrt(GM/R)) — escape is sqrt(2) x orbital",
      "Not remembering that g inside a solid sphere decreases linearly: g proportional to r",
      "Forgetting Kepler's 3rd law is T^2 proportional to r^3, not T proportional to r^3",
      "Sign errors in total energy of satellite: TE = -GMm/(2r) (negative = bound)",
    ],
    examTips: [
      "Memorise: v_e = 11.2 km/s (Earth), g = 9.8 m/s^2, G = 6.674e-11",
      "For satellites: KE = -TE = -PE/2 (virial theorem for 1/r^2 force)",
      "Geostationary: T = 24h, same direction as Earth's rotation, above equator, ~36,000 km",
      "JEE: practise variation of g with altitude, depth, and latitude",
    ],
    frequentlyConfused: [
      { a: "Gravitational field", b: "Gravitational potential", distinction: "Field = force per unit mass (vector, N/kg); Potential = work per unit mass (scalar, J/kg)." },
      { a: "Escape velocity", b: "Orbital velocity", distinction: "Escape leaves the field (v_e = sqrt(2gR)); orbital stays in orbit (v_o = sqrt(gR)). v_e = sqrt(2) x v_o." },
    ],
      },
      {
        id: "p9",
        title: "Mechanical Properties of Solids",
        summary:
          "Stress, strain, Hooke's law, Young's modulus, and elastic potential energy in solids.",
        concepts: [
          "Stress and strain and their types",
          "Hooke's law and the stress-strain curve",
          "Young's, shear and bulk modulus",
          "Elastic potential energy in a wire",
          "Applications of elastic behaviour",
        ],
        formulas: [
          "Stress = F / A",
          "Strain = ΔL / L",
          "Y = (F · L) / (A · ΔL)",
          "U = (1/2) × stress × strain × volume",
          "P = -B(ΔV / V)",
        ],
        questions: [
          "State Hooke's law.",
          "A wire of length 2 m and area 1 mm² stretches by 2 mm under 100 N. Find Young's modulus.",
          "Define the elastic limit of a material.",
          "Differentiate between Young's modulus and bulk modulus.",
        ],
    overview: "Studies how solid materials deform under applied forces. Covers stress, strain, Hooke's law, Young's modulus, shear modulus, bulk modulus, and elastic potential energy.",
    learningObjectives: [
      "Define stress and strain and distinguish between their types",
      "State and apply Hooke's law and the stress-strain curve",
      "Calculate Young's modulus, shear modulus, and bulk modulus",
      "Determine elastic potential energy stored in a deformed body",
      "Apply Poisson's ratio and understand elastic fatigue",
    ],
    prerequisites: [
      "Laws of Motion (p5)",
      "Work, Energy and Power (p6)",
    ],
    estimatedTime: "5-6 hours",
    difficulty: "Medium",
    boardWeightage: "4 marks",
    jeeWeightage: "1 question",
    quickSummary: [
      "Stress = Force/Area (Pa); Strain = change/original (dimensionless)",
      "Hooke's law: stress proportional to strain (within elastic limit)",
      "Young's modulus Y = (F/A)/(dL/L); Shear modulus eta = (F/A)/theta; Bulk B = -P/(dV/V)",
      "Elastic PE per unit volume = 1/2 x stress x strain",
      "Poisson's ratio sigma = lateral strain / longitudinal strain",
    ],
    importantDefinitions: [
      { term: "Stress", definition: "The restoring force per unit area inside a deformed body. Types: tensile, compressive, shear, hydraulic." },
      { term: "Strain", definition: "The ratio of change in dimension to original dimension. Dimensionless." },
      { term: "Hooke's law", definition: "Within the elastic limit, stress is directly proportional to strain." },
      { term: "Young's modulus", definition: "The ratio of longitudinal stress to longitudinal strain: Y = (F/A)/(dL/L)." },
      { term: "Elastic limit", definition: "The maximum stress beyond which the body does not return to its original shape." },
      { term: "Poisson's ratio", definition: "The ratio of lateral strain to longitudinal strain within the elastic limit." },
    ],
    commonMistakes: [
      "Confusing stress (internal restoring force per area) with pressure (external force per area)",
      "Forgetting that strain is dimensionless",
      "Mixing up the three moduli: Y (stretching), eta (shearing), B (compression)",
      "Not reading the stress-strain curve correctly",
      "Forgetting the 1/2 factor in elastic PE: U = 1/2 x stress x strain x volume",
    ],
    examTips: [
      "Memorise the three moduli and their formulas (Y, eta, B)",
      "Stress-strain curve: proportional limit, elastic limit, yield point, ultimate stress, breaking point",
      "Elastic PE: U = 1/2 x Y x strain^2 x volume = 1/2 x F x dL",
      "Medium-weightage chapter — focus on conceptual clarity and standard formulas",
    ],
    frequentlyConfused: [
      { a: "Stress", b: "Pressure", distinction: "Same units (Pa) but stress is internal restoring force per area; pressure is external force per area." },
      { a: "Elastic limit", b: "Proportional limit", distinction: "Proportional limit = where stress-strain stops being linear; elastic limit = where deformation stops being reversible." },
    ],
      },
      {
        id: "p10",
        title: "Mechanical Properties of Fluids",
        summary:
          "Pressure, Pascal's law, Bernoulli's theorem, viscosity, surface tension, and capillarity.",
        concepts: [
          "Pressure and Pascal's law",
          "Buoyancy and Archimedes' principle",
          "Bernoulli's principle and its applications",
          "Viscosity and Stokes' law; terminal velocity",
          "Surface tension and capillarity",
        ],
        formulas: [
          "P = ρgh",
          "F_buoyant = ρVg",
          "F_viscous = 6πηrv (Stokes' law)",
          "v_t = (2r²(ρ - σ)g) / (9η)",
          "h = (2σ cosθ) / (ρgr)",
        ],
        questions: [
          "State Bernoulli's principle.",
          "Find the pressure at 10 m depth in water (ρ = 1000 kg/m³, g = 10 m/s²).",
          "State Stokes' law for the viscous drag on a sphere.",
          "Explain why raindrops fall with a constant terminal velocity.",
        ],
    overview: "Studies fluids at rest (hydrostatics) and in motion (hydrodynamics). Covers pressure, Pascal's law, Archimedes' principle, Bernoulli's principle, viscosity, surface tension, and capillarity.",
    learningObjectives: [
      "Define pressure and apply Pascal's law to hydraulic systems",
      "State and apply Archimedes' principle and the law of floatation",
      "Apply the equation of continuity and Bernoulli's principle",
      "Describe viscosity and apply Stokes' law for terminal velocity",
      "Explain surface tension, surface energy, and capillary action",
    ],
    prerequisites: [
      "Mechanical Properties of Solids (p9)",
      "Laws of Motion (p5)",
    ],
    estimatedTime: "7-8 hours",
    difficulty: "Medium",
    boardWeightage: "5 marks",
    jeeWeightage: "1-2 questions",
    quickSummary: [
      "Pressure P = F/A; depth pressure P = P0 + rho*g*h",
      "Pascal's law: pressure applied to enclosed fluid transmitted equally in all directions",
      "Archimedes: buoyant force = weight of fluid displaced",
      "Continuity: A1*v1 = A2*v2 (incompressible flow)",
      "Bernoulli: P + 1/2*rho*v^2 + rho*g*h = constant",
      "Terminal velocity v_t = 2r^2(rho-sigma)g/(9*eta); Capillary rise h = 2T*cos(theta)/(rho*g*r)",
    ],
    importantDefinitions: [
      { term: "Pressure", definition: "Force per unit area acting perpendicular to a surface. SI unit: pascal (Pa)." },
      { term: "Buoyancy", definition: "The upward force on a body immersed in a fluid, equal to weight of fluid displaced." },
      { term: "Bernoulli's principle", definition: "For an ideal fluid in steady flow, P + 1/2*rho*v^2 + rho*g*h is constant." },
      { term: "Viscosity", definition: "The property of a fluid that opposes relative motion between its layers." },
      { term: "Surface tension", definition: "The force per unit length acting on the liquid surface: T = F/l." },
      { term: "Capillarity", definition: "The rise or fall of a liquid in a narrow tube due to surface tension: h = 2T*cos(theta)/(rho*g*r)." },
    ],
    commonMistakes: [
      "Forgetting that pressure at same depth is same in all directions",
      "Confusing buoyant force with weight of body — buoyancy = weight of DISPLACED fluid",
      "Not understanding Bernoulli is conservation of energy — higher speed means lower pressure",
      "Sign errors in capillary rise: concave meniscus rises, convex meniscus falls",
      "Forgetting Stokes' law applies only for small spherical bodies at low Reynolds number",
    ],
    examTips: [
      "Memorise: Bernoulli, continuity, terminal velocity, capillary rise formulas",
      "For floatation: weight = buoyant force; for sinking: weight > buoyant force",
      "Bernoulli applications: airplane wing (lift), venturi meter, Bunsen burner",
      "JEE: practise Reynolds number problems",
    ],
    frequentlyConfused: [
      { a: "Viscosity", b: "Friction", distinction: "Viscosity opposes relative motion between fluid LAYERS; friction opposes relative motion between solid SURFACES." },
      { a: "Cohesion", b: "Adhesion", distinction: "Cohesion = attraction between same molecules; Adhesion = attraction between different molecules." },
    ],
      },
      {
        id: "p11",
        title: "Thermal Properties of Matter",
        summary:
          "Temperature, heat, thermal expansion, calorimetry, and the three modes of heat transfer.",
        concepts: [
          "Temperature and heat",
          "Thermal expansion (linear, area, volume)",
          "Specific heat capacity and calorimetry",
          "Change of state and latent heat",
          "Conduction, convection and radiation",
        ],
        formulas: [
          "ΔL = αL₀ΔT",
          "ΔA = βA₀ΔT",
          "ΔV = γV₀ΔT",
          "Q = mcΔT",
          "Q = mL (latent heat)",
        ],
        questions: [
          "Differentiate between heat and temperature.",
          "A steel rod of length 1 m expands by 1.2 mm for ΔT = 100 °C. Find α.",
          "State Stefan's law of black-body radiation.",
          "Why is water used as a coolant in car radiators?",
        ],
    overview: "Studies thermal expansion, heat transfer, calorimetry, and the gas laws. Covers linear/area/volume expansion, specific heat, latent heat, conduction, convection, radiation, and Newton's law of cooling.",
    learningObjectives: [
      "Calculate linear, area, and volume thermal expansion",
      "Apply calorimetry principles to solve heat exchange problems",
      "Distinguish conduction, convection, and radiation",
      "Apply Newton's law of cooling to temperature decay problems",
      "Understand anomalous expansion of water and its significance",
    ],
    prerequisites: [
      "Basic thermodynamics concepts",
      "Algebra",
    ],
    estimatedTime: "5-6 hours",
    difficulty: "Medium",
    boardWeightage: "4 marks",
    jeeWeightage: "1 question",
    quickSummary: [
      "Linear expansion: dL = L0*alpha*dT; Area: dA = A0*(2*alpha)*dT; Volume: dV = V0*(3*alpha)*dT",
      "Specific heat c = Q/(m*dT); Latent heat L = Q/m (no temp change during phase transition)",
      "Calorimetry: heat lost by hot = heat gained by cold",
      "Conduction: Q = kA(T1-T2)t/L; Convection: fluid motion; Radiation: EM waves",
      "Newton's law of cooling: dT/dt = -k(T - Ts); Stefan: E = sigma*T^4",
      "Anomalous expansion of water: 4C = minimum volume, maximum density",
    ],
    importantDefinitions: [
      { term: "Thermal expansion", definition: "The increase in dimensions of a body due to increase in temperature." },
      { term: "Specific heat capacity", definition: "Heat required to raise 1 kg of substance by 1 K: c = Q/(m*dT)." },
      { term: "Latent heat", definition: "Heat required to change state without changing temperature: L = Q/m." },
      { term: "Conduction", definition: "Heat transfer through a medium without the medium moving (solids)." },
      { term: "Newton's law of cooling", definition: "Rate of cooling is proportional to temperature difference between body and surroundings." },
    ],
    commonMistakes: [
      "Forgetting alpha (linear), beta (area), gamma (volume) are related: beta = 2*alpha, gamma = 3*alpha",
      "Mixing up specific heat (per kg per K) with heat capacity (per K)",
      "Not accounting for latent heat separately during phase transitions",
      "Confusing conduction, convection, and radiation",
      "Forgetting water's anomaly: between 0C and 4C, water CONTRACTS on heating",
    ],
    examTips: [
      "Memorise expansion formulas: dL = L0*alpha*dT, dV = V0*gamma*dT, gamma = 3*alpha",
      "Calorimetry: always set heat lost = heat gained; include latent heat if phase change",
      "Newton's law of cooling: T(t) = Ts + (T0 - Ts)*e^(-kt)",
      "Stefan's law: E = sigma*e*A*(T^4 - T0^4); sigma = 5.67e-8 W/m^2 K^4",
    ],
    frequentlyConfused: [
      { a: "Heat", b: "Temperature", distinction: "Heat = energy in transit due to temperature difference (J); Temperature = degree of hotness (K or C)." },
      { a: "Specific heat", b: "Latent heat", distinction: "Specific heat changes temperature; latent heat changes state (no temp change)." },
    ],
      },
      {
        id: "p12",
        title: "Thermodynamics",
        summary:
          "The laws of thermodynamics, thermodynamic processes, heat engines, and refrigerators.",
        concepts: [
          "Zeroth, first and second laws of thermodynamics",
          "Isothermal, adiabatic, isobaric, isochoric processes",
          "Internal energy, work, and enthalpy",
          "Carnot engine and its efficiency",
          "Refrigerator and heat pump",
        ],
        formulas: [
          "ΔU = Q - W",
          "W = PΔV (isobaric)",
          "PV = constant (isothermal)",
          "PV^γ = constant (adiabatic)",
          "η = 1 - (T₂ / T₁)",
        ],
        questions: [
          "State the first law of thermodynamics.",
          "Differentiate between isothermal and adiabatic processes.",
          "A Carnot engine operates between 300 K and 600 K. Find its efficiency.",
          "What is an isochoric process? Find the work done in it.",
        ],
    overview: "Thermodynamics studies the relationship between heat, work, and energy. Covers the zeroth, first, and second laws, thermodynamic processes, heat engines, refrigerators, and the Carnot cycle.",
    learningObjectives: [
      "State the zeroth, first, and second laws of thermodynamics",
      "Distinguish isothermal, adiabatic, isobaric, and isochoric processes",
      "Apply the first law: dU = Q - W to solve problems",
      "Calculate efficiency of heat engines and COP of refrigerators",
      "Analyse the Carnot cycle and understand entropy",
    ],
    prerequisites: [
      "Thermal Properties of Matter (p11)",
      "Work, Energy and Power (p6)",
    ],
    estimatedTime: "8-10 hours",
    difficulty: "Hard",
    boardWeightage: "7 marks",
    jeeWeightage: "2-3 questions",
    quickSummary: [
      "Zeroth law: two systems in thermal equilibrium with a third are in equilibrium with each other",
      "First law: dU = Q - W (energy conservation)",
      "Isothermal (T const): W = nRT*ln(V2/V1); Adiabatic (Q=0): PV^gamma = const",
      "Second law: no heat engine can have 100% efficiency (Kelvin-Planck)",
      "Carnot efficiency: eta = 1 - T_cold/T_hot (max possible)",
      "Entropy: dS = Q_rev/T; always increases for irreversible processes",
    ],
    importantDefinitions: [
      { term: "Internal energy", definition: "The total energy (kinetic + potential) of all molecules in a system. For ideal gas, depends only on T." },
      { term: "First law of thermodynamics", definition: "dU = Q - W; change in internal energy = heat added - work done by system." },
      { term: "Isothermal process", definition: "A process at constant temperature (dU = 0 for ideal gas); W = Q." },
      { term: "Adiabatic process", definition: "A process with no heat exchange (Q = 0); dU = -W." },
      { term: "Carnot engine", definition: "An ideal reversible heat engine with max efficiency eta = 1 - T_c/T_h." },
      { term: "Entropy", definition: "A measure of disorder; dS = Q_rev/T. Increases for irreversible processes in isolated systems." },
    ],
    commonMistakes: [
      "Sign convention: W is work done BY system (positive when gas expands); use dU = Q - W consistently",
      "Confusing isothermal (dT = 0, dU = 0) with adiabatic (Q = 0)",
      "Forgetting gamma = Cp/Cv > 1; adiabatic PV^gamma = const is steeper than isothermal PV = const",
      "Not realising Carnot efficiency uses ABSOLUTE temperature (Kelvin)",
      "Confusing heat engine (heat to work) with refrigerator (work to move heat cold to hot)",
    ],
    examTips: [
      "Memorise: dU = Q - W; eta_Carnot = 1 - T_c/T_h; gamma = Cp/Cv; Cp - Cv = R",
      "Isothermal: W = nRT*ln(V2/V1); Adiabatic: W = nCv*(T1-T2)",
      "Carnot cycle: 2 isothermal + 2 adiabatic; efficiency depends ONLY on reservoir temperatures",
      "JEE: practise P-V diagram interpretation and non-standard cycles",
    ],
    frequentlyConfused: [
      { a: "Isothermal", b: "Adiabatic", distinction: "Isothermal: T constant, Q = W; Adiabatic: Q = 0, dU = -W. On P-V diagram, adiabatic is steeper." },
      { a: "Heat engine", b: "Refrigerator", distinction: "Engine: heat flows hot to cold, produces work; Refrigerator: uses work to move heat cold to hot." },
    ],
      },
      {
        id: "p13",
        title: "Kinetic Theory",
        summary:
          "Kinetic interpretation of temperature, pressure of an ideal gas, degrees of freedom, and specific heats of gases.",
        concepts: [
          "Postulates of kinetic theory of gases",
          "Pressure of an ideal gas",
          "Kinetic interpretation of temperature",
          "Degrees of freedom and law of equipartition of energy",
          "Mean free path and specific heat ratio γ",
        ],
        formulas: [
          "P = (1/3)ρv̄²",
          "(1/2)mc² = (3/2)kT",
          "U = (f/2)nRT",
          "C_p - C_v = R",
          "γ = C_p / C_v",
        ],
        questions: [
          "State the law of equipartition of energy.",
          "Derive P = (1/3)ρv̄² from kinetic theory of gases.",
          "Define mean free path.",
          "Why is C_p greater than C_v for an ideal gas? Explain.",
        ],
    overview: "Explains macroscopic gas behaviour through microscopic molecular motion. Covers kinetic theory of gases, degrees of freedom, equipartition of energy, and mean free path.",
    learningObjectives: [
      "Derive the kinetic theory expression for gas pressure",
      "State the postulates of the kinetic theory of gases",
      "Apply the law of equipartition of energy to calculate Cv and Cp",
      "Define and calculate mean free path of gas molecules",
      "Understand degrees of freedom for monatomic, diatomic, and polyatomic gases",
    ],
    prerequisites: [
      "Thermodynamics (p12)",
      "Thermal Properties of Matter (p11)",
    ],
    estimatedTime: "5-6 hours",
    difficulty: "Medium",
    boardWeightage: "4 marks",
    jeeWeightage: "1 question",
    quickSummary: [
      "Kinetic theory: P = 1/3 * rho * v_rms^2",
      "RMS speed: v_rms = sqrt(3RT/M); Average: v_avg = sqrt(8RT/pi*M); Most probable: v_p = sqrt(2RT/M)",
      "Equipartition: each degree of freedom contributes 1/2 kT per molecule",
      "Monatomic (3 DOF): Cv = 3R/2, gamma = 5/3; Diatomic (5 DOF): Cv = 5R/2, gamma = 7/5",
      "Mean free path: lambda = 1/(sqrt(2) * pi * d^2 * n)",
    ],
    importantDefinitions: [
      { term: "Kinetic theory", definition: "A theory explaining gas properties by treating gas as a large number of molecules in random motion." },
      { term: "RMS speed", definition: "The square root of the mean of the squares of molecular speeds: v_rms = sqrt(3RT/M)." },
      { term: "Degrees of freedom", definition: "The number of independent ways a molecule can possess energy." },
      { term: "Equipartition theorem", definition: "Each degree of freedom contributes 1/2 kT of energy per molecule on average." },
      { term: "Mean free path", definition: "The average distance a molecule travels between two successive collisions." },
    ],
    commonMistakes: [
      "Confusing v_rms, v_average, and v_most_probable — they are different: v_rms > v_avg > v_p",
      "Forgetting DOF: monatomic = 3, diatomic = 5, polyatomic = 6",
      "Using gamma = 5/3 for all gases — only for monatomic; diatomic gamma = 7/5",
      "Mixing up k (Boltzmann, per molecule) with R (gas constant, per mole)",
      "Forgetting equipartition gives 1/2 kT per DOF per molecule",
    ],
    examTips: [
      "Memorise: v_rms = sqrt(3RT/M), Cv for monatomic (3R/2) and diatomic (5R/2)",
      "Relations: Cp - Cv = R; gamma = Cp/Cv; Cv = R/(gamma-1)",
      "Mean free path: lambda = 1/(sqrt(2) * pi * d^2 * n)",
      "JEE: practise problems relating pressure to molecular speeds",
    ],
    frequentlyConfused: [
      { a: "RMS speed", b: "Average speed", distinction: "v_rms = sqrt(3RT/M) > v_avg = sqrt(8RT/pi*M) > v_p = sqrt(2RT/M)." },
      { a: "Degrees of freedom", b: "Dimension", distinction: "DOF = number of independent energy modes; dimension = spatial axes (always 3)." },
    ],
      },
      {
        id: "p14",
        title: "Oscillations",
        summary:
          "Periodic motion, simple harmonic motion, time period, energy in SHM, and damped oscillations.",
        concepts: [
          "Periodic and oscillatory motion",
          "Simple harmonic motion (SHM)",
          "Spring-mass system and simple pendulum",
          "Energy in SHM",
          "Damped and forced oscillations; resonance",
        ],
        formulas: [
          "F = -kx",
          "T = 2π√(m/k)",
          "T = 2π√(L/g)",
          "E = (1/2)mω²A²",
          "v_max = Aω",
        ],
        questions: [
          "A simple pendulum has length 1 m. Find its time period (g = 9.8 m/s²).",
          "State the conditions for a motion to be SHM.",
          "Find the total energy of a particle in SHM with m = 0.5 kg, ω = 2 rad/s, A = 0.1 m.",
          "Differentiate between free and damped oscillations.",
        ],
    overview: "Studies periodic and oscillatory motion, especially Simple Harmonic Motion (SHM). Covers the SHM equation, energy in SHM, pendulums, damped and forced oscillations, and resonance.",
    learningObjectives: [
      "Define and identify simple harmonic motion (SHM)",
      "Derive and apply the SHM equation: x = A sin(omega*t + phi)",
      "Calculate time period and frequency of spring-mass and pendulum systems",
      "Analyse energy in SHM (KE and PE interchange)",
      "Distinguish damped, forced, and resonant oscillations",
    ],
    prerequisites: [
      "Motion in a Straight Line (p3)",
      "Motion in a Plane (p4)",
      "Differentiation",
    ],
    estimatedTime: "7-8 hours",
    difficulty: "Hard",
    boardWeightage: "6 marks",
    jeeWeightage: "2 questions",
    quickSummary: [
      "SHM: F = -kx (restoring force proportional to displacement); a = -omega^2 * x",
      "Displacement: x = A sin(omega*t + phi); max velocity = A*omega",
      "Spring: T = 2*pi*sqrt(m/k); Simple pendulum: T = 2*pi*sqrt(L/g)",
      "Energy: KE = 1/2 m*omega^2*(A^2-x^2); PE = 1/2 m*omega^2*x^2; Total = 1/2 m*omega^2*A^2",
      "Damped: amplitude decreases; Forced: external periodic force; Resonance: driving freq = natural freq",
    ],
    importantDefinitions: [
      { term: "Simple harmonic motion", definition: "Periodic motion where restoring force is proportional to displacement and directed toward equilibrium: F = -kx." },
      { term: "Angular frequency", definition: "omega = 2*pi/T = 2*pi*f. For spring: omega = sqrt(k/m)." },
      { term: "Amplitude", definition: "The maximum displacement from equilibrium in oscillatory motion." },
      { term: "Phase", definition: "The argument (omega*t + phi) of the sine function; describes the state of oscillation." },
      { term: "Resonance", definition: "Large-amplitude oscillation when driving frequency equals natural frequency." },
    ],
    commonMistakes: [
      "Forgetting SHM requires BOTH restoring force AND F proportional to -x",
      "Confusing angular frequency omega with angular velocity",
      "Sign errors in energy: at x = 0, KE is max and PE = 0; at x = A, KE = 0 and PE is max",
      "Using T = 2*pi*sqrt(L/g) for large amplitudes — only valid for theta < 10 degrees",
      "Forgetting total energy in SHM is constant (1/2 m*omega^2*A^2)",
    ],
    examTips: [
      "Memorise: x = A sin(omega*t + phi), T = 2*pi*sqrt(m/k) (spring), T = 2*pi*sqrt(L/g) (pendulum)",
      "Energy: at equilibrium, all KE; at extremes, all PE. Total = 1/2 m*omega^2*A^2",
      "Springs in series: 1/k = 1/k1 + 1/k2; parallel: k = k1 + k2",
      "JEE: practise vertical spring (equilibrium shift) and compound pendulum",
    ],
    frequentlyConfused: [
      { a: "Periodic motion", b: "Oscillatory motion", distinction: "Periodic = repeats at equal intervals; Oscillatory = periodic AND back-and-forth about equilibrium." },
      { a: "Damped oscillation", b: "Forced oscillation", distinction: "Damped: amplitude decreases due to resistance; Forced: external periodic force maintains oscillation." },
    ],
      },
      {
        id: "p15",
        title: "Waves",
        summary:
          "Transverse and longitudinal waves, speed of waves, superposition, beats, and the Doppler effect.",
        concepts: [
          "Transverse and longitudinal waves",
          "Speed of travelling waves in strings and gases",
          "Principle of superposition and interference",
          "Beats and standing waves",
          "Doppler effect in sound",
        ],
        formulas: [
          "v = fλ",
          "v = √(T/μ) (string)",
          "v = √(γP/ρ) (Laplace, gas)",
          "f' = f(v ± v_o) / (v ∓ v_s)",
          "Beat frequency = |f₁ - f₂|",
        ],
        questions: [
          "A wave has frequency 500 Hz and wavelength 0.7 m. Find its speed.",
          "State the principle of superposition of waves.",
          "Two tuning forks of 256 Hz and 260 Hz are sounded together. Find the beat frequency.",
          "Explain the Doppler effect in sound.",
        ],
    overview: "Studies wave motion — propagation of disturbances through a medium. Covers transverse and longitudinal waves, the wave equation, superposition, standing waves, beats, Doppler effect, and sound.",
    learningObjectives: [
      "Distinguish transverse and longitudinal waves",
      "Derive and apply the wave equation: v = lambda*f = omega/k",
      "Apply the principle of superposition to analyse interference and standing waves",
      "Calculate beat frequency and explain the Doppler effect",
      "Analyse standing waves in strings and pipes",
    ],
    prerequisites: [
      "Oscillations (p14)",
      "Motion in a Plane (p4)",
    ],
    estimatedTime: "8-10 hours",
    difficulty: "Hard",
    boardWeightage: "7 marks",
    jeeWeightage: "2-3 questions",
    quickSummary: [
      "Transverse: particles oscillate perpendicular to wave direction; Longitudinal: parallel",
      "Wave equation: y = A sin(kx - omega*t); v = lambda*f = omega/k = sqrt(T/mu) for string",
      "Speed of sound in air ~ 343 m/s at 20C; v proportional to sqrt(T)",
      "Superposition: displacements add; Interference: constructive (in phase) / destructive (out of phase)",
      "Standing waves: nodes (zero amplitude) and antinodes (max); string fixed both ends: lambda_n = 2L/n",
      "Beats: f_beat = |f1 - f2|; Doppler: f' = f(v +/- v_o)/(v -/+ v_s)",
    ],
    importantDefinitions: [
      { term: "Wave", definition: "A disturbance that propagates through a medium, transferring energy without net transfer of matter." },
      { term: "Transverse wave", definition: "A wave where particles oscillate perpendicular to wave direction (light, string)." },
      { term: "Longitudinal wave", definition: "A wave where particles oscillate parallel to wave direction (sound)." },
      { term: "Standing wave", definition: "A wave formed by superposition of two identical waves travelling in opposite directions; has fixed nodes and antinodes." },
      { term: "Doppler effect", definition: "The apparent change in frequency when source and observer are in relative motion." },
      { term: "Beats", definition: "Periodic intensity variation when two waves of slightly different frequencies superpose; f_beat = |f1 - f2|." },
    ],
    commonMistakes: [
      "Confusing transverse (perpendicular) and longitudinal (parallel) — sound is longitudinal, light is transverse",
      "Sign errors in Doppler: source moving toward observer means higher frequency",
      "Forgetting standing waves on string fixed both ends: lambda_n = 2L/n",
      "Not distinguishing open pipe (antinode at open end) from closed pipe (node at closed end)",
      "Forgetting wave speed depends on medium, not frequency or amplitude",
    ],
    examTips: [
      "Memorise: v = lambda*f, v = sqrt(T/mu) (string), Doppler formula, beat frequency",
      "Standing waves: string (both fixed) lambda = 2L/n; open pipe lambda = 2L/n; closed pipe lambda = 4L/(2n-1)",
      "Doppler: use + for approach, - for recede; source in denominator, observer in numerator",
      "JEE: practise combined source+observer motion and wind effect",
    ],
    frequentlyConfused: [
      { a: "Transverse wave", b: "Longitudinal wave", distinction: "Transverse: particles move perpendicular to wave direction (EM); Longitudinal: parallel (sound)." },
      { a: "Node", b: "Antinode", distinction: "Node = zero amplitude point; Antinode = maximum amplitude point. Distance between adjacent nodes = lambda/2." },
    ],
      },
    ],
  },

  // ============================ CHEMISTRY ============================
  {
    id: "chemistry",
    name: "Chemistry",
    icon: "🧪",
    color: "from-emerald-500 to-green-500",
    accent: "#10b981",
    chapters: [
      {
        id: "c1",
        title: "Some Basic Concepts of Chemistry",
        summary:
          "Introduces the classification of matter, SI units, the mole concept, stoichiometry, and concentration terms.",
        concepts: [
          "Matter and its classification",
          "Properties of matter and SI units",
          "Laws of chemical combination",
          "Mole concept and molar mass",
          "Empirical and molecular formula",
          "Concentration of solutions",
        ],
        formulas: [
          "Moles = mass / molar mass",
          "Molarity (M) = n_solute / V_solution (L)",
          "Molality (m) = n_solute / mass_solvent (kg)",
          "Number of particles = n × 6.022 × 10²³",
          "% by mass = (mass_solute / mass_solution) × 100",
        ],
        questions: [
          "Calculate the molar mass of H₂SO₄.",
          "Find the number of atoms in 4 g of NaOH.",
          "Define molarity. Calculate the molarity of 4 g NaOH in 500 mL solution.",
          "Determine the empirical formula of a compound with 80% C and 20% H.",
        ],
      },
      {
        id: "c2",
        title: "Structure of Atom",
        summary:
          "Sub-atomic particles, the atomic models of Thomson, Rutherford and Bohr, the quantum mechanical model, and electronic configuration.",
        concepts: [
          "Discovery of electron, proton and neutron",
          "Atomic models (Thomson, Rutherford, Bohr)",
          "Dual nature of radiation and matter",
          "Quantum numbers and orbitals",
          "Aufbau, Pauli and Hund's rules",
          "Electronic configuration of atoms",
        ],
        formulas: [
          "E_n = -13.6/n² eV (hydrogen atom)",
          "r_n = 0.529 n² / Z Å",
          "λ = h/p = h/mv (de Broglie)",
          "hν = E₂ - E₁",
          "Number of orbitals in shell n = n²",
        ],
        questions: [
          "Write the electronic configuration of nitrogen (Z = 7).",
          "Calculate the energy of an electron in the second orbit of hydrogen.",
          "State Pauli's exclusion principle.",
          "What is the de Broglie wavelength of an electron moving at 10⁶ m/s?",
        ],
      },
      {
        id: "c3",
        title: "Classification of Elements and Periodicity in Properties",
        summary:
          "The modern periodic table and periodic trends in atomic radius, ionization enthalpy, electron gain enthalpy and electronegativity.",
        concepts: [
          "Need for classification and Mendeleev's periodic table",
          "Modern periodic law and table",
          "Periodic trends: atomic and ionic radii",
          "Ionization enthalpy and electron gain enthalpy",
          "Electronegativity and periodicity in properties",
        ],
        questions: [
          "State the modern periodic law.",
          "Why does ionization enthalpy increase across a period?",
          "Define electronegativity. Which scale is most commonly used?",
          "Why are noble gases assigned zero electronegativity?",
        ],
      },
      {
        id: "c4",
        title: "Chemical Bonding and Molecular Structure",
        summary:
          "Lewis structures, VSEPR theory, valence bond theory, hybridization, and intermolecular forces.",
        concepts: [
          "Kössel-Lewis approach and the octet rule",
          "Ionic vs covalent bonding",
          "VSEPR theory and molecular shapes",
          "Valence bond theory and hybridization",
          "Hydrogen bonding and intermolecular forces",
          "Formal charge and resonance",
        ],
        questions: [
          "Draw the Lewis structure of CO₂.",
          "Predict the shape of NH₃ using VSEPR theory.",
          "What is the hybridization of carbon in CH₄?",
          "Differentiate between sigma (σ) and pi (π) bonds.",
        ],
      },
      {
        id: "c5",
        title: "States of Matter",
        summary:
          "Gas laws, the ideal gas equation, deviation from ideal behaviour, and properties of liquids.",
        concepts: [
          "Boyle's, Charles' and Avogadro's laws",
          "Ideal gas equation PV = nRT",
          "Dalton's law of partial pressures",
          "Real gases and the van der Waals equation",
          "Liquid state: vapour pressure, viscosity, surface tension",
        ],
        formulas: [
          "PV = nRT",
          "P_total = P₁ + P₂ + ...",
          "(P + an²/V²)(V - nb) = nRT",
          "d = PM/RT",
          "u_rms = √(3RT/M)",
        ],
        questions: [
          "State Boyle's law and give its mathematical form.",
          "Calculate the volume occupied by 2 moles of an ideal gas at STP.",
          "State Dalton's law of partial pressures.",
          "Why do real gases deviate from ideal behaviour at high pressure?",
        ],
      },
      {
        id: "c6",
        title: "Thermodynamics",
        summary:
          "Thermochemical equations, enthalpy changes, Hess's law, and the spontaneity of chemical reactions.",
        concepts: [
          "System, surroundings and state functions",
          "First law and internal energy",
          "Enthalpy and enthalpy changes",
          "Hess's law of constant heat summation",
          "Bond enthalpy and enthalpy of formation",
          "Second law, entropy and Gibbs energy",
        ],
        formulas: [
          "ΔU = q + w",
          "w = -PΔV",
          "ΔH = ΔU + ΔnRT",
          "ΔG = ΔH - TΔS",
          "q = m · c · ΔT",
        ],
        questions: [
          "State the first law of thermodynamics.",
          "Calculate ΔH when ΔU = 100 J and ΔnRT = 40 J.",
          "State Hess's law. Give its significance.",
          "For a reaction ΔG is negative. What does it indicate about spontaneity?",
        ],
      },
      {
        id: "c7",
        title: "Equilibrium",
        summary:
          "Dynamic equilibrium in physical and chemical processes, Le Chatelier's principle, and ionic equilibrium.",
        concepts: [
          "Dynamic equilibrium and equilibrium constant",
          "Homogeneous and heterogeneous equilibrium",
          "Le Chatelier's principle and reaction quotients",
          "Relation between Kp and Kc",
          "Ionic equilibrium: acids, bases, pH, buffers, Ksp",
        ],
        formulas: [
          "Kc = [C]^c [D]^d / ([A]^a [B]^b)",
          "Kp = Kc(RT)^Δn",
          "pH = -log[H⁺]",
          "pOH = -log[OH⁻]",
          "pH + pOH = 14 (at 25 °C)",
        ],
        questions: [
          "State Le Chatelier's principle.",
          "For N₂ + 3H₂ ⇌ 2NH₃, write the expression for Kc.",
          "Calculate the pH of 0.001 M HCl.",
          "What is a buffer solution? Give one example.",
        ],
      },
      {
        id: "c8",
        title: "Redox Reactions",
        summary:
          "Oxidation-reduction processes, oxidation numbers, balancing redox equations, and redox titrations.",
        concepts: [
          "Oxidation, reduction, oxidizing and reducing agents",
          "Oxidation number and rules for assigning it",
          "Balancing redox reactions (half-equation and oxidation number methods)",
          "Redox titrations (e.g. KMnO₄ vs oxalic acid)",
          "Disproportionation reactions",
        ],
        questions: [
          "Balance: MnO₄⁻ + Fe²⁺ + H⁺ → Mn²⁺ + Fe³⁺ + H₂O",
          "Find the oxidation number of S in H₂SO₄.",
          "Identify the oxidizing agent in: 2Na + Cl₂ → 2NaCl.",
          "Define a disproportionation reaction with one example.",
        ],
      },
      {
        id: "c9",
        title: "Hydrogen",
        summary:
          "The position of hydrogen in the periodic table, its preparation, properties, hydrides, and heavy water.",
        concepts: [
          "Position of hydrogen in the periodic table",
          "Isotopes of hydrogen (protium, deuterium, tritium)",
          "Hydrides (ionic, covalent, metallic)",
          "Hardness of water and heavy water",
          "Dihydrogen as a fuel",
        ],
        questions: [
          "Why is hydrogen placed separately in the periodic table?",
          "Differentiate between hard and soft water.",
          "What is heavy water? Give its chemical formula.",
          "Mention one use of dihydrogen as a fuel.",
        ],
      },
      {
        id: "c10",
        title: "The s-Block Elements",
        summary:
          "Group 1 (alkali metals) and Group 2 (alkaline earth metals) — occurrence, trends, anomalous behaviour, and important compounds.",
        concepts: [
          "Group 1: alkali metals — trends and properties",
          "Group 2: alkaline earth metals — trends and properties",
          "Anomalous behaviour of Li and Be",
          "Diagonal relationship",
          "Important compounds: NaOH, Na₂CO₃, CaO, gypsum, plaster of Paris",
        ],
        questions: [
          "Why are alkali metals kept under kerosene?",
          "Explain the diagonal relationship between Li and Mg.",
          "What is plaster of Paris? Give its chemical formula.",
          "Why is beryllium anomalous in Group 2?",
        ],
      },
      {
        id: "c11",
        title: "The p-Block Elements (Group 13 & 14)",
        summary:
          "Group 13 (boron family) and Group 14 (carbon family) — trends, anomalous behaviour, and important compounds.",
        concepts: [
          "Group 13: boron family — trends and properties",
          "Anomalous behaviour of boron",
          "Borax, diborane and boric acid",
          "Group 14: carbon family — trends",
          "Allotropes of carbon; CO, CO₂, SiO₂, silicones",
        ],
        questions: [
          "Why does boron show anomalous behaviour in Group 13?",
          "What is borax? Give its chemical formula.",
          "List three allotropes of carbon.",
          "Why is carbon monoxide poisonous?",
        ],
      },
      {
        id: "c12",
        title: "Organic Chemistry – Some Basic Principles and Techniques",
        summary:
          "Fundamentals of organic chemistry — IUPAC nomenclature, isomerism, electronic effects, and reaction mechanisms.",
        concepts: [
          "Tetravalence of carbon and catenation",
          "IUPAC nomenclature of organic compounds",
          "Isomerism (structural and stereo)",
          "Electronic effects: inductive, resonance, hyperconjugation",
          "Reaction intermediates: carbocations, carbanions, free radicals",
          "Types of organic reactions and purification methods",
        ],
        questions: [
          "Write the IUPAC name of CH₃-CH₂-CH(OH)-CH₃.",
          "Differentiate between structural and stereoisomerism.",
          "Explain the inductive effect with an example.",
          "What is meant by homolytic bond cleavage?",
        ],
      },
      {
        id: "c13",
        title: "Hydrocarbons",
        summary:
          "Classification, preparation, properties, and reactions of alkanes, alkenes, alkynes, and aromatic hydrocarbons.",
        concepts: [
          "Alkanes: preparation, properties and reactions",
          "Alkenes: addition reactions and Markovnikov's rule",
          "Alkynes: acidic character and addition reactions",
          "Aromatic hydrocarbons: benzene and electrophilic substitution",
          "Mechanism of substitution and addition; petroleum",
        ],
        questions: [
          "State Markovnikov's rule with an example.",
          "Complete the reaction: CH≡CH + H₂ → ? (Ni catalyst).",
          "Why is benzene unusually stable?",
          "Write the equation for the Wurtz reaction.",
        ],
      },
      {
        id: "c14",
        title: "Environmental Chemistry",
        summary:
          "Environmental pollution of air, water, and soil; acid rain, greenhouse effect, and the principles of green chemistry.",
        concepts: [
          "Air pollution and atmospheric chemistry",
          "Water pollution: causes, BOD and COD",
          "Soil pollution and pesticides",
          "Acid rain, greenhouse effect and smog",
          "Green chemistry and strategies for pollution control",
        ],
        questions: [
          "What is acid rain? Give its main causes.",
          "Define BOD and COD.",
          "What is the greenhouse effect? Name two greenhouse gases.",
          "What is meant by green chemistry?",
        ],
      },
    ],
  },

  // ============================ MATHEMATICS ============================
  {
    id: "maths",
    name: "Mathematics",
    icon: "📐",
    color: "from-indigo-500 to-violet-500",
    accent: "#6366f1",
    chapters: [
      {
        id: "m1",
        title: "Sets",
        summary:
          "Introduces sets and their representations, types of sets, set operations, and Venn diagrams.",
        concepts: [
          "Definition and representation of sets",
          "Types of sets (empty, finite, infinite, equal, equivalent)",
          "Subsets, power set, universal set",
          "Operations: union, intersection, difference, complement",
          "Venn diagrams and De Morgan's laws",
        ],
        formulas: [
          "n(A∪B) = n(A) + n(B) - n(A∩B)",
          "n(A∪B∪C) = n(A) + n(B) + n(C) - n(A∩B) - n(B∩C) - n(A∩C) + n(A∩B∩C)",
          "(A∪B)' = A'∩B'",
          "(A∩B)' = A'∪B'",
          "n(A - B) = n(A) - n(A∩B)",
        ],
        questions: [
          "If A = {1, 2, 3} and B = {2, 3, 4}, find A∪B and A∩B.",
          "State De Morgan's laws for sets.",
          "In a group of 50 students, 30 like tea and 25 like coffee. Find how many like both if 10 like neither.",
          "Find the power set of {a, b}.",
        ],
      },
      {
        id: "m2",
        title: "Relations and Functions",
        summary:
          "Cartesian products, relations, types of relations, and functions with their graphs.",
        concepts: [
          "Cartesian product of sets",
          "Relations: domain, range, codomain",
          "Types of relations: reflexive, symmetric, transitive, equivalence",
          "Functions: domain, range",
          "Types of functions: one-one, onto, bijective",
          "Algebra of real functions",
        ],
        questions: [
          "Define a function. When is it said to be one-one?",
          "Check if R = {(1,1), (2,2), (1,2)} on {1,2} is an equivalence relation.",
          "Find the domain of f(x) = 1/(x - 3).",
          "If f(x) = 2x + 1 and g(x) = x², find f∘g(2).",
        ],
      },
      {
        id: "m3",
        title: "Trigonometric Functions",
        summary:
          "Radian measure, trigonometric ratios of standard angles, identities, and trigonometric equations.",
        concepts: [
          "Radian and degree measure of angles",
          "Trigonometric ratios of standard angles",
          "Sign of trigonometric ratios in quadrants",
          "Trigonometric identities and formulae",
          "Trigonometric equations and their solutions",
        ],
        formulas: [
          "sin²θ + cos²θ = 1",
          "1 + tan²θ = sec²θ",
          "1 + cot²θ = cosec²θ",
          "sin(A±B) = sinA cosB ± cosA sinB",
          "cos(A+B) + cos(A-B) = 2 cosA cosB",
          "sin 2θ = 2 sinθ cosθ",
        ],
        questions: [
          "Convert 45° into radians.",
          "Prove that sin²θ + cos²θ = 1.",
          "Find the value of sin 75°.",
          "Solve: sin x = 1/2 for x in [0, 2π].",
        ],
      },
      {
        id: "m4",
        title: "Principle of Mathematical Induction",
        summary:
          "Proving statements for all natural numbers using the principle of mathematical induction.",
        concepts: [
          "Statement P(n) for natural numbers",
          "Base step (n = 1)",
          "Inductive step (P(k) → P(k+1))",
          "Validity of the induction principle",
        ],
        questions: [
          "Prove by induction: 1 + 2 + ... + n = n(n+1)/2.",
          "Prove by induction that n² + n is even for all natural n.",
          "Prove: 1 + 3 + ... + (2n - 1) = n² by induction.",
          "Prove by induction: 2ⁿ > n for all natural n.",
        ],
      },
      {
        id: "m5",
        title: "Complex Numbers and Quadratic Equations",
        summary:
          "Complex numbers, the algebra of complex numbers, the Argand plane, and the solutions of quadratic equations.",
        concepts: [
          "Complex numbers and the imaginary unit i",
          "Algebra of complex numbers (add, subtract, multiply, divide)",
          "Modulus and conjugate",
          "Argand plane and polar representation",
          "Solutions of quadratic equations",
        ],
        formulas: [
          "i² = -1",
          "z = a + ib",
          "|z| = √(a² + b²)",
          "z · z̄ = |z|²",
          "x = [-b ± √(b² - 4ac)] / (2a)",
          "(cosθ + i sinθ)ⁿ = cos(nθ) + i sin(nθ) (De Moivre)",
        ],
        questions: [
          "Express (3 + 2i) + (1 - 4i) in standard form.",
          "Find the modulus of z = 3 + 4i.",
          "Solve x² + x + 1 = 0.",
          "Find the multiplicative inverse of 2 - 3i.",
        ],
      },
      {
        id: "m6",
        title: "Linear Inequalities",
        summary:
          "Linear inequalities in one and two variables, and their graphical solutions.",
        concepts: [
          "Inequalities in one variable",
          "Rules for solving inequalities",
          "Graphical solution of linear inequalities in two variables",
          "System of linear inequalities",
        ],
        questions: [
          "Solve: 3x - 6 < 0.",
          "Solve 2x + 3 ≥ 7 and represent the solution on the number line.",
          "Solve graphically: x + y ≥ 5.",
          "Solve the system: x + 2y ≤ 8, x ≥ 0, y ≥ 0.",
        ],
      },
      {
        id: "m7",
        title: "Permutations and Combinations",
        summary:
          "The fundamental principle of counting, factorial notation, permutations, and combinations.",
        concepts: [
          "Fundamental principle of counting",
          "Factorial n!",
          "Permutations P(n, r)",
          "Combinations C(n, r)",
          "Properties and applications",
        ],
        formulas: [
          "n! = n(n-1)(n-2)…1",
          "P(n, r) = n! / (n-r)!",
          "C(n, r) = n! / [r!(n-r)!]",
          "C(n, r) = C(n, n-r)",
          "C(n, r) + C(n, r-1) = C(n+1, r)",
        ],
        questions: [
          "Find 5! / 3!.",
          "Find the number of arrangements of 5 books on a shelf.",
          "Find C(8, 2).",
          "How many 3-digit numbers can be formed using 1, 2, 3, 4 without repetition?",
        ],
      },
      {
        id: "m8",
        title: "Binomial Theorem",
        summary:
          "Expansion of (a + b)ⁿ for a positive integer n; the general and middle terms.",
        concepts: [
          "Binomial theorem for positive integral index",
          "General and middle terms",
          "Properties of binomial coefficients",
          "Applications of the binomial theorem",
        ],
        formulas: [
          "(a + b)ⁿ = Σ ⁿCᵣ aⁿ⁻ʳ bʳ",
          "T_{r+1} = ⁿCᵣ aⁿ⁻ʳ bʳ",
          "Sum of coefficients = 2ⁿ",
          "Middle term: r = n/2 (even), (n±1)/2 (odd)",
        ],
        questions: [
          "Expand (x + 2)⁵.",
          "Find the coefficient of x⁴ in (1 + x)⁶.",
          "Find the middle term of (a + b)⁶.",
          "Find the 4th term in (2x - 1)⁵.",
        ],
      },
      {
        id: "m9",
        title: "Sequences and Series",
        summary:
          "Arithmetic and geometric progressions, the sums of series, and special series.",
        concepts: [
          "Arithmetic Progression (AP)",
          "Geometric Progression (GP)",
          "Arithmetic and geometric means",
          "Sum of n terms of AP and GP",
          "Sum to infinity of a GP",
          "Special series Σn, Σn², Σn³",
        ],
        formulas: [
          "aₙ = a + (n-1)d",
          "Sₙ = (n/2)[2a + (n-1)d]",
          "aₙ = arⁿ⁻¹",
          "Sₙ = a(rⁿ - 1)/(r - 1), r ≠ 1",
          "S_∞ = a/(1-r), |r| < 1",
          "Σn² = n(n+1)(2n+1)/6",
        ],
        questions: [
          "Find the 10th term of the AP: 2, 5, 8, ...",
          "Find the sum of the first 20 terms of the AP: 1, 4, 7, ...",
          "Find the sum to infinity of the GP: 1, 1/2, 1/4, ...",
          "Find the sum: 1² + 2² + ... + 10².",
        ],
      },
      {
        id: "m10",
        title: "Straight Lines",
        summary:
          "Coordinate geometry basics: slope, equations of lines in various forms, angle between lines, and the distance of a point from a line.",
        concepts: [
          "Slope of a line",
          "Various forms of the equation of a line",
          "General equation of a line",
          "Angle between two lines",
          "Distance of a point from a line",
          "Family of lines",
        ],
        formulas: [
          "m = (y₂ - y₁) / (x₂ - x₁)",
          "y - y₁ = m(x - x₁)",
          "y = mx + c",
          "x/a + y/b = 1 (intercept form)",
          "Distance = |Ax + By + C| / √(A² + B²)",
          "tanθ = |(m₁ - m₂) / (1 + m₁ m₂)|",
        ],
        questions: [
          "Find the slope of the line passing through (2, 3) and (5, 9).",
          "Find the equation of the line with slope 2 passing through (1, 1).",
          "Find the distance of the point (3, 4) from the line 3x + 4y = 5.",
          "Find the angle between the lines y = 2x + 1 and y = -3x + 2.",
        ],
      },
      {
        id: "m11",
        title: "Conic Sections",
        summary:
          "Sections of a cone — circle, parabola, ellipse, and hyperbola — their standard equations and properties.",
        concepts: [
          "Sections of a cone",
          "Circle: equation and properties",
          "Parabola: standard equations",
          "Ellipse: standard equations",
          "Hyperbola: standard equations",
        ],
        formulas: [
          "(x - h)² + (y - k)² = r² (circle)",
          "y² = 4ax (parabola)",
          "x²/a² + y²/b² = 1 (ellipse)",
          "x²/a² - y²/b² = 1 (hyperbola)",
          "Eccentricity e = c/a",
        ],
        questions: [
          "Find the equation of the circle with centre (2, 3) and radius 5.",
          "Find the focus and directrix of the parabola y² = 12x.",
          "Find the vertices of the ellipse x²/25 + y²/16 = 1.",
          "Identify the conic: 9x² - 16y² = 144.",
        ],
      },
      {
        id: "m12",
        title: "Introduction to Three Dimensional Geometry",
        summary:
          "Coordinates of a point in 3D space, the octants, and the distance and section formulas in three dimensions.",
        concepts: [
          "Coordinates of a point in 3D space",
          "Octants in space",
          "Distance between two points in 3D",
          "Section formula (internal and external division)",
        ],
        formulas: [
          "d = √((x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²)",
          "Midpoint = ((x₁+x₂)/2, (y₁+y₂)/2, (z₁+z₂)/2)",
          "Section: ((mx₂+nx₁)/(m+n), (my₂+ny₁)/(m+n), (mz₂+nz₁)/(m+n))",
        ],
        questions: [
          "Find the distance between (1, 2, 3) and (4, 6, 3).",
          "Find the midpoint of the segment joining (2, -1, 3) and (4, 3, -1).",
          "Name the octant in which the point (2, -3, 4) lies.",
          "Find the coordinates of the point dividing the join of (1, 2, 3) and (3, 4, 5) in the ratio 2:3 internally.",
        ],
      },
      {
        id: "m13",
        title: "Limits and Derivatives",
        summary:
          "The intuitive idea of limits, standard limits, and the derivative of a function as a rate of change.",
        concepts: [
          "Intuitive idea of a limit",
          "Algebra of limits and standard limits",
          "Limits of trigonometric functions",
          "Derivative as rate of change",
          "Derivative from first principles",
          "Algebra of derivatives",
        ],
        formulas: [
          "lim(x→a) (xⁿ - aⁿ)/(x - a) = n · aⁿ⁻¹",
          "lim(x→0) (sin x)/x = 1",
          "lim(x→0) (1 - cos x)/x = 0",
          "f'(x) = lim(h→0) [f(x+h) - f(x)] / h",
          "d/dx (xⁿ) = n · xⁿ⁻¹",
          "(u ± v)' = u' ± v'",
        ],
        questions: [
          "Evaluate lim(x→2) (x² - 4) / (x - 2).",
          "Find the derivative of f(x) = x³ from first principles.",
          "Evaluate lim(x→0) (sin 3x) / x.",
          "Find d/dx (3x² + 2x + 1).",
        ],
      },
      {
        id: "m14",
        title: "Mathematical Reasoning",
        summary:
          "Mathematically acceptable statements, logical connectives, and the validation of statements.",
        concepts: [
          "Mathematically acceptable statements",
          "Compound statements with connectives (and, or, not, if-then, iff)",
          "Quantifiers (there exists, for all)",
          "Implications and contrapositive",
          "Validating statements",
        ],
        questions: [
          "Check whether 'The sum of two odd numbers is even' is a statement.",
          "Write the contrapositive of: 'If x = 2, then x² = 4'.",
          "Identify the connective in: 'It is raining or it is cold.'",
          "What is a quantifier? Give an example.",
        ],
      },
      {
        id: "m15",
        title: "Statistics",
        summary:
          "Measures of dispersion — range, mean deviation, variance, and standard deviation of ungrouped and grouped data.",
        concepts: [
          "Measures of dispersion: range, mean deviation",
          "Mean deviation about mean and median",
          "Variance and standard deviation",
          "Shortcut method for variance",
          "Analysis of frequency distributions",
        ],
        formulas: [
          "Mean deviation = (Σ|xᵢ - x̄|) / n",
          "σ² = (Σ(xᵢ - x̄)²) / n",
          "σ = √variance",
          "σ² = (Σxᵢ²/n) - (x̄)²",
          "Coefficient of variation = (σ / mean) × 100",
        ],
        questions: [
          "Find the mean deviation about the mean for: 2, 4, 6, 8, 10.",
          "Find the variance of: 4, 8, 10, 12, 16.",
          "Define standard deviation.",
          "If the CV of series A is 20 and that of series B is 25, which series is more consistent?",
        ],
      },
      {
        id: "m16",
        title: "Probability",
        summary:
          "Random experiments, sample space, events, and the axiomatic (and classical) approach to probability.",
        concepts: [
          "Random experiments and sample space",
          "Events (simple, compound, sure, impossible)",
          "Algebra of events",
          "Axiomatic approach to probability",
          "Classical definition and P(A∪B)",
        ],
        formulas: [
          "0 ≤ P(A) ≤ 1",
          "P(∅) = 0, P(S) = 1",
          "P(A∪B) = P(A) + P(B) - P(A∩B)",
          "P(A') = 1 - P(A)",
          "P(A|B) = P(A∩B) / P(B)",
        ],
        questions: [
          "A die is rolled. Find P(prime number).",
          "Two coins are tossed. Find P(at least one head).",
          "A card is drawn from a pack of 52. Find P(king).",
          "If P(A) = 0.3, P(B) = 0.4 and P(A∩B) = 0.2, find P(A∪B).",
        ],
      },
    ],
  },

  // ============================ COMPUTER SCIENCE ============================
  {
    id: "cs",
    name: "Computer Science",
    icon: "💻",
    color: "from-purple-500 to-fuchsia-500",
    accent: "#a855f7",
    chapters: [
      {
        id: "cs1",
        title: "Computer System",
        summary:
          "Components of a computer system — input/output devices, CPU, memory, and the role of software.",
        concepts: [
          "Input and output devices",
          "CPU (ALU, Control Unit, registers)",
          "Memory: primary (RAM, ROM) and secondary",
          "Hardware vs software",
          "Booting and operating system basics",
        ],
        questions: [
          "Differentiate between RAM and ROM.",
          "What is the role of the ALU in the CPU?",
          "List three input and three output devices.",
          "Define system software with examples.",
        ],
      },
      {
        id: "cs2",
        title: "Number System and Conversion",
        summary:
          "Binary, octal, decimal and hexadecimal number systems and the conversions between them.",
        concepts: [
          "Decimal, binary, octal and hexadecimal systems",
          "Decimal-to-binary conversion (and vice versa)",
          "Binary-to-octal/hex conversion",
          "Binary arithmetic (addition and subtraction)",
          "Encoding: ASCII and Unicode",
        ],
        questions: [
          "Convert 25 (decimal) to binary.",
          "Convert 1011 (binary) to decimal.",
          "Add: 1011 + 1101 in binary.",
          "Convert AF (hex) to decimal.",
        ],
      },
      {
        id: "cs3",
        title: "Data Handling",
        summary:
          "Representation of data — bits, bytes, encoding schemes, and data compression.",
        concepts: [
          "Bits, bytes and words",
          "Data representation of integers (signed and unsigned)",
          "Floating-point representation",
          "Boolean data and characters (ASCII, Unicode)",
          "Data compression (lossless, lossy)",
        ],
        questions: [
          "How many bits are there in one byte?",
          "What is ASCII? Give the ASCII value of 'A'.",
          "Differentiate between lossless and lossy compression.",
          "Represent -5 in 8-bit signed-magnitude form.",
        ],
      },
      {
        id: "cs4",
        title: "Boolean Logic",
        summary:
          "Boolean algebra, logic gates, truth tables, and the basic Boolean laws.",
        concepts: [
          "Boolean values and operations (AND, OR, NOT)",
          "Truth tables",
          "Logic gates (AND, OR, NOT, NAND, NOR, XOR)",
          "Boolean expressions and laws",
          "De Morgan's theorems",
        ],
        formulas: [
          "A · A = A (idempotent)",
          "A + 0 = A (identity)",
          "A · (A + B) = A (absorption)",
          "(A · B)' = A' + B' (De Morgan)",
        ],
        questions: [
          "Draw the truth table for an AND gate.",
          "State De Morgan's theorems.",
          "Simplify: A + A · B.",
          "Draw the symbol for a NAND gate.",
        ],
      },
      {
        id: "cs5",
        title: "Introducing Python",
        summary:
          "Introduction to Python, its features, IDEs, and the basic structure of a Python program.",
        concepts: [
          "Features of Python (high-level, interpreted, object-oriented)",
          "Python IDEs (IDLE, Spyder, Jupyter)",
          "Tokens: keywords, identifiers, literals",
          "Comments and indentation",
          "Executing a Python program",
        ],
        questions: [
          "List three features of Python.",
          "What is the role of indentation in Python?",
          "What are keywords? Give two examples.",
          "Differentiate between compiled and interpreted languages.",
        ],
      },
      {
        id: "cs6",
        title: "Programming Methodology",
        summary:
          "Programming style, documentation, debugging, and the characteristics of a good program.",
        concepts: [
          "Characteristics of a good program",
          "Stages of program development",
          "Flowcharts and pseudocode",
          "Debugging: syntax, runtime and logical errors",
          "Documentation and comments",
        ],
        questions: [
          "List three characteristics of a good program.",
          "Differentiate between syntax errors and logical errors.",
          "What is a flowchart? Draw one for finding the larger of two numbers.",
          "Why is documentation important in programming?",
        ],
      },
      {
        id: "cs7",
        title: "Data Types and Operators",
        summary:
          "Python data types, mutable and immutable types, and operators with their precedence.",
        concepts: [
          "Python data types (int, float, complex, bool, str)",
          "Mutable vs immutable types",
          "type() and type conversion",
          "Operators: arithmetic, relational, logical, assignment",
          "Operator precedence and associativity",
        ],
        questions: [
          "List Python's standard data types.",
          "Differentiate between mutable and immutable types with examples.",
          "What is the output of: 10 // 3?",
          "State the difference between == and is operators.",
        ],
      },
      {
        id: "cs8",
        title: "Conditional and Iterative Statements",
        summary:
          "Decision-making (if-elif-else) and looping (for, while) constructs in Python.",
        concepts: [
          "if, if-else, if-elif-else statements",
          "for loop and range()",
          "while loop",
          "break, continue, pass",
          "Nested loops",
        ],
        questions: [
          "Write a Python program to check whether a number is even or odd.",
          "Differentiate between the for and while loops.",
          "What does the break statement do?",
          "Write a Python program to print the first 10 natural numbers using a while loop.",
        ],
      },
      {
        id: "cs9",
        title: "Strings",
        summary:
          "Python strings — creation, indexing, slicing, methods, and operations.",
        concepts: [
          "Creating and accessing strings",
          "String indexing and slicing",
          "String concatenation and repetition",
          "String methods (upper, lower, find, split, replace)",
          "Traversing strings and immutability",
        ],
        questions: [
          "Write a Python statement to find the length of a string s.",
          "Differentiate between strings and lists.",
          "What is slicing? Give the output of 'Python'[1:4].",
          "Write a program to count the vowels in a string.",
        ],
      },
      {
        id: "cs10",
        title: "Lists",
        summary:
          "Python lists — creation, indexing, slicing, methods, and list comprehensions.",
        concepts: [
          "Creating and accessing lists",
          "List indexing, slicing and traversal",
          "List methods (append, insert, remove, sort, reverse, pop)",
          "List comprehensions",
          "Nested lists",
        ],
        questions: [
          "Write a Python statement to add an element to the end of a list L.",
          "Differentiate between append() and extend().",
          "Write a list comprehension to create the squares of 1 to 5.",
          "Reverse the list [1, 2, 3, 4] using slicing.",
        ],
      },
      {
        id: "cs11",
        title: "Tuples",
        summary:
          "Python tuples — immutable sequences, operations, methods, and tuple packing/unpacking.",
        concepts: [
          "Creating and accessing tuples",
          "Immutability of tuples",
          "Tuple operations and methods (count, index)",
          "Tuple packing and unpacking",
          "Tuples vs lists",
        ],
        questions: [
          "Why are tuples called immutable?",
          "Write a Python statement to create a tuple with a single element.",
          "Differentiate between tuples and lists.",
          "What is tuple unpacking? Give an example.",
        ],
      },
      {
        id: "cs12",
        title: "Dictionaries",
        summary:
          "Python dictionaries — key-value pairs, built-in methods, and iteration.",
        concepts: [
          "Creating and accessing dictionaries",
          "Keys and values; immutable keys",
          "Dictionary methods (keys, values, items, get, update, pop)",
          "Traversing dictionaries",
          "Nested dictionaries",
        ],
        questions: [
          "Differentiate between a list and a dictionary.",
          "Write a Python statement to access the value for key 'name' in dictionary D.",
          "What will D.keys() return for D = {'a': 1, 'b': 2}?",
          "Write a Python program to count the frequency of characters in a string using a dictionary.",
        ],
      },
      {
        id: "cs13",
        title: "Functions",
        summary:
          "User-defined functions, arguments, return values, scope of variables, and recursion in Python.",
        concepts: [
          "Defining and calling functions",
          "Parameters and arguments (default, keyword, variable-length)",
          "The return statement",
          "Scope of variables (local, global, nonlocal)",
          "Recursion",
        ],
        questions: [
          "Differentiate between arguments and parameters.",
          "Write a Python function to find the factorial of n using recursion.",
          "Differentiate between local and global variables.",
          "Write a function to check whether a number is prime.",
        ],
      },
      {
        id: "cs14",
        title: "File Handling",
        summary:
          "Reading and writing text and binary files in Python, including the use of the with statement.",
        concepts: [
          "File types (text, binary)",
          "Opening and closing files (open, close)",
          "Reading and writing text files (read, readline, readlines, write)",
          "File modes (r, w, a, rb, wb)",
          "The with statement and error handling",
        ],
        questions: [
          "Differentiate between text and binary files.",
          "Write a Python statement to open the file 'data.txt' in read mode.",
          "What is the use of the 'with' statement in file handling?",
          "Write a Python program to count the number of lines in a text file.",
        ],
      },
      {
        id: "cs15",
        title: "Modules",
        summary:
          "Python modules — importing, standard library modules, and creating custom modules.",
        concepts: [
          "What is a module and its need",
          "The import statement and from-import",
          "Standard library modules (math, random, statistics, datetime)",
          "Creating and using custom modules",
          "Module search path (sys.path)",
        ],
        questions: [
          "What is a module in Python?",
          "Write a Python statement to import only the sqrt function from the math module.",
          "List three standard library modules.",
          "Write a Python program that uses the random module to roll a die.",
        ],
      },
    ],
  },

  // ============================ ENGLISH ============================
  {
    id: "english",
    name: "English",
    icon: "📚",
    color: "from-rose-500 to-pink-500",
    accent: "#f43f5e",
    chapters: [
      {
        id: "e1",
        title: "The Portrait of a Lady (Hornbill)",
        summary:
          "Khushwant Singh's nostalgic memoir of his grandmother and the changing bond between them over the years.",
        concepts: [
          "Theme of generation gap",
          "Character sketch of the grandmother",
          "Symbolism of the portrait",
          "Narrator-grandmother bond",
          "Loss and acceptance",
        ],
        questions: [
          "Describe the grandfather's portrait as mentioned in the lesson.",
          "Why was the grandmother disturbed when the narrator went to the city?",
          "How did the grandmother spend her time after the narrator went abroad?",
          "Explain the title 'The Portrait of a Lady'.",
        ],
      },
      {
        id: "e2",
        title: "We're Not Afraid to Die (Hornbill)",
        summary:
          "A first-person account of a family's survival when their boat Wavewalker is damaged in the Southern Indian Ocean.",
        concepts: [
          "Adventure and courage",
          "Family bonding under crisis",
          "Survival at sea",
          "Role of Jonathan and Suzanne",
          "Hope and optimism",
        ],
        questions: [
          "What was the destination of the narrator's voyage?",
          "How did Suzanne show courage during the disaster?",
          "Describe the damage to the Wavewalker.",
          "What message does the chapter convey about courage?",
        ],
      },
      {
        id: "e3",
        title: "Discovering Tut (Hornbill)",
        summary:
          "A.R. Williams describes the life and death of King Tutankhamun and the scientific investigation of his mummy using CT scans.",
        concepts: [
          "Historical mystery of King Tut",
          "CT scan of the mummy",
          "Significance of Tut's treasures",
          "Archaeology and modern science",
          "Egyptian civilization",
        ],
        questions: [
          "Who was King Tutankhamun?",
          "Why was Tut's body subjected to a CT scan?",
          "What treasures were found in Tut's tomb?",
          "How does science help in unravelling history?",
        ],
      },
      {
        id: "e4",
        title: "Landscape of the Soul (Hornbill)",
        summary:
          "Nathalie Trouveroy contrasts Chinese and European approaches to art through the concepts of shanshui and illusionistic painting.",
        concepts: [
          "Chinese painting — shanshui",
          "European painting — illusionistic",
          "Role of the painter vs the viewer",
          "Concept of 'outsider' and 'middle way'",
          "Quintessential Chinese art vs Western art",
        ],
        questions: [
          "What does shanshui literally mean?",
          "Differentiate between Chinese and European landscape painting.",
          "What is the role of the 'middle way' in Chinese art?",
          "Explain the concept of the 'outsider' in Chinese painting.",
        ],
      },
      {
        id: "e5",
        title: "The Ailing Planet (Hornbill)",
        summary:
          "Nani Palkhivala highlights the environmental crisis and the urgent need for sustainable development.",
        concepts: [
          "Green movement and the concept of sustainability",
          "Depletion of natural resources",
          "Role of industry and population growth",
          "Concept of 'Our Common Future'",
          "Eco-feminism and ecological responsibility",
        ],
        questions: [
          "Why is the Earth called an ailing planet?",
          "What is the Green Movement?",
          "What does the author mean by 'sustainable development'?",
          "Why does the author refer to the 'World Conservation Strategy'?",
        ],
      },
      {
        id: "e6",
        title: "The Browning Version (Hornbill)",
        summary:
          "Terence Rattigan's play excerpt portrays the touching moment when student Taplow shows affection for his retiring teacher Crocker-Harris.",
        concepts: [
          "Student-teacher relationship",
          "Character of Crocker-Harris",
          "Taplow's affection",
          "Humour and pathos",
          "Contrast with other teachers",
        ],
        questions: [
          "Who is Taplow?",
          "Why does Taplow like Mr. Crocker-Harris despite his strictness?",
          "What is the significance of the title?",
          "How does Taplow differ from the usual student?",
        ],
      },
      {
        id: "e7",
        title: "The Adventure (Hornbill)",
        summary:
          "Jayant Narlikar's science-fiction narrative of Professor Gangadharpant Gaitonde's transition to a parallel world where the Marathas won the Battle of Panipat.",
        concepts: [
          "Concept of parallel worlds",
          "Historical speculation (Battle of Panipat)",
          "Role of catastrophe theory",
          "Reality vs illusion",
          "Science and history interplay",
        ],
        questions: [
          "Who was Professor Gangadharpant Gaitonde?",
          "What was the professor's experience at Azad Maidan?",
          "Explain the concept of a parallel world in the story.",
          "Why did Gaitonde decide not to deliver the presidential address?",
        ],
      },
      {
        id: "e8",
        title: "Silk Road (Hornbill)",
        summary:
          "Nick Middleton travels from Ravu to Mount Kailash through Tibet, tracing the ancient trade route known as the Silk Road.",
        concepts: [
          "Travelogue through Tibet",
          "Description of nomadic life",
          "Significance of Mount Kailash",
          "Cultural and geographical details",
          "Hardships of high-altitude travel",
        ],
        questions: [
          "Why was the author going to Mount Kailash?",
          "Describe the author's experience at Hor.",
          "What is the significance of the Silk Road?",
          "How did the author feel at the height of 5215 metres?",
        ],
      },
      {
        id: "e9",
        title: "The Summer of the Beautiful White Horse (Snapshots)",
        summary:
          "William Saroyan's tale of two Armenian boys who steal a horse but return it out of a sense of honour.",
        concepts: [
          "Tribe of Garoghlanian — honesty and integrity",
          "Mourad's character — love for animals",
          "Aram's innocence",
          "Theme of honour and morality",
          "Elements of magic realism",
        ],
        questions: [
          "Who were Aram and Mourad?",
          "Why was the tribe of Garoghlanian famous?",
          "Why did the boys return the horse?",
          "What does the white horse symbolize?",
        ],
      },
      {
        id: "e10",
        title: "The Address (Snapshots)",
        summary:
          "Marga Minco's poignant story of a woman who retrieves her family's belongings from a woman who kept them during the war, only to choose to leave them behind.",
        concepts: [
          "Theme of war and displacement",
          "Mrs. Dorling's character",
          "Significance of the address",
          "Emotional conflict of the narrator",
          "Choice to forget the past",
        ],
        questions: [
          "Who was Mrs. Dorling?",
          "Why did the narrator go to the address?",
          "What did the narrator decide in the end? Why?",
          "Explain the significance of the title 'The Address'.",
        ],
      },
      {
        id: "e11",
        title: "Ranga's Marriage (Snapshots)",
        summary:
          "Masti Venkatesha Iyengar's humorous story of how a village clerk arranges Ranga's marriage with Ratna using clever manipulation.",
        concepts: [
          "Tradition vs modernity in marriage",
          "Character of Shyama (the narrator)",
          "Ranga's views on marriage",
          "Role of astrology in the plot",
          "Humour and social commentary",
        ],
        questions: [
          "Who was Ranga?",
          "What were Ranga's views on marriage?",
          "How did Shyama plan Ranga's marriage with Ratna?",
          "What role did the Shastri play in the story?",
        ],
      },
      {
        id: "e12",
        title: "Albert Einstein at School (Snapshots)",
        summary:
          "Patrick Pringle's account of young Einstein's hatred for the school's rigid education system and his eventual departure.",
        concepts: [
          "Critique of mechanical education",
          "Einstein's dislike of rote learning",
          "Role of his teacher Braun",
          "Einstein's love for geometry and music",
          "Yuri's role as friend",
        ],
        questions: [
          "Why did Einstein hate school?",
          "How did Einstein's teacher Mr. Braun insult him?",
          "What role did Yuri play in Einstein's life?",
          "How did Einstein finally manage to leave school?",
        ],
      },
      {
        id: "e13",
        title: "Mother's Day (Snapshots)",
        summary:
          "J.B. Priestley's comic play where a spirited old mother exchanges bodies with her daughter-in-law to teach her family a lesson.",
        concepts: [
          "Theme of women's empowerment",
          "Mrs. Pearson and Mrs. Fitzgerald",
          "Body-swap as a comic device",
          "Family dynamics and respect for mothers",
          "Humour and message",
        ],
        questions: [
          "Who is Mrs. Pearson?",
          "How did Mrs. Fitzgerald help Mrs. Pearson?",
          "Why did the family change their attitude at the end?",
          "What is the central message of the play?",
        ],
      },
      {
        id: "e14",
        title: "The Ghat of the Only World (Snapshots)",
        summary:
          "Amitav Ghosh's touching tribute to his friend Agha Shahid Ali, the Kashmiri poet, written as a promise before his death.",
        concepts: [
          "Tribute to Agha Shahid Ali",
          "Theme of friendship and loss",
          "Kashmir and memory",
          "Shahid's love of food, music and poetry",
          "Acceptance of death with grace",
        ],
        questions: [
          "Who was Agha Shahid Ali?",
          "What promise did the author make to Shahid?",
          "Why was Shahid 'the only world' for the author?",
          "How does the author portray Shahid's love for Kashmir?",
        ],
      },
      {
        id: "e15",
        title: "Birth (Snapshots)",
        summary:
          "A.J. Cronin's story where Andrew Manson, a young doctor, dramatically saves both a stillborn baby and its mother through determined effort.",
        concepts: [
          "Andrew Manson's character — dedication",
          "Conflict between hope and despair",
          "Medical miracle",
          "Theme of responsibility",
          "Triumph of skill and perseverance",
        ],
        questions: [
          "Who was Andrew Manson?",
          "What was the condition of the baby when born?",
          "How did Andrew save the baby?",
          "What is the significance of the title 'Birth'?",
        ],
      },
    ],
  },
];

export const ALL_SUBJECTS_CLASS11 = CURRICULUM_CLASS11;
export const TOTAL_CHAPTERS_CLASS11 = CURRICULUM_CLASS11.reduce(
  (a, s) => a + s.chapters.length,
  0
);

export function getSubjectClass11(id: string): Subject | undefined {
  return CURRICULUM_CLASS11.find((s) => s.id === id);
}

export function getChapterClass11(
  subjectId: string,
  chapterId: string
): Chapter | undefined {
  return getSubjectClass11(subjectId)?.chapters.find((c) => c.id === chapterId);
}

export default CURRICULUM_CLASS11;
