import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY!;
const ai = new GoogleGenAI({ apiKey });

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: 'Say hello',
});

console.log("=== response.text ===");
console.log(JSON.stringify(response.text));

console.log("\n=== response.candidates[0].content.parts ===");
console.log(JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
