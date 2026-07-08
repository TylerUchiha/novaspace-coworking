
import { GoogleGenAI, Type } from "@google/genai";
import { novaBotChatRemote } from "./cloudFunctions";

const GEMINI_MODEL = "gemini-2.5-flash";

function getClientApiKey(): string | undefined {
  if (!import.meta.env.DEV) {
    return undefined;
  }
  const key = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  return key && key.length > 0 ? key : undefined;
}

export const detectLanguageDialectResponse = (input: string): boolean => {
  const normalized = input.trim();
  
  const languages = [
    'English', 'Spanish', 'French', 'German', 'Chinese', 'Portuguese', 'Italian', 
    'Japanese', 'Arabic', 'Hindi', 'Russian', 'Dutch', 'Korean', 'Turkish', 
    'Vietnamese', 'Polish', 'Greek', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Hebrew', 'Indonesian'
  ];
  
  const dialects = [
    'US', 'UK', 'AU', 'CA', 'NZ', 'IN', 'GB', 'USA', 'Mexican', 'Spain', 'LATAM', 
    'Argentinian', 'Castilian', 'Canadian', 'France', 'Belgian', 'Swiss', 'Mandarin', 
    'Cantonese', 'Simplified', 'Traditional', 'Brazilian', 'Portugal', 'Egyptian', 
    'Gulf', 'Levantine', 'Austrian', 'Ireland', 'Irish', 'American', 'British', 
    'Australian', 'Quebec', 'European', 'Standard', 'Beijing', 'Taiwanese', 'Singapore', 'South Africa'
  ];

  for (const lang of languages) {
    for (const dia of dialects) {
      const pattern1 = new RegExp(`\\b${lang}\\b\\s*[\\(\\[\\-/,]?\\s*\\b${dia}\\b\\s*[\\)\\]]?`, 'i');
      const pattern2 = new RegExp(`\\b${dia}\\b\\s*[\\(\\[\\-/,]?\\s*\\b${lang}\\b\\s*[\\)\\]]?`, 'i');
      if (pattern1.test(normalized) || pattern2.test(normalized)) {
        return true;
      }
    }
  }
  
  return false;
};

export type NovaBotResponse = {
  reply: string;
  matchingLocationIds: string[];
  matchingTags: string[];
  matchingCities: string[];
  filterAction: 'replace' | 'append';
  shouldApplyFilters: boolean;
};

const CASUAL_CHAT_PATTERN = /^(hi|hello|hey|howdy|yo|sup|thanks|thank you|ok|okay|cool|nice|good morning|good afternoon|good evening)[\s!.?]*$/i;

export function shouldApplyNovaBotFilters(response: NovaBotResponse, userPrompt?: string): boolean {
  if (userPrompt && CASUAL_CHAT_PATTERN.test(userPrompt.trim())) {
    return false;
  }
  return response.shouldApplyFilters === true;
}

export type NovaBotFilterUpdates = {
  chatbotFilteredIds: string[] | null;
  selectedTags: string[];
  selectedCities: string[];
};

export function getNovaBotFilterUpdates(
  response: NovaBotResponse,
  selectedTags: string[],
  selectedCities: string[],
  userPrompt?: string,
): NovaBotFilterUpdates | null {
  if (!shouldApplyNovaBotFilters(response, userPrompt)) {
    return null;
  }

  const nextTags = response.filterAction === 'replace' ? [] : [...selectedTags];
  const nextCities = response.filterAction === 'replace' ? [] : [...selectedCities];

  let newTags = selectedTags;
  if (response.matchingTags?.length > 0) {
    newTags = Array.from(new Set([...nextTags, ...response.matchingTags]));
  } else if (response.filterAction === 'replace') {
    newTags = [];
  }

  let newCities = selectedCities;
  if (response.matchingCities?.length > 0) {
    newCities = Array.from(new Set([...nextCities, ...response.matchingCities]));
  } else if (response.filterAction === 'replace') {
    newCities = [];
  }

  const chatbotFilteredIds =
    response.matchingLocationIds?.length > 0 ? response.matchingLocationIds : null;

  return { chatbotFilteredIds, selectedTags: newTags, selectedCities: newCities };
}

