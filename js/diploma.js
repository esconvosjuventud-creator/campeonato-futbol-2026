(() => {
  "use strict";

  const $=id=>document.getElementById(id);
  const LABEL={
    "M13-15":"Masculino 13–15",
    "M16-22":"Masculino 16–22",
    "F-LIBRE":"Femenino Libre"
  };
  const TITLE={
    CHAMPION:"Campeón",
    RUNNER_UP:"Subcampeón",
    TOP_SCORER:"Goleador/a",
    FAIR_PLAY:"Reconocimiento Fair Play",
    SPECIAL:"Reconocimiento especial"
  };

  const params=new URLSearchParams(location.search);
  const category=params.get("category")||"";
  const awardType=params.get("award")||"";

  let client=null;

  function setup(){
    const cfg=window.APP_CONFIG||{};
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY)return false;
    client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
    return true;
  }

  function showError(msg){
    $("diploma").classList.add("hidden");
    $("diplomaError").textContent=msg;
    $("diplomaError").classList.remove("hidden");
  }

  async function load(){
    if(!category||!awardType){
      showError("Falta indicar el reconocimiento.");
      return;
    }

    if(!setup()){
      showError("La página todavía no está conectada al sistema.");
      return;
    }

    const {data,error}=await client.rpc("get_public_closing");
    if(error){
      showError("No se pudo cargar el reconocimiento.");
      return;
    }

    const c=(data?.categories||[]).find(x=>x.category===category);
    const a=(c?.awards||[]).find(x=>x.award_type===awardType);

    if(!a){
      showError("Este reconocimiento todavía no está publicado.");
      return;
    }

    $("diplomaTitle").textContent=a.title||TITLE[awardType]||"Reconocimiento";
    $("diplomaName").textContent=a.participant_name||a.team_name||"—";
    $("diplomaCategory").textContent=LABEL[category]||category;

    if(a.notes){
      $("diplomaMessage").textContent=a.notes;
    }
  }

  load();
})();
