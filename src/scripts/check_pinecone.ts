import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { Pinecone } from '@pinecone-database/pinecone';

async function main() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const idx = pc.index('bis-index');
  const stats = await idx.describeIndexStats();
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nTotal vectors in index: ${stats.totalRecordCount}`);
}

main();
