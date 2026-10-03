import type { ReactNode } from 'react';
export const go=(path:string)=>{location.hash='#'+path;};
export function Back({to='/',label='Dashboard'}:{to?:string;label?:string}){return <button type="button" className="back" onClick={()=>go(to)}><span aria-hidden="true">‹</span> {label}</button>}
export function Progress({value,label,color='purple'}:{value:number;label:string;color?:string}){return <div className={'progress '+color} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.max(0,value))}><span style={{width:Math.min(100,Math.max(0,value))+'%'}}/></div>}
export function Empty({children}:{children:ReactNode}){return <div className="empty">{children}</div>}
export function ErrorText({error}:{error:string}){return error?<p className="error" role="alert">{error}</p>:null}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint?<small>{hint}</small>:null}</label>}
export function Header({eyebrow,title,description}:{eyebrow?:string;title:string;description?:string}){return <header className="page-header">{eyebrow?<div className="eyebrow">{eyebrow}</div>:null}<h1>{title}</h1>{description?<p className="muted">{description}</p>:null}</header>}
