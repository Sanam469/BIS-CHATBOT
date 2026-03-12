import { pinecone, indexName } from '../lib/pinecone';

async function clearIndex() {
    console.log(`🧹 Preparing to wipe index: ${indexName}...`);
    const index = pinecone.index(indexName);

    try {
        // This deletes every record in the default namespace
        await index.deleteAll();
        console.log("✅ Database wiped clean. You are ready for a fresh start!");
    } catch (error) {
        console.error("❌ Failed to clear database:", error);
    }
}

clearIndex();