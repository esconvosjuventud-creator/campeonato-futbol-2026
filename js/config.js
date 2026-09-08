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
