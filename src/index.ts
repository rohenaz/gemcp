#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Image } from "@google/genai";
import { callGemini, callGeminiWithMessages, callGeminiImage, callGeminiUpscale, callGeminiEdit, callGeminiSvg, callGeminiSegment } from "./utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(__dirname, "../package.json"), "utf-8")) as { version: string };

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const isConfigured = Boolean(apiKey);

const SetupSchema = z.object({});

const GeminiGenerateSchema = z.object({
  prompt: z.string().describe("The input text or prompt for Gemini"),
  model: z.string().optional().default("gemini-3-pro-preview").describe("Gemini model variant to use"),
  instructions: z.string().optional().describe("System instructions for the model"),
  thinking_level: z.enum(["low", "high"]).optional().describe("Thinking/reasoning depth level"),
  include_thoughts: z.boolean().optional().describe("Whether to include the model's reasoning in response"),
  max_tokens: z.number().optional().describe("Maximum tokens to generate"),
  temperature: z.number().min(0).max(2).optional().describe("Temperature for randomness (0-2)"),
  top_p: z.number().min(0).max(1).optional().describe("Top-p sampling parameter"),
});

const GeminiMessagesSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]).describe("Message role"),
    content: z.string().describe("Message content"),
  })).describe("Array of conversation messages"),
  model: z.string().optional().default("gemini-3-pro-preview").describe("Gemini model variant to use"),
  instructions: z.string().optional().describe("System instructions for the model"),
  thinking_level: z.enum(["low", "high"]).optional().describe("Thinking/reasoning depth level"),
  include_thoughts: z.boolean().optional().describe("Whether to include the model's reasoning in response"),
  max_tokens: z.number().optional().describe("Maximum tokens to generate"),
  temperature: z.number().min(0).max(2).optional().describe("Temperature for randomness (0-2)"),
  top_p: z.number().min(0).max(1).optional().describe("Top-p sampling parameter"),
});

const GeminiImageSchema = z.object({
  prompt: z.string().describe("The image generation or editing prompt"),
  input_image: z.string().optional().describe("Path to input image for editing/manipulation"),
  output_path: z.string().optional().describe("Path to save the output image (without extension - format determined by API)"),
  image_size: z.enum(["1K", "2K", "4K"]).optional().default("1K").describe("Output image size"),
  aspect_ratio: z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]).optional().describe("Aspect ratio for generated image"),
  negative_prompt: z.string().optional().describe("What to avoid in the generated image"),
  num_images: z.number().min(1).max(4).optional().describe("Number of images to generate (1-4)"),
  guidance_scale: z.number().optional().describe("How closely to follow the prompt (higher = more literal)"),
  seed: z.number().optional().describe("Random seed for reproducible results"),
});

const GeminiUpscaleSchema = z.object({
  input_image: z.string().describe("Path to input image to upscale"),
  output_path: z.string().optional().describe("Path to save the upscaled image (without extension)"),
  output_format: z.enum(["png", "jpeg", "webp"]).optional().describe("Output image format (supported in Imagen)"),
  jpeg_quality: z.number().min(0).max(100).optional().describe("JPEG compression quality (0-100)"),
  upscale_factor: z.enum(["x2", "x4"]).optional().default("x2").describe("Upscale factor"),
});

const GeminiEditSchema = z.object({
  prompt: z.string().describe("Description of the edit to make"),
  input_image: z.string().describe("Path to input image to edit"),
  mask_image: z.string().optional().describe("Path to mask image (white areas will be edited)"),
  output_path: z.string().optional().describe("Path to save the edited image (without extension)"),
  edit_mode: z.enum(["inpaint", "outpaint"]).optional().describe("Edit mode: inpaint fills masked areas, outpaint extends image"),
  output_format: z.enum(["png", "jpeg", "webp"]).optional().describe("Output image format (supported in Imagen)"),
  jpeg_quality: z.number().min(0).max(100).optional().describe("JPEG compression quality (0-100)"),
  negative_prompt: z.string().optional().describe("What to avoid in the edited areas"),
  num_images: z.number().min(1).max(4).optional().describe("Number of variations to generate (1-4)"),
  guidance_scale: z.number().optional().describe("How closely to follow the prompt"),
  seed: z.number().optional().describe("Random seed for reproducible results"),
});

