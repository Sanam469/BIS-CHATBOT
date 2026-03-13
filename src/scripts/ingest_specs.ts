import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index('bis-index');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

async function ingestSpecs() {
    const specsPath = path.resolve(process.cwd(), 'BIS_RAG_DATA.md');
    const content = fs.readFileSync(specsPath, 'utf-8');

    // Split by sections starting with ##
    const sections = content.split('\n---').map(s => s.trim()).filter(s => s.length > 0);

    console.log(`🚀 Ingesting ${sections.length} spec sections...`);

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const lines = section.split('\n');
        const titleLine = lines.find(l => l.startsWith('## '));
        const title = titleLine ? titleLine.replace('## ', '').trim() : 'BIS Specification';
        
        console.log(`  📄 Chunking: ${title}`);

        try {
            const embResult = await embeddingModel.embedContent({
                content: { role: 'user', parts: [{ text: section.substring(0, 8000) }] },
                taskType: TaskType.RETRIEVAL_DOCUMENT,
            });

            await index.upsert({
                records: [{
                    id: `spec-${i}-${Date.now()}`,
                    values: embResult.embedding.values,
                    metadata: {
                        is_specs: true,
                        title: title,
                        text: section,
                        url: 'https://www.bis.gov.in/extracted-specs'
                    }
                }]
            });
            
            console.log(`  ✅ Upserted chunk ${i+1}/${sections.length}`);
        } catch (e) {
            console.error(`  ❌ Failed chunk ${i+1}:`, e);
        }
    }

    console.log("🎯 Ingestion complete!");
}

ingestSpecs().catch(console.error);
