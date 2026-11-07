"use client";
import {useEffect, type RefObject} from "react";
import type {NavigationLensControl} from "./velocity-motion";

/** Press-follow inside a row, never a vertical drag-to-navigate. Vertical
 * movement immediately yields to native drawer scrolling; no capture. */
export function useSidebarTouch(root: RefObject<HTMLElement | null>, control: RefObject<NavigationLensControl | null>, active: string, enabled: boolean) {
  useEffect(() => {
    const node = root.current;
    if (!node || !enabled) return;
    let touch: {id:number;x:number;y:number;box:{x:number;y:number;width:number;height:number}} | undefined, frame = 0;
    const reset = () => { if (!touch) return; touch=undefined; cancelAnimationFrame(frame); frame=0; delete node.dataset.sgTouch; control.current?.settle(); };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !e.isPrimary || !(e.target instanceof Element)) return;
      const button=e.target.closest<HTMLElement>('[data-velocity-control="navigation"]');
      if (!button || !node.contains(button)) return;
      const a=node.getBoundingClientRect(),b=button.getBoundingClientRect();
      touch={id:e.pointerId,x:e.clientX,y:e.clientY,box:{x:b.left-a.left+node.scrollLeft,y:b.top-a.top+node.scrollTop,width:b.width,height:b.height}};
      node.dataset.sgTouch="true"; control.current?.track(touch.box);
    };
    const move = (e: PointerEvent) => {
      const t=touch; if (!t || t.id!==e.pointerId) return;
      if (Math.abs(e.clientY-t.y)>=7) { reset(); return; }
      const dx=Math.max(-3,Math.min(3,(e.clientX-t.x)*.12));
      cancelAnimationFrame(frame); frame=requestAnimationFrame(()=>{frame=0;if(touch===t)control.current?.track({...t.box,x:t.box.x+dx});});
    };
    node.addEventListener("pointerdown",down,{passive:true});node.addEventListener("pointermove",move,{passive:true});node.addEventListener("pointerup",reset);node.addEventListener("pointercancel",reset);
    window.addEventListener("resize",reset);window.addEventListener("blur",reset);window.addEventListener("scroll",reset,true);document.addEventListener("visibilitychange",reset);
    return()=>{reset();node.removeEventListener("pointerdown",down);node.removeEventListener("pointermove",move);node.removeEventListener("pointerup",reset);node.removeEventListener("pointercancel",reset);window.removeEventListener("resize",reset);window.removeEventListener("blur",reset);window.removeEventListener("scroll",reset,true);document.removeEventListener("visibilitychange",reset);};
  },[root,control,active,enabled]);
}
