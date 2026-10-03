# Start using Lecture Notes

After following [the setup instructions](../README.md), open **[http://127.0.0.1:3100](http://127.0.0.1:3100)**. Select a configured engine in Settings. [Local AI](LOCAL-AI-SETUP.md) works without an API key or paid AI service.

## Open it again later

Open the project folder in File Explorer and double-click **Start Lecture Notes.cmd**. It starts the app and local AI in the background and opens your browser. **Stop Lecture Notes.cmd** shuts down the processes started by that launcher. Stop and save a recording before shutting down.

## Make your first notes

1. Enter a lecture title. Add an optional course and vocabulary hints.
2. Choose **Record microphone** or **Upload audio**. For recording, allow your browser to use the microphone, then pause/resume or choose **Stop & save**. Keep the tab open and laptop awake while recording and saving.
3. With the audio saved, keep **Local — on this laptop** selected and choose **Transcribe & generate notes**.
4. Listen to the audio and check the transcript and study notes. Timestamp buttons jump to the recording. AI can omit or misinterpret details, so review before relying on it for studying.
5. Use **Edit transcript** or **Edit notes**, then **Save edits**. Find saved lectures in the sidebar. **Export** downloads notes as Markdown or the transcript as timestamped text; the audio has its own download button.

Lectures can contain up to two hours of audio, with a file limit of 2 GiB. Supported uploads: MP3, M4A, WAV, WebM. Local processing speed varies with lecture length and laptop load.

## Optional free cloud mode

Open **Settings** and enter your Groq Free-plan key in the password field there. Confirm that your account is on the Free plan with no billing enabled, then save. **Do not send the key in chat.** It stays in memory in the running local server and must be entered again after restart. Choosing Groq sends the audio and transcript to Groq. A quota wait preserves your progress; you can resume later or select Local. The app never upgrades the account or switches to a paid AI service.

## If processing or saving fails

Your saved audio and completed processing work remain available. Retry or select the other configured engine. After an interrupted recording, reopen it and choose **Recover saved recording chunks**. The final unsaved seconds may be missing. During a recording save failure, keep the tab open and choose **Retry saving**.

Regenerating notes creates a draft and keeps your existing notes until you explicitly replace them. Transcript edits mark older notes as out of date. Permanent lecture deletion requires the app's confirmation and cannot be undone.

## What has been verified

Actual local transcription and note generation worked on a 39-second synthesized spoken sample. Automated browser checks passed for capture with a synthetic microphone, upload/playback, saving/reopening edits, export, seeking, denied permission, retry recovery, and responsive layouts. Start/stop shortcuts were tested.

**Still needs a live check:** your physical microphone, Groq with your Free-plan key, and a complete two-hour spoken lecture. Two-hour audio splitting and the exact 2 GiB streaming limit passed automated checks; full lecture accuracy and sustained two-hour recording were not verified.

See [verification details](VERIFICATION.md), the [finished app preview](APP-PREVIEW.png), and [real local result screenshot](LOCAL-NOTES-PREVIEW.png). Technical setup, backup, and test instructions are in `README.md` in the project folder.

