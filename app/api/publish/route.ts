import {NextResponse} from "next/server";
import {updatePost} from "@/lib/store";
export const runtime="nodejs"; export const maxDuration=60;

export async function POST(req:Request){
 const secret=process.env.ADMIN_SECRET;
 if(!secret||req.headers.get("authorization")!=="Bearer "+secret)return NextResponse.json({error:"Publishing authorization is not configured."},{status:401});
 const {id,caption,imageUrl}=await req.json();
 if(!id||!caption||!imageUrl)return NextResponse.json({error:"id, caption and imageUrl are required."},{status:400});
 const token=process.env.INSTAGRAM_ACCESS_TOKEN; const account=process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
 if(!token||!account)return NextResponse.json({error:"Instagram credentials are not configured yet."},{status:400});
 const createUrl="https://graph.facebook.com/v24.0/"+account+"/media";
 const create=await fetch(createUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image_url:imageUrl,caption,access_token:token})});
 const created=await create.json();
 if(!create.ok||!created.id)return NextResponse.json({error:created.error?.message||"Instagram media creation failed.",details:created},{status:500});
 const publish=await fetch("https://graph.facebook.com/v24.0/"+account+"/media_publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creation_id:created.id,access_token:token})});
 const published=await publish.json();
 if(!publish.ok||!published.id)return NextResponse.json({error:published.error?.message||"Instagram publish failed.",details:published},{status:500});
 const post=await updatePost(id,"published",{imageUrl});
 return NextResponse.json({ok:true,instagramMediaId:published.id,post});
}
