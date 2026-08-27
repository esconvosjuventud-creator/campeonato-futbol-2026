(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const LABEL={
    "M13-15":"Masculino 13–15",
    "M16-22":"Masculino 16–22",
    "F-LIBRE":"Femenino Libre"
  };

  let client=null;
  let days=[];
  let active="";

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);

  function setup(){
    const cfg=window.APP_CONFIG||{};
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return false;
    client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
    return true;
  }

  function dateLabel(dateStr){
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-UY",{
      weekday:"long",day:"2-digit",month:"long"
    });
  }

  function timeLabel(iso){
    return new Date(iso).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
  }

  function statusClass(status){
    return String(status||"").toLowerCase().replaceAll(" ","-");
  }

  function renderTabs(){
    $("publicOpsDayTabs").innerHTML=days.map(d=>`
      <button type="button" data-id="${d.id}" class="${d.id===active?"active":""}">
        ${esc(dateLabel(d.event_date))} · ${esc(d.title)}
      </button>
    `).join("");
  }

  function renderNow(day){
    const slots=day.slots||[];
    const live=slots.filter(s=>s.operational_status==="En juego");
    const calls=slots.filter(s=>s.operational_status==="Llamado");

    if(!live.length&&!calls.length){
      $("publicOpsToday").classList.add("hidden");
      return;
    }

    $("publicOpsToday").classList.remove("hidden");
    $("publicOpsToday").innerHTML=`
      ${live.length?`
        <div class="public-now-group">
          <span>🔴 EN JUEGO</span>
          ${live.map(s=>`
            <strong>${esc(s.team_a_name)} ${s.score_a ?? 0} – ${s.score_b ?? 0} ${esc(s.team_b_name)}</strong>
            <small>${esc(s.court_name)} · ${esc(LABEL[s.category]||s.category)}</small>
          `).join("")}
        </div>`:""}
      ${calls.length?`
        <div class="public-now-group call">
          <span>📣 LLAMADO</span>
          ${calls.map(s=>`
            <strong>${esc(s.team_a_name)} vs. ${esc(s.team_b_name)}</strong>
            <small>${timeLabel(s.scheduled_start)} · ${esc(s.court_name)}</small>
          `).join("")}
        </div>`:""}
    `;
  }

  function renderDay(){
    const day=days.find(d=>d.id===active);
    if(!day)return;

    renderNow(day);

    const slots=day.slots||[];
    const courts=[...new Set(slots.map(s=>s.court_name))];

    $("publicOpsContent").innerHTML=`
      <section class="public-day-head">
        <span>${esc(dateLabel(day.event_date))}</span>
        <h2>${esc(day.title)}</h2>
        <p>
          Inicio ${String(day.start_time).slice(0,5)} · ${day.match_minutes} min por partido ·
          ${courts.length} cancha${courts.length===1?"":"s"}
        </p>
      </section>

      <section class="public-courts-grid">
        ${courts.map(court=>`
          <article class="public-court-card">
            <h3>🏟️ ${esc(court)}</h3>
            ${slots.filter(s=>s.court_name===court).map(s=>`
              <div class="public-slot ${statusClass(s.operational_status)}">
                <div class="public-slot-time">
                  <strong>${timeLabel(s.scheduled_start)}</strong>
                  <span>${esc(s.operational_status)}</span>
                </div>
                <div class="public-slot-match">
                  <small>${esc(LABEL[s.category]||s.category)}</small>
                  <strong>${esc(s.team_a_name)}</strong>
                  <b>${s.operational_status==="Finalizado"||s.operational_status==="En juego" ? `${s.score_a ?? 0} – ${s.score_b ?? 0}` : "vs."}</b>
                  <strong>${esc(s.team_b_name)}</strong>
                  ${s.notes?`<em>${esc(s.notes)}</em>`:""}
                </div>
              </div>
            `).join("")}
          </article>
        `).join("")}
      </section>
    `;
  }

  async function load(){
    $("publicOpsError").classList.add("hidden");

    if(!setup()){
      $("publicOpsError").textContent="La página todavía no está conectada al sistema.";
      $("publicOpsError").classList.remove("hidden");
      return;
    }

    const {data,error}=await client.rpc("get_public_operations");
    if(error){
      $("publicOpsError").textContent="El cronograma todavía no está disponible.";
      $("publicOpsError").classList.remove("hidden");
      return;
    }

    days=data?.days||[];

    if(!days.length){
      $("publicOpsError").innerHTML="<strong>Próximamente</strong><br>La organización publicará los horarios cuando estén confirmados.";
      $("publicOpsError").classList.remove("hidden");
      $("publicOpsDayTabs").innerHTML="";
      $("publicOpsContent").innerHTML="";
      $("publicOpsToday").classList.add("hidden");
      return;
    }

    if(!active||!days.some(d=>d.id===active))active=days[0].id;
    renderTabs();
    renderDay();
  }

  document.addEventListener("click",e=>{
    if(e.target.matches("#publicOpsDayTabs button")){
      active=e.target.dataset.id;
      renderTabs();
      renderDay();
    }
  });

  $("publicOpsRefresh").addEventListener("click",load);
  load();
})();
