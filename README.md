# MedLifeSim — Private, On-Device Medical AI

> A privacy-first desktop app for medical consultations. Chat with a local LLM, upload documents, run counterfactual simulations, fine-tune your own adapter, and translate reports into 18 languages — all on-device, with no data leaving your machine.

<!-- Hero image: drop a `docs/images/hero.png` (Dashboard screenshot, ~1280×800) and uncomment the line below. -->
<!-- ![MedLifeSim hero](docs/images/hero.png) -->

## What is MedLifeSim?

**MedLifeSim** is a desktop app that turns a local language model into a real medical workflow tool — not a chatbot, but a research and consultation surface that runs entirely on your machine.

The model is loaded through the **[QVAC SDK](https://www.npmjs.com/package/@qvac/sdk)**, so the model — and your conversations, documents, simulations, and fine-tunes — never touch a cloud API. Translation runs through **[Bergamot NMT](https://github.com/browsermt/bergamot-translator)** (Mozilla's on-device translator). P2P sharing is opt-in and uses Hyperswarm with a `fallbackToLocal: true` consumer, so a dead peer never breaks your workflow.

The app supports **four profiles** (self, family member, doctor, community) so multiple people can share one installation with fully isolated data — separate chat history, separate documents, separate simulation reports, separate LoRA adapters.

**What you can do with it:**

- Chat with the model directly, with a streaming UI and a live status pill for model load / error / training lock.
- Upload text, OCR'd scans, and free-form notes; the model references them when you chat.
- Build a **Subject → Exposure → Intervention** scenario on a canvas, enumerate every path, and run each one through the model. Get a structured report with per-path risk, best/worst intervention rankings, and a pre-rendered executive summary.
- **Translate** any report into 1 of 18 languages on-device (Bergamot, not Google Translate).
- **Fine-tune** a LoRA adapter on your own simulation outcomes — SFT over JSONL — and bind the result back into the chat. Watch loss and ETA live.
- **(Opt-in) share** your fine-tuned model with a trusted peer over Hyperswarm DHT. The consumer always falls back to local.

MedLifeSim is **not a substitute for a licensed clinician**. The medical disclaimer ([`src/shared/disclaimer.ts`](src/shared/disclaimer.ts)) is surfaced prominently in the app. It's an assistant that helps you organize information, run scenarios, and explore what-ifs — you make the calls.

---

## Highlight features

- **🩺 On-device AI chat** — QVAC SDK loads the model locally. Streaming responses, model-load progress, retryable error mapping. No cloud.
- **👥 Multi-profile** — Self / family / doctor / community. Each profile gets its own chat sessions, documents, simulations, and training data. Deleting a profile wipes its directory.
- **📄 Documents** — Text, OCR'd scans, free-form notes. Semantic search across the profile's document set.
- **🧪 Counterfactual simulations** — Drag-and-drop canvas (dnd-kit). Subject → Exposure → Intervention path enumeration. The worker runs each path through the model. Reports aggregate best/worst interventions, per-subject risk, and a pre-rendered executive summary.
- **🌍 18-language report translation** — Bergamot NMT runs locally. Click the translation picker on any report, pick a target language, see it translated in place. The English original is preserved underneath.
- **🎯 LoRA training** — Supervised fine-tuning over your own simulation outcomes. Choose rank / alpha / epochs / batch size, watch loss + ETA live, and bind the trained adapter back to the chat.
- **🔗 Opt-in P2P model sharing** — Hyperswarm DHT provider/consumer. Delegate outcomes work to a trusted peer; always falls back to local. Disable entirely in Settings.
- **🛡️ Strict privacy** — No cloud calls, no telemetry, no analytics SDK, no error reporting service. All inference, translation, OCR, and (optional) P2P run on-device.

## Quick links

- **Live demo** — *(not yet published; this is a beta)*
- **Discord / community** — *(not yet set up)*
- **Issues** — open a GitHub issue
- **Disclaimer** — [src/shared/disclaimer.ts](src/shared/disclaimer.ts)

## Tech stack

| Layer | What's used |
| --- | --- |
| Runtime | Electron 39 |
| UI | React 19 + React Router 7 (HashRouter) |
| Language | TypeScript 5.9 (strict, two tsconfigs: `tsconfig.node.json` for main/preload, `tsconfig.web.json` for renderer) |
| Bundler | `electron-vite` 5 (Vite 7 under the hood) |
| Model runtime | `@qvac/sdk` 0.12.2 — `loadModel`, `translate`, P2P, fine-tune |
| Translation | Bergamot NMT (via QVAC), 18 language pairs |
| P2P | Hyperswarm (via QVAC), with `fallbackToLocal: true` |
| Canvas | dnd-kit (Subject / Exposure / Intervention drag-and-drop) |
| Animation | framer-motion |
| Markdown | react-markdown + remark-gfm (simulation reports) |
| Icons | lucide-react |
| Validation | zod |

---

## Quick start

This walkthrough mirrors the actual user flow: from cold boot to running a translated simulation report.

### 1. Install and launch

```bash
git clone https://github.com/pisuthd/medpsy-doctor.git
cd medpsy-doctor
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
git clone https://github.com/pisuthd/medpsy-doctor.git
cd medpsy-doctor
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
├── src/
│   ├── main/                   # Electron main process
│   │   ├── qvac.ts             # QVAC SDK chokepoint (load/unload/LoRA/error)
│   │   ├── translation.ts      # Bergamot NMT runtime
│   │   ├── p2p.ts              # Hyperswarm provider/consumer
│   │   ├── finetune.ts         # LoRA / SFT training
│   │   ├── simulationWorker.ts # Outcomes worker
│   │   ├── reportExport.ts     # PDF/JSON/MD/CSV report writer
│   │   ├── ocr.ts              # On-device OCR
│   │   ├── tools/              # Document & outcome tool handlers
│   │   ├── sessions.ts         # Chat session persistence
│   │   ├── modelStore.ts       # Model catalog
│   │   └── index.ts            # Main entry
│   │
│   ├── preload/                # IPC bridge exposed as `window.api`
│   │   ├── index.ts
│   │   ├── index.d.ts          # `window.api` type
│   │   └── simulation.d.ts     # Shared simulation types
│   │
│   ├── renderer/               # React app
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx         # Boot state machine + HashRouter
│   │       ├── context/        # AIContext, ProfileContext, TrainingContext
│   │       ├── components/     # PageWrapper, Sidebar, ui/ primitives, etc.
│   │       ├── pages/          # Dashboard, Chat, Sessions, …
│   │       ├── data/           # Simulation cards, paths, templates
│   │       ├── utils/          # format, risk, modelDisplay
│   │       └── theme.ts        # BLUE / TEAL / NAVY / MUTED palette
│   │
│   └── shared/                 # Used by main + renderer
│       ├── outcomeParser.ts
│       ├── outcomeReport.ts    # Pure aggregator (best/worst interventions)
│       ├── scenarioPresets.ts
│       └── disclaimer.ts       # Medical disclaimer text
│
├── build/                      # App icons (icns/ico/png)
├── resources/                  # Runtime resources
├── electron.vite.config.ts
├── electron-builder.yml        # Installer config (NSIS, DMG, AppImage)
├── tsconfig.node.json          # Main + preload
├── tsconfig.web.json           # Renderer
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

### Privacy

- **No cloud calls.** All inference, translation, OCR, and (optional) P2P run on-device. The renderer never makes outbound network requests of its own.
- **Models cached locally.** Downloaded once via QVAC SDK; subsequent loads are offline.
- **P2P is opt-in.** Provider/consumer roles in Settings are off by default. The consumer's `fallbackToLocal: true` means a dead peer never breaks your workflow.
- **Per-profile isolation.** Chat history, documents, simulations, and training data are scoped to a profile. Switching profiles loads a different directory; deleting a profile wipes it.
- **No telemetry.** There is no analytics SDK, no error reporting service, no remote config.

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

[MIT](LICENSE) © Pisuth D.

> _A `LICENSE` file is not yet committed; this README references MIT as the intended license. The standard MIT text should be added in a follow-up._

## Acknowledgments

- [QVAC SDK](https://www.npmjs.com/package/@qvac/sdk) — local model runtime, translation, P2P, fine-tuning.
- [Bergamot](https://github.com/browsermt/bergamot-translator) (Mozilla) — on-device neural machine translation.
- [Hyperswarm](https://github.com/hyperswarm/hyperswarm) — DHT for the optional P2P layer.
- [dnd-kit](https://dndkit.com/) — drag & drop for the simulation canvas.
- [framer-motion](https://www.framer.com/motion/) — UI animation.
- [lucide-react](https://lucide.dev/) — icons.
- [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) — Markdown rendering in simulation reports.
- The open-source model community, without whom none of this is possible.
