"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { StatCard, EmptyState, Pill, Markdown } from "@/lib/shared";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  PenTool, Sparkles, Brain, Trophy, History, Lightbulb, Upload, RotateCcw,
  Download, CheckCircle2, XCircle, Target, Clock, FileText, Award, TrendingUp,
  Trash2, ChevronRight, Zap,
} from "lucide-react";

// ============================================================================
// Answer Writing Lab — Scholar (Class 9 / Class 11 aware)
// ============================================================================

interface DescriptiveQ {
  id: string;
  subject: "physics" | "chemistry" | "maths" | "cs" | "english" | "biology" | "history" | "economics" | "geography" | "civics";
  subjectName: string;
  chapter: string;
  question: string;
  marks: number;
  keywords: string[];
  modelAnswer: string;
  tips: string;
}

const SUBJECT_COLORS: Record<string, string> = {
  physics: "#3b82f6",
  chemistry: "#10b981",
  maths: "#f59e0b",
  cs: "#8b5cf6",
  english: "#f43f5e",
  history: "#f59e0b",
  biology: "#10b981",
  economics: "#6366f1",
  geography: "#14b8a6",
  civics: "#d946ef",
};

// ===== Class 9 question bank (Science + SST + English) =====
const QUESTIONS_CLASS9: DescriptiveQ[] = [
  // English (2)
  { id: "a1", subject: "english", subjectName: "English", chapter: "The Fun They Had (Beehive)", marks: 5,
    question: "Why was Margie disappointed with her mechanical teacher? How does the story comment on the value of traditional schools?",
    keywords: ["mechanical teacher", "geography sector", "human teacher", "companionship", "playground", "traditional school", "imagined"],
    modelAnswer: "Margie was disappointed with her mechanical teacher because its geography sector had been geared too fast for an eleven-year-old, leading to repeated poor test scores. The County Inspector repaired it but slowed the pace, meaning she had to spend longer hours studying alone. Through Margie's nostalgic reflections on old schools — where children of the same age learned together in a building, helped one another with homework, and shared laughter on the playground — the author Isaac Asimov subtly critiques an overly mechanised education system. He suggests that learning is not merely the transmission of facts but a social experience, and that the human warmth of a classroom — the laughter, friendship and shared curiosity — cannot be replicated by a machine, however efficient. Margie's wistful entry, 'How nice it would be if I could go back to the old school,' is the story's emotional core.",
    tips: "Begin with the immediate cause (geography sector too fast), then widen to the larger theme (mechanised vs human education). Use a specific phrase from the text ('the old kind of school') and close with the story's central message about community in learning." },
  { id: "a2", subject: "english", subjectName: "English", chapter: "The Happy Prince (Moments)", marks: 5,
    question: "Describe how the Happy Prince and the swallow together brought relief to the suffering people of the city. What values does the story uphold?",
    keywords: ["ruby", "sapphire", "gold leaf", "swallow", "seamstress", "playwright", "matchgirl", "sacrifice", "compassion", "lead heart"],
    modelAnswer: "The Happy Prince, standing high above the city on his column, could see all the misery he had been shielded from in his palace days. He asked the swallow — delayed on its journey to Egypt — to act as his messenger. First, the swallow plucked out the ruby from the Prince's sword-hilt and placed it beside the exhausted seamstress whose son was ill with fever. Next, the Prince gave one sapphire eye to a young playwright too cold and hungry to finish his play, and the other to a little matchgirl whose matches had fallen into the gutter. Finally, the swallow stripped the fine gold leaf from the Prince's body, distributing it among the barefoot children of the city. When winter came, the swallow died at the Prince's feet; the lead heart of the statue cracked in two from sorrow. The story upholds the values of selfless compassion, sacrifice, and the spiritual truth that love given freely to the poor is love given to God. Oscar Wilde shows that true wealth is not gold or jewels but a generous heart.",
    tips: "Sequence the acts of giving in order (ruby → sapphires → gold). Mention each recipient by name. End with the symbolism of the cracked lead heart and the story's spiritual message." },

  // History (2)
  { id: "a3", subject: "history", subjectName: "History", chapter: "The French Revolution", marks: 5,
    question: "Explain the social, economic and political causes of the French Revolution of 1789.",
    keywords: ["three estates", "Third Estate", "tax burden", "taille", "tithes", "feudal dues", "empty treasury", "American War", "subsistence crisis", "Enlightenment", "Rousseau", "Estates General"],
    modelAnswer: "The French Revolution of 1789 was the product of long-accumulating social, economic and political tensions. Socially, France was divided into three estates: the Clergy (First Estate) and Nobility (Second Estate) enjoyed vast privileges and paid almost no taxes, while the Third Estate — peasants, artisans and the bourgeoisie — bore the entire tax burden through taille (land tax), tithes to the Church, and feudal dues to lords. Economically, France's treasury was emptied by France's support for the American War of Independence and by the extravagant spending of Louis XVI and Marie Antoinette at Versailles. A rapid population rise from 23 million to 28 million between 1715 and 1789 worsened a subsistence crisis — bread prices soared while wages stagnated. Politically, the king ruled as an absolute monarch with no real forum for the commoners' grievances. Intellectually, the writings of Enlightenment thinkers — Rousseau's Social Contract, Montesquieu's separation of powers, Voltaire's defence of liberty — inspired the middle class to demand equality and popular sovereignty. The immediate trigger was the calling of the Estates General in May 1789 to raise taxes, which the Third Estate transformed into the National Assembly on 17 June 1789.",
    tips: "Structure the answer in clear causes (Social → Economic → Political → Intellectual → Immediate). Use French terms correctly (taille, tithes, Estates General). End with the trigger event — the Estates General of May 1789." },
  { id: "a4", subject: "history", subjectName: "History", chapter: "Nazism and the Rise of Hitler", marks: 5,
    question: "How did the Weimar Republic's weaknesses help Hitler rise to power in Germany?",
    keywords: ["Weimar Republic", "Treaty of Versailles", "war guilt", "reparations", "hyperinflation 1923", "Great Depression", "unemployment", "coalition governments", "stab-in-the-back myth", "propaganda", "Enabling Act 1933"],
    modelAnswer: "The Weimar Republic, established in 1919 after Germany's defeat in World War I, was born under a cloud of distrust. It was blamed by many Germans for signing the humiliating Treaty of Versailles, which imposed war-guilt, territorial losses, and crushing reparations of £6,600 million. Economically, the Republic never recovered: the hyperinflation of 1923 wiped out middle-class savings, and the Great Depression of 1929 sent unemployment soaring to 6 million by 1932. Politically unstable, the Republic saw twenty different cabinets in just fourteen years, with no party ever winning a clear majority. Many conservative Germans believed the 'stab-in-the-back' myth — that the German army had not been defeated on the battlefield but betrayed by politicians and socialists at home. Hitler exploited every one of these weaknesses. Through Nazi propaganda masterminded by Goebbels, he promised to undo Versailles, restore German honour, provide bread and work, and crush communism. Big business, fearing a communist revolution, funded the Nazis. In the elections of 1932 the Nazis became the largest party, and on 30 January 1933 President Hindenburg appointed Hitler Chancellor. The Reichstag Fire and the Enabling Act of March 1933 then gave him dictatorial powers, ending the Weimar experiment.",
    tips: "Cover economic crises (1923 hyperinflation + 1929 Depression), political instability, and the psychological wounds of Versailles. Mention the Enabling Act of March 1933 as the legal end of Weimar democracy." },

  // Science (Biology) (2)
  { id: "a5", subject: "biology", subjectName: "Science", chapter: "Tissues", marks: 5,
    question: "Differentiate between xylem and phloem. Explain how each is adapted to its function.",
    keywords: ["xylem", "phloem", "tracheids", "vessels", "lignin", "unidirectional", "bidirectional", "translocation", "transpiration", "sieve tubes", "companion cells"],
    modelAnswer: "Xylem and phloem together form the conducting tissues of vascular plants, but they differ in structure, function and direction of transport. Xylem transports water and dissolved minerals from the roots up to the leaves and is unidirectional. It is composed of four elements — tracheids, vessels, xylem parenchyma and xylem fibres. Tracheids and vessels are tubular cells whose walls are thickened with lignin, making them strong enough to withstand the negative pressure generated by transpiration pull. The lignin also renders them dead and hollow at maturity, allowing water to flow freely. Phloem, by contrast, transports the products of photosynthesis (mainly sucrose) from the leaves to all other parts of the plant, including roots, fruits and growing shoots — a process called translocation. This transport is bidirectional, depending on the source-to-sink relationship. Phloem consists of sieve tube cells, companion cells, phloem parenchyma and phloem fibres. Sieve tubes are living but lack a nucleus at maturity; companion cells lying alongside them regulate their metabolic activity through cytoplasmic connections called plasmodesmata. Thus, while xylem is built for one-way mechanical water transport, phloem is built for two-way, metabolically active food transport.",
    tips: "Use a clear comparison structure. Highlight key structural features (lignin in xylem; companion cells in phloem). Mention direction of transport (unidirectional vs bidirectional) explicitly." },
  { id: "a6", subject: "biology", subjectName: "Science", chapter: "Why Do We Fall Ill", marks: 3,
    question: "Distinguish between infectious and non-infectious diseases with two examples each. Why are infectious diseases more of a public health concern?",
    keywords: ["infectious", "non-infectious", "pathogen", "bacteria", "virus", "transmission", "tuberculosis", "common cold", "diabetes", "hypertension", "public health", "epidemic"],
    modelAnswer: "Infectious diseases are caused by pathogens — bacteria, viruses, fungi or protozoa — and can spread from one person to another through air, water, food, physical contact or vectors like mosquitoes. Examples include tuberculosis (caused by the bacterium Mycobacterium tuberculosis) and the common cold (caused by rhinoviruses). Non-infectious diseases, in contrast, do not spread between people; they arise from internal causes such as genetic defects, poor nutrition, lifestyle or ageing. Examples include diabetes, hypertension and cancer. Infectious diseases are a greater public health concern because a single case can quickly multiply into an epidemic affecting thousands. They can disrupt schools, workplaces and entire economies, and they tend to strike hardest in densely populated areas with poor sanitation. Hence preventing infectious disease — through vaccination, clean water, sanitation and hygiene — is a national priority.",
    tips: "Define both terms first. Give a pathogen-based example for infectious and a lifestyle/genetic example for non-infectious. End with a sentence on the social dimension (epidemics, sanitation)." },

  // Economics (2)
  { id: "a7", subject: "economics", subjectName: "Economics", chapter: "The Story of Village Palampur", marks: 5,
    question: "What are the factors of production? Explain each with examples from the village of Palampur.",
    keywords: ["factors of production", "land", "labour", "capital", "human capital", "fixed capital", "working capital", "multiple cropping", "Palampur", "irrigation", "tubewell"],
    modelAnswer: "The factors of production are the resources required to produce any good or service. They are grouped under four heads: land, labour, physical capital and human capital. Land refers to all natural resources used in production — in Palampur, the 200 hectares of cultivated land on which farmers grow jowar, bajra, potato and wheat in multiple cropping cycles. Labour is the human effort — physical or mental — that goes into production. In Palampur, small farmers work their own fields, while landless labourers like Dala and Ramkali are hired on daily wages. Physical capital is the variety of inputs required at different stages; it is further divided into fixed capital (tools, machines, buildings that last many years — such as the tubewells, tractors and threshers used in Palampur) and working capital (raw materials and cash in hand needed for each production cycle, like seeds, fertilisers and diesel for the pump). Human capital refers to the knowledge, skill and training of the people — a farmer trained in modern methods or a schoolteacher is human capital. Together these four factors combine in Palampur to produce crops that feed both the village and the wider market.",
    tips: "Define each factor first, then immediately attach the Palampur example. Distinguish fixed vs working capital clearly. End by showing how all four combine." },
  { id: "a8", subject: "economics", subjectName: "Economics", chapter: "People as Resource", marks: 3,
    question: "What is human capital? How is investment in education and health an investment in human capital?",
    keywords: ["human capital", "education", "health", "productivity", "investment", "literacy", "skilled workforce", "GDP", "earnings", "schooling"],
    modelAnswer: "Human capital is the stock of knowledge, skills, training and physical health that people possess, which makes them productive members of the economy. Just as a country invests in machines and factories (physical capital), it must invest in its people. Expenditure on education builds literacy, numeracy and specialised skills; a trained engineer, doctor or teacher produces far more economic value than an unskilled worker of the same age. Expenditure on health — through sanitation, vaccination, nutrition and medical care — ensures that people are physically able to work, attend school regularly and live longer. Healthy, educated workers earn more, pay more taxes, contribute more to GDP, and raise healthier, better-educated children in turn. Hence spending on education and health is not consumption but investment — it pays back over a lifetime through higher productivity, greater earnings and faster national growth.",
    tips: "Define human capital in one sentence. Then explain education → skills → productivity, and health → ability to work → attendance. End with the 'investment, not consumption' insight." },

  // Geography (2)
  { id: "a9", subject: "geography", subjectName: "Geography", chapter: "Climate", marks: 5,
    question: "Explain the factors that affect the climate of India. Why do the Western Ghats receive more rainfall than the Eastern Ghats?",
    keywords: ["latitude", "altitude", "distance from sea", "monsoon", "Western Ghats", "Eastern Ghats", "windward", "leeward", "orographic rainfall", "southwest monsoon"],
    modelAnswer: "India's climate is influenced by several factors: latitude (the Tropic of Cancer divides India into tropical and subtropical zones), altitude (the Himalayas protect India from cold Central Asian winds), distance from the sea (coastal areas have a moderating maritime climate while the interior has an extreme continental climate), and the monsoon winds. The Western Ghats receive far more rainfall than the Eastern Ghats because of orographic rainfall. The southwest monsoon winds, laden with moisture from the Arabian Sea, first strike the windward (western) slopes of the Western Ghats, rise, cool, and shed heavy rain — places like Mahabaleshwar receive over 600 cm. Having lost their moisture, the winds descend on the leeward (eastern) side as dry winds, creating a rain-shadow region. The Eastern Ghats therefore receive much less rainfall. This windward–leeward contrast explains why Mumbai is wetter than Chennai and why the Malabar coast is lush while the Deccan interior is relatively dry.",
    tips: "List the climate factors (latitude, altitude, distance from sea, monsoon). Then explain orographic rainfall using windward–leeward contrast. Mention specific rainfall figures to strengthen the answer." },
  { id: "a10", subject: "geography", subjectName: "Geography", chapter: "Drainage", marks: 3,
    question: "Distinguish between Himalayan and Peninsular rivers. Give two examples of each.",
    keywords: ["Himalayan rivers", "Peninsular rivers", "perennial", "seasonal", "glacial", "rainfed", "Ganga", "Brahmaputra", "Godavari", "Krishna", "course", "meanders"],
    modelAnswer: "Himalayan rivers are perennial — they carry water throughout the year because they are fed both by melting snow from the Himalayas and by rainfall. They have long courses from their source to the sea, perform intensive erosion in their upper course and form large meanders and deltas in their lower course. Major examples are the Ganga and the Brahmaputra. Peninsular rivers, by contrast, are seasonal — they depend mainly on monsoon rainfall and shrink or dry up in summer. They are older than the Himalayan rivers, flow through shallow, graded valleys, have little erosional power, and do not form large meanders. Examples include the Godavari (also called 'Dakshin Ganga') and the Krishna. The Himalayan rivers create large fertile plains (Indo-Gangetic plain) while the Peninsular rivers form plateaus and smaller coastal plains.",
    tips: "Use a comparison table-style answer (Perennial vs Seasonal, Glacial vs Rainfed, Long vs Short course). Always end with two named examples for each." },

  // Civics (2)
  { id: "a11", subject: "civics", subjectName: "Civics", chapter: "What is Democracy? Why Democracy?", marks: 5,
    question: "Define democracy. Explain why democracy is considered the best form of government, despite its limitations.",
    keywords: ["democracy", "popular sovereignty", "elections", "fundamental rights", "accommodation", "dignity", "transparency", "accountability", "deliberation", "legitimacy"],
    modelAnswer: "Democracy is a form of government in which the rulers are elected by the people through free and fair elections, where decision-making is based on public deliberation, and where each adult citizen has one vote. Abraham Lincoln's definition — 'government of the people, by the people, for the people' — captures its essence. Democracy is considered the best form of government for several reasons. First, it is accountable: rulers must answer to the people at regular intervals through elections. Second, it improves the quality of decision-making because decisions are taken after discussion and consultation, reducing the chance of rash or biased actions. Third, it accommodates diversity and resolves differences through negotiation rather than coercion, which is essential in a plural society like India's. Fourth, it enhances the dignity of citizens by giving them political equality and the freedom to criticise the government. Fifth, it allows mistakes to be corrected — a bad law can be repealed, a bad leader can be voted out. Its limitations — delays, populism, role of money and muscle power — are real, but they are outweighed by its capacity for self-correction. As Amartya Sen noted, no famine has ever occurred in a functioning democracy.",
    tips: "Define democracy first (Lincoln quote helps). Then list 4-5 strengths. Acknowledge limitations honestly but show why democracy still wins. End with a memorable insight (Sen, Mandela)." },
  { id: "a12", subject: "civics", subjectName: "Civics", chapter: "Constitutional Design", marks: 3,
    question: "Why did India need a written Constitution? Mention any three features of the Indian Constitution.",
    keywords: ["written constitution", "fundamental rights", "democratic republic", "secular", "parliamentary", "federal", "framers", "Constituent Assembly", "Dr. Ambedkar"],
    modelAnswer: "India needed a written Constitution to define the powers and limits of the new government after Independence, to guarantee fundamental rights to all citizens, to accommodate India's vast diversity of religion, language and caste, and to provide a clear framework for the world's largest democracy. Drafted by the Constituent Assembly between 1946 and 1949 under the chairmanship of Dr. B.R. Ambedkar, the Constitution came into effect on 26 January 1950. Three of its most important features are: (i) it establishes India as a sovereign, socialist, secular, democratic republic; (ii) it guarantees Fundamental Rights to all citizens — including equality before law, freedom of speech and religion, and the right to constitutional remedies; (iii) it adopts a parliamentary form of government with a federal structure, where power is divided between the Union and the States. The Constitution is both a legal document and a moral vision — it tells us not only how we are to be governed but also what kind of society we wish to build.",
    tips: "Begin by stating WHY India needed a written constitution (post-Independence, diversity, guarantee rights). List 3 features clearly with their meaning. End with the dual nature (legal + moral) of the Constitution." },
];

