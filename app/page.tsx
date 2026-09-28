"use client";
import {useState} from "react";
const sources=["BBC World","Reuters World","Al Jazeera","CNN World","The Guardian World"];
const steps=["Fetch source","Understand story","Write Tamil","Create original graphic","Human approval","Publish to Instagram"];
export default function Home(){
 const [tab,setTab]=useState("Dashboard"); const [test,setTest]=useState(false);
 return <main className="app"><aside className="sidebar"><div className="logo"><div className="mark">HA</div><div><b>Hijaz Tamil News</b><span>@hijaz_ah</span></div></div>
 <nav>{["Dashboard","Pending Posts","Published","Sources","Settings"].map(x=><button className={tab===x?"selected":""} onClick={()=>setTab(x)} key={x}><span>{x==="Dashboard"?"⌂":x==="Pending Posts"?"◷":x==="Published"?"✓":x==="Sources"?"◉":"⚙"}</span>{x}</button>)}</nav>
 <div className="safe"><div><i/> Automation ready</div><small>Every post requires approval before Instagram publishing.</small></div></aside>
 <section className="main"><header><div><label>EDITORIAL AUTOMATION</label><h1>{tab}</h1><p>International news → natural Tamil → original visual → approval → Instagram.</p></div><button className="run" onClick={()=>setTest(true)}>Run test</button></header>
 {tab==="Dashboard"&&<><div className="stats">{[["Active sources","05","Feeds configured"],["Pending","00","Awaiting approval"],["Published","00","Instagram posts"],["Errors","00","Needs attention"]].map(([a,b,c])=><div className="stat" key={a}><span>{a}</span><strong>{b}</strong><small>{c}</small></div>)}</div>
 <div className="panel"><div className="panelTitle"><div><h2>Automation pipeline</h2><p>Safe editorial workflow</p></div><em>APPROVAL MODE</em></div><div className="pipeline">{steps.map((s,i)=><div className="step" key={s}><div className="num">{String(i+1).padStart(2,"0")}</div><div><b>{s}</b><small>{i<2?"Ready":i===2?"AI processing":"Waiting"}</small></div><span className={i<2?"ready":i===2?"ai":"wait"}>{i<2?"●":i===2?"✦":"○"}</span></div>)}</div></div>
 <div className="panel"><div className="panelTitle"><div><h2>News sources</h2><p>Use authorized feeds or APIs. Article wording is not copied.</p></div><button className="ghost">Manage</button></div><div className="sourceGrid">{sources.map(s=><div className="source" key={s}><span className="sourceDot"/><b>{s}</b><small>Configured</small></div>)}</div></div>
 <div className="panel note"><div className="noteIcon">✓</div><div><b>Editorial safeguards enabled</b><p>The AI is instructed to preserve facts, avoid invented details, distinguish reported claims from confirmed facts, and produce original Tamil copy.</p></div></div></>}
 {tab!=="Dashboard"&&<div className="panel empty"><div className="emptyIcon">{tab==="Pending Posts"?"◷":tab==="Published"?"✓":tab==="Sources"?"◉":"⚙"}</div><h2>{tab}</h2><p>This module is scaffolded and ready for the next integration.</p></div>}
 {test&&<div className="toast"><b>Test run queued</b><span>Feed fetching and AI processing will be connected next.</span><button onClick={()=>setTest(false)}>×</button></div>}
 </section></main>
}