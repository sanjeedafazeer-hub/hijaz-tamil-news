export type NewsItem={source:string;title:string;link:string;publishedAt:string;summary:string;guid:string};

type FeedConfig={name?:string;url?:string};

function decodeXml(value:string){
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

function stripHtml(value:string){
  return decodeXml(value).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

function tagValue(xml:string,tag:string){
  const match=xml.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+tag+">","i"));
  return match?.[1] ? decodeXml(match[1]).trim() : "";
}

function itemBlocks(xml:string){
  const rss=[...xml.matchAll(/<item(?:\\s[^>]*)?>([\\s\\S]*?)<\\/item>/gi)].map(m=>m[1]);
  if(rss.length) return rss;
  return [...xml.matchAll(/<entry(?:\\s[^>]*)?>([\\s\\S]*?)<\\/entry>/gi)].map(m=>m[1]);
}

function itemLink(block:string){
  const direct=tagValue(block,"link");
  if(direct) return stripHtml(direct);
  const href=block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return href?.[1]||"";
}

function readFeedXml(xml:string,feed:FeedConfig):NewsItem[]{
  return itemBlocks(xml).slice(0,10).map(block=>{
    const link=itemLink(block);
    const title=stripHtml(tagValue(block,"title"));
    const published=tagValue(block,"isoDate")||tagValue(block,"pubDate")||tagValue(block,"published")||tagValue(block,"updated")||new Date().toISOString();
    const summary=stripHtml(tagValue(block,"description")||tagValue(block,"summary")||tagValue(block,"content"));
    const guid=stripHtml(tagValue(block,"guid")||tagValue(block,"id")||link);
    return {source:feed.name||"News source",title,link,publishedAt:published,summary:summary.slice(0,500),guid};
  }).filter(item=>item.link&&item.title);
}

function getConfiguredFeeds():FeedConfig[]{
  if(!process.env.NEWS_FEEDS) return [];
  try{
    const parsed=JSON.parse(process.env.NEWS_FEEDS);
    return Array.isArray(parsed)?parsed:[];
  }catch(error){
    console.error("Invalid NEWS_FEEDS JSON",error);
    return [];
  }
}

export async function fetchNewsFeeds():Promise<NewsItem[]>{
  const results:NewsItem[]=[];
  for(const feed of getConfiguredFeeds()){
    if(!feed?.url) continue;
    try{
      const response=await fetch(feed.url,{headers:{"User-Agent":"HijazTamilNews/1.0 (+https://hijaz-tamil-news.vercel.app)"},cache:"no-store"});
      if(!response.ok) throw new Error("HTTP "+response.status);
      const xml=await response.text();
      results.push(...readFeedXml(xml,feed));
    }catch(error){
      console.error("Feed error",feed?.name,error);
    }
  }
  return results.sort((a,b)=>{
    const bt=Date.parse(b.publishedAt),at=Date.parse(a.publishedAt);
    return (Number.isFinite(bt)?bt:0)-(Number.isFinite(at)?at:0);
  });
}

export async function rewriteTamil(item:NewsItem){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model=process.env.OPENAI_MODEL||"gpt-5.6-luna";
  const prompt=`You are the Tamil editor for an international news Instagram page.
Create an original Tamil social-media news post from the supplied source metadata.
Understand the story before writing. Do not translate word-for-word. Use natural, modern Tamil.
Do not invent facts, quotes, numbers, dates, locations or motives. Preserve names and proper nouns accurately.
Clearly attribute allegations or claims. Do not add political persuasion, praise, criticism or predictions.
Do not copy the source article wording. Keep the output concise and mobile-friendly.
Return ONLY JSON with: headline_tamil, caption_tamil, category, key_facts (array of 3 short Tamil facts), source.

SOURCE: ${item.source}
HEADLINE: ${item.title}
SUMMARY: ${item.summary}
URL: ${item.link}`;

  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
    body:JSON.stringify({model,input:prompt})
  });
  if(!response.ok) throw new Error("OpenAI error "+response.status+": "+await response.text());
  const json=await response.json() as {output_text?:string};
  const raw=json.output_text||"";
  if(!raw) throw new Error("OpenAI returned no output");
  return JSON.parse(raw.replace(/^\s*```json\s*/,"").replace(/\s*```\s*$/,""));
}
