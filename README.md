# MedPsy Doctor - QVAC MedPsy Desktop Application

A free, open-source desktop application for QVAC MedPsy - the medical language model launched by Tether AI. Try the latest on-device AI medical assistant on your computer.

![Electron](https://img.shields.io/badge/Electron-191970?style=flat-square&logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 🎯 What is QVAC MedPsy?

**QVAC MedPsy** is a cutting-edge medical language model from Tether AI (launched May 2025), designed to run directly on devices with limited processing power. This desktop app brings QVAC MedPsy to your Windows, Mac, or Linux computer with a user-friendly interface.

### Why Use This App?

- ✅ **Try QVAC MedPsy immediately** - No mobile device required
- ✅ **100% Offline** - Your health data never leaves your device
- ✅ **No subscription** - Free and open source
- ✅ **Privacy-first** - Local AI processing, no cloud
- ✅ **Document support** - Upload medical records for AI analysis

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Windows, macOS, or Linux
- ~2GB disk space

### Installation

```bash
# Clone the repository
git clone https://github.com/pisuthd/medpsy-doctor.git
cd medpsy-doctor

# Install dependencies
npm install

# Start development server
npm run dev

# Build for your platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## ✨ Features

### 💬 AI Chat with QVAC MedPsy
- Chat naturally with the medical AI model
- Streaming responses with AI thinking display
- Multiple conversation sessions
- Context-aware responses based on your profile

### 👨‍👩‍👧‍👦 Profile System
- Create profiles for yourself, family members, or community users
- Personalized AI context (age, gender, role)
- Separate data storage per profile

### 📄 Medical Documents
- Upload medical documents via drag & drop
- OCR support for image files (prescriptions, lab reports)
- Quick notes for personal health records
- AI can search and reference your documents

### 🔒 Privacy Features
- All AI processing happens **locally on your device**
- Your health data **never leaves your computer**
- No internet required after initial model download
- No accounts, no tracking, no subscriptions

## 📋 Tech Stack

- **Framework**: Electron + electron-vite
- **Frontend**: React 19 + TypeScript
- **AI Engine**: QVAC SDK with local GGUF model
- **Animations**: Framer Motion
- **Styling**: Custom design system (blue gradient theme)

## 🤖 AI Model

This app uses the QVAC MedPsy medical AI model:
- **Model**: Medpsy-1.7B (GGUF format)
- **Download**: Automatic on first run (~1.5GB)
- **Storage**: `{userData}/medpsy-1.7b-q4_k_m-imat.gguf`

## 📁 Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts           # Main entry, AI chat, IPC handlers
│   ├── profileStore.ts    # Profile persistence
│   ├── sessions.ts        # Session management
│   ├── toolsStore.ts      # Tool settings
│   └── tools/
│       └── documents/     # Document tools for AI
├── preload/        # Context bridge for IPC
└── renderer/       # React frontend
    └── src/
        ├── components/
        ├── pages/
        ├── context/
        └── App.tsx
``

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please feel free to submit issues and pull requests.

## 🔗 Resources

- [QVAC MedPsy Model](https://github.com/pisuthd/my-doctor-ai/releases) - Download the GGUF model
- [QVAC SDK Documentation](https://www.npmjs.com/package/@qvac/sdk) - Learn about the AI SDK
