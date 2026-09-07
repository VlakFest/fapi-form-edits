
## Planned customization files

- `fapi-custom.css`
- `fapi-custom.js`

Unless noted otherwise, customizations in this repository are intended to preserve the visual appearance of the embedded FAPI form when the transferable embed block is copied to another host page.

## Webflow integration

In Webflow, split the integration into three places. Do not put the custom
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

The unit `kus`, `kusy`, or `kusů` is always removed from FAPI's remaining-availability message, so for example `zbývá 10 kusů` is displayed as `zbývá 10`. Use FAPI's native product setting to show or hide the remaining-availability message itself. This text-only customization does not change FAPI's available-quantity enforcement.

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

```text
http://localhost:8000/index-local.html
```

## Section spacing and FAPI credit

The actual form uses one continuous cream panel with a thin neutral outline. Sections have no outer gaps or rounded card edges; existing headings provide separation, with responsive section padding. The FAPI credit remains directly after the outlined form as a small centered note on a transparent background. Inline color normalization excludes `.fapi-order-form`, whose style attribute contains inherited color variables rather than a colored content block.

## Maintenance

CSS rules share the common FAPI selectors and retain `:has()` fallbacks for fields that render before JavaScript initialization. JavaScript keeps all delegated form events behind one binding function and all dynamic enhancements behind one readiness check; delayed updates and the mutation observer remain in place for FAPI's asynchronous rendering.
