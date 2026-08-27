(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const LABEL = {
    "M13-15": "Masculino 13–15",
    "M16-22": "Masculino 16–22",
    "F-LIBRE": "Femenino Libre"
  };

  let client = null;
  let teams = [];
  let fixtures = [];
  let playoffs = [];

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);

  function setupClient() {
    if (client) return true;
    const cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return false;
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY,
      { auth:{ persistSession:true, autoRefreshToken:true } }
    );
    return true;
  }

  async function adminOk() {
    if (!setupClient()) return false;
    const { data:{ session } } = await client.auth.getSession();
    if (!session) return false;
    const { data, error } = await client.rpc("is_admin");
    return !error && data === true;
  }

  function notice(msg, danger=false) {
    const box = $("competitionNotice");
    box.textContent = msg;
    box.classList.remove("hidden");
    box.classList.toggle("danger", danger);
    box.classList.toggle("warning", !danger);
  }

  function clearNotice() {
    $("competitionNotice").classList.add("hidden");
  }

  function showCompetitionView() {
    $("teamsAdminView")?.classList.add("hidden");
    $("fixtureAdminView")?.classList.add("hidden");
    $("competitionAdminView")?.classList.remove("hidden");

    $("teamsTabBtn")?.classList.remove("active");
    $("fixtureTabBtn")?.classList.remove("active");
    $("competitionTabBtn")?.classList.add("active");
  }

  function hideCompetitionView() {
    $("competitionAdminView")?.classList.add("hidden");
    $("competitionTabBtn")?.classList.remove("active");
  }

  async function loadAll() {
    if (!await adminOk()) {
      notice("Iniciá sesión como administrador.", true);
      return;
    }

    clearNotice();

    const [
      teamsResult,
      fixturesResult,
      fixtureMatchesResult,
      playoffsResult,
      playoffMatchesResult
    ] = await Promise.all([
      client.from("teams")
        .select("id,team_name,category,registration_number")
        .eq("is_submitted", true),
      client.from("fixtures")
        .select("*")
        .order("created_at", {ascending:false}),
      client.from("fixture_matches")
        .select("*")
        .order("round_number", {ascending:true})
        .order("match_order", {ascending:true}),
      client.from("playoffs")
        .select("*")
        .order("created_at", {ascending:false}),
      client.from("playoff_matches")
        .select("*")
        .order("created_at", {ascending:true})
    ]);

    for (const r of [
      teamsResult, fixturesResult, fixtureMatchesResult,
      playoffsResult, playoffMatchesResult
    ]) {
      if (r.error) throw r.error;
    }

    teams = teamsResult.data || [];

    fixtures = (fixturesResult.data || []).map(f => ({
      ...f,
      matches: (fixtureMatchesResult.data || [])
        .filter(m => m.fixture_id === f.id)
    }));

    playoffs = (playoffsResult.data || []).map(p => ({
      ...p,
      matches: (playoffMatchesResult.data || [])
        .filter(m => m.playoff_id === p.id)
    }));

    renderStandings();
    renderPlayoffs();
  }

  function teamName(id) {
    return teams.find(t => t.id === id)?.team_name || "Equipo";
  }

  function latestFixture(category) {
    return fixtures
      .filter(f => f.category === category)
      .sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
  }

  function fixtureTeamIds(fixture) {
    if (!fixture) return [];
    const ids = new Set();
    fixture.matches.forEach(m => {
      if (m.team_a_id) ids.add(m.team_a_id);
      if (m.team_b_id) ids.add(m.team_b_id);
    });
    return [...ids];
  }

  function standings(fixture) {
    if (!fixture) return [];

    const ids = fixtureTeamIds(fixture);
    const table = new Map();

    ids.forEach(id => {
      table.set(id, {
        team_id:id,
        team_name:teamName(id),
        pj:0, pg:0, pe:0, pp:0,
        gf:0, gc:0, dg:0, pts:0
      });
    });

    fixture.matches
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

        const sa = Number(m.score_a);
        const sb = Number(m.score_b);

        a.pj++; b.pj++;
        a.gf += sa; a.gc += sb;
        b.gf += sb; b.gc += sa;

        if (sa > sb) {
          a.pg++; b.pp++;
          a.pts += 3;
        } else if (sb > sa) {
          b.pg++; a.pp++;
          b.pts += 3;
        } else {
          a.pe++; b.pe++;
          a.pts++; b.pts++;
        }
      });

    [...table.values()].forEach(r => {
      r.dg = r.gf - r.gc;
    });

    return [...table.values()].sort((a,b) =>
      b.pts - a.pts ||
      b.dg - a.dg ||
      b.gf - a.gf ||
      a.team_name.localeCompare(b.team_name, "es")
    );
  }

  function progress(fixture) {
    const games = fixture?.matches?.filter(m => !m.is_bye) || [];
    const played = games.filter(m =>
      m.match_status === "Jugado" &&
      m.score_a !== null && m.score_a !== undefined &&
      m.score_b !== null && m.score_b !== undefined
    ).length;
    return { played, total:games.length, done:games.length > 0 && played === games.length };
  }

  function renderStandingsTable(rows, qualifiers=0) {
    if (!rows.length) return `<p class="help">No hay equipos para calcular posiciones.</p>`;

    return `
      <div class="standings-scroll">
        <table class="standings-table">
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
                <td><strong>${esc(r.team_name)}</strong></td>
                <td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td>
                <td>${r.gf}</td><td>${r.gc}</td><td>${r.dg > 0 ? "+" : ""}${r.dg}</td>
                <td><strong>${r.pts}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderStandings() {
    $("standingsCategories").innerHTML = Object.keys(LABEL).map(category => {
      const fixture = latestFixture(category);

      if (!fixture) {
        return `
          <article class="standings-category-card">
            <span class="competition-kicker">${esc(LABEL[category])}</span>
            <h3>Sin fixture generado</h3>
            <p class="help">Primero generá el fixture desde la pestaña anterior.</p>
          </article>
        `;
      }

      const rows = standings(fixture);
      const prog = progress(fixture);
      const existingPlayoff = playoffs.find(p =>
        p.category === category &&
        p.source_fixture_id === fixture.id &&
        p.status !== "Finalizado"
      );

      const maxQ = rows.length >= 4 ? 4 : 2;

      return `
        <article class="standings-category-card">
          <div class="standings-card-head">
            <div>
              <span class="competition-kicker">${esc(LABEL[category])}</span>
              <h3>${esc(fixture.fixture_name)}</h3>
              <p class="small">
                ${prog.played}/${prog.total} partidos jugados ·
                Estado fixture: ${esc(fixture.status)}
              </p>
            </div>
            <div class="league-progress">
              <strong>${prog.total ? Math.round((prog.played/prog.total)*100) : 0}%</strong>
              <span>fase regular</span>
            </div>
          </div>

          ${renderStandingsTable(rows, existingPlayoff?.qualifiers || 0)}

          <div class="standings-foot">
            <p>
              Desempate provisional del sistema:
              <strong>puntos → diferencia de goles → goles a favor</strong>.
            </p>

            <div class="qualification-controls">
              <label>
                Clasifican
                <select class="qualifiers-select" data-category="${category}">
                  <option value="2">Top 2 · Final directa</option>
                  ${rows.length >= 4 ? `<option value="4">Top 4 · Semifinales + Final</option>` : ""}
                </select>
              </label>

              <button
                class="btn primary create-playoff"
                data-category="${category}"
                type="button"
                ${!prog.done || rows.length < 2 || existingPlayoff ? "disabled" : ""}
              >
                ${existingPlayoff ? "Definición ya creada" : "Generar definición"}
              </button>
            </div>
          </div>

          ${
            !prog.done
              ? `<div class="competition-hint">Para generar la definición deben estar cargados todos los resultados de la fase regular.</div>`
              : ""
          }
        </article>
      `;
    }).join("");
  }

  async function createPlayoff(category) {
    clearNotice();

    const fixture = latestFixture(category);
    if (!fixture) return;

    const prog = progress(fixture);
    if (!prog.done) {
      notice("Completá todos los resultados de la fase regular.", true);
      return;
    }

    const rows = standings(fixture);
    const select = document.querySelector(`.qualifiers-select[data-category="${category}"]`);
    const qualifiers = Number(select?.value || 2);

    if (rows.length < qualifiers) {
      notice("No hay suficientes equipos para esa definición.", true);
      return;
    }

    const name = qualifiers === 4
      ? `Definición ${LABEL[category]} · Semifinales y Final`
      : `Final ${LABEL[category]}`;

    const { data:{ user } } = await client.auth.getUser();

    const { data: playoff, error } = await client
      .from("playoffs")
      .insert({
        category,
        playoff_name:name,
        source_fixture_id:fixture.id,
        qualifiers,
        competition_date:fixture.competition_date,
        created_by:user?.id || null
      })
      .select()
      .single();

    if (error) {
      notice(error.message, true);
      return;
    }

    let matches = [];

    if (qualifiers === 2) {
      matches = [{
        playoff_id:playoff.id,
        stage:"Final",
        match_order:1,
        team_a_id:rows[0].team_id,
        team_b_id:rows[1].team_id
      }];
    } else {
      matches = [
        {
          playoff_id:playoff.id,
          stage:"Semifinal",
          match_order:1,
          team_a_id:rows[0].team_id,
          team_b_id:rows[3].team_id
        },
        {
          playoff_id:playoff.id,
          stage:"Semifinal",
          match_order:2,
          team_a_id:rows[1].team_id,
          team_b_id:rows[2].team_id
        },
        {
          playoff_id:playoff.id,
          stage:"Final",
          match_order:1,
          team_a_id:null,
          team_b_id:null
        }
      ];
    }

    const insert = await client.from("playoff_matches").insert(matches);
    if (insert.error) {
      await client.from("playoffs").delete().eq("id", playoff.id);
      notice(insert.error.message, true);
      return;
    }

    notice(`Definición creada para ${LABEL[category]}.`);
    await loadAll();
  }

  function playoffMatchCard(m) {
    const waiting = !m.team_a_id || !m.team_b_id;

    return `
      <article class="playoff-match" data-playoff-match-id="${m.id}">
        <div class="playoff-stage">
          <span>${esc(m.stage)}${m.stage === "Semifinal" ? ` ${m.match_order}` : ""}</span>
          <small>${esc(m.match_status)}</small>
        </div>

        <div class="playoff-teams">
          <strong>${waiting ? "A definir" : esc(teamName(m.team_a_id))}</strong>
          <span>vs.</span>
          <strong>${waiting ? "A definir" : esc(teamName(m.team_b_id))}</strong>
        </div>

        <div class="playoff-fields">
          <input class="po-date" type="date" value="${esc(m.match_date || "")}" ${waiting ? "disabled" : ""}>
          <input class="po-time" type="time" value="${esc(m.match_time ? String(m.match_time).slice(0,5) : "")}" ${waiting ? "disabled" : ""}>
          <input class="po-court" placeholder="Cancha" value="${esc(m.court || "")}" ${waiting ? "disabled" : ""}>

          <div class="playoff-score">
            <input class="po-score-a" type="number" min="0" placeholder="0" value="${m.score_a ?? ""}" ${waiting ? "disabled" : ""}>
            <span>–</span>
            <input class="po-score-b" type="number" min="0" placeholder="0" value="${m.score_b ?? ""}" ${waiting ? "disabled" : ""}>
          </div>

          <div class="penalties-box">
            <span>Penales</span>
            <input class="po-penalty-a" type="number" min="0" placeholder="-" value="${m.penalty_a ?? ""}" ${waiting ? "disabled" : ""}>
            <span>–</span>
            <input class="po-penalty-b" type="number" min="0" placeholder="-" value="${m.penalty_b ?? ""}" ${waiting ? "disabled" : ""}>
          </div>

          <select class="po-status" ${waiting ? "disabled" : ""}>
            <option ${m.match_status === "Programado" ? "selected" : ""}>Programado</option>
            <option ${m.match_status === "Jugado" ? "selected" : ""}>Jugado</option>
            <option ${m.match_status === "Suspendido" ? "selected" : ""}>Suspendido</option>
          </select>

          <button class="btn dark save-playoff-match" data-id="${m.id}" type="button" ${waiting ? "disabled" : ""}>
            Guardar partido
          </button>
        </div>

        ${
          m.winner_team_id
            ? `<div class="winner-strip">🏆 Ganador: <strong>${esc(teamName(m.winner_team_id))}</strong></div>`
            : ""
        }
      </article>
    `;
  }

  function renderPlayoffs() {
    if (!playoffs.length) {
      $("playoffsAdminList").innerHTML = `
        <div class="competition-empty">
          <span>🏆</span>
          <strong>Todavía no hay definiciones generadas</strong>
          <small>Se habilitan al completar todos los resultados de la fase regular.</small>
        </div>
      `;
      return;
    }

    $("playoffsAdminList").innerHTML = playoffs.map(p => `
      <article class="playoff-card">
        <div class="playoff-card-head">
          <div>
            <span class="competition-kicker">${esc(LABEL[p.category])}</span>
            <h3>${esc(p.playoff_name)}</h3>
            <p class="small">Clasifican ${p.qualifiers} · ${esc(p.status)}</p>
          </div>

          <div class="playoff-actions">
            <select class="playoff-status-select" data-id="${p.id}">
              <option ${p.status === "Borrador" ? "selected" : ""}>Borrador</option>
              <option ${p.status === "Publicado" ? "selected" : ""}>Publicado</option>
              <option ${p.status === "Finalizado" ? "selected" : ""}>Finalizado</option>
            </select>
            <button class="btn light save-playoff-status" data-id="${p.id}" type="button">Guardar estado</button>
          </div>
        </div>

        <div class="playoff-bracket-grid ${p.qualifiers === 2 ? "final-only" : ""}">
          ${p.matches
            .sort((a,b) =>
              (a.stage === "Final" ? 2 : 1) - (b.stage === "Final" ? 2 : 1) ||
              a.match_order - b.match_order
            )
            .map(playoffMatchCard)
            .join("")}
        </div>
      </article>
    `).join("");
  }

  function matchWinner(m, scoreA, scoreB, penA, penB, status) {
    if (status !== "Jugado") return null;
    if (scoreA === null || scoreB === null) return null;

    if (scoreA > scoreB) return m.team_a_id;
    if (scoreB > scoreA) return m.team_b_id;

    if (penA !== null && penB !== null && penA !== penB) {
      return penA > penB ? m.team_a_id : m.team_b_id;
    }

    return null;
  }

  async function savePlayoffMatch(id) {
    const card = document.querySelector(`[data-playoff-match-id="${id}"]`);
    const playoff = playoffs.find(p => p.matches.some(m => m.id === id));
    const match = playoff?.matches.find(m => m.id === id);
    if (!card || !playoff || !match) return;

    const raw = selector => card.querySelector(selector)?.value ?? "";
    const num = selector => raw(selector) === "" ? null : Number(raw(selector));

    const scoreA = num(".po-score-a");
    const scoreB = num(".po-score-b");
    const penA = num(".po-penalty-a");
    const penB = num(".po-penalty-b");
    const status = raw(".po-status");

    const winner = matchWinner(match, scoreA, scoreB, penA, penB, status);

    if (status === "Jugado" && scoreA === scoreB && !winner) {
      notice("En un partido eliminatorio empatado debés cargar el resultado de los penales.", true);
      return;
    }

    const payload = {
      match_date: raw(".po-date") || null,
      match_time: raw(".po-time") || null,
      court: raw(".po-court").trim() || null,
      score_a:scoreA,
      score_b:scoreB,
      penalty_a:penA,
      penalty_b:penB,
      match_status:status,
      winner_team_id:winner
    };

    const { error } = await client
      .from("playoff_matches")
      .update(payload)
      .eq("id", id);

    if (error) {
      notice(error.message, true);
      return;
    }

    // Si es semifinal, actualiza automáticamente uno de los lugares de la final.
    if (match.stage === "Semifinal") {
      const finalMatch = playoff.matches.find(m => m.stage === "Final");
      if (finalMatch) {
        const update = match.match_order === 1
          ? { team_a_id:winner }
          : { team_b_id:winner };

        await client
          .from("playoff_matches")
          .update(update)
          .eq("id", finalMatch.id);
      }
    }

    notice("Partido de definición actualizado.");
    await loadAll();
  }

  async function savePlayoffStatus(id) {
    const select = document.querySelector(`.playoff-status-select[data-id="${id}"]`);
    if (!select) return;

    const { error } = await client
      .from("playoffs")
      .update({ status:select.value })
      .eq("id",id);

    if (error) notice(error.message,true);
    else {
      notice("Estado de la definición actualizado.");
      await loadAll();
    }
  }

  async function openCompetition() {
    showCompetitionView();
    try {
      await loadAll();
    } catch (e) {
      notice(
        `No se pudo cargar la Etapa 3. Ejecutá primero supabase/competition-migration.sql. Detalle: ${e.message}`,
        true
      );
    }
  }

  document.addEventListener("click", e => {
    const t = e.target;

    if (t.id === "competitionTabBtn") openCompetition();

    if (t.id === "teamsTabBtn" || t.id === "fixtureTabBtn") {
      hideCompetitionView();
    }

    if (t.matches(".create-playoff")) {
      createPlayoff(t.dataset.category);
    }

    if (t.matches(".save-playoff-match")) {
      savePlayoffMatch(t.dataset.id);
    }

    if (t.matches(".save-playoff-status")) {
      savePlayoffStatus(t.dataset.id);
    }
  });

  $("reloadCompetitionBtn")?.addEventListener("click", loadAll);
  $("reloadPlayoffsBtn")?.addEventListener("click", loadAll);
})();
