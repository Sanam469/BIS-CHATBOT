import FirecrawlApp from '@mendable/firecrawl-js';
import { pinecone, indexName } from '../lib/pinecone'; 
import { embeddingModel } from '../lib/gemini';
import { TaskType } from "@google/generative-ai";

interface FirecrawlPage {
    url?: string;
    markdown?: string;
    metadata?: {
        title?: string;
        url?: string;
    };
}

interface FirecrawlResponse {
    success: boolean;
    status: string;
    data?: FirecrawlPage[];
}

interface BISMetadata {
    url: string;
    text: string;
    title: string;
    [key: string]: string | number | boolean | string[]; 
}

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const JOB_ID = "019cdd00-3f56-703d-983d-1899863e4082"; 

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function harvest() {
    console.log("🚀 Starting Completion Harvest (Records 501+)...");
    const index = pinecone.index(indexName);
    
    try {
        console.log("📡 Requesting all data (autoPaginate: true)...");
        
        // Exactly your format, just added the paginate option
        const response = await (firecrawl as unknown as { getCrawlStatus: (id: string, options: { autoPaginate: boolean }) => Promise<FirecrawlResponse> }).getCrawlStatus(JOB_ID, { 
            autoPaginate: true 
        }) as unknown as FirecrawlResponse;
        
        const allData = response.data || [];
        
        // The logic to skip the first 500 you already finished
        const remainingData = allData.slice(500);

        if (remainingData.length === 0) {
            console.log("✅ No new pages found to index.");
            return;
        }

        console.log(`\n📦 Success! Found ${remainingData.length} new pages.`);
        console.log("🛠️ Starting Pinecone Upsert...");

        for (let i = 0; i < remainingData.length; i++) {
            const page = remainingData[i];
            const pageUrl = page.url || page.metadata?.url;
            if (!page.markdown || !pageUrl) continue;

            // Safe ID logic for long URLs
            const pineconeId = pageUrl.length > 250 
                ? Buffer.from(pageUrl.substring(0, 100)).toString('base64') 
                : Buffer.from(pageUrl).toString('base64');

            try {
                const embResult = await embeddingModel.embedContent({
                    content: { role: 'user', parts: [{ text: page.markdown.substring(0, 8000) }] },
                    taskType: TaskType.RETRIEVAL_DOCUMENT,
                });

                await index.upsert({
                    records: [{
                        id: pineconeId,
                        values: embResult.embedding.values,
                        metadata: {
                            url: pageUrl,
                            text: page.markdown.substring(0, 3000),
                            title: page.metadata?.title || "BIS Record"
                        } as BISMetadata
                    }]
                });

                process.stdout.write(`\r🚀 Progress: ${i + 1}/${remainingData.length} indexed`);
                await sleep(1000); 

            } catch (error: unknown) {
                const err = error instanceof Error ? error : new Error(String(error));
                if (err.message?.includes('429')) {
                    console.log("\n🛑 Rate limit! Sleeping 30s...");
                    await sleep(30000);
                    i--; 
                } else {
                    console.error(`\n⚠️ Page ${i} failed:`, err.message);
                }
            }
        }
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("\n❌ Connection Failed:", error.message);
    }

    console.log("\n\n🏁 MISSION COMPLETE.");
}

harvest();