// ===== Class 11 question bank (Physics + Chemistry + Maths + CS + English) =====
const QUESTIONS_CLASS11: DescriptiveQ[] = [
  // Physics (3)
  { id: "c11p1", subject: "physics", subjectName: "Physics", chapter: "Laws of Motion", marks: 5,
    question: "State Newton's three laws of motion. Use the second law to derive the relation between force, mass and acceleration, and explain how the third law is consistent with the conservation of momentum.",
    keywords: ["inertia", "F = ma", "action-reaction", "momentum", "conservation", "impulse", "free body diagram", "net force", "second law", "third law"],
    modelAnswer: "Newton's first law (law of inertia) states that a body continues in its state of rest or of uniform motion in a straight line unless acted upon by a net external force. The second law states that the rate of change of momentum of a body is directly proportional to the applied force and acts in the direction of the force. For constant mass, F = dp/dt = m(dv/dt) = ma, which is the desired relation. The third law states that for every action there is an equal and opposite reaction; forces always occur in pairs acting on different bodies. If two bodies A and B interact, F_AB = -F_BA. Over a time interval dt, the impulse on A equals the impulse on B in magnitude but is opposite in sign, so the change in momentum of A equals the negative change in momentum of B. Hence the total momentum of the isolated two-body system remains constant — the third law is therefore consistent with (and indeed the microscopic basis of) the law of conservation of linear momentum.",
    tips: "State all three laws clearly first, with the standard textbook phrasing. Derive F = ma from F = dp/dt assuming constant mass. For the third-law part, show action-reaction pair mathematically and conclude with conservation." },
  { id: "c11p2", subject: "physics", subjectName: "Physics", chapter: "Work, Energy and Power", marks: 5,
    question: "State and prove the work-energy theorem for a variable force. Hence explain the concept of conservative and non-conservative forces with one example each.",
    keywords: ["work-energy theorem", "variable force", "kinetic energy", "integration", "conservative force", "non-conservative", "potential energy", "spring force", "friction", "path independence"],
    modelAnswer: "The work-energy theorem states that the work done by the net force on a particle equals the change in its kinetic energy. For a variable force F(x) acting along the x-axis, the work done in displacing the particle from x1 to x2 is W = ∫F(x) dx. Using Newton's second law F = ma = m(dv/dt), and converting the variable of integration from t to x via dx = v dt, we get F dx = m(dv/dt)·v dt = mv dv. Integrating both sides from x1 to x2 and the corresponding velocities v1 to v2: W = ∫mv dv = (1/2)m(v2² - v1²) = ΔKE. Hence W = ΔKE, proving the theorem. A conservative force is one in which the work done around any closed path is zero and the work done depends only on the endpoints — examples are gravity, the electrostatic force, and the spring force (F = -kx). Such forces have an associated potential energy function. A non-conservative force is one where the work done depends on the path taken — friction is the classic example; the work done against friction along a longer path is greater, and energy is dissipated as heat, which cannot be fully recovered.",
    tips: "Begin with the statement, then derive carefully showing the dx = v dt conversion. Mention both definitions of conservative force (closed-path zero AND path-independence). End with named examples of each type." },
  { id: "c11p3", subject: "physics", subjectName: "Physics", chapter: "Oscillations", marks: 5,
    question: "Define simple harmonic motion (SHM). Derive expressions for the time period and acceleration of a particle in SHM, and show that the motion of a simple pendulum is approximately SHM for small angles.",
    keywords: ["SHM", "restoring force", "proportional to displacement", "angular frequency", "time period", "simple pendulum", "small angle approximation", "T = 2π√(L/g)", "sin θ ≈ θ"],
    modelAnswer: "Simple harmonic motion is a periodic motion in which the restoring force (and hence the acceleration) is directly proportional to the displacement from the equilibrium position and is always directed towards it: F = -kx, giving a = -(k/m)x = -ω²x, where ω = √(k/m) is the angular frequency. The general solution is x(t) = A sin(ωt + φ). The acceleration is a(t) = -ω²x(t), and the time period is T = 2π/ω = 2π√(m/k). For a simple pendulum of length L and bob mass m, the restoring torque about the pivot is τ = -mgL sin θ. Using the rotational analogue of Newton's law τ = Iα with I = mL², we get α = -(g/L) sin θ. For small angles (θ < 10°), sin θ ≈ θ, so α ≈ -(g/L)θ, which is exactly the SHM equation with ω² = g/L. Hence the time period of a simple pendulum is T = 2π√(L/g). The motion is approximately simple harmonic only for small angular displacements, where the small-angle approximation holds; for larger amplitudes, the period increases slightly and the motion becomes anharmonic.",
    tips: "Define SHM via F = -kx first. Derive T = 2π√(m/k). For the pendulum, set up the torque equation and clearly justify sin θ ≈ θ. End by stating the small-angle condition explicitly." },

  // Chemistry (3)
  { id: "c11c1", subject: "chemistry", subjectName: "Chemistry", chapter: "Structure of Atom", marks: 5,
    question: "State the postulates of Bohr's atomic model. Using Bohr's model, derive the expression for the radius of the nth orbit of a hydrogen atom.",
    keywords: ["Bohr's postulates", "quantized orbits", "angular momentum", "n h / 2π", "Coulomb force", "centripetal force", "r = a₀n²", "Bohr radius", "stationary states"],
    modelAnswer: "Bohr's atomic model (1913) rests on three postulates: (i) the electron revolves around the nucleus only in certain allowed circular orbits (stationary states), in which it does not radiate energy; (ii) the electron can jump from one orbit to another by absorbing or emitting a photon whose energy equals the difference between the two states, hν = E₂ - E₁; (iii) the angular momentum of the electron in a stationary state is quantised: L = mvr = n(h/2π), where n = 1, 2, 3, … To derive the radius of the nth orbit, equate the Coulomb force of attraction to the centripetal force: mv²/r = ke²/r², so mv² = ke²/r. From the quantisation condition, v = nh/(2πmr). Squaring: v² = n²h²/(4π²m²r²). Substituting into the force equation: m·n²h²/(4π²m²r²) = ke²/r, so r = n²h²/(4π²mke²). Setting all constants together gives r = a₀n² where a₀ = h²/(4π²mke²) ≈ 0.529 Å is the Bohr radius. Thus the orbital radii are quantised and scale as n² — the first orbit has radius a₀, the second 4a₀, the third 9a₀, and so on.",
    tips: "List all three postulates before starting the derivation. Set up Coulomb = centripetal clearly. Use the quantisation condition L = nh/2π. Substitute carefully to obtain r = a₀n². Mention the value of a₀." },
  { id: "c11c2", subject: "chemistry", subjectName: "Chemistry", chapter: "Chemical Bonding and Molecular Structure", marks: 5,
    question: "Explain VSEPR theory. Using VSEPR, predict the shapes of CH₄, NH₃, H₂O and SF₆, giving the bond angles in each case.",
    keywords: ["VSEPR", "valence shell", "electron pair repulsion", "lone pair", "bond pair", "geometry", "CH4", "NH3", "H2O", "SF6", "bond angle", "tetrahedral", "octahedral"],
    modelAnswer: "VSEPR (Valence Shell Electron Pair Repulsion) theory, proposed by Gillespie and Nyholm, states that the shape of a molecule is determined by the repulsion between electron pairs (both bond pairs and lone pairs) in the valence shell of the central atom. The electron pairs arrange themselves so as to minimise repulsion, with the order of repulsions being: lone pair-lone pair > lone pair-bond pair > bond pair-bond pair. Applying VSEPR: (i) Methane CH₄ — central carbon has 4 bond pairs and 0 lone pairs. The 4 pairs arrange tetrahedrally, giving a bond angle of 109.5°. (ii) Ammonia NH₃ — central nitrogen has 3 bond pairs and 1 lone pair. The basic electron-pair geometry is tetrahedral, but the molecular geometry is trigonal pyramidal because the lone pair occupies one corner. The lone pair-bond pair repulsion compresses the H-N-H angle to 107°. (iii) Water H₂O — central oxygen has 2 bond pairs and 2 lone pairs. The electron-pair geometry is tetrahedral, but the molecular shape is bent (V-shaped). Two lone pairs compress the H-O-H angle further to 104.5°. (iv) Sulphur hexafluoride SF₆ — central sulphur has 6 bond pairs and 0 lone pairs. The 6 pairs arrange octahedrally, giving bond angles of 90° between adjacent bonds and 180° between opposite bonds. Thus VSEPR correctly predicts that lone pairs progressively distort ideal bond angles.",
    tips: "State VSEPR principle first, then the repulsion order. For each molecule, count bond pairs and lone pairs on the central atom BEFORE stating the shape. Always give the bond angle. SF₆ is a useful exception (octahedral, expanded octet)." },
  { id: "c11c3", subject: "chemistry", subjectName: "Chemistry", chapter: "Equilibrium", marks: 5,
    question: "State Le Chatelier's principle. Predict the effect of (i) increasing temperature, (ii) increasing pressure, and (iii) adding a catalyst on the equilibrium: N₂(g) + 3H₂(g) ⇌ 2NH₃(g); ΔH = -92 kJ.",
    keywords: ["Le Chatelier", "exothermic", "forward reaction", "pressure", "moles of gas", "catalyst", "yield", "rate", "Haber process", "dynamic equilibrium"],
    modelAnswer: "Le Chatelier's principle states that if a system at equilibrium is subjected to a change in concentration, pressure or temperature, the equilibrium shifts in a direction that partially undoes the change. For the Haber process N₂ + 3H₂ ⇌ 2NH₃, ΔH = -92 kJ (exothermic in the forward direction): (i) Increasing temperature adds heat; the system shifts in the endothermic direction (backward), producing less NH₃. Hence low temperature favours a high yield of ammonia but slows the rate — a compromise temperature of ~700 K is used industrially. (ii) Increasing pressure shifts the equilibrium towards the side with fewer gaseous moles. The forward reaction converts 4 moles of gas (1 N₂ + 3 H₂) into 2 moles of NH₃, so high pressure (~200 atm) increases the yield of ammonia. (iii) Adding a catalyst does NOT shift the position of equilibrium — it speeds up both forward and backward reactions equally, helping the system reach equilibrium faster without changing the final composition. Industrially, an iron catalyst is used. Thus, the optimum conditions for ammonia production are low temperature, high pressure, and a catalyst — a textbook example of Le Chatelier's principle applied to industrial chemistry.",
    tips: "State the principle first. Address each of the three changes separately and explicitly. Distinguish yield (affected by T and P) from rate (affected by catalyst). End with the industrial 'compromise conditions' for Haber process." },

  // Maths (3)
  { id: "c11m1", subject: "maths", subjectName: "Mathematics", chapter: "Trigonometric Functions", marks: 5,
    question: "Prove the identity sin 3x = 3 sin x - 4 sin³x. Hence find the general solution of sin 3x = 0.",
    keywords: ["triple angle", "sin(A+B)", "identity", "general solution", "sin x = 0", "nπ", "factorisation", "cubic in sin x"],
    modelAnswer: "We use the identity sin(A + B) = sin A cos B + cos A sin B with A = 2x, B = x: sin 3x = sin(2x + x) = sin 2x cos x + cos 2x sin x. Now use sin 2x = 2 sin x cos x and cos 2x = 1 - 2 sin²x: sin 3x = (2 sin x cos x) cos x + (1 - 2 sin²x) sin x = 2 sin x cos²x + sin x - 2 sin³x. Substituting cos²x = 1 - sin²x: sin 3x = 2 sin x(1 - sin²x) + sin x - 2 sin³x = 2 sin x - 2 sin³x + sin x - 2 sin³x = 3 sin x - 4 sin³x. Hence sin 3x = 3 sin x - 4 sin³x. Setting sin 3x = 0: 3 sin x - 4 sin³x = 0 → sin x(3 - 4 sin²x) = 0. This gives two cases: (a) sin x = 0 → x = nπ, n ∈ ℤ. (b) 3 - 4 sin²x = 0 → sin²x = 3/4 → sin x = ±√3/2 → x = nπ + (-1)ⁿ(π/3) or x = nπ + (-1)ⁿ(2π/3), n ∈ ℤ. Combining, the general solution is x = nπ, or x = nπ ± π/3, or x = nπ ± 2π/3, n ∈ ℤ.",
    tips: "Start with sin(A+B) expansion. Substitute sin 2x and cos 2x identities explicitly. Convert cos²x to 1 - sin²x to get a polynomial in sin x. Factor the resulting cubic and apply the standard general-solution formulas." },
  { id: "c11m2", subject: "maths", subjectName: "Mathematics", chapter: "Limits and Derivatives", marks: 5,
    question: "Using the first principle of differentiation, find the derivative of f(x) = sin x. Hence deduce the derivative of cos x.",
    keywords: ["first principle", "limit definition", "sin(x+h)", "sin(A+B)", "cos(A+B)", "standard limits", "sin h / h", "cos x", "differentiation"],
    modelAnswer: "The derivative of a function f at x, by the first principle (definition of derivative), is f'(x) = lim(h→0) [f(x+h) - f(x)] / h. For f(x) = sin x: f'(x) = lim(h→0) [sin(x+h) - sin x] / h. Expand sin(x+h) using sin(A+B) = sin A cos B + cos A sin B: sin(x+h) = sin x cos h + cos x sin h. Therefore f'(x) = lim(h→0) [sin x cos h + cos x sin h - sin x] / h = lim(h→0) [sin x (cos h - 1) / h] + lim(h→0) [cos x · (sin h / h)]. Using the standard limits lim(h→0) (sin h / h) = 1 and lim(h→0) (cos h - 1) / h = 0: f'(x) = sin x · 0 + cos x · 1 = cos x. Hence d/dx (sin x) = cos x. To deduce the derivative of cos x, write cos x = sin(π/2 - x) and apply the chain rule with the result above: d/dx [cos x] = d/dx [sin(π/2 - x)] = cos(π/2 - x) · d/dx(π/2 - x) = sin x · (-1) = -sin x. Hence d/dx (cos x) = -sin x.",
    tips: "Write the limit definition first. Expand sin(x+h) with the addition formula. Split into two limits and apply the two standard limits. For cos x, use the complementary-angle substitution and chain rule." },
  { id: "c11m3", subject: "maths", subjectName: "Mathematics", chapter: "Permutations and Combinations", marks: 5,
    question: "State the fundamental principle of counting. From a group of 5 boys and 4 girls, in how many ways can a committee of 5 be formed so as to include at least 2 girls? Solve the problem using combinations.",
    keywords: ["fundamental principle", "multiplication", "combinations", "nCr", "at least", "cases", "selection", "committee", "non-negative integer solutions"],
    modelAnswer: "The fundamental principle of counting (multiplication principle) states that if an event can occur in m ways and another independent event in n ways, then the two events together can occur in m × n ways. To form a committee of 5 from 5 boys (B) and 4 girls (G) with at least 2 girls, we consider three mutually exclusive cases: Case 1: exactly 2 girls and 3 boys — number of ways = ⁴C₂ × ⁵C₃ = 6 × 10 = 60. Case 2: exactly 3 girls and 2 boys — number of ways = ⁴C₃ × ⁵C₂ = 4 × 10 = 40. Case 3: exactly 4 girls and 1 boy — number of ways = ⁴C₄ × ⁵C₁ = 1 × 5 = 5. By the addition principle, the total number of ways = 60 + 40 + 5 = 105. Hence the committee can be formed in 105 ways. (We cannot have 5 girls because there are only 4 girls available.) Note: we use combinations ⁿCᵣ = n! / [r!(n-r)!] rather than permutations because the order of selection within the committee does not matter.",
    tips: "State the fundamental principle first. Identify the cases by the number of girls (2, 3, 4 — not 5, since only 4 girls exist). Use ⁿCᵣ (not ⁿPᵣ) since order doesn't matter. Add the cases by the addition principle. Sanity-check by computing the complement: total ways ⁹C₅ = 126, minus (0 girls: 1, 1 girl: 5×4=20) → 126 - 21 = 105 ✓." },

  // Computer Science (3)
  { id: "c11cs1", subject: "cs", subjectName: "Computer Science", chapter: "Conditional and Iterative Statements", marks: 5,
    question: "Differentiate between a for loop and a while loop in Python. Write a Python program to print all prime numbers between 1 and 50 using a for-else construct, and explain each line.",
    keywords: ["for loop", "while loop", "iteration", "for-else", "range", "break", "else clause", "prime number", "divisibility", "Python"],
    modelAnswer: "A for loop in Python iterates over a sequence (such as a list, string, or range) and executes the loop body once per element. It is used when the number of iterations is known in advance. A while loop repeatedly executes its body as long as a Boolean condition remains True; the number of iterations is not known in advance and depends on the condition becoming false. The for loop's syntax is 'for var in sequence:' while the while loop's syntax is 'while condition:'. A common pitfall with while loops is the infinite loop, which occurs if the condition never becomes false.\n\nPython program to print primes between 1 and 50 using for-else:\n\nfor n in range(2, 51):\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            break\n    else:\n        print(n, end=' ')\n\nLine-by-line: (1) Outer loop iterates n from 2 to 50 (range(2, 51) excludes 51). (2) Inner loop iterates i from 2 to √n; we only need to check divisors up to √n because if n = a·b then at least one of a or b is ≤ √n. (3) If n % i == 0, n is divisible by i, so it is not prime — we break out of the inner loop. (4) The else clause attached to the for loop executes only if the loop completed without a break, i.e., no divisor was found, meaning n is prime. (5) We then print n. The output is: 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47.",
    tips: "Define both loops and their syntax first. In the program, justify the √n bound. Explain the for-else construct — the else runs only when the loop completes WITHOUT a break. Show the output to prove correctness." },
  { id: "c11cs2", subject: "cs", subjectName: "Computer Science", chapter: "Lists", marks: 5,
    question: "Explain the difference between a list and a tuple in Python. Write a Python function that takes a list of numbers and returns a new list containing only the even numbers, sorted in descending order.",
    keywords: ["list", "tuple", "mutable", "immutable", "list comprehension", "sorted", "reverse", "filter", "lambda", "Python"],
    modelAnswer: "A list in Python is an ordered, mutable collection of elements enclosed in square brackets []. Elements can be added, removed, or modified after creation — methods like append(), remove(), and sort() modify the list in place. A tuple is an ordered, immutable collection enclosed in parentheses (). Once created, its elements cannot be changed — there are no append or remove methods. Tuples are therefore safer for fixed data (coordinates, dates) and slightly faster than lists. Both support indexing, slicing, and iteration, and both can hold heterogeneous data types.\n\nPython function to filter even numbers and sort in descending order:\n\ndef even_desc(nums):\n    return sorted([x for x in nums if x % 2 == 0], reverse=True)\n\n# Example:\n# even_desc([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])\n# returns [10, 8, 6, 4, 2]\n\nExplanation: (1) The list comprehension [x for x in nums if x % 2 == 0] iterates over each element x in the input list nums and includes it in the new list only if x % 2 == 0 (i.e., x is even). (2) The built-in sorted() function returns a new list sorted in ascending order by default. (3) Passing reverse=True sorts in descending order instead. (4) The function returns the resulting list. The space complexity is O(n) for the new list; the time complexity is O(n log n) due to the sort.",
    tips: "Define both data types with their brackets ([] vs ()) and the key difference (mutable vs immutable). In the function, use a list comprehension for the filter and sorted() with reverse=True for the sort. Mention time complexity to add depth." },
  { id: "c11cs3", subject: "cs", subjectName: "Computer Science", chapter: "File Handling", marks: 5,
    question: "Explain the different modes of opening a file in Python. Write a Python program that reads a text file 'data.txt', counts the number of lines, words and characters, and writes the result to a new file 'stats.txt'.",
    keywords: ["file modes", "read mode", "write mode", "append mode", "with statement", "readlines", "split", "len", "Python", "context manager"],
    modelAnswer: "Python's open() function accepts a mode argument that determines how the file is handled. The common modes are: 'r' — read mode (default); file must exist, raises FileNotFoundError otherwise. 'w' — write mode; creates a new file or truncates an existing one to zero length. 'a' — append mode; creates the file if it does not exist, otherwise writes are appended to the end. 'r+' — read and write without truncation. 'x' — exclusive creation; fails if the file already exists. Binary modes ('rb', 'wb', 'ab') are used for non-text files like images. The 'with open(...) as f:' context manager is preferred because it automatically closes the file when the block exits, even if an exception occurs.\n\nPython program to count lines, words, and characters:\n\nwith open('data.txt', 'r') as f:\n    content = f.read()\n    lines = content.splitlines()\n    num_lines = len(lines)\n    num_words = len(content.split())\n    num_chars = len(content)\n\nwith open('stats.txt', 'w') as out:\n    out.write(f'Lines: {num_lines}\\n')\n    out.write(f'Words: {num_words}\\n')\n    out.write(f'Characters: {num_chars}\\n')\n\nExplanation: (1) The first 'with open' reads the entire content of 'data.txt' into the string 'content' using f.read(). (2) splitlines() splits the content on newline characters and returns a list of lines; len() gives the count. (3) split() splits on any whitespace (spaces, tabs, newlines) and returns a list of words; len() gives the word count. (4) len(content) gives the total number of characters (including spaces and newlines). (5) The second 'with open' opens 'stats.txt' in write mode ('w'), creating or overwriting it, and writes the three statistics. The use of 'with' ensures both files are properly closed even if an error occurs during processing.",
    tips: "List the modes with their behaviour (truncate vs append vs exclusive). Recommend the 'with' statement and explain why (auto-close). In the program, explain each counting technique (splitlines for lines, split for words, len for chars). Mention that 'w' overwrites existing files." },

  // English (3) — Hornbill + Snapshots
  { id: "c11e1", subject: "english", subjectName: "English", chapter: "The Portrait of a Lady (Hornbill)", marks: 5,
    question: "Describe the changing relationship between the narrator and his grandmother as depicted in 'The Portrait of a Lady'. What does the grandmother symbolise?",
    keywords: ["Khushwant Singh", "grandmother", "childhood friendship", "city life", "loneliness", "feeding sparrows", "old woman", "scriptures", "acceptance", "tradition"],
    modelAnswer: "In 'The Portrait of a Lady', Khushwant Singh traces three phases of his relationship with his grandmother. In the village, during his early childhood, they were constant companions — she woke him, bathed him, dressed him, gave him a stale chapatti with butter and sugar for breakfast, and walked him to school, where she sat in the temple reading scriptures while he studied. Their friendship was intimate and almost wordless. The second phase began when they moved to the city to live with the narrator's parents. The grandmother could no longer accompany him to school; the English-medium school, with its no-God, no-scriptures curriculum, distressed her deeply. She stopped talking to him, withdrew into her rosary and her spinning wheel, and spent her time feeding stray dogs and sparrows. The third and final phase came when the narrator went abroad for higher studies. The grandmother came to the station to see him off — calm, silent, not a trace of emotion. When he returned five years later, she was frail and old, but she celebrated his homecoming by singing prayers and beating an old drum. That night she died peacefully, surrounded by mournful sparrows who had come to bid her farewell. The grandmother symbolises the quiet strength of tradition, faith, and unconditional love — a vanishing India of simple piety, restraint, and grace.",
    tips: "Structure the answer in three clear phases (village → city → return from abroad). Use specific details (chapatti with sugar, feeding sparrows, station farewell) to anchor the analysis. End with what she symbolises (tradition, faith, silent love)." },
  { id: "c11e2", subject: "english", subjectName: "English", chapter: "We're Not Afraid to Die (Hornbill)", marks: 5,
    question: "'We're Not Afraid to Die…if we can all be together.' Justify the title of the chapter with reference to the courage and unity displayed by the family.",
    keywords: ["Gordon Cook", "wavewalker", "storm", "Indian Ocean", "Sue", "Jonathan", "Mary", "lifeline", "courage", "unity", "survival"],
    modelAnswer: "The title of Gordon Cook's chapter is the central message of the entire narrative: courage is possible, and death is acceptable, only as long as the family is united. The story chronicles the Cook family's attempt to duplicate Captain James Cook's round-the-world voyage of 200 years earlier. Their boat Wavewalker, 23 metres long and 30 tons in weight, was built professionally in the Netherlands for the open ocean. In July 1976, somewhere south of Cape Town in the Indian Ocean, a gigantic wave — 'a vertical, almost vertical, huge wave' — struck the boat, shattering the deck timbers and nearly capsizing her. The narrator was thrown overboard but miraculously survived, sustained only by the lifeline of his harness. His wife Mary took the wheel while water poured into the cabin; his daughter Sue, though badly injured with a swollen black eye and a deep cut on her head, never complained; his son Jonathan, just six years old, told his father 'Daddy, if we are all going to die, we are not afraid to die.' That single statement becomes the moral centre of the story — it reveals that courage is not the absence of fear, but the willingness to face death if those you love are with you. Through three days of desperate pumping, navigation by dead reckoning, and finally the sight of Ile Amsterdam — a tiny volcanic island in the southern Indian Ocean — the family survives not because of equipment or expertise alone, but because every member, even the children, refused to abandon the others. The title is thus both a tribute and a thesis: unity is the highest form of courage.",
    tips: "Quote the title directly and unpack it. Recount the storm scene vividly with concrete details (23-metre boat, July 1976, shattering timbers). Highlight each family member's contribution (Mary at the wheel, Sue injured but uncomplaining, Jonathan's quoted line). End by explaining the title as both tribute and thesis." },
  { id: "c11e3", subject: "english", subjectName: "English", chapter: "Ranga's Marriage (Snapshots)", marks: 5,
    question: "Comment on the institution of marriage as portrayed in 'Ranga's Marriage'. How does the narrator engineer Ranga's marriage, and what does this reveal about his character?",
    keywords: ["Masti Venkatesha Iyengar", "Ranga", "Hosahalli", "narrator", "Shastri", "Ratna", "arranged marriage", "astrology", "matchmaking", "village customs"],
    modelAnswer: "In 'Ranga's Marriage', Masti Venkatesha Iyengar offers a gently ironic portrait of arranged marriage in a South Indian village at the turn of the twentieth century. The narrator, a loquacious old resident of Hosahalli, views marriage as both a social duty and a crafty art — something that must be arranged with cunning rather than left to the whimsy of romantic love. Ranga, the village's first English-educated young man, returns from Bangalore speaking a few English phrases, and the entire village gathers to inspect him. To the narrator's relief, Ranga still touches the elder's feet and behaves with traditional respect; but when he declares he will marry only a girl of his own choice and at the right age, the narrator resolves to teach him a lesson. Through a carefully staged encounter at his own home, the narrator introduces Ranga to Ratna — the beautiful eleven-year-old niece of Rama Rao, who is singing. Ranga is captivated but hesitant; the narrator then enlists the village Shastri, instructing him in advance to invent an astrological forecast that Ranga is destined to marry a girl named Ratna. Bit by bit, the narrator dismantles Ranga's modern objections, and the marriage is arranged. The story thus portrays arranged marriage not as oppression but as a clever, affectionate social dance. The narrator emerges as a master manipulator — well-meaning but mischievous, who treats social engineering as a gentle art and believes that custom, astrology, and a little white lie are perfectly legitimate tools for bringing two young people together.",
    tips: "Begin by setting the village context (Hosahalli, English education). Trace the narrator's plan step by step (introduce Ratna → enlist Shastri → invent astrology). End with what the narrator's manipulation reveals about him (clever, affectionate, traditional but not rigid)." },
];

