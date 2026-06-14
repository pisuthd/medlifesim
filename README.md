# MedLifeSim

> A privacy-first on-device medical AI sandbox powered by the QVAC MedPsy medical language model.

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

## The Workflow

<img width="799" height="473" alt="Screenshot 2026-06-13 212824" src="https://github.com/user-attachments/assets/38c4ef6b-3739-4ff3-a025-871d8be2cee3" />

MedLifeSim is built around a simple but expressive framework: **Subject → Exposure → Intervention**.

Each simulation begins by defining who is affected, what they are exposed to, and how we choose to respond. By connecting these three elements, MedLifeSim can generate and evaluate multiple pathways to explore how different interventions may influence outcomes.

- **Subject** represents the population or individuals involved — such as school children, emergency patients, elderly caregivers, at-risk teens, pregnant individuals, or urban workers.
- **Exposure** describes the condition, event, or risk factor affecting them — including respiratory outbreaks, secondhand smoke, peer drug access, sedentary lifestyles, incompatible blood transfusions, and environmental pollution.
- **Intervention** captures the actions taken in response — ranging from vaccination programs and education campaigns to hospital rescue procedures, workplace policies, and supportive care.

This workflow allows MedLifeSim to support scenarios across diverse settings, from emergency departments and hospitals to schools, workplaces, households, and community health programs.

Rather than producing a single answer, it systematically compares possible pathways and helps users understand the trade-offs between different approaches.

---

## Example use cases

MedLifeSim demonstrates how medical AI can be used to simulate health scenarios without the cost, time, or ethical constraints of running full-scale real-world studies. It enables safe exploration of interventions, outcomes, and risk pathways before decisions are made in real environments.

These simulations can be applied across clinical, community, and environmental contexts:

- Smoking-risk assessment in workplace environments  
- Teen substance-abuse prevention in semi-urban communities  
- Respiratory outbreak response in schools  
- Urban metabolic decline analysis  
- Emergency hospital intervention simulations  

---

## Example: Emergency Transfusion Scenario

In a hospital setting, MedLifeSim can simulate outcomes after an incompatible blood transfusion and compare intervention strategies in real time.

### Scenario setup  
Subject groups: Trauma patients, Emergency patients  
Interventions: No rescue, IV fluid resuscitation, exchange transfusion, organ support  

### What the simulation produces
- Comparative risk across all intervention paths  
- Best and worst-performing interventions  
- Per-subject outcome breakdowns  
- Actionable recommendations for response planning  

### Output

```text
Best intervention:   IV Fluid Resuscitation   15% avg risk   (n=2)
Worst intervention:  Exchange Transfusion     53.8% avg risk (n=2)
Lowest-risk subject:  Trauma Patients          18.3%
Highest-risk subject: Emergency Patients       43.3%
```

Each path is expanded into a structured narrative describing:

- key risk drivers
- failure points in the response chain
- recommended interventions for mitigation

---

## Quick start

### 1. Install and launch

**Most users — download the prebuilt installer:**

