import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI, Type } from '@google/genai';
import { geminiApiKeySecret } from './secrets';

const GEMINI_MODEL = 'gemini-2.5-flash';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface LocationContext {
  id: string;
  name: string;
  city?: string;
  description?: string;
  tags?: string[];
}

function detectLanguageDialectResponse(input: string): boolean {
  const normalized = input.trim();
  const languages = [
    'English', 'Spanish', 'French', 'German', 'Chinese', 'Portuguese', 'Italian',
    'Japanese', 'Arabic', 'Hindi', 'Russian', 'Dutch', 'Korean', 'Turkish',
  ];
  const dialects = ['US', 'UK', 'Egyptian', 'Gulf', 'Levantine', 'Canadian', 'European'];

  for (const lang of languages) {
    for (const dia of dialects) {
      const pattern1 = new RegExp(`\\b${lang}\\b\\s*[\\(\\[\\-/,]?\\s*\\b${dia}\\b`, 'i');
      const pattern2 = new RegExp(`\\b${dia}\\b\\s*[\\(\\[\\-/,]?\\s*\\b${lang}\\b`, 'i');
      if (pattern1.test(normalized) || pattern2.test(normalized)) return true;
    }
  }
  return false;
}

async function runNovaBot(
  apiKey: string,
  userPrompt: string,
  locations: LocationContext[],
  history: ChatMessage[],
  allAvailableTags: string[],
  allAvailableCities: string[],
  userName?: string,
  userProfession?: string,
) {
  if (detectLanguageDialectResponse(userPrompt)) {
    return {
      reply: userPrompt,
      matchingLocationIds: locations.map((l) => l.id),
      matchingTags: [] as string[],
      matchingCities: [] as string[],
      filterAction: 'replace' as const,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const locationContext = locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    city: loc.city || '',
    description: loc.description || '',
    tags: loc.tags || [],
  }));

  const chatHistory = history.map((h) => ({
    role: h.role,
    parts: [{ text: h.text }],
  }));

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [...chatHistory, { role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: `You are "Nova Bot", a friendly workspace matchmaker for NovaSpace coworking.
Available Workspaces: ${JSON.stringify(locationContext, null, 2)}
Available Filter Tags: ${JSON.stringify(allAvailableTags)}
Available Cities: ${JSON.stringify(allAvailableCities)}
User name: "${userName || 'there'}", profession: "${userProfession || 'Member'}".
Help the user pick a workspace. Respond in the SAME language as the user's message (including Arabic dialects like Egyptian Franco-Arabic "3aml eh" — reply in Egyptian Arabic).
Return JSON with reply, matchingLocationIds, matchingTags, matchingCities, filterAction (replace|append).`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          matchingLocationIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchingTags: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchingCities: { type: Type.ARRAY, items: { type: Type.STRING } },
          filterAction: { type: Type.STRING, enum: ['replace', 'append'] },
        },
        required: ['reply', 'matchingLocationIds', 'matchingTags', 'matchingCities', 'filterAction'],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch {
    return {
      reply: 'I found some great spots for you! Check the list on the left.',
      matchingLocationIds: locations.map((l) => l.id),
      matchingTags: [],
      matchingCities: [],
      filterAction: 'replace' as const,
    };
  }
}

export const novaBotChat = onCall({ cors: true, secrets: [geminiApiKeySecret] }, async (request) => {
  const apiKey = geminiApiKeySecret.value()?.trim();
  if (!apiKey) {
    throw new HttpsError(
      'failed-precondition',
      'Nova Bot is not configured. Set GEMINI_API_KEY in Secret Manager (firebase functions:secrets:set GEMINI_API_KEY).',
    );
  }

  const data = request.data as {
    userPrompt?: string;
    locations?: LocationContext[];
    history?: ChatMessage[];
    allAvailableTags?: string[];
    allAvailableCities?: string[];
    userName?: string;
    userProfession?: string;
  };

  if (!data.userPrompt?.trim()) {
    throw new HttpsError('invalid-argument', 'Message is required.');
  }

  try {
    return await runNovaBot(
      apiKey,
      data.userPrompt.trim(),
      data.locations || [],
      data.history || [],
      data.allAvailableTags || [],
      data.allAvailableCities || [],
      data.userName,
      data.userProfession,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Nova Bot Gemini error:', message);

    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('prepayment credits')) {
      throw new HttpsError(
        'resource-exhausted',
        'Nova Bot is temporarily unavailable — your Gemini API credits are used up. Add billing at https://aistudio.google.com/apikey then try again.',
      );
    }

    if (message.includes('403') || message.includes('API key not valid')) {
      throw new HttpsError(
        'failed-precondition',
        'Nova Bot API key is invalid. Update GEMINI_API_KEY in Secret Manager and redeploy.',
      );
    }

    throw new HttpsError('internal', 'Nova Bot could not reach Gemini. Please try again in a moment.');
  }
});
