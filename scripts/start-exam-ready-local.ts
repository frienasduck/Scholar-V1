import {spawn} from "node:child_process";
// This opt-in entrypoint always binds a literal loopback interface. A copied
// .env flag alone cannot enable the capability in a generic public dev server.
if(["VERCEL","VERCEL_ENV","VERCEL_URL","DEPLOYMENT_URL","CI"].some(key=>!!process.env[key]))throw new Error("Exam Ready Guest AI refuses deployment/CI environments.");
const child=spawn(process.execPath,["run","node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3002"],{stdio:"inherit",windowsHide:true,env:{...process.env,SCHOLAR_DEV_GUEST_AI_LOCAL_SERVER:"1"}});
child.on("exit",code=>{process.exitCode=code??1;});
process.on("SIGINT",()=>child.kill("SIGINT"));
process.on("SIGTERM",()=>child.kill("SIGTERM"));
