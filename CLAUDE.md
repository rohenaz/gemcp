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
- Image generation: `gemini-3-pro-image-preview`
- Image upscale: `imagen-3.0-generate-002`
- Image edit: `imagen-3.0-capability-001`
- Segmentation: `gemini-2.5-flash` (returns masks for background removal)

### API Limitations (from SDK types)

**gemini_image** (generateContent with ImageConfig):
- SUPPORTED: `aspectRatio`, `imageSize`
- NOT SUPPORTED: `outputMimeType`, `outputCompressionQuality` (SDK explicitly states these are not supported in Gemini API)

**gemini_upscale/gemini_edit** (Imagen APIs):
- SUPPORTED: `outputMimeType`, `outputCompressionQuality` - format control works
- upscaleFactor uses `x2`/`x4` format (lowercase x)
- editImage uses `referenceImages` array with `RawReferenceImage` and `MaskReferenceImage` classes

### Tool Notes

- **SVG**: Uses the chat model since Gemini 3 Pro can emit valid inline SVG. Nano/Banana variants output raster only.
- **Segment**: Returns `box_2d` (normalized 0-1000) and base64 PNG masks. Masks are probability maps (0-255).
- **File Extension**: All image saves use mimeType from API response to determine extension - user provides path without extension.

## Environment

`GEMINI_API_KEY` - Get from https://aistudio.google.com/apikey
