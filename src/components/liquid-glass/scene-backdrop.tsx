"use client";
import {createContext, useContext, useEffect, useRef, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {registerGlassSurface} from "./glass-runtime";

export const SceneBackdropContext = createContext<HTMLElement | null | undefined>(undefined);

/** Move the existing route background into the shared scene. Never clone its
 * video, screenshot the application, or copy interactive DOM. */
export function SceneBackdrop({children}:{children:ReactNode}) {
  const host=useContext(SceneBackdropContext);
  return host === undefined ? children : host ? createPortal(children,host) : null;
}

/** A bounded optical zone; the rest of the large sidebar stays translucent.
 * Registration obeys the existing engine/visibility/area/quality budget. */
export function SidebarOptic() {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const node=ref.current;if(node)return registerGlassSurface(node,{elasticity:0,pointer:false,priority:90});},[]);
  return <div ref={ref} className="sg-sidebar-optic" aria-hidden="true"/>;
}
