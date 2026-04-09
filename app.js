// ─── STATE ──────────────────────────────────────────────────────────────
const state = {
  username: localStorage.getItem('lbx_username') || 'Reader',
  readBooks: JSON.parse(localStorage.getItem('lbx_read') || '{}'),
  ratings: JSON.parse(localStorage.getItem('lbx_ratings') || '{}'),
  favorites: JSON.parse(localStorage.getItem('lbx_favorites') || '[]'),
  currentPage: 'home',
  currentBook: null,
  searchQuery: '',
  searchResults: [],
  popularBooks: [],
  classicsBooks: [],
  recentBooks: [],
  pendingRatingBook: null,
};

function save() {
  localStorage.setItem('lbx_read', JSON.stringify(state.readBooks));
  localStorage.setItem('lbx_ratings', JSON.stringify(state.ratings));
  localStorage.setItem('lbx_favorites', JSON.stringify(state.favorites));
  localStorage.setItem('lbx_username', state.username);
}

// ─── OPEN LIBRARY API ────────────────────────────────────────────────────
const COVERS = 'https://covers.openlibrary.org/b/id/';
const OL = 'https://openlibrary.org';

async function searchBooks(query, limit = 20) {
  const url = `${OL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.docs || []).map(normalizeBook);
}

async function fetchBookDetails(key) {
  // key like /works/OL12345W
  const res = await fetch(`${OL}${key}.json`);
  const data = await res.json();
  return data;
}

async function fetchAuthor(authorKey) {
  const res = await fetch(`${OL}${authorKey}.json`);
  return await res.json();
}

async function getPopularBooks(subject, limit = 12) {
  const url = `${OL}/subjects/${subject}.json?limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.works || []).map(w => ({
    key: w.key,
    title: w.title,
    author: w.authors?.[0]?.name || 'Unknown Author',
    coverId: w.cover_id || w.cover_edition_key,
    year: w.first_publish_year || '',
  }));
}

function normalizeBook(doc) {
  return {
    key: doc.key,
    title: doc.title,
    author: doc.author_name?.[0] || 'Unknown Author',
    coverId: doc.cover_i,
    year: doc.first_publish_year || '',
    pages: doc.number_of_pages_median || null,
  };
}

function coverUrl(id, size = 'M') {
  if (!id) return null;
  return `${COVERS}${id}-${size}.jpg`;
}

// ─── ROUTER ──────────────────────────────────────────────────────────────
function navigate(page, params = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  state.currentPage = page;
  window.scrollTo(0, 0);

  if (page === 'home') {
    document.getElementById('page-home').classList.add('active');
    document.querySelector('nav a[data-page="home"]')?.classList.add('active');
    loadHomePage();
  } else if (page === 'search') {
    document.getElementById('page-search').classList.add('active');
    document.querySelector('nav a[data-page="search"]')?.classList.add('active');
    if (params.query) {
      document.getElementById('main-search-input').value = params.query;
      doSearch(params.query);
    }
  } else if (page === 'book') {
    document.getElementById('page-book').classList.add('active');
    loadBookDetail(params.book || state.currentBook);
  } else if (page === 'profile') {
    document.getElementById('page-profile').classList.add('active');
    document.querySelector('nav a[data-page="profile"]')?.classList.add('active');
    loadProfilePage();
  }
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────
async function loadHomePage() {
  renderSkeletons('popular-books-grid', 10);
  renderSkeletons('classics-books-grid', 10);

  try {
    const [popular, classics, fiction] = await Promise.all([
      getPopularBooks('bestseller', 12),
      getPopularBooks('classic_literature', 12),
      getPopularBooks('science_fiction', 12),
    ]);
    state.popularBooks = popular;
    state.classicsBooks = classics;
    renderBookGrid('popular-books-grid', popular);
    renderBookGrid('classics-books-grid', classics);
    // Render fiction in the "recent" section
    renderBookGrid('fiction-books-grid', fiction);
  } catch (e) {
    console.error(e);
    showToast('Could not load books. Check your connection.', 'error');
  }
}

function renderSkeletons(containerId, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({length: count}, () => `
    <div>
      <div class="skeleton skeleton-cover"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line short"></div>
    </div>
  `).join('');
}

function renderBookGrid(containerId, books) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!books.length) {
    el.innerHTML = `<div class="empty-state"><p>No books found.</p></div>`;
    return;
  }
  el.innerHTML = books.map(book => bookCardHTML(book)).join('');
  el.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.overlay-btn')) return;
      const key = card.dataset.key;
      const book = findBookByKey(key) || books.find(b => b.key === key);
      if (book) openBook(book);
    });
  });
  el.querySelectorAll('.overlay-btn.mark-read').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
    });
  });
  el.querySelectorAll('.overlay-btn.rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const book = books.find(b => b.key === btn.dataset.key);
      if (book) openRatingModal(book);
    });
  });
}

