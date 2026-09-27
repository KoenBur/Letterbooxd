// ─── BOOK SEARCH & COVERS ───────────────────────────────────────────────
// Primary: Open Library (free, no key, great for novels)
// Covers: Open Library covers by ISBN/OLID → Wikipedia → Google Books fallback
const OL = 'https://openlibrary.org';

// ─── UTILITY ────────────────────────────────────────────────────────────
function relativeDate(str) {
  if (!str) return '';
  // Handle "MMM YYYY" format stored by toggleRead
  const my = str.match(/^(\w{3})\s+(\d{4})$/);
  const date = my ? new Date(`${my[1]} 1, ${my[2]}`) : new Date(str);
  if (isNaN(date)) return str;
  const days = Math.floor((Date.now() - date) / 86400000);
  if (days < 1)  return 'today';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `~${Math.round(days / 7)}w ago`;
  if (days < 365) return `~${Math.round(days / 30)}mo ago`;
  return `~${Math.round(days / 365)}y ago`;
}

function normalizeText(s = '') {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a = '', b = '') {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  if (!aa && !bb) return 1;
  if (aa === bb) return 1;
  // Simple token overlap for speed
  const tokA = new Set(aa.split(' '));
  const tokB = new Set(bb.split(' '));
  let overlap = 0;
  for (const t of tokA) if (tokB.has(t)) overlap++;
  return overlap / Math.max(tokA.size, tokB.size, 1);
}

// ─── OPEN LIBRARY SEARCH ────────────────────────────────────────────────
function normalizeOLBook(doc) {
  const coverId = doc.cover_i || null;
  const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
  return {
    key: doc.key?.replace('/works/', '') || doc.edition_key?.[0] || doc.title,
    title: doc.title || 'Unknown Title',
    author: doc.author_name?.[0] || 'Unknown Author',
    coverUrl,
    year: doc.first_publish_year?.toString() || '',
    pages: doc.number_of_pages_median || null,
    description: '',
    categories: doc.subject?.slice(0, 5) || [],
    language: doc.language?.[0] || 'eng',
    isbn: doc.isbn?.[0] || null,
    olKey: doc.key || null,
  };
}

// Verified recent/regional releases that the public catalog APIs do not expose
// reliably. These still flow through the normal ranking and book-detail UI.
const SUPPLEMENTAL_BOOKS = [
  {
    key: 'jNowEQAAQBAJ',
    title: 'De slag om Rust en Vreugd',
    author: 'Hendrik Groen',
    coverUrl: 'https://books.google.com/books/content?id=jNowEQAAQBAJ&printsec=frontcover&img=1&zoom=3&source=gbs_api',
    year: '2025',
    pages: 240,
    description: '',
    categories: ['Fiction'],
    language: 'nl',
    isbn: '9789089683137',
  },
];

function searchSupplementalBooks(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return SUPPLEMENTAL_BOOKS.filter(book => {
    const title = normalizeText(book.title);
    const author = normalizeText(book.author);
    const isbn = String(book.isbn || '').replace(/[^0-9X]/gi, '');
    const compactQuery = normalizedQuery.replace(/\s/g, '');
    return title.includes(normalizedQuery)
      || author.includes(normalizedQuery)
      || normalizedQuery.includes(title)
      || (isbn && isbn === compactQuery)
      || (tokens.length > 1 && tokens.every(token => title.includes(token) || author.includes(token)));
  });
}

// ─── OL WORK RESOLUTION ─────────────────────────────────────────────────
const olWorkCache = {};

