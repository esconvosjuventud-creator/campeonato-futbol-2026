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
    FAIR_PLAY:"Fair Play",
    SPECIAL:"Reconocimiento especial"
  };
  const AWARD_ICON={
    CHAMPION:"🏆",
    RUNNER_UP:"🥈",
    TOP_SCORER:"⚽",
    FAIR_PLAY:"🤝",
    SPECIAL:"⭐"
  };

  let client=null;
  let payload=null;
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

  function awardName(a){
    return a.participant_name||a.team_name||"—";
  }

  function renderMessage(){
    const c=payload?.closing;
    if(!c){
      $("publicClosingMessage").classList.add("hidden");
      return;
    }

    $("publicClosingMessage").classList.remove("hidden");
    $("publicClosingMessage").innerHTML=`
      <span>GRACIAS POR SER PARTE</span>
      <h2>${esc(c.public_title||"Cerramos una nueva edición del campeonato")}</h2>
      <p>${esc(c.public_message||"Gracias a todos los equipos, familias, referentes y organizaciones que hicieron posible esta jornada.")}</p>
    `;
  }

  function renderTabs(){
    const categories=payload?.categories||[];
    $("publicClosingTabs").innerHTML=categories.map(c=>`
      <button type="button" data-category="${c.category}" class="${c.category===active?"active":""}">
        ${esc(LABEL[c.category]||c.category)}
      </button>
    `).join("");
  }

  function renderActive(){
    const category=(payload?.categories||[]).find(c=>c.category===active);
    if(!category)return;

    const awards=category.awards||[];

    $("publicClosingContent").innerHTML=`
      <section class="public-closing-category-head">
        <span>${esc(LABEL[category.category]||category.category)}</span>
        <h2>Reconocimientos</h2>
      </section>

      <section class="public-awards-list">
        ${awards.map(a=>`
          <article class="public-closing-award ${String(a.award_type).toLowerCase()}">
            <div class="public-closing-award-icon">${AWARD_ICON[a.award_type]||"⭐"}</div>
            <span>${esc(a.title||AWARD_LABEL[a.award_type]||a.award_type)}</span>
            <strong>${esc(awardName(a))}</strong>
            ${a.notes?`<p>${esc(a.notes)}</p>`:""}
            <a href="diploma.html?category=${encodeURIComponent(category.category)}&award=${encodeURIComponent(a.award_type)}">
              Ver reconocimiento ↗
            </a>
          </article>
        `).join("")}
      </section>

      <section class="public-closing-motto">
        <span>⚽</span>
        <div>
          <strong>Competir también es respetar.</strong>
          <p>Que en tu equipo no juegue la violencia.</p>
        </div>
      </section>
    `;
  }

  async function load(){
    $("publicClosingError").classList.add("hidden");

    if(!setup()){
      $("publicClosingError").textContent="La página todavía no está conectada al sistema.";
      $("publicClosingError").classList.remove("hidden");
      return;
    }

    const {data,error}=await client.rpc("get_public_closing");

    if(error){
      $("publicClosingError").textContent="El cierre todavía no está disponible.";
      $("publicClosingError").classList.remove("hidden");
      return;
    }

    payload=data||{};
    const categories=payload.categories||[];

    if(!payload.closing && !categories.length){
      $("publicClosingError").innerHTML="<strong>Próximamente</strong><br>La premiación se publicará cuando finalice el campeonato.";
      $("publicClosingError").classList.remove("hidden");
      $("publicClosingTabs").innerHTML="";
      $("publicClosingContent").innerHTML="";
      $("publicClosingMessage").classList.add("hidden");
      return;
    }

    renderMessage();

    if(categories.length){
      if(!active||!categories.some(c=>c.category===active))active=categories[0].category;
      renderTabs();
      renderActive();
    }else{
      $("publicClosingTabs").innerHTML="";
      $("publicClosingContent").innerHTML="";
    }
  }

  document.addEventListener("click",e=>{
    if(e.target.matches("#publicClosingTabs button")){
      active=e.target.dataset.category;
      renderTabs();
      renderActive();
    }
  });

  $("publicClosingRefresh").addEventListener("click",load);
  load();
})();
