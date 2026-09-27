// Blind Date keeps its votes in the browser session and works anonymously.
const BLIND_DATE_STORAGE = 'lbx_blind_date_session_v1';
const BLIND_DATE_SUBJECTS = ['literary_fiction','science_fiction','mystery','history','biography','fantasy','psychology','travel','horror','poetry'];
const blindDateCoverPreloads = new Map();
const blindDateWorkPreloads = new Map();

function preloadBlindDateCover(book) {
  if (!book?.coverUrl) return Promise.resolve(false);
  if (blindDateCoverPreloads.has(book.key)) return blindDateCoverPreloads.get(book.key);
  const promise = new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = coverUrl(book.coverUrl, 'L');
  });
  blindDateCoverPreloads.set(book.key, promise);
  return promise;
}

async function enrichBlindDateBook(book) {
  const workId = String(book?.key || '').replace('/works/', '');
  if (!/^OL\d+W$/.test(workId)) return book;
  if (!blindDateWorkPreloads.has(workId)) {
    blindDateWorkPreloads.set(workId, (async () => {
      try {
        const response = await fetch(`${OL}/works/${workId}.json`);
        if (!response.ok) return null;
        const data = await response.json();
        const description = typeof data.description === 'string' ? data.description : data.description?.value || '';
        return { description, subjects: Array.isArray(data.subjects) ? data.subjects : [] };
      } catch { return null; }
    })());
  }
  const details = await blindDateWorkPreloads.get(workId);
  if (!details) return book;
  if (details.description) book.description = details.description;
  if (details.subjects.length) book.categories = [...new Set([...(book.categories || []), ...details.subjects])].slice(0, 12);
  return book;
}

function newBlindDateSession() {
  return { id: crypto.randomUUID?.() || `bd-${Date.now()}`, shown: [], votes: [], pool: [], current: null, revealed: false, busy: false, summaryDue: false };
}

function loadBlindDateSession() {
  if (state.blindDate) return state.blindDate;
  try {
    const saved = JSON.parse(sessionStorage.getItem(BLIND_DATE_STORAGE) || 'null');
    state.blindDate = saved?.id ? { ...newBlindDateSession(), ...saved, pool: [] } : newBlindDateSession();
  } catch { state.blindDate = newBlindDateSession(); }
  return state.blindDate;
}

function saveBlindDateSession() {
  const game = loadBlindDateSession();
  sessionStorage.setItem(BLIND_DATE_STORAGE, JSON.stringify({ ...game, pool: [], busy: false }));
}

function blindDateCopyIndex(book, length) {
  const seed = String(book?.key || book?.year || 'book');
  return [...seed].reduce((total, char) => total + char.charCodeAt(0), 0) % length;
}

