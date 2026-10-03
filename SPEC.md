# Spec: Lecture Note Taker

Status: Product requirements approved by the user on 2026-10-01. Implementation plan approved by the user. The app has been built; remaining acceptance checks are recorded in outputs/VERIFICATION.md.
Date: 2026-10-01

## Objective

Build a laptop web app that turns a microphone recording or uploaded lecture audio into a transcript and organized study notes. Success means a user can capture a lecture, generate notes, verify them against the recording, edit them, and reopen them later.

Treat this as one integrated lecture-processing capability. Recording, transcription, and note generation are stages of the same user workflow, rather than separate products or public modules.

### Confirmed requirements

- Laptop web application.
- Record the microphone.
- Accept existing audio uploads.
- Transcribe lectures and generate organized study notes.
- Support lectures up to two hours.
- Generate detailed notes with definitions and examples.
- Prefer free cloud AI; use local processing when free cloud processing is unavailable. Do not use paid AI services.

### Approved defaults

- Personal use by one person; application served locally on this laptop.
- English lectures initially.
- Generate transcripts and notes after recording ends or an upload completes.
- Save audio, transcript, notes, and lecture metadata on the laptop.
- Target current desktop Chrome and Edge; keep the layout usable at smaller widths.
- User keeps the recording tab open and the laptop awake during recording.
- No accounts, sharing, public deployment, live transcription, screen recording, computer audio capture, or direct Notion integration in version one.

### Processing decision

Propose Groq's Free plan for timestamped transcription and text-based note generation. Use only an account confirmed to be on its Free plan; do not add billing or use a Developer-plan key. Free quotas and account eligibility are external constraints, not guarantees of unlimited service. Establish free eligibility during setup before any lecture request; if that cannot be established, keep cloud processing disabled and use the local path.

Local fallback: whisper.cpp for transcription and a locally running Ollama model for notes. This requires one-time model downloads and a hardware compatibility check. Choose model sizes after that check; local processing speed and note quality remain unverified. Read-only hardware discovery was unavailable in the current environment, so this spec does not assert that a particular local model will run well.

If a quota is exhausted, preserve the recording and completed work and let the user wait or switch to the configured local engine. Never fall back to a paid service. Allow local mode explicitly even when cloud mode is available.

### Approved implementation assumptions

- No technology preference was supplied; use the proposed stack below.
- Personal-use, English, local-serving, and after-recording defaults are included in the approved requirements.

## User workflow and feature requirements

1. Create a lecture with a title and optional course label and vocabulary hints.
2. Choose Record microphone or Upload audio.
3. Record: request microphone access only after the user starts; show recording state, elapsed recorded time, pause/resume, and stop controls. Stop releases microphone access. Permission denial leaves upload available.
4. Upload: accept MP3, M4A, WAV, and WebM initially; verify that the file contains decodable audio. Accept audio up to 7,200 seconds and files up to 2 GiB, with streaming uploads rather than loading the entire file into server memory. Reject invalid, empty, oversized, or over-duration inputs with a clear explanation. Warn as recording approaches the duration limit and stop safely at that limit.
5. Save the original audio and make it playable and downloadable before AI processing. Persist recording chunks periodically; document and test recovery limits rather than promise full crash recovery.
6. Show processing stages: preparing audio, transcribing, generating notes, ready, or failed. Only display measured progress; do not invent percentages or completion times.
7. Present editable transcript segments with timestamps and an audio player. Selecting a timestamp seeks to the corresponding part of the recording.
8. Generate detailed notes grouped by lecture topic, with a short opening summary, explanations of key concepts, definitions, examples actually present in the lecture, and formulas or processes where stated. Preserve useful detail rather than reduce a two-hour lecture to a few generic bullets. Flag missing definitions rather than invent them. Flashcards and review questions are outside the initial scope unless requested later.
9. Attach transcript segment references to substantive notes. Validate those references before display; label notes as AI generated. Mark unclear content without supplying invented facts, formulas, or quotations.
10. Save edits. Editing a transcript marks generated notes as potentially out of date; regenerating notes must not silently overwrite user edits.
11. Show a searchable lecture history with title, course, date, and processing status. Reopening a lecture restores audio, transcript, and notes.
12. Export notes as Markdown and transcript as text. Delete a lecture only after an explicit user action, and remove its local audio, transcript, notes, and temporary processing files.

