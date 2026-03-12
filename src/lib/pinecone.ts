import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Moved to the very top

import { Pinecone } from '@pinecone-database/pinecone';

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export const indexName = 'bis-index';