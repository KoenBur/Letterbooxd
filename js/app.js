// ─── SUPABASE ───────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ycejifwmvlpjewbsbrub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZWppZndtdmxwamV3YnNicnViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjU4MDksImV4cCI6MjA5MTQwMTgwOX0.wCbsCkjSoSgEBniitnMVmhdiCnTxg94xnzD6K6VUUOA';

let sb = null;
try {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient)
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) { }

// A Supabase error is returned as data unless explicitly checked.
async function queryResult(request) {
  const result = await request;
  if (result.error) throw result.error;
  return result;
}

async function saveMutation(request) {
  try { await request; return true; }
  catch (error) {
    showToast(error.message || 'Could not save. Please try again.', 'error');
    return false;
  }
}

let modalTrigger = null;
function openModal(modalId, focusSelector) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  modalTrigger = document.activeElement;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  const target = focusSelector ? overlay.querySelector(focusSelector) : overlay.querySelector('button, input, textarea, [tabindex]:not([tabindex="-1"])');
  setTimeout(() => target?.focus(), 0);
}

function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  const trigger = modalTrigger;
  modalTrigger = null;
  trigger?.focus?.();
}

function trapModalFocus(event) {
  const overlay = document.querySelector('.modal-overlay.open');
  if (!overlay) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (overlay.id === 'auth-modal') closeAuthModal();
    else if (overlay.id === 'rating-modal') closeRatingModal();
    else if (overlay.id === 'create-list-modal') closeCreateListModal();
    else if (overlay.id === 'confirm-modal') closeModal('confirm-modal');
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.closest('[aria-hidden="true"]'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

// Prevent a second click from starting the same save before the first finishes.
const pendingBookMutations = new Set();
async function runBookMutation(key, action) {
  if (pendingBookMutations.has(key)) return false;
  pendingBookMutations.add(key);
  try { return await action(); }
  finally { pendingBookMutations.delete(key); }
}

// ─── STATE ──────────────────────────────────────────────────────────────
const state = {
  user: null,           // supabase user object
  username: 'Reader',
  readBooks: {},
  ratings: {},
  favorites: [],
  wishlist: {},
  currentPage: 'home',
  currentBook: null,
  searchResults: [],
  popularBooks: [],
  classicsBooks: [],
  fictionBooks: [],
  pendingRatingBook: null,
  isAdmin: false,
  bio: '',
  avatarUrl: '',
  wishlistIsPublic: true,
  blindDate: null,
};

// ─── AUTH ────────────────────────────────────────────────────────────────
function loadLocalGuestData() {
  state.username = localStorage.getItem('lbx_username') || 'Reader';
  state.readBooks = JSON.parse(localStorage.getItem('lbx_read') || '{}');
  state.ratings = JSON.parse(localStorage.getItem('lbx_ratings') || '{}');
  state.favorites = JSON.parse(localStorage.getItem('lbx_favorites') || '[]');
  state.wishlist = JSON.parse(localStorage.getItem('lbx_wishlist') || '{}');
}

async function initAuth() {
  if (!sb) {
    // Offline mode — load from localStorage
    loadLocalGuestData();
    updateAuthUI();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    state.user = session.user;
    await loadUserData();
  } else {
    // Not logged in — load from localStorage as fallback
    loadLocalGuestData();
  }
  updateAuthUI();

  // Listen for auth state changes (login, logout, token refresh)
  sb.auth.onAuthStateChange(async (event, session) => {
    const wasLoggedIn = !!state.user;
    state.user = session?.user || null;
    if (state.user && !wasLoggedIn) {
      await loadUserData();
    }
    if (!state.user) {
      state.readBooks = {};
      state.ratings = {};
      state.favorites = [];
      state.wishlist = {};
      state.username = 'Reader';
      state.avatarUrl = '';
    }
    updateAuthUI();
    // Re-render current page
    if (state.currentPage === 'profile' && state.user) loadProfilePage();
  });
}

function updateAuthUI() {
  const loggedIn = !!state.user;
  const hasSupabase = !!sb;
  const loginBtn = document.getElementById('header-login-btn');
  const signupBtn = document.getElementById('header-signup-btn');
  const profileLink = document.getElementById('profile-nav-link');
  const logoutBtn = document.getElementById('header-logout-btn');
  const heroSearchBtn = document.getElementById('hero-search-btn');
  const heroProfileBtn = document.getElementById('hero-profile-btn');
  // hero-explore-btn is always visible — not toggled by auth state

  if (!hasSupabase) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (profileLink) profileLink.style.display = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (heroSearchBtn) heroSearchBtn.style.display = 'none';
    if (heroProfileBtn) heroProfileBtn.style.display = '';
  } else {
    if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : '';
    if (signupBtn) signupBtn.style.display = loggedIn ? 'none' : '';
    if (profileLink) profileLink.style.display = loggedIn ? '' : 'none';
    if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
    if (heroSearchBtn) heroSearchBtn.style.display = loggedIn ? 'none' : '';
    if (heroProfileBtn) heroProfileBtn.style.display = loggedIn ? '' : 'none';
  }

  const avatarSmall = document.getElementById('profile-avatar-small');
  if (avatarSmall) avatarSmall.textContent = state.username[0]?.toUpperCase() || 'R';

  if (state.currentPage === 'home') renderHomepagePersonal();
}

async function signUp(email, password, username) {
  if (!sb) throw new Error('Auth is not available. Please try again later.');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { username: username || 'Reader' },
      emailRedirectTo: 'https://letterbooxd.com',
    }
  });
  if (error) throw error;

  // Migrate any existing localStorage data after signup
  migrateLocalData(data.user?.id);

  return data;
}

async function logIn(email, password) {
  if (!sb) throw new Error('Auth is not available. Please try again later.');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function logOut() {
  if (sb) await sb.auth.signOut();
  state.user = null;
  state.readBooks = {};
  state.ratings = {};
  state.favorites = [];
  state.wishlist = {};
  state.username = 'Reader';
  state.avatarUrl = '';
  updateAuthUI();
  navigate('home');
  showToast('Logged out', 'info');
}

// Migrate localStorage data to Supabase for first-time signups
async function migrateLocalData(userId) {
  if (!userId) return;
  try {
    const oldRead = JSON.parse(localStorage.getItem('lbx_read') || '{}');
    const oldRatings = JSON.parse(localStorage.getItem('lbx_ratings') || '{}');
    const oldFavs = JSON.parse(localStorage.getItem('lbx_favorites') || '[]');

    const readEntries = Object.values(oldRead).filter(b => b && b.key);
    if (readEntries.length) {
      await queryResult(sb.from('read_books').upsert(
        readEntries.map(b => ({
          user_id: userId, book_key: b.key, title: b.title,
          author: b.author, cover_url: b.coverUrl, year: b.year, date_read: b.dateRead,
        })),
        { onConflict: 'user_id,book_key' }
      ));
    }

    const ratingEntries = Object.entries(oldRatings).filter(([k, v]) => v > 0);
    if (ratingEntries.length) {
      await queryResult(sb.from('ratings').upsert(
        ratingEntries.map(([key, rating]) => ({
          user_id: userId, book_key: key, rating,
        })),
        { onConflict: 'user_id,book_key' }
      ));
    }

    if (oldFavs.length) {
      await queryResult(sb.from('favorites').upsert(
        oldFavs.map((f, i) => ({
          user_id: userId, book_key: f.key, title: f.title,
          author: f.author, cover_url: f.coverUrl, position: i,
        })),
        { onConflict: 'user_id,book_key' }
      ));
    }
  } catch (e) { }
}

// ─── DATA LAYER ─────────────────────────────────────────────────────────
async function loadUserData() {
  if (!state.user) return;
  const uid = state.user.id;

  // Check admin status from profile
  state.isAdmin = false;

  // Load profile
  const { data: profile } = await queryResult(sb
    .from('profiles').select('username, is_admin, bio, avatar_url, wishlist_is_public').eq('id', uid).single());
  state.username = profile?.username || state.user.user_metadata?.username || 'Reader';
  state.isAdmin = !!profile?.is_admin;
  state.bio = profile?.bio || '';
  state.avatarUrl = profile?.avatar_url || '';
  state.wishlistIsPublic = profile?.wishlist_is_public !== false;

  const [readsResult, ratingsResult, favoritesResult, wishlistResult] = await Promise.allSettled([
    queryResult(sb.from('read_books').select('book_key, title, author, cover_url, year, date_read').eq('user_id', uid)),
    queryResult(sb.from('ratings').select('book_key, rating').eq('user_id', uid)),
    queryResult(sb.from('favorites').select('book_key, title, author, cover_url, position').eq('user_id', uid).order('position')),
    queryResult(sb.from('wishlist').select('book_key, title, author, cover_url, year, date_added').eq('user_id', uid)),
  ]);
  const reads = readsResult.status === 'fulfilled' ? readsResult.value.data : [];
  const rats = ratingsResult.status === 'fulfilled' ? ratingsResult.value.data : [];
  const favs = favoritesResult.status === 'fulfilled' ? favoritesResult.value.data : [];
  const wish = wishlistResult.status === 'fulfilled' ? wishlistResult.value.data : [];
  if ([readsResult, ratingsResult, favoritesResult, wishlistResult].some(result => result.status === 'rejected')) {
    showToast('Some library data could not be refreshed. Please try again.', 'error');
  }

  // Load read books
  state.readBooks = {};
  (reads || []).forEach(r => {
    state.readBooks[r.book_key] = {
      key: r.book_key, title: r.title, author: r.author,
      coverUrl: r.cover_url, year: r.year, dateRead: r.date_read,
    };
  });

  state.ratings = {};
  (rats || []).forEach(r => { state.ratings[r.book_key] = r.rating; });

  state.favorites = (favs || []).map(f => ({
    key: f.book_key, title: f.title, author: f.author, coverUrl: f.cover_url,
  }));

  // Load wishlist (read later)
  state.wishlist = {};
  (wish || []).forEach(w => {
    state.wishlist[w.book_key] = {
      key: w.book_key, title: w.title, author: w.author,
      coverUrl: w.cover_url, year: w.year, dateAdded: w.date_added,
    };
  });
}

// Persist guest data locally. Signed-in actions save through Supabase.
async function saveLocalGuestData() {
  if (state.user) {
    // Supabase saves happen in individual toggle/action functions
    return;
  }
  // Fallback for non-logged-in browsing (data won't persist across devices)
  localStorage.setItem('lbx_read', JSON.stringify(state.readBooks));
  localStorage.setItem('lbx_ratings', JSON.stringify(state.ratings));
  localStorage.setItem('lbx_favorites', JSON.stringify(state.favorites));
  localStorage.setItem('lbx_username', state.username);
  localStorage.setItem('lbx_wishlist', JSON.stringify(state.wishlist));
}

function requireAuth(actionName) {
  // If supabase isn't available, allow localStorage-based usage
  if (!sb) return true;
  if (state.user) return true;
  showToast(`Log in to ${actionName}`, 'info');
  openAuthModal('login');
  return false;
}

// ─── LISTS DATA (loaded from Supabase) ──────────────────────────────────
// Lists are stored in Supabase tables: lists + list_books
// Curated lists have is_curated=true and user_id=NULL
// User lists have is_curated=false and user_id set
const listsCache = {}; // keyed by list id
let listsCacheLoadedAt = 0;
let listsCacheRequest = null;

async function loadAllLists() {
  if (Date.now() - listsCacheLoadedAt < 60_000 && Object.keys(listsCache).length) return listsCache;
  if (listsCacheRequest) return listsCacheRequest;
  listsCacheRequest = loadAllListsFromServer().finally(() => { listsCacheRequest = null; });
  return listsCacheRequest;
}

async function loadAllListsFromServer() {
  if (!sb) return {};
  try {
    // Load all lists with their books in one query using a join
    const { data: lists } = await queryResult(sb
      .from('lists')
      .select('*, list_books(id, title, author, position)')
      .order('is_curated', { ascending: false })
      .order('created_at', { ascending: true }));
    // Refresh cached entries from the returned lists
    for (const list of (lists || [])) {
      const books = (list.list_books || [])
        .sort((a, b) => a.position - b.position)
        .map(b => ({
          title: b.title,
          author: b.author,
        }));
      listsCache[list.id] = {
        id: list.id,
        title: list.title,
        source: list.source || '',
        year: list.year || '',
        desc: list.description || '',
        is_curated: list.is_curated,
        user_id: list.user_id,
        books,
      };
    }
    listsCacheLoadedAt = Date.now();
    return listsCache;
  } catch (e) {
    throw new Error('Lists could not be loaded.');
  }
}

async function loadListBooks(listId) {
  if (!sb) return [];
  if (listsCache[listId]?.books?.length) return listsCache[listId].books;
  try {
    const { data } = await queryResult(sb
      .from('list_books')
      .select('title, author, position')
      .eq('list_id', listId)
      .order('position'));
    const books = (data || []).map(b => ({ title: b.title, author: b.author }));
    if (listsCache[listId]) listsCache[listId].books = books;
    return books;
  } catch (e) {
    return [];
  }
}

async function createUserList(title, description, books) {
  if (!sb || !state.user) throw new Error('Must be logged in');
  const id = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await queryResult(sb.from('lists').insert({
    id,
    user_id: state.user.id,
    title,
    source: state.username,
    year: new Date().getFullYear().toString(),
    description,
    is_curated: false,
  }));

  if (books.length) {
    const rows = books.map((b, i) => ({
      list_id: id,
      title: b.title,
      author: b.author,
      position: i,
    }));
    await queryResult(sb.from('list_books').insert(rows));
  }

  // Update cache
  listsCache[id] = {
    id,
    title,
    source: state.username,
    year: new Date().getFullYear().toString(),
    desc: description,
    is_curated: false,
    user_id: state.user.id,
    books,
  };
  listsCacheLoadedAt = Date.now();

  return id;
}

async function deleteUserList(listId) {
  if (!sb || !state.user) return;
  const list = listsCache[listId];
  if (!list || list.is_curated || list.user_id !== state.user.id) return;
  if (!await saveMutation(queryResult(sb.from('lists').delete().eq('id', listId)))) return false;
  delete listsCache[listId];
  listsCacheLoadedAt = Date.now();
  return true;
}

// Get a list by ID — tries cache (Supabase) first, falls back to offline data
function getListData(listId) {
  if (listsCache[listId] && listsCache[listId].books?.length) return listsCache[listId];
  if (CURATED_LISTS_OFFLINE[listId]) {
    const off = CURATED_LISTS_OFFLINE[listId];
    return { id: listId, title: off.title, source: off.source, year: off.year, desc: off.desc, is_curated: true, books: off.books };
  }
  return listsCache[listId] || null;
}

// ─── ROUTER ──────────────────────────────────────────────────────────────
function navigate(page, params = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  state._prevPage = state.currentPage;
  state.currentPage = page;
  window.scrollTo(0, 0);

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`nav a[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  if (page === 'home') {
    loadHomePage();
  } else if (page === 'search') {
    if (params.genre) {
      document.getElementById('main-search-input').value = params.genre;
      doGenreSearch(params.genre);
    } else if (params.query) {
      document.getElementById('main-search-input').value = params.query;
      doSearch(params.query);
    }
  } else if (page === 'book') {
    loadBookDetail(params.book || state.currentBook);
  } else if (page === 'list-detail') {
    loadListDetail(params.listId);
  } else if (page === 'profile') {
    loadProfilePage();
  } else if (page === 'collection') {
    // loadCollectionPage renders content after this navigation
  } else if (page === 'user') {
    loadUserProfile(params.userId).catch(error => showToast(error.message || "Could not load this profile.", "error"));
  } else if (page === 'wishlist') {
    loadWishlistPage();
  } else if (page === 'lists') {
    loadListsPreviews();
  } else if (page === 'blind-date') {
    loadBlindDatePage();
  }

  if (!params.fromHistory && page !== 'book') {
    const route = new URLSearchParams({ page });
    ['listId', 'userId', 'query', 'genre'].forEach(key => {
      if (params[key]) route.set(key, params[key]);
    });
    const hash = `#${route.toString()}`;
    if (location.hash !== hash) history.pushState({ page, params }, '', hash);
  }
}

