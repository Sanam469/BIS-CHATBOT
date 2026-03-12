import FirecrawlApp from '@mendable/firecrawl-js';
import * as dotenv from 'dotenv';

// 1. This line connects your script to the .env.local file
dotenv.config({ path: '.env.local' });

// 2. Initialize the Scraper with your key
const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function main() {
  console.log("🔍 Starting the BIS website crawl...");

  // 3. We are telling the scraper to go to the BIS homepage and return Markdown
  const scrapeResult = await app.scrape('https://bis.gov.in', {
    formats: ['markdown'],
  });

  if (!scrapeResult.markdown) {
    console.error(`❌ Scrape failed: No markdown content returned`);
    return;
  }

  // 4. Success! Let's see what we got.
  console.log("✅ Scrape successful!");
  console.log("First 500 characters of the site:");
  console.log(scrapeResult.markdown?.slice(0, 500));
}

main();