import { notFound } from "next/navigation";
import Home from "../page";
import { isScholarRoute } from "@/lib/routes";
export const metadata = { robots: { index: false, follow: false } };
export default async function WorkspaceRoute({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!isScholarRoute(path)) notFound();
  return <Home />;
}
