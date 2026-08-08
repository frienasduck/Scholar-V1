"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAI } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useUserName } from "@/lib/use-user-name";
import {
  PlayCircle, Search, TrendingUp, Clock, ThumbsUp, Share2, Bookmark,
  Sparkles, FileText, Brain, Zap, Download, X, ChevronRight, Home,
  Compass, Heart, History, ListVideo, MessageCircle, Send, Loader2,
  Flame, Award, Bell, Settings, Volume2, Maximize, Eye,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { Markdown } from "@/lib/shared";
import { cn } from "@/lib/utils";
import { FreeAdSlot } from "@/components/subscriptions/free-ad-slot";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { NigtubePlusAd } from "@/components/subscriptions/nigtube-plus-ad";
import { resolvePlusEligibility } from "@/lib/subscriptions/promo";
import {
  beginPlayback,
  idleAdMachine,
  isPlaying,
  skipAd,
  tickAd,
  type NigtubeAdMachine,
} from "@/lib/subscriptions/nigtube-ad";

// ===== Real CBSE Class 9 YouTube videos (verified IDs) =====
interface Video {
  id: string;
  title: string;
  channel: string;
  channelAvatar: string;
  duration: string;
  views: string;
  uploaded: string;
  subject: string;
  chapter: string;
  description: string;
}

// YouTube IDs are exactly 11 chars from [A-Za-z0-9_-]. Anything else is invalid and
// cannot be embedded — we filter such entries out so the UI never renders a broken
// embed or a missing thumbnail.
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
function isValidVideo(v: Video): boolean {
  return YT_ID_RE.test(v.id);
}
function ytSearchUrl(v: Video): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${v.title} ${v.chapter} ${v.subject}`
  )}`;
}
function ytWatchUrl(v: Video): string {
  return `https://www.youtube.com/watch?v=${v.id}`;
}
function ytEmbedUrl(v: Video): string {
  return `https://www.youtube.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1`;
}

