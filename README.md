# Website-audit-tool
# 🔍 Website Audit Tool

An AI-powered single-page website analyzer for SEO, CTA, and UX evaluation — built as part of the EIGHT25MEDIA AI-Native Software Engineer assignment.

> Paste any URL → get factual metrics + structured AI insights + prioritized recommendations in seconds.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- A Gemini API key — get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/DamyaGamage/Website-audit-tool.git
cd Website-audit-tool

# 2. Install dependencies
npm install

# 3. Create your .env file
echo "GEMINI_API_KEY=your_key_here" > .env
echo "PORT=3000" >> .env

# 4. Start the server
node server.js
```

Then open **http://localhost:3000** in your browser, enter any URL, and click **Analyze Page**.

---

## 🏗️ Architecture Overview

```
┌──────────────────────┐
│   Browser (UI)       │  ← User enters a URL
│   HTML / CSS / JS    │
└────────┬─────────────┘
         │ POST /analyze
         ▼
┌──────────────────────────────────────────┐
│   Express Server (server.js)             │
│                                          │
│  ┌─────────────────────────────────┐     │
│  │  1. scrapeWebsite(url)          │     │
│  │     axios.get → raw HTML        │     │
│  │     cheerio.load → parse DOM    │     │
│  │     extract metrics (no AI)     │     │
│  └──────────────┬──────────────────┘     │
│                 │ structured metrics      │
│  ┌──────────────▼──────────────────┐     │
│  │  2. analyzeWithAI(metrics)      │     │
│  │     build prompt with metrics   │     │
│  │     call Gemini API             │     │
│  │     parse JSON response         │     │
│  └──────────────┬──────────────────┘     │
│                 │ insights + recs         │
└─────────────────┼────────────────────────┘
                  │ JSON response
         ▼
┌──────────────────────┐
│   Browser renders    │
│   metrics, insights, │
│   recommendations,   │
│   and prompt logs    │
└──────────────────────┘
```

### Key Files

| File | Purpose |
|---|---|
| `server.js` | Express server, scraper logic, Gemini AI call |
| `public/index.html` | Frontend UI structure |
| `public/style.css` | Styling |
| `public/app.js` | Frontend JS — calls API, renders results |
| `prompt-logs.md` | Full prompt logs and raw model outputs |
| `.env` | API key (never committed to Git) |

---

## 📊 What It Extracts

### Factual Metrics (no AI involved)
These are scraped directly from the page HTML using Cheerio:

- ✅ Meta title and meta description
- ✅ Word count
- ✅ Heading counts (H1, H2, H3)
- ✅ Number of CTAs (buttons, action links)
- ✅ Internal vs external link count
- ✅ Total images + % missing alt text

### AI Insights (Gemini 2.5 Flash)
Grounded analysis covering:
- 🔎 SEO structure
- 💬 Messaging clarity
- 🎯 CTA usage
- 📝 Content depth
- ⚠️ UX concerns

### Prioritized Recommendations
3–5 actionable recommendations, each tied to a specific metric.

---

## 🤖 AI Design Decisions

### 1. Metrics-first, AI-second
The scraper runs completely independently of AI. Gemini receives a clean, structured set of numbers — not raw HTML. This means:
- The AI cannot hallucinate metrics — all numbers are ground truth
- The scraper and AI layer are fully decoupled and independently testable
- The AI model can be swapped without touching the scraper

### 2. Single combined prompt for Gemini
Unlike Anthropic's API which has a dedicated `system` field, Gemini works best with the system instructions and user data combined into one prompt. The system instructions are prepended, followed by the structured metrics data.

### 3. Strict JSON output instruction
The system prompt explicitly instructs Gemini to return only raw valid JSON — no markdown fences, no preamble. A cleanup step strips any accidental backticks before parsing. This makes the output reliably machine-readable without fragile regex parsing.

### 4. Grounding requirement enforced in the prompt
The system prompt contains an explicit rule: *"Every insight MUST reference actual numbers from the metrics."* This prevents generic advice and forces the model to be specific and useful.

### 5. Content snippet for semantic context
We pass the first 3,000 characters of body text and the top 20 headings. This gives Gemini enough context to assess messaging clarity and content depth without overloading the context window or increasing cost.

### 6. Prompt logs exposed in the UI
The system prompt, user prompt, and raw model output are all returned in the API response and displayed in a collapsible section in the UI. This provides full transparency into the AI layer — a core requirement of the assignment.

---

## ⚖️ Trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| **Cheerio over Puppeteer** | Fast, lightweight, zero browser overhead | Can't render JavaScript — SPAs (React, Vue, Angular) may return incomplete HTML |
| **Plain HTML/CSS/JS frontend** | Simple, no build step, easy to run locally | React would offer better component structure for a larger app |
| **Single Gemini API call** | Low latency, lower cost | Separate calls per insight category would allow deeper analysis per section |
| **No database** | Keeps scope focused | Results aren't stored — no history or comparison over time |
| **Gemini 2.5 Flash** | Free tier, fast, sufficient quality | Gemini 2.5 Pro would give richer insights but costs money |
| **No auth / rate limiting** | Simpler for a demo tool | Would be essential before any production deployment |

---

## 🔮 What I'd Improve With More Time

1. **Puppeteer support** — Handle JS-rendered SPAs by running a real browser headlessly, with screenshot capture for visual audits

2. **Caching layer** — Use Redis to cache results for repeated URLs, avoiding redundant API calls and reducing latency

3. **Audit history** — Store results in SQLite or PostgreSQL and show a diff between audits over time — valuable for tracking SEO improvements

4. **Composite score card** — A single 0–100 score per category (SEO, CTA, Content, UX) to give clients a quick at-a-glance health check

5. **PDF export** — Generate a downloadable audit report formatted for client delivery, with the agency's branding

6. **Rate limiting** — Add `express-rate-limit` to prevent abuse of the `/analyze` endpoint

7. **Better CTA detection** — Current detection uses CSS class patterns. A smarter approach would use NLP to identify action-oriented anchor text regardless of class names

8. **Deployment** — Deploy to Railway or Render with a single click, with environment variables set via their dashboard

---

## 📋 Prompt Logs

See [prompt-logs.md](./prompt-logs.md) for the full AI orchestration layer including:
- The system prompt
- The user prompt constructed from scraped metrics
- The raw model output before JSON parsing

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Server | Express.js |
| Scraping | Axios + Cheerio |
| AI Model | Google Gemini 2.5 Flash |
| AI SDK | @google/genai |
| Frontend | HTML5 / CSS3 / Vanilla JS |
| Config | dotenv |