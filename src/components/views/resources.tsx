"use client";
import { useEffect, useState } from "react";
import { ClassicResourceLibrary } from "@/components/resources/classic-resource-library";
export function ResourcesView() {
  const [target, setTarget] = useState<{ subjectId?: string; chapterId?: string; type?: string; q?: string; resourceId?: string } | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const value = sessionStorage.getItem("scholar:resources:target");
        sessionStorage.removeItem("scholar:resources:target");
        if (value) setTarget(JSON.parse(value));
      } catch {}
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <ClassicResourceLibrary key={JSON.stringify(target)} subjectId={target?.subjectId} chapterId={target?.chapterId} type={target?.type} initialSearch={target?.q} initialResourceId={target?.resourceId}/>;
}
