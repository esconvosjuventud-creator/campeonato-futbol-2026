(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const LABEL = {
    "M13-15": "Masculino 13–15",
    "M16-22": "Masculino 16–22",
    "F-LIBRE": "Femenino Libre"
  };

  let client = null;
  let categories = [];
  let active = "";

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);

  function setup() {
    const cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return false;
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY
    );
    return true;
  }

  function teamMap(category) {
    return new Map((category.teams || []).map(t => [t.id,t.name]));
  }

  function standings(category) {
    const table = new Map();
    (category.teams || []).forEach(t => {
      table.set(t.id,{
        id:t.id,name:t.name,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0
      });
    });

    (category.matches || [])
      .filter(m =>
        !m.is_bye &&
        m.match_status === "Jugado" &&
        m.score_a !== null && m.score_a !== undefined &&
        m.score_b !== null && m.score_b !== undefined
      )
      .forEach(m => {
        const a = table.get(m.team_a_id);
        const b = table.get(m.team_b_id);
        if (!a || !b) return;

        const sa = Number(m.score_a), sb = Number(m.score_b);
        a.pj++; b.pj++;
        a.gf += sa; a.gc += sb;
        b.gf += sb; b.gc += sa;

        if (sa > sb) { a.pg++; b.pp++; a.pts += 3; }
        else if (sb > sa) { b.pg++; a.pp++; b.pts += 3; }
        else { a.pe++; b.pe++; a.pts++; b.pts++; }
      });

    [...table.values()].forEach(r => r.dg = r.gf-r.gc);

    return [...table.values()].sort((a,b) =>
      b.pts-a.pts ||
      b.dg-a.dg ||
      b.gf-a.gf ||
      a.name.localeCompare(b.name,"es")
    );
  }

  function tableHtml(rows, qualifiers=0) {
    return `
      <div class="standings-scroll">
        <table class="standings-table public-table">
          <thead>
            <tr>
              <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
              <th>GF</th><th>GC</th><th>DG</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r,i) => `
              <tr class="${qualifiers && i < qualifiers ? "qualified-row" : ""}">
                <td><span class="position-badge">${i+1}</span></td>
                <td><strong>${esc(r.name)}</strong></td>
                <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td>
                <td>${r.gf}</td><td>${r.gc}</td>
                <td>${r.dg > 0 ? "+" : ""}${r.dg}</td>
                <td><strong>${r.pts}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function fixtureHtml(category) {
    const teams = teamMap(category);
    const rounds = [...new Set((category.matches || []).map(m => m.round_number))];

    return rounds.map(round => {
      const matches = category.matches.filter(m => m.round_number === round);
      return `
        <section class="public-round">
          <h3>Fecha ${round}</h3>
          ${matches.map(m => {
            if (m.is_bye) {
              const id = m.team_a_id || m.team_b_id;
              return `
                <div class="public-match bye">
                  <span>LIBRE</span>
                  <strong>${esc(teams.get(id) || "Equipo")}</strong>
                </div>
              `;
            }

            const score = m.match_status === "Jugado"
              ? `<strong class="public-score">${m.score_a} – ${m.score_b}</strong>`
              : `<span class="public-vs">vs.</span>`;

            const meta = [
              m.match_date || "",
              m.match_time ? String(m.match_time).slice(0,5) : "",
              m.court || ""
            ].filter(Boolean).join(" · ");

            return `
              <div class="public-match">
                <strong>${esc(teams.get(m.team_a_id) || "Equipo")}</strong>
                ${score}
                <strong>${esc(teams.get(m.team_b_id) || "Equipo")}</strong>
                <small>${esc(meta || m.match_status)}</small>
              </div>
            `;
          }).join("")}
        </section>
      `;
    }).join("");
  }

  function playoffHtml(category) {
    const p = category.playoff;
    if (!p) return "";

    const teams = teamMap(category);

    return `
      <section class="public-playoff">
        <div class="public-section-head">
          <span>🏆 DEFINICIÓN</span>
          <h2>${esc(p.name)}</h2>
        </div>
        <div class="public-playoff-grid ${p.qualifiers === 2 ? "final-only" : ""}">
          ${(p.matches || []).map(m => {
            const a = m.team_a_id ? (teams.get(m.team_a_id) || "Equipo") : "A definir";
            const b = m.team_b_id ? (teams.get(m.team_b_id) || "Equipo") : "A definir";

            let result = "vs.";
            if (m.match_status === "Jugado") {
              result = `${m.score_a} – ${m.score_b}`;
              if (
                m.score_a === m.score_b &&
                m.penalty_a !== null && m.penalty_a !== undefined &&
                m.penalty_b !== null && m.penalty_b !== undefined
              ) {
                result += ` · pen. ${m.penalty_a}–${m.penalty_b}`;
              }
            }

            return `
              <article class="public-playoff-match ${m.stage === "Final" ? "final" : ""}">
                <span>${esc(m.stage)}${m.stage === "Semifinal" ? ` ${m.match_order}` : ""}</span>
                <strong>${esc(a)}</strong>
                <b>${esc(result)}</b>
                <strong>${esc(b)}</strong>
                <small>${esc([m.match_date, m.match_time ? String(m.match_time).slice(0,5) : "", m.court].filter(Boolean).join(" · "))}</small>
                ${m.winner_team_id ? `<em>🏆 ${esc(teams.get(m.winner_team_id) || "Ganador")}</em>` : ""}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderTabs() {
    $("publicCategoryTabs").innerHTML = categories.map(c => `
      <button
        type="button"
        class="${c.category === active ? "active" : ""}"
        data-category="${c.category}"
      >
        ${esc(LABEL[c.category] || c.category)}
      </button>
    `).join("");
  }

  function renderActive() {
    const c = categories.find(x => x.category === active);
    if (!c) return;

    const rows = standings(c);

    $("publicCompetitionContent").innerHTML = `
      <section class="public-category-head">
        <span>${esc(LABEL[c.category] || c.category)}</span>
        <h2>${esc(c.fixture?.name || "Fixture")}</h2>
      </section>

      <section class="public-competition-grid">
        <article class="public-panel">
          <div class="public-section-head">
            <span>📊 TABLA</span>
            <h2>Posiciones</h2>
          </div>
          ${tableHtml(rows, c.playoff?.qualifiers || 0)}
          <p class="public-note">Orden: puntos, diferencia de goles y goles a favor.</p>
        </article>

        <article class="public-panel">
          <div class="public-section-head">
            <span>⚽ PARTIDOS</span>
            <h2>Fixture y resultados</h2>
          </div>
          <div class="public-rounds">
            ${fixtureHtml(c)}
          </div>
        </article>
      </section>

      ${playoffHtml(c)}
    `;
  }

  async function load() {
    $("publicCompetitionError").classList.add("hidden");

    if (!setup()) {
      $("publicCompetitionError").textContent = "La página todavía no está conectada al sistema.";
      $("publicCompetitionError").classList.remove("hidden");
      return;
    }

    const { data, error } = await client.rpc("get_public_competition");

    if (error) {
      $("publicCompetitionError").textContent =
        "Todavía no hay información pública disponible o falta activar el módulo de competencia.";
      $("publicCompetitionError").classList.remove("hidden");
      return;
    }

    categories = data?.categories || [];

    if (!categories.length) {
      $("publicCompetitionError").innerHTML =
        "<strong>Próximamente</strong><br>El fixture y los resultados se publicarán cuando estén confirmados por la organización.";
      $("publicCompetitionError").classList.remove("hidden");
      $("publicCategoryTabs").innerHTML = "";
      $("publicCompetitionContent").innerHTML = "";
      return;
    }

    if (!active || !categories.some(c => c.category === active)) {
      active = categories[0].category;
    }

    renderTabs();
    renderActive();
  }

  document.addEventListener("click", e => {
    if (e.target.matches("#publicCategoryTabs button")) {
      active = e.target.dataset.category;
      renderTabs();
      renderActive();
    }
  });

  $("publicRefreshBtn").addEventListener("click", load);

  load();
})();
