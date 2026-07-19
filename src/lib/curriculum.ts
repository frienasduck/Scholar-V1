// CBSE Class 9 curriculum data — full chapter lists with summaries, key concepts, formulas, questions.

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  concepts: string[];
  formulas?: string[];
  questions: string[];
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string; // gradient
  accent: string; // hex
  chapters: Chapter[];
}

export const CURRICULUM: Subject[] = [
  {
    id: "maths",
    name: "Mathematics",
    icon: "📐",
    color: "from-indigo-500 to-violet-500",
    accent: "#6366f1",
    chapters: [
      {
        id: "m1",
        title: "Number Systems",
        summary:
          "Extends the number system to rational and irrational numbers, real numbers, and their representation on the number line.",
        concepts: ["Rational & irrational numbers", "Real numbers", "Number line representation", "Laws of exponents for real numbers", "Rationalisation"],
        formulas: ["(a^m)(a^n) = a^(m+n)", "(a^m)^n = a^(mn)", "√a × √b = √(ab)", "1/(a^n) = a^(-n)"],
        questions: [
          "Is √2 a rational number? Justify.",
          "Represent √3 on the number line.",
          "Rationalise the denominator of 1/(√5 - 2).",
          "Express 0.333... as a fraction.",
          "Simplify: (3 + √3)(3 - √3).",
        ],
      },
      {
        id: "m2",
        title: "Polynomials",
        summary:
          "Introduces polynomials in one variable, degree, zeroes, the remainder and factor theorems, and algebraic identities.",
        concepts: ["Polynomial, degree, zeroes", "Remainder Theorem", "Factor Theorem", "Algebraic identities", "Factorisation"],
        formulas: ["(a+b)² = a² + 2ab + b²", "(a-b)² = a² - 2ab + b²", "a² - b² = (a+b)(a-b)", "(x+a)(x+b) = x² + (a+b)x + ab"],
        questions: [
          "Find the remainder when x³ + 3x² + 3x + 1 is divided by x + 1.",
          "Check whether (x - 2) is a factor of x³ - 3x² + 4x - 4.",
          "Factorise: x² - 7x + 12.",
          "Expand (2x + 3y)² using identity.",
          "If p(x) = x² - 5x + 6, find p(2).",
        ],
      },
      {
        id: "m3",
        title: "Coordinate Geometry",
        summary:
          "Studies the Cartesian plane, plotting points, and the relationship between algebra and geometry.",
        concepts: ["Cartesian system", "Coordinates of a point", "Quadrants", "Plotting points"],
        questions: [
          "Plot the point (3, -4) and identify its quadrant.",
          "In which quadrant does (-2, 5) lie?",
          "What are the coordinates of the origin?",
          "The point (0, 5) lies on which axis?",
        ],
      },
      {
        id: "m4",
        title: "Linear Equations in Two Variables",
        summary:
          "Deals with linear equations of the form ax + by + c = 0, their graphs, and solutions.",
        concepts: ["Linear equation ax+by+c=0", "Solution of a linear equation", "Graph of a linear equation"],
        formulas: ["ax + by + c = 0 (a,b not both zero)"],
        questions: [
          "Find 4 solutions of 2x + y = 6.",
          "Draw the graph of x + y = 4.",
          "Is (2, 3) a solution of 3x - y = 3?",
        ],
      },
      {
        id: "m5",
        title: "Introduction to Euclid's Geometry",
        summary: "Foundations of geometry through axioms, postulates, and deductive reasoning.",
        concepts: ["Axioms & postulates", "Euclid's five postulates", "Theorems vs axioms"],
        questions: ["State Euclid's fifth postulate.", "Define a point and a line per Euclid.", "Give an example of an axiom."],
      },
      {
        id: "m6",
        title: "Lines and Angles",
        summary: "Properties of angles formed by intersecting and parallel lines with a transversal.",
        concepts: ["Complementary & supplementary angles", "Linear pair", "Vertically opposite angles", "Parallel lines & transversal", "Corresponding, alternate, co-interior angles"],
        formulas: ["Sum of angles on a straight line = 180°", "Vertically opposite angles are equal"],
        questions: ["If two angles are complementary and one is 35°, find the other.", "Prove that vertically opposite angles are equal.", "Find x if two parallel lines are cut by a transversal making corresponding angles (3x)° and (2x+20)°."],
      },
      {
        id: "m7",
        title: "Triangles",
        summary: "Congruence criteria and inequalities in triangles.",
        concepts: ["Congruence (SAS, ASA, SSS, RHS)", "Properties of triangles", "Inequalities in a triangle"],
        questions: ["Prove SAS congruence rule.", "If two sides of a triangle are unequal, the angle opposite the longer side is ___.", "Prove that the angles opposite equal sides of an isosceles triangle are equal."],
      },
      {
        id: "m8",
        title: "Quadrilaterals",
        summary: "Properties of parallelograms and mid-point theorem.",
        concepts: ["Types of quadrilaterals", "Properties of parallelogram", "Mid-point theorem"],
        questions: ["Prove that the diagonals of a parallelogram bisect each other.", "State the mid-point theorem.", "If one angle of a parallelogram is 70°, find all angles."],
      },
      {
        id: "m9",
        title: "Areas of Parallelograms and Triangles",
        summary: "Areas on the same base and between the same parallels.",
        concepts: ["Parallelograms on the same base & same parallels", "Triangles on the same base & same parallels"],
        questions: ["Prove that parallelograms on the same base and between same parallels have equal area.", "Two triangles on the same base have equal area. What can you conclude?"],
      },
      {
        id: "m10",
        title: "Circles",
        summary: "Chords, arcs, angles subtended, and cyclic quadrilaterals.",
        concepts: ["Chord & arc", "Angle subtended by chord at center & on circle", "Perpendicular from center to chord", "Cyclic quadrilateral"],
        formulas: ["Angle at center = 2 × angle on circle (same arc)", "Opposite angles of cyclic quad sum to 180°"],
        questions: ["Prove that equal chords subtend equal angles at the center.", "Find the opposite angle of 75° in a cyclic quadrilateral.", "Prove that the perpendicular from the center to a chord bisects the chord."],
      },
      {
        id: "m11",
        title: "Constructions",
        summary: "Basic geometrical constructions using ruler and compass.",
        concepts: ["Bisecting a line segment", "Perpendicular bisector", "Constructing angles 60°, 90°, 45°", "Constructing triangles"],
        questions: ["Construct an angle of 60°.", "Construct the perpendicular bisector of a 6 cm segment.", "Construct a triangle given SAS."],
      },
      {
        id: "m12",
        title: "Heron's Formula",
        summary: "Finding the area of a triangle using its three sides.",
        concepts: ["Heron's formula", "Application to quadrilaterals"],
        formulas: ["s = (a+b+c)/2", "Area = √(s(s-a)(s-b)(s-c))"],
        questions: ["Find the area of a triangle with sides 3, 4, 5 cm.", "Find the area of an equilateral triangle of side 6 cm using Heron's.", "Find the area of a triangle with sides 7, 8, 9 cm."],
      },
      {
        id: "m13",
        title: "Surface Areas and Volumes",
        summary: "Surface area and volume of solids: cube, cuboid, cylinder, cone, sphere.",
        concepts: ["Cube & cuboid", "Cylinder", "Cone", "Sphere & hemisphere"],
        formulas: ["Cylinder CSA = 2πrh", "Cylinder TSA = 2πr(r+h)", "Cone CSA = πrl", "Sphere SA = 4πr²", "Sphere V = (4/3)πr³", "Cylinder V = πr²h"],
        questions: ["Find the CSA of a cylinder of radius 7 cm and height 10 cm.", "Find the volume of a sphere of radius 3 cm.", "Find the TSA of a cone with r=5, l=13."],
      },
      {
        id: "m14",
        title: "Statistics",
        summary: "Collection, presentation, and interpretation of data; mean, median, mode.",
        concepts: ["Frequency distribution", "Bar graphs, histograms", "Mean, median, mode of ungrouped data"],
        formulas: ["Mean = Σxᵢ / n", "Median = middle value (sorted)", "Mode = most frequent value"],
        questions: ["Find the mean of 2, 4, 6, 8, 10.", "Find the median of 3, 5, 7, 9, 11.", "Find the mode of 2, 2, 3, 4, 4, 4, 5."],
      },
      {
        id: "m15",
        title: "Probability",
        summary: "Empirical probability of events.",
        concepts: ["Trial, outcome, event", "Empirical probability", "Impossible & certain events"],
        formulas: ["P(E) = (Number of outcomes favourable to E) / (Total outcomes)"],
        questions: ["A die is rolled. Find P(even number).", "A coin is tossed. Find P(head).", "A bag has 3 red and 2 blue balls. Find P(red)."],
      },
    ],
  },
  {
    id: "science",
    name: "Science",
    icon: "🔬",
    color: "from-emerald-500 to-teal-500",
    accent: "#10b981",
    chapters: [
      {
        id: "s1",
        title: "Matter in Our Surroundings",
        summary: "Nature of matter: states, characteristics, and interconversion.",
        concepts: ["States of matter", "Characteristics of particles", "Change of state", "Evaporation", "Latent heat"],
        questions: ["Why do we feel cold when acetone is put on our palm?", "Define latent heat of fusion.", "Why does a gas fill its container completely?"],
      },
      {
        id: "s2",
        title: "Is Matter Around Us Pure",
        summary: "Mixtures, solutions, suspensions, colloids, separation techniques.",
        concepts: ["Elements, compounds, mixtures", "Solution, suspension, colloid", "Concentration of solution", "Separation methods"],
        formulas: ["Concentration = (solute / solution) × 100"],
        questions: ["Differentiate between a mixture and a compound.", "What is a colloid? Give an example.", "How will you separate a mixture of sand and salt?"],
      },
      {
        id: "s3",
        title: "Atoms and Molecules",
        summary: "Laws of chemical combination, atoms, molecules, ions, and mole concept.",
        concepts: ["Laws of conservation & constant proportions", "Atoms & molecules", "Ions", "Mole concept", "Molar mass"],
        formulas: ["Moles = mass / molar mass", "Number of particles = moles × 6.022×10²³"],
        questions: ["Calculate the molar mass of H₂O.", "State the law of constant proportions.", "What is an ion? Give two examples."],
      },
      {
        id: "s4",
        title: "Structure of the Atom",
        summary: "Sub-atomic particles, atomic models, electronic configuration.",
        concepts: ["Electrons, protons, neutrons", "Thomson, Rutherford, Bohr models", "Atomic number & mass number", "Electronic configuration", "Isotopes & isobars"],
        questions: ["What are isotopes? Give an example.", "Write the electronic configuration of oxygen (Z=8).", "Who proposed the nuclear model of the atom?"],
      },
      {
        id: "s5",
        title: "The Fundamental Unit of Life",
        summary: "Cell as the basic unit of life; structure and function of cell organelles.",
        concepts: ["Cell theory", "Prokaryotic vs eukaryotic", "Plant vs animal cell", "Cell organelles", "Plasma membrane, cell wall"],
        questions: ["Why is the cell called the structural and functional unit of life?", "Differentiate between prokaryotic and eukaryotic cells.", "What is the function of mitochondria?"],
      },
      {
        id: "s6",
        title: "Tissues",
        summary: "Plant and animal tissues, their structure and functions.",
        concepts: ["Plant tissues: meristematic, permanent", "Animal tissues: epithelial, connective, muscular, nervous"],
        questions: ["Differentiate between xylem and phloem.", "What are meristematic tissues?", "Name the tissue that connects bone to bone."],
      },
      {
        id: "s7",
        title: "Diversity in Living Organisms",
        summary: "Classification of living organisms into kingdoms and hierarchy.",
        concepts: ["Classification & hierarchy", "Five kingdom classification", "Binomial nomenclature"],
        questions: ["Who proposed the binomial nomenclature?", "What are the five kingdoms of classification?", "Differentiate between Monera and Protista."],
      },
      {
        id: "s8",
        title: "Motion",
        summary: "Describing motion: distance, displacement, speed, velocity, acceleration, equations of motion.",
        concepts: ["Distance vs displacement", "Speed, velocity, acceleration", "Equations of motion", "Graphical representation"],
        formulas: ["v = u + at", "s = ut + ½at²", "v² = u² + 2as"],
        questions: ["A car accelerates from rest at 2 m/s² for 5 s. Find final velocity.", "Differentiate speed and velocity.", "Draw a velocity-time graph for uniform acceleration."],
      },
      {
        id: "s9",
        title: "Force and Laws of Motion",
        summary: "Newton's three laws of motion and the concept of momentum.",
        concepts: ["Balanced & unbalanced forces", "Newton's 1st, 2nd, 3rd laws", "Momentum & conservation"],
        formulas: ["F = ma", "p = mv", "F = (mv - mu)/t"],
        questions: ["State Newton's second law of motion.", "A 2 kg object accelerates at 3 m/s². Find force.", "State the law of conservation of momentum."],
      },
      {
        id: "s10",
        title: "Gravitation",
        summary: "Universal law of gravitation, free fall, buoyancy, pressure.",
        concepts: ["Universal law of gravitation", "Free fall, g", "Mass vs weight", "Thrust & pressure", "Buoyancy, Archimedes' principle"],
        formulas: ["F = G(m₁m₂)/r²", "g = GM/R²", "Pressure = Force/Area"],
        questions: ["State the universal law of gravitation.", "Differentiate between mass and weight.", "State Archimedes' principle."],
      },
      {
        id: "s11",
        title: "Work and Energy",
        summary: "Work, kinetic and potential energy, the law of conservation of energy.",
        concepts: ["Work done", "Kinetic & potential energy", "Conservation of energy", "Power"],
        formulas: ["W = F × d", "KE = ½mv²", "PE = mgh", "P = W/t"],
        questions: ["Define 1 joule of work.", "Find the KE of a 2 kg ball moving at 3 m/s.", "State the law of conservation of energy."],
      },
      {
        id: "s12",
        title: "Sound",
        summary: "Production, propagation, and characteristics of sound waves.",
        concepts: ["Mechanical waves: longitudinal & transverse", "Characteristics: amplitude, frequency, wavelength", "Echo, reverberation", "SONAR", "Range of hearing"],
        formulas: ["v = fλ", "Speed of sound in air ≈ 344 m/s (at 20°C)"],
        questions: ["What is the audible range for humans?", "Define frequency. Give its unit.", "State the relation v = fλ."],
      },
      {
        id: "s13",
        title: "Why Do We Fall Ill",
        summary: "Health, disease, causes, and the principles of treatment and prevention.",
        concepts: ["Health & disease", "Acute vs chronic", "Infectious vs non-infectious", "Causes of disease", "Principles of treatment & prevention"],
        questions: ["Differentiate between acute and chronic diseases.", "What are infectious diseases? Give two examples.", "How can infectious diseases be prevented?"],
      },
      {
        id: "s14",
        title: "Natural Resources",
        summary: "Air, water, soil, biogeochemical cycles, and conservation.",
        concepts: ["Air & air pollution", "Water & water pollution", "Soil & soil erosion", "Biogeochemical cycles: water, nitrogen, carbon"],
        questions: ["What is the greenhouse effect?", "Explain the water cycle.", "How is soil formed?"],
      },
      {
        id: "s15",
        title: "Improvement in Food Resources",
        summary: "Strategies for improvement in crop yields and animal husbandry.",
        concepts: ["Crop variety improvement", "Crop production management", "Animal husbandry", "Cattle farming, poultry"],
        questions: ["What is animal husbandry?", "Name two kharif crops.", "What are macronutrients? Give examples."],
      },
    ],
  },
  {
    id: "english",
    name: "English",
    icon: "📚",
    color: "from-rose-500 to-pink-500",
    accent: "#f43f5e",
    chapters: [
      { id: "e1", title: "The Fun They Had (Beehive)", summary: "A story set in the future about a mechanical teacher and the joys of traditional schools.", concepts: ["Theme of technology vs human connection", "Character: Margie & Tommy"], questions: ["What kind of teachers did Margie and Tommy have?", "Why did Margie hate school?"] },
      { id: "e2", title: "The Sound of Music (Beehive)", summary: "Stories of Evelyn Glennie and Bismillah Khan — overcoming odds through music.", concepts: ["Evelyn Glennie's hearing loss", "Bismillah Khan & the shehnai"], questions: ["How did Evelyn Glennie hear music?", "Where was the shehnai played traditionally?"] },
      { id: "e3", title: "The Little Girl (Beehive)", summary: "A girl's changing perception of her father.", concepts: ["Father-daughter relationship", "Fear to understanding"], questions: ["Why was Kezia afraid of her father?", "What changed her feelings?"] },
      { id: "e4", title: "A Truly Beautiful Mind (Beehive)", summary: "A biographical sketch of Albert Einstein.", concepts: ["Einstein's life", "Genius & humanity"], questions: ["Why is Einstein called a truly beautiful mind?", "What was Einstein's special theory of relativity?"] },
      { id: "e5", title: "The Snake and the Mirror (Beehive)", summary: "A humorous story of a doctor and a snake.", concepts: ["Humour & vanity", "Irony"], questions: ["What did the doctor do when the snake coiled around his arm?", "Why was the doctor vain?"] },
      { id: "e6", title: "My Childhood (Beehive)", summary: "APJ Abdul Kalam's early years and influences.", concepts: ["Kalam's upbringing", "Communal harmony"], questions: ["Who were Kalam's school friends?", "What did Kalam's father do?"] },
      { id: "e7", title: "Reach for the Top (Beehive)", summary: "Stories of Santosh Yadav and Maria Sharapova.", concepts: ["Determination", "Overcoming hardship"], questions: ["How did Santosh Yadav reach the top?", "What hardships did Maria Sharapova face?"] },
      { id: "e8", title: "Kathmandu (Beehive)", summary: "A travelogue through Kathmandu's temples and streets.", concepts: ["Travel writing", "Cultural observation"], questions: ["What did the author see at Pashupatinath?", "What is the difference between the two temples?"] },
      { id: "e9", title: "If I Were You (Beehive)", summary: "A play about Gerrard outsmarting an intruder.", concepts: ["Drama & wit", "Presence of mind"], questions: ["How did Gerrard outwit the intruder?", "Why did the intruder want to impersonate Gerrard?"] },
      { id: "e10", title: "The Lost Child (Moments)", summary: "A child's desire for things at a fair, lost in the crowd.", concepts: ["Innocence", "Love for parents"], questions: ["What did the child want at the fair?", "Why did the child cry at the end?"] },
      { id: "e11", title: "The Adventures of Toto (Moments)", summary: "A mischievous monkey and the trouble it causes.", concepts: ["Humour", "Pet behavior"], questions: ["Why was Toto a problem pet?", "How did Toto damage the things?"] },
      { id: "e12", title: "Iswaran the Storyteller (Moments)", summary: "Mahendra's cook and his vivid storytelling.", concepts: ["Storytelling", "Imagination"], questions: ["How did Iswaran narrate stories?", "What was Iswaran's speciality?"] },
      { id: "e13", title: "In the Kingdom of Fools (Moments)", summary: "A witty tale about a foolish king and a guru's wisdom.", concepts: ["Folly vs wisdom", "Justice"], questions: ["Why was the kingdom called the Kingdom of Fools?", "How did the guru save his disciple?"] },
      { id: "e14", title: "The Happy Prince (Moments)", summary: "A statue and a swallow who sacrifice for the poor.", concepts: ["Compassion", "Sacrifice"], questions: ["Why was the Happy Prince sad?", "How did the swallow help the Prince?"] },
      { id: "e15", title: "Weathering the Storm in Ersama (Moments)", summary: "A story of courage during a super cyclone.", concepts: ["Courage", "Community service"], questions: ["How did Prashant help the flood victims?", "What was the situation in Ersama after the cyclone?"] },
    ],
  },
  {
    id: "sst",
    name: "Social Science",
    icon: "🌍",
    color: "from-amber-500 to-orange-500",
    accent: "#f59e0b",
    chapters: [
      { id: "ss1", title: "The French Revolution (History)", summary: "Causes, course, and consequences of the French Revolution (1789).", concepts: ["Causes: social, economic, political", "Estates system", "Storming of Bastille", "Reign of Terror", "Abolition of slavery"], questions: ["What were the three estates in France?", "Why was the Bastille stormed?", "Who was Robespierre?"] },
      { id: "ss2", title: "Socialism in Europe and the Russian Revolution (History)", summary: "Rise of socialism and the Russian Revolution of 1917.", concepts: ["Industrial society", "Bolsheviks & Mensheviks", "October Revolution", "Stalinism"], questions: ["Who were the Bolsheviks?", "What was the October Revolution?", "Explain collectivisation."] },
      { id: "ss3", title: "Nazism and the Rise of Hitler (History)", summary: "Weimar Republic, Nazism, and WWII.", concepts: ["Weimar Republic", "Rise of Hitler", "Nazi ideology", "The Holocaust"], questions: ["What was the Weimar Republic?", "How did Hitler rise to power?", "What was the Holocaust?"] },
      { id: "ss4", title: "Forest Society and Colonialism (History)", summary: "Impact of colonialism on forest societies.", concepts: ["Deforestation", "Scientific forestry", "Rebellions"], questions: ["What is scientific forestry?", "How did colonial rule affect forests?"] },
      { id: "ss5", title: "Pastoralists in the Modern World (History)", summary: "Lives of nomadic communities and colonial impact.", concepts: ["Pastoral nomadism", "Colonial restrictions", "Pastoralists in Africa"], questions: ["Who are pastoralists?", "How did colonial rule affect pastoralists?"] },
      { id: "ss6", title: "India - Size and Location (Geography)", summary: "India's location, size, and neighbors.", concepts: ["Location & latitudinal extent", "Size", "Neighbours"], questions: ["What is India's latitudinal extent?", "How many states border India?"] },
      { id: "ss7", title: "Physical Features of India (Geography)", summary: "Major physiographic divisions of India.", concepts: ["The Himalayas", "Northern Plains", "Peninsular Plateau", "Coastal plains", "Islands"], questions: ["Name the major physiographic divisions of India.", "What are the three ranges of the Himalayas?"] },
      { id: "ss8", title: "Drainage (Geography)", summary: "River systems of India.", concepts: ["Himalayan rivers", "Peninsular rivers", "Lakes", "Water pollution"], questions: ["Name the major Himalayan rivers.", "What is a drainage basin?"] },
      { id: "ss9", title: "Climate (Geography)", summary: "India's climate and the monsoon.", concepts: ["Climatic controls", "Monsoon", "Factors affecting climate"], questions: ["What is the monsoon?", "Which winds bring rain to India?"] },
      { id: "ss10", title: "Natural Vegetation and Wildlife (Geography)", summary: "Types of vegetation and wildlife in India.", concepts: ["Types of forests", "Wildlife conservation", "Biosphere reserves"], questions: ["What are the types of natural vegetation in India?", "What is a biosphere reserve?"] },
      { id: "ss11", title: "Population (Geography)", summary: "Population size, distribution, and growth in India.", concepts: ["Distribution & density", "Growth", "Composition"], questions: ["What is population density?", "Which is the most populous state of India?"] },
      { id: "ss12", title: "What is Democracy? Why Democracy? (Civics)", summary: "Meaning and features of democracy.", concepts: ["Definition of democracy", "Features", "Merits & demerits"], questions: ["What is democracy?", "Give two features of democracy."] },
      { id: "ss13", title: "Constitutional Design (Civics)", summary: "Making of the Indian Constitution.", concepts: ["Constituent Assembly", "Preamble", "Features"], questions: ["Who was the Chairman of the Constituent Assembly?", "What does the Preamble state?"] },
      { id: "ss14", title: "The Story of Village Palampur (Economics)", summary: "Production and farming in a hypothetical village.", concepts: ["Factors of production", "Farming in Palampur", "Non-farm activities"], questions: ["What are the factors of production?", "What is multiple cropping?"] },
      { id: "ss15", title: "People as Resource (Economics)", summary: "Human capital and its role in development.", concepts: ["Human capital", "Education & health", "Unemployment"], questions: ["What is human capital?", "What is unemployment?"] },
    ],
  },
  {
    id: "hindi",
    name: "Hindi",
    icon: "✍️",
    color: "from-cyan-500 to-blue-500",
    accent: "#06b6d4",
    chapters: [
      { id: "h1", title: "दो बैलों की कथा (Kshitij)", summary: "प्रेमचंद की कहानी — मानवीय मूल्य और मजदूरी का संघर्ष।", concepts: ["मानवीय मूल्य", "शोषण", "मित्रता"], questions: ["हीरा और मोती कौन थे?", "झोपड़ी में कौन रहता था?"] },
      { id: "h2", title: "ल्हासा की ओर (Kshitij)", summary: "राहुल सांकृत्यायन का यात्रा वृत्तांत।", concepts: ["यात्रा वृत्तांत", "तिब्बत का वर्णन"], questions: ["लेखक ल्हासा क्यों गए?", "तिब्बत की क्या विशेषता बताई गई है?"] },
      { id: "h3", title: "उपभोक्तावाद की संस्कृति (Kshitij)", summary: "श्यामाचरण दुबे — उपभोक्तावाद का समाजशास्त्रीय विश्लेषण।", concepts: ["उपभोक्तावाद", "संस्कृति"], questions: ["उपभोक्तावाद क्या है?"] },
      { id: "h4", title: "साँवले सपनों की याद (Kshitij)", summary: "हरिवंश राय बच्चन की कविता।", concepts: ["कविता", "सपने"], questions: ["कवि को क्या याद आ रहा है?"] },
      { id: "h5", title: "नाना साहब की पुत्री देवी मैना को भाग्य ने जगाया (Kshitij)", summary: "वृंदावन लाल वर्मा की ऐतिहासिक कहानी।", concepts: ["ऐतिहासिक कहानी", "वीरता"], questions: ["देवी मैना कौन थी?"] },
      { id: "h6", title: "प्रेमचंद के फटे जूते (Kshitij)", summary: "हरिशंकर परसाई — प्रेमचंद पर व्यंग्य।", concepts: ["व्यंग्य", "साहित्यकार का जीवन"], questions: ["प्रेमचंद के जूते कैसे फटे?"] },
      { id: "h7", title: "मेरे बचपन के दिन (Kshitij)", summary: "महादेवी वर्मा की आत्मकथात्मक रचना।", concepts: ["बचपन की स्मृतियाँ"], questions: ["लेखिका का बचपन कैसा था?"] },
      { id: "h8", title: "एक कुत्ता और एक मैना (Kshitij)", summary: "हजारी प्रसाद द्विवेदी की रचना।", concepts: ["पशु-पक्षी मित्रता"], questions: ["कुत्ते और मैना की कहानी क्या है?"] },
      { id: "h9", title: "कबीर के पद (Kshitij)", summary: "कबीर के दोहे — समाज सुधार और आध्यात्मिकता।", concepts: ["दोहे", "निर्गुण भक्ति"], questions: ["कबीर का संदेश क्या था?"] },
      { id: "h10", title: "वाख (Kshitij)", summary: "ललद्यद की वाख — कश्मीरी संत कवित्री।", concepts: ["वाख", "अध्यात्म"], questions: ["ललद्यद कौन थीं?"] },
      { id: "h11", title: "सवैये (Kshitij)", summary: "रसखान के सवैये — कृष्ण भक्ति।", concepts: ["सवैया", "कृष्ण भक्ति"], questions: ["रसखान ने कृष्ण का कैसा वर्णन किया?"] },
      { id: "h12", title: "कैदी और कोकिला (Kshitij)", summary: "सुमित्रानंदन पंत की कविता।", concepts: ["स्वतंत्रता", "प्रकृति"], questions: ["कैदी को कोकिल की बोली कैसी लगी?"] },
      { id: "h13", title: "ग्राम श्री (Kshitij)", summary: "सूर्यकांत त्रिपाठी निराला की कविता।", concepts: ["ग्रामीण जीवन", "प्रकृति"], questions: ["निराला ने गाँव का कैसा चित्र खींचा है?"] },
      { id: "h14", title: "नेताजी का चश्मा (Kritika)", summary: "कहानी — व्यंग्य एवं राजनीतिक व्यवस्था।", concepts: ["व्यंग्य", "राजनीति"], questions: ["नेताजी का चश्मा कहाँ गया?"] },
      { id: "h15", title: "मेरे संग की औरतें (Kritika)", summary: "स्त्रियों के संघर्ष और सशक्तिकरण पर रचना।", concepts: ["स्त्री सशक्तिकरण"], questions: ["लेखिका के अनुसार औरतें कैसी हैं?"] },
    ],
  },
];

export const ALL_SUBJECTS = CURRICULUM;
export const TOTAL_CHAPTERS = CURRICULUM.reduce((a, s) => a + s.chapters.length, 0);

export function getSubject(id: string): Subject | undefined {
  return CURRICULUM.find((s) => s.id === id);
}
export function getChapter(subjectId: string, chapterId: string): Chapter | undefined {
  return getSubject(subjectId)?.chapters.find((c) => c.id === chapterId);
}
