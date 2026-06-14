# MedLifeSim

> A privacy-first on-device medical AI sandbox powered by the QVAC MedPsy medical language model.

<!-- Hero image: drop a `docs/images/hero.png` (Dashboard screenshot, ~1280×800) and uncomment the line below. -->
<!-- ![MedLifeSim hero](docs/images/hero.png) -->

## Why we build MedLifeSim

QVAC MedPsy is a medical language model from Tether AI designed to run on edge devices. We built MedLifeSim to explore what medical AI can become when it's more than just another chat interface.

- **Accessible by design.** Advanced medical AI shouldn't require expensive infrastructure. MedLifeSim runs on everyday hardware, making experimentation possible on a budget desktop or laptop.
- **More than a chatbot.** Simulations, visual canvases, and structured reports transform conversations into a workspace for exploring health scenarios.
- **Built to inform, not diagnose.** AI is most useful when helping people understand options, compare interventions, and ask better questions—not replacing clinical judgment.
- **Expand access.** Make virtual health scenario exploration available to educators, community organizations, caregivers, and smaller teams.

## What is MedLifeSim?

**MedLifeSim** is an Electron-based desktop application and a privacy-first, on-device medical AI sandbox powered by **QVAC MedPsy**, allowing individuals and organizations to explore health scenarios without relying on cloud services or exposing sensitive data.

Built around a **Subject → Exposure → Intervention** simulation workflow, MedLifeSim helps users examine how different decisions may shape outcomes across a wide range of contexts—from hospital use cases such as emergency transfusion response, to community challenges like teen substance abuse, school infectious outbreaks, workplace secondhand smoke exposure, and urban lifestyle health risks. 

Rather than providing definitive answers, MedLifeSim offers a safe environment to explore possibilities, compare interventions, and better understand real-world health scenarios before they happen.

---

## Highlight Features

* **Ready-to-use medical models** — Start immediately with **MedPsy 1.7B and 4B** models downloaded directly from Hugging Face, or import your own compatible local models.

* **Organized local workspace** — Create multiple profiles and maintain separate chat sessions, simulations, and training data for each. Everything persists as local files, with a structure inspired by OpenClaw for reliability and simplicity.

* **Scenario canvas and simulation engine** — Compose health scenarios on a visual canvas, generate every possible pathway, and sequentially analyze **up to 100 outcomes** entirely on your desktop.

* **Prompt-to-Scenario generation** — Describe a health situation in plain language and let AI automatically generate the corresponding Subject, Exposure, and Intervention cards.

* **Distributed simulation with P2P resource sharing** — Accelerate large simulations by distributing outcome processing across trusted peers within an organization using Hyperswarm.

* **Structured simulation reports** — Compare interventions through reports that summarize outcome pathways, highlight best and worst approaches, estimate subject-level risk, and generate executive summaries. Export reports to PDF, Markdown, JSON, CSV, and more.

* **Translate reports into any language** — Translate reports locally using Bergamot NMT while preserving the original English version for reference.

* **Fine-tune with your own data** — Use LoRA to fine-tune MedPsy with simulation outcomes and private datasets, then apply the adapted model in future conversations and simulations for more personalized results.

* **Privacy by design** — No cloud APIs, telemetry, analytics, or external reporting services. Inference, simulations, translation, and optional distributed processing remain under your control.

## Example use cases

> **Scenario in this section:** *Hospital · Emergency Transfusion* — a post-adverse-event rescue simulation for incompatible blood transfusion scenarios. Two patient populations (trauma, emergency), 4 rescue interventions, 8 paths total. This is the same template shipped in the app; the numbers below come from one real run.

### What you explore

After a patient receives the wrong blood type, every minute of decision-making matters. The canvas maps 4 rescue options — *no rescue*, *IV fluid resuscitation*, *exchange transfusion*, and *organ support* — against 2 patient populations, producing 8 paths that each go through the model. The point is to see which rescue actually minimizes risk, and for whom.

