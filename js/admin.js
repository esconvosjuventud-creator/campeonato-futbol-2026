(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let client = null;
  let allTeams = [];

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);

  const cat = c => ({
    "M13-15": "Masculino 13–15",
    "M16-22": "Masculino 16–22",
    "F-LIBRE": "Femenino Libre"
  })[c] || c;

  function init() {
    const cfg = window.APP_CONFIG || {};

    if (
      !cfg.SUPABASE_URL ||
      !cfg.SUPABASE_PUBLISHABLE_KEY ||
      cfg.SUPABASE_URL.includes("PEGAR_AQUI")
    ) {
      $("configError").textContent = "Falta configurar Supabase en js/config.js.";
      $("configError").classList.remove("hidden");
      $("loginCard").classList.add("hidden");
      return false;
    }

    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );

    return true;
  }

  async function isAdmin() {
    const { data, error } = await client.rpc("is_admin");
    return !error && data === true;
  }

  async function hasValidIdentity() {
    const { data, error } = await client.auth.getClaims();
    return !error && Boolean(data?.claims?.sub);
  }

  async function syncSession() {
    if (await hasValidIdentity() && await isAdmin()) {
      showPanel();
      await loadTeams();
      return;
    }

    showLogin();
  }

  function showLogin() {
    $("loginCard").classList.remove("hidden");
    $("adminPanel").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
  }

  function showPanel() {
    $("loginCard").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
  }

  async function loadTeams() {
    const { data, error } = await client
      .from("teams")
      .select(`*,participants(*,documents(*))`)
      .eq("is_submitted", true)
      .order("submitted_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    allTeams = data || [];
    render();
  }

  function renderStats(data) {
    const counts = {
      total: data.length,
      pending: data.filter(x => x.status === "Pendiente").length,
      confirmed: data.filter(x => x.status === "Confirmado").length,
      players: data.reduce((a, t) => a + (t.participants?.length || 0), 0),
      docs: data.reduce(
        (a, t) => a + (t.participants || []).reduce(
          (b, p) => b + (p.documents?.length || 0),
          0
        ),
        0
      )
    };

    $("stats").innerHTML = `
      <div class="stat"><span>Total equipos</span><strong>${counts.total}</strong></div>
      <div class="stat"><span>Pendientes</span><strong>${counts.pending}</strong></div>
      <div class="stat"><span>Confirmados</span><strong>${counts.confirmed}</strong></div>
      <div class="stat"><span>Participantes</span><strong>${counts.players}</strong></div>
      <div class="stat"><span>Documentos</span><strong>${counts.docs}</strong></div>
    `;
  }

  /* ======================================================
     WHATSAPP
     Convierte números uruguayos a formato internacional:
     099 123 456 -> 59899123456
     +598 99 123 456 -> 59899123456
     ====================================================== */
  function whatsappNumber(phone) {
    let digits = String(phone || "").replace(/\D/g, "");

    if (!digits) return "";

    if (digits.startsWith("598")) {
      return digits;
    }

    if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }

    // Números uruguayos de 8 dígitos sin código de país.
    if (digits.length === 8) {
      return "598" + digits;
    }

    // Si ya parece tener un código internacional diferente,
    // se conserva para no modificarlo incorrectamente.
    return digits.length > 8 ? digits : "";
  }

  function whatsappHref(phone, team, contactName) {
    const number = whatsappNumber(phone);
    if (!number) return "";

    const name = contactName || "referente";
    const message =
`Hola ${name} 👋

Te escribimos desde la organización del Campeonato de Fútbol “Que en tu equipo no juegue la violencia”.

⚽ Equipo: ${team.team_name}
📝 Inscripción: ${team.registration_number}

Queremos comunicarnos contigo por la inscripción del equipo.`;

    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function whatsappButton(team, name, phone, secondary = false, compact = false) {
    const href = whatsappHref(phone, team, name);
    if (!href) return "";

    const label = secondary
      ? (compact ? "2.º referente" : `WhatsApp · ${name || "Segundo referente"}`)
      : (compact ? "WhatsApp" : `WhatsApp · ${name || "Referente"}`);

    return `
      <a
        class="wa-contact-btn ${secondary ? "secondary-contact" : ""} ${compact ? "compact" : ""}"
        href="${esc(href)}"
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir conversación por WhatsApp con ${esc(name || "referente")}"
      >
        <span class="wa-icon" aria-hidden="true">✆</span>
        <span>${esc(label)}</span>
      </a>
    `;
  }

  function teamContactButtons(team, compact = false) {
    const primary = whatsappButton(
      team,
      team.delegate_name,
      team.delegate_phone,
      false,
      compact
    );

    const secondary = team.second_contact_phone
      ? whatsappButton(
          team,
          team.second_contact_name || "Segundo referente",
          team.second_contact_phone,
          true,
          compact
        )
      : "";

    return primary + secondary;
  }

  function filtered() {
    const c = $("categoryFilter").value;
    const s = $("statusFilter").value;
    const q = $("searchBox").value.toLowerCase().trim();

    return allTeams.filter(t => {
      if (c && t.category !== c) return false;
      if (s && t.status !== s) return false;

      const hay = [
        t.registration_number,
        t.team_name,
        t.delegate_name,
        t.delegate_ci,
        t.delegate_phone,
        t.second_contact_name,
        t.second_contact_phone,
        ...(t.participants || []).flatMap(p => [
          p.first_name,
          p.last_name,
          p.ci
        ])
      ].join(" ").toLowerCase();

      return !q || hay.includes(q);
    });
  }

  function render() {
    const data = filtered();
    renderStats(allTeams);

    $("teamsList").innerHTML = data.map(t => `
      <article class="team-row">
        <div>
          <strong class="mono">${esc(t.registration_number)}</strong>
          <p class="small">${new Date(t.submitted_at).toLocaleString("es-UY")}</p>
        </div>

        <div>
          <h3>${esc(t.team_name)}</h3>
          <p class="small">${esc(cat(t.category))} · ${t.participants.length} integrantes</p>
        </div>

        <div class="team-contact-column">
          <strong>${esc(t.delegate_name)}</strong>
          <p class="small">${esc(t.delegate_phone)}</p>
          <div class="team-contact-actions">
            ${teamContactButtons(t, true)}
          </div>
        </div>

        <div>
          <span class="status-pill">${esc(t.status)}</span>
        </div>

        <button class="btn dark open-team" data-id="${t.id}" type="button">
          Ver inscripción
        </button>
      </article>
    `).join("") || "<p class='help'>No hay resultados.</p>";
  }

  async function openTeam(id) {
    const t = allTeams.find(x => x.id === id);
    if (!t) return;

    $("dialogTitle").textContent = `${t.registration_number} — ${t.team_name}`;

    const secondContact = t.second_contact_phone
      ? `
        <div class="contact-person">
          <div>
            <span class="contact-role">Segundo referente</span>
            <strong>${esc(t.second_contact_name || "Segundo referente")}</strong>
            <small>${esc(t.second_contact_phone)}</small>
          </div>
          ${whatsappButton(
            t,
            t.second_contact_name || "Segundo referente",
            t.second_contact_phone,
            true,
            false
          )}
        </div>
      `
      : "";

    $("dialogContent").innerHTML = `
      <section class="admin-contact-panel">
        <div class="admin-contact-panel-head">
          <div>
            <span class="contact-panel-kicker">CONTACTOS DEL EQUIPO</span>
            <h3>Hablar con los referentes</h3>
          </div>
          <span class="contact-panel-note">Abre WhatsApp o WhatsApp Web</span>
        </div>

        <div class="contact-people">
          <div class="contact-person primary-contact">
            <div>
              <span class="contact-role">Referente principal</span>
              <strong>${esc(t.delegate_name)}</strong>
              <small>${esc(t.delegate_phone)}</small>
            </div>
            ${whatsappButton(
              t,
              t.delegate_name,
              t.delegate_phone,
              false,
              false
            )}
          </div>

          ${secondContact}
        </div>
      </section>

      <div class="admin-fields">
        <label>
          Estado
          <select id="editStatus">
            <option ${t.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
            <option ${t.status === "En revisión" ? "selected" : ""}>En revisión</option>
            <option ${t.status === "Confirmado" ? "selected" : ""}>Confirmado</option>
            <option ${t.status === "Observado" ? "selected" : ""}>Observado</option>
            <option ${t.status === "Rechazado" ? "selected" : ""}>Rechazado</option>
          </select>
        </label>

        <label>
          Responsable
          <input value="${esc(t.delegate_name)}" disabled>
        </label>

        <label>
          Teléfono
          <input value="${esc(t.delegate_phone)}" disabled>
        </label>

        <label>
          Correo
          <input value="${esc(t.delegate_email)}" disabled>
        </label>
      </div>

      <button id="saveTeamStatus" class="btn primary" type="button">
        Guardar estado
      </button>

      <section class="card" style="margin-top:1rem">
        <h3>Administrar equipo</h3>
        <p class="small">Podés agregar un jugador o eliminar una inscripción incorrecta.</p>
        <div class="toolbar">
          <button id="toggleAddPlayer" class="btn dark" type="button">➕ Agregar jugador</button>
          <button id="deleteTeamBtn" class="btn danger" type="button">🗑️ Borrar equipo</button>
        </div>

        <form id="addPlayerForm" class="hidden" style="margin-top:1rem">
          <div class="grid two">
            <label>Nombre *<input id="newFirstName" required maxlength="80"></label>
            <label>Apellidos *<input id="newLastName" required maxlength="100"></label>
            <label>Cédula *<input id="newCi" required inputmode="numeric" maxlength="20"></label>
            <label>Fecha de nacimiento *<input id="newBirth" required type="date"></label>
            <label>Teléfono personal<input id="newPhone" inputmode="tel" maxlength="30"></label>
            <label>Teléfono de contacto *<input id="newContactPhone" required inputmode="tel" maxlength="30"></label>
            <label>Correo electrónico<input id="newEmail" type="email" maxlength="160"></label>
            <label>Vencimiento del carné *<input id="newFitnessExpiry" required type="date"></label>
          </div>
          <p class="small">El jugador se cargará con estado “Documentación faltante”.</p>
          <div id="addPlayerError" class="alert danger hidden"></div>
          <button class="btn primary" type="submit">Guardar jugador</button>
        </form>
      </section>

      <hr>

      ${(t.participants || []).map((p, i) => `
        <section class="admin-player">
          <h3>${i + 1}. ${esc(p.first_name)} ${esc(p.last_name)}</h3>
          <p class="small">
            CI ${esc(p.ci)} · Nacimiento ${esc(p.birth_date)} · Imagen:
            <strong>${p.image_consent ? "AUTORIZADA" : "NO AUTORIZADA"}</strong>
          </p>

          ${p.guardian_name ? `
            <p class="small">
              Responsable legal:
              ${esc(p.guardian_name)} ·
              ${esc(p.guardian_relation)} ·
              ${esc(p.guardian_phone)}
            </p>
          ` : ""}

          <div class="doc-actions">
            ${(p.documents || []).map(d => `
              <button
                class="btn light open-doc"
                data-path="${esc(d.storage_path)}"
                type="button"
              >
                ${d.document_type === "CEDULA" ? "Ver cédula" : "Ver carné"}
              </button>
            `).join("")}
          </div>

          <div class="admin-fields">
            <label>
              Estado documental
              <select class="doc-status" data-pid="${p.id}">
                <option ${p.document_status === "Documentación completa" ? "selected" : ""}>Documentación completa</option>
                <option ${p.document_status === "Documentación a corregir" ? "selected" : ""}>Documentación a corregir</option>
                <option ${p.document_status === "Documentación faltante" ? "selected" : ""}>Documentación faltante</option>
                <option ${p.document_status === "Verificado" ? "selected" : ""}>Verificado</option>
              </select>
            </label>

            <label>
              Observaciones
              <textarea class="doc-notes" data-pid="${p.id}">${esc(p.admin_notes || "")}</textarea>
            </label>
          </div>

          <button
            class="btn dark save-player"
            data-pid="${p.id}"
            type="button"
          >
            Guardar participante
          </button>
        </section>
      `).join("")}
    `;

    $("teamDialog").showModal();

    $("saveTeamStatus").onclick = async () => {
      const { error } = await client
        .from("teams")
        .update({ status: $("editStatus").value })
        .eq("id", t.id);

      if (error) {
        alert(error.message);
      } else {
        await loadTeams();
        $("teamDialog").close();
      }
    };

    $("toggleAddPlayer").onclick = () => {
      $("addPlayerForm").classList.toggle("hidden");
    };

    $("addPlayerForm").onsubmit = async event => {
      event.preventDefault();
      $("addPlayerError").classList.add("hidden");

      const payload = {
        first_name: $("newFirstName").value,
        last_name: $("newLastName").value,
        ci: $("newCi").value,
        birth_date: $("newBirth").value,
        phone: $("newPhone").value,
        contact_phone: $("newContactPhone").value,
        email: $("newEmail").value,
        fitness_expiry: $("newFitnessExpiry").value
      };

      const { error } = await client.rpc("admin_add_participant", {
        p_team_id: t.id,
        p_data: payload
      });

      if (error) {
        $("addPlayerError").textContent = error.message;
        $("addPlayerError").classList.remove("hidden");
        return;
      }

      await loadTeams();
      $("teamDialog").close();
      alert("Jugador agregado. Quedó marcado con documentación faltante.");
    };

    $("deleteTeamBtn").onclick = async () => {
      const confirmation = prompt(
        `Esta acción borrará definitivamente la inscripción de "${t.team_name}" y sus documentos. Para confirmar, escribí BORRAR.`
      );

      if (confirmation !== "BORRAR") return;

      const { error } = await client.rpc("admin_delete_team", {
        p_team_id: t.id
      });

      if (error) {
        alert(error.message);
        return;
      }

      $("teamDialog").close();
      await loadTeams();
      alert("El equipo fue eliminado.");
    };
  }

  async function openDoc(path) {
    const { data, error } = await client
      .storage
      .from("documentos")
      .createSignedUrl(path, 90);

    if (error) {
      alert(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function savePlayer(pid) {
    const st = document.querySelector(`.doc-status[data-pid="${pid}"]`).value;
    const notes = document.querySelector(`.doc-notes[data-pid="${pid}"]`).value;

    const { error } = await client
      .from("participants")
      .update({
        document_status: st,
        admin_notes: notes
      })
      .eq("id", pid);

    if (error) {
      alert(error.message);
    } else {
      alert("Guardado.");
    }
  }

  function csv() {
    const rows = [[
      "Numero",
      "Equipo",
      "Categoria",
      "Estado",
      "Responsable",
      "Telefono",
      "Segundo referente",
      "Telefono segundo referente",
      "Participante",
      "Cedula",
      "Nacimiento",
      "Carne vence",
      "Imagen",
      "Estado documental"
    ]];

    allTeams.forEach(t =>
      (t.participants || []).forEach(p =>
        rows.push([
          t.registration_number,
          t.team_name,
          cat(t.category),
          t.status,
          t.delegate_name,
          t.delegate_phone,
          t.second_contact_name || "",
          t.second_contact_phone || "",
          `${p.first_name} ${p.last_name}`,
          p.ci,
          p.birth_date,
          p.fitness_expiry,
          p.image_consent ? "SI" : "NO",
          p.document_status
        ])
      )
    );

    const text = rows
      .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(
      ["\ufeff" + text],
      { type: "text/csv;charset=utf-8" }
    );

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "inscripciones_campeonato_2026.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.addEventListener("click", e => {
    if (e.target.matches(".open-team")) {
      openTeam(e.target.dataset.id);
    }

    if (e.target.matches(".open-doc")) {
      openDoc(e.target.dataset.path);
    }

    if (e.target.matches(".save-player")) {
      savePlayer(e.target.dataset.pid);
    }
  });

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    $("loginError").classList.add("hidden");

    const { error } = await client.auth.signInWithPassword({
      email: $("loginEmail").value,
      password: $("loginPassword").value
    });

    if (error) {
      $("loginError").textContent = error.message;
      $("loginError").classList.remove("hidden");
      return;
    }

    if (!await isAdmin()) {
      await client.auth.signOut();
      $("loginError").textContent = "El usuario existe, pero no tiene permisos administrativos.";
      $("loginError").classList.remove("hidden");
      return;
    }

    showPanel();
    await loadTeams();
  });

  $("logoutBtn").addEventListener("click", async () => {
    await client.auth.signOut();
    showLogin();
  });

  $("refreshBtn").addEventListener("click", loadTeams);
  $("exportBtn").addEventListener("click", csv);
  $("categoryFilter").addEventListener("change", render);
  $("statusFilter").addEventListener("change", render);
  $("searchBox").addEventListener("input", render);
  $("closeDialog").addEventListener("click", () => $("teamDialog").close());

  if (init()) {
    client.auth.onAuthStateChange(() => {
      // Run after the auth callback finishes to avoid competing with token storage.
      queueMicrotask(syncSession);
    });
    syncSession();
  }
})();
