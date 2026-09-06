const state = {
  prompts: [],
  current: null,
  drawing: false,
  hasMarks: false,
  lastPoint: null,
  writingDistance: 0,
  revealedWritingLines: 0,
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
  storyTitle: document.querySelector("#story-title"),
  storyBody: document.querySelector("#story-body"),
  storyPlace: document.querySelector("#story-place"),
  storyType: document.querySelector("#story-type"),
  referenceSymbol: document.querySelector("#reference-symbol"),
  storyReference: document.querySelector("#story-reference"),
  referenceNote: document.querySelector("#reference-note"),
  previewSymbol: document.querySelector("#preview-symbol"),
  sceneSequence: document.querySelector("#scene-sequence"),
  guideLabel: document.querySelector("#guide-label"),
  beginAction: document.querySelector("#begin-action"),
  characterContext: document.querySelector("#character-context"),
  contextSummaryStatus: document.querySelector("#context-summary-status"),
  contextNote: document.querySelector("#context-note"),
  contextSources: document.querySelector("#context-sources"),
  contextArtefact: document.querySelector("#context-artefact"),
  contextAudio: document.querySelector("#context-audio"),
  writingTitle: document.querySelector("#writing-title"),
  writingReference: document.querySelector("#writing-reference"),
  writingInstruction: document.querySelector("#writing-instruction"),
  writingNarrative: document.querySelector("#writing-narrative"),
  writingNarrativeLines: document.querySelector("#writing-narrative-lines"),
  writingNarrativeStatus: document.querySelector("#writing-narrative-status"),
  afterQuote: document.querySelector("#after-quote"),
  cardForm: document.querySelector("#card-form"),
  cardReference: document.querySelector("#card-reference"),
  cardBackground: document.querySelector("#card-background"),
  promptPicker: document.querySelector("#prompt-picker"),
  promptList: document.querySelector("#prompt-list"),
  guide: document.querySelector("#guide-canvas"),
  writing: document.querySelector("#writing-canvas"),
  after: document.querySelector("#after-canvas"),
  card: document.querySelector("#card-canvas"),
  canvasFrame: document.querySelector("#canvas-frame"),
  inkStatus: document.querySelector("#ink-status"),
  about: document.querySelector("#about-dialog")
};

