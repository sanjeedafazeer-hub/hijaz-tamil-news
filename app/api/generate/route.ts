import {NextResponse} from "next/server";
import {put} from "@vercel/blob";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import {Resvg} from "@resvg/resvg-js";
import {updatePost} from "@/lib/store";

export const runtime="nodejs";
export const maxDuration=60;

function escapeXml(value:string){
 return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function wrapText(text:string,maxChars=28){
 const words=text.trim().split(/\s+/);
 const lines:string[]=[]; let line="";
 for(const word of words){
   const candidate=line?line+" "+word:word;
   if(candidate.length>maxChars && line){ lines.push(line); line=word; }
   else line=candidate;
 }
 if(line) lines.push(line);
 return lines.slice(0,5);
}

export async function POST(req:Request){
 const secret=process.env.ADMIN_SECRET;
 if(!secret||req.headers.get("authorization")!=="Bearer "+secret)
   return NextResponse.json({error:"Graphic authorization is not configured."},{status:401});

 const body=await req.json();
 const id=String(body.id||"");
 const headline=String(body.headline||"");
 const source=String(body.source||"");
 const category=String(body.category||"World News");
 if(!id||!headline)return NextResponse.json({error:"Post id and headline are required."},{status:400});

 const lines=wrapText(headline,30);
 const fontBase64=fs.readFileSync(path.join(process.cwd(),"assets","NotoSansTamil-Regular.ttf.base64"),"utf8").trim();
 const fontPath="/tmp/NotoSansTamil-Regular.ttf";
 if(!fs.existsSync(fontPath)) fs.writeFileSync(fontPath,Buffer.from(fontBase64,"base64"));
 const lineHeight=76;
 const headlineStart=540;
 const headlineSvg=lines.map((line,i)=>`<text x="90" y="${headlineStart+i*lineHeight}" class="headline">${escapeXml(line)}</text>`).join("");
 const sourceText=escapeXml(source||"International");
 const categoryText=escapeXml(category||"World News");

 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
 <style>@font-face{font-family:"NishadhTamil";src:url(data:font/ttf;base64,${tamilFontBase64}) format("truetype");font-weight:100 900;font-style:normal}.tamil{font-family:"NishadhTamil",sans-serif}</style>
 <defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#111317"/><stop offset="1" stop-color="#262A31"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
   <stop offset="0" stop-color="#C7A15A"/><stop offset="1" stop-color="#F1D28A"/>
  </linearGradient>
 </defs>
 <rect width="1080" height="1350" fill="url(#bg)"/>
 <circle cx="930" cy="150" r="260" fill="#C7A15A" opacity=".07"/>
 <circle cx="80" cy="1230" r="330" fill="#FFFFFF" opacity=".025"/>
 <rect x="70" y="74" width="940" height="5" rx="2.5" fill="url(#gold)"/>
 <text x="90" y="150" fill="#F1D28A" font-family="NishadhTamil, sans-serif" font-size="34" font-weight="700">NISHADH NEWS</text>
 <text x="90" y="205" fill="#AEB4BF" font-family="Noto Sans Tamil, Noto Sans, sans-serif" font-size="24">${categoryText}</text>
 <line x1="90" y1="250" x2="990" y2="250" stroke="#FFFFFF" stroke-opacity=".12"/>
 ${headlineSvg}
 <rect x="90" y="1060" width="900" height="2" fill="#C7A15A" opacity=".65"/>
 <text x="90" y="1120" fill="#F5F1E8" font-family="Noto Sans Tamil, Noto Sans, sans-serif" font-size="25" font-weight="600">Source: ${sourceText}</text>
 <text x="90" y="1245" fill="#8F96A3" font-family="Noto Sans Tamil, Noto Sans, sans-serif" font-size="21">International news • Natural Tamil • Editorial review</text>
 </svg>`;

 const renderedPng=new Resvg(svg,{font:{fontFiles:[fontPath],loadSystemFonts:true,sansSerifFamily:"Noto Sans Tamil"}}).render().asPng();
 const jpeg=await sharp(renderedPng).jpeg({quality:92}).toBuffer();
 const blob=await put("hijaz/graphics/"+Date.now()+".jpg",jpeg,{access:"public",contentType:"image/jpeg",addRandomSuffix:true});
 await updatePost(id,"approved",{imageUrl:blob.url});
 return NextResponse.json({ok:true,url:blob.url});
}