function blindDateSafeCategories(book) {
  const titleWords = new Set(normalizeText(book?.title || '').split(' ').filter(word => word.length > 3));
  const seen = new Set();
  return (book?.categories || [])
    .map(category => String(category).replace(/_/g, ' ').replace(/^(?:subject|genre)\s*:\s*/i, '').trim())
    .filter(Boolean)
    .filter(category => !/^(?:serie|series|franchise|characters?|places?|people|persons?)\s*:/i.test(category))
    .filter(category => !/juvenile literature|protected daisy|accessible book|reading level|open library|nyt bestseller/i.test(category))
    .filter(category => {
      const words = normalizeText(category).split(' ').filter(word => word.length > 3);
      return !words.length || words.filter(word => titleWords.has(word)).length / words.length < .6;
    })
    .filter(category => {
      const key = normalizeText(category);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function blindDateNeutralPremise(book) {
  const subjects = blindDateSafeCategories(book)
    .flatMap(category => category.split(/[\/;,]/))
    .map(subject => subject.trim().toLowerCase())
    .filter(subject => subject.length > 2 && subject.length < 38)
    .filter(subject => !/fiction|literature|accessible book|protected daisy|reading level|open library|nyt|bestseller/.test(subject));
  const allMetadata = `${(book.categories || []).join(' ')} ${book.title || ''}`.toLowerCase();
  const themeLabels = subjects.slice(0, 2);
  const themes = themeLabels.length === 2
    ? `${themeLabels[0]} and ${themeLabels[1]}`
    : themeLabels[0] || 'the choices people make under pressure';
  const pace = book.pages ? (book.pages < 240 ? 'compact' : book.pages > 520 ? 'expansive' : 'full-length') : 'immersive';

  let voice = 'literary';
  if (/mystery|detective|crime|thriller|suspense/.test(allMetadata)) voice = 'mystery';
  else if (/science fiction|space|dystopi|future|alien/.test(allMetadata)) voice = 'speculative';
  else if (/fantasy|magic|myth|fairy|dragon/.test(allMetadata)) voice = 'fantasy';
  else if (/horror|ghost|supernatural|gothic/.test(allMetadata)) voice = 'horror';
  else if (/biograph|memoir|autobiograph/.test(allMetadata)) voice = 'memoir';
  else if (/history|politic|war|social science/.test(allMetadata)) voice = 'history';
  else if (/romance|love stories/.test(allMetadata)) voice = 'romance';

  const openings = {
    mystery: ['Something is wrong, and the truth is buried under several convincing lies.', 'A question nobody can quite answer begins to pull everything else apart.', 'The clues are there. The trouble is deciding whom to trust.'],
    speculative: ['The world is recognizable, until one altered rule changes what it means to be human.', 'Imagine ordinary people living with an extraordinary new reality.', 'The future arrives carrying a problem nobody is ready to solve.'],
    fantasy: ['Beyond the familiar world, an old power is beginning to stir.', 'A strange world opens slowly, then asks for more than its characters expected to give.', 'Magic may shape this world, but its hardest choices are painfully human.'],
    horror: ['The unease begins quietly, in a place that should have felt safe.', 'Something waits just outside the edge of an ordinary life.', 'The first warning is easy to dismiss. The next one is not.'],
    memoir: ['A life is revisited through the moments that changed its direction.', 'This is less a record of events than an attempt to understand what they meant.', 'Memory, identity, and consequence meet in one candid life story.'],
    history: ['A familiar chapter of history looks very different from inside the lives it changed.', 'Large events come into focus through the people caught in their path.', 'The past becomes immediate when viewed through its arguments, accidents, and human costs.'],
    romance: ['Two lives begin to overlap at exactly the wrong, or perhaps right, moment.', 'Attraction is the easy part. Everything surrounding it is more complicated.', 'A connection grows where good sense says it probably should not.'],
    literary: ['An ordinary life shifts, and the consequences refuse to stay ordinary.', 'A small decision opens into a much larger reckoning.', 'People try to understand one another, with mixed and revealing results.'],
  };
  const middles = [
    `Underneath it runs an interest in ${themes}.`,
    `Its real territory is ${themes}.`,
    `What unfolds keeps circling back to ${themes}.`,
    `The story uses its premise to look closely at ${themes}.`,
  ];
  const endings = [
    `It unfolds at a ${pace} pace, leaving plenty for the reader to discover firsthand.`,
    `The shape is ${pace}; the pleasure lies in seeing where its central idea leads.`,
    `Much of the appeal comes from watching its separate pieces gather meaning.`,
    `Go in curious. This one is better met without a map.`,
  ];
  const index = blindDateCopyIndex(book, openings[voice].length);
  return `${openings[voice][index]} ${middles[blindDateCopyIndex({ key: `${book.key}m` }, middles.length)]} ${endings[blindDateCopyIndex({ key: `${book.key}e` }, endings.length)]}`;
}

function cleanBookDescription(book) {
  const holder = document.createElement('div');
  holder.innerHTML = book.description || '';
  let text = (holder.textContent || '').replace(/\s+/g, ' ').trim();
  const secrets = [book.title, book.author, ...(book.author || '').split(/\s+/).filter(p => p.length > 3)];
  secrets.filter(Boolean).sort((a,b) => b.length - a.length).forEach(secret => {
    text = text.replace(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'this book');
  });
  text = text
    .replace(/(?:in|from)\s+[A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){0,4}(?:'s|’s)?\s+(?:masterpiece|novel|book|series|classic)/g, 'In this story')
    .replace(/\b(?:New York Times|Sunday Times|international)\s+bestsell(?:er|ing)\b/gi, '')
    .replace(/\b(?:bestselling|award-winning|acclaimed|celebrated) author\b/gi, 'writer')
    .replace(/\b(?:Book|Volume)\s+(?:One|Two|Three|Four|Five|\d+)\s+(?:of|in)\s+(?:the\s+)?[^.!?]+/gi, 'Part of a larger story')
    // Multi-word proper names are usually characters, places, or series names.
    // Mask them before reveal rather than leaking them through the synopsis.
    .replace(/\b[A-Z][a-z'’.-]{2,}(?:\s+[A-Z][a-z'’.-]{2,})+(?:'s|’s)?\b/g, 'someone')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!text || text.length < 80 || /this book.{0,12}this book/i.test(text)) {
    return blindDateNeutralPremise(book);
  }
  const clipped = text.slice(0, 430);
  return clipped.length < text.length ? `${clipped.replace(/\s+\S*$/, '')}…` : clipped;
}

function blindDateEligible(book) {
  if (!book?.key || !book.title || !book.author || !book.year) return false;
  const descriptionLength = book.description?.trim().length || 0;
  const usefulGenres = (book.categories || []).filter(Boolean).length;
  // Covers are preferred during ranking, but the reveal UI already has a
  // graceful missing-cover state. A concise premise or two useful subjects is
  // enough to build an anonymous card without throwing away most candidates.
  return descriptionLength >= 40 || usefulGenres >= 2;
}

function blindDatePreferredYear() {
  const wishlistYears = Object.values(state.wishlist).map(item => Number(item.year)).filter(year => year > 0).sort((a,b) => a - b);
  return wishlistYears.length ? wishlistYears[Math.floor(wishlistYears.length / 2)] : 2005;
}

async function fillBlindDatePool() {
  const game = loadBlindDateSession();
  if (game.pool.length >= 12 || game.loading) return;
  game.loading = true;
  const excluded = new Set([...game.shown, ...Object.keys(state.readBooks)]);
  const works = new Set(game.pool.map(b => normalizeText(`${stripSubtitle(b.title)}|${b.author}`)));
  const addBooks = books => {
    for (const book of books) {
      const work = normalizeText(`${stripSubtitle(book.title)}|${book.author}`);
      if (!blindDateEligible(book) || excluded.has(book.key) || works.has(work)) continue;
      works.add(work); game.pool.push(book);
    }
  };

  // Open Library is the primary game catalogue. Its subject search is free,
  // does not require a browser-exposed API key, and returns canonical works.
  const subjects = [...BLIND_DATE_SUBJECTS].sort(() => Math.random() - .5).slice(0, 6);
  const modernStartYear = Math.max(1950, blindDatePreferredYear() - 30);
  const olBatches = await Promise.allSettled(subjects.map((subject, i) => {
    // Four modern-release lanes for every two broad catalogue lanes. This
    // avoids Open Library's edition-count bias toward nineteenth-century books.
    const modernLane = i < 4;
    const sort = 'editions';
    const offset = modernLane ? ((game.votes.length + i * 7) % 3) * 24 : ((game.votes.length + i * 11) % 5) * 24;
    return fetchOLSubject(subject, 24, offset, sort, modernLane ? modernStartYear : null);
  }));
  addBooks(olBatches.flatMap(result => result.value || []));

  // Google Books is now a small last-resort fallback instead of the primary
  // source, so a Google rate limit cannot empty a healthy Open Library pool.
  if (game.pool.length < 8) {
    const fallback = await Promise.allSettled(subjects.slice(0, 2).map((subject, i) =>
      searchBooksGoogle(`subject:${subject.replace(/_/g, ' ')}`, 10, i * 10)
    ));
    addBooks(fallback.flatMap(result => result.value || []));
  }
  game.loading = false;
}

function blindDateAffinity(book) {
  let score = Math.random() * 2;
  if (book.coverUrl) score += .45;
  if ((book.description || '').length >= 120) score += .35;
  if ((book.categories || []).length >= 2) score += .25;
  const preferredYear = blindDatePreferredYear();
  const candidateYear = Number(book.year) || 0;
  if (candidateYear) {
    const distance = Math.abs(candidateYear - preferredYear);
    if (distance <= 10) score += 3;
    else if (distance <= 25) score += 1.5;
    else if (candidateYear < 1900 && preferredYear >= 1950) score -= 2.5;
  }
  for (const vote of loadBlindDateSession().votes) {
    const direction = vote.choice === 'interested' ? 1 : -.35;
    if ((book.categories || []).some(c => vote.categories?.some(v => normalizeText(v).includes(normalizeText(c)) || normalizeText(c).includes(normalizeText(v))))) score += 3 * direction;
    if (book.pages && vote.pages && Math.abs(book.pages - vote.pages) < 150) score += .8 * direction;
    if (book.year && vote.year && Math.abs(Number(book.year) - Number(vote.year)) < 15) score += .6 * direction;
  }
  return score;
}

async function chooseBlindDateBook() {
  const game = loadBlindDateSession();
  await fillBlindDatePool();
  if (!game.pool.length) return null;
  const exploratory = Math.random() < .3;
  // Most exploratory picks still come from the modern catalogue. Roughly one
  // in four may range freely across eras so classics remain discoverable.
  const freeEraExploration = exploratory && Math.random() < .25;
  const ranked = [...game.pool].sort((a,b) => freeEraExploration ? Math.random() - .5 : blindDateAffinity(b) - blindDateAffinity(a));
  const book = ranked[0];
  game.pool = game.pool.filter(b => b.key !== book.key);
  await enrichBlindDateBook(book);
  game.current = book; game.revealed = false; game.shown.push(book.key);
  preloadBlindDateCover(book);
  game.pool.slice(0, 3).forEach(preloadBlindDateCover);
  saveBlindDateSession(); fillBlindDatePool();
  return book;
}

function updateBlindDateProgress() {
  const step = loadBlindDateSession().votes.length % 10 + 1;
  const label = document.getElementById('blind-date-progress-label');
  const fill = document.getElementById('blind-date-progress-fill');
  if (label) label.textContent = `${step} / 10`;
  if (fill) fill.style.width = `${step * 10}%`;
}

function renderBlindDateMystery(book) {
  const stage = document.getElementById('blind-date-stage');
  if (!stage) return;
  preloadBlindDateCover(book);
  const safeCategories = blindDateSafeCategories(book);
  const nonfiction = safeCategories.some(c => /history|biography|science|psychology|business|travel/i.test(c));
  const prompts = ['Worth turning the first page?', 'Does this belong in your reading future?', 'Would you take this one home?', 'Has this earned a place on your nightstand?', 'Would you keep reading after page one?'];
  const prompt = prompts[blindDateCopyIndex(book, prompts.length)];
  stage.innerHTML = `<article class="blind-card blind-card-mystery"><div class="blind-card-rail"><span>YOUR NEXT BLIND DATE</span><b aria-hidden="true">?</b></div><div class="blind-card-body"><div class="blind-clue-meta"><span>${nonfiction ? 'Nonfiction or literary narrative' : 'Fiction'}</span><span>First published ${escHtml(book.year)}</span>${book.pages ? `<span>${book.pages} pages</span>` : ''}</div><div class="blind-genres">${safeCategories.slice(0,4).map(c => `<span>${escHtml(c)}</span>`).join('')}</div><blockquote>${escHtml(cleanBookDescription(book))}</blockquote><p class="blind-prompt">${prompt}</p><div class="blind-actions"><button class="blind-choice blind-choice-no" data-choice="not_interested" type="button"><span>×</span> Not for me</button><button class="blind-choice blind-choice-yes" data-choice="interested" type="button"><span>+</span> Interested</button></div></div></article>`;
  stage.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => voteBlindDate(button.dataset.choice)));
  updateBlindDateProgress();
}

async function voteBlindDate(choice) {
  const game = loadBlindDateSession();
  if (game.busy || game.revealed || !game.current) return;
  game.busy = true;
  document.querySelectorAll('.blind-choice').forEach(button => { button.disabled = true; });
  document.querySelector('.blind-card-mystery')?.classList.add('is-choosing');
  const book = game.current;
  const vote = { book_id: book.key, choice, timestamp: new Date().toISOString(), session_id: game.id, categories: book.categories || [], pages: book.pages || null, year: book.year || null };
  game.votes.push(vote); game.revealed = true; game.summaryDue = game.votes.length % 10 === 0;
  saveBlindDateSession();
  await Promise.race([
    preloadBlindDateCover(book),
    new Promise(resolve => setTimeout(resolve, 700)),
  ]);
  renderBlindDateReveal(book, choice); game.busy = false;
}

function renderBlindDateReveal(book, choice) {
  const interested = choice === 'interested';
  const isWish = !!state.wishlist[book.key];
  const likedVerdicts = ['A spark worth following', 'This one found its reader', 'Your shelf just leaned closer', 'Curiosity wins this round'];
  const passedVerdicts = ['Not every book finds its reader', 'A clean break—unless…', 'The mystery worked; the match did not', 'One for a different shelf'];
  const verdicts = interested ? likedVerdicts : passedVerdicts;
  const verdict = verdicts[blindDateCopyIndex(book, verdicts.length)];
  const saveLabel = interested ? '+ Add to Read Later' : 'Still want to read';
  document.getElementById('blind-date-stage').innerHTML = `<article class="blind-card blind-card-reveal"><div class="blind-reveal-cover"><img src="${escHtml(coverUrl(book.coverUrl,'L'))}" alt="Cover of ${escHtml(book.title)}" onerror="this.parentElement.classList.add('cover-failed');this.remove()"><span>Cover unavailable</span></div><div class="blind-reveal-copy"><p class="blind-verdict ${interested ? 'liked' : ''}">${verdict}</p><h2>${escHtml(book.title)}</h2><p class="blind-author">${escHtml(book.author)} · ${escHtml(book.year)}</p><div class="blind-genres">${book.categories.slice(0,3).map(c => `<span>${escHtml(c)}</span>`).join('')}</div><p class="blind-reveal-description">${escHtml(cleanBookDescription(book))}</p><div class="blind-reveal-actions"><button class="blind-save ${isWish ? 'saved' : ''}" id="blind-save" type="button">${isWish ? '✓ Saved to Read Later' : saveLabel}</button><button class="blind-detail" id="blind-detail" type="button">View book details ↗</button><button class="blind-next" id="blind-next" type="button">${loadBlindDateSession().summaryDue ? 'See your results →' : 'Next blind date →'}</button></div></div></article>`;
  document.getElementById('blind-save')?.addEventListener('click', async e => {
    const button = e.currentTarget;
    if (!await toggleWishlist(book)) return;
    button.textContent = state.wishlist[book.key] ? '✓ Saved to Read Later' : saveLabel;
    button.classList.toggle('saved', !!state.wishlist[book.key]);
  });
  document.getElementById('blind-detail')?.addEventListener('click', () => openBook(book));
  document.getElementById('blind-next')?.addEventListener('click', nextBlindDate);
}

function blindDateSummary() {
  const game = loadBlindDateSession(), last = game.votes.slice(-10), liked = last.filter(v => v.choice === 'interested'), genres = {};
  liked.forEach(v => v.categories.forEach(c => { const g = c.split('/')[0].trim(); genres[g] = (genres[g] || 0) + 1; }));
  const top = Object.entries(genres).sort((a,b) => b[1] - a[1]).slice(0,3).map(([g]) => g);
  const withPages = liked.filter(v => v.pages), avgPages = Math.round(withPages.reduce((n,v) => n + v.pages, 0) / Math.max(1, withPages.length));
  const signals = [...top.map(g => `More ${g.toLowerCase()}`), ...(avgPages ? [`Books around ${Math.round(avgPages/50)*50} pages`] : []), 'A little room for surprises'].slice(0,4);
  document.getElementById('blind-date-stage').innerHTML = `<section class="blind-summary"><p>10 books, zero covers</p><h2>Your Blind Date results</h2><div class="blind-summary-score"><strong>${liked.length}</strong><span>of 10<br>caught your interest</span></div><p>So far, your shelf is leaning toward:</p><ul>${signals.map(s => `<li>${escHtml(s)}</li>`).join('')}</ul><button class="blind-next" id="blind-continue" type="button">Continue dating books →</button></section>`;
  document.getElementById('blind-continue').addEventListener('click', async () => { game.summaryDue = false; saveBlindDateSession(); await nextBlindDate(); });
}

async function nextBlindDate() {
  const game = loadBlindDateSession();
  if (game.summaryDue) return blindDateSummary();
  renderBlindDateLoading(); const book = await chooseBlindDateBook();
  if (book) renderBlindDateMystery(book); else renderBlindDateEmpty();
}
function renderBlindDateLoading() {
  const lines = ['Pulling a promising book from the stacks…', 'Following a loose page through the catalogue…', 'Asking the shelves to keep a secret…', 'Finding a story you might otherwise miss…'];
  const line = lines[Math.floor(Math.random() * lines.length)];
  const el = document.getElementById('blind-date-stage');
  if (el) el.innerHTML = `<div class="blind-loading" role="status"><svg class="blind-loading-books" width="82" height="72" viewBox="0 0 82 72" fill="none" aria-hidden="true"><rect class="book-one" x="8" y="48" width="66" height="13" rx="1"/><rect class="book-two" x="15" y="30" width="58" height="13" rx="1"/><rect class="book-three" x="9" y="12" width="64" height="13" rx="1"/><path d="M18 16h32M24 34h40M18 52h35"/></svg><p>${line}</p></div>`;
}
function renderBlindDateEmpty() { const el = document.getElementById('blind-date-stage'); if (el) el.innerHTML = `<div class="blind-empty"><span>THE STACKS ARE QUIET</span><h2>No suitable books found.</h2><p>We could not reach the catalogue, or you have seen every eligible book in this batch.</p><button class="blind-next" type="button" onclick="nextBlindDate()">Try the stacks again →</button></div>`; }
async function loadBlindDatePage() {
  const game = loadBlindDateSession();
  if (game.summaryDue) return blindDateSummary();
  if (game.current && game.revealed) return renderBlindDateReveal(game.current, game.votes.at(-1)?.choice);
  if (game.current) { await enrichBlindDateBook(game.current); return renderBlindDateMystery(game.current); }
  renderBlindDateLoading(); const book = await chooseBlindDateBook();
  if (book) renderBlindDateMystery(book); else renderBlindDateEmpty();
}