// Active question bank — switches with scholarClass
function useActiveQuestions(): DescriptiveQ[] {
  const scholarClass = useStore((s) => s.user.scholarClass);
  return scholarClass === 11 ? QUESTIONS_CLASS11 : QUESTIONS_CLASS9;
}

interface EvalResult {
  score: number;
  maxScore: number;
  correctConcepts: string[];
  missingConcepts: string[];
  formulaFeedback: string;
  unitsFeedback: string;
  stepFeedback: string;
  improvedAnswer: string;
  source: "ai" | "local-rubric";
  predictedMarks: number;
  breakdown: { criterion: string; score: number; max: number; comment: string }[];
  keywordsHit: string[];
  keywordsMissed: string[];
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
}

interface EvaluationPayload {
  score: number;
  maxScore: number;
  correctConcepts: string[];
  missingConcepts: string[];
  formulaFeedback: string;
  unitsFeedback: string;
  stepFeedback: string;
  markingBreakdown: { criterion: string; marksAwarded: number; maxMarks: number; feedback: string }[];
  improvedAnswer: string;
}

interface HistoryEntry {
  id: string;
  questionId: string;
  question: string;
  subjectName: string;
  chapter: string;
  userAnswer: string;
  result: EvalResult;
  at: number;
}
function loadHistory(scholarClass: 9 | 11): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<HistoryEntry[]>(scholarClass, "answer-lab-history", []);
}
function saveHistory(scholarClass: 9 | 11, list: HistoryEntry[]) {
  profileSetJSON(scholarClass, "answer-lab-history", list);
}

