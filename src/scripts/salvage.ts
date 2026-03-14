import { GoogleGenerativeAI } from "@google/generative-ai";
import { pinecone, indexName } from '@/src/lib/pinecone';
import { getEmbeddingModel } from '@/src/lib/gemini';
import { TaskType } from "@google/generative-ai";

// Retry helper for Gemini API rate limits
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try { return await fn(); }
        catch (e: unknown) {
            const error = e as Error;
            if (error?.message?.includes('429') && i < retries - 1) {
                const wait = (i + 1) * 10;
                console.log(`⏳ Rate limited, retrying in ${wait}s... (attempt ${i + 2}/${retries})`);
                await sleep(wait * 1000);
            } else throw e;
        }
    }
    throw new Error('Retries exhausted');
}

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

interface PineconeMetadata {
    url?: string;
    title?: string;
    text?: string;
    [key: string]: string | number | boolean | string[] | undefined;
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// ── Query Rewriter: Resolves pronouns + expands context (TC-03, HTC-09) ──
async function rewriteQuery(
    userQuery: string,
    conversationHistory: Message[]
): Promise<string> {
    if (conversationHistory.length === 0) return userQuery;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const historyText = conversationHistory
        .slice(-6) // last 3 full turns
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

    const rewritePrompt = `Given this conversation history:
${historyText}

The user now says: "${userQuery}"

Rewrite this query as a STANDALONE search query that:
1. Resolves all pronouns ("it", "that", "the third one", "this scheme")
2. Includes the specific topic/entity being referenced
3. Is optimized for semantic search against a BIS (Bureau of Indian Standards) database

Return ONLY the rewritten query, nothing else. Keep it concise (1-2 sentences max).`;

    try {
        const result = await withRetry(() => model.generateContent(rewritePrompt));
        const rewritten = result.response.text().trim();
        console.log(`🔄 Query rewrite: "${userQuery}" → "${rewritten}"`);
        return rewritten;
    } catch {
        console.log('⚠️ Query rewrite failed, using original');
        return userQuery;
    }
}

// ── Retrieval: Multi-query + conversation-aware ─────────────────────────
async function retrieveContext(
    userQuery: string,
    conversationHistory: Message[]
): Promise<SourceDoc[]> {
    const index = pinecone.index(indexName);

    // Step 1: Rewrite query with resolved pronouns (critical for TC-03, HTC-09)
    const rewrittenQuery = await rewriteQuery(userQuery, conversationHistory);

    // Step 2: Generate embedding for the rewritten query
    const embResult = await withRetry(() => getEmbeddingModel().embedContent({
        content: { role: 'user', parts: [{ text: rewrittenQuery.substring(0, 8000) }] },
        taskType: TaskType.RETRIEVAL_QUERY,
    }));

    // Step 3: Primary query with high topK for cross-section retrieval (TC-04, HTC-03, HTC-10)
    const queryResponse = await index.query({
        vector: embResult.embedding.values,
        topK: 20,
        includeMetadata: true,
    });

    // Step 4: For comparative queries, also search with the original query
    // This helps when the rewrite might over-specify one side of the comparison
    let secondaryMatches: typeof queryResponse.matches = [];
    if (conversationHistory.length === 0 && userQuery.length > 20) {
        try {
            const origEmb = await withRetry(() => getEmbeddingModel().embedContent({
                content: { role: 'user', parts: [{ text: userQuery.substring(0, 8000) }] },
                taskType: TaskType.RETRIEVAL_QUERY,
            }));
            const origResponse = await index.query({
                vector: origEmb.embedding.values,
                topK: 10,
                includeMetadata: true,
            });
            secondaryMatches = origResponse.matches;
        } catch {
            // silently skip secondary search
        }
    }

    // Merge and deduplicate all matches
    const allMatches = [...queryResponse.matches, ...secondaryMatches];
    const seenIds = new Set<string>();
    const uniqueMatches = allMatches.filter(m => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
    });

    // Sort by score (best first)
    uniqueMatches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Build source docs — allow multiple chunks from same URL for completeness
    const urlChunks = new Map<string, SourceDoc>();

    for (const match of uniqueMatches.slice(0, 20)) {
        const metadata = match.metadata as PineconeMetadata | undefined;
        const url = metadata?.url ?? '';
        const title = metadata?.title ?? 'BIS Document';
        const text = metadata?.text ?? '';
        const score = match.score ?? 0;

        const urlBase = url.split('::')[0].split('#')[0];

        if (text.length < 50) continue;

        if (!urlChunks.has(urlBase)) {
            urlChunks.set(urlBase, { url: urlBase, title, text, score });
        } else {
            // Append chunk text to existing doc for completeness
            const existing = urlChunks.get(urlBase)!;
            existing.text = (existing.text + '\n\n' + text).substring(0, 6000);
        }
    }

