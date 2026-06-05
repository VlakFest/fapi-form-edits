/*
  Custom JS for FAPI order form.

  Target form:
  https://form.fapi.cz/?id=2bf5428f-0a21-4eeb-be54-bfb85522da14

  The FAPI form is rendered dynamically.
  Future DOM changes should wait until the form exists.

  Do not change:
  - prices
  - payment data
  - hidden/security fields
  - submit behaviour
  - FAPI internal order logic
*/

(function () {
  const wrapperSelector = "#fapi-form-wrapper";
  const passengerFieldSelector = ".fapi-form-custom-field";
  const passengerLabelPattern = /^Spolupasažér\s+č\.\s*(\d+)\s*-\s*(.+)$/i;
  const noteLabelPattern = /^Poznámka\b/i;
  const customFieldsOriginalTitle = "Doplňující informace";
  const customFieldsTitle = "Tví spolucestující";
  const customFieldsDescription =
    "Pokud kupuješ jízdenku pro více lidí, potřebujeme znát jejich kontaktní údaje. Jestli zatím nevíš, kdo s tebou pojede, můžeš nám je doposlat později.";
  const collapsibleSectionSelectors = [
    ".fapi-form-basic-data",
    ".fapi-form-custom-fields",
  ];
  const formControlSelector = [
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset'])",
    "select",
    "textarea",
  ].join(", ");

  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function getPassengerFieldData(field) {
    const label = Array.from(field.querySelectorAll("label")).find((candidate) =>
      passengerLabelPattern.test(normalizeText(candidate.textContent || ""))
    );

    if (!label) {
      return null;
    }

    const match = normalizeText(label.textContent).match(passengerLabelPattern);
    if (!match) {
      return null;
    }

    const fieldType = match[2].toLowerCase();
    let kind = "other";
    let shortLabel = match[2];

    if (fieldType.includes("jméno") || fieldType.includes("jmeno")) {
      kind = "name";
      shortLabel = "Jméno a příjmení";
    } else if (fieldType.includes("email")) {
      kind = "email";
      shortLabel = "Email";
    } else if (fieldType.includes("telefon")) {
      kind = "phone";
      shortLabel = "Telefon (včetně předvolby)";
    }

    return {
      number: match[1],
      kind,
      label,
      shortLabel,
    };
  }

  function ensureLabelText(label, text) {
    if (normalizeText(label.textContent || "") !== text) {
      label.textContent = ` ${text} `;
    }
  }

  function getFieldLabel(field) {
    return field.querySelector(":scope > label") || field.querySelector("label");
  }

  function getTextareaField(textarea, wrapper) {
    let field = textarea.parentElement;

    while (field && field !== wrapper) {
      if (field.classList.contains("fapi-form-custom-field") || field.querySelector(":scope > label")) {
        return field;
      }

      field = field.parentElement;
    }

    return textarea.parentElement;
  }

  function enhanceTextareaFields() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper) {
      return false;
    }

    const textareas = Array.from(wrapper.querySelectorAll("textarea"));

    textareas.forEach((textarea) => {
      const field = getTextareaField(textarea, wrapper);
      const label = field ? getFieldLabel(field) : null;

      if (!field) {
        return;
      }

      field.classList.add("vf-textarea-field");

      if (label && noteLabelPattern.test(normalizeText(label.textContent || ""))) {
        field.classList.add("vf-note-field");
        label.classList.add("vf-note-label");
      }
    });

    return Boolean(textareas.length);
  }

  function enhancePassengerFields() {
    const wrapper = document.querySelector(wrapperSelector);
    const grid = wrapper?.querySelector(".fapi-form-custom-fields .f-grid");

    if (!grid || grid.dataset.vfPassengerBlocks === "ready") {
      return Boolean(grid);
    }

    const fields = Array.from(grid.children).filter((child) =>
      child.matches(passengerFieldSelector)
    );
    const passengers = new Map();

    fields.forEach((field) => {
      const data = getPassengerFieldData(field);

      if (!data) {
        return;
      }

      if (!passengers.has(data.number)) {
        passengers.set(data.number, {
          number: data.number,
          fields: {},
        });
      }

      passengers.get(data.number).fields[data.kind] = { field, data };
    });

    if (!passengers.size) {
      return false;
    }

    passengers.forEach((passenger) => {
      const block = document.createElement("div");
      const title = document.createElement("div");
      const contactRow = document.createElement("div");

      block.className = "vf-passenger-block";
      block.dataset.vfPassenger = passenger.number;

      title.className = "vf-passenger-title";
      title.textContent = `Spolupasažér č. ${passenger.number}`;
      block.appendChild(title);

      const nameEntry = passenger.fields.name;
      if (nameEntry) {
        nameEntry.field.classList.add("vf-passenger-name");
        ensureLabelText(nameEntry.data.label, nameEntry.data.shortLabel);
        block.appendChild(nameEntry.field);
      }

      contactRow.className = "vf-passenger-contact-row";
      ["email", "phone"].forEach((kind) => {
        const entry = passenger.fields[kind];

        if (!entry) {
          return;
        }

        entry.field.classList.add(`vf-passenger-${kind}`);
        ensureLabelText(entry.data.label, entry.data.shortLabel);
        contactRow.appendChild(entry.field);
      });

      if (contactRow.children.length) {
        block.appendChild(contactRow);
      }

      grid.appendChild(block);
    });

    grid.dataset.vfPassengerBlocks = "ready";
    return true;
  }

  function getSectionTitle(section) {
    const title = section.querySelector(".fapi-form-basic-block-title, .fapi-container-header");
    return normalizeText(title?.textContent || "");
  }

  function isCustomFieldsSection(section) {
    return section.classList.contains("fapi-form-custom-fields");
  }

  function isCollapsibleSection(section) {
    return /^Fakturační údaje$/i.test(getSectionTitle(section)) || isCustomFieldsSection(section);
  }

  function isBillingSection(section) {
    return /^Fakturační údaje$/i.test(getSectionTitle(section));
  }

  function getCollapsibleSections(wrapper) {
    return Array.from(
      wrapper.querySelectorAll(collapsibleSectionSelectors.join(", "))
    ).filter(isCollapsibleSection);
  }

  function hasSelectedOrderItem(wrapper) {
    const hasCheckedItem = Array.from(
      wrapper.querySelectorAll(".fapi-form-items .fapi-form-item input[type='checkbox'], .fapi-form-items .fapi-form-item input[type='radio']")
    ).some((input) => input.checked);

    const hasPositiveQuantity = Array.from(
      wrapper.querySelectorAll(".fapi-form-items .fapi-form-item input[type='number']")
    ).some((input) => Number(input.value) > 0);

    const hasItemCount = Array.from(
      wrapper.querySelectorAll(".fapi-form-items input[type='hidden'][name$='_items']")
    ).some((input) => Number(input.value) > 0);

    return hasCheckedItem || hasPositiveQuantity || hasItemCount;
  }

  function setSectionExpanded(section, expanded) {
    const header = section.querySelector(".fapi-container-header");
    const content = section.querySelector(":scope > .f-p-6");

    section.dataset.vfExpanded = expanded ? "true" : "false";
    header?.setAttribute("aria-expanded", expanded ? "true" : "false");

    if (content) {
      content.hidden = !expanded;
    }
  }

  function setSectionVisible(section, visible) {
    section.hidden = !visible;
    section.dataset.vfVisible = visible ? "true" : "false";
  }

  function enhanceCustomFieldsIntro(section) {
    if (!isCustomFieldsSection(section)) {
      return;
    }

    const header = section.querySelector(".fapi-container-header");

    if (!header) {
      return;
    }

    const currentTitle = getSectionTitle(section);

    if (currentTitle === customFieldsOriginalTitle || currentTitle === customFieldsTitle) {
      let title = header.querySelector(":scope > .fapi-form-basic-block-title");

      if (!title) {
        header.textContent = "";
        title = document.createElement("span");
        title.className = "fapi-form-basic-block-title";
        header.appendChild(title);
      }

      title.textContent = customFieldsTitle;
    }

    if (Array.from(section.children).some((child) => child.classList.contains("vf-section-description"))) {
      return;
    }

    const description = document.createElement("p");
    description.className = "vf-section-description";
    description.textContent = customFieldsDescription;
    header.insertAdjacentElement("afterend", description);
  }

  function getFieldContainer(control, section) {
    let field = control.parentElement;
    while (field && field !== section) {
      if (field.matches(".fapi-form-custom-field")) {
        return field;
      }

      if (field.querySelector(":scope > label, :scope > .fapi-form-label")) {
        return field;
      }

      field = field.parentElement;
    }

    return control.parentElement || section;
  }

  function isRequiredControl(control) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
      return false;
    }

    const field = getFieldContainer(
      control,
      control.closest(".fapi-form-basic-data, .fapi-form-custom-fields, .fapi-form-result") || document.body
    );
    const label = field?.querySelector("label, .fapi-form-label");
    const labelText = normalizeText(label?.textContent || "");

    return control.required || control.getAttribute("aria-required") === "true" || /\*$/.test(labelText);
  }

  function isMissingRequiredControl(control, section) {
    if (!isRequiredControl(control) || control.disabled) {
      return false;
    }

    if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
      const name = control.name;
      const group = name
        ? Array.from(section.querySelectorAll(`input[type="${control.type}"]`)).filter((input) => input.name === name)
        : [control];

      return !group.some((input) => input.checked);
    }

    return !normalizeText(control.value || "");
  }

  function isInvalidControl(control, section) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
      return false;
    }

    if (control.disabled) {
      return false;
    }

    if (isMissingRequiredControl(control, section)) {
      return true;
    }

    return Boolean(control.validity) && !control.validity.valid;
  }

  function getInvalidControls(section) {
    const controls = Array.from(section.querySelectorAll(formControlSelector));

    return controls.filter((control) => isInvalidControl(control, section));
  }

  function clearValidationHighlight(control, section) {
    const field = getFieldContainer(control, section);

    if (!field || isInvalidControl(control, section)) {
      return;
    }

    field.classList.remove("vf-missing-required", "vf-missing-required-choice");
    field.querySelector(".vf-required-message")?.remove();
  }

  function highlightMissingControls(section, missingControls) {
    section.querySelectorAll(".vf-required-message").forEach((message) => {
      message.remove();
    });

    Array.from(section.querySelectorAll(".vf-missing-required")).forEach((field) => {
      const control = field.querySelector(formControlSelector);

      if (!control || !missingControls.includes(control)) {
        field.classList.remove("vf-missing-required", "vf-missing-required-choice");
        field.querySelector(".vf-required-message")?.remove();
      }
    });

    missingControls.forEach((control) => {
      const field = getFieldContainer(control, section);

      if (!field) {
        return;
      }

      field.classList.add("vf-missing-required");
      if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
        field.classList.add("vf-missing-required-choice");
      }
    });
  }

  function drawAttentionToSection(section, missingControls) {
    const firstField = missingControls.length ? getFieldContainer(missingControls[0], section) : null;
    const scrollTarget = firstField || missingControls[0] || section;

    setSectionVisible(section, true);
    setSectionExpanded(section, true);
    section.dataset.vfUserToggled = "true";
    section.classList.remove("vf-validation-attention");

    highlightMissingControls(section, missingControls);

    window.setTimeout(() => {
      section.classList.add("vf-validation-attention");
      scrollTarget.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);

    window.setTimeout(() => {
      section.classList.remove("vf-validation-attention");
    }, 2400);
  }

  function revealInvalidBillingSection(wrapper) {
    const section = getCollapsibleSections(wrapper).find(isBillingSection);

    if (!section) {
      return false;
    }

    const missingControls = getInvalidControls(section);

    if (!missingControls.length) {
      return false;
    }

    drawAttentionToSection(section, missingControls);
    return true;
  }

  function revealInvalidControls(wrapper) {
    const invalidControls = getInvalidControls(wrapper);

    if (!invalidControls.length) {
      return false;
    }

    const controlsBySection = new Map();

    invalidControls.forEach((control) => {
      const section =
        getCollapsibleSections(wrapper).find((candidate) => candidate.contains(control)) ||
        control.closest(".fapi-form-result, .fapi-form-result-container, .fapi-form-basic-data, .fapi-form-custom-fields") ||
        wrapper;

      if (!controlsBySection.has(section)) {
        controlsBySection.set(section, []);
      }

      controlsBySection.get(section).push(control);
    });

    controlsBySection.forEach((controls, section) => {
      if (section.classList.contains("vf-collapsible-section")) {
        drawAttentionToSection(section, controls);
        return;
      }

      highlightMissingControls(section, controls);
    });

    const firstControl = invalidControls[0];
    const firstSection = Array.from(controlsBySection.keys()).find((section) =>
      section.contains(firstControl)
    );
    const firstField = firstSection ? getFieldContainer(firstControl, firstSection) : null;
    const scrollTarget = firstField || firstControl;

    window.setTimeout(() => {
      scrollTarget.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);

    return true;
  }

  function enhanceCollapsibleSections() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper) {
      return false;
    }

    const selected = hasSelectedOrderItem(wrapper);
    const hadSelected = wrapper.dataset.vfHadSelected === "true";
    const becameSelected = selected && !hadSelected;
    const becameUnselected = !selected && hadSelected;
    const sections = getCollapsibleSections(wrapper);

    sections.forEach((section) => {
      const header = section.querySelector(".fapi-container-header");
      const content = section.querySelector(":scope > .f-p-6");

      if (!header || !content) {
        return;
      }

      enhanceCustomFieldsIntro(section);

      const title = getSectionTitle(section);
      const isCustomFields = isCustomFieldsSection(section);
      const isLocked = isCustomFields && !selected;

      section.classList.add("vf-collapsible-section");
      setSectionVisible(section, selected || !isCustomFields);

      if (section.dataset.vfCollapsibleReady !== "true") {
        const contentId =
          content.id || `vf-collapsible-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

        content.id = contentId;
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-controls", contentId);
        section.dataset.vfCollapsibleReady = "true";

        header.addEventListener("click", () => {
          if (section.dataset.vfLocked === "true") {
            return;
          }

          setSectionExpanded(section, section.dataset.vfExpanded !== "true");
          section.dataset.vfUserToggled = "true";
        });

        header.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          header.click();
        });
      }

      section.dataset.vfLocked = isLocked ? "true" : "false";

      if (!selected) {
        if (isCustomFields) {
          section.dataset.vfUserToggled = "false";
          setSectionExpanded(section, false);
        } else if (becameUnselected || !section.dataset.vfExpanded) {
          setSectionExpanded(section, false);
        }
      } else if (becameSelected || section.dataset.vfUserToggled !== "true") {
        section.dataset.vfUserToggled = "false";
        setSectionExpanded(section, true);
      }
    });

    wrapper.dataset.vfHadSelected = selected ? "true" : "false";

    return Boolean(sections.length);
  }

  function bindOrderItemWatcher() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper || wrapper.dataset.vfOrderWatcher === "ready") {
      return Boolean(wrapper);
    }

    const scheduleUpdate = () => {
      enhanceCollapsibleSections();
      window.setTimeout(enhanceCollapsibleSections, 0);
      window.setTimeout(enhanceCollapsibleSections, 150);
      window.setTimeout(enhanceCollapsibleSections, 500);
    };

    const isOrderItemControl = (target) =>
      target instanceof HTMLInputElement &&
      target.closest(".fapi-form-items .fapi-form-item") &&
      (target.type === "checkbox" || target.type === "radio" || target.type === "number");

    wrapper.addEventListener("change", (event) => {
      if (isOrderItemControl(event.target)) {
        scheduleUpdate();
      }
    });

    wrapper.addEventListener("input", (event) => {
      if (isOrderItemControl(event.target)) {
        scheduleUpdate();
      }
    });

    wrapper.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest(".fapi-form-items .fapi-form-item")) {
        scheduleUpdate();
      }
    });

    wrapper.dataset.vfOrderWatcher = "ready";
    return true;
  }

  function bindBillingValidationWatcher() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper || wrapper.dataset.vfBillingValidationWatcher === "ready") {
      return Boolean(wrapper);
    }

    wrapper.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const submitter = event.target.closest(".fapi-submit-button, button[type='submit'], input[type='submit']");

        if (submitter && wrapper.contains(submitter)) {
          revealInvalidControls(wrapper);
        }
      },
      true
    );

    wrapper.addEventListener(
      "invalid",
      (event) => {
        if (!(event.target instanceof HTMLElement)) {
          return;
        }

        const section =
          getCollapsibleSections(wrapper).find((candidate) => candidate.contains(event.target)) ||
          event.target.closest(".fapi-form-result, .fapi-form-result-container, .fapi-form-basic-data, .fapi-form-custom-fields");

        if (section) {
          if (section.classList.contains("vf-collapsible-section")) {
            drawAttentionToSection(section, [event.target]);
          } else {
            highlightMissingControls(section, [event.target]);
          }
        }
      },
      true
    );

    const clearHighlight = (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const section =
        getCollapsibleSections(wrapper).find((candidate) => candidate.contains(event.target)) ||
        event.target.closest(".fapi-form-result, .fapi-form-result-container, .fapi-form-basic-data, .fapi-form-custom-fields");

      if (section) {
        clearValidationHighlight(event.target, section);
      }
    };

    wrapper.addEventListener("input", clearHighlight);
    wrapper.addEventListener("change", clearHighlight);

    wrapper.dataset.vfBillingValidationWatcher = "ready";
    return true;
  }

  function initPassengerFields() {
    const runEnhancements = () => ({
      passengersReady: enhancePassengerFields(),
      textareasReady: enhanceTextareaFields(),
      collapsibleSectionsReady: enhanceCollapsibleSections(),
      orderWatcherReady: bindOrderItemWatcher(),
      billingValidationWatcherReady: bindBillingValidationWatcher(),
    });

    const isReadyEnough = (result) =>
      result.textareasReady &&
      result.collapsibleSectionsReady &&
      result.orderWatcherReady &&
      result.billingValidationWatcherReady;

    const initialResult = runEnhancements();

    if (isReadyEnough(initialResult) && initialResult.passengersReady) {
      return;
    }

    let attempts = 0;
    let scheduled = false;
    const scheduleFrame = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 16);
    const observer = new MutationObserver(() => {
      if (scheduled) {
        return;
      }

      scheduled = true;
      scheduleFrame(() => {
        scheduled = false;
        attempts += 1;

        let result;
        try {
          result = runEnhancements();
        } catch (error) {
          observer.disconnect();
          return;
        }

        if ((isReadyEnough(result) && result.passengersReady) || attempts > 120) {
          observer.disconnect();
        }
      });
    });

    observer.observe(document.querySelector(wrapperSelector) || document.body, {
      childList: true,
      subtree: true,
    });
  }

  function safeInitPassengerFields() {
    try {
      initPassengerFields();
    } catch (error) {
      return;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInitPassengerFields);
  } else {
    safeInitPassengerFields();
  }
})();
