# Lecture Note Taker: Build Tasks

Status: Plan approved by the user. Implementation tasks T01–T14 and delivery T16 are complete; the remaining real-device/cloud/long-spoken-lecture checks in T15 are pending. See [verification evidence](../docs/VERIFICATION.md).
Use SPEC.md for requirements and tasks/plan.md for architecture and boundaries.
After approval, checkpoints are verification milestones, not additional human gates.

## T01 — Establish the local project

- [x] Implemented T01.
- Acceptance: initialize an isolated Git repository in this workspace; exclude runtime data/secrets/models/outputs; verify Node/package manager; establish strict TypeScript and the required runnable scripts.
- Verify: development health endpoint; production build; typecheck; lint; a meaningful startup smoke test. Partition initial configuration if more than five files are needed.
- Dependencies: none.
- Likely files: package.json, package-lock.json, tsconfig.json, .gitignore, tooling configuration (split configuration work if needed).

## T02 — Design and render the app shell

- [x] Implemented T02.
- Acceptance: create a full primary-screen image concept; implement its tokens, sidebar, lecture workspace, and honest empty states; keyboard navigation and smaller-width layout work.
- Verify: built-in browser inspection and concept comparison; build/typecheck/lint; no artificial lectures or results.
- Dependencies: T01.
- Likely files: src/client/main.tsx, src/client/App.tsx, src/client/styles.css, index.html, work/design reference.

## T03 — Create and reopen lectures

- [x] Implemented T03.
- Acceptance: save title/course/vocabulary hints in SQLite; create and reopen a lecture through the UI; persistence survives a restart.
- Verify: storage/API integration tests and browser create/reload flow.
- Dependencies: T02.
- Likely files: src/shared/lecture.ts, src/server/storage.ts, src/server/lectureRoutes.ts, src/client/Library.tsx, tests/integration/lectures.test.ts.

## T04 — Upload validated audio

- [x] Implemented T04.
- Acceptance: stream MP3/M4A/WAV/WebM to disk; decode and enforce two-hour/2 GiB limits; retain valid original audio and reject invalid media clearly.
- Verify: supported-format and invalid-file tests; streamed size-boundary tests; UI upload result.
- Dependencies: T03.
- Likely files: src/server/audio.ts, src/server/uploadRoutes.ts, src/client/Upload.tsx, tests/integration/uploads.test.ts, tests/unit/audioLimits.test.ts.

## T05 — Play saved lecture audio

- [x] Implemented T05.
- Acceptance: serve audio with byte-range support; play/pause/seek/download work; reopened lecture retains its audio.
- Verify: range-response tests and real playback in browser.
- Dependencies: T04.
- Likely files: src/server/audioRoutes.ts, src/client/AudioPlayer.tsx, src/client/LectureWorkspace.tsx, tests/integration/playback.test.ts.

## T06 — Record the microphone reliably

- [x] Implemented T06.
- Acceptance: user-triggered record/pause/resume/stop with elapsed time and safe two-hour stop; persist ordered chunks idempotently; release microphone and expose permission/storage errors.
- Verify: recording state and chunk-retry tests; browser synthetic-audio capture and denied-permission flow; short real microphone check when permission is available.
- Dependencies: T05.
- Likely files: src/client/Recorder.tsx, src/client/recording.ts, src/server/recordingRoutes.ts, tests/unit/recording.test.ts, tests/e2e/recording.spec.ts.

### Checkpoint A

- [x] Capture and playback work; applicable checks pass; original audio persists without any AI credentials.

## T07 — Persist processing jobs

- [x] Implemented T07.
- Acceptance: one active job per lecture; persisted stages and per-chunk completion; interruption/retry preserves audio and successful work.
- Verify: duplicate-start, restart, retry, and disk-failure integration tests; visible honest status in UI.
- Dependencies: T06.
- Likely files: src/server/jobs.ts, src/server/jobRoutes.ts, src/shared/job.ts, src/client/ProcessingStatus.tsx, tests/integration/jobs.test.ts.

## T08 — Transcribe through free Groq

- [x] Implemented T08.
- Acceptance: cloud disabled until key/free-account setup is complete; valid sub-limit audio chunks return globally aligned segments; quota errors become recoverable waits.
- Verify: response/offset/overlap tests, quota waits, and a real spoken fixture with a confirmed Free-plan account when configured. Never request a key through chat.
- Dependencies: T07.
- Likely files: src/server/providers/groqTranscription.ts, src/server/chunkAudio.ts, src/client/Transcript.tsx, tests/unit/transcriptMapping.test.ts, tests/integration/cloudTranscription.test.ts.

## T09 — Generate detailed grounded notes

- [x] Implemented T09.
- Acceptance: detailed topic notes include definitions/examples from the transcript; long inputs use durable section work; unknown citations or malformed results are rejected.
- Verify: output-validation and long-input coverage tests; inspect notes against real spoken fixture; keep failed generations recoverable.
- Dependencies: T08.
- Likely files: src/server/providers/groqNotes.ts, src/server/notesPipeline.ts, src/client/Notes.tsx, src/shared/notes.ts, tests/integration/notes.test.ts.

### Checkpoint B

- [ ] Capture-to-notes path works with the configured cloud provider; quota/restart recovery tests pass. Record any unavailable real-provider checks explicitly.

