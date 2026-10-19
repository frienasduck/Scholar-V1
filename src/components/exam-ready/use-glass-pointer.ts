"use client";
import { useEffect, useRef, type PointerEvent } from "react";
/** Local specular lighting only. No React rerender or global animation loop. */
export function useGlassPointer(){
    const frame=useRef<number|null>(null), point=useRef<{node:HTMLElement;x:number;y:number}|null>(null), enabled=useRef(false);
    useEffect(()=>{const media=matchMedia("(prefers-reduced-motion: reduce)");const update=()=>{enabled.current=!media.matches;};update();media.addEventListener("change",update);return()=>{media.removeEventListener("change",update);if(frame.current!==null)cancelAnimationFrame(frame.current);};},[]);
    return (event:PointerEvent<HTMLElement>)=>{if(!enabled.current||event.pointerType!=="mouse")return;const node=(event.target as HTMLElement).closest<HTMLElement>("button");if(!node||!event.currentTarget.contains(node))return;point.current={node,x:event.clientX,y:event.clientY};if(frame.current!==null)return;frame.current=requestAnimationFrame(()=>{frame.current=null;const p=point.current;if(!p?.node.isConnected)return;const box=p.node.getBoundingClientRect();p.node.style.setProperty("--er-pointer-x",`${p.x-box.left}px`);p.node.style.setProperty("--er-pointer-y",`${p.y-box.top}px`);});};
}