### What the report shows

A completed run returns a structured report with four sections:

1. **Executive Summary** — auto-derived. The single sentence that matters: which intervention minimizes risk on average, which maximizes it, and which patient group is most exposed.
2. **Comparison Dashboard** — every path side-by-side. Risk % and Severe % per `Subject → Exposure → Intervention` row.
3. **Risk Breakdown** — average risk by intervention, average risk by subject. A quick visual for "who is most at risk and which rescue works best."
4. **Per-Subject Response** — for each subject, every path written out in plain language: the narrative of what happens, the key drivers, and a bulleted list of recommendations.

### Sample output

```text
Best intervention:   IV Fluid Resuscitation   15% avg risk   (n=2)
Worst intervention:  Exchange Transfusion     53.8% avg risk (n=2)
Lowest-risk subject:  Trauma Patients          18.3%
Highest-risk subject: Emergency Patients       43.3%
```

The interesting story is in the **per-path** breakdown. For the lowest-risk path — *Trauma Patients + Incompatible Blood Transfusion + IV Fluid Resuscitation* (5–20% risk) — the model flags the key drivers as *blood bank protocol noncompliance*, *ER time pressure*, and *rushed patient care*, and recommends:

- Mandatory blood typing/crossmatching at bedside
- Use of O-negative blood or compatible alternatives in trauma
- Activation of emergency transfusion protocol
- Staff education on ABO incompatibility consequences

The same structure repeats for every other path. So instead of one number, you get 8 small narratives, each with its own drivers and a concrete checklist of recommendations to share with a clinical team or use as a teaching artifact. Reports export to PDF, Markdown, JSON, and CSV.

## Quick links

