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

// Image generation types and functions

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
  imageSize?: '1K' | '2K' | '4K';
  aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  jpegQuality?: number;
  negativePrompt?: string;
  numberOfImages?: number;
  guidanceScale?: number;
  seed?: number;
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

  // Build image config
  const imageConfig: Record<string, unknown> = {};
  if (options.imageSize) imageConfig.imageSize = options.imageSize;
  if (options.aspectRatio) imageConfig.aspectRatio = options.aspectRatio;

  // Map output format to mime type
  const formatToMime: Record<string, string> = {
    'png': 'image/png',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp'
  };
  if (options.outputFormat) {
    imageConfig.outputMimeType = formatToMime[options.outputFormat];
  }
  if (options.jpegQuality !== undefined) {
    imageConfig.outputCompressionQuality = options.jpegQuality;
  }

  // Build generation config
  const config: Record<string, unknown> = {
    responseModalities: ['IMAGE', 'TEXT'],
  };

  if (Object.keys(imageConfig).length > 0) {
    config.imageConfig = imageConfig;
  }
  if (options.negativePrompt) config.negativePrompt = options.negativePrompt;
  if (options.numberOfImages) config.numberOfImages = options.numberOfImages;
  if (options.guidanceScale) config.guidanceScale = options.guidanceScale;
  if (options.seed !== undefined) config.seed = options.seed;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts }],
    config
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

// Upscale image

export interface GeminiUpscaleOptions {
  outputFormat?: 'png' | 'jpeg' | 'webp';
  jpegQuality?: number;
  upscaleFactor?: '2x' | '4x';
}

export async function callGeminiUpscale(
  apiKey: string,
  imageData: { data: string; mimeType: string },
  options: GeminiUpscaleOptions = {}
): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey });

  const formatToMime: Record<string, string> = {
    'png': 'image/png',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp'
  };

  const config: Record<string, unknown> = {};
  if (options.outputFormat) {
    config.outputMimeType = formatToMime[options.outputFormat];
  }
  if (options.jpegQuality !== undefined) {
    config.outputCompressionQuality = options.jpegQuality;
  }
  if (options.upscaleFactor) {
    config.upscaleFactor = options.upscaleFactor;
  }

  const response = await ai.models.upscaleImage({
    model: 'imagen-3.0-generate-002',
    image: imageData,
    config
  });

  const images: Array<{ mimeType: string; data: string }> = [];

  if (response.generatedImages) {
    for (const img of response.generatedImages) {
      if (img.image?.imageBytes) {
        images.push({
          mimeType: img.image.mimeType || 'image/png',
          data: img.image.imageBytes
        });
      }
    }
  }

  return { images };
}

// Edit image with mask

export interface GeminiEditOptions {
  outputFormat?: 'png' | 'jpeg' | 'webp';
  jpegQuality?: number;
  negativePrompt?: string;
  numberOfImages?: number;
  guidanceScale?: number;
  seed?: number;
  editMode?: 'inpaint' | 'outpaint';
}

// SVG generation types
export interface GeminiSvgResult {
  svg: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Segmentation types
export interface SegmentationMask {
  box_2d: [number, number, number, number]; // [y0, x0, y1, x1] normalized 0-1000
  mask: string; // base64 encoded PNG
  label: string;
}

export interface GeminiSegmentResult {
  masks: SegmentationMask[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function callGeminiEdit(
  apiKey: string,
  prompt: string,
  imageData: { data: string; mimeType: string },
  maskData?: { data: string; mimeType: string },
  options: GeminiEditOptions = {}
): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey });

  const formatToMime: Record<string, string> = {
    'png': 'image/png',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp'
  };

  const config: Record<string, unknown> = {};
  if (options.outputFormat) {
    config.outputMimeType = formatToMime[options.outputFormat];
  }
  if (options.jpegQuality !== undefined) {
    config.outputCompressionQuality = options.jpegQuality;
  }
  if (options.negativePrompt) config.negativePrompt = options.negativePrompt;
  if (options.numberOfImages) config.numberOfImages = options.numberOfImages;
  if (options.guidanceScale) config.guidanceScale = options.guidanceScale;
  if (options.seed !== undefined) config.seed = options.seed;
  if (options.editMode) config.editMode = options.editMode.toUpperCase();

  const editParams: Record<string, unknown> = {
    model: 'imagen-3.0-capability-001',
    prompt,
    image: imageData,
    config
  };

  if (maskData) {
    editParams.mask = maskData;
  }

  const response = await ai.models.editImage(editParams as Parameters<typeof ai.models.editImage>[0]);

  const images: Array<{ mimeType: string; data: string }> = [];
  let text: string | undefined;

  if (response.generatedImages) {
    for (const img of response.generatedImages) {
      if (img.image?.imageBytes) {
        images.push({
          mimeType: img.image.mimeType || 'image/png',
          data: img.image.imageBytes
        });
      }
    }
  }

  return { text, images };
}

// Generate SVG via chat model
export async function callGeminiSvg(
  apiKey: string,
  prompt: string,
  options: { instructions?: string } = {}
): Promise<GeminiSvgResult> {
  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = options.instructions ||
    'You are an expert SVG designer. Generate clean, optimized SVG code. Output ONLY the SVG code with no markdown fences or explanation. The SVG should be self-contained with proper viewBox and xmlns attributes.';

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    }
  });

  let svg = '';
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) svg += part.text;
    }
  }

  // Clean up any markdown fences that might have been included
  svg = svg.trim();
  if (svg.startsWith('```svg')) svg = svg.slice(6);
  else if (svg.startsWith('```xml')) svg = svg.slice(6);
  else if (svg.startsWith('```')) svg = svg.slice(3);
  if (svg.endsWith('```')) svg = svg.slice(0, -3);
  svg = svg.trim();

  return {
    svg,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0
    } : undefined
  };
}

// Segment image using Gemini 2.5
export async function callGeminiSegment(
  apiKey: string,
  imageData: { data: string; mimeType: string },
  prompt?: string
): Promise<GeminiSegmentResult> {
  const ai = new GoogleGenAI({ apiKey });

  const segmentPrompt = prompt ||
    'Give the segmentation masks for all objects. Output a JSON list of segmentation masks where each entry contains the 2D bounding box in the key "box_2d", the segmentation mask in key "mask", and the text label in the key "label". Use descriptive labels.';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: imageData },
          { text: segmentPrompt }
        ]
      }
    ],
    config: {
      temperature: 0,
      responseModalities: ['TEXT'],
    }
  });

  let jsonText = '';
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) jsonText += part.text;
    }
  }

  // Parse JSON from response (handle markdown fences)
  jsonText = jsonText.trim();
  if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
  else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
  if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
  jsonText = jsonText.trim();

  let masks: SegmentationMask[] = [];
  try {
    const parsed = JSON.parse(jsonText);
    // Handle data URI format in mask field
    masks = parsed.map((m: { box_2d: [number, number, number, number]; mask: string; label: string }) => ({
      ...m,
      mask: m.mask.startsWith('data:') ? m.mask.split(',')[1] : m.mask
    }));
  } catch {
    // If parsing fails, return empty masks
  }

  return {
    masks,
    usage: response.usageMetadata ? {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0
    } : undefined
  };
}
