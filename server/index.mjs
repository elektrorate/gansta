import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { initializeApp,applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { canView,canEditTask,validateEntry,validateOffering,validateTask } from '../shared/domain.ts';
import { requireActive,requireAdmin,validateUserChange,taskProgressOnly } from './permissions.mjs';

initializeApp({credential:applicationDefault(),projectId:process.env.GOOGLE_CLOUD_PROJECT});
const db=getFirestore(),auth=getAuth(),origin=process.env.APP_ORIGIN||'http://localhost:5173';
const publicProfile=(snap)=>({id:snap.id,name:snap.data().name,email:snap.data().email,role:snap.data().role,status:snap.data().status,invitedAt:snap.data().invitedAt||''});
function error(message,status=400){throw Object.assign(new Error(message),{status})}
function cleanOffering(data,id,createdAt){return {id,name:data.name,category:data.category,price:data.price,billing:data.billing,description:data.description,start:data.start,end:data.end,goal:data.goal,unit:data.unit,budgets:data.budgets,enabledPlatforms:data.enabledPlatforms,targets:data.targets,ownerId:data.ownerId,memberIds:data.memberIds,milestoneDates:data.milestoneDates,driveUrl:data.driveUrl,createdAt};}
function cleanTask(data,id){return {id,title:data.title,milestone:data.milestone,ownerId:data.ownerId,ownerName:data.ownerName,start:data.start,end:data.end,blocked:data.blocked,subtasks:data.subtasks};}
const rates=new Map();
createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.headers.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(req.headers.origin===origin?204:403);res.end();return;}
  const respond=(data,status=200)=>{res.writeHead(status);res.end(JSON.stringify(data));};
  try{
    if(req.headers.origin&&req.headers.origin!==origin)error('Origen no autorizado.',403);
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/health'&&req.method==='GET'){respond({ok:true});return;}
    const bearer=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!bearer)error('Inicia sesión para continuar.',401);
    let token;try{token=await auth.verifyIdToken(bearer,true)}catch{error('Tu sesión ha caducado. Inicia sesión de nuevo.',401)}
    const userRef=db.doc('users/'+token.uid),userSnap=await userRef.get(),profile=userSnap.exists?publicProfile(userSnap):null;
    const now=Date.now(),limit=rates.get(token.uid);if(!limit||now-limit.at>60000)rates.set(token.uid,{at:now,n:1});else if(++limit.n>120)error('Demasiadas solicitudes. Espera un minuto.',429);
    if(rates.size>10000)for(const [key,v] of rates)if(now-v.at>60000)rates.delete(key);
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1000000)error('Solicitud demasiado grande.',413)}
    let body={};if(raw){try{body=JSON.parse(raw)}catch{error('Datos no válidos.')}}
    if(!body||typeof body!=='object'||Array.isArray(body))error('Datos no válidos.');
    if(pathname==='/api/activate'&&req.method==='POST'){
      if(!token.email_verified)error('Valida tu correo antes de activar la cuenta.',403);
      await db.runTransaction(async tx=>{const s=await tx.get(userRef),p=s.data();if(!p||p.status==='disabled')error('No tienes una invitación activa.',403);if(p.status==='active')return;if(p.inviteExpiresAt<Date.now())error('La invitación ha caducado. Pide al administrador que la reenvíe.',403);if(p.email.toLowerCase()!==token.email?.toLowerCase())error('La invitación no corresponde a este correo.',403);tx.update(userRef,{status:'active',activatedAt:new Date().toISOString()});});respond({ok:true});return;
    }
    requireActive(profile,token.email_verified);if(profile.email.toLowerCase()!==token.email?.toLowerCase())error('Tu correo no coincide con el acceso autorizado.',403);
    if(pathname==='/api/snapshot'&&req.method==='GET'){
      const offeringQuery=profile.role==='admin'?db.collection('offerings'):db.collection('offerings').where('memberIds','array-contains',profile.id);
      const [offeringDocs,people]=await Promise.all([offeringQuery.get(),profile.role==='admin'?db.collection('users').get():Promise.resolve(null)]);
      const offerings=offeringDocs.docs.map(s=>s.data()),tasks={},entries={};
      await Promise.all(offerings.map(async o=>{const [ts,es]=await Promise.all([db.collection('offerings/'+o.id+'/tasks').get(),db.collection('offerings/'+o.id+'/entries').get()]);tasks[o.id]=ts.docs.map(s=>s.data());entries[o.id]=es.docs.map(s=>s.data());}));
      respond({offerings,tasks,entries,profiles:people?people.docs.map(publicProfile):[profile]});return;
    }
    if(pathname==='/api/users'&&req.method==='POST'){
      requireAdmin(profile);const {name,email,role}=body;if(typeof name!=='string'||!name.trim()||name.length>100||typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||!['admin','collaborator'].includes(role))error('Introduce nombre, correo y rol válidos.');
      let user;try{user=await auth.createUser({email:email.toLowerCase().trim(),displayName:name.trim(),password:randomBytes(32).toString('base64url'),emailVerified:false})}catch(e){if(e.code==='auth/email-already-exists')error('Este correo ya está registrado.');throw e;}
      try{await db.doc('users/'+user.uid).create({name:name.trim(),email:user.email,role,status:'invited',invitedAt:new Date().toISOString(),inviteExpiresAt:Date.now()+7*86400000});}catch(e){await auth.deleteUser(user.uid);throw e;}
      respond({id:user.uid},201);return;
    }
    const userRoute=pathname.match(/^\/api\/users\/([\w-]+)(\/resend)?$/);
    if(userRoute){requireAdmin(profile);const id=userRoute[1],ref=db.doc('users/'+id),snap=await ref.get();if(!snap.exists)error('Usuario no encontrado.',404);if(userRoute[2]&&req.method==='POST'){if(snap.data().status!=='invited')error('Solo se reenvían invitaciones pendientes.');await ref.update({invitedAt:new Date().toISOString(),inviteExpiresAt:Date.now()+7*86400000});respond({ok:true});return;}
      if(req.method==='PATCH'){validateUserChange(profile.id,id,body);const target=await auth.getUser(id);if(body.status==='active'&&!target.emailVerified)error('El usuario debe validar su correo antes de activarse.');
        // Firestore first: revocation remains effective even if the Auth call fails.
        await ref.update({role:body.role,status:body.status,...(body.status==='invited'?{inviteExpiresAt:Date.now()+7*86400000}:{})});await auth.updateUser(id,{disabled:body.status==='disabled'});await auth.revokeRefreshTokens(id);respond({ok:true});return;}
    }
    const offeringRoute=pathname.match(/^\/api\/offerings\/([\w-]+)(?:\/(tasks|entries)\/([\w-]+))?$/);
    if(offeringRoute&&req.method==='PUT'){
      const [,id,kind,childId]=offeringRoute,ref=db.doc('offerings/'+id);
      await db.runTransaction(async tx=>{
        // Re-read permission data in the same transaction as each mutation.
        const actorSnap=await tx.get(userRef),actor={...actorSnap.data(),id:profile.id};requireActive(actor,token.email_verified);
        const snap=await tx.get(ref),o=snap.exists?snap.data():null;
        if(!kind){requireAdmin(actor);const next=validateOffering(cleanOffering(body,id,o?.createdAt||new Date().toISOString()));
          for(const member of next.memberIds){if(!/^[\w-]+$/.test(member))error('Usuario no válido.');const memberSnap=await tx.get(db.doc('users/'+member));if(!memberSnap.exists||memberSnap.data().status!=='active')error('El equipo solo puede contener usuarios activos.');}
          if(o){const [ts,es]=await Promise.all([tx.get(ref.collection('tasks')),tx.get(ref.collection('entries'))]);ts.docs.forEach(t=>validateTask(t.data(),next));es.docs.forEach(e=>validateEntry(e.data(),next));}
          tx.set(ref,next);return;
        }
        if(!o||!canView(actor,o))error('Offering no encontrado o sin permiso.',403);
        if(kind==='entries'){requireAdmin(actor);const next=validateEntry({id:childId,date:body.date,platform:body.platform,queries:body.queries,closed:body.closed,spent:body.spent},o);if(childId!==next.date+'_'+next.platform)error('Identificador de registro no válido.');tx.set(ref.collection('entries').doc(childId),next);return;}
        const taskRef=ref.collection('tasks').doc(childId),previous=await tx.get(taskRef),next=cleanTask(body,childId);
        if(actor.role!=='admin'){if(!previous.exists||!canEditTask(actor,o,previous.data())||!taskProgressOnly(previous.data(),next))error('Solo puedes actualizar el cumplimiento de tus tareas.',403);}
        validateTask(next,o);const ownerSnap=await tx.get(db.doc('users/'+next.ownerId));if(!ownerSnap.exists||ownerSnap.data().status!=='active')error('Responsable no disponible.');next.ownerName=ownerSnap.data().name;tx.set(taskRef,next);
      });respond({ok:true});return;
    }
    error('Ruta no encontrada.',404);
  }catch(e){const status=e.status||(['auth/insufficient-permission','auth/invalid-credential'].includes(e.code)?503:e.code?503:400);respond({error:status>=500?'El servidor no pudo completar la operación. Revisa la configuración de Firebase.':e.message||'No se pudo completar la operación.'},status);}
}).listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Gantsta API: http://'+(process.env.HOST||'127.0.0.1')+':'+(process.env.PORT||8787)));
