import Parser from "rss-parser";

export type NewsItem={source:string;title:string;link:string;publishedAt:string;summary:string;guid:string};
const parser=new Parser();
const configured=process.env.NEWS_FEEDS?JSON.parse(process.env.NEWS_FEEDS):[];

export async function fetchNewsFeeds():Promise<NewsItem[]>{
 const results:NewsItem[]=[];
 for(const feed of configured){
  if(!feed?.url) continue;
  try{
   const data=await parser.parseURL(feed.url);
   for(const item of (data.items||[]).slice(0,10)){
    const link=item.link||""; if(!link) continue;
    results.push({source:feed.name||data.title||"News source",title:(item.title||"").trim(),link,publishedAt:item.isoDate||item.pubDate||new Date().toISOString(),summary:(item.contentSnippet||item.content||item.summary||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,500),guid:item.guid||link});
   }
  }catch(error){console.error("Feed error",feed?.name,error)}
 }
 return results.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}

export async function rewriteTamil(item:NewsItem){
 const apiKey=process.env.OPENAI_API_KEY; if(!apiKey) throw new Error("OPENAI_API_KEY is not configured");
 const model=process.env.OPENAI_MODEL||"gpt-5.6-luna";
 const prompt="You are the Tamil editor for an international news Instagram page.\nCreate an original Tamil social-media news post from the supplied source metadata.\nUnderstand the story before writing. Do not translate word-for-word. Use natural, modern Tamil.\nDo not invent facts, quotes, numbers, dates, locations or motives. Preserve names and proper nouns accurately.\nClearly attribute allegations or claims. Do not add political persuasion, praise, criticism or predictions.\nDo not copy the source article wording. Keep the output concise and mobile-friendly.\nReturn ONLY JSON with: headline_tamil, caption_tamil, category, key_facts (array of 3 short Tamil facts), source.\n\nSOURCE: "+item.source+"\nHEADLINE: "+item.title+"\nSUMMARY: "+item.summary+"\nURL: "+item.link;
 const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},body:JSON.stringify({model,input:prompt})});
 if(!response.ok) throw new Error("OpenAI error "+response.status+": "+await response.text());
 const json=await response.json();
 const raw=json.output_text||"";
 return JSON.parse(raw.replace(/^\s*```json\s*/,"").replace(/\s*```\s*$/,""));
}