    return Array.from(urlChunks.values());
}

// ── Format context for the LLM ──────────────────────────────────────────
function formatContextForLLM(docs: SourceDoc[]): string {
    if (docs.length === 0) return 'NO RELEVANT DOCUMENTS FOUND IN THE BIS DATABASE.';

    return docs
        .map((doc, i) => {
            const cleanUrl = doc.url.startsWith('file://')
                ? `https://www.bis.gov.in/`
                : doc.url;
            return `URL: ${cleanUrl}\nTITLE: ${doc.title}\nCONTENT:\n${doc.text}`;
        })
        .join('\n\n─────────────────────────────\n\n');
}

// ── System Prompt — Optimized for ALL hackathon test cases ──────────────
const SYSTEM_PROMPT = `You are **BIS Intel-Bot**, the official AI assistant for the Bureau of Indian Standards (BIS) website. Built on Gemini 2.5 Flash. Your knowledge comes EXCLUSIVELY from the BIS website context provided below.

## CORE RULES :
1. **STRICTLY use provided context.** Every single claim you make MUST be traceable to the context below. Never fabricate IS numbers, fees, dates, processes, regulations, or BIS rules.
2. **NO Inline Citations.** Do NOT include links or [Source 1] citations in the middle of your sentences. It hinders readability. 
3. **End with References.** Only list cited sources at the very end of your response in the "📋 Sources" section.
4. **Non-existent regulations:** If a user asks about a regulation, standard, scheme, or BIS rule that does NOT appear in the provided context, you MUST say: "I could not find information about [topic] in the BIS database."
5. **Out-of-scope:** Politely decline: "This falls outside the scope of BIS information."

## FORMATTING & READABILITY RULES:
1. **NO LINES**: Do NOT use horizontal dashes (\`---\`) or any other visual separators. Use empty space only.
2. **QUADRUPLE NEWLINES**: Use THREE or FOUR newlines between ALL paragraphs and sections. This MUST create a massive "2-4 line gap" as requested.
3. **Headings**: Use \`### →\` followed by your heading text (Example: \`### → Core Functions\`). Always put a massive gap AFTER a heading.
4. **NO SOURCE MARKERS**: DO NOT output \`[SOURCE n]\`, \`[1]\`, or any URLs in the main response text. This is critical. Clutter must be zero.
5. **Bold & Underline**: Use **Bold** for organizations and marks. Use \`<u>\`Underline\`</u>\` for critical regulatory terms or fees.
6. **Lists**: Use clean bullet points (-) for features or points.

## SUMMARY SECTION:
Every response MUST end with a short summary section after a massive gap:
✅ **In short:**
[A concise 2-3 sentence summary of the entire answer]

## ANSWER QUALITY:
- Quote exact numbers, fees, and dates.
- Use markdown tables for comparisons.

Example Structure:
### → Main Category
This is an intro paragraph with **Bold** and <u>Underlined</u> terms.


### → Specific Function
- **Certification** of products.
- **Hallmarking** of gold.


✅ **In short:**
...summary...`;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json() as { messages: Message[] };
        const lastMessage = messages[messages.length - 1].content;
        const previousMessages = messages.slice(0, -1);

        // 1. Retrieve context with conversation-aware query rewriting
        const sourceDocs = await retrieveContext(lastMessage, previousMessages);
        const formattedContext = formatContextForLLM(sourceDocs);

        // 2. Build the model
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.3,     // low = factual, grounded
                topP: 0.6,            // focused sampling
                maxOutputTokens: 4096,// detailed answers
            }
        });

        // 3. Construct the full prompt with system + context + history
        const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n## BIS CONTEXT SOURCES (Use ONLY this data to answer):\n\n${formattedContext}`;

        // 4. Build conversation contents for Gemini
        const contents = [
            // System context as first user message
            { role: 'user' as const, parts: [{ text: fullSystemPrompt }] },
            { role: 'model' as const, parts: [{ text: 'Understood. I am BIS Intel-Bot. I will:\n1. Answer EXCLUSIVELY from provided BIS context\n2. Cite all sources with exact URLs from context\n3. Never fabricate regulations, standards, or data\n4. Maintain full conversation context across turns\n5. Decline out-of-scope queries gracefully\n6. Use comparison tables when comparing items\n7. Include contact info when describing processes\n8. Quote numbers and dates exactly as they appear\nReady to assist.' }] },
            // Previous conversation history (full context for multi-turn: TC-03, HTC-09)
            ...previousMessages.slice(-8).map((m: Message) => ({
                role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
                parts: [{ text: m.content }]
            })),
            // Current user message
            { role: 'user' as const, parts: [{ text: lastMessage }] }
        ];

        // 5. Generate response (with retry)
        const result = await withRetry(() => model.generateContent({ contents }));
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