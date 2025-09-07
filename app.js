/* --------------------
   PROMPTS: load from prompts.json
   -------------------- */

// In this version, prompts are kept in prompts.json (same folder).
// Edit that file and commit. This script fetches it on page load.

let PROMPTS = [];
const DEFAULT_PROMPTS = [
  {
    id: 'email-summary',
    title: 'Email Summarizer',
    tags: ['work', 'summarize'],
    body: `You are an assistant that summarizes email threads.
- Return a concise bullet list with the key points, decisions, and action items.
- Pull out dates and owners.
- Keep it under 120 words.`,
  },
  {
    id: 'bug-report',
    title: 'Structured Bug Report',
    tags: ['engineering', 'qa', 'template'],
    body: `Write a clear, complete bug report:

Title:
Environment: (OS, Browser/App version)
Steps to Reproduce:
Expected Result:
Actual Result:
Additional Context / Screenshots:
Severity (P0–P3):`,
  },
  {
    id: 'code-review',
    title: 'Code Review Checklist',
    tags: ['engineering', 'checklist'],
    body: `Perform a code review:
- Correctness: edge cases, errors handled.
- Clarity: naming, comments, readability.
- Design: cohesion, coupling, single responsibility.
- Tests: coverage, meaningful cases.
- Performance & Security: obvious pitfalls.
- Maintainability: duplication, complexity.`,
  },
  {
    id: 'translate-brief',
    title: 'Translate + Preserve Tone',
    tags: ['writing', 'translate'],
    body: `Translate the text to <LANGUAGE>.
- Preserve tone and nuance.
- Use natural phrasing for native speakers.
- Provide 2 alternatives for ambiguous terms.`,
  },
];

async function loadPrompts() {
  try {
    const res = await fetch('prompts.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('prompts.json must be an array');

    // Normalize + index
    const normed = data.map((p, i) => ({
      id: String(p.id ?? '').trim() || `p-${i+1}`,
      title: String(p.title ?? 'Untitled'),
      tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      body: String(p.body ?? ''),
      __addedIndex: i,
    }));

    // Warn on duplicate ids (used for deep-links)
    const seen = new Set();
    for (const p of normed) {
      if (seen.has(p.id)) console.warn(`[prompt-library] Duplicate id in prompts.json: "${p.id}"`);
      seen.add(p.id);
    }

    PROMPTS = normed;
  } catch (err) {
    console.warn('[prompt-library] Failed to load prompts.json. Falling back to defaults.', err);
    PROMPTS = DEFAULT_PROMPTS.map((p, i) => ({ ...p, __addedIndex: i }));
  }
}

/* --------------------
   App state & helpers
   -------------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const state = {
  query: '',
  sort: 'title', // 'title' | 'added'
  selectedTags: new Set(),
};

const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

function uniqueTags() {
  const all = new Set();
  for (const p of PROMPTS) for (const t of p.tags || []) all.add(t);
  return Array.from(all).sort((a,b)=>a.localeCompare(b));
}

function hashHue(str) {
  let h = 0; for (let i=0; i<str.length; i++) { h = (h<<5)-h + str.charCodeAt(i); h |= 0; }
  return (Math.abs(h) % 360);
}

function renderTags() {
  const row = $('#tagRow');
  row.innerHTML = '';
  for (const tag of uniqueTags()) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.setAttribute('data-selected', 'false');
    btn.style.setProperty('--hue', hashHue(tag));
    btn.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${tag}</span>`;
    btn.addEventListener('click', () => {
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag); else state.selectedTags.add(tag);
      btn.setAttribute('data-selected', state.selectedTags.has(tag) ? 'true' : 'false');
      update();
    });
    row.appendChild(btn);
  }
}

function promptMatches(p) {
  const q = norm(state.query);
  const inText = q === '' || norm(p.title).includes(q) || norm(p.body).includes(q) || (p.tags||[]).some(t => norm(t).includes(q));
  const tagOk = state.selectedTags.size === 0 || (p.tags||[]).some(t => state.selectedTags.has(t));
  return inText && tagOk;
}

function copyToClipboard(text, el) {
  navigator.clipboard.writeText(text).then(() => flash(el, 'Copied'));
}

function flash(el, text='Done') {
  const btn = el;
  const prev = btn.textContent;
  btn.textContent = text + ' ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1200);
}

function shareLinkFor(id) {
  const url = new URL(window.location.href);
  url.hash = `p=${encodeURIComponent(id)}`;
  return url.toString();
}

function openFromHash() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const pid = params.get('p');
  if (!pid) return;
  const card = document.getElementById(`card-${pid}`);
  if (card) {
    const det = card.querySelector('details');
    det.open = true; card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.animate([{ boxShadow: '0 0 0 0 var(--ring)' },{ boxShadow: '0 0 0 8px var(--ring)' },{ boxShadow: '0 0 0 0 var(--ring)' }], { duration: 900, easing: 'ease-in-out' });
  }
}

function renderCards(list) {
  const grid = $('#grid');
  grid.innerHTML = '';
  for (const p of list) {
    const art = document.createElement('article');
    art.className = 'card';
    art.id = `card-${p.id}`;
    art.innerHTML = `
      <div class="card-header">
        <div>
          <div class="title">${p.title}</div>
          <div class="subtitle">${(p.tags||[]).map(t => `<span class=\"chip\" style=\"--hue:${hashHue(t)}\"><span class=\"dot\"></span>${t}</span>`).join(' ')}</div>
        </div>
        <div class="btn-row">
          <button class="copyBtn" title="Copy prompt">Copy</button>
          <button class="shareBtn" title="Copy share link">Share</button>
        </div>
      </div>
      <div class="card-body">
        <details>
          <summary>Show prompt</summary>
          <pre></pre>
        </details>
      </div>
    `;
    art.querySelector('pre').textContent = p.body;
    art.querySelector('.copyBtn').addEventListener('click', e => copyToClipboard(p.body, e.currentTarget));
    art.querySelector('.shareBtn').addEventListener('click', e => { navigator.clipboard.writeText(shareLinkFor(p.id)); flash(e.currentTarget, 'Link copied'); });
    grid.appendChild(art);
  }
}

function paramsToUI() {
  const url = new URL(window.location.href);
  const q = url.searchParams.get('q') || '';
  const sort = url.searchParams.get('sort') || 'title';
  const tags = (url.searchParams.get('tags') || '').split(',').filter(Boolean);
  $('#q').value = q; state.query = q;
  $('#sort').value = sort; state.sort = sort;
  state.selectedTags = new Set(tags);
  // Update chips to reflect selected tags
  $$('#tagRow .chip').forEach(ch => {
    const label = ch.textContent.trim();
    ch.setAttribute('data-selected', state.selectedTags.has(label) ? 'true' : 'false');
  });
}

function uiToParams() {
  const url = new URL(window.location.href);
  if (state.query) url.searchParams.set('q', state.query); else url.searchParams.delete('q');
  if (state.sort !== 'title') url.searchParams.set('sort', state.sort); else url.searchParams.delete('sort');
  if (state.selectedTags.size) url.searchParams.set('tags', Array.from(state.selectedTags).join(',')); else url.searchParams.delete('tags');
  history.replaceState(null, '', url);
}

function update() {
  const filtered = PROMPTS.filter(promptMatches);
  const sorted = filtered.sort((a,b) => {
    if (state.sort === 'title') return a.title.localeCompare(b.title);
    return b.__addedIndex - a.__addedIndex; // recently added first
  });
  renderCards(sorted);
  $('#resultsInfo').textContent = `${sorted.length} prompt${sorted.length!==1?'s':''} shown` + (state.query ? ` for “${state.query}”` : '') + (state.selectedTags.size? ` · tags: ${Array.from(state.selectedTags).join(', ')}` : '');
  $('#empty').hidden = sorted.length !== 0;
  uiToParams();
}

function setTheme(mode) {
  const root = document.documentElement;
  if (!mode) {
    mode = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  root.setAttribute('data-theme', mode);
  $('#themeBtn').setAttribute('aria-pressed', mode === 'dark');
  localStorage.setItem('theme', mode);
}

// Event wiring
window.addEventListener('DOMContentLoaded', async () => {
  setTheme();
  await loadPrompts();
  renderTags();
  paramsToUI();
  update();
  openFromHash();

  // Search
  $('#q').addEventListener('input', (e) => { state.query = e.target.value; update(); });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); } });

  // Sort
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; update(); });

  // Actions
  $('#exportBtn').addEventListener('click', () => {
    const data = PROMPTS.map(({id, title, tags, body}) => ({id, title, tags, body}));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'prompts.json' });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  $('#printBtn').addEventListener('click', () => window.print());
  $('#themeBtn').addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  // Update last updated timestamp
  const dt = new Date(document.lastModified);
  $('#lastUpdated').textContent = dt.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  // React to hash change for deep-linking
  window.addEventListener('hashchange', openFromHash);
});
