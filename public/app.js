/* ContentFlow frontend — vanilla JS, talks to /api/items */
let items = [];
let activeTab = 'queue';
let typeFilter = '';
let searchText = '';
let editing = null; // item currently open in editor

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const TYPE_ICON = { article: '📄', video: '🎬', paper: '🔬', thread: '🧵', podcast: '🎙', book: '📚' };
const REMIND_AFTER_DAYS = 3;

/* ---------------- API ---------------- */
async function api(method, path, body) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function load() {
  items = await api('GET', 'items');
  render();
}

async function patch(item, changes) {
  Object.assign(item, changes);
  render();
  await api('PUT', 'items/' + item.id, changes);
}

/* ---------------- Helpers ---------------- */
function daysAgo(iso) {
  return Math.floor((Date.now() - new Date(iso)) / 86400000);
}
function agoLabel(iso) {
  const d = daysAgo(iso);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}
function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
function priorityRank(p) { return p === 'high' ? 0 : p === 'normal' ? 1 : 2; }

/* ---------------- Render ---------------- */
function render() {
  renderQueue();
  renderStudio();
  renderScheduled();
  renderBadges();
}

function renderBadges() {
  const q = items.filter((i) => i.status === 'queue').length;
  const s = items.filter((i) => i.status === 'done').length;
  const c = items.filter((i) => i.status === 'done' && i.scheduledFor).length;
  for (const [id, n] of [['badge-queue', q], ['badge-studio', s], ['badge-scheduled', c]]) {
    const el = document.getElementById(id);
    el.textContent = n;
    el.classList.toggle('zero', n === 0);
  }
}

function renderQueue() {
  const grid = $('#queue-grid');
  let list = items.filter((i) => i.status === 'queue');
  if (typeFilter) list = list.filter((i) => i.type === typeFilter);
  if (searchText) {
    const q = searchText.toLowerCase();
    list = list.filter((i) =>
      i.title.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)));
  }
  list.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.addedAt.localeCompare(a.addedAt));

  grid.innerHTML = list.map((i) => `
    <div class="card ${i.priority}">
      <div class="card-top">
        <span class="card-type">${TYPE_ICON[i.type] || '📄'}</span>
        <span class="card-age">${agoLabel(i.addedAt)}</span>
      </div>
      <div class="card-title">${i.url
        ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)} ↗</a>`
        : esc(i.title)}</div>
      ${i.tags.length ? `<div class="card-tags">${i.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn success" data-act="done" data-id="${i.id}">✓ Done</button>
        <button class="btn del" data-act="del" data-id="${i.id}" title="Delete">🗑</button>
      </div>
    </div>`).join('');

  $('#queue-empty').classList.toggle('hidden', list.length > 0);
}

function renderStudio() {
  const done = items.filter((i) => i.status === 'done');
  // Reminders: consumed N+ days ago, still no draft
  const stale = done.filter((i) => !i.draft && i.doneAt && daysAgo(i.doneAt) >= REMIND_AFTER_DAYS);
  $('#reminders').innerHTML = stale.map((i) => `
    <div class="reminder" data-act="edit" data-id="${i.id}">
      <span>⏰ You finished <b>${esc(i.title)}</b> ${agoLabel(i.doneAt)} but haven't written anything yet.</span>
      <span>Write now →</span>
    </div>`).join('');

  const sorted = [...done].sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  $('#studio-list').innerHTML = sorted.map((i) => {
    const pill = i.scheduledFor
      ? '<span class="status-pill scheduled">scheduled</span>'
      : i.draft
        ? '<span class="status-pill drafted">draft in progress</span>'
        : '<span class="status-pill nodraft">no draft yet</span>';
    return `
    <div class="card" data-act="edit" data-id="${i.id}" style="cursor:pointer">
      <div class="card-top">
        <span class="card-type">${TYPE_ICON[i.type] || '📄'}</span>
        <span class="card-age">done ${i.doneAt ? agoLabel(i.doneAt) : ''}</span>
      </div>
      <div class="card-title">${esc(i.title)}</div>
      ${pill}
      ${i.draft ? `<div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(i.draft.split('\n')[0])}</div>` : ''}
    </div>`;
  }).join('');

  $('#studio-empty').classList.toggle('hidden', done.length > 0);
}

function renderScheduled() {
  const sched = items
    .filter((i) => i.status === 'done' && i.scheduledFor)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  $('#scheduled-list').innerHTML = sched.map((i) => {
    const when = new Date(i.scheduledFor);
    const overdue = when < new Date();
    return `
    <div class="sched-item ${overdue ? 'overdue' : ''}" data-act="edit" data-id="${i.id}">
      <div class="sched-when">${overdue ? '⚠ ' : ''}${when.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      <div class="sched-body">
        <div class="card-title">${esc(i.title)}</div>
        <div class="sched-draft">${esc((i.draft || '(no draft)').split('\n')[0])}</div>
      </div>
    </div>`;
  }).join('');
  $('#scheduled-empty').classList.toggle('hidden', sched.length > 0);
}

