# Implementation Plan: Lecture Note Taker

Status: Approved by the user. Implementation delivered; remaining live acceptance checks are recorded in outputs/VERIFICATION.md.
Date: 2026-10-01
Execution: After plan approval, complete tasks sequentially without routine approval between tasks. Pause only for required user input, actual permission blocks, or changes outside the approved scope.

## Outcome

A local laptop web app that records or uploads lectures of up to two hours, produces editable timestamped transcripts and detailed study notes, and saves the original audio and results. Free Groq processing is preferred; a configured local engine provides an alternative when free cloud processing is unavailable. No billing, paid AI calls, public deployment, or fabricated results.

## Baseline when this plan was written

- Workspace contains SPEC.md and its user-facing copy; no app or existing tests.
- This directory is not a Git repository. Initialize an isolated repository here during foundation work and commit only named project files. Do not create a repository in the parent Documents directory.
- Node is available. Locate its package-manager entry point and verify the runtime before setup; npm was not resolved as a standalone command during the initial check.
- FFmpeg, whisper.cpp, Ollama, model files, API credentials, and hardware capability have not been verified.
- A read-only hardware query was denied in the current environment. Do not infer RAM or GPU capacity from that failure.

## Architecture decisions

1. **Local browser interface and server.** React, TypeScript, and Vite in src/client; a Node TypeScript backend in src/server, listening on 127.0.0.1. Serve the production client and API from the same origin. Validate origin/host for mutation endpoints so unrelated websites cannot control the local app.
2. **Save first.** SQLite stores lecture/job metadata, revisions, transcript segments, and note drafts. Audio lives in an ignored local data directory. Stream uploads to disk. Recording chunks are uploaded in order and acknowledged before completion; retry chunk uploads idempotently. Do not place audio in localStorage.
3. **One durable job per lecture.** Persist stages and completed chunks. Use queued/preparing/transcribing/generating/waiting/ready/failed/interrupted states. Restart recovers unfinished work without silently making another cloud request. Waiting on quota does not destroy the source or completed transcript.
4. **Validated audio preparation.** Use FFmpeg/ffprobe to check audio, duration, and decoding. Prepare independently decodable chunks under the provider limit and map timestamps to the original lecture timeline. Never split an encoded recording by arbitrary byte boundaries.
5. **Free cloud adapter.** Server-side Groq transcription and note generation use a Free-plan account. The app cannot infer billing tier merely from an API key: require explicit free-account confirmation during setup and never configure a paid fallback. If free eligibility cannot be established, leave cloud disabled. Account setup and the key remain user-owned; never ask for a key in chat or write it to committed files.
6. **Local adapter.** whisper.cpp produces timestamped transcripts; local Ollama produces notes under the same validated contract. Choose model sizes after hardware checks. Downloads/binaries belong in the project workspace where practical; do not make unrequested system-wide changes. Missing tools produce setup guidance, never simulated results.
7. **Grounded notes with revisions.** Summarize transcript sections before assembling a detailed document. Notes cite stable transcript segment IDs; reject unknown references. Keep a regenerated draft separate until the user elects to replace edited notes. Transcript edits mark notes stale.
8. **Focused interface.** A searchable lecture sidebar, a main lecture workspace, recording/upload controls, an audio player, and Transcript/Notes tabs. Clear empty states and processing status; no fake sample lectures, decorative metrics, or invented progress. Include visible keyboard focus, accessible labels, and responsive layout.

## Ordered build stages

The actionable task list is tasks/todo.md; task IDs are stable.

| Stage | Tasks | Reviewable result |
|---|---|---|
| Foundation | T01-T03 | Reproducible local app, designed interface, persistent lecture library |
| Capture | T04-T06 | Valid uploads and microphone recordings saved and playable |
| Processing | T07-T09 | Durable jobs, timestamped free-cloud transcription, detailed source-linked notes |
| Local alternative | T10-T11 | Local transcription and note generation with readiness checks |
| Study workflow | T12-T14 | Safe editing/regeneration, search/export/delete, usable setup and error recovery |
| Verification and handoff | T15-T16 | Browser and long-lecture verification, documented launch and limitations |

Dependencies: T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11 → T12 → T13 → T14 → T15 → T16.

