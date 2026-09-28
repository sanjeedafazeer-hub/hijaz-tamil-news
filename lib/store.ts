import {get,put} from "@vercel/blob";

export type StoredPost={id:string;source:string;title:string;link:string;publishedAt:string;summary:string;guid:string;editorial?:any;status:"pending_approval"|"approved"|"rejected"|"published";imageUrl?:string;createdAt:string;updatedAt:string};

const PATH="hijaz/posts.json";

async function readPosts():Promise<StoredPost[]>{
 try{
  const result=await get(PATH,{access:"private",useCache:false});
  if(!result) return [];
  const text=await new Response(result.stream).text();
  return JSON.parse(text);
 }catch{return [];}
}

async function writePosts(posts:StoredPost[]){
 await put(PATH,JSON.stringify(posts),{access:"private",allowOverwrite:true});
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
