import {
  brushSurface,
  clamp,
  createTaperSamples,
  interpolateStrokeSegment,
  modelBrushSample,
  seededNoise
} from "./brush-engine.js";

const state = {
  prompts: [],
  current: null,
  drawing: false,
  hasMarks: false,
  lastPoint: null,
  lastDirection: { x: 0, y: 1 },
  activePointerId: null,
  activeStroke: null,
  strokes: [],
  strokeCounter: 0,
  strokeDistance: 0,
  brushSampleIndex: 0,
  cursorActive: false,
  guideSize: "comfort",
  activeCharacterIndex: null,
  characterInkDistances: [],
  characterStrokeCounts: [],
  characterInkBounds: [],
  completedCharacters: new Set(),
  characterPauseTimer: null,
  lineResponsePlayed: false,
  lineResponsePreserved: false,
  lineResponseTimer: null,
  writingDistance: 0,
  revealedWritingLines: 0,
  writingAspectRatio: 1,
  inputMode: "draw",
  lastKeyboardAttendTime: null,
  partialTrace: false,
  sending: false,
  stage: "home",
  surface: "paper",
  activeAudio: null,
  returnFocus: null
};

const els = {
  panels: [...document.querySelectorAll("[data-stage]")],
  stageNumber: document.querySelector("#stage-number"),
  stageName: document.querySelector("#stage-name"),
  progress: [...document.querySelectorAll(".progress span")],
  homeContextList: document.querySelector("#home-context-list"),
  storyTime: document.querySelector("#story-time"),
  storyTitle: document.querySelector("#story-title"),
  storyBody: document.querySelector("#story-body"),
  storyPlace: document.querySelector("#story-place"),
  storyType: document.querySelector("#story-type"),
  evidenceBoundaryStatus: document.querySelector("#evidence-boundary-status"),
  referenceSymbol: document.querySelector("#reference-symbol"),
  storyReference: document.querySelector("#story-reference"),
  referenceNote: document.querySelector("#reference-note"),
  previewSymbol: document.querySelector("#preview-symbol"),
  sceneSequence: document.querySelector("#scene-sequence"),
  guideLabel: document.querySelector("#guide-label"),
  beginAction: document.querySelector("#begin-action"),
  characterContext: document.querySelector("#character-context"),
  contextSummaryStatus: document.querySelector("#context-summary-status"),
  contextNoteSection: document.querySelector("#context-note-section"),
  contextNote: document.querySelector("#context-note"),
  contextRecord: document.querySelector("#context-record"),
  contextSources: document.querySelector("#context-sources"),
  contextArtefactSection: document.querySelector("#context-artefact-section"),
  contextArtefact: document.querySelector("#context-artefact"),
  contextAudioSection: document.querySelector("#context-audio-section"),
  contextAudio: document.querySelector("#context-audio"),
  writingTitle: document.querySelector("#writing-title"),
  writingReference: document.querySelector("#writing-reference"),
  writingEvidence: document.querySelector("#writing-evidence"),
  writingInstruction: document.querySelector("#writing-instruction"),
  writingNarrative: document.querySelector("#writing-narrative"),
  writingNarrativeIntro: document.querySelector("#writing-narrative-intro"),
  writingNarrativeLines: document.querySelector("#writing-narrative-lines"),
  writingNarrativeStatus: document.querySelector("#writing-narrative-status"),
  inputModeAction: document.querySelector("#input-mode-action"),
  inputModeNote: document.querySelector("#input-mode-note"),
  accessibleWriting: document.querySelector("#accessible-writing"),
  accessibleForm: document.querySelector("#accessible-form"),
  accessibleFormStatus: document.querySelector("#accessible-form-status"),
  accessibleFormAction: document.querySelector("#accessible-form-action"),
  afterQuote: document.querySelector("#after-quote"),
  afterTraceCaption: document.querySelector("#after-trace-caption"),
  afterEvidenceStatus: document.querySelector("#after-evidence-status"),
  afterForm: document.querySelector("#after-form"),
  afterTranscription: document.querySelector("#after-transcription"),
  afterMeaning: document.querySelector("#after-meaning"),
  afterReadingList: document.querySelector("#after-reading-list"),
  afterReadingNote: document.querySelector("#after-reading-note"),
  deliveryTrack: document.querySelector("#delivery-track"),
  cardForm: document.querySelector("#card-form"),
  cardReference: document.querySelector("#card-reference"),
  cardBackground: document.querySelector("#card-background"),
  cardFooter: document.querySelector("#card-footer"),
  archiveTitle: document.querySelector("#archive-title"),
  archiveDescription: document.querySelector("#archive-description"),
  promptPicker: document.querySelector("#prompt-picker"),
  promptList: document.querySelector("#prompt-list"),
  guide: document.querySelector("#guide-canvas"),
  writing: document.querySelector("#writing-canvas"),
  after: document.querySelector("#after-canvas"),
  card: document.querySelector("#card-canvas"),
  canvasFrame: document.querySelector("#canvas-frame"),
  guideSizePicker: document.querySelector("#guide-size-picker"),
  characterFeedbackLayer: document.querySelector("#character-feedback-layer"),
  inkStatus: document.querySelector("#ink-status"),
  brushCursor: document.querySelector("#brush-cursor"),
  brushReadout: document.querySelector("#brush-readout"),
  brushInput: document.querySelector("#brush-input"),
  partialAction: document.querySelector("#partial-action"),
  pauseAction: document.querySelector("#pause-action"),
  reflectionNotice: document.querySelector("#reflection-notice"),
  reflectionUnknown: document.querySelector("#reflection-unknown"),
  about: document.querySelector("#about-dialog")
};

const stageLabels = {
  home: ["00", "Choose"],
  entering: ["01", "Story"],
  writing: ["02", "Writing"],
  after: ["03", "Arrival"],
  archive: ["04", "Keep"]
};

const surfaceLabels = {
  paper: "paper",
  fan: "paper fan",
  cloth: "woven cloth"
};

const sceneAccents = {
  message: "#984e3a",
  crossing: "#3f6877",
  witness: "#744154",
  invocation: "#78612f"
};

const rootStyles = getComputedStyle(document.documentElement);
const brushPalette = {
  ink: rootStyles.getPropertyValue("--brush-ink").trim() || "#211f1a",
  edge: rootStyles.getPropertyValue("--brush-edge").trim() || "#40362b"
};

function currentAccent() {
  return sceneAccents[state.current?.scene?.theme] || sceneAccents.message;
}

function syncCanvasFrameState() {
  const guideClass = state.current
    ? hasStrokeGuide() ? " is-phrase-guide" : " is-unguided"
    : "";
  const inkClass = state.hasMarks ? " has-ink" : "";
  const drawingClass = state.drawing ? " is-drawing" : "";
  const cursorClass = state.cursorActive ? " is-cursor-active" : "";
  const sizeClass = state.current && hasStrokeGuide() && state.guideSize === "comfort" ? " is-comfort-guide" : "";
  const preservedClass = state.lineResponsePreserved ? " is-line-preserved" : "";
  const sendingClass = state.sending ? " is-sending" : "";
  els.canvasFrame.className = `canvas-frame surface-${state.surface}${guideClass}${sizeClass}${inkClass}${drawingClass}${cursorClass}${preservedClass}${sendingClass}`;
}

async function loadPrompts() {
  const response = await fetch("content.json");
  if (!response.ok) throw new Error("The local prompt file could not be loaded.");
  const data = await response.json();
  validateContent(data);
  state.prompts = data.prompts;
  renderHomepage();
  selectPrompt(state.prompts[0]);
  setStage("home", false);
  if (document.fonts) {
    try {
      const symbols = state.prompts.map((prompt) => strokeFor(prompt).phrase || "").join("");
      if (symbols) await document.fonts.load("400 160px 'Noto Traditional Nushu'", symbols);
    } catch (error) {
      console.warn("The local Nüshu font did not load; a system fallback will be used.", error);
    }
  }
}

function validateContent(data) {
  if (data?.contentVersion !== 3 || !Array.isArray(data.prompts) || data.prompts.length !== 4) {
    throw new Error("content.json does not contain the four version 3 contexts.");
  }

  const ids = new Set();
  const themes = new Set();
  data.prompts.forEach((prompt) => {
    const { stroke, narrative, context } = prompt.layers || {};
    const scene = prompt.scene;
    const requiredSceneText = [scene?.kicker, scene?.homeTitle, scene?.homeDeck, scene?.theme, scene?.evidenceLabel, scene?.defaultSurface];
    const requiredStrokeText = [stroke?.status, stroke?.transcription, stroke?.gloss, stroke?.guideLabel, stroke?.reference, stroke?.referenceNote];
    const requiredNarrativeText = [
      narrative?.sender,
      narrative?.receiver,
      narrative?.time,
      narrative?.title,
      narrative?.place,
      narrative?.storyType,
      narrative?.after,
      narrative?.archiveNote
    ];
    const guided = ["verified-digital-reconstruction", "dictionary-derived-reconstruction"].includes(stroke?.status);
    const pendingIsClean = stroke?.status === "pending-verification" && stroke.symbol === null && stroke.phrase === null && stroke.phraseReading === null;
    if (
      !hasText(prompt.id) || ids.has(prompt.id) || themes.has(scene?.theme) ||
      !requiredSceneText.every(hasText) || !Array.isArray(scene?.sequence) || scene.sequence.length !== 3 || !scene.sequence.every(hasText) ||
      !requiredStrokeText.every(hasText) || !requiredNarrativeText.every(hasText) ||
      (!guided && !pendingIsClean) ||
      (guided && ![stroke.symbol, stroke.phrase, stroke.phraseReading].every(hasText)) ||
      !Array.isArray(narrative?.story) || narrative.story.length < 2 || !narrative.story.every(hasText) ||
      !Array.isArray(narrative?.writingLines) || narrative.writingLines.length !== 3 || !narrative.writingLines.every(hasText) ||
      !context || (context.note !== null && !hasText(context.note)) ||
      !Array.isArray(context.sources) || !("artefact" in context) || !("audio" in context) ||
      !["message", "crossing", "witness", "invocation"].includes(scene?.theme) ||
      !["paper", "fan", "cloth"].includes(scene?.defaultSurface)
    ) {
      throw new Error(`Prompt ${prompt.id || "(unknown)"} is missing a required layer.`);
    }
    ids.add(prompt.id);
    themes.add(scene.theme);
  });
}

