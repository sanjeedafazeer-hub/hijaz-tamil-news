import {NextResponse} from "next/server";
export async function GET(){
 return NextResponse.json({
  ok:true,
  service:"hijaz-tamil-news",
  openaiConfigured:Boolean(process.env.OPENAI_API_KEY),
  feedsConfigured:Boolean(process.env.NEWS_FEEDS),
  instagramConfigured:Boolean(process.env.INSTAGRAM_ACCESS_TOKEN&&process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
  blobTokenConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  oidcConfigured:Boolean(process.env.VERCEL_OIDC_TOKEN),
  blobStoreIdConfigured:Boolean(process.env.BLOB_STORE_ID||process.env.VERCEL_BLOB_STORE_ID)
 });
}
