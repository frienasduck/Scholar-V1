"use client";
import dynamic from "next/dynamic";
const AuthScreen = dynamic(() => import("@/components/auth-screen").then((m) => m.AuthScreen), { ssr: false, loading: () => <main className="grid min-h-dvh place-items-center bg-background" role="status">Opening Scholar…</main> });
export default function LoginPage() { return <AuthScreen />; }