const GeminiSvgSchema = z.object({
  prompt: z.string().describe("Description of the SVG to generate (e.g., 'a minimalist logo of a mountain')"),
  output_path: z.string().optional().describe("Path to save the SVG file"),
  instructions: z.string().optional().describe("Custom system instructions for SVG generation"),
});

const GeminiSegmentSchema = z.object({
  input_image: z.string().describe("Path to input image to segment"),
  prompt: z.string().optional().describe("Custom segmentation prompt (e.g., 'segment only the person' or 'find the background')"),
  output_mask_path: z.string().optional().describe("Path to save the combined mask as PNG (white = selected, black = background)"),
});

type GeminiGenerateArgs = z.infer<typeof GeminiGenerateSchema>;
type GeminiMessagesArgs = z.infer<typeof GeminiMessagesSchema>;
type GeminiImageArgs = z.infer<typeof GeminiImageSchema>;
type GeminiUpscaleArgs = z.infer<typeof GeminiUpscaleSchema>;
type GeminiEditArgs = z.infer<typeof GeminiEditSchema>;
type GeminiSvgArgs = z.infer<typeof GeminiSvgSchema>;
type GeminiSegmentArgs = z.infer<typeof GeminiSegmentSchema>;

function getMimeType(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  const types: Record<string, string> = {
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp'
  };
  return types[ext || ''] || 'image/png';
}


const SETUP_INSTRUCTIONS = `
Gemini MCP Server - Setup Required

GEMINI_API_KEY environment variable is not set.

Setup Steps:

1. Get an API key from Google AI Studio:
   https://aistudio.google.com/apikey

2. Add to your shell profile (~/.zshrc or ~/.bashrc):
   export GEMINI_API_KEY="your-api-key-here"

3. Restart your terminal and Claude Code

Alternative - Add directly via Claude CLI:
   claude mcp add -s user gemini -e GEMINI_API_KEY=your-key -- bunx @bopen-io/gemcp

After setup, restart Claude Code to enable all Gemini tools:
- gemini_generate: Text generation with thinking modes
- gemini_messages: Conversation-based generation
- gemini_image: Image generation with full control over format, size, aspect ratio
- gemini_upscale: Upscale images 2x or 4x
- gemini_edit: Edit images with inpainting/outpainting
`.trim();