function bookCardHTML(book) {
  const isRead = !!state.readBooks[book.key];
  const rating = state.ratings[book.key] || 0;
  const cover = coverUrl(book.coverId);
  const starsHtml = [1,2,3,4,5].map(i => `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`).join('');

  return `
    <div class="book-card" data-key="${escHtml(book.key)}">
      <div class="book-cover-wrap">
        ${cover
          ? `<img class="book-cover" src="${cover}" alt="${escHtml(book.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="book-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/><rect x="3" y="4" width="18" height="2" rx="1" fill="#67788a"/><rect x="3" y="9" width="14" height="2" rx="1" fill="#67788a"/><rect x="3" y="14" width="16" height="2" rx="1" fill="#67788a"/></svg>
          <span class="placeholder-title">${escHtml(book.title)}</span>
        </div>
        <div class="book-overlay">
          <div class="overlay-actions">
            <button class="overlay-btn mark-read ${isRead ? 'read' : ''}" data-key="${escHtml(book.key)}" data-title="${escHtml(book.title)}" data-author="${escHtml(book.author)}" data-cover="${book.coverId || ''}" data-year="${book.year || ''}" title="${isRead ? 'Mark unread' : 'Mark as read'}">
              ${isRead ? '✓' : '📖'}
            </button>
            <button class="overlay-btn rate-btn ${rating ? 'rated' : ''}" data-key="${escHtml(book.key)}" title="Rate">★</button>
          </div>
        </div>
        ${isRead ? '<div class="read-badge">✓</div>' : ''}
      </div>
      <div class="book-info">
        <div class="book-title">${escHtml(book.title)}</div>
        <div class="book-author">${escHtml(book.author)}</div>
        ${rating ? `<div class="book-rating">${starsHtml}</div>` : ''}
      </div>
    </div>
  `;
}

// ─── BOOK DETAIL ───────────────────────────────────────────────────────────
async function openBook(book) {
  state.currentBook = book;
  navigate('book', { book });
}

async function loadBookDetail(book) {
  if (!book) return;

  const isRead = !!state.readBooks[book.key];
  const rating = state.ratings[book.key] || 0;
  const isFav = state.favorites.some(f => f.key === book.key);
  const cover = coverUrl(book.coverId, 'L');

  // Render initial shell
  document.getElementById('book-detail-content').innerHTML = `
    <div class="book-detail-backdrop">
      <div class="book-detail-inner">
        <div>
          ${cover
            ? `<img class="book-detail-cover" id="detail-cover-img" src="${cover}" alt="${escHtml(book.title)}" onerror="this.style.display='none';document.getElementById('detail-cover-placeholder').style.display='flex'">`
            : ''}
          <div class="book-detail-cover-placeholder" id="detail-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
            <svg width="48" height="64" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/><rect x="3" y="4" width="18" height="2" rx="1" fill="#67788a"/><rect x="3" y="9" width="14" height="2" rx="1" fill="#67788a"/><rect x="3" y="14" width="16" height="2" rx="1" fill="#67788a"/></svg>
            <p>${escHtml(book.title)}</p>
          </div>
        </div>
        <div class="book-detail-info">
          ${book.year ? `<div class="book-detail-year">${book.year}</div>` : ''}
          <h1 class="book-detail-title">${escHtml(book.title)}</h1>
          <div class="book-detail-author">by <a href="#">${escHtml(book.author)}</a></div>

          <div class="detail-meta">
            ${book.pages ? `<div class="meta-item"><span class="meta-label">Pages</span><span class="meta-value">${book.pages}</span></div>` : ''}
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <span class="meta-value" id="detail-status">${isRead ? '✓ Read' : '— Not read'}</span>
            </div>
          </div>

          <div class="detail-actions">
            <button class="detail-action-btn ${isRead ? 'active-read' : ''}" id="detail-read-btn">
              <span>${isRead ? '✓' : '+'}</span> ${isRead ? 'Read' : 'Mark as Read'}
            </button>
            <button class="detail-action-btn ${isFav ? 'active-fav' : ''}" id="detail-fav-btn">
              <span>♥</span> ${isFav ? 'Favorited' : 'Add to Favorites'}
            </button>
            <div class="detail-rating">
              <span class="detail-rating-label">Rate:</span>
              ${[1,2,3,4,5].map(i => `<span class="detail-star ${i <= rating ? 'filled' : ''}" data-val="${i}">★</span>`).join('')}
            </div>
          </div>

          <div id="detail-description" class="book-description">
            <span class="text-muted" style="color:var(--text-muted);font-style:italic">Loading description…</span>
          </div>
        </div>
      </div>
    </div>
    <div class="detail-tabs-section">
      <div class="tabs">
        <button class="tab-btn active" data-tab="overview">Overview</button>
      </div>
      <div id="tab-overview"></div>
    </div>
  `;

  bindDetailActions(book);
  fetchAndRenderDescription(book.key);
}

function bindDetailActions(book) {
  // Read button
  document.getElementById('detail-read-btn')?.addEventListener('click', () => {
    toggleRead(book.key, book.title, book.author, book.coverId, book.year);
    const isRead = !!state.readBooks[book.key];
    const btn = document.getElementById('detail-read-btn');
    const statusEl = document.getElementById('detail-status');
    if (btn) {
      btn.className = `detail-action-btn ${isRead ? 'active-read' : ''}`;
      btn.innerHTML = `<span>${isRead ? '✓' : '+'}</span> ${isRead ? 'Read' : 'Mark as Read'}`;
    }
    if (statusEl) statusEl.textContent = isRead ? '✓ Read' : '— Not read';
  });

  // Fav button
  document.getElementById('detail-fav-btn')?.addEventListener('click', () => {
    toggleFavorite(book);
    const isFav = state.favorites.some(f => f.key === book.key);
    const btn = document.getElementById('detail-fav-btn');
    if (btn) {
      btn.className = `detail-action-btn ${isFav ? 'active-fav' : ''}`;
      btn.innerHTML = `<span>♥</span> ${isFav ? 'Favorited' : 'Add to Favorites'}`;
    }
  });

  // Stars
  const stars = document.querySelectorAll('.detail-star');
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      stars.forEach((s, i) => s.classList.toggle('hover-fill', i < val));
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hover-fill'));
    });
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      const current = state.ratings[book.key] || 0;
      const newRating = current === val ? 0 : val;
      state.ratings[book.key] = newRating;
      save();
      stars.forEach((s, i) => s.classList.toggle('filled', i < newRating));
      showToast(newRating ? `Rated "${book.title}" ${newRating}★` : `Removed rating`, 'info');
    });
  });
}

async function fetchAndRenderDescription(key) {
  try {
    const data = await fetchBookDetails(key);
    let desc = '';
    if (typeof data.description === 'string') desc = data.description;
    else if (data.description?.value) desc = data.description.value;

    // Clean up
    desc = desc.replace(/\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').trim();

    const el = document.getElementById('detail-description');
    if (!el) return;

    if (!desc) {
      el.innerHTML = `<span style="color:var(--text-muted);font-style:italic">No description available.</span>`;
      return;
    }

    el.classList.add('collapsed');
    el.textContent = desc;

    const btn = document.createElement('button');
    btn.className = 'read-more-btn';
    btn.textContent = 'Show more';
    btn.onclick = () => {
      const collapsed = el.classList.toggle('collapsed');
      btn.textContent = collapsed ? 'Show more' : 'Show less';
    };
    el.after(btn);
  } catch (e) {
    const el = document.getElementById('detail-description');
    if (el) el.innerHTML = `<span style="color:var(--text-muted);font-style:italic">No description available.</span>`;
  }
}

// ─── SEARCH PAGE ───────────────────────────────────────────────────────────
async function doSearch(query) {
  if (!query.trim()) return;
  state.searchQuery = query;
  document.getElementById('search-results-info').textContent = 'Searching…';
  renderSkeletons('search-results-grid', 12);

  try {
    const results = await searchBooks(query, 24);
    state.searchResults = results;
    document.getElementById('search-results-info').textContent =
      `${results.length} results for "${query}"`;
    renderBookGrid('search-results-grid', results);
  } catch (e) {
    document.getElementById('search-results-info').textContent = 'Search failed. Try again.';
    document.getElementById('search-results-grid').innerHTML = '';
    showToast('Search failed', 'error');
  }
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────
function loadProfilePage() {
  // Update stats
  const readCount = Object.keys(state.readBooks).length;
  const ratedCount = Object.keys(state.ratings).filter(k => state.ratings[k] > 0).length;
  const favCount = state.favorites.length;

  document.getElementById('stat-read').textContent = readCount;
  document.getElementById('stat-rated').textContent = ratedCount;
  document.getElementById('stat-favs').textContent = favCount;
  document.getElementById('profile-username').textContent = state.username;
  document.getElementById('profile-avatar-letter').textContent = state.username[0].toUpperCase();

  renderFavorites();
  renderReadList();
}

function renderFavorites() {
  const grid = document.getElementById('favorites-grid');
  if (!grid) return;

  const slots = [0, 1, 2, 3];
  grid.innerHTML = slots.map(i => {
    const fav = state.favorites[i];
    if (fav) {
      const cover = coverUrl(fav.coverId, 'M');
      return `
        <div class="fav-slot filled" data-slot="${i}">
          ${cover
            ? `<img src="${cover}" alt="${escHtml(fav.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="fav-slot-placeholder" ${cover ? 'style="display:none"' : ''}>
            <span>${escHtml(fav.title)}</span>
          </div>
          <div class="fav-slot-overlay">
            <button onclick="removeFavorite(${i})">Remove</button>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="fav-slot" data-slot="${i}" onclick="navigate('search')">
          <div class="fav-slot-empty">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            <span>Add a favorite</span>
          </div>
        </div>
      `;
    }
  }).join('');
}