function strokeFor(prompt = state.current) {
  return prompt.layers.stroke;
}

function narrativeFor(prompt = state.current) {
  return prompt.layers.narrative;
}

function hasStrokeGuide(stroke = strokeFor()) {
  return ["verified-digital-reconstruction", "dictionary-derived-reconstruction"].includes(stroke.status);
}

function totalForms() {
  return state.current && hasStrokeGuide() ? Array.from(strokeFor().phrase || "").length : 0;
}

function evidenceBoundaryText(prompt = state.current) {
  if (!prompt) return "";
  const stroke = strokeFor(prompt);
  if (stroke.status === "verified-digital-reconstruction") {
    return "The people and scene are imagined; the line and displayed forms are archive-checked.";
  }
  if (stroke.status === "dictionary-derived-reconstruction") {
    return "The people and scene are imagined; the source line is reported, while the displayed forms are provisional dictionary matches.";
  }
  return "The people and scene are imagined. No verified Nüshu form is supplied for this open response.";
}

function mediaUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function emptyContextState(label, text) {
  const empty = document.createElement("div");
  empty.className = "context-empty";

  const status = document.createElement("span");
  status.className = "context-empty-label";
  status.textContent = label;

  const message = document.createElement("p");
  message.textContent = text;
  empty.append(status, message);
  return empty;
}

