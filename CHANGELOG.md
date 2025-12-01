# Changelog

## 0.0.8

- Fix response parsing for Gemini 3 models - extract text from `response.candidates[0].content.parts` instead of `response.text` which returns empty for gemini-3-pro-preview

## 0.0.7

- Initial release with gemini_generate, gemini_messages, and gemini_image tools
