import {NextResponse} from "next/server";
import {fetchNewsFeeds,rewriteTamil} from "@/lib/news";
import {upsertPost} from "@/lib/store";
export const runtime="nodejs"; export const maxDuration=60;

export async function POST(req:Request){
 const ingestSecret=process.env.INGEST_SECRET;
 const adminSecret=process.env.ADMIN_SECRET;
 const auth=req.headers.get("authorization");
 const authorized=!ingestSecret && !adminSecret
   ? true
   : auth==="Bearer "+ingestSecret || auth==="Bearer "+adminSecret;
 if(!authorized)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const items=(await fetchNewsFeeds()).slice(0,Number(process.env.MAX_ITEMS_PER_RUN||3));
  console.info("Ingest selected items",items.length);
  const posts=[];
  for(const item of items){
   try{
    console.info("AI rewrite starting",item.source,item.title);
    const editorial=await rewriteTamil(item);
    console.info("AI rewrite completed",item.source);
    const existingId=Buffer.from(item.guid||item.link).toString("base64url").slice(0,80);
    const post=await upsertPost({...item,id:existingId,editorial,status:"pending_approval",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    console.info("Post stored",post.id);
    posts.push(post);
   }catch(error){
    console.error("Ingest item error",item.source,item.title,error);
    posts.push({...item,status:"ai_error",error:error instanceof Error?error.message:"Unknown AI error"});
   }
  }
  console.info("Ingest completed",posts.length);
  return NextResponse.json({ok:true,count:posts.length,posts});
 }catch(error){
  console.error("Ingest fatal error",error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Unknown error"},{status:500});
 }
}