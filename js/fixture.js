(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const CATEGORY_LABELS = {
    "M13-15": "Masculino 13–15",
    "M16-22": "Masculino 16–22",
    "F-LIBRE": "Femenino Libre"
  };

  let client = null;
  let teams = [];
  let fixtures = [];
  let manualMatches = [];
  let initialized = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[ch]);

  function ageOn(dateStr, refStr) {
    if (!dateStr || !refStr) return null;
    const birth = new Date(dateStr + "T12:00:00");
    const ref = new Date(refStr + "T12:00:00");
    let age = ref.getFullYear() - birth.getFullYear();
    const m = ref.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
    return age;
  }

  function setupClient() {
    if (client) return true;
    const cfg = window.APP_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return false;
    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
    return true;
  }

  async function ensureAdmin() {
    if (!setupClient()) return false;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return false;
    const { data, error } = await client.rpc("is_admin");
    return !error && data === true;
  }

  function showView(name) {
    const teamsView = $("teamsAdminView");
    const fixtureView = $("fixtureAdminView");
    const teamsBtn = $("teamsTabBtn");
    const fixtureBtn = $("fixtureTabBtn");

    const fixtureMode = name === "fixture";
    teamsView.classList.toggle("hidden", fixtureMode);
    fixtureView.classList.toggle("hidden", !fixtureMode);
    teamsBtn.classList.toggle("active", !fixtureMode);
    fixtureBtn.classList.toggle("active", fixtureMode);
  }

  async function loadTeams() {
    const { data, error } = await client
      .from("teams")
      .select("*,participants(*,documents(*))")
      .eq("is_submitted", true)
      .order("team_name", { ascending: true });

    if (error) throw error;
    teams = data || [];
  }

  async function loadFixtures() {
    const { data: fixtureRows, error: fixtureError } = await client
      .from("fixtures")
      .select("*")
      .order("created_at", { ascending: false });

    if (fixtureError) throw fixtureError;

    const ids = (fixtureRows || []).map(f => f.id);
    let matches = [];

    if (ids.length) {
      const { data, error } = await client
        .from("fixture_matches")
        .select("*")
        .in("fixture_id", ids)
        .order("round_number", { ascending: true })
        .order("match_order", { ascending: true });

      if (error) throw error;
      matches = data || [];
    }

    fixtures = (fixtureRows || []).map(f => ({
      ...f,
      matches: matches.filter(m => m.fixture_id === f.id)
    }));
  }

  function participantReasons(p, category, competitionDate) {
    const reasons = [];
    const docs = p.documents || [];
    const types = new Set(docs.map(d => d.document_type));
    const age = ageOn(p.birth_date, "2026-09-11");

    if (!types.has("CEDULA")) reasons.push(`${p.first_name}: falta cédula`);
    if (!types.has("APTITUD")) reasons.push(`${p.first_name}: falta carné`);
    if (p.document_status !== "Verificado") {
      reasons.push(`${p.first_name}: documentación no verificada`);
    }

    if (category === "M13-15" && (age === null || age < 13 || age > 15)) {
      reasons.push(`${p.first_name}: edad fuera de 13–15`);
    }

    if (category === "M16-22" && (age === null || age < 16 || age > 22)) {
      reasons.push(`${p.first_name}: edad fuera de 16–22`);
    }

    if (age !== null && age < 18 && !p.participation_consent) {
      reasons.push(`${p.first_name}: falta autorización de menor`);
    }

    if (competitionDate && p.fitness_expiry && p.fitness_expiry < competitionDate) {
      reasons.push(`${p.first_name}: carné vence ${p.fitness_expiry}`);
    }

    return reasons;
  }

  function evaluateTeam(team, competitionDate) {
    const reasons = [];
    const ps = team.participants || [];

    if (team.status !== "Confirmado") {
      reasons.push("El equipo todavía no está Confirmado");
    }

    if (ps.length < 5 || ps.length > 10) {
      reasons.push(`Cantidad de integrantes inválida (${ps.length})`);
    }

    if (!team.data_consent || !team.final_declaration) {
      reasons.push("Faltan declaraciones obligatorias del equipo");
    }

    ps.forEach(p => {
      reasons.push(...participantReasons(p, team.category, competitionDate));
    });

    return {
      eligible: reasons.length === 0,
      reasons
    };
  }

  function categoryTeams(category, competitionDate) {
    return teams
      .filter(t => t.category === category)
      .map(t => ({ ...t, evaluation: evaluateTeam(t, competitionDate) }));
  }

  function showNotice(message, danger = false) {
    const box = $("fixtureNotice");
    box.textContent = message;
    box.classList.remove("hidden");
    box.classList.toggle("danger", danger);
    box.classList.toggle("warning", !danger);
  }

  function hideNotice() {
    $("fixtureNotice").classList.add("hidden");
  }

  function renderEligibility() {
    const date = $("fixtureCompetitionDate").value;

    $("eligibilitySummary").innerHTML = Object.keys(CATEGORY_LABELS).map(category => {
      const rows = categoryTeams(category, date);
      const eligible = rows.filter(x => x.evaluation.eligible);
      const blocked = rows.filter(x => !x.evaluation.eligible);

      return `
        <article class="eligibility-card">
          <div class="eligibility-card-head">
            <div>
              <span class="fixture-kicker">${esc(CATEGORY_LABELS[category])}</span>
              <h3>${eligible.length} habilitado${eligible.length === 1 ? "" : "s"} · ${blocked.length} pendiente${blocked.length === 1 ? "" : "s"}</h3>
            </div>
            <span class="eligibility-count">${rows.length}</span>
          </div>

          <div class="eligibility-section">
            <strong class="eligibility-title ok">✓ Pueden entrar al fixture</strong>
            ${
              eligible.length
                ? eligible.map(t => `
                  <div class="eligibility-team ok">
                    <span>${esc(t.team_name)}</span>
                    <small>${esc(t.registration_number)}</small>
                  </div>
                `).join("")
                : `<p class="small">Todavía no hay equipos habilitados.</p>`
            }
          </div>

          <div class="eligibility-section">
            <strong class="eligibility-title bad">! Requieren revisión</strong>
            ${
              blocked.length
                ? blocked.map(t => `
                  <details class="eligibility-team blocked">
                    <summary>
                      <span>${esc(t.team_name)}</span>
                      <small>${t.evaluation.reasons.length} observación${t.evaluation.reasons.length === 1 ? "" : "es"}</small>
                    </summary>
                    <ul>
                      ${t.evaluation.reasons.map(r => `<li>${esc(r)}</li>`).join("")}
                    </ul>
                  </details>
                `).join("")
                : `<p class="small">No hay equipos observados en esta categoría.</p>`
            }
          </div>

          ${
            !date
              ? `<p class="fixture-hint">Primero indicá la fecha de inicio del campeonato.</p>`
              : eligible.length < 2
                ? `<p class="fixture-hint">Se necesitan al menos 2 equipos habilitados.</p>`
                : `<p class="fixture-hint">Estos equipos están disponibles para el fixture manual.</p>`
          }
        </article>
      `;
    }).join("");
  }

  function manualEligibleTeams() {
    const category = $("manualFixtureCategory")?.value || "";
    const competitionDate = $("fixtureCompetitionDate")?.value || "";
    if (!category || !competitionDate) return [];
    return categoryTeams(category, competitionDate).filter(t => t.evaluation.eligible);
  }

  function manualTeamOptions(selectedId = "") {
    const options = manualEligibleTeams();
    return [
      '<option value="">Seleccionar equipo</option>',
      ...options.map(t =>
        `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${esc(t.team_name)}</option>`
      )
    ].join("");
  }

  function renderManualBuilder() {
    const container = $("manualFixtureMatches");
    const hint = $("manualFixtureHint");
    const addBtn = $("addManualMatchBtn");
    const saveBtn = $("createManualFixtureBtn");
    if (!container || !hint || !addBtn || !saveBtn) return;

    const category = $("manualFixtureCategory")?.value || "";
    const competitionDate = $("fixtureCompetitionDate")?.value || "";
    const eligible = manualEligibleTeams();

    const defaultName = category ? `Fixture manual ${CATEGORY_LABELS[category]} 2026` : "";
    const nameInput = $("manualFixtureName");
    if (nameInput && !nameInput.value.trim()) nameInput.placeholder = defaultName;

    if (!competitionDate) {
      hint.textContent = "Primero indicá la fecha de inicio del campeonato.";
      addBtn.disabled = true;
      saveBtn.disabled = true;
    } else if (eligible.length < 2) {
      hint.textContent = "Se necesitan al menos 2 equipos habilitados en la categoría seleccionada.";
      addBtn.disabled = true;
      saveBtn.disabled = true;
    } else {
      hint.textContent = `${eligible.length} equipos habilitados disponibles. Podés armar los cruces manualmente.`;
      addBtn.disabled = false;
      saveBtn.disabled = manualMatches.length === 0;
    }

    if (!manualMatches.length) {
      container.innerHTML = `
        <div class="fixture-empty manual-empty">
          <span>✍️</span>
          <strong>No agregaste partidos todavía</strong>
          <small>Presioná “Agregar partido” para comenzar a armar el fixture manual.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = manualMatches.map((m, index) => `
      <article class="manual-match-row" data-manual-id="${m.id}">
        <div class="manual-match-number">P${index + 1}</div>

        <label>
          Fecha / rueda
          <input
            type="number"
            min="1"
            value="${m.round_number}"
            data-manual-field="round_number"
            data-manual-id="${m.id}"
          >
        </label>

        <label>
          Equipo A
          <select data-manual-field="team_a_id" data-manual-id="${m.id}">
            ${manualTeamOptions(m.team_a_id)}
          </select>
        </label>

        <span class="manual-versus">vs.</span>

        <label>
          Equipo B
          <select data-manual-field="team_b_id" data-manual-id="${m.id}">
            ${manualTeamOptions(m.team_b_id)}
          </select>
        </label>

        <label>
          Día
          <input
            type="date"
            value="${esc(m.match_date || "")}"
            data-manual-field="match_date"
            data-manual-id="${m.id}"
          >
        </label>

        <label>
          Hora
          <input
            type="time"
            value="${esc(m.match_time || "")}"
            data-manual-field="match_time"
            data-manual-id="${m.id}"
          >
        </label>

        <label>
          Cancha
          <input
            value="${esc(m.court || "")}"
            placeholder="Cancha"
            data-manual-field="court"
            data-manual-id="${m.id}"
          >
        </label>

        <button class="btn danger remove-manual-match" data-manual-id="${m.id}" type="button">
          Quitar
        </button>
      </article>
    `).join("");
  }

  function addManualMatch() {
    const competitionDate = $("fixtureCompetitionDate")?.value || "";
    if (!competitionDate) {
      showNotice("Indicá primero la fecha de inicio del campeonato.", true);
      return;
    }

    if (manualEligibleTeams().length < 2) {
      showNotice("No hay suficientes equipos habilitados para crear partidos manuales.", true);
      return;
    }

    manualMatches.push({
      id: crypto.randomUUID(),
      round_number: 1,
      team_a_id: "",
      team_b_id: "",
      match_date: competitionDate,
      match_time: "",
      court: ""
    });

    renderManualBuilder();
  }

  function updateManualMatch(target) {
    const id = target.dataset.manualId;
    const field = target.dataset.manualField;
    if (!id || !field) return;

    const row = manualMatches.find(m => m.id === id);
    if (!row) return;

    row[field] = field === "round_number"
      ? Math.max(1, Number(target.value || 1))
      : target.value;
  }

  async function createManualFixture() {
    hideNotice();

    const category = $("manualFixtureCategory")?.value || "";
    const competitionDate = $("fixtureCompetitionDate")?.value || "";
    const eligible = manualEligibleTeams();
    const eligibleIds = new Set(eligible.map(t => t.id));

    if (!competitionDate) {
      showNotice("Indicá la fecha de inicio del campeonato.", true);
      return;
    }

    if (!category || eligible.length < 2) {
      showNotice("La categoría no tiene suficientes equipos habilitados.", true);
      return;
    }

    if (!manualMatches.length) {
      showNotice("Agregá al menos un partido al fixture manual.", true);
      return;
    }

    for (let i = 0; i < manualMatches.length; i++) {
      const m = manualMatches[i];
      if (!eligibleIds.has(m.team_a_id) || !eligibleIds.has(m.team_b_id)) {
        showNotice(`Partido ${i + 1}: seleccioná dos equipos habilitados.`, true);
        return;
      }
      if (m.team_a_id === m.team_b_id) {
        showNotice(`Partido ${i + 1}: un equipo no puede jugar contra sí mismo.`, true);
        return;
      }
      if (!Number.isInteger(Number(m.round_number)) || Number(m.round_number) < 1) {
        showNotice(`Partido ${i + 1}: la fecha/rueda debe ser mayor o igual a 1.`, true);
        return;
      }
    }

    const teamsByRound = new Map();
    for (const m of manualMatches) {
      const round = Number(m.round_number);
      if (!teamsByRound.has(round)) teamsByRound.set(round, new Set());
      const used = teamsByRound.get(round);
      if (used.has(m.team_a_id) || used.has(m.team_b_id)) {
        showNotice(`En la Fecha ${round} hay un equipo asignado a más de un partido.`, true);
        return;
      }
      used.add(m.team_a_id);
      used.add(m.team_b_id);
    }

    const existing = fixtures.find(
      f => f.category === category && f.status !== "Finalizado"
    );
    if (existing) {
      const ok = window.confirm(
        `Ya existe un fixture de ${CATEGORY_LABELS[category]} (${existing.fixture_name}). ¿Querés crear otro fixture manual igualmente?`
      );
      if (!ok) return;
    }

    const nameInput = $("manualFixtureName");
    const fixtureName = (nameInput?.value || "").trim() ||
      `Fixture manual ${CATEGORY_LABELS[category]} 2026`;

    const { data: { user } } = await client.auth.getUser();

    const { data: fixture, error: fixtureError } = await client
      .from("fixtures")
      .insert({
        category,
        fixture_name: fixtureName,
        competition_date: competitionDate,
        format: "ROUND_ROBIN",
        creation_mode: "MANUAL",
        created_by: user?.id || null
      })
      .select()
      .single();

    if (fixtureError) {
      showNotice(`No se pudo crear el fixture manual: ${fixtureError.message}`, true);
      return;
    }

    const counters = {};
    const matchRows = manualMatches.map(m => {
      const round = Number(m.round_number);
      counters[round] = (counters[round] || 0) + 1;
      return {
        fixture_id: fixture.id,
        round_number: round,
        round_label: `Fecha ${round}`,
        match_order: counters[round],
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        is_bye: false,
        match_date: m.match_date || null,
        match_time: m.match_time || null,
        court: (m.court || "").trim() || null
      };
    });

    const { error: matchError } = await client
      .from("fixture_matches")
      .insert(matchRows);

    if (matchError) {
      await client.from("fixtures").delete().eq("id", fixture.id);
      showNotice(`No se pudieron guardar los partidos: ${matchError.message}`, true);
      return;
    }

    manualMatches = [];
    if (nameInput) nameInput.value = "";
    showNotice(
      `Fixture manual creado para ${CATEGORY_LABELS[category]} con ${matchRows.length} partido${matchRows.length === 1 ? "" : "s"}.`
    );

    await loadFixtures();
    renderManualBuilder();
    renderSavedFixtures();
  }

  function teamName(id) {
    if (!id) return "—";
    return teams.find(t => t.id === id)?.team_name || "Equipo";
  }

  function renderSavedFixtures() {
    if (!fixtures.length) {
      $("savedFixtures").innerHTML = `
        <div class="fixture-empty">
          <span>🏆</span>
          <strong>Todavía no hay fixtures generados</strong>
          <small>Cuando haya al menos dos equipos habilitados en una categoría, podrás crearlo arriba.</small>
        </div>
      `;
      return;
    }

    $("savedFixtures").innerHTML = fixtures.map(f => {
      const rounds = [...new Set(f.matches.map(m => m.round_number))];

      return `
        <article class="saved-fixture" data-fixture-id="${f.id}">
          <div class="saved-fixture-head">
            <div>
              <span class="fixture-kicker">${esc(CATEGORY_LABELS[f.category])}</span>
              <h3>${esc(f.fixture_name)}</h3>
              <p class="small">
                Inicio ${esc(f.competition_date)} ·
                ${f.creation_mode === "MANUAL" ? "Fixture manual" : "Automático · Todos contra todos"} ·
                ${f.matches.filter(m => !m.is_bye).length} partidos
              </p>
            </div>

            <div class="fixture-head-actions">
              <select class="fixture-status-select" data-fixture-id="${f.id}">
                <option ${f.status === "Borrador" ? "selected" : ""}>Borrador</option>
                <option ${f.status === "Publicado" ? "selected" : ""}>Publicado</option>
                <option ${f.status === "Finalizado" ? "selected" : ""}>Finalizado</option>
              </select>
              <button class="btn light save-fixture-status" data-fixture-id="${f.id}" type="button">Guardar estado</button>
              <button class="btn danger delete-fixture" data-fixture-id="${f.id}" type="button">Eliminar</button>
            </div>
          </div>

          <div class="fixture-rounds">
            ${rounds.map(round => {
              const matches = f.matches.filter(m => m.round_number === round);
              return `
                <section class="fixture-round">
                  <h4>Fecha ${round}</h4>

                  ${matches.map(m => {
                    if (m.is_bye) {
                      return `
                        <div class="fixture-match bye-match">
                          <span class="match-number">LIBRE</span>
                          <strong>${esc(teamName(m.team_a_id || m.team_b_id))}</strong>
                          <span class="small">No juega esta fecha</span>
                        </div>
                      `;
                    }

                    return `
                      <div class="fixture-match" data-match-id="${m.id}">
                        <div class="fixture-pair">
                          <span class="match-number">P${m.match_order}</span>
                          <strong>${esc(teamName(m.team_a_id))}</strong>
                          <span class="versus">vs.</span>
                          <strong>${esc(teamName(m.team_b_id))}</strong>
                        </div>

                        <div class="fixture-match-fields">
                          <input class="match-date" type="date" value="${esc(m.match_date || "")}" aria-label="Fecha del partido">
                          <input class="match-time" type="time" value="${esc(m.match_time ? String(m.match_time).slice(0,5) : "")}" aria-label="Hora del partido">
                          <input class="match-court" value="${esc(m.court || "")}" placeholder="Cancha" aria-label="Cancha">
                          <div class="score-inputs">
                            <input class="score-a" type="number" min="0" value="${m.score_a ?? ""}" placeholder="0" aria-label="Goles equipo A">
                            <span>–</span>
                            <input class="score-b" type="number" min="0" value="${m.score_b ?? ""}" placeholder="0" aria-label="Goles equipo B">
                          </div>
                          <select class="match-status">
                            <option ${m.match_status === "Programado" ? "selected" : ""}>Programado</option>
                            <option ${m.match_status === "Jugado" ? "selected" : ""}>Jugado</option>
                            <option ${m.match_status === "Suspendido" ? "selected" : ""}>Suspendido</option>
                          </select>
                          <button class="btn dark save-match" data-match-id="${m.id}" type="button">Guardar</button>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </section>
              `;
            }).join("")}
          </div>
        </article>
      `;
    }).join("");
  }

  async function saveMatch(matchId) {
    const row = document.querySelector(`[data-match-id="${matchId}"].fixture-match`);
    if (!row) return;

    const val = selector => row.querySelector(selector)?.value ?? "";
    const score = selector => {
      const x = val(selector);
      return x === "" ? null : Number(x);
    };

    const payload = {
      match_date: val(".match-date") || null,
      match_time: val(".match-time") || null,
      court: val(".match-court").trim() || null,
      score_a: score(".score-a"),
      score_b: score(".score-b"),
      match_status: val(".match-status")
    };

    const { error } = await client
      .from("fixture_matches")
      .update(payload)
      .eq("id", matchId);

    if (error) {
      showNotice(`No se pudo guardar el partido: ${error.message}`, true);
    } else {
      showNotice("Partido actualizado.");
      await loadFixtures();
      renderSavedFixtures();
    }
  }

  async function saveFixtureStatus(fixtureId) {
    const select = document.querySelector(
      `.fixture-status-select[data-fixture-id="${fixtureId}"]`
    );
    if (!select) return;

    const { error } = await client
      .from("fixtures")
      .update({ status: select.value })
      .eq("id", fixtureId);

    if (error) {
      showNotice(error.message, true);
    } else {
      showNotice("Estado del fixture actualizado.");
      await loadFixtures();
      renderSavedFixtures();
    }
  }

  async function deleteFixture(fixtureId) {
    if (!window.confirm("¿Eliminar este fixture y todos sus partidos?")) return;

    const { error } = await client
      .from("fixtures")
      .delete()
      .eq("id", fixtureId);

    if (error) {
      showNotice(error.message, true);
    } else {
      showNotice("Fixture eliminado.");
      await loadFixtures();
      renderSavedFixtures();
    }
  }

  async function refreshModule() {
    try {
      if (!await ensureAdmin()) {
        showNotice("Iniciá sesión como administrador para usar el módulo de fixture.", true);
        return;
      }

      await Promise.all([loadTeams(), loadFixtures()]);
      renderEligibility();
      renderManualBuilder();
      renderSavedFixtures();
    } catch (error) {
      showNotice(
        `No se pudo cargar el módulo. Si todavía no ejecutaste fixture-migration.sql en Supabase, hacelo primero. Detalle: ${error.message}`,
        true
      );
    }
  }

  async function activateFixture() {
    showView("fixture");
    if (!initialized) initialized = true;
    await refreshModule();
  }

  document.addEventListener("click", event => {
    const target = event.target;

    if (target.id === "teamsTabBtn") {
      showView("teams");
    }

    if (target.id === "fixtureTabBtn") {
      activateFixture();
    }

    if (target.id === "addManualMatchBtn") {
      addManualMatch();
    }

    if (target.id === "createManualFixtureBtn") {
      createManualFixture();
    }

    if (target.matches(".remove-manual-match")) {
      manualMatches = manualMatches.filter(m => m.id !== target.dataset.manualId);
      renderManualBuilder();
    }

    if (target.matches(".save-match")) {
      saveMatch(target.dataset.matchId);
    }

    if (target.matches(".save-fixture-status")) {
      saveFixtureStatus(target.dataset.fixtureId);
    }

    if (target.matches(".delete-fixture")) {
      deleteFixture(target.dataset.fixtureId);
    }
  });

  $("fixtureCompetitionDate")?.addEventListener("change", () => {
    if (teams.length) {
      renderEligibility();
      renderManualBuilder();
    }
  });

  $("manualFixtureCategory")?.addEventListener("change", () => {
    manualMatches = [];
    renderManualBuilder();
  });

  document.addEventListener("input", event => {
    if (event.target.matches("[data-manual-field][data-manual-id]")) {
      updateManualMatch(event.target);
    }
  });

  document.addEventListener("change", event => {
    if (event.target.matches("[data-manual-field][data-manual-id]")) {
      updateManualMatch(event.target);
    }
  });

  $("reloadFixturesBtn")?.addEventListener("click", refreshModule);

  // Fecha sugerida: no se inventa una fecha de campeonato.
  // El administrador debe elegirla expresamente.
  showView("teams");
})();
