"use client";
import {useLayoutEffect,useRef,useState} from "react";
import {velocityMotionAllowed} from "@/lib/animation/velocity-policy";

/** Radix Select (unlike Menu) has no Presence. Retain its real content briefly
 * for exit, not a cloned ghost. Value handlers remain immediate; close/focus
 * restoration finish together. Reopen cancels the old exit timer. */
export function useRetainedSelect(openProp:boolean|undefined,defaultOpen:boolean|undefined,onChange:((open:boolean)=>void)|undefined) {
  const [local,setLocal]=useState(defaultOpen??false), open=openProp??local;
  const [state,setState]=useState({requested:open,retained:open,epoch:0});
  // Adjust this component's own state before children render. This avoids an
  // effect-driven second layout commit and never changes parent state.
  if(open!==state.requested)setState({requested:open,retained:open||state.retained,epoch:state.epoch+1});
  const closing=!open&&state.retained;
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useLayoutEffect(()=>{
    clearTimeout(timer.current);
    if(closing){const epoch=state.epoch;timer.current=setTimeout(()=>setState(s=>s.epoch===epoch?{...s,retained:false}:s),velocityMotionAllowed("panel")?160:0);}
    return()=>clearTimeout(timer.current);
  },[closing,state.epoch]);
  return {open:open||state.retained,closing,onOpenChange:(next:boolean)=>{if(next)clearTimeout(timer.current);setLocal(next);onChange?.(next);}};
}
