# Prototype source notes

These links informed the real-character and material updates in this prototype. They are a design-research record, not a substitute for full thesis citations or cultural review.

- [Unicode Nüshu Source Data](https://www.unicode.org/Public/17.0.0/ucd/NushuSources.txt): standardized source references and representative readings, including `sai21` for `𛉡` (U+1B261).
- [Unicode Nüshu encoding proposal (WG2 N3337)](https://www.unicode.org/L2/L2007/07303-n3337.pdf): records attested Han-character correspondences for the `sai21` syllable, including `信` and `送`.
- [Online Nushu Dictionary](https://nushuscript.org/en-US/): explains that Nüshu is syllabic, rather than a one-to-one logographic equivalent of Chinese, and records use on fans, paper, handkerchiefs, and textiles.
- [UNESCO — Nüshu: from tears to sunshine](https://www.unesco.org/en/articles/nushu-tears-sunshine-0): describes third-day missives, correspondence between sworn sisters, and historical presence on paper, fans, clothes, handkerchiefs, and belts.
- [Academia Sinica digital collection — Nüshu third-day-letter handkerchief](https://havefun.asdc.sinica.edu.tw/content/repository/resource_content.jsp?oid=4364459): preserves the Han transcription and provenance of a third-day letter associated with Chen Shibian, including the line `薄文傳聲信`.
- [Fei-wen Liu, “Literacy, Gender, and Class” (2004)](https://www.ioe.sinica.edu.tw/WebTools/FilesDownload.ashx?Menuid=530167136406372131&Pname=2004+nan6-2_liu_090904.pdf&Siteid=530167135246736660&fd=ResearcherPublication): translates and analyses the Heyuan Village passage, including its appeal for sisterhood to persist after marriage.
- [Orie Endo, *Inscribing Intimacy*](https://deepblue.lib.umich.edu/items/5b196955-cb60-490e-90db-64717fa24eba): records meeting He Yanxin in 1994 and the return of her Nüshu practice after a long gap.
- [Oxford Academic — “He Yanxin: Calling and Recalling the Sentiments of Nüshu”](https://academic.oup.com/book/25548/chapter-abstract/192849746): bibliographic record for the chapter on He Yanxin.
- [The Paper — “Land and deities: Jiangyong, Nüshu and sister goddesses”](https://www.thepaper.cn/newsDetail_forward_5187608): journalistic source used for the reported Han transcriptions and the oral-memory context of the handkerchief and Huashan Temple song cards.
- [Fei-wen Liu, “From being to becoming” (2004)](https://www.ioe.sinica.edu.tw/WebTools/FilesDownload.ashx?Menuid=530167136406372131&Pname=2004+From+being+to+becoming+PDF.pdf&Siteid=530167135246736660&fd=ResearcherPublication): analysis of Nüshu genres, sentiment, and the song attributed to Cizhu.
- [Sohu secondary publication](https://www.sohu.com/a/166175656_488835): secondary Chinese source reproducing the Han transcription `要凭女书诉苦情`; it is labeled as secondary in the interface and should be replaced if a primary text record becomes available.
- [Noto Traditional Nushu](https://notofonts.github.io/nushu/): source of the bundled standardized digital typeface used for the guides. Copyright 2022 The Noto Project Authors; distributed under the SIL Open Font License 1.1, reproduced at `assets/fonts/OFL.txt`.

The per-context records in `content.json` state which source supports a transcription, social-context note, or standardized reconstruction. A link in this file alone does not authorize an image or recording for display.

The material visuals are abstract interface treatments. They must not be described as facsimiles, historic artefacts, or evidence of a particular individual’s handwriting. The contextual layer currently contains no historical image, artefact photograph, or audio recording.

The phrase `𛉖𛆂𛈆𛉂𛉡` is a normalized digital reconstruction of `薄文傳聲信`, assembled from standardized Unicode forms and their documented Han-character correspondences. It is not a diplomatic transcription or facsimile of the historical hand. The interface gloss “This light letter carries my voice” is intentionally concise and interpretive; it is not presented as a literal scholarly translation.

The other three cards retain attested or reported Han transcriptions and now show explicitly provisional, dictionary-derived sequences. They were assembled by comparing the *Dictionary of Nushu Standard Characters* readings exposed by the Online Nushu Dictionary with Unicode form-to-Han correspondences. They are not transcriptions of the source handkerchief, song manuscript, or historical handwriting:

- `寄到国外相会身` → `𛉓𛇼𛈅𛇒𛉵𛆴𛈛`. Standardized alternatives exist for `寄` and `到`, and `会` has several dialect readings.
- `要凭女书诉苦情` → `𛅺𛋆𛆁𛈬𛉅𛇰𛊭`. The published Han line is secure, but the readings associated with `凭` and `诉` differ between the two reference systems.
- `把笔修书拜贵神` → `𛊷𛇞𛉪𛈬𛇣𛋫𛋙`. The line survives here through reported oral memory; `把` has multiple standardized correspondences, while the readings listed for `贵` and `神` diverge across the reference tables.

For this reason, these records use `dictionary-derived-reconstruction`, not `verified-digital-reconstruction`. The interface exposes that uncertainty in each story’s historical-grounding panel.

Lian and Yue, Xiu and Zhen, Cai and Gui, and Qiao and Lan are fictional characters. Their private rooms, gestures, conversations, relationships, and journeys are historical imaginings written for the interaction. The documented or reported lines, material practices, social genres, and historical figures named in the source notes remain distinct from those invented characters. The third card places a Cizhu-attributed song line inside an imagined exchange without recasting it as a surviving private letter; the fourth makes Lan the carrier while the goddess remains the prayer’s final addressee.
