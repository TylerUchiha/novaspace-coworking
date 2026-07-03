import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { geminiApiKeySecret } from './secrets';

const GEMINI_MODEL = 'gemini-2.5-flash';

export const supportChat = onCall({ cors: true, secrets: [geminiApiKeySecret] }, async (request) => {
  const message = typeof request.data?.message === 'string' ? request.data.message.trim() : '';
  if (!message) {
    throw new HttpsError('invalid-argument', 'Message is required.');
  }

  const apiKey = geminiApiKeySecret.value()?.trim();
  if (!apiKey) {
    throw new HttpsError(
      'failed-precondition',
      'Support chat is not configured. Set GEMINI_API_KEY in Secret Manager.',
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: GEMINI_MODEL,
      config: {
        systemInstruction:
          'You are the NovaSpace AI Support Assistant. NovaSpace is a premium coworking network. You help users with bookings, location information, amenities, and technical support. Speak casually, like a friendly coworker. Use emojis occasionally. Keep your messages very short and concise. Do NOT use markdown bolding like ** in your responses. If you do not know something, suggest they email support@novaspace.ai. LANGUAGE RULE: Detect the language of the user message and respond in that same language.',
      },
    });

    const response = await chat.sendMessage({ message });
    return { reply: response.text || "I'm sorry, I couldn't process that request." };
  } catch (error) {
    console.error('Support chat Gemini error:', error);
    throw new HttpsError('internal', 'Support chat could not reach Gemini. Please try again.');
  }
});