// ============================================================================
// Component
// ============================================================================
export function AnswerLabView() {
  const addXP = useStore((s) => s.addXP);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const QUESTIONS = useActiveQuestions();
  const studentName = scholarClass === 11 ? "Ishan" : "Neha";
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const [fSubject, setFSubject] = useState<string>("all");
  const [activeQ, setActiveQ] = useState<DescriptiveQ | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [evaluationError, setEvaluationError] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"problem" | "write" | "feedback">("problem");
  const answerPanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => { setHistory(loadHistory(scholarClass)); }, [scholarClass]);

  const filteredQs = useMemo(() => {
    return QUESTIONS.filter((q) => fSubject === "all" || q.subject === fSubject);
  }, [fSubject, QUESTIONS]);

  const totalEvaluated = history.length;
  const avgMarks = history.length > 0
    ? Math.round(history.reduce((sum, h) => sum + h.result.predictedMarks, 0) / history.length * 10) / 10
    : 0;
  const totalMarksAvailable = QUESTIONS.reduce((a, q) => a + q.marks, 0);
  const bestScore = history.length > 0
    ? Math.max(...history.map((h) => {
        const m = QUESTIONS.find((q) => q.id === h.questionId)?.marks ?? 1;
        return (h.result.predictedMarks / m) * 100;
      }))
    : 0;

  const selectQuestion = (q: DescriptiveQ) => {
    setActiveQ(q); setAnswer(""); setEvalResult(null); setEvaluationError(false); setUploadedName(null);
    setMobileTab("write");
    setTimeout(() => { answerPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedName(file.name);
    toast.success("Handwritten sheet attached", { description: `${file.name} • Use the text box above to transcribe it for AI evaluation.` });
  };

  const storeEvaluation = (structured: EvaluationPayload, source: EvalResult["source"]) => {
    if (!activeQ) return;
    const score = Math.max(0, Math.min(activeQ.marks, Number(structured.score) || 0));
    const result: EvalResult = {
      ...structured,
      score,
      maxScore: activeQ.marks,
      source,
      predictedMarks: score,
      breakdown: structured.markingBreakdown.map((item) => ({
        criterion: item.criterion,
        score: Math.min(item.maxMarks, item.marksAwarded),
        max: item.maxMarks,
        comment: item.feedback,
      })),
      keywordsHit: structured.correctConcepts,
      keywordsMissed: structured.missingConcepts,
      strengths: structured.correctConcepts.length ? structured.correctConcepts : ["A relevant attempt was made."],
      improvements: [
        ...structured.missingConcepts,
        structured.formulaFeedback,
        structured.unitsFeedback,
        structured.stepFeedback,
      ].filter(Boolean),
      modelAnswer: structured.improvedAnswer,
    };
    setEvalResult(result);
    setEvaluationError(false);
    setMobileTab("feedback");
    addXP(8);
    addCoins(2);
    const entry: HistoryEntry = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      questionId: activeQ.id, question: activeQ.question, subjectName: activeQ.subjectName,
      chapter: activeQ.chapter, userAnswer: answer, result, at: Date.now(),
    };
    const next = [entry, ...history].slice(0, 50);
    setHistory(next); saveHistory(scholarClass, next);
    pushActivity({ type: "ai", text: `Answer Lab evaluated: ${activeQ.chapter} (${result.predictedMarks}/${activeQ.marks})`, icon: "✍️" });
    toast.success(`Evaluated: ${result.predictedMarks}/${activeQ.marks} marks`, { description: source === "ai" ? "+8 XP · +2 coins" : "Local rubric evaluation · +8 XP · +2 coins" });
  };

  const evaluate = async () => {
    if (!activeQ) return;
    if (answer.trim().length < 40) { toast.error("Write at least a few sentences for AI to evaluate."); return; }
    setEvaluating(true); setEvalResult(null); setEvaluationError(false);
    try {
      const prompt = `You are a CBSE Class ${scholarClass} board examiner evaluating a descriptive answer.
Subject: ${activeQ.subjectName} • Chapter: ${activeQ.chapter} • Marks: ${activeQ.marks}
Question: ${activeQ.question}
Required concepts: ${activeQ.keywords.join(", ")}

Student's answer:
"""
${answer}
"""

Return exactly: score, maxScore, correctConcepts, missingConcepts, formulaFeedback, unitsFeedback, stepFeedback, markingBreakdown, and improvedAnswer. Each markingBreakdown item must contain criterion, marksAwarded, maxMarks, and feedback. score must be between 0 and ${activeQ.marks}; maxScore must be ${activeQ.marks}. improvedAnswer must be a complete board-style model answer.`;
      const structured = await askAIJSON<EvaluationPayload>(prompt, "default", { mode: "answer-evaluation" });
      if (!structured) throw new Error("No result");
      storeEvaluation(structured, "ai");
    } catch {
      setEvaluationError(true);
      toast.error("Could not evaluate the answer", { description: "Retry AI or use the local rubric evaluation." });
    } finally { setEvaluating(false); }
  };

  const useLocalRubricEvaluation = () => {
    if (!activeQ) return;
    const normalizedAnswer = answer.toLowerCase();
    const correctConcepts = activeQ.keywords.filter((keyword) => normalizedAnswer.includes(keyword.toLowerCase()));
    const missingConcepts = activeQ.keywords.filter((keyword) => !correctConcepts.includes(keyword));
    const conceptRatio = activeQ.keywords.length > 0 ? correctConcepts.length / activeQ.keywords.length : 0.5;
    const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
    const structureRatio = Math.min(1, wordCount / Math.max(60, activeQ.marks * 25));
    const rawScore = activeQ.marks * (conceptRatio * 0.75 + structureRatio * 0.25);
    const score = Math.round(rawScore * 2) / 2;
    const conceptMax = Math.max(0.5, activeQ.marks * 0.7);
    const structureMax = Math.max(0.5, activeQ.marks - conceptMax);
    storeEvaluation({
      score,
      maxScore: activeQ.marks,
      correctConcepts,
      missingConcepts,
      formulaFeedback: "Local check: verify every formula against the textbook and define each symbol before substitution.",
      unitsFeedback: "Local check: include SI units wherever the question involves measurable quantities.",
      stepFeedback: wordCount >= 60 ? "The response has enough detail; organize it into explicit logical steps." : "Expand the response with numbered reasoning steps and a conclusion.",
      markingBreakdown: [
        { criterion: "Required concepts", marksAwarded: conceptMax * conceptRatio, maxMarks: conceptMax, feedback: `${correctConcepts.length} of ${activeQ.keywords.length} rubric concepts detected.` },
        { criterion: "Structure and completeness", marksAwarded: structureMax * structureRatio, maxMarks: structureMax, feedback: `${wordCount} words detected; check the answer manually for accuracy.` },
      ],
      improvedAnswer: activeQ.modelAnswer,
    }, "local-rubric");
  };

  const rewrite = async () => {
    if (!activeQ || !evalResult) return;
    setEvaluating(true);
    try {
      const improved = evalResult.modelAnswer;
      setAnswer(improved);
      toast.success("Model answer loaded into the editor", { description: "Compare it with your original — note the differences." });
    } finally { setEvaluating(false); }
  };

  const clearHistory = () => { setHistory([]); saveHistory(scholarClass, []); toast.success("History cleared."); };
  const exportEval = (entry: HistoryEntry) => {
    const bodyHtml = mdToHtml(`# Answer Writing Lab — Evaluation Report

**Subject:** ${entry.subjectName} • **Chapter:** ${entry.chapter}
**Question:** ${entry.question}
**Marks Scored:** ${entry.result.predictedMarks} / ${entry.subjectName && QUESTIONS.find((q) => q.id === entry.questionId)?.marks}
**Date:** ${new Date(entry.at).toLocaleString()}

## Your Answer
${entry.userAnswer}

## Breakdown
${entry.result.breakdown.map((b) => `- **${b.criterion}**: ${b.score}/${b.max} — ${b.comment}`).join("\n")}

## Keywords Hit
${entry.result.keywordsHit.map((k) => `✓ ${k}`).join("\n") || "—"}

## Keywords Missed
${entry.result.keywordsMissed.map((k) => `✗ ${k}`).join("\n") || "—"}

## Strengths
${entry.result.strengths.map((s) => `+ ${s}`).join("\n")}

## Improvements
${entry.result.improvements.map((s) => `→ ${s}`).join("\n")}

## Model Answer
${entry.result.modelAnswer}

> Generated by Scholar Answer Writing Lab.`);
    exportPDF({ title: "Answer Lab — Evaluation", subtitle: `${entry.subjectName} • ${entry.chapter}`, bodyHtml, accent: SUBJECT_COLORS[entry.subjectName.toLowerCase()] ?? "#6366f1", scholarClass });
    toast.success("Exporting evaluation…");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .al-font-serif { font-family: 'Instrument Serif', serif; }
        .al-font-body { font-family: 'Inter', sans-serif; }
        .al-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .al-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .al-glass input, .al-glass textarea, .al-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .al-glass input::placeholder, .al-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .al-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .al-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      `}</style>

      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 al-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500/30 to-pink-500/30 text-rose-300 border border-white/10">
              <PenTool className="h-6 w-6" />
            </div>
            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40">Descriptive Writing • CBSE Class {scholarClass}</Badge>
          </div>
          <h1 className="al-font-serif text-5xl md:text-6xl text-white leading-tight">
            Answer Writing <em className="text-rose-300">Lab</em>
          </h1>
          <p className="text-white/70 mt-3 max-w-2xl">
            Master the art of long-form answers. Write, attach handwritten sheets, and let AI evaluate you
            on content, structure, keyword coverage and language — like a real CBSE examiner.
          </p>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {[
            { icon: Trophy, label: "Answers Evaluated", value: totalEvaluated, accent: "#f43f5e" },
            { icon: Target, label: "Average Marks", value: avgMarks, accent: "#6366f1" },
            { icon: TrendingUp, label: "Best Score", value: `${Math.round(bestScore)}%`, accent: "#10b981" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        <Tabs defaultValue="practice" className="space-y-6">
          <TabsList className="al-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="practice" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Practice</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">History</TabsTrigger>
            <TabsTrigger value="tips" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Tips</TabsTrigger>
          </TabsList>

          {/* ===== PRACTICE ===== */}
          <TabsContent value="practice" className="space-y-6">
            {/* Subject filter */}
            <div className="al-glass rounded-2xl p-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/50 mr-2">Subject:</span>
              <Pill active={fSubject === "all"} onClick={() => setFSubject("all")}>All</Pill>
              {Array.from(new Set(QUESTIONS.map((q) => q.subject))).map((sid) => {
                const sample = QUESTIONS.find((q) => q.subject === sid)!;
                return (
                  <Pill key={sid} active={fSubject === sid} onClick={() => setFSubject(sid)} color={SUBJECT_COLORS[sid]}>
                    {sample.subjectName}
                  </Pill>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-[320px_1fr] gap-4">
              {/* Mobile sub-tabs */}
              <div className="lg:hidden al-glass rounded-xl p-1 flex gap-1 sticky top-2 z-10">
                {([
                  { id: "problem", label: "Problem" },
                  { id: "write", label: "Write Answer" },
                  { id: "feedback", label: "Feedback" },
                ] as const).map((t) => (
                  <button key={t.id} onClick={() => setMobileTab(t.id)}
                    className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[44px] flex items-center justify-center",
                      mobileTab === t.id ? "bg-white/15 text-white" : "text-white/60 hover:text-white")}>
                    {t.label}
                    {t.id === "feedback" && evalResult && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  </button>
                ))}
              </div>

              {/* Question list */}
              <div className={cn("space-y-2 lg:max-h-[70vh] overflow-y-auto al-scroll pr-1 lg:block", mobileTab === "problem" ? "block" : "hidden")}>
                {filteredQs.map((q, i) => {
                  const color = SUBJECT_COLORS[q.subject];
                  const isActive = activeQ?.id === q.id;
                  return (
                    <motion.button
                      key={q.id}
                      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      onClick={() => selectQuestion(q)}
                      className={cn("w-full text-left p-3 rounded-xl border transition-all min-h-[64px]",
                        isActive ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]")}
                      style={isActive ? { borderLeftColor: color, borderLeftWidth: 3 } : { borderLeftColor: color, borderLeftWidth: 3, opacity: 0.85 }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge style={{ background: `${color}22`, color, border: `${color}55` }}>{q.subjectName}</Badge>
                        <span className="text-xs text-white/50">{q.marks} marks</span>
                      </div>
                      <p className="text-sm text-white/90 line-clamp-2">{q.question}</p>
                      <p className="text-xs text-white/50 mt-1">{q.chapter}</p>
                    </motion.button>
                  );
                })}
              </div>

              {/* Answer panel */}
              <div ref={answerPanelRef} className={cn("lg:block", mobileTab === "write" || mobileTab === "feedback" ? "block" : "hidden")}>
                {!activeQ ? (
                  <div className="al-glass rounded-2xl p-12 text-center">
                    <PenTool className="h-10 w-10 text-white/30 mx-auto mb-3" />
                    <h3 className="text-white/80 font-medium mb-1">Pick a question to begin</h3>
                    <p className="text-sm text-white/50">Choose from the list on the left — your AI examiner is ready.</p>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Question card */}
                    <div className="al-glass rounded-2xl p-5">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge style={{ background: `${SUBJECT_COLORS[activeQ.subject]}22`, color: SUBJECT_COLORS[activeQ.subject], border: `${SUBJECT_COLORS[activeQ.subject]}55` }}>{activeQ.subjectName}</Badge>
                        <span className="text-xs text-white/50">{activeQ.chapter}</span>
                        <span className="text-xs text-white/40">•</span>
                        <span className="text-xs text-white/50">{activeQ.marks} marks</span>
                      </div>
                      <ScholarAIContent content={activeQ.question} mode="compact" className="text-lg text-white" />
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {activeQ.keywords.map((k) => (
                          <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/10">{k}</span>
                        ))}
                      </div>
                    </div>

                    {/* Answer textarea */}
                    <div className="al-glass rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs uppercase tracking-wider text-white/50">Your Answer</label>
                        <span className="text-xs text-white/50">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
                      </div>
                      <Textarea
                        rows={12}
                        placeholder="Write your full answer here. Aim for clear paragraphs, key terms from the question, and a concluding sentence…"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        className="bg-white/5 border-white/15 text-white resize-y"
                      />

                      <div className="flex items-center gap-2 flex-wrap mt-3">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
                        <Button variant="outline" size="sm" className="bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload handwritten
                        </Button>
                        {uploadedName && (
                          <span className="text-xs text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {uploadedName}
                          </span>
                        )}
                        <div className="ml-auto flex gap-2">
                          <Button variant="ghost" size="sm" className="text-white/70" disabled={!answer || evaluating} onClick={() => { setAnswer(""); setEvalResult(null); }}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Clear
                          </Button>
                          <Button size="sm" className="bg-rose-500 hover:bg-rose-600 text-white" disabled={!answer || evaluating} onClick={evaluate}>
                            {evaluating ? (
                              <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block"><Brain className="h-3.5 w-3.5 mr-1.5" /></motion.span> Evaluating…</>
                            ) : (
                              <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Evaluate</>
                            )}
                          </Button>
                        </div>
                      </div>
                      {evaluationError && !evaluating && (
                        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                          <p className="text-sm font-semibold text-amber-200">AI evaluation is unavailable.</p>
                          <p className="text-xs text-white/60 mt-1">The local rubric checks required concepts and structure without inventing an AI response.</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Button size="sm" variant="outline" onClick={evaluate}>Retry AI</Button>
                            <Button size="sm" variant="outline" onClick={useLocalRubricEvaluation}>Use Local Rubric Evaluation</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEvaluationError(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Evaluation result */}
                    <AnimatePresence>
                      {evalResult && (
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("space-y-4", mobileTab !== "feedback" && "lg:block hidden")}>
                          {/* Score banner */}
                          <div className="al-glass-strong rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="grid place-items-center h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-300">
                                  <Trophy className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-xs text-white/50 uppercase tracking-wider">{evalResult.source === "local-rubric" ? "Local rubric evaluation" : "AI Examiner's Score"}</p>
                                  <p className="text-3xl text-white font-bold tabular-nums">
                                    {evalResult.predictedMarks}<span className="text-white/50 text-lg">/{activeQ.marks}</span>
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="border-white/20 text-white/70">
                                {Math.round((evalResult.predictedMarks / activeQ.marks) * 100)}%
                              </Badge>
                            </div>
                            <Progress value={(evalResult.predictedMarks / activeQ.marks) * 100} className="bg-white/10 h-2" />
                          </div>

                          {/* Breakdown */}
                          <div className="al-glass rounded-2xl p-5">
                            <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-rose-300" /> Breakdown</h4>
                            <div className="space-y-3">
                              {evalResult.breakdown.map((b, i) => (
                                <div key={i}>
                                  <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-white/80">{b.criterion}</span>
                                    <span className="text-white/60 tabular-nums">{b.score}/{b.max}</span>
                                  </div>
                                  <Progress value={(b.score / b.max) * 100} className="bg-white/10 h-1.5 mb-1" />
                                  <p className="text-xs text-white/50">{b.comment}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Keywords */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="al-glass rounded-2xl p-5">
                              <h4 className="text-white font-semibold mb-3 text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Keywords Hit ({evalResult.keywordsHit.length})</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {evalResult.keywordsHit.length ? evalResult.keywordsHit.map((k) => (
                                  <span key={k} className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">{k}</span>
                                )) : <span className="text-xs text-white/40">None</span>}
                              </div>
                            </div>
                            <div className="al-glass rounded-2xl p-5">
                              <h4 className="text-white font-semibold mb-3 text-sm flex items-center gap-2"><XCircle className="h-4 w-4 text-rose-300" /> Keywords Missed ({evalResult.keywordsMissed.length})</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {evalResult.keywordsMissed.length ? evalResult.keywordsMissed.map((k) => (
                                  <span key={k} className="text-xs px-2 py-1 rounded-full bg-rose-500/15 text-rose-200 border border-rose-500/30">{k}</span>
                                )) : <span className="text-xs text-white/40">All hit!</span>}
                              </div>
                            </div>
                          </div>

                          {/* Strengths / Improvements */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="al-glass rounded-2xl p-5">
                              <h4 className="text-white font-semibold mb-3 text-sm flex items-center gap-2"><Award className="h-4 w-4 text-emerald-300" /> Strengths</h4>
                              <ul className="space-y-2">
                                {evalResult.strengths.map((s, i) => (
                                  <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                                    <span className="text-emerald-400 mt-0.5">+</span> {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="al-glass rounded-2xl p-5">
                              <h4 className="text-white font-semibold mb-3 text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-300" /> Improvements</h4>
                              <ul className="space-y-2">
                                {evalResult.improvements.map((s, i) => (
                                  <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                                    <ChevronRight className="h-3.5 w-3.5 text-amber-300 mt-0.5 shrink-0" /> {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Model answer */}
                          <div className="al-glass rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-white font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-300" /> Model Answer</h4>
                              <Button size="sm" variant="ghost" className="text-white/70" onClick={rewrite}>
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Load into editor
                              </Button>
                            </div>
                            <ScholarAIContent content={evalResult.modelAnswer} className="text-sm text-white/80" />
                          </div>

                          <Button variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10"
                            onClick={() => {
                              const entry: HistoryEntry = {
                                id: Math.random().toString(36).slice(2), questionId: activeQ.id, question: activeQ.question,
                                subjectName: activeQ.subjectName, chapter: activeQ.chapter, userAnswer: answer, result: evalResult, at: Date.now(),
                              };
                              exportEval(entry);
                            }}>
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export this evaluation
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ===== HISTORY ===== */}
          <TabsContent value="history" className="space-y-4">
            <div className="al-glass rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2"><History className="h-4 w-4 text-rose-300" /> Evaluation History</h3>
                <p className="text-xs text-white/60 mt-0.5">{history.length} evaluations stored locally.</p>
              </div>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" className="text-rose-300 hover:bg-rose-500/10" onClick={clearHistory}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
                </Button>
              )}
            </div>
            {history.length === 0 ? (
              <EmptyState icon={History} title="No evaluations yet" description="Practice answering any question and your AI-marked results will appear here." />
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto al-scroll pr-2">
                {history.map((h, i) => {
                  const q = QUESTIONS.find((q) => q.id === h.questionId);
                  const pct = q ? Math.round((h.result.predictedMarks / q.marks) * 100) : 0;
                  const color = SUBJECT_COLORS[h.subjectName.toLowerCase()] ?? "#6366f1";
                  return (
                    <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="al-glass rounded-xl p-4 border-l-2" style={{ borderLeftColor: color }}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge style={{ background: `${color}22`, color, border: `${color}55` }}>{h.subjectName}</Badge>
                            <span className="text-xs text-white/50">{h.chapter}</span>
                          </div>
                          <p className="text-sm text-white/90 line-clamp-2">{h.question}</p>
                          <p className="text-xs text-white/40 mt-1">{new Date(h.at).toLocaleString()}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-white tabular-nums">{h.result.predictedMarks}<span className="text-white/50 text-sm">/{q?.marks ?? "?"}</span></p>
                          <Badge variant="outline" className={cn("border", pct >= 80 ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : pct >= 50 ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-rose-500/15 border-rose-500/40 text-rose-300")}>{pct}%</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" variant="ghost" className="text-white/70 h-7" onClick={() => exportEval(h)}>
                          <Download className="h-3 w-3 mr-1" /> Export
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== TIPS ===== */}
          <TabsContent value="tips" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: Target, color: "#f43f5e", title: "Decode the question", text: "Underline verbs like 'explain', 'differentiate', 'analyse'. They tell you the depth and structure expected." },
                { icon: Lightbulb, color: "#f59e0b", title: "Open with a definition", text: "Begin every answer with a one-line definition or context. Examiners form an impression in the first sentence." },
                { icon: CheckCircle2, color: "#10b981", title: "Use keywords", text: "Sprinkle subject-specific terms (lignin, taille, ITCZ, Constituent Assembly). Each keyword earns a partial mark." },
                { icon: FileText, color: "#6366f1", title: "Structure with paragraphs", text: "Intro → main body → conclusion. Use bullet points for differentiate-type questions. Number steps for derivations." },
                { icon: Award, color: "#d946ef", title: "Conclude strongly", text: "End with the significance, exception or real-world connection. A weak conclusion loses the final mark." },
                { icon: Clock, color: "#14b8a6", title: "Time per mark", text: "Allocate ~1.5 minutes per mark in CBSE exams. A 5-mark answer should take 7-8 minutes — practice with a timer." },
              ].map((tip, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="al-glass rounded-2xl p-5">
                  <div className="grid place-items-center h-10 w-10 rounded-xl mb-3" style={{ background: `${tip.color}22`, color: tip.color }}>
                    <tip.icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-white font-semibold mb-1">{tip.title}</h4>
                  <p className="text-sm text-white/70 leading-relaxed">{tip.text}</p>
                </motion.div>
              ))}
            </div>

            <div className="al-glass-strong rounded-2xl p-6">
              <h3 className="al-font-serif text-2xl text-white mb-3 flex items-center gap-2"><Zap className="h-5 w-5 text-amber-300" /> Marking Scheme Insight</h3>
              <p className="text-white/70 text-sm leading-relaxed mb-3">
                CBSE examiners use a step-wise marking scheme. Each correct point in your answer earns a partial mark, even if the overall answer is incomplete. Always write something for every question — a blank answer is a guaranteed zero.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-white/50">2-mark question</p>
                  <p className="text-white font-semibold">2 key points</p>
                </div>
                <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-white/50">3-mark question</p>
                  <p className="text-white font-semibold">3 key points + example</p>
                </div>
                <div className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                  <p className="text-xs text-white/50">5-mark question</p>
                  <p className="text-white font-semibold">Intro + 4 points + conclusion</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default AnswerLabView;
