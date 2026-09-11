(() => {
  "use strict";

  const authContainer = document.getElementById("authorizations");
  const reviewContainer = document.getElementById("review");
  if (!authContainer) return;

  const step4 = document.querySelector('.step[data-step="4"]');
  if (step4) {
    const title = step4.querySelector(".step-heading h2");
    const help = step4.querySelector(".step-heading .help");
    if (title) title.textContent = "Confirmación del responsable";
    if (help) help.textContent = "Si el equipo incluye menores, alcanza con una única declaración general del responsable o delegado.";
  }

  for (const step of document.querySelectorAll(".journey-step")) {
    if (step.querySelector(".journey-number")?.textContent?.trim() === "4") {
      const strong = step.querySelector("strong");
      const small = step.querySelector("small");
      if (strong) strong.textContent = "Confirmación";
      if (small) small.textContent = "Una sola declaración si hay menores";
    }
  }

  function setValue(input, value) {
    if (!input) return;
    input.value = value || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyDeclaration(checked) {
    const delegateName = document.getElementById("delegateName")?.value?.trim() || "Responsable/delegado del equipo";
    const delegateCi = document.getElementById("delegateCi")?.value?.trim() || "";
    const delegatePhone = document.getElementById("delegatePhone")?.value?.trim() || "";
    const delegateEmail = document.getElementById("delegateEmail")?.value?.trim() || "";

    const minorCards = [...authContainer.querySelectorAll(".auth-card")].filter(card =>
      card.textContent.includes("menor de 18 años")
    );

    for (const card of minorCards) {
      setValue(card.querySelector('input[data-pfield="guardianName"]'), checked ? delegateName : "");
      setValue(card.querySelector('input[data-pfield="guardianCi"]'), checked ? delegateCi : "");
      setValue(card.querySelector('input[data-pfield="guardianRelation"]'), checked ? "Declaración general del responsable/delegado" : "");
      setValue(card.querySelector('input[data-pfield="guardianPhone"]'), checked ? delegatePhone : "");
      setValue(card.querySelector('input[data-pfield="guardianEmail"]'), checked ? delegateEmail : "");

      const consent = card.querySelector('input[data-pcheck="participationConsent"]');
      if (consent) {
        consent.checked = !!checked;
        consent.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const noImage = card.querySelector('input[data-pfield="imageConsent"][value="NO"]');
      if (noImage && !noImage.checked) {
        noImage.checked = true;
        noImage.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function cleanReview() {
    if (!reviewContainer) return;
    for (const item of [...reviewContainer.querySelectorAll("li")]) {
      const text = item.textContent || "";
      if (text.includes("Autorización de participación registrada") || text.includes("uso de imagen") || text.includes("Autoriza uso de imagen") || text.includes("No autoriza uso de imagen")) {
        item.remove();
      }
    }
  }

  function render() {
    const cards = [...authContainer.querySelectorAll(":scope > .auth-card")].filter(card => card.id !== "generalMinorDeclaration");
    const minorCards = cards.filter(card => card.textContent.includes("menor de 18 años"));

    for (const card of cards) {
      const noImage = card.querySelector('input[data-pfield="imageConsent"][value="NO"]');
      if (noImage && !noImage.checked) {
        noImage.checked = true;
        noImage.dispatchEvent(new Event("change", { bubbles: true }));
      }
      card.style.display = "none";
    }

    let general = document.getElementById("generalMinorDeclaration");

    if (minorCards.length === 0) {
      if (general) general.remove();
      return;
    }

    if (!general) {
      general = document.createElement("article");
      general.id = "generalMinorDeclaration";
      general.className = "legal-box";
      general.innerHTML = `
        <h3>Declaración general por participantes menores</h3>
        <p>Para simplificar la inscripción no es necesario completar una autorización por cada menor.</p>
        <label class="checkbox">
          <input id="generalMinorConsent" type="checkbox">
          <span>Declaro, como responsable/delegado del equipo, que cuento con las autorizaciones necesarias de madres, padres o tutores legales para la participación de todas las personas menores de 18 años incluidas en esta inscripción. *</span>
        </label>`;
      authContainer.prepend(general);
      general.querySelector("#generalMinorConsent")?.addEventListener("change", event => applyDeclaration(event.target.checked));
    }

    const checkbox = general.querySelector("#generalMinorConsent");
    if (checkbox?.checked) applyDeclaration(true);
  }

  new MutationObserver(render).observe(authContainer, { childList: true });
  if (reviewContainer) new MutationObserver(cleanReview).observe(reviewContainer, { childList: true, subtree: true });

  render();
  cleanReview();
})();
