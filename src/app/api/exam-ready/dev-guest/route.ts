import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { AIProviderError } from "@/lib/ai/errors";
import { DEV_GUEST_COOKIE, LocalGuestError, localGuestOperation, localGuestStatus, newLocalCapability } from "@/lib/exam-ready/dev-guest";
import { DEV_GUEST_LIMITS, localGuestRequest } from "@/lib/exam-ready/dev-guest-policy";
export const runtime="nodejs";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store, private","Vary":"Cookie","X-Content-Type-Options":"nosniff"}});
export async function GET(request:NextRequest) {
    if(!localGuestRequest(request))return reply({enabled:false},200);
    const token=request.cookies.get(DEV_GUEST_COOKIE)?.value??newLocalCapability();
    try {
        const response=reply(await localGuestStatus(token));
        response.cookies.set(DEV_GUEST_COOKIE,token,{httpOnly:true,sameSite:"strict",path:"/api/exam-ready/dev-guest",maxAge:86400});return response;
    }catch {return reply({enabled:false,message:"Local development workspace could not open safely."},503);}
}
export async function POST(request:NextRequest) {
    if(!localGuestRequest(request))return reply({message:"Development Guest AI is unavailable on this host."},403);
    const token=request.cookies.get(DEV_GUEST_COOKIE)?.value;
    if(!token)return reply({message:"Open the local workspace first."},401);
    try {return reply(await localGuestOperation(token,await readBoundedJson(request,DEV_GUEST_LIMITS.bodyBytes),request.signal));}
    catch(error){
        if(error instanceof LocalGuestError || error instanceof AIProviderError)return reply({message:error.message,...(error instanceof AIProviderError?{code:error.code}:{})},error.status);
        if(error instanceof ZodError)return reply({message:"The local input or AI response failed validation. Your previous work is preserved."},422);
        if(error instanceof RequestBodyError)return reply({message:error.message},error.status);
        return reply({message:"The local teaching turn could not finish safely. Your previous lesson and notes are preserved; retry explicitly."},503);
    }
}