/* ---------------- Connector generator ----------------
   Template-based. Produces hooks / bridges / closers from the
   user's own thoughts — never writes the post itself. */
const STOPWORDS = new Set(('the a an and or but if then this that these those i you we they it is are was were be been being ' +
  'have has had do does did of in on at to for with about as by from not no so very really just ' +
  'removes makes gets feels seems looks goes comes takes gives turns becomes entirely actually basically things thing like more most much').split(' '));

function extractBits(item, thoughts) {
  const lines = thoughts.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const sentences = thoughts.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 8);
  const words = thoughts.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
  const freq = {};
  for (const w of words) if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
  return {
    title: item.title,
    topic: item.tags[0] || keywords[0] || item.type,
    claim: (sentences[0] || lines[0] || '').replace(/[.!?]+$/, ''),
    second: (sentences[1] || '').replace(/[.!?]+$/, ''),
    n: Math.max(lines.length, 2),
    keywords,
  };
}

const TEMPLATES = {
  insight: {
    hooks: [
      (b) => `Most people miss the real point of ${b.topic}.`,
      (b) => `I just finished "${b.title}" and one idea won't leave my head:`,
      (b) => `Everyone talks about ${b.topic}. Almost nobody talks about this part:`,
    ],
    bridges: [
      () => `Here's the part nobody mentions:`,
      (b) => `And this is where it gets interesting —`,
      (b) => `Which connects directly to ${b.keywords[1] || b.topic}:`,
      () => `Once you see it, you can't unsee it:`,
    ],
    closers: [
      (b) => `If you work anywhere near ${b.topic}, this is worth your time.`,
      () => `Saving this one. Future me will thank present me.`,
      (b) => `What's the one idea about ${b.topic} that changed how you think? Curious.`,
    ],
  },
  contrarian: {
    hooks: [
      (b) => `Unpopular opinion after reading "${b.title}":`,
      (b) => `Everything you've been told about ${b.topic} is incomplete. Here's why:`,
      (b) => `Hot take: ${b.claim || 'the consensus on ' + b.topic + ' is wrong'}.`,
    ],
    bridges: [
      () => `But here's where the standard advice falls apart:`,
      () => `The counterintuitive bit:`,
      (b) => `Most takes stop here. The real story is ${b.keywords[1] || 'one level deeper'}:`,
    ],
    closers: [
      () => `Disagree? Tell me why — genuinely want the strongest counter.`,
      (b) => `Maybe I'm wrong about ${b.topic}. But I haven't seen a good rebuttal yet.`,
      () => `The comfortable answer and the correct answer are rarely the same one.`,
    ],
  },
  story: {
    hooks: [
      (b) => `${agoOrToday(b)} I sat down with "${b.title}". Didn't expect it to rewire how I see ${b.topic}.`,
      (b) => `I almost skipped "${b.title}". Glad I didn't. Here's what it taught me:`,
      (b) => `A ${b.topic} story that stuck with me:`,
    ],
    bridges: [
      () => `Then it clicked:`,
      () => `That's when I realized the bigger pattern:`,
      () => `And the lesson underneath the lesson:`,
    ],
    closers: [
      () => `Sometimes the best ideas come from the things you almost skipped.`,
      (b) => `If this resonated, "${b.title}" is the source — worth the full read.`,
      () => `What changed your mind recently? Always collecting these.`,
    ],
  },
  question: {
    hooks: [
      (b) => `What if everything hard about ${b.topic} is actually a framing problem?`,
      (b) => `Quick question: why does nobody talk about ${b.keywords[0] || b.topic}?`,
      (b) => `Serious question after reading "${b.title}" — ${b.claim ? b.claim + '?' : 'are we doing ' + b.topic + ' wrong?'}`,
    ],
    bridges: [
      () => `The answer is messier than you'd think:`,
      () => `Sit with that for a second. Because it leads here:`,
      (b) => `And that raises the harder question about ${b.keywords[1] || b.topic}:`,
    ],
    closers: [
      () => `I don't have the full answer. But asking the right question is half of it.`,
      () => `Genuinely curious what you'd answer. Replies open.`,
      (b) => `If you've solved this for ${b.topic}, my DMs are open.`,
    ],
  },
  listicle: {
    hooks: [
      (b) => `${b.n} things "${b.title}" got right about ${b.topic}:`,
      (b) => `I pulled ${b.n} ideas from "${b.title}" so you don't have to. Thread 🧵`,
      (b) => `${b.n} lessons on ${b.topic} — each one took me too long to learn:`,
    ],
    bridges: [
      () => `But the next one is the one that matters most:`,
      () => `(This one alone is worth the whole list.)`,
      () => `Now stack these together and you get:`,
    ],
    closers: [
      () => `That's the list. Steal what's useful, ignore the rest.`,
      (b) => `Follow for more breakdowns like this — I read the long stuff about ${b.topic} so you don't have to.`,
      () => `Which one hit hardest? Helps me know what to go deeper on.`,
    ],
  },
};

