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
  const pattern="<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+tag+">";
  const match=xml.match(new RegExp(pattern,"i"));
  return match?.[1] ? decodeXml(match[1]).trim() : "";
}

function itemBlocks(xml:string){
  const rssPattern="<item(?:\\s[^>]*)?>([\\s\\S]*?)</item>";
  const atomPattern="<entry(?:\\s[^>]*)?>([\\s\\S]*?)</entry>";
  const rss=[...xml.matchAll(new RegExp(rssPattern,"gi"))].map(m=>m[1]);
  if(rss.length) return rss;
  return [...xml.matchAll(new RegExp(atomPattern,"gi"))].map(m=>m[1]);
}

function itemLink(block:string){
  const direct=tagValue(block,"link");
  if(direct) return stripHtml(direct);
  const match=block.match(new RegExp("<link[^>]+href=[\\\"']([^\\\"']+)[\\\"'][^>]*>","i"));
  return match?.[1]||"";
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

function normalizeFeed(feed:FeedConfig):FeedConfig{
  const url=feed.url||"";
  // Reuters retired the old feeds.reuters.com public RSS service. Use a Google News
  // RSS search constrained to Reuters until an authenticated Reuters feed is configured.
  if(url.includes("feeds.reuters.com/reuters/worldNews")||url.includes("feeds.reuters.com/Reuters/worldNews")){
    return {
      ...feed,
      url:"https://news.google.com/rss/search?q=when:24h+site:reuters.com/world&ceid=US:en&hl=en-US&gl=US"
    };
  }
  if(url.startsWith("http://rss.cnn.com/")) return {...feed,url:url.replace("http://","https://")};
  return feed;
}

export async function fetchNewsFeeds():Promise<NewsItem[]>{
  const results:NewsItem[]=[];
  for(const originalFeed of getConfiguredFeeds()){
    const feed=normalizeFeed(originalFeed);
    if(!feed?.url) continue;
    try{
      const response=await fetch(feed.url,{
        headers:{"User-Agent":"Mozilla/5.0 (compatible; HijazTamilNews/1.0)","Accept":"application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"},
        cache:"no-store"
      });
      if(!response.ok) throw new Error("HTTP "+response.status);
      const items=readFeedXml(await response.text(),feed);
      console.info("Feed loaded",feed.name,items.length);
      results.push(...items);
    }catch(error){
      console.error("Feed error",feed?.name,error);
    }
  }
  console.info("Total feed items",results.length);
  return results.sort((a,b)=>{
    const bt=Date.parse(b.publishedAt),at=Date.parse(a.publishedAt);
    return (Number.isFinite(bt)?bt:0)-(Number.isFinite(at)?at:0);
  });
}

function extractResponseText(json:any):string{
  if(typeof json?.output_text==="string"&&json.output_text.trim()) return json.output_text.trim();
  const parts:Array<string>=[];
  for(const item of Array.isArray(json?.output)?json.output:[]){
    for(const part of Array.isArray(item?.content)?item.content:[]){
      if(typeof part?.text==="string") parts.push(part.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJson(raw:string){
  const cleaned=raw
    .replace(/^\s*\x60\x60\x60(?:json)?\s*/i,"")
    .replace(/\s*\x60\x60\x60\s*$/,"")
    .trim();
  try{return JSON.parse(cleaned);}
  catch{
    const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
    if(start>=0&&end>start) return JSON.parse(cleaned.slice(start,end+1));
    throw new Error("AI returned invalid JSON");
  }
}

const tamilEditorialPrompt=(item:NewsItem)=>`You are the Tamil editor for an international news Instagram page.
Create an original Tamil social-media news post from the supplied source metadata.
Understand the story before writing. Do not translate word-for-word. Use natural, modern Tamil.
Do not invent facts, quotes, numbers, dates, locations or motives. Preserve names and proper nouns accurately.
Clearly attribute allegations or claims. Do not add political persuasion, praise, criticism or predictions.
Do not copy the source article wording. Keep the output concise and mobile-friendly.
Return ONLY valid JSON with: headline_tamil, caption_tamil, category, key_facts (array of 3 short Tamil facts), source.

SOURCE: ${item.source}
HEADLINE: ${item.title}
SUMMARY: ${item.summary}
URL: ${item.link}`;

import { createHash, createHmac } from "node:crypto";

function sha256Hex(value:string){
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key:string|Buffer,value:string){
  return createHmac("sha256",key).update(value).digest();
}

function awsSigV4Headers(region:string,model:string,body:string,accessKeyId:string,secretAccessKey:string){
  const service="bedrock";
  const host="bedrock-runtime."+region+".amazonaws.com";
  const now=new Date();
  const amzDate=now.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const dateStamp=amzDate.slice(0,8);
  const canonicalUri="/model/"+encodeURIComponent(model)+"/converse";
  const payloadHash=sha256Hex(body);
  const canonicalHeaders="content-type:application/json\nhost:"+host+"\nx-amz-date:"+amzDate+"\n";
  const signedHeaders="content-type;host;x-amz-date";
  const canonicalRequest=["POST",canonicalUri,"",canonicalHeaders,signedHeaders,payloadHash].join("\n");
  const credentialScope=dateStamp+"/"+region+"/"+service+"/aws4_request";
  const stringToSign=["AWS4-HMAC-SHA256",amzDate,credentialScope,sha256Hex(canonicalRequest)].join("\n");
  const kDate=hmac("AWS4"+secretAccessKey,dateStamp);
  const kRegion=hmac(kDate,region);
  const kService=hmac(kRegion,service);
  const kSigning=hmac(kService,"aws4_request");
  const signature=createHmac("sha256",kSigning).update(stringToSign).digest("hex");
  return {
    host,
    "Content-Type":"application/json",
    "X-Amz-Date":amzDate,
    Authorization:"AWS4-HMAC-SHA256 Credential="+accessKeyId+"/"+credentialScope+", SignedHeaders="+signedHeaders+", Signature="+signature
  };
}

async function rewriteWithBedrock(item:NewsItem){
  const accessKeyId=process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey=process.env.AWS_SECRET_ACCESS_KEY;
  if(!accessKeyId||!secretAccessKey) throw new Error("AWS access key credentials are not configured");
  const region=process.env.AWS_BEDROCK_REGION||"us-east-1";
  const model=process.env.AWS_BEDROCK_MODEL||"amazon.nova-micro-v1:0";
  const body=JSON.stringify({
    messages:[{role:"user",content:[{text:tamilEditorialPrompt(item)}]}],
    inferenceConfig:{maxTokens:900,temperature:0.2}
  });
  const headers=awsSigV4Headers(region,model,body,accessKeyId,secretAccessKey);
  const response=await fetch("https://"+headers.host+"/model/"+encodeURIComponent(model)+"/converse",{
    method:"POST",
    headers,
    body
  });
  if(!response.ok) throw new Error("AWS Bedrock error "+response.status+": "+await response.text());
  const json=await response.json();
  const raw=Array.isArray(json?.output?.message?.content)
    ? json.output.message.content.map((part:any)=>typeof part?.text==="string"?part.text:"").join("\n").trim()
    : "";
  if(!raw) throw new Error("AWS Bedrock returned no output");
  return parseJson(raw);
}
async function rewriteWithOpenAI(item:NewsItem){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model=process.env.OPENAI_MODEL||"gpt-5.6-luna";
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
    body:JSON.stringify({
      model,
      input:tamilEditorialPrompt(item),
      text:{format:{type:"json_object"}}
    })
  });
  if(!response.ok) throw new Error("OpenAI error "+response.status+": "+await response.text());
  const json=await response.json();
  const raw=extractResponseText(json);
  if(!raw) throw new Error("OpenAI returned no output");
  return parseJson(raw);
}

export async function rewriteTamil(item:NewsItem){
  if(process.env.AWS_ACCESS_KEY_ID&&process.env.AWS_SECRET_ACCESS_KEY){
    console.info("Using Amazon Bedrock with AWS SigV4 authentication for Tamil rewrite");
    return rewriteWithBedrock(item);
  }
  console.info("Using OpenAI for Tamil rewrite");
  return rewriteWithOpenAI(item);
}
