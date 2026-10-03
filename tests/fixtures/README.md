# Spoken lecture test fixture

`cells.wav` is a 39.5-second Windows-synthesized English voice reading this known script:

Today we will discuss cells. A cell is the basic structural and functional unit of life. The cell membrane controls which substances enter and leave the cell. Diffusion is the movement of particles from higher concentration to lower concentration. For example oxygen moves into a cell by diffusion when oxygen concentration is higher outside the cell. Osmosis is the movement of water through a selectively permeable membrane. Active transport requires energy to move substances against a concentration gradient. Remember that active transport requires energy while diffusion does not.

`cells-result.json` was captured from actual whisper.cpp small.en-q5_1 transcription and Ollama qwen3:4b generation/evidence review on this laptop on 2026-10-02. It is a frozen reference for browser editor/export tests, not a provider implementation or fallback. The evidence review removed unsupported elaborations about solute direction and membrane purpose. The final notes retained the definitions and oxygen example but omitted the final comparison that diffusion needs no energy. This is a material note-quality limit; the transcript remains available to check and edit notes.

Runtime tests use an isolated app and temporary lectures. The personal library contains no sample/seed data. The audio is synthesized speech, not a physical microphone or classroom recording. A separate two-hour silent fixture verifies media splitting and limits; it does not verify two-hour transcription accuracy.