function sourceLink(label, url, className = "") {
  const href = mediaUrl(url);
  if (!href) return null;
  const link = document.createElement("a");
  link.href = href;
  link.className = className;
  link.textContent = label;
  return link;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sourceIsCitable(record) {
  return Boolean(
    record &&
    [record.label, record.credit, record.url].every(hasText) &&
    mediaUrl(record.url)
  );
}

function artefactIsDisplayable(record) {
  return Boolean(
    record &&
    ["photograph", "artefact"].includes(record.kind) &&
    [record.src, record.alt, record.caption, record.credit, record.sourceUrl, record.rights].every(hasText) &&
    mediaUrl(record.src) &&
    mediaUrl(record.sourceUrl)
  );
}

function audioIsPlayable(record) {
  return Boolean(
    record &&
    [record.src, record.mimeType, record.title, record.description, record.transcript, record.credit, record.sourceUrl, record.rights].every(hasText) &&
    record.mimeType.startsWith("audio/") &&
    mediaUrl(record.src) &&
    mediaUrl(record.sourceUrl)
  );
}

function renderContext(context) {
  const safeContext = context || { note: null, sources: [], artefact: null, audio: null };
  const sources = Array.isArray(safeContext.sources) ? safeContext.sources : [];
  const citableSourceCount = sources.filter(sourceIsCitable).length;
  els.contextSummaryStatus.textContent = `${citableSourceCount} ${citableSourceCount === 1 ? "reference" : "references"}`;
  els.contextNoteSection.hidden = !hasText(safeContext.note);
  els.contextNote.textContent = safeContext.note || "";
  renderSources(sources);
  const showArtefact = artefactIsDisplayable(safeContext.artefact);
  els.contextArtefactSection.hidden = !showArtefact;
  if (showArtefact) renderArtefact(safeContext.artefact);
  else els.contextArtefact.replaceChildren();
  const showAudio = audioIsPlayable(safeContext.audio);
  els.contextAudioSection.hidden = !showAudio;
  els.contextRecord.classList.toggle("is-sources-only", !showArtefact && !showAudio);
  if (showAudio) renderAudio(safeContext.audio);
  else {
    stopActiveAudio();
    state.activeAudio = null;
    els.contextAudio.replaceChildren();
  }
}

function renderSources(sources) {
  const citableSources = sources.filter(sourceIsCitable);
  if (!citableSources.length) {
    els.contextSources.replaceChildren(emptyContextState(
      sources.length ? "Withheld" : "Not recorded",
      sources.length
        ? "The source record is incomplete, so it is not presented as a citation."
        : "No source record has been added. This entry should not be treated as historical evidence."
    ));
    return;
  }

  const list = document.createElement("ol");
  list.className = "context-source-list";
  citableSources.forEach((source) => {
    const item = document.createElement("li");
    const title = sourceLink(source.label, source.url, "context-source-link");
    const titleFallback = document.createElement("span");
    titleFallback.className = "context-source-link";
    titleFallback.textContent = source.label;

    const credit = document.createElement("p");
    credit.className = "context-credit";
    credit.textContent = source.credit;
    item.append(title || titleFallback, credit);

    if (source.rights) {
      const rights = document.createElement("p");
      rights.className = "context-rights";
      rights.textContent = `Rights: ${source.rights}`;
      item.append(rights);
    }
    list.append(item);
  });
  els.contextSources.replaceChildren(list);
}

function renderArtefact(artefact) {
  if (!artefactIsDisplayable(artefact)) {
    els.contextArtefact.replaceChildren(emptyContextState(
      artefact ? "Withheld" : "Not attached",
      artefact
        ? "This record is missing required source, credit, rights, caption, or alt-text information, so the material is not displayed."
        : "No verified photograph or artefact is attached to this entry. No reconstruction is substituted."
    ));
    return;
  }

  const src = mediaUrl(artefact.src);
  const figure = document.createElement("figure");
  figure.className = "context-artefact";
  const mediaFrame = document.createElement("div");
  mediaFrame.className = "context-media-frame";
  const image = document.createElement("img");
  image.src = src;
  image.alt = artefact.alt;
  image.loading = "lazy";
  image.decoding = "async";

  const caption = document.createElement("figcaption");
  const captionText = document.createElement("p");
  captionText.className = "context-caption";
  captionText.textContent = artefact.caption;
  const credit = document.createElement("p");
  credit.className = "context-credit";
  credit.textContent = artefact.credit;
  const rights = document.createElement("p");
  rights.className = "context-rights";
  rights.textContent = `Rights: ${artefact.rights}`;
  caption.append(captionText, credit, rights);

  const record = sourceLink("View source record", artefact.sourceUrl, "context-record-link");
  if (record) caption.append(record);
  mediaFrame.append(image);
  figure.append(mediaFrame, caption);
  image.addEventListener("error", () => {
    if (!mediaFrame.isConnected || !figure.contains(mediaFrame)) return;
    const errorState = emptyContextState(
      "Unavailable",
      "The credited artefact could not be loaded. No replacement image is shown."
    );
    errorState.setAttribute("role", "status");
    mediaFrame.replaceChildren(errorState);
  }, { once: true });
  els.contextArtefact.replaceChildren(figure);
}

function stopActiveAudio() {
  if (!state.activeAudio) return;
  state.activeAudio.pause();
  try {
    state.activeAudio.currentTime = 0;
  } catch {
    // Some streamed recordings cannot seek before their metadata is available.
  }
}

function renderAudio(audioRecord) {
  stopActiveAudio();
  if (!audioIsPlayable(audioRecord)) {
    state.activeAudio = null;
    els.contextAudio.replaceChildren(emptyContextState(
      audioRecord ? "Withheld" : "Not attached",
      audioRecord
        ? "This record is missing required source, credit, rights, description, or transcript information, so no audio is loaded."
        : "No credited audio is attached to this entry. Nothing will play."
    ));
    return;
  }

  const src = mediaUrl(audioRecord.src);
  const wrapper = document.createElement("div");
  wrapper.className = "context-audio";
  const title = document.createElement("p");
  title.className = "context-media-title";
  title.textContent = audioRecord.title;

  const description = document.createElement("p");
  const descriptionId = `context-audio-description-${state.current.id}`;
  description.id = descriptionId;
  description.className = "context-audio-description";
  description.textContent = `${audioRecord.description} Audio never starts automatically and begins muted.`;

  const player = document.createElement("audio");
  player.controls = true;
  player.autoplay = false;
  player.preload = "none";
  player.defaultMuted = true;
  player.muted = true;
  player.setAttribute("muted", "");
  player.setAttribute("aria-label", `${audioRecord.title}. Starts muted.`);
  player.setAttribute("aria-describedby", descriptionId);
  const source = document.createElement("source");
  source.src = src;
  source.type = audioRecord.mimeType;
  player.append(source);
  const playerRegion = document.createElement("div");
  playerRegion.className = "context-audio-player";
  playerRegion.append(player);

  const soundButton = document.createElement("button");
  soundButton.type = "button";
  soundButton.className = "audio-sound-toggle";
  const soundLabel = document.createElement("span");
  soundLabel.textContent = "Sound";
  const soundState = document.createElement("span");
  soundState.className = "audio-sound-state";
  soundState.setAttribute("aria-hidden", "true");
  soundButton.append(soundLabel, soundState);
  const syncSoundButton = () => {
    const soundIsOn = !player.muted;
    soundButton.setAttribute("aria-pressed", String(soundIsOn));
    soundState.textContent = soundIsOn ? "On" : "Off";
  };
  soundButton.addEventListener("click", () => {
    player.muted = !player.muted;
    syncSoundButton();
  });
  player.addEventListener("volumechange", syncSoundButton);
  syncSoundButton();

  const transcript = document.createElement("details");
  transcript.className = "context-transcript";
  const transcriptSummary = document.createElement("summary");
  transcriptSummary.textContent = "Read transcript or sound description";
  const transcriptText = document.createElement("p");
  transcriptText.textContent = audioRecord.transcript;
  transcript.append(transcriptSummary, transcriptText);

  const credit = document.createElement("p");
  credit.className = "context-credit";
  credit.textContent = audioRecord.credit;
  const rights = document.createElement("p");
  rights.className = "context-rights";
  rights.textContent = `Rights: ${audioRecord.rights}`;
  const record = sourceLink("View audio source record", audioRecord.sourceUrl, "context-record-link");

  let audioFailed = false;
  const handleAudioError = () => {
    if (audioFailed || state.activeAudio !== player || !wrapper.isConnected) return;
    audioFailed = true;
    stopActiveAudio();
    state.activeAudio = null;
    player.setAttribute("aria-invalid", "true");
    soundButton.disabled = true;
    soundButton.removeAttribute("aria-pressed");
    soundButton.replaceChildren("Sound unavailable");
    const errorState = emptyContextState(
      "Unavailable",
      "The credited audio could not be loaded. Nothing will play."
    );
    errorState.setAttribute("role", "status");
    playerRegion.append(errorState);
  };
  player.addEventListener("error", handleAudioError, { once: true });
  source.addEventListener("error", handleAudioError, { once: true });

  wrapper.append(title, description, playerRegion, soundButton, transcript, credit, rights);
  if (record) wrapper.append(record);
  els.contextAudio.replaceChildren(wrapper);
  state.activeAudio = player;
}

function renderHomepage() {
  const choices = state.prompts.map((prompt, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `context-choice context-choice-${prompt.scene.theme}`;
    button.dataset.contextId = prompt.id;

    const top = document.createElement("span");
    top.className = "context-choice-topline";
    const number = document.createElement("span");
    number.className = "context-choice-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const kicker = document.createElement("span");
    kicker.className = "context-choice-kicker";
    kicker.textContent = prompt.scene.kicker;
    top.append(number, kicker);

    const title = document.createElement("span");
    title.className = "context-choice-title";
    title.textContent = prompt.scene.homeTitle;

    const deck = document.createElement("span");
    deck.className = "context-choice-deck";
    deck.textContent = prompt.scene.homeDeck;

    const sequence = document.createElement("span");
    sequence.className = "context-choice-sequence";
    sequence.setAttribute("aria-hidden", "true");
    prompt.scene.sequence.forEach((beat) => {
      const item = document.createElement("span");
      item.textContent = beat;
      sequence.append(item);
    });

    const bottom = document.createElement("span");
    bottom.className = "context-choice-bottom";
    const boundary = document.createElement("span");
    boundary.className = "context-choice-boundary";
    boundary.textContent = "Fictional composite";
    const evidence = document.createElement("span");
    evidence.className = "context-choice-evidence";
    evidence.textContent = prompt.scene.evidenceLabel;
    const action = document.createElement("span");
    action.className = "context-choice-action";
    action.textContent = "Carry her words →";
    bottom.append(boundary, evidence, action);

    button.append(top, title, deck, sequence, bottom);
    return button;
  });
  els.homeContextList.replaceChildren(...choices);
}

function renderAfterFeedback() {
  const stroke = strokeFor();
  const narrative = narrativeFor();
  const forms = stroke.phrase ? Array.from(stroke.phrase) : [];
  const readings = stroke.phraseReading ? stroke.phraseReading.split(/\s*·\s*/) : [];

  els.afterForm.textContent = stroke.phrase || stroke.transcription;
  els.afterForm.classList.toggle("nushu-glyph", Boolean(stroke.phrase));
  els.afterTranscription.textContent = stroke.transcription;
  els.afterMeaning.textContent = `“${stroke.gloss}”`;

  if (forms.length && readings.length === forms.length) {
    const readingTokens = forms.map((form, index) => {
      const token = document.createElement("span");
      token.className = "after-reading-token";
      token.style.setProperty("--reading-index", String(index));
      const glyph = document.createElement("span");
      glyph.className = "after-reading-glyph nushu-glyph";
      glyph.textContent = form;
      glyph.setAttribute("aria-hidden", "true");
      const reading = document.createElement("span");
      reading.className = "after-reading-syllable";
      reading.textContent = readings[index];
      token.append(glyph, reading);
      return token;
    });
    els.afterReadingList.replaceChildren(...readingTokens);
    els.afterReadingNote.textContent = stroke.status === "verified-digital-reconstruction"
      ? `Jiangyong readings recorded for these ${forms.length} forms.`
      : `Provisional Jiangyong readings for these ${forms.length} standardized forms.`;
  } else {
    const unavailable = document.createElement("p");
    unavailable.className = "after-reading-unavailable";
    unavailable.textContent = "A checked syllable reading is not available for this line.";
    els.afterReadingList.replaceChildren(unavailable);
    els.afterReadingNote.textContent = "Read the Han transcription beneath the line.";
  }

  const roleLabels = [narrative.sender, "Your hand", narrative.receiver];
  els.deliveryTrack.setAttribute(
    "aria-label",
    `${narrative.sender}’s words move through your hand towards ${narrative.receiver}`
  );
  const deliveryNodes = state.current.scene.sequence.map((beat, index) => {
    const node = document.createElement("span");
    node.className = `delivery-node delivery-node-${index + 1}`;
    node.style.setProperty("--delivery-index", String(index));
    const marker = document.createElement("span");
    marker.className = "delivery-marker";
    marker.textContent = String(index + 1).padStart(2, "0");
    const role = document.createElement("strong");
    role.textContent = roleLabels[index];
    const detail = document.createElement("span");
    detail.textContent = beat;
    node.append(marker, role, detail);
    return node;
  });
  els.deliveryTrack.replaceChildren(...deliveryNodes);
}

function selectPrompt(prompt) {
  stopActiveAudio();
  state.current = prompt;
  const stroke = strokeFor(prompt);
  const narrative = narrativeFor(prompt);
  const verified = hasStrokeGuide(stroke);
  document.body.dataset.scene = prompt.scene.theme;
  state.surface = prompt.scene.defaultSurface;
  syncCanvasFrameState();
  document.querySelectorAll("[data-surface]").forEach((button) => {
    const isSelected = button.dataset.surface === state.surface;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  els.storyTime.textContent = narrative.time;
  els.storyTitle.textContent = narrative.title;
  els.storyBody.replaceChildren(...narrative.story.map((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    return paragraph;
  }));
  els.storyPlace.textContent = narrative.place;
  els.storyType.textContent = narrative.storyType;
  els.evidenceBoundaryStatus.textContent = prompt.scene.evidenceLabel;
  els.referenceSymbol.textContent = verified ? stroke.symbol : "Form pending";
  els.referenceSymbol.classList.toggle("nushu-glyph", verified);
  els.referenceSymbol.classList.toggle("is-pending-form", !verified);
  els.storyReference.textContent = stroke.reference;
  els.referenceNote.textContent = stroke.referenceNote;
  els.previewSymbol.textContent = verified ? stroke.phrase : stroke.transcription;
  els.previewSymbol.classList.toggle("nushu-glyph", verified);
  els.previewSymbol.classList.toggle("is-phrase", verified);
  els.previewSymbol.classList.toggle("is-transcription", !verified);
  if (verified) els.previewSymbol.removeAttribute("lang");
  else els.previewSymbol.setAttribute("lang", "zh-Hans");
  els.sceneSequence.replaceChildren(...prompt.scene.sequence.map((beat, index) => {
    const item = document.createElement("li");
    item.textContent = beat;
    item.dataset.step = String(index + 1).padStart(2, "0");
    return item;
  }));
  els.guideLabel.textContent = stroke.guideLabel;
  els.beginAction.textContent = `Write for ${narrative.sender}`;
  els.writingTitle.textContent = `Carry ${narrative.sender}’s words to ${narrative.receiver}`;
  els.writingReference.textContent = `${stroke.transcription} · “${stroke.gloss}”`;
  els.writingEvidence.textContent = evidenceBoundaryText(prompt);
  els.writingInstruction.textContent = verified
    ? `Follow the ${Array.from(stroke.phrase).length} pale forms from top to bottom. Let the line unfold slowly.`
    : "Let your mark answer the story in your own way.";
  els.writing.setAttribute("aria-label", verified
    ? stroke.status === "verified-digital-reconstruction"
      ? `A canvas for tracing the Nüshu line transcribed as ${stroke.transcription}`
      : `A canvas for tracing provisional standardized forms for the line ${stroke.transcription}`
    : `An open writing canvas for ${narrative.title}`);
  els.guideSizePicker.hidden = !verified;
  els.writingNarrativeIntro.textContent = `Stay with ${narrative.sender} as the words take shape.`;
  els.afterQuote.textContent = narrative.after;
  els.afterEvidenceStatus.textContent = evidenceBoundaryText(prompt);
  renderAfterFeedback();
  els.cardForm.textContent = narrative.title;
  els.cardReference.textContent = `${narrative.sender} → ${narrative.receiver} · ${stroke.transcription}`;
  els.cardBackground.textContent = narrative.archiveNote;
  els.archiveTitle.textContent = `A record of your encounter with ${narrative.sender}’s line`;
  els.archiveDescription.textContent = `This keeps your temporary involvement visible without claiming ownership of Nüshu or ${narrative.sender}’s story.`;
  renderContext(prompt.layers.context);
  els.characterContext.open = false;
  setupWritingNarrative();
  clearWriting({ resetInputMode: true });
}

function setupWritingNarrative() {
  const lines = state.current ? narrativeFor().writingLines : [];
  els.writingNarrative.hidden = lines.length === 0;
  els.writingNarrativeLines.replaceChildren(...lines.map((line, index) => {
    const paragraph = document.createElement("p");
    paragraph.className = "writing-narrative-line";
    paragraph.dataset.narrativeLine = String(index);
    paragraph.textContent = line;
    return paragraph;
  }));
  els.writingNarrativeStatus.textContent = "";
}

function revealWritingNarrative() {
  const lines = state.current ? narrativeFor().writingLines : [];
  if (!lines.length) return;
  const total = totalForms();
  const completed = state.completedCharacters.size;
  const targetCount = total > 0
    ? Math.min(lines.length, Math.max(state.hasMarks ? 1 : 0, 1 + Math.floor((completed / total) * (lines.length - 1))))
    : Math.min(lines.length, state.hasMarks ? 1 + Math.floor(Math.max(0, state.strokes.length - 1) / 2) : 0);

  while (state.revealedWritingLines < targetCount) {
    const index = state.revealedWritingLines;
    const line = els.writingNarrativeLines.querySelector(`[data-narrative-line="${index}"]`);
    line?.classList.add("is-revealed");
    els.writingNarrativeStatus.textContent = lines[index];
    state.revealedWritingLines += 1;
  }

  els.writingNarrativeLines.querySelectorAll(".writing-narrative-line").forEach((line, index) => {
    line.classList.toggle("is-current", index === state.revealedWritingLines - 1);
  });
}

function lineIsComplete() {
  const total = totalForms();
  return total > 0 ? state.completedCharacters.size === total : state.hasMarks;
}

function syncCompletionControls() {
  const complete = lineIsComplete();
  const hasPartial = state.hasMarks && !complete;
  els.pauseAction.disabled = !complete || state.sending;
  els.pauseAction.textContent = complete ? "Send the line onward" : "Complete the line to send it";
  els.partialAction.hidden = !hasPartial || state.sending;
  els.inputModeAction.disabled = state.hasMarks || state.sending;
  els.accessibleFormAction.disabled = complete || state.sending;
  if (state.hasMarks) els.inputModeAction.title = "Clear the page before changing the input pathway";
  else els.inputModeAction.removeAttribute("title");
}

function captureWritingGeometry() {
  const rect = els.writing.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) state.writingAspectRatio = rect.width / rect.height;
}

function applyInputMode() {
  const keyboardMode = state.inputMode === "keyboard";
  const traceLabel = keyboardMode
    ? "keyboard-paced attention trace"
    : state.partialTrace ? "partial handwriting trace" : "handwriting trace";
  els.canvasFrame.hidden = keyboardMode;
  els.accessibleWriting.hidden = !keyboardMode;
  els.inputModeAction.setAttribute("aria-pressed", String(keyboardMode));
  els.inputModeAction.textContent = keyboardMode ? "Return to the drawing pathway" : "Use the keyboard-paced pathway";
  els.inputModeNote.textContent = keyboardMode
    ? "Each press records a pause mark rather than imitating handwriting. Clear the trace to change pathways."
    : "If drawing is not accessible to you, attend to each form with a deliberate key press. This records rhythm, not simulated handwriting.";
  els.afterTraceCaption.textContent = `Your ${traceLabel}, before interpretation`;
  els.after.setAttribute("aria-label", `Your ${traceLabel} from the writing stage`);
  els.card.setAttribute("aria-label", `Your saved ${traceLabel} record`);
  els.cardFooter.textContent = `${traceLabel[0].toUpperCase()}${traceLabel.slice(1)} · personal record, not a heritage object`;
  renderAccessiblePath();
  syncCompletionControls();
}

function toggleInputMode() {
  if (state.hasMarks || state.sending) return;
  captureWritingGeometry();
  state.inputMode = state.inputMode === "draw" ? "keyboard" : "draw";
  applyInputMode();
  if (state.inputMode === "draw") requestAnimationFrame(setupWritingCanvases);
  else requestAnimationFrame(() => els.accessibleFormAction.focus());
}

function renderAccessiblePath() {
  if (!state.current) return;
  const forms = Array.from(strokeFor().phrase || "");
  const readings = strokeFor().phraseReading?.split(/\s*·\s*/) || [];
  const index = forms.findIndex((_, formIndex) => !state.completedCharacters.has(formIndex));
  if (index === -1) {
    els.accessibleForm.textContent = forms.at(-1) || "";
    els.accessibleFormStatus.textContent = `All ${forms.length} forms have been attended to. The line is ready to send.`;
    els.accessibleFormAction.textContent = "Line ready";
    return;
  }
  els.accessibleForm.textContent = forms[index] || "";
  const reading = readings[index] ? `, read ${readings[index]}` : "";
  els.accessibleFormStatus.textContent = `Form ${index + 1} of ${forms.length}${reading}. Pause, then activate the button when you are ready.`;
  els.accessibleFormAction.textContent = `Attend to form ${index + 1}`;
}

function keyboardTracePoint(x, y, width, speed = 0.32) {
  return {
    x,
    y,
    width,
    speed,
    force: 0.48,
    ink: 0.88,
    tilt: 0,
    tiltAngle: 0,
    pointerType: "keyboard",
    usesHardwarePressure: false,
    time: 0
  };
}

function attendToNextForm() {
  if (state.inputMode !== "keyboard" || state.sending) return;
  const total = totalForms();
  const index = Array.from({ length: total }, (_, formIndex) => formIndex)
    .find((formIndex) => !state.completedCharacters.has(formIndex));
  if (index === undefined) return;
  const now = performance.now();
  const pauseWeight = state.lastKeyboardAttendTime === null
    ? 0.52
    : clamp((now - state.lastKeyboardAttendTime) / 2400, 0.2, 1);
  state.lastKeyboardAttendTime = now;
  const centreY = (index + 0.5) / total;
  const direction = index % 2 === 0 ? 1 : -1;
  const halfLength = 0.022 + pauseWeight * 0.035;
  const markWidth = 0.007 + pauseWeight * 0.006;
  const seed = (state.strokeCounter + 1) * 7919;
  state.strokeCounter += 1;
  state.strokes.push({
    seed,
    points: [
      keyboardTracePoint(0.5 - direction * halfLength, centreY - 0.012, markWidth),
      keyboardTracePoint(0.5 + direction * halfLength, centreY + 0.012, markWidth * 0.72)
    ]
  });
  state.hasMarks = true;
  state.completedCharacters.add(index);
  state.writingDistance += 1;
  els.inkStatus.textContent = index === total - 1
    ? `${total} of ${total} · the line is ready.`
    : `${index + 1} of ${total} · pause before the next form.`;
  revealWritingNarrative();
  renderAccessiblePath();
  syncCompletionControls();
  scheduleLineResponse(total);
}

function setStage(stage, moveFocus = true) {
  const previousStage = state.stage;
  if (previousStage === "writing" && stage !== "writing") captureWritingGeometry();
  if (stage !== "entering") stopActiveAudio();
  if (stage !== "writing") {
    updateBrushCursor();
    clearCharacterPause();
  }
  state.stage = stage;
  if (stage !== "writing") state.sending = false;
  syncCanvasFrameState();
  els.panels.forEach((panel) => { panel.hidden = panel.dataset.stage !== stage; });
  const [number, name] = stageLabels[stage];
  els.stageNumber.textContent = number;
  els.stageName.textContent = name;
  const index = ["entering", "writing", "after", "archive"].indexOf(stage);
  els.progress.forEach((line, i) => line.classList.toggle("is-current", i === index));
  if (stage === "home") delete document.body.dataset.scene;
  else if (state.current) document.body.dataset.scene = state.current.scene.theme;
  const motionIsReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: motionIsReduced ? "auto" : "smooth" });
  if (moveFocus) {
    const activePanel = els.panels.find((panel) => panel.dataset.stage === stage);
    const focusTarget = activePanel?.querySelector("h1, h2, .after-quote");
    if (focusTarget) {
      focusTarget.tabIndex = -1;
      requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
    }
  }

  if (stage === "writing") requestAnimationFrame(() => {
    applyInputMode();
    setupWritingCanvases(previousStage === "after");
    syncCompletionControls();
  });
  if (stage === "after") requestAnimationFrame(drawAfterMark);
  if (stage === "archive") requestAnimationFrame(drawArchiveCard);
}

