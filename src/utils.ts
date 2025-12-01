import { GoogleGenAI } from "@google/genai";

export interface GeminiOptions {
  model?: string;
  instructions?: string;
  thinkingLevel?: 'low' | 'high';
  includeThoughts?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface GeminiResult {
  content: string;
  reasoning?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  options: GeminiOptions = {}
): Promise<GeminiResult> {
  const ai = new GoogleGenAI({ apiKey });
  const model = options.model || 'gemini-3-pro-preview';

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: options.instructions,
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
    }
  });

  // Extract text from candidates (response.text doesn't work for gemini-3)
  let content = '';
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) content += part.text;
    }
  }

  return {
    content,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0
    } : undefined
  };
}

export async function callGeminiWithMessages(
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  options: GeminiOptions = {}
): Promise<GeminiResult> {
  const ai = new GoogleGenAI({ apiKey });
  const model = options.model || 'gemini-3-pro-preview';

  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }]
    }));

  const response = await ai.models.generateContent({
    model,
    contents: chatMessages,
    config: {
      systemInstruction: options.instructions || systemMessage?.content,
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
    }
  });

  // Extract text from candidates (response.text doesn't work for gemini-3)
  let content = '';
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) content += part.text;
    }
  }

  return {
    content,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0
    } : undefined
  };
}

export interface GeminiImageResult {
  text?: string;
  images: Array<{ mimeType: string; data: string }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GeminiImageOptions {
  imageSize?: '512' | '1K' | '2K';
  inputImage?: { data: string; mimeType: string };
}

export async function callGeminiImage(
  apiKey: string,
  prompt: string,
  options: GeminiImageOptions = {}
): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

  if (options.inputImage) {
    parts.push({ inlineData: options.inputImage });
  }
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    }
  });

  const images: Array<{ mimeType: string; data: string }> = [];
  let text: string | undefined;

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        images.push({
          mimeType: part.inlineData.mimeType || 'image/png',
          data: part.inlineData.data || ''
        });
      } else if (part.text) {
        text = part.text;
      }
    }
  }

  return {
    text,
    images,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0
    } : undefined
  };
}
