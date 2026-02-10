import type { Context } from "hono";

interface TranslationSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
}

export async function translateText(
  text: string,
  targetLang: string,
  settings: TranslationSettings,
): Promise<string> {
  const { baseUrl, apiKey, model, prompt } = settings;

  // Determine if this is OpenAI API or LibreTranslate
  const isOpenAI =
    baseUrl.includes("openai.com") ||
    baseUrl.includes("openai") ||
    baseUrl.includes("api.openai") ||
    baseUrl.endsWith("/v1") ||
    (apiKey && !baseUrl.includes("libretranslate"));

  if (isOpenAI) {
    return translateWithOpenAI(text, baseUrl, apiKey, model, prompt);
  } else {
    return translateWithLibre(text, targetLang, baseUrl, apiKey);
  }
}

async function translateWithOpenAI(
  text: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  const apiUrl = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  // Enhanced prompt for Markdown translation
  const markdownPrompt =
    prompt ||
    "You are a professional translator. Translate the following Markdown text while preserving all Markdown formatting (links, images, code blocks, etc.). Only translate the readable text content, keep URLs and Markdown syntax unchanged.";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: markdownPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const json = await response.json();
  return json.choices[0]?.message?.content || "";
}

async function translateWithLibre(
  text: string,
  targetLang: string,
  baseUrl: string,
  apiKey: string,
): Promise<string> {
  const translateUrl = `${baseUrl.replace(/\/$/, "")}/translate`;

  const body: any = {
    q: text,
    source: "auto",
    target: targetLang,
    format: "text",
  };

  if (apiKey) {
    body.api_key = apiKey;
  }

  const response = await fetch(translateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LibreTranslate error (${response.status}): ${error}`);
  }

  const json = await response.json();
  return json.translatedText || "";
}