- **v1.0.0-beta.1 (Windows)** — [Download on GitHub Releases](https://github.com/pisuthd/medlifesim/releases/tag/v.1.0.0-beta.1)
- **Landing page** — [medlifesim.xyz](https://medlifesim.xyz/)
- **YouTube demo (3 min)** — [Watch on YouTube](https://youtu.be/h1j-_VYcWP8)

## Tech stack

| Layer | What's used |
| --- | --- |
| Runtime | Electron 39 |
| Frontend UI | React 19 + React Router 7 with TypeScript 5.9 |
| Bundler | `electron-vite` 5 (Vite 7 under the hood) |
| Model runtime | `@qvac/sdk` 0.12.2 — `loadModel`, `translate`, P2P, fine-tune |
| Translation | Bergamot NMT (via QVAC), 18 language pairs |
| P2P | Hyperswarm (via QVAC)  |
| Canvas | dnd-kit (Subject / Exposure / Intervention drag-and-drop) |

---

## Quick start

This walkthrough mirrors the actual user flow: from cold boot to running a translated simulation report.

### 1. Install and launch

**Most users — download the prebuilt installer:**

Grab the latest build from the [GitHub Releases page](https://github.com/pisuthd/medlifesim/releases) (Windows installer available; macOS and Linux builds are coming next). Run the installer, and MedLifeSim opens. No extra setup yet — you'll pick a base model in the next step.

**Developers — build from source:**

If you want to hack on MedLifeSim or run an unreleased platform, clone the repo and boot it in dev mode:

```bash
git clone https://github.com/pisuthd/medlifesim.git
cd medlifesim
npm install
npm run dev
```

`npm run dev` boots `electron-vite` in dev mode: the renderer has Vite HMR, the main process restarts on change, preload scripts reload too. The app window opens automatically.

> 📷 *Screenshot: the splash → ModelSelector on first run. Drop `docs/images/01-model-selector.png` here.*

### 2. Pick a base model

The first time you launch, you'll land on the **Model Selector** with the QVAC catalog preloaded. Pick a base model that fits your hardware — smaller models load faster and run on lighter GPUs. The app downloads and loads it locally; you'll see a progress bar with download vs. load phases.

> 📷 *Screenshot: the loading screen with the progress bar. Drop `docs/images/02-loading.png` here.*

If you already have a GGUF model, you can add it from a local file via **Add custom model** — MedLifeSim caches it under the QVAC cache directory for offline reuse.

### 3. Pick a profile

Once a model is loaded, the app routes you to the **Profile Selector**. Create a new profile (self, family, doctor, or community) or pick an existing one. Each profile is a fully isolated workspace.

> 📷 *Screenshot: profile selector with the 4 profile types. Drop `docs/images/03-profile.png` here.*

After this, the app remembers your choice and goes straight to the **Dashboard** on subsequent launches.

### 4. Start chatting

The **Dashboard** shows the loaded model, status, uptime, and two recent-activity tables (simulations + chat sessions). Click **Start chatting** to enter the Chat page.

The chat streams responses token-by-token. Your history is saved per profile. To attach documents, drop them into the chat input — MedLifeSim will OCR scans locally and add the recognized text to the document store.

> 📷 *Screenshot: a chat session with a streaming response and a document attached. Drop `docs/images/04-chat.png` here.*

### 5. Run a simulation

Go to **Simulations → New simulation**. You'll land on a **canvas** with three column groups: **Subject**, **Exposure**, **Intervention**. Drag cards from the right-hand library into each group, then connect them to form paths.

> 📷 *Screenshot: the simulation canvas with cards placed. Drop `docs/images/05-canvas.png` here.*

When you're happy, click **Run all paths**. MedLifeSim enumerates every Subject → Exposure → Intervention combination, kicks off a worker per path, and emits progress events in real time. You can watch the recent-simulations table fill in.

> 📷 *Screenshot: the recent-simulations table with a row in 'Processing' state. Drop `docs/images/06-progress.png` here.*

When all paths complete, click **Report** on a row to open the **Simulation Report** — a structured page with per-path risk, the executive summary, and a comparison table of interventions ranked by average risk.

### 6. Translate the report

The simulation report has a translation picker in the page header. Pick a target language (e.g. Spanish, Thai, Vietnamese, Japanese) and MedLifeSim will load the Bergamot model for that language pair and translate the report in place. The English original stays underneath; you can flip back any time.

> 📷 *Screenshot: a report translated into Spanish with the picker open. Drop `docs/images/07-translated.png` here.*

Eighteen language pairs are supported: Arabic, German, Greek, Spanish, French, Hebrew, Hindi, Italian, Japanese, Korean, Dutch, Polish, Portuguese, Russian, Swedish, Turkish, Vietnamese, Chinese. All run on-device — no cloud translation API.

### 7. Train a LoRA (optional)

If you want to specialize the model for your own patterns, head to **Training**. Create a dataset from your completed simulations, pick a base model and LoRA hyperparameters (rank, alpha, epochs, batch size), and start a fine-tune run. MedLifeSim runs SFT over JSONL with live loss + ETA.

> 📷 *Screenshot: the training page mid-run with the live loss chart. Drop `docs/images/08-training.png` here.*

When the run finishes, the new adapter is registered in the LoRA catalog. Switch to it from the **Model Selector** → **LoRA** picker in the Chat page.

### 8. Share peer-to-peer (opt-in)

If you want to offload outcomes work to a trusted peer — say, a colleague with a beefier GPU — go to **Settings → Shared Resources → P2P**. Flip the **Provider** toggle to expose your fine-tuned model on Hyperswarm. On the consumer side, add the peer's public key, connect, and MedLifeSim will delegate outcomes work to them.

The consumer's `fallbackToLocal: true` means a dead peer never breaks your workflow. If the peer is unreachable, the work just runs locally.

> 📷 *Screenshot: the P2P settings panel with a connected peer. Drop `docs/images/09-p2p.png` here.*

You can leave P2P off entirely. It's an opt-in feature.

---

## For developers

### Local setup

```bash
git clone https://github.com/pisuthd/medlifesim.git
cd medlifesim
npm install
npm run dev
```

### Environment variables

**None required.** MedLifeSim is fully on-device — there is no API key, no cloud endpoint, no `.env` file. The QVAC SDK handles model download and caching via its own cache directory (configured in `src/main/qvac.ts`). If you proxy a model source through your own server, the SDK supports a `modelSrc` URL — see `@qvac/sdk` docs.

### npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Electron + Vite dev with HMR |
| `npm start` | `electron-vite preview` — runs the built bundle |
| `npm run build` | Typecheck (main + renderer) + production bundle |
| `npm run build:unpack` | Build + unpacked Electron dir (no installer) |
| `npm run build:win` | Build + Windows NSIS installer |
| `npm run build:mac` | Build + macOS DMG |
| `npm run build:linux` | Build + Linux AppImage / snap / deb |
| `npm run typecheck` | Run both `typecheck:node` and `typecheck:web` |
| `npm run typecheck:node` | `tsc --noEmit -p tsconfig.node.json` |
| `npm run typecheck:web` | `tsc --noEmit -p tsconfig.web.json` |
| `npm run lint` | `eslint --cache .` |
| `npm run format` | `prettier --write .` |

### Project structure

```
my-doctor-ai/
├── src/             # main, preload, renderer, shared
├── build/           # App icons
├── resources/       # Runtime resources
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.node.json
├── tsconfig.web.json
└── package.json
```

### Architecture

**Boot state machine** (in [`src/renderer/src/App.tsx`](src/renderer/src/App.tsx)):

```
              ┌──────────┐
              │ loading  │  splash
              └────┬─────┘
                   │ window.api.models.status() returns no active
              ┌────▼─────┐
              │  model   │  ModelSelector (first run)
              └────┬─────┘
                   │ user picks
              ┌────▼──────────┐
              │ model-loading │  LoadingScreen with progress bar
              └────┬──────────┘
                   │ models:progress reaches 100%
              ┌────▼──────┐
              │  profile  │  ProfileSelector (self/family/doctor/community)
              └────┬──────┘
                   │ user picks
              ┌────▼─────┐
              │   main   │  Dashboard / Chat / Simulations / …
              └──────────┘
```

**IPC bridge.** The main process owns all state. The renderer talks to it through `window.api.*`, declared in [`src/preload/index.d.ts`](src/preload/index.d.ts). Every channel goes through the typed surface — no `ipcRenderer` calls in the renderer. Live channels (`models:progress`, `p2p.onStatus`, `simulations.onProgress`, `ai:streamToken`, …) are subscribed to in the relevant context provider (`AIContext`, `TrainingContext`) or page hook.

**QVAC SDK chokepoint.** [`src/main/qvac.ts`](src/main/qvac.ts) is the only file that imports `@qvac/sdk` on the main side. Errors are normalized to `{code, message, retryable}` so the UI can show a single error pill. Training-mode lock blocks model swaps while a fine-tune is in flight.

### Privacy and Local-First

MedLifeSim does not use any remote APIs for AI inference — every model call runs on-device.

- **No cloud calls.** All inference, translation, and (optional) P2P run on-device. The renderer never makes outbound network requests of its own.
- **Models cached locally.** Downloaded once via QVAC SDK; subsequent loads are offline.
- **P2P is opt-in.** Provider/consumer roles in Settings are off by default.
- **Per-profile isolation.** Chat history, documents, simulations, and training data are scoped to a profile. Switching profiles loads a different directory; deleting a profile wipes it.
- **No telemetry.** There is no analytics SDK, no error reporting service, no remote config.

---

## Performance audit log

MedLifeSim's QVAC SDK chokepoint ([`src/main/qvac.ts`](src/main/qvac.ts)) emits a structured audit log for every model load/unload and every inference call. Below is one full demo run with **MedPsy 1.7B** on a consumer Windows desktop with GPU acceleration.

### Model load 

```text
[sdk:client] ≡ƒôª Initializing SDK config
[sdk:client] ≡ƒô▒ Runtime context: { runtime: 'node', platform: 'win32' }
[sdk:server] Γ£à Cache directory set to: C:\Users\pisut\AppData\Roaming\medlifesim\qvac-cache
[sdk:client] Γ£à Initialization complete
[sdk:server] [request-lifecycle] begin requestId=047fb155-2498-4dcb-9e46-5ad5f92131c9 kind=downloadAsset modelId=- state=running
[sdk:server] Loading from HTTP URL: https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q8_0.gguf?download=true
[sdk:server] Γ£à Using cached HTTP model: C:\Users\pisut\AppData\Roaming\medlifesim\qvac-cache/b615104e1b3947be_medpsy-1.7b-q8_0.gguf
[sdk:server] Loaded Model to C:\Users\pisut\AppData\Roaming\medlifesim\qvac-cache/b615104e1b3947be_medpsy-1.7b-q8_0.gguf
[sdk:server] [request-lifecycle] end requestId=047fb155-2498-4dcb-9e46-5ad5f92131c9 kind=downloadAsset modelId=- state=completed durationMs=731
[sdk:server] [request-lifecycle] begin requestId=e4061c0e-1a8a-4d4b-8f63-f4646e0f39c5 kind=loadModel modelId=- state=running
[sdk:server] Loading from HTTP URL: https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q8_0.gguf?download=true
[sdk:server] Γ£à Using cached HTTP model: C:\Users\pisut\AppData\Roaming\medlifesim\qvac-cache/b615104e1b3947be_medpsy-1.7b-q8_0.gguf
[sdk:server] Loaded Model to C:\Users\pisut\AppData\Roaming\medlifesim\qvac-cache/b615104e1b3947be_medpsy-1.7b-q8_0.gguf
[sdk:server] llamacpp-completion: Loading model 918cace3f72353a7...
parse: load the model metadata from disk file.
initFromConfig: load the model from disk file and apply lora adapter, if any.
common_init_result: fitting params to device memory, for bugs during this step try to reproduce them with -fit off, or provide --verbose logs if the bug only occurs with -fit on
common_init_result: added </s> logit bias = -inf
common_init_result: added <|endoftext|> logit bias = -inf
common_init_result: added <|im_end|> logit bias = -inf
common_init_result: added <|fim_pad|> logit bias = -inf
common_init_result: added <|repo_name|> logit bias = -inf
common_init_result: added <|file_sep|> logit bias = -inf
[sdk:server] llamacpp-completion model 918cace3f72353a7 loaded
[sdk:server] Local model registered: 918cace3f72353a7 -> C:\Users\pisut\AppData\Roaming\medlifesim\qvac-cache/b615104e1b3947be_medpsy-1.7b-q8_0.gguf
[sdk:server] [request-lifecycle] end requestId=e4061c0e-1a8a-4d4b-8f63-f4646e0f39c5 kind=loadModel modelId=- state=completed durationMs=15544
[qvac] URL model loaded: 918cace3f72353a7 ( https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q8_0.gguf?download=true )
```

### Inference performance

```text
[AI] completionStats {"type":"completionStats","seq":965,"stats":{"timeToFirstToken":1509.605,"tokensPerSecond":8.340257313756641,"cacheTokens":1532,"promptTokens":235,"generatedTokens":967,"backendDevice":"gpu"}}
```

Every chat completion in the app emits the same `completionStats` event into the audit log; every model load/unload emits a `request-lifecycle` block with `kind`, `state`, and `durationMs`.

---

## Roadmap

MedLifeSim is at **v1.0.0-beta.1** and the core flows (chat, simulations, translation, training, P2P) are working.

**Next up:**

- Screenshot catalog for the README (the `📷` placeholders above).
- A downloadable portable build for each platform (no installer required).
- Export / import profile bundles — share your simulation reports and LoRAs with a colleague.
- A search/command palette (Ctrl/Cmd-K) for jumping to any page or simulation.

If you have feature requests, open an issue.

## License

[MIT](LICENSE) © Tamago Labs