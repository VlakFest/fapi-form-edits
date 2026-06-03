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
      shortLabel = "Telefon";
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

  function initPassengerFields() {
    const hasPassengerFields = enhancePassengerFields();
    const hasTextareaFields = enhanceTextareaFields();

    if (hasPassengerFields && hasTextareaFields) {
      return;
    }

    const observer = new MutationObserver(() => {
      const passengersReady = enhancePassengerFields();
      const textareasReady = enhanceTextareaFields();

      if (passengersReady && textareasReady) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPassengerFields);
  } else {
    initPassengerFields();
  }
})();