export function getNovaBotErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (message.includes('prepayment credits') || message.includes('resource-exhausted')) {
      return 'Nova Bot is out of Gemini API credits. Add billing at aistudio.google.com/apikey, then try again.';
    }
    if (message.includes('API key is not configured') || message.includes('API key is invalid')) {
      return 'Nova Bot is not configured yet. Please contact support.';
    }
    if (message.length > 0 && message.length < 300 && !message.includes('FirebaseError')) {
      return message;
    }
  }
  return "I'm having a little trouble connecting to my brain right now, but feel free to try again or use the filters!";
}

async function getNovaBotResponseClient(
  userPrompt: string,
  locations: any[],
  history: { role: 'user' | 'model'; text: string }[],
  allAvailableTags: string[] = [],
  allAvailableCities: string[] = [],
  userName?: string,
  userProfession?: string,
): Promise<NovaBotResponse> {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const locationContext = locations.map(loc => ({
    id: loc.id,
    name: loc.name,
    city: loc.city || '',
    description: loc.description || '',
    tags: loc.tags || []
  }));

  const chatHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  const userFirstName = userName ? userName.split(' ')[0] : '';

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      ...chatHistory,
      { role: "user", parts: [{ text: userPrompt }] }
    ],
    config: {
      systemInstruction: `You are "Nova Bot", a friendly and intelligent workspace matchmaker AI.
Your sole mission is to help the user filter and figure out which co-working spaces/properties they want to work in today.

Available Workspaces:
${JSON.stringify(locationContext, null, 2)}

Available Filter Tags:
${JSON.stringify(allAvailableTags)}

Available Cities:
${JSON.stringify(allAvailableCities)}

Instructions:
1. Greet the user nicely and reference their query.
2. Based on their preferences, identify which workspaces match.
3. Respond in a friendly, conversational tone.
4. Return JSON matching the schema.
5. LANGUAGE RULE: Respond in the SAME language as the user (including Egyptian Arabic for Franco-Arabic like "3aml eh").
6. User name: "${userName || 'there'}", profession: "${userProfession || 'Member'}". Greet playfully as "hey ${userFirstName || 'there'}".

FILTER RULES (critical):
- Set shouldApplyFilters to false for greetings, small talk, thanks, or general questions (e.g. "hello", "hi", "how are you"). Reply warmly but do NOT change any filters.
- Set shouldApplyFilters to true ONLY when the user mentions workspace preferences: city, tags, amenities, "show me", "I want", "find", "looking for", etc.
- When shouldApplyFilters is false, return empty arrays for matchingLocationIds, matchingTags, matchingCities.
- When shouldApplyFilters is true and showing all / clearing filters, set matchingLocationIds to ALL workspace ids.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          matchingLocationIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchingTags: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchingCities: { type: Type.ARRAY, items: { type: Type.STRING } },
          filterAction: { type: Type.STRING, enum: ["replace", "append"] },
          shouldApplyFilters: { type: Type.BOOLEAN },
        },
        required: ["reply", "matchingLocationIds", "matchingTags", "matchingCities", "filterAction", "shouldApplyFilters"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Failed to parse Nova Bot response:", error);
    return {
      reply: "I found some great spots for you! Let me show them on the list.",
      matchingLocationIds: locations.map(l => l.id),
      matchingTags: [],
      matchingCities: [],
      filterAction: "replace",
      shouldApplyFilters: false,
    };
  }
}

export const getNovaBotResponse = async (
  userPrompt: string,
  locations: any[],
  history: { role: 'user' | 'model'; text: string }[],
  allAvailableTags: string[] = [],
  allAvailableCities: string[] = [],
  userName?: string,
  userProfession?: string
): Promise<NovaBotResponse> => {
  if (detectLanguageDialectResponse(userPrompt)) {
    return {
      reply: userPrompt,
      matchingLocationIds: locations.map(l => l.id),
      matchingTags: [],
      matchingCities: [],
      filterAction: 'replace',
      shouldApplyFilters: false,
    };
  }

  try {
    return await novaBotChatRemote({
      userPrompt,
      locations,
      history,
      allAvailableTags,
      allAvailableCities,
      userName,
      userProfession,
    });
  } catch (cloudError) {
    console.warn('Nova Bot cloud function failed, trying local API key fallback.', cloudError);
    const cloudMessage = getNovaBotErrorMessage(cloudError);
    if (cloudMessage.includes('out of Gemini API credits') || cloudMessage.includes('prepayment credits')) {
      throw cloudError;
    }
    return getNovaBotResponseClient(
      userPrompt,
      locations,
      history,
      allAvailableTags,
      allAvailableCities,
      userName,
      userProfession,
    );
  }
};