function stripSubtitle(title) {
  return (title || '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s*:\s*.+$/, '')
    .trim();
}

async function resolveToOLWork(book) {
  if (/^OL\d+W$/.test(book.key)) return book;
  if (olWorkCache[book.key]) return { ...book, ...olWorkCache[book.key] };

  let workId = null;

  // OL-sourced books already carry olKey = '/works/OL...W'
  if (book.olKey) {
    const m = book.olKey.match(/\/works\/(OL\d+W)/);
    if (m) workId = m[1];
  }

  // ISBN lookup — most reliable cross-reference
  if (!workId && book.isbn) {
    try {
      const r = await fetch(`${OL}/isbn/${book.isbn}.json`);
      if (r.ok) {
        const d = await r.json();
        const wk = d.works?.[0]?.key;
        if (wk) workId = wk.replace('/works/', '');
      }
    } catch {}
  }

  // Title + author search fallback
  if (!workId) {
    try {
      const r = await fetch(
        `${OL}/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&limit=1`
      );
      if (r.ok) {
        const d = await r.json();
        const wk = d.docs?.[0]?.key;
        if (wk) workId = wk.replace('/works/', '');
      }
    } catch {}
  }

  if (!workId) return book;
  const patch = { key: workId, olWorkId: workId };
  olWorkCache[book.key] = patch;
  return { ...book, ...patch };
}

async function migrateBookKey(oldKey, newKey) {
  if (oldKey === newKey) return;

  if (state.readBooks[oldKey] && !state.readBooks[newKey]) {
    state.readBooks[newKey] = { ...state.readBooks[oldKey], key: newKey };
    delete state.readBooks[oldKey];
  }
  if (state.ratings[oldKey] !== undefined && state.ratings[newKey] === undefined) {
    state.ratings[newKey] = state.ratings[oldKey];
    delete state.ratings[oldKey];
  }
  if (state.wishlist[oldKey] && !state.wishlist[newKey]) {
    state.wishlist[newKey] = { ...state.wishlist[oldKey], key: newKey };
    delete state.wishlist[oldKey];
  }
  state.favorites = state.favorites.map(f => f.key === oldKey ? { ...f, key: newKey } : f);

  if (state.user && sb) {
    const uid = state.user.id;
    for (const table of ['read_books', 'ratings', 'favorites', 'wishlist', 'reviews']) {
      queryResult(sb.from(table).update({ book_key: newKey }).eq('user_id', uid).eq('book_key', oldKey))
        .then(() => {}).catch(() => {});
    }
  }
}

async function fetchFromOL(trimmed, byMatch, limit) {
  let olUrl;
  if (byMatch) {
    olUrl = `${OL}/search.json?title=${encodeURIComponent(byMatch[1].trim())}&author=${encodeURIComponent(byMatch[2].trim())}&limit=${limit}`;
  } else {
    olUrl = `${OL}/search.json?q=${encodeURIComponent(trimmed)}&limit=${limit * 2}`;
  }
  const res = await fetch(olUrl);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs || []).filter(d => d.title).map(normalizeOLBook);
}

