import { expect,mock,test } from "bun:test";
mock.module("server-only",()=>({}));
const {normalizeTeachingData}=await import("../src/lib/exam-ready/teacher");
const {stagedLesson}=await import("../src/lib/exam-ready/knowledge/generation");
import {clarifyPhysicsFeedback} from "../src/lib/exam-ready/feedback-safety";
import type {Lesson} from "../src/lib/exam-ready/model";
test("formula object shape repair preserves supplied meanings and rejects unknown fields",()=>{
    const value={formulas:[{formula:"F = ma",symbols:"m is mass in kg",conditions:"constant mass"}]};
    expect(normalizeTeachingData(value)).toEqual({formulas:["F = ma; Symbols: m is mass in kg; Conditions: constant mass"]});
    const unknown={formulas:[{formula:"F = ma",answer:"Invented outside the supported shape"}]};expect(normalizeTeachingData(unknown)).toEqual(unknown);
});
test("a real retained core can be recovered through all validators without another generation",async()=>{
    let calls=0;const text="In an inertial frame, zero resultant force means zero acceleration, not zero velocity. Forces can balance while a body keeps moving uniformly. ".repeat(5)+"[S1]";
    const raw={text,concept:{title:"Balanced forces",explanation:text},formulas:[{formula:"F = 0",symbols:"F is resultant force",conditions:"inertial frame"}]};
    const result=await stagedLesson({saved:{questions:[],rejectedOutput:{stage:"core",data:raw}},teaching:true,needExample:false,normalize:normalizeTeachingData,generate:async()=>{calls++;throw new Error("Unexpected paid transport");},validateCore:core=>{if(!core.text.includes("[S1]"))throw new Error("Source missing");},validate:data=>{const value=data as Pick<Lesson,"text"|"formulas">;return {text:value.text,formulas:value.formulas,questions:[],citations:[],grounding:"source-grounded"};},checkpoint:async()=>{}});
    expect(result.restored).toBe(true);expect(calls).toBe(0);expect(result.lesson?.formulas[0]).toContain("inertial frame");
});
test("physics feedback clarification flags the missing horizontal-force assumption without pretending to be AI",()=>{
    const feedback="Consider a block sliding at constant velocity on a rough surface: gravity, normal and friction sum to zero.";
    expect(clarifyPhysicsFeedback(feedback,"physics","p5")).toContain("not a new AI response");
    expect(clarifyPhysicsFeedback(feedback,"physics","p5")).toContain("horizontal applied force");
    expect(clarifyPhysicsFeedback(feedback+" An applied force balances friction.","physics","p5")).toBe(feedback+" An applied force balances friction.");
    expect(clarifyPhysicsFeedback(feedback,"chemistry","c7")).toBe(feedback);
});
