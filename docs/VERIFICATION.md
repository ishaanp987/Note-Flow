# Lecture Notes — verification report

Date: 2026-10-02. Implementation is delivered and the local app is ready. Full acceptance remains pending the live checks listed below; no simulated provider response is counted as real transcription or note generation.

## Passed checks

| Area | Evidence |
| --- | --- |
| Automated code checks | 27 Vitest unit/integration tests passed; strict TypeScript, lint, and production build passed. Build emits benign warnings from dependency directives/comments. |
| Browser workflows | Six Playwright workflows passed in an isolated app on port 3101: upload/playback/reload/search/delete; synthetic microphone pause/resume/stop/release; denied permission; failed chunk-save retry; responsive layouts; transcript/note edits, reopening, export and timestamp seeking. |
| Real local transcription | whisper.cpp v1.9.2 with small.en-q5_1 transcribed the 39.5-second `cells.wav` spoken fixture into nine timestamped segments. Definitions, diffusion/oxygen example, osmosis, and active transport were recovered. |
| Real local notes | Local Ollama v0.35.1 / qwen3:4b generated topic notes and an additional evidence review on the actual transcript. The user-facing app displayed real results and a regeneration draft, which was reviewed and accepted. |
| Original audio and playback | Actual uploads and browser-recorded audio played; range responses and seeking were exercised. The quota-failure test verifies that saved original bytes remain identical. Recording chunks survive interruption and idempotent retries. |
| Saving and editing | SQLite reopening/restart recovery passed. Revisions reject stale saves. Edited transcripts mark notes stale; regenerated drafts preserve saved edits until replacement. Concurrent transcript corrections cannot repopulate an outdated generation cache. Unsaved edits block app view changes and warn on leaving the tab. |
| Export and library | Browser note and transcript downloads contained saved edits; timestamp links sought the actual player. Search and explicit deletion worked in the isolated test library. Deletion scope and refusal during recording were tested. The personal library is empty after removal of the disposable verification lecture. |
| Supported formats | WAV, MP3, M4A and WebM were decoded and normalized with their durations retained. Invalid audio was rejected. |
| Two-hour media handling | A 7,200-second silent WAV (~230 MB) was streamed into twelve independently decodable ten-minute chunks. First, middle and last chunks decoded with correct offsets and stayed below 25 MB. This is a media test, not a two-hour speech accuracy test. |
| Streamed file boundary | Exactly 2 GiB was accepted by the streaming limiter; one additional byte was rejected. A reused 16 MiB buffer exercised the full counter without a large fixture or full-file memory allocation. |
| Quota recovery | Simulated quota responses preserve transcripts, section candidates and reviewed sections. Both numeric and HTTP-date Retry-After waits are honored without automatic resubmission. Review retry reuses its saved candidate. A cloud quota can be bypassed only by choosing the installed local engine, never a paid provider. |
| Secure setup | Localhost Host checks, same-origin checks, mutation tokens, secret redaction and no persisted API key were tested. Cloud is disabled without a key and Free-plan confirmation. Ollama local-model names are checked; the launcher binds it to localhost with cloud disabled. |
| Launch and stop | The delivered start shortcut launched the production app and local AI; the stop shortcut verified process identities and stopped their trees. Relaunch succeeded. No system installation, startup task, billing setup or security-policy changes were made. |

Local processing performance depends on the chosen hardware, model and input length. The short-fixture checks do not establish a turnaround time for full lectures.

## Note accuracy finding

The first real result expanded the osmosis definition and membrane purpose beyond what the sample stated. A separate evidence review was added and actually tested. It removed those unsupported additions and retained the speaker's definitions and oxygen example. It also omitted a useful final comparison about diffusion not requiring energy. The transcript retained that comparison. Evidence review reduces unsupported additions but does not guarantee complete or error-free notes; timestamp/source review and editing remain necessary. Frozen results in `tests/fixtures` are used only for reproducible editor/export tests and are never a production fallback.

## Remaining acceptance checks