function routeFromLocation() {
  const route = new URLSearchParams(location.hash.slice(1));
  const page = route.get('page');
  const allowedPages = new Set(['home', 'search', 'lists', 'list-detail', 'profile', 'user', 'wishlist', 'blind-date']);
  if (!allowedPages.has(page)) return { page: 'home', params: {} };
  return {
    page,
    params: {
      listId: route.get('listId') || undefined,
      userId: route.get('userId') || undefined,
      query: route.get('query') || undefined,
      genre: route.get('genre') || undefined,
      fromHistory: true,
    },
  };
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────
let homeLoaded = false;

// Curated shelves — hand-picked titles with reliable, great-looking covers
const SHELF_POPULAR = [
  { title: 'The Hunger Games', author: 'Collins' },
  { title: 'Gone Girl', author: 'Flynn' },
  { title: 'The Girl with the Dragon Tattoo', author: 'Larsson' },
  { title: 'The Da Vinci Code', author: 'Brown' },
  { title: 'Harry Potter and the Philosophers Stone', author: 'Rowling' },
  { title: 'The Fault in Our Stars', author: 'Green' },
  { title: 'Educated', author: 'Westover' },
  { title: 'Sapiens', author: 'Harari' },
  { title: 'Atomic Habits', author: 'Clear' },
  { title: 'The Alchemist', author: 'Coelho' },
  { title: 'Dune', author: 'Herbert' },
  { title: 'The Hobbit', author: 'Tolkien' },
  { title: 'A Little Life', author: 'Yanagihara' },
  { title: 'Normal People', author: 'Rooney' },
  { title: 'The Thursday Murder Club', author: 'Osman' },
  { title: 'Tomorrow and Tomorrow and Tomorrow', author: 'Zevin' },
];

const SHELF_CLASSICS = [
  { title: 'To Kill a Mockingbird', author: 'Lee' },
  { title: '1984', author: 'Orwell' },
  { title: 'The Great Gatsby', author: 'Fitzgerald' },
  { title: 'One Hundred Years of Solitude', author: 'Marquez' },
  { title: 'Crime and Punishment', author: 'Dostoevsky' },
  { title: 'Brave New World', author: 'Huxley' },
  { title: 'Anna Karenina', author: 'Tolstoy' },
  { title: 'Moby Dick', author: 'Melville' },
  { title: 'The Catcher in the Rye', author: 'Salinger' },
  { title: 'Middlemarch', author: 'Eliot' },
  { title: 'Pride and Prejudice', author: 'Austen' },
  { title: 'Jane Eyre', author: 'Bronte' },
  { title: 'Wuthering Heights', author: 'Bronte' },
  { title: 'Ulysses', author: 'Joyce' },
  { title: 'Don Quixote', author: 'Cervantes' },
  { title: 'The Brothers Karamazov', author: 'Dostoevsky' },
];

const SHELF_FICTION = [
  { title: 'Dune', author: 'Herbert' },
  { title: 'The Hitchhikers Guide to the Galaxy', author: 'Adams' },
  { title: 'Foundation', author: 'Asimov' },
  { title: 'Neuromancer', author: 'Gibson' },
  { title: 'The Left Hand of Darkness', author: 'Le Guin' },
  { title: 'Enders Game', author: 'Card' },
  { title: 'The Martian', author: 'Weir' },
  { title: 'Annihilation', author: 'VanderMeer' },
  { title: 'Project Hail Mary', author: 'Weir' },
  { title: 'The Road', author: 'McCarthy' },
  { title: 'Never Let Me Go', author: 'Ishiguro' },
  { title: 'Blindsight', author: 'Watts' },
  { title: 'A Canticle for Leibowitz', author: 'Miller' },
  { title: 'The Stars My Destination', author: 'Bester' },
  { title: 'Flowers for Algernon', author: 'Keyes' },
  { title: 'Slaughterhouse Five', author: 'Vonnegut' },
];

async function loadHomePage() {
  renderHomepagePersonal();
  if (homeLoaded) return;
  renderShelfSkeletons('popular-books-grid', 16);
  renderShelfSkeletons('classics-books-grid', 16);
  renderShelfSkeletons('fiction-books-grid', 16);

  try {
    const [popular, classics, fiction] = await Promise.all([
      getCuratedShelf(SHELF_POPULAR),
      getCuratedShelf(SHELF_CLASSICS),
      getCuratedShelf(SHELF_FICTION),
    ]);
    state.popularBooks = popular;
    state.classicsBooks = classics;
    state.fictionBooks = fiction;
    renderShelfBooks('popular-books-grid', popular);
    renderShelfBooks('classics-books-grid', classics);
    renderShelfBooks('fiction-books-grid', fiction);
    renderHeroFeature();
    homeLoaded = true;
  } catch (e) {
    showToast('Could not load books. Check your connection.', 'error');
  }
}

function renderHeroFeature() {
  const books = state.popularBooks;
  if (!books || !books.length) return;
  const feature = document.getElementById('hero-feature');
  if (!feature) return;

  const featuredBooks = books.filter(b => b.coverUrl).slice(0, 5);
  if (!featuredBooks.length) return;
  let activeIndex = 0;

  const renderFeature = (index, shouldAnimate = false) => {
    activeIndex = index;
    const book = featuredBooks[index];
    const image = coverUrl(book.coverUrl, 'L');
    const isRead = !!state.readBooks[book.key];
    const title = escHtml(book.title);
    const author = escHtml(book.author);

    feature.innerHTML = `
      <div class="hero-feature-label"><span>Currently circulating</span><span>${String(index + 1).padStart(2, '0')} / ${String(featuredBooks.length).padStart(2, '0')}</span></div>
      <div class="hero-feature-stage">
        <button class="hero-feature-cover" type="button" data-feature-open aria-label="Open ${title}">
          <img src="${image}" alt="Cover of ${title}" loading="eager">
        </button>
        <div class="hero-feature-copy">
          <div class="hero-feature-year">${book.year ? escHtml(String(book.year)) : 'Publication year unknown'}</div>
          <h2>${title}</h2>
          <p>by ${author}</p>
          <div class="hero-feature-actions">
            <button class="hero-feature-action primary" type="button" data-feature-open>Open book <span aria-hidden="true">↗</span></button>
            <button class="hero-feature-action" type="button" data-feature-read>${isRead ? '✓ In your log' : '+ Mark as read'}</button>
          </div>
        </div>
      </div>
      <div class="hero-feature-queue" aria-label="More recommendations">
        ${featuredBooks.map((candidate, candidateIndex) => `
          <button class="hero-queue-item ${candidateIndex === index ? 'active' : ''}" type="button" data-feature-index="${candidateIndex}" ${candidateIndex === index ? 'aria-current="true"' : ''}>
            <img src="${coverUrl(candidate.coverUrl, 'S')}" alt="" loading="lazy">
            <span><strong>${escHtml(candidate.title)}</strong><small>${escHtml(candidate.author)}</small></span>
            <b>${String(candidateIndex + 1).padStart(2, '0')}</b>
          </button>
        `).join('')}
      </div>
    `;

    if (shouldAnimate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const stage = feature.querySelector('.hero-feature-stage');
      stage?.animate([
        { opacity: .55, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 160, easing: 'cubic-bezier(.23, 1, .32, 1)' });
    }
  };

  feature.addEventListener('click', async event => {
    const queueItem = event.target.closest('[data-feature-index]');
    if (queueItem) {
      const nextIndex = Number(queueItem.dataset.featureIndex);
      if (nextIndex !== activeIndex) renderFeature(nextIndex, event.detail !== 0);
      return;
    }

    const book = featuredBooks[activeIndex];
    if (event.target.closest('[data-feature-open]')) {
      openBook(book);
      return;
    }

    if (event.target.closest('[data-feature-read]')) {
      await toggleRead(book.key, book.title, book.author, book.coverUrl, book.year);
      renderFeature(activeIndex, false);
    }
  });

  renderFeature(0, false);
}

// ── Homepage personal sections ─────────────────────────────
function computeMonthlyReads() {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { y: d.getFullYear(), m: d.getMonth(), count: 0 };
  });
  Object.values(state.readBooks).forEach(b => {
    if (!b?.dateRead) return;
    const d = new Date(b.dateRead);
    const slot = months.find(m => m.y === d.getFullYear() && m.m === d.getMonth());
    if (slot) slot.count++;
  });
  return months.map(m => m.count);
}

function sparklineSVG(data) {
  const W = 100, H = 36;
  if (!data?.length || data.every(v => v === 0)) {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><line x1="2" y1="${H / 2}" x2="${W - 2}" y2="${H / 2}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.4"/></svg>`;
  }
  const max = Math.max(...data, 1);
  const n = data.length;
  const pts = data.map((v, i) => [
    (i / (n - 1)) * (W - 6) + 3,
    (1 - v / max) * (H - 10) + 5
  ]);
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
    d += ` C ${cpx.toFixed(1)} ${pts[i - 1][1].toFixed(1)}, ${cpx.toFixed(1)} ${pts[i][1].toFixed(1)}, ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  const last = pts[pts.length - 1], first = pts[0];
  const fill = `${d} L ${last[0].toFixed(1)} ${H} L ${first[0].toFixed(1)} ${H} Z`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
    <path d="${fill}" fill="rgba(232,160,48,0.14)"/>
    <path d="${d}" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function renderContinueReading() {
  const grid = document.getElementById('continue-reading-grid');
  if (!grid) return;
  const books = Object.values(state.readBooks)
    .filter(b => b?.title)
    .sort((a, b) => {
      if (!a.dateRead) return 1;
      if (!b.dateRead) return -1;
      return new Date(b.dateRead) - new Date(a.dateRead);
    })
    .slice(0, 3);

  const addSlotHTML = `<div class="continue-book-slot continue-book-add">
    <span class="continue-add-plus">+</span>
    <span class="continue-add-label">Add a book</span>
  </div>`;

  const bookSlots = books.map(book => {
    const url = coverUrl(book.coverUrl || book.cover_url, 'M');
    return `<div class="continue-book-slot" data-key="${escHtml(book.key || '')}">
      ${url
        ? `<img src="${url}" alt="${escHtml(book.title || '')}" loading="lazy">`
        : `<div class="continue-book-placeholder"><span>${escHtml(book.title || '')}</span></div>`}
    </div>`;
  });

  const total = 4;
  const addCount = Math.max(1, total - bookSlots.length);
  const all = [...bookSlots, ...Array(addCount).fill(addSlotHTML)].slice(0, total);
  grid.innerHTML = all.join('');

  grid.querySelectorAll('.continue-book-slot:not(.continue-book-add)').forEach(slot => {
    slot.addEventListener('click', async () => {
      const b = state.readBooks[slot.dataset.key];
      if (b) openBook(b);
    });
  });
  grid.querySelectorAll('.continue-book-add').forEach(btn => {
    btn.addEventListener('click', () => navigate('search'));
  });
}

async function renderYourListsHP() {
  const container = document.getElementById('your-lists-list');
  if (!container || !state.user || !sb) return;
  try {
    const { data } = await queryResult(sb.from('lists')
      .select('id, title, list_books(count)')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false })
      .limit(5));
    if (!data?.length) {
      container.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:4px 0">No lists yet. <button class="link-btn" id="hp-create-list-link">Create one →</button></div>`;
      document.getElementById('hp-create-list-link')?.addEventListener('click', () => navigate('lists'));
      return;
    }
    const listIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
    container.innerHTML = data.map(list => {
      const count = list.list_books?.[0]?.count ?? 0;
      return `<div class="your-list-item" data-list-id="${escHtml(list.id)}">
        <div class="your-list-badge">${listIcon}</div>
        <div class="your-list-info">
          <div class="your-list-title">${escHtml(list.title)}</div>
          <div class="your-list-count">${count} book${count !== 1 ? 's' : ''}</div>
        </div>
        <span class="your-list-arrow">›</span>
      </div>`;
    }).join('');
    container.querySelectorAll('.your-list-item').forEach(item => {
      item.addEventListener('click', () => navigate('list-detail', { listId: item.dataset.listId }));
    });
  } catch (e) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:13px">Could not load lists.</p>`;
  }
}

