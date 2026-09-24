import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const source = await readFile("fapi-custom.js", "utf8");
const styles = (await readFile("fapi-custom.css", "utf8")).replace(
  /^@import.*;\r?$/m,
  "",
);
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.setContent(`<!doctype html><html lang="cs"><body>
    <div id="fapi-form-wrapper">
      <div class="fapi-form-items"><div class="fapi-form-item-group">
        <div class="fapi-container-header">
          <div class="fapi-form-basic-block-title">Položky a ceny</div>
          <div class="fapi-form-basic-block-title-after"></div>
        </div>
      </div></div>
    </div>
  </body></html>`);
  await page.addStyleTag({ content: styles });

  const control = page.locator(".fapi-form-basic-block-title-after");
  assert.equal(await control.evaluate((element) => getComputedStyle(element).display), "none");

  await page.addScriptTag({ content: source });
  assert.equal(await control.count(), 1);
  assert.equal(await control.evaluate((element) => getComputedStyle(element).display), "none");
  assert.equal(await page.locator(".vf-currency-trigger").count(), 0);
  assert.equal(await control.getAttribute("data-vf-tooltip"), null);

  await control.evaluate((element) => {
    const select = document.createElement("select");
    select.id = "currency";
    select.add(new Option("Kč", "CZK"));
    element.append(select);
  });
  await page.waitForFunction(() => document.querySelector("#currency"));
  assert.equal(await control.evaluate((element) => getComputedStyle(element).display), "none");
  assert.equal(await page.locator(".vf-currency-trigger").count(), 0);

  await page.locator("#currency").evaluate((select) => {
    select.add(new Option("€", "EUR"));
  });
  await page.waitForFunction(() => document.querySelector(".vf-currency-trigger"));
  assert.notEqual(await control.evaluate((element) => getComputedStyle(element).display), "none");
  assert.equal(await page.locator(".vf-currency-trigger").count(), 1);
  assert.equal(await control.getAttribute("data-vf-tooltip"), "Vyber si měnu objednávky");

  await page.locator("#currency").evaluate((select) => select.options[1].remove());
  await page.waitForFunction(() => !document.querySelector(".vf-currency-trigger"));
  assert.equal(await control.evaluate((element) => getComputedStyle(element).display), "none");
  assert.equal(await control.getAttribute("data-vf-tooltip"), null);
} finally {
  await browser.close();
}

console.log("Currency selector regression checks passed.");