function removeFavorite(index) {
  state.favorites.splice(index, 1);
  save();
  renderFavorites();
  showToast('Removed from favorites');
}

function renderReadList() {
  const el = document.getElementById('read-books-list');
  if (!el) return;

  const keys = Object.keys(state.readBooks);
  if (!keys.length) {
    el.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M4 19V6a2 2 0 012-2h12a2 2 0 012 2v13" stroke="currentColor" stroke-width="1.5"/><path d="M4 19h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <h3>No books read yet</h3>
        <p>Search for a book and mark it as read</p>
      </div>
    `;
    return;
  }

  el.innerHTML = keys.map(key => {
    const b = state.readBooks[key];
    const rating = state.ratings[key] || 0;
    const cover = coverUrl(b.coverId);
    const starsHtml = [1,2,3,4,5].map(i => `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`).join('');
    return `
      <div class="book-list-item" onclick="openBook(${JSON.stringify(b).replace(/"/g, '&quot;')})">
        ${cover
          ? `<img class="book-list-cover" src="${cover}" alt="${escHtml(b.title)}" onerror="this.style.display='none'">`
          : `<div class="book-list-cover-placeholder"><svg width="16" height="22" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/></svg></div>`}
        <div class="book-list-info">
          <div class="book-list-title">${escHtml(b.title)}</div>
          <div class="book-list-author">${escHtml(b.author)}</div>
          ${b.dateRead ? `<div class="date-read">Read ${b.dateRead}</div>` : ''}
        </div>
        <div class="book-list-rating">${starsHtml}</div>
      </div>
    `;
  }).join('');
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────
function toggleRead(key, title, author, coverId, year) {
  if (state.readBooks[key]) {
    delete state.readBooks[key];
    showToast(`Removed "${title}" from read list`);
  } else {
    const now = new Date();
    const dateRead = now.toLocaleDateString('en-NL', { month: 'short', year: 'numeric' });
    state.readBooks[key] = { key, title, author, coverId, year, dateRead };
    showToast(`Marked "${title}" as read ✓`, 'success');
  }
  save();
}

function toggleFavorite(book) {
  const idx = state.favorites.findIndex(f => f.key === book.key);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    showToast(`Removed from favorites`);
  } else {
    if (state.favorites.length >= 4) {
      showToast('You can only have 4 favorites. Remove one first.', 'error');
      return;
    }
    state.favorites.push({
      key: book.key,
      title: book.title,
      author: book.author,
      coverId: book.coverId,
    });
    showToast(`Added "${book.title}" to favorites ♥`);
  }
  save();
}

function findBookByKey(key) {
  return [...state.popularBooks, ...state.classicsBooks, ...state.recentBooks, ...state.searchResults]
    .find(b => b.key === key);
}

// ─── RATING MODAL ────────────────────────────────────────────────────────
function openRatingModal(book) {
  state.pendingRatingBook = book;
  document.getElementById('modal-book-title').textContent = book.title;
  const current = state.ratings[book.key] || 0;
  document.querySelectorAll('.modal-star').forEach(s => {
    s.classList.toggle('filled', parseInt(s.dataset.val) <= current);
  });
  document.getElementById('rating-modal').classList.add('open');
}

function closeRatingModal() {
  document.getElementById('rating-modal').classList.remove('open');
  state.pendingRatingBook = null;
}

function saveRating(val) {
  const book = state.pendingRatingBook;
  if (!book) return;
  const current = state.ratings[book.key] || 0;
  state.ratings[book.key] = current === val ? 0 : val;
  save();
  closeRatingModal();
  showToast(state.ratings[book.key] ? `Rated ${state.ratings[book.key]}★` : 'Rating removed');
}

// ─── TOAST ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── UTILS ────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav links
  document.querySelectorAll('nav a[data-page]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); });
  });

  // Logo
  document.getElementById('logo-link')?.addEventListener('click', e => {
    e.preventDefault(); navigate('home');
  });

  // Profile link
  document.getElementById('profile-nav-link')?.addEventListener('click', e => {
    e.preventDefault(); navigate('profile');
  });

  // Header search
  const headerSearch = document.getElementById('header-search');
  headerSearch?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && headerSearch.value.trim()) {
      navigate('search', { query: headerSearch.value.trim() });
    }
  });

  // Main search
  document.getElementById('search-btn')?.addEventListener('click', () => {
    const q = document.getElementById('main-search-input').value.trim();
    if (q) doSearch(q);
  });

  document.getElementById('main-search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) doSearch(q);
    }
  });

  // Genre filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const genre = chip.dataset.genre;
      document.getElementById('main-search-input').value = genre;
      doSearch(genre);
    });
  });

  // Hero CTA
  document.getElementById('hero-search-btn')?.addEventListener('click', () => {
    navigate('search');
    setTimeout(() => document.getElementById('main-search-input')?.focus(), 100);
  });

  document.getElementById('hero-profile-btn')?.addEventListener('click', () => navigate('profile'));

  // Rating modal stars
  document.querySelectorAll('.modal-star').forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      document.querySelectorAll('.modal-star').forEach((s, i) => {
        s.classList.toggle('hover-fill', i < val);
      });
    });
    star.addEventListener('mouseleave', () => {
      document.querySelectorAll('.modal-star').forEach(s => s.classList.remove('hover-fill'));
      // Re-apply current filled state
      const book = state.pendingRatingBook;
      if (book) {
        const cur = state.ratings[book.key] || 0;
        document.querySelectorAll('.modal-star').forEach(s => {
          s.classList.toggle('filled', parseInt(s.dataset.val) <= cur);
        });
      }
    });
    star.addEventListener('click', () => saveRating(parseInt(star.dataset.val)));
  });

  document.getElementById('modal-cancel')?.addEventListener('click', closeRatingModal);
  document.getElementById('rating-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRatingModal();
  });

  // Username editing
  document.getElementById('edit-username-btn')?.addEventListener('click', () => {
    const form = document.getElementById('edit-name-form');
    const input = document.getElementById('username-input');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    if (input) { input.value = state.username; input.focus(); }
  });

  document.getElementById('save-username-btn')?.addEventListener('click', () => {
    const val = document.getElementById('username-input').value.trim();
    if (val) {
      state.username = val;
      save();
      document.getElementById('profile-username').textContent = val;
      document.getElementById('profile-avatar-letter').textContent = val[0].toUpperCase();
      document.getElementById('profile-avatar-small').textContent = val[0].toUpperCase();
      document.getElementById('edit-name-form').style.display = 'none';
      showToast('Username updated!');
    }
  });

  // Update header avatar
  document.getElementById('profile-avatar-small').textContent = state.username[0].toUpperCase();

  // Start on home
  navigate('home');
});