async function fetchExactTitleFromOL(title, limit) {
  const res = await fetch(`${OL}/search.json?title=${encodeURIComponent(title)}&limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs || []).filter(d => d.title).map(normalizeOLBook);
}

async function searchBooks(query, limit = 20) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const byMatch = trimmed.match(/^(.+?)\s+by\s+(.+)$/i);

  const broadResults = await Promise.allSettled([
    fetchFromOL(trimmed, byMatch, limit),
    searchBooksGoogle(trimmed, limit),
  ]);

  let providerBooks = [
    ...searchSupplementalBooks(trimmed),
    ...broadResults.flatMap(result => result.value || []),
  ];
  const normalizedQuery = normalizeText(trimmed.replace(/^intitle:/i, ''));
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const hasStrongMatch = providerBooks.some(book => {
    const title = normalizeText(book.title);
    const author = normalizeText(book.author);
    const titleTokens = new Set(title.split(' '));
    const coverage = queryTokens.filter(token => titleTokens.has(token)).length / Math.max(queryTokens.length, 1);
    return title === normalizedQuery || author === normalizedQuery || coverage >= .8;
  });

  // Broad catalog search can miss recent regional editions. Only pay for these
  // focused requests when the first pass did not find a convincing match.
  if (!hasStrongMatch && queryTokens.length > 1) {
    const exactResults = await Promise.allSettled([
      fetchExactTitleFromOL(trimmed, limit),
      searchBooksGoogle(`intitle:${trimmed}`, limit),
    ]);
    providerBooks.push(...exactResults.flatMap(result => result.value || []));
  }

  const seenBooks = new Set();
  const results = [];
  for (const book of providerBooks) {
    const identity = `${normalizeText(book.title)}|${normalizeText(book.author)}`;
    if (!seenBooks.has(identity)) {
      seenBooks.add(identity);
      results.push(book);
    }
  }

  // Both providers return results in their own order. Re-rank the merged set so
  // exact and near-exact titles win, including newer non-English books.
  return results
    .map((book, providerIndex) => {
      const title = normalizeText(book.title);
      const author = normalizeText(book.author);
      const titleTokens = new Set(title.split(' '));
      const matchedTokens = queryTokens.filter(token => titleTokens.has(token)).length;
      let score = matchedTokens / Math.max(queryTokens.length, 1) * 60;
      if (title === normalizedQuery) score += 120;
      else if (title.startsWith(normalizedQuery)) score += 75;
      else if (title.includes(normalizedQuery)) score += 45;
      if (author === normalizedQuery) score += 95;
      else if (author.includes(normalizedQuery)) score += 35;
      if (book.coverUrl) score += 8;
      if (book.year) score += 2;
      score -= providerIndex * .01;
      return { book, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(result => result.book);
}

// Google Books fallback search — startIndex enables pagination (40 results per page max)
function normalizeGoogleCoverUrl(url) {
  return url.replace('http://', 'https://').replace('&edge=curl', '').replace(/zoom=\d+/g, 'zoom=3');
}

async function searchBooksGoogle(query, limit = 20, startIndex = 0) {
  try {
    const maxResults = Math.min(Math.max(limit, 1), 40);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&printType=books&orderBy=relevance&startIndex=${startIndex}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
      .filter(item => {
        const info = item.volumeInfo || {};
        if (info.printType && info.printType !== 'BOOK') return false;
        return !!info.title;
      })
      .slice(0, limit)
      .map(item => {
        const info = item.volumeInfo || {};
        const base = info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || '';
        const coverUrl = base ? normalizeGoogleCoverUrl(base) : null;
        return {
          key: item.id,
          title: info.title || 'Unknown Title',
          author: info.authors?.[0] || 'Unknown Author',
          coverUrl,
          year: info.publishedDate?.substring(0, 4) || '',
          pages: info.pageCount || null,
          description: info.description || '',
          categories: info.categories || [],
          language: info.language || '',
        };
      });
  } catch { return []; }
}

// ─── COVER CACHE ─────────────────────────────────────────────────────────
const coverMemCache = {};

async function getCachedCover(title, author) {
  author = author || '';
  const key = (title + '||' + author).toLowerCase();
  if (coverMemCache[key]) return coverMemCache[key];
  if (!sb) return null;
  try {
    const { data } = await queryResult(sb
      .from('book_cover_cache')
      .select('cover_url, book_key, year')
      .eq('title_lower', title.toLowerCase())
      .eq('author_lower', author.toLowerCase())
      .maybeSingle());
    if (data?.cover_url) {
      const result = { key: data.book_key || title, title, author, coverUrl: data.cover_url, year: data.year || '' };
      coverMemCache[key] = result;
      return result;
    }
  } catch (e) { /* ignore cache miss */ }
  return null;
}

async function saveCoverToCache(title, author, coverUrl, bookKey, year) {
  const key = (title + '||' + author).toLowerCase();
  const result = { key: bookKey || title, title, author, coverUrl, year: year || '' };
  coverMemCache[key] = result;
  if (!sb || !coverUrl) return;
  try {
    await queryResult(sb.from('book_cover_cache').upsert({
      title_lower: title.toLowerCase(),
      author_lower: author.toLowerCase(),
      cover_url: coverUrl,
      book_key: bookKey || title,
      year: year || '',
    }, { onConflict: 'title_lower,author_lower' }));
  } catch (e) { /* ignore cache write failure */ }
}

// ─── COVER LOOKUP: OL → Wikipedia → Google ──────────────────────────────
async function searchBooksForList(title, author) {
  author = author || '';
  // Check cache first
  const cached = await getCachedCover(title, author);
  if (cached) return cached;

  let book = null;

  // 1. Try Open Library search
  try {
    const olUrl = `${OL}/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=3&language=eng`;
    const res = await fetch(olUrl);
    if (res.ok) {
      const data = await res.json();
      // Find best match
      for (const doc of (data.docs || [])) {
        if (!doc.title) continue;
        const titleSim = similarity(doc.title, title);
        if (titleSim > 0.4 || normalizeText(doc.title).includes(normalizeText(title))) {
          book = normalizeOLBook(doc);
          break;
        }
      }
    }
  } catch { /* ignore */ }

  // 2. If no cover from OL, try Wikipedia
  if (!book?.coverUrl) {
    const wikiCover = await getWikipediaCover(title, author);
    if (wikiCover) {
      if (book) {
        book.coverUrl = wikiCover;
      } else {
        book = { key: title, title, author, coverUrl: wikiCover, year: '' };
      }
    }
  }

  // 3. Last resort: Google Books
  if (!book?.coverUrl) {
    try {
      const q = `intitle:"${title}" inauthor:"${author}"`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books&langRestrict=en`;
      const res = await fetch(url);
      if (res.ok && res.status !== 429) {
        const data = await res.json();
        const item = (data.items || [])[0];
        if (item) {
          const info = item.volumeInfo || {};
          const base = info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || '';
          const gCover = base ? normalizeGoogleCoverUrl(base) : null;
          if (gCover) {
            if (book) {
              book.coverUrl = gCover;
              if (!book.year) book.year = info.publishedDate?.substring(0, 4) || '';
            } else {
              book = {
                key: item.id, title, author, coverUrl: gCover,
                year: info.publishedDate?.substring(0, 4) || '',
                pages: info.pageCount || null,
                description: info.description || '', categories: info.categories || [],
              };
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Fallback: no cover found anywhere
  if (!book) {
    book = { key: title, title, author, coverUrl: null, year: '' };
  }

  // Save to cache for future loads
  if (book.coverUrl) {
    saveCoverToCache(title, author, book.coverUrl, book.key, book.year);
  }

  return book;
}

const GENRE_SUBJECTS = {
  'fantasy':           'fantasy',
  'thriller':          'thriller',
  'romance':           'romance',
  'biography':         'biography',
  'history':           'history',
  'philosophy':        'philosophy',
  'self-help':         'self_help',
  'horror':            'horror',
  'comics':            'comics',
  'classic literature':'classics',
  'science fiction':   'science_fiction',
  'popular books':     'bestsellers',
};

async function fetchOLSubject(subject, limit = 100, offset = 0, sort = 'editions', minYear = null) {
  const fields = 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject,language,isbn,edition_key';
  const catalogueFilter = minYear
    ? `q=${encodeURIComponent(`subject:${subject} first_publish_year:[${minYear} TO ${new Date().getFullYear()}]`)}`
    : `subject=${encodeURIComponent(subject)}`;
  const url = `${OL}/search.json?${catalogueFilter}&sort=${encodeURIComponent(sort)}&fields=${encodeURIComponent(fields)}&limit=${limit}&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs || []).filter(d => d.title).map(normalizeOLBook);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve([]), ms))]);
}

async function fetchOLTrending(limit = 100) {
  const url = `${OL}/trending/monthly.json?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.works || []).filter(w => w.title).map(w => ({
    key: w.key?.replace('/works/', '') || w.title,
    title: w.title,
    author: (w.author_name || [])[0] || 'Unknown Author',
    coverUrl: w.cover_id ? `https://covers.openlibrary.org/b/id/${w.cover_id}-L.jpg` : null,
    year: w.first_publish_year?.toString() || '',
    pages: null,
    description: '',
    categories: [],
    language: 'eng',
    isbn: null,
    olKey: w.key || null,
  }));
}

async function getCuratedShelf(titles) {
  const results = await Promise.allSettled(
    titles.map(async ({ title, author }) => {
      try {
        return await searchBooksForList(title, author);
      } catch {
        return { key: title, title, author, coverUrl: null, year: '' };
      }
    })
  );
  return results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
}

// Wikipedia cover — searches for the book article and grabs the page image
async function getWikipediaCover(title, author) {
  try {
    // Step 1: Search Wikipedia for the article
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + ' ' + author + ' novel')}&srlimit=3&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const articles = searchData.query?.search || [];

    // Find the best matching article
    let bestTitle = null;
    for (const article of articles) {
      const normArticle = normalizeText(article.title);
      const normTarget = normalizeText(title);
      if (normArticle.includes(normTarget) || normTarget.includes(normArticle) || similarity(article.title, title) > 0.5) {
        bestTitle = article.title;
        break;
      }
    }
    // Fallback: just use first result
    if (!bestTitle && articles.length) bestTitle = articles[0].title;
    if (!bestTitle) return null;

    // Step 2: Get the page image
    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(bestTitle)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
    const imgRes = await fetch(imgUrl);
    const imgData = await imgRes.json();
    const pages = Object.values(imgData.query?.pages || {});
    const img = pages[0]?.thumbnail?.source;
    return img || null;
  } catch { return null; }
}

function coverUrl(idOrUrl, size = 'M') {
  if (!idOrUrl) return null;
  if (idOrUrl.startsWith('http')) return idOrUrl;
  return `https://covers.openlibrary.org/b/id/${idOrUrl}-${size}.jpg`;
}

// ─── ADMIN: COVER MANAGEMENT ───────────────────────────────────────────
async function adminUpdateCover(title, author, newCoverUrl, bookKey, year) {
  if (!state.isAdmin) return;
  const key = (title + '||' + author).toLowerCase();
  // Update Supabase cache
  if (sb) {
    if (!await saveMutation(queryResult(sb.from('book_cover_cache').upsert({
      title_lower: title.toLowerCase(),
      author_lower: author.toLowerCase(),
      cover_url: newCoverUrl,
      book_key: bookKey || title,
      year: year || '',
    }, { onConflict: 'title_lower,author_lower' })))) return false;
  }
  // Update the in-memory cover only after persistence succeeds.
  coverMemCache[key] = { key: bookKey || title, title, author, coverUrl: newCoverUrl, year: year || '' };
  return true;
}

async function adminFindCoverOptions(title, author) {
  if (!state.isAdmin) return [];
  const options = [];
  const seen = new Set();

  function addOption(url, source) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    options.push({ url, source });
  }

  // Fetch all sources in parallel
  const [olResults, wikiCover, googleResults] = await Promise.allSettled([
    // 1. Open Library — search for multiple editions to get different covers
    (async () => {
      const res = await fetch(`${OL}/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=10&language=eng`);
      if (!res.ok) return [];
      const data = await res.json();
      const covers = [];
      for (const doc of (data.docs || [])) {
        if (doc.cover_i) {
          const sim = similarity(doc.title || '', title);
          if (sim > 0.3 || normalizeText(doc.title || '').includes(normalizeText(title))) {
            covers.push({
              url: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
              source: `Open Library${doc.edition_count > 1 ? ` (${doc.first_publish_year || ''})` : ''}`,
            });
          }
        }
      }
      return covers;
    })(),
    // 2. Wikipedia
    getWikipediaCover(title, author),
    // 3. Google Books — multiple results
    (async () => {
      const q = `intitle:"${title}" inauthor:"${author}"`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books&langRestrict=en`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const covers = [];
      for (const item of (data.items || [])) {
        const info = item.volumeInfo || {};
        const base = info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || '';
        if (base) {
          const coverUrl = normalizeGoogleCoverUrl(base);
          covers.push({ url: coverUrl, source: `Google Books (${info.publishedDate?.substring(0, 4) || '?'})` });
        }
      }
      return covers;
    })(),
  ]);

  // Collect results
  if (olResults.status === 'fulfilled') {
    for (const c of olResults.value) addOption(c.url, c.source);
  }
  if (wikiCover.status === 'fulfilled' && wikiCover.value) {
    addOption(wikiCover.value, 'Wikipedia');
  }
  if (googleResults.status === 'fulfilled') {
    for (const c of googleResults.value) addOption(c.url, c.source);
  }

  return options;
}
