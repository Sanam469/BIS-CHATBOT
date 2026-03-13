import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { pinecone, indexName } from '../lib/pinecone';
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import fs from 'fs';
import crypto from 'crypto';

// Use a SEPARATE API key for salvage (dedicated quota, doesn't affect chatbot)
const SALVAGE_API_KEY = 'AIzaSyBffZbNVxwHL5rS2knCSsiGgsE-xCqjVfc';
const salvageGenAI = new GoogleGenerativeAI(SALVAGE_API_KEY);
const embeddingModel = salvageGenAI.getGenerativeModel({ model: 'gemini-embedding-001' });

// ── Config ──────────────────────────────────────────────────────────────
const BIS_DATA_DIR = path.resolve(process.cwd(), 'bis_data');
const index = pinecone.index(indexName);
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// Resume: skip the first N unique docs (already indexed in previous run)
const SKIP_FIRST_N = 145;

// ── Step 1: Read all .md files from bis_data, filter to TODAY ───────────
interface LocalDoc {
    filename: string;
    filepath: string;
    content: string;
    sizeBytes: number;
    reconstructedUrl: string;
    isPdf: boolean;
}

function reconstructUrl(filename: string): string {
    // Filename format: PREFIX-path-segments.md
    // e.g. ACT-the-bureau-bis-act-2016.md → https://www.bis.gov.in/the-bureau/bis-act-2016/
    // e.g. GLB-php-BIS_2.0-bisconnect-mou.md → https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/mou
    // e.g. ISI-en-publication-6777.md → external (iec.ch etc.)

    const base = filename.replace(/\.md$/, '');
    // Remove the category prefix (ACT-, GLB-, ISI-, COM-, CON-, LAB-)
    const withoutPrefix = base.replace(/^(ACT|GLB|ISI|COM|CON|LAB)-/, '');

    // If it contains "php-BIS_2.0" it's a services.bis.gov.in URL
    if (withoutPrefix.includes('php-BIS_2.0')) {
        return `https://www.services.bis.gov.in/${withoutPrefix.replace(/-/g, '/')}`;
    }

    // If it starts with patterns that look like external domains, skip URL reconstruction
    if (withoutPrefix.startsWith('v-t') || withoutPrefix.startsWith('styles-') ||
        withoutPrefix.startsWith('system-files') || withoutPrefix.startsWith('en-') ||
        withoutPrefix.startsWith('issue-') || withoutPrefix.startsWith('tags-') ||
        withoutPrefix.startsWith('blog-') || withoutPrefix.startsWith('academy-') ||
        withoutPrefix.startsWith('categories-') || withoutPrefix.startsWith('homepage') ||
        withoutPrefix.startsWith('who-we-are') || withoutPrefix.startsWith('what-we-do') ||
        withoutPrefix.startsWith('fundamentals') || withoutPrefix.startsWith('ip-ratings') ||
        withoutPrefix.startsWith('inclusive-') || withoutPrefix.startsWith('young-') ||
        withoutPrefix.startsWith('national-committees') || withoutPrefix.startsWith('strategic-') ||
        withoutPrefix.startsWith('basecamp-') || withoutPrefix.startsWith('where-we-') ||
        withoutPrefix.startsWith('dyn-www') || withoutPrefix.startsWith('publication-') ||
        withoutPrefix.startsWith('isi-root')) {
        return ''; // External/non-BIS content — will be filtered out
    }

    // Default: reconstruct as bis.gov.in URL
    return `https://www.bis.gov.in/${withoutPrefix.replace(/-/g, '/')}/`;
}

function isPdfContent(content: string, filename: string): boolean {
    return filename.toLowerCase().includes('.pdf') ||
           content.includes('.pdf') ||
           content.toLowerCase().includes('download pdf');
}

