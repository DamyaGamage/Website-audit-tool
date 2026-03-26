// app.js — Frontend logic
// This runs in the browser. It:
// 1. Sends the URL to our backend
// 2. Receives results
// 3. Renders them into the HTML

async function analyze() {
  const urlInput = document.getElementById('urlInput');
  const errorMsg = document.getElementById('errorMsg');
  const loader   = document.getElementById('loader');
  const results  = document.getElementById('results');
  const btn      = document.getElementById('analyzeBtn');

  const url = urlInput.value.trim();

  // Clear any previous state
  errorMsg.classList.add('hidden');
  results.classList.add('hidden');

  if (!url) {
    showError('Please enter a URL');
    return;
  }

  // Show loading state
  btn.disabled = true;
  btn.textContent = 'Analyzing…';
  loader.classList.remove('hidden');

  try {
    // Call our backend API
    const response = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed');
    }

    // Render the results
    renderMetrics(data.metrics);
    renderInsights(data.insights);
    renderRecommendations(data.recommendations);
    renderPromptLogs(data.promptLogs);

    results.classList.remove('hidden');
    // Smooth scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    showError('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyze Page';
    loader.classList.add('hidden');
  }
}

function showError(msg) {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function renderMetrics(m) {
  const grid = document.getElementById('metricsGrid');
  grid.innerHTML = `
    <div class="metric-item wide">
      <div class="metric-label">Meta Title</div>
      <div class="metric-value" style="font-size:1rem">${escHtml(m.metaTitle)}</div>
    </div>
    <div class="metric-item wide">
      <div class="metric-label">Meta Description</div>
      <div class="metric-value" style="font-size:1rem">${escHtml(m.metaDescription)}</div>
    </div>
    ${metricCard('Word Count', m.wordCount)}
    ${metricCard('H1 Tags', m.h1Count)}
    ${metricCard('H2 Tags', m.h2Count)}
    ${metricCard('H3 Tags', m.h3Count)}
    ${metricCard('CTAs Found', m.ctaCount)}
    ${metricCard('Internal Links', m.internalLinks)}
    ${metricCard('External Links', m.externalLinks)}
    ${metricCard('Total Images', m.totalImages)}
    ${metricCard('Missing Alt Text', m.missingAlt, `${m.missingAltPercent}% of images`)}
  `;
}

function metricCard(label, value, sub = '') {
  return `
    <div class="metric-item">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
      ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
    </div>
  `;
}

function renderInsights(ins) {
  const labels = {
    seo: '🔎 SEO Structure',
    messaging: '💬 Messaging Clarity',
    cta: '🎯 CTA Usage',
    content_depth: '📝 Content Depth',
    ux_concerns: '⚠️ UX Concerns'
  };
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = Object.entries(ins).map(([key, text]) => `
    <div class="insight-item">
      <div class="insight-label">${labels[key] || key}</div>
      <div class="insight-text">${escHtml(text)}</div>
    </div>
  `).join('');
}

function renderRecommendations(recs) {
  const list = document.getElementById('recsList');
  list.innerHTML = recs.map(r => `
    <div class="rec-item">
      <div class="rec-priority">${r.priority}</div>
      <div>
        <div class="rec-title">${escHtml(r.title)}</div>
        <div class="rec-detail">${escHtml(r.detail)}</div>
        <span class="rec-metric">📊 ${escHtml(r.metric_reference)}</span>
      </div>
    </div>
  `).join('');
}

function renderPromptLogs(logs) {
  document.getElementById('logSystem').textContent = logs.systemPrompt;
  document.getElementById('logUser').textContent   = logs.userPrompt;
  document.getElementById('logRaw').textContent    = logs.rawModelOutput;
}

// Escape HTML to prevent XSS (important security practice!)
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Allow pressing Enter to trigger analysis
document.getElementById('urlInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});