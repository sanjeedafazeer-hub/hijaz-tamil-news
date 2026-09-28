import {get,put} from "@vercel/blob";

export type StoredPost={id:string;source:string;title:string;link:string;publishedAt:string;summary:string;guid:string;editorial?:any;status:"pending_approval"|"approved"|"rejected"|"published";imageUrl?:string;createdAt:string;updatedAt:string};

const PATH="hijaz/posts.json";

const blobOptions=()=>({
 access:"private" as const,
 useCache:false,
 token:process.env.BLOB_READ_WRITE_TOKEN,
 oidcToken:process.env.VERCEL_OIDC_TOKEN,
 storeId:process.env.BLOB_STORE_ID || process.env.VERCEL_BLOB_STORE_ID
});

async function readPosts():Promise<StoredPost[]>{
 const result=await get(PATH,blobOptions());
 if(!result) return [];
 const text=await new Response(result.stream).text();
 return JSON.parse(text);
}

async function writePosts(posts:StoredPost[]){
 await put(PATH,JSON.stringify(posts),{
  access:"private",
  allowOverwrite:true,
  token:process.env.BLOB_READ_WRITE_TOKEN,
  oidcToken:process.env.VERCEL_OIDC_TOKEN,
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