function loadAllFiles(): LocalDoc[] {
    const files = fs.readdirSync(BIS_DATA_DIR).filter(f => f.endsWith('.md'));
    const docs: LocalDoc[] = [];

    for (const file of files) {
        const filepath = path.join(BIS_DATA_DIR, file);
        const stat = fs.statSync(filepath);
        const content = fs.readFileSync(filepath, 'utf-8');
        const url = reconstructUrl(file);

        docs.push({
            filename: file,
            filepath,
            content,
            sizeBytes: stat.size,
            reconstructedUrl: url,
            isPdf: isPdfContent(content, file),
        });
    }

    return docs;
}

// ── Step 2: Filter out obvious junk only ────────────────────────────────
function filterValidDocs(docs: LocalDoc[]): LocalDoc[] {
    return docs.filter(doc => {
        // Skip truly empty/tiny files (< 100 chars)
        if (doc.content.trim().length < 100) return false;

        // Skip Facebook CDN image scrapes (they're just image metadata, no real text)
        if (doc.filename.includes('scontent-')) return false;

        return true;
    });
}

// ── Step 3: Deduplicate — prefer PDF content ────────────────────────────
function deduplicatePreferPdf(docs: LocalDoc[]): LocalDoc[] {
    const seen = new Map<string, LocalDoc>();

    for (const doc of docs) {
        // Use content hash for dedup (same content = same document)
        const contentKey = crypto.createHash('md5')
            .update(doc.content.substring(0, 2000))
            .digest('hex');

        const existing = seen.get(contentKey);
        if (!existing) {
            seen.set(contentKey, doc);
        } else {
            // Prefer the one with PDF content
            if (!existing.isPdf && doc.isPdf) {
                seen.set(contentKey, doc);
            }
        }
    }

    return Array.from(seen.values());
}

// ── Step 4: Clean markdown (strip nav/footer boilerplate) ───────────────
function cleanMarkdown(raw: string): string {
    // Remove the common BIS website nav/header that appears at the top of every page
    let clean = raw;

    // strip everything before the first real heading or content marker
    const headerEnd = clean.indexOf('☰');
    if (headerEnd > 0 && headerEnd < 2000) {
        clean = clean.substring(headerEnd + 1);
    }

    // Remove the Hindi split marker
    clean = clean.split("हम बीआईएस हैं")[0];

    // Remove social media footer boilerplate
    const footerPatterns = [
        /Previous\s*\n\s*!\[.*?\]\(https:\/\/www\.bis\.gov\.in\/wp-content\/uploads[\s\S]*$/,
        /!\[BIS FeedBack\][\s\S]*$/,
    ];
    for (const pattern of footerPatterns) {
        clean = clean.replace(pattern, '');
    }

    return clean.trim();
}

// ── Step 5: Chunk large markdown ────────────────────────────────────────
function chunkMarkdown(text: string, maxChars: number = 6000): string[] {
    if (text.length <= maxChars) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
            chunks.push(remaining);
            break;
        }

        let splitIndex = remaining.lastIndexOf('\n\n', maxChars);
        if (splitIndex < maxChars * 0.3) {
            splitIndex = remaining.lastIndexOf('\n', maxChars);
        }
        if (splitIndex < maxChars * 0.3) {
            splitIndex = maxChars;
        }

        chunks.push(remaining.substring(0, splitIndex));
        remaining = remaining.substring(splitIndex).trimStart();
    }

    return chunks;
}

