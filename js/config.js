window.APP_CONFIG = {
  SUPABASE_URL: "https://prkgpliedgdadokzprcy.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZYOu7LJGk5fB61B2o4kgCA_kzxk1l7Q"
};

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

// Simplificación del paso de autorizaciones:
// se elimina de la interfaz la consulta por uso de imagen. Para nuevas
// inscripciones se registra internamente NO, de modo que no se presume permiso.
(() => {
  const authContainer = document.getElementById("authorizations");
  const reviewContainer = document.getElementById("review");

  const step4 = document.querySelector('.step[data-step="4"]');
  if (step4) {
    const title = step4.querySelector(".step-heading h2");
    const help = step4.querySelector(".step-heading .help");
    if (title) title.textContent = "Autorizaciones";
    if (help) help.textContent = "Si hay menores de 18 años, necesitaremos los datos y la autorización del adulto responsable.";
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

  function simplifyAuthorizations() {
    if (!authContainer) return;
    const noRadios = authContainer.querySelectorAll('input[data-pfield="imageConsent"][value="NO"]');
    for (const radio of noRadios) {
      if (!radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const choice = radio.closest(".image-choice");
      const permissionBlock = choice?.parentElement;
      if (permissionBlock) permissionBlock.style.display = "none";
    }

    const adultNotes = authContainer.querySelectorAll(".auth-card .small");
    for (const note of adultNotes) {
      if (note.textContent.includes("fotografías") || note.textContent.includes("uso de imagen")) {
        note.style.display = "none";
      }
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
