import {
  brushSurface,
  characterStartMode,
  creditedTraceDistance,
  clamp,
  createTaperSamples,
  interpolateStrokeSegment,
  isCharacterTraceComplete,
  modelBrushSample,
  seededNoise
} from "./brush-engine.js";

const languagePreferenceKey = "held-in-ink-language-v1";

function initialLanguage() {
  try {
    const saved = window.localStorage.getItem(languagePreferenceKey);
    if (["en", "zh"].includes(saved)) return saved;
  } catch {
    // Fall through to the site default when storage is unavailable.
  }
  return "en";
}

const state = {
  language: initialLanguage(),
  contentByLanguage: {},
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
  characterInputTypes: [],
  characterCoveredCells: [],
  characterGuideSamples: [],
  completedCharacters: new Set(),
  revisingCompletedCharacter: false,
  lineResponsePlayed: false,
  lineResponsePreserved: false,
  lineResponseTimer: null,
  livingInkActive: false,
  livingInkSettled: false,
  livingInkFrame: null,
  livingInkStartedAt: null,
  livingInkProgress: 0,
  livingInkScene: null,
  writingDistance: 0,
  revealedWritingLines: 0,
  writingAspectRatio: 1,
  inputMode: "draw",
  lastKeyboardAttendTime: null,
  partialTrace: false,
  sending: false,
  releaseInProgress: false,
  releaseTimer: null,
  releaseFrame: null,
  releaseStartedAt: null,
  releaseParticles: [],
  stage: "threshold",
  surface: "paper",
  activeAudio: null,
  returnFocus: null
};

const els = {
  panels: [...document.querySelectorAll("[data-stage]")],
  stageNumber: document.querySelector("#stage-number"),
  stageName: document.querySelector("#stage-name"),
  progress: [...document.querySelectorAll(".progress span")],
  languageToggle: document.querySelector("#language-toggle"),
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
  preWritingDisclosure: document.querySelector("#pre-writing-disclosure"),
  preWritingStatus: document.querySelector("#pre-writing-status"),
  preWritingEvidence: document.querySelector("#pre-writing-evidence"),
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
  returnDocumentedCopy: document.querySelector("#return-documented-copy"),
  cardForm: document.querySelector("#card-form"),
  cardTranscription: document.querySelector("#card-transcription"),
  cardReading: document.querySelector("#card-reading"),
  cardBackground: document.querySelector("#card-background"),
  cardFooter: document.querySelector("#card-footer"),
  archiveTitle: document.querySelector("#archive-title"),
  archiveDescription: document.querySelector("#archive-description"),
  promptPicker: document.querySelector("#prompt-picker"),
  promptList: document.querySelector("#prompt-list"),
  guide: document.querySelector("#guide-canvas"),
  writing: document.querySelector("#writing-canvas"),
  livingInk: document.querySelector("#living-ink-canvas"),
  after: document.querySelector("#after-canvas"),
  card: document.querySelector("#card-canvas"),
  canvasFrame: document.querySelector("#canvas-frame"),
  guideSizePicker: document.querySelector("#guide-size-picker"),
  characterFeedbackLayer: document.querySelector("#character-feedback-layer"),
  releaseVisual: document.querySelector("#release-visual"),
  siteInkCursor: document.querySelector("#site-ink-cursor"),
  releaseCanvas: document.querySelector("#release-canvas"),
  releaseEffectsCanvas: document.querySelector("#release-effects-canvas"),
  releaseFanPanels: document.querySelector("#release-fan-panels"),
  releaseDialog: document.querySelector("#release-dialog"),
  releaseDescription: document.querySelector("#release-description"),
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
  threshold: "00",
  home: "01",
  entering: "02",
  writing: "03",
  after: "04",
  archive: "05"
};

const stageCopyKeys = {
  threshold: "stageThreshold",
  home: "stageHome",
  entering: "stageEntering",
  writing: "stageWriting",
  after: "stageAfter",
  archive: "stageArchive"
};

const staticZh = {
  skipLink: "跳至体验",
  wordmarkAria: "返回书信选择",
  contextCare: "史料与关怀",
  thresholdEyebrow: "第一封信抵达以前",
  thresholdTitle: "有些文字得以留存，是因为有人愿意接过它。",
  thresholdDeck: "隔着远近、劳作、婚嫁、离别与仪式，女书由女人们彼此相向的书写塑成。在这里，四个想象中的声音邀请你放慢下来，让一行文字从自己手中经过。",
  thresholdRoleLabel: "你的角色：",
  thresholdRole: "你并非进入过去，也不替这些女人发言。片刻之间，请做一位暂时接过这些文字的人。",
  thresholdBoundaryLabel: "启程之前",
  thresholdBoundary: "四位女人及其所处的场景，均是以文献记录为基础的复合虚构。沿途，每一句话、每一个字形所依据的证据，都会如实标明。",
  beginCarrying: "开始传递",
  skipIntroduction: "略过引言",
  careRouteAria: "这段相遇所经过的路径",
  receive: "接信",
  receiveNote: "进入一则故事，接过其中的字句",
  attend: "凝神",
  attendNote: "循着字形，一字一字描写",
  carry: "传递",
  carryNote: "写完这一行，再将它送出",
  return: "归返",
  returnNote: "回看哪些出于想象，哪些见于史料",
  homeEyebrow: "四位女人 · 四封想象的书信",
  homeTitle: "你愿意替谁传递这一句话？",
  homeDeck: "每一次相遇，都从一句写向远方的话开始。选择一个故事，接过那行文字，让它朝另一位倾听者继续前行。",
  homeChoicesAria: "从四个女书语境中选择一个",
  loadingContexts: "正在展开四封书信……",
  homeMethod: "每一次相遇都围绕复合虚构人物展开。参与以前，页面会标明证据状态；待字句抵达以后，完整史料将重新出现。",
  readOpening: "重读开篇",
  storyEyebrow: "一封等待被传递的信",
  fictionalComposite: "复合虚构人物",
  beforeWriting: "落笔以前",
  verifiedHere: "这里有哪些已经核对",
  sourcesReturnLater: "更完整的语境与资料来源，将在这行字抵达以后重新出现。",
  historicalGrounding: "史料依据",
  documentedImagined: "哪些见于文献，哪些出于想象",
  returnStage: "04 · 归返",
  returnContext: "让这行字归回它的来处",
  returnContextIntro: "现在，这行字已经抵达。请把它重新放回塑成这次相遇的历史语境之中。",
  imaginedHere: "此处的想象",
  imaginedHereNote: "写信人与收信人、相遇时刻及叙事细节，均为以文献记载为基础的复合虚构。",
  documentedHere: "此处的文献依据",
  behindStory: "故事背后",
  readSources: "查阅来源",
  photoArtefact: "照片或文物",
  audio: "声音",
  chooseAnother: "选择另一位女人",
  writingEyebrow: "提笔接过她的话",
  brushGuidance: "笔压或行笔速度改变墨色。",
  writingSurface: "书写载体",
  surfaceNote: "选择承载这句话的材质。",
  surfaceAria: "选择书写载体",
  paper: "纸张",
  paperNote: "静默的纤维",
  fan: "折扇",
  fanNote: "折叠的纸面",
  cloth: "织物",
  clothNote: "经纬相接",
  guideSize: "字帖大小",
  guideSizeAria: "选择描写字帖的大小",
  comfort: "舒展",
  comfortNote: "较大字形，便于描写",
  compact: "紧凑",
  compactNote: "一次看见整句",
  lineGathers: "字句渐成",
  stayMoment: "陪她停留片刻。",
  keyboardAttention: "以键盘节奏凝神",
  writingCanvasAria: "描写所选女书字形的画布",
  inkBrush: "墨笔",
  clearAgain: "清去笔迹，重新开始",
  releaseCloseAria: "回到书写",
  releaseEyebrow: "重新落笔以前",
  releaseTitle: "要让这段未竟的墨迹离开吗？",
  releaseBoundary: "这一材质过渡是界面中的诠释性动作，并非对历史订正方式的复原。",
  releaseCancel: "回到书写",
  releaseConfirm: "放下此迹，重新开始",
  partialTrace: "带着未竟的笔迹继续",
  arrivalEyebrow: "这一行字已经抵达",
  whatCarried: "你所传递的",
  evidenceBoundary: "证据边界",
  howRead: "这一行如何读",
  handToHand: "从一只手，到另一只手",
  deliveryAria: "这句话从其来源语境出发，经过你的手，走向一位倾听者",
  pauseKeeping: "留下以前，请先停一停",
  reflectionTitle: "当这一行字从你手中经过，有什么发生了变化？",
  reflectionNotice: "你的速度、迟疑或书写载体，让你注意到了什么？",
  reflectionUnknown: "关于这位女人的经历，仍有哪些是你无法知晓的？",
  reflectionPrivacy: "这些文字只停留在当前页面，不会写入下载的记录。",
  keepRecord: "留下这次相遇的记录",
  writeAgain: "再写一次",
  keptHand: "留在你手中",
  savedCardAria: "你保存的书写卡片",
  meaningLabel: "所写之意",
  hanTranscription: "汉字转写",
  jiangyongReading: "江永读音",
  downloadImage: "下载图像",
  carryAnother: "传递另一句话",
  promptPickerAria: "选择一封书信",
  fourWomen: "四位女人",
  closePickerAria: "关闭书信选择",
  closeAria: "关闭",
  aboutTitle: "用心书写",
  aboutOne: "女书是与中国湖南江永县密切相关的女性文字。几代女人曾以它传递书信、歌谣，以及亲密而隐微的扶持。",
  aboutTwo: "页面中的四位女人及其相遇时刻均属想象；她们的书信、歌谣、处境与社会关系，则以每个故事内列出的历史资料为依据。",
  aboutThree: "女书是一种音节文字：同一字形可能承载多个汉语词语的读音。第一组字帖已与文献书信核对；其余三组均明确标作暂依字典所得的重构。",
  aboutFour: "这是一项仍在延续的文化遗产。请以访客的身份进入，让每一行字把你的注意带回曾经传递它的女人与社群。",
  aboutVisual: "四件载体从馆藏物件中提取纸张暗花、装帧、针法、竖列和山水笔法，但仍是为本网站绘制的当代视觉转译，并非历史物件的复原。手帕参照物来自海峡殖民地，仅用于理解丝缎、抽纱边与刺绣结构，不作为江永地方纹样的证据。",
  visualReferences: "当代视觉转译的馆藏参照",
  visualLetterRef: "明代王鏊书札：暗花笺纸与册页",
  visualClothRef: "二十世纪初丝缎手帕：针法与边缘结构（非江永来源）",
  visualNushuRef: "UNESCO：三朝书封面与内页",
  visualLandscapeRef: "清代黄均《仿古山水册》：细线与淡设色"
};