// ── Main ────────────────────────────────────────────────────────────────
async function salvageEverything(): Promise<void> {
    console.log(`🚀 Salvage: Read local bis_data → Dedup → Chunk → Embed → Pinecone`);
    console.log(`⏩ Resuming from doc #${SKIP_FIRST_N} (skipping already-indexed)\n`);

    // 1) Load ALL files
    const allDocs = loadAllFiles();
    console.log(`📂 Total .md files in bis_data: ${fs.readdirSync(BIS_DATA_DIR).filter(f => f.endsWith('.md')).length}`);
    console.log(`📂 Loaded: ${allDocs.length}`);

    if (allDocs.length === 0) {
        console.log("❌ No files found. Check bis_data/ directory.");
        return;
    }

    // 2) Filter out junk
    const validDocs = filterValidDocs(allDocs);
    console.log(`🧹 After filtering (removed images/tiny/external): ${validDocs.length}`);

    // 3) Deduplicate
    const unique = deduplicatePreferPdf(validDocs);
    const dupsRemoved = validDocs.length - unique.length;
    console.log(`🔄 After dedup (prefer PDF): ${unique.length} unique (${dupsRemoved} duplicates removed)`);

    // 4) Chunk, embed, upsert
    let totalChunksIndexed = 0;
    let errors = 0;
    let skipped = 0;

    for (let i = 0; i < unique.length; i++) {
        // Skip already-indexed docs from previous run
        if (i < SKIP_FIRST_N) continue;

        const doc = unique[i];
        const cleaned = cleanMarkdown(doc.content);

        if (cleaned.length < 100) {
            continue;
        }

        const chunks = chunkMarkdown(cleaned);
        const sourceUrl = doc.reconstructedUrl || `file://${doc.filename}`;

        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            const chunkText = chunks[chunkIdx];
            const pineconeId = crypto
                .createHash('md5')
                .update(`${doc.filename}::chunk${chunkIdx}`)
                .digest('hex');


            try {
                const embResult = await embeddingModel.embedContent({
                    content: { role: 'user', parts: [{ text: chunkText.substring(0, 8000) }] },
                    taskType: TaskType.RETRIEVAL_DOCUMENT,
                });

                await index.upsert({
                    records: [{
                        id: pineconeId,
                        values: embResult.embedding.values,
                        metadata: {
                            url: sourceUrl,
                            text: chunkText.substring(0, 3500),
                            title: doc.filename.replace(/\.md$/, '').replace(/^(ACT|GLB|ISI|COM|CON|LAB)-/, ''),
                            chunkIndex: chunkIdx,
                            totalChunks: chunks.length,
                            isPdf: doc.isPdf,
                            source: 'salvage-local',
                        }
                    }]
                });

                totalChunksIndexed++;
                process.stdout.write(
                    `\r✅ [${i + 1}/${unique.length}] chunk ${chunkIdx + 1}/${chunks.length} | Indexed: ${totalChunksIndexed} | Skip: ${skipped} | ${doc.filename.substring(0, 35)}...`
                );

                await sleep(4500); // ~13 req/min to stay under Gemini free tier limit

            } catch (error: unknown) {
                if (error instanceof Error) {
                    if (error.message.includes('429')) {
                        console.log("\n🛑 Rate Limit. Sleeping 60s...");
                        await sleep(60000);
                        chunkIdx--; // retry
                    } else if (error.message.includes('fetch') || error.message.includes('ENOTFOUND') || error.message.includes('network')) {
                        console.log(`\n🌐 Network error. Retrying in 10s...`);
                        await sleep(10000);
                        chunkIdx--; // retry
                    } else {
                        errors++;
                        console.error(`\n⚠️ Failed ${doc.filename} chunk ${chunkIdx}:`, error.message);
                    }
                }
            }
        }
    }

    console.log(`\n\n📈 SUMMARY:`);
    console.log(`   • Total files: ${allDocs.length}`);
    console.log(`   • After filtering: ${validDocs.length}`);
    console.log(`   • Unique (no dups): ${unique.length}`);
    console.log(`   • Skipped (already indexed): ${SKIP_FIRST_N} docs + ${skipped} chunks`);
    console.log(`   • Processed this run: ${unique.length - SKIP_FIRST_N}`);
    console.log(`   • New chunks indexed: ${totalChunksIndexed}`);
    console.log(`   • Chunks already in Pinecone: ${skipped}`);
    console.log(`   • Errors: ${errors}`);
    console.log(`\n🏁 SALVAGE COMPLETE.`);
}

salvageEverything();