
## Planned customization files

- `fapi-custom.css`
- `fapi-custom.js`

Unless noted otherwise, customizations in this repository are intended to preserve the visual appearance of the embedded FAPI form when the transferable embed block is copied to another host page.

## Recommended host-page structure

Copy the following block as a whole to the desired location inside the host page's `<body>`:

```html
<link rel="stylesheet" href="https://vlakfest.github.io/fapi-form-edits/fapi-custom.css">

<div id="fapi-form-wrapper">
  <script type="text/javascript" src="https://form.fapi.cz/script.php?id=2bf5428f-0a21-4eeb-be54-bfb85522da14"></script>
</div>

<script src="https://vlakfest.github.io/fapi-form-edits/fapi-custom.js" defer></script>
```

For a different FAPI form, replace only the `id` value in the FAPI embed script URL.

The stylesheet centers the FAPI form within the wrapper while preserving FAPI's configured maximum width. The outer form shell is transparent, without a border, shadow, or padding, so it does not create a colored frame on the host page. This also applies on mobile screens.

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