Grab the latest build from the [GitHub Releases page](https://github.com/pisuthd/medlifesim/releases) (Windows installer available; macOS and Linux builds are coming next). Run the installer, and MedLifeSim opens. No extra setup yet — you'll pick a base model in the next step.

**Build from source:**

Clone the repository and run the app in development mode:

```bash
git clone https://github.com/pisuthd/medlifesim.git
cd medlifesim
npm install
npm run dev
```

Create production builds for your platform:

```bash
npm run build:unpack // Build unpacked Electron app (no installer)
npm run build:win // Windows installer
npm run build:mac // macOS DMG package
npm run build:linux // Linux builds (AppImage / snap / deb)
```

<img width="119" height="224" alt="Screenshot 2026-06-13 212337" src="https://github.com/user-attachments/assets/38fee9bb-e9c8-41f8-8b39-ef5883e31137" />

### 2. Pick a model

When you launch MedLifeSim, you'll land on the **Model Selector** with the QVAC catalog preloaded. Choose a model based on your hardware — smaller models load faster and run on lighter devices.

The app downloads and loads the model locally, with a progress indicator showing both download and initialization stages.

<img width="550" height="404" alt="Screenshot 2026-06-13 212310" src="https://github.com/user-attachments/assets/1c27a2bd-2325-42ce-92c1-2cd7eae6b143" />

### 3. Pick a profile

Once a model is loaded, the app routes you to the **Profile Selector**. Create a new profile (self, family, doctor, or community) or pick an existing one. Each profile is a fully isolated workspace.

After this, the app remembers your choice and goes straight to the **Dashboard**.

<img width="944" height="501" alt="Screenshot 2026-06-13 212503" src="https://github.com/user-attachments/assets/62caf592-35f9-46e8-8238-1cd0d0f6f4b8" />

### 4. Start chatting

Click **Start chatting** to enter the Chat page. The chat streams responses token-by-token, and your history is saved per profile.

Before starting a conversation, you can choose between:
- **Base model** — the original QVAC MedPsy model
- **Fine-tuned model** — a customized version trained on your simulation or private data (details in the Fine-tuning section)

Each option affects how the model responds during chat and simulation workflows.

<img width="774" height="469" alt="Screenshot 2026-06-14 082148" src="https://github.com/user-attachments/assets/e724637b-275a-4464-8814-ffa5153c981c" />

### 5. Run a simulation

<img width="596" height="331" alt="Screenshot 2026-06-13 213743" src="https://github.com/user-attachments/assets/396c595b-7e3c-44b9-848e-c37540534210" />

Go to **New simulation**. You'll enter the **canvas view**, where you can build a simulation in two ways:

- **Manual mode:** Drag and drop cards into the three columns — **Subject**, **Exposure**, and **Intervention** — then connect them to define paths.
- **Prompt-to-generation:** Describe a health scenario in natural language, and MedLifeSim will automatically generate the relevant Subject, Exposure, and Intervention cards for you.

<img width="539" height="373" alt="Screenshot 2026-06-13 213111" src="https://github.com/user-attachments/assets/3ea97c28-7ae1-46f9-87be-3b9940aefe56" />

The canvas lets you visually compose and refine the simulation structure before execution.

When you're ready, click **Preview**. MedLifeSim enumerates every valid Subject → Exposure → Intervention combination, then submit to executes each path in parallel, and streams progress updates in real time. You can watch the recent-simulations table update as results are processed.

<img width="752" height="356" alt="Screenshot 2026-06-14 083038" src="https://github.com/user-attachments/assets/41ce155e-720b-445d-8cf8-62682b8eb905" />

Once all paths are complete, click **Report** on a simulation row to open the **Simulation Report** — a structured view showing per-path risk analysis, an executive summary, and a comparison of interventions ranked by average risk.

### 6. Translate the report

The simulation report has a translation picker in the page header. Pick a target language and MedLifeSim will load the Bergamot model for that language pair and translate the report in place. The English original stays underneath; you can flip back any time.

<img width="752" height="440" alt="Screenshot 2026-06-14 093917" src="https://github.com/user-attachments/assets/83dd8908-d984-4d28-bd5c-3794aab7ca6e" />

Eighteen language pairs are supported: Arabic, German, Greek, Spanish, French, Hebrew, Hindi, Italian, Japanese, Korean, Dutch, Polish, Portuguese, Russian, Swedish, Turkish, Vietnamese, Chinese. All run on-device — no cloud translation API.

### 7. Train a LoRA (optional)

If you want to specialize the model for your own patterns, go to **Training**. You can generate a dataset from your completed simulations, select a base model, and start a fine-tuning run.

MedLifeSim performs LoRA-based SFT training on JSONL data, with real-time metrics such as training loss and estimated time remaining.

Once the run is complete, the trained adapter is registered in the LoRA catalog. You can then switch to it from the input in the Chat page.

### 8. Share peer-to-peer (opt-in)

If you want to offload simulation work to trusted peers, go to **Settings → Shared Resources**.

To share your resources, enable the **Provider** toggle. This will expose your resource over Hyperswarm and generate a public key that can be shared with others on the same network.

On the consumer side, add the provider’s public key to connect. Once connected, MedLifeSim can delegate supported simulation workloads to that peer.

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

**None required.** MedLifeSim is fully on-device — there is no API key, no cloud endpoint, no `.env` file. The QVAC SDK handles model download and caching via its own cache directory.

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

## License

[MIT](LICENSE) © Tamago Labs
