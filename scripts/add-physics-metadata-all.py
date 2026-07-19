#!/usr/bin/env python3
"""Add rich metadata to ALL 15 Physics chapters (p3-p15, since p1-p2 already done)."""

FILE = "/home/z/my-project/scholar/src/lib/curriculum-class11.ts"

METADATA = {
    "p3": {
        "overview": "This chapter introduces kinematics — the description of motion without regard to causes. It covers displacement, velocity, acceleration, the equations of uniformly accelerated motion, and relative velocity in one dimension.",
        "learningObjectives": [
            "Distinguish between distance, displacement, speed, and velocity",
            "Derive and apply the three kinematic equations for uniform acceleration",
            "Interpret position-time, velocity-time, and acceleration-time graphs",
            "Calculate relative velocity in one dimension",
            "Solve problems involving free fall under gravity",
        ],
        "prerequisites": ["Basic calculus (limits, derivatives)", "Graph interpretation", "Algebra"],
        "estimatedTime": "6-8 hours",
        "difficulty": "Medium",
        "boardWeightage": "5 marks",
        "jeeWeightage": "1-2 questions",
        "quickSummary": [
            "Displacement is the shortest path from start to end (vector); distance is total path (scalar)",
            "Average velocity = displacement/time; Instantaneous velocity = dx/dt",
            "Kinematic equations: v=u+at, s=ut+1/2at^2, v^2=u^2+2as",
            "Under free fall: a = g = 9.8 m/s^2 downward",
            "Relative velocity: v_AB = v_A - v_B",
        ],
        "importantDefinitions": [
            {"term": "Displacement", "definition": "The change in position of an object; a vector from initial to final position."},
            {"term": "Instantaneous velocity", "definition": "The velocity of an object at a specific instant; dx/dt."},
            {"term": "Uniform acceleration", "definition": "Constant acceleration — velocity changes by equal amounts in equal time intervals."},
            {"term": "Relative velocity", "definition": "The velocity of one object as observed from another: v_AB = v_A - v_B."},
            {"term": "Free fall", "definition": "Motion under gravity alone (no air resistance), a = g = 9.8 m/s^2."},
        ],
        "commonMistakes": [
            "Confusing distance with displacement — returning to start gives zero displacement but non-zero distance",
            "Sign errors in free fall — if upward is positive, g = -9.8 m/s^2",
            "Forgetting that the area under a v-t graph gives displacement, not distance",
            "Using v = u + at when acceleration is NOT uniform",
        ],
        "examTips": [
            "Always choose a sign convention and stick to it",
            "Draw a v-t graph for multi-stage motion problems",
            "For ball thrown upward: at max height v=0; time up = time down",
            "Practise relative velocity problems (trains passing each other)",
        ],
        "frequentlyConfused": [
            {"a": "Average speed", "b": "Average velocity", "distinction": "Average speed = total distance / total time (scalar); Average velocity = displacement / time (vector)."},
            {"a": "Instantaneous velocity", "b": "Average velocity", "distinction": "Instantaneous is at one moment (dx/dt); average is over a time interval."},
        ],
    },
    "p4": {
        "overview": "Extends kinematics to two dimensions using vector algebra. Covers projectile motion, uniform circular motion, and relative velocity in two dimensions.",
        "learningObjectives": [
            "Add and resolve vectors using triangle, parallelogram, and component methods",
            "Analyse projectile motion as independent horizontal and vertical motions",
            "Derive and apply equations for range, maximum height, and time of flight",
            "Describe uniform circular motion in terms of centripetal acceleration",
            "Calculate relative velocity in two dimensions",
        ],
        "prerequisites": ["Motion in a Straight Line (p3)", "Basic trigonometry", "Pythagoras theorem"],
        "estimatedTime": "7-9 hours",
        "difficulty": "Medium",
        "boardWeightage": "5 marks",
        "jeeWeightage": "2-3 questions",
        "quickSummary": [
            "Vectors have magnitude and direction; scalars have magnitude only",
            "Projectile: horizontal (constant v) + vertical (constant a = -g) are independent",
            "Range R = u^2 sin(2theta)/g; Max height H = u^2 sin^2(theta)/2g; Time T = 2u sin(theta)/g",
            "Maximum range occurs at theta = 45 degrees",
            "Centripetal acceleration a_c = v^2/r, directed toward centre",
        ],
        "importantDefinitions": [
            {"term": "Vector", "definition": "A quantity with both magnitude and direction, obeying the triangle/parallelogram law of addition."},
            {"term": "Projectile", "definition": "An object thrown into space that moves under gravity alone, following a parabolic path."},
            {"term": "Centripetal acceleration", "definition": "The acceleration of an object in circular motion, directed toward the centre: a_c = v^2/r."},
            {"term": "Range of projectile", "definition": "The horizontal distance travelled by a projectile: R = u^2 sin(2theta)/g."},
            {"term": "Uniform circular motion", "definition": "Motion in a circle at constant speed; velocity direction changes continuously."},
        ],
        "commonMistakes": [
            "Treating horizontal and vertical motions as dependent — they are independent",
            "Using the wrong angle in range formula — it is sin(2theta), not sin(theta)",
            "Forgetting that centripetal acceleration is perpendicular to velocity",
            "Sign errors when resolving vectors — use consistent angle reference",
        ],
        "examTips": [
            "Break projectile problems into horizontal (constant velocity) and vertical (constant acceleration) components",
            "Memorise R, H, T formulas — they appear in every exam",
            "For complementary angles (theta and 90-theta), ranges are equal",
            "JEE: practise projectile on an incline and from a height",
        ],
        "frequentlyConfused": [
            {"a": "Speed", "b": "Velocity", "distinction": "Speed = |velocity|, a scalar. In circular motion, speed is constant but velocity changes direction."},
            {"a": "Centripetal force", "b": "Centrifugal force", "distinction": "Centripetal is real, directed inward; centrifugal is a pseudo-force in rotating frames, directed outward."},
        ],
    },
    "p5": {
        "overview": "Newton's three laws of motion form the foundation of classical mechanics. Covers inertia, force, momentum, friction, and conservation of linear momentum.",
        "learningObjectives": [
            "State and apply Newton's three laws of motion",
            "Draw free-body diagrams and solve problems using them",
            "Analyse static and kinetic friction, including on inclined planes",
            "Apply the principle of conservation of linear momentum",
            "Solve problems involving pulleys, connected bodies, and circular motion",
        ],
        "prerequisites": ["Motion in a Straight Line (p3)", "Motion in a Plane (p4)", "Vector algebra"],
        "estimatedTime": "8-10 hours",
        "difficulty": "Hard",
        "boardWeightage": "7 marks",
        "jeeWeightage": "2-3 questions",
        "quickSummary": [
            "First Law (Inertia): body stays at rest or in uniform motion unless net external force acts",
            "Second Law: F = ma = dp/dt",
            "Third Law: every action has an equal and opposite reaction (on different bodies)",
            "Friction: f_s <= mu_s N (static), f_k = mu_k N (kinetic)",
            "Conservation of momentum: if no external force, total momentum is constant",
            "Impulse = F*dt = dp (change in momentum)",
        ],
        "importantDefinitions": [
            {"term": "Inertia", "definition": "The tendency of a body to resist changes in its state of rest or uniform motion."},
            {"term": "Force", "definition": "An external agency that changes or tends to change the state of rest or uniform motion of a body."},
            {"term": "Momentum", "definition": "The product of mass and velocity (p = mv); a vector quantity."},
            {"term": "Friction", "definition": "The contact force that opposes relative motion between two surfaces."},
            {"term": "Impulse", "definition": "The product of force and the time for which it acts; equals change in momentum."},
            {"term": "Free-body diagram", "definition": "A diagram showing all forces acting on a single isolated body."},
        ],
        "commonMistakes": [
            "Forgetting that action and reaction act on DIFFERENT bodies — they don't cancel",
            "Confusing static friction (variable, up to mu_s N) with kinetic friction (constant, mu_k N)",
            "Not drawing free-body diagrams before writing equations",
            "Using N = mg on inclined planes — should be N = mg cos(theta)",
            "Using F = ma instead of F = dp/dt for variable-mass systems (rockets)",
        ],
        "examTips": [
            "ALWAYS draw a free-body diagram before solving force problems",
            "On inclined plane: resolve weight into mg sin(theta) along plane and mg cos(theta) perpendicular",
            "For connected bodies (Atwood machine): write equations for EACH body separately",
            "Conservation of momentum is key for collision and explosion problems",
            "JEE: practise spring-block systems and pulley problems with friction",
        ],
        "frequentlyConfused": [
            {"a": "Mass", "b": "Weight", "distinction": "Mass = amount of matter (kg, scalar, constant); Weight = mg (N, vector, depends on g)."},
            {"a": "Static friction", "b": "Kinetic friction", "distinction": "Static prevents motion (up to mu_s N); kinetic acts during motion (= mu_k N). mu_s > mu_k."},
        ],
    },
    "p6": {
        "overview": "Explores work, kinetic energy, potential energy, and power. Covers the work-energy theorem, conservative and non-conservative forces, and collisions.",
        "learningObjectives": [
            "Define and calculate work done by constant and variable forces",
            "State and prove the work-energy theorem",
            "Distinguish conservative and non-conservative forces with examples",
            "Apply conservation of mechanical energy to solve problems",
            "Analyse elastic and inelastic collisions in one and two dimensions",
        ],
        "prerequisites": ["Laws of Motion (p5)", "Basic integration", "Motion in a Straight Line (p3)"],
        "estimatedTime": "7-9 hours",
        "difficulty": "Hard",
        "boardWeightage": "7 marks",
        "jeeWeightage": "2-3 questions",
        "quickSummary": [
            "Work W = F.d.cos(theta) (scalar product of force and displacement)",
            "Kinetic energy KE = 1/2 mv^2; Work-energy theorem: W_net = delta KE",
            "Potential energy: gravitational PE = mgh; spring PE = 1/2 kx^2",
            "Conservative force: work is path-independent (gravity, spring); non-conservative: friction",
            "Power P = W/t = F.v; SI unit: watt (W)",
            "Elastic collision: momentum AND KE conserved; Inelastic: only momentum",
        ],
        "importantDefinitions": [
            {"term": "Work", "definition": "The scalar product of force and displacement: W = F.d.cos(theta). SI unit: joule (J)."},
            {"term": "Kinetic energy", "definition": "The energy possessed by a body due to its motion: KE = 1/2 mv^2."},
            {"term": "Potential energy", "definition": "The energy stored due to position or configuration (mgh, 1/2 kx^2)."},
            {"term": "Conservative force", "definition": "A force for which work done around any closed path is zero (gravity, spring force)."},
            {"term": "Power", "definition": "The rate of doing work: P = W/t. SI unit: watt (W) = J/s."},
            {"term": "Elastic collision", "definition": "A collision in which both momentum and kinetic energy are conserved."},
        ],
        "commonMistakes": [
            "Forgetting work is zero when force is perpendicular to displacement (theta = 90)",
            "Confusing KE (1/2 mv^2) with momentum (mv) — KE is scalar, momentum is vector",
            "Applying conservation of energy when friction is present without accounting for energy loss",
            "Forgetting that in perfectly inelastic collision, bodies stick together",
            "Using P = W/t for variable power — should use P = dW/dt = F.v",
        ],
        "examTips": [
            "Work-energy theorem is a shortcut — use it instead of kinematic equations for force-displacement problems",
            "For collisions: ALWAYS check if momentum is conserved (no external force)",
            "Elastic 1D formulas: v1 = (m1-m2)u1/(m1+m2), v2 = 2m1u1/(m1+m2)",
            "JEE: practise variable force work (integration), spring-block, and 2D collisions",
        ],
        "frequentlyConfused": [
            {"a": "Energy", "b": "Power", "distinction": "Energy = capacity to do work (J); Power = rate of energy transfer (W = J/s)."},
            {"a": "Elastic collision", "b": "Inelastic collision", "distinction": "Elastic conserves both KE and momentum; inelastic conserves only momentum (KE is lost)."},
        ],
    },
    "p7": {
        "overview": "Extends mechanics to systems of particles and rigid bodies. Covers centre of mass, torque, angular momentum, moment of inertia, and rotational dynamics.",
        "learningObjectives": [
            "Locate the centre of mass of two-particle and symmetric rigid body systems",
            "Define and calculate torque and angular momentum",
            "Apply the rotational analogue of Newton's second law: tau = I*alpha",
            "Calculate moment of inertia for standard geometries using parallel and perpendicular axis theorems",
            "Apply conservation of angular momentum to solve problems",
        ],
        "prerequisites": ["Laws of Motion (p5)", "Work, Energy and Power (p6)", "Vectors"],
        "estimatedTime": "10-12 hours",
        "difficulty": "Hard",
        "boardWeightage": "8 marks",
        "jeeWeightage": "3-4 questions",
        "quickSummary": [
            "Centre of mass: R_cm = sum(m_i r_i) / sum(m_i)",
            "Torque tau = r x F; angular momentum L = r x p = I*omega",
            "Rotational Newton's 2nd law: tau = I*alpha",
            "Moment of inertia: rod (mL^2/12), disc (mR^2/2), solid sphere (2mR^2/5)",
            "Parallel axis: I = I_cm + Md^2; Perpendicular axis (planar): I_z = I_x + I_y",
            "Conservation of angular momentum: if tau_ext = 0, L is constant",
        ],
        "importantDefinitions": [
            {"term": "Centre of mass", "definition": "The point where the entire mass of a system can be assumed to be concentrated for translational motion."},
            {"term": "Torque", "definition": "The rotational analogue of force: tau = r x F. Causes angular acceleration."},
            {"term": "Angular momentum", "definition": "The rotational analogue of linear momentum: L = r x p = I*omega. Conserved if no external torque."},
            {"term": "Moment of inertia", "definition": "The rotational analogue of mass: I = sum(mr^2). Measures resistance to angular acceleration."},
            {"term": "Radius of gyration", "definition": "The distance k from axis where entire mass must be concentrated to give same I: I = Mk^2."},
        ],
        "commonMistakes": [
            "Confusing centre of mass with centre of gravity — they coincide only in uniform field",
            "Forgetting that moment of inertia depends on the axis",
            "Not using the right I formula — memorise standard shapes",
            "Mixing up parallel axis (I = I_cm + Md^2) with perpendicular axis (I_z = I_x + I_y, planar only)",
            "Forgetting angular momentum conservation (skater pulling arms in: I decreases, omega increases)",
        ],
        "examTips": [
            "Memorise standard moment of inertia formulas — needed in every rotational problem",
            "Parallel axis theorem: shifting from centre of mass to a parallel axis",
            "Conservation of angular momentum for spinning problems (skater, collapsing star)",
            "JEE: practise rolling without slipping (v = R*omega, KE = 1/2 mv^2 + 1/2 I*omega^2)",
        ],
        "frequentlyConfused": [
            {"a": "Torque", "b": "Force", "distinction": "Force causes linear acceleration (F=ma); torque causes angular acceleration (tau=I*alpha)."},
            {"a": "Moment of inertia", "b": "Mass", "distinction": "Mass resists linear acceleration; I resists angular acceleration and depends on mass distribution AND axis."},
        ],
    },
    "p8": {
        "overview": "Studies gravitational force. Covers Kepler's laws, Newton's law of universal gravitation, gravitational field and potential, escape velocity, orbital mechanics, and satellites.",
        "learningObjectives": [
            "State and apply Kepler's three laws of planetary motion",
            "Derive and apply Newton's law of universal gravitation",
            "Calculate gravitational field and potential for point masses and shells",
            "Derive and apply expressions for escape velocity and orbital velocity",
            "Analyse satellite motion, including geostationary orbits",
        ],
        "prerequisites": ["Laws of Motion (p5)", "Work, Energy and Power (p6)", "Circular motion (p4)"],
        "estimatedTime": "8-10 hours",
        "difficulty": "Hard",
        "boardWeightage": "6 marks",
        "jeeWeightage": "2-3 questions",
        "quickSummary": [
            "Newton's law: F = Gm1m2/r^2, G = 6.674e-11 N m^2/kg^2",
            "Kepler's 3rd law: T^2 proportional to r^3",
            "Gravitational field g = GM/r^2; potential V = -GM/r",
            "Escape velocity v_e = sqrt(2GM/R) = sqrt(2gR) = 11.2 km/s for Earth",
            "Orbital velocity v_o = sqrt(GM/r) = sqrt(gR) for near-Earth orbit",
            "Total energy of satellite = -GMm/(2r) (negative = bound state)",
        ],
        "importantDefinitions": [
            {"term": "Universal gravitation", "definition": "Every particle attracts every other with F = Gm1m2/r^2 along the line joining them."},
            {"term": "Gravitational field", "definition": "The gravitational force per unit mass at a point: g = GM/r^2."},
            {"term": "Gravitational potential", "definition": "Work done per unit mass to bring a test mass from infinity: V = -GM/r."},
            {"term": "Escape velocity", "definition": "The minimum velocity to escape a gravitational field: v_e = sqrt(2GM/R)."},
            {"term": "Geostationary orbit", "definition": "An orbit at ~36,000 km with T = 24 h, appearing stationary relative to Earth."},
        ],
        "commonMistakes": [
            "Forgetting that gravitational potential is negative (zero at infinity)",
            "Confusing escape velocity (sqrt(2GM/R)) with orbital velocity (sqrt(GM/R)) — escape is sqrt(2) x orbital",
            "Not remembering that g inside a solid sphere decreases linearly: g proportional to r",
            "Forgetting Kepler's 3rd law is T^2 proportional to r^3, not T proportional to r^3",
            "Sign errors in total energy of satellite: TE = -GMm/(2r) (negative = bound)",
        ],
        "examTips": [
            "Memorise: v_e = 11.2 km/s (Earth), g = 9.8 m/s^2, G = 6.674e-11",
            "For satellites: KE = -TE = -PE/2 (virial theorem for 1/r^2 force)",
            "Geostationary: T = 24h, same direction as Earth's rotation, above equator, ~36,000 km",
            "JEE: practise variation of g with altitude, depth, and latitude",
        ],
        "frequentlyConfused": [
            {"a": "Gravitational field", "b": "Gravitational potential", "distinction": "Field = force per unit mass (vector, N/kg); Potential = work per unit mass (scalar, J/kg)."},
            {"a": "Escape velocity", "b": "Orbital velocity", "distinction": "Escape leaves the field (v_e = sqrt(2gR)); orbital stays in orbit (v_o = sqrt(gR)). v_e = sqrt(2) x v_o."},
        ],
    },
    "p9": {
        "overview": "Studies how solid materials deform under applied forces. Covers stress, strain, Hooke's law, Young's modulus, shear modulus, bulk modulus, and elastic potential energy.",
        "learningObjectives": [
            "Define stress and strain and distinguish between their types",
            "State and apply Hooke's law and the stress-strain curve",
            "Calculate Young's modulus, shear modulus, and bulk modulus",
            "Determine elastic potential energy stored in a deformed body",
            "Apply Poisson's ratio and understand elastic fatigue",
        ],
        "prerequisites": ["Laws of Motion (p5)", "Work, Energy and Power (p6)"],
        "estimatedTime": "5-6 hours",
        "difficulty": "Medium",
        "boardWeightage": "4 marks",
        "jeeWeightage": "1 question",
        "quickSummary": [
            "Stress = Force/Area (Pa); Strain = change/original (dimensionless)",
            "Hooke's law: stress proportional to strain (within elastic limit)",
            "Young's modulus Y = (F/A)/(dL/L); Shear modulus eta = (F/A)/theta; Bulk B = -P/(dV/V)",
            "Elastic PE per unit volume = 1/2 x stress x strain",
            "Poisson's ratio sigma = lateral strain / longitudinal strain",
        ],
        "importantDefinitions": [
            {"term": "Stress", "definition": "The restoring force per unit area inside a deformed body. Types: tensile, compressive, shear, hydraulic."},
            {"term": "Strain", "definition": "The ratio of change in dimension to original dimension. Dimensionless."},
            {"term": "Hooke's law", "definition": "Within the elastic limit, stress is directly proportional to strain."},
            {"term": "Young's modulus", "definition": "The ratio of longitudinal stress to longitudinal strain: Y = (F/A)/(dL/L)."},
            {"term": "Elastic limit", "definition": "The maximum stress beyond which the body does not return to its original shape."},
            {"term": "Poisson's ratio", "definition": "The ratio of lateral strain to longitudinal strain within the elastic limit."},
        ],
        "commonMistakes": [
            "Confusing stress (internal restoring force per area) with pressure (external force per area)",
            "Forgetting that strain is dimensionless",
            "Mixing up the three moduli: Y (stretching), eta (shearing), B (compression)",
            "Not reading the stress-strain curve correctly",
            "Forgetting the 1/2 factor in elastic PE: U = 1/2 x stress x strain x volume",
        ],
        "examTips": [
            "Memorise the three moduli and their formulas (Y, eta, B)",
            "Stress-strain curve: proportional limit, elastic limit, yield point, ultimate stress, breaking point",
            "Elastic PE: U = 1/2 x Y x strain^2 x volume = 1/2 x F x dL",
            "Medium-weightage chapter — focus on conceptual clarity and standard formulas",
        ],
        "frequentlyConfused": [
            {"a": "Stress", "b": "Pressure", "distinction": "Same units (Pa) but stress is internal restoring force per area; pressure is external force per area."},
            {"a": "Elastic limit", "b": "Proportional limit", "distinction": "Proportional limit = where stress-strain stops being linear; elastic limit = where deformation stops being reversible."},
        ],
    },
    "p10": {
        "overview": "Studies fluids at rest (hydrostatics) and in motion (hydrodynamics). Covers pressure, Pascal's law, Archimedes' principle, Bernoulli's principle, viscosity, surface tension, and capillarity.",
        "learningObjectives": [
            "Define pressure and apply Pascal's law to hydraulic systems",
            "State and apply Archimedes' principle and the law of floatation",
            "Apply the equation of continuity and Bernoulli's principle",
            "Describe viscosity and apply Stokes' law for terminal velocity",
            "Explain surface tension, surface energy, and capillary action",
        ],
        "prerequisites": ["Mechanical Properties of Solids (p9)", "Laws of Motion (p5)"],
        "estimatedTime": "7-8 hours",
        "difficulty": "Medium",
        "boardWeightage": "5 marks",
        "jeeWeightage": "1-2 questions",
        "quickSummary": [
            "Pressure P = F/A; depth pressure P = P0 + rho*g*h",
            "Pascal's law: pressure applied to enclosed fluid transmitted equally in all directions",
            "Archimedes: buoyant force = weight of fluid displaced",
            "Continuity: A1*v1 = A2*v2 (incompressible flow)",
            "Bernoulli: P + 1/2*rho*v^2 + rho*g*h = constant",
            "Terminal velocity v_t = 2r^2(rho-sigma)g/(9*eta); Capillary rise h = 2T*cos(theta)/(rho*g*r)",
        ],
        "importantDefinitions": [
            {"term": "Pressure", "definition": "Force per unit area acting perpendicular to a surface. SI unit: pascal (Pa)."},
            {"term": "Buoyancy", "definition": "The upward force on a body immersed in a fluid, equal to weight of fluid displaced."},
            {"term": "Bernoulli's principle", "definition": "For an ideal fluid in steady flow, P + 1/2*rho*v^2 + rho*g*h is constant."},
            {"term": "Viscosity", "definition": "The property of a fluid that opposes relative motion between its layers."},
            {"term": "Surface tension", "definition": "The force per unit length acting on the liquid surface: T = F/l."},
            {"term": "Capillarity", "definition": "The rise or fall of a liquid in a narrow tube due to surface tension: h = 2T*cos(theta)/(rho*g*r)."},
        ],
        "commonMistakes": [
            "Forgetting that pressure at same depth is same in all directions",
            "Confusing buoyant force with weight of body — buoyancy = weight of DISPLACED fluid",
            "Not understanding Bernoulli is conservation of energy — higher speed means lower pressure",
            "Sign errors in capillary rise: concave meniscus rises, convex meniscus falls",
            "Forgetting Stokes' law applies only for small spherical bodies at low Reynolds number",
        ],
        "examTips": [
            "Memorise: Bernoulli, continuity, terminal velocity, capillary rise formulas",
            "For floatation: weight = buoyant force; for sinking: weight > buoyant force",
            "Bernoulli applications: airplane wing (lift), venturi meter, Bunsen burner",
            "JEE: practise Reynolds number problems",
        ],
        "frequentlyConfused": [
            {"a": "Viscosity", "b": "Friction", "distinction": "Viscosity opposes relative motion between fluid LAYERS; friction opposes relative motion between solid SURFACES."},
            {"a": "Cohesion", "b": "Adhesion", "distinction": "Cohesion = attraction between same molecules; Adhesion = attraction between different molecules."},
        ],
    },
    "p11": {
        "overview": "Studies thermal expansion, heat transfer, calorimetry, and the gas laws. Covers linear/area/volume expansion, specific heat, latent heat, conduction, convection, radiation, and Newton's law of cooling.",
        "learningObjectives": [
            "Calculate linear, area, and volume thermal expansion",
            "Apply calorimetry principles to solve heat exchange problems",
            "Distinguish conduction, convection, and radiation",
            "Apply Newton's law of cooling to temperature decay problems",
            "Understand anomalous expansion of water and its significance",
        ],
        "prerequisites": ["Basic thermodynamics concepts", "Algebra"],
        "estimatedTime": "5-6 hours",
        "difficulty": "Medium",
        "boardWeightage": "4 marks",
        "jeeWeightage": "1 question",
        "quickSummary": [
            "Linear expansion: dL = L0*alpha*dT; Area: dA = A0*(2*alpha)*dT; Volume: dV = V0*(3*alpha)*dT",
            "Specific heat c = Q/(m*dT); Latent heat L = Q/m (no temp change during phase transition)",
            "Calorimetry: heat lost by hot = heat gained by cold",
            "Conduction: Q = kA(T1-T2)t/L; Convection: fluid motion; Radiation: EM waves",
            "Newton's law of cooling: dT/dt = -k(T - Ts); Stefan: E = sigma*T^4",
            "Anomalous expansion of water: 4C = minimum volume, maximum density",
        ],
        "importantDefinitions": [
            {"term": "Thermal expansion", "definition": "The increase in dimensions of a body due to increase in temperature."},
            {"term": "Specific heat capacity", "definition": "Heat required to raise 1 kg of substance by 1 K: c = Q/(m*dT)."},
            {"term": "Latent heat", "definition": "Heat required to change state without changing temperature: L = Q/m."},
            {"term": "Conduction", "definition": "Heat transfer through a medium without the medium moving (solids)."},
            {"term": "Newton's law of cooling", "definition": "Rate of cooling is proportional to temperature difference between body and surroundings."},
        ],
        "commonMistakes": [
            "Forgetting alpha (linear), beta (area), gamma (volume) are related: beta = 2*alpha, gamma = 3*alpha",
            "Mixing up specific heat (per kg per K) with heat capacity (per K)",
            "Not accounting for latent heat separately during phase transitions",
            "Confusing conduction, convection, and radiation",
            "Forgetting water's anomaly: between 0C and 4C, water CONTRACTS on heating",
        ],
        "examTips": [
            "Memorise expansion formulas: dL = L0*alpha*dT, dV = V0*gamma*dT, gamma = 3*alpha",
            "Calorimetry: always set heat lost = heat gained; include latent heat if phase change",
            "Newton's law of cooling: T(t) = Ts + (T0 - Ts)*e^(-kt)",
            "Stefan's law: E = sigma*e*A*(T^4 - T0^4); sigma = 5.67e-8 W/m^2 K^4",
        ],
        "frequentlyConfused": [
            {"a": "Heat", "b": "Temperature", "distinction": "Heat = energy in transit due to temperature difference (J); Temperature = degree of hotness (K or C)."},
            {"a": "Specific heat", "b": "Latent heat", "distinction": "Specific heat changes temperature; latent heat changes state (no temp change)."},
        ],
    },
    "p12": {
        "overview": "Thermodynamics studies the relationship between heat, work, and energy. Covers the zeroth, first, and second laws, thermodynamic processes, heat engines, refrigerators, and the Carnot cycle.",
        "learningObjectives": [
            "State the zeroth, first, and second laws of thermodynamics",
            "Distinguish isothermal, adiabatic, isobaric, and isochoric processes",
            "Apply the first law: dU = Q - W to solve problems",
            "Calculate efficiency of heat engines and COP of refrigerators",
            "Analyse the Carnot cycle and understand entropy",
        ],
        "prerequisites": ["Thermal Properties of Matter (p11)", "Work, Energy and Power (p6)"],
        "estimatedTime": "8-10 hours",
        "difficulty": "Hard",
        "boardWeightage": "7 marks",
        "jeeWeightage": "2-3 questions",
        "quickSummary": [
            "Zeroth law: two systems in thermal equilibrium with a third are in equilibrium with each other",
            "First law: dU = Q - W (energy conservation)",
            "Isothermal (T const): W = nRT*ln(V2/V1); Adiabatic (Q=0): PV^gamma = const",
            "Second law: no heat engine can have 100% efficiency (Kelvin-Planck)",
            "Carnot efficiency: eta = 1 - T_cold/T_hot (max possible)",
            "Entropy: dS = Q_rev/T; always increases for irreversible processes",
        ],
        "importantDefinitions": [
            {"term": "Internal energy", "definition": "The total energy (kinetic + potential) of all molecules in a system. For ideal gas, depends only on T."},
            {"term": "First law of thermodynamics", "definition": "dU = Q - W; change in internal energy = heat added - work done by system."},
            {"term": "Isothermal process", "definition": "A process at constant temperature (dU = 0 for ideal gas); W = Q."},
            {"term": "Adiabatic process", "definition": "A process with no heat exchange (Q = 0); dU = -W."},
            {"term": "Carnot engine", "definition": "An ideal reversible heat engine with max efficiency eta = 1 - T_c/T_h."},
            {"term": "Entropy", "definition": "A measure of disorder; dS = Q_rev/T. Increases for irreversible processes in isolated systems."},
        ],
        "commonMistakes": [
            "Sign convention: W is work done BY system (positive when gas expands); use dU = Q - W consistently",
            "Confusing isothermal (dT = 0, dU = 0) with adiabatic (Q = 0)",
            "Forgetting gamma = Cp/Cv > 1; adiabatic PV^gamma = const is steeper than isothermal PV = const",
            "Not realising Carnot efficiency uses ABSOLUTE temperature (Kelvin)",
            "Confusing heat engine (heat to work) with refrigerator (work to move heat cold to hot)",
        ],
        "examTips": [
            "Memorise: dU = Q - W; eta_Carnot = 1 - T_c/T_h; gamma = Cp/Cv; Cp - Cv = R",
            "Isothermal: W = nRT*ln(V2/V1); Adiabatic: W = nCv*(T1-T2)",
            "Carnot cycle: 2 isothermal + 2 adiabatic; efficiency depends ONLY on reservoir temperatures",
            "JEE: practise P-V diagram interpretation and non-standard cycles",
        ],
        "frequentlyConfused": [
            {"a": "Isothermal", "b": "Adiabatic", "distinction": "Isothermal: T constant, Q = W; Adiabatic: Q = 0, dU = -W. On P-V diagram, adiabatic is steeper."},
            {"a": "Heat engine", "b": "Refrigerator", "distinction": "Engine: heat flows hot to cold, produces work; Refrigerator: uses work to move heat cold to hot."},
        ],
    },
    "p13": {
        "overview": "Explains macroscopic gas behaviour through microscopic molecular motion. Covers kinetic theory of gases, degrees of freedom, equipartition of energy, and mean free path.",
        "learningObjectives": [
            "Derive the kinetic theory expression for gas pressure",
            "State the postulates of the kinetic theory of gases",
            "Apply the law of equipartition of energy to calculate Cv and Cp",
            "Define and calculate mean free path of gas molecules",
            "Understand degrees of freedom for monatomic, diatomic, and polyatomic gases",
        ],
        "prerequisites": ["Thermodynamics (p12)", "Thermal Properties of Matter (p11)"],
        "estimatedTime": "5-6 hours",
        "difficulty": "Medium",
        "boardWeightage": "4 marks",
        "jeeWeightage": "1 question",
        "quickSummary": [
            "Kinetic theory: P = 1/3 * rho * v_rms^2",
            "RMS speed: v_rms = sqrt(3RT/M); Average: v_avg = sqrt(8RT/pi*M); Most probable: v_p = sqrt(2RT/M)",
            "Equipartition: each degree of freedom contributes 1/2 kT per molecule",
            "Monatomic (3 DOF): Cv = 3R/2, gamma = 5/3; Diatomic (5 DOF): Cv = 5R/2, gamma = 7/5",
            "Mean free path: lambda = 1/(sqrt(2) * pi * d^2 * n)",
        ],
        "importantDefinitions": [
            {"term": "Kinetic theory", "definition": "A theory explaining gas properties by treating gas as a large number of molecules in random motion."},
            {"term": "RMS speed", "definition": "The square root of the mean of the squares of molecular speeds: v_rms = sqrt(3RT/M)."},
            {"term": "Degrees of freedom", "definition": "The number of independent ways a molecule can possess energy."},
            {"term": "Equipartition theorem", "definition": "Each degree of freedom contributes 1/2 kT of energy per molecule on average."},
            {"term": "Mean free path", "definition": "The average distance a molecule travels between two successive collisions."},
        ],
        "commonMistakes": [
            "Confusing v_rms, v_average, and v_most_probable — they are different: v_rms > v_avg > v_p",
            "Forgetting DOF: monatomic = 3, diatomic = 5, polyatomic = 6",
            "Using gamma = 5/3 for all gases — only for monatomic; diatomic gamma = 7/5",
            "Mixing up k (Boltzmann, per molecule) with R (gas constant, per mole)",
            "Forgetting equipartition gives 1/2 kT per DOF per molecule",
        ],
        "examTips": [
            "Memorise: v_rms = sqrt(3RT/M), Cv for monatomic (3R/2) and diatomic (5R/2)",
            "Relations: Cp - Cv = R; gamma = Cp/Cv; Cv = R/(gamma-1)",
            "Mean free path: lambda = 1/(sqrt(2) * pi * d^2 * n)",
            "JEE: practise problems relating pressure to molecular speeds",
        ],
        "frequentlyConfused": [
            {"a": "RMS speed", "b": "Average speed", "distinction": "v_rms = sqrt(3RT/M) > v_avg = sqrt(8RT/pi*M) > v_p = sqrt(2RT/M)."},
            {"a": "Degrees of freedom", "b": "Dimension", "distinction": "DOF = number of independent energy modes; dimension = spatial axes (always 3)."},
        ],
    },
    "p14": {
        "overview": "Studies periodic and oscillatory motion, especially Simple Harmonic Motion (SHM). Covers the SHM equation, energy in SHM, pendulums, damped and forced oscillations, and resonance.",
        "learningObjectives": [
            "Define and identify simple harmonic motion (SHM)",
            "Derive and apply the SHM equation: x = A sin(omega*t + phi)",
            "Calculate time period and frequency of spring-mass and pendulum systems",
            "Analyse energy in SHM (KE and PE interchange)",
            "Distinguish damped, forced, and resonant oscillations",
        ],
        "prerequisites": ["Motion in a Straight Line (p3)", "Motion in a Plane (p4)", "Differentiation"],
        "estimatedTime": "7-8 hours",
        "difficulty": "Hard",
        "boardWeightage": "6 marks",
        "jeeWeightage": "2 questions",
        "quickSummary": [
            "SHM: F = -kx (restoring force proportional to displacement); a = -omega^2 * x",
            "Displacement: x = A sin(omega*t + phi); max velocity = A*omega",
            "Spring: T = 2*pi*sqrt(m/k); Simple pendulum: T = 2*pi*sqrt(L/g)",
            "Energy: KE = 1/2 m*omega^2*(A^2-x^2); PE = 1/2 m*omega^2*x^2; Total = 1/2 m*omega^2*A^2",
            "Damped: amplitude decreases; Forced: external periodic force; Resonance: driving freq = natural freq",
        ],
        "importantDefinitions": [
            {"term": "Simple harmonic motion", "definition": "Periodic motion where restoring force is proportional to displacement and directed toward equilibrium: F = -kx."},
            {"term": "Angular frequency", "definition": "omega = 2*pi/T = 2*pi*f. For spring: omega = sqrt(k/m)."},
            {"term": "Amplitude", "definition": "The maximum displacement from equilibrium in oscillatory motion."},
            {"term": "Phase", "definition": "The argument (omega*t + phi) of the sine function; describes the state of oscillation."},
            {"term": "Resonance", "definition": "Large-amplitude oscillation when driving frequency equals natural frequency."},
        ],
        "commonMistakes": [
            "Forgetting SHM requires BOTH restoring force AND F proportional to -x",
            "Confusing angular frequency omega with angular velocity",
            "Sign errors in energy: at x = 0, KE is max and PE = 0; at x = A, KE = 0 and PE is max",
            "Using T = 2*pi*sqrt(L/g) for large amplitudes — only valid for theta < 10 degrees",
            "Forgetting total energy in SHM is constant (1/2 m*omega^2*A^2)",
        ],
        "examTips": [
            "Memorise: x = A sin(omega*t + phi), T = 2*pi*sqrt(m/k) (spring), T = 2*pi*sqrt(L/g) (pendulum)",
            "Energy: at equilibrium, all KE; at extremes, all PE. Total = 1/2 m*omega^2*A^2",
            "Springs in series: 1/k = 1/k1 + 1/k2; parallel: k = k1 + k2",
            "JEE: practise vertical spring (equilibrium shift) and compound pendulum",
        ],
        "frequentlyConfused": [
            {"a": "Periodic motion", "b": "Oscillatory motion", "distinction": "Periodic = repeats at equal intervals; Oscillatory = periodic AND back-and-forth about equilibrium."},
            {"a": "Damped oscillation", "b": "Forced oscillation", "distinction": "Damped: amplitude decreases due to resistance; Forced: external periodic force maintains oscillation."},
        ],
    },
    "p15": {
        "overview": "Studies wave motion — propagation of disturbances through a medium. Covers transverse and longitudinal waves, the wave equation, superposition, standing waves, beats, Doppler effect, and sound.",
        "learningObjectives": [
            "Distinguish transverse and longitudinal waves",
            "Derive and apply the wave equation: v = lambda*f = omega/k",
            "Apply the principle of superposition to analyse interference and standing waves",
            "Calculate beat frequency and explain the Doppler effect",
            "Analyse standing waves in strings and pipes",
        ],
        "prerequisites": ["Oscillations (p14)", "Motion in a Plane (p4)"],
        "estimatedTime": "8-10 hours",
        "difficulty": "Hard",
        "boardWeightage": "7 marks",
        "jeeWeightage": "2-3 questions",
        "quickSummary": [
            "Transverse: particles oscillate perpendicular to wave direction; Longitudinal: parallel",
            "Wave equation: y = A sin(kx - omega*t); v = lambda*f = omega/k = sqrt(T/mu) for string",
            "Speed of sound in air ~ 343 m/s at 20C; v proportional to sqrt(T)",
            "Superposition: displacements add; Interference: constructive (in phase) / destructive (out of phase)",
            "Standing waves: nodes (zero amplitude) and antinodes (max); string fixed both ends: lambda_n = 2L/n",
            "Beats: f_beat = |f1 - f2|; Doppler: f' = f(v +/- v_o)/(v -/+ v_s)",
        ],
        "importantDefinitions": [
            {"term": "Wave", "definition": "A disturbance that propagates through a medium, transferring energy without net transfer of matter."},
            {"term": "Transverse wave", "definition": "A wave where particles oscillate perpendicular to wave direction (light, string)."},
            {"term": "Longitudinal wave", "definition": "A wave where particles oscillate parallel to wave direction (sound)."},
            {"term": "Standing wave", "definition": "A wave formed by superposition of two identical waves travelling in opposite directions; has fixed nodes and antinodes."},
            {"term": "Doppler effect", "definition": "The apparent change in frequency when source and observer are in relative motion."},
            {"term": "Beats", "definition": "Periodic intensity variation when two waves of slightly different frequencies superpose; f_beat = |f1 - f2|."},
        ],
        "commonMistakes": [
            "Confusing transverse (perpendicular) and longitudinal (parallel) — sound is longitudinal, light is transverse",
            "Sign errors in Doppler: source moving toward observer means higher frequency",
            "Forgetting standing waves on string fixed both ends: lambda_n = 2L/n",
            "Not distinguishing open pipe (antinode at open end) from closed pipe (node at closed end)",
            "Forgetting wave speed depends on medium, not frequency or amplitude",
        ],
        "examTips": [
            "Memorise: v = lambda*f, v = sqrt(T/mu) (string), Doppler formula, beat frequency",
            "Standing waves: string (both fixed) lambda = 2L/n; open pipe lambda = 2L/n; closed pipe lambda = 4L/(2n-1)",
            "Doppler: use + for approach, - for recede; source in denominator, observer in numerator",
            "JEE: practise combined source+observer motion and wind effect",
        ],
        "frequentlyConfused": [
            {"a": "Transverse wave", "b": "Longitudinal wave", "distinction": "Transverse: particles move perpendicular to wave direction (EM); Longitudinal: parallel (sound)."},
            {"a": "Node", "b": "Antinode", "distinction": "Node = zero amplitude point; Antinode = maximum amplitude point. Distance between adjacent nodes = lambda/2."},
        ],
    },
}

