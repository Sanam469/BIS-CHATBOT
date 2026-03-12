import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface ScrapeResponse {
    success: boolean;
    data?: { markdown?: string };
    error?: string;
}

const API_KEY = process.env.FIRECRAWL_API_KEY;
const SCRAPED_URLS = new Set<string>();
const SAVED_HASHES = new Set<string>();

// SURGICAL KEYWORDS: Focus on the "Process" and "Fees", not the 20,000 products.
const TARGET_KEYWORDS = [
    "product-certification", // Allows it to find the branch
    "isi-mark", 
    "grant-of-license", 
    "marking-fee", 
    "surveillance", 
    "process",
    "fee",
    "guidelines"
];

async function scrapeISI(url: string, depth = 0) {
    const MAX_DEPTH = 3;
    if (SCRAPED_URLS.has(url) || depth > MAX_DEPTH) return;
    SCRAPED_URLS.add(url);

    const indent = "  ".repeat(depth);
    console.log(`${indent}🏗️  ISI Mark: ${url}`);

    try {
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                url: url,
                formats: ["markdown"],
                onlyMainContent: true,
                waitFor: 1000,
                excludeTags: ["nav", "header", "footer", "script", "style"]
            })
        });

        const result = (await response.json()) as unknown as ScrapeResponse;

        if (result.success && result.data?.markdown) {
            const rawMd = result.data.markdown;
            
            // ✅ LINK PRESERVATION: Keeping the "Fee Schedule" and "Process Flow" PDFs
            const cleanMd = rawMd.split("हम बीआईएस हैं")[0];
            
            const contentHash = crypto.createHash('md5').update(cleanMd).digest('hex');

            if (cleanMd.length > 500 && !SAVED_HASHES.has(contentHash)) {
                SAVED_HASHES.add(contentHash);
                const outputDir = path.resolve(process.cwd(), 'bis_data');
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

                const fileName = new URL(url).pathname.split('/').filter(p => p).join('-') || 'isi-root';
                fs.writeFileSync(path.join(outputDir, `ISI-${fileName}.md`), cleanMd);
                console.log(`${indent}💾 Saved: ISI-${fileName}.md`);
            }

            const links = rawMd.match(/(https?:\/\/[^\s\)\"\]]+|(?<=\()\/[^\s\)\"\]]+)/g) || [];
            for (let link of links) {
                link = link.replace(/[()]/g, '').split(']')[0];
                if (link.startsWith('/')) link = `https://www.bis.gov.in${link}`;

                const isRelevant = TARGET_KEYWORDS.some(kw => link.toLowerCase().includes(kw));
                const isHindi = link.includes('?lang=hi') || link.includes('/hi/');

                if (isRelevant && !isHindi && !link.endsWith('.pdf') && !SCRAPED_URLS.has(link)) {
                    await scrapeISI(link, depth + 1);
                }
            }
        }
    } catch (e: unknown) {
        console.error(`${indent}🛑 Error: ${(e as Error).message}`);
    }
}

console.log("🚀 Starting ISI Mark (Scheme-I) Surgical Scrape...");
scrapeISI("https://www.bis.gov.in/product-certification/product-certification-schemes/scheme-i-isi-mark-scheme/?lang=en");
