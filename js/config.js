window.APP_CONFIG = {
  SUPABASE_URL: "https://prkgpliedgdadokzprcy.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZYOu7LJGk5fB61B2o4kgCA_kzxk1l7Q"
};

// Extensión interna y no anunciada de las inscripciones.
// Entre el 17 y el 18 de setiembre el formulario sigue operativo, pero la
// página no muestra una nueva fecha ni un contador correspondiente a la extensión.
(() => {
  const RealDate = window.Date;
  const silentStart = new RealDate("2026-09-17T00:00:00-03:00");
  const silentEnd = new RealDate("2026-09-18T23:59:59-03:00");
  const realNow = new RealDate();

  if (realNow < silentStart || realNow > silentEnd) return;

  const frozenNow = new RealDate("2026-09-16T23:30:00-03:00").getTime();

  class RegistrationDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(frozenNow);
      else super(...args);
    }
    static now() { return frozenNow; }
  }

  RegistrationDate.parse = RealDate.parse;
  RegistrationDate.UTC = RealDate.UTC;
  window.Date = RegistrationDate;
  window.__CF2026_SILENT_EXTENSION__ = true;

  setTimeout(() => {
    window.Date = RealDate;

    const keepExtensionPrivate = () => {
      const countdown = document.getElementById("countdownCard");
      const periodNotice = document.getElementById("periodNotice");
      const form = document.getElementById("formCard");

      if (countdown) countdown.classList.add("hidden");
      if (periodNotice) periodNotice.classList.add("hidden");
      if (form) form.classList.remove("hidden");
    };

    keepExtensionPrivate();
    setInterval(keepExtensionPrivate, 1000);
  }, 0);
})();

// El correo electrónico del responsable es opcional para el usuario.
// La base actual todavía espera un valor en ese campo, por eso cuando se deja
// vacío se envía internamente un marcador no entregable (.invalid) sin mostrarlo
// ni guardarlo en el borrador local visible para la persona que completa el formulario.
(() => {
  const NO_EMAIL_SENTINEL = "sin-correo@registro.invalid";
  const DRAFT_KEY = "cf2026_github_draft_v3";
  const input = document.getElementById("delegateEmail");
  if (!input) return;

  input.required = false;

  const label = input.closest("label");
  if (label) {
    for (const node of label.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.includes("Correo electrónico")) {
        node.textContent = "Correo electrónico (opcional)";
        break;
      }
    }
  }

  function insertSentinelIfEmpty() {
    if (input.value.trim()) return false;
    input.value = NO_EMAIL_SENTINEL;
    input.dataset.autoNoEmail = "1";
    return true;
  }

  function clearAutomaticSentinel() {
    if (input.dataset.autoNoEmail !== "1" || input.value !== NO_EMAIL_SENTINEL) return;
    input.value = "";
    delete input.dataset.autoNoEmail;

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.top) {
        draft.top.delegate_email = "";
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch (_) {
      // Si el borrador local no puede leerse, el formulario continúa normalmente.
    }
  }

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (insertSentinelIfEmpty()) setTimeout(clearAutomaticSentinel, 0);
    });
  }

  const form = document.getElementById("registrationForm");
  if (form) {
    form.addEventListener("submit", () => {
      if (insertSentinelIfEmpty()) setTimeout(clearAutomaticSentinel, 0);
    });
  }
})();

// Simplificación de autorizaciones:
// - no se solicita permiso de imagen en la interfaz (se registra NO por defecto);
// - no se solicitan nombre, cédula, vínculo, teléfono ni correo del adulto responsable;
// - para menores solo se confirma que cuentan con autorización para participar.
(() => {
  const authContainer = document.getElementById("authorizations");
  const reviewContainer = document.getElementById("review");

  const step4 = document.querySelector('.step[data-step="4"]');
  if (step4) {
    const title = step4.querySelector(".step-heading h2");
    const help = step4.querySelector(".step-heading .help");
    if (title) title.textContent = "Autorizaciones";
    if (help) help.textContent = "Si hay menores de 18 años, solo deberás confirmar que cuentan con autorización para participar.";
  }

  const journeySteps = document.querySelectorAll(".journey-step");
  for (const step of journeySteps) {
    const number = step.querySelector(".journey-number")?.textContent?.trim();
    if (number === "4") {
      const strong = step.querySelector("strong");
      const small = step.querySelector("small");
      if (strong) strong.textContent = "Autorizaciones";
      if (small) small.textContent = "Solo si hay menores";
    }
  }

  function setInternalValue(input, value) {
    if (!input || input.value === value) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function simplifyAuthorizations() {
    if (!authContainer) return;

    let visibleMinorCards = 0;
    const cards = authContainer.querySelectorAll(".auth-card");

    for (const card of cards) {
      const heading = card.querySelector("h3")?.textContent || "";
      const isMinor = heading.includes("menor de 18 años");

      // El uso de imagen permanece en NO, sin consulta al usuario.
      const noRadio = card.querySelector('input[data-pfield="imageConsent"][value="NO"]');
      if (noRadio && !noRadio.checked) {
        noRadio.checked = true;
        noRadio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const imageChoice = noRadio?.closest(".image-choice");
      const permissionBlock = imageChoice?.parentElement;
      if (permissionBlock) permissionBlock.style.display = "none";

      if (!isMinor) {
        card.style.display = "none";
        continue;
      }

      visibleMinorCards++;
      card.style.display = "";

      // Estos valores son únicamente marcadores técnicos para compatibilidad con
      // la validación del formulario. Supabase no los almacena.
      setInternalValue(card.querySelector('input[data-pfield="guardianName"]'), "No solicitado");
      setInternalValue(card.querySelector('input[data-pfield="guardianCi"]'), "0");
      setInternalValue(card.querySelector('input[data-pfield="guardianRelation"]'), "Autorización confirmada");
      setInternalValue(card.querySelector('input[data-pfield="guardianPhone"]'), "No solicitado");
      setInternalValue(card.querySelector('input[data-pfield="guardianEmail"]'), "");

      const guardianGrid = card.querySelector(".grid.two");
      if (guardianGrid) guardianGrid.style.display = "none";

      const consent = card.querySelector('input[data-pcheck="participationConsent"]');
      const consentText = consent?.closest("label")?.querySelector("span");
      if (consentText) {
        consentText.textContent = "Confirmo que el/la menor cuenta con autorización de una persona adulta responsable para participar en el campeonato. *";
      }
    }

    const wrapper = authContainer.parentElement;
    if (wrapper && !wrapper.classList.contains("step")) {
      wrapper.style.display = visibleMinorCards ? "" : "none";
      const heading = wrapper.querySelector(".step-heading h2");
      const help = wrapper.querySelector(".step-heading .help");
      if (heading) heading.textContent = "Autorización de menores";
      if (help) help.textContent = "Si hay menores de 18 años, confirmá que cuentan con autorización para participar. No solicitamos datos personales del adulto responsable.";
    }
  }

  function simplifyReview() {
    if (!reviewContainer) return;
    const items = reviewContainer.querySelectorAll("li");
    for (const item of items) {
      const text = item.textContent || "";
      if (text.includes("uso de imagen") || text.includes("Autoriza uso de imagen") || text.includes("No autoriza uso de imagen")) {
        item.remove();
      }
    }
  }

  if (authContainer) {
    new MutationObserver(simplifyAuthorizations).observe(authContainer, { childList: true, subtree: true });
    simplifyAuthorizations();
  }

  if (reviewContainer) {
    new MutationObserver(simplifyReview).observe(reviewContainer, { childList: true, subtree: true });
    simplifyReview();
  }
})();