async function renderHomepagePersonal() {
  const sections = document.getElementById('homepage-personal-sections');
  if (!sections) return;
  if (!state.user) { sections.style.display = 'none'; return; }
  sections.style.display = 'block';

  // Books-read count
  const readCount = Object.keys(state.readBooks).length;
  const el = id => document.getElementById(id);
  if (el('hp-stat-books')) el('hp-stat-books').textContent = readCount;

  // Sparkline
  if (el('hp-sparkline')) el('hp-sparkline').innerHTML = sparklineSVG(computeMonthlyReads());

  // Average rating
  const ratings = Object.values(state.ratings || {}).filter(r => r > 0);
  const avgRating = ratings.length
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : '—';
  if (el('hp-stat-rating')) el('hp-stat-rating').textContent = avgRating;

  // Rating bars (1–5)
  if (el('hp-rating-bars')) {
    const counts = [1, 2, 3, 4, 5].map(r => ratings.filter(v => v === r).length);
    const maxC = Math.max(...counts, 1);
    el('hp-rating-bars').innerHTML = `<div class="rating-bars">${counts.map(c =>
      `<div class="rating-bar-wrap"><div class="rating-bar" style="height:${c > 0 ? Math.max(6, Math.round((c / maxC) * 40)) : 2}px;opacity:${c > 0 ? 0.9 : 0.18}"></div></div>`
    ).join('')}</div>`;
  }

  // Continue reading
  renderContinueReading();

  // Friends (async)
  try {
    const friends = await getFriends();
    if (el('hp-stat-friends')) el('hp-stat-friends').textContent = friends.length;
    if (el('hp-avatars')) {
      const first4 = friends.slice(0, 4);
      const rest = friends.length - 4;
      el('hp-avatars').innerHTML = `<div class="avatar-cluster">
        ${first4.map((f, i) =>
          `<div class="cluster-avatar" style="left:${i * 22}px" title="${escHtml(f.username || '')}">
            ${f.avatar_url
              ? `<img src="${escHtml(f.avatar_url)}" alt="" onerror="this.style.display='none'">`
              : `<span>${((f.username || '?')[0] || '?').toUpperCase()}</span>`}
          </div>`).join('')}
        ${rest > 0 ? `<div class="cluster-more" style="left:${first4.length * 22}px">+${rest}</div>` : ''}
        ${friends.length === 0 ? '<span style="font-size:11px;color:var(--text-muted)">No friends yet</span>' : ''}
      </div>`;
    }
  } catch (_) {}

  // Lists
  renderYourListsHP();
}

function renderShelfSkeletons(containerId, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({length: count}, () => `
    <div style="flex:0 0 auto;width:110px;margin-right:6px">
      <div class="skeleton skeleton-cover" style="width:110px"></div>
    </div>
  `).join('');
}

function renderShelfBooks(containerId, books) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = books.map(book => shelfBookHTML(book)).join('');
  // bind events
  el.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.overlay-btn')) return;
      const book = findBookByKey(card.dataset.key) || books.find(b => b.key === card.dataset.key);
      if (book) openBook(book);
    });
  });
  el.querySelectorAll('.overlay-btn.mark-read').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
      // update badge
      const card = el.querySelector(`.book-card[data-key="${CSS.escape(btn.dataset.key)}"]`);
      if (card) refreshCardBadge(card, btn.dataset.key);
    });
  });
  el.querySelectorAll('.overlay-btn.rate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const book = books.find(b => b.key === btn.dataset.key);
      if (book) openRatingModal(book);
    });
  });
}

function shelfBookHTML(book) {
  const isRead = !!state.readBooks[book.key];
  const cover = coverUrl(book.coverUrl);
  return `
    <div class="book-card" data-key="${escHtml(book.key)}">
      <div class="book-cover-wrap">
        ${cover
          ? `<img class="book-cover" src="${cover}" alt="${escHtml(book.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="book-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
          <svg width="20" height="28" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/><rect x="3" y="4" width="18" height="2" rx="1" fill="#67788a"/><rect x="3" y="9" width="14" height="2" rx="1" fill="#67788a"/></svg>
          <span class="placeholder-title">${escHtml(book.title)}</span>
        </div>
        <div class="book-overlay">
          <div class="overlay-actions">
            <button class="overlay-btn mark-read ${isRead ? 'read' : ''}"
              data-key="${escHtml(book.key)}" data-title="${escHtml(book.title)}"
              data-author="${escHtml(book.author)}" data-cover="${book.coverUrl || ''}"
              data-year="${book.year || ''}" title="${isRead ? 'Mark unread' : 'Mark as read'}">
              ${isRead ? '✓' : '📖'}
            </button>
            <button class="overlay-btn rate-btn" data-key="${escHtml(book.key)}" title="Rate">★</button>
          </div>
        </div>
        ${isRead ? '<div class="read-badge">✓</div>' : ''}
      </div>
      <div class="shelf-book-info">
        <div class="shelf-book-state">${isRead ? 'In your reading log' : 'Open book'}</div>
        <div class="shelf-book-title">${escHtml(book.title)}</div>
        <div class="shelf-book-author">${escHtml(book.author)}</div>
        <div class="shelf-book-foot">
          <span>${book.year ? escHtml(String(book.year)) : 'Year unknown'}</span>
          <span aria-hidden="true">↗</span>
        </div>
      </div>
    </div>
  `;
}

function refreshCardBadge(card, key) {
  const isRead = !!state.readBooks[key];
  const existing = card.querySelector('.read-badge');
  if (isRead && !existing) {
    const badge = document.createElement('div');
    badge.className = 'read-badge';
    badge.textContent = '✓';
    card.querySelector('.book-cover-wrap').appendChild(badge);
  } else if (!isRead && existing) {
    existing.remove();
  }
  const btn = card.querySelector('.overlay-btn.mark-read');
  if (btn) {
    btn.className = `overlay-btn mark-read ${isRead ? 'read' : ''}`;
    btn.textContent = isRead ? '✓' : '📖';
  }
}

// ─── SHELF ARROWS ─────────────────────────────────────────────────────────
function initShelfArrows() {
  document.querySelectorAll('.shelf-arrow-right').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.target;
      const track = document.getElementById(targetId)?.querySelector('.shelf-track');
      if (!track) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) {
        const listId = btn.dataset.list;
        if (listId) navigate('list-detail', { listId });
      } else {
        track.scrollBy({ left: 600, behavior: 'smooth' });
      }
    });
  });
}

// ─── LISTS PAGE ───────────────────────────────────────────────────────────
let listsPageLoaded = false;

async function loadListsPreviews() {
  const popularContainer = document.getElementById('lists-popular-container');
  const newContainer = document.getElementById('lists-new-container');
  const recsContainer = document.getElementById('lists-recs-container');
  const newSection = document.getElementById('lists-new-section');
  if (!popularContainer) return;

  if (!listsPageLoaded) {
    popularContainer.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">Loading lists…</div>`;
  }

  try {
    await loadAllLists();
  } catch (error) {
    popularContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--accent-red)">Lists could not be loaded. <button class="link-btn" id="retry-lists-btn">Try again</button></div>';
    popularContainer.querySelector('#retry-lists-btn')?.addEventListener('click', () => loadListsPreviews());
    return;
  }

  const allLists = Object.values(listsCache);
  const curated = allLists.filter(l => l.is_curated);
  const userLists = allLists.filter(l => !l.is_curated);

  // Popular lists = user lists sorted by book count (proxy for popularity)
  const popular = [...userLists].sort((a, b) => (b.books?.length || 0) - (a.books?.length || 0)).slice(0, 6);
  if (popular.length) {
    popularContainer.innerHTML = popular.map(l => listCardHTML(l)).join('');
  } else {
    popularContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No lists yet. Create the first one!</div>';
  }

  // Recently created = newest user lists
  const recent = [...userLists].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 6);
  if (recent.length && newSection && newContainer) {
    newSection.style.display = '';
    newContainer.innerHTML = recent.map(l => listCardHTML(l)).join('');
  }

  // Letterbooxd Recommendations = curated lists
  if (recsContainer) {
    const recsData = curated.length ? curated : CURATED_LIST_IDS.map(id => {
      const list = CURATED_LISTS_OFFLINE[id];
      return list ? { id, title: list.title, source: list.source, year: list.year, desc: list.desc, is_curated: true, books: list.books } : null;
    }).filter(Boolean);
    recsContainer.innerHTML = recsData.map(l => listCardHTML(l)).join('');
  }

  // Bind click events on all containers
  [popularContainer, newContainer, recsContainer].forEach(container => {
    if (!container) return;
    container.querySelectorAll('.list-card').forEach(card => {
      card.addEventListener('click', () => openList(card.dataset.listId));
    });
    container.querySelectorAll('.list-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this list?')) return;
        if (!await deleteUserList(btn.dataset.listId)) return;
        showToast('List deleted');
        listsPageLoaded = false;
        loadListsPreviews();
      });
    });
  });

  loadListPreviewCovers();
  listsPageLoaded = true;
}

function listCardHTML(list) {
  const bookCount = list.books?.length ?? '…';
  const isOwn = state.user && list.user_id === state.user.id;
  const previewCount = Array.isArray(list.books) ? Math.min(list.books.length, 5) : 5;
  const previewSlots = previewCount
    ? [...Array(previewCount).fill('<div class="list-placeholder-cover" aria-hidden="true"></div>'), ...Array(5 - previewCount).fill('<div class="list-preview-spacer" aria-hidden="true"></div>')].join('')
    : '<div class="list-preview-empty">Add a book to start this list</div>';
  return `
    <div class="list-card" data-list-id="${escHtml(list.id)}">
      <div class="list-card-books" id="${escHtml(list.id)}-preview">
        ${previewSlots}
      </div>
      <div class="list-card-info" style="position:relative">
        <div class="list-type-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </div>
        <div class="list-card-title">${escHtml(list.title)}</div>
        <div class="list-card-meta">${escHtml(list.source)} · ${bookCount} books${list.year ? ' · ' + escHtml(list.year) : ''}</div>
        <div class="list-card-desc">${escHtml(list.desc)}</div>
        ${isOwn ? `<button class="list-delete-btn btn btn-secondary btn-sm" data-list-id="${escHtml(list.id)}" style="margin-top:8px;font-size:11px;padding:3px 10px;color:#e74c3c;border-color:#e74c3c">Delete</button>` : ''}
      </div>
    </div>`;
}

async function renderListPreviewCovers(previewEl, books, showMissing = false) {
  const first5 = books.slice(0, 5);
  const results = await Promise.allSettled(
    first5.map(b => {
      if (b.coverUrl) return Promise.resolve({ coverUrl: b.coverUrl, title: b.title });
      return searchBooksForList(b.title, b.author);
    })
  );

  const slots = previewEl.querySelectorAll('.list-placeholder-cover');
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value && r.value.coverUrl) {
      const img = document.createElement('img');
      img.src = coverUrl(r.value.coverUrl, 'S');
      img.alt = first5[i].title;
      img.style.flex = '1';
      img.style.objectFit = 'cover';
      img.style.borderRight = '2px solid var(--bg-primary)';
      slots[i]?.replaceWith(img);
    } else if (showMissing && slots[i]) {
      slots[i].classList.add('is-missing');
      slots[i].textContent = first5[i].title;
      slots[i].title = first5[i].title;
    }
  });
}

async function loadListPreviewCovers() {
  const allLists = Object.values(listsCache).length ? Object.values(listsCache) : CURATED_LIST_IDS.map(id => ({id, ...(CURATED_LISTS_OFFLINE[id] || {})}));

  await Promise.all(allLists.map(async list => {
    const previewEl = document.getElementById(`${list.id}-preview`);
    if (!previewEl || previewEl.dataset.loaded) return;
    previewEl.dataset.loaded = '1';

    // Load books if not already loaded
    let books = list.books;
    if (!books?.length) {
      books = await loadListBooks(list.id);
    }
    if (!books?.length) return;

    await renderListPreviewCovers(previewEl, books, true);
  }));
}

function openList(listId) {
  navigate('list-detail', { listId });
}

