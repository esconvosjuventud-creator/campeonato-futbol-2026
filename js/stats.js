(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const LABEL = {
    "M13-15":"Masculino 13–15",
    "M16-22":"Masculino 16–22",
    "F-LIBRE":"Femenino Libre"
  };
  const EVENT_LABEL = {
    GOAL:"⚽ Gol",
    YELLOW:"🟨 Amarilla",
    BLUE:"🟦 Azul",
    RED:"🟥 Roja"
  };

  let client = null;
  let teams = [];
  let participants = [];
  let fixtureMatches = [];
  let playoffMatches = [];
  let fixtures = [];
  let playoffs = [];
  let events = [];
  let sanctions = [];
  let currentLog = "events";

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);

  function setup() {
    if (client) return true;
    const cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return false;
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:true,autoRefreshToken:true}}
    );
    return true;
  }

  async function isAdmin() {
    if (!setup()) return false;
    const {data:{session}} = await client.auth.getSession();
    if (!session) return false;
    const {data,error} = await client.rpc("is_admin");
    return !error && data === true;
  }

  function notice(msg,danger=false) {
    const box = $("statsNotice");
    box.textContent = msg;
    box.classList.remove("hidden");
    box.classList.toggle("danger",danger);
    box.classList.toggle("warning",!danger);
  }

  function clearNotice() {
    $("statsNotice").classList.add("hidden");
  }

  function teamName(id) {
    return teams.find(t=>t.id===id)?.team_name || "Equipo";
  }

  function participantName(id) {
    const p=participants.find(x=>x.id===id);
    return p ? `${p.first_name} ${p.last_name}` : "Jugador/a";
  }

  function showStatsView() {
    $("teamsAdminView")?.classList.add("hidden");
    $("fixtureAdminView")?.classList.add("hidden");
    $("competitionAdminView")?.classList.add("hidden");
    $("statsAdminView")?.classList.remove("hidden");

    ["teamsTabBtn","fixtureTabBtn","competitionTabBtn"].forEach(id =>
      $(id)?.classList.remove("active")
    );
    $("statsTabBtn")?.classList.add("active");
  }

  function hideStatsView() {
    $("statsAdminView")?.classList.add("hidden");
    $("statsTabBtn")?.classList.remove("active");
  }

  async function loadAll() {
    if (!await isAdmin()) {
      notice("Iniciá sesión como administrador.",true);
      return;
    }

    clearNotice();

    const results = await Promise.all([
      client.from("teams").select("id,team_name,category,registration_number").eq("is_submitted",true),
      client.from("participants").select("id,team_id,first_name,last_name,ci"),
      client.from("fixtures").select("id,category,fixture_name,status"),
      client.from("fixture_matches").select("*"),
      client.from("playoffs").select("id,category,playoff_name,status"),
      client.from("playoff_matches").select("*"),
      client.from("match_events").select("*").order("created_at",{ascending:false}),
      client.from("sanctions").select("*").order("created_at",{ascending:false})
    ]);

    const err=results.find(r=>r.error)?.error;
    if (err) throw err;

    [teams,participants,fixtures,fixtureMatches,playoffs,playoffMatches,events,sanctions]
      = results.map(r=>r.data||[]);

    populateMatchSelect();
    populateSanctionParticipants();
    renderSummary();
    renderLogs();
  }

  function categoryTeams(category) {
    return teams.filter(t=>t.category===category);
  }

  function matchLabel(type,m) {
    const a=teamName(m.team_a_id);
    const b=teamName(m.team_b_id);
    if (type==="F") {
      const f=fixtures.find(x=>x.id===m.fixture_id);
      return `${f?.fixture_name || "Fixture"} · Fecha ${m.round_number} · ${a} vs ${b}`;
    }
    const p=playoffs.find(x=>x.id===m.playoff_id);
    return `${p?.playoff_name || "Definición"} · ${m.stage}${m.stage==="Semifinal" ? " "+m.match_order : ""} · ${a} vs ${b}`;
  }

  function availableMatches(category) {
    const fixtureIds=new Set(fixtures.filter(f=>f.category===category).map(f=>f.id));
    const playoffIds=new Set(playoffs.filter(p=>p.category===category).map(p=>p.id));

    const a=fixtureMatches
      .filter(m=>fixtureIds.has(m.fixture_id) && !m.is_bye && m.team_a_id && m.team_b_id)
      .map(m=>({key:`F:${m.id}`,type:"F",match:m,label:matchLabel("F",m)}));

    const b=playoffMatches
      .filter(m=>playoffIds.has(m.playoff_id) && m.team_a_id && m.team_b_id)
      .map(m=>({key:`P:${m.id}`,type:"P",match:m,label:matchLabel("P",m)}));

    return [...a,...b];
  }

  function populateMatchSelect() {
    const category=$("statsCategory").value;
    const list=availableMatches(category);

    $("statsMatch").innerHTML=list.length
      ? list.map(x=>`<option value="${x.key}">${esc(x.label)}</option>`).join("")
      : `<option value="">No hay partidos disponibles</option>`;

    populateMatchParticipants();
  }

  function selectedMatch() {
    const value=$("statsMatch").value;
    if (!value) return null;
    const [type,id]=value.split(":");
    const match=type==="F"
      ? fixtureMatches.find(m=>m.id===id)
      : playoffMatches.find(m=>m.id===id);
    return match ? {type,match} : null;
  }

  function populateMatchParticipants() {
    const selected=selectedMatch();
    if (!selected) {
      $("statsParticipant").innerHTML='<option value="">Sin jugadores</option>';
      return;
    }

    const ids=[selected.match.team_a_id,selected.match.team_b_id];
    const rows=participants
      .filter(p=>ids.includes(p.team_id))
      .sort((a,b)=>participantName(a.id).localeCompare(participantName(b.id),"es"));

    $("statsParticipant").innerHTML=rows.map(p=>
      `<option value="${p.id}">${esc(participantName(p.id))} · ${esc(teamName(p.team_id))}</option>`
    ).join("");
  }

  function populateSanctionParticipants() {
    const category=$("sanctionCategory").value;
    const teamIds=new Set(categoryTeams(category).map(t=>t.id));
    const rows=participants
      .filter(p=>teamIds.has(p.team_id))
      .sort((a,b)=>participantName(a.id).localeCompare(participantName(b.id),"es"));

    $("sanctionParticipant").innerHTML=rows.map(p=>
      `<option value="${p.id}">${esc(participantName(p.id))} · ${esc(teamName(p.team_id))}</option>`
    ).join("");
  }

  async function addEvent() {
    clearNotice();
    const selected=selectedMatch();
    const pid=$("statsParticipant").value;
    const p=participants.find(x=>x.id===pid);

    if (!selected || !p) {
      notice("Seleccioná un partido y un jugador.",true);
      return;
    }

    const eventType=$("statsEventType").value;
    let quantity=Number($("statsEventQuantity").value||1);
    if (eventType!=="GOAL") quantity=1;
    quantity=Math.max(1,Math.min(20,quantity));

    const minuteRaw=$("statsEventMinute").value;
    const minute=minuteRaw==="" ? null : Number(minuteRaw);

    const {data:{user}}=await client.auth.getUser();

    const payload={
      category:$("statsCategory").value,
      fixture_match_id:selected.type==="F" ? selected.match.id : null,
      playoff_match_id:selected.type==="P" ? selected.match.id : null,
      team_id:p.team_id,
      participant_id:p.id,
      event_type:eventType,
      quantity,
      event_minute:minute,
      notes:$("statsEventNotes").value.trim()||null,
      created_by:user?.id||null
    };

    const {error}=await client.from("match_events").insert(payload);
    if (error) {
      notice(error.message,true);
      return;
    }

    $("statsEventQuantity").value="1";
    $("statsEventMinute").value="";
    $("statsEventNotes").value="";
    notice("Evento registrado.");
    await loadAll();
  }

  async function addSanction() {
    clearNotice();
    const pid=$("sanctionParticipant").value;
    const p=participants.find(x=>x.id===pid);
    const reason=$("sanctionReason").value.trim();

    if (!p || !reason) {
      notice("Seleccioná un jugador e indicá el motivo.",true);
      return;
    }

    const {data:{user}}=await client.auth.getUser();

    const payload={
      category:$("sanctionCategory").value,
      team_id:p.team_id,
      participant_id:p.id,
      reason,
      matches_suspended:Number($("sanctionMatches").value||0),
      status:$("sanctionStatus").value,
      notes:$("sanctionNotes").value.trim()||null,
      created_by:user?.id||null
    };

    const {error}=await client.from("sanctions").insert(payload);
    if (error) {
      notice(error.message,true);
      return;
    }

    $("sanctionReason").value="";
    $("sanctionMatches").value="1";
    $("sanctionNotes").value="";
    notice("Sanción registrada.");
    await loadAll();
  }

  function statsFor(category) {
    const teamIds=new Set(categoryTeams(category).map(t=>t.id));
    const scorerMap=new Map();
    const teamCards=new Map();

    categoryTeams(category).forEach(t=>{
      teamCards.set(t.id,{team_id:t.id,team_name:t.team_name,yellow:0,blue:0,red:0});
    });

    events.filter(e=>e.category===category).forEach(e=>{
      if (e.event_type==="GOAL") {
        const current=scorerMap.get(e.participant_id)||{
          participant_id:e.participant_id,
          name:participantName(e.participant_id),
          team_name:teamName(e.team_id),
          goals:0
        };
        current.goals+=Number(e.quantity||1);
        scorerMap.set(e.participant_id,current);
      } else {
        const r=teamCards.get(e.team_id);
        if (r) {
          if (e.event_type==="YELLOW") r.yellow+=1;
          if (e.event_type==="BLUE") r.blue+=1;
          if (e.event_type==="RED") r.red+=1;
        }
      }
    });

    return {
      scorers:[...scorerMap.values()].sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,"es")),
      cards:[...teamCards.values()].sort((a,b)=>b.red-a.red||b.yellow-a.yellow||a.team_name.localeCompare(b.team_name,"es")),
      activeSanctions:sanctions.filter(s=>s.category===category&&s.status==="Activa")
    };
  }

  function champion(category) {
    const ps=playoffs
      .filter(p=>p.category===category)
      .sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
    for (const p of ps) {
      const final=playoffMatches.find(m=>m.playoff_id===p.id&&m.stage==="Final"&&m.match_status==="Jugado"&&m.winner_team_id);
      if (final) {
        const runner=final.winner_team_id===final.team_a_id ? final.team_b_id : final.team_a_id;
        return {winner:teamName(final.winner_team_id),runner:teamName(runner)};
      }
    }
    return null;
  }

  function renderSummary() {
    $("statsCategorySummary").innerHTML=Object.keys(LABEL).map(category=>{
      const s=statsFor(category);
      const champ=champion(category);
      const top=s.scorers[0];

      return `
        <article class="stats-summary-card">
          <div class="stats-summary-head">
            <div>
              <span class="stats-kicker">${esc(LABEL[category])}</span>
              <h3>Resumen deportivo</h3>
            </div>
            <span class="stats-summary-icon">🏅</span>
          </div>

          <div class="stats-highlight-grid">
            <div class="stats-highlight">
              <span>Campeón</span>
              <strong>${esc(champ?.winner || "A definir")}</strong>
              <small>${champ ? `Subcampeón: ${esc(champ.runner)}` : "Esperando definición"}</small>
            </div>
            <div class="stats-highlight">
              <span>Goleador/a</span>
              <strong>${esc(top?.name || "A definir")}</strong>
              <small>${top ? `${top.goals} gol${top.goals===1?"":"es"} · ${esc(top.team_name)}` : "Sin goles cargados"}</small>
            </div>
            <div class="stats-highlight">
              <span>Sanciones activas</span>
              <strong>${s.activeSanctions.length}</strong>
              <small>Seguimiento interno</small>
            </div>
          </div>

          <div class="stats-tables-grid">
            <div>
              <h4>⚽ Goleadores</h4>
              ${
                s.scorers.length
                  ? `<div class="mini-ranking">${s.scorers.slice(0,8).map((r,i)=>`
                      <div><span>${i+1}</span><strong>${esc(r.name)}</strong><small>${esc(r.team_name)}</small><b>${r.goals}</b></div>
                    `).join("")}</div>`
                  : `<p class="help">Todavía no hay goles registrados.</p>`
              }
            </div>

            <div>
              <h4>🟨🟦🟥 Tarjetas por equipo</h4>
              <div class="discipline-mini">
                ${s.cards.map(r=>`
                  <div>
                    <strong>${esc(r.team_name)}</strong>
                    <span>🟨 ${r.yellow}</span>
                    <span>🟦 ${r.blue}</span>
                    <span>🟥 ${r.red}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function matchEventDescription(e) {
    const minute=e.event_minute!==null&&e.event_minute!==undefined ? ` · ${e.event_minute}'` : "";
    const qty=e.event_type==="GOAL"&&Number(e.quantity)>1 ? ` ×${e.quantity}` : "";
    return `${EVENT_LABEL[e.event_type]||e.event_type}${qty}${minute}`;
  }

  function renderEventsLog() {
    $("eventsLog").innerHTML=events.length ? `
      <div class="admin-log-list">
        ${events.slice(0,150).map(e=>`
          <div class="admin-log-row">
            <div>
              <strong>${esc(participantName(e.participant_id))}</strong>
              <small>${esc(teamName(e.team_id))} · ${esc(LABEL[e.category])}</small>
            </div>
            <div>
              <strong>${esc(matchEventDescription(e))}</strong>
              <small>${esc(e.notes||"")}</small>
            </div>
            <button class="btn danger delete-match-event" data-id="${e.id}" type="button">Eliminar</button>
          </div>
        `).join("")}
      </div>
    ` : `<p class="help">No hay eventos registrados.</p>`;
  }

  function renderSanctionsLog() {
    $("sanctionsLog").innerHTML=sanctions.length ? `
      <div class="admin-log-list">
        ${sanctions.map(s=>`
          <div class="admin-log-row sanction-row">
            <div>
              <strong>${esc(participantName(s.participant_id))}</strong>
              <small>${esc(teamName(s.team_id))} · ${esc(LABEL[s.category])}</small>
            </div>
            <div>
              <strong>${esc(s.reason)}</strong>
              <small>${s.matches_suspended} partido${s.matches_suspended===1?"":"s"} · ${esc(s.notes||"")}</small>
            </div>
            <select class="sanction-status-edit" data-id="${s.id}">
              <option ${s.status==="Activa"?"selected":""}>Activa</option>
              <option ${s.status==="Cumplida"?"selected":""}>Cumplida</option>
              <option ${s.status==="Anulada"?"selected":""}>Anulada</option>
            </select>
            <button class="btn light save-sanction-status" data-id="${s.id}" type="button">Guardar</button>
          </div>
        `).join("")}
      </div>
    ` : `<p class="help">No hay sanciones registradas.</p>`;
  }

  function renderLogs() {
    renderEventsLog();
    renderSanctionsLog();
    $("eventsLog").classList.toggle("hidden",currentLog!=="events");
    $("sanctionsLog").classList.toggle("hidden",currentLog!=="sanctions");
    $("eventsLogTab").classList.toggle("active",currentLog==="events");
    $("sanctionsLogTab").classList.toggle("active",currentLog==="sanctions");
  }

  async function deleteEvent(id) {
    if (!confirm("¿Eliminar este evento?")) return;
    const {error}=await client.from("match_events").delete().eq("id",id);
    if (error) notice(error.message,true);
    else {
      notice("Evento eliminado.");
      await loadAll();
    }
  }

  async function saveSanctionStatus(id) {
    const select=document.querySelector(`.sanction-status-edit[data-id="${id}"]`);
    if (!select) return;
    const {error}=await client.from("sanctions").update({status:select.value}).eq("id",id);
    if (error) notice(error.message,true);
    else {
      notice("Sanción actualizada.");
      await loadAll();
    }
  }

  async function openStats() {
    showStatsView();
    try {
      await loadAll();
    } catch(e) {
      notice(`No se pudo cargar la Etapa 4. Ejecutá supabase/stats-migration.sql. Detalle: ${e.message}`,true);
    }
  }

  document.addEventListener("click",e=>{
    const t=e.target;
    if (t.id==="statsTabBtn") openStats();
    if (["teamsTabBtn","fixtureTabBtn","competitionTabBtn"].includes(t.id)) hideStatsView();
    if (t.matches(".delete-match-event")) deleteEvent(t.dataset.id);
    if (t.matches(".save-sanction-status")) saveSanctionStatus(t.dataset.id);
  });

  $("statsCategory")?.addEventListener("change",populateMatchSelect);
  $("statsMatch")?.addEventListener("change",populateMatchParticipants);
  $("statsEventType")?.addEventListener("change",()=>{
    const isGoal=$("statsEventType").value==="GOAL";
    $("statsEventQuantity").disabled=!isGoal;
    if (!isGoal) $("statsEventQuantity").value="1";
  });
  $("sanctionCategory")?.addEventListener("change",populateSanctionParticipants);
  $("addMatchEventBtn")?.addEventListener("click",addEvent);
  $("addSanctionBtn")?.addEventListener("click",addSanction);
  $("reloadStatsBtn")?.addEventListener("click",loadAll);

  $("eventsLogTab")?.addEventListener("click",()=>{currentLog="events";renderLogs();});
  $("sanctionsLogTab")?.addEventListener("click",()=>{currentLog="sanctions";renderLogs();});
})();
