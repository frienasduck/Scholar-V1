"use client";
import {useEffect,useState} from "react";
import {useStore} from "@/lib/store";
import type {ResourceResult} from "@/lib/resources/types";

/** Same authenticated/permission-filtered endpoint as the old command search.
 * Identity/query fencing plus abort prevents stale private results resurfacing. */
export function useResourceSearch(query:string,active:boolean){
  const grade=useStore(s=>s.user.scholarClass),identity=useStore(s=>`${s.authed}:${s.guestMode}:${s.user.email}`);
  const q=query.trim().slice(0,160),[record,setRecord]=useState<{identity:string;q:string;grade:number;status:"ready"|"error";resources:ResourceResult["resources"]}|null>(null);
  useEffect(()=>{
    if(!active||q.length<2)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{void fetch(`/api/resources?${new URLSearchParams({q,grade:String(grade),limit:"5"})}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error("Resource lookup unavailable");const data=await response.json();if(!Array.isArray(data.resources))throw Error("Invalid resource result");if(!controller.signal.aborted)setRecord({identity,q,grade,status:"ready",resources:data.resources});}).catch(()=>{if(!controller.signal.aborted)setRecord({identity,q,grade,status:"error",resources:[]});});},250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[q,grade,identity,active]);
  if(!active||q.length<2)return{resources:[],status:"idle" as const};
  return record?.identity===identity&&record.q===q&&record.grade===grade?record:{resources:[],status:"loading" as const};
}
