
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
  "international-relations", "mou", "bilateral", "multilateral", 
  "iso", "iec", "wto-tbt", "technical-barriers", "trade",
  "global-standards", "cooperation-agreement", "regional-cooperation",
  "harmonization", "tbt-enquiry-point", "foreign-manufacturers"
];

async function scrapeISI(url: string, depth = 0) {
    const MAX_DEPTH = 4; // Increased depth for the product branch
    if (SCRAPED_URLS.has(url) || depth > MAX_DEPTH) return;
    SCRAPED_URLS.add(url);

    const indent = "  ".repeat(depth);
    console.log(`${indent}🏗️  ISI Branch: ${url}`);

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
                // We set this to false so it can see the sidebar links/navigation
                onlyMainContent: false, 
                waitFor: 1500,
                // We removed 'nav' from exclusion to let it see the menus
                excludeTags: ["header", "footer", "script", "style", ".top-header"]
            })
        });

        const result = (await response.json()) as unknown as ScrapeResponse;

        if (result.success && result.data?.markdown) {
            const rawMd = result.data.markdown;
            
            // ✅ LINK PRESERVATION: We keep PDF links like SP-73:2023!
            const cleanMd = rawMd.split("हम बीआईएस हैं")[0];
            
            const contentHash = crypto.createHash('md5').update(cleanMd).digest('hex');

            // Save if it's unique and contains substantial text
            if (cleanMd.length > 700 && !SAVED_HASHES.has(contentHash)) {
                SAVED_HASHES.add(contentHash);
                const outputDir = path.resolve(process.cwd(), 'bis_data');
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

                const urlObj = new URL(url);
                const fileName = urlObj.pathname.split('/').filter(p => p).join('-') || 'isi-root';
                
                fs.writeFileSync(path.join(outputDir, `ISI-${fileName}.md`), cleanMd);
                console.log(`${indent}💾 Saved: ISI-${fileName}.md (${cleanMd.length} chars)`);
            }

            // --- BRANCH DISCOVERY ---
            const links = rawMd.match(/(https?:\/\/[^\s\)\"\]]+|(?<=\()\/[^\s\)\"\]]+)/g) || [];
            for (let link of links) {
                link = link.replace(/[()]/g, '').split(']')[0];
                if (link.startsWith('/')) link = `https://www.bis.gov.in${link}`;

                const isRelevant = TARGET_KEYWORDS.some(kw => link.toLowerCase().includes(kw));
                const isHindi = link.includes('?lang=hi') || link.includes('/hi/');

                // Skip social media and redundant home links
                const isSocial = link.includes("facebook.com") || link.includes("twitter.com");

                if (isRelevant && !isHindi && !isSocial && !link.endsWith('.pdf') && !SCRAPED_URLS.has(link)) {
                    await scrapeISI(link, depth + 1);
                }
            }
        }
    } catch (e: unknown) {
        console.error(`${indent}🛑 Error: ${(e as Error).message}`);
    }
}

// MULTI-ROOT JUMPSTART: Forces the scraper into the 3 most important ISI branches
async function runISI() {
    console.log("🚀 STARTING DEEP ISI MARK SCRAPE (LINK-RICH)...");
    
    const roots = [
        "https://www.bis.gov.in/international-relations/mou-with-other-countries/?lang=en",
        "https://www.bis.gov.in/standards/international-standardization-2/participation-in-iso-iec/?lang=en",
        "https://www.bis.gov.in/standards/international-standardization-2/wto-tbt/?lang=en",
    ];

    for (const root of roots) {
        await scrapeISI(root);
    }
    
    console.log("\n🏁 DEEP ISI SCRAPE COMPLETE.");
}

runISI();