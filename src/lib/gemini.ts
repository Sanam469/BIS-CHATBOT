import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// gemini-embedding-001 is the current stable choice for RAG
export const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Use gemini-2.5-flash for faster chat responses
export const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });