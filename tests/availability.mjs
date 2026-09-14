import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const source = await readFile("fapi-custom.js", "utf8");
const styles = await readFile("fapi-custom.css", "utf8");
const instrumented = source.replace(
  '  if (document.readyState === "loading") {',
  '  window.__updateAvailability = removeRemainingAvailabilityUnit;\n  window.__getAvailabilityType = getRemainingAvailabilityType;\n  if (document.readyState === "loading") {',
);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (error) => console.error(error));

try {
  await page.setContent(`<!doctype html><html lang="cs"><body>
    <div id="fapi-form-wrapper">
      <div class="fapi-form-items">
        <div class="fapi-form-item product-row">
          <div><div><input type="checkbox"><label id="product-name"></label></div></div>
          <div>
            <div><div>
              <div style="display:flex;align-items:center;gap:8px">
                <div class="f-flex-shrink-0 f-w-6 f-h-6"></div>
                <input type="number">
                <div class="f-flex-shrink-0 f-w-6 f-h-6"></div>
              </div>
              <div id="availability"></div>
            </div></div>
            <div class="product-price"><span class="fapi-form-item-price">2 900 Kč</span></div>
          </div>
        </div>
      </div>
    </div>
  </body></html>`);
  await page.addStyleTag({ content: styles.replace(/^@import.*;\r?$/m, "") });
  await page.addScriptTag({ content: instrumented });

  const cases = [
    ["Výprava - lehátko v kupé pro 6", 1, "Zbývá 1 místo", false],
    ["Výprava - lehátko v kupé pro 6", 2, "Zbývají 2 místa", false],
    ["Výprava - lehátko v kupé pro 6", 3, "Zbývají 3 místa", false],
    ["Výprava - lehátko v kupé pro 6", 4, "Zbývají 4 místa", false],
    ["Výprava - lehátko v kupé pro 6", 5, "Zbývá 5 míst", false],
    ["Výprava - lehátko v kupé pro 6", 42, "Zbývá 42 míst", false],
    ["Výprava - lehátko v kupé pro 6", 43, "Zbývá 43 míst", true],
    ["Výprava - lehátko v kupé pro 6 (se studentskou slevou)", 42, "Zbývá 42 míst", false],
    ["Výprava - lehátko v kupé pro 6 (se studentskou slevou)", 43, "Zbývá 43 míst", true],
    ["Výprava - lehátko v plackartu", 42, "Zbývá 42 míst", false],
    ["Výprava - lehátko v plackartu", 43, "Zbývá 43 míst", true],
    ["Výprava - lehátko v plackartu (se studentskou slevou)", 42, "Zbývá 42 míst", false],
    ["Výprava - lehátko v plackartu (se studentskou slevou)", 43, "Zbývá 43 míst", true],
    ["Výprava - lůžko v kupé pro 3", 24, "Zbývá 24 míst", false],
    ["Výprava - lůžko v kupé pro 3", 25, "Zbývá 25 míst", true],
    ["Výprava - lůžko v kupé pro 4", 24, "Zbývá 24 míst", false],
    ["Výprava - lůžko v kupé pro 4", 25, "Zbývá 25 míst", true],
    ["Výprava - celé lehátkové kupé pro 6", 1, "Zbývá 1 kupé", false],
    ["Výprava - celé lehátkové kupé pro 6", 7, "Zbývá 7 kupé", false],
    ["Výprava - celé lehátkové kupé pro 6", 8, "Zbývá 8 kupé", true],
    ["Výprava - celé lůžkové kupé pro 3", 8, "Zbývá 8 kupé", false],
    ["Výprava - celé lůžkové kupé pro 3", 9, "Zbývá 9 kupé", true],
    ["Výprava - celé lůžkové kupé pro 4", 8, "Zbývá 8 kupé", false],
    ["Výprava - celé lůžkové kupé pro 4", 9, "Zbývá 9 kupé", true],
  ];

  for (const [productName, count, text, hidden] of cases) {
    const actual = await page.evaluate(({ productName, count }) => {
      const label = document.querySelector("#product-name");
      const availability = document.querySelector("#availability");

      label.textContent = productName;
      availability.hidden = false;
      availability.className = "f-text-sm f-text-red-600";
      delete availability.dataset.vfNativeAvailability;
      document.querySelector("input[type='number']").value = "0";
      availability.innerHTML = `zbývá <b>${count}</b> kusů`;
      window.__updateAvailability();

      return {
        text: availability.textContent,
        hidden: availability.hidden,
        className: availability.className,
      };
    }, { productName, count });

    assert.equal(actual.text, text, productName);
    assert.equal(actual.hidden, hidden, productName);
    assert.match(actual.className, /\bvf-remaining-availability\b/, productName);
  }

  const generic = await page.evaluate(() => {
    const label = document.querySelector("#product-name");
    const availability = document.querySelector("#availability");

    label.textContent = "Výprava - jiná jízdenka";
    availability.hidden = false;
    availability.className = "f-text-sm f-text-red-600";
    availability.innerHTML = "zbývá <b>10</b> kusů";
    window.__updateAvailability();
    return availability.innerHTML;
  });

  assert.equal(generic, "zbývá <b>10</b>");

  for (const [productName, expectedType] of [
    ["Výprava - lehátko v plackartu", "openPlanCouchette"],
    ["Výprava - lůžko v kupé pro 4", "fourBed"],
    ["Výprava - celé lůžkové kupé pro 4", "fourBedCompartment"],
  ]) {
    const actualType = await page.evaluate((name) => {
      document.querySelector("#product-name").textContent = name;
      return window.__getAvailabilityType(document.querySelector(".fapi-form-item"));
    }, productName);

    assert.equal(actualType, expectedType, productName);
  }

  const alignment = await page.evaluate(() => {
    const label = document.querySelector("#product-name");
    const availability = document.querySelector("#availability");
    const input = document.querySelector("input[type='number']");

    label.textContent = "Výprava - lehátko v kupé pro 6";
    availability.className = "f-text-sm f-text-red-600";
    availability.innerHTML = "zbývá 5 kusů";
    window.__updateAvailability();

    const inputRect = input.getBoundingClientRect();
    const availabilityRect = availability.getBoundingClientRect();
    return (availabilityRect.left + availabilityRect.width / 2) -
      (inputRect.left + inputRect.width / 2);
  });

  assert(Math.abs(alignment) < 0.02, `availability alignment delta: ${alignment}px`);

  const productRow = ({ id, name, remaining }) => `
    <div class="fapi-form-item product-row" id="${id}">
      <div><div><input type="checkbox"><label>${name}</label></div></div>
      <div><div><div>
        <div class="quantity-controls">
          <div class="minus"></div>
          <input type="number" min="0" max="${remaining}" value="0">
          <div class="plus"></div>
        </div>
        <div class="availability">zbývá ${remaining} kusů</div>
      </div></div><div class="product-price"></div></div>
    </div>`;

  await page.setContent(`<!doctype html><html lang="cs"><body>
    <div id="fapi-form-wrapper"><div class="fapi-form-items">
      ${productRow({ id: "couchette", name: "Výprava - lehátko v kupé pro 6", remaining: 12 })}
      ${productRow({ id: "couchette-compartment", name: "Výprava - celé lehátkové kupé pro 6", remaining: 8 })}
      ${productRow({ id: "couchette-student", name: "Výprava - lehátko v kupé pro 6 (se studentskou slevou)", remaining: 8 })}
      ${productRow({ id: "bed", name: "Výprava - lůžko v kupé pro 3", remaining: 10 })}
      ${productRow({ id: "bed-compartment", name: "Výprava - celé lůžkové kupé pro 3", remaining: 8 })}
      ${productRow({ id: "four-bed", name: "Výprava - lůžko v kupé pro 4", remaining: 9 })}
      ${productRow({ id: "four-bed-compartment", name: "Výprava - celé lůžkové kupé pro 4", remaining: 8 })}
      ${productRow({ id: "plackart", name: "Výprava - lehátko v plackartu", remaining: 7 })}
      ${productRow({ id: "plackart-student", name: "Výprava - lehátko v plackartu (se studentskou slevou)", remaining: 20 })}
    </div></div>
  </body></html>`);
  await page.addStyleTag({ content: styles.replace(/^@import.*;\r?$/m, "") });
  await page.addScriptTag({ content: instrumented });

  const initialSharedState = await page.evaluate(() => {
    const state = {};

    for (const id of [
      "couchette",
      "couchette-compartment",
      "couchette-student",
      "bed",
      "bed-compartment",
      "four-bed",
      "four-bed-compartment",
      "plackart",
      "plackart-student",
    ]) {
      const row = document.querySelector(`#${id}`);
      state[id] = {
        availability: row.querySelector(".availability").textContent,
        max: row.querySelector("input[type='number']").max,
      };
    }

    return state;
  });

  assert.deepEqual(initialSharedState.couchette, {
    availability: "Zbývá 12 míst",
    max: "12",
  });
  assert.deepEqual(initialSharedState["couchette-student"], {
    availability: "Zbývá 12 míst",
    max: "12",
  });
  assert.deepEqual(initialSharedState["couchette-compartment"], {
    availability: "Zbývají 2 kupé",
    max: "2",
  });
  assert.deepEqual(initialSharedState["bed-compartment"], {
    availability: "Zbývají 3 kupé",
    max: "3",
  });
  assert.deepEqual(initialSharedState["four-bed-compartment"], {
    availability: "Zbývají 2 kupé",
    max: "2",
  });
  assert.deepEqual(initialSharedState["plackart-student"], {
    availability: "Zbývá 7 míst",
    max: "7",
  });

  async function enterQuantity(id, value) {
    return page.evaluate(({ id, value }) => {
      const input = document.querySelector(`#${id} input[type='number']`);
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      return {
        value: input.value,
        message: document.querySelector(`#${id} .vf-capacity-message`)?.textContent || "",
      };
    }, { id, value });
  }

  await enterQuantity("couchette-student", 2);
  let sharedState = await page.evaluate(() => ({
    main: document.querySelector("#couchette .availability").textContent,
    student: document.querySelector("#couchette-student .availability").textContent,
    compartment: document.querySelector("#couchette-compartment .availability").textContent,
  }));
  assert.deepEqual(sharedState, {
    main: "Zbývá 10 míst",
    student: "Zbývá 10 míst",
    compartment: "Zbývá 1 kupé",
  });

  await enterQuantity("couchette-compartment", 1);
  sharedState = await page.evaluate(() => ({
    main: document.querySelector("#couchette .availability").textContent,
    compartment: document.querySelector("#couchette-compartment .availability").textContent,
    compartmentMax: document.querySelector("#couchette-compartment input[type='number']").max,
  }));
  assert.deepEqual(sharedState, {
    main: "Zbývají 4 místa",
    compartment: "Zbývá 0 kupé",
    compartmentMax: "1",
  });

  const clampedMain = await enterQuantity("couchette", 5);
  assert.deepEqual(clampedMain, {
    value: "4",
    message: "Maximální dostupné množství je 4.",
  });
  assert.equal(
    await page.locator("#couchette .availability").textContent(),
    "Zbývá 0 míst",
  );

  const clampedCompartment = await enterQuantity("couchette-compartment", 2);
  assert.deepEqual(clampedCompartment, {
    value: "1",
    message: "Maximální dostupné množství je 1.",
  });

  assert.equal(await page.locator("#couchette .vf-capacity-message").isVisible(), true);

  await enterQuantity("couchette-compartment", 0);
  assert.equal(await page.locator("#couchette .vf-capacity-message").isVisible(), false);
  assert.equal(
    await page.locator("#couchette .availability").textContent(),
    "Zbývá 6 míst",
  );
  assert.equal(
    await page.locator("#couchette-compartment .availability").textContent(),
    "Zbývá 1 kupé",
  );

  await enterQuantity("bed", 2);
  assert.equal(
    await page.locator("#bed-compartment .availability").textContent(),
    "Zbývají 2 kupé",
  );
  await enterQuantity("four-bed", 2);
  assert.equal(
    await page.locator("#four-bed-compartment .availability").textContent(),
    "Zbývá 1 kupé",
  );

  await page.evaluate(() => {
    document.querySelectorAll(".plus").forEach((plusButton) => {
      plusButton.addEventListener("click", () => {
        const input = plusButton.previousElementSibling;
        input.value = String(Number(input.value) + 1);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });
  await page.locator("#couchette-compartment .plus").dispatchEvent("click");
  assert.equal(
    await page.locator("#couchette-compartment input[type='number']").inputValue(),
    "1",
  );
  await page.locator("#couchette-compartment .plus").dispatchEvent("click");
  assert.equal(
    await page.locator("#couchette-compartment input[type='number']").inputValue(),
    "1",
  );
  assert.equal(
    await page.locator("#couchette-compartment .vf-capacity-message").textContent(),
    "Maximální dostupné množství je 1.",
  );

  await enterQuantity("couchette-student", 0);
  assert.equal(await page.locator("#couchette-compartment .vf-capacity-message").isVisible(), true);
  await enterQuantity("couchette", 0);
  assert.equal(await page.locator("#couchette-compartment .vf-capacity-message").isVisible(), false);

  console.log(`Availability: ${cases.length + 20} formatting, pooling, clamping and coefficient cases passed`);
} finally {
  await browser.close();
}
