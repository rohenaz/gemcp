# gemcp

MCP server for Google Gemini API - text and image generation.

## Install via Plugin

```bash
/plugin marketplace add b-open-io/claude-plugins
/plugin install gemcp@b-open-io
```

Then run `/gemcp:setup` to configure your API key.

## Install via CLI

```bash
claude mcp add -s user gemini -e GEMINI_API_KEY=$GEMINI_API_KEY -- bunx @bopen-io/gemcp
```

## Setup

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Add to your shell profile (`~/.zshrc` or `~/.bashrc`):
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```
3. Restart your terminal and Claude Code

## Tools

- `gemini_generate` - Text generation with optional thinking mode
- `gemini_messages` - Conversation-based generation
- `gemini_image` - Image generation and editing (pass `input_image` path for editing)

## Models

- `gemini-3-pro-preview` - Text (default)
- `gemini-3-pro-image-preview` - Images

## License

MIT