const stageLabels = {
  home: ["00", "Choose"],
  entering: ["01", "Entering"],
  writing: ["02", "Writing"],
  after: ["03", "After"],
  archive: ["04", "Archive"]
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

function currentAccent() {
  return sceneAccents[state.current?.scene?.theme] || sceneAccents.message;
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
    const requiredNarrativeText = [narrative?.title, narrative?.place, narrative?.storyType, narrative?.after, narrative?.archiveNote];
    const verified = stroke?.status === "verified-digital-reconstruction";
    const pendingIsClean = stroke?.status === "pending-verification" && stroke.symbol === null && stroke.phrase === null && stroke.phraseReading === null;
    if (
      !hasText(prompt.id) || ids.has(prompt.id) || themes.has(scene?.theme) ||
      !requiredSceneText.every(hasText) || !Array.isArray(scene?.sequence) || scene.sequence.length !== 3 || !scene.sequence.every(hasText) ||
      !requiredStrokeText.every(hasText) || !requiredNarrativeText.every(hasText) ||
      (!verified && !pendingIsClean) ||
      (verified && ![stroke.symbol, stroke.phrase, stroke.phraseReading].every(hasText)) ||
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

function isVerifiedStroke(stroke = strokeFor()) {
  return stroke.status === "verified-digital-reconstruction";
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
  const sourceCount = `${citableSourceCount} ${citableSourceCount === 1 ? "source" : "sources"}`;
  const withheldSourceCount = sources.length - citableSourceCount;
  const mediaStatus = [
    artefactIsDisplayable(safeContext.artefact) ? "artefact attached" : safeContext.artefact ? "artefact withheld" : "no artefact",
    audioIsPlayable(safeContext.audio) ? "audio attached" : safeContext.audio ? "audio withheld" : "no audio"
  ].join(" · ");
  const withheldSources = withheldSourceCount
    ? ` · ${withheldSourceCount} ${withheldSourceCount === 1 ? "source" : "sources"} withheld`
    : "";
  els.contextSummaryStatus.textContent = `${sourceCount}${withheldSources} · ${mediaStatus}`;
  els.contextNote.textContent = safeContext.note || "A contextual note has not yet been added. No historical account is inferred from the narrative prompt.";
  renderSources(sources);
  renderArtefact(safeContext.artefact);
  renderAudio(safeContext.audio);
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
    const evidence = document.createElement("span");
    evidence.className = "context-choice-evidence";
    evidence.textContent = prompt.scene.evidenceLabel;
    const action = document.createElement("span");
    action.className = "context-choice-action";
    action.textContent = "Enter context →";
    bottom.append(evidence, action);

    button.append(top, title, deck, sequence, bottom);
    return button;
  });
  els.homeContextList.replaceChildren(...choices);
}

function selectPrompt(prompt) {
  stopActiveAudio();
  state.current = prompt;
  const stroke = strokeFor(prompt);
  const narrative = narrativeFor(prompt);
  const verified = isVerifiedStroke(stroke);
  document.body.dataset.scene = prompt.scene.theme;
  state.surface = prompt.scene.defaultSurface;
  els.canvasFrame.className = `canvas-frame surface-${state.surface}${verified ? " is-phrase-guide" : " is-unguided"}`;
  document.querySelectorAll("[data-surface]").forEach((button) => {
    const isSelected = button.dataset.surface === state.surface;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  els.storyTitle.textContent = narrative.title;
  els.storyBody.replaceChildren(...narrative.story.map((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    return paragraph;
  }));
  els.storyPlace.textContent = narrative.place;
  els.storyType.textContent = narrative.storyType;
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
  els.guideLabel.textContent = verified
    ? `${Array.from(stroke.phrase).length} standardized forms · one carried message`
    : stroke.guideLabel;
  els.beginAction.textContent = verified ? "Begin with this message" : "Enter this writing context";
  els.writingTitle.textContent = verified ? "Write the message as one line" : "Make an unguided response";
  els.writingReference.textContent = `${stroke.transcription} · “${stroke.gloss}”`;
  els.writingInstruction.textContent = verified
    ? "Follow the five pale forms from top to bottom. There is no score and no single correct hand."
    : "No letterform guide is shown because this line has not yet been matched to verified Nüshu forms. Your mark will not be presented as Nüshu.";
  els.writing.setAttribute("aria-label", verified
    ? `A canvas for tracing the Nüshu phrase transcribed as ${stroke.transcription}`
    : `An unguided response canvas for the context titled ${narrative.title}; the mark is not labeled as Nüshu`);
  els.afterQuote.textContent = narrative.after;
  els.cardForm.textContent = narrative.title;
  els.cardReference.textContent = `${stroke.transcription} · Surface: ${surfaceLabels[state.surface]}`;
  els.cardBackground.textContent = narrative.archiveNote;
  renderContext(prompt.layers.context);
  setupWritingNarrative();
  clearWriting();
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
  const isPhrase = Boolean(strokeFor().phrase);
  const stepDistance = Math.max(90, Math.min(els.writing.clientWidth, els.writing.clientHeight) * (isPhrase ? 0.9 : 0.28));
  const targetCount = Math.min(lines.length, 1 + Math.floor(state.writingDistance / stepDistance));

  while (state.revealedWritingLines < targetCount) {
    const index = state.revealedWritingLines;
    const line = els.writingNarrativeLines.querySelector(`[data-narrative-line="${index}"]`);
    line?.classList.add("is-revealed");
    els.writingNarrativeStatus.textContent = lines[index];
    state.revealedWritingLines += 1;
  }
}

function setStage(stage, moveFocus = true) {
  const previousStage = state.stage;
  if (stage !== "entering") stopActiveAudio();
  state.stage = stage;
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

  if (stage === "writing") requestAnimationFrame(() => setupWritingCanvases(previousStage === "after"));
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

function setupWritingCanvases(preserveMarks = false) {
  const snapshot = preserveMarks ? document.createElement("canvas") : null;
  if (snapshot) {
    snapshot.width = els.writing.width;
    snapshot.height = els.writing.height;
    snapshot.getContext("2d").drawImage(els.writing, 0, 0);
  }
  const rect = els.canvasFrame.getBoundingClientRect();
  sizeCanvas(els.guide, rect.width, rect.height);
  const writeCtx = sizeCanvas(els.writing, rect.width, rect.height);
  if (snapshot) writeCtx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, rect.width, rect.height);
  drawGuide();
}

function drawGuide() {
  const width = els.guide.clientWidth;
  const height = els.guide.clientHeight;
  const ctx = els.guide.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  if (!isVerifiedStroke()) return;
  ctx.save();
  const forms = Array.from(strokeFor().phrase);
  const isPhrase = forms.length > 1;
  const fontSize = isPhrase
    ? Math.min((height * 0.84 / forms.length) * 0.88, width * 0.3)
    : Math.min(height * 0.76, width * 0.46);
  ctx.font = `400 ${fontSize}px "Noto Traditional Nushu"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(129, 108, 83, 0.055)";
  ctx.strokeStyle = "rgba(130, 113, 93, 0.42)";
  ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0026);
  if (isPhrase) {
    const step = fontSize * 1.08;
    const firstY = height / 2 - ((forms.length - 1) * step) / 2;
    forms.forEach((form, index) => {
      const y = firstY + index * step;
      ctx.fillText(form, width / 2, y);
      ctx.strokeText(form, width / 2, y);
    });
  } else {
    ctx.fillText(forms[0], width / 2, height / 2 + fontSize * 0.02);
    ctx.strokeText(forms[0], width / 2, height / 2 + fontSize * 0.02);
  }
  ctx.restore();
}

function setSurface(surface) {
  if (!(surface in surfaceLabels) || state.surface === surface) return;
  const snapshot = document.createElement("canvas");
  snapshot.width = els.writing.width;
  snapshot.height = els.writing.height;
  snapshot.getContext("2d").drawImage(els.writing, 0, 0);
  state.surface = surface;
  els.canvasFrame.className = `canvas-frame surface-${surface}${isVerifiedStroke() ? " is-phrase-guide" : " is-unguided"}`;
  document.querySelectorAll("[data-surface]").forEach((button) => {
    const isSelected = button.dataset.surface === surface;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  els.cardReference.textContent = `${strokeFor().transcription || strokeFor().reference} · Surface: ${surfaceLabels[state.surface]}`;
  if (state.stage === "writing") {
    requestAnimationFrame(() => {
      const rect = els.canvasFrame.getBoundingClientRect();
      sizeCanvas(els.guide, rect.width, rect.height);
      const writeCtx = sizeCanvas(els.writing, rect.width, rect.height);
      writeCtx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, rect.width, rect.height);
      drawGuide();
    });
  }
}

function pointFromEvent(event) {
  const rect = els.writing.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function drawInkLine(from, to) {
  const ctx = els.writing.getContext("2d");
  ctx.save();
  ctx.strokeStyle = "rgba(45, 39, 31, 0.9)";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.1;
  ctx.shadowColor = "rgba(51, 35, 20, .18)";
  ctx.shadowBlur = 0.8;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function startDrawing(event) {
  if (state.stage !== "writing") return;
  event.preventDefault();
  els.writing.setPointerCapture?.(event.pointerId);
  state.drawing = true;
  state.lastPoint = pointFromEvent(event);
  drawInkLine(state.lastPoint, { x: state.lastPoint.x + 0.01, y: state.lastPoint.y + 0.01 });
  state.hasMarks = true;
  revealWritingNarrative();
  els.inkStatus.textContent = isVerifiedStroke()
    ? "Your trace is here. It does not need to match the guide."
    : "Your response mark is here. It will remain explicitly unguided.";
}

function continueDrawing(event) {
  if (!state.drawing) return;
  event.preventDefault();
  const nextPoint = pointFromEvent(event);
  state.writingDistance += Math.hypot(nextPoint.x - state.lastPoint.x, nextPoint.y - state.lastPoint.y);
  drawInkLine(state.lastPoint, nextPoint);
  state.lastPoint = nextPoint;
  revealWritingNarrative();
}

function stopDrawing(event) {
  if (!state.drawing) return;
  event.preventDefault();
  state.drawing = false;
  state.lastPoint = null;
}

function clearWriting() {
  state.hasMarks = false;
  state.drawing = false;
  state.lastPoint = null;
  state.writingDistance = 0;
  state.revealedWritingLines = 0;
  els.inkStatus.textContent = state.current && !isVerifiedStroke()
    ? "This unguided mark is a response, not a Nüshu transcription."
    : "Your line will remain here.";
  const ctx = els.writing.getContext("2d");
  ctx?.clearRect(0, 0, els.writing.clientWidth, els.writing.clientHeight);
  els.guide.classList.remove("is-faded");
  els.writingNarrativeLines.querySelectorAll(".writing-narrative-line").forEach((line) => line.classList.remove("is-revealed"));
  els.writingNarrativeStatus.textContent = "";
}

function copyWritingTo(canvas) {
  const ctx = canvas.getContext("2d");
  const sourceWidth = els.writing.clientWidth;
  const sourceHeight = els.writing.clientHeight;
  const targetWidth = canvas.clientWidth;
  const targetHeight = canvas.clientHeight;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.save();
  ctx.translate((targetWidth - drawWidth) / 2, (targetHeight - drawHeight) / 2);
  ctx.drawImage(els.writing, 0, 0, els.writing.width, els.writing.height, 0, 0, drawWidth, drawHeight);
  ctx.restore();
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
  const inset = 130;
  const scale = Math.min((cardWidth - 2 * inset) / els.writing.width, 470 / els.writing.height);
  const writeWidth = els.writing.width * scale;
  const writeHeight = els.writing.height * scale;
  ctx.drawImage(els.writing, 0, 0, els.writing.width, els.writing.height, (cardWidth - writeWidth) / 2, 170 + (470 - writeHeight) / 2, writeWidth, writeHeight);
  ctx.fillStyle = "#302d28";
  ctx.font = "43px Georgia";
  ctx.fillText(narrative.title, 70, 755);
  ctx.fillStyle = currentAccent();
  ctx.font = "21px Georgia";
  ctx.fillText(`${strokeFor().transcription || strokeFor().reference} · Surface: ${surfaceLabels[state.surface]}`, 70, 794);
  ctx.fillStyle = "#645d52";
  ctx.font = "22px Georgia";
  wrapText(ctx, narrative.archiveNote, 70, 830, cardWidth - 140, 29);
  ctx.fillStyle = currentAccent();
  ctx.font = "16px Arial";
  ctx.fillText("DESIGN STUDY WITH STATED LIMITS · INTERPRETATION AND RECONSTRUCTION LABELED", 70, 944);
  ctx.fillStyle = "#645d52";
  ctx.font = "14px Arial";
  const sourceHosts = archiveSourceHosts().map((host) => host.toUpperCase()).join(" · ");
  const archiveStatus = isVerifiedStroke()
    ? "FONT-RENDERED UNICODE FORMS"
    : "UNGUIDED RESPONSE · NÜSHU FORMS WITHHELD";
  ctx.fillText(`${archiveStatus} · SOURCES: ${sourceHosts || "RECORDED IN WEB ENTRY"}`, 70, 971);
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

function archiveSourceHosts() {
  const sources = state.current?.layers?.context?.sources || [];
  return [...new Set(sources.flatMap((source) => {
    try {
      const hostname = new URL(source.url).hostname.replace(/^www\./, "");
      return [hostname.endsWith("sinica.edu.tw") ? "sinica.edu.tw" : hostname];
    } catch {
      return [];
    }
  }))];
}

function showPicker() {
  state.returnFocus = document.activeElement;
  const options = state.prompts.map((prompt, index) => {
    const stroke = strokeFor(prompt);
    const verified = isVerifiedStroke(stroke);
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

function pauseWithMark() {
  if (!state.hasMarks) {
    els.inkStatus.textContent = "Place even a small mark before you pause.";
    return;
  }
  els.guide.classList.add("is-faded");
  const motionIsReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(() => setStage("after"), motionIsReduced ? 0 : 900);
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "home") {
    event.preventDefault();
    clearWriting();
    setStage("home");
  }
  if (action === "begin") setStage("writing");
  if (action === "change") showPicker();
  if (action === "close-picker") hidePicker();
  if (action === "clear") clearWriting();
  if (action === "pause") pauseWithMark();
  if (action === "archive") setStage("archive");
  if (action === "return-writing") setStage("writing");
  if (action === "download") archiveImage();
  if (action === "start-over") { clearWriting(); setStage("home"); }
  if (event.target.closest("[data-open-about]")) els.about.showModal();
  if (event.target.closest("[data-close-about]")) els.about.close();
  const surfaceButton = event.target.closest("[data-surface]");
  if (surfaceButton) setSurface(surfaceButton.dataset.surface);
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
els.writing.addEventListener("pointermove", continueDrawing);
els.writing.addEventListener("pointerup", stopDrawing);
els.writing.addEventListener("pointercancel", stopDrawing);
window.addEventListener("resize", () => { if (state.stage === "writing") setupWritingCanvases(true); });

loadPrompts().catch((error) => {
  const message = document.createElement("p");
  message.className = "context-loading";
  message.setAttribute("role", "alert");
  message.textContent = "The four contexts could not be loaded. Open this prototype through its local web server and try again.";
  els.homeContextList.replaceChildren(message);
  console.error(error);
});