function sizeCanvas(canvas, width, height) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function guideLayout(width, height) {
  if (!state.current || !hasStrokeGuide()) {
    return { forms: [], fontSize: 0, step: 0, positions: [] };
  }
  const forms = Array.from(strokeFor().phrase);
  const isPhrase = forms.length > 1;
  const isComfortGuide = state.guideSize === "comfort";
  const fontSize = isPhrase
    ? Math.min(
      (height * (isComfortGuide ? 0.9 : 0.84) / forms.length) * (isComfortGuide ? 0.99 : 0.88),
      width * (isComfortGuide ? 0.38 : 0.3)
    )
    : Math.min(height * (isComfortGuide ? 0.82 : 0.76), width * (isComfortGuide ? 0.62 : 0.46));
  const step = isPhrase ? fontSize * (isComfortGuide ? 1.13 : 1.16) : 0;
  const firstY = isPhrase ? height / 2 - ((forms.length - 1) * step) / 2 : height / 2 + fontSize * 0.02;
  const positions = forms.map((form, index) => ({ form, y: firstY + index * step }));
  return { forms, fontSize, step, positions };
}

function setupWritingCanvases() {
  const rect = els.canvasFrame.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  state.writingAspectRatio = rect.width / rect.height;
  sizeCanvas(els.guide, rect.width, rect.height);
  const writeCtx = sizeCanvas(els.writing, rect.width, rect.height);
  writeCtx.clearRect(0, 0, rect.width, rect.height);
  renderRecordedStrokes(writeCtx, { x: 0, y: 0, width: rect.width, height: rect.height }, state.surface);
  drawGuide();
  setupCharacterFeedback();
}

