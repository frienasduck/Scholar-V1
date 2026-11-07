"use client";
import {useCallback,useEffect,useId,useState} from "react";
import {SETTINGS_TARGET_EVENT,consumeSettingsTarget} from "@/lib/shrinking-scholar";

export const SETTINGS_CATEGORIES=[
  ["account","Account"],["appearance","Appearance"],["academic","Academic"],["lam","LAM"],
  ["intelligence","Scholar Intelligence"],["privacy","Privacy"],["notifications","Notifications"],
  ["data","Data"],["downloads","Downloads"],["personalization","Learning Profile"],
  ["subscription","Subscription"],["connections","Plugins & Connections"],["updates","Update Logs"],["developer","Developer"],
] as const;
const valid=(value:string)=>SETTINGS_CATEGORIES.some(([id])=>id===value);
export function settingsCategoryFromUrl(url:URL){
  let hash="";try{hash=decodeURIComponent(url.hash.slice(1));}catch{}
  if(hash==="plugins-connections")return"connections";
  return valid(hash)?hash:new URLSearchParams(url.search).has("drive")?"connections":"account";
}
function initialSettingsState(historyOwner:string){
  if(typeof window==="undefined")return{category:"account",depth:0};
  // A deep link can set a Settings target before this view mounts (for
  // example /intelligence or a search result). Consume it once so the
  // requested tab opens even though the URL may still carry #account.
  const target=consumeSettingsTarget();
  const category=target&&valid(target)?target:settingsCategoryFromUrl(new URL(location.href));
  const marker=history.state?.scholarSettings;
  return{category,depth:marker?.owner===historyOwner?marker.depth:0};
}
export function useSettingsNavigation(){
  const historyOwner=useId();
  const [initial]=useState(()=>initialSettingsState(historyOwner));
  const [category,setCategory]=useState(initial.category),[depth,setDepth]=useState(initial.depth);
  useEffect(()=>{
    const sync=()=>{setCategory(settingsCategoryFromUrl(new URL(location.href)));const marker=history.state?.scholarSettings;setDepth(marker?.owner===historyOwner?marker.depth:0);};
    const onTarget=(event:Event)=>{
      const next=(event as CustomEvent<{category?:string}>).detail?.category;
      if(!next||!valid(next))return;
      consumeSettingsTarget();
      setCategory(next);
      setDepth(0);
      document.getElementById("main-scroll")?.scrollTo({top:0,behavior:"auto"});
    };
    window.addEventListener("popstate",sync);
    window.addEventListener("hashchange",sync);
    window.addEventListener(SETTINGS_TARGET_EVENT,onTarget);
    return()=>{window.removeEventListener("popstate",sync);window.removeEventListener("hashchange",sync);window.removeEventListener(SETTINGS_TARGET_EVENT,onTarget);};
  },[historyOwner]);
  const select=useCallback((next:string)=>{if(!valid(next)||next===category)return;setCategory(next);setDepth(depth+1);const hash=next==="connections"?"plugins-connections":next;history.pushState({...history.state,viewId:"settings",scholarSettings:{owner:historyOwner,depth:depth+1}},"",`${location.pathname}${location.search}#${hash}`);document.getElementById("main-scroll")?.scrollTo({top:0,behavior:"auto"});},[category,depth,historyOwner]);
  const back=()=>{if(depth>0)history.back();else window.dispatchEvent(new CustomEvent("neha-scholar:navigate",{detail:{viewId:"dashboard"}}));};
  return{category,select,back,hasBack:depth>0};
}
