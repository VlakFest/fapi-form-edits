
## Local development — quick start

Run from the repository root:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000/index-local.html](http://localhost:8000/index-local.html).

## Planned customization files

- `fapi-custom.css`
- `fapi-custom.js`

Unless noted otherwise, customizations in this repository are intended to preserve the visual appearance of the embedded FAPI form when the transferable embed block is copied to another host page.

## Webflow integration

On the webpage, split the integration into three places. Do not put the custom
JavaScript into the same Embed element as the FAPI script.

Add this to the page's **Inside `<head>` tag** custom code:

```html
<link rel="stylesheet" href="https://vlakfest.github.io/fapi-form-edits/fapi-custom.css">
```

Put this into a Webflow **Code Embed** element at the place where the form
should appear:

```html
<div id="fapi-form-wrapper">
  <script type="text/javascript" src="https://form.fapi.cz/script.php?id=2bf5428f-0a21-4eeb-be54-bfb85522da14"></script>
</div>
```

Add this to the page's **Before `</body>` tag** custom code:

```html
<script src="https://vlakfest.github.io/fapi-form-edits/fapi-custom.js"></script>
```

For a different FAPI form, replace only the `id` value in the FAPI embed script URL.

Publish the Webflow page after changing custom code. Embedded JavaScript is not
reliably represented inside the Designer canvas; verify the result on the
published page. Keep exactly one `id="fapi-form-wrapper"` on the page.

Loading the custom JavaScript before the closing `body` tag ensures the wrapper
already exists. The script's mutation observer then waits for FAPI's asynchronous
form rendering before adding collapsible sections and passenger-field blocks.

The currency control is shown only when FAPI provides at least two currency
options. For a single configured currency, its empty header slot, arrow, and
tooltip are hidden.

## Plain HTML integration

On a normal HTML page, the following combined block can still be copied to the
desired location inside `<body>`:

```html
<link rel="stylesheet" href="https://vlakfest.github.io/fapi-form-edits/fapi-custom.css">

<div id="fapi-form-wrapper">
  <script type="text/javascript" src="https://form.fapi.cz/script.php?id=2bf5428f-0a21-4eeb-be54-bfb85522da14"></script>
</div>

<script src="https://vlakfest.github.io/fapi-form-edits/fapi-custom.js" defer></script>
```

The stylesheet centers the FAPI form within the wrapper while preserving FAPI's configured maximum width. The outer form shell is transparent, without a border, shadow, or padding, so it does not create a colored frame on the host page. This also applies on mobile screens.

## Remaining availability

The script groups related product rows into shared client-side capacity pools. The
non-student individual-place row is the authoritative source for the pool's
initial availability. Student rows display and consume the same balance; their
own FAPI availability text is ignored by the client-side calculation.

Whole compartments consume the corresponding number of individual places:

- one whole three-bed sleeping compartment consumes 3 places
- one whole four-bed sleeping compartment consumes 4 places
- one whole six-place couchette compartment consumes 6 places

The number displayed for a whole compartment is
`floor(remaining individual places / compartment size)`. Open-plan couchettes
(`plackart`) have no whole-compartment row and use a separate pool.

Every quantity input receives a dynamic maximum based on the other selections
in its pool. The plus control is blocked at that maximum. If a manually entered
quantity exceeds it, the value is clamped and the row displays
`Maximální dostupné množství je X.` For a zero maximum, the message is
`Tady už nic nezbývá.` Decreasing a quantity immediately returns
its weighted capacity to every linked row, and the shared balance never falls
below zero.
Quantity fields accept only non-negative whole numbers. Typing non-digit
characters and pasting non-digit text is blocked; programmatic values and
prefilled decimals are normalized before use. Selecting an unavailable row via
its checkbox or label is blocked with the same maximum-quantity message, without
changing other selections. Already selected rows can still be deselected.
The maximum-quantity message disappears when another linked row releases enough
capacity to increase that row's maximum above the value shown in the message.

The editable `remainingAvailabilityLimits` object near the top of `fapi-custom.js`
controls when the recalculated availability message is shown:

- `couchette: 42` — individual couchettes, including the student variant
- `openPlanCouchette: 42` — individual couchettes in an open-plan coach (`plackart`), including the student variant
- `bed: 24` — individual beds
- `fourBed: 24` — individual beds in a four-bed compartment
- `couchetteCompartment: 7` — whole couchette compartments
- `bedCompartment: 8` — whole sleeping compartments
- `fourBedCompartment: 8` — whole four-bed sleeping compartments

The message is visible when the remaining count is less than or equal to its
limit and hidden above it. Individual places use Czech inflection (`1 místo`,
`2–4 místa`, otherwise `míst`); whole compartments use the invariant `kupé`.
Counts 2–4 use `Zbývají`; all other counts use `Zbývá`, for both places and compartments.
The message is centered below the numeric quantity field.

This client-side customization does not create a shared server-side inventory in
FAPI. On each new page load, the shared balance starts from the current
availability of the non-student individual-place product. FAPI remains
authoritative when the order is submitted.

## Test page

This repository includes a simple `index.html` page for testing the embedded FAPI form together with:

- `fapi-custom.css`
- `fapi-custom.js`

When deployed through GitHub Pages, the test page is available at:

```text
https://vlakfest.github.io/fapi-form-edits/
```

The customization files are available at:

```text
https://vlakfest.github.io/fapi-form-edits/fapi-custom.css
https://vlakfest.github.io/fapi-form-edits/fapi-custom.js
```

## Local test page

For local development, use `index-local.html`. It loads the current local files directly:

```text
fapi-custom.css
fapi-custom.js
```

Run a local static server from the repository root:

```bash
python3 -m http.server 8000
```

Then open:

[http://localhost:8000/index-local.html](http://localhost:8000/index-local.html)

## Section spacing and FAPI credit

The actual form uses one continuous cream panel with a thin neutral outline. Sections have no outer gaps or rounded card edges; existing headings provide separation, with responsive section padding. The FAPI credit remains directly after the outlined form as a small centered note on a transparent background. Inline color normalization excludes `.fapi-order-form`, whose style attribute contains inherited color variables rather than a colored content block.

## Maintenance

CSS rules share the common FAPI selectors and retain `:has()` fallbacks for fields that render before JavaScript initialization. JavaScript keeps all delegated form events behind one binding function and all dynamic enhancements behind one readiness check; delayed updates and the mutation observer remain in place for FAPI's asynchronous rendering.

## Refactor regression checks

The shared JavaScript helpers preserve the distinct textarea/validation field-container rules, choice-control validation, original DOM nodes and enhancement timing. CSS removes only the overridden quantity font size and an identical mobile alignment rule.

Run `npm ci`, install the Playwright browsers with `npx playwright install chromium firefox webkit`, then run `npm test` and `npm run test:live`. The live runner serves the versioned `tests/live.html` itself and does not depend on `index-local.html`. Production loading and the transferable embed remain unchanged.

See [test instructions and coverage](../tests/README.md), [second analysis](refactor-analysis.md), and [verification report](refactor-verification.md). Test dependencies are development-only; no build or runtime dependency is required by the embedded form.