def escape_js_string(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')

def build_metadata_string(meta):
    lines = []
    
    if "overview" in meta:
        lines.append(f'    overview: "{escape_js_string(meta["overview"])}",')
    if "learningObjectives" in meta:
        lines.append('    learningObjectives: [')
        for obj in meta["learningObjectives"]:
            lines.append(f'      "{escape_js_string(obj)}",')
        lines.append('    ],')
    if "prerequisites" in meta:
        lines.append('    prerequisites: [')
        for pre in meta["prerequisites"]:
            lines.append(f'      "{escape_js_string(pre)}",')
        lines.append('    ],')
    if "estimatedTime" in meta:
        lines.append(f'    estimatedTime: "{escape_js_string(meta["estimatedTime"])}",')
    if "difficulty" in meta:
        lines.append(f'    difficulty: "{escape_js_string(meta["difficulty"])}",')
    if "boardWeightage" in meta:
        lines.append(f'    boardWeightage: "{escape_js_string(meta["boardWeightage"])}",')
    if "jeeWeightage" in meta:
        lines.append(f'    jeeWeightage: "{escape_js_string(meta["jeeWeightage"])}",')
    if "quickSummary" in meta:
        lines.append('    quickSummary: [')
        for qs in meta["quickSummary"]:
            lines.append(f'      "{escape_js_string(qs)}",')
        lines.append('    ],')
    if "importantDefinitions" in meta:
        lines.append('    importantDefinitions: [')
        for d in meta["importantDefinitions"]:
            term = escape_js_string(d["term"])
            definition = escape_js_string(d["definition"])
            lines.append(f'      {{ term: "{term}", definition: "{definition}" }},')
        lines.append('    ],')
    if "commonMistakes" in meta:
        lines.append('    commonMistakes: [')
        for cm in meta["commonMistakes"]:
            lines.append(f'      "{escape_js_string(cm)}",')
        lines.append('    ],')
    if "examTips" in meta:
        lines.append('    examTips: [')
        for et in meta["examTips"]:
            lines.append(f'      "{escape_js_string(et)}",')
        lines.append('    ],')
    if "frequentlyConfused" in meta:
        lines.append('    frequentlyConfused: [')
        for fc in meta["frequentlyConfused"]:
            a = escape_js_string(fc["a"])
            b = escape_js_string(fc["b"])
            dist = escape_js_string(fc["distinction"])
            lines.append(f'      {{ a: "{a}", b: "{b}", distinction: "{dist}" }},')
        lines.append('    ],')
    
    return "\n".join(lines)

def main():
    with open(FILE, 'r') as f:
        content = f.read()
    
    for ch_id, meta in METADATA.items():
        id_pattern = f'id: "{ch_id}",'
        id_idx = content.find(id_pattern)
        if id_idx == -1:
            print(f"WARNING: Chapter {ch_id} not found!")
            continue
        
        questions_start = content.find('questions: [', id_idx)
        if questions_start == -1:
            print(f"WARNING: questions array not found for {ch_id}")
            continue
        
        bracket_depth = 0
        i = questions_start + len('questions: ')
        while i < len(content):
            if content[i] == '[':
                bracket_depth += 1
            elif content[i] == ']':
                bracket_depth -= 1
                if bracket_depth == 0:
                    break
            i += 1
        
        close_bracket = i
        next_500 = content[close_bracket:close_bracket+500]
        if 'overview:' in next_500:
            print(f"SKIP: {ch_id} already has metadata")
            continue
        
        after = content[close_bracket+1:]
        stripped = after.lstrip()
        offset = len(after) - len(stripped)
        
        if stripped.startswith(','):
            insert_point = close_bracket + 1 + offset + 1
            meta_str = "\n" + build_metadata_string(meta)
        else:
            insert_point = close_bracket + 1 + offset
            meta_str = ",\n" + build_metadata_string(meta)
        
        content = content[:insert_point] + meta_str + content[insert_point:]
        print(f"OK: Added metadata to {ch_id}")
    
    with open(FILE, 'w') as f:
        f.write(content)
    
    print(f"\nDone! Processed {len(METADATA)} chapters.")

if __name__ == '__main__':
    main()
