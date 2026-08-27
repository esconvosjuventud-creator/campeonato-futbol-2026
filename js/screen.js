(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const LABEL={
    "M13-15":"Masculino 13–15",
    "M16-22":"Masculino 16–22",
    "F-LIBRE":"Femenino Libre"
  };
  let client=null;
  let timer=null;

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);

  function setup(){
    const cfg=window.APP_CONFIG||{};
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return false;
    client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
    return true;
  }

  function clock(){
    const now=new Date();
    $("screenClock").textContent=now.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
    $("screenDate").textContent=now.toLocaleDateString("es-UY",{weekday:"long",day:"2-digit",month:"long"});
  }

  function timeLabel(iso){
    return new Date(iso).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
  }

  function chooseDay(days){
    const today=new Date().toISOString().slice(0,10);
    return days.find(d=>d.event_date===today) || days[0] || null;
  }

  function liveCard(slot){
    return `
      <div class="screen-live-court">${esc(slot.court_name)} · ${esc(LABEL[slot.category]||slot.category)}</div>
      <div class="screen-live-teams">
        <strong>${esc(slot.team_a_name)}</strong>
        <div class="screen-live-score">
          <span>${slot.score_a ?? 0}</span>
          <b>–</b>
          <span>${slot.score_b ?? 0}</span>
        </div>
        <strong>${esc(slot.team_b_name)}</strong>
      </div>
      ${slot.notes?`<div class="screen-live-note">${esc(slot.notes)}</div>`:""}
    `;
  }

  function render(day){
    if(!day){
      $("screenError").textContent="Todavía no hay una jornada publicada.";
      $("screenError").classList.remove("hidden");
      return;
    }

    $("screenError").classList.add("hidden");

    const now=new Date();
    const slots=[...(day.slots||[])].sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));
    const live=slots.filter(s=>s.operational_status==="En juego");
    const calls=slots.filter(s=>s.operational_status==="Llamado");
    const future=slots.filter(s=>
      ["Programado","Llamado","Demorado"].includes(s.operational_status) &&
      new Date(s.scheduled_start)>=new Date(now.getTime()-30*60000)
    );

    const liveBox=$("screenLive").querySelector(".screen-live-content");
    liveBox.innerHTML=live.length
      ? live.slice(0,2).map(liveCard).join("")
      : `<div class="screen-placeholder"><strong>PRÓXIMO PARTIDO</strong><br>${future[0] ? `${timeLabel(future[0].scheduled_start)} · ${esc(future[0].team_a_name)} vs. ${esc(future[0].team_b_name)}` : "Esperando próximos encuentros"}</div>`;

    $("screenNext").innerHTML=future.slice(0,6).map(s=>`
      <article class="screen-next-card">
        <div>
          <strong>${timeLabel(s.scheduled_start)}</strong>
          <span>${esc(s.court_name)}</span>
        </div>
        <small>${esc(LABEL[s.category]||s.category)}</small>
        <b>${esc(s.team_a_name)}</b>
        <em>vs.</em>
        <b>${esc(s.team_b_name)}</b>
        ${s.operational_status==="Demorado"?`<mark>DEMORADO</mark>`:""}
      </article>
    `).join("") || `<div class="screen-placeholder small">No hay más partidos programados.</div>`;

    $("screenCalls").innerHTML=calls.length
      ? calls.map(s=>`
          <div class="screen-call">
            <span>${esc(s.court_name)}</span>
            <strong>${esc(s.team_a_name)} vs. ${esc(s.team_b_name)}</strong>
          </div>
        `).join("")
      : `<div class="screen-placeholder small">Sin llamados activos.</div>`;

    $("screenUpdated").textContent=`${esc(day.title)} · actualizado ${new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`;
  }

  async function load(){
    if(!setup()){
      $("screenError").textContent="Falta conectar la pantalla al sistema.";
      $("screenError").classList.remove("hidden");
      return;
    }

    const {data,error}=await client.rpc("get_public_operations");
    if(error){
      $("screenError").textContent="No se pudo cargar la jornada.";
      $("screenError").classList.remove("hidden");
      return;
    }
    render(chooseDay(data?.days||[]));
  }

  clock();
  setInterval(clock,1000);
  load();
  timer=setInterval(load,15000);

  window.addEventListener("beforeunload",()=>clearInterval(timer));
})();
