"use client";
import {useEffect,useRef,useState} from "react";
import {AnimatePresence,motion} from "framer-motion";
import {X} from "lucide-react";

const KEY="scholar:guest-notice-dismissed-v31";
export const GUEST_NOTICE_MS=5000;

/** Five visible foreground seconds, once per browser session. Route renders
 * never reset the clock. Focus gets one bounded reading pause; hidden tabs
 * pause without burning the time behind another application. */
export function GuestSessionNotice({guest,ready,reduced,onSignIn}:{guest:boolean;ready:boolean;reduced:boolean;onSignIn:()=>void}) {
  const [visible,setVisible]=useState(()=>{try{return sessionStorage.getItem(KEY)!=="1";}catch{return true;}});
  const noticeRef=useRef<HTMLElement>(null),remainingRef=useRef(GUEST_NOTICE_MS);
  const controllerRef=useRef<{pause:()=>void;resume:()=>void;dismiss:()=>void}|null>(null);
  useEffect(()=>{
    if(!guest||!ready)return;
    try{if(sessionStorage.getItem(KEY)==="1")return;}catch{}
    let timer=0,focusTimer=0,started=0,focused=false,done=false;
    const stop=()=>{if(started){remainingRef.current=Math.max(0,remainingRef.current-(performance.now()-started));started=0;}clearTimeout(timer);};
    const dismiss=()=>{if(done)return;done=true;stop();clearTimeout(focusTimer);try{sessionStorage.setItem(KEY,"1");}catch{}if(noticeRef.current?.contains(document.activeElement))document.querySelector<HTMLElement>('.scholar-top-profile')?.focus();setVisible(false);};
    const resume=()=>{if(done||document.hidden||focused)return;stop();started=performance.now();timer=window.setTimeout(dismiss,remainingRef.current);};
    const pause=()=>{if(done||focused)return;stop();focused=true;focusTimer=window.setTimeout(()=>{focused=false;resume();},8000);};
    const focusOut=()=>{focused=false;clearTimeout(focusTimer);resume();};
    const visibility=()=>{if(document.hidden)stop();else resume();};
    controllerRef.current={pause,resume:focusOut,dismiss};resume();document.addEventListener("visibilitychange",visibility);
    return()=>{stop();clearTimeout(focusTimer);controllerRef.current=null;document.removeEventListener("visibilitychange",visibility);};
  },[guest,ready]);
  return <AnimatePresence initial={false}>{guest&&visible&&<motion.section ref={noticeRef} className="scholar-guest-banner" data-testid="guest-session-notice" aria-label="Guest session information" role="status"
    initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,height:0,paddingTop:0,paddingBottom:0,marginTop:0,marginBottom:0,borderWidth:0}} transition={{duration:reduced?0:.18}}
    onFocusCapture={()=>controllerRef.current?.pause()} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))controllerRef.current?.resume();}}>
    <p className="scholar-guest-copy"><strong>Guest session</strong><span>Some work lasts only for this session. Sign in for account-synced learning.</span></p>
    <div className="scholar-guest-actions"><button type="button" className="scholar-guest-action" data-velocity-control="session" onClick={onSignIn}>Create account or Sign in</button><button type="button" className="scholar-guest-dismiss" aria-label="Dismiss guest session banner" onClick={()=>{if(controllerRef.current){controllerRef.current.dismiss();return;}try{sessionStorage.setItem(KEY,"1");}catch{}if(noticeRef.current?.contains(document.activeElement))document.querySelector<HTMLElement>('.scholar-top-profile')?.focus();setVisible(false);}}><X className="h-4 w-4"/></button></div>
  </motion.section>}</AnimatePresence>;
}