const dynamicCopy = {
  en: {
    stageThreshold: "Threshold", stageHome: "Choose", stageEntering: "Story", stageWriting: "Writing", stageAfter: "Arrival", stageArchive: "Keep",
    loadError: "The four contexts could not be loaded. Open this prototype through its local web server and try again.",
    evidenceVerified: "The people and scene are imagined; the line and displayed forms are archive-checked.",
    evidenceProvisional: "The people and scene are imagined; the source line is reported, while the displayed forms are provisional dictionary matches.",
    evidenceOpen: "The people and scene are imagined. No verified Nüshu form is supplied for this open response.",
    referenceCount: ({ count }) => `${count} ${count === 1 ? "reference" : "references"}`,
    fictionalComposite: "Fictional composite", carryWords: "Carry her words →", rights: ({ value }) => `Rights: ${value}`,
    withheld: "Withheld", notRecorded: "Not recorded", incompleteSource: "The source record is incomplete, so it is not presented as a citation.", noSource: "No source record has been added. This entry should not be treated as historical evidence.", notAttached: "Not attached", invalidArtefact: "This record is missing required source, credit, rights, caption, or alt-text information, so the material is not displayed.", noArtefact: "No verified photograph or artefact is attached to this entry. No reconstruction is substituted.", viewSource: "View source record", unavailable: "Unavailable", artefactLoadError: "The credited artefact could not be loaded. No replacement image is shown.", invalidAudio: "This record is missing required source, credit, rights, description, or transcript information, so no audio is loaded.", noAudio: "No credited audio is attached to this entry. Nothing will play.", audioSuffix: "Audio never starts automatically and begins muted.", startsMuted: "Starts muted.", sound: "Sound", on: "On", off: "Off", transcript: "Read transcript or sound description", viewAudio: "View audio source record", soundUnavailable: "Sound unavailable", audioLoadError: "The credited audio could not be loaded. Nothing will play.",
    formPending: "Form pending", writeFor: ({ sender }) => `Write for ${sender}`, writingTitle: ({ sender, receiver }) => `Carry ${sender}’s words to ${receiver}`,
    guidedInstruction: ({ count }) => `Follow the ${count} pale forms from top to bottom. Let the line unfold slowly.`, fanGuidedInstruction: ({ count }) => `Follow ${count} pale forms down each short column, moving from the right column to the left.`, openInstruction: "Let your mark answer the story in your own way.",
    canvasVerified: ({ line }) => `A canvas for tracing the Nüshu line transcribed as ${line}`, canvasProvisional: ({ line }) => `A canvas for tracing provisional standardized forms for the line ${line}`, canvasOpen: ({ title }) => `An open writing canvas for ${title}`,
    stayWith: ({ sender }) => `Stay with ${sender} as the words take shape.`, archiveDescription: ({ transcription, reading }) => `Han transcription: ${transcription}. Jiangyong reading: ${reading}. This remains a personal record of encounter, not a heritage object.`,
    readingVerified: ({ count }) => `Jiangyong readings recorded for these ${count} forms.`, readingProvisional: ({ count }) => `Provisional Jiangyong readings for these ${count} standardized forms.`, readingUnavailable: "A checked syllable reading is not available for this line.", readTranscription: "Read the Han transcription beneath the line.", yourHand: "Your hand", deliveryDynamicAria: ({ sender, receiver }) => `${sender}’s words move through your hand towards ${receiver}`,
    sendOnward: "Send the line onward", completeToSend: "Complete the line to send it", clearBeforeInput: "Clear the page before changing the input pathway", returnDrawing: "Return to the drawing pathway", useKeyboard: "Use the keyboard-paced pathway", keyboardModeNote: "Each press records a pause mark rather than imitating handwriting. Clear the trace to change pathways.", drawingModeNote: "If drawing is not accessible to you, attend to each form with a deliberate key press. This records rhythm, not simulated handwriting.",
    keyboardTrace: "keyboard-paced attention trace", partialTraceLabel: "partial handwriting trace", handwritingTrace: "handwriting trace", traceCaption: ({ trace }) => `Your ${trace}, before interpretation`, traceAria: ({ trace }) => `Your ${trace} from the writing stage`, savedTraceAria: ({ trace }) => `Your saved ${trace} record`, traceFooter: ({ trace }) => `${trace[0].toUpperCase()}${trace.slice(1)} · personal record, not a heritage object`,
    allForms: ({ count }) => `All ${count} forms have been attended to. The line is ready to send.`, lineReady: "Line ready", formStatus: ({ index, count, reading }) => `Form ${index} of ${count}${reading ? `, read ${reading}` : ""}. Pause, then activate the button when you are ready.`, attendForm: ({ index }) => `Attend to form ${index}`,
    keyboardProgressReady: ({ total }) => `${total} of ${total} · the line is ready.`, keyboardProgress: ({ index, total }) => `${index} of ${total} · pause before the next form.`,
    pageOpen: "The page is open.", beginFirstTop: "Begin with the first form at the top.", clearBeforeGuide: "Clear the page to change the guide size", lineReadyFor: ({ sender, receiver }) => `${sender}’s line is ready for ${receiver}.`, sendItOnward: "Send it onward", startHere: "start here", next: "next", progressReady: ({ total }) => `${total} of ${total} · the line is ready.`, progressContinue: ({ index, total }) => `${index} of ${total} · continue downward.`, progressNextColumn: ({ index, total }) => `${index} of ${total} · move to the top of the left column.`, returnToForm: ({ index }) => `Return to the pale area for form ${index}.`, traceMore: ({ index }) => `Follow more of the pale structure in form ${index}.`, revisionKept: ({ index }) => `Your added stroke remains. Continue with form ${index}.`, finishCurrentFirst: ({ index }) => `Finish form ${index} before moving to the forms below.`, continueForm: ({ index }) => `Continue with form ${index} below.`, continueNextColumn: ({ index }) => `Continue with form ${index} at the top of the left column.`,
    pressurePace: "pressure · pace", touchPressure: "touch pressure", stylusPressure: "stylus pressure", paceSensing: "pace sensing", stylusPace: "stylus · pace", touchPace: "touch · pace", pressureDeepens: "Your pressure deepens the ink.", slowerFuller: "A slower movement leaves a fuller stroke.",
    beginBeforeSend: "Begin the first form before sending the line.", incompleteLine: ({ index }) => `The line is not complete yet. Continue with form ${index}, or choose the partial-trace path.`, guideRecedes: "The guide recedes. Stay with your trace before it arrives.", partialRecedes: "The guide recedes. This partial trace will remain named as partial.",
    releasePaper: "The ink will darken at its edges, then lift through the paper fibres as ash. A clear page waits beneath.", releaseFan: "The fan will gather the unfinished line panel by panel, then open again as a clear surface.", releaseCloth: "The trace will loosen strand by strand with the weave. The cloth will remain ready to receive the line again.", releaseInProgress: "The unfinished trace is leaving the surface.", releaseComplete: "The surface is open again. Begin with the first form.",
    surfacePaper: "paper", surfaceFan: "paper fan", surfaceCloth: "woven cloth", meaningLabel: "MEANING", hanTranscription: "HAN TRANSCRIPTION", jiangyongReading: "JIANGYONG READING", archiveKeyboard: "KEYBOARD-PACED ATTENTION TRACE · PERSONAL RECORD", archivePartial: "PARTIAL HANDWRITING TRACE · PERSONAL RECORD", archiveHandwriting: "HANDWRITING TRACE · PERSONAL RECORD", archiveDocumented: "HISTORICAL FICTION · DOCUMENTED LINE", archiveProvisional: "HISTORICAL FICTION · PROVISIONAL FORMS", archiveOpen: "HISTORICAL FICTION · OPEN RESPONSE"
  },
  zh: {
    stageThreshold: "序", stageHome: "择信", stageEntering: "入信", stageWriting: "落笔", stageAfter: "抵达", stageArchive: "留存",
    loadError: "四封书信未能载入，请稍后重新打开此页面。",
    evidenceVerified: "人物与场景出于想象；所引句及页面字形已经档案核对。",
    evidenceProvisional: "人物与场景出于想象；原句见于资料，页面字形则为暂依字典所得的配对。",
    evidenceOpen: "人物与场景出于想象；此处不提供未经核实的女书字形。",
    referenceCount: ({ count }) => `${count} 项参考资料`,
    fictionalComposite: "复合虚构人物", carryWords: "接过她的话 →", rights: ({ value }) => `权利说明：${value}`,
    withheld: "暂不呈现", notRecorded: "尚无记录", incompleteSource: "来源记录尚不完整，故不作为引文呈现。", noSource: "此处尚未加入来源记录，不应将本条目视为历史证据。", notAttached: "尚未附入", invalidArtefact: "此记录缺少必要的来源、署名、权利说明、图注或替代文字，相关材料因此不予展示。", noArtefact: "此条目未附入经过核实的照片或文物图像，也不以重构图替代。", viewSource: "查看来源记录", unavailable: "暂不可用", artefactLoadError: "已署名的文物图像未能载入，页面不会以其他图像替代。", invalidAudio: "此记录缺少必要的来源、署名、权利说明、描述或文字记录，因此不载入声音。", noAudio: "此条目未附入有明确署名的声音材料，页面不会播放音频。", audioSuffix: "声音不会自动播放，初始状态为静音。", startsMuted: "初始为静音。", sound: "声音", on: "开启", off: "关闭", transcript: "阅读文字记录或声音描述", viewAudio: "查看声音来源记录", soundUnavailable: "声音暂不可用", audioLoadError: "已署名的声音材料未能载入，页面不会播放音频。",
    formPending: "字形待考", writeFor: ({ sender }) => `替${sender}落笔`, writingTitle: ({ sender, receiver }) => `把${sender}的话送到${receiver}身边`,
    guidedInstruction: ({ count }) => `依次描写由上而下的 ${count} 个淡色字形，让这一行慢慢展开。`, fanGuidedInstruction: ({ count }) => `依次描写 ${count} 个淡色字形：每列自上而下，并由右列移至左列。`, openInstruction: "让你的笔迹以自己的方式回应这个故事。",
    canvasVerified: ({ line }) => `描写女书句“${line}”的画布`, canvasProvisional: ({ line }) => `描写“${line}”暂定规范字形的画布`, canvasOpen: ({ title }) => `为“${title}”开放的书写画布`,
    stayWith: ({ sender }) => `字句渐成时，陪${sender}停留片刻。`, archiveDescription: ({ transcription, reading }) => `汉字转写：${transcription}。江永读音：${reading}。此为个人相遇记录，并非文化遗产物件。`,
    readingVerified: ({ count }) => `这 ${count} 个字形采用已有记录的江永读音。`, readingProvisional: ({ count }) => `这 ${count} 个规范字形采用暂定的江永读音。`, readingUnavailable: "这一行暂无经过核对的音节读法。", readTranscription: "请从字形下方阅读汉字转写。", yourHand: "你的手", deliveryDynamicAria: ({ sender, receiver }) => `${sender}的话经过你的手，向${receiver}而去`,
    sendOnward: "让这行字继续前行", completeToSend: "写完整行，才可送出", clearBeforeInput: "请先清去笔迹，再更换输入方式", returnDrawing: "回到手写描摹", useKeyboard: "使用键盘节奏模式", keyboardModeNote: "每次按键只记录一次停顿的节奏，并不模仿手写。若要更换方式，请先清去笔迹。", drawingModeNote: "若手写描摹不便，可用一次有意识的按键凝视每个字形。系统只记录节奏，不模拟手写。",
    keyboardTrace: "键盘节奏留下的凝神痕迹", partialTraceLabel: "未竟的手写痕迹", handwritingTrace: "手写痕迹", traceCaption: ({ trace }) => `解释以前，你留下的${trace}`, traceAria: ({ trace }) => `你在书写阶段留下的${trace}`, savedTraceAria: ({ trace }) => `你保存的${trace}记录`, traceFooter: ({ trace }) => `${trace} · 个人相遇记录，并非文化遗产物件`,
    allForms: ({ count }) => `${count} 个字形均已凝神看过，这一行可以送出了。`, lineReady: "这一行已经写好", formStatus: ({ index, count, reading }) => `第 ${index} 个，共 ${count} 个${reading ? `，读作 ${reading}` : ""}。停一停，准备好后再按下按钮。`, attendForm: ({ index }) => `凝神看第 ${index} 个字形`,
    keyboardProgressReady: ({ total }) => `${total}/${total} · 这一行已经写好。`, keyboardProgress: ({ index, total }) => `${index}/${total} · 写下一字以前，请先停一停。`,
    pageOpen: "纸页已经展开。", beginFirstTop: "请从最上方的第一个字形开始。", clearBeforeGuide: "请先清去笔迹，再调整字帖大小", lineReadyFor: ({ sender, receiver }) => `${sender}的这一行，已经可以送往${receiver}。`, sendItOnward: "送它继续前行", startHere: "从这里开始", next: "下一字", progressReady: ({ total }) => `${total}/${total} · 这一行已经写好。`, progressContinue: ({ index, total }) => `${index}/${total} · 继续向下。`, progressNextColumn: ({ index, total }) => `${index}/${total} · 请移至左列顶端。`, returnToForm: ({ index }) => `请回到第 ${index} 个字形的淡色区域。`, traceMore: ({ index }) => `请沿着第 ${index} 个淡色字形继续描摹。`, revisionKept: ({ index }) => `补写的墨迹已留下，请继续第 ${index} 个字形。`, finishCurrentFirst: ({ index }) => `请先写完第 ${index} 个字形，再继续后面的字。`, continueForm: ({ index }) => `请继续描写下方第 ${index} 个字形。`, continueNextColumn: ({ index }) => `请移至左列顶端，继续第 ${index} 个字形。`,
    pressurePace: "笔压 · 行速", touchPressure: "触屏压力", stylusPressure: "触控笔压力", paceSensing: "感知行笔速度", stylusPace: "触控笔 · 行速", touchPace: "触屏 · 行速", pressureDeepens: "你的笔压让墨色渐深。", slowerFuller: "行笔越缓，墨痕越丰。",
    beginBeforeSend: "请先写下第一个字形，再送出这一行。", incompleteLine: ({ index }) => `这一行尚未写完。请继续第 ${index} 个字形，或选择带着未竟的笔迹前行。`, guideRecedes: "淡色字帖缓缓隐去；在它抵达以前，再陪你的笔迹片刻。", partialRecedes: "淡色字帖缓缓隐去；这道未竟的痕迹仍会被如实标明。",
    releasePaper: "墨缘将先焦褐，再沿纸张纤维化作灰屑离开；一页清纸仍在其下等候。", releaseFan: "折扇会逐片收拢未竟的字句，再度展开一面空白。", releaseCloth: "笔迹将随经纬一丝丝松开，织物仍会留下，重新承接这一行字。", releaseInProgress: "这段未竟的墨迹正在离开书写载体。", releaseComplete: "书写载体重新展开了。请从第一个字形落笔。",
    surfacePaper: "纸张", surfaceFan: "折扇", surfaceCloth: "织物", meaningLabel: "所写之意", hanTranscription: "汉字转写", jiangyongReading: "江永读音", archiveKeyboard: "键盘节奏凝神痕迹 · 个人记录", archivePartial: "未竟手写痕迹 · 个人记录", archiveHandwriting: "手写痕迹 · 个人记录", archiveDocumented: "历史虚构 · 文献所载句", archiveProvisional: "历史虚构 · 暂定字形", archiveOpen: "历史虚构 · 开放书写"
  }
};

