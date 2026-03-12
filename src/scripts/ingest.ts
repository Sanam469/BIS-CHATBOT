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

const TARGET_KEYWORDS = [
    "consumer-overview", 
    "hallmarking", 
    "public-grievance", 
    "consumer-engagement", 
    "know-your-standards",
    "care-manual"
];

async function scrapeConsumer(url: string, depth = 0) {
    const MAX_DEPTH = 3;
    if (SCRAPED_URLS.has(url) || depth > MAX_DEPTH) return;
    SCRAPED_URLS.add(url);

    const indent = "  ".repeat(depth);
    console.log(`${indent}🛍️  Consumer: ${url}`);

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
            
            // ✅ LINK PRESERVATION: Keeping those complaint form PDFs and manuals!
            const cleanMd = rawMd.split("हम बीआईएस हैं")[0];
            
            const contentHash = crypto.createHash('md5').update(cleanMd).digest('hex');

            if (cleanMd.length > 500 && !SAVED_HASHES.has(contentHash)) {
                SAVED_HASHES.add(contentHash);
                const outputDir = path.resolve(process.cwd(), 'bis_data');
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

                const fileName = new URL(url).pathname.split('/').filter(p => p).join('-') || 'con-root';
                fs.writeFileSync(path.join(outputDir, `CON-${fileName}.md`), cleanMd);
                console.log(`${indent}💾 Saved: CON-${fileName}.md`);
            }

            const links = rawMd.match(/(https?:\/\/[^\s\)\"\]]+|(?<=\()\/[^\s\)\"\]]+)/g) || [];
            for (let link of links) {
                link = link.replace(/[()]/g, '').split(']')[0];
                if (link.startsWith('/')) link = `https://www.bis.gov.in${link}`;

                const isRelevant = TARGET_KEYWORDS.some(kw => link.toLowerCase().includes(kw));
                const isHindi = link.includes('?lang=hi') || link.includes('/hi/');

                if (isRelevant && !isHindi && !link.endsWith('.pdf') && !SCRAPED_URLS.has(link)) {
                    await scrapeConsumer(link, depth + 1);
                }
            }
        }
    } catch (e: unknown) {
        console.error(`${indent}🛑 Error: ${(e as Error).message}`);
    }
}

console.log("🚀 Starting Consumer Affairs Surgical Scrape...");
scrapeConsumer("https://www.bis.gov.in/consumer-overview/consumer-overviews/portal-for-public-grievances/?lang=en");
catch (e: unknown) {
        console.error(`${indent}🛑 Error: ${(e as Error).message}`);
    }