async function main() {
  const server = new Server({ name: "gemini-server", version: pkg.version }, { capabilities: { tools: {} } });

  server.onerror = (error) => console.error("MCP Server Error:", error);
  process.on("SIGINT", async () => { await server.close(); process.exit(0); });

  if (!isConfigured) {
    // Not configured - only show setup tool
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        { name: "gemini_setup", description: "Get setup instructions for the Gemini MCP server. GEMINI_API_KEY is not configured.", inputSchema: zodToJsonSchema(SetupSchema) },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "gemini_setup") {
        return { content: [{ type: "text", text: SETUP_INSTRUCTIONS }] };
      }
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    });
  } else {
    // Configured - show all tools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        { name: "gemini_generate", description: "Generate text using Google Gemini API with a simple input prompt. Supports thinking/reasoning modes.", inputSchema: zodToJsonSchema(GeminiGenerateSchema) },
        { name: "gemini_messages", description: "Generate text using Gemini with structured conversation messages. Supports thinking/reasoning modes.", inputSchema: zodToJsonSchema(GeminiMessagesSchema) },
        { name: "gemini_image", description: "Generate or edit images using Gemini. Pass input_image path for editing, or just prompt for generation. Saves to output_path.", inputSchema: zodToJsonSchema(GeminiImageSchema) },
        { name: "gemini_upscale", description: "Upscale an image using Imagen. Supports 2x and 4x upscaling with format control.", inputSchema: zodToJsonSchema(GeminiUpscaleSchema) },
        { name: "gemini_edit", description: "Edit an image using Imagen with optional mask for inpainting/outpainting.", inputSchema: zodToJsonSchema(GeminiEditSchema) },
        { name: "gemini_svg", description: "Generate SVG code using Gemini 3 Pro. Best for logos, icons, and simple vector graphics.", inputSchema: zodToJsonSchema(GeminiSvgSchema) },
        { name: "gemini_segment", description: "Segment objects in an image using Gemini 2.5. Returns masks for background removal or object isolation.", inputSchema: zodToJsonSchema(GeminiSegmentSchema) },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "gemini_generate": {
            const args = GeminiGenerateSchema.parse(request.params.arguments) as GeminiGenerateArgs;
            const result = await callGemini(apiKey, args.prompt, {
              model: args.model, instructions: args.instructions, thinkingLevel: args.thinking_level,
              includeThoughts: args.include_thoughts, maxTokens: args.max_tokens, temperature: args.temperature, topP: args.top_p,
            });
            let text = result.reasoning ? `**Reasoning:**\n${result.reasoning}\n\n**Response:**\n${result.content}` : result.content;
            if (result.usage) text += `\n\n**Usage:** ${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion, ${result.usage.totalTokens} total`;
            return { content: [{ type: "text", text }] };
          }

          case "gemini_messages": {
            const args = GeminiMessagesSchema.parse(request.params.arguments) as GeminiMessagesArgs;
            const result = await callGeminiWithMessages(apiKey, args.messages, {
              model: args.model, instructions: args.instructions, thinkingLevel: args.thinking_level,
              includeThoughts: args.include_thoughts, maxTokens: args.max_tokens, temperature: args.temperature, topP: args.top_p,
            });
            let text = result.reasoning ? `**Reasoning:**\n${result.reasoning}\n\n**Response:**\n${result.content}` : result.content;
            if (result.usage) text += `\n\n**Usage:** ${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion, ${result.usage.totalTokens} total`;
            return { content: [{ type: "text", text }] };
          }

          case "gemini_image": {
            const args = GeminiImageSchema.parse(request.params.arguments) as GeminiImageArgs;

            let inputImage: Image | undefined;
            if (args.input_image) {
              const absInputPath = resolve(args.input_image);
              const imageBuffer = await readFile(absInputPath);
              inputImage = {
                imageBytes: imageBuffer.toString('base64'),
                mimeType: getMimeType(absInputPath)
              };
            }

            const result = await callGeminiImage(apiKey, args.prompt, {
              imageSize: args.image_size,
              aspectRatio: args.aspect_ratio,
              negativePrompt: args.negative_prompt,
              numberOfImages: args.num_images,
              guidanceScale: args.guidance_scale,
              seed: args.seed,
              inputImage
            });

            const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
            if (result.text) content.push({ type: "text", text: result.text });

            for (let i = 0; i < result.images.length; i++) {
              const img = result.images[i];
              if (args.output_path) {
                const ext = img.mimeType === 'image/png' ? '.png' : img.mimeType === 'image/webp' ? '.webp' : '.jpg';
                let filePath = args.output_path.replace(/\.[^.]+$/, '') + ext;
                if (result.images.length > 1) filePath = filePath.replace(/(\.[^.]+)$/, `_${i + 1}$1`);
                const absPath = resolve(filePath);
                await writeFile(absPath, Buffer.from(img.data, "base64"));
                content.push({ type: "text", text: `Saved: ${absPath}` });
              } else {
                content.push({ type: "image", data: img.data, mimeType: img.mimeType });
              }
            }

            if (result.usage) content.push({ type: "text", text: `**Usage:** ${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion, ${result.usage.totalTokens} total` });
            return { content };
          }

          case "gemini_upscale": {
            const args = GeminiUpscaleSchema.parse(request.params.arguments) as GeminiUpscaleArgs;
            const absInputPath = resolve(args.input_image);
            const imageBuffer = await readFile(absInputPath);
            const inputImage: Image = {
              imageBytes: imageBuffer.toString('base64'),
              mimeType: getMimeType(absInputPath)
            };

            const result = await callGeminiUpscale(apiKey, inputImage, {
              upscaleFactor: args.upscale_factor,
              outputFormat: args.output_format,
              jpegQuality: args.jpeg_quality
            });

            const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
            for (let i = 0; i < result.images.length; i++) {
              const img = result.images[i];
              if (args.output_path) {
                const ext = img.mimeType === 'image/png' ? '.png' : img.mimeType === 'image/webp' ? '.webp' : '.jpg';
                let filePath = args.output_path.replace(/\.[^.]+$/, '') + ext;
                if (result.images.length > 1) filePath = filePath.replace(/(\.[^.]+)$/, `_${i + 1}$1`);
                const absPath = resolve(filePath);
                await writeFile(absPath, Buffer.from(img.data, "base64"));
                content.push({ type: "text", text: `Saved: ${absPath}` });
              } else {
                content.push({ type: "image", data: img.data, mimeType: img.mimeType });
              }
            }
            return { content };
          }

          case "gemini_edit": {
            const args = GeminiEditSchema.parse(request.params.arguments) as GeminiEditArgs;
            const absInputPath = resolve(args.input_image);
            const imageBuffer = await readFile(absInputPath);
            const inputImage: Image = {
              imageBytes: imageBuffer.toString('base64'),
              mimeType: getMimeType(absInputPath)
            };

            let maskImage: Image | undefined;
            if (args.mask_image) {
              const absMaskPath = resolve(args.mask_image);
              const maskBuffer = await readFile(absMaskPath);
              maskImage = {
                imageBytes: maskBuffer.toString('base64'),
                mimeType: getMimeType(absMaskPath)
              };
            }

            const result = await callGeminiEdit(apiKey, args.prompt, inputImage, maskImage, {
              editMode: args.edit_mode,
              outputFormat: args.output_format,
              jpegQuality: args.jpeg_quality,
              negativePrompt: args.negative_prompt,
              numberOfImages: args.num_images,
              guidanceScale: args.guidance_scale,
              seed: args.seed
            });

            const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
            if (result.text) content.push({ type: "text", text: result.text });

            for (let i = 0; i < result.images.length; i++) {
              const img = result.images[i];
              if (args.output_path) {
                const ext = img.mimeType === 'image/png' ? '.png' : img.mimeType === 'image/webp' ? '.webp' : '.jpg';
                let filePath = args.output_path.replace(/\.[^.]+$/, '') + ext;
                if (result.images.length > 1) filePath = filePath.replace(/(\.[^.]+)$/, `_${i + 1}$1`);
                const absPath = resolve(filePath);
                await writeFile(absPath, Buffer.from(img.data, "base64"));
                content.push({ type: "text", text: `Saved: ${absPath}` });
              } else {
                content.push({ type: "image", data: img.data, mimeType: img.mimeType });
              }
            }
            return { content };
          }

          case "gemini_svg": {
            const args = GeminiSvgSchema.parse(request.params.arguments) as GeminiSvgArgs;
            const result = await callGeminiSvg(apiKey, args.prompt, {
              instructions: args.instructions
            });

            if (args.output_path) {
              const absPath = resolve(args.output_path);
              await writeFile(absPath, result.svg);
              let text = `Saved SVG: ${absPath}`;
              if (result.usage) text += `\n\n**Usage:** ${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion, ${result.usage.totalTokens} total`;
              return { content: [{ type: "text", text }] };
            }

            let text = result.svg;
            if (result.usage) text += `\n\n**Usage:** ${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion, ${result.usage.totalTokens} total`;
            return { content: [{ type: "text", text }] };
          }

          case "gemini_segment": {
            const args = GeminiSegmentSchema.parse(request.params.arguments) as GeminiSegmentArgs;
            const absInputPath = resolve(args.input_image);
            const imageBuffer = await readFile(absInputPath);
            const inputImage: Image = {
              imageBytes: imageBuffer.toString('base64'),
              mimeType: getMimeType(absInputPath)
            };

            const result = await callGeminiSegment(apiKey, inputImage, args.prompt);

            const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];

            if (result.masks.length === 0) {
              content.push({ type: "text", text: "No objects detected for segmentation." });
            } else {
              // Return mask data as JSON for further processing
              const maskInfo = result.masks.map((m, i) => ({
                index: i,
                label: m.label,
                box_2d: m.box_2d,
                mask_base64_length: m.mask.length
              }));
              content.push({ type: "text", text: `Found ${result.masks.length} segment(s):\n${JSON.stringify(maskInfo, null, 2)}` });

              // If output path specified, save the first mask (or combined mask)
              if (args.output_mask_path && result.masks.length > 0) {
                // Return the first mask as a PNG
                const firstMask = result.masks[0];
                const absPath = resolve(args.output_mask_path);
                const maskBuffer = Buffer.from(firstMask.mask, 'base64');
                await writeFile(absPath, maskBuffer);
                content.push({ type: "text", text: `Saved mask: ${absPath} (label: ${firstMask.label})` });
              }
            }

            if (result.usage) content.push({ type: "text", text: `**Usage:** ${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion, ${result.usage.totalTokens} total` });
            return { content };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Gemini API error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(isConfigured ? "Gemini MCP server running" : "Gemini MCP server running (setup required)");
}

main().catch((error) => { console.error("Server error:", error); process.exit(1); });
