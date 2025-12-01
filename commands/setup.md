---
name: setup
description: Configure Gemini MCP server - check status and get setup instructions
---

Help the user get the Gemini MCP server working. Follow these diagnostic steps:

## Step 1: Check Current Status

First, check if gemini tools are available. Look for `mcp__gemini__gemini_generate`, `mcp__gemini__gemini_messages`, and `mcp__gemini__gemini_image` in your available tools.

If you see these tools, the server is working. Tell the user and stop here.

## Step 2: Check API Key

Run this command to verify the API key is set:
```bash
echo "GEMINI_API_KEY is ${GEMINI_API_KEY:+set (${#GEMINI_API_KEY} chars)}"
```

If NOT set, provide setup instructions:

**Get an API Key:**
- Go to https://aistudio.google.com/apikey
- Create a new API key

**Add to Shell Profile:**
```bash
echo 'export GEMINI_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

Then restart Claude Code.

## Step 3: Test MCP Server Directly

If API key is set but server still fails, test it directly:
```bash
GEMINI_API_KEY="$GEMINI_API_KEY" bunx @bopen-io/gemcp 2>&1 &
sleep 2
kill %1 2>/dev/null
```

Should output "Gemini MCP server running". If it exits silently or errors, proceed to Step 4.

## Step 4: Clear Bun Cache

Stale cached versions cause connection failures. Clear them:
```bash
rm -rf ~/.bun/install/cache/@bopen-io/gemcp*
```

Then test again with Step 3. If it works, restart Claude Code.

## Step 5: Force Fresh Install (Nuclear Option)

If still failing, do a complete reset:
```bash
# Clear all caches
rm -rf ~/.bun/install/cache/@bopen-io/gemcp*
bun pm cache rm

# Install globally to prime the cache
bun add -g @bopen-io/gemcp

# Verify it works
GEMINI_API_KEY="$GEMINI_API_KEY" gemcp &
sleep 2
kill %1 2>/dev/null
```

After this works, restart Claude Code. The plugin should now connect.

## Step 6: Check Plugin Installation

Verify the plugin is installed:
```bash
cat ~/.claude/plugins/installed_plugins.json | grep -A5 gemcp
```

If not found, install the plugin:
```
/plugin marketplace add b-open-io/claude-plugins
/plugin install gemcp@b-open-io
```

## Common Issues

- **"Connection closed" after ~30ms**: Stale bun cache. Run Step 4.
- **No output from bunx**: Corrupted cache. Run Step 5.
- **API key set but tools not showing**: Restart Claude Code after clearing cache.
- **Two gemini servers**: Remove any manual .mcp.json entries - use only the plugin.
