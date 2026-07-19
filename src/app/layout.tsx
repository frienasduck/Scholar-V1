import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Poppins, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var r=JSON.parse(localStorage.getItem('neha-scholar-v5')||'{}');var c=r&&r.state&&r.state.user&&r.state.user.scholarClass===11?11:9;var id=localStorage.getItem('scholar:class'+c+':equipped-theme')||'theme-default';var valid=['theme-default','theme-aurora','theme-sunset','theme-glass','theme-paper'];if(valid.indexOf(id)<0)id='theme-default';document.documentElement.dataset.scholarTheme=id;document.documentElement.classList.toggle('dark',id!=='theme-paper')}catch(e){}})();` }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${poppins.variable} ${sourceSerif4.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <SonnerToaster richColors closeButton position="bottom-right" />
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
