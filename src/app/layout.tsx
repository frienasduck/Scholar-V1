import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Poppins, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scholar — Study OS for CBSE Class 9 & Class 11",
  description:
    "A premium, minimal, all-in-one study operating system for CBSE students. AI tutors, notes, flashcards, quizzes, planner, analytics and more. Supports Class 9 (Science, Maths, SST, English) and Class 11 (Physics, Chemistry, Maths, Computer Science, English) with an optional JEE Mode.",
  keywords: ["CBSE", "Class 9", "Class 11", "PCM", "Computer Science", "JEE", "Study", "AI Tutor", "Scholar", "Flashcards", "Quiz"],
  authors: [{ name: "Scholar" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scholar",
  },
  applicationName: "Scholar",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark" data-scholar-theme="theme-default">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var r=JSON.parse(localStorage.getItem('neha-scholar-v5')||'{}'),s=r&&r.state||{},c=s.user&&s.user.scholarClass===11?11:9,id=localStorage.getItem('scholar:class'+c+':equipped-theme')||'theme-default',valid=['theme-default','theme-aurora','theme-sunset','theme-glass','theme-paper'];if(valid.indexOf(id)<0)id='theme-default';var a=s.settings&&s.settings.appearance||{},m=a.themeMode||'dark',now=new Date(),mins=now.getHours()*60+now.getMinutes(),toM=function(v,d){var p=String(v||d).split(':').map(Number);return(p[0]||0)*60+(p[1]||0)},s1=a.sunriseSunset?390:toM(a.scheduleLight,'07:00'),s2=a.sunriseSunset?1110:toM(a.scheduleDark,'19:00');if(m==='system')m=matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';if(m==='schedule')m=s1<=s2&&mins>=s1&&mins<s2?'light':'dark';var root=document.documentElement,dark=m!=='light',hex=/^#[0-9a-f]{6}$/i,colors=a.colors||{},accent=hex.test(colors.primary||'')?colors.primary:'#818cf8';root.dataset.scholarTheme=id;root.dataset.appearanceTheme=m;root.dataset.appearancePreset=a.preset||'scholar-default';root.dataset.appearanceDensity=a.density||'balanced';root.style.setProperty('--scholar-accent',accent);root.style.setProperty('--primary',accent);root.classList.toggle('dark',dark)}catch(e){}})();` }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${poppins.variable} ${sourceSerif4.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <SonnerToaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
