#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { callGemini, callGeminiWithMessages, callGeminiImage } from "./utils";

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
  output_path: z.string().optional().describe("Path to save the output image"),
  image_size: z.enum(["512", "1K", "2K"]).optional().default("1K").describe("Output image size"),
});

type GeminiGenerateArgs = z.infer<typeof GeminiGenerateSchema>;
type GeminiMessagesArgs = z.infer<typeof GeminiMessagesSchema>;
type GeminiImageArgs = z.infer<typeof GeminiImageSchema>;

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
- gemini_image: Image generation and editing
`.trim();

async function main() {
  const server = new Server({ name: "gemini-server", version: "0.0.4" }, { capabilities: { tools: {} } });

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

            let inputImageData: { data: string; mimeType: string } | undefined;
            if (args.input_image) {
              const absInputPath = resolve(args.input_image);
              const imageBuffer = await readFile(absInputPath);
              inputImageData = {
                data: imageBuffer.toString('base64'),
                mimeType: getMimeType(absInputPath)
              };
            }

            const result = await callGeminiImage(apiKey, args.prompt, {
              imageSize: args.image_size,
              inputImage: inputImageData
            });

            const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
            if (result.text) content.push({ type: "text", text: result.text });

            for (let i = 0; i < result.images.length; i++) {
              const img = result.images[i];
              const imgBuffer = Buffer.from(img.data, "base64");
              if (args.output_path) {
                const filePath = result.images.length > 1 ? args.output_path.replace(/(\.[^.]+)$/, `_${i + 1}$1`) : args.output_path;
                const absPath = resolve(filePath);
                await writeFile(absPath, imgBuffer);
                content.push({ type: "text", text: `Saved: ${absPath}` });
              } else {
                content.push({ type: "image", data: img.data, mimeType: img.mimeType });
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