- **Physical microphone:** synthetic-device recording and device release passed. The user still needs to record a short clip in Chrome or Edge, pause/resume/stop, listen to it, and confirm their actual microphone works.
- **Live free Groq:** no API key was supplied. No live Groq request, full free-cloud pipeline, real cloud quota exhaustion, or actual cloud-to-local handoff was verified. Enter the key securely in Settings and confirm the Free plan before testing. Free status is a user confirmation; the app cannot inspect account billing independently.
- **Representative two-hour lecture:** no full spoken classroom fixture was provided. End-to-end model coverage/accuracy at two hours and timestamp accuracy around hard chunk boundaries remain unverified. Chunks are contiguous, with no overlap duplicates; recognition context across boundaries may need improvement after that check.
- **Sustained long recording and real storage exhaustion:** a physical two-hour capture and a full disk were not exercised. Automatic time limits, streaming limits, chunk persistence, failure statuses and simulated retry paths are implemented; these do not substitute for those laptop checks.
- **Accessibility:** semantic controls, labels, focus styling, status announcements, keyboard-accessible recording/editing and smaller layouts were checked. A full screen-reader audit was not performed. No public deployment or remote access was tested or enabled.

These are outstanding T15 checks, not passed gates. T06/T08 implementation is complete, with the corresponding live checks pending. T16 delivery includes launch instructions and this evidence report.

## Browser and design verification

The primary interface was checked in the Codex in-app browser first. The accepted image concept is [DESIGN-CONCEPT.png](DESIGN-CONCEPT.png); the final full-page Chromium test screenshot is [APP-PREVIEW.png](APP-PREVIEW.png). Both were inspected directly with `view_image`. The CSS viewport was checked at the concept's native 1536 × 1024 size; browser workflow tests also covered widths 1280, 768 and 390.

IAB was used for the real upload, processing, notes/draft review and visual comparison. Its final full-page screenshot API failed twice after the bundled font was added; its normal preview still worked. The final complete preview was therefore captured with Playwright Chromium at 1536 × 1024, with the same code and font, in the isolated test app. Its upload chooser was slow and it did not provide the synthetic-device controls needed for repeatable microphone tests, so automated Chromium tests covered those cases in a separate local test app. They did not access a physical microphone or use live cloud credentials.

| Comparison point | Final inspection |
| --- | --- |
| Layout | 314 px sidebar, thin top bar, centered 943 px workspace; metadata → capture → status → document tabs → empty notes → footer order retained. |
| Typography | Inter is bundled locally, with its OFL license, so headings, labels, body text and controls use the same font offline. Heading hierarchy and compact utility text match the concept. |
| Palette | White main canvas, cool pale sidebar, dark text, muted captions and teal actions/selection; no added warm tint or decorative panels. |
| Spacing | Brand/navigation, heading/metadata gaps, capture tabs, note tabs and footer positions were compared and corrected. The complete empty state fits the native viewport. |
| Component treatment | Thin borders, modest corner radius, restrained outline book/microphone/document/settings icons, mint microphone circle and underline tab selection retained. |
| Copy and interactions | All concept labels and instructional text remain. Record/upload, study-note/transcript tabs, Settings, library, exports and timestamps are functional. |

Above-the-fold copy diff: one required addition, **Vocabulary hints (optional)**, from SPEC.md. No unrelated headline, marketing copy, metrics or seeded lectures were added. Intentional differences: unavailable recording/export actions are disabled until the title/content exists; saved lectures show their course, date and real processing status; processing, playback, editing and setup states extend the same visual system. Image-generated texture and raster font antialiasing are not reproduced in the native controls.

The implementation was faithfully verified against the accepted design for layout, hierarchy, typography, palette, components and copy, with these functional deviations recorded. Material spacing and font-fallback drift were fixed. No material visual mismatch remains in the primary empty workspace. The [local result screenshot](LOCAL-NOTES-PREVIEW.png) documents the actual tested AI result.

## Reference documentation

Provider capability and setup checks used official [Groq speech documentation](https://console.groq.com/docs/speech-to-text), [Free-plan rate limits](https://console.groq.com/docs/rate-limits), [GPT-OSS model documentation](https://console.groq.com/docs/model/openai/gpt-oss-20b), [whisper.cpp](https://github.com/ggml-org/whisper.cpp), and [Ollama](https://github.com/ollama/ollama). Quotas, model availability and account limits can change; documentation checks do not replace a live account test.

Runtime recordings, keys, models, tools, exports and temporary test data are excluded from Git. The durable test fixture contains only synthesized public-domain sample wording and genuinely generated local results. Package versions are pinned in `pnpm-lock.yaml`.