async function loadListDetail(listId) {
  let list = getListData(listId);
  
  // If books not loaded yet, fetch them
  if (!list || !list.books?.length) {
    await loadListBooks(listId);
    list = getListData(listId);
    if (!list) {
      // Try offline fallback
      list = CURATED_LISTS_OFFLINE[listId];
      if (list) list = { id: listId, title: list.title, source: list.source, year: list.year, desc: list.desc, is_curated: true, books: list.books };
    }
  }
  if (!list) return;

  const readCount = list.books.filter(b =>
    Object.values(state.readBooks).some(rb => rb.title.toLowerCase() === b.title.toLowerCase())
  ).length;
  const pct = Math.round((readCount / list.books.length) * 100);

  document.getElementById('list-detail-content').innerHTML = `
    <div class="list-detail-header">
      <div class="list-detail-header-inner">
        <button class="list-detail-back" onclick="navigate('lists')">← Back to Lists</button>
        <div class="list-detail-title">${escHtml(list.title)}</div>
        <div class="list-detail-meta">${escHtml(list.source)} · ${list.books.length} books · ${escHtml(list.year)}</div>
        <p style="color:var(--text-muted);font-size:14px;max-width:600px;margin-top:10px;line-height:1.6">${escHtml(list.desc)}</p>
        <div class="list-progress-bar-wrap">
          <div class="list-progress-label">${readCount} of ${list.books.length} read (${pct}%)</div>
          <div class="list-progress-bar"><div class="list-progress-fill" style="width:${pct}%"></div></div>
        </div>
      </div>
    </div>
    <div style="max-width:1200px;margin:0 auto;padding:32px 20px 60px">
      <div id="list-detail-books" class="list-tile-grid">
        ${list.books.map((b, i) => {
          const isRead = Object.values(state.readBooks).some(rb => rb.title.toLowerCase() === b.title.toLowerCase());
          return `
          <div class="list-tile" data-idx="${i}" data-title="${escHtml(b.title)}" data-author="${escHtml(b.author)}">
            <div class="list-tile-cover" id="list-cover-${i}">
              <div class="list-tile-placeholder"><span class="list-tile-num">${i+1}</span></div>
            </div>
            <div class="list-tile-overlay">
              <button class="overlay-btn list-mark-read ${isRead ? 'read' : ''}" data-idx="${i}" title="Mark as read">${isRead ? '✓' : '📖'}</button>
            </div>
            ${isRead ? '<div class="read-badge" id="list-read-badge-' + i + '">✓</div>' : '<div id="list-read-badge-' + i + '"></div>'}
            <div class="list-tile-info">
              <div class="list-tile-title" title="${escHtml(b.title)}">${escHtml(b.title)}</div>
              <div class="list-tile-author">${escHtml(b.author)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  loadListCovers(list.books);
}

async function loadListCovers(books) {
  const cachedCovers = await getCachedCovers(books);
  const unresolved = [];

  books.forEach((book, idx) => {
    const cached = cachedCovers.get(cacheKey(book.title, book.author));
    if (cached) renderListCover(cached, idx);
    else unresolved.push({ book, idx });
  });

  const batchSize = 8;
  for (let start = 0; start < unresolved.length; start += batchSize) {
    const batch = unresolved.slice(start, start + batchSize);
    const results = await Promise.allSettled(
      batch.map(({ book }) => searchBooksForList(book.title, book.author))
    );
    results.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) renderListCover(r.value, batch[j].idx);
    });
  }
}

function renderListCover(book, idx) {
  const el = document.getElementById(`list-cover-${idx}`);
  if (!el) return;
  const tile = el.closest('.list-tile');
  if (tile) {
    tile._book = book;
    tile.addEventListener('click', async (e) => { if (!e.target.closest('.overlay-btn')) openBook(book); });
    tile.style.cursor = 'pointer';
  }
  if (book.coverUrl) {
    el.innerHTML = `<img src="${book.coverUrl}" alt="${escHtml(book.title)}" class="list-tile-cover-img" onerror="this.style.display='none';this.parentElement.querySelector('.list-tile-placeholder')?.style.display='flex'">
      <div class="list-tile-placeholder" style="display:none"><span class="list-tile-num">${idx+1}</span></div>`;
  }
  const readBtn = tile?.querySelector(`.list-mark-read[data-idx="${idx}"]`);
  if (!readBtn) return;
  const isRead = Object.values(state.readBooks).some(rb => rb.title.toLowerCase() === book.title.toLowerCase());
  if (isRead) { readBtn.textContent = '✓'; readBtn.classList.add('read'); }
  readBtn.onclick = async (e) => {
    e.stopPropagation();
    await toggleRead(book.key || book.title, book.title, book.author, book.coverUrl, book.year);
    const nowRead = !!state.readBooks[book.key || book.title];
    readBtn.textContent = nowRead ? '✓' : '📖';
    readBtn.classList.toggle('read', nowRead);
    const badge = document.getElementById(`list-read-badge-${idx}`);
    if (badge) badge.innerHTML = nowRead ? '<div class="read-badge" style="position:static;width:16px;height:16px;font-size:8px">✓</div>' : '';
  };
}

// ─── BOOK DETAIL ───────────────────────────────────────────────────────────
async function loadAndRenderEditions(olWorkId) {
  const section = document.getElementById('book-editions-section');
  const list = document.getElementById('book-editions-list');
  const heading = document.getElementById('editions-heading');
  if (!section || !list || !heading) return;

  try {
    const r = await fetch(`${OL}/works/${olWorkId}/editions.json?limit=10`);
    if (!r.ok) return;
    const data = await r.json();
    const editions = (data.entries || []).filter(e => e.publishers?.length || e.publish_date);
    if (!editions.length) return;

    section.style.display = '';
    const toggle = document.getElementById('editions-toggle');
    heading.addEventListener('click', async () => {
      const open = list.style.display !== 'none';
      list.style.display = open ? 'none' : '';
      if (toggle) toggle.textContent = open ? '▼ show' : '▲ hide';
    });

    list.innerHTML = editions.map(e => {
      const coverId = e.covers?.[0];
      const coverSrc = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-S.jpg` : null;
      const publisher = escHtml(e.publishers?.[0] || '');
      const year = escHtml(e.publish_date || '');
      const isbn = escHtml(e.isbn_13?.[0] || e.isbn_10?.[0] || '');
      return `<div class="edition-item">
        ${coverSrc ? `<img class="edition-cover" src="${escHtml(coverSrc)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="edition-cover-placeholder"></div>'}
        <div class="edition-info">
          ${publisher ? `<div class="edition-publisher">${publisher}</div>` : ''}
          ${year ? `<div class="edition-year">${year}</div>` : ''}
          ${isbn ? `<div class="edition-isbn">ISBN ${isbn}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch {}
}

async function openBook(book) {
  state.currentBook = book;
  navigate('book', { book });

  // Resolve to canonical OL Work ID in the background
  const resolved = await resolveToOLWork(book);
  if (resolved.key !== book.key && state.currentPage === 'book') {
    migrateBookKey(book.key, resolved.key);
    state.currentBook = resolved;
    loadBookDetail(resolved);
  }
}

async function loadBookDetail(book) {
  if (!book) return;
  const isRead = !!state.readBooks[book.key];
  const rating = state.ratings[book.key] || 0;
  const isFav = state.favorites.some(f => f.key === book.key);
  const isWish = !!state.wishlist[book.key];
  const cover = coverUrl(book.coverUrl, 'L');

  document.getElementById('book-detail-content').innerHTML = `
    <div class="book-detail-backdrop">
      <div class="detail-back-bar"><button class="back-btn" id="book-back-btn">← Back</button></div>
      <div class="book-detail-inner">
        <div class="book-detail-left">
          <div style="position:relative">
            ${cover ? `<img class="book-detail-cover" id="detail-cover-img" src="${cover}" alt="${escHtml(book.title)}" onerror="this.style.display='none';document.getElementById('detail-cover-placeholder').style.display='flex'">` : ''}
            <div class="book-detail-cover-placeholder" id="detail-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
              <svg width="48" height="64" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/></svg>
              <p>${escHtml(book.title)}</p>
            </div>
            ${state.isAdmin ? `
            <div class="admin-cover-actions" id="admin-cover-actions">
              <button class="btn btn-secondary btn-sm admin-btn" id="admin-find-covers" title="Find cover options from multiple sources">🔍 Find covers</button>
              <button class="btn btn-secondary btn-sm admin-btn" id="admin-custom-cover" title="Set a custom cover URL">🖼 Paste URL</button>
            </div>
            <div class="admin-cover-picker" id="admin-cover-picker" style="display:none"></div>` : ''}
          </div>
          ${book.year || book.pages || book.categories?.length ? `
          <div class="book-meta-cards">
            ${book.year ? `
            <div class="book-meta-card">
              <div class="meta-icon-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <div class="meta-card-label">First published</div>
                <div class="meta-card-value">${book.year}</div>
              </div>
            </div>` : ''}
            ${book.pages ? `
            <div class="book-meta-card">
              <div class="meta-icon-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
              </div>
              <div>
                <div class="meta-card-label">Pages</div>
                <div class="meta-card-value">${book.pages}</div>
              </div>
            </div>` : ''}
            ${book.categories?.length ? `
            <div class="book-meta-card">
              <div class="meta-icon-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                  <circle cx="7" cy="7" r="1.5" fill="white" stroke="none"/>
                </svg>
              </div>
              <div>
                <div class="meta-card-label">Genres</div>
                <div class="meta-card-value">${book.categories.slice(0,2).join(', ')}</div>
              </div>
            </div>` : ''}
          </div>` : ''}
        </div>
        <div class="book-detail-info">
          <h1 class="book-detail-title">${escHtml(book.title)}</h1>
          <div class="book-detail-author">by <a href="#" class="author-link" data-author="${escHtml(book.author)}">${escHtml(book.author)}</a></div>
          <div class="detail-actions">
            <button class="detail-action-btn ${isRead ? 'active-read' : ''}" id="detail-read-btn">
              <span>${isRead ? '✓' : '+'}</span> ${isRead ? 'Read' : 'Mark as Read'}
            </button>
            <button class="detail-action-btn ${isFav ? 'active-fav' : ''}" id="detail-fav-btn">
              <span>♥</span> ${isFav ? 'Favorited' : 'Add to Favorites'}
            </button>
            <button class="detail-action-btn ${isWish ? 'active-wish' : ''}" id="detail-wish-btn">
              <span>🔖</span> ${isWish ? 'Saved' : 'Read Later'}
            </button>
            <div class="detail-rating">
              <span class="detail-rating-label">Rate:</span>
              ${[1,2,3,4,5].map(i => `<span class="detail-star ${i <= rating ? 'filled' : ''}" data-val="${i}">★</span>`).join('')}
            </div>
          </div>
          <div class="book-description-wrap">
            <div id="detail-description" class="book-description">
              <span style="color:var(--text-muted);font-style:italic">Loading description…</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="detail-tabs-section">
      <div class="tabs">
        <button class="tab-btn active" data-tab="overview">Overview</button>
        <button class="tab-btn" data-tab="details">Details</button>
        <button class="tab-btn" data-tab="genres">Genres</button>
      </div>
      <div class="tab-content" id="tab-overview">
        <div class="reviews-section">
          <h3 class="reviews-heading">Reviews</h3>
          ${state.user ? `
          <div class="write-review-form" id="write-review-form">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              ${state.avatarUrl
                ? `<img class="review-avatar review-avatar-img" src="${escHtml(state.avatarUrl)}" alt="${escHtml(state.username)}" onerror="this.outerHTML='<div class=\\'review-avatar\\'>${state.username[0].toUpperCase()}</div>'">`
                : `<div class="review-avatar">${state.username[0].toUpperCase()}</div>`}
              <span style="font-size:13px;color:var(--text-secondary)">Write a review</span>
              <div class="review-form-stars" id="review-form-stars">
                ${[1,2,3,4,5].map(i => `<span class="review-form-star" data-val="${i}">☆</span>`).join('')}
              </div>
            </div>
            <textarea id="review-text-input" placeholder="What did you think of this book?" maxlength="1000" rows="3"></textarea>
            <button class="btn btn-primary btn-sm" id="submit-review-btn" style="margin-top:8px">Post Review</button>
          </div>` : '<p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Log in to write a review.</p>'}
          <div class="review-list" id="review-list">
            <p style="color:var(--text-muted);font-style:italic;font-size:13px">Loading reviews…</p>
          </div>
        </div>
      </div>
      <div class="tab-content" id="tab-details" style="display:none">
        <div class="details-grid" id="book-details-grid">
          <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${escHtml(book.title)}</span></div>
          <div class="detail-row"><span class="detail-label">Author</span><span class="detail-value"><a href="#" class="author-link" data-author="${escHtml(book.author)}">${escHtml(book.author)}</a></span></div>
          ${book.year ? `<div class="detail-row"><span class="detail-label">Published</span><span class="detail-value">${book.year}</span></div>` : ''}
          ${book.pages ? `<div class="detail-row"><span class="detail-label">Pages</span><span class="detail-value">${book.pages}</span></div>` : ''}
          ${book.isbn ? `<div class="detail-row"><span class="detail-label">ISBN</span><span class="detail-value" style="font-family:monospace;font-size:12px">${escHtml(book.isbn)}</span></div>` : ''}
          <div class="detail-row"><span class="detail-label">Book ID</span><span class="detail-value" style="font-family:monospace;font-size:12px">${escHtml(book.key)}</span></div>
        </div>
      </div>
      <div class="tab-content" id="tab-genres" style="display:none">
        <div id="book-genres-content">
          ${book.categories?.length
            ? `<div class="genre-tags">${book.categories.map(c => `<span class="genre-tag" data-genre="${escHtml(c)}">${escHtml(c)}</span>`).join('')}</div>`
            : '<p style="color:var(--text-muted);font-style:italic">No genre information available for this book.</p>'}
        </div>
      </div>
    </div>
    <div class="detail-tabs-section" id="author-books-section" style="display:none">
      <h3 class="reviews-heading">More by <span id="author-section-name"></span></h3>
      <div class="books-grid" id="author-books-grid"></div>
    </div>
    <div class="detail-tabs-section" id="book-editions-section" style="display:none">
      <h3 class="reviews-heading" style="cursor:pointer;user-select:none" id="editions-heading">
        Other editions <span id="editions-toggle" style="font-size:13px;color:var(--text-muted);font-family:inherit;font-weight:400">▼ show</span>
      </h3>
      <div id="book-editions-list" style="display:none"></div>
    </div>
  `;

  bindDetailActions(book);
  bindTabs();
  bindAuthorLinks();
  bindAdminCoverActions(book);
  fetchAndRenderDescription(book.key);
  loadAndRenderReviews(book);
  bindReviewForm(book);
  if (/^OL\d+W$/.test(book.key)) loadAndRenderEditions(book.key);

  document.getElementById('book-back-btn')?.addEventListener('click', async () => {
    if (state._prevPage && state._prevPage !== 'book') navigate(state._prevPage);
    else navigate('home');
  });
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.style.display = 'block';
    });
  });

  // Genre tags are clickable — search for that genre
  document.querySelectorAll('.genre-tag').forEach(tag => {
    tag.addEventListener('click', async () => {
      navigate('search', { genre: tag.dataset.genre });
    });
  });
}

