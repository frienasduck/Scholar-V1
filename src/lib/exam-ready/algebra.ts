/** Bounded one-variable polynomials only. No eval, sampling, rational cancellation
 * or domain guesses. Unsupported expressions delegate to rubric review. */
export function polynomial(input:string,variable="x"):number[] {
  if(!/^[a-z]$/.test(variable)||input.length>300||/\d\s+\d/.test(input))throw new Error("Unsupported polynomial");
  const text=input.trim().replace(/^\$+|\$+$/g,"").replace(/²/g,"^2").replace(/³/g,"^3").replace(/−/g,"-").replace(/\s+/g,"");
  const tokens=text.match(/(?:\d+(?:\.\d*)?|\.\d+)|[a-z+*/^()-]/g)??[];
  if(tokens.join("")!==text||tokens.length>100||tokens.some(t=>/^[a-z]$/.test(t)&&t!==variable))throw new Error("Unsupported polynomial");
  const normalized:string[]=[];
  for(const token of tokens){const last=normalized.at(-1);if(last&&(/^(?:\d|\.)/.test(last)||last===variable||last===")")&&(token===variable||token==="("||/^(?:\d|\.)/.test(token)&&last===")"))normalized.push("*");normalized.push(token);}
  let index=0,depth=0;
  const trim=(p:number[])=>{while(p.length>1&&Math.abs(p.at(-1)!)<1e-12)p.pop();if(p.length>9||p.some(n=>!Number.isFinite(n)||Math.abs(n)>1e12))throw new Error("Polynomial bound exceeded");return p;};
  const add=(a:number[],b:number[],sign=1)=>trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]??0)+sign*(b[i]??0)));
  const multiply=(a:number[],b:number[])=>{if(a.length+b.length>10)throw new Error("Polynomial degree exceeds eight");const p=Array(a.length+b.length-1).fill(0);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)p[i+j]+=a[i]*b[j];return trim(p);};
  const primary=():number[]=>{if(++depth>12)throw new Error("Polynomial nesting exceeded");let p:number[];const token=normalized[index++];if(token==="("){p=sum();if(normalized[index++]!==")")throw new Error("Unbalanced polynomial");}else if(token===variable)p=[0,1];else if(token&&/^(?:\d|\.)/.test(token))p=[Number(token)];else throw new Error("Missing polynomial term");depth--;return p;};
  const power=():number[]=>{let p=primary();if(normalized[index]==="^"){index++;const n=Number(normalized[index++]);if(!Number.isInteger(n)||n<0||n>8)throw new Error("Unsupported polynomial power");const base=p;p=[1];for(let i=0;i<n;i++)p=multiply(p,base);}return p;};
  const unary=():number[]=>normalized[index]==="+"?(index++,unary()):normalized[index]==="-"?(index++,unary().map(n=>-n)):power();
  const product=():number[]=>{let p=unary();while(["*","/"].includes(normalized[index])){const op=normalized[index++],b=unary();if(op==="/"){if(b.length!==1||!b[0])throw new Error("Variable denominators need domain review");p=trim(p.map(n=>n/b[0]));}else p=multiply(p,b);}return p;};
  const sum=():number[]=>{let p=product();while(["+","-"].includes(normalized[index])){const op=normalized[index++];p=add(p,product(),op==="+"?1:-1);}return p;};
  const result=sum();if(index!==normalized.length)throw new Error("Unexpected polynomial input");return result;
}
export function equivalentPolynomials(expected:string,response:string,variable="x"):boolean|null {
  try {const a=polynomial(expected,variable),b=polynomial(response,variable);return Array.from({length:Math.max(a.length,b.length)},(_,i)=>Math.abs((a[i]??0)-(b[i]??0))<=1e-9*Math.max(1,Math.abs(a[i]??0))).every(Boolean);}catch{return null;}
}