const staticEnglishText = new Map();
const staticEnglishAria = new Map();

function tr(key, values = {}) {
  const entry = dynamicCopy[state.language]?.[key] ?? dynamicCopy.en[key] ?? key;
  return typeof entry === "function" ? entry(values) : entry;
}

function applyStaticTranslations() {
  document.documentElement.lang = state.language === "zh" ? "zh-Hans" : "en";
  document.body.dataset.language = state.language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!staticEnglishText.has(key)) staticEnglishText.set(key, element.textContent);
    element.textContent = state.language === "zh" ? staticZh[key] : staticEnglishText.get(key);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    const key = element.dataset.i18nAria;
    if (!staticEnglishAria.has(key)) staticEnglishAria.set(key, element.getAttribute("aria-label") || "");
    element.setAttribute("aria-label", state.language === "zh" ? staticZh[key] : staticEnglishAria.get(key));
  });
  document.title = state.language === "zh"
    ? "Held in Ink — 一场跨越手掌的女书相遇"
    : "Held in Ink — A Nüshu Writing Encounter";
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = state.language === "zh"
    ? "一场以书写、倾听与史料边界展开的女书相遇。"
    : "A quiet, embodied writing encounter with Nüshu.";
  els.languageToggle.textContent = state.language === "zh" ? "English" : "中文";
  els.languageToggle.setAttribute("aria-label", state.language === "zh" ? "切换至英文" : "Switch to Chinese");
  syncReleaseDialogCopy();
}

const thresholdSessionKey = "held-in-ink-threshold-seen-v1";

function thresholdWasSeen() {
  try {
    return window.sessionStorage.getItem(thresholdSessionKey) === "yes";
  } catch {
    return false;
  }
}

function rememberThreshold() {
  try {
    window.sessionStorage.setItem(thresholdSessionKey, "yes");
  } catch {
    // The introduction still works when browser storage is unavailable.
  }
}

const surfaceLabels = {
  paper: "paper",
  fan: "paper fan",
  cloth: "woven cloth"
};

const releaseCopyKeys = {
  paper: "releasePaper",
  fan: "releaseFan",
  cloth: "releaseCloth"
};

function syncReleaseDialogCopy() {
  if (!els.releaseDialog || !els.releaseDescription) return;
  const surface = releaseCopyKeys[state.surface] ? state.surface : "paper";
  els.releaseDialog.dataset.surface = surface;
  els.releaseDescription.textContent = tr(releaseCopyKeys[surface]);
}

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
const glyphAnalysisCanvas = document.createElement("canvas");
const glyphAnalysisCache = new Map();
const glyphGrid = Object.freeze({ columns: 7, rows: 11 });

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
  const releaseClass = state.releaseInProgress ? " is-releasing" : "";
  const livingInkClass = state.livingInkActive || state.livingInkSettled ? " is-line-awake" : "";
  els.canvasFrame.className = `canvas-frame surface-${state.surface}${guideClass}${sizeClass}${inkClass}${drawingClass}${cursorClass}${preservedClass}${sendingClass}${releaseClass}${livingInkClass}`;
}

async function loadPrompts() {
  const [englishResponse, chineseResponse] = await Promise.all([
    fetch("content.json"),
    fetch("content.zh.json")
  ]);
  if (!englishResponse.ok || !chineseResponse.ok) throw new Error("The local prompt files could not be loaded.");
  const [englishData, chineseData] = await Promise.all([
    englishResponse.json(),
    chineseResponse.json()
  ]);
  validateContent(englishData);
  validateContent(chineseData);
  state.contentByLanguage = { en: englishData, zh: chineseData };
  state.prompts = state.contentByLanguage[state.language].prompts;
  applyStaticTranslations();
  renderHomepage();
  selectPrompt(state.prompts[0]);
  setStage(thresholdWasSeen() ? "home" : "threshold", false);
  if (document.fonts) {
    try {
      const symbols = state.prompts.map((prompt) => strokeFor(prompt).phrase || "").join("");
      if (symbols) await document.fonts.load("400 160px 'Noto Traditional Nushu'", symbols);
      glyphAnalysisCache.clear();
      if (state.stage === "writing") requestAnimationFrame(setupWritingCanvases);
    } catch (error) {
      console.warn("The local Nüshu font did not load; a system fallback will be used.", error);
    }
  }
}

function setLanguage(language) {
  if (!["en", "zh"].includes(language) || language === state.language) return;
  finishReleaseVisual({ announce: false });
  const currentId = state.current?.id;
  const pickerWasOpen = !els.promptPicker.hidden;
  state.language = language;
  try {
    window.localStorage.setItem(languagePreferenceKey, language);
  } catch {
    // Language switching still works for the current page without persistence.
  }
  applyStaticTranslations();
  if (!state.contentByLanguage[language]) return;
  state.prompts = state.contentByLanguage[language].prompts;
  renderHomepage();
  const localizedPrompt = state.prompts.find((prompt) => prompt.id === currentId) || state.prompts[0];
  selectPrompt(localizedPrompt, { preserveInteraction: true });
  syncLocalizedInkStatus();
  if (state.stage === "threshold" || state.stage === "home") delete document.body.dataset.scene;
  syncStageLabel();
  if (pickerWasOpen) showPicker();
  if (state.stage === "writing") requestAnimationFrame(setupWritingCanvases);
  if (state.stage === "after") requestAnimationFrame(drawAfterMark);
  if (state.stage === "archive") requestAnimationFrame(drawArchiveCard);
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
    return tr("evidenceVerified");
  }
  if (stroke.status === "dictionary-derived-reconstruction") {
    return tr("evidenceProvisional");
  }
  return tr("evidenceOpen");
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
  els.contextSummaryStatus.textContent = tr("referenceCount", { count: citableSourceCount });
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
      sources.length ? tr("withheld") : tr("notRecorded"),
      sources.length
        ? tr("incompleteSource")
        : tr("noSource")
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
      rights.textContent = tr("rights", { value: source.rights });
      item.append(rights);
    }
    list.append(item);
  });
  els.contextSources.replaceChildren(list);
}

