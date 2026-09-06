import { readFile, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function objectAt(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value;
}

function nonBlank(value, path) {
  if (typeof value !== "string" || !value.trim()) fail(path, "must be a non-blank string");
  return value;
}

function allowedKeys(value, allowed, path) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) fail(path, `contains unsupported field(s): ${extras.join(", ")}`);
}

function httpUrl(value, path) {
  nonBlank(value, path);
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Unsupported protocol");
  } catch {
    fail(path, "must be an absolute HTTP(S) URL");
  }
}

async function mediaSource(value, path, projectRoot) {
  nonBlank(value, path);
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol)) return;
    fail(path, "must use HTTP(S) or a local assets/ path");
  } catch (error) {
    if (error.message?.startsWith(path)) throw error;
  }

  const normalized = value.replaceAll("\\", "/");
  if (!normalized.startsWith("assets/") || normalized.includes("?") || normalized.includes("#")) {
    fail(path, "local media must use a plain assets/... path");
  }
  const assetsRoot = resolve(projectRoot, "assets");
  const filePath = resolve(projectRoot, normalized);
  if (!filePath.startsWith(`${assetsRoot}${sep}`)) fail(path, "must stay within assets/");
  try {
    if (!(await stat(filePath)).isFile()) throw new Error("Not a file");
  } catch {
    fail(path, `references a missing local file: ${normalized}`);
  }
}

function validateSource(source, path) {
  objectAt(source, path);
  allowedKeys(source, ["label", "credit", "url", "rights"], path);
  nonBlank(source.label, `${path}.label`);
  nonBlank(source.credit, `${path}.credit`);
  httpUrl(source.url, `${path}.url`);
  if (source.rights !== undefined) nonBlank(source.rights, `${path}.rights`);
}

async function validateArtefact(record, path, projectRoot) {
  if (record === null) return;
  objectAt(record, path);
  const fields = ["kind", "src", "alt", "caption", "credit", "sourceUrl", "rights"];
  allowedKeys(record, fields, path);
  fields.forEach((field) => nonBlank(record[field], `${path}.${field}`));
  if (!["photograph", "artefact"].includes(record.kind)) fail(`${path}.kind`, "must be photograph or artefact");
  await mediaSource(record.src, `${path}.src`, projectRoot);
  httpUrl(record.sourceUrl, `${path}.sourceUrl`);
}

async function validateAudio(record, path, projectRoot) {
  if (record === null) return;
  objectAt(record, path);
  const fields = ["src", "mimeType", "title", "description", "transcript", "credit", "sourceUrl", "rights"];
  allowedKeys(record, fields, path);
  fields.forEach((field) => nonBlank(record[field], `${path}.${field}`));
  if (!record.mimeType.startsWith("audio/")) fail(`${path}.mimeType`, "must start with audio/");
  await mediaSource(record.src, `${path}.src`, projectRoot);
  httpUrl(record.sourceUrl, `${path}.sourceUrl`);
}

