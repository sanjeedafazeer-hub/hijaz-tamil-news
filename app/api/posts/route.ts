import {NextResponse} from "next/server";
import {listPosts} from "@/lib/store";
export const runtime="nodejs";
export async function GET(){
 try{return NextResponse.json({ok:true,posts:await listPosts()});}
 catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Storage is not configured"},{status:500});}
}