function renderArtefact(artefact) {
  if (!artefactIsDisplayable(artefact)) {
    els.contextArtefact.replaceChildren(emptyContextState(
      artefact ? tr("withheld") : tr("notAttached"),
      artefact
        ? tr("invalidArtefact")
        : tr("noArtefact")
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
  rights.textContent = tr("rights", { value: artefact.rights });
  caption.append(captionText, credit, rights);

  const record = sourceLink(tr("viewSource"), artefact.sourceUrl, "context-record-link");
  if (record) caption.append(record);
  mediaFrame.append(image);
  figure.append(mediaFrame, caption);
  image.addEventListener("error", () => {
    if (!mediaFrame.isConnected || !figure.contains(mediaFrame)) return;
    const errorState = emptyContextState(
      tr("unavailable"),
      tr("artefactLoadError")
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
      audioRecord ? tr("withheld") : tr("notAttached"),
      audioRecord
        ? tr("invalidAudio")
        : tr("noAudio")
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
  description.textContent = `${audioRecord.description} ${tr("audioSuffix")}`;

  const player = document.createElement("audio");
  player.controls = true;
  player.autoplay = false;
  player.preload = "none";
  player.defaultMuted = true;
  player.muted = true;
  player.setAttribute("muted", "");
  player.setAttribute("aria-label", `${audioRecord.title}. ${tr("startsMuted")}`);
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
  soundLabel.textContent = tr("sound");
  const soundState = document.createElement("span");
  soundState.className = "audio-sound-state";
  soundState.setAttribute("aria-hidden", "true");
  soundButton.append(soundLabel, soundState);
  const syncSoundButton = () => {
    const soundIsOn = !player.muted;
    soundButton.setAttribute("aria-pressed", String(soundIsOn));
    soundState.textContent = soundIsOn ? tr("on") : tr("off");
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
  transcriptSummary.textContent = tr("transcript");
  const transcriptText = document.createElement("p");
  transcriptText.textContent = audioRecord.transcript;
  transcript.append(transcriptSummary, transcriptText);

  const credit = document.createElement("p");
  credit.className = "context-credit";
  credit.textContent = audioRecord.credit;
  const rights = document.createElement("p");
  rights.className = "context-rights";
  rights.textContent = tr("rights", { value: audioRecord.rights });
  const record = sourceLink(tr("viewAudio"), audioRecord.sourceUrl, "context-record-link");

  let audioFailed = false;
  const handleAudioError = () => {
    if (audioFailed || state.activeAudio !== player || !wrapper.isConnected) return;
    audioFailed = true;
    stopActiveAudio();
    state.activeAudio = null;
    player.setAttribute("aria-invalid", "true");
    soundButton.disabled = true;
    soundButton.removeAttribute("aria-pressed");
    soundButton.replaceChildren(tr("soundUnavailable"));
    const errorState = emptyContextState(
      tr("unavailable"),
      tr("audioLoadError")
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
  const carrierForTheme = {
    message: "book",
    crossing: "cloth",
    witness: "song",
    invocation: "fold"
  };
  const carrierArtwork = {
    book: "assets/carrier-book-letterpaper.svg",
    cloth: "assets/carrier-cloth-peony.svg",
    song: "assets/carrier-song-manuscript.svg",
    fold: "assets/carrier-fold-mountains.svg"
  };
  const choices = state.prompts.map((prompt, index) => {
    const button = document.createElement("button");
    const carrier = carrierForTheme[prompt.scene.theme] || "paper";
    button.type = "button";
    button.className = `context-choice context-choice-${prompt.scene.theme} carrier-${carrier}`;
    button.dataset.contextId = prompt.id;
    button.dataset.carrier = carrier;

    const surface = document.createElement("span");
    surface.className = "context-choice-surface";
    const material = document.createElement("span");
    material.className = "carrier-material";
    material.setAttribute("aria-hidden", "true");
    if (carrier === "song" && prompt.layers.stroke.phrase) {
      material.classList.add("nushu-glyph");
      material.textContent = prompt.layers.stroke.phrase;
    }
    const illustration = document.createElement("img");
    illustration.className = "carrier-illustration";
    illustration.src = carrierArtwork[carrier];
    illustration.alt = "";
    illustration.setAttribute("aria-hidden", "true");
    illustration.draggable = false;

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

    const bottom = document.createElement("span");
    bottom.className = "context-choice-bottom";
    const boundary = document.createElement("span");
    boundary.className = "context-choice-boundary";
    boundary.textContent = tr("fictionalComposite");
    const evidence = document.createElement("span");
    evidence.className = "context-choice-evidence";
    evidence.textContent = prompt.scene.evidenceLabel;
    const action = document.createElement("span");
    action.className = "context-choice-action";
    action.textContent = tr("carryWords");
    bottom.append(boundary, evidence, action);

    surface.append(illustration, material, top, title, deck, bottom);
    button.append(surface);
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
      ? tr("readingVerified", { count: forms.length })
      : tr("readingProvisional", { count: forms.length });
  } else {
    const unavailable = document.createElement("p");
    unavailable.className = "after-reading-unavailable";
    unavailable.textContent = tr("readingUnavailable");
    els.afterReadingList.replaceChildren(unavailable);
    els.afterReadingNote.textContent = tr("readTranscription");
  }

  const roleLabels = [narrative.sender, tr("yourHand"), narrative.receiver];
  els.deliveryTrack.setAttribute(
    "aria-label",
    tr("deliveryDynamicAria", { sender: narrative.sender, receiver: narrative.receiver })
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

function syncWritingInstruction() {
  if (!state.current || !hasStrokeGuide()) {
    els.writingInstruction.textContent = tr("openInstruction");
    return;
  }
  const count = Array.from(strokeFor().phrase).length;
  els.writingInstruction.textContent = state.surface === "fan" && count > 1
    ? tr("fanGuidedInstruction", { count })
    : tr("guidedInstruction", { count });
}

function selectPrompt(prompt, { preserveInteraction = false } = {}) {
  stopActiveAudio();
  const disclosureWasOpen = els.preWritingDisclosure.open;
  const contextWasOpen = els.characterContext.open;
  state.current = prompt;
  const stroke = strokeFor(prompt);
  const narrative = narrativeFor(prompt);
  const verified = hasStrokeGuide(stroke);
  document.body.dataset.scene = prompt.scene.theme;
  if (!preserveInteraction) state.surface = prompt.scene.defaultSurface;
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
  els.preWritingStatus.textContent = prompt.scene.evidenceLabel;
  els.preWritingEvidence.textContent = evidenceBoundaryText(prompt);
  els.returnDocumentedCopy.textContent = evidenceBoundaryText(prompt);
  els.referenceSymbol.textContent = verified ? stroke.symbol : tr("formPending");
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
  els.beginAction.textContent = tr("writeFor", { sender: narrative.sender });
  els.writingTitle.textContent = tr("writingTitle", { sender: narrative.sender, receiver: narrative.receiver });
  els.writingReference.textContent = `${stroke.transcription} · “${stroke.gloss}”`;
  els.writingEvidence.textContent = evidenceBoundaryText(prompt);
  syncWritingInstruction();
  els.writing.setAttribute("aria-label", verified
    ? stroke.status === "verified-digital-reconstruction"
      ? tr("canvasVerified", { line: stroke.transcription })
      : tr("canvasProvisional", { line: stroke.transcription })
    : tr("canvasOpen", { title: narrative.title }));
  els.guideSizePicker.hidden = !verified;
  els.writingNarrativeIntro.textContent = tr("stayWith", { sender: narrative.sender });
  els.afterQuote.textContent = narrative.after;
  els.afterEvidenceStatus.textContent = evidenceBoundaryText(prompt);
  renderAfterFeedback();
  els.cardForm.textContent = `“${stroke.gloss}”`;
  els.cardTranscription.textContent = stroke.transcription;
  els.cardReading.textContent = stroke.phraseReading || tr("readingUnavailable");
  els.cardBackground.textContent = narrative.archiveNote;
  els.archiveTitle.textContent = `“${stroke.gloss}”`;
  els.archiveDescription.textContent = tr("archiveDescription", {
    transcription: stroke.transcription,
    reading: stroke.phraseReading || tr("readingUnavailable")
  });
  renderContext(prompt.layers.context);
  els.preWritingDisclosure.open = preserveInteraction ? disclosureWasOpen : false;
  els.characterContext.open = preserveInteraction ? contextWasOpen : false;
  if (preserveInteraction) state.revealedWritingLines = 0;
  setupWritingNarrative();
  if (preserveInteraction) {
    revealWritingNarrative();
    applyInputMode();
    syncGuideSizeControls();
  } else {
    clearWriting({ resetInputMode: true });
  }
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

function syncLocalizedInkStatus() {
  if (!state.current || state.stage !== "writing") return;
  if (state.releaseInProgress) {
    els.inkStatus.textContent = tr("releaseInProgress");
    return;
  }
  if (!state.hasMarks) {
    els.inkStatus.textContent = hasStrokeGuide() ? tr("beginFirstTop") : tr("pageOpen");
    return;
  }
  const total = totalForms();
  if (lineIsComplete()) {
    const narrative = narrativeFor();
    els.inkStatus.textContent = tr("lineReadyFor", { sender: narrative.sender, receiver: narrative.receiver });
    return;
  }
  if (state.inputMode === "keyboard") {
    els.inkStatus.textContent = tr("keyboardProgress", { index: state.completedCharacters.size, total });
    return;
  }
  const expected = expectedCharacterIndex();
  els.inkStatus.textContent = state.completedCharacters.size > 0
    ? tr("progressContinue", { index: state.completedCharacters.size, total })
    : tr("traceMore", { index: (expected ?? 0) + 1 });
}

function syncCompletionControls() {
  const complete = lineIsComplete();
  const hasPartial = state.hasMarks && !complete;
  els.pauseAction.disabled = !complete || state.sending;
  els.pauseAction.textContent = complete ? tr("sendOnward") : tr("completeToSend");
  els.partialAction.hidden = !hasPartial || state.sending;
  els.inputModeAction.disabled = state.hasMarks || state.sending;
  els.accessibleFormAction.disabled = complete || state.sending;
  if (state.hasMarks) els.inputModeAction.title = tr("clearBeforeInput");
  else els.inputModeAction.removeAttribute("title");
}

function captureWritingGeometry() {
  const rect = els.writing.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) state.writingAspectRatio = rect.width / rect.height;
}

function applyInputMode() {
  const keyboardMode = state.inputMode === "keyboard";
  const traceLabel = keyboardMode
    ? tr("keyboardTrace")
    : state.partialTrace ? tr("partialTraceLabel") : tr("handwritingTrace");
  els.canvasFrame.hidden = keyboardMode;
  els.accessibleWriting.hidden = !keyboardMode;
  els.inputModeAction.setAttribute("aria-pressed", String(keyboardMode));
  els.inputModeAction.textContent = keyboardMode ? tr("returnDrawing") : tr("useKeyboard");
  els.inputModeNote.textContent = keyboardMode
    ? tr("keyboardModeNote")
    : tr("drawingModeNote");
  els.afterTraceCaption.textContent = tr("traceCaption", { trace: traceLabel });
  els.after.setAttribute("aria-label", tr("traceAria", { trace: traceLabel }));
  els.card.setAttribute("aria-label", tr("savedTraceAria", { trace: traceLabel }));
  els.cardFooter.textContent = tr("traceFooter", { trace: traceLabel });
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
    els.accessibleFormStatus.textContent = tr("allForms", { count: forms.length });
    els.accessibleFormAction.textContent = tr("lineReady");
    return;
  }
  els.accessibleForm.textContent = forms[index] || "";
  els.accessibleFormStatus.textContent = tr("formStatus", { index: index + 1, count: forms.length, reading: readings[index] || "" });
  els.accessibleFormAction.textContent = tr("attendForm", { index: index + 1 });
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
    ? tr("keyboardProgressReady", { total })
    : tr("keyboardProgress", { index: index + 1, total });
  revealWritingNarrative();
  renderAccessiblePath();
  syncCompletionControls();
  scheduleLineResponse(total);
}

let stageTransitionSwapTimer = null;
let stageTransitionCleanupTimer = null;
let stageTransitionSequence = 0;

function setStage(stage, moveFocus = true) {
  const currentPanel = els.panels.find((panel) => panel.dataset.stage === state.stage && !panel.hidden);
  const motionIsReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const shouldTransition = moveFocus && !motionIsReduced && stage !== state.stage && Boolean(currentPanel);

  window.clearTimeout(stageTransitionSwapTimer);
  window.clearTimeout(stageTransitionCleanupTimer);
  els.panels.forEach((panel) => panel.classList.remove("is-leaving"));
  document.body.classList.remove("is-stage-transitioning");

  if (!shouldTransition) {
    applyStage(stage, moveFocus);
    return;
  }

  const sequence = ++stageTransitionSequence;
  currentPanel.classList.add("is-leaving");
  void document.body.offsetWidth;
  document.body.classList.add("is-stage-transitioning");
  stageTransitionSwapTimer = window.setTimeout(() => {
    if (sequence !== stageTransitionSequence) return;
    currentPanel.classList.remove("is-leaving");
    applyStage(stage, moveFocus);
  }, 190);
  stageTransitionCleanupTimer = window.setTimeout(() => {
    if (sequence !== stageTransitionSequence) return;
    document.body.classList.remove("is-stage-transitioning");
  }, 760);
}

function applyStage(stage, moveFocus = true) {
  const previousStage = state.stage;
  if (previousStage === "writing" && stage !== "writing") finishReleaseVisual({ announce: false });
  if (previousStage === "writing" && stage !== "writing") captureWritingGeometry();
  if (stage !== "entering") stopActiveAudio();
  if (stage !== "writing") {
    updateBrushCursor();
  }
  state.stage = stage;
  if (stage !== "writing") state.sending = false;
  syncCanvasFrameState();
  els.panels.forEach((panel) => { panel.hidden = panel.dataset.stage !== stage; });
  syncStageLabel();
  const index = ["entering", "writing", "after", "archive"].indexOf(stage);
  els.progress.forEach((line, i) => line.classList.toggle("is-current", i === index));
  if (stage === "home" || stage === "threshold") delete document.body.dataset.scene;
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
    revealWritingNarrative();
    syncCompletionControls();
  });
  if (stage === "after") requestAnimationFrame(drawAfterMark);
  if (stage === "archive") requestAnimationFrame(drawArchiveCard);
}

function syncStageLabel() {
  els.stageNumber.textContent = stageLabels[state.stage];
  els.stageName.textContent = tr(stageCopyKeys[state.stage]);
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
    return { forms: [], fontSize: 0, step: 0, positions: [], flow: "single-column" };
  }
  const forms = Array.from(strokeFor().phrase);
  const isPhrase = forms.length > 1;
  const isComfortGuide = state.guideSize === "comfort";
  if (isPhrase && state.surface === "fan") {
    const rightColumnCount = Math.ceil(forms.length / 2);
    const columnCounts = [rightColumnCount, forms.length - rightColumnCount];
    const maxRows = Math.max(...columnCounts);
    const safeTop = height * 0.22;
    const safeBottom = height * 0.84;
    const usableHeight = safeBottom - safeTop;
    const fontSize = Math.min(
      (usableHeight / maxRows) * (isComfortGuide ? 0.92 : 0.8),
      width * (isComfortGuide ? 0.2 : 0.16),
      height * (isComfortGuide ? 0.24 : 0.2)
    );
    const step = maxRows > 1 ? Math.min(fontSize * 1.16, usableHeight / (maxRows - 1)) : 0;
    const columnOffset = Math.min(width * 0.18, fontSize * 1.08);
    const columnXs = [width / 2 + columnOffset, width / 2 - columnOffset];
    const positions = forms.map((form, index) => {
      const column = index < rightColumnCount ? 0 : 1;
      const columnStart = column === 0 ? 0 : rightColumnCount;
      const row = index - columnStart;
      const count = columnCounts[column];
      const firstY = (safeTop + safeBottom) / 2 - ((count - 1) * step) / 2;
      return {
        form,
        x: columnXs[column],
        y: firstY + row * step,
        column,
        statusSide: column === 0 ? 1 : -1
      };
    });
    return { forms, fontSize, step, positions, flow: "fan-columns" };
  }
  const fontSize = isPhrase
    ? Math.min(
      (height * (isComfortGuide ? 0.9 : 0.84) / forms.length) * (isComfortGuide ? 0.99 : 0.88),
      width * (isComfortGuide ? 0.38 : 0.3)
    )
    : Math.min(height * (isComfortGuide ? 0.82 : 0.76), width * (isComfortGuide ? 0.62 : 0.46));
  const step = isPhrase ? fontSize * (isComfortGuide ? 1.13 : 1.16) : 0;
  const firstY = isPhrase ? height / 2 - ((forms.length - 1) * step) / 2 : height / 2 + fontSize * 0.02;
  const positions = forms.map((form, index) => ({
    form,
    x: width / 2,
    y: firstY + index * step,
    column: 0,
    statusSide: 1
  }));
  return { forms, fontSize, step, positions, flow: "single-column" };
}

function setupWritingCanvases() {
  const rect = els.canvasFrame.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  state.writingAspectRatio = rect.width / rect.height;
  sizeCanvas(els.guide, rect.width, rect.height);
  const writeCtx = sizeCanvas(els.writing, rect.width, rect.height);
  writeCtx.clearRect(0, 0, rect.width, rect.height);
  const livingInkCtx = sizeCanvas(els.livingInk, rect.width, rect.height);
  livingInkCtx.clearRect(0, 0, rect.width, rect.height);
  renderRecordedStrokes(writeCtx, { x: 0, y: 0, width: rect.width, height: rect.height }, state.surface);
  drawGuide();
  setupCharacterFeedback();
  if ((state.livingInkActive || state.livingInkSettled) && lineIsComplete()) {
    state.livingInkScene = createLivingInkScene(rect.width, rect.height);
    drawLivingInkScene(state.livingInkProgress || 1);
  }
}

function drawGuide() {
  const width = els.guide.clientWidth;
  const height = els.guide.clientHeight;
  const ctx = els.guide.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  if (!hasStrokeGuide()) return;
  ctx.save();
  const { forms, fontSize, positions } = guideLayout(width, height);
  const isPhrase = forms.length > 1;
  ctx.font = `400 ${fontSize}px "Noto Traditional Nushu"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(129, 108, 83, 0.075)";
  ctx.strokeStyle = "rgba(114, 96, 76, 0.5)";
  ctx.lineWidth = Math.max(1.15, Math.min(width, height) * 0.0031);
  if (isPhrase) {
    positions.forEach(({ form, x, y, column, statusSide }, index) => {
      ctx.save();
      // A completed guide recedes, but remains legible so an early completion
      // can still be understood and revised without losing the form.
      ctx.globalAlpha = state.completedCharacters.has(index) ? 0.42 : 1;
      ctx.fillText(form, x, y);
      ctx.strokeText(form, x, y);
      ctx.restore();
      ctx.save();
      ctx.font = "650 10px Segoe UI, Arial, sans-serif";
      ctx.fillStyle = "rgba(94, 82, 67, 0.62)";
      ctx.textAlign = statusSide < 0 ? "right" : "left";
      ctx.fillText(String(index + 1).padStart(2, "0"), x + statusSide * Math.max(50, fontSize * 0.68), y + 3);
      ctx.restore();
      const next = positions[index + 1];
      if (next && next.column === column) {
        const dividerY = (y + next.y) / 2;
        ctx.save();
        ctx.strokeStyle = "rgba(107, 91, 72, 0.16)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        ctx.moveTo(x - Math.max(42, fontSize * 0.45), dividerY);
        ctx.lineTo(x + Math.max(42, fontSize * 0.45), dividerY);
        ctx.stroke();
        ctx.restore();
      }
    });
  } else {
    ctx.save();
    ctx.globalAlpha = state.completedCharacters.has(0) ? 0.42 : 1;
    ctx.fillText(forms[0], positions[0].x, positions[0].y);
    ctx.strokeText(forms[0], positions[0].x, positions[0].y);
    ctx.restore();
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
  els.characterFeedbackLayer.classList.toggle("is-fan-flow", layout.flow === "fan-columns");
  els.characterFeedbackLayer.style.setProperty("--line-x", `${firstPosition.x + statusOffset + 2.5}px`);
  els.characterFeedbackLayer.style.setProperty("--line-start", `${lineStart}px`);
  els.characterFeedbackLayer.style.setProperty("--line-height", `${lineHeight}px`);
  const responses = layout.positions.map(({ form, x, y, column, statusSide }, index) => {
    const next = layout.positions[index + 1];
    const continuesInColumn = Boolean(next && next.column === column);
    const response = document.createElement("span");
    response.className = "character-response";
    response.dataset.characterIndex = String(index);
    response.classList.toggle("is-settled", state.completedCharacters.has(index));
    response.classList.toggle("is-last", index === layout.positions.length - 1);
    response.classList.toggle("is-column-end", !continuesInColumn);
    response.classList.toggle("is-status-left", statusSide < 0);
    response.style.setProperty("--guide-x", `${x}px`);
    response.style.setProperty("--guide-y", `${y}px`);
    response.style.setProperty("--guide-size", `${layout.fontSize}px`);
    response.style.setProperty("--guide-gap", `${continuesInColumn ? next.y - y : layout.step}px`);
    response.style.setProperty("--status-offset", `${statusSide * statusOffset}px`);
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
  syncWritingInstruction();
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
    if (state.hasMarks) button.title = tr("clearBeforeGuide");
    else button.removeAttribute("title");
  });
}

const livingInkDuration = 6200;
const livingInkPalettes = {
  message: { stem: [49, 47, 39], leaf: [79, 78, 55], bloom: [124, 61, 43], lineWidth: 1.18 },
  crossing: { stem: [43, 64, 67], leaf: [66, 91, 82], bloom: [88, 72, 58], lineWidth: 1.08 },
  witness: { stem: [61, 47, 52], leaf: [85, 69, 64], bloom: [111, 54, 65], lineWidth: 1 },
  invocation: { stem: [58, 55, 36], leaf: [84, 83, 47], bloom: [126, 72, 35], lineWidth: 1.28 }
};

function livingInkSeed() {
  return Array.from(state.current?.id || "held-in-ink").reduce(
    (seed, character) => Math.imul(seed ^ character.codePointAt(0), 16777619) >>> 0,
    2166136261
  );
}

function livingInkPoint(branch, t) {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * branch.start.x
      + 3 * inverse ** 2 * t * branch.controlA.x
      + 3 * inverse * t ** 2 * branch.controlB.x
      + t ** 3 * branch.end.x,
    y: inverse ** 3 * branch.start.y
      + 3 * inverse ** 2 * t * branch.controlA.y
      + 3 * inverse * t ** 2 * branch.controlB.y
      + t ** 3 * branch.end.y
  };
}

function livingInkTangent(branch, t) {
  const before = livingInkPoint(branch, Math.max(0, t - 0.012));
  const after = livingInkPoint(branch, Math.min(1, t + 0.012));
  return Math.atan2(after.y - before.y, after.x - before.x);
}

function createLivingInkScene(width, height) {
  if (width <= 0 || height <= 0) return null;
  const bounds = { x: 0, y: 0, width, height };
  const theme = state.current?.scene.theme || "message";
  const palette = livingInkPalettes[theme] || livingInkPalettes.message;
  const layout = guideLayout(width, height);
  const target = characterTargetDimensions(layout);
  if (!layout.positions.length) return null;
  const seed = livingInkSeed();
  const endpointGroups = layout.positions.map(() => []);

  state.strokes.forEach((stroke) => {
    if (!stroke.points?.length) return;
    const restored = stroke.points.map((point) => restoredPoint(point, bounds));
    [restored[0], restored.at(-1)].forEach((point) => {
      let nearestIndex = null;
      let nearestDistance = Infinity;
      layout.positions.forEach((position, index) => {
        const distance = Math.hypot(point.x - position.x, point.y - position.y);
        if (distance < nearestDistance) {
          nearestIndex = index;
          nearestDistance = distance;
        }
      });
      if (nearestIndex !== null && nearestDistance <= Math.max(target.width, target.height) * .72) {
        endpointGroups[nearestIndex].push(point);
      }
    });
  });

  const ordered = layout.positions.map((position, index) => ({ position, index }));
  if (layout.flow === "fan-columns") {
    ordered.sort((a, b) => {
      const yDifference = a.position.y - b.position.y;
      return Math.abs(yDifference) < layout.fontSize * .48
        ? b.position.x - a.position.x
        : yDifference;
    });
  }

  const outerOffset = clamp(target.width * .64, 62, Math.min(width * .2, 146));
  const nodes = ordered.map(({ position, index }, pathIndex) => {
    const side = layout.flow === "fan-columns"
      ? (position.x >= width / 2 ? 1 : -1)
      : (pathIndex % 2 === 0 ? -1 : 1);
    const yDrift = (seededNoise(seed, pathIndex, 2) - .5) * Math.min(layout.fontSize * .18, 18);
    const vine = {
      x: clamp(position.x + side * outerOffset, 28, width - 28),
      y: clamp(position.y + yDrift, 26, height - 26)
    };
    const endpoints = endpointGroups[index];
    const attachment = endpoints.length
      ? endpoints.reduce((selected, point) => (
        side < 0 ? (point.x < selected.x ? point : selected) : (point.x > selected.x ? point : selected)
      ), endpoints[0])
      : {
        x: position.x + side * Math.min(layout.fontSize * .27, target.width * .34),
        y: position.y
      };
    return { position, originalIndex: index, pathIndex, side, vine, attachment };
  });

  const first = nodes[0];
  const firstGap = nodes[1] ? Math.abs(nodes[1].vine.y - first.vine.y) : layout.fontSize;
  const start = {
    x: clamp(first.vine.x - first.side * outerOffset * .28, 28, width - 28),
    y: clamp(first.vine.y - Math.max(36, Math.min(firstGap * .58, 92)), 24, height - 24)
  };
  const mainPoints = [start, ...nodes.map((node) => node.vine)];
  const mainSegments = mainPoints.slice(0, -1).map((segmentStart, index) => {
    const end = mainPoints[index + 1];
    const node = nodes[index];
    const previousSide = index === 0 ? -node.side : nodes[index - 1].side;
    const verticalDistance = Math.max(34, Math.abs(end.y - segmentStart.y));
    const sweep = clamp(verticalDistance * .62 + outerOffset * .34, 44, 132);
    return {
      start: segmentStart,
      end,
      controlA: {
        x: clamp(segmentStart.x + previousSide * sweep, 18, width - 18),
        y: segmentStart.y + (end.y - segmentStart.y) * .28
      },
      controlB: {
        x: clamp(end.x + node.side * sweep * .86, 18, width - 18),
        y: end.y - (end.y - segmentStart.y) * .3
      },
      direction: node.side,
      leafSize: clamp(width * .015, 7.5, 13),
      leafTurns: [
        (seededNoise(seed, index, 6) - .5) * .56,
        (seededNoise(seed, index, 7) - .5) * .46
      ],
      seed: seed + index * 101
    };
  });

  const connections = nodes.map((node, index) => {
    const curl = clamp(target.width * .28, 24, 54);
    const verticalCurl = (index % 2 === 0 ? -1 : 1) * Math.min(layout.fontSize * .22, 24);
    return {
      start: node.vine,
      end: node.attachment,
      controlA: {
        x: clamp(node.vine.x + node.side * curl, 18, width - 18),
        y: node.vine.y + verticalCurl
      },
      controlB: {
        x: node.attachment.x + node.side * curl * .78,
        y: node.attachment.y - verticalCurl * .72
      },
      direction: -node.side,
      seed: seed + index * 137
    };
  });

  const lastSegment = mainSegments.at(-1);
  return {
    theme,
    palette,
    nodes,
    mainSegments,
    connections,
    flower: {
      point: nodes.at(-1).vine,
      angle: lastSegment ? livingInkTangent(lastSegment, 1) : -Math.PI / 2,
      size: clamp(width * .022, 13, 21),
      seed: seed + 2027
    }
  };
}

function strokeLivingInkBranch(ctx, branch, progress, color, width, alpha, dry) {
  if (progress <= 0) return;
  const steps = Math.max(3, Math.ceil(progress * 28));
  ctx.save();
  ctx.beginPath();
  const start = livingInkPoint(branch, 0);
  ctx.moveTo(start.x, start.y);
  for (let step = 1; step <= steps; step += 1) {
    const point = livingInkPoint(branch, (step / steps) * progress);
    ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = `rgba(${color.join(",")},${alpha})`;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (dry) ctx.setLineDash([6, 2.5, 1.3, 3.2]);
  ctx.stroke();
  ctx.restore();
}

function strokeLivingInkVine(ctx, segment, progress, palette, alpha, isConnection = false) {
  const width = palette.lineWidth * (isConnection ? .72 : 1);
  strokeLivingInkBranch(ctx, segment, progress, palette.stem, width * 5.6, alpha * .055, false);
  strokeLivingInkBranch(ctx, segment, progress, palette.leaf, width * 2.25, alpha * .17, false);
  strokeLivingInkBranch(ctx, segment, progress, palette.stem, width, alpha * (isConnection ? .74 : 1), true);
}

function drawLivingInkLeaf(ctx, branch, t, size, side, reveal, palette, alpha) {
  if (reveal <= 0) return;
  const point = livingInkPoint(branch, t);
  const angle = livingInkTangent(branch, t) + side * (0.78 + branch.leafTurns[side > 0 ? 0 : 1]);
  const length = size * (1.65 + t * 0.2) * reveal;
  const breadth = size * 0.58 * reveal;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(length * .32, -breadth, length * .82, -breadth * .62, length, 0);
  ctx.bezierCurveTo(length * .75, breadth * .72, length * .28, breadth * .82, 0, 0);
  ctx.fillStyle = `rgba(${palette.leaf.join(",")},${alpha * .18})`;
  ctx.strokeStyle = `rgba(${palette.stem.join(",")},${alpha * .88})`;
  ctx.lineWidth = Math.max(.58, palette.lineWidth * .72);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(length * .08, 0);
  ctx.lineTo(length * .82, 0);
  ctx.strokeStyle = `rgba(${palette.stem.join(",")},${alpha * .45})`;
  ctx.lineWidth = .48;
  ctx.stroke();
  ctx.restore();
}

function drawLivingInkFlower(ctx, flower, reveal, palette, alpha) {
  if (reveal <= 0) return;
  const point = flower.point;
  const size = flower.size * (.68 + reveal * .32);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(flower.angle);

  const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.65);
  wash.addColorStop(0, `rgba(${palette.bloom.join(",")},${alpha * .11 * reveal})`);
  wash.addColorStop(1, `rgba(${palette.bloom.join(",")},0)`);
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.65, 0, Math.PI * 2);
  ctx.fill();

  for (let petal = 0; petal < 5; petal += 1) {
    const irregularity = .86 + seededNoise(flower.seed, petal, 1) * .24;
    ctx.save();
    ctx.rotate((petal / 5) * Math.PI * 2 - Math.PI / 2 + (seededNoise(flower.seed, petal, 2) - .5) * .16);
    ctx.scale(reveal, reveal);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * .32, -size * .34, -size * .28, -size * 1.04 * irregularity, 0, -size * 1.18 * irregularity);
    ctx.bezierCurveTo(size * .31, -size * 1.01 * irregularity, size * .35, -size * .34, 0, 0);
    ctx.fillStyle = `rgba(${palette.bloom.join(",")},${alpha * .12})`;
    ctx.strokeStyle = `rgba(${palette.bloom.join(",")},${alpha * .72})`;
    ctx.lineWidth = .76;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = `rgba(${palette.stem.join(",")},${alpha * .8})`;
  for (let dot = 0; dot < 5; dot += 1) {
    const angle = (dot / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * size * .18, Math.sin(angle) * size * .18, .7 + reveal * .65, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLivingInkScene(progress) {
  const canvas = els.livingInk;
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  const scene = state.livingInkScene;
  if (!scene?.mainSegments.length) return;
  const { palette } = scene;
  const settle = progress < .88 ? 1 : 1 - ((progress - .88) / .12) * .22;
  const alpha = .69 * settle;
  const vineProgress = clamp((progress - .035) / .61, 0, 1);
  const segmentCount = scene.mainSegments.length;

  scene.mainSegments.forEach((segment, index) => {
    const segmentProgress = clamp(vineProgress * segmentCount - index, 0, 1);
    const easedSegment = 1 - (1 - segmentProgress) ** 3;
    strokeLivingInkVine(ctx, segment, easedSegment, palette, alpha);

    [0.36, 0.67].forEach((t, leafIndex) => {
      const leafArrival = .12 + ((index + t) / segmentCount) * .56 + leafIndex * .025;
      const leafProgress = clamp((progress - leafArrival) / .14, 0, 1);
      const side = (index + leafIndex) % 2 === 0 ? segment.direction : -segment.direction;
      drawLivingInkLeaf(
        ctx,
        segment,
        t,
        segment.leafSize,
        side,
        1 - (1 - leafProgress) ** 2,
        palette,
        alpha
      );
    });
  });

  scene.connections.forEach((connection, index) => {
    const arrival = .1 + ((index + 1) / scene.connections.length) * .5;
    const connectionProgress = clamp((progress - arrival) / .16, 0, 1);
    strokeLivingInkVine(
      ctx,
      connection,
      1 - (1 - connectionProgress) ** 3,
      palette,
      alpha * .82,
      true
    );

    if (connectionProgress > 0 && progress < arrival + .25) {
      const washProgress = clamp((progress - arrival) / .25, 0, 1);
      const wash = ctx.createRadialGradient(connection.end.x, connection.end.y, 0, connection.end.x, connection.end.y, 18 + washProgress * 18);
      wash.addColorStop(0, `rgba(${palette.leaf.join(",")},${(1 - washProgress) * .07})`);
      wash.addColorStop(1, `rgba(${palette.leaf.join(",")},0)`);
      ctx.fillStyle = wash;
      ctx.fillRect(connection.end.x - 38, connection.end.y - 38, 76, 76);
    }
  });

  const flowerProgress = clamp((progress - .69) / .2, 0, 1);
  drawLivingInkFlower(
    ctx,
    scene.flower,
    1 - (1 - flowerProgress) ** 3,
    palette,
    alpha
  );
}

function clearLivingInk() {
  if (state.livingInkFrame !== null) window.cancelAnimationFrame(state.livingInkFrame);
  state.livingInkFrame = null;
  state.livingInkStartedAt = null;
  state.livingInkProgress = 0;
  state.livingInkScene = null;
  state.livingInkActive = false;
  state.livingInkSettled = false;
  const ctx = els.livingInk?.getContext("2d");
  ctx?.clearRect(0, 0, els.livingInk.clientWidth, els.livingInk.clientHeight);
  els.canvasFrame.classList.remove("is-line-awake");
}

function animateLivingInk(timestamp) {
  if (!state.livingInkActive || state.stage !== "writing") return;
  if (state.livingInkStartedAt === null) state.livingInkStartedAt = timestamp;
  state.livingInkProgress = clamp((timestamp - state.livingInkStartedAt) / livingInkDuration, 0, 1);
  drawLivingInkScene(state.livingInkProgress);
  if (state.livingInkProgress < 1) {
    state.livingInkFrame = window.requestAnimationFrame(animateLivingInk);
    return;
  }
  state.livingInkFrame = null;
  state.livingInkActive = false;
  state.livingInkSettled = true;
  syncCanvasFrameState();
}

function startLivingInkAnimation({ reduced = false } = {}) {
  clearLivingInk();
  const rect = els.canvasFrame.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || !state.strokes.length) return;
  sizeCanvas(els.livingInk, rect.width, rect.height);
  state.livingInkScene = createLivingInkScene(rect.width, rect.height);
  if (!state.livingInkScene?.mainSegments.length) return;
  state.livingInkActive = !reduced;
  state.livingInkSettled = reduced;
  state.livingInkProgress = reduced ? 1 : 0;
  syncCanvasFrameState();
  if (reduced) {
    drawLivingInkScene(1);
    return;
  }
  state.livingInkFrame = window.requestAnimationFrame(animateLivingInk);
}

function clearLineResponse() {
  if (state.lineResponseTimer !== null) window.clearTimeout(state.lineResponseTimer);
  state.lineResponseTimer = null;
  state.lineResponsePlayed = false;
  state.lineResponsePreserved = false;
  clearLivingInk();
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
    startLivingInkAnimation({ reduced: motionIsReduced });
    const narrative = narrativeFor();
    els.inkStatus.textContent = tr("lineReadyFor", { sender: narrative.sender, receiver: narrative.receiver });
    state.lineResponseTimer = window.setTimeout(() => {
      layer.classList.remove("is-line-breathing");
      layer.classList.add("is-line-preserved");
      state.lineResponsePreserved = true;
      els.pauseAction.textContent = tr("sendItOnward");
      syncCanvasFrameState();
      state.lineResponseTimer = null;
    }, motionIsReduced ? 0 : 5800);
  }, motionIsReduced ? 0 : 560);
}

function characterTargetDimensions(layout) {
  const isPhrase = layout.positions.length > 1;
  return {
    width: Math.max(112, layout.fontSize * 1.02),
    height: isPhrase
      ? Math.max(layout.fontSize * 0.92, Math.min(layout.step * 0.98, layout.fontSize * 1.14))
      : layout.fontSize * 1.14
  };
}

function pointInsideCharacterTarget(point, layout, index) {
  const position = layout.positions[index];
  if (!position) return false;
  const target = characterTargetDimensions(layout);
  const normalizedX = Math.abs(point.x - position.x) / (target.width / 2);
  const normalizedY = Math.abs(point.y - position.y) / (target.height / 2);
  return normalizedX ** 4 + normalizedY ** 4 <= 1;
}

function glyphAnalysisFor(layout, index) {
  const position = layout.positions[index];
  const target = characterTargetDimensions(layout);
  const width = Math.max(1, Math.ceil(target.width));
  const height = Math.max(1, Math.ceil(target.height));
  const cacheKey = `${position?.form || ""}:${Math.round(layout.fontSize)}:${width}:${height}`;
  if (glyphAnalysisCache.has(cacheKey)) {
    return { ...glyphAnalysisCache.get(cacheKey), position };
  }

  glyphAnalysisCanvas.width = width;
  glyphAnalysisCanvas.height = height;
  const ctx = glyphAnalysisCanvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.font = `400 ${layout.fontSize}px "Noto Traditional Nushu"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(position?.form || "", width / 2, height / 2);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const cellWidth = width / glyphGrid.columns;
  const cellHeight = height / glyphGrid.rows;
  const templateCells = [];

  for (let row = 0; row < glyphGrid.rows; row += 1) {
    for (let column = 0; column < glyphGrid.columns; column += 1) {
      const startX = Math.floor(column * cellWidth);
      const endX = Math.min(width, Math.ceil((column + 1) * cellWidth));
      const startY = Math.floor(row * cellHeight);
      const endY = Math.min(height, Math.ceil((row + 1) * cellHeight));
      let inkPixels = 0;
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          if (pixels[(y * width + x) * 4 + 3] > 24) inkPixels += 1;
        }
      }
      if (inkPixels >= 2) {
        templateCells.push({
          key: `${column}:${row}`,
          x: (column + 0.5) * cellWidth,
          y: (row + 0.5) * cellHeight
        });
      }
    }
  }

  const analysis = {
    target,
    templateCells,
    tolerance: Math.max(14, layout.fontSize * 0.13)
  };
  glyphAnalysisCache.set(cacheKey, analysis);
  return { ...analysis, position };
}

function nearestGuideCell(point, analysis) {
  if (!analysis.templateCells.length) return null;
  const localX = point.x - (analysis.position.x - analysis.target.width / 2);
  const localY = point.y - (analysis.position.y - analysis.target.height / 2);
  let nearest = null;
  let nearestDistance = Infinity;
  analysis.templateCells.forEach((cell) => {
    const distance = Math.hypot(localX - cell.x, localY - cell.y);
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  });
  return nearestDistance <= analysis.tolerance ? nearest : null;
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
    status.textContent = isCurrent ? `${number} · ${index === 0 ? tr("startHere") : tr("next")}` : number;
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
  layout.positions.forEach(({ x, y }, index) => {
    if (!pointInsideCharacterTarget(point, layout, index)) return;
    const normalizedX = Math.abs(point.x - x) / (target.width / 2);
    const normalizedY = Math.abs(point.y - y) / (target.height / 2);
    const distance = normalizedX ** 2 + normalizedY ** 2;
    if (distance < closestDistance) {
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
  const target = characterTargetDimensions(layout);
  const analysis = glyphAnalysisFor(layout, index);
  const coveredCells = state.characterCoveredCells[index] || new Set();
  const coveredTemplateCells = analysis.templateCells.filter((cell) => coveredCells.has(cell.key)).length;
  const coverageRatio = analysis.templateCells.length
    ? coveredTemplateCells / analysis.templateCells.length
    : 1;
  const guideSamples = state.characterGuideSamples[index] || { onGuide: 0, total: 0 };
  const onGuideRatio = guideSamples.total ? guideSamples.onGuide / guideSamples.total : 0;
  return isCharacterTraceComplete({
    distance,
    strokes,
    bounds,
    fontSize: layout.fontSize,
    targetWidth: target.width,
    targetHeight: target.height,
    pointerType: state.characterInputTypes[index] || "mouse",
    coverageRatio,
    onGuideRatio
  });
}

function settleCharacter(index) {
  if (index !== expectedCharacterIndex() || !characterIsReady(index) || state.completedCharacters.has(index)) return false;
  state.completedCharacters.add(index);
  const response = els.characterFeedbackLayer.querySelector(`[data-character-index="${index}"]`);
  if (response) {
    response.classList.add("is-settled");
    response.classList.remove("is-responding");
    void response.offsetWidth;
    response.classList.add("is-responding");
    window.setTimeout(() => response.classList.remove("is-responding"), 2400);
  }
  window.setTimeout(() => {
    if (state.completedCharacters.has(index) && state.stage === "writing") drawGuide();
  }, 620);
  const total = guideLayout(els.writing.clientWidth, els.writing.clientHeight).positions.length;
  const layout = guideLayout(els.writing.clientWidth, els.writing.clientHeight);
  const nextIndex = index + 1;
  const nextStartsColumn = nextIndex < total
    && layout.positions[nextIndex].column !== layout.positions[index].column;
  els.inkStatus.textContent = index === total - 1
    ? tr("progressReady", { total })
    : nextStartsColumn
      ? tr("progressNextColumn", { index: index + 1, total })
      : tr("progressContinue", { index: index + 1, total });
  state.activeCharacterIndex = null;
  syncCharacterTargets();
  revealWritingNarrative();
  syncCompletionControls();
  scheduleLineResponse(total);
  return true;
}

function beginCharacterStroke(point, pointerType) {
  if (!state.current || !hasStrokeGuide()) {
    state.activeCharacterIndex = null;
    state.revisingCompletedCharacter = false;
    return true;
  }
  const index = characterIndexAtPoint(point);
  if (!state.revisingCompletedCharacter && state.activeCharacterIndex !== null && state.activeCharacterIndex !== index) {
    settleCharacter(state.activeCharacterIndex);
  }
  const expected = expectedCharacterIndex();
  const startMode = characterStartMode({
    guided: true,
    hitIndex: index,
    expectedIndex: expected,
    hitCompleted: index !== null && state.completedCharacters.has(index)
  });
  if (startMode === "revision") {
    state.activeCharacterIndex = index;
    state.revisingCompletedCharacter = true;
    return true;
  }
  if (startMode === "blocked") {
    state.activeCharacterIndex = null;
    state.revisingCompletedCharacter = false;
    if (expected === null) {
      els.inkStatus.textContent = tr("progressReady", { total: totalForms() });
    } else {
      els.inkStatus.textContent = index === null
        ? tr("returnToForm", { index: expected + 1 })
        : tr("finishCurrentFirst", { index: expected + 1 });
      remindCharacterTarget(expected);
    }
    return false;
  }
  state.activeCharacterIndex = index;
  state.revisingCompletedCharacter = false;
  state.characterInputTypes[index] = pointerType || "mouse";
  state.characterStrokeCounts[index] = (state.characterStrokeCounts[index] || 0) + 1;
  return true;
}

function recordCharacterGuideCoverage(index, from, to, distance, layout) {
  const analysis = glyphAnalysisFor(layout, index);
  if (!analysis.templateCells.length || distance < 0.01) return;
  const coveredCells = state.characterCoveredCells[index] || new Set();
  const guideSamples = state.characterGuideSamples[index] || { onGuide: 0, total: 0 };
  const sampleSpacing = Math.max(3, layout.fontSize * 0.035);
  const steps = Math.max(1, Math.ceil(distance / sampleSpacing));

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const point = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    };
    if (!pointInsideCharacterTarget(point, layout, index)) continue;
    guideSamples.total += 1;
    const guideCell = nearestGuideCell(point, analysis);
    if (!guideCell) continue;
    guideSamples.onGuide += 1;
    coveredCells.add(guideCell.key);
  }

  state.characterCoveredCells[index] = coveredCells;
  state.characterGuideSamples[index] = guideSamples;
}

function trackCharacterInk(from, to, distance) {
  if (!state.current || !hasStrokeGuide()) return;
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const index = state.activeCharacterIndex;
  if (index === null || index !== expectedCharacterIndex()) return;
  const layout = guideLayout(els.writing.clientWidth, els.writing.clientHeight);
  const insidePoints = [from, midpoint, to]
    .filter((point) => pointInsideCharacterTarget(point, layout, index));
  if (!insidePoints.length) return;
  recordCharacterGuideCoverage(index, from, to, distance, layout);
  const countedDistance = creditedTraceDistance({
    distance,
    fontSize: layout.fontSize,
    insideSamples: insidePoints.length,
    totalSamples: 3
  });
  state.characterInkDistances[index] = (state.characterInkDistances[index] || 0) + countedDistance;
  const bounds = state.characterInkBounds[index] || { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  insidePoints.forEach((point) => {
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxY = Math.max(bounds.maxY, point.y);
  });
  state.characterInkBounds[index] = bounds;
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
    els.brushInput.textContent = tr("pressurePace");
    return;
  }
  els.brushInput.textContent = point.usesHardwarePressure
    ? point.pointerType === "touch" ? tr("touchPressure") : tr("stylusPressure")
    : point.pointerType === "mouse"
      ? tr("paceSensing")
      : point.pointerType === "pen" ? tr("stylusPace") : tr("touchPace");
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
  finishReleaseVisual({ announce: false });
  event.preventDefault();
  if (event.pointerType === "touch" || event.pointerType === "pen") {
    window.getSelection?.()?.removeAllRanges();
  }
  const rect = els.writing.getBoundingClientRect();
  const bounds = { x: 0, y: 0, width: rect.width, height: rect.height };
  const point = pointFromEvent(event, rect);
  if (!beginCharacterStroke(point, event.pointerType)) {
    updateBrushReadout(point);
    updateBrushCursor(point);
    return;
  }
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
  els.inkStatus.textContent = point.usesHardwarePressure
    ? tr("pressureDeepens")
    : tr("slowerFuller");
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
  state.revisingCompletedCharacter = false;
  syncCanvasFrameState();
  if (releaseCapture && pointerId !== null && els.writing.hasPointerCapture?.(pointerId)) {
    els.writing.releasePointerCapture(pointerId);
  }
}

function stopDrawing(event) {
  if (!state.drawing || event.pointerId !== state.activePointerId) return;
  event.preventDefault();
  drawEventSamples(event);
  const characterIndex = state.activeCharacterIndex;
  const wasRevision = state.revisingCompletedCharacter;
  finishActiveStroke();
  if (wasRevision) {
    state.activeCharacterIndex = null;
    const expected = expectedCharacterIndex();
    els.inkStatus.textContent = expected === null
      ? tr("progressReady", { total: totalForms() })
      : tr("revisionKept", { index: expected + 1 });
    return;
  }
  const completed = settleCharacter(characterIndex);
  if (hasStrokeGuide() && characterIndex !== null && !completed) {
    els.inkStatus.textContent = tr("traceMore", { index: characterIndex + 1 });
    remindCharacterTarget(characterIndex);
  }
}

function cancelDrawing(event) {
  if (!state.drawing || event.pointerId !== state.activePointerId) return;
  finishActiveStroke({ taper: false, releaseCapture: false });
  updateBrushCursor();
}

function snapshotTraceForRelease() {
  const source = els.writing;
  const target = els.releaseCanvas;
  if (!source || !target || source.width < 1 || source.height < 1) return false;
  target.width = source.width;
  target.height = source.height;
  const context = target.getContext("2d");
  if (!context) return false;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, target.width, target.height);
  context.drawImage(source, 0, 0, target.width, target.height);
  return true;
}

const releaseVisualDuration = 1480;

function seededReleaseRandom(seed) {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function sampledReleaseInk(random, limit = 150) {
  const source = els.releaseCanvas;
  const sampleScale = Math.min(1, 260 / Math.max(source.width, source.height));
  const sampleWidth = Math.max(1, Math.round(source.width * sampleScale));
  const sampleHeight = Math.max(1, Math.round(source.height * sampleScale));
  const sampler = document.createElement("canvas");
  sampler.width = sampleWidth;
  sampler.height = sampleHeight;
  const context = sampler.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(source, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const candidates = [];
  for (let y = 0; y < sampleHeight; y += 2) {
    for (let x = 0; x < sampleWidth; x += 2) {
      const offset = (y * sampleWidth + x) * 4;
      if (pixels[offset + 3] > 22) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return [];
  const points = [];
  const count = Math.min(limit, candidates.length);
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates[Math.floor(random() * candidates.length)];
    points.push({
      x: (candidate.x / sampleWidth) * source.width,
      y: (candidate.y / sampleHeight) * source.height
    });
  }
  return points;
}

function buildReleaseFanPanels() {
  if (!els.releaseFanPanels) return;
  els.releaseFanPanels.replaceChildren();
  const panelCount = window.innerWidth < 700 ? 9 : 13;
  const image = els.releaseCanvas.toDataURL("image/png");
  for (let index = 0; index < panelCount; index += 1) {
    const panel = document.createElement("span");
    const distanceFromCentre = Math.abs(index - (panelCount - 1) / 2);
    panel.className = "release-fan-panel";
    panel.style.left = `${(index / panelCount) * 100}%`;
    panel.style.width = `calc(${100 / panelCount}% + 1px)`;
    panel.style.backgroundImage = `url(${image})`;
    panel.style.backgroundSize = `${panelCount * 100}% 100%`;
    panel.style.backgroundPosition = `${panelCount === 1 ? 0 : (index / (panelCount - 1)) * 100}% 0`;
    const foldShift = (((panelCount - 1) / 2) - index) * 100;
    const foldTurn = index % 2 === 0 ? -82 : 82;
    panel.style.setProperty("--fold-shift-mid", `${foldShift * 0.72}%`);
    panel.style.setProperty("--fold-shift", `${foldShift}%`);
    panel.style.setProperty("--fold-turn-mid", `${foldTurn * 0.78}deg`);
    panel.style.setProperty("--fold-turn", `${foldTurn}deg`);
    panel.style.setProperty("--fold-delay", `${Math.round(distanceFromCentre * 12)}ms`);
    els.releaseFanPanels.append(panel);
  }
}

function prepareReleaseParticles(surface, seed) {
  const effects = els.releaseEffectsCanvas;
  const source = els.releaseCanvas;
  if (!effects || !source) return;
  effects.width = source.width;
  effects.height = source.height;
  effects.getContext("2d")?.clearRect(0, 0, effects.width, effects.height);
  const random = seededReleaseRandom(seed);
  const points = sampledReleaseInk(random, surface === "cloth" ? 170 : 135);
  const centreX = source.width / 2;
  const scale = Math.max(1, Math.min(source.width, source.height) / 520);
  state.releaseParticles = points.map((point, index) => ({
    x: point.x + (random() - 0.5) * 7 * scale,
    y: point.y + (random() - 0.5) * 7 * scale,
    delay: random() * (surface === "fan" ? 0.22 : 0.3),
    drift: (random() - 0.5) * (surface === "paper" ? 60 : 38) * scale,
    lift: (45 + random() * 105) * scale,
    size: (0.8 + random() * 2.8) * scale,
    length: (10 + random() * 32) * scale,
    phase: random() * Math.PI * 2,
    direction: point.x < centreX ? 1 : -1,
    axis: index % 3 === 0 ? "warp" : "weft"
  }));
  if (surface === "fan") buildReleaseFanPanels();
  else els.releaseFanPanels?.replaceChildren();
  state.releaseStartedAt = null;
}

function drawPaperRelease(context, progress, width, height) {
  const scale = Math.max(1, Math.min(width, height) / 520);
  state.releaseParticles.forEach((particle, index) => {
    const local = Math.max(0, Math.min(1, (progress - particle.delay) / (1 - particle.delay)));
    if (local <= 0 || local >= 1) return;
    const ease = 1 - ((1 - local) ** 3);
    const x = particle.x + particle.drift * ease + Math.sin(particle.phase + local * 9) * 4 * scale;
    const y = particle.y - particle.lift * ease;
    const alpha = Math.sin(Math.PI * local) * (1 - local * 0.3);
    if (index % 8 === 0 && local < 0.56) {
      const radius = particle.size * (5 + local * 7);
      const glow = context.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(240, 137, 54, ${alpha * 0.32})`);
      glow.addColorStop(1, "rgba(184, 61, 25, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = local < 0.48
      ? `rgba(189, 72, 31, ${alpha * 0.88})`
      : `rgba(60, 51, 42, ${alpha * 0.7})`;
    context.beginPath();
    context.arc(x, y, Math.max(0.7 * scale, particle.size * (1 - local * 0.55)), 0, Math.PI * 2);
    context.fill();
  });
}

function drawFanRelease(context, progress, width, height) {
  const scale = Math.max(1, Math.min(width, height) / 520);
  const centreX = width / 2;
  const gatherY = height * 0.9;
  state.releaseParticles.forEach((particle, index) => {
    const local = Math.max(0, Math.min(1, (progress - particle.delay) / (1 - particle.delay)));
    if (local <= 0 || local >= 1 || index % 2) return;
    const ease = local * local * (3 - 2 * local);
    const x = particle.x + (centreX - particle.x) * ease * 0.88;
    const y = particle.y + (gatherY - particle.y) * ease * 0.55;
    const alpha = Math.sin(Math.PI * local) * 0.7;
    context.save();
    context.translate(x, y);
    context.rotate(particle.phase + local * 2.4);
    context.fillStyle = `rgba(144, 94, 43, ${alpha})`;
    context.fillRect(-particle.size * 1.7, -0.45 * scale, particle.size * 3.4, 0.9 * scale);
    context.restore();
  });
}

function drawClothRelease(context, progress, width, height) {
  const scale = Math.max(1, Math.min(width, height) / 520);
  state.releaseParticles.forEach((particle) => {
    const local = Math.max(0, Math.min(1, (progress - particle.delay) / (1 - particle.delay)));
    if (local <= 0 || local >= 1) return;
    const ease = 1 - ((1 - local) ** 2);
    const travel = particle.direction * particle.length * 2.7 * ease;
    const x = particle.x + (particle.axis === "weft" ? travel : Math.sin(particle.phase + local * 8) * 5 * scale);
    const y = particle.y + (particle.axis === "warp" ? travel * 0.45 : Math.sin(particle.phase + local * 6) * 3 * scale);
    const alpha = Math.sin(Math.PI * local) * 0.76;
    context.strokeStyle = particle.axis === "warp"
      ? `rgba(247, 233, 207, ${alpha})`
      : `rgba(86, 65, 45, ${alpha * 0.8})`;
    context.lineWidth = particle.axis === "warp" ? 0.8 * scale : 1.15 * scale;
    context.beginPath();
    if (particle.axis === "warp") {
      context.moveTo(x, y - particle.length);
      context.quadraticCurveTo(x + Math.sin(particle.phase) * 7 * scale, y, x, y + particle.length);
    } else {
      context.moveTo(x - particle.length, y);
      context.quadraticCurveTo(x, y + Math.cos(particle.phase) * 6 * scale, x + particle.length, y);
    }
    context.stroke();
  });
}

function animateReleaseEffects(timestamp, surface) {
  if (!state.releaseInProgress || !els.releaseEffectsCanvas) return;
  if (state.releaseStartedAt === null) state.releaseStartedAt = timestamp;
  const progress = Math.min(1, (timestamp - state.releaseStartedAt) / releaseVisualDuration);
  const context = els.releaseEffectsCanvas.getContext("2d");
  if (!context) return;
  const { width, height } = els.releaseEffectsCanvas;
  context.clearRect(0, 0, width, height);
  if (surface === "paper") drawPaperRelease(context, progress, width, height);
  if (surface === "fan") drawFanRelease(context, progress, width, height);
  if (surface === "cloth") drawClothRelease(context, progress, width, height);
  if (progress < 1) {
    state.releaseFrame = window.requestAnimationFrame((nextTimestamp) => animateReleaseEffects(nextTimestamp, surface));
  } else {
    state.releaseFrame = null;
  }
}

function finishReleaseVisual({ announce = true } = {}) {
  if (state.releaseTimer !== null) window.clearTimeout(state.releaseTimer);
  if (state.releaseFrame !== null) window.cancelAnimationFrame(state.releaseFrame);
  state.releaseTimer = null;
  state.releaseFrame = null;
  state.releaseStartedAt = null;
  state.releaseParticles = [];
  const wasInProgress = state.releaseInProgress;
  state.releaseInProgress = false;
  els.releaseVisual.hidden = true;
  els.releaseCanvas.getContext("2d")?.clearRect(0, 0, els.releaseCanvas.width, els.releaseCanvas.height);
  els.releaseEffectsCanvas?.getContext("2d")?.clearRect(0, 0, els.releaseEffectsCanvas.width, els.releaseEffectsCanvas.height);
  els.releaseFanPanels?.replaceChildren();
  delete els.canvasFrame.dataset.releaseSurface;
  syncCanvasFrameState();
  if (wasInProgress && announce && !state.hasMarks && state.stage === "writing") {
    els.inkStatus.textContent = tr("releaseComplete");
  }
}

function requestWritingRelease() {
  if (!state.hasMarks) {
    els.inkStatus.textContent = state.current && !hasStrokeGuide()
      ? tr("pageOpen")
      : tr("beginFirstTop");
    return;
  }
  finishActiveStroke();
  syncReleaseDialogCopy();
  if (!els.releaseDialog.open) els.releaseDialog.showModal();
}

function confirmWritingRelease() {
  if (!state.hasMarks) {
    els.releaseDialog.close();
    return;
  }
  const surface = state.surface;
  const releaseSeed = (state.strokeCounter + 1) * 7919 + state.strokes.length * 101;
  const hasSnapshot = snapshotTraceForRelease();
  els.releaseDialog.close();
  state.releaseInProgress = hasSnapshot;
  els.releaseVisual.hidden = !hasSnapshot;
  if (hasSnapshot) {
    els.canvasFrame.dataset.releaseSurface = surface;
    prepareReleaseParticles(surface, releaseSeed);
  }
  clearWriting();
  if (!hasSnapshot) return;
  els.inkStatus.textContent = tr("releaseInProgress");
  const motionIsReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!motionIsReduced) {
    state.releaseFrame = window.requestAnimationFrame((timestamp) => animateReleaseEffects(timestamp, surface));
  }
  state.releaseTimer = window.setTimeout(
    () => finishReleaseVisual({ announce: true }),
    motionIsReduced ? 0 : releaseVisualDuration
  );
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
  state.revisingCompletedCharacter = false;
  state.characterInkDistances = [];
  state.characterStrokeCounts = [];
  state.characterInkBounds = [];
  state.characterInputTypes = [];
  state.characterCoveredCells = [];
  state.characterGuideSamples = [];
  state.completedCharacters = new Set();
  clearLineResponse();
  state.writingDistance = 0;
  state.revealedWritingLines = 0;
  syncGuideSizeControls();
  els.inkStatus.textContent = state.current && !hasStrokeGuide()
    ? tr("pageOpen")
    : tr("beginFirstTop");
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
  const stroke = strokeFor();
  const archiveSerif = state.language === "zh"
    ? '"Songti SC", "STSong", "Microsoft YaHei", serif'
    : "Georgia, serif";
  const archiveSans = state.language === "zh"
    ? '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    : "Arial, sans-serif";
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
  ctx.font = `22px ${archiveSans}`;
  ctx.letterSpacing = "3px";
  ctx.fillText("HELD IN INK", 70, 84);
  ctx.textAlign = "right";
  ctx.font = `42px ${archiveSerif}`;
  ctx.fillText("女书", cardWidth - 70, 87);
  ctx.textAlign = "left";
  ctx.letterSpacing = "0px";
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
  ctx.fillStyle = currentAccent();
  ctx.font = `650 15px ${archiveSans}`;
  ctx.fillText(tr("meaningLabel"), 70, 730);
  ctx.fillStyle = "#302d28";
  ctx.font = `36px ${archiveSerif}`;
  const meaningEnd = wrapText(ctx, `“${stroke.gloss}”`, 70, 770, cardWidth - 140, 42);
  const detailsTop = Math.min(846, meaningEnd + 34);
  ctx.fillStyle = "#645d52";
  ctx.font = `650 14px ${archiveSans}`;
  ctx.fillText(tr("hanTranscription"), 70, detailsTop);
  ctx.fillStyle = currentAccent();
  ctx.font = `21px ${archiveSerif}`;
  ctx.fillText(stroke.transcription, 70, detailsTop + 25);
  ctx.fillStyle = "#645d52";
  ctx.font = `650 14px ${archiveSans}`;
  ctx.fillText(tr("jiangyongReading"), 70, detailsTop + 54);
  ctx.fillStyle = currentAccent();
  ctx.font = `21px ${archiveSerif}`;
  ctx.fillText(stroke.phraseReading || tr("readingUnavailable"), 70, detailsTop + 79);
  ctx.fillStyle = currentAccent();
  ctx.font = `16px ${archiveSans}`;
  ctx.fillText(state.inputMode === "keyboard"
    ? tr("archiveKeyboard")
    : state.partialTrace
      ? tr("archivePartial")
      : tr("archiveHandwriting"), 70, 954);
  ctx.fillStyle = "#645d52";
  ctx.font = `14px ${archiveSans}`;
  const archiveStatus = stroke.status === "verified-digital-reconstruction"
    ? tr("archiveDocumented")
    : stroke.status === "dictionary-derived-reconstruction"
      ? tr("archiveProvisional")
      : tr("archiveOpen");
  ctx.fillText(archiveStatus, 70, 979);
  const link = document.createElement("a");
  link.download = `held-in-ink-${state.current.id}.png`;
  link.href = image.toDataURL("image/png");
  link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  let lineY = y;
  const tokens = state.language === "zh" ? Array.from(text) : text.split(/(\s+)/).filter(Boolean);
  tokens.forEach((token) => {
    const next = `${line}${token}`;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line.trimEnd(), x, lineY);
      line = token.trimStart();
      lineY += lineHeight;
    } else line = next;
  });
  ctx.fillText(line.trimEnd(), x, lineY);
  return lineY;
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
    els.inkStatus.textContent = tr("beginBeforeSend");
    return;
  }
  settleCharacter(state.activeCharacterIndex);
  const complete = lineIsComplete();
  if (!complete && !allowPartial) {
    const next = state.completedCharacters.size + 1;
    els.inkStatus.textContent = tr("incompleteLine", { index: next });
    remindCharacterTarget(Math.min(next - 1, Math.max(0, totalForms() - 1)));
    return;
  }
  clearLineResponse();
  captureWritingGeometry();
  state.partialTrace = !complete;
  state.sending = true;
  applyInputMode();
  els.guide.classList.add("is-faded");
  syncCanvasFrameState();
  els.inkStatus.textContent = complete
    ? tr("guideRecedes")
    : tr("partialRecedes");
  const motionIsReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(() => setStage("after"), motionIsReduced ? 0 : 1400);
}

function inkActionTarget(target) {
  const interactive = target instanceof Element
    ? target.closest("button:not(:disabled), a[href], summary")
    : null;
  return interactive?.closest("#writing-canvas") ? null : interactive;
}

const siteCursorMedia = window.matchMedia?.("(hover: hover) and (pointer: fine)");

function hideSiteInkCursor() {
  document.documentElement.classList.remove("has-site-ink-cursor");
  els.siteInkCursor?.classList.remove("is-visible", "is-over-action", "is-over-canvas", "is-pressing");
}

document.addEventListener("pointermove", (event) => {
  if (!els.siteInkCursor || !siteCursorMedia?.matches || event.pointerType !== "mouse") {
    hideSiteInkCursor();
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  const overCanvas = Boolean(target?.closest("#writing-canvas"));
  const overAction = Boolean(target?.closest("button:not(:disabled), a[href], summary, textarea, input, label, [role='button']"));
  els.siteInkCursor.style.left = `${event.clientX}px`;
  els.siteInkCursor.style.top = `${event.clientY}px`;
  els.siteInkCursor.classList.add("is-visible");
  els.siteInkCursor.classList.toggle("is-over-action", overAction && !overCanvas);
  els.siteInkCursor.classList.toggle("is-over-canvas", overCanvas);
  document.documentElement.classList.add("has-site-ink-cursor");
}, { passive: true });

document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") els.siteInkCursor?.classList.add("is-pressing");
}, { passive: true });

document.addEventListener("pointerup", () => {
  els.siteInkCursor?.classList.remove("is-pressing");
}, { passive: true });

window.addEventListener("blur", hideSiteInkCursor);
document.documentElement.addEventListener("mouseleave", hideSiteInkCursor);
siteCursorMedia?.addEventListener?.("change", () => {
  if (!siteCursorMedia.matches) hideSiteInkCursor();
});

function leaveInkActionMark(x, y, pressure = 0.48, pointerType = "mouse") {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const mark = document.createElement("span");
  const penPressure = pointerType === "pen" && Number.isFinite(pressure) && pressure > 0
    ? clamp(pressure, 0.16, 1)
    : 0.48;
  const size = 46 + penPressure * 42;
  mark.className = "ink-action-mark";
  mark.dataset.inkTemperament = document.body.dataset.scene || "threshold";
  mark.style.setProperty("--ink-x", `${x}px`);
  mark.style.setProperty("--ink-y", `${y}px`);
  mark.style.setProperty("--ink-size", `${size}px`);
  mark.style.setProperty("--ink-strength", String(0.42 + penPressure * 0.46));
  mark.style.setProperty("--ink-fade", String(0.22 + penPressure * 0.28));
  mark.style.setProperty("--ink-line", `${(0.8 + penPressure * 1.35).toFixed(2)}px`);
  mark.style.setProperty("--ink-turn", `${(Math.random() * 18 - 9).toFixed(2)}deg`);
  document.body.append(mark);
  mark.addEventListener("animationend", () => mark.remove(), { once: true });
  window.setTimeout(() => mark.remove(), 1100);
}

document.addEventListener("pointerdown", (event) => {
  if (!inkActionTarget(event.target) || event.button > 0) return;
  leaveInkActionMark(event.clientX, event.clientY, event.pressure, event.pointerType);
}, { passive: true });

document.addEventListener("click", (event) => {
  const inkTarget = inkActionTarget(event.target);
  if (inkTarget && event.detail === 0) {
    const rect = inkTarget.getBoundingClientRect();
    leaveInkActionMark(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.48, "keyboard");
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "toggle-language") setLanguage(state.language === "en" ? "zh" : "en");
  if (action === "enter-threshold" || action === "skip-threshold") {
    rememberThreshold();
    setStage("home");
  }
  if (action === "revisit-threshold") {
    hidePicker();
    if (els.about.open) els.about.close();
    setStage("threshold");
  }
  if (action === "home") {
    event.preventDefault();
    clearWriting({ resetInputMode: true });
    setStage("home");
  }
  if (action === "begin") setStage("writing");
  if (action === "change") showPicker();
  if (action === "close-picker") hidePicker();
  if (action === "clear") requestWritingRelease();
  if (action === "cancel-release") els.releaseDialog.close();
  if (action === "confirm-release") confirmWritingRelease();
  if (action === "toggle-input-mode") toggleInputMode();
  if (action === "attend-form") attendToNextForm();
  if (action === "pause") pauseWithMark();
  if (action === "pause-partial") pauseWithMark({ allowPartial: true });
  if (action === "archive") setStage("archive");
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
els.canvasFrame.addEventListener("selectstart", (event) => event.preventDefault());
els.canvasFrame.addEventListener("dragstart", (event) => event.preventDefault());
window.addEventListener("resize", () => {
  if (state.stage !== "writing") return;
  finishReleaseVisual({ announce: false });
  finishActiveStroke({ taper: false, releaseCapture: false });
  updateBrushCursor();
  setupWritingCanvases();
});

loadPrompts().catch((error) => {
  const message = document.createElement("p");
  message.className = "context-loading";
  message.setAttribute("role", "alert");
  message.textContent = tr("loadError");
  els.homeContextList.replaceChildren(message);
  console.error(error);
});
