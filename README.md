# gemcp

MCP server for Google Gemini API - text and image generation.

## Install

### From npm

```bash
bunx @bopen-io/gemcp
```

### Add to Claude Code

```bash
claude mcp add -s user gemini -e GEMINI_API_KEY=$GEMINI_API_KEY -- bunx @bopen-io/gemcp
```

## Tools

- `gemini_generate` - Text generation with optional thinking mode
- `gemini_messages` - Conversation-based generation
- `gemini_image` - Image generation and editing (pass `input_image` path for editing)

## Models

- `gemini-3-pro-preview` - Text (default)
- `gemini-3-pro-image-preview` - Images

## Environment

`GEMINI_API_KEY` - Get from [Google AI Studio](https://aistudio.google.com/apikey)

## License

MIT