export async function validateContentFile(projectRoot) {
  const contentPath = resolve(projectRoot, "content.json");
  const data = JSON.parse(await readFile(contentPath, "utf8"));
  objectAt(data, "content");
  allowedKeys(data, ["$schema", "contentVersion", "prompts"], "content");
  if (data.$schema !== undefined) nonBlank(data.$schema, "content.$schema");
  if (data.contentVersion !== 3) fail("content.contentVersion", "must equal 3");
  if (!Array.isArray(data.prompts) || data.prompts.length !== 4) fail("content.prompts", "must contain the four homepage contexts");

  const ids = new Set();
  const themes = new Set();
  for (let index = 0; index < data.prompts.length; index += 1) {
    const promptPath = `content.prompts[${index}]`;
    const prompt = objectAt(data.prompts[index], promptPath);
    allowedKeys(prompt, ["id", "scene", "layers"], promptPath);
    nonBlank(prompt.id, `${promptPath}.id`);
    if (!/^[a-z0-9-]+$/.test(prompt.id)) fail(`${promptPath}.id`, "must use lowercase letters, numbers, and hyphens only");
    if (ids.has(prompt.id)) fail(`${promptPath}.id`, `duplicates ${prompt.id}`);
    ids.add(prompt.id);

    const scene = objectAt(prompt.scene, `${promptPath}.scene`);
    const sceneFields = ["kicker", "homeTitle", "homeDeck", "theme", "sequence", "evidenceLabel", "defaultSurface"];
    allowedKeys(scene, sceneFields, `${promptPath}.scene`);
    sceneFields.filter((field) => field !== "sequence").forEach((field) => nonBlank(scene[field], `${promptPath}.scene.${field}`));
    if (!["message", "crossing", "witness", "invocation"].includes(scene.theme)) fail(`${promptPath}.scene.theme`, "uses an unsupported visual theme");
    if (themes.has(scene.theme)) fail(`${promptPath}.scene.theme`, `duplicates the ${scene.theme} visual theme`);
    themes.add(scene.theme);
    if (!["paper", "fan", "cloth"].includes(scene.defaultSurface)) fail(`${promptPath}.scene.defaultSurface`, "uses an unsupported writing surface");
    if (!Array.isArray(scene.sequence) || scene.sequence.length !== 3) fail(`${promptPath}.scene.sequence`, "must contain three narrative beats");
    scene.sequence.forEach((beat, beatIndex) => nonBlank(beat, `${promptPath}.scene.sequence[${beatIndex}]`));

    const layers = objectAt(prompt.layers, `${promptPath}.layers`);
    allowedKeys(layers, ["stroke", "narrative", "context"], `${promptPath}.layers`);

    const stroke = objectAt(layers.stroke, `${promptPath}.layers.stroke`);
    const strokeFields = ["status", "symbol", "phrase", "transcription", "phraseReading", "gloss", "guideLabel", "reference", "referenceNote"];
    allowedKeys(stroke, strokeFields, `${promptPath}.layers.stroke`);
    ["status", "transcription", "gloss", "guideLabel", "reference", "referenceNote"].forEach((field) => nonBlank(stroke[field], `${promptPath}.layers.stroke.${field}`));
    if (!["verified-digital-reconstruction", "pending-verification"].includes(stroke.status)) fail(`${promptPath}.layers.stroke.status`, "uses an unsupported verification status");
    if (stroke.status === "verified-digital-reconstruction") {
      ["symbol", "phrase", "phraseReading"].forEach((field) => nonBlank(stroke[field], `${promptPath}.layers.stroke.${field}`));
      if (Array.from(stroke.phrase).length < 2) fail(`${promptPath}.layers.stroke.phrase`, "must contain at least two forms");
    } else if (stroke.symbol !== null || stroke.phrase !== null || stroke.phraseReading !== null) {
      fail(`${promptPath}.layers.stroke`, "pending records must keep symbol, phrase, and phraseReading null");
    }

    const narrative = objectAt(layers.narrative, `${promptPath}.layers.narrative`);
    const narrativeFields = ["title", "place", "storyType", "story", "writingLines", "after", "archiveNote"];
    allowedKeys(narrative, narrativeFields, `${promptPath}.layers.narrative`);
    narrativeFields.filter((field) => !["story", "writingLines"].includes(field)).forEach((field) => nonBlank(narrative[field], `${promptPath}.layers.narrative.${field}`));
    if (!Array.isArray(narrative.story) || narrative.story.length < 2) fail(`${promptPath}.layers.narrative.story`, "must contain at least two paragraphs");
    narrative.story.forEach((paragraph, paragraphIndex) => nonBlank(paragraph, `${promptPath}.layers.narrative.story[${paragraphIndex}]`));
    if (!Array.isArray(narrative.writingLines) || narrative.writingLines.length !== 3) fail(`${promptPath}.layers.narrative.writingLines`, "must contain three reveal lines");
    narrative.writingLines.forEach((line, lineIndex) => nonBlank(line, `${promptPath}.layers.narrative.writingLines[${lineIndex}]`));

    const context = objectAt(layers.context, `${promptPath}.layers.context`);
    allowedKeys(context, ["note", "sources", "artefact", "audio"], `${promptPath}.layers.context`);
    if (context.note !== null) nonBlank(context.note, `${promptPath}.layers.context.note`);
    if (!Array.isArray(context.sources)) fail(`${promptPath}.layers.context.sources`, "must be an array");
    context.sources.forEach((source, sourceIndex) => validateSource(source, `${promptPath}.layers.context.sources[${sourceIndex}]`));
    if (!("artefact" in context)) fail(`${promptPath}.layers.context.artefact`, "must be present; use null when unavailable");
    if (!("audio" in context)) fail(`${promptPath}.layers.context.audio`, "must be present; use null when unavailable");
    await validateArtefact(context.artefact, `${promptPath}.layers.context.artefact`, projectRoot);
    await validateAudio(context.audio, `${promptPath}.layers.context.audio`, projectRoot);
  }

  return data;
}

const scriptPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (scriptPath === fileURLToPath(import.meta.url)) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  validateContentFile(projectRoot)
    .then((data) => console.log(`Validated ${data.prompts.length} contextual prompt records.`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
