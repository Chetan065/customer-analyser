import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { env } from "@/lib/env";

export function getChatModel(temperature = 0) {
  return new ChatGoogleGenerativeAI({
    model: env.GEMINI_MODEL,
    apiKey: env.resolvedApiKey,
    temperature,
    maxRetries: 3,
  });
}

export function getEmbeddingsModel() {
  return new GoogleGenerativeAIEmbeddings({
    model: env.GEMINI_EMBEDDING_MODEL,
    apiKey: env.resolvedApiKey,
    maxRetries: 3,
  });
}
