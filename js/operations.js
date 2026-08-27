(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const LABEL = {
    "M13-15":"Masculino 13–15",
    "M16-22":"Masculino 16–22",
    "F-LIBRE":"Femenino Libre"
  };

  let client = null;
  let teams = [];
  let fixtures = [];
  let fixtureMatches = [];
  let playoffs = [];
  let playoffMatches = [];
  let days = [];
  let slots = [];

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

  function notice(message,danger=false) {
    const box=$("operationsNotice");
    box.textContent=message;
    box.classList.remove("hidden");
    box.classList.toggle("danger",danger);
    box.classList.toggle("warning",!danger);
  }

  function clearNotice() {
    $("operationsNotice").classList.add("hidden");
  }

  function showView() {
    ["teamsAdminView","fixtureAdminView","competitionAdminView","statsAdminView"]
      .forEach(id => $(id)?.classList.add("hidden"));
    $("operationsAdminView")?.classList.remove("hidden");

    ["teamsTabBtn","fixtureTabBtn","competitionTabBtn","statsTabBtn"]
      .forEach(id => $(id)?.classList.remove("active"));
    $("operationsTabBtn")?.classList.add("active");
  }

  function hideView() {
    $("operationsAdminView")?.classList.add("hidden");
    $("operationsTabBtn")?.classList.remove("active");
  }

  function teamName(id) {
    return teams.find(t=>t.id===id)?.team_name || "Equipo";
  }

  async function loadAll() {
    if (!await isAdmin()) {
      notice("Iniciá sesión como administrador.",true);
      return;
    }

    clearNotice();

    const results=await Promise.all([
      client.from("teams").select("id,team_name,category,registration_number").eq("is_submitted",true),
      client.from("fixtures").select("*"),
      client.from("fixture_matches").select("*").order("round_number",{ascending:true}).order("match_order",{ascending:true}),
      client.from("playoffs").select("*"),
      client.from("playoff_matches").select("*").order("created_at",{ascending:true}),
      client.from("operation_days").select("*").order("event_date",{ascending:true}).order("start_time",{ascending:true}),
      client.from("operation_slots").select("*").order("scheduled_start",{ascending:true}).order("sequence_number",{ascending:true})
    ]);

    const err=results.find(r=>r.error)?.error;
    if (err) throw err;

    [teams,fixtures,fixtureMatches,playoffs,playoffMatches,days,slots]=results.map(r=>r.data||[]);

    updatePreview();
    renderDays();
  }

  function sourceMatches() {
    const category=$("opCategory").value;
    const phase=$("opPhase").value;

    const scheduledFixtureIds=new Set(slots.filter(s=>s.fixture_match_id).map(s=>s.fixture_match_id));
    const scheduledPlayoffIds=new Set(slots.filter(s=>s.playoff_match_id).map(s=>s.playoff_match_id));

    if (phase==="FIXTURE") {
      const fixtureIds=new Set(
        fixtures
          .filter(f=>category==="ALL"||f.category===category)
          .map(f=>f.id)
      );

      return fixtureMatches
        .filter(m=>
          fixtureIds.has(m.fixture_id) &&
          !m.is_bye &&
          m.team_a_id &&
          m.team_b_id &&
          !scheduledFixtureIds.has(m.id)
        )
        .map(m=>{
          const f=fixtures.find(x=>x.id===m.fixture_id);
          return {
            source_type:"FIXTURE",
            source_id:m.id,
            category:f?.category || teams.find(t=>t.id===m.team_a_id)?.category,
            team_a_id:m.team_a_id,
            team_b_id:m.team_b_id,
            order_key:`${f?.category||""}-${String(m.round_number).padStart(3,"0")}-${String(m.match_order).padStart(3,"0")}`,
            label:`${LABEL[f?.category]||f?.category} · Fecha ${m.round_number} · ${teamName(m.team_a_id)} vs ${teamName(m.team_b_id)}`
          };
        })
        .sort((a,b)=>a.order_key.localeCompare(b.order_key));
    }

    const playoffIds=new Set(
      playoffs
        .filter(p=>category==="ALL"||p.category===category)
        .map(p=>p.id)
    );

    return playoffMatches
      .filter(m=>
        playoffIds.has(m.playoff_id) &&
        m.team_a_id &&
        m.team_b_id &&
        !scheduledPlayoffIds.has(m.id)
      )
      .map(m=>{
        const p=playoffs.find(x=>x.id===m.playoff_id);
        const stageOrder=m.stage==="Semifinal" ? 1 : 2;
        return {
          source_type:"PLAYOFF",
          source_id:m.id,
          category:p?.category || teams.find(t=>t.id===m.team_a_id)?.category,
          team_a_id:m.team_a_id,
          team_b_id:m.team_b_id,
          order_key:`${p?.category||""}-${stageOrder}-${String(m.match_order).padStart(3,"0")}`,
          label:`${LABEL[p?.category]||p?.category} · ${m.stage}${m.stage==="Semifinal" ? " "+m.match_order : ""} · ${teamName(m.team_a_id)} vs ${teamName(m.team_b_id)}`
        };
      })
      .sort((a,b)=>a.order_key.localeCompare(b.order_key));
  }

  function updatePreview() {
    if (!$("operationsPreviewInfo")) return;
    const matches=sourceMatches();
    const phase=$("opPhase").value==="FIXTURE" ? "fase regular" : "definición";
    $("operationsPreviewInfo").innerHTML = matches.length
      ? `<strong>${matches.length}</strong> partido${matches.length===1?"":"s"} sin programar para ${phase}.`
      : `No hay partidos pendientes de programación con esos filtros.`;
  }

  function parseCourts() {
    const courts=$("opCourts").value
      .split(",")
      .map(x=>x.trim())
      .filter(Boolean);
    return [...new Set(courts)];
  }

  function localDateTime(dateStr,timeStr) {
    return new Date(`${dateStr}T${timeStr}:00`);
  }

  function addMinutes(date,minutes) {
    return new Date(date.getTime()+minutes*60000);
  }

  function scheduleMatches(matches,config) {
    const courts=config.courts.map(name=>({
      name,
      available:new Date(config.start)
    }));

    const teamLastEnd=new Map();
    const result=[];

    matches.forEach((match,index)=>{
      let best=null;

      courts.forEach(court=>{
        let candidate=new Date(court.available);

        for (const tid of [match.team_a_id,match.team_b_id]) {
          const last=teamLastEnd.get(tid);
          if (last) {
            const earliest=addMinutes(last,config.rest_minutes);
            if (earliest>candidate) candidate=earliest;
          }
        }

        if (!best || candidate<best.start || (candidate.getTime()===best.start.getTime() && court.name<best.court.name)) {
          best={court,start:candidate};
        }
      });

      const end=addMinutes(best.start,config.match_minutes);
      result.push({
        ...match,
        court_name:best.court.name,
        scheduled_start:best.start,
        scheduled_end:end,
        sequence_number:index+1
      });

      best.court.available=addMinutes(end,config.gap_minutes);
      teamLastEnd.set(match.team_a_id,end);
      teamLastEnd.set(match.team_b_id,end);
    });

    return result;
  }

  async function syncSourceSchedule(item) {
    const payload={
      match_date:item.scheduled_start.toISOString().slice(0,10),
      match_time:item.scheduled_start.toTimeString().slice(0,5),
      court:item.court_name
    };

    if (item.source_type==="FIXTURE") {
      return client.from("fixture_matches").update(payload).eq("id",item.source_id);
    }
    return client.from("playoff_matches").update(payload).eq("id",item.source_id);
  }

  async function generateDay() {
    clearNotice();

    const title=$("opDayTitle").value.trim();
    const date=$("opDate").value;
    const time=$("opStartTime").value;
    const courts=parseCourts();
    const matches=sourceMatches();

    if (!title||!date||!time) {
      notice("Completá nombre, fecha y hora de inicio.",true);
      return;
    }
    if (!courts.length) {
      notice("Ingresá al menos una cancha.",true);
      return;
    }
    if (!matches.length) {
      notice("No hay partidos pendientes para programar.",true);
      return;
    }

    const matchMinutes=Number($("opMatchMinutes").value||30);
    const gapMinutes=Number($("opGapMinutes").value||0);
    const restMinutes=Number($("opRestMinutes").value||0);
    const callMinutes=Number($("opCallMinutes").value||0);

    const generated=scheduleMatches(matches,{
      courts,
      start:localDateTime(date,time),
      match_minutes:matchMinutes,
      gap_minutes:gapMinutes,
      rest_minutes:restMinutes
    });

    const lastEnd=generated.reduce((max,x)=>x.scheduled_end>max?x.scheduled_end:max,generated[0].scheduled_end);
    const ok=window.confirm(
      `Se programarán ${generated.length} partidos en ${courts.length} cancha${courts.length===1?"":"s"}.\n\n`+
      `Inicio: ${generated[0].scheduled_start.toLocaleString("es-UY")}\n`+
      `Fin estimado: ${lastEnd.toLocaleString("es-UY")}\n\n`+
      `¿Crear la jornada?`
    );
    if (!ok) return;

    const {data:{user}}=await client.auth.getUser();

    const {data:day,error:dayError}=await client
      .from("operation_days")
      .insert({
        title,
        event_date:date,
        start_time:time,
        match_minutes:matchMinutes,
        gap_minutes:gapMinutes,
        rest_minutes:restMinutes,
        call_minutes:callMinutes,
        courts,
        created_by:user?.id||null
      })
      .select()
      .single();

    if (dayError) {
      notice(dayError.message,true);
      return;
    }

    const rows=generated.map(x=>({
      day_id:day.id,
      category:x.category,
      source_type:x.source_type,
      fixture_match_id:x.source_type==="FIXTURE" ? x.source_id : null,
      playoff_match_id:x.source_type==="PLAYOFF" ? x.source_id : null,
      court_name:x.court_name,
      scheduled_start:x.scheduled_start.toISOString(),
      scheduled_end:x.scheduled_end.toISOString(),
      sequence_number:x.sequence_number
    }));

    const {error:slotError}=await client.from("operation_slots").insert(rows);
    if (slotError) {
      await client.from("operation_days").delete().eq("id",day.id);
      notice(slotError.message,true);
      return;
    }

    for (const item of generated) {
      await syncSourceSchedule(item);
    }

    notice("Jornada creada y horarios sincronizados con los partidos.");
    await loadAll();
  }

  function slotTeams(slot) {
    if (slot.source_type==="FIXTURE") {
      const m=fixtureMatches.find(x=>x.id===slot.fixture_match_id);
      return m ? {a:m.team_a_id,b:m.team_b_id,score_a:m.score_a,score_b:m.score_b,penalty_a:null,penalty_b:null} : null;
    }
    const m=playoffMatches.find(x=>x.id===slot.playoff_match_id);
    return m ? {a:m.team_a_id,b:m.team_b_id,score_a:m.score_a,score_b:m.score_b,penalty_a:m.penalty_a,penalty_b:m.penalty_b} : null;
  }

  function timeLabel(iso) {
    return new Date(iso).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
  }

  function dateLabel(dateStr) {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-UY",{
      weekday:"long",day:"2-digit",month:"long"
    });
  }

  function renderDays() {
    if (!days.length) {
      $("operationDaysList").innerHTML=`
        <div class="operations-empty">
          <span>⏱️</span>
          <strong>Todavía no hay jornadas creadas</strong>
          <small>Usá el generador superior cuando tengas partidos listos para programar.</small>
        </div>`;
      return;
    }

    $("operationDaysList").innerHTML=days.map(day=>{
      const daySlots=slots.filter(s=>s.day_id===day.id);
      const courts=[...new Set(daySlots.map(s=>s.court_name))];

      return `
        <article class="operation-day-card">
          <div class="operation-day-head">
            <div>
              <span class="operations-kicker">${esc(dateLabel(day.event_date))}</span>
              <h3>${esc(day.title)}</h3>
              <p class="small">
                ${daySlots.length} partidos · ${courts.length} cancha${courts.length===1?"":"s"} ·
                ${day.match_minutes} min/partido · descanso mínimo ${day.rest_minutes} min
              </p>
            </div>

            <div class="operation-day-actions">
              <select class="operation-day-status" data-id="${day.id}">
                <option ${day.status==="Borrador"?"selected":""}>Borrador</option>
                <option ${day.status==="Publicado"?"selected":""}>Publicado</option>
                <option ${day.status==="Finalizado"?"selected":""}>Finalizado</option>
              </select>
              <button class="btn light save-operation-day" data-id="${day.id}" type="button">Guardar estado</button>
              <button class="btn danger delete-operation-day" data-id="${day.id}" type="button">Eliminar</button>
            </div>
          </div>

          <div class="operation-court-columns">
            ${courts.map(court=>`
              <section class="operation-court">
                <h4>🏟️ ${esc(court)}</h4>
                ${daySlots.filter(s=>s.court_name===court).map(slot=>renderSlot(slot)).join("")}
              </section>
            `).join("")}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderSlot(slot) {
    const t=slotTeams(slot);
    if (!t) return "";
    const a=teamName(t.a),b=teamName(t.b);

    return `
      <article class="operation-slot status-${slot.operational_status.toLowerCase().replaceAll(" ","-")}">
        <div class="operation-slot-top">
          <strong>${timeLabel(slot.scheduled_start)}</strong>
          <span>${esc(LABEL[slot.category]||slot.category)}</span>
        </div>

        <div class="operation-slot-teams">
          <strong>${esc(a)}</strong>
          <span>vs.</span>
          <strong>${esc(b)}</strong>
        </div>

        <div class="operation-slot-controls">
          <select class="slot-status" data-id="${slot.id}">
            ${["Programado","Llamado","En juego","Finalizado","Demorado","Suspendido"].map(s=>
              `<option ${slot.operational_status===s?"selected":""}>${s}</option>`
            ).join("")}
          </select>

          <div class="slot-score">
            <input class="slot-score-a" data-id="${slot.id}" type="number" min="0" value="${t.score_a ?? ""}" placeholder="0">
            <span>–</span>
            <input class="slot-score-b" data-id="${slot.id}" type="number" min="0" value="${t.score_b ?? ""}" placeholder="0">
          </div>

          <input class="slot-notes" data-id="${slot.id}" value="${esc(slot.notes||"")}" placeholder="Nota / demora">

          <button class="btn dark save-operation-slot" data-id="${slot.id}" type="button">Guardar</button>
        </div>
      </article>
    `;
  }

  async function saveDayStatus(id) {
    const select=document.querySelector(`.operation-day-status[data-id="${id}"]`);
    if (!select) return;
    const {error}=await client.from("operation_days").update({status:select.value}).eq("id",id);
    if (error) notice(error.message,true);
    else {
      notice("Estado de jornada actualizado.");
      await loadAll();
    }
  }

  async function deleteDay(id) {
    if (!confirm("¿Eliminar esta jornada? Los partidos conservarán sus resultados, pero se borrará el cronograma operativo.")) return;
    const {error}=await client.from("operation_days").delete().eq("id",id);
    if (error) notice(error.message,true);
    else {
      notice("Jornada eliminada.");
      await loadAll();
    }
  }

  async function saveSlot(id) {
    const slot=slots.find(s=>s.id===id);
    if (!slot) return;

    const status=document.querySelector(`.slot-status[data-id="${id}"]`)?.value || "Programado";
    const notes=document.querySelector(`.slot-notes[data-id="${id}"]`)?.value.trim() || null;
    const rawA=document.querySelector(`.slot-score-a[data-id="${id}"]`)?.value ?? "";
    const rawB=document.querySelector(`.slot-score-b[data-id="${id}"]`)?.value ?? "";
    const scoreA=rawA==="" ? null : Number(rawA);
    const scoreB=rawB==="" ? null : Number(rawB);

    const {error}=await client
      .from("operation_slots")
      .update({
        operational_status:status,
        notes,
        updated_at:new Date().toISOString()
      })
      .eq("id",id);

    if (error) {
      notice(error.message,true);
      return;
    }

    const matchPayload={
      score_a:scoreA,
      score_b:scoreB
    };

    if (status==="Finalizado") {
      matchPayload.match_status="Jugado";
    } else if (status==="Suspendido") {
      matchPayload.match_status="Suspendido";
    } else {
      matchPayload.match_status="Programado";
    }

    if (slot.source_type==="FIXTURE") {
      await client.from("fixture_matches").update(matchPayload).eq("id",slot.fixture_match_id);
    } else {
      await client.from("playoff_matches").update(matchPayload).eq("id",slot.playoff_match_id);
    }

    notice("Partido actualizado.");
    await loadAll();
  }

  async function openOperations() {
    showView();
    try {
      await loadAll();
    } catch(e) {
      notice(`No se pudo cargar la Etapa 5. Ejecutá supabase/operations-migration.sql. Detalle: ${e.message}`,true);
    }
  }

  document.addEventListener("click",e=>{
    const t=e.target;
    if (t.id==="operationsTabBtn") openOperations();
    if (["teamsTabBtn","fixtureTabBtn","competitionTabBtn","statsTabBtn"].includes(t.id)) hideView();
    if (t.matches(".save-operation-day")) saveDayStatus(t.dataset.id);
    if (t.matches(".delete-operation-day")) deleteDay(t.dataset.id);
    if (t.matches(".save-operation-slot")) saveSlot(t.dataset.id);
  });

  ["opCategory","opPhase"].forEach(id=>$(id)?.addEventListener("change",updatePreview));
  $("generateOperationDayBtn")?.addEventListener("click",generateDay);
  $("reloadOperationsBtn")?.addEventListener("click",loadAll);
})();