## Tech stack

Approved stack proposal (installed versions and launch instructions are now documented in README.md):

- React + TypeScript + Vite for the browser interface.
- Node.js + TypeScript for a backend bound to localhost.
- SQLite for lecture metadata, transcript segments, notes, and job status; local files for audio.
- Browser getUserMedia and MediaRecorder for microphone capture, with runtime audio-format support checks.
- FFmpeg for validated audio decoding, normalization, and independently decodable chunks. Do not split encoded audio by arbitrary byte offsets.
- Provider adapters for free cloud and local processing. Proposed cloud models: Groq whisper-large-v3-turbo for timestamped transcription and openai/gpt-oss-20b hosted by Groq for note generation; model names are configuration, and availability must be rechecked during setup. Keep keys on the server. The cloud choice uses Groq's API, not a paid OpenAI API.
- Local whisper.cpp and Ollama adapters with the same transcript/note contracts. Configure installed binaries and model names on the server; choose and document model sizes after the hardware check. Do not automatically install system-wide tools or large models during specification.
- Vitest for unit/integration tests and Playwright for targeted browser tests.

Choose compatible package versions and record them in a lockfile during implementation. No dependency installation or model download is part of the spec phase. Record local model download sizes and hardware requirements during setup; use only local Ollama models for the fallback.

## Commands

These are the scripts the implementation must provide; they are not executable in this empty project yet:

```text
npm install
npm run dev -- --host 127.0.0.1
npm run build
npm run start -- --host 127.0.0.1
npm run typecheck
npm run lint
npm run test -- --run
npm run test:e2e
```

## Project structure

```text
SPEC.md                    Approved requirements
src/client/                Browser pages, components, recording, and playback
src/server/                Local API, job orchestration, storage, and providers
src/shared/                Validated data contracts and common types
tests/unit/                Validation, timestamp mapping, and state transitions
tests/integration/         Processing, persistence, retries, and deletion
tests/e2e/                 Main browser workflows
data/                      Ignored runtime database and audio, never committed
tasks/                     Implementation plan and tasks after spec approval
outputs/                   User-facing spec copy and later deliverables
```

## Code style and data contracts

Use strict TypeScript, named domain types, camelCase functions, and PascalCase React components. Validate input and provider output at runtime. Keep provider calls and file access outside UI components.

```ts
type TranscriptSegment = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

type StudyNote = {
  heading: string;
  body: string;
  sourceSegmentIds: string[];
};
```

Preserve original transcript segment identifiers when text is edited. Apply chunk offsets to timestamps and handle duplicate overlap explicitly. Notes reference existing segment IDs; models must not invent timestamps.

## Processing and reliability

- Save audio before submitting a processing job. A failed job must not destroy the source.
- Compress or split long recordings to the chosen provider's verified limits. Track chunk offsets and ordering, preserve useful boundary context, and retain completed transcription work for retry.
- For free Groq transcription, prepare independently decodable chunks below 25 MB. Its published baseline audio budget is two hours per hour and eight hours per day, subject to account-specific limits. Chunk overlap and retries also consume quota, so a two-hour lecture may need to wait for a quota reset. Serialize requests, respect retry-after, and persist waiting jobs instead of repeatedly resubmitting them.
- Budget note-generation requests against the chosen model's input/output and account rate limits. Process a long transcript in sections and persist section notes before the final assembly. No free-tier latency guarantee.
- For long transcripts, summarize sections with source references before generating final notes; preserve the beginning, middle, and end rather than truncate silently.
- Retry transient failures with a bounded policy; expose manual retry. Do not automatically rerun successfully completed stages and consume quota again.
- On local-server restart, unfinished jobs become interrupted and recoverable; they must not appear complete.
- If microphone access, storage, media decoding, credentials, networking, or provider output fails, show a specific actionable message. Never substitute demo content for a failed real lecture.
- Keep the UI responsive during recording and processing. Set processing performance targets after measuring the chosen provider or local hardware, rather than promise a fixed turnaround.

