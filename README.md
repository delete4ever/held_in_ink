# Held in Ink — Nüshu Writing Encounter

A static, single-page design prototype for an English-language graduation thesis. Its homepage offers four sourced or source-bounded social contexts, followed by a slow, unscored writing encounter.

## Technical approach

- Plain HTML, CSS, and JavaScript: no framework, account, database, or installed dependency. A small Node script copies the static deployment output.
- `public/content.json` holds each homepage `scene` plus three explicit layers: `stroke`, `narrative`, and `context`.
- The contextual layer is text-first. It records per-character notes and sources, and only renders an artefact or audio recording when a complete credited record is present.
- The locally bundled Noto Traditional Nüshu font renders the real standardized glyph guide without needing a network connection.
- Two layered HTML Canvas elements make the writing space: a pale font guide and an ink layer that accepts mouse, pen, and touch through Pointer Events.
- The writing surface can switch between paper, a paper fan, and woven cloth. These are deliberately abstract visual cues, not reconstructions of historical objects.
- Recorded strokes use normalized coordinates, so the personal trace survives the transition from the hidden writing canvas into both the Arrival view and the archive preview. A separate high-resolution canvas creates the downloadable PNG.
- Responsive CSS keeps the writing area usable on both a desktop and a phone browser; on narrow screens, the current narrative line remains beside the writing activity as the page moves.

## Interaction and ethical framing

- A first-visit narrative threshold positions the visitor as a temporary carrier rather than a spokesperson, owner, or traveller with direct access to the past. It can be skipped and revisited without interrupting later returns to the four encounters.
- The threshold previews the care loop as receive, attend, carry, and return, while naming the fictional-composite and documentary boundaries before role-play begins.

- The drawing path asks for an attempt in every form region before its primary send action becomes available. It does not score visual correctness. A secondary partial-trace route remains available and keeps that incompleteness visible at Arrival.
- Narrative lines unfold at character-settlement pauses rather than according to total pointer distance. This ties story progression to attentive completion without claiming to measure understanding or care.
- A keyboard-paced pathway offers one deliberate activation per form. It records a small rhythm-sensitive attention trace and labels that trace separately from handwriting; it does not generate a counterfeit Nüshu hand.
- Arrival presents the personal trace before the standardized line, names the boundary between fiction and documentary evidence again, and offers private reflection prompts before archival action.
- The archive is described as a personal record of encounter, not a heritage object. Reflection text remains in the current page only and is not included in the downloaded image.
- The care loop can return from Arrival to the expanded source context, keeping interpretation answerable to documentation rather than ending with possession of an image.

## File structure

```
Nvshu/
├── public/        # the complete browser-facing website
│   ├── index.html # homepage choice, four experience stages, dialogs
│   ├── styles.css # responsive visual system and paper/ink treatment
│   ├── app.js     # flow, writing interaction, arrival, and archive card
│   ├── brush-engine.js # pressure-, pace-, and material-aware ink model
│   ├── content.json # four stories in stroke / narrative / context layers
│   ├── content.schema.json # field contract for stories and optional media
│   └── assets/fonts/ # bundled Noto Traditional Nüshu font and OFL license
├── scripts/       # validation, brush tests, local preview, and static build
├── docs/SOURCES.md # research provenance and reconstruction boundaries
└── README.md      # local-run and editing notes
```

## Open locally

`public/content.json` is loaded by the browser, so open the project with the local server rather than double-clicking `public/index.html`.

With Node.js installed, in this folder run:

```powershell
npm run dev
```

Then visit [http://localhost:8000](http://localhost:8000) in a browser. Stop the server with `Ctrl + C`.

To create the deployable static output, run `npm run build`. No package installation is required.

## Edit a context or its three layers

Open `public/content.json`. Each object in `prompts` is one encounter, organized as follows:

- `scene` contains the homepage title and deck, one of four visual themes, three visible narrative beats, the evidence label, and the default writing surface.
- `layers.stroke` always records a verification `status`, Han `transcription`, interpretive `gloss`, and source boundary. Both archive-checked and dictionary-derived records contain `symbol`, `phrase`, and `phraseReading`; a pending record keeps all three fields `null`.
- `layers.narrative` names the fictional `sender` and `receiver`, locates the scene in `time` and `place`, and contains the story, three writing-stage reveal lines, arrival text, and archive note.
- `layers.context` contains a social-context `note`, a `sources` list, and optional `artefact` and `audio` records.
- `id` becomes the downloaded file name; keep it short and unique.

To add or replace a guide, use forms that exist in the bundled font and update `layers.stroke.symbol`, `layers.stroke.phrase`, and `phraseReading`. Use `verified-digital-reconstruction` only when the complete sequence can be cross-checked against an authoritative text record. Use `dictionary-derived-reconstruction` when standardized candidates are selected from published Han correspondences and Jiangyong readings but the original line has not been matched; state every material ambiguity in `referenceNote`. Do not convert modern Chinese characters by visual or semantic guesswork. If even a transparent candidate sequence cannot be supported, keep `pending-verification` and the three form fields `null`.

`public/content.schema.json` documents the complete contract. Use `null` for an unavailable `artefact` or `audio` record and an empty array for no sources; do not use empty strings or placeholder file paths. The interface will retain a complete, honest text state when media is absent.

## Change the writing surface

The three surface choices are defined in `public/index.html` and styled in `public/styles.css`:

- `paper` is the default fibre-ground surface.
- `fan` applies a folded paper-fan silhouette and ribs.
- `cloth` applies a woven-thread ground.

The selected surface is preserved in the archive-card preview and downloaded PNG. The four contexts also use distinct colour, alignment, and narrative-sequence treatments. These are interface distinctions, not reconstructed motifs or cultural evidence.

## Add contextual material later

The current version contains no historical image or recording. Paper, fan, and cloth textures remain abstract interface cues and are never used as contextual evidence.

Before adding an `artefact`, obtain a reliable source record and permission information. Then provide all required fields: `kind`, `src`, content-specific `alt`, `caption`, `credit`, `sourceUrl`, and `rights`. Images render as captioned content at their natural aspect ratio, never as a background or decorative crop. Put local media under `public/assets/` and use an `assets/...` path in the data; HTTP(S) media URLs are also supported.

Before adding `audio`, provide `src`, `mimeType`, `title`, `description`, a same-page `transcript` or sound description, `credit`, `sourceUrl`, and `rights`. Audio does not autoplay, is muted each time a character is selected, and includes a keyboard-accessible sound toggle alongside native controls.

Do not reuse a thesis screenshot or an uncredited visual as an artefact. Do not synthesize or approximate a sung character in place of a sourced recording.
