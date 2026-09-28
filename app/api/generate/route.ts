import {NextResponse} from "next/server";
import {put} from "@vercel/blob";
export const runtime="nodejs"; export const maxDuration=60;

export async function POST(req:Request){
 const secret=process.env.ADMIN_SECRET;
 if(!secret||req.headers.get("authorization")!=="Bearer "+secret)return NextResponse.json({error:"Graphic authorization is not configured."},{status:401});
 const body=await req.json(); const headline=String(body.headline||""); const source=String(body.source||""); const category=String(body.category||"World News");
 if(!headline)return NextResponse.json({error:"Headline is required."},{status:400});
 const prompt="Create an original premium Tamil international-news Instagram graphic, 1080x1350 portrait. Editorial newsroom aesthetic, dark charcoal background, warm cream typography, subtle gold accents, strong hierarchy, clean modern layout, no logos of other publishers, no copied source graphics, no flags unless relevant, no fabricated people or facts. Main Tamil headline: "+headline+". Category: "+category+". Source label: "+source+".";
 const response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-image-1",prompt,size:"1024x1536",quality:"high",output_format:"png"})});
 if(!response.ok)return NextResponse.json({error:await response.text()},{status:500});
 const data=await response.json(); const b64=data.data?.[0]?.b64_json;
 if(!b64)return NextResponse.json({error:"No image returned."},{status:500});
 const buffer=Buffer.from(b64,"base64");
 const blob=await put("hijaz/graphics/"+Date.now()+".png",buffer,{access:"public",contentType:"image/png",addRandomSuffix:true});
 return NextResponse.json({ok:true,url:blob.url});
}
