
## Planned customization files

- `fapi-custom.css`
- `fapi-custom.js`

## Recommended host-page structure

```html
<link rel="stylesheet" href="PUBLIC_URL_TO/fapi-custom.css">

<div id="fapi-form-wrapper">
  <script type="text/javascript" src="https://form.fapi.cz/script.php?id=2bf5428f-0a21-4eeb-be54-bfb85522da14"></script>
</div>

<script src="PUBLIC_URL_TO/fapi-custom.js" defer></script>
```

`PUBLIC_URL_TO` must be replaced with the real public URL after deployment.

## Test page

This repository includes a simple `index.html` page for testing the embedded FAPI form together with:

- `fapi-custom.css`
- `fapi-custom.js`

When deployed through GitHub Pages, the test page is available at:

```text
https://USERNAME.github.io/REPOSITORY/
```

The customization files are available at:

```text
https://USERNAME.github.io/REPOSITORY/fapi-custom.css
https://USERNAME.github.io/REPOSITORY/fapi-custom.js
```
