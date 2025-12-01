---
name: setup
description: Configure Gemini MCP server - check status and get setup instructions
---

Check if the Gemini MCP server is configured correctly and help the user set it up if needed.

1. First, check if the `gemini` MCP server is connected by looking at the available tools. If you see `gemini_generate`, `gemini_messages`, and `gemini_image` tools, it's working.

2. If you only see `gemini_setup` tool or the server shows as failed, the user needs to set up their API key.

3. Provide these setup instructions:

**Get an API Key:**
- Go to https://aistudio.google.com/apikey
- Create a new API key

**Add to Shell Profile:**
Add this line to `~/.zshrc` (Mac) or `~/.bashrc` (Linux):
```bash
export GEMINI_API_KEY="your-api-key-here"
```

Then run:
```bash
source ~/.zshrc  # or ~/.bashrc
```

**Restart Claude Code** for the changes to take effect.

4. After the user confirms they've set up the key and restarted, verify the server is working by checking if the gemini tools are available.
