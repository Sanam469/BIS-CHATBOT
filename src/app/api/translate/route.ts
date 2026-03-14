import { withGeminiRetry } from '@/src/lib/gemini';

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!text) {
            return new Response(JSON.stringify({ error: "Text is required" }), { status: 400 });
        }

        const prompt = `Translate the following text to Hindi. Respond ONLY with the Hindi translation, preserving markdown formatting (like tables, bolding, bullet points) if there are any. Do not include any extra text, explanations, or quotes.

Text:
${text}`;

        const result = await withGeminiRetry(async (genAI) => {
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            return await model.generateContent(prompt);
        });

        const translation = result.response.text();
        const usage = result.response.usageMetadata;
        
        if (usage) {
            console.log(`\n📊 [TRANSLATE] Token Usage:`);
            console.log(`    Input:  ${usage.promptTokenCount}`);
            console.log(`    Output: ${usage.candidatesTokenCount}`);
            console.log(`    Total:  ${usage.totalTokenCount}\n`);
        }

        return new Response(JSON.stringify({ translation }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error("Translation API Error:", error);
        return new Response(JSON.stringify({ error: "Translation failed" }), { status: 500 });
    }
}
