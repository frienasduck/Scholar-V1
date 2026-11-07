"use client";
import {BookOpen,ArrowRight} from "lucide-react";
import {Button} from "@/components/ui/button";
import {navigateTo} from "@/lib/nav-event";

/** Intentional route link, not another embedded discovery/search/filter UI. */
export function ResourcesHomeLink(_props: Record<string,unknown>){
  return <div className="sg-resources-route-link"><p>Browse and manage study sources in your dedicated Resources library. Lesson citations and selected materials remain with your learning.</p><Button variant="outline" onClick={()=>navigateTo("resources")}><BookOpen className="size-4"/>Open Resources<ArrowRight className="size-4"/></Button></div>;
}