function bindAuthorLinks() {
  document.querySelectorAll('.author-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const author = link.dataset.author;
      // Show author books section
      const section = document.getElementById('author-books-section');
      const grid = document.getElementById('author-books-grid');
      const nameEl = document.getElementById('author-section-name');
      if (!section || !grid || !nameEl) return;

      nameEl.textContent = author;
      section.style.display = 'block';
      grid.innerHTML = Array.from({length: 6}, () => `<div><div class="skeleton skeleton-cover"></div><div class="skeleton skeleton-line"></div></div>`).join('');

      try {
        const results = await searchBooks(`inauthor:${author}`, 12);
        renderBookGrid('author-books-grid', results);
      } catch {
        grid.innerHTML = '<p style="color:var(--text-muted)">Could not load books by this author.</p>';
      }

      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function bindDetailActions(book) {
  document.getElementById('detail-read-btn')?.addEventListener('click', async () => {
    await toggleRead(book.key, book.title, book.author, book.coverUrl, book.year);
    const isRead = !!state.readBooks[book.key];
    const btn = document.getElementById('detail-read-btn');
    if (btn) { btn.className = `detail-action-btn ${isRead ? 'active-read' : ''}`; btn.innerHTML = `<span>${isRead ? '✓' : '+'}</span> ${isRead ? 'Read' : 'Mark as Read'}`; }
  });

  document.getElementById('detail-fav-btn')?.addEventListener('click', async () => {
    await toggleFavorite(book);
    const isFav = state.favorites.some(f => f.key === book.key);
    const btn = document.getElementById('detail-fav-btn');
    if (btn) { btn.className = `detail-action-btn ${isFav ? 'active-fav' : ''}`; btn.innerHTML = `<span>♥</span> ${isFav ? 'Favorited' : 'Add to Favorites'}`; }
  });

  document.getElementById('detail-wish-btn')?.addEventListener('click', async () => {
    await toggleWishlist(book);
    const isWish = !!state.wishlist[book.key];
    const btn = document.getElementById('detail-wish-btn');
    if (btn) { btn.className = `detail-action-btn ${isWish ? 'active-wish' : ''}`; btn.innerHTML = `<span>🔖</span> ${isWish ? 'Saved' : 'Read Later'}`; }
  });

  const stars = document.querySelectorAll('.detail-star');
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => { const val = parseInt(star.dataset.val); stars.forEach((s, i) => s.classList.toggle('hover-fill', i < val)); });
    star.addEventListener('mouseleave', () => { stars.forEach(s => s.classList.remove('hover-fill')); });
    star.addEventListener('click', async () => {
      if (!requireAuth('rate books')) return;
      const val = parseInt(star.dataset.val);
      if (!await toggleBookRating(book, val)) return;
      stars.forEach((s, i) => s.classList.toggle('filled', i < state.ratings[book.key]));
      showToast(state.ratings[book.key] ? `Rated "${book.title}" ${state.ratings[book.key]}★` : 'Rating removed', 'info');
    });
  });
}

// ─── ADMIN COVER ACTIONS ─────────────────────────────────────────────────
function bindAdminCoverActions(book) {
  if (!state.isAdmin) return;

  document.getElementById('admin-find-covers')?.addEventListener('click', async () => {
    const btn = document.getElementById('admin-find-covers');
    const picker = document.getElementById('admin-cover-picker');
    if (!picker) return;

    // Toggle off if already open
    if (picker.style.display !== 'none') {
      picker.style.display = 'none';
      return;
    }

    btn.textContent = '🔍 Searching…';
    btn.disabled = true;
    picker.style.display = 'block';
    picker.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px">Searching Open Library, Wikipedia & Google Books…</p>';

    try {
      const options = await adminFindCoverOptions(book.title, book.author);
      if (!options.length) {
        picker.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px">No covers found. Try pasting a URL instead.</p>';
      } else {
        picker.innerHTML = `
          <p style="color:var(--text-muted);font-size:12px;margin-bottom:8px">Click a cover to use it:</p>
          <div class="cover-options-grid">
            ${options.map((opt, i) => `
              <div class="cover-option" data-idx="${i}">
                <img src="${escHtml(opt.url)}" alt="Cover option ${i + 1}" onerror="this.parentElement.style.display='none'">
                <span class="cover-option-source">${escHtml(opt.source)}</span>
              </div>
            `).join('')}
          </div>
        `;
        picker.querySelectorAll('.cover-option').forEach(el => {
          el.addEventListener('click', async () => {
            const idx = parseInt(el.dataset.idx);
            const chosen = options[idx];
            if (!chosen) return;
            if (!await adminUpdateCover(book.title, book.author, chosen.url, book.key, book.year)) return;
            book.coverUrl = chosen.url;
            const img = document.getElementById('detail-cover-img');
            const placeholder = document.getElementById('detail-cover-placeholder');
            if (img) { img.src = chosen.url; img.style.display = ''; }
            else {
              const newImg = document.createElement('img');
              newImg.className = 'book-detail-cover';
              newImg.id = 'detail-cover-img';
              newImg.src = chosen.url;
              newImg.alt = book.title;
              placeholder?.parentElement?.insertBefore(newImg, placeholder);
            }
            if (placeholder) placeholder.style.display = 'none';
            picker.style.display = 'none';
            showToast(`Cover updated from ${chosen.source}!`);
          });
        });
      }
    } catch (e) {
      picker.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px">Failed to search. Try again.</p>';
    }
    btn.textContent = '🔍 Find covers';
    btn.disabled = false;
  });

  document.getElementById('admin-custom-cover')?.addEventListener('click', async () => {
    const url = prompt('Paste a cover image URL:');
    if (!url) return;
    if (!url.startsWith('http')) { showToast('Please enter a valid URL', 'error'); return; }
    if (!await adminUpdateCover(book.title, book.author, url, book.key, book.year)) return;
    book.coverUrl = url;
    const img = document.getElementById('detail-cover-img');
    const placeholder = document.getElementById('detail-cover-placeholder');
    if (img) { img.src = url; img.style.display = ''; }
    else {
      const newImg = document.createElement('img');
      newImg.className = 'book-detail-cover';
      newImg.id = 'detail-cover-img';
      newImg.src = url;
      newImg.alt = book.title;
      placeholder?.parentElement?.insertBefore(newImg, placeholder);
    }
    if (placeholder) placeholder.style.display = 'none';
    showToast('Custom cover saved!');
  });
}

// ─── REVIEW RENDERING ────────────────────────────────────────────────────
async function loadAndRenderReviews(book) {
  const container = document.getElementById('review-list');
  if (!container) return;
  let reviews;
  try {
    reviews = await getBookReviews(book.key);
  } catch (error) {
    container.innerHTML = '<p style="color:var(--accent-red);font-size:13px">Reviews could not be loaded. <button class="link-btn" id="retry-reviews-btn">Try again</button></p>';
    container.querySelector('#retry-reviews-btn')?.addEventListener('click', () => loadAndRenderReviews(book));
    return;
  }
  if (!reviews.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-style:italic;font-size:13px">No reviews yet. Be the first to share your thoughts!</p>';
    return;
  }
  container.innerHTML = reviews.map(r => {
    const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const stars = r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : '';
    const isOwn = state.user && r.user_id === state.user.id;
    const avatarHtml = r.avatar_url
      ? `<img class="review-avatar review-avatar-img" src="${escHtml(r.avatar_url)}" alt="${escHtml(r.username)}" onerror="this.outerHTML='<div class=\\'review-avatar\\'>${(r.username || '?')[0].toUpperCase()}</div>'">`
      : `<div class="review-avatar">${(r.username || '?')[0].toUpperCase()}</div>`;
    return `
      <div class="review-item">
        <div class="review-header">
          ${avatarHtml}
          <div class="review-meta">
            <div class="review-name">${escHtml(r.username)}</div>
            ${stars ? `<div class="review-stars">${stars}</div>` : ''}
          </div>
          <div class="review-date">${date}</div>
          ${isOwn || state.isAdmin ? `<button class="review-delete-btn" data-review-id="${r.id}" title="Delete">✕</button>` : ''}
        </div>
        ${r.review_text ? `<p class="review-text">${escHtml(r.review_text)}</p>` : ''}
      </div>`;
  }).join('');

  container.querySelectorAll('.review-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this review? This cannot be undone.')) return;
      if (!await deleteReview(btn.dataset.reviewId)) return;
      showToast('Review deleted');
      loadAndRenderReviews(book);
    });
  });
}

function bindReviewForm(book) {
  let reviewRating = 0;
  const stars = document.querySelectorAll('.review-form-star');
  stars.forEach(star => {
    star.addEventListener('click', async () => {
      const val = parseInt(star.dataset.val);
      reviewRating = reviewRating === val ? 0 : val;
      stars.forEach((s, i) => s.textContent = i < reviewRating ? '★' : '☆');
    });
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      stars.forEach((s, i) => s.classList.toggle('hover-fill', i < val));
    });
    star.addEventListener('mouseleave', () => stars.forEach(s => s.classList.remove('hover-fill')));
  });

  document.getElementById('submit-review-btn')?.addEventListener('click', async () => {
    const text = document.getElementById('review-text-input')?.value.trim() || '';
    if (!text && !reviewRating) { showToast('Write something or add a rating', 'info'); return; }
    const btn = document.getElementById('submit-review-btn');
    btn.disabled = true; btn.textContent = 'Posting…';
    try {
      await submitReview(book.key, book.title, reviewRating, text);
      showToast('Review posted!');
      document.getElementById('review-text-input').value = '';
      reviewRating = 0;
      stars.forEach(s => s.textContent = '☆');
      loadAndRenderReviews(book);
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
    btn.disabled = false; btn.textContent = 'Post Review';
  });
}

async function fetchBookDetails(key) {
  // Try Google Books API first
  try {
    const url = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data.volumeInfo || data;
    }
  } catch { /* fall through */ }
  // Fallback to Open Library
  try {
    const res = await fetch(`${OL}/works/${key}.json`);
    if (res.ok) return await res.json();
  } catch { /* ignore */ }
  return {};
}

async function fetchAndRenderDescription(key) {
  try {
    // If the current book already has a description (from Google Books), use it directly
    const existing = state.currentBook?.description;
    let desc = existing || '';
    if (!desc) {
      const data = await fetchBookDetails(key);
      if (typeof data.description === 'string') desc = data.description;
      else if (data.description?.value) desc = data.description.value;
      // Google Books API volumeInfo.description
      else if (data.volumeInfo?.description) desc = data.volumeInfo.description;
    }
    desc = desc.replace(/\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').trim();
    const el = document.getElementById('detail-description');
    if (!el) return;
    if (!desc) { el.innerHTML = `<span style="color:var(--text-muted);font-style:italic">No description available.</span>`; return; }
    el.classList.add('collapsed');
    el.textContent = desc;
    const btn = document.createElement('button');
    btn.className = 'read-more-btn';
    btn.textContent = 'Show more';
    btn.onclick = () => { const c = el.classList.toggle('collapsed'); btn.textContent = c ? 'Show more' : 'Show less'; };
    el.after(btn);
  } catch (e) {
    const el = document.getElementById('detail-description');
    if (el) el.innerHTML = `<span style="color:var(--text-muted);font-style:italic">No description available.</span>`;
  }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────
async function doGenreSearch(genre) {
  const subject = GENRE_SUBJECTS[genre.toLowerCase()] || genre.toLowerCase().replace(/[\s-]+/g, '_');
  const grid = document.getElementById('search-results-grid');
  const info = document.getElementById('search-results-info');
  info.textContent = 'Searching…';
  renderGridSkeletons('search-results-grid', 24);

  const seenTitles = new Set();
  state.searchResults = [];

  grid.onclick = async e => {
    const btn = e.target.closest('.overlay-btn');
    if (btn) {
      if (btn.classList.contains('mark-read'))
        await toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
      else if (btn.classList.contains('rate-btn')) {
        const book = state.searchResults.find(b => b.key === btn.dataset.key);
        if (book) openRatingModal(book);
      }
      return;
    }
    const card = e.target.closest('.book-card');
    if (card) {
      const book = state.searchResults.find(b => b.key === card.dataset.key);
      if (book) openBook(book);
    }
  };

  function applyBatch(books) {
    const newBooks = books.filter(b => {
      const n = normalizeText(b.title);
      if (seenTitles.has(n)) return false;
      seenTitles.add(n);
      return true;
    });
    if (!newBooks.length) return;
    state.searchResults.push(...newBooks);
    info.textContent = `${state.searchResults.length} results for "${genre}"`;
    if (grid.querySelector('.skeleton')) {
      grid.innerHTML = newBooks.map(bookCardHTML).join('');
    } else {
      const frag = document.createDocumentFragment();
      newBooks.forEach(book => {
        const tmp = document.createElement('div');
        tmp.innerHTML = bookCardHTML(book);
        frag.appendChild(tmp.firstElementChild);
      });
      grid.appendChild(frag);
    }
  }

  const isPopular = genre.toLowerCase() === 'popular books';
  const gbQuery = isPopular ? 'bestselling fiction' : `subject:${genre}`;
  const fetches = [
    ...Array.from({ length: 4 }, (_, i) =>
      searchBooksGoogle(gbQuery, 40, i * 40).then(applyBatch).catch(() => {})),
    ...(isPopular
      ? [withTimeout(fetchOLTrending(100), 6000).then(applyBatch).catch(() => {})]
      : Array.from({ length: 3 }, (_, i) =>
          withTimeout(fetchOLSubject(subject, 100, i * 100), 6000).then(applyBatch).catch(() => {}))),
  ];
  await Promise.allSettled(fetches);

  if (!state.searchResults.length) {
    grid.innerHTML = '<div class="empty-state"><p>No books found.</p></div>';
    info.textContent = `No results for "${genre}"`;
  }
}

async function doSearch(query) {
  if (!query.trim()) return;
  document.getElementById('search-results-info').textContent = 'Searching…';
  renderGridSkeletons('search-results-grid', 12);

  try {
    const results = await searchBooks(query, 24);
    state.searchResults = results;
    document.getElementById('search-results-info').textContent = `${results.length} results for "${query}"`;
    renderBookGrid('search-results-grid', results);
  } catch (e) {
    document.getElementById('search-results-info').textContent = 'Search failed. Try again.';
    showToast('Search failed', 'error');
  }
}

function renderGridSkeletons(containerId, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({length: count}, () => `
    <div><div class="skeleton skeleton-cover"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>
  `).join('');
}

function renderBookGrid(containerId, books) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!books.length) { el.innerHTML = `<div class="empty-state"><p>No books found.</p></div>`; return; }
  el.innerHTML = books.map(book => bookCardHTML(book)).join('');
  el.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.overlay-btn')) return;
      const book = books.find(b => b.key === card.dataset.key);
      if (book) openBook(book);
    });
  });
  el.querySelectorAll('.overlay-btn.mark-read').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
    });
  });
  el.querySelectorAll('.overlay-btn.rate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const book = books.find(b => b.key === btn.dataset.key);
      if (book) openRatingModal(book);
    });
  });
}

