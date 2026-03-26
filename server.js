require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenAI } = require('@google/genai');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Gemini client
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);


// ─────────────────────────────────────────────
// SCRAPER — extracts factual metrics from a URL
// ─────────────────────────────────────────────
async function scrapeWebsite(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 15000
  });

  const html = response.data;
  const $ = cheerio.load(html);

  // Meta tags
  const metaTitle = $('title').text().trim() || 'Not found';
  const metaDescription = $('meta[name="description"]').attr('content') || 'Not found';

  // Headings
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  // Word count (strip scripts/styles first)
  $('script, style, noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(' ').filter(w => w.length > 0).length;

  // Internal vs external links
  const baseHostname = new URL(url).hostname;
  let internalLinks = 0;
  let externalLinks = 0;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    try {
      if (href.startsWith('http') || href.startsWith('//')) {
        const linkHostname = new URL(href.startsWith('//') ? 'https:' + href : href).hostname;
        linkHostname === baseHostname ? internalLinks++ : externalLinks++;
      } else {
        internalLinks++;
      }
    } catch { internalLinks++; }
  });

  // Images
  const images = $('img');
  const totalImages = images.length;
  let missingAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (!alt || alt.trim() === '') missingAlt++;
  });
  const missingAltPercent = totalImages > 0
    ? Math.round((missingAlt / totalImages) * 100) : 0;

  // CTAs
  const ctaCount = $(
    'button, a.btn, a.button, [class*="cta"], [class*="btn"], input[type="submit"]'
  ).length;

  // Headings text for AI context
  const headingsText = [];
  $('h1, h2, h3').each((_, el) => {
    headingsText.push(`${el.tagName.toUpperCase()}: ${$(el).text().trim()}`);
  });

  return {
    metrics: {
      metaTitle, metaDescription, wordCount,
      h1Count, h2Count, h3Count,
      internalLinks, externalLinks,
      totalImages, missingAlt, missingAltPercent,
      ctaCount,
    },
    context: {
      headingsText: headingsText.slice(0, 20),
      bodySnippet: bodyText.slice(0, 3000),
    }
  };
}

// ─────────────────────────────────────────────
// AI ANALYSIS — sends metrics to Gemini
// ─────────────────────────────────────────────
async function analyzeWithAI(url, metrics, context) {

  // System instructions baked into the prompt for Gemini
  const systemPrompt = `You are a senior web analyst specializing in SEO, conversion rate optimization (CRO), and UX for marketing websites.

You will receive factual metrics extracted from a webpage along with a content snippet. Your job is to:
1. Analyze the page based ONLY on the metrics and content provided
2. Generate specific, grounded insights — every insight MUST reference actual numbers from the metrics
3. Provide 3–5 prioritized, actionable recommendations tied to the metrics

CRITICAL RULES:
- Never give generic advice. Every statement must reference specific numbers.
- Return ONLY valid raw JSON. No markdown fences, no explanation text outside the JSON.

Return exactly this JSON structure:
{
  "insights": {
    "seo": "specific SEO analysis referencing actual metric values",
    "messaging": "clarity of page message based on headings and content",
    "cta": "CTA effectiveness based on the count found",
    "content_depth": "analysis based on word count and heading structure",
    "ux_concerns": "structural or UX red flags from the data"
  },
  "recommendations": [
    {
      "priority": 1,
      "title": "Short title",
      "detail": "Specific action tied to a metric",
      "metric_reference": "The exact metric driving this recommendation"
    }
  ]
}`;

  const userPrompt = `Analyze this webpage: ${url}

EXTRACTED METRICS:
- Meta Title: "${metrics.metaTitle}"
- Meta Description: "${metrics.metaDescription}"
- Word Count: ${metrics.wordCount}
- Headings: H1=${metrics.h1Count}, H2=${metrics.h2Count}, H3=${metrics.h3Count}
- CTAs found: ${metrics.ctaCount}
- Internal Links: ${metrics.internalLinks}
- External Links: ${metrics.externalLinks}
- Total Images: ${metrics.totalImages}
- Images missing alt text: ${metrics.missingAlt} (${metrics.missingAltPercent}%)

PAGE HEADINGS:
${context.headingsText.join('\n')}

CONTENT SNIPPET (first 3000 characters):
${context.bodySnippet}

Generate the structured analysis JSON now.`;

  // Combine system + user prompt for Gemini
  // (Gemini Flash works best with a single combined prompt)
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const result = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: fullPrompt,
    });
    const rawOutput = result.text;

  // Log everything to the console (for prompt-logs.md)
  console.log('\n======= PROMPT LOG =======');
  console.log('SYSTEM PROMPT:\n', systemPrompt);
  console.log('\nUSER PROMPT:\n', userPrompt);
  console.log('\nRAW MODEL OUTPUT:\n', rawOutput);
  console.log('===========================\n');

  // Strip markdown fences if Gemini adds them despite instructions
  const cleaned = rawOutput
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  return { parsed, rawOutput, systemPrompt, userPrompt };
}

// ─────────────────────────────────────────────
// API ROUTE: POST /analyze
// ─────────────────────────────────────────────
app.post('/analyze', async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  let normalizedUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = 'https://' + url;
  }

  try {
    console.log(`\n🔍 Analyzing: ${normalizedUrl}`);

    console.log('📄 Scraping page...');
    const { metrics, context } = await scrapeWebsite(normalizedUrl);
    console.log('✅ Metrics:', metrics);

    console.log('🤖 Sending to Gemini...');
    const { parsed, rawOutput, systemPrompt, userPrompt } = await analyzeWithAI(normalizedUrl, metrics, context);
    console.log('✅ AI analysis complete');

    res.json({
      url: normalizedUrl,
      metrics,
      insights: parsed.insights,
      recommendations: parsed.recommendations,
      promptLogs: { systemPrompt, userPrompt, rawModelOutput: rawOutput }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: error.message || 'Something went wrong. Check the URL and try again.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Website Audit Tool running at http://localhost:${PORT}`);
});