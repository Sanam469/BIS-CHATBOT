import FirecrawlApp from '@mendable/firecrawl-js';

// TOTAL ISOLATION: No imports, no env, no junk.
const firecrawl = new FirecrawlApp({ apiKey: "fc-55bdec6f42d7465d93aad36457a16c55" });

async function run() {
    console.log("⚡ Testing hardcoded key...");
    try {
        const result = await firecrawl.scrape("https://example.com", { formats: ['markdown'] });
        console.log("✅ IT WORKED. Response received.");
    } catch (e) {
        console.error("❌ STILL FAILING:", e);
    }
}
run();