function bookCardHTML(book) {
  const isRead = !!state.readBooks[book.key];
  const rating = state.ratings[book.key] || 0;
  const cover = coverUrl(book.coverUrl);
  const starsHtml = [1,2,3,4,5].map(i => `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`).join('');
  return `
    <div class="book-card" data-key="${escHtml(book.key)}">
      <div class="book-cover-wrap">
        ${cover ? `<img class="book-cover" src="${cover}" alt="${escHtml(book.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="book-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/><rect x="3" y="4" width="18" height="2" rx="1" fill="#67788a"/><rect x="3" y="9" width="14" height="2" rx="1" fill="#67788a"/></svg>
          <span class="placeholder-title">${escHtml(book.title)}</span>
        </div>
        <div class="book-overlay">
          <div class="overlay-actions">
            <button class="overlay-btn mark-read ${isRead ? 'read' : ''}" data-key="${escHtml(book.key)}" data-title="${escHtml(book.title)}" data-author="${escHtml(book.author)}" data-cover="${book.coverUrl || ''}" data-year="${book.year || ''}">${isRead ? '✓' : '📖'}</button>
            <button class="overlay-btn rate-btn ${rating ? 'rated' : ''}" data-key="${escHtml(book.key)}">★</button>
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

// ─── COLLECTION PAGE ──────────────────────────────────────────────────────
function normalizeStoredBook(book) {
  return {
    ...book,
    key: book.key || book.book_key || '',
    title: book.title || book.book_title || 'Unknown',
    author: book.author || book.book_author || '',
    coverUrl: book.coverUrl || book.cover_url,
    dateRead: book.dateRead || book.date_read || '',
  };
}

function collectionItemHTML(book) {
  const cover = coverUrl(book.coverUrl, 'S');
  const rating = book.rating || 0;
  const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
  const date = book.dateRead || '';
  return `<div class="collection-item" data-book-key="${escHtml(book.key || '')}">
    ${cover ? `<img class="collection-item-cover" src="${escHtml(cover)}" alt="" loading="lazy" onerror="this.style.background='var(--bg-secondary)';this.removeAttribute('src')">` : '<div class="collection-item-cover"></div>'}
    <div class="collection-item-info">
      <div class="collection-item-title">${escHtml(book.title || 'Unknown')}</div>
      <div class="collection-item-author">${escHtml(book.author || '')}</div>
    </div>
    <div class="collection-item-right">
      ${stars ? `<div class="collection-item-rating">${stars}</div>` : ''}
      ${date ? `<div class="collection-item-date">${escHtml(relativeDate(date))}</div>` : ''}
    </div>
  </div>`;
}

function loadCollectionPage({ title, books, backPage, backParams = {} }) {
  books = (books || []).map(normalizeStoredBook);
  navigate('collection');
  document.getElementById('collection-title').textContent = title;
  document.getElementById('collection-back-btn').onclick = () => navigate(backPage, backParams);

  const listEl = document.getElementById('collection-books-list');
  if (!books?.length) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;padding:16px 0">No books here yet.</p>';
    return;
  }
  listEl.innerHTML = books.map(collectionItemHTML).join('');
  listEl.querySelectorAll('.collection-item').forEach((el, i) => {
    el.addEventListener('click', async () => {
      const b = books[i];
      if (b) openBook({ key: b.key, title: b.title, author: b.author, coverUrl: b.coverUrl, year: b.year || '' });
    });
  });
}

// ─── USER PROFILE (public view) ───────────────────────────────────────────
async function loadUserProfile(userId) {
  if (!sb) return;

  const { data: profile } = await queryResult(sb.from('profiles').select('username, bio, avatar_url, wishlist_is_public').eq('id', userId).single());
  if (!profile) return;

  // Header
  const avatarEl = document.getElementById('user-avatar-letter');
  if (avatarEl) {
    avatarEl.innerHTML = profile.avatar_url
      ? `<img src="${escHtml(profile.avatar_url)}" class="profile-big-avatar-img" alt="" onerror="this.remove();this.parentElement.textContent='${(profile.username||'?')[0].toUpperCase()}'">`
      : (profile.username || '?')[0].toUpperCase();
  }
  const usernameEl = document.getElementById('user-username');
  if (usernameEl) usernameEl.textContent = profile.username || 'User';
  const bioEl = document.getElementById('user-bio');
  if (bioEl) { bioEl.textContent = profile.bio || ''; bioEl.style.display = profile.bio ? '' : 'none'; }

  // Fetch everything in parallel
  const [
    { data: favsData },
    { data: readsData },
    { data: ratingsData },
    { data: listsData },
    { data: wishlistData },
  ] = await Promise.all([
    queryResult(sb.from('favorites').select('book_key, title, author, cover_url, position').eq('user_id', userId)),
    queryResult(sb.from('read_books').select('book_key, title, author, cover_url, year, date_read').eq('user_id', userId)),
    queryResult(sb.from('ratings').select('book_key, rating, book_title, book_author, cover_url').eq('user_id', userId).gt('rating', 0)),
    queryResult(sb.from('lists').select('id, title, description').eq('user_id', userId).eq('is_curated', false)),
    profile.wishlist_is_public
      ? queryResult(sb.from('wishlist').select('book_key, title, author, cover_url, year, date_added').eq('user_id', userId).order('date_added', { ascending: false }))
      : Promise.resolve({ data: [] }),
  ]);

  const favs    = (favsData    || []).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const reads   = readsData   || [];
  const ratings = ratingsData || [];
  const lists   = listsData   || [];
  const wishlist = wishlistData || [];

  // Stats
  document.getElementById('user-stat-read').textContent  = reads.length;
  document.getElementById('user-stat-rated').textContent = ratings.length;
  document.getElementById('user-stat-favs').textContent  = favs.length;

  // Stat click handlers
  const readMap = Object.fromEntries(reads.map(r => [r.book_key, r]));
  const favMap  = Object.fromEntries(favs.map(f => [f.book_key, f]));

  function resolveRatedBook(r) {
    const meta = readMap[r.book_key] || favMap[r.book_key];
    return {
      key:      r.book_key,
      title:    r.book_title   || meta?.title   || 'Unknown Book',
      author:   r.book_author  || meta?.author  || '',
      coverUrl: r.cover_url    || meta?.cover_url    || null,
      rating:   r.rating,
    };
  }

  document.getElementById('user-stat-item-read')?.addEventListener('click', () =>
    loadCollectionPage({ title: `${profile.username}'s Books`, books: reads, backPage: 'user', backParams: { userId } })
  );
  document.getElementById('user-stat-item-rated')?.addEventListener('click', () =>
    loadCollectionPage({ title: `${profile.username}'s Rated Books`, books: ratings.map(resolveRatedBook), backPage: 'user', backParams: { userId } })
  );
  document.getElementById('user-stat-item-favs')?.addEventListener('click', () =>
    loadCollectionPage({ title: `${profile.username}'s Favourites`, books: favs, backPage: 'user', backParams: { userId } })
  );

  // Favourites grid (read-only)
  const favsGrid = document.getElementById('user-favorites-grid');
  if (favsGrid) {
    if (favs.length) {
      favsGrid.innerHTML = [0,1,2,3].map(i => {
        const f = favs[i];
        if (!f) return `<div class="fav-slot"><div class="fav-slot-empty" style="opacity:.3"><span>—</span></div></div>`;
        const cover = coverUrl(f.cover_url, 'M');
        return `<div class="fav-slot filled" style="cursor:pointer" data-key="${escHtml(f.book_key)}">
          ${cover ? `<img src="${cover}" alt="${escHtml(f.title||'')}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <div class="fav-slot-placeholder" ${cover?'style="display:none"':''}><span>${escHtml(f.title||'')}</span></div>
          <div class="fav-slot-title">${escHtml(f.title||'')}</div>
        </div>`;
      }).join('');
      favsGrid.querySelectorAll('.fav-slot.filled').forEach(slot => {
        slot.addEventListener('click', async () => {
          const f = favs.find(x => x.book_key === slot.dataset.key);
          if (f) openBook({ key: f.book_key, title: f.title, author: f.author, coverUrl: f.cover_url });
        });
      });
    } else {
      favsGrid.innerHTML = '<p style="color:var(--text-muted);font-size:13px;font-style:italic">No favourites yet.</p>';
    }
  }

  // All reads with relative dates
  const readList = document.getElementById('user-read-list');
  if (readList) {
    readList.innerHTML = reads.length
      ? reads.map(r => collectionItemHTML({ key: r.book_key, title: r.title, author: r.author, coverUrl: r.cover_url, dateRead: r.date_read })).join('')
      : '<p style="color:var(--text-muted);font-style:italic;font-size:13px">No books read yet.</p>';
    readList.querySelectorAll('.collection-item').forEach((el, i) => {
      el.addEventListener('click', async () => {
        const r = reads[i];
        if (r) openBook({ key: r.book_key, title: r.title, author: r.author, coverUrl: r.cover_url, year: r.year || '' });
      });
    });
  }

  // Lists
  const listsSection = document.getElementById('user-lists-section');
  const listsGrid = document.getElementById('user-lists-grid');
  if (listsSection && listsGrid && lists.length) {
    listsSection.style.display = '';
    listsGrid.innerHTML = lists.map(l => `
      <div class="list-card" data-list-id="${escHtml(l.id)}" style="cursor:pointer">
        <div class="list-card-title">${escHtml(l.title)}</div>
        ${l.description ? `<div class="list-card-desc">${escHtml(l.description)}</div>` : ''}
      </div>`).join('');
    listsGrid.querySelectorAll('.list-card').forEach(card => {
      card.addEventListener('click', () => openList(card.dataset.listId));
    });
  }

  const wishlistSection = document.getElementById('user-wishlist-section');
  const wishlistList = document.getElementById('user-wishlist-list');
  if (wishlistSection && wishlistList) {
    wishlistSection.style.display = profile.wishlist_is_public ? '' : 'none';
    if (profile.wishlist_is_public) {
      wishlistList.innerHTML = wishlist.length
        ? wishlist.map(item => collectionItemHTML({ key: item.book_key, title: item.title, author: item.author, coverUrl: item.cover_url, dateRead: item.date_added })).join('')
        : '<p style="color:var(--text-muted);font-style:italic;font-size:13px">Nothing saved yet.</p>';
      wishlistList.querySelectorAll('.collection-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          const item = wishlist[i];
          if (item) openBook({ key: item.book_key, title: item.title, author: item.author, coverUrl: item.cover_url, year: item.year || '' });
        });
      });
    }
  }

  document.getElementById('user-back-btn')?.addEventListener('click', () => navigate('profile'));
  document.getElementById('user-share-btn')?.addEventListener('click', () => copyCurrentLink('Profile link'));
}

// ─── PROFILE ──────────────────────────────────────────────────────────────
function loadProfilePage() {
  if (sb && !state.user) {
    openAuthModal('login');
    navigate('home');
    return;
  }
  const readCount = Object.keys(state.readBooks).length;
  const ratedCount = Object.keys(state.ratings).filter(k => state.ratings[k] > 0).length;
  const favCount = state.favorites.length;
  const wishCount = Object.keys(state.wishlist).length;
  document.getElementById('stat-read').textContent = readCount;
  document.getElementById('stat-rated').textContent = ratedCount;
  document.getElementById('stat-favs').textContent = favCount;
  document.getElementById('stat-wishlist').textContent = wishCount;
  document.getElementById('profile-username').textContent = state.username;
  const wishlistVisibilityInput = document.getElementById('wishlist-public-input');
  if (wishlistVisibilityInput) wishlistVisibilityInput.checked = state.wishlistIsPublic;

  // Stat click → collection page
  document.getElementById('stat-item-read')?.addEventListener('click', () =>
    loadCollectionPage({ title: 'Books Read', books: Object.values(state.readBooks), backPage: 'profile' })
  );
  document.getElementById('stat-item-rated')?.addEventListener('click', async () => {
    const books = Object.entries(state.ratings)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ ...(state.readBooks[k] || state.wishlist[k] || state.favorites.find(f => f.key === k) || { key: k }), rating: v }));
    loadCollectionPage({ title: 'Rated Books', books, backPage: 'profile' });
  });
  document.getElementById('stat-item-favs')?.addEventListener('click', () =>
    loadCollectionPage({ title: 'Favourites', books: state.favorites, backPage: 'profile' })
  );
  document.getElementById('stat-item-wishlist')?.addEventListener('click', () => navigate('wishlist'));

  // Avatar display
  const avatarEl = document.getElementById('profile-avatar-letter');
  if (avatarEl) {
    if (state.avatarUrl) {
      avatarEl.innerHTML = `<img src="${escHtml(state.avatarUrl)}" alt="${escHtml(state.username)}" class="profile-big-avatar-img" onerror="this.remove();this.parentElement.textContent='${state.username[0].toUpperCase()}'">`;
    } else {
      avatarEl.textContent = state.username[0].toUpperCase();
    }
  }
  // Header small avatar
  const smallAvatar = document.getElementById('profile-avatar-small');
  if (smallAvatar) {
    if (state.avatarUrl) {
      smallAvatar.innerHTML = `<img src="${escHtml(state.avatarUrl)}" alt="" class="header-avatar-img" onerror="this.remove();this.parentElement.textContent='${state.username[0].toUpperCase()}'">`;
    } else {
      smallAvatar.textContent = state.username[0].toUpperCase();
    }
  }

  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.textContent = state.bio || '';
  if (bioEl) bioEl.style.display = state.bio ? '' : 'none';

  // Show current avatar URL in edit form
  const avatarInput = document.getElementById('avatar-url-input');
  if (avatarInput) avatarInput.value = state.avatarUrl || '';

  // Update wishlist tile count
  const wishTileCount = document.getElementById('wishlist-tile-count');
  if (wishTileCount) wishTileCount.textContent = Object.keys(state.wishlist).length;

  renderFavorites();
  renderReadList();
  renderWishlist();
  renderProfileLists();
  loadFriendsSidebar();
  bindFriendSearch();
}

async function renderProfileLists() {
  const section = document.getElementById('profile-lists-section');
  const grid = document.getElementById('profile-lists-grid');
  if (!section || !grid || !state.user) return;

  // Find user's lists from cache
  try {
    await loadAllLists();
  } catch (error) {
    section.style.display = '';
    grid.innerHTML = '<p style="color:var(--accent-red);font-size:13px">Your lists could not be loaded. Please try again.</p>';
    return;
  }
  const myLists = Object.values(listsCache).filter(l => l.user_id === state.user.id);
  if (!myLists.length) { section.style.display = 'none'; return; }

  section.style.display = '';
  grid.innerHTML = myLists.map(list => listCardHTML(list)).join('');

  grid.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => openList(card.dataset.listId));
  });
  grid.querySelectorAll('.list-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this list?')) return;
      if (!await deleteUserList(btn.dataset.listId)) return;
      showToast('List deleted');
      listsPageLoaded = false;
      renderProfileLists();
    });
  });

  // Load preview covers
  for (const list of myLists) {
    const previewEl = document.getElementById(`${list.id}-preview`);
    if (!previewEl || previewEl.dataset.loaded) continue;
    previewEl.dataset.loaded = '1';
    await renderListPreviewCovers(previewEl, list.books || []);
  }
}

function renderFavorites() {
  const grid = document.getElementById('favorites-grid');
  if (!grid) return;
  grid.innerHTML = [0,1,2,3].map(i => {
    const fav = state.favorites[i];
    if (fav) {
      const cover = coverUrl(fav.coverUrl, 'M');
      return `
        <div class="fav-slot filled" data-slot="${i}" data-fav-key="${escHtml(fav.key)}">
          ${cover ? `<img src="${cover}" alt="${escHtml(fav.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <div class="fav-slot-placeholder" ${cover ? 'style="display:none"' : ''}><span>${escHtml(fav.title)}</span></div>
          <div class="fav-slot-title">${escHtml(fav.title)}</div>
          <div class="fav-slot-overlay">
            <button class="fav-remove-btn" data-idx="${i}">Remove</button>
            <button class="fav-open-btn" data-idx="${i}">View</button>
          </div>
        </div>`;
    } else {
      return `<div class="fav-slot" data-slot="${i}" onclick="navigate('search')">
        <div class="fav-slot-empty">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>Add a favourite</span>
        </div>
      </div>`;
    }
  }).join('');

  // Bind favorite actions
  grid.querySelectorAll('.fav-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => { e.stopPropagation(); removeFavorite(parseInt(btn.dataset.idx)); });
  });
  grid.querySelectorAll('.fav-open-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fav = state.favorites[parseInt(btn.dataset.idx)];
      if (fav) openBook(fav);
    });
  });
  // Also make the whole card clickable (except overlay buttons)
  grid.querySelectorAll('.fav-slot.filled').forEach(slot => {
    slot.addEventListener('click', async (e) => {
      if (e.target.closest('.fav-remove-btn') || e.target.closest('.fav-open-btn')) return;
      const idx = parseInt(slot.dataset.slot);
      const fav = state.favorites[idx];
      if (fav) openBook(fav);
    });
  });
}

