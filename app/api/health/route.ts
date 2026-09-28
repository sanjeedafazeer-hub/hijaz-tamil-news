import {NextResponse} from "next";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "hijaz-tamil-news",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    feedsConfigured: Boolean(process.env.NEWS_FEEDS),
    instagramConfigured: Boolean(
      process.env.INSTAGRAM_ACCESS_TOKEN &&
        process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    ),
  });
}
