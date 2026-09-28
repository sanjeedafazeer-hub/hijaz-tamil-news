import {NextResponse} from "next/server";
import {updatePost} from "@/lib/store";
export const runtime="nodejs";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const secret=process.env.ADMIN_SECRET;
 if(!secret||req.headers.get("authorization")!=="Bearer "+secret)return NextResponse.json({error:"Approval authorization is not configured."},{status:401});
 const {id}=await params; const body=await req.json().catch(()=>({}));
 const action=body.action;
 if(!["approved","rejected"].includes(action))return NextResponse.json({error:"Invalid action"},{status:400});
 const post=await updatePost(id,action);
 return post?NextResponse.json({ok:true,post}):NextResponse.json({error:"Post not found"},{status:404});
}
