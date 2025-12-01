# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MCP server for Google Gemini API - text and image generation. Published as `@bopen-io/gemcp`.

## Commands

```bash
bun start         # Run server locally
npm publish       # Publish to npm (runs TypeScript directly via Bun)
```

## Architecture

Two-file structure:

- `src/index.ts` - MCP server setup, Zod schemas for tool inputs, request handlers
- `src/utils.ts` - Gemini API wrappers: `callGemini`, `callGeminiWithMessages`, `callGeminiImage`, `callGeminiUpscale`, `callGeminiEdit`, `callGeminiSvg`, `callGeminiSegment`

Version is read from `package.json` (single source of truth).

### Models Used

- Text: `gemini-3-pro-preview`
- SVG generation: `gemini-3-pro-preview` (chat model outputs SVG code)
- Image generation: `gemini-2.0-flash-preview-image-generation`
- Image upscale: `imagen-3.0-generate-002`
- Image edit: `imagen-3.0-capability-001`
- Segmentation: `gemini-2.5-flash` (returns masks for background removal)

### Tool Notes

- **SVG**: Uses the chat model since Gemini 3 Pro can emit valid inline SVG. Nano/Banana variants output raster only.
- **Segment**: Returns `box_2d` (normalized 0-1000) and base64 PNG masks. Masks are probability maps (0-255).

## Critical: Gemini Mime Type Bug

**Gemini API returns incorrect mime types for images.** DO NOT trust `img.mimeType` from API responses.

The fix: Use `file-type` library to detect actual format from image bytes before returning to Claude or saving to disk. See `detectMimeType()` in `src/index.ts`.

Without this fix, inline images break Claude sessions with "Image does not match provided media type" errors.

## Troubleshooting

If image generation breaks Claude sessions:
```bash
rm -rf ~/.bun/install/cache/@bopen-io          # Clear bun cache
rm -rf ~/.claude/projects/*your-project*       # Clear corrupted project cache
# Restart Claude Code
```

## Environment

`GEMINI_API_KEY` - Get from https://aistudio.google.com/apikey
