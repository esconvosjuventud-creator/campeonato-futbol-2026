(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const LABEL={
    "M13-15":"Masculino 13–15",
    "M16-22":"Masculino 16–22",
    "F-LIBRE":"Femenino Libre"
  };

  let client=null;
  let categories=[];
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

  function renderTabs(){
    $("publicStatsTabs").innerHTML=categories.map(c=>`
      <button type="button" class="${c.category===active?"active":""}" data-category="${c.category}">
        ${esc(LABEL[c.category]||c.category)}
      </button>
    `).join("");
  }

  function renderActive(){
    const c=categories.find(x=>x.category===active);
    if(!c)return;

    const scorers=c.scorers||[];
    const cards=c.discipline||[];

    $("publicStatsContent").innerHTML=`
      <section class="public-stats-category-head">
        <span>${esc(LABEL[c.category]||c.category)}</span>
        <h2>${esc(c.fixture_name||"Campeonato")}</h2>
      </section>

      <section class="public-awards-grid">
        <article class="public-award champion">
          <span>🏆</span>
          <small>CAMPEÓN</small>
          <strong>${esc(c.champion?.team_name||"A definir")}</strong>
          <em>${c.runner_up?.team_name ? `Subcampeón: ${esc(c.runner_up.team_name)}` : "Esperando la definición"}</em>
        </article>

        <article class="public-award scorer">
          <span>⚽</span>
          <small>GOLEADOR/A</small>
          <strong>${esc(scorers[0]?.display_name||"A definir")}</strong>
          <em>${scorers[0] ? `${scorers[0].goals} gol${scorers[0].goals===1?"":"es"} · ${esc(scorers[0].team_name)}` : "Todavía sin goles cargados"}</em>
        </article>
      </section>

      <section class="public-stats-grid">
        <article class="public-stats-panel">
          <div class="public-stats-section-head">
            <span>⚽ GOLES</span>
            <h2>Tabla de goleadores</h2>
          </div>
          ${
            scorers.length
              ? `<div class="public-scorers">
                  ${scorers.map((s,i)=>`
                    <div class="${i===0?"leader":""}">
                      <span class="public-rank">${i+1}</span>
                      <div><strong>${esc(s.display_name)}</strong><small>${esc(s.team_name)}</small></div>
                      <b>${s.goals}</b>
                    </div>
                  `).join("")}
                </div>`
              : `<div class="public-stats-empty small-empty">Todavía no hay goles registrados.</div>`
          }
        </article>

        <article class="public-stats-panel">
          <div class="public-stats-section-head">
            <span>🤝 CONVIVENCIA Y DISCIPLINA</span>
            <h2>Tarjetas por equipo</h2>
          </div>
          <div class="public-discipline">
            ${cards.map(r=>`
              <div>
                <strong>${esc(r.team_name)}</strong>
                <span title="Amarillas">🟨 ${r.yellow}</span>
                <span title="Azules">🟦 ${r.blue}</span>
                <span title="Rojas">🟥 ${r.red}</span>
              </div>
            `).join("")}
          </div>
          <p class="public-stats-note">
            Estos datos son informativos. Las sanciones personales se gestionan de forma privada por la organización.
          </p>
        </article>
      </section>

      <div class="public-privacy-note">
        🔒 Para proteger a adolescentes y jóvenes, en esta página se muestra el nombre y solo la inicial del apellido de los goleadores.
      </div>
    `;
  }

  async function load(){
    $("publicStatsError").classList.add("hidden");

    if(!setup()){
      $("publicStatsError").textContent="La página todavía no está conectada al sistema.";
      $("publicStatsError").classList.remove("hidden");
      return;
    }

    const {data,error}=await client.rpc("get_public_statistics");
    if(error){
      $("publicStatsError").textContent="Las estadísticas todavía no están disponibles.";
      $("publicStatsError").classList.remove("hidden");
      return;
    }

    categories=data?.categories||[];

    if(!categories.length){
      $("publicStatsError").innerHTML="<strong>Próximamente</strong><br>Las estadísticas aparecerán cuando la organización publique el campeonato.";
      $("publicStatsError").classList.remove("hidden");
      $("publicStatsTabs").innerHTML="";
      $("publicStatsContent").innerHTML="";
      return;
    }

    if(!active||!categories.some(c=>c.category===active))active=categories[0].category;
    renderTabs();
    renderActive();
  }

  document.addEventListener("click",e=>{
    if(e.target.matches("#publicStatsTabs button")){
      active=e.target.dataset.category;
      renderTabs();
      renderActive();
    }
  });

  $("publicStatsRefresh").addEventListener("click",load);
  load();
})();