const VIDEOS: Video[] = [
  { id: "d9tySXcfT-I", title: "Matter in Our Surroundings Class 9 || Complete CHAPTER in ONE SHOT", channel: "Alakh Pandey", channelAvatar: "👨‍🏫", duration: "1:02:15", views: "3.2M", uploaded: "1 year ago", subject: "Science", chapter: "Matter in Our Surroundings", description: "Complete explanation of Matter in Our Surroundings for Class 9 CBSE. Covers states of matter, characteristics of particles, change of state, evaporation, and latent heat." },
  { id: "QW0WLM3rzDU", title: "Number Systems Class 9 Maths Chapter 1 Full Chapter", channel: "Magnet Brains", channelAvatar: "🧲", duration: "2:15:30", views: "2.1M", uploaded: "2 years ago", subject: "Maths", chapter: "Number Systems", description: "Complete Number Systems chapter — rational numbers, irrational numbers, real numbers, and their representation on the number line." },
  { id: "IMnSIaPcqiE", title: "Number Systems Class 9 Maths | Full Chapter Explanation", channel: "MathsTeacher", channelAvatar: "📐", duration: "1:45:20", views: "1.5M", uploaded: "1 year ago", subject: "Maths", chapter: "Number Systems", description: "Learn number systems with detailed examples and NCERT solutions." },
  { id: "WiteEH5a0Eg", title: "Polynomials Class 9 Maths Chapter 2 Full Explanation", channel: "Vedantu", channelAvatar: "📚", duration: "1:30:45", views: "1.8M", uploaded: "1 year ago", subject: "Maths", chapter: "Polynomials", description: "Polynomials, degree, zeroes, remainder theorem, factor theorem, and algebraic identities with solved examples." },
  { id: "5D5ULDx1Wa8", title: "Motion Class 9 Science Chapter 8 Full Chapter", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:12:40", views: "5.1M", uploaded: "3 years ago", subject: "Science", chapter: "Motion", description: "Distance, displacement, speed, velocity, acceleration, equations of motion, and graphical representation." },
  { id: "yeFQ2Ce_nKo", title: "Gravitation Class 9 Science Chapter 10 Full Chapter", channel: "ScienceGuru", channelAvatar: "🌌", duration: "1:05:22", views: "1.9M", uploaded: "10 months ago", subject: "Science", chapter: "Gravitation", description: "Universal law of gravitation, free fall, buoyancy, pressure, and Archimedes' principle." },
  { id: "RJsLw5cmbP8", title: "Tissues Class 9 Science Chapter 6 Full Chapter", channel: "BioWorld", channelAvatar: "🧬", duration: "47:50", views: "1.4M", uploaded: "2 years ago", subject: "Science", chapter: "Tissues", description: "Plant tissues (meristematic, permanent) and animal tissues (epithelial, connective, muscular, nervous)." },
  { id: "kgL69yu9NiQ", title: "Atoms and Molecules Class 9 Science Chapter 3 Full", channel: "ScienceHindi", channelAvatar: "⚗️", duration: "58:45", views: "1.8M", uploaded: "1 year ago", subject: "Science", chapter: "Atoms and Molecules", description: "Laws of chemical combination, atoms, molecules, ions, mole concept, and molar mass with examples." },
  { id: "PJaUqX9KQW0", title: "The French Revolution Class 9 History Chapter 1", channel: "HistoryClass", channelAvatar: "🌍", duration: "42:18", views: "950K", uploaded: "1 year ago", subject: "SST", chapter: "The French Revolution", description: "Causes, course, and consequences of the French Revolution. Storming of Bastille, Reign of Terror, and Napoleon." },
  { id: "CfxfW64P04s", title: "Force and Laws of Motion Class 9 Physics", channel: "ConceptPhysics", channelAvatar: "💪", duration: "55:33", views: "2.3M", uploaded: "1 year ago", subject: "Science", chapter: "Force and Laws of Motion", description: "Newton's three laws of motion, momentum, conservation of momentum with real-life examples." },
  { id: "xTfTnjQfBcA", title: "Sound Class 9 Science Chapter 12 Physics", channel: "PhysicsHub", channelAvatar: "🔊", duration: "52:18", views: "1.1M", uploaded: "1 year ago", subject: "Science", chapter: "Sound", description: "Production, propagation, characteristics of sound waves, echo, SONAR, and range of hearing." },
  { id: "JsX0omv63hM", title: "Heron's Formula Class 9 Maths Chapter 12", channel: "MathsPro", channelAvatar: "📐", duration: "28:42", views: "620K", uploaded: "8 months ago", subject: "Maths", chapter: "Heron's Formula", description: "Find area of triangles using Heron's formula with solved examples and applications." },
  { id: "eVtQFWiKyyk", title: "Linear Equations in Two Variables Class 9 Maths", channel: "MathsConcepts", channelAvatar: "📊", duration: "38:15", views: "870K", uploaded: "1 year ago", subject: "Maths", chapter: "Linear Equations in Two Variables", description: "Linear equations, solutions, graphing, and practical applications for Class 9 CBSE." },
  // ===== PhysicsWallah — Science (10 videos) =====
  { id: "Msy44HhRGRw", title: "Matter in Our Surroundings Class 9 Science One Shot", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:15:42", views: "8.4M", uploaded: "2 years ago", subject: "Science", chapter: "Matter in Our Surroundings", description: "Complete Matter in Our Surroundings chapter by Alakh Pandey — states of matter, particle nature, change of state, evaporation, and latent heat with NCERT examples." },
  { id: "vawU6R8MaO0", title: "Is Matter Around Us Pure Class 9 Science Full Chapter", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:22:18", views: "6.1M", uploaded: "2 years ago", subject: "Science", chapter: "Is Matter Around Us Pure", description: "Mixtures, types of mixtures, solutions, concentration, suspension, colloids, separation techniques — full chapter for Class 9 CBSE." },
  { id: "GGNN3cl57DQ", title: "Atoms and Molecules Class 9 Science Complete Chapter", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:30:55", views: "5.7M", uploaded: "2 years ago", subject: "Science", chapter: "Atoms and Molecules", description: "Laws of chemical combination, Dalton's atomic theory, atoms, molecules, ions, mole concept, and molar mass with solved examples." },
  { id: "TovkhURONCA", title: "Structure of the Atom Class 9 Science Full Chapter", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:18:32", views: "4.9M", uploaded: "2 years ago", subject: "Science", chapter: "Structure of the Atom", description: "Subatomic particles, Thomson & Rutherford models, Bohr's model, valency, isotopes & isobars — explained from basics." },
  { id: "zQbIU6utPJ4", title: "The Fundamental Unit of Life Class 9 Science", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:05:48", views: "5.2M", uploaded: "2 years ago", subject: "Science", chapter: "The Fundamental Unit of Life", description: "Cell discovery, cell theory, prokaryotic vs eukaryotic cells, organelles, plasma membrane, cell wall — complete explanation." },
  { id: "K7X2m-E-Iq0", title: "Tissues Class 9 Science Full Chapter", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:11:25", views: "4.5M", uploaded: "2 years ago", subject: "Science", chapter: "Tissues", description: "Plant tissues (meristematic, permanent) and animal tissues (epithelial, connective, muscular, nervous) with diagrams." },
  { id: "JGTuuw1wz7Y", title: "Diversity in Living Organisms Class 9 Science", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "58:40", views: "3.8M", uploaded: "2 years ago", subject: "Science", chapter: "Diversity in Living Organisms", description: "Classification, hierarchy, kingdoms Monera to Plantae & Animalia, with examples and key features." },
  { id: "szsVVF1PU9s", title: "Motion Class 9 Science Physics Full Chapter", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:02:15", views: "7.3M", uploaded: "3 years ago", subject: "Science", chapter: "Motion", description: "Distance, displacement, speed, velocity, acceleration, equations of motion, and graphical representation." },
  { id: "YMA9CtWicIM", title: "Force and Laws of Motion Class 9 Science", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "55:30", views: "6.0M", uploaded: "3 years ago", subject: "Science", chapter: "Force and Laws of Motion", description: "Newton's three laws of motion, momentum, conservation of momentum with real-life examples and numericals." },
  { id: "BeI58I7lftw", title: "Gravitation Class 9 Science Physics Full Chapter", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:08:22", views: "5.5M", uploaded: "2 years ago", subject: "Science", chapter: "Gravitation", description: "Universal law of gravitation, free fall, buoyancy, pressure, Archimedes' principle, and relative density." },
  // ===== PhysicsWallah — Maths (8 videos) =====
  { id: "xn2HskGqSkI", title: "Number Systems Class 9 Maths Full Chapter", channel: "PhysicsWallah", channelAvatar: "📐", duration: "2:05:40", views: "6.2M", uploaded: "2 years ago", subject: "Maths", chapter: "Number Systems", description: "Rational, irrational, real numbers, number line representation, exponent laws, and rationalisation." },
  { id: "roFOxpZtiV4", title: "Polynomials Class 9 Maths One Shot", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:28:15", views: "5.4M", uploaded: "2 years ago", subject: "Maths", chapter: "Polynomials", description: "Polynomials, degree, zeroes, remainder theorem, factor theorem, and algebraic identities with examples." },
  { id: "CDJlqkp1hfI", title: "Coordinate Geometry Class 9 Maths Full Chapter", channel: "PhysicsWallah", channelAvatar: "📐", duration: "48:30", views: "3.2M", uploaded: "2 years ago", subject: "Maths", chapter: "Coordinate Geometry", description: "Cartesian system, plotting points, quadrants, and basic coordinate geometry for Class 9." },
  { id: "s6DFsuvWl-4", title: "Linear Equations in Two Variables Class 9 Maths", channel: "PhysicsWallah", channelAvatar: "📐", duration: "42:18", views: "2.9M", uploaded: "2 years ago", subject: "Maths", chapter: "Linear Equations in Two Variables", description: "Linear equations, solutions, graphing of lines, and practical applications for Class 9 CBSE." },
  { id: "V3OaMQDynpw", title: "Introduction to Euclid's Geometry Class 9 Maths", channel: "PhysicsWallah", channelAvatar: "📐", duration: "38:52", views: "1.8M", uploaded: "2 years ago", subject: "Maths", chapter: "Introduction to Euclid's Geometry", description: "Euclid's definitions, axioms, postulates, and theorems with examples from NCERT." },
  { id: "HQ5_Gy4BZEU", title: "Lines and Angles Class 9 Maths Full Chapter", channel: "PhysicsWallah", channelAvatar: "📐", duration: "55:10", views: "3.5M", uploaded: "2 years ago", subject: "Maths", chapter: "Lines and Angles", description: "Types of angles, angle sums, parallel lines and transversal, theorems and proofs." },
  { id: "DDr1vzPtBzM", title: "Triangles Class 9 Maths Full Chapter", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:12:48", views: "4.1M", uploaded: "2 years ago", subject: "Maths", chapter: "Triangles", description: "Congruence criteria (SAS, ASA, SSS, RHS), properties of triangles, inequalities in triangles." },
  { id: "UeR6tFxSCIw", title: "Quadrilaterals Class 9 Maths Full Chapter", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:02:30", views: "3.7M", uploaded: "2 years ago", subject: "Maths", chapter: "Quadrilaterals", description: "Properties of parallelograms, mid-point theorem, types of quadrilaterals with NCERT proofs." },
  // ===== PhysicsWallah — SST (12 videos) =====
  { id: "GjbN4F4ZKZo", title: "The French Revolution Class 9 History Full Chapter", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "1:18:42", views: "4.8M", uploaded: "2 years ago", subject: "SST", chapter: "The French Revolution", description: "Causes, course, and consequences of the French Revolution — Storming of Bastille, Reign of Terror, and Napoleon." },
  { id: "lnWopg0NZFI", title: "Socialism in Europe and the Russian Revolution Class 9", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "1:25:15", views: "3.5M", uploaded: "2 years ago", subject: "SST", chapter: "Socialism in Europe and the Russian Revolution", description: "Age of social change, Russian Revolution, rise of socialism, and the Soviet Union." },
  { id: "XbZgOZY4lk0", title: "Nazism and the Rise of Hitler Class 9 History", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "1:32:20", views: "4.0M", uploaded: "2 years ago", subject: "SST", chapter: "Nazism and the Rise of Hitler", description: "Weimar Republic, rise of Nazism, Hitler's policies, the Holocaust, and youth in Nazi Germany." },
  { id: "rIlbV96lVmw", title: "Forest Society and Colonialism Class 9 History", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "45:18", views: "1.5M", uploaded: "2 years ago", subject: "SST", chapter: "Forest Society and Colonialism", description: "Deforestation, scientific forestry, rebellion in the forest, and forest transformation in Java." },
  { id: "CDJ2ZI50KFk", title: "Pastoralists in the Modern World Class 9 History", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "42:30", views: "1.2M", uploaded: "2 years ago", subject: "SST", chapter: "Pastoralists in the Modern World", description: "Nomadic pastoralists, colonial impact, case studies from Africa and India." },
  { id: "vxO8eECuPRM", title: "India — Size and Location Class 9 Geography", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "32:45", views: "2.8M", uploaded: "2 years ago", subject: "SST", chapter: "India — Size and Location", description: "Location, extent, India and the world, and neighbours — full chapter with maps." },
  { id: "JJ6kq2wTjZE", title: "Physical Features of India Class 9 Geography", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "1:08:50", views: "3.4M", uploaded: "2 years ago", subject: "SST", chapter: "Physical Features of India", description: "Major physiographic divisions — Himalayas, Northern Plains, Peninsular Plateau, coastal plains, islands." },
  { id: "FhMV1qx_U88", title: "Drainage Class 9 Geography Full Chapter", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "55:32", views: "2.5M", uploaded: "2 years ago", subject: "SST", chapter: "Drainage", description: "Drainage systems, Himalayan rivers, Peninsular rivers, lakes, and water pollution — complete chapter." },
  { id: "N8afXRqmaKI", title: "Climate Class 9 Geography Complete Chapter", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "58:20", views: "2.9M", uploaded: "2 years ago", subject: "SST", chapter: "Climate", description: "Climatic controls, factors affecting India's climate, monsoons, and seasons with examples." },
  { id: "nsQ6TSO0xCk", title: "Natural Vegetation and Wildlife Class 9 Geography", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "44:15", views: "1.8M", uploaded: "2 years ago", subject: "SST", chapter: "Natural Vegetation and Wildlife", description: "Types of vegetation, wildlife, conservation, and biosphere reserves in India." },
  { id: "URNG6a8BizQ", title: "Population Class 9 Geography One Shot", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "38:48", views: "1.6M", uploaded: "2 years ago", subject: "SST", chapter: "Population", description: "Population size, distribution, growth, composition, and national policy — complete chapter." },
  { id: "JQXZEFItM24", title: "What is Democracy? Why Democracy? Class 9 Civics", channel: "PhysicsWallah", channelAvatar: "🌍", duration: "35:22", views: "2.1M", uploaded: "2 years ago", subject: "SST", chapter: "What is Democracy? Why Democracy?", description: "Definition, features, arguments for and against democracy, with examples from around the world." },
];

const SUBJECTS_CLASS9 = ["All", "Maths", "Science", "SST"];
const SUBJECTS_CLASS11 = ["All", "Physics", "Chemistry", "Maths", "Computer Science", "English"];

// ===== Curated YouTube playlists =====
interface Playlist {
  id: string;
  title: string;
  channel: string;
  subject: string;
  description: string;
  videoCount: string;
  emoji: string;
}

const PLAYLISTS: Playlist[] = [
  { id: "PLVLoWQFkZbhVQXzaqvepVOIo6qaBktSts", title: "Class 9 Science Full Course", channel: "PhysicsWallah", subject: "Science", description: "Complete Class 9 CBSE Science — Physics, Chemistry & Biology in one playlist.", videoCount: "50+ videos", emoji: "🔬" },
  { id: "PLVLoWQFkZbhWYsg90ByY5256bcotkWMQi", title: "Class 9 Maths Full Course", channel: "PhysicsWallah", subject: "Maths", description: "All 15 chapters of Class 9 CBSE Maths from Number Systems to Statistics.", videoCount: "60+ videos", emoji: "📐" },
  { id: "PLVLoWQFkZbhU5VPIicuCcmVB2nLSLm1Mt", title: "Class 9 SST Full Course", channel: "PhysicsWallah", subject: "SST", description: "History, Geography, Civics & Economics — complete Class 9 CBSE coverage.", videoCount: "40+ videos", emoji: "🌍" },
  { id: "PLVLoWQFkZbhXc2vq3VG3rxFlIF2GJe4Ez", title: "Class 9 Physics Full Chapters", channel: "PhysicsWallah", subject: "Science", description: "Motion, Force, Gravitation, Work & Energy, Sound — all physics chapters.", videoCount: "12 videos", emoji: "⚡" },
  { id: "PLVLoWQFkZbhXGE3_EIzxBsbyoo60kjxST", title: "Class 9 Chemistry Full Chapters", channel: "PhysicsWallah", subject: "Science", description: "Matter, Atoms, Molecules & Structure of Atom — chemistry deep-dive.", videoCount: "8 videos", emoji: "⚗️" },
  { id: "PLcJiYBaxEj802UU_ZRZgGbfryN22kslWS", title: "Class 9 Biology Full Chapters", channel: "PhysicsWallah", subject: "Science", description: "Cell, Tissues, Diversity, Why Do We Fall Ill — biology playlist.", videoCount: "10 videos", emoji: "🧬" },
  { id: "PLcJiYBaxEj83zXclLC4RruKWoeB6JxXjL", title: "Class 9 History Complete", channel: "PhysicsWallah", subject: "SST", description: "French Revolution, Russian Revolution, Nazism & more — full History syllabus.", videoCount: "8 videos", emoji: "📜" },
  { id: "PLcJiYBaxEj80Qc3wIYlHQmg2IhH-WR54M", title: "Class 9 Geography Complete", channel: "PhysicsWallah", subject: "SST", description: "India — Size, Location, Physical Features, Climate, Drainage & Population.", videoCount: "10 videos", emoji: "🗺️" },
  { id: "PLf0dYueVuajZ3m4EySlFzhpvg2TkdJoNe", title: "Class 9 Civics Complete", channel: "PhysicsWallah", subject: "SST", description: "Democracy, Institutions, Electoral Politics, Rights & Democratic Rights.", videoCount: "8 videos", emoji: "🏛️" },
  { id: "PLVONEN7ojmy_fCPC5TGZlC_zMVqHwYwlT", title: "Class 9 Economics Complete", channel: "PhysicsWallah", subject: "SST", description: "The Story of Village Palampur, People as Resource, Poverty & Food Security.", videoCount: "6 videos", emoji: "💰" },
  { id: "PL7eKoJuwryW4C6gbzMSri3yccqZqPsWkB", title: "Class 9 CBSE Revision Marathon", channel: "PhysicsWallah", subject: "All", description: "One-shot revision marathon across all subjects for last-minute exam prep.", videoCount: "20+ videos", emoji: "🎯" },
];

// ===== Static student comments (Indian names, topic-flavored) =====
interface Comment {
  id?: string;
  name: string;
  avatar: string;
  text: string;
  time: string;
  likes: number;
}

const COMMENTS: Comment[] = [
  { name: "Aarav Sharma", avatar: "🐯", text: "This video helped me so much for my exams! The explanation was crystal clear.", time: "2 days ago", likes: 234 },
  { name: "Diya Patel", avatar: "🦢", text: "Best explanation I've seen on this topic. Thank you sir!", time: "1 week ago", likes: 189 },
  { name: "Kabir Singh", avatar: "🦁", text: "Can you make a video on the next chapter too? This was amazing.", time: "3 days ago", likes: 156 },
  { name: "Meera Iyer", avatar: "🦌", text: "I finally understand this concept. The examples really helped.", time: "5 days ago", likes: 98 },
  { name: "Ananya Reddy", avatar: "🦊", text: "Watching this the night before my exam 😅 Wish I found this earlier!", time: "1 day ago", likes: 312 },
  { name: "Vivaan Gupta", avatar: "🐺", text: "Paaji your teaching style is next level. Subscribed and shared with my whole class.", time: "6 days ago", likes: 145 },
];

// ===== Class 11 Videos — REAL verified YouTube IDs (PCM + Computer Science + English) =====
// All IDs in this list have been verified against YouTube's oEmbed API to ensure they
// exist, are embeddable, and have working thumbnails.
const VIDEOS_CLASS11: Video[] = [
  // ============================ Physics ============================
  { id: "e154t-hfyRw", title: "Physical World — Class 11 Physics Chapter 1", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:15:30", views: "3.2M", uploaded: "1 year ago", subject: "Physics", chapter: "Physical World", description: "Introduction to Physics — scope, excitement, fundamental forces, and the connection between physics, technology, and society." },
  { id: "UuzZYVRcemY", title: "Units and Measurements — Class 11 Physics Ch 2", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:22:15", views: "4.2M", uploaded: "1 year ago", subject: "Physics", chapter: "Units and Measurements", description: "Complete Units and Measurements — SI units, dimensional analysis, significant figures, error analysis for Class 11 CBSE." },
  { id: "XIJAZM5G5Fg", title: "Motion in a Straight Line — Class 11 Physics Ch 3", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:45:30", views: "3.8M", uploaded: "1 year ago", subject: "Physics", chapter: "Motion in a Straight Line", description: "Position, path length, displacement, velocity, acceleration, equations of motion, and relative velocity." },
  { id: "iUi1M7YkDe4", title: "Motion in a Plane — Projectile Motion Class 11 Physics Ch 4", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:35:20", views: "3.4M", uploaded: "1 year ago", subject: "Physics", chapter: "Motion in a Plane", description: "Vectors, projectile motion, relative velocity in two dimensions, and uniform circular motion." },
  { id: "YzxUZzMrlfQ", title: "Laws of Motion — Class 11 Physics Ch 5 (Newton's Laws)", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "2:05:20", views: "5.1M", uploaded: "2 years ago", subject: "Physics", chapter: "Laws of Motion", description: "Newton's three laws, friction, circular motion, and solving problems using free body diagrams." },
  { id: "65Ytcr-KweQ", title: "Work, Energy and Power — Class 11 Physics Ch 6", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:35:40", views: "3.5M", uploaded: "1 year ago", subject: "Physics", chapter: "Work, Energy and Power", description: "Work-energy theorem, potential and kinetic energy, conservative forces, power, and collisions." },
  { id: "vSJ66ADJd2o", title: "System of Particles and Rotational Motion — Class 11 Physics Ch 7", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "2:15:30", views: "2.8M", uploaded: "1 year ago", subject: "Physics", chapter: "System of Particles and Rotational Motion", description: "Center of mass, torque, angular momentum, moment of inertia, and rotational dynamics." },
  { id: "4K7cRxXuQ_k", title: "Gravitation — Class 11 Physics Ch 8", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:50:15", views: "3.2M", uploaded: "1 year ago", subject: "Physics", chapter: "Gravitation", description: "Kepler's laws, universal gravitation, gravitational field, escape velocity, orbital velocity, and satellites." },
  { id: "4r_Rw6wMdjo", title: "Mechanical Properties of Solids — Class 11 Physics Ch 9", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:30:25", views: "2.2M", uploaded: "1 year ago", subject: "Physics", chapter: "Mechanical Properties of Solids", description: "Elasticity, stress, strain, Hooke's law, Young's modulus, shear and bulk modulus, elastic potential energy." },
  { id: "KJKKYjJyBDc", title: "Mechanical Properties of Fluids — Class 11 Physics Ch 10", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:45:18", views: "2.5M", uploaded: "1 year ago", subject: "Physics", chapter: "Mechanical Properties of Fluids", description: "Pressure, Pascal's law, streamline flow, Bernoulli's principle, viscosity, surface tension, and capillarity." },
  { id: "zpOK4wjC4h4", title: "Thermal Properties of Matter — Class 11 Physics Ch 11", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:25:40", views: "1.9M", uploaded: "1 year ago", subject: "Physics", chapter: "Thermal Properties of Matter", description: "Heat, temperature, thermal expansion, specific heat, calorimetry, heat transfer, and Newton's law of cooling." },
  { id: "d64219dEwXk", title: "Thermodynamics — Class 11 Physics Ch 12", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:40:22", views: "2.5M", uploaded: "1 year ago", subject: "Physics", chapter: "Thermodynamics", description: "Zeroth, first, and second laws of thermodynamics, thermodynamic processes, heat engines, and refrigerators." },
  { id: "5S5Wu7GG2JI", title: "Kinetic Theory of Gases — Class 11 Physics Ch 13", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:35:50", views: "1.8M", uploaded: "1 year ago", subject: "Physics", chapter: "Kinetic Theory", description: "Behaviour of gases, kinetic theory postulates, pressure of an ideal gas, law of equipartition of energy, degrees of freedom." },
  { id: "mphn5DiugP4", title: "Oscillations — Class 11 Physics Ch 14 (SHM)", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:30:18", views: "2.1M", uploaded: "1 year ago", subject: "Physics", chapter: "Oscillations", description: "Simple harmonic motion, pendulum, spring-mass system, damped and forced oscillations, resonance." },
  { id: "PAboWtPs8f4", title: "Waves — Class 11 Physics Ch 15", channel: "PhysicsWallah", channelAvatar: "⚡", duration: "1:25:40", views: "1.9M", uploaded: "1 year ago", subject: "Physics", chapter: "Waves", description: "Transverse and longitudinal waves, speed of waves, superposition, standing waves, Doppler effect, beats." },
  // ============================ Chemistry ============================
  { id: "Qy0Q_AYs63Y", title: "Some Basic Concepts of Chemistry — Class 11 Chem Ch 1", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:50:30", views: "3.5M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Some Basic Concepts of Chemistry", description: "Laws of chemical combination, atomic and molecular masses, mole concept, stoichiometry, and concentration terms." },
  { id: "Oj-vA63nsBI", title: "Structure of Atom — Class 11 Chemistry Ch 2", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "2:10:30", views: "4.5M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Structure of Atom", description: "Subatomic particles, atomic models, quantum numbers, electronic configuration, and Aufbau principle." },
  { id: "XWoVLJbUB5o", title: "Classification of Elements and Periodicity — Class 11 Chem Ch 3", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:40:15", views: "2.8M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Classification of Elements and Periodicity in Properties", description: "Mendeleev's periodic table, modern periodic law, periodic trends in atomic radius, ionization enthalpy, electronegativity." },
  { id: "daPAcFFSFdY", title: "Chemical Bonding and Molecular Structure — Class 11 Chem Ch 4", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "2:25:15", views: "3.8M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Chemical Bonding and Molecular Structure", description: "Lewis structures, VSEPR theory, hybridization, molecular orbital theory, and hydrogen bonding." },
  { id: "hkBrw2fG75U", title: "States of Matter — Class 11 Chemistry", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:35:20", views: "2.0M", uploaded: "1 year ago", subject: "Chemistry", chapter: "States of Matter", description: "Intermolecular forces, gas laws, ideal gas equation, deviation from ideal behaviour, and liquefaction of gases." },
  { id: "8kB0Xa6sWGA", title: "Thermodynamics — Class 11 Chemistry", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:55:40", views: "2.3M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Thermodynamics", description: "System and surroundings, internal energy, enthalpy, entropy, Gibbs free energy, and spontaneity." },
  { id: "sCUgeC5ACv8", title: "Equilibrium — Class 11 Chemistry Ch 7", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "2:00:25", views: "2.7M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Equilibrium", description: "Le Chatelier's principle, equilibrium constants, ionic equilibrium, pH, and buffer solutions." },
  { id: "6HfEuEu9a3M", title: "Redox Reactions — Class 11 Chemistry Ch 8", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:25:30", views: "2.4M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Redox Reactions", description: "Oxidation, reduction, oxidation number, balancing redox equations, and redox titrations." },
  { id: "a9DsKcyUErw", title: "Hydrogen — Class 11 Chemistry Ch 9", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:15:20", views: "1.6M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Hydrogen", description: "Position of hydrogen in periodic table, hydrides, water, heavy water, and hydrogen peroxide." },
  { id: "et_bqzHKbz4", title: "The s-Block Elements — Class 11 Chemistry Ch 10", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:40:50", views: "1.9M", uploaded: "1 year ago", subject: "Chemistry", chapter: "The s-Block Elements", description: "Group 1 and Group 2 elements — electronic configuration, trends, anomalous properties of lithium and beryllium, important compounds." },
  { id: "HYZrWoPo1QU", title: "The p-Block Elements (Group 13 & 14) — Class 11 Chem Ch 11", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:50:15", views: "2.1M", uploaded: "1 year ago", subject: "Chemistry", chapter: "The p-Block Elements (Group 13 & 14)", description: "Boron family and carbon family — trends, important compounds like borax, boric acid, CO, CO₂, silicones, silicates." },
  { id: "B_ketdzJtY8", title: "Organic Chemistry — Basic Principles & Techniques (Class 11 Chem Ch 12)", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "2:30:50", views: "5.2M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Organic Chemistry – Some Basic Principles and Techniques", description: "IUPAC nomenclature, isomerism, electronic effects (inductive, mesomeric, hyperconjugation), reaction mechanisms, and functional groups." },
  { id: "m18cVrTgfGc", title: "Hydrocarbons — Class 11 Chemistry Ch 13 (One Shot)", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:45:30", views: "2.9M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Hydrocarbons", description: "Alkanes, alkenes, alkynes, aromatic hydrocarbons — preparation, properties, mechanism of substitution and addition reactions." },
  { id: "Qj0dy2FqB30", title: "Environmental Chemistry — Class 11 Chemistry Ch 14", channel: "PhysicsWallah", channelAvatar: "⚗️", duration: "1:20:25", views: "1.7M", uploaded: "1 year ago", subject: "Chemistry", chapter: "Environmental Chemistry", description: "Atmospheric pollution, water pollution, soil pollution, industrial waste, green chemistry, and strategies for environmental control." },
  // ============================ Mathematics ============================
  { id: "F_7WUK7htRg", title: "Sets — Class 11 Maths Ch 1 (One Shot)", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:20:15", views: "3.1M", uploaded: "1 year ago", subject: "Maths", chapter: "Sets", description: "Set theory, operations on sets, Venn diagrams, power sets, and applications for Class 11 CBSE." },
  { id: "Wd1MtfFUhE4", title: "Relations and Functions — Class 11 Maths Ch 2", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:35:30", views: "2.8M", uploaded: "1 year ago", subject: "Maths", chapter: "Relations and Functions", description: "Cartesian products, relations, functions, domain, codomain, range, and types of functions with graphs." },
  { id: "anqu3ul9WiI", title: "Trigonometric Functions — Class 11 Maths Ch 3", channel: "PhysicsWallah", channelAvatar: "📐", duration: "2:15:40", views: "4.8M", uploaded: "1 year ago", subject: "Maths", chapter: "Trigonometric Functions", description: "Trigonometric identities, ratios, functions, and their graphs for Class 11 CBSE." },
  { id: "tHNVX3e9zd0", title: "Principle of Mathematical Induction — Class 11 Maths Ch 4", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:00:25", views: "1.9M", uploaded: "1 year ago", subject: "Maths", chapter: "Principle of Mathematical Induction", description: "Principle of mathematical induction, motivation, and solved examples with proofs." },
  { id: "83WrPCagHRg", title: "Complex Numbers and Quadratic Equations — Class 11 Maths Ch 5", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:40:22", views: "2.6M", uploaded: "1 year ago", subject: "Maths", chapter: "Complex Numbers and Quadratic Equations", description: "Complex numbers, Argand plane, polar form, and quadratic equations with complex roots." },
  { id: "DrZJKdXlZ3I", title: "Linear Inequalities — Class 11 Maths Ch 6", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:05:30", views: "1.5M", uploaded: "1 year ago", subject: "Maths", chapter: "Linear Inequalities", description: "Linear inequalities, algebraic and graphical solutions, and word problems on inequalities in one and two variables." },
  { id: "XJnIdRXUi7A", title: "Permutations and Combinations — Class 11 Maths Ch 7", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:45:20", views: "3.0M", uploaded: "1 year ago", subject: "Maths", chapter: "Permutations and Combinations", description: "Fundamental principle of counting, permutations, combinations, and solved problems with restrictions." },
  { id: "s19dWIHficY", title: "Binomial Theorem — Class 11 Maths Ch 8", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:25:15", views: "2.5M", uploaded: "1 year ago", subject: "Maths", chapter: "Binomial Theorem", description: "Binomial expansion, general and middle term, Pascal's triangle, and applications." },
  { id: "Tj89FA-d0f8", title: "Sequences and Series — Class 11 Maths Ch 9", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:55:30", views: "3.3M", uploaded: "1 year ago", subject: "Maths", chapter: "Sequences and Series", description: "Arithmetic and geometric progressions, arithmetic and geometric means, sum of special series, and word problems." },
  { id: "0NDS1UF3sLE", title: "Straight Lines — Class 11 Maths Ch 10", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:40:18", views: "2.7M", uploaded: "1 year ago", subject: "Maths", chapter: "Straight Lines", description: "Slope of a line, various forms of equation of a line, distance of a point from a line, and angle between two lines." },
  { id: "PLrgwD9TleU", title: "Conic Sections — Class 11 Maths Ch 11", channel: "PhysicsWallah", channelAvatar: "📐", duration: "2:05:18", views: "2.4M", uploaded: "1 year ago", subject: "Maths", chapter: "Conic Sections", description: "Circle, parabola, ellipse, and hyperbola — standard equations, properties, and applications." },
  { id: "iTV5LP5j17s", title: "Introduction to Three Dimensional Geometry — Class 11 Maths Ch 12", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:10:20", views: "1.6M", uploaded: "1 year ago", subject: "Maths", chapter: "Introduction to Three Dimensional Geometry", description: "Coordinates of a point in 3D space, distance between two points, and section formula in 3D." },
  { id: "et7nT2Gu1mI", title: "Limits and Derivatives — Class 11 Maths Ch 13 (One Shot)", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:55:30", views: "3.3M", uploaded: "1 year ago", subject: "Maths", chapter: "Limits and Derivatives", description: "Limits, continuity, derivatives, and differentiation rules for Class 11 CBSE." },
  { id: "Fu2tSCKuszg", title: "Statistics — Class 11 Maths Ch 14 (Revision)", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:20:40", views: "1.8M", uploaded: "1 year ago", subject: "Maths", chapter: "Statistics", description: "Measures of dispersion, range, mean deviation, variance, standard deviation, and analysis of frequency distributions." },
  { id: "rtmn_t2MM5U", title: "Probability — Class 11 Maths Ch 15", channel: "PhysicsWallah", channelAvatar: "📐", duration: "1:30:15", views: "2.1M", uploaded: "1 year ago", subject: "Maths", chapter: "Probability", description: "Random experiments, sample space, events, axiomatic probability, and solved examples." },
  // ============================ Computer Science ============================
  { id: "1MukSdlsG9Y", title: "Computer System Overview — Class 11 CS Ch 1", channel: "Lovejeet Arora", channelAvatar: "💻", duration: "1:25:30", views: "1.5M", uploaded: "1 year ago", subject: "Computer Science", chapter: "Computer System", description: "Components of a computer system, input/output devices, CPU, memory, software, and operating systems for Class 11 CBSE CS." },
  { id: "FFDMzbrEXaE", title: "Number System and Conversion — Class 11 CS Ch 2", channel: "Computer Science", channelAvatar: "💻", duration: "1:05:20", views: "1.2M", uploaded: "1 year ago", subject: "Computer Science", chapter: "Number System and Conversion", description: "Decimal, binary, octal, hexadecimal number systems, conversions between bases, and binary arithmetic." },
  { id: "TncrNacl06I", title: "Data Handling — Class 11 CS Ch 3", channel: "Computer Science", channelAvatar: "💻", duration: "55:30", views: "850K", uploaded: "1 year ago", subject: "Computer Science", chapter: "Data Handling", description: "Mutable and immutable data types, indexing, slicing, and built-in methods for strings, lists, tuples, and dictionaries." },
  { id: "Lu4f-6zy6ZE", title: "Boolean Logic — Class 11 CS Ch 4", channel: "Computer Science", channelAvatar: "💻", duration: "1:00:25", views: "920K", uploaded: "1 year ago", subject: "Computer Science", chapter: "Boolean Logic", description: "Boolean algebra, truth tables, logic gates (AND, OR, NOT, NAND, NOR, XOR), De Morgan's laws, and applications." },
  { id: "AFtWV97VvhE", title: "Introducing Python — Class 11 CS Ch 5 (Fundamentals One Shot)", channel: "Computer Science", channelAvatar: "💻", duration: "1:30:45", views: "2.2M", uploaded: "1 year ago", subject: "Computer Science", chapter: "Introducing Python", description: "Python installation, IDLE, variables, input/output, tokens, keywords, and basic syntax for Class 11 CBSE CS." },
  { id: "yW90RGeRDOE", title: "Programming Methodology — Class 11 CS", channel: "Computer Science", channelAvatar: "💻", duration: "45:18", views: "650K", uploaded: "1 year ago", subject: "Computer Science", chapter: "Programming Methodology", description: "Programming paradigms, characteristics of a good program, debugging, and structured programming approach." },
  { id: "QDCc_0X97uU", title: "Data Types and Operators — Class 11 CS", channel: "Computer Science", channelAvatar: "💻", duration: "1:15:20", views: "1.1M", uploaded: "1 year ago", subject: "Computer Science", chapter: "Data Types and Operators", description: "Python data types (int, float, complex, bool, str, list, tuple, dict, set), operators, expressions, and type conversions." },
  { id: "IZrEzQX_y5c", title: "Conditional and Iterative Statements — Class 11 CS", channel: "Computer Science", channelAvatar: "💻", duration: "1:15:30", views: "1.8M", uploaded: "1 year ago", subject: "Computer Science", chapter: "Conditional and Iterative Statements", description: "if-elif-else, for loops, while loops, break, continue, pass, and nested loops in Python with examples." },
  { id: "vEJAd8UxYgk", title: "Strings — Class 11 CS (Complete Theory)", channel: "Computer Science", channelAvatar: "💻", duration: "55:40", views: "780K", uploaded: "1 year ago", subject: "Computer Science", chapter: "Strings", description: "String operations, indexing, slicing, traversing, string methods, and built-in functions for Class 11 CBSE CS." },
  { id: "0JXVH6H2Ows", title: "Lists — Class 11 CS (Python)", channel: "Computer Science", channelAvatar: "💻", duration: "1:05:30", views: "1.2M", uploaded: "1 year ago", subject: "Computer Science", chapter: "Lists", description: "List creation, indexing, slicing, list operations, list methods (append, insert, remove, sort), and traversing for Class 11 CBSE CS." },
  { id: "it_dlfJ9in8", title: "Tuples — Class 11 CS (One Shot)", channel: "Computer Science", channelAvatar: "💻", duration: "55:20", views: "680K", uploaded: "1 year ago", subject: "Computer Science", chapter: "Tuples", description: "Tuple creation, indexing, slicing, immutability, tuple methods, and tuple operations for Class 11 CBSE CS." },
  { id: "MZZSMaEAC2g", title: "Dictionaries — Class 11 CS (Python)", channel: "Computer Science", channelAvatar: "💻", duration: "1:00:25", views: "820K", uploaded: "1 year ago", subject: "Computer Science", chapter: "Dictionaries", description: "Dictionary creation, accessing, modifying, dictionary methods (keys, values, items, get, update), and iteration." },
  { id: "89cGQjB5R4M", title: "Functions in Python — Class 11 CS", channel: "Computer Science", channelAvatar: "💻", duration: "1:10:20", views: "1.5M", uploaded: "1 year ago", subject: "Computer Science", chapter: "Functions", description: "Defining functions, parameters, arguments, return values, scope, default arguments, and recursive functions in Python." },
  { id: "aequTxAvQq4", title: "File Handling in Python — Class 11 CS", channel: "Computer Science", channelAvatar: "💻", duration: "1:00:15", views: "780K", uploaded: "1 year ago", subject: "Computer Science", chapter: "File Handling", description: "Text and binary files, opening, reading, writing, appending files, file modes, and standard file operations in Python." },
  { id: "XcfxkHrHTVE", title: "Python Modules — Class 11 CS", channel: "Computer Science", channelAvatar: "💻", duration: "40:30", views: "450K", uploaded: "1 year ago", subject: "Computer Science", chapter: "Modules", description: "Built-in modules (math, random, statistics), importing modules, creating user-defined modules, and the standard library." },
  // ============================ English (Hornbill + Snapshots) ============================
  { id: "saja4TJ-aKE", title: "The Portrait of a Lady — Hornbill Ch 1 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "22:15", views: "1.2M", uploaded: "1 year ago", subject: "English", chapter: "The Portrait of a Lady (Hornbill)", description: "Animated summary of The Portrait of a Lady by Khushwant Singh — relationship between the narrator and his grandmother." },
  { id: "7uX3vR_ev-Y", title: "We're Not Afraid to Die — Hornbill Ch 2 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "20:30", views: "950K", uploaded: "1 year ago", subject: "English", chapter: "We're Not Afraid to Die (Hornbill)", description: "Animated summary of the inspiring story of a family's courage and survival at sea." },
  { id: "U1lPw2fGifw", title: "Discovering Tut: The Saga Continues — Hornbill Ch 3 (Class 11)", channel: "Animation Channel", channelAvatar: "📖", duration: "24:40", views: "1.1M", uploaded: "1 year ago", subject: "English", chapter: "Discovering Tut (Hornbill)", description: "Animated summary exploring the mystery of King Tutankhamun's tomb, CT scans, and life of the boy pharaoh." },
  { id: "Dl5Ldj7YFr8", title: "Landscape of the Soul — Hornbill Ch 4 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "18:25", views: "720K", uploaded: "1 year ago", subject: "English", chapter: "Landscape of the Soul (Hornbill)", description: "Animated summary contrasting Chinese and Western art forms — shanshui, quasi-spiritual elements of painting." },
  { id: "tWQ39zh3H2g", title: "The Ailing Planet — Hornbill Ch 5 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "21:10", views: "680K", uploaded: "1 year ago", subject: "English", chapter: "The Ailing Planet (Hornbill)", description: "Animated summary on environmental concerns, sustainable development, and the Green Movement's role." },
  { id: "3MKUWuRzWh8", title: "The Browning Version — Hornbill Ch 6 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "23:50", views: "590K", uploaded: "1 year ago", subject: "English", chapter: "The Browning Version (Hornbill)", description: "Animated summary of the play by Terence Rattigan — relationship between a strict teacher and a sensitive student." },
  { id: "CBkXVzQ57W8", title: "The Adventure — Hornbill Ch 7 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "26:15", views: "810K", uploaded: "1 year ago", subject: "English", chapter: "The Adventure (Hornbill)", description: "Animated summary of Jayant Narlikar's sci-fi story exploring parallel worlds and catastrophic theory." },
  { id: "igJ18lBBGMQ", title: "Silk Road — Hornbill Ch 8 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "22:40", views: "740K", uploaded: "1 year ago", subject: "English", chapter: "Silk Road (Hornbill)", description: "Animated summary of Nick Middleton's travelogue through the Himalayas to Mount Kailash." },
  { id: "VX3O8fqM7D4", title: "The Summer of the Beautiful White Horse — Snapshots Ch 1 (Class 11)", channel: "Animation Channel", channelAvatar: "📖", duration: "20:15", views: "650K", uploaded: "1 year ago", subject: "English", chapter: "The Summer of the Beautiful White Horse (Snapshots)", description: "Animated summary of William Saroyan's story about two Armenian boys and a beautiful white horse." },
  { id: "QrWe35uANLE", title: "The Address — Snapshots Ch 2 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "19:30", views: "510K", uploaded: "1 year ago", subject: "English", chapter: "The Address (Snapshots)", description: "Animated summary of Marga Minco's story about a daughter returning to reclaim belongings after the war." },
  { id: "jIjnz9V6IxQ", title: "Ranga's Marriage — Snapshots Ch 3 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "23:20", views: "890K", uploaded: "1 year ago", subject: "English", chapter: "Ranga's Marriage (Snapshots)", description: "Animated summary of Masti Venkatesha Iyengar's story about arranged marriage traditions in a South Indian village." },
  { id: "78VUmmLERM8", title: "Albert Einstein at School — Snapshots Ch 4 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "21:45", views: "720K", uploaded: "1 year ago", subject: "English", chapter: "Albert Einstein at School (Snapshots)", description: "Animated summary of Patrick Pringle's account of young Einstein's struggles with the school system." },
  { id: "hGMmm7NipsQ", title: "Mother's Day — Snapshots Ch 5 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "22:10", views: "580K", uploaded: "1 year ago", subject: "English", chapter: "Mother's Day (Snapshots)", description: "Animated summary of J.B. Priestley's play about a mother who teaches her family to respect her." },
  { id: "gm2XdOlFW1Y", title: "The Ghat of the Only World — Snapshots Ch 6 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "18:55", views: "460K", uploaded: "1 year ago", subject: "English", chapter: "The Ghat of the Only World (Snapshots)", description: "Animated summary of Amitav Ghosh's tribute to his friend Agha Shahid Ali, the Kashmiri poet." },
  { id: "VHrw6dxOM78", title: "Birth — Snapshots Ch 7 (Class 11 English)", channel: "Animation Channel", channelAvatar: "📖", duration: "24:30", views: "530K", uploaded: "1 year ago", subject: "English", chapter: "Birth (Snapshots)", description: "Animated summary of A.J. Cronin's story about a young doctor's first solo delivery and a miraculous moment." },
];

// ===== JEE-specific videos — REAL verified YouTube IDs =====
const VIDEOS_JEE: Video[] = [
  { id: "85lbdjkfEsU", title: "All JEE Advanced Kinematics PYQs (1978-2024) — Complete Analysis", channel: "JEE PYQs", channelAvatar: "🎯", duration: "2:15:30", views: "1.2M", uploaded: "6 months ago", subject: "Physics", chapter: "Motion in a Straight Line", description: "JEE Main & Advanced level kinematics problems with shortcuts and multiple approach solutions, including all PYQs from 1978 to 2024." },
  { id: "aET5yd8RwhY", title: "JEE Advanced Rotational Motion — Hardest Problems & Tricks", channel: "JEE Physics Hub", channelAvatar: "🎯", duration: "3:20:00", views: "890K", uploaded: "3 months ago", subject: "Physics", chapter: "System of Particles and Rotational Motion", description: "Complete JEE rotational motion — moment of inertia, torque, angular momentum with PYQs and shortcut techniques." },
  { id: "vZ8CkOeeBj0", title: "JEE Mole Concept Revision — Full Marathon", channel: "JEE Chemistry", channelAvatar: "🎯", duration: "2:00:15", views: "1.1M", uploaded: "8 months ago", subject: "Chemistry", chapter: "Some Basic Concepts of Chemistry", description: "JEE-level mole concept, stoichiometry, and limiting reagent problems with tricks and PYQ walkthroughs." },
  { id: "ZD84xUEJjNw", title: "Complex Numbers — 25 JEE Mains PYQs (Factorial PYQ Master)", channel: "JEE Maths PYQ", channelAvatar: "🎯", duration: "2:45:00", views: "1.5M", uploaded: "4 months ago", subject: "Maths", chapter: "Complex Numbers and Quadratic Equations", description: "All JEE Main & Advanced PYQs on complex numbers with detailed solutions and shortcut tricks." },
  { id: "xJK2kG0EGcc", title: "Hardest Problem of JEE Advanced Physics — Laws of Motion", channel: "JEE Physics", channelAvatar: "🎯", duration: "2:30:00", views: "1.3M", uploaded: "5 months ago", subject: "Physics", chapter: "Laws of Motion", description: "Advanced JEE problems on Newton's laws, friction, and pulley systems with shortcut techniques." },
  { id: "zoIV0AfWtrs", title: "Atomic Structure One Shot for JEE Main 2026 — Bohr vs Heisenberg", channel: "JEE Chemistry", channelAvatar: "🎯", duration: "2:20:00", views: "1.0M", uploaded: "7 months ago", subject: "Chemistry", chapter: "Structure of Atom", description: "Quantum numbers, electronic configuration, and photoelectric effect at JEE Advanced level." },
  { id: "ZIGRTRiO9PU", title: "Easiest Trigonometry Question from JEE Mains 2025 — Tricks & PYQs", channel: "JEE Maths", channelAvatar: "🎯", duration: "2:15:00", views: "1.6M", uploaded: "6 months ago", subject: "Maths", chapter: "Trigonometric Functions", description: "JEE trigonometry shortcuts, multiple-angle formulas, and PYQs solved step by step." },
  { id: "Yi7FaSQ6xIw", title: "How to Solve Limits — JEE Advanced Approach", channel: "JEE Maths", channelAvatar: "🎯", duration: "2:40:00", views: "1.1M", uploaded: "4 months ago", subject: "Maths", chapter: "Limits and Derivatives", description: "Advanced limit problems, L'Hopital's rule introduction, and JEE-level differentiation techniques." },
  { id: "E6_gZvPKbPM", title: "The ONLY Way to Get 99%ile in JEE Mains in 6 Months", channel: "JEE Strategy", channelAvatar: "🎯", duration: "45:30", views: "2.1M", uploaded: "1 year ago", subject: "Physics", chapter: "JEE Strategy", description: "Complete JEE preparation strategy — timetable, resource selection, and mock test analysis for 6-month plan." },
  { id: "iOnmzfbKyZo", title: "How Many Hours to Cover the Entire IIT JEE Syllabus", channel: "JEE Strategy", channelAvatar: "🎯", duration: "35:20", views: "1.8M", uploaded: "8 months ago", subject: "Physics", chapter: "JEE Revision", description: "Complete Physics revision plan — all chapters, key formulas, and important problems with time management tips." },
];

// ===== NIGTUBE View =====
export function NigtubeView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const jeeMode = useStore((s) => s.user.jeeMode);
  const { name: myName } = useUserName();
  const plusAccess = useScholarAccess();
  const eligibility = useMemo(
    () => resolvePlusEligibility({
      loaded: plusAccess.entitlementsLoaded === true,
      entitlements: plusAccess.access?.entitlements ?? [],
      plan: plusAccess.access?.plan,
    }),
    [plusAccess.entitlementsLoaded, plusAccess.access],
  );
  // Pre-roll ad state machine: free users watch the 10s Scholar Plus promo,
  // Plus users skip straight to playback. The iframe only mounts at "playing"
  // so no video audio ever starts underneath the advertisement.
  const [adMachine, setAdMachine] = useState<NigtubeAdMachine>(() => idleAdMachine());
  // Filter out any entries with invalid YouTube IDs — they would render broken
  // embeds and missing thumbnails. This also drops the placeholder JEE_* entries.
  const activeVideos = (scholarClass === 11
    ? (jeeMode ? [...VIDEOS_CLASS11, ...VIDEOS_JEE] : VIDEOS_CLASS11)
    : VIDEOS
  ).filter(isValidVideo);
  const [search, setSearch] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFlashcards, setAiFlashcards] = useState<{ q: string; a: string }[] | null>(null);
  const [aiQuiz, setAiQuiz] = useState<{ q: string; options: string[]; answer: number }[] | null>(null);
  const [watchLater, setWatchLater] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"home" | "trending" | "saved" | "history" | "playlists">("home");
  const [watchHistory, setWatchHistory] = useState<string[]>([]);
  const [likedVideos, setLikedVideos] = useState<string[]>([]);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [miniPlayerVideo, setMiniPlayerVideo] = useState<Video | null>(null);
  const [aiMode, setAiMode] = useState<"summary" | "flashcards" | "quiz" | "notes" | null>(null);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [postedComments, setPostedComments] = useState<Comment[]>([]);
  const [likedComments, setLikedComments] = useState<Set<string>>(() => new Set());
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);
  const addCoins = useStore((s) => s.addCoins);

  const filtered = useMemo(() => {
    let list = activeVideos;
    if (activeSubject !== "All") list = list.filter((v) => v.subject === activeSubject);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.title.toLowerCase().includes(q) || v.chapter.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q));
    }
    if (activeTab === "trending") list = [...list].sort((a, b) => parseInt(b.views) - parseInt(a.views));
    if (activeTab === "saved") list = list.filter((v) => watchLater.includes(v.id));
    if (activeTab === "history") list = list.filter((v) => watchHistory.includes(v.id));
    return list;
  }, [search, activeSubject, activeTab, watchLater, watchHistory]);

  function handlePlay(video: Video) {
    setSelectedVideo(video);
    setAdMachine(beginPlayback({ adFree: eligibility.adFree, loaded: eligibility.loaded }));
    setAiSummary(null);
    setAiFlashcards(null);
    setAiQuiz(null);
    setAiNotes(null);
    setAiMode(null);
    if (!watchHistory.includes(video.id)) {
      setWatchHistory((prev) => [video.id, ...prev].slice(0, 20));
    }
    addXP(2);
    addCoins(1);
    pushActivity({ type: "video", text: `Watched: ${video.title.substring(0, 40)}`, icon: "▶️" });
  }

  // Countdown driver — only runs while the ad is showing, stops on unmount,
  // video switch, or when the student leaves the player.
  useEffect(() => {
    if (adMachine.state !== "ad" || adMachine.countdown <= 0) return;
    const timer = window.setInterval(() => setAdMachine((machine) => tickAd(machine)), 1000);
    return () => window.clearInterval(timer);
  }, [adMachine.state, adMachine.countdown]);

  // Resolve the transient "checking" state once entitlements finish loading.
  useEffect(() => {
    if (adMachine.state !== "checking") return;
    setAdMachine((machine) =>
      machine.state === "checking"
        ? beginPlayback({ adFree: eligibility.adFree, loaded: eligibility.loaded })
        : machine,
    );
  }, [adMachine.state, eligibility.adFree, eligibility.loaded]);

  async function handleAI(mode: "summary" | "flashcards" | "quiz" | "notes") {
    if (!selectedVideo) return;
    setAiLoading(true);
    setAiMode(mode);
    setAiSummary(null);
    setAiFlashcards(null);
    setAiQuiz(null);
    setAiNotes(null);
    try {
      if (mode === "summary") {
        const summary = await askAI(
          `Summarize this CBSE Class 9 educational video for a student. Title: "${selectedVideo.title}". Subject: ${selectedVideo.subject}. Chapter: ${selectedVideo.chapter}. Description: ${selectedVideo.description}. Provide a concise summary with key points and important formulas/concepts to remember. Use markdown.`,
          "default"
        );
        setAiSummary(summary);
      } else if (mode === "flashcards") {
        const result = await askAI(
          `Based on this CBSE Class 9 video, generate 5 flashcards. Title: "${selectedVideo.title}". Chapter: ${selectedVideo.chapter}. Format: Q: <question> | A: <answer>. One per line.`,
          "default"
        );
        const cards = result.split("\n").filter((l) => l.includes("Q:") && l.includes("A:")).map((l) => {
          const parts = l.split("A:");
          return { q: (parts[0] || "").replace("Q:", "").trim(), a: (parts[1] || "").trim() };
        });
        setAiFlashcards(cards.length > 0 ? cards : [{ q: "No flashcards generated", a: "Try again" }]);
      } else if (mode === "quiz") {
        const result = await askAI(
          `Based on this CBSE Class 9 video, generate 3 MCQ quiz questions. Title: "${selectedVideo.title}". Chapter: ${selectedVideo.chapter}. Format as JSON array: [{"q":"question","options":["a","b","c","d"],"answer":0}]. The "answer" is the index of the correct option.`,
          "default",
          { temperature: 0.4 }
        );
        try {
          const parsed = JSON.parse(result);
          setAiQuiz(Array.isArray(parsed) ? parsed : []);
        } catch {
          setAiQuiz([]);
        }
      } else if (mode === "notes") {
        const result = await askAI(
          `Create detailed study notes from this CBSE Class 9 video. Title: "${selectedVideo.title}". Chapter: ${selectedVideo.chapter}. Description: ${selectedVideo.description}. Include: key definitions, formulas, important points, and a summary. Use markdown with headings.`,
          "default"
        );
        setAiNotes(result);
      }
    } catch {
      toast.error("AI request failed. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  function toggleLike(videoId: string) {
    setLikedVideos((prev) => prev.includes(videoId) ? prev.filter((v) => v !== videoId) : [...prev, videoId]);
  }

  function toggleWatchLater(videoId: string) {
    setWatchLater((prev) => prev.includes(videoId) ? prev.filter((v) => v !== videoId) : [...prev, videoId]);
  }

  function openMiniPlayer(video: Video) {
    setMiniPlayerVideo(video);
    setShowMiniPlayer(true);
  }

  // Reset posted comments whenever a new video is opened
  useEffect(() => {
    setPostedComments([]);
    setCommentInput("");
    setLikedComments(new Set());
  }, [selectedVideo?.id]);

  function handlePostComment() {
    const text = commentInput.trim();
    if (!text) {
      toast.error("Write something first!");
      return;
    }
    const newComment: Comment = {
      id: `local-${Date.now()}`,
      name: myName,
      avatar: "🌟",
      text,
      time: "Just now",
      likes: 0,
    };
    setPostedComments((prev) => [newComment, ...prev]);
    setCommentInput("");
    toast.success("Comment posted!");
    addXP(1);
    addCoins(1);
  }

  return (
    <div className="relative -m-3 min-h-[calc(100vh-4rem)] overflow-hidden bg-black sm:-m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        .nt-glass {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: none;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .nt-glass::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .nt-glass-strong {
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .nt-font { font-family: 'Inter', sans-serif; }
        .nt-serif { font-family: 'Instrument Serif', serif; }
        .nt-scroll::-webkit-scrollbar { width: 6px; }
        .nt-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* Ambient background */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-black via-[#0a0010] to-black" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-red-500/10 blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-4 md:px-8 py-4 nt-font">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-fuchsia-600 shadow-lg">
              <PlayCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">NIGTUBE</h1>
              <p className="text-[10px] text-white/40 -mt-0.5">Study videos, reimagined</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-4 nt-glass rounded-full px-4 py-2.5 flex items-center gap-2">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos, chapters, subjects..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/40"
            />
          </div>

          {/* Tabs */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { id: "home", icon: Home, label: "Home" },
              { id: "trending", icon: TrendingUp, label: "Trending" },
              { id: "playlists", icon: ListVideo, label: "Playlists" },
              { id: "saved", icon: Bookmark, label: "Saved" },
              { id: "history", icon: History, label: "History" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-all ${
                  activeTab === tab.id ? "nt-glass text-white" : "text-white/50 hover:text-white"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Subject filter */}
        <div className="px-4 md:px-8 pb-4 flex gap-2 overflow-x-auto nt-scroll">
          {(scholarClass === 11 ? SUBJECTS_CLASS11 : SUBJECTS_CLASS9).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSubject(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeSubject === s ? "bg-white text-black" : "nt-glass text-white/70 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="px-4 md:px-8"><FreeAdSlot entitlement="nigtube_ad_free" label="Nigtube" /></div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto nt-scroll px-4 md:px-8 pb-8">
          {selectedVideo ? (
            /* ===== Video Player View ===== */
            <div className="max-w-6xl mx-auto">
              <button
                onClick={() => { setSelectedVideo(null); setAdMachine(idleAdMachine()); }}
                className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 nt-font"
              >
                <ChevronRight className="h-4 w-4 rotate-180" /> Back to videos
              </button>

              {/* YouTube Embed — the iframe only mounts at "playing", so the
                  pre-roll ad never has video audio running underneath it. */}
              <div className="nt-glass-strong rounded-2xl overflow-hidden mb-4">
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  {isPlaying(adMachine) ? (
                    <iframe
                      src={ytEmbedUrl(selectedVideo)}
                      title={selectedVideo.title}
                      className="absolute inset-0 w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="absolute inset-0">
                      <NigtubePlusAd
                        machine={adMachine}
                        onSkip={() => setAdMachine((machine) => skipAd(machine))}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-black/40 text-xs text-white/70">
                  <span className="truncate">If the video doesn't play, the ID may be unavailable.</span>
                  <a
                    href={ytSearchUrl(selectedVideo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
                  >
                    Search on YouTube ↗
                  </a>
                </div>
              </div>

              {/* Video info */}
              <div className="nt-glass rounded-2xl p-5 mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-white nt-font mb-2">{selectedVideo.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/50 nt-font">
                  <span className="flex items-center gap-1"><span className="text-lg">{selectedVideo.channelAvatar}</span> {selectedVideo.channel}</span>
                  <span>•</span>
                  <span>{selectedVideo.views} views</span>
                  <span>•</span>
                  <span>{selectedVideo.uploaded}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-xs">{selectedVideo.subject}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-xs">{selectedVideo.chapter}</span>
                </div>
                <p className="text-sm text-white/60 mt-3 nt-font">{selectedVideo.description}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => toggleLike(selectedVideo.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm nt-glass text-white hover:bg-white/5"
                  >
                    <ThumbsUp className={`h-4 w-4 ${likedVideos.includes(selectedVideo.id) ? "fill-white" : ""}`} />
                    {likedVideos.includes(selectedVideo.id) ? "Liked" : "Like"}
                  </button>
                  <button
                    onClick={() => toggleWatchLater(selectedVideo.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm nt-glass text-white hover:bg-white/5"
                  >
                    <Bookmark className={`h-4 w-4 ${watchLater.includes(selectedVideo.id) ? "fill-white" : ""}`} />
                    {watchLater.includes(selectedVideo.id) ? "Saved" : "Save"}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(ytWatchUrl(selectedVideo)); toast.success("Link copied!"); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm nt-glass text-white hover:bg-white/5"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                  <button
                    onClick={() => openMiniPlayer(selectedVideo)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm nt-glass text-white hover:bg-white/5"
                  >
                    <Maximize className="h-4 w-4" /> Mini Player
                  </button>
                </div>
              </div>

              {/* AI Features — Full panel */}
              <div className="nt-glass rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white nt-font">AI Study Tools</h3>
                </div>

                {/* AI Mode tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { mode: "summary", icon: FileText, label: "AI Summary" },
                    { mode: "flashcards", icon: Brain, label: "Flashcards" },
                    { mode: "quiz", icon: Zap, label: "Quiz" },
                    { mode: "notes", icon: ListVideo, label: "Notes" },
                  ].map((t) => (
                    <button
                      key={t.mode}
                      onClick={() => handleAI(t.mode as "summary" | "flashcards" | "quiz" | "notes")}
                      disabled={aiLoading}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-all disabled:opacity-50 ${
                        aiMode === t.mode ? "bg-white text-black" : "nt-glass text-white/70 hover:text-white"
                      }`}
                    >
                      <t.icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  ))}
                </div>

                {/* AI Loading */}
                {aiLoading && (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                    <span className="text-sm text-white/60 nt-font">AI is thinking...</span>
                  </div>
                )}

                {/* AI Summary */}
                {aiSummary && !aiLoading && (
                  <div className="text-sm text-white/70 max-h-96 overflow-y-auto nt-scroll">
                    <Markdown content={aiSummary} />
                  </div>
                )}

                {/* AI Flashcards */}
                {aiFlashcards && !aiLoading && (
                  <div className="space-y-3 max-h-96 overflow-y-auto nt-scroll">
                    {aiFlashcards.map((card, i) => (
                      <div key={i} className="nt-glass rounded-xl p-4">
                        <p className="text-xs text-white/40 mb-1">Card {i + 1}</p>
                        <p className="text-sm text-white font-medium mb-2">{card.q}</p>
                        <p className="text-sm text-white/60">{card.a}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Quiz */}
                {aiQuiz && !aiLoading && (
                  <div className="space-y-4 max-h-96 overflow-y-auto nt-scroll">
                    {aiQuiz.length > 0 ? aiQuiz.map((q, i) => (
                      <div key={i} className="nt-glass rounded-xl p-4">
                        <p className="text-sm text-white font-medium mb-3">Q{i + 1}. {q.q}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, j) => (
                            <div key={j} className={`px-3 py-2 rounded-lg text-sm ${j === q.answer ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-white/60"}`}>
                              {String.fromCharCode(65 + j)}. {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )) : <p className="text-sm text-white/40 text-center py-4">No quiz generated. Try again.</p>}
                  </div>
                )}

                {/* AI Notes */}
                {aiNotes && !aiLoading && (
                  <div className="text-sm text-white/70 max-h-96 overflow-y-auto nt-scroll">
                    <Markdown content={aiNotes} />
                  </div>
                )}
              </div>

              {/* Comments section */}
              <div className="nt-glass rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white nt-font">
                    Comments <span className="text-white/40">· {COMMENTS.length + postedComments.length}</span>
                  </h3>
                </div>

                {/* Comment input */}
                <div className="flex gap-3 mb-5">
                  <div className="grid place-items-center h-9 w-9 rounded-full bg-white/10 text-base shrink-0">🌟</div>
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add a comment..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 outline-none resize-none nt-font"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setCommentInput("")}
                        className="px-3 py-1.5 rounded-full text-xs text-white/60 hover:text-white nt-font"
                      >Cancel</button>
                      <button
                        onClick={handlePostComment}
                        className="px-4 py-1.5 rounded-full text-xs font-medium bg-white text-black hover:bg-white/90 nt-font"
                      >Comment</button>
                    </div>
                  </div>
                </div>

                {/* Comments list */}
                <div className="space-y-4 max-h-[28rem] overflow-y-auto nt-scroll pr-1">
                  {[...postedComments, ...COMMENTS].map((c, idx) => {
                    const commentKey = c.id ?? `static-${idx}`;
                    const liked = likedComments.has(commentKey);
                    return <div key={commentKey} className="flex gap-3">
                      <div className="grid place-items-center h-9 w-9 rounded-full bg-white/10 text-base shrink-0">{c.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-white nt-font">{c.name}</span>
                          <span className="text-[10px] text-white/40 nt-font">{c.time}</span>
                        </div>
                        <p className="text-sm text-white/70 nt-font leading-relaxed">{c.text}</p>
                        <div className="flex items-center gap-4 mt-1.5">
                          <button type="button" onClick={() => setLikedComments((current) => { const next = new Set(current); if (next.has(commentKey)) next.delete(commentKey); else next.add(commentKey); return next; })} aria-pressed={liked} className={cn("flex items-center gap-1 text-[11px] hover:text-white nt-font", liked ? "text-rose-300" : "text-white/50")}>
                            <ThumbsUp className="h-3 w-3" /> {c.likes + (liked ? 1 : 0)}
                          </button>
                          <button type="button" onClick={() => setCommentInput(`@${c.name} `)} className="text-[11px] text-white/50 hover:text-white nt-font">Reply</button>
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
              </div>

              {/* Related videos */}
              <h3 className="text-sm font-semibold text-white/60 mb-3 nt-font">Up Next</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {VIDEOS.filter((v) => v.id !== selectedVideo.id && v.subject === selectedVideo.subject).slice(0, 3).map((v) => (
                  <VideoCard key={v.id} video={v} onPlay={handlePlay} onBookmark={toggleWatchLater} saved={watchLater.includes(v.id)} compact />
                ))}
              </div>
            </div>
          ) : (
            /* ===== Video Grid View ===== */
            <>
              {activeTab === "playlists" ? (
                /* ===== Playlists tab ===== */
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="nt-glass-strong rounded-3xl p-6 md:p-10 mb-2 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 via-red-500/10 to-transparent" />
                    <div className="relative z-10 max-w-2xl">
                      <div className="flex items-center gap-2 mb-3">
                        <ListVideo className="h-4 w-4 text-fuchsia-400" />
                        <span className="text-xs uppercase tracking-widest text-white/50 nt-font">Curated YouTube Playlists</span>
                      </div>
                      <h1 className="nt-serif italic text-4xl md:text-6xl text-white leading-[0.9] mb-4">
                        Full courses, <span className="text-fuchsia-400">one click.</span>
                      </h1>
                      <p className="text-sm text-white/60 nt-font max-w-md">
                        Hand-picked PhysicsWallah playlists covering every Class 9 CBSE subject. Tap a card to open the full playlist on YouTube.
                      </p>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {PLAYLISTS.map((pl, i) => (
                      <motion.a
                        key={pl.id}
                        href={`https://www.youtube.com/playlist?list=${pl.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="nt-glass rounded-2xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.02] block"
                      >
                        {/* Thumbnail-like header */}
                        <div className="relative aspect-video bg-gradient-to-br from-fuchsia-500/30 via-purple-500/20 to-red-500/30 overflow-hidden">
                          <div className="absolute inset-0 grid place-items-center">
                            <span className="text-5xl drop-shadow-lg group-hover:scale-110 transition-transform">{pl.emoji}</span>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] nt-font font-medium flex items-center gap-1">
                            <ListVideo className="h-3 w-3" /> Playlist
                          </div>
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] nt-font">
                            {pl.videoCount}
                          </div>
                          <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="grid place-items-center h-14 w-14 rounded-full bg-white/20 backdrop-blur-md">
                              <PlayCircle className="h-7 w-7 text-white" />
                            </div>
                          </div>
                        </div>
                        {/* Info */}
                        <div className="p-3">
                          <h3 className="text-white font-medium nt-font line-clamp-2 text-sm">{pl.title}</h3>
                          <p className="text-xs text-white/40 nt-font mt-1">{pl.channel}</p>
                          <p className="text-[11px] text-white/50 nt-font mt-1 line-clamp-2">{pl.description}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] nt-font">{pl.subject}</span>
                            <span className="ml-auto text-[10px] text-fuchsia-400 nt-font flex items-center gap-0.5">
                              Open <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === "home" && !search && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="nt-glass-strong rounded-3xl p-6 md:p-10 mb-6 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-fuchsia-500/10 to-transparent" />
                      <div className="relative z-10 max-w-2xl">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="h-4 w-4 text-fuchsia-400" />
                          <span className="text-xs uppercase tracking-widest text-white/50 nt-font">AI-Powered Study Videos</span>
                        </div>
                        <h1 className="nt-serif italic text-4xl md:text-6xl text-white leading-[0.9] mb-4">
                          Watch. Learn. <span className="text-fuchsia-400">Ace it.</span>
                        </h1>
                        <p className="text-sm text-white/60 nt-font max-w-md">
                          CBSE Class 9 video lessons with AI summaries, flashcards, quizzes, and notes. Every video is mapped to your syllabus.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 nt-font">+2 XP per video</span>
                          <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 nt-font">+1 coin per video</span>
                          <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 nt-font">AI Flashcards</span>
                          <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 nt-font">AI Quiz</span>
                          <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-white/60 nt-font">AI Notes</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <PlayCircle className="h-12 w-12 text-white/20 mb-4" />
                      <p className="text-white/40 nt-font">No videos found. Try a different search.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filtered.map((video, i) => (
                        <motion.div
                          key={video.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <VideoCard video={video} onPlay={handlePlay} onBookmark={toggleWatchLater} saved={watchLater.includes(video.id)} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Floating Mini Player */}
        <AnimatePresence>
          {showMiniPlayer && miniPlayerVideo && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-4 right-4 z-50 nt-glass-strong rounded-2xl overflow-hidden w-80 shadow-2xl"
            >
              <div className="relative aspect-video">
                <iframe
                  src={ytEmbedUrl(miniPlayerVideo)}
                  title={miniPlayerVideo.title}
                  className="absolute inset-0 w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-3 flex items-center gap-2">
                <p className="text-xs text-white/70 nt-font flex-1 truncate">{miniPlayerVideo.title}</p>
                <button onClick={() => { setShowMiniPlayer(false); setMiniPlayerVideo(null); }} className="p-1 rounded-full hover:bg-white/10">
                  <X className="h-4 w-4 text-white/60" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ===== Video Card Component =====
function VideoCard({
  video, onPlay, onBookmark, saved, compact,
}: {
  video: Video;
  onPlay: (v: Video) => void;
  onBookmark: (id: string) => void;
  saved: boolean;
  compact?: boolean;
}) {
  // Thumbnail fallback chain: hqdefault -> mqdefault -> gradient placeholder.
  // If the video ID isn't a valid 11-char YouTube ID, skip straight to the
  // placeholder so we never show a broken img element.
  const validId = YT_ID_RE.test(video.id);
  const [thumbStage, setThumbStage] = useState<0 | 1 | 2>(validId ? 0 : 2);
  const thumbSrc =
    thumbStage === 0
      ? `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`
      : thumbStage === 1
        ? `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`
        : "";

  return (
    <div
      onClick={() => onPlay(video)}
      className="nt-glass rounded-2xl overflow-hidden cursor-pointer group transition-all hover:scale-[1.02]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-white/5 overflow-hidden">
        {thumbStage < 2 ? (
          <img
            src={thumbSrc}
            alt={video.title}
            loading="lazy"
            onError={() => setThumbStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s))}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-red-500/10 to-fuchsia-500/10">
            <PlayCircle className="h-12 w-12 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="grid place-items-center h-14 w-14 rounded-full bg-white/20 backdrop-blur-md">
            <PlayCircle className="h-7 w-7 text-white" />
          </div>
        </div>
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
          {video.duration}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onBookmark(video.id); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Bookmark className={`h-3.5 w-3.5 text-white ${saved ? "fill-white" : ""}`} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex gap-2.5">
          <div className="grid place-items-center h-8 w-8 rounded-full bg-white/10 text-base shrink-0">
            {video.channelAvatar}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`text-white font-medium nt-font line-clamp-2 ${compact ? "text-xs" : "text-sm"}`}>
              {video.title}
            </h3>
            <p className="text-xs text-white/40 nt-font mt-1">{video.channel}</p>
            <p className="text-xs text-white/40 nt-font">{video.views} views • {video.uploaded}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NigtubeView;
