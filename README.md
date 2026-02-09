# KaooChat 🦞

A modern, real-time chat interface inspired by [OpenClaw](https://github.com/openclaw/openclaw) - your personal AI assistant powered by your own OpenClaw backend.

## Features

- 🦞 **Clean, Modern UI** - OpenClaw-inspired chat interface with dark mode support
- ⚡ **Real-time Streaming** - See AI responses as they're generated
- 🤖 **OpenClaw Backend** - Connects to your OpenClaw instance at oclaw.kaoohi.com
- 📱 **Responsive Design** - Works beautifully on desktop and mobile
- 🔄 **WebSocket Ready** - Architecture supports future multi-channel messaging

## Getting Started

### Prerequisites

- Node.js 18+ or later
- Access to an OpenClaw backend (default: oclaw.kaoohi.com)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd kaoochat
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables:
```bash
cp .env.example .env.local
```

4. (Optional) Add your OpenClaw token to `.env.local` if authentication is required:
```env
OPENCLAW_TOKEN=your_openclaw_token_here
```

The app is configured to use `https://oclaw.kaoohi.com` as the backend by default.

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to start chatting.

### Production

Build the application for production:

```bash
npm run build
npm start
```

## Architecture

KaooChat is built with:
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Z.ai (Zhipu AI)** - GLM-4-Plus AI model via OpenAI-compatible API
- **Server-Sent Events** - Real-time message streaming

The architecture is designed to support future enhancements like:
- WebSocket Gateway (like OpenClaw's `ws://127.0.0.1:18789`)
- Multi-channel messaging (WhatsApp, Telegram, Slack, etc.)
- Session management and conversation history
- Tool/skill system for extended capabilities

## Inspiration

This project is inspired by [OpenClaw](https://openclaw.ai/), a powerful personal AI assistant that connects to multiple messaging platforms. KaooChat brings a similar experience to the web with a focus on clean UI and real-time interactions.

## Technologies

- [Next.js](https://nextjs.org/) - React framework
- [Z.ai (Zhipu AI)](https://z.ai/) - GLM AI models with OpenAI-compatible API
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Available Models

KaooChat uses Z.ai's flagship model **GLM-4-Plus** by default. You can also use:
- `glm-4-plus` - Flagship model with reasoning, coding, and agentic capabilities
- `glm-4` - Standard model
- `glm-4-air` - Faster, lighter model
- `glm-4-flash` - Ultra-fast model

To change the model, edit [src/app/api/chat/route.ts](src/app/api/chat/route.ts) and modify the `model` parameter.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT

---

Built with 🦞 by the KaooChat team