async function removeFavorite(index) {
  const book = state.favorites[index];
  if (book && await toggleFavorite(book)) renderFavorites();
}

function renderReadList() {
  const el = document.getElementById('read-books-list');
  if (!el) return;
  const keys = Object.keys(state.readBooks);
  if (!keys.length) {
    el.innerHTML = `<div class="empty-state"><svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M4 19V6a2 2 0 012-2h12a2 2 0 012 2v13" stroke="currentColor" stroke-width="1.5"/></svg><h3>Start your reading history</h3><p>Find a book, then mark it as read to make this shelf yours.</p><button class="btn btn-primary" id="start-reading-btn" type="button">Find a book</button></div>`;
    el.querySelector('#start-reading-btn')?.addEventListener('click', () => navigate('search'));
    return;
  }
  const sort = document.getElementById('read-sort')?.value || 'recent';
  const sortedKeys = [...keys].sort((a, b) => {
    const first = state.readBooks[a];
    const second = state.readBooks[b];
    if (sort === 'title') return (first.title || '').localeCompare(second.title || '');
    if (sort === 'rating') return (state.ratings[second.key] || 0) - (state.ratings[first.key] || 0);
    return new Date(second.dateRead || 0) - new Date(first.dateRead || 0);
  });
  el.innerHTML = sortedKeys.map(key => {
    const b = state.readBooks[key];
    const rating = state.ratings[key] || 0;
    const cover = coverUrl(b.coverUrl);
    const starsHtml = [1,2,3,4,5].map(i => `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`).join('');
    return `
      <div class="book-list-item" onclick="openBook(${JSON.stringify(b).replace(/"/g, '&quot;')})">
        ${cover ? `<img class="book-list-cover" src="${cover}" alt="${escHtml(b.title)}" onerror="this.style.display='none'">` : `<div class="book-list-cover-placeholder"><svg width="16" height="22" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/></svg></div>`}
        <div class="book-list-info">
          <div class="book-list-title">${escHtml(b.title)}</div>
          <div class="book-list-author">${escHtml(b.author)}</div>
          ${b.dateRead ? `<div class="date-read">Read ${b.dateRead}</div>` : ''}
        </div>
        <div class="book-list-rating">${starsHtml}</div>
      </div>`;
  }).join('');
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────
async function toggleRead(key, title, author, coverUrl, year) {
  return runBookMutation('read:' + key, async () => {
    if (!requireAuth('track books')) return false;
    const removing = !!state.readBooks[key];
    const dateRead = new Date().toLocaleDateString('en-NL', { month: 'short', year: 'numeric' });
    if (state.user) {
      const request = removing
        ? queryResult(sb.from('read_books').delete().eq('user_id', state.user.id).eq('book_key', key))
        : queryResult(sb.from('read_books').upsert({ user_id: state.user.id, book_key: key, title, author,
            cover_url: coverUrl, year, date_read: dateRead }, { onConflict: 'user_id,book_key' }));
      if (!await saveMutation(request)) return false;
    }
    if (removing) delete state.readBooks[key];
    else state.readBooks[key] = { key, title, author, coverUrl, year, dateRead };
    saveLocalGuestData();
    showToast(removing ? `Removed "${title}" from read list` : `Marked "${title}" as read ✓`);
    return true;
  });
}

async function toggleFavorite(book) {
  return runBookMutation('favorite:' + book.key, async () => {
    if (!requireAuth('add favourites')) return false;
    const idx = state.favorites.findIndex(f => f.key === book.key);
    if (idx < 0 && state.favorites.length >= 4) {
      showToast('You can only have 4 favourites. Remove one first.', 'error'); return false;
    }
    if (state.user) {
      const request = idx >= 0
        ? queryResult(sb.from('favorites').delete().eq('user_id', state.user.id).eq('book_key', book.key))
        : queryResult(sb.from('favorites').upsert({ user_id: state.user.id, book_key: book.key, title: book.title,
            author: book.author, cover_url: book.coverUrl, position: state.favorites.length }, { onConflict: 'user_id,book_key' }));
      if (!await saveMutation(request)) return false;
    }
    if (idx >= 0) state.favorites.splice(idx, 1);
    else state.favorites.push({ key: book.key, title: book.title, author: book.author, coverUrl: book.coverUrl });
    saveLocalGuestData();
    showToast(idx >= 0 ? 'Removed from favourites' : `Added "${book.title}" to favourites ♥`);
    return true;
  });
}

// ─── WISHLIST (READ LATER) ──────────────────────────────────────────────
async function toggleWishlist(book) {
  return runBookMutation('wishlist:' + book.key, async () => {
    if (!requireAuth('save to wishlist')) return false;
    const key = book.key;
    const removing = !!state.wishlist[key];
    const dateAdded = new Date().toISOString();
    if (state.user) {
      const request = removing
        ? queryResult(sb.from('wishlist').delete().eq('user_id', state.user.id).eq('book_key', key))
        : queryResult(sb.from('wishlist').upsert({ user_id: state.user.id, book_key: key, title: book.title,
            author: book.author, cover_url: book.coverUrl, year: book.year, date_added: dateAdded }, { onConflict: 'user_id,book_key' }));
      if (!await saveMutation(request)) return false;
    }
    if (removing) delete state.wishlist[key];
    else state.wishlist[key] = { key, title: book.title, author: book.author, coverUrl: book.coverUrl, year: book.year, dateAdded };
    saveLocalGuestData();
    showToast(removing ? `Removed "${book.title}" from Read Later` : `Added "${book.title}" to Read Later 🔖`);
    return true;
  });
}

function renderWishlist() {
  const el = document.getElementById('wishlist-books-list');
  if (!el) return;
  const keys = Object.keys(state.wishlist);
  if (!keys.length) {
    el.innerHTML = `<div class="empty-state"><svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" stroke="currentColor" stroke-width="1.5"/></svg><h3>No books saved yet</h3><p>Browse books and tap "Read Later" to save them here.</p></div>`;
    return;
  }
  el.innerHTML = keys.map(key => {
    const b = state.wishlist[key];
    const cover = coverUrl(b.coverUrl);
    const dateAdded = b.dateAdded ? new Date(b.dateAdded).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    return `
      <div class="book-list-item" onclick="openBook(${JSON.stringify(b).replace(/"/g, '&quot;')})">
        ${cover ? `<img class="book-list-cover" src="${cover}" alt="${escHtml(b.title)}" onerror="this.style.display='none'">` : `<div class="book-list-cover-placeholder"><svg width="16" height="22" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/></svg></div>`}
        <div class="book-list-info">
          <div class="book-list-title">${escHtml(b.title)}</div>
          <div class="book-list-author">${escHtml(b.author)}</div>
          ${dateAdded ? `<div class="date-read">Added ${dateAdded}</div>` : ''}
        </div>
        <button class="wishlist-remove-btn" data-key="${escHtml(key)}" title="Remove" onclick="event.stopPropagation()">✕</button>
      </div>`;
  }).join('');

  el.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const book = state.wishlist[key];
      if (book) {
        await toggleWishlist(book);
        renderWishlist();
        // Update wishlist count on profile
        const wishCount = document.getElementById('stat-wishlist');
        if (wishCount) wishCount.textContent = Object.keys(state.wishlist).length;
      }
    });
  });
}

function findBookByKey(key) {
  return [...state.popularBooks, ...state.classicsBooks, ...state.fictionBooks, ...state.searchResults].find(b => b.key === key);
}

function loadWishlistPage() {
  if (sb && !state.user) {
    openAuthModal('login');
    navigate('home');
    return;
  }
  renderWishlist();
}

// ─── RATING MODAL ────────────────────────────────────────────────────────
function openRatingModal(book) {
  state.pendingRatingBook = book;
  document.getElementById('modal-book-title').textContent = book.title;
  const cur = state.ratings[book.key] || 0;
  document.querySelectorAll('.modal-star').forEach(s => s.classList.toggle('filled', parseInt(s.dataset.val) <= cur));
  openModal('rating-modal', '.modal-star');
}

function closeRatingModal() {
  closeModal('rating-modal');
  state.pendingRatingBook = null;
}

async function toggleBookRating(book, val) {
  return runBookMutation('rating:' + book.key, async () => {
    const rating = state.ratings[book.key] === val ? 0 : val;
    if (state.user) {
      const request = rating > 0
        ? queryResult(sb.from('ratings').upsert({ user_id: state.user.id, book_key: book.key, rating,
            book_title: book.title || null, book_author: book.author || null, cover_url: book.coverUrl || null }, { onConflict: 'user_id,book_key' }))
        : queryResult(sb.from('ratings').delete().eq('user_id', state.user.id).eq('book_key', book.key));
      if (!await saveMutation(request)) return false;
    }
    state.ratings[book.key] = rating;
    saveLocalGuestData();
    return true;
  });
}

async function saveRating(val) {
  const book = state.pendingRatingBook;
  if (!book) return;
  if (!requireAuth('rate books')) return;
  if (!await toggleBookRating(book, val)) return;
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function copyCurrentLink(label = 'Link') {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    showToast(`${label} copied`);
  } catch {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    showToast(`${label} copied`);
  }
}

// ─── CREATE LIST MODAL ────────────────────────────────────────────────────
let createListBooks = []; // books added to the new list
let createListSearchResults = [];
let createListSearchRequest = 0;
let createListSearchTimer = null;

