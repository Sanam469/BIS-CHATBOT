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

    const previousMessage = conversationHistory.length > 0
        ? conversationHistory[conversationHistory.length - 1].content
        : '';

    // Split query by logical markers to catch specific facts in compound/comparative questions
    const subQueries = userQuery
        .split(/[?.\n]| vs | and /i)
        .map(q => q.trim())
        .filter(q => q.length > 5); // reduced threshold to catch short scheme names like "ISI"

    // If no good splits, use the whole thing
    const queriesToSearch = subQueries.length > 1 ? subQueries : [userQuery];

    // Perform parallel searches for each fragment
    const searchPromises = queriesToSearch.map(async (q) => {
        const contextualQuery = previousMessage
            ? `Current Question: ${q} | Context: ${previousMessage}`
            : q;

        const embResult = await embeddingModel.embedContent({
            content: { role: 'user', parts: [{ text: contextualQuery.substring(0, 8000) }] },
            taskType: TaskType.RETRIEVAL_QUERY,
        });

        return index.query({
            vector: embResult.embedding.values,
            topK: 15,
            includeMetadata: true,
        });
    });

    const results = await Promise.all(searchPromises);

    // Deduplicate by URL and collect unique sources across all search results
    const seen = new Set<string>();
    const docs: SourceDoc[] = [];

    for (const res of results) {
        for (const match of res.matches) {
            const url = (match.metadata?.url as string) ?? '';
            const title = (match.metadata?.title as string) ?? 'BIS Document';
            const text = (match.metadata?.text as string) ?? '';
            const score = match.score ?? 0;

            const urlBase = url.split('::')[0].split('#')[0];

            if (!seen.has(urlBase) && text.length > 50) {
                seen.add(urlBase);
                docs.push({ url: urlBase, title, text, score });
            } else if (seen.has(urlBase)) {
                const existing = docs.find(d => d.url === urlBase);
                if (existing && text.length > 50 && !existing.text.includes(text.substring(0, 100))) {
                    existing.text = (existing.text + '\n\n' + text).substring(0, 7000);
                }
            }
        }
    }

    // Sort by score and take best overall context
    return docs.sort((a, b) => b.score - a.score).slice(0, 25);
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
1. **INTRO PARAGRAPH REQUIREMENT** — Your opening response MUST be a comprehensive introduction of at least 3 lines. DO NOT provide shorter intros. Be welcoming but professional.
2. **MULTI-QUESTION & COMPARATIVE HANDLING** — If multiple questions are asked, or a comparison is requested (e.g., "Scheme A vs Scheme B"), answer each concisely and confidently. For comparisons, create a **Markdown Table** comparing key features (fees, eligibility, timeline).
3. **GROUNDING & ANTI-HALLUCINATION** — Every fact (IS numbers, fees, percentages, dates) MUST be pulled directly from the context. If you find multiple conflicting values, mention both with their context. If a value is missing, state: "Specific information on [topic] is not available in the current BIS records."
4. **REGULATORY TIMELINES** — If asked about timelines (e.g., "Desktop Audit", "Citizen Charter", "7-day rule"), search the context thoroughly. If found, quote it exactly. If not found, say you cannot confirm the specific timeline and point to the official portal.
5. **CITE SOURCES** — Use named markdown links: ([Page Title](URL)). Put ONE relevant source per claim.
6. **OUT-OF-SCOPE** — Politely decline anything not related to BIS, standardization, or quality certification.

## FORMATTING RULES (CRITICAL):
You write like a modern AI assistant. Your responses must be **scannable and structured**, never walls of text.

**Always follow this pattern:**

→ **One short intro sentence** (1-2 lines max, directly answering the core of the question)


**[MASSIVE 4-LINE GAP HERE]**


→ Then use **one or more** of these structures:
- **Bullet points** with **bold key terms**
- **Numbered steps** for processes
- **Tables** for comparison of fees, timelines, or classes
- **Short paragraphs** (2-3 lines MAX)
- **Sub-headings** (### →) for section titles


**[MASSIVE 4-LINE GAP HERE]**


**NEVER do this:**
- Long paragraphs (>3 lines)
- Fabricating IS Standards or Fees
- Listing ogni/every source on every bullet
- Using visual lines like \`---\` — use empty space only.

**End every answer with:**


📋 **Sources:**
1. [Descriptive Name](URL)
2. [Descriptive Name](URL)

## EXAMPLE:
**User:** "Compare ISI and CRS"
**Response:**
BIS operates several certification schemes to ensure product quality and safety for Indian consumers. Both the ISI Mark scheme and the Compulsory Registration Scheme (CRS) are pillars of this mission...

### → Scheme Comparison
| Feature | ISI Mark (Scheme-I) | CRS (Scheme-II) |
|---|---|---|
| Focus | Quality & Performance | Safety |
| Marking | Self-marking after license | Self-declaration |
| Sector | General Industry | Electronics/IT |


✅ **In short:** ISI covers general products with factory audits, while CRS is safety-focused for electronics.`;

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
            // Previous conversation history (for multi-turn context) - limited to last 8 for deep context!
            ...previousMessages.slice(-8).map((m: Message) => ({
                role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
                parts: [{ text: m.content }]
            })),
            // Current user message
            { role: 'user' as const, parts: [{ text: lastMessage }] }
        ];

        const result = await model.generateContentStream({ contents });

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            controller.enqueue(new TextEncoder().encode(chunkText));
                        }
                    }
                    controller.close();
                } catch (e) {
                    controller.error(e);
                }
            }
        });

        // 6. Return response with source metadata for the frontend in Header
        const sourceUrls = sourceDocs
            .filter(d => !d.url.startsWith('file://'))
            .map(d => ({ url: d.url, title: d.title })).slice(0, 5);

        return new Response(stream, {
            headers: {
                'X-Sources': encodeURIComponent(JSON.stringify(sourceUrls)),
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
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