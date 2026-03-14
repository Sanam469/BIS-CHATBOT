import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * 🚀 HACKATHON API KEY POOL
 * Paste your Gemini API keys here as a comma-separated string in .env.local 
 * or directly in this array if you prefer.
 */
const apiKeys = (
    process.env.GOOGLE_GENERATIVE_AI_API_KEYS ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    "" // FALLBACK: ["KEY_1", "KEY_2", "KEY_3"]
).split(',').map(k => k.trim()).filter(Boolean);

// Fallback for easy filling if .env is not used
// const apiKeys = ["", "", ""]; 

let currentKeyIndex = 0;

export function getGenAI() {
    if (apiKeys.length === 0) {
        throw new Error("No Google Generative AI API keys found. Add them to GOOGLE_GENERATIVE_AI_API_KEYS in .env.local");
    }
    return new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
}

/**
 * Rotates to the next available API key.
 * @returns true if rotated, false if only one key exists.
 */
export function rotateApiKey() {
    if (apiKeys.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        console.warn(`[API ROTATION] 🔄 Switched to API key index ${currentKeyIndex} (Key starts with: ${apiKeys[currentKeyIndex].substring(0, 6)}...)`);
        return true;
    }
    return false;
}

/**
 * Centralized retry wrapper for Gemini calls.
 * Automatically rotates keys on 429 (Rate Limit) errors.
 */
export async function withGeminiRetry<T>(fn: (genAI: GoogleGenerativeAI) => Promise<T>, maxRetries = 10): Promise<T> {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn(getGenAI());
        } catch (error: unknown) {
            lastError = error;
            const err = error as { message?: string; status?: number };
            const errorMsg = err?.message?.toLowerCase() || "";
            // The user noted Gemini returns a 500 error when API quota is exhausted
            const isRateLimit = errorMsg.includes('429') ||
                errorMsg.includes('quota') ||
                err?.status === 429 ||
                err?.status === 500;

            if (isRateLimit) {
                console.warn(`[RETRY] ⚠️ Quota/Rate limit hit (Status: ${err?.status || 'Unknown'}). Attempting rotation... (${i + 1}/${maxRetries})`);
                if (!rotateApiKey()) {
                    // If we can't rotate (only 1 key), wait a bit before retrying
                    const waitTime = (i + 1) * 2000;
                    console.log(`[RETRY] ⏳ Only one key available. Waiting ${waitTime}ms...`);
                    await new Promise(r => setTimeout(r, waitTime));
                }
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

// gemini-embedding-001 is the current stable choice for RAG
export const getEmbeddingModel = () => getGenAI().getGenerativeModel({ model: "gemini-embedding-001" });

// Use gemini-2.5-flash for faster chat responses
export const getChatModel = () => getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
