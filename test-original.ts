import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY!;
const ai = new GoogleGenAI({ apiKey });

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: 'Say hello',
});

// Original code uses response.text
console.log("=== Using response.text (original) ===");
console.log("Result:", JSON.stringify(response.text || ''));

// My fix uses candidates
console.log("\n=== Using candidates (my fix) ===");
let content = '';
if (response.candidates?.[0]?.content?.parts) {
  for (const part of response.candidates[0].content.parts) {
    if (part.text) content += part.text;
  }
}
console.log("Result:", JSON.stringify(content));