function openCreateListModal() {
  if (!requireAuth('create lists')) return;
  const modal = document.getElementById('create-list-modal');
  renderCreateListBooks();
  openModal('create-list-modal', '#create-list-title');
}

function closeCreateListModal() {
  clearTimeout(createListSearchTimer);
  createListSearchRequest++;
  closeModal('create-list-modal');
}

function resetCreateListDraft() {
  createListBooks = [];
  createListSearchResults = [];
  document.getElementById('create-list-title').value = '';
  document.getElementById('create-list-desc').value = '';
  document.getElementById('create-list-search').value = '';
  document.getElementById('create-list-search-results').innerHTML = '';
  renderCreateListBooks();
}

function renderCreateListBooks() {
  const el = document.getElementById('create-list-books');
  if (!el) return;
  if (!createListBooks.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:13px;font-style:italic;padding:12px 0">No books added yet. Search above to add books.</div>`;
    return;
  }
  el.innerHTML = createListBooks.map((b, i) => `
    <div class="create-list-book-item">
      <span class="create-list-book-num">${i + 1}</span>
      <div class="create-list-book-info">
        <div class="create-list-book-title">${escHtml(b.title)}</div>
        <div class="create-list-book-author">${escHtml(b.author)}</div>
      </div>
      <button class="create-list-remove-btn" data-idx="${i}" title="Remove">✕</button>
    </div>
  `).join('');

  el.querySelectorAll('.create-list-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      createListBooks.splice(parseInt(btn.dataset.idx), 1);
      renderCreateListBooks();
    });
  });
}

async function searchBooksForListCreation(query) {
  const resultsEl = document.getElementById('create-list-search-results');
  const trimmed = query.trim();
  const requestId = ++createListSearchRequest;
  if (!trimmed) { createListSearchResults = []; resultsEl.innerHTML = ''; return; }
  resultsEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Searching…</div>`;
  try {
    const results = await searchBooks(trimmed, 8);
    if (requestId !== createListSearchRequest) return;
    createListSearchResults = results;
    if (!results.length) {
      resultsEl.innerHTML = `<div class="create-list-search-status">No books found for “${escHtml(trimmed)}”.</div>`;
      return;
    }
    resultsEl.innerHTML = results.map((b, index) => `
      <button type="button" class="create-list-search-item" data-index="${index}">
        ${b.coverUrl ? `<img src="${escHtml(coverUrl(b.coverUrl, 'S'))}" alt="">` : '<span class="create-list-search-cover" aria-hidden="true"></span>'}
        <span class="create-list-search-copy"><span class="create-list-search-title">${escHtml(b.title)}</span><span class="create-list-search-author">${escHtml(b.author)}${b.year ? ` · ${escHtml(b.year)}` : ''}</span></span>
        <span class="create-list-search-add" aria-hidden="true">+</span>
      </button>
    `).join('');

    resultsEl.querySelectorAll('.create-list-search-item').forEach(item => {
      item.addEventListener('click', async () => {
        const selected = createListSearchResults[Number(item.dataset.index)];
        if (!selected) return;
        const { title, author } = selected;
        if (createListBooks.some(b => b.title === title && b.author === author)) {
          showToast('Already in list', 'info');
          return;
        }
        createListBooks.push(selected);
        renderCreateListBooks();
        showToast(`Added "${title}"`);
        document.getElementById('create-list-search').value = '';
        resultsEl.innerHTML = '';
      });
    });
  } catch (e) {
    if (requestId !== createListSearchRequest) return;
    resultsEl.innerHTML = `<div class="create-list-search-status is-error">Search is unavailable right now. Please try again.</div>`;
  }
}

async function submitCreateList() {
  const title = document.getElementById('create-list-title').value.trim();
  const desc = document.getElementById('create-list-desc').value.trim();
  const submitBtn = document.getElementById('create-list-submit');

  if (!title) { showToast('Please add a title', 'error'); return; }
  if (!createListBooks.length) { showToast('Add at least one book', 'error'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';

  try {
    await createUserList(title, desc, createListBooks);
    closeCreateListModal();
    resetCreateListDraft();
    showToast('List created!');
    listsPageLoaded = false;
    loadListsPreviews();
  } catch (e) {
    showToast(e.message || 'Failed to create list', 'error');
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Create List';
}

// ─── AUTH MODAL ──────────────────────────────────────────────────────────
let authMode = 'signup'; // 'signup' or 'login'

function openAuthModal(mode = 'signup') {
  authMode = mode;
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchText = document.getElementById('auth-switch-text');
  const switchLink = document.getElementById('auth-switch-link');
  const usernameField = document.getElementById('auth-username-field');
  const errorEl = document.getElementById('auth-error');

  if (mode === 'signup') {
    title.textContent = 'Sign up';
    subtitle.textContent = 'Create an account to save your reading history across devices.';
    submitBtn.textContent = 'Sign up';
    switchText.textContent = 'Already have an account?';
    switchLink.textContent = 'Log in';
    usernameField.style.display = '';
  } else {
    title.textContent = 'Log in';
    subtitle.textContent = 'Welcome back! Log in to access your library.';
    submitBtn.textContent = 'Log in';
    switchText.textContent = "Don't have an account?";
    switchLink.textContent = 'Sign up';
    usernameField.style.display = 'none';
  }
  errorEl.style.display = 'none';
  openModal('auth-modal', mode === 'signup' ? '#auth-username' : '#auth-email');
}

function closeAuthModal() {
  closeModal('auth-modal');
  document.getElementById('auth-error').style.display = 'none';
}

// ─── INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Init auth first
  try { await initAuth(); }
  catch (error) { showToast(error.message || "Could not load your account.", "error"); updateAuthUI(); }

  // Nav
  document.querySelectorAll('nav a[data-page]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.page);
      document.getElementById('main-nav')?.classList.remove('open');
    });
  });

  // Mobile menu
  document.getElementById('mobile-menu-btn')?.addEventListener('click', async () => {
    document.getElementById('main-nav')?.classList.toggle('open');
  });

  document.getElementById('logo-link')?.addEventListener('click', e => { e.preventDefault(); navigate('home'); });
  document.getElementById('profile-nav-link')?.addEventListener('click', e => { e.preventDefault(); navigate('profile'); });
  document.getElementById('wishlist-tile')?.addEventListener('click', () => navigate('wishlist'));

  // Header auth buttons
  document.getElementById('header-login-btn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('header-signup-btn')?.addEventListener('click', () => openAuthModal('signup'));
  document.getElementById('header-logout-btn')?.addEventListener('click', logOut);
  document.getElementById('profile-logout-btn')?.addEventListener('click', logOut);
  document.getElementById('read-sort')?.addEventListener('change', renderReadList);

  // Auth modal
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });
  document.addEventListener('keydown', trapModalFocus);

  document.getElementById('auth-switch-link')?.addEventListener('click', e => {
    e.preventDefault();
    openAuthModal(authMode === 'signup' ? 'login' : 'signup');
  });

  document.getElementById('auth-submit-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = document.getElementById('auth-username').value.trim();
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (!email || !password) { errorEl.textContent = 'Please fill in all fields.'; errorEl.style.display = ''; return; }
    if (password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; errorEl.style.display = ''; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = authMode === 'signup' ? 'Creating account…' : 'Logging in…';

    try {
      if (authMode === 'signup') {
        await signUp(email, password, username || 'Reader');
        closeAuthModal();
        // Show confirmation modal
        document.getElementById('confirm-email-addr').textContent = email;
        openModal('confirm-modal', '#confirm-ok-btn');
      } else {
        await logIn(email, password);
        closeAuthModal();
        showToast(`Welcome back, ${state.username}!`);
        // Re-render if on profile
        if (state.currentPage === 'profile') loadProfilePage();
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong. Please try again.';
      errorEl.style.display = '';
    }

    submitBtn.disabled = false;
    submitBtn.textContent = authMode === 'signup' ? 'Sign up' : 'Log in';
  });

  // Allow Enter to submit auth form
  ['auth-email', 'auth-password', 'auth-username'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('auth-submit-btn')?.click();
    });
  });

  document.getElementById('confirm-ok-btn')?.addEventListener('click', async () => {
    closeModal('confirm-modal');
  });

  // Header search
  document.getElementById('header-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) navigate('search', { query: e.target.value.trim() });
  });

  // Search page
  document.getElementById('search-btn')?.addEventListener('click', async () => {
    const q = document.getElementById('main-search-input').value.trim();
    if (q) doSearch(q);
  });
  document.getElementById('main-search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) doSearch(e.target.value.trim());
  });
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const genre = chip.dataset.genre;
      document.getElementById('main-search-input').value = genre;
      doGenreSearch(genre);
    });
  });

  // Hero
  document.getElementById('hero-search-btn')?.addEventListener('click', async () => {
    if (state.user) {
      navigate('search');
      setTimeout(() => document.getElementById('main-search-input')?.focus(), 100);
    } else {
      openAuthModal('signup');
    }
  });
  document.getElementById('hero-profile-btn')?.addEventListener('click', () => navigate('profile'));
  document.getElementById('hero-explore-btn')?.addEventListener('click', async () => {
    navigate('search');
    setTimeout(() => document.getElementById('main-search-input')?.focus(), 100);
  });
  document.getElementById('blind-date-entry')?.addEventListener('click', () => navigate('blind-date'));
  document.getElementById('hp-continue-more')?.addEventListener('click', e => { e.preventDefault(); navigate('profile'); });
  document.getElementById('hp-lists-more')?.addEventListener('click', e => { e.preventDefault(); navigate('lists'); });

  // Rating modal stars
  document.querySelectorAll('.modal-star').forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      document.querySelectorAll('.modal-star').forEach((s, i) => s.classList.toggle('hover-fill', i < val));
    });
    star.addEventListener('mouseleave', () => {
      document.querySelectorAll('.modal-star').forEach(s => s.classList.remove('hover-fill'));
      const book = state.pendingRatingBook;
      if (book) {
        const cur = state.ratings[book.key] || 0;
        document.querySelectorAll('.modal-star').forEach(s => s.classList.toggle('filled', parseInt(s.dataset.val) <= cur));
      }
    });
    star.addEventListener('click', () => saveRating(parseInt(star.dataset.val)));
  });
  document.getElementById('modal-cancel')?.addEventListener('click', closeRatingModal);
  document.getElementById('rating-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeRatingModal(); });

  // Profile editing
  document.getElementById('edit-username-btn')?.addEventListener('click', async () => {
    const form = document.getElementById('edit-name-form');
    const input = document.getElementById('username-input');
    const bioInput = document.getElementById('bio-input');
    const avatarInput = document.getElementById('avatar-url-input');
    const wishlistInput = document.getElementById('wishlist-public-input');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    if (input) { input.value = state.username; input.focus(); }
    if (bioInput) bioInput.value = state.bio || '';
    if (avatarInput) avatarInput.value = state.avatarUrl || '';
    if (wishlistInput) wishlistInput.checked = state.wishlistIsPublic;
  });
  document.getElementById('save-username-btn')?.addEventListener('click', async () => {
    const val = document.getElementById('username-input').value.trim();
    const bioVal = document.getElementById('bio-input')?.value.trim() || '';
    const avatarVal = document.getElementById('avatar-url-input')?.value.trim() || '';
    const wishlistIsPublic = document.getElementById('wishlist-public-input')?.checked !== false;
    if (val) {
      if (state.user) {
        if (!await saveMutation(queryResult(sb.from('profiles').update({ username: val, bio: bioVal, avatar_url: avatarVal || null, wishlist_is_public: wishlistIsPublic }).eq('id', state.user.id)))) return;
      }
      state.username = val;
      state.bio = bioVal;
      state.avatarUrl = avatarVal;
      state.wishlistIsPublic = wishlistIsPublic;
      saveLocalGuestData();
      document.getElementById('profile-username').textContent = val;
      // Update avatar
      const avatarEl = document.getElementById('profile-avatar-letter');
      if (avatarEl) {
        if (avatarVal) {
          avatarEl.innerHTML = `<img src="${escHtml(avatarVal)}" alt="${escHtml(val)}" class="profile-big-avatar-img" onerror="this.remove();this.parentElement.textContent='${val[0].toUpperCase()}'">`;
        } else {
          avatarEl.textContent = val[0].toUpperCase();
        }
      }
      const smallAvatar = document.getElementById('profile-avatar-small');
      if (smallAvatar) {
        if (avatarVal) {
          smallAvatar.innerHTML = `<img src="${escHtml(avatarVal)}" alt="" class="header-avatar-img" onerror="this.remove();this.parentElement.textContent='${val[0].toUpperCase()}'">`;
        } else {
          smallAvatar.textContent = val[0].toUpperCase();
        }
      }
      const bioEl = document.getElementById('profile-bio');
      if (bioEl) { bioEl.textContent = bioVal; bioEl.style.display = bioVal ? '' : 'none'; }
      document.getElementById('edit-name-form').style.display = 'none';
      showToast('Profile updated!');
    }
  });

  // Shelf arrows
  initShelfArrows();

  // Create list modal
  document.getElementById('create-list-btn')?.addEventListener('click', openCreateListModal);
  document.getElementById('create-list-modal-close')?.addEventListener('click', closeCreateListModal);
  document.getElementById('create-list-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeCreateListModal(); });
  document.getElementById('create-list-submit')?.addEventListener('click', submitCreateList);

  document.getElementById('create-list-search')?.addEventListener('input', (e) => {
    clearTimeout(createListSearchTimer);
    const query = e.target.value;
    if (!query.trim()) { searchBooksForListCreation(''); return; }
    createListSearchTimer = setTimeout(() => searchBooksForListCreation(query), 250);
  });

  window.addEventListener('popstate', () => {
    const route = routeFromLocation();
    navigate(route.page, route.params);
  });
  const initialRoute = routeFromLocation();
  navigate(initialRoute.page, initialRoute.params);
});
