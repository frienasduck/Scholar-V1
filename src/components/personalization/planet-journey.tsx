"use client";
import { useEffect,useState } from "react";
export const PLANETS=[{id:"profile",title:"Identity",detail:"Your learning profile"},{id:"priorities",title:"Direction",detail:"Your subject priorities"},{id:"materials",title:"Library",detail:"Your imported material"},{id:"lam",title:"Companion",detail:"Your LAM preferences"},{id:"strategy",title:"Rhythm",detail:"Your study strategy"},{id:"dashboard",title:"Arrival",detail:"Your Scholar Today"}];
export function PlanetJourney({active,message,hasMaterials}:{active:string;message:string;hasMaterials:boolean}) {
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{const sync=()=>setHidden(document.hidden);document.addEventListener("visibilitychange",sync);return()=>document.removeEventListener("visibilitychange",sync);},[]);
  const planets=PLANETS.filter(p=>hasMaterials || p.id!=="materials");
  const index=Math.max(0,planets.findIndex(p=>p.id===active));
  return <div className={`your-scholar-journey ${hidden ? "is-paused" : ""}`}>
    <div className={`your-scholar-cosmos planet-${active}`} aria-hidden="true"><div className="your-scholar-orbit orbit-one"/><div className="your-scholar-orbit orbit-two"/><div key={active} className="your-scholar-planet"><div className="your-scholar-planet-light"/><div className="your-scholar-planet-core"/></div>{hasMaterials && active==="materials" ? <div className="your-scholar-orbital-book">▤</div> : null}<span className="your-scholar-star star-one"/><span className="your-scholar-star star-two"/><span className="your-scholar-star star-three"/></div>
    <p className="your-scholar-eyebrow">Building your Scholar · {index+1} of {planets.length}</p>
    <h2>{planets[index].title}</h2><p role="status" aria-live="polite">{message}</p>
    <ol className="your-scholar-planets" aria-label="Personalization progress">{planets.map((planet,i)=><li key={planet.id} aria-current={i===index ? "step" : undefined} data-complete={i<index}><span aria-hidden="true">{i<index ? "✓" : String(i+1).padStart(2,"0")}</span><div>{planet.title}<small>{planet.detail}{i<index ? " · Done" : i===index ? " · Working" : ""}</small></div></li>)}</ol>
  </div>;
}
