import { expect, test } from "bun:test";
import { arithmetic } from "../src/lib/exam-ready/assessment";

// Original independent reference problems, NOT fabricated live AI transcripts,
// official past-paper questions, or a substitute for all-chapter validation.
const choose = (n: number, r: number) => { let result = 1; for (let i = 1; i <= r; i++) result = result * (n - i + 1) / i; return result; };
test("Laws of Motion: opposing pull, gravity and kinetic friction on an incline", () => {
    // m=10 kg, g=10, sin(theta)=0.6, cos(theta)=0.8, mu=0.2.
    // Block is sliding down; a 40 N pull is parallel UP the slope.
    // N=80 N, friction=16 N up, resultant=60-40-16=4 N down.
    expect(arithmetic("(10*10*0.6-40-0.2*10*10*0.8)/10")).toBeCloseTo(.4, 10);
    expect(arithmetic("2+((10*10*0.6-40-0.2*10*10*0.8)/10)*3")).toBeCloseTo(3.2, 10);
    // Changing direction reverses friction, not gravity or the specified pull.
    expect(arithmetic("(10*10*0.6-40+0.2*10*10*0.8)/10")).toBeCloseTo(3.6, 10);
});
test("Rotational motion: solid disc rolls from rest through 1.2 m of vertical drop", () => {
    // mgh = (1/2)mv² + (1/2)(mR²/2)(v/R)² = (3/4)mv².
    // No slip, negligible rolling losses, g=10: v=4 m/s.
    expect(arithmetic("(4*10*1.2/3)^0.5")).toBeCloseTo(4, 10);
    // Original parametric family independently checked against energy balance.
    for (const height of [.3, .9, 1.7, 2.4]) {
        const v = arithmetic(`(4*9.8*${height}/3)^0.5`);
        expect(.75 * v * v).toBeCloseTo(9.8 * height, 10);
    }
});
test("Chemical equilibrium: reaction exponents must come from stoichiometry", () => {
    // N2 + 3H2 <=> 2NH3; equilibrium concentrations .1, .2, .2 mol/L.
    // Kc = (.2)^2 / ((.1)(.2)^3) = 50 L²/mol².
    expect(arithmetic("0.2^2/(0.1*0.2^3)")).toBeCloseTo(50, 10);
    expect(arithmetic("0.2/(0.1*0.2)")).not.toBe(50);
});
test("Chemical bonding: removal of an antibonding electron increases bond order", () => {
    // Valence MO counts: O2 bonding=8, antibonding=4 -> 2.
    // O2+ loses one pi* electron: (8-3)/2=2.5, one unpaired remains.
    expect(arithmetic("(8-4)/2")).toBe(2);
    expect(arithmetic("(8-3)/2")).toBe(2.5);
});
test("Binomial theorem: coefficient and sign are independently recalculated", () => {
    // Coefficient of x^4 in (2x-1)^8 is C(8,4)*2^4*(-1)^4=1120.
    expect(arithmetic("((8*7*6*5)/(4*3*2*1))*2^4")).toBe(1120);
    for (let n = 5; n <= 11; n++) for (let r = 1; r <= Math.min(n, 5); r++) {
        const expected = choose(n, r) * 2 ** r * (-1) ** (n - r);
        const numerator = Array.from({ length: r }, (_, i) => String(n - i)).join("*");
        const denominator = Array.from({ length: r }, (_, i) => String(i + 1)).join("*");
        expect(arithmetic(`(${numerator})/(${denominator})*2^${r}*(-1)^${n-r}`)).toBeCloseTo(expected, 9);
    }
});
test("Complex numbers: both roots and substitution, not string matching", () => {
    // z²=-8+6i has roots ±(1+3i). Both satisfy the original equation.
    for (const [real, imaginary] of [[1, 3], [-1, -3]]) {
        expect(real * real - imaginary * imaginary).toBe(-8);
        expect(2 * real * imaginary).toBe(6);
    }
});
test("Trigonometry: squaring an equation requires excluding extraneous roots", () => {
    // sin x+cos x=sqrt(3/2), 0<=x<2pi: x=pi/12, 5pi/12 only.
    for (const x of [Math.PI / 12, 5 * Math.PI / 12]) expect(Math.sin(x) + Math.cos(x)).toBeCloseTo(Math.sqrt(1.5), 12);
    for (const x of [13 * Math.PI / 12, 17 * Math.PI / 12]) expect(Math.sin(x) + Math.cos(x)).not.toBeCloseTo(Math.sqrt(1.5), 12);
});
test("Additional supported subject: Grade IX coordinate geometry and domain", () => {
    // A(-2,3), B(4,-5): midpoint(1,-1), distance=10.
    expect(arithmetic("(-2+4)/2")).toBe(1);
    expect(arithmetic("(3-5)/2")).toBe(-1);
    expect(arithmetic("((4-(-2))^2+(-5-3)^2)^0.5")).toBe(10);
});