function drawGuide() {
  const width = els.guide.clientWidth;
  const height = els.guide.clientHeight;
  const ctx = els.guide.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  if (!hasStrokeGuide()) return;
  ctx.save();
  const { forms, fontSize, step, positions } = guideLayout(width, height);
  const isPhrase = forms.length > 1;
  ctx.font = `400 ${fontSize}px "Noto Traditional Nushu"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(129, 108, 83, 0.075)";
  ctx.strokeStyle = "rgba(114, 96, 76, 0.5)";
  ctx.lineWidth = Math.max(1.15, Math.min(width, height) * 0.0031);
  if (isPhrase) {
    positions.forEach(({ form, y }, index) => {
      ctx.fillText(form, width / 2, y);
      ctx.strokeText(form, width / 2, y);
      ctx.save();
      ctx.font = "650 10px Segoe UI, Arial, sans-serif";
      ctx.fillStyle = "rgba(94, 82, 67, 0.62)";
      ctx.textAlign = "left";
      ctx.fillText(String(index + 1).padStart(2, "0"), width / 2 + Math.max(50, fontSize * 0.68), y + 3);
      ctx.restore();
      if (index < positions.length - 1) {
        const dividerY = y + step / 2;
        ctx.save();
        ctx.strokeStyle = "rgba(107, 91, 72, 0.16)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(width * 0.31, dividerY);
        ctx.lineTo(width * 0.69, dividerY);
        ctx.stroke();
        ctx.restore();
      }
    });
  } else {
    ctx.fillText(forms[0], width / 2, positions[0].y);
    ctx.strokeText(forms[0], width / 2, positions[0].y);
  }
  ctx.restore();
}

function setupCharacterFeedback() {
  const width = els.guide.clientWidth;
  const height = els.guide.clientHeight;
  els.characterFeedbackLayer.replaceChildren();
  if (!state.current || !hasStrokeGuide() || width <= 0 || height <= 0) return;
  const layout = guideLayout(width, height);
  const firstPosition = layout.positions[0];
  const lastPosition = layout.positions[layout.positions.length - 1];
  const statusOffset = Math.max(50, layout.fontSize * 0.68);
  const target = characterTargetDimensions(layout);
  const lineStart = firstPosition.y;
  const lineHeight = Math.max(12, lastPosition.y - firstPosition.y);
  els.characterFeedbackLayer.style.setProperty("--line-x", `calc(50% + ${statusOffset + 2.5}px)`);
  els.characterFeedbackLayer.style.setProperty("--line-start", `${lineStart}px`);
  els.characterFeedbackLayer.style.setProperty("--line-height", `${lineHeight}px`);
  const responses = layout.positions.map(({ form, y }, index) => {
    const response = document.createElement("span");
    response.className = "character-response";
    response.dataset.characterIndex = String(index);
    response.classList.toggle("is-settled", state.completedCharacters.has(index));
    response.classList.toggle("is-last", index === layout.positions.length - 1);
    response.style.setProperty("--guide-y", `${y}px`);
    response.style.setProperty("--guide-size", `${layout.fontSize}px`);
    response.style.setProperty("--guide-gap", `${layout.step}px`);
    response.style.setProperty("--status-offset", `${statusOffset}px`);
    response.style.setProperty("--target-width", `${target.width}px`);
    response.style.setProperty("--target-height", `${target.height}px`);
    response.style.setProperty("--thread-start", `${layout.fontSize * 0.38}px`);
    response.style.setProperty("--thread-length", `${Math.max(20, layout.step - layout.fontSize * 0.55)}px`);
    response.style.setProperty("--line-index", String(index));
    const targetArea = document.createElement("span");
    targetArea.className = "character-response-target";
    const echo = document.createElement("span");
    echo.className = "character-response-glyph nushu-glyph";
    echo.textContent = form;
    echo.dataset.form = form;
    const status = document.createElement("span");
    status.className = "character-response-status";
    status.textContent = String(index + 1).padStart(2, "0");
    response.append(targetArea, echo, status);
    return response;
  });
  els.characterFeedbackLayer.replaceChildren(...responses);
  syncCharacterTargets();
}

function setSurface(surface) {
  if (!(surface in surfaceLabels) || state.surface === surface) return;
  state.surface = surface;
  syncCanvasFrameState();
  document.querySelectorAll("[data-surface]").forEach((button) => {
    const isSelected = button.dataset.surface === surface;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  const narrative = narrativeFor();
  els.cardReference.textContent = `${narrative.sender} → ${narrative.receiver} · ${strokeFor().transcription}`;
  if (state.stage === "writing") {
    requestAnimationFrame(setupWritingCanvases);
  }
}

function setGuideSize(size) {
  if (!state.current || state.hasMarks || !hasStrokeGuide() || !["comfort", "compact"].includes(size) || state.guideSize === size) return;
  state.guideSize = size;
  document.querySelectorAll("[data-guide-size]").forEach((button) => {
    const isSelected = button.dataset.guideSize === size;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  syncCanvasFrameState();
  if (state.stage === "writing") requestAnimationFrame(setupWritingCanvases);
}

function syncGuideSizeControls() {
  document.querySelectorAll("[data-guide-size]").forEach((button) => {
    button.disabled = state.hasMarks;
    if (state.hasMarks) button.title = "Clear the page to change the guide size";
    else button.removeAttribute("title");
  });
}

function clearCharacterPause() {
  if (state.characterPauseTimer !== null) window.clearTimeout(state.characterPauseTimer);
  state.characterPauseTimer = null;
}

function clearLineResponse() {
  if (state.lineResponseTimer !== null) window.clearTimeout(state.lineResponseTimer);
  state.lineResponseTimer = null;
  state.lineResponsePlayed = false;
  state.lineResponsePreserved = false;
  els.characterFeedbackLayer.classList.remove("is-line-breathing", "is-line-preserved");
  els.canvasFrame.classList.remove("is-line-preserved");
}

function scheduleLineResponse(total) {
  if (state.lineResponsePlayed || total < 1 || state.completedCharacters.size !== total) return;
  const motionIsReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  state.lineResponsePlayed = true;
  state.lineResponseTimer = window.setTimeout(() => {
    state.lineResponseTimer = null;
    if (state.stage !== "writing" || state.completedCharacters.size !== total) return;
    const layer = els.characterFeedbackLayer;
    state.lineResponsePreserved = false;
    layer.classList.remove("is-line-breathing", "is-line-preserved");
    void layer.offsetWidth;
    layer.classList.add("is-line-breathing");
    const narrative = narrativeFor();
    els.inkStatus.textContent = `${narrative.sender}’s line is ready for ${narrative.receiver}.`;
    state.lineResponseTimer = window.setTimeout(() => {
      layer.classList.remove("is-line-breathing");
      layer.classList.add("is-line-preserved");
      state.lineResponsePreserved = true;
      els.pauseAction.textContent = "Send it onward";
      syncCanvasFrameState();
      state.lineResponseTimer = null;
    }, motionIsReduced ? 0 : 5800);
  }, motionIsReduced ? 0 : 560);
}

function characterTargetDimensions(layout) {
  const isPhrase = layout.positions.length > 1;
  return {
    width: Math.max(72, layout.fontSize * 0.56),
    height: isPhrase ? Math.min(layout.step * 0.86, layout.fontSize * 0.96) : layout.fontSize * 0.96
  };
}

function expectedCharacterIndex() {
  const total = totalForms();
  for (let index = 0; index < total; index += 1) {
    if (!state.completedCharacters.has(index)) return index;
  }
  return null;
}

function syncCharacterTargets() {
  const expected = expectedCharacterIndex();
  els.characterFeedbackLayer.querySelectorAll(".character-response").forEach((response) => {
    const index = Number(response.dataset.characterIndex);
    const isCurrent = index === expected;
    response.classList.toggle("is-current", isCurrent);
    const status = response.querySelector(".character-response-status");
    if (!status) return;
    const number = String(index + 1).padStart(2, "0");
    status.textContent = isCurrent ? `${number} · ${index === 0 ? "start here" : "next"}` : number;
  });
}

function remindCharacterTarget(index) {
  const response = els.characterFeedbackLayer.querySelector(`[data-character-index="${index}"]`);
  if (!response) return;
  response.classList.remove("is-reminding");
  void response.offsetWidth;
  response.classList.add("is-reminding");
  window.setTimeout(() => response.classList.remove("is-reminding"), 1000);
}

function characterIndexAtPoint(point) {
  if (!state.current || !hasStrokeGuide()) return null;
  const layout = guideLayout(els.writing.clientWidth, els.writing.clientHeight);
  if (!layout.positions.length) return null;
  const target = characterTargetDimensions(layout);
  let matchedIndex = null;
  let closestDistance = Infinity;
  layout.positions.forEach(({ y }, index) => {
    const normalizedX = Math.abs(point.x - els.writing.clientWidth / 2) / (target.width / 2);
    const normalizedY = Math.abs(point.y - y) / (target.height / 2);
    const insideTarget = normalizedX ** 4 + normalizedY ** 4 <= 1;
    const distance = normalizedX ** 2 + normalizedY ** 2;
    if (insideTarget && distance < closestDistance) {
      closestDistance = distance;
      matchedIndex = index;
    }
  });
  return matchedIndex;
}

function characterIsReady(index) {
  if (index === null || index < 0) return false;
  const layout = guideLayout(els.writing.clientWidth, els.writing.clientHeight);
  const distance = state.characterInkDistances[index] || 0;
  const strokes = state.characterStrokeCounts[index] || 0;
  const bounds = state.characterInkBounds[index];
  const verticalSpan = bounds ? bounds.maxY - bounds.minY : 0;
  return distance >= Math.max(48, layout.fontSize * 0.65)
    && verticalSpan >= Math.max(32, layout.fontSize * 0.38)
    && (strokes >= 2 || distance >= layout.fontSize * 1.15);
}

function settleCharacter(index) {
  if (index !== expectedCharacterIndex() || !characterIsReady(index) || state.completedCharacters.has(index)) return;
  state.completedCharacters.add(index);
  const response = els.characterFeedbackLayer.querySelector(`[data-character-index="${index}"]`);
  if (response) {
    response.classList.add("is-settled");
    response.classList.remove("is-responding");
    void response.offsetWidth;
    response.classList.add("is-responding");
    window.setTimeout(() => response.classList.remove("is-responding"), 2400);
  }
  const total = guideLayout(els.writing.clientWidth, els.writing.clientHeight).positions.length;
  els.inkStatus.textContent = index === total - 1
    ? `${total} of ${total} · the line is ready.`
    : `${index + 1} of ${total} · continue downward.`;
  state.activeCharacterIndex = null;
  syncCharacterTargets();
  revealWritingNarrative();
  syncCompletionControls();
  scheduleLineResponse(total);
}

function beginCharacterStroke(point) {
  clearCharacterPause();
  const index = characterIndexAtPoint(point);
  if (state.activeCharacterIndex !== null && state.activeCharacterIndex !== index) {
    settleCharacter(state.activeCharacterIndex);
  }
  const expected = expectedCharacterIndex();
  if (expected === null) {
    state.activeCharacterIndex = null;
    return;
  }
  if (index === null) {
    state.activeCharacterIndex = null;
    els.inkStatus.textContent = `Return to the pale area for form ${expected + 1}.`;
    remindCharacterTarget(expected);
    return;
  }
  if (index !== expected) {
    state.activeCharacterIndex = null;
    els.inkStatus.textContent = expected === 0
      ? "Begin with the first form at the top."
      : `Continue with form ${expected + 1} below.`;
    remindCharacterTarget(expected);
    return;
  }
  state.activeCharacterIndex = index;
  state.characterStrokeCounts[index] = (state.characterStrokeCounts[index] || 0) + 1;
}

function trackCharacterInk(from, to, distance) {
  if (!state.current || !hasStrokeGuide()) return;
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const index = characterIndexAtPoint(midpoint);
  const endIndex = characterIndexAtPoint(to);
  if (index === null || index !== endIndex || index !== state.activeCharacterIndex || index !== expectedCharacterIndex()) return;
  const layout = guideLayout(els.writing.clientWidth, els.writing.clientHeight);
  const countedDistance = Math.min(distance, Math.max(10, layout.fontSize * 0.12));
  state.characterInkDistances[index] = (state.characterInkDistances[index] || 0) + countedDistance;
  const bounds = state.characterInkBounds[index] || { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  bounds.minX = Math.min(bounds.minX, midpoint.x, to.x);
  bounds.maxX = Math.max(bounds.maxX, midpoint.x, to.x);
  bounds.minY = Math.min(bounds.minY, midpoint.y, to.y);
  bounds.maxY = Math.max(bounds.maxY, midpoint.y, to.y);
  state.characterInkBounds[index] = bounds;
}

function scheduleCharacterResponse() {
  clearCharacterPause();
  const index = state.activeCharacterIndex;
  if (!characterIsReady(index) || state.completedCharacters.has(index)) return;
  state.characterPauseTimer = window.setTimeout(() => {
    state.characterPauseTimer = null;
    if (!state.drawing && state.stage === "writing") settleCharacter(index);
  }, 900);
}

function pointFromEvent(event, rect, previousPoint = null) {
  const x = clamp(event.clientX - rect.left, 0, rect.width);
  const y = clamp(event.clientY - rect.top, 0, rect.height);
  const time = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
  const distance = previousPoint ? Math.hypot(x - previousPoint.x, y - previousPoint.y) : 0;
  const elapsed = previousPoint ? Math.max(1, time - previousPoint.time) : 16;
  const speed = previousPoint ? clamp(distance / elapsed, 0, 4) : 0.55;
  const strokeDistance = state.strokeDistance + distance;
  const modeled = modelBrushSample({
    pointerType: event.pointerType,
    pressure: event.pressure,
    speed,
    previousForce: previousPoint?.force ?? null,
    strokeDistance,
    surface: state.surface
  });
  const tiltX = Number.isFinite(event.tiltX) ? event.tiltX : 0;
  const tiltY = Number.isFinite(event.tiltY) ? event.tiltY : 0;
  const tilt = clamp(Math.hypot(tiltX, tiltY) / 90, 0, 1);
  const tiltAngle = tilt > 0.01 ? Math.atan2(tiltY, tiltX) : previousPoint?.tiltAngle || 0;

  return {
    x,
    y,
    time,
    speed,
    strokeDistance,
    tilt,
    tiltAngle,
    pointerType: event.pointerType || "mouse",
    ...modeled
  };
}

function recordedPoint(point, bounds) {
  const scale = Math.max(1, Math.min(bounds.width, bounds.height));
  return {
    ...point,
    x: (point.x - bounds.x) / bounds.width,
    y: (point.y - bounds.y) / bounds.height,
    width: point.width / scale,
    time: 0
  };
}

function restoredPoint(point, bounds) {
  const scale = Math.max(1, Math.min(bounds.width, bounds.height));
  return {
    ...point,
    x: bounds.x + point.x * bounds.width,
    y: bounds.y + point.y * bounds.height,
    width: Math.max(0.32, point.width * scale)
  };
}

function mixAngles(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function fillEllipse(ctx, radiusX, radiusY, alpha, color = brushPalette.ink) {
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(0.08, radiusX), Math.max(0.08, radiusY), 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function paintBrushStamp(ctx, point, direction, surface, seed, index) {
  const material = brushSurface(surface);
  const width = Math.max(0.32, point.width);
  const travelAngle = Math.atan2(direction.y, direction.x);
  const uprightNibAngle = travelAngle + Math.PI / 2;
  const tiltInfluence = clamp((point.tilt - 0.06) / 0.62, 0, 0.76);
  const nibAngle = mixAngles(uprightNibAngle, point.tiltAngle, tiltInfluence);
  const aspect = clamp(0.9 - point.tilt * 0.38 - material.fibre * 0.035, 0.46, 0.9);
  const noise = seededNoise(seed, index, 0);
  const dryness = clamp((1 - point.ink) * 1.28 + point.speed * 0.042 + material.fibre * 0.07, 0, 0.72);

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(nibAngle);

  fillEllipse(
    ctx,
    width * (0.57 + material.absorption * 0.055),
    width * (aspect + 0.08) * (0.57 + material.absorption * 0.045),
    (0.025 + material.absorption * 0.028) * point.ink * (0.86 + noise * 0.22),
    brushPalette.edge
  );

  const bodyAlpha = (0.14 + point.ink * 0.105) * (1 - dryness * 0.24) * (0.88 + noise * 0.2);
  fillEllipse(ctx, width * 0.5, width * aspect * 0.5, bodyAlpha);
  fillEllipse(ctx, width * 0.34, width * aspect * 0.43, 0.065 + point.ink * 0.09);

  const fibreCount = 2 + Math.round(material.fibre * 3);
  for (let fibre = 0; fibre < fibreCount; fibre += 1) {
    const offsetNoise = seededNoise(seed, index, fibre + 1);
    const widthNoise = seededNoise(seed, index, fibre + 9);
    const offset = (offsetNoise * 2 - 1) * width * 0.45;
    const fibreWidth = Math.max(0.1, width * (0.014 + widthNoise * 0.024));
    const fibreLength = width * aspect * (0.25 + widthNoise * 0.2);
    ctx.save();
    ctx.translate(offset, 0);
    fillEllipse(
      ctx,
      fibreWidth,
      fibreLength,
      (0.026 + dryness * 0.12) * material.fibre * point.ink,
      brushPalette.ink
    );
    ctx.restore();
  }

  ctx.restore();
}

function paintBrushDab(ctx, point, direction, surface, seed, startIndex = 0) {
  const scales = [0.34, 0.62, 0.84, 1];
  scales.forEach((scale, offset) => {
    paintBrushStamp(ctx, { ...point, width: point.width * scale }, direction, surface, seed, startIndex + offset);
  });
  return startIndex + scales.length;
}

function paintBrushSegment(ctx, from, to, surface, seed, startIndex, fallbackDirection) {
  const samples = interpolateStrokeSegment(from, to);
  let cursor = from;
  let direction = fallbackDirection;
  let index = startIndex;

  samples.forEach((sample) => {
    const distance = Math.hypot(sample.x - cursor.x, sample.y - cursor.y);
    if (distance > 0.001) {
      direction = { x: (sample.x - cursor.x) / distance, y: (sample.y - cursor.y) / distance };
    }
    paintBrushStamp(ctx, sample, direction, surface, seed, index);
    cursor = sample;
    index += 1;
  });

  return { direction, index };
}

function renderRecordedStrokes(ctx, bounds, surface) {
  state.strokes.forEach((stroke) => {
    const points = stroke.points.map((point) => restoredPoint(point, bounds));
    if (!points.length) return;
    let direction = { x: 0, y: 1 };
    let index = paintBrushDab(ctx, points[0], direction, surface, stroke.seed, 0);
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      const result = paintBrushSegment(
        ctx,
        points[pointIndex - 1],
        points[pointIndex],
        surface,
        stroke.seed,
        index,
        direction
      );
      direction = result.direction;
      index = result.index;
    }
  });
}

function coalescedEventsFor(event) {
  try {
    const samples = event.getCoalescedEvents?.();
    return samples?.length ? samples : [event];
  } catch {
    return [event];
  }
}

function updateBrushReadout(point = null) {
  const force = point?.force ?? 0.42;
  els.brushReadout.style.setProperty("--brush-force", force.toFixed(3));
  els.brushReadout.style.setProperty("--brush-size", `${(4 + force * 13).toFixed(2)}px`);
  els.brushReadout.style.setProperty("--brush-blur", `${(1 + force * 2).toFixed(2)}px`);
  if (!point) {
    els.brushInput.textContent = "pressure · pace";
    return;
  }
  els.brushInput.textContent = point.usesHardwarePressure
    ? point.pointerType === "touch" ? "touch pressure" : "stylus pressure"
    : point.pointerType === "mouse"
      ? "pace sensing"
      : point.pointerType === "pen" ? "stylus · pace" : "touch · pace";
}

function updateBrushCursor(point = null) {
  const shouldShow = Boolean(point && point.pointerType !== "touch");
  state.cursorActive = shouldShow;
  els.canvasFrame.classList.toggle("is-cursor-active", shouldShow);
  if (!shouldShow) return;
  els.brushCursor.style.left = `${point.x}px`;
  els.brushCursor.style.top = `${point.y}px`;
  els.brushCursor.style.setProperty("--cursor-size", `${Math.max(5, point.width).toFixed(2)}px`);
}

function previewBrushCursor(event) {
  if (state.stage !== "writing" || state.drawing || event.pointerType === "touch") {
    if (!state.drawing) updateBrushCursor();
    return;
  }
  const rect = els.writing.getBoundingClientRect();
  updateBrushCursor(pointFromEvent(event, rect));
}

function drawEventSamples(event) {
  const rect = els.writing.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) state.writingAspectRatio = rect.width / rect.height;
  const bounds = { x: 0, y: 0, width: rect.width, height: rect.height };
  const ctx = els.writing.getContext("2d");

  coalescedEventsFor(event).forEach((sampleEvent) => {
    const nextPoint = pointFromEvent(sampleEvent, rect, state.lastPoint);
    const distance = state.lastPoint
      ? Math.hypot(nextPoint.x - state.lastPoint.x, nextPoint.y - state.lastPoint.y)
      : 0;
    if (!state.lastPoint || distance < 0.01) return;
    updateBrushReadout(nextPoint);
    updateBrushCursor(nextPoint);
    state.strokeDistance = nextPoint.strokeDistance;
    state.writingDistance += distance;
    trackCharacterInk(state.lastPoint, nextPoint, distance);
    const result = paintBrushSegment(
      ctx,
      state.lastPoint,
      nextPoint,
      state.surface,
      state.activeStroke.seed,
      state.brushSampleIndex,
      state.lastDirection
    );
    state.lastDirection = result.direction;
    state.brushSampleIndex = result.index;
    state.activeStroke.points.push(recordedPoint(nextPoint, bounds));
    state.lastPoint = nextPoint;
    revealWritingNarrative();
  });
}

function startDrawing(event) {
  if (
    state.stage !== "writing" ||
    state.drawing ||
    event.isPrimary === false ||
    (event.pointerType === "mouse" && event.button !== 0)
  ) return;
  event.preventDefault();
  const rect = els.writing.getBoundingClientRect();
  const bounds = { x: 0, y: 0, width: rect.width, height: rect.height };
  const point = pointFromEvent(event, rect);
  const seed = (state.strokeCounter + 1) * 7919;
  state.strokeCounter += 1;
  state.drawing = true;
  state.activePointerId = event.pointerId;
  state.strokeDistance = 0;
  state.brushSampleIndex = 0;
  state.lastDirection = { x: 0, y: 1 };
  state.lastPoint = point;
  state.activeStroke = { seed, points: [recordedPoint(point, bounds)] };
  state.strokes.push(state.activeStroke);
  beginCharacterStroke(point);
  state.brushSampleIndex = paintBrushDab(
    els.writing.getContext("2d"),
    point,
    state.lastDirection,
    state.surface,
    seed
  );
  state.hasMarks = true;
  syncGuideSizeControls();
  syncCompletionControls();
  syncCanvasFrameState();
  updateBrushReadout(point);
  updateBrushCursor(point);
  els.writing.setPointerCapture?.(event.pointerId);
  revealWritingNarrative();
  els.inkStatus.textContent = hasStrokeGuide()
    ? point.usesHardwarePressure
      ? "Your pressure deepens the ink."
      : "A slower movement leaves a fuller stroke."
    : point.usesHardwarePressure
      ? "Your pressure deepens the ink."
      : "A slower movement leaves a fuller stroke.";
}

function continueDrawing(event) {
  if (!state.drawing || event.pointerId !== state.activePointerId) return;
  event.preventDefault();
  drawEventSamples(event);
}

function handlePointerMove(event) {
  if (state.drawing) continueDrawing(event);
  else previewBrushCursor(event);
}

function finishActiveStroke({ taper = true, releaseCapture = true } = {}) {
  if (!state.drawing) return;
  if (taper && state.lastPoint && state.activeStroke) {
    const rect = els.writing.getBoundingClientRect();
    const bounds = { x: 0, y: 0, width: rect.width, height: rect.height };
    const ctx = els.writing.getContext("2d");
    const taperPoints = createTaperSamples(
      state.lastPoint,
      state.lastDirection,
      state.lastPoint.usesHardwarePressure ? 5 : 7
    );
    taperPoints.forEach((point) => {
      const result = paintBrushSegment(
        ctx,
        state.lastPoint,
        point,
        state.surface,
        state.activeStroke.seed,
        state.brushSampleIndex,
        state.lastDirection
      );
      state.lastDirection = result.direction;
      state.brushSampleIndex = result.index;
      state.activeStroke.points.push(recordedPoint(point, bounds));
      state.lastPoint = point;
    });
  }

  const pointerId = state.activePointerId;
  state.drawing = false;
  state.activePointerId = null;
  state.activeStroke = null;
  state.lastPoint = null;
  state.strokeDistance = 0;
  syncCanvasFrameState();
  if (releaseCapture && pointerId !== null && els.writing.hasPointerCapture?.(pointerId)) {
    els.writing.releasePointerCapture(pointerId);
  }
}

function stopDrawing(event) {
  if (!state.drawing || event.pointerId !== state.activePointerId) return;
  event.preventDefault();
  drawEventSamples(event);
  finishActiveStroke();
  scheduleCharacterResponse();
}

function cancelDrawing(event) {
  if (!state.drawing || event.pointerId !== state.activePointerId) return;
  finishActiveStroke({ taper: false, releaseCapture: false });
  updateBrushCursor();
}

function clearWriting({ resetInputMode = false } = {}) {
  const pointerId = state.activePointerId;
  if (resetInputMode) state.inputMode = "draw";
  state.hasMarks = false;
  state.partialTrace = false;
  state.sending = false;
  state.lastKeyboardAttendTime = null;
  state.drawing = false;
  state.lastPoint = null;
  state.lastDirection = { x: 0, y: 1 };
  state.activePointerId = null;
  state.activeStroke = null;
  state.strokes = [];
  state.strokeCounter = 0;
  state.strokeDistance = 0;
  state.brushSampleIndex = 0;
  state.activeCharacterIndex = null;
  state.characterInkDistances = [];
  state.characterStrokeCounts = [];
  state.characterInkBounds = [];
  state.completedCharacters = new Set();
  clearCharacterPause();
  clearLineResponse();
  state.writingDistance = 0;
  state.revealedWritingLines = 0;
  syncGuideSizeControls();
  els.inkStatus.textContent = state.current && !hasStrokeGuide()
    ? "The page is open."
    : "Begin with the first form at the top.";
  const ctx = els.writing.getContext("2d");
  ctx?.clearRect(0, 0, els.writing.clientWidth, els.writing.clientHeight);
  if (pointerId !== null && els.writing.hasPointerCapture?.(pointerId)) els.writing.releasePointerCapture(pointerId);
  updateBrushReadout();
  syncCanvasFrameState();
  setupCharacterFeedback();
  els.guide.classList.remove("is-faded");
  els.writingNarrativeLines.querySelectorAll(".writing-narrative-line").forEach((line) => line.classList.remove("is-revealed", "is-current"));
  els.writingNarrativeStatus.textContent = "";
  els.reflectionNotice.value = "";
  els.reflectionUnknown.value = "";
  applyInputMode();
  syncCompletionControls();
}

function fittedRecordingBounds(targetWidth, targetHeight) {
  const aspect = Number.isFinite(state.writingAspectRatio) && state.writingAspectRatio > 0
    ? state.writingAspectRatio
    : 1;
  let width = targetWidth;
  let height = width / aspect;
  if (height > targetHeight) {
    height = targetHeight;
    width = height * aspect;
  }
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height
  };
}

function copyWritingTo(canvas) {
  const ctx = canvas.getContext("2d");
  const targetWidth = canvas.clientWidth;
  const targetHeight = canvas.clientHeight;
  if (!ctx || targetWidth <= 0 || targetHeight <= 0) return;
  renderRecordedStrokes(ctx, fittedRecordingBounds(targetWidth, targetHeight), state.surface);
}

function drawAfterMark() {
  const rect = els.after.getBoundingClientRect();
  const ctx = sizeCanvas(els.after, rect.width, rect.height);
  ctx.clearRect(0, 0, rect.width, rect.height);
  copyWritingTo(els.after);
}

function paintSurface(ctx, width, height, surface) {
  if (surface === "cloth") {
    ctx.fillStyle = "#dfd0b9";
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += 9) {
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let x = 0; x < width; x += 9) {
      ctx.strokeStyle = "rgba(98,72,48,.16)";
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    return;
  }
  if (surface === "fan") {
    ctx.fillStyle = "#f4e6ce";
    ctx.fillRect(0, 0, width, height);
    const centreX = width / 2;
    const centreY = height * 1.18;
    for (let angle = Math.PI * 1.15; angle < Math.PI * 1.85; angle += Math.PI / 23) {
      ctx.strokeStyle = "rgba(111,78,45,.24)";
      ctx.beginPath();
      ctx.moveTo(centreX, centreY);
      ctx.lineTo(centreX + Math.cos(angle) * height * 1.9, centreY + Math.sin(angle) * height * 1.9);
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = "#f3ecdd";
  ctx.fillRect(0, 0, width, height);
  for (let y = 8; y < height; y += 17) {
    ctx.strokeStyle = "rgba(93,69,41,.04)";
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y - 6); ctx.stroke();
  }
}

function drawArchiveCard() {
  const rect = els.card.getBoundingClientRect();
  const ctx = sizeCanvas(els.card, rect.width, rect.height);
  paintSurface(ctx, rect.width, rect.height, state.surface);
  ctx.strokeStyle = currentAccent();
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 1;
  ctx.strokeRect(14, 14, rect.width - 28, rect.height - 28);
  ctx.globalAlpha = 1;
  copyWritingTo(els.card);
}

function archiveImage() {
  const narrative = narrativeFor();
  const cardWidth = 1200;
  const cardHeight = 1000;
  const image = document.createElement("canvas");
  image.width = cardWidth;
  image.height = cardHeight;
  const ctx = image.getContext("2d");
  ctx.fillStyle = "#fbf8f0";
  ctx.fillRect(0, 0, cardWidth, cardHeight);
  ctx.strokeStyle = "#c2b5a0";
  ctx.strokeRect(42, 42, cardWidth - 84, cardHeight - 84);
  ctx.fillStyle = "#645d52";
  ctx.font = "22px Arial";
  ctx.letterSpacing = "3px";
  ctx.fillText("HELD IN INK", 70, 84);
  ctx.textAlign = "right";
  ctx.font = "42px Georgia";
  ctx.fillText("女书", cardWidth - 70, 87);
  ctx.textAlign = "left";
  ctx.save();
  ctx.translate(70, 120);
  paintSurface(ctx, cardWidth - 140, 570, state.surface);
  ctx.restore();
  ctx.strokeStyle = "#d8cdbb";
  ctx.strokeRect(70, 120, cardWidth - 140, 570);
  const recordBounds = fittedRecordingBounds(cardWidth - 260, 470);
  renderRecordedStrokes(ctx, {
    x: 130 + recordBounds.x,
    y: 170 + recordBounds.y,
    width: recordBounds.width,
    height: recordBounds.height
  }, state.surface);
  ctx.fillStyle = "#302d28";
  ctx.font = "43px Georgia";
  ctx.fillText(`${narrative.sender} → ${narrative.receiver}`, 70, 755);
  ctx.fillStyle = currentAccent();
  ctx.font = "21px Georgia";
  ctx.fillText(`${strokeFor().transcription} · ${surfaceLabels[state.surface]}`, 70, 794);
  ctx.fillStyle = "#645d52";
  ctx.font = "22px Georgia";
  wrapText(ctx, narrative.archiveNote, 70, 830, cardWidth - 140, 29);
  ctx.fillStyle = currentAccent();
  ctx.font = "16px Arial";
  ctx.fillText(state.inputMode === "keyboard"
    ? "KEYBOARD-PACED ATTENTION TRACE · PERSONAL RECORD"
    : state.partialTrace
      ? "PARTIAL HANDWRITING TRACE · PERSONAL RECORD"
      : "HANDWRITING TRACE · PERSONAL RECORD", 70, 944);
  ctx.fillStyle = "#645d52";
  ctx.font = "14px Arial";
  const archiveStatus = strokeFor().status === "verified-digital-reconstruction"
    ? "HISTORICAL FICTION · DOCUMENTED LINE"
    : strokeFor().status === "dictionary-derived-reconstruction"
      ? "HISTORICAL FICTION · PROVISIONAL FORMS"
      : "HISTORICAL FICTION · OPEN RESPONSE";
  ctx.fillText(archiveStatus, 70, 971);
  const link = document.createElement("a");
  link.download = `held-in-ink-${state.current.id}.png`;
  link.href = image.toDataURL("image/png");
  link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  let lineY = y;
  text.split(" ").forEach((word) => {
    const next = `${line}${word} `;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, lineY);
      line = `${word} `;
      lineY += lineHeight;
    } else line = next;
  });
  ctx.fillText(line.trim(), x, lineY);
}

function showPicker() {
  state.returnFocus = document.activeElement;
  const options = state.prompts.map((prompt, index) => {
    const stroke = strokeFor(prompt);
    const verified = hasStrokeGuide(stroke);
    const button = document.createElement("button");
    button.className = `prompt-option prompt-option-${prompt.scene.theme}`;
    button.type = "button";
    button.dataset.promptId = prompt.id;

    const symbol = document.createElement("span");
    symbol.className = `option-symbol ${verified ? "nushu-glyph" : "is-transcription"}`;
    symbol.textContent = verified ? stroke.symbol : stroke.transcription;
    if (!verified) symbol.setAttribute("lang", "zh-Hans");
    const number = document.createElement("span");
    number.className = "option-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("span");
    title.className = "option-title";
    title.textContent = prompt.scene.homeTitle;
    const place = document.createElement("span");
    place.className = "option-place";
    place.textContent = prompt.scene.evidenceLabel;
    button.append(symbol, number, title, place);
    return button;
  });
  els.promptList.replaceChildren(...options);
  els.promptPicker.hidden = false;
  document.body.style.overflow = "hidden";
  els.promptPicker.querySelector("[data-action='close-picker']")?.focus();
}

function hidePicker() {
  els.promptPicker.hidden = true;
  document.body.style.overflow = "";
  state.returnFocus?.focus?.();
  state.returnFocus = null;
}

function pauseWithMark({ allowPartial = false } = {}) {
  if (!state.hasMarks) {
    els.inkStatus.textContent = "Begin the first form before sending the line.";
    return;
  }
  settleCharacter(state.activeCharacterIndex);
  const complete = lineIsComplete();
  if (!complete && !allowPartial) {
    const next = state.completedCharacters.size + 1;
    els.inkStatus.textContent = `The line is not complete yet. Continue with form ${next}, or choose the partial-trace path.`;
    remindCharacterTarget(Math.min(next - 1, Math.max(0, totalForms() - 1)));
    return;
  }
  clearCharacterPause();
  clearLineResponse();
  captureWritingGeometry();
  state.partialTrace = !complete;
  state.sending = true;
  applyInputMode();
  els.guide.classList.add("is-faded");
  syncCanvasFrameState();
  els.inkStatus.textContent = complete
    ? "The guide recedes. Stay with your trace before it arrives."
    : "The guide recedes. This partial trace will remain named as partial.";
  const motionIsReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(() => setStage("after"), motionIsReduced ? 0 : 1400);
}

function reviewContext() {
  setStage("entering");
  els.characterContext.open = true;
  requestAnimationFrame(() => els.characterContext.querySelector("summary")?.focus({ preventScroll: true }));
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "home") {
    event.preventDefault();
    clearWriting({ resetInputMode: true });
    setStage("home");
  }
  if (action === "begin") setStage("writing");
  if (action === "change") showPicker();
  if (action === "close-picker") hidePicker();
  if (action === "clear") clearWriting();
  if (action === "toggle-input-mode") toggleInputMode();
  if (action === "attend-form") attendToNextForm();
  if (action === "pause") pauseWithMark();
  if (action === "pause-partial") pauseWithMark({ allowPartial: true });
  if (action === "archive") setStage("archive");
  if (action === "review-context") reviewContext();
  if (action === "return-writing") { clearWriting(); setStage("writing"); }
  if (action === "download") archiveImage();
  if (action === "start-over") { clearWriting({ resetInputMode: true }); setStage("home"); }
  if (event.target.closest("[data-open-about]")) els.about.showModal();
  if (event.target.closest("[data-close-about]")) els.about.close();
  const surfaceButton = event.target.closest("[data-surface]");
  if (surfaceButton) setSurface(surfaceButton.dataset.surface);
  const guideSizeButton = event.target.closest("[data-guide-size]");
  if (guideSizeButton) setGuideSize(guideSizeButton.dataset.guideSize);
  const contextButton = event.target.closest("[data-context-id]");
  if (contextButton) {
    const prompt = state.prompts.find((item) => item.id === contextButton.dataset.contextId);
    if (prompt) {
      selectPrompt(prompt);
      setStage("entering");
    }
  }
  const promptButton = event.target.closest("[data-prompt-id]");
  if (promptButton) {
    selectPrompt(state.prompts.find((prompt) => prompt.id === promptButton.dataset.promptId));
    hidePicker();
    setStage("entering");
  }
});

els.writing.addEventListener("pointerdown", startDrawing);
els.writing.addEventListener("pointermove", handlePointerMove);
els.writing.addEventListener("pointerenter", previewBrushCursor);
els.writing.addEventListener("pointerleave", () => { if (!state.drawing) updateBrushCursor(); });
els.writing.addEventListener("pointerup", stopDrawing);
els.writing.addEventListener("pointercancel", cancelDrawing);
els.writing.addEventListener("lostpointercapture", cancelDrawing);
window.addEventListener("resize", () => {
  if (state.stage !== "writing") return;
  finishActiveStroke({ taper: false, releaseCapture: false });
  updateBrushCursor();
  setupWritingCanvases();
});

loadPrompts().catch((error) => {
  const message = document.createElement("p");
  message.className = "context-loading";
  message.setAttribute("role", "alert");
  message.textContent = "The four contexts could not be loaded. Open this prototype through its local web server and try again.";
  els.homeContextList.replaceChildren(message);
  console.error(error);
});
