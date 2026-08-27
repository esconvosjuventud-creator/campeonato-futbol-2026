(() => {
  "use strict";

  const $=id=>document.getElementById(id);
  const LABEL={
    "M13-15":"Masculino 13–15",
    "M16-22":"Masculino 16–22",
    "F-LIBRE":"Femenino Libre"
  };
  const AWARD_LABEL={
    CHAMPION:"Campeón",
    RUNNER_UP:"Subcampeón",
    TOP_SCORER:"Goleador/a",
    FAIR_PLAY:"Reconocimiento Fair Play",
    SPECIAL:"Reconocimiento especial"
  };

  let client=null;
  let teams=[];
  let participants=[];
  let fixtures=[];
  let fixtureMatches=[];
  let playoffs=[];
  let playoffMatches=[];
  let events=[];
  let awards=[];
  let closingRows=[];

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);

  function setup(){
    if(client)return true;
    const cfg=window.APP_CONFIG||{};
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return false;
    client=window.supabase.createClient(
      cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:true,autoRefreshToken:true}}
    );
    return true;
  }

  async function isAdmin(){
    if(!setup())return false;
    const {data:{session}}=await client.auth.getSession();
    if(!session)return false;
    const {data,error}=await client.rpc("is_admin");
    return !error&&data===true;
  }

  function notice(msg,danger=false){
    const box=$("closingNotice");
    box.textContent=msg;
    box.classList.remove("hidden");
    box.classList.toggle("danger",danger);
    box.classList.toggle("warning",!danger);
  }

  function clearNotice(){
    $("closingNotice").classList.add("hidden");
  }

  function showView(){
    ["teamsAdminView","fixtureAdminView","competitionAdminView","statsAdminView","operationsAdminView"]
      .forEach(id=>$(id)?.classList.add("hidden"));
    $("closingAdminView")?.classList.remove("hidden");

    ["teamsTabBtn","fixtureTabBtn","competitionTabBtn","statsTabBtn","operationsTabBtn"]
      .forEach(id=>$(id)?.classList.remove("active"));
    $("closingTabBtn")?.classList.add("active");
  }

  function hideView(){
    $("closingAdminView")?.classList.add("hidden");
    $("closingTabBtn")?.classList.remove("active");
  }

  function teamName(id){
    return teams.find(t=>t.id===id)?.team_name||"Equipo";
  }

  function participantName(id){
    const p=participants.find(x=>x.id===id);
    return p?`${p.first_name} ${p.last_name}`:"Jugador/a";
  }

  async function loadAll(){
    if(!await isAdmin()){
      notice("Iniciá sesión como administrador.",true);
      return;
    }

    clearNotice();

    const results=await Promise.all([
      client.from("teams").select("id,team_name,category,registration_number,status").eq("is_submitted",true),
      client.from("participants").select("id,team_id,first_name,last_name"),
      client.from("fixtures").select("*"),
      client.from("fixture_matches").select("*"),
      client.from("playoffs").select("*").order("created_at",{ascending:false}),
      client.from("playoff_matches").select("*"),
      client.from("match_events").select("*"),
      client.from("championship_awards").select("*").order("created_at",{ascending:true}),
      client.from("championship_closing").select("*").order("updated_at",{ascending:false})
    ]);

    const err=results.find(r=>r.error)?.error;
    if(err)throw err;

    [teams,participants,fixtures,fixtureMatches,playoffs,playoffMatches,events,awards,closingRows]
      =results.map(r=>r.data||[]);

    renderGlobalSummary();
    renderCategories();
    fillClosingForm();
  }

  function categoryFinal(category){
    const ps=playoffs
      .filter(p=>p.category===category)
      .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));

    for(const p of ps){
      const final=playoffMatches.find(m=>
        m.playoff_id===p.id &&
        m.stage==="Final" &&
        m.match_status==="Jugado" &&
        m.winner_team_id
      );
      if(final){
        return{
          winner_id:final.winner_team_id,
          runner_id:final.winner_team_id===final.team_a_id?final.team_b_id:final.team_a_id
        };
      }
    }
    return null;
  }

  function topScorer(category){
    const map=new Map();
    events
      .filter(e=>e.category===category&&e.event_type==="GOAL")
      .forEach(e=>{
        const row=map.get(e.participant_id)||{
          participant_id:e.participant_id,
          team_id:e.team_id,
          goals:0
        };
        row.goals+=Number(e.quantity||1);
        map.set(e.participant_id,row);
      });

    return [...map.values()]
      .sort((a,b)=>b.goals-a.goals||participantName(a.participant_id).localeCompare(participantName(b.participant_id),"es"))[0]||null;
  }

  function counts(){
    const playedFixture=fixtureMatches.filter(m=>m.match_status==="Jugado").length;
    const playedPlayoff=playoffMatches.filter(m=>m.match_status==="Jugado").length;
    const goals=events.filter(e=>e.event_type==="GOAL").reduce((a,e)=>a+Number(e.quantity||1),0);
    const cards=events.filter(e=>["YELLOW","BLUE","RED"].includes(e.event_type)).length;

    return{
      teams:teams.length,
      participants:participants.length,
      matches:playedFixture+playedPlayoff,
      goals,
      cards
    };
  }

  function renderGlobalSummary(){
    const c=counts();
    $("closingGlobalSummary").innerHTML=`
      <article><span>Equipos</span><strong>${c.teams}</strong><small>inscriptos</small></article>
      <article><span>Participantes</span><strong>${c.participants}</strong><small>registrados</small></article>
      <article><span>Partidos</span><strong>${c.matches}</strong><small>jugados</small></article>
      <article><span>Goles</span><strong>${c.goals}</strong><small>registrados</small></article>
      <article><span>Tarjetas</span><strong>${c.cards}</strong><small>registradas</small></article>
    `;
  }

  function awardOf(category,type){
    return awards.find(a=>a.category===category&&a.award_type===type)||null;
  }

  function categoryTeamOptions(category,selected=""){
    return teams
      .filter(t=>t.category===category)
      .sort((a,b)=>a.team_name.localeCompare(b.team_name,"es"))
      .map(t=>`<option value="${t.id}" ${t.id===selected?"selected":""}>${esc(t.team_name)}</option>`)
      .join("");
  }

  function diplomaUrl(category,type){
    return `diploma.html?category=${encodeURIComponent(category)}&award=${encodeURIComponent(type)}`;
  }

  function renderCategories(){
    $("closingCategories").innerHTML=Object.keys(LABEL).map(category=>{
      const final=categoryFinal(category);
      const scorer=topScorer(category);
      const fair=awardOf(category,"FAIR_PLAY");
      const champ=awardOf(category,"CHAMPION");
      const runner=awardOf(category,"RUNNER_UP");
      const top=awardOf(category,"TOP_SCORER");

      return`
        <article class="closing-category-card">
          <div class="closing-category-head">
            <div>
              <span class="closing-kicker">${esc(LABEL[category])}</span>
              <h3>Premiación de la categoría</h3>
            </div>
            <button class="btn primary sync-official-awards" data-category="${category}" type="button"
              ${!final?"disabled":""}>
              ${final?"Consolidar resultados oficiales":"Final pendiente"}
            </button>
          </div>

          <div class="closing-podium-grid">
            <div class="closing-award-box gold">
              <span>🏆 CAMPEÓN</span>
              <strong>${esc(champ?teamName(champ.team_id):(final?teamName(final.winner_id):"A definir"))}</strong>
              ${champ?`<a href="${diplomaUrl(category,"CHAMPION")}" target="_blank">Diploma ↗</a>`:""}
            </div>

            <div class="closing-award-box silver">
              <span>🥈 SUBCAMPEÓN</span>
              <strong>${esc(runner?teamName(runner.team_id):(final?teamName(final.runner_id):"A definir"))}</strong>
              ${runner?`<a href="${diplomaUrl(category,"RUNNER_UP")}" target="_blank">Diploma ↗</a>`:""}
            </div>

            <div class="closing-award-box scorer">
              <span>⚽ GOLEADOR/A</span>
              <strong>${esc(top?participantName(top.participant_id):(scorer?participantName(scorer.participant_id):"A definir"))}</strong>
              <small>${topScorer(category)?`${topScorer(category).goals} gol${topScorer(category).goals===1?"":"es"}`:"Sin goles cargados"}</small>
              ${top?`<a href="${diplomaUrl(category,"TOP_SCORER")}" target="_blank">Diploma ↗</a>`:""}
            </div>
          </div>

          <div class="closing-fairplay">
            <div>
              <span class="closing-kicker">RECONOCIMIENTO ESPECIAL</span>
              <h4>🤝 Fair Play / Juego limpio</h4>
              <p>La organización elige el equipo que mejor representó el espíritu del campeonato.</p>
            </div>

            <div class="closing-fairplay-form">
              <select class="fairplay-team" data-category="${category}">
                <option value="">Seleccionar equipo…</option>
                ${categoryTeamOptions(category,fair?.team_id||"")}
              </select>
              <input class="fairplay-note" data-category="${category}" maxlength="300"
                value="${esc(fair?.notes||"")}"
                placeholder="Motivo del reconocimiento (opcional)">
              <button class="btn dark save-fairplay" data-category="${category}" type="button">Guardar Fair Play</button>
              ${fair?`<a class="btn light" href="${diplomaUrl(category,"FAIR_PLAY")}" target="_blank">Ver diploma</a>`:""}
            </div>
          </div>

          <div class="closing-awards-status">
            <strong>Estado de consolidación:</strong>
            <span>${champ&&runner&&top?"Resultados oficiales guardados":"Pendiente de consolidar"}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  async function upsertStandardAward(category,type,data){
    const existing=awardOf(category,type);
    const {data:{user}}=await client.auth.getUser();

    const payload={
      category,
      award_type:type,
      title:AWARD_LABEL[type],
      team_id:data.team_id||null,
      participant_id:data.participant_id||null,
      notes:data.notes||null,
      is_public:true,
      updated_at:new Date().toISOString()
    };

    if(existing){
      return client.from("championship_awards").update(payload).eq("id",existing.id);
    }

    return client.from("championship_awards").insert({
      ...payload,
      created_by:user?.id||null
    });
  }

  async function syncOfficialAwards(category){
    clearNotice();

    const final=categoryFinal(category);
    const scorer=topScorer(category);

    if(!final){
      notice("La final de esta categoría todavía no tiene un ganador oficial.",true);
      return;
    }

    const operations=[
      upsertStandardAward(category,"CHAMPION",{team_id:final.winner_id}),
      upsertStandardAward(category,"RUNNER_UP",{team_id:final.runner_id})
    ];

    if(scorer){
      operations.push(
        upsertStandardAward(category,"TOP_SCORER",{
          team_id:scorer.team_id,
          participant_id:scorer.participant_id,
          notes:`${scorer.goals} gol${scorer.goals===1?"":"es"}`
        })
      );
    }

    const results=await Promise.all(operations);
    const err=results.find(r=>r.error)?.error;
    if(err){
      notice(err.message,true);
      return;
    }

    notice(`Resultados oficiales consolidados para ${LABEL[category]}.`);
    await loadAll();
  }

  async function saveFairPlay(category){
    clearNotice();
    const teamId=document.querySelector(`.fairplay-team[data-category="${category}"]`)?.value||"";
    const note=document.querySelector(`.fairplay-note[data-category="${category}"]`)?.value.trim()||null;

    if(!teamId){
      notice("Seleccioná el equipo que recibe el reconocimiento Fair Play.",true);
      return;
    }

    const result=await upsertStandardAward(category,"FAIR_PLAY",{
      team_id:teamId,
      notes:note
    });

    if(result.error){
      notice(result.error.message,true);
      return;
    }

    notice(`Reconocimiento Fair Play guardado para ${LABEL[category]}.`);
    await loadAll();
  }

  function fillClosingForm(){
    const row=closingRows[0];
    $("closingPublicTitle").value=row?.public_title||"";
    $("closingPublicMessage").value=row?.public_message||"";
    $("closingInternalNotes").value=row?.internal_notes||"";
    $("closingGlobalStatus").value=row?.status||"Borrador";
  }

  async function saveClosing(){
    clearNotice();

    const payload={
      public_title:$("closingPublicTitle").value.trim()||null,
      public_message:$("closingPublicMessage").value.trim()||null,
      internal_notes:$("closingInternalNotes").value.trim()||null,
      status:$("closingGlobalStatus").value,
      closed_at:$("closingGlobalStatus").value==="Publicado"?new Date().toISOString():null,
      updated_at:new Date().toISOString()
    };

    const existing=closingRows[0];

    let result;
    if(existing){
      result=await client.from("championship_closing").update(payload).eq("id",existing.id);
    }else{
      const {data:{user}}=await client.auth.getUser();
      result=await client.from("championship_closing").insert({
        ...payload,
        created_by:user?.id||null
      });
    }

    if(result.error){
      notice(result.error.message,true);
      return;
    }

    notice("Cierre del campeonato guardado.");
    await loadAll();
  }

  function csvEscape(value){
    return `"${String(value??"").replace(/"/g,'""')}"`;
  }

  function exportFinalReport(){
    const c=counts();
    const rows=[
      ["CAMPEONATO DE FÚTBOL 2026 - INFORME FINAL"],
      [],
      ["RESUMEN GENERAL"],
      ["Equipos",c.teams],
      ["Participantes",c.participants],
      ["Partidos jugados",c.matches],
      ["Goles",c.goals],
      ["Tarjetas",c.cards],
      []
    ];

    Object.keys(LABEL).forEach(category=>{
      rows.push([LABEL[category]]);
      const final=categoryFinal(category);
      const scorer=topScorer(category);
      const fair=awardOf(category,"FAIR_PLAY");

      rows.push(["Campeón",final?teamName(final.winner_id):""]);
      rows.push(["Subcampeón",final?teamName(final.runner_id):""]);
      rows.push(["Goleador/a",scorer?participantName(scorer.participant_id):"",scorer?.goals||0]);
      rows.push(["Fair Play",fair?teamName(fair.team_id):"",fair?.notes||""]);
      rows.push([]);
    });

    const text=rows.map(r=>r.map(csvEscape).join(",")).join("\\n");
    const blob=new Blob(["\\ufeff"+text],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="informe_final_campeonato_2026.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function openClosing(){
    showView();
    try{
      await loadAll();
    }catch(e){
      notice(`No se pudo cargar la Etapa 6. Ejecutá supabase/closing-migration.sql. Detalle: ${e.message}`,true);
    }
  }

  document.addEventListener("click",e=>{
    const t=e.target;

    if(t.id==="closingTabBtn")openClosing();

    if(["teamsTabBtn","fixtureTabBtn","competitionTabBtn","statsTabBtn","operationsTabBtn"].includes(t.id)){
      hideView();
    }

    if(t.matches(".sync-official-awards"))syncOfficialAwards(t.dataset.category);
    if(t.matches(".save-fairplay"))saveFairPlay(t.dataset.category);
  });

  $("saveGlobalClosingBtn")?.addEventListener("click",saveClosing);
  $("exportFinalReportBtn")?.addEventListener("click",exportFinalReport);
})();
