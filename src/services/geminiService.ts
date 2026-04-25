import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function processVoiceOrder(audioBase64: string) {
  const prompt = `
    This is a voice order for a water tanker in Yemen. 
    Analyze the audio content and extract the following details in JSON format:
    - locationDescription: A text description of where the water should be delivered.
    - capacity: The requested amount of water in liters (look for numbers like 3000, 5000).
    - urgency: 'normal' or 'urgent'.
    - transcript: The full Arabic transcription of the order.

    If any field is not found, leave it null or as an empty string.
    Return ONLY valid JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "audio/wav",
              data: audioBase64
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error("Failed to parse order details from AI response");
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw error;
  }
}
