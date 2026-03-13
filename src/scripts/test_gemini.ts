import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

async function testEmbedding() {
    console.log("Testing Gemini Embedding API with key:", API_KEY?.substring(0, 10) + "...");
    if (!API_KEY) {
        console.error("No API key found in .env.local");
        return;
    }
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    
    try {
        const result = await model.embedContent("Hello world");
        console.log("Success! Embedding length:", result.embedding.values.length);
    } catch (e: any) {
        console.error("FULL ERROR:", JSON.stringify(e, null, 2));
        console.error("ERROR MESSAGE:", e.message);
    }
}

testEmbedding();
