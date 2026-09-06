# Held in Ink — Nüshu Writing Encounter

A static, single-page design prototype for an English-language graduation thesis. Its homepage offers four sourced or source-bounded social contexts, followed by a slow, unscored writing encounter.

## Technical approach

- Plain HTML, CSS, and JavaScript: no framework, account, database, or installed dependency. A small Node script copies the static deployment output.
- `content.json` holds each homepage `scene` plus three explicit layers: `stroke`, `narrative`, and `context`.
- The contextual layer is text-first. It records per-character notes and sources, and only renders an artefact or audio recording when a complete credited record is present.
- The locally bundled Noto Traditional Nüshu font renders the real standardized glyph guide without needing a network connection.
- Two layered HTML Canvas elements make the writing space: a pale font guide and an ink layer that accepts mouse, pen, and touch through Pointer Events.
- The writing surface can switch between paper, a paper fan, and woven cloth. These are deliberately abstract visual cues, not reconstructions of historical objects.
- A third canvas generates the archive preview; a separate high-resolution canvas creates the downloadable PNG.
- Responsive CSS keeps the writing area usable on both a desktop and a phone browser.

## File structure

```
Nvshu/
├── index.html     # homepage choice, four experience stages, dialogs
├── styles.css     # responsive visual system and paper/ink treatment
├── app.js         # flow, canvas writing, archive card, image download
├── content.json   # three-layer prompt records and optional contextual media
├── content.schema.json # field contract for prompt, source, artefact, and audio records
├── assets/fonts/  # bundled Noto Traditional Nüshu typeface and its OFL license
├── scripts/       # dependency-free preview and static build scripts
└── README.md      # local-run and editing notes
```

## Open locally

`content.json` is loaded by the browser, so open the folder with a tiny local server rather than double-clicking `index.html`.

With Node.js installed, in this folder run:

```powershell
npm run dev
```

Then visit [http://localhost:8000](http://localhost:8000) in a browser. Stop the server with `Ctrl + C`.

To create the deployable static output, run `npm run build`. No package installation is required.

## Edit a context or its three layers

Open `content.json`. Each object in `prompts` is one encounter, organized as follows:

- `scene` contains the homepage title and deck, one of four visual themes, three visible narrative beats, the evidence label, and the default writing surface.
- `layers.stroke` always records a verification `status`, Han `transcription`, interpretive `gloss`, and source boundary. A verified record also contains `symbol`, `phrase`, and `phraseReading`; a pending record keeps all three fields `null`.
- `layers.narrative` contains the title, place, evidence status, multiple story paragraphs, three writing-stage reveal lines, after-text, and archive note.
- `layers.context` contains a social-context `note`, a `sources` list, and optional `artefact` and `audio` records.
- `id` becomes the downloaded file name; keep it short and unique.

To add or replace a guide, use forms that exist in the bundled font, update `layers.stroke.symbol` and `layers.stroke.phrase`, and verify the full syllabic sequence against an authoritative source. Do not convert modern Chinese characters to Nüshu by visual or semantic guesswork. Until verification is complete, keep the status `pending-verification` and the three form fields `null`; the interface will provide an explicitly unguided response surface.

`content.schema.json` documents the complete contract. Use `null` for an unavailable `artefact` or `audio` record and an empty array for no sources; do not use empty strings or placeholder file paths. The interface will retain a complete, honest text state when media is absent.

## Change the writing surface

The three surface choices are defined in `index.html` and styled in `styles.css`:

- `paper` is the default fibre-ground surface.
- `fan` applies a folded paper-fan silhouette and ribs.
- `cloth` applies a woven-thread ground.

The selected surface is preserved in the archive-card preview and downloaded PNG. The four contexts also use distinct colour, alignment, and narrative-sequence treatments. These are interface distinctions, not reconstructed motifs or cultural evidence.

## Add contextual material later

The current version contains no historical image or recording. Paper, fan, and cloth textures remain abstract interface cues and are never used as contextual evidence.

Before adding an `artefact`, obtain a reliable source record and permission information. Then provide all required fields: `kind`, `src`, content-specific `alt`, `caption`, `credit`, `sourceUrl`, and `rights`. Images render as captioned content at their natural aspect ratio, never as a background or decorative crop. Put local media under `assets/` and use an `assets/...` path; HTTP(S) media URLs are also supported.

Before adding `audio`, provide `src`, `mimeType`, `title`, `description`, a same-page `transcript` or sound description, `credit`, `sourceUrl`, and `rights`. Audio does not autoplay, is muted each time a character is selected, and includes a keyboard-accessible sound toggle alongside native controls.

Do not reuse a thesis screenshot or an uncredited visual as an artefact. Do not synthesize or approximate a sung character in place of a sourced recording.
