# BIS Intel-Bot 🇮🇳

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**BIS Intel-Bot** is an advanced, AI-powered conversational interface designed specifically for the **Bureau of Indian Standards (BIS)**. Built during the **FOSS x BIS Hackathon**, this project aims to make Indian standardizations, certifications, and compliance processes instantly accessible, understandable, and highly engaging for citizens and manufacturers alike.

## 🌟 Hackathon Highlights

This project was built with a strong focus on open-source principles (FOSS), high performance, and an exceptional user experience:

- **Precision Retrieval-Augmented Generation (RAG)**: Built using `Pinecone` for vector storage and `gemini-embedding-001`. It accurately retrieves BIS documents, schemes, and IS standards to answer complex normative queries.
- **Anti-Hallucination Measures**: Strict system prompts guarantee that the bot *never* fabricates IS numbers, fees, or timelines. If a regulation isn't in the database, the bot honestly states its limitations.
- **Dynamic Multi-Query Engine**: Capable of breaking down complex, multi-part user questions (e.g., "Compare ISI and CRS") into parallel vector searches for comprehensive answers.
- **Mock Hindi Translator ('अ')**: A seamless toggle to show how regional language support makes BIS standards accessible to all of India.
- **Resilient API Infrastructure**: Includes a custom-built API Key Rotation pool (`gemini.ts`) that automatically handles 429/500 rate limits to guarantee uninterrupted service during high-traffic presentations.
- **Premium UI/UX**: Features a 3-colored BIS logo, interactive feedback (Thumbs Up/Down), a "Future Scope" scanner feature for instant ISI mark verification, and perfectly formatted markdown output (tables, bolded key terms) that is easy to scan.

## 🛠️ Tech Stack

- **Frontend Framework**: [Next.js](https://nextjs.org/) (React, TypeScript)
- **Styling**: Tailwind CSS & Lucide React Icons
- **AI / LLM**: Google Gemini (`gemini-2.5-flash` for chat, `gemini-embedding-001` for embeddings)
- **Vector Database**: [Pinecone](https://www.pinecone.io/)
- **Data Ingestion**: FireCrawl (for parsing `.pdf`, `.md`, and `.docx` BIS guidelines)

## 🚀 Getting Started Locally

1. **Clone the repository:**
   ```bash
   git clone [your-repo-link]
   cd bis-hackathon
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory and add your API keys:
   ```env
   PINECONE_API_KEY=your_pinecone_key
   FIRECRAWL_API_KEY=your_firecrawl_key
   # You can provide a comma-separated list of keys for automatic rotation!
   GOOGLE_GENERATIVE_AI_API_KEYS=key1,key2,key3
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to interact with the bot.

## 🌐 Open Source & FOSS

In the spirit of the FOSS x BIS Hackathon, this project emphasizes transparency, modularity, and community contribution. 

- **Extensible Architecture**: The API routing (`src/app/api/chat/route.ts`) and AI logic (`src/lib/gemini.ts`) are completely decoupled, allowing easy swaps to local open-source LLMs (like Llama 3 via Ollama) in the future.
- **Accessible Design**: Prioritized clean UI, keyboard navigability, and multi-language potential (Hindi translator demo) to align with true open-source accessibility goals.

---
*Built with ❤️ for the FOSS x BIS Hackathon.*
