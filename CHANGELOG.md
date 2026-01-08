# Changelog

## 0.0.18

- Upgrade to @google/genai 1.34.0, @modelcontextprotocol/sdk 1.25.2, zod 4.x
- Add thinking mode support (thinking_level, include_thoughts parameters)
- Use new McpServer API with native zod schema handling
- Fix enum usage for EditMode and MaskReferenceMode
- Parse and return reasoning from model responses

## 0.0.8

- Fix response parsing for Gemini 3 models - extract text from `response.candidates[0].content.parts` instead of `response.text` which returns empty for gemini-3-pro-preview

## 0.0.7

- Initial release with gemini_generate, gemini_messages, and gemini_image tools
