import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {list,put} from "@vercel/blob";

export type StoredPost={id:string;source:string;title:string;link:string;publishedAt:string;summary:string;guid:string;editorial?:any;status:"pending_approval"|"approved"|"rejected"|"published";imageUrl?:string;createdAt:string;updatedAt:string};

const PATH="hijaz/posts.json";

const blobOptions=()=>({
 access:"public" as const,
 useCache:false,
 token:process.env.BLOB_READ_WRITE_TOKEN,
 storeId:process.env.BLOB_STORE_ID || process.env.VERCEL_BLOB_STORE_ID
});

function key(){
 const secret=process.env.ADMIN_SECRET;
 if(!secret) throw new Error("ADMIN_SECRET is not configured");
 return createHash("sha256").update(secret).digest();
}

function encrypt(value:string){
 const iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key(),iv);
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 const tag=cipher.getAuthTag();
 return JSON.stringify({v:1,iv:iv.toString("base64"),tag:tag.toString("base64"),data:encrypted.toString("base64")});
}

function decrypt(value:string){
 const payload=JSON.parse(value);
 if(payload.v!==1) throw new Error("Unsupported storage format");
 const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(payload.iv,"base64"));
 decipher.setAuthTag(Buffer.from(payload.tag,"base64"));
 const decrypted=Buffer.concat([decipher.update(Buffer.from(payload.data,"base64")),decipher.final()]);
 return decrypted.toString("utf8");
}

async function readPosts():Promise<StoredPost[]>{
 const result=await list({prefix:PATH,limit:1,...blobOptions()});
 const blob=result.blobs.find(x=>x.pathname===PATH);
 if(!blob) return [];
 const response=await fetch(blob.url,{cache:"no-store"});
 if(!response.ok) throw new Error(`Vercel Blob: Failed to fetch blob: ${response.status} ${response.statusText}`);
 const text=await response.text();
 return JSON.parse(decrypt(text));
}

async function writePosts(posts:StoredPost[]){
 await put(PATH,encrypt(JSON.stringify(posts)),{
  access:"public",
  allowOverwrite:true,
  token:process.env.BLOB_READ_WRITE_TOKEN,
  storeId:process.env.BLOB_STORE_ID || process.env.VERCEL_BLOB_STORE_ID,
  contentType:"application/json"
 });
}

export async function listPosts(){return readPosts();}

export async function upsertPost(post:StoredPost){
 const posts=await readPosts();
 const index=posts.findIndex(x=>x.id===post.id);
 if(index>=0) posts[index]=post; else posts.unshift(post);
 await writePosts(posts.slice(0,100));
 return post;
}

export async function updatePost(id:string,status:StoredPost["status"],extra:Partial<StoredPost>={}){
 const posts=await readPosts();
 const index=posts.findIndex(x=>x.id===id);
 if(index<0) return null;
 posts[index]={...posts[index],...extra,status,updatedAt:new Date().toISOString()};
 await writePosts(posts);
 return posts[index];
}
