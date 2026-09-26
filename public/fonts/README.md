# Company wordmark font

The company name is set in **Brayles** (Blankids Studio). The `font-brand`
class and its `@font-face` are already wired in `src/index.css`; they point at
this folder.

Drop the licensed web font here as:

```
public/fonts/Brayles.woff2
```

A `.ttf` named `public/fonts/Brayles.ttf` also works — it is the second source
in the `@font-face` rule.

Until a file is present the wordmark falls back to the app's normal face
(Arial in the staff and client portals), so nothing renders broken in the
meantime.

Brayles is distributed as **personal use only**; a commercial licence is
required to set the company name in it. A licence is sold by Blankids Studio
at <https://blankidsfonts.com/product/brayles-font/>. Please use a font file
you are licensed for.
