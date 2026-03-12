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

// 🎯 Refined International Keywords for BIS
const TARGET_KEYWORDS = [
  "gazette", "notification", "amendment", "qco", "quality-control-order", "statutory-order", "gsr", 
  "advisory-committee", "governing-council", "executive-committee", "proceedings", "minutes", "composition", "resolution",
  "whats-new", "circular", "bulletin", "public-notice", "extension", "implementation", "grant-of-license", "first-licence"
];

async function scrapeBISGlobal(url: string, depth = 0) {
    const MAX_DEPTH = 3;
    if (SCRAPED_URLS.has(url) || depth > MAX_DEPTH) return;
    SCRAPED_URLS.add(url);

    const indent = "  ".repeat(depth);
    console.log(`${indent}🌍 BIS Global: ${url}`);

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
            const cleanMd = rawMd.split("हम बीआईएस हैं")[0];
            const contentHash = crypto.createHash('md5').update(cleanMd).digest('hex');

            if (cleanMd.length > 500 && !SAVED_HASHES.has(contentHash)) {
                SAVED_HASHES.add(contentHash);
                const outputDir = path.resolve(process.cwd(), 'bis_data');
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

                const fileName = new URL(url).pathname.split('/').filter(p => p).join('-') || 'global-root';
                fs.writeFileSync(path.join(outputDir, `GLB-${fileName}.md`), cleanMd);
                console.log(`${indent}💾 Saved: GLB-${fileName}.md`);
            }

            const links = rawMd.match(/(https?:\/\/[^\s\)\"\]]+|(?<=\()\/[^\s\)\"\]]+)/g) || [];
            
            for (let link of links) {
                link = link.replace(/[()]/g, '').split(']')[0];
                if (link.startsWith('/')) link = `https://www.bis.gov.in${link}`;

                // 🛡️ THE DOMAIN GUARD: Strictly stay on BIS domains
                const isInternal = link.includes('bis.gov.in') || link.includes('services.bis.gov.in');
                
                // 🔍 KEYWORD CHECK: Only follow if it's international-related
                const isRelevant = TARGET_KEYWORDS.some(kw => link.toLowerCase().includes(kw));
                const isHindi = link.includes('?lang=hi') || link.includes('/hi/');

                if (isInternal && isRelevant && !isHindi && !link.endsWith('.pdf') && !SCRAPED_URLS.has(link)) {
                    await scrapeBISGlobal(link, depth + 1);
                }
            }
        }
    } catch (e: unknown) {
        console.error(`${indent}🛑 Error: ${(e as Error).message}`);
    }
}

console.log("🚀 Starting Restricted Global Scrape (BIS Domain Only)...");

// Pointing directly at the International hubs on the BIS site
const seeds = [
    "https://www.bis.gov.in/the-bureau/gazette-notifications/?lang=en",
    "https://www.bis.gov.in/the-bureau/advisory-committees/?lang=en",
    "https://www.bis.gov.in/standards/international-standardization-2/wto-tbt/?lang=en"
];

seeds.forEach(url => scrapeBISGlobal(url));