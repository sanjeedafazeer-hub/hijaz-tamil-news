import {NextResponse} from "next/server";
import {put} from "@vercel/blob";
import sharp from "sharp";
import {Resvg} from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import {updatePost} from "@/lib/store";

export const runtime="nodejs";
export const maxDuration=120;

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

 const openaiKey=process.env.OPENAI_API_KEY;
 if(!openaiKey) return NextResponse.json({error:"OPENAI_API_KEY is not configured."},{status:500});

 const visualPrompt=`Create a premium editorial news photograph/illustration for an international Tamil news Instagram page.
Story headline: ${headline}
Category: ${category}

Create a visually striking, realistic editorial scene that communicates the subject of the story.
Use cinematic documentary photography, natural lighting, realistic materials, strong composition, and subtle depth.
Vertical social-media composition with important visual content concentrated in the center and lower-middle area.
Leave the upper third relatively clean/dark so a headline can be overlaid later.
Do NOT generate any words, letters, logos, captions, watermarks, UI, borders, or typography.
Do not invent recognizable real people. If people are necessary, use generic non-identifiable subjects.
This is an AI-generated editorial illustration, not a claim that the image is a real photograph.`;

 const imageResponse=await fetch("https://api.openai.com/v1/images/generations",{
  method:"POST",
  headers:{"Content-Type":"application/json","Authorization":"Bearer "+openaiKey},
  body:JSON.stringify({
   model:process.env.OPENAI_IMAGE_MODEL||"gpt-image-2",
   prompt:visualPrompt,
   size:"1024x1536",
   quality:process.env.OPENAI_IMAGE_QUALITY||"medium",
   output_format:"jpeg",
   output_compression:88
  })
 });
 if(!imageResponse.ok){
  const errorText=await imageResponse.text();
  console.error("OpenAI image generation error",errorText);
  return NextResponse.json({error:"AI image generation failed.",details:errorText.slice(0,1000)},{status:502});
 }
 const imageJson=await imageResponse.json();
 const b64=imageJson?.data?.[0]?.b64_json;
 if(!b64) return NextResponse.json({error:"OpenAI returned no image data."},{status:502});

 const aiImage=Buffer.from(b64,"base64");
 const sourceText=escapeXml(source||"International");
 const categoryText=escapeXml(category||"World News");
 const headlineSvg=lines.map((line,i)=>`<text x="90" y="${570+i*76}" class="headline">${escapeXml(line)}</text>`).join("");

 const overlaySvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
 <defs>
  <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#07090D" stop-opacity=".94"/>
   <stop offset=".72" stop-color="#07090D" stop-opacity=".30"/>
   <stop offset="1" stop-color="#07090D" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#07090D" stop-opacity="0"/>
   <stop offset="1" stop-color="#07090D" stop-opacity=".92"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
   <stop offset="0" stop-color="#C7A15A"/><stop offset="1" stop-color="#F1D28A"/>
  </linearGradient>
  <style>.headline{font-family:"Noto Sans Tamil",sans-serif;font-size:58px;font-weight:700;fill:#FFFFFF}</style>
 </defs>
 <rect width="1080" height="1350" fill="url(#top)"/>
 <rect width="1080" height="1350" fill="url(#bottom)"/>
 <rect x="70" y="62" width="940" height="5" rx="2.5" fill="url(#gold)"/>
 <text x="90" y="135" fill="#F1D28A" font-family="Noto Sans Tamil, sans-serif" font-size="34" font-weight="700">NISHADH NEWS</text>
 <text x="90" y="185" fill="#F1F1F1" font-family="Noto Sans Tamil, sans-serif" font-size="23">${categoryText}</text>
 <line x1="90" y1="225" x2="990" y2="225" stroke="#FFFFFF" stroke-opacity=".25"/>
 ${headlineSvg}
 <rect x="90" y="1035" width="900" height="2" fill="#E0B968" opacity=".85"/>
 <text x="90" y="1095" fill="#FFFFFF" font-family="Noto Sans Tamil, sans-serif" font-size="25" font-weight="600">Source: ${sourceText}</text>
 <text x="90" y="1190" fill="#FFFFFF" opacity=".82" font-family="Noto Sans Tamil, sans-serif" font-size="21">AI editorial visual • Natural Tamil</text>
 </svg>`;

 const overlayPng=Buffer.from(new Resvg(overlaySvg,{fitTo:{mode:"original"},font:{fontFiles:[fontPath],loadSystemFonts:false,defaultFontFamily:"Noto Sans Tamil"}}).render().asPng());

 const rendered=await sharp(aiImage)
  .resize(1080,1350,{fit:"cover",position:"center"})
  .composite([{input:overlayPng,top:0,left:0}])
  .jpeg({quality:92})
  .toBuffer();

 const blob=await put("hijaz/graphics/"+Date.now()+".jpg",rendered,{access:"public",contentType:"image/jpeg",addRandomSuffix:true});
 await updatePost(id,"approved",{imageUrl:blob.url});
 return NextResponse.json({ok:true,url:blob.url});
}