## Testing strategy and acceptance criteria

- Record a real short microphone clip, pause/resume, stop, play it back, and confirm the microphone is released.
- Reject microphone permission and still complete the upload workflow.
- Upload valid samples in each supported format; reject invalid files without crashing or creating a ready lecture.
- With the chosen provider configured, process a real sample end to end and inspect transcription and note quality against known spoken content. Provider mocks verify failure paths but do not replace this test.
- Test a two-hour lecture with a representative fixture. Confirm first, middle, and final content is retained and timestamp seeking remains within two seconds at chunk boundaries. Exercise the 2 GiB file-size boundary through streamed validation without requiring a large tracked fixture.
- Verify the free-cloud path with a confirmed Free-plan account and the local path with installed local models. Quota exhaustion leaves a resumable waiting job and offers local mode; it never invokes a paid service. If either engine cannot be verified, report that limitation rather than claim the full fallback works.
- Unit-test offset mapping, overlap handling, output validation, unknown source references, duration/size limits, and allowed job transitions.
- Integration-test provider timeouts, partial transcription retries, disk-write failures, restart recovery, and local deletion.
- Confirm transcript and note edits survive browser reload and local-server restart. Confirm regeneration preserves edited notes until replacement is explicitly chosen.
- Verify library search, lecture reopening, Markdown/text exports, and deletion.
- Verify keyboard operation, visible focus, readable labels, accessible status announcements, and no horizontal overflow at 1280px and 768px viewport widths.
- Confirm credentials never enter browser bundles or logs. A missing credential or local model shows setup guidance and does not show invented results.
- Pass build, typecheck, lint, targeted tests, and browser verification before declaring the version complete. No arbitrary coverage percentage; cover the meaningful behavior above.

## Boundaries

Always: save source audio before processing; protect API credentials; validate files and generated content; keep notes grounded in the transcript; preserve user edits; make errors and processing status visible; test real browser behavior.

Ask first: change the no-paid-services requirement; deploy publicly; add accounts or external integrations; make destructive changes to existing user data; change approved product scope. Free cloud processing and a local fallback are within the requested scope; routine dependency choices do not require repeated approval.

Never: enable billing or make paid AI calls; record without a user action; expose keys in browser code; commit recordings or secrets; invent lecture material to fill missing content; claim perfect transcription or guaranteed crash recovery; mark partial or failed work ready.

## Reference constraints checked on 2026-10-01

- Browser microphone access requires user permission and a secure context; localhost qualifies. See [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- Browser recording controls and runtime format checks are documented in [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).
- Groq's [Free-plan rate limits](https://console.groq.com/docs/rate-limits) publish model-specific audio and token quotas; actual account limits must be verified.
- Groq's [speech-to-text guide](https://console.groq.com/docs/speech-to-text) documents a 25 MB free-tier request limit and segment timestamps. This request limit is distinct from the application's file-size limit.
- Groq's [billing FAQ](https://console.groq.com/docs/billing-faqs) distinguishes Free and paid Developer plans. Never upgrade as part of this application setup.
- Local engine references: [whisper.cpp](https://github.com/ggml-org/whisper.cpp) and [Ollama's local API](https://docs.ollama.com/api/introduction). Hardware performance still requires measurement.

## Approval

The user approved these requirements on 2026-10-01 and requested an implementation plan for review. Coding begins after plan approval. No lecture audio has been sent to a provider.
