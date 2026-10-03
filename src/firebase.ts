import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
export const configured=Object.values(config).every(Boolean);
const app=configured?initializeApp(config):null;
export const auth=app?getAuth(app):null;
export const db=app?getFirestore(app):null;
if(auth)auth.languageCode='es';
export const demoEnabled=import.meta.env.DEV||import.meta.env.VITE_ENABLE_DEMO==='true';
export async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{
  if(!auth?.currentUser)throw new Error('Inicia sesión para continuar.');
  const token=await auth.currentUser.getIdToken();
  const response=await fetch((import.meta.env.VITE_API_URL||'')+'/api'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json().catch(()=>({error:'No se pudo contactar con el servidor.'}));
  if(!response.ok)throw new Error(result.error||'No se pudo completar la operación.');
  return result as T;
}
