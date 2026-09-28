import {NextResponse} from "next/server";
import {fetchNewsFeeds,rewriteTamil} from "@/lib/news";
export const runtime="nodejs"; export const maxDuration=60;
export async function POST(req:Request){
 const secret=process.env.INGEST_SECRET;
 if(secret && req.headers.get("authorization")!=="Bearer "+secret)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{const items=(await fetchNewsFeeds()).slice(0,Number(process.env.MAX_ITEMS_PER_RUN||3));const posts=[];for(const item of items){try{posts.push({...item,editorial:await rewriteTamil(item),status:"pending_approval"});}catch(error){posts.push({...item,status:"ai_error",error:error instanceof Error?error.message:"Unknown AI error"});}}return NextResponse.json({ok:true,count:posts.length,posts});}
 catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Unknown error"},{status:500});}}
