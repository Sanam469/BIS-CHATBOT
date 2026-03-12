import { GoogleGenerativeAI } from "@google/generative-ai";
import { pinecone, indexName } from '@/src/lib/pinecone';
import { embeddingModel } from '@/src/lib/gemini';
import { TaskType } from "@google/generative-ai";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface SourceDoc {
    url: string;
    title: string;
    text: string;
    score: number;
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// ── Retrieval: Multi-query + conversation-aware ─────────────────────────
async function retrieveContext(
    userQuery: string,
    conversationHistory: Message[]
): Promise<SourceDoc[]> {
    const index = pinecone.index(indexName);

    // Build a retrieval-optimized query that includes conversation context
    // This helps with pronouns like "tell me more about the third one" (TC-03, HTC-09)
    const recentContext = conversationHistory
        .slice(-6)  // last 3 turns
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

    const contextualQuery = recentContext
        ? `Given this conversation:\n${recentContext}\n\nThe user now asks: ${userQuery}`
        : userQuery;

    // Generate a search-optimized embedding using the full contextual query
    const embResult = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text: contextualQuery.substring(0, 8000) }] },
        taskType: TaskType.RETRIEVAL_QUERY,
    });

    // Query with higher topK for better cross-section retrieval (TC-04, HTC-03, HTC-10)
    const queryResponse = await index.query({
        vector: embResult.embedding.values,
        topK: 12,
        includeMetadata: true,
    });

    // Deduplicate by URL and collect unique sources
    const seen = new Set<string>();
    const docs: SourceDoc[] = [];

    for (const match of queryResponse.matches) {
        const url = (match.metadata?.url as string) ?? '';
        const title = (match.metadata?.title as string) ?? 'BIS Document';
        const text = (match.metadata?.text as string) ?? '';
        const score = match.score ?? 0;

        // Dedup by URL base (different chunks from same page)
        const urlBase = url.split('::')[0].split('#')[0];
        
        if (!seen.has(urlBase) && text.length > 50) {
            seen.add(urlBase);
            docs.push({ url: urlBase, title, text, score });
        } else if (seen.has(urlBase)) {
            // Append chunk text to existing doc for completeness
            const existing = docs.find(d => d.url === urlBase);
            if (existing && text.length > 50) {
                existing.text = (existing.text + '\n\n' + text).substring(0, 7000);
            }
        }
    }

    return docs;
}

// ── Format context for the LLM ──────────────────────────────────────────
function formatContextForLLM(docs: SourceDoc[]): string {
    if (docs.length === 0) return 'NO RELEVANT DOCUMENTS FOUND IN THE BIS DATABASE.';

    return docs
        .map((doc, i) => {
            const cleanUrl = doc.url.startsWith('file://') 
                ? `https://www.bis.gov.in/` 
                : doc.url;
            return `[SOURCE ${i + 1}]\nURL: ${cleanUrl}\nTITLE: ${doc.title}\nCONTENT:\n${doc.text}`;
        })
        .join('\n\n─────────────────────────────\n\n');
}

// ── System Prompt ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are **BIS Intel-Bot**, the official AI assistant for the Bureau of Indian Standards (BIS) website. Built on Gemini 2.5 Flash. Your knowledge comes EXCLUSIVELY from the BIS website context provided below.

## ABSOLUTE RULES:

1. **ONLY use provided context.** Never fabricate facts, IS numbers, fees, dates, or processes. If the answer isn't in the context, say so and link to https://www.bis.gov.in
2. **Cite sources** using named markdown links: ([Page Title](URL)). Put ONE relevant source per claim, not every source on every line.
3. **If a user asks about a non-existent regulation** — clearly state you cannot find it. Never make one up.
4. **Out-of-scope queries** (stock prices, weather, sports, etc.) — politely decline and suggest a BIS-related topic instead.
5. **Multi-turn memory** — resolve pronouns ("the third one", "that scheme", "tell me more") from conversation history. Never ask the user to repeat themselves.

## FORMATTING RULES (CRITICAL — follow exactly):

You write like a modern AI assistant. Your responses must be **scannable and structured**, never walls of text.

**Always follow this pattern:**

→ **One short intro sentence** (1-2 lines max, directly answering the question)

→ Then use **one or more** of these structures:
- **Bullet points** with **bold key terms** at the start
- **Numbered steps** for processes (bold the step name)
- **Tables** for comparisons
- **Short paragraphs** (2-3 lines MAX, never longer)
- **Sub-headings** (## or ###) to organize sections

**NEVER do this:**
- Long paragraphs (>3 lines)
- Repeating the same information
- Listing every source on every bullet point
- Writing "[Source]" — always use a descriptive name like [Product Certification](URL)
- Using excessive emojis

**End every answer with:**

📋 **Sources:**
1. [Descriptive Name](URL)
2. [Descriptive Name](URL)

## EXAMPLE:

**User:** "How do I apply for BIS certification?"

**Your response:**

BIS offers multiple certification schemes. Here's how to apply:

### Step-by-Step Process

1. **Identify your scheme** — Choose from ISI Mark (Scheme-I), Registration Scheme, CRS, or FMCS based on your product type. ([Certification Schemes](URL))

2. **Check compulsory certification** — Verify if your product falls under a Quality Control Order (QCO). ([Products Under QCO](URL))

3. **Submit application online** — Apply through the eBIS portal at manakonline.in with required documents. ([Apply Online](URL))

4. **Factory inspection** — BIS conducts a factory assessment and product testing before granting the licence.

### Key Documents Required
- Application form with product details
- Test reports from BIS-recognized labs
- Factory layout and process flow

📋 **Sources:**
1. [Certification Schemes](URL)
2. [Products Under QCO](URL)
3. [Apply Online](URL)
`;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json() as { messages: Message[] };
        const lastMessage = messages[messages.length - 1].content;
        const previousMessages = messages.slice(0, -1);

        // 1. Retrieve context with conversation awareness
        const sourceDocs = await retrieveContext(lastMessage, previousMessages);
        const formattedContext = formatContextForLLM(sourceDocs);

        // 2. Build the model
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.3,     // lower = more factual, less creative
                topP: 0.8,
                maxOutputTokens: 4096,
            }
        });

        // 3. Construct the full prompt with system + context + history
        const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n## BIS CONTEXT SOURCES (Use ONLY this data to answer):\n\n${formattedContext}`;

        // 4. Build conversation contents for Gemini
        const contents = [
            // System context as first user message
            { role: 'user' as const, parts: [{ text: fullSystemPrompt }] },
            { role: 'model' as const, parts: [{ text: 'Understood. I am BIS Intel-Bot. I will answer exclusively from the provided BIS context, cite all sources with URLs, handle out-of-scope queries gracefully, and maintain conversation context across turns. Ready to assist.' }] },
            // Previous conversation history (for multi-turn context)
            ...previousMessages.map((m: Message) => ({
                role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
                parts: [{ text: m.content }]
            })),
            // Current user message
            { role: 'user' as const, parts: [{ text: lastMessage }] }
        ];

        // 5. Generate response
        const result = await model.generateContent({ contents });
        const responseText = result.response.text();

        // 6. Return response with source metadata for the frontend
        const sourceUrls = sourceDocs
            .filter(d => !d.url.startsWith('file://'))
            .map(d => ({ url: d.url, title: d.title }));

        return new Response(JSON.stringify({ 
            text: responseText,
            sources: sourceUrls
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: unknown) {
        console.error("API Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ 
            error: "BIS Intel-Bot is temporarily unavailable. Please try again.",
            details: errorMessage
        }), { status: 500 });
    }
}