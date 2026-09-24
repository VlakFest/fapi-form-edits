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
    "Pokud kupuješ jízdenku pro více lidí (nebo někomu jako dárek), potřebujeme znát jejich kontaktní údaje. Jestli zatím nevíš, kdo s tebou pojede, můžeš nám je doposlat později.";
  const collapsibleSectionSelector = ".fapi-form-basic-data, .fapi-form-custom-fields";
  const validationSectionSelector = `${collapsibleSectionSelector}, .fapi-form-result, .fapi-form-result-container`;
  const remainingAvailabilitySelector = ".fapi-form-items .fapi-form-item *";
  const currencyObserverWrappers = new WeakSet();
  let currencyTooltipSuppressedUntil = 0;
  // Show remaining availability only at or below these editable limits.
  const remainingAvailabilityLimits = {
    couchette: 42, // Lehátko v kupé pro 6, včetně studentské varianty.
    openPlanCouchette: 42, // Lehátko v plackartu, včetně studentské varianty.
    bed: 24, // Lůžko v kupé pro 3.
    fourBed: 24, // Lůžko v kupé pro 4.
    couchetteCompartment: 7, // Celé lehátkové kupé pro 6.
    bedCompartment: 8, // Celé lůžkové kupé pro 3.
    fourBedCompartment: 8, // Celé lůžkové kupé pro 4.
  };
  const sharedCapacityRules = {
    couchette: {
      individualType: "couchette",
      compartmentType: "couchetteCompartment",
      compartmentSize: 6,
    },
    openPlanCouchette: {
      individualType: "openPlanCouchette",
      compartmentType: null,
      compartmentSize: null,
    },
    bed: {
      individualType: "bed",
      compartmentType: "bedCompartment",
      compartmentSize: 3,
    },
    fourBed: {
      individualType: "fourBed",
      compartmentType: "fourBedCompartment",
      compartmentSize: 4,
    },
  };
  const formControlSelector = [
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset'])",
    "select",
    "textarea",
  ].join(", ");

  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function normalizeSearchText(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  }

  function enhanceCurrencySelector() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper) {
      return false;
    }

    if (!currencyObserverWrappers.has(wrapper)) {
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) {
          return;
        }

        scheduled = true;
        window.requestAnimationFrame(() => {
          scheduled = false;
          enhanceCurrencySelector();
        });
      });

      observer.observe(wrapper, { childList: true, subtree: true });
      currencyObserverWrappers.add(wrapper);
    }

    const select = wrapper.querySelector(
      ".fapi-form-items .fapi-form-basic-block-title-after select"
    );

    if (!select) {
      return true;
    }

    const tooltip = "Vyber si měnu objednávky";
    select.setAttribute("aria-label", tooltip);

    const control = select.closest(".fapi-form-basic-block-title-after");
    if (!control) {
      return true;
    }

    control.dataset.vfTooltip = tooltip;
    const tooltipSuppressionRemaining = currencyTooltipSuppressedUntil - Date.now();
    if (tooltipSuppressionRemaining > 0) {
      control.dataset.vfTooltipSuppressed = "true";
      window.setTimeout(() => {
        if (Date.now() >= currencyTooltipSuppressedUntil) {
          delete control.dataset.vfTooltipSuppressed;
        }
      }, tooltipSuppressionRemaining);
    }

    const currentTrigger = control.querySelector(".vf-currency-trigger");
    if (currentTrigger) {
      const value = currentTrigger.querySelector(".vf-currency-value");
      if (value) {
        value.textContent = select.selectedOptions[0]?.textContent.trim() || select.value;
      }
      return true;
    }

    select.classList.add("vf-native-currency-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const menuId = `${select.id || "vf-currency"}-custom-menu`;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "vf-currency-trigger";
    trigger.setAttribute("aria-label", tooltip);
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menuId);

    const value = document.createElement("span");
    value.className = "vf-currency-value";
    const arrow = document.createElement("span");
    arrow.className = "vf-currency-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "▼";
    trigger.append(value, arrow);

    const menu = document.createElement("div");
    menu.id = menuId;
    menu.className = "vf-currency-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", tooltip);
    menu.hidden = true;

    const closeMenu = ({ focusTrigger = false, suppressTooltip = false } = {}) => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      control.dataset.vfCurrencyOpen = "false";
      if (suppressTooltip) {
        currencyTooltipSuppressedUntil = Date.now() + 1200;
        control.dataset.vfTooltipSuppressed = "true";
      }
      if (focusTrigger) {
        trigger.focus();
      }
    };

    const sync = () => {
      value.textContent = select.selectedOptions[0]?.textContent.trim() || select.value;
      menu.querySelectorAll(".vf-currency-option").forEach((option) => {
        const selected = option.dataset.value === select.value;
        option.setAttribute("aria-selected", selected ? "true" : "false");
      });
    };

    Array.from(select.options).forEach((nativeOption) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "vf-currency-option";
      option.dataset.value = nativeOption.value;
      option.setAttribute("role", "option");
      option.textContent = nativeOption.textContent.trim();
      option.addEventListener("click", () => {
        select.value = nativeOption.value;
        sync();
        closeMenu({ focusTrigger: true, suppressTooltip: true });
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      menu.append(option);
    });

    const openMenu = () => {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      control.dataset.vfCurrencyOpen = "true";
    };

    trigger.addEventListener("click", () => {
      if (menu.hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();
      openMenu();
      const options = Array.from(menu.querySelectorAll(".vf-currency-option"));
      const selectedIndex = options.findIndex(
        (option) => option.getAttribute("aria-selected") === "true"
      );
      const fallbackIndex = event.key === "ArrowDown" ? 0 : options.length - 1;
      options[selectedIndex >= 0 ? selectedIndex : fallbackIndex]?.focus();
    });

    control.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        event.preventDefault();
        closeMenu({ focusTrigger: true });
      }
    });

    control.addEventListener("focusout", (event) => {
      if (!control.contains(event.relatedTarget)) {
        closeMenu();
      }
    });

    select.addEventListener("change", sync);
    control.append(trigger, menu);
    sync();

    return true;
  }

  function getRemainingAvailabilityType(item) {
    const productName = normalizeSearchText(item.querySelector("label")?.textContent || "");

    if (/\bcele\b.*\blehatkove\b.*\bkupe\b/u.test(productName)) {
      return "couchetteCompartment";
    }

    if (/\bcele\b.*\bluzkove\b.*\bkupe\b.*\bpro\s*4\b/u.test(productName)) {
      return "fourBedCompartment";
    }

    if (/\bcele\b.*\bluzkove\b.*\bkupe\b/u.test(productName)) {
      return "bedCompartment";
    }

    if (/\blehatko\b.*\bplackart(?:u)?\b/u.test(productName)) {
      return "openPlanCouchette";
    }

    if (/\blehatko\b/u.test(productName)) {
      return "couchette";
    }

    if (/\bluzko\b.*\bkupe\b.*\bpro\s*4\b/u.test(productName)) {
      return "fourBed";
    }

    if (/\bluzko\b/u.test(productName)) {
      return "bed";
    }

    return null;
  }

  function getPlaceUnit(count) {
    if (count === 1) {
      return "místo";
    }

    if (count >= 2 && count <= 4) {
      return "místa";
    }

    return "míst";
  }

  function getAvailabilityCount(element) {
    const match = normalizeText(element?.textContent || "").match(
      /^(?:zbývá|zbývají)\s+(\d+)(?:\s+(?:kusů|kusy|kus|míst|místa|místo|kupé))?$/iu
    );

    return match ? Number(match[1]) : null;
  }

  function getCapacityRule(type) {
    return Object.entries(sharedCapacityRules).find(([, rule]) =>
      type === rule.individualType || type === rule.compartmentType
    ) || null;
  }

  function isStudentVariant(item) {
    return /\bstudent/u.test(normalizeSearchText(item.querySelector("label")?.textContent || ""));
  }

  function getQuantity(input) {
    if (!input || input.value === "") {
      return 0;
    }

    const value = Number(input.value);
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  function setQuantity(input, value) {
    if (input.value === String(value)) {
      return;
    }

    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getCapacityMessage(entry) {
    let message = entry.item.querySelector(".vf-capacity-message");

    if (!message) {
      message = document.createElement("div");
      message.className = "vf-capacity-message";
      message.setAttribute("role", "status");
      message.setAttribute("aria-live", "polite");
      message.hidden = true;
      entry.availability.insertAdjacentElement("afterend", message);
    }

    return message;
  }

  function showCapacityMessage(entry, maximum) {
    const message = getCapacityMessage(entry);
    message.textContent = maximum === 0
      ? "Tady už nic nezbývá."
      : `Maximální dostupné množství je ${maximum}.`;
    message.dataset.vfCapacityMaximum = String(maximum);
    message.hidden = false;
  }

  function hideCapacityMessage(entry) {
    const message = entry.item.querySelector(".vf-capacity-message");

    if (message) {
      message.hidden = true;
    }
  }

  function setAvailabilityText(entry, remainingSeats) {
    const count = entry.isCompartment
      ? Math.floor(remainingSeats / entry.weight)
      : remainingSeats;
    const text = `${count >= 2 && count <= 4 ? "Zbývají" : "Zbývá"} ${count} ${entry.isCompartment ? "kupé" : getPlaceUnit(count)}`;

    entry.availability.classList.add("vf-remaining-availability");
    entry.availability.hidden = count > remainingAvailabilityLimits[entry.type];

    if (normalizeText(entry.availability.textContent || "") !== text) {
      entry.availability.textContent = text;
    }
  }

  function getCapacityEntries(availabilityElements) {
    return availabilityElements.map((availability) => {
      const item = availability.closest(".fapi-form-item");
      const type = item && getRemainingAvailabilityType(item);
      const capacityRule = type && getCapacityRule(type);
      const input = item?.querySelector("input[type='number']");

      if (!item || !type || !capacityRule || !input) {
        return null;
      }

      const [group, rule] = capacityRule;
      const isCompartment = type === rule.compartmentType;
      const nativeAvailability = getAvailabilityCount(availability);

      if (!availability.dataset.vfNativeAvailability && nativeAvailability !== null) {
        availability.dataset.vfNativeAvailability = String(nativeAvailability);
      }

      return {
        availability,
        group,
        input,
        isCompartment,
        isMain: type === rule.individualType && !isStudentVariant(item),
        item,
        nativeAvailability: Number(availability.dataset.vfNativeAvailability),
        rule,
        type,
        weight: isCompartment ? rule.compartmentSize : 1,
      };
    }).filter(Boolean);
  }

  function updateQuantityLimit(entry, remainingSeats) {
    const quantity = getQuantity(entry.input);
    const capacityMaximum = quantity + Math.floor(remainingSeats / entry.weight);
    const maximum = Math.max(0, capacityMaximum);
    const plusButton = entry.input.nextElementSibling;
    const isAtMaximum = quantity >= maximum;

    entry.input.max = String(maximum);
    entry.input.min = "0";
    entry.input.step = "1";
    entry.input.inputMode = "numeric";
    entry.item.dataset.vfCapacityGroup = entry.group;

    const message = entry.item.querySelector(".vf-capacity-message");

    if (message && maximum > Number(message.dataset.vfCapacityMaximum)) {
      hideCapacityMessage(entry);
    }

    if (plusButton) {
      plusButton.classList.toggle("vf-capacity-limit", isAtMaximum);
      plusButton.setAttribute("aria-disabled", isAtMaximum ? "true" : "false");
    }
  }

  function removeRemainingAvailabilityUnit(preferredInput) {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper) {
      return false;
    }

    const availabilityCandidates = Array.from(
      wrapper.querySelectorAll(remainingAvailabilitySelector)
    ).filter((element) => {
      const text = normalizeText(element.textContent || "");

      return /^(?:zbývá|zbývají)(?:\s|$)/iu.test(text) &&
        /(?:^|\s)(?:kusů|kusy|kus|míst|místa|místo|kupé)$/iu.test(text);
    });
    const availabilityElements = availabilityCandidates.filter((element) =>
      !availabilityCandidates.some((candidate) => candidate !== element && element.contains(candidate))
    );

    if (wrapper.dataset.vfCapacitySync === "true") {
      return Boolean(availabilityElements.length);
    }

    const capacityEntries = getCapacityEntries(availabilityElements);

    wrapper.dataset.vfCapacitySync = "true";

    Object.keys(sharedCapacityRules).forEach((group) => {
      const entries = capacityEntries.filter((entry) => entry.group === group);
      const mainEntry = entries.find((entry) => entry.isMain);

      if (!mainEntry || !Number.isFinite(mainEntry.nativeAvailability)) {
        return;
      }

      const capacity = mainEntry.nativeAvailability;
      const preferredEntry = entries.find((entry) => entry.input === preferredInput);

      if (preferredEntry) {
        const usedByOthers = entries.reduce((sum, entry) =>
          entry === preferredEntry ? sum : sum + getQuantity(entry.input) * entry.weight
        , 0);
        const capacityMaximum = Math.max(
          0,
          Math.floor((capacity - usedByOthers) / preferredEntry.weight)
        );
        const maximum = capacityMaximum;
        const attempted = getQuantity(preferredEntry.input);

        if (attempted > maximum) {
          setQuantity(preferredEntry.input, maximum);
          showCapacityMessage(preferredEntry, maximum);
        } else if (attempted < maximum) {
          hideCapacityMessage(preferredEntry);
        }
      }

      let unallocatedSeats = capacity;

      entries.forEach((entry) => {
        const maximum = Math.max(0, Math.floor(unallocatedSeats / entry.weight));
        const quantity = getQuantity(entry.input);

        if (quantity > maximum) {
          setQuantity(entry.input, maximum);
          showCapacityMessage(entry, maximum);
        } else if (entry.input.value !== "" && entry.input.value !== String(quantity)) {
          setQuantity(entry.input, quantity);
        }

        unallocatedSeats -= getQuantity(entry.input) * entry.weight;
      });

      const remainingSeats = Math.max(0, unallocatedSeats);

      entries.forEach((entry) => {
        setAvailabilityText(entry, remainingSeats);
        updateQuantityLimit(entry, remainingSeats);
      });
    });

    wrapper.dataset.vfCapacitySync = "false";

    availabilityElements.forEach((element) => {
      const item = element.closest(".fapi-form-item");
      const availabilityType = item && getRemainingAvailabilityType(item);

      if (availabilityType) {
        if (!element.classList.contains("vf-remaining-availability")) {
          const count = getAvailabilityCount(element);

          if (count === null) {
            return;
          }

          const isCompartment = [
            "couchetteCompartment",
            "bedCompartment",
            "fourBedCompartment",
          ].includes(availabilityType);

          element.classList.add("vf-remaining-availability");
          element.hidden = count > remainingAvailabilityLimits[availabilityType];
          element.textContent = `${count >= 2 && count <= 4 ? "Zbývají" : "Zbývá"} ${count} ${isCompartment ? "kupé" : getPlaceUnit(count)}`;
        }

        return;
      }

      // Preserve the previous generic behavior for products outside the configured categories.
      const textNodes = Array.from(element.childNodes).filter(
        (node) => node.nodeType === Node.TEXT_NODE
      );

      for (let index = textNodes.length - 1; index >= 0; index -= 1) {
        const textNode = textNodes[index];
        const cleanedText = textNode.nodeValue.replace(/\s*(?:kusů|kusy|kus)\s*$/iu, "");

        if (cleanedText !== textNode.nodeValue) {
          textNode.nodeValue = cleanedText;
          break;
        }
      }
    });

    return Boolean(availabilityElements.length);
  }

  function enhanceDiscountSavings() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper) {
      return false;
    }

    const discountCode = wrapper.querySelector(".fapi-form-result-discount-code");
    const source = wrapper.querySelector(
      ".fapi-form-prices-total-discount:not(.vf-discount-savings)"
    );
    const current = discountCode?.querySelector(":scope > .vf-discount-savings");

    if (!discountCode) {
      return false;
    }

    if (!source) {
      current?.remove();
      return true;
    }

    const sourceLabel = source.querySelector(".fapi-form-prices-total-discount-label");
    const sourceValue = source.querySelector(".fapi-form-prices-total-discount-value");
    let savings = current;

    source.classList.add("vf-discount-savings-source");

    if (sourceLabel && normalizeText(sourceLabel.textContent || "") !== "Ušetříš:") {
      sourceLabel.textContent = "Ušetříš:";
    }

    if (!savings) {
      savings = document.createElement("div");
      savings.className = "vf-discount-savings";
      savings.setAttribute("aria-live", "polite");
      savings.innerHTML =
        '<span class="vf-discount-savings-label">Ušetříš:</span>' +
        '<span class="vf-discount-savings-value"></span>';
      discountCode.appendChild(savings);
    }

    const value = savings.querySelector(".vf-discount-savings-value");
    const valueText = normalizeText(sourceValue?.textContent || "");

    if (value && normalizeText(value.textContent || "") !== valueText) {
      value.textContent = valueText;
    }

    return true;
  }

  function getPassengerFieldData(field) {
    let label;
    let match;

    for (const candidate of field.querySelectorAll("label")) {
      match = normalizeText(candidate.textContent || "").match(passengerLabelPattern);

      if (match) {
        label = candidate;
        break;
      }
    }

    if (!label) {
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

  function findFieldContainer(control, boundary, labelSelector) {
    let field = control.parentElement;

    while (field && field !== boundary) {
      if (field.classList.contains("fapi-form-custom-field") || field.querySelector(labelSelector)) {
        return field;
      }

      field = field.parentElement;
    }

    return control.parentElement;
  }

  function getTextareaField(textarea, wrapper) {
    return findFieldContainer(textarea, wrapper, ":scope > label");
  }

  function enhanceTextareaFields() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper) {
      return false;
    }

    const textareas = Array.from(wrapper.querySelectorAll("textarea"));

    textareas.forEach((textarea) => {
      const field = getTextareaField(textarea, wrapper);
      const label = field?.querySelector(":scope > label, label");

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

  function getCollapsibleSections(wrapper) {
    return Array.from(wrapper.querySelectorAll(collapsibleSectionSelector)).filter(isCollapsibleSection);
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
    return findFieldContainer(control, section, ":scope > label, :scope > .fapi-form-label") || section;
  }

  function isFormControl(control) {
    return control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement;
  }

  function isChoiceControl(control) {
    return control instanceof HTMLInputElement &&
      (control.type === "checkbox" || control.type === "radio");
  }

  function getValidationSection(control, wrapper) {
    return getCollapsibleSections(wrapper).find((section) => section.contains(control)) ||
      control.closest(validationSectionSelector) ||
      wrapper;
  }

  function isRequiredControl(control) {
    if (!isFormControl(control)) {
      return false;
    }

    const field = getFieldContainer(
      control,
      control.closest(validationSectionSelector) || document.body
    );
    const label = field?.querySelector("label, .fapi-form-label");
    const labelText = normalizeText(label?.textContent || "");

    return control.required || control.getAttribute("aria-required") === "true" || /\*$/.test(labelText);
  }

  function isMissingRequiredControl(control, section) {
    if (!isRequiredControl(control) || control.disabled) {
      return false;
    }

    if (isChoiceControl(control)) {
      const name = control.name;
      const group = name
        ? Array.from(section.querySelectorAll(`input[type="${control.type}"]`)).filter((input) => input.name === name)
        : [control];

      return !group.some((input) => input.checked);
    }

    return !normalizeText(control.value || "");
  }

  function isInvalidControl(control, section) {
    if (!isFormControl(control) || control.disabled) {
      return false;
    }

    if (isMissingRequiredControl(control, section)) {
      return true;
    }

    return Boolean(control.validity) && !control.validity.valid;
  }

  function getInvalidControls(section) {
    return Array.from(section.querySelectorAll(formControlSelector))
      .filter((control) => isInvalidControl(control, section));
  }

  function clearValidationHighlight(control, section) {
    const field = getFieldContainer(control, section);

    if (!field || isInvalidControl(control, section)) {
      return;
    }

    field.classList.remove("vf-missing-required", "vf-missing-required-choice");
  }

  function highlightMissingControls(section, missingControls) {
    section.querySelectorAll(".vf-missing-required").forEach((field) => {
      const control = field.querySelector(formControlSelector);

      if (!control || !missingControls.includes(control)) {
        field.classList.remove("vf-missing-required", "vf-missing-required-choice");
      }
    });

    missingControls.forEach((control) => {
      const field = getFieldContainer(control, section);

      if (!field) {
        return;
      }

      field.classList.add("vf-missing-required");
      if (isChoiceControl(control)) {
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

  function revealInvalidControls(wrapper) {
    const invalidControls = getInvalidControls(wrapper);

    if (!invalidControls.length) {
      return false;
    }

    const controlsBySection = new Map();

    invalidControls.forEach((control) => {
      const section = getValidationSection(control, wrapper);

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
    const firstField = getFieldContainer(firstControl, getValidationSection(firstControl, wrapper));
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

  function bindFormEvents() {
    const wrapper = document.querySelector(wrapperSelector);

    if (!wrapper || wrapper.dataset.vfFormEvents === "ready") {
      return Boolean(wrapper);
    }

    const scheduleUpdate = () => {
      enhanceCollapsibleSections();
      removeRemainingAvailabilityUnit();
      enhanceDiscountSavings();
      [0, 150, 500].forEach((delay) => {
        window.setTimeout(enhanceCollapsibleSections, delay);
        window.setTimeout(removeRemainingAvailabilityUnit, delay);
        window.setTimeout(enhanceDiscountSavings, delay);
      });
    };

    const isOrderItemControl = (target) =>
      target instanceof HTMLInputElement &&
      target.closest(".fapi-form-items .fapi-form-item") &&
      (target.type === "checkbox" || target.type === "radio" || target.type === "number");

    const isCapacityInput = (target) =>
      target instanceof HTMLInputElement && target.type === "number" &&
      Boolean(target.closest(".fapi-form-item[data-vf-capacity-group]"));

    // Normalize before FAPI's input listeners read the value, including paste,
    // autofill and programmatically dispatched input/change events.
    ["input", "change"].forEach((eventName) => {
      wrapper.addEventListener(eventName, (event) => {
        if (isCapacityInput(event.target) && event.target.value !== "") {
          event.target.value = String(getQuantity(event.target));
        }
      }, true);
    });

    wrapper.addEventListener("keydown", (event) => {
      if (isCapacityInput(event.target) && !event.ctrlKey && !event.metaKey &&
          !event.altKey && event.key.length === 1 && !/^[0-9]$/.test(event.key)) {
        event.preventDefault();
      }
    }, true);

    wrapper.addEventListener("beforeinput", (event) => {
      if (isCapacityInput(event.target) && event.data && !/^[0-9]+$/.test(event.data)) {
        event.preventDefault();
      }
    }, true);

    wrapper.addEventListener("paste", (event) => {
      if (isCapacityInput(event.target) &&
          !/^[0-9]+$/.test(event.clipboardData?.getData("text") || "")) {
        event.preventDefault();
      }
    }, true);

    ["change", "input"].forEach((eventName) => {
      wrapper.addEventListener(eventName, (event) => {
        if (isOrderItemControl(event.target)) {
          if (
            event.target.type === "number" &&
            wrapper.dataset.vfCapacitySync !== "true"
          ) {
            removeRemainingAvailabilityUnit(event.target);
          }

          scheduleUpdate();
        }

        if (event.target instanceof HTMLElement) {
          clearValidationHighlight(
            event.target,
            getValidationSection(event.target, wrapper)
          );
        }
      });
    });

    wrapper.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) {
          return;
        }

        const item = event.target.closest(".fapi-form-items .fapi-form-item");
        const input = item?.querySelector("input[type='number']");
        const plusButton = input?.nextElementSibling;

        if (!item?.dataset.vfCapacityGroup || !input) {
          return;
        }

        const maximum = Number(input.max);
        const checkbox = item.querySelector("input[type='checkbox']");
        const label = event.target.closest("label");
        const selectingUnavailable = getQuantity(input) === 0 && maximum < 1 &&
          (event.target === checkbox || (label && label.control === checkbox));
        const increasing = plusButton?.contains(event.target);

        if (!Number.isFinite(maximum) ||
            (!selectingUnavailable && (!increasing || getQuantity(input) < maximum))) {
          return;
        }

        const availability = item.querySelector(".vf-remaining-availability");

        event.preventDefault();
        event.stopImmediatePropagation();

        if (availability) {
          showCapacityMessage({ availability, item }, maximum);
        }
      },
      true
    );

    wrapper.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest(".fapi-form-items .fapi-form-item")) {
        scheduleUpdate();
      }
    });

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

        const section = getValidationSection(event.target, wrapper);

        if (section.classList.contains("vf-collapsible-section")) {
          drawAttentionToSection(section, [event.target]);
        } else {
          highlightMissingControls(section, [event.target]);
        }
      },
      true
    );

    const discountSavingsObserver = new MutationObserver(() => {
      enhanceDiscountSavings();
    });

    discountSavingsObserver.observe(wrapper, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    wrapper.dataset.vfFormEvents = "ready";
    return true;
  }

  function initPassengerFields() {
    const runEnhancements = () => [
      removeRemainingAvailabilityUnit,
      enhanceDiscountSavings,
      enhanceCurrencySelector,
      enhancePassengerFields,
      enhanceTextareaFields,
      enhanceCollapsibleSections,
      bindFormEvents,
    ].map((enhance) => enhance()).every(Boolean);

    if (runEnhancements()) {
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

        try {
          if (runEnhancements() || attempts > 120) {
            observer.disconnect();
          }
        } catch (error) {
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
