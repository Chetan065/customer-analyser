import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Embeddings } from "@langchain/core/embeddings";
import { env } from "@/lib/env";

export function getChatModel(temperature = 0): BaseChatModel {
  if (env.LLM_PROVIDER === "openai") {
    return new ChatOpenAI({
      model: env.OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY || env.resolvedApiKey,
      temperature,
      maxRetries: 3,
    });
  }

  return new ChatGoogleGenerativeAI({
    model: env.GEMINI_MODEL,
    apiKey: env.resolvedApiKey,
    temperature,
    maxRetries: 3,
  });
}

export function getEmbeddingsModel(): Embeddings {
  // Vectors in Neon pgvector are vector(768). Google text-embedding-004 produces 768d vectors.
  // OpenAI text-embedding-3-small supports the `dimensions: 768` parameter to match existing schema.
  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY && !env.GEMINI_API_KEY && !env.GOOGLE_API_KEY) {
    return new OpenAIEmbeddings({
      model: env.OPENAI_EMBEDDING_MODEL,
      apiKey: env.OPENAI_API_KEY,
      dimensions: 768,
      maxRetries: 3,
    });
  }

  return new GoogleGenerativeAIEmbeddings({
    model: env.GEMINI_EMBEDDING_MODEL,
    apiKey: env.resolvedApiKey,
    maxRetries: 3,
  });
}