## T10 — Add local transcription

- [x] Implemented T10.
- Acceptance: discover/check whisper.cpp and a compatible local model; safely run it on normalized chunks; return the same timestamp contract without cloud calls.
- Verify: parser/process-failure tests; actual local spoken-fixture transcription when model/tool setup is available; record hardware and performance limits.
- Dependencies: T09.
- Likely files: src/server/providers/localTranscription.ts, src/server/localTools.ts, src/server/providerSelection.ts, tests/unit/localTranscript.test.ts, tests/integration/localTranscription.test.ts.

## T11 — Add local note generation

- [x] Implemented T11.
- Acceptance: local Ollama readiness/model selection; detailed notes use the same citation validation; quota-bound cloud work can continue through a configured local engine without discarding completed work.
- Verify: unavailable-model and malformed-output tests; real local fixture; ensure local mode never routes to an Ollama cloud model or other cloud provider.
- Dependencies: T10.
- Likely files: src/server/providers/localNotes.ts, src/server/providerSelection.ts, src/client/EngineSelector.tsx, tests/integration/localNotes.test.ts, tests/integration/engineSwitch.test.ts.

## T12 — Preserve edits and regeneration drafts

- [x] Implemented T12.
- Acceptance: transcript/note edits persist; transcript edits mark notes stale; regenerated notes require explicit replacement before changing edited notes.
- Verify: revision persistence, concurrent job/edit behavior, and regeneration preservation tests; browser edit/reopen.
- Dependencies: T11.
- Likely files: src/server/revisions.ts, src/server/editRoutes.ts, src/client/Transcript.tsx, src/client/Notes.tsx, tests/integration/revisions.test.ts.

### Checkpoint C

- [x] Local mode and safe editing work; completed work remains recoverable. Explicitly identify any local-model checks not yet runnable.

## T13 — Finish lecture library operations

- [x] Implemented T13.
- Acceptance: search by title/course; export notes/transcript and download audio; explicit deletion removes only the selected lecture and its files/jobs.
- Verify: search/export tests, scoped deletion and active-job deletion tests; browser workflows.
- Dependencies: T12.
- Likely files: src/server/libraryRoutes.ts, src/server/exports.ts, src/client/Library.tsx, src/client/LectureActions.tsx, tests/integration/libraryActions.test.ts.

## T14 — Complete secure setup and recovery UI

- [x] Implemented T14.
- Acceptance: local setup screen stores/redacts server-side credentials and confirms Free plan; local readiness has actionable guidance; retry/wait/engine-switch errors are accessible and user-readable.
- Verify: missing credentials/models; same-origin/host checks; secret redaction; keyboard/status announcements. Setup scaffolding needed for T08 is built there and finalized here.
- Dependencies: T13.
- Likely files: src/server/settingsRoutes.ts, src/server/settings.ts, src/client/Settings.tsx, src/client/ProcessingStatus.tsx, tests/integration/settings.test.ts.

## T15 — Verify long lectures and browser behavior

- [ ] Complete T15.
- Acceptance: supported formats and two-hour pipeline retain beginning/middle/end; browser workflows and responsive layout pass; distinguish real-provider evidence from simulations.
- Verify: all applicable tests/build/typecheck/lint; desktop/smaller browser screenshots; concept-to-render comparison; real microphone and both provider paths when configured.
- Dependencies: T14.
- Likely files: tests/e2e/lectureWorkflow.spec.ts, tests/integration/longLecture.test.ts, tests/fixtures fixture manifest, work/verification notes, targeted defect fixes split into small tasks as needed.

### Checkpoint D

- [x] Acceptance evidence and remaining verification gaps are recorded. Missing credentials/tools/permissions are concrete blockers, not passed checks.

## T16 — Deliver launch instructions and results

- [x] Complete T16.
- Acceptance: document how to launch and configure the app; provide outputs with verified behavior and material limits; leave project clean of temporary QA assets and committed secrets.
- Verify: launch from the documented instructions; inspect Git status and deliverable links; report any remaining unmet acceptance criteria.
- Dependencies: T15.
- Likely files: README.md, outputs/START-HERE.md, outputs/VERIFICATION.md, tasks/todo.md.

## Remaining verification

- T06: synthetic microphone capture, pause/resume, device release, permission denial, and retry pass. Physical microphone capture needs the user to record a clip in their browser.
- T08 / Checkpoint B: cloud adapter and quota handling are implemented and tested with simulated responses. Live Groq Free-plan transcription, notes, and engine switching await a key entered securely in Settings.
- T15: two-hour media splitting, first/middle/last chunk decoding, transcript section coverage, all supported formats, and the exact streamed 2 GiB boundary pass. A full two-hour spoken lecture, boundary timestamp accuracy against speech, sustained two-hour microphone capture, and actual disk exhaustion remain unverified.
- Local AI was verified on an actual 39.5-second synthesized spoken sample; it was not a classroom or physical microphone recording. Note accuracy remains subject to review.
- Package restoration uses the pinned pnpm lockfile, instead of the proposed npm lockfile. Audio chunks do not overlap, so overlap duplicates are not introduced; recognition around hard chunk boundaries still needs the representative speech check.
