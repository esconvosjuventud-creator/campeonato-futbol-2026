(() => {
  "use strict";
  const START = new Date("2026-08-26T00:00:00-03:00");
  const END = new Date("2026-09-11T23:59:59-03:00");
  const AGE_REF = new Date("2026-09-11T12:00:00-03:00");
  const MIN = 5, MAX = 10, MAX_BYTES = 8 * 1024 * 1024;
  const DRAFT_KEY = "cf2026_github_draft_v3";
  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
  let currentStep = 1;
  let players = [];
  let client = null;
  const $ = id => document.getElementById(id);

  function uuid(){ return crypto.randomUUID(); }
  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function digits(v){ return String(v || "").replace(/\D/g, ""); }
  function age(birth){
    if(!birth) return null;
    const b = new Date(`${birth}T12:00:00`); if(Number.isNaN(b.getTime())) return null;
    let a = AGE_REF.getFullYear() - b.getFullYear();
    const m = AGE_REF.getMonth() - b.getMonth();
    if(m < 0 || (m === 0 && AGE_REF.getDate() < b.getDate())) a--;
    return a;
  }
  function minor(p){ const a=age(p.birth); return a !== null && a < 18; }
  function catLabel(c){ return ({"M13-15":"Masculino 13 a 15 años","M16-22":"Masculino 16 a 22 años","F-LIBRE":"Femenino Libre"})[c] || ""; }
  function ageError(p){
    const a=age(p.birth), c=$("category").value;
    if(a === null) return "Ingresá la fecha de nacimiento.";
    if(c === "M13-15" && (a < 13 || a > 15)) return `Tiene ${a} años; la categoría admite de 13 a 15.`;
    if(c === "M16-22" && (a < 16 || a > 22)) return `Tiene ${a} años; la categoría admite de 16 a 22.`;
    return "";
  }
  function blankPlayer(){ return { id:uuid(), firstName:"", lastName:"", ci:"", birth:"", phone:"", contactPhone:"", email:"", fitnessExpiry:"", ciFile:null, fitnessFile:null, guardianName:"", guardianCi:"", guardianRelation:"", guardianPhone:"", guardianEmail:"", participationConsent:false, imageConsent:"" }; }

  function initSupabase(){
    const cfg=window.APP_CONFIG || {};
    if(!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_URL.includes("PEGAR_AQUI") || cfg.SUPABASE_PUBLISHABLE_KEY.includes("PEGAR_AQUI")){
      $("configError").textContent="Este sitio todavía no está conectado a Supabase. El administrador debe completar js/config.js antes de habilitar las inscripciones.";
      $("configError").classList.remove("hidden"); $("formCard").classList.add("hidden"); return false;
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:true,autoRefreshToken:true}});
    return true;
  }

  function checkPeriod(){
    const now=new Date();
    if(now < START){ $("periodNotice").textContent="Las inscripciones estarán habilitadas a partir del 26 de agosto de 2026."; $("periodNotice").classList.remove("hidden"); $("formCard").classList.add("hidden"); return false; }
    if(now > END){ $("periodNotice").textContent="El período de inscripción al 14.º Campeonato de Fútbol ha finalizado."; $("periodNotice").classList.remove("hidden"); $("formCard").classList.add("hidden"); return false; }
    return true;
  }

  function topData(){ return {
    team_name:$("teamName").value.trim(), category:$("category").value,
    delegate_name:$("delegateName").value.trim(), delegate_ci:digits($("delegateCi").value), delegate_birth:$("delegateBirth").value || null,
    delegate_phone:$("delegatePhone").value.trim(), delegate_email:$("delegateEmail").value.trim(), represented_group:$("representedGroup").value.trim(),
    second_contact_name:$("secondContactName").value.trim(), second_contact_phone:$("secondContactPhone").value.trim(),
    data_consent:$("dataConsent").checked, final_declaration:$("finalDeclaration").checked
  }; }

  function saveDraft(){
    const data={top:topData(), players:players.map(p=>({...p,ciFile:p.ciFile?{name:p.ciFile.name}:null,fitnessFile:p.fitnessFile?{name:p.fitnessFile.name}:null}))};
    localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
  }
  function loadDraft(){ try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");}catch{return null;} }
  function restore(){
    const d=loadDraft();
    players = d?.players?.length >= MIN ? d.players.slice(0,MAX).map(p=>({...p,ciFile:null,fitnessFile:null})) : Array.from({length:MIN},blankPlayer);
    if(d?.top){
      const map={team_name:"teamName",category:"category",delegate_name:"delegateName",delegate_ci:"delegateCi",delegate_birth:"delegateBirth",delegate_phone:"delegatePhone",delegate_email:"delegateEmail",represented_group:"representedGroup",second_contact_name:"secondContactName",second_contact_phone:"secondContactPhone"};
      Object.entries(map).forEach(([k,id])=>{ if(d.top[k] != null) $(id).value=d.top[k]; });
      $("dataConsent").checked=!!d.top.data_consent; $("finalDeclaration").checked=!!d.top.final_declaration;
    }
    renderPlayers();
  }

  function playerHtml(p,i){ const a=age(p.birth), err=p.birth?ageError(p):""; return `<article class="participant" data-id="${p.id}">
    <div class="participant-head"><h3>Participante ${i+1}</h3>${players.length>MIN?`<button type="button" class="btn danger remove-player" data-id="${p.id}">Quitar</button>`:""}</div>
    <div class="grid two">
      <label>Nombre *<input data-pfield="firstName" data-id="${p.id}" value="${esc(p.firstName)}"></label>
      <label>Apellidos *<input data-pfield="lastName" data-id="${p.id}" value="${esc(p.lastName)}"></label>
      <label>Cédula de identidad *<input data-pfield="ci" data-id="${p.id}" inputmode="numeric" value="${esc(p.ci)}"></label>
      <label>Fecha de nacimiento *<input data-pfield="birth" data-id="${p.id}" type="date" value="${esc(p.birth)}"><span class="small">Edad al 11/09/2026: <strong>${a??"—"}</strong></span>${p.birth?`<span class="${err?"age-bad":"age-ok"}">${esc(err||"Edad compatible con la categoría.")}</span>`:""}</label>
      <label>Teléfono personal<input data-pfield="phone" data-id="${p.id}" inputmode="tel" value="${esc(p.phone)}"></label>
      <label>Teléfono de contacto *<input data-pfield="contactPhone" data-id="${p.id}" inputmode="tel" value="${esc(p.contactPhone)}"></label>
      <label>Correo electrónico<input data-pfield="email" data-id="${p.id}" type="email" value="${esc(p.email)}"></label>
    </div></article>`; }
  function renderPlayers(){ $("participants").innerHTML=players.map(playerHtml).join(""); $("playerCount").textContent=players.length; $("addParticipant").disabled=players.length>=MAX; }

  function fileText(file){ return file ? `${file.name} · ${(file.size/1024/1024).toFixed(2)} MB` : "Ningún archivo seleccionado"; }
  function renderDocs(){ $("documents").innerHTML=players.map((p,i)=>`<article class="doc-card"><h3>${i+1}. ${esc(`${p.firstName} ${p.lastName}`.trim()||`Participante ${i+1}`)}</h3><div class="doc-grid">
    <label class="file-label">Fotocopia / foto de Cédula *<input type="file" data-file="ciFile" data-id="${p.id}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><span class="small">${esc(fileText(p.ciFile))}</span></label>
    <label class="file-label">Carné de Aptitud Física *<input type="file" data-file="fitnessFile" data-id="${p.id}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><span class="small">${esc(fileText(p.fitnessFile))}</span></label>
    <label>Vencimiento del carné *<input type="date" data-pfield="fitnessExpiry" data-id="${p.id}" value="${esc(p.fitnessExpiry)}"></label>
  </div></article>`).join(""); }

  function imageChoice(p){ return `<div><strong>Permiso de uso de imagen *</strong><p class="small">Registrar la decisión del participante o, si es menor, de su responsable legal.</p><div class="image-choice">
    <label><input type="radio" data-pfield="imageConsent" data-id="${p.id}" name="img_${p.id}" value="SI" ${p.imageConsent==="SI"?"checked":""}> Sí, autoriza</label>
    <label><input type="radio" data-pfield="imageConsent" data-id="${p.id}" name="img_${p.id}" value="NO" ${p.imageConsent==="NO"?"checked":""}> No autoriza</label>
  </div></div>`; }
  function renderAuth(){ $("authorizations").innerHTML=players.map((p,i)=>{ const name=esc(`${p.firstName} ${p.lastName}`.trim()||`Participante ${i+1}`); if(minor(p)) return `<article class="auth-card"><h3>${i+1}. ${name} — menor de 18 años</h3><div class="grid two">
    <label>Responsable legal *<input data-pfield="guardianName" data-id="${p.id}" value="${esc(p.guardianName)}"></label><label>Cédula del responsable *<input data-pfield="guardianCi" data-id="${p.id}" inputmode="numeric" value="${esc(p.guardianCi)}"></label>
    <label>Vínculo *<input data-pfield="guardianRelation" data-id="${p.id}" value="${esc(p.guardianRelation)}" placeholder="Madre, padre, tutor..."></label><label>Teléfono / WhatsApp *<input data-pfield="guardianPhone" data-id="${p.id}" value="${esc(p.guardianPhone)}"></label>
    <label>Correo electrónico<input data-pfield="guardianEmail" data-id="${p.id}" type="email" value="${esc(p.guardianEmail)}"></label></div>
    <label class="checkbox"><input type="checkbox" data-pcheck="participationConsent" data-id="${p.id}" ${p.participationConsent?"checked":""}> <span>Declaro ser responsable legal y autorizo la participación del menor en el campeonato. *</span></label>${imageChoice(p)}</article>`;
    return `<article class="auth-card"><h3>${i+1}. ${name} — mayor de 18 años</h3><p class="small">La organización podrá registrar fotografías y videos con fines institucionales, educativos, informativos y de difusión, sin fines comerciales. La inscripción no depende de autorizar el uso de imagen.</p>${imageChoice(p)}</article>`; }).join(""); }

  function renderReview(){ const t=topData(); $("review").innerHTML=`<article class="review-card"><div class="review-head"><div><h3>${esc(t.team_name)}</h3><span class="small">${esc(catLabel(t.category))} · ${players.length} integrantes</span></div></div></article>` + players.map((p,i)=>`<article class="review-card"><strong>${i+1}. ${esc(`${p.firstName} ${p.lastName}`)}</strong><div class="small">CI ${esc(digits(p.ci))} · Edad ${age(p.birth)}</div><ul><li>✅ Cédula seleccionada</li><li>✅ Carné seleccionado · vence ${esc(p.fitnessExpiry)}</li><li>${minor(p)?"✅ Autorización de participación registrada":"✅ Mayor de edad"}</li><li>${p.imageConsent==="SI"?"✅ Autoriza uso de imagen":"🚫 No autoriza uso de imagen"}</li></ul></article>`).join(""); }

  function showError(msg){ $("formError").textContent=msg; $("formError").classList.remove("hidden"); return false; }
  function clearError(){ $("formError").classList.add("hidden"); }
  function validateFile(f){ return f && f.size>0 && f.size<=MAX_BYTES && allowedTypes.has(f.type); }
  function validateStep(s){ clearError(); const t=topData();
    if(s===1){ if(!t.team_name||!t.category||!t.delegate_name||!t.delegate_ci||!t.delegate_phone||!t.delegate_email) return showError("Completá todos los campos obligatorios del equipo y del responsable."); if(!/^\S+@\S+\.\S+$/.test(t.delegate_email)) return showError("Ingresá un correo electrónico válido."); }
    if(s===2){ if(players.length<MIN||players.length>MAX) return showError("Cada equipo debe tener entre 5 y 10 participantes."); const seen=new Set(); for(let i=0;i<players.length;i++){const p=players[i],ci=digits(p.ci); if(!p.firstName||!p.lastName||!ci||!p.birth||!p.contactPhone) return showError(`Completá los campos obligatorios del participante ${i+1}.`); if(seen.has(ci)) return showError(`La cédula del participante ${i+1} está repetida dentro del equipo.`); seen.add(ci); const e=ageError(p); if(e) return showError(`Participante ${i+1}: ${e}`);}}
    if(s===3){ for(let i=0;i<players.length;i++){const p=players[i]; if(!validateFile(p.ciFile)||!validateFile(p.fitnessFile)) return showError(`Seleccioná archivos válidos (PDF/JPG/PNG, máximo 8 MB) para el participante ${i+1}.`); if(!p.fitnessExpiry) return showError(`Ingresá el vencimiento del carné del participante ${i+1}.`); if(new Date(`${p.fitnessExpiry}T12:00:00`) < AGE_REF) return showError(`El carné del participante ${i+1} figura vencido al 11/09/2026.`);}}
    if(s===4){ for(let i=0;i<players.length;i++){const p=players[i]; if(minor(p)&&(!p.guardianName||!digits(p.guardianCi)||!p.guardianRelation||!p.guardianPhone||!p.participationConsent)) return showError(`Completá la autorización de participación del menor ${i+1}.`); if(!["SI","NO"].includes(p.imageConsent)) return showError(`Indicá Sí o No en el permiso de imagen del participante ${i+1}.`);} if(!t.data_consent||!t.final_declaration) return showError("Debés aceptar la protección de datos y la declaración final."); }
    return true; }

  function setStep(s){ currentStep=s; document.querySelectorAll(".step").forEach(x=>x.classList.toggle("active",Number(x.dataset.step)===s)); const labels={1:"Paso 1 de 5 — Equipo",2:"Paso 2 de 5 — Participantes",3:"Paso 3 de 5 — Documentación",4:"Paso 4 de 5 — Autorizaciones",5:"Paso 5 de 5 — Revisar y enviar"}; $("stepTitle").textContent=labels[s]; $("progressBar").style.width=`${s*20}%`; $("prevBtn").classList.toggle("hidden",s===1); $("nextBtn").classList.toggle("hidden",s===5); $("submitBtn").classList.toggle("hidden",s!==5); if(s===3)renderDocs(); if(s===4)renderAuth(); if(s===5)renderReview(); saveDraft(); window.scrollTo({top:0,behavior:"smooth"}); }

  function payload(){ const t=topData(); return {team:t, participants:players.map(p=>({id:p.id,first_name:p.firstName.trim(),last_name:p.lastName.trim(),ci:digits(p.ci),birth_date:p.birth,phone:p.phone.trim(),contact_phone:p.contactPhone.trim(),email:p.email.trim(),fitness_expiry:p.fitnessExpiry,guardian_name:minor(p)?p.guardianName.trim():null,guardian_ci:minor(p)?digits(p.guardianCi):null,guardian_relation:minor(p)?p.guardianRelation.trim():null,guardian_phone:minor(p)?p.guardianPhone.trim():null,guardian_email:minor(p)?p.guardianEmail.trim():null,participation_consent:minor(p)?!!p.participationConsent:true,image_consent:p.imageConsent==="SI"}))}; }
  function ext(file){ const byType={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png"}; return byType[file.type] || "bin"; }

  async function submit(){
    for(const s of [1,2,3,4]) if(!validateStep(s)){ setStep(s); return; }
    $("formCard").classList.add("hidden"); $("sendingCard").classList.remove("hidden"); $("uploadProgress").textContent="Creando inscripción segura...";
    let draft=null;
    try{
      // Generar identificadores nuevos en cada intento de envío.
  // Evita colisiones si un intento anterior quedó incompleto.
  players = players.map(p => ({
    ...p,
    id: uuid()
  }));

  const {data,error}=await client.rpc(
    "create_registration_draft",
    {payload:payload()}
  );

  if(error) throw error;
  draft=data;;
      const docs=[]; let done=0,total=players.length*2;
      for(const p of players){
        for(const [kind,file] of [["CEDULA",p.ciFile],["APTITUD",p.fitnessFile]]){
          const path=`${draft.team_id}/${draft.upload_token}/${p.id}/${kind.toLowerCase()}-${uuid()}.${ext(file)}`;
          const {error:upErr}=await client.storage.from("documentos").upload(path,file,{contentType:file.type,upsert:false,cacheControl:"3600"}); if(upErr) throw upErr;
          docs.push({participant_id:p.id,document_type:kind,storage_path:path,original_name:file.name,mime_type:file.type,size_bytes:file.size});
          done++; $("uploadProgress").textContent=`Documentos cargados: ${done} de ${total}`;
        }
      }
      $("uploadProgress").textContent="Validando y confirmando inscripción...";
      const {data:final,error:finErr}=await client.rpc("finalize_registration",{p_team_id:draft.team_id,p_upload_token:draft.upload_token,p_documents:docs}); if(finErr) throw finErr;
      localStorage.removeItem(DRAFT_KEY); $("sendingCard").classList.add("hidden"); $("successCard").classList.remove("hidden");
      $("successSummary").innerHTML=`<strong>Equipo:</strong> ${esc(topData().team_name)}<br><strong>Categoría:</strong> ${esc(catLabel(topData().category))}<br><strong>Participantes:</strong> ${players.length}<br><strong>N.º de inscripción:</strong> <span class="mono">${esc(final.registration_number)}</span>`;
    }catch(err){ console.error(err); $("sendingCard").classList.add("hidden"); $("formCard").classList.remove("hidden"); setStep(5); showError(`No se pudo completar la inscripción. ${err?.message||"Intentá nuevamente."}`); }
  }

  document.addEventListener("input",e=>{ const id=e.target.dataset.id,field=e.target.dataset.pfield; if(id&&field){ const p=players.find(x=>x.id===id); if(p){p[field]=e.target.value;if(field==="birth")renderPlayers();saveDraft();}} else if(e.target.closest("#registrationForm"))saveDraft(); });
  document.addEventListener("change",e=>{ const id=e.target.dataset.id,field=e.target.dataset.pfield,check=e.target.dataset.pcheck,fileField=e.target.dataset.file; if(id&&field){const p=players.find(x=>x.id===id);if(p){p[field]=e.target.value;saveDraft();}} if(id&&check){const p=players.find(x=>x.id===id);if(p){p[check]=e.target.checked;saveDraft();}} if(id&&fileField){const p=players.find(x=>x.id===id);if(p){const f=e.target.files?.[0]||null;if(f&&!validateFile(f)){alert("Archivo no permitido. Usá PDF, JPG, JPEG o PNG de hasta 8 MB.");e.target.value="";p[fileField]=null;}else p[fileField]=f;renderDocs();}} if(e.target.id==="category")renderPlayers(); });
  document.addEventListener("click",e=>{ if(e.target.matches(".remove-player")){players=players.filter(p=>p.id!==e.target.dataset.id);renderPlayers();saveDraft();} });
  $("addParticipant").addEventListener("click",()=>{if(players.length<MAX){players.push(blankPlayer());renderPlayers();saveDraft();}});
  $("nextBtn").addEventListener("click",()=>{if(validateStep(currentStep))setStep(currentStep+1);}); $("prevBtn").addEventListener("click",()=>setStep(currentStep-1));
  $("registrationForm").addEventListener("submit",e=>{e.preventDefault();submit();}); $("newRegistration").addEventListener("click",()=>{localStorage.removeItem(DRAFT_KEY);location.reload();});
  if(initSupabase() && checkPeriod()){restore();setStep(1);} 
})();
