import * as fs from 'fs';
import * as path from 'path';

const BIS_DATA_DIR = path.resolve(process.cwd(), 'bis_data');

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

function cleanMarkdown(raw: string): string {
    let clean = raw;
    const headerEnd = clean.indexOf('☰');
    if (headerEnd > 0 && headerEnd < 2000) {
        clean = clean.substring(headerEnd + 1);
    }
    clean = clean.split("हम बीआईएस हैं")[0];
    const footerPatterns = [
        /Previous\s*\n\s*!\[.*?\]\(https:\/\/www\.bis\.gov\.in\/wp-content\/uploads[\s\S]*$/,
        /!\[BIS FeedBack\][\s\S]*$/,
    ];
    for (const pattern of footerPatterns) {
        clean = clean.replace(pattern, '');
    }
    return clean.trim();
}

function countTotalChunks() {
    const files = fs.readdirSync(BIS_DATA_DIR).filter(f => f.endsWith('.md'));
    let totalChunks = 0;
    
    // Using the same valid/unique logic as salvage.ts to be precise
    const docs = files.map(file => {
        const content = fs.readFileSync(path.join(BIS_DATA_DIR, file), 'utf-8');
        return { filename: file, content };
    }).filter(d => d.content.trim().length >= 100 && !d.filename.includes('scontent-'));

    for (const doc of docs) {
        const cleaned = cleanMarkdown(doc.content);
        if (cleaned.length < 100) continue;
        const chunks = chunkMarkdown(cleaned);
        totalChunks += chunks.length;
    }

    console.log(`Total files (after filter): ${docs.length}`);
    console.log(`Total chunks generated: ${totalChunks}`);
}

countTotalChunks();
