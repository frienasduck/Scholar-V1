import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const root='test-artifacts/liquid-velocity-3-1',dir=root+'/browser';mkdirSync(root+'/recordings',{recursive:true});
const data=JSON.parse(readFileSync(dir+'/results.json','utf8'));
const videos=[];
for(const c of data.cases.filter(x=>/^0[1-9]-/.test(x.name))){
 const input=`${dir}/${c.name}.webm`,output=`${root}/recordings/${c.name}.mp4`;
 if(!process.argv.slice(2).length||process.argv.slice(2).includes(c.name))execFileSync('ffmpeg',['-y','-loglevel','error','-i',input,'-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart','-an',output],{windowsHide:true});
 const stream=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',output],{encoding:'utf8',windowsHide:true}));
 videos.push({name:c.name,passed:c.passed,file:output,duration:Number(stream.format.duration),width:stream.streams[0].width,height:stream.streams[0].height});
}
const a=await sharp(dir+'/optical-equal-blur-on.png').extract({left:0,top:0,width:256,height:540}).raw().toBuffer(),b=await sharp(dir+'/optical-equal-blur-no-svg.png').extract({left:0,top:0,width:256,height:540}).raw().toBuffer();
let sum=0,over8=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);sum+=d;if(d>8)over8++;}
const evidence={videos,opticalComparison:{description:'Same real scene stripe target and blur(3px)/saturate(125%); only SVG URL removed in second image. No mock screenshot or cloned application.',meanAbsoluteChannelDelta:sum/a.length,fractionChannelsDeltaOver8:over8/a.length},measured:new Date().toISOString()};
writeFileSync(root+'/evidence-index.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