Checkpoint after every three tasks: applicable tests, build, typecheck, lint, and a runnable user path. These are agent verification checkpoints, not requests for the user to approve each increment.

## Implementation and verification rules

- Use test-first development for behavior: first reproduce expected outcomes with failing tests, then implement, then verify. Do not write tests solely for colors, static copy, or framework internals.
- Each task targets no more than five implementation/test files; split it further if its actual scope grows. Bootstrap configuration can be partitioned into smaller commits as needed.
- Provide the dev/build/start/typecheck/lint/test/test:e2e commands specified in SPEC.md. Record exact package-manager invocation if npm is only available through the bundled runtime.
- Stage only files touched by the current task plus its checklist update. Ignore secrets, recordings, model files, dependencies, scratch work, and user-facing output copies. Keep changes recoverable through focused local commits; no pushing or deployment.
- Use the frontend-app-builder skill for the visual concept and implementation, including its image concept and browser comparison requirements. Generate the concept before UI implementation. The concept follows the approved interface architecture; extra product features need scope approval. Visual concept assets are design references, never a substitute for functional controls.
- Prefer the built-in browser for manual verification. Use automated browser tests for repeatable permission-denied, synthetic recording, navigation, and state scenarios. Synthetic audio verifies mechanics; it does not establish real microphone quality.
- Use real speech for provider acceptance tests. Test doubles cover timeouts and malformed responses but never populate the app with fake lecture results.

## Provider setup and user involvement

Build a local setup screen to enter the Groq key securely and confirm the account is on the Free plan. Keys are sent only to the local server, redacted in diagnostics, stored outside version control, and never echoed into chat. The setup screen must explain that cloud processing sends audio/text to Groq. Check readiness separately for local tools and selected models.

Do not ask for credentials before that screen exists. If the free account cannot be configured, use the local route within the user's stated preference. Local performance remains a measurement, not a promise. If hardware discovery remains unavailable, ask only for the necessary RAM/GPU information and continue the app work that does not depend on it.

Microphone permission and a short real microphone sample may require the user. Prepare the UI and repeatable tests before asking. No user billing changes are part of this plan.

## Risks and mitigations

| Risk | Mitigation and acceptance consequence |
|---|---|
| Free quotas cannot immediately process a two-hour lecture, especially with overlap/retries | Queue work, honor retry-after, preserve completed chunks, and offer configured local processing. Do not promise instant completion or unlimited free use. |
| Billing tier cannot be established automatically from a key | Free-account setup confirmation is required; no cloud request if free eligibility remains unknown. Never add a payment method or enable billing. |
| Local hardware cannot run a chosen model well | Choose a smaller compatible model after checks and measure it. Report an unverified or unsuitable local fallback explicitly. |
| Browser tab closes or laptop sleeps during recording | Periodically save chunks, show save state, warn before navigation, and test partial recovery. Do not claim lossless crash/sleep recovery. |
| Audio and transcript exceed memory/context limits | Stream file writes, split valid media, process transcript sections, persist intermediate results, and test beginning/middle/end coverage. |
| Provider invents content or citations | Ground prompts in transcript text, validate structure and IDs, preserve source links, and inspect real examples. Validation cannot guarantee factual correctness; provide review/edit controls. |
| Regeneration overwrites manual work | Store separate drafts/revisions and require an explicit replace action in the app. |
| Tools or network are blocked by the environment | Complete unaffected implementation and tests; report the actual block. Do not replace failed provider calls with canned notes. |

## Completion evidence

1. Build, typecheck, lint, meaningful unit/integration tests, and browser tests pass.
2. Recording, upload, playback, edit/save, search, export, and delete are verified in a browser.
3. Free-cloud and local adapters have real-audio acceptance evidence, or are clearly marked unverified with the concrete setup/blocking condition. An unverified provider path means the full spec is not yet complete.
4. A two-hour fixture exercises chunk offsets and content coverage, plus streamed size-limit validation. A shorter real spoken fixture checks transcription and note quality. Clearly distinguish pipeline tests from full two-hour AI processing if quota prevents the latter.
5. The interface is compared against the generated concept at desktop and smaller widths.
6. User receives a launch guide, setup steps, verification summary, and remaining limitations in outputs/.

## Approval

One user approval of this plan starts the complete implementation sequence. No code, dependency installation, repository initialization, model download, or credential handling is performed in this planning turn.
