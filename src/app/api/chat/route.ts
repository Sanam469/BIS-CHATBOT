import { GoogleGenerativeAI } from "@google/generative-ai";
import { pinecone, indexName } from '@/src/lib/pinecone';
import { embeddingModel } from '@/src/lib/gemini';
import { TaskType } from "@google/generative-ai";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1].content;

        // 1. Vectorize the user's question
        const embResult = await embeddingModel.embedContent({
            content: { role: 'user', parts: [{ text: lastMessage }] },
            taskType: TaskType.RETRIEVAL_QUERY,
        });

        // 2. Query Pinecone for the most relevant BIS records
        const index = pinecone.index(indexName);
        const queryResponse = await index.query({
            vector: embResult.embedding.values,
            topK: 5,
            includeMetadata: true,
        });

        // 3. Construct the "Knowledge Context"
        // We extract the text and the URL from the metadata we saved during ingestion
        const context = queryResponse.matches
            .map(match => `SOURCE: ${match.metadata?.url}\nTITLE: ${match.metadata?.title}\nCONTENT: ${match.metadata?.text}`)
            .join("\n\n---\n\n");

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 4. The System Prompt (The AI's personality and constraints)
        const systemPrompt = `
You are the "BIS Intel-Bot", powered by Gemini 2.5 Flash. You have two modes:

1. CHIT-CHAT MODE (Casual & Fun):
- Use this for greetings, "how are you", or general talk.
- Tone: Witty, casual, and a bit "tech-bro" friendly. Use occasional emojis not in every line but as per conditions(⚡, 🤖, 🚀).
- Goal: Make the user enjoy the conversation. You don't need the database for this.

2. BIS EXPERT MODE (Strict & Professional):
- Trigger: When the user asks about IS standards, ISI marks, certifications, or specific BIS data.
- Tone: Serious, precise, and authoritative. 
- Rule: Use ONLY the provided BIS Context. If it's not there, say you don't have that specific record.
- Citation: You MUST provide the Source URL for every technical fact.

BIS CONTEXT:
${context}

Always bridge the gap naturally. If they say "Yo, tell me about ISI", start casual but transition into the strict expert data.
`;

        // 5. Send history + context to Gemini
        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                ...messages.slice(0, -1).map((m: Message) => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                })),
                { role: 'user', parts: [{ text: lastMessage }] }
            ]
        });

        return new Response(JSON.stringify({ text: result.response.text() }));

    } catch (error: unknown) {
        console.error("API Error:", error);
        return new Response(JSON.stringify({ error: "The Brain is currently offline." }), { status: 500 });
    }
}