function agoOrToday(b) {
  return 'Last week'; // simple story opener; user edits anyway
}

function generateSuggestions(item, thoughts, angle) {
  const b = extractBits(item, thoughts);
  const t = TEMPLATES[angle];
  const pick = (arr) => arr.map((fn) => fn(b)).filter(Boolean);
  return { Hooks: pick(t.hooks), Bridges: pick(t.bridges), Closers: pick(t.closers) };
}

/* ---------------- Editor ---------------- */
function openEditor(item) {
  editing = item;
  $('#ed-title').textContent = item.title;
  $('#ed-meta').textContent = `${TYPE_ICON[item.type] || ''} ${item.type}` +
    (item.doneAt ? ` · finished ${agoLabel(item.doneAt)}` : '') +
    (item.tags.length ? ` · ${item.tags.join(', ')}` : '');
  $('#ed-thoughts').value = item.thoughts || '';
  $('#ed-draft').value = item.draft || '';
  $('#ed-schedule').value = item.scheduledFor ? item.scheduledFor.slice(0, 16) : '';
  $('#ed-suggestions').innerHTML = '';
  updateCharCount();
  $('#editor').classList.remove('hidden');
  $('#ed-thoughts').focus();
}

function closeEditor() {
  $('#editor').classList.add('hidden');
  editing = null;
}

async function saveEditor(extra = {}) {
  if (!editing) return;
  const schedRaw = $('#ed-schedule').value;
  await patch(editing, {
    thoughts: $('#ed-thoughts').value,
    draft: $('#ed-draft').value,
    scheduledFor: schedRaw ? new Date(schedRaw).toISOString() : null,
    ...extra,
  });
}

function updateCharCount() {
  const len = $('#ed-draft').value.length;
  const el = $('#ed-charcount');
  el.textContent = `${len} chars ${len > 280 ? '· over single-tweet limit (thread it)' : '· fits one tweet'}`;
  el.classList.toggle('over', len > 280);
}

/* ---------------- Events ---------------- */
// Tabs
$$('.tab').forEach((t) => t.addEventListener('click', () => {
  activeTab = t.dataset.tab;
  $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $$('.tabpane').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + activeTab));
}));

// Add form
$('#add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tags = $('#add-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
  await api('POST', 'items', {
    title: $('#add-title').value,
    url: $('#add-url').value,
    type: $('#add-type').value,
    priority: $('#add-priority').value,
    tags,
  });
  $('#add-title').value = '';
  $('#add-url').value = '';
  $('#add-tags').value = '';
  await load();
  $('#add-title').focus();
});

// Filters
$('#search').addEventListener('input', (e) => { searchText = e.target.value; renderQueue(); });
$$('#type-chips .chip').forEach((c) => c.addEventListener('click', () => {
  typeFilter = c.dataset.type;
  $$('#type-chips .chip').forEach((x) => x.classList.toggle('active', x === c));
  renderQueue();
}));

// Card actions (delegated)
document.body.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const item = items.find((i) => i.id === el.dataset.id);
  if (!item) return;
  if (el.dataset.act === 'done') {
    await patch(item, { status: 'done', doneAt: new Date().toISOString() });
  } else if (el.dataset.act === 'del') {
    if (confirm(`Delete "${item.title}"?`)) {
      items = items.filter((i) => i !== item);
      render();
      await api('DELETE', 'items/' + item.id);
    }
  } else if (el.dataset.act === 'edit') {
    openEditor(item);
  }
});

// Editor
$('#ed-close').addEventListener('click', async () => { await saveEditor(); closeEditor(); });
$('#editor').addEventListener('click', (e) => { if (e.target === $('#editor')) { saveEditor(); closeEditor(); } });
$('#ed-save').addEventListener('click', async () => { await saveEditor(); closeEditor(); });
$('#ed-posted').addEventListener('click', async () => {
  await saveEditor({ status: 'posted', postedAt: new Date().toISOString() });
  closeEditor();
});
$('#ed-draft').addEventListener('input', updateCharCount);

$('#ed-generate').addEventListener('click', () => {
  if (!editing) return;
  const thoughts = $('#ed-thoughts').value.trim();
  if (!thoughts) {
    $('#ed-suggestions').innerHTML = '<div class="muted">Write a thought or two first — the generator builds on YOUR words.</div>';
    return;
  }
  const groups = generateSuggestions(editing, thoughts, $('#ed-angle').value);
  $('#ed-suggestions').innerHTML = Object.entries(groups).map(([label, lines]) => `
    <div class="sug-group-label">${label}</div>
    ${lines.map((l) => `<div class="sug">${esc(l)}</div>`).join('')}
  `).join('');
});

// Click suggestion → append to draft
$('#ed-suggestions').addEventListener('click', (e) => {
  const sug = e.target.closest('.sug');
  if (!sug) return;
  const d = $('#ed-draft');
  d.value = (d.value ? d.value + '\n\n' : '') + sug.textContent;
  sug.classList.add('used');
  updateCharCount();
});

load();
