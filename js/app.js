// ─── SUPABASE ───────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ycejifwmvlpjewbsbrub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZWppZndtdmxwamV3YnNicnViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjU4MDksImV4cCI6MjA5MTQwMTgwOX0.wCbsCkjSoSgEBniitnMVmhdiCnTxg94xnzD6K6VUUOA';

let sb = null;
try {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient)
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) { }

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
  currentList: null,
  searchQuery: '',
  searchResults: [],
  popularBooks: [],
  classicsBooks: [],
  fictionBooks: [],
  pendingRatingBook: null,
  isAdmin: false,
  bio: '',
  avatarUrl: '',
  blindDate: null,
};

// ─── AUTH ────────────────────────────────────────────────────────────────
async function initAuth() {
  if (!sb) {
    // Offline mode — load from localStorage
    state.username = localStorage.getItem('lbx_username') || 'Reader';
    state.readBooks = JSON.parse(localStorage.getItem('lbx_read') || '{}');
    state.ratings = JSON.parse(localStorage.getItem('lbx_ratings') || '{}');
    state.favorites = JSON.parse(localStorage.getItem('lbx_favorites') || '[]');
    state.wishlist = JSON.parse(localStorage.getItem('lbx_wishlist') || '{}');
    updateAuthUI();
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    state.user = session.user;
    await loadUserData();
  } else {
    // Not logged in — load from localStorage as fallback
    state.username = localStorage.getItem('lbx_username') || 'Reader';
    state.readBooks = JSON.parse(localStorage.getItem('lbx_read') || '{}');
    state.ratings = JSON.parse(localStorage.getItem('lbx_ratings') || '{}');
    state.favorites = JSON.parse(localStorage.getItem('lbx_favorites') || '[]');
    state.wishlist = JSON.parse(localStorage.getItem('lbx_wishlist') || '{}');
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
      await sb.from('read_books').upsert(
        readEntries.map(b => ({
          user_id: userId, book_key: b.key, title: b.title,
          author: b.author, cover_url: b.coverUrl, year: b.year, date_read: b.dateRead,
        })),
        { onConflict: 'user_id,book_key' }
      );
    }

    const ratingEntries = Object.entries(oldRatings).filter(([k, v]) => v > 0);
    if (ratingEntries.length) {
      await sb.from('ratings').upsert(
        ratingEntries.map(([key, rating]) => ({
          user_id: userId, book_key: key, rating,
        })),
        { onConflict: 'user_id,book_key' }
      );
    }

    if (oldFavs.length) {
      await sb.from('favorites').upsert(
        oldFavs.map((f, i) => ({
          user_id: userId, book_key: f.key, title: f.title,
          author: f.author, cover_url: f.coverUrl, position: i,
        })),
        { onConflict: 'user_id,book_key' }
      );
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
  let profile;
  const { data: p1, error: e1 } = await sb
    .from('profiles').select('username, is_admin, bio, avatar_url').eq('id', uid).single();
  if (e1) {
    const { data: p2 } = await sb
      .from('profiles').select('username, is_admin, bio').eq('id', uid).single();
    profile = p2;
  } else {
    profile = p1;
  }
  state.username = profile?.username || state.user.user_metadata?.username || 'Reader';
  state.isAdmin = !!profile?.is_admin;
  state.bio = profile?.bio || '';
  state.avatarUrl = profile?.avatar_url || '';

  // Load read books
  const { data: reads } = await sb
    .from('read_books').select('*').eq('user_id', uid);
  state.readBooks = {};
  (reads || []).forEach(r => {
    state.readBooks[r.book_key] = {
      key: r.book_key, title: r.title, author: r.author,
      coverUrl: r.cover_url, year: r.year, dateRead: r.date_read,
    };
  });

  // Load ratings
  const { data: rats } = await sb
    .from('ratings').select('*').eq('user_id', uid);
  state.ratings = {};
  (rats || []).forEach(r => { state.ratings[r.book_key] = r.rating; });

  // Load favorites
  const { data: favs } = await sb
    .from('favorites').select('*').eq('user_id', uid).order('position');
  state.favorites = (favs || []).map(f => ({
    key: f.book_key, title: f.title, author: f.author, coverUrl: f.cover_url,
  }));

  // Load wishlist (read later)
  try {
    const { data: wish } = await sb
      .from('wishlist').select('*').eq('user_id', uid);
    state.wishlist = {};
    (wish || []).forEach(w => {
      state.wishlist[w.book_key] = {
        key: w.book_key, title: w.title, author: w.author,
        coverUrl: w.cover_url, year: w.year, dateAdded: w.date_added,
      };
    });
  } catch (e) {
    state.wishlist = {};
  }
}

// Save functions — write to Supabase if logged in, localStorage as fallback
async function save() {
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

async function loadAllLists() {
  if (!sb) return {};
  try {
    // Load all lists with their books in one query using a join
    const { data: lists, error } = await sb
      .from('lists')
      .select('*, list_books(id, title, author, position)')
      .order('is_curated', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    // Clear and rebuild cache
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
    return listsCache;
  } catch (e) {
    return {};
  }
}

async function loadListBooks(listId) {
  if (!sb) return [];
  if (listsCache[listId]?.books?.length) return listsCache[listId].books;
  try {
    const { data, error } = await sb
      .from('list_books')
      .select('title, author, position')
      .eq('list_id', listId)
      .order('position');
    if (error) throw error;
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
  const { error: listError } = await sb.from('lists').insert({
    id,
    user_id: state.user.id,
    title,
    source: state.username,
    year: new Date().getFullYear().toString(),
    description,
    is_curated: false,
  });
  if (listError) throw listError;

  if (books.length) {
    const rows = books.map((b, i) => ({
      list_id: id,
      title: b.title,
      author: b.author,
      position: i,
    }));
    const { error: booksError } = await sb.from('list_books').insert(rows);
    if (booksError) throw booksError;
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

  return id;
}

async function deleteUserList(listId) {
  if (!sb || !state.user) return;
  const list = listsCache[listId];
  if (!list || list.is_curated || list.user_id !== state.user.id) return;
  await sb.from('list_books').delete().eq('list_id', listId);
  await sb.from('lists').delete().eq('id', listId);
  delete listsCache[listId];
}

// Fallback hardcoded list IDs for offline mode
const CURATED_LIST_IDS = ['lemonde', 'modernlibrary', 'telegraph', 'bbc', 'time', 'guardian'];

const CURATED_LISTS_OFFLINE = {
  lemonde: {
    title: "Le Monde's 100 Books of the Century",
    source: "Le Monde",
    year: "1999",
    desc: "In 1999, the French newspaper Le Monde asked its readers to vote for the greatest books of the 20th century. The result was a fascinating cross-section of world literature.",
    books: [
      { title: "In Search of Lost Time", author: "Marcel Proust" },
      { title: "The Trial", author: "Franz Kafka" },
      { title: "Journey to the End of the Night", author: "Louis-Ferdinand Céline" },
      { title: "The Stranger", author: "Albert Camus" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "The Little Prince", author: "Antoine de Saint-Exupéry" },
      { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "The Sound and the Fury", author: "William Faulkner" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "The Master and Margarita", author: "Mikhail Bulgakov" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "The Plague", author: "Albert Camus" },
      { title: "Nausea", author: "Jean-Paul Sartre" },
      { title: "Waiting for Godot", author: "Samuel Beckett" },
      { title: "The Tin Drum", author: "Günter Grass" },
      { title: "The Old Man and the Sea", author: "Ernest Hemingway" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "For Whom the Bell Tolls", author: "Ernest Hemingway" },
      { title: "The Name of the Rose", author: "Umberto Eco" },
      { title: "Gone with the Wind", author: "Margaret Mitchell" },
      { title: "The Diary of a Young Girl", author: "Anne Frank" },
      { title: "The Second Sex", author: "Simone de Beauvoir" },
      { title: "If This Is a Man", author: "Primo Levi" },
      { title: "The Leopard", author: "Giuseppe Tomasi di Lampedusa" },
      { title: "Doctor Zhivago", author: "Boris Pasternak" },
      { title: "The Tropic of Cancer", author: "Henry Miller" },
      { title: "Man's Fate", author: "André Malraux" },
      { title: "Being and Nothingness", author: "Jean-Paul Sartre" },
      { title: "A Room of One's Own", author: "Virginia Woolf" },
      { title: "The Counterfeiters", author: "André Gide" },
      { title: "The Lover", author: "Marguerite Duras" },
      { title: "Les Enfants Terribles", author: "Jean Cocteau" },
      { title: "Beloved", author: "Toni Morrison" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "Ficciones", author: "Jorge Luis Borges" },
      { title: "The Unbearable Lightness of Being", author: "Milan Kundera" },
      { title: "The Metamorphosis", author: "Franz Kafka" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "The Bell Jar", author: "Sylvia Plath" },
      { title: "Steppenwolf", author: "Hermann Hesse" },
      { title: "Siddhartha", author: "Hermann Hesse" },
      { title: "The Glass Bead Game", author: "Hermann Hesse" },
      { title: "Things Fall Apart", author: "Chinua Achebe" },
      { title: "Animal Farm", author: "George Orwell" },
      { title: "A Farewell to Arms", author: "Ernest Hemingway" },
      { title: "Death in Venice", author: "Thomas Mann" },
      { title: "The Magic Mountain", author: "Thomas Mann" },
      { title: "Buddenbrooks", author: "Thomas Mann" },
      { title: "All Quiet on the Western Front", author: "Erich Maria Remarque" },
      { title: "Berlin Alexanderplatz", author: "Alfred Döblin" },
      { title: "Nadja", author: "André Breton" },
      { title: "The Tartar Steppe", author: "Dino Buzzati" },
      { title: "The Stranger", author: "Albert Camus" },
      { title: "The Myth of Sisyphus", author: "Albert Camus" },
      { title: "No Exit", author: "Jean-Paul Sartre" },
      { title: "The Mandarins", author: "Simone de Beauvoir" },
      { title: "Memoirs of Hadrian", author: "Marguerite Yourcenar" },
      { title: "Zazie in the Metro", author: "Raymond Queneau" },
      { title: "The Ravishing of Lol Stein", author: "Marguerite Duras" },
      { title: "Tropism", author: "Nathalie Sarraute" },
      { title: "A Void", author: "Georges Perec" },
      { title: "Life: A User's Manual", author: "Georges Perec" },
      { title: "W, or the Memory of Childhood", author: "Georges Perec" },
      { title: "The Opposing Shore", author: "Julien Gracq" },
      { title: "Friday", author: "Michel Tournier" },
      { title: "Bonjour Tristesse", author: "Françoise Sagan" },
      { title: "Thérèse Desqueyroux", author: "François Mauriac" },
      { title: "The Horseman on the Roof", author: "Jean Giono" },
      { title: "Strait Is the Gate", author: "André Gide" },
      { title: "The Immoralist", author: "André Gide" },
      { title: "The Voyeur", author: "Alain Robbe-Grillet" },
      { title: "Jealousy", author: "Alain Robbe-Grillet" },
      { title: "The Erasers", author: "Alain Robbe-Grillet" },
      { title: "Moderato Cantabile", author: "Marguerite Duras" },
      { title: "The Wind", author: "Claude Simon" },
      { title: "The Flanders Road", author: "Claude Simon" },
      { title: "The Bald Soprano", author: "Eugène Ionesco" },
      { title: "Rhinoceros", author: "Eugène Ionesco" },
      { title: "Endgame", author: "Samuel Beckett" },
      { title: "Molloy", author: "Samuel Beckett" },
      { title: "The Unnamable", author: "Samuel Beckett" },
      { title: "The Roots of Heaven", author: "Romain Gary" },
      { title: "Promise at Dawn", author: "Romain Gary" },
      { title: "The Life Before Us", author: "Romain Gary" },
      { title: "Gargantua and Pantagruel", author: "François Rabelais" },
      { title: "Germinal", author: "Émile Zola" },
      { title: "Les Misérables", author: "Victor Hugo" },
      { title: "Madame Bovary", author: "Gustave Flaubert" },
      { title: "The Red and the Black", author: "Stendhal" },
      { title: "The Count of Monte Cristo", author: "Alexandre Dumas" },
      { title: "Cyrano de Bergerac", author: "Edmond Rostand" },
    ]
  },
  modernlibrary: {
    title: "Modern Library 100 Best Novels",
    source: "Modern Library",
    year: "1998",
    desc: "The board's selection of the 100 best English-language novels published since 1900. A canonical list that has sparked endless debate since its publication.",
    books: [
      { title: "Ulysses", author: "James Joyce" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "A Portrait of the Artist as a Young Man", author: "James Joyce" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "The Sound and the Fury", author: "William Faulkner" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "Darkness at Noon", author: "Arthur Koestler" },
      { title: "Sons and Lovers", author: "D.H. Lawrence" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "Under the Volcano", author: "Malcolm Lowry" },
      { title: "The Way of All Flesh", author: "Samuel Butler" },
      { title: "1984", author: "George Orwell" },
      { title: "I, Claudius", author: "Robert Graves" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "An American Tragedy", author: "Theodore Dreiser" },
      { title: "The Heart Is a Lonely Hunter", author: "Carson McCullers" },
      { title: "Slaughterhouse-Five", author: "Kurt Vonnegut" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "Native Son", author: "Richard Wright" },
      { title: "Henderson the Rain King", author: "Saul Bellow" },
      { title: "Appointment in Samarra", author: "John O'Hara" },
      { title: "U.S.A. Trilogy", author: "John Dos Passos" },
      { title: "Winesburg, Ohio", author: "Sherwood Anderson" },
      { title: "A Passage to India", author: "E.M. Forster" },
      { title: "The Wings of the Dove", author: "Henry James" },
      { title: "The Ambassadors", author: "Henry James" },
      { title: "Tender Is the Night", author: "F. Scott Fitzgerald" },
      { title: "The Studs Lonigan Trilogy", author: "James T. Farrell" },
      { title: "The Good Soldier", author: "Ford Madox Ford" },
      { title: "Animal Farm", author: "George Orwell" },
      { title: "The Golden Bowl", author: "Henry James" },
      { title: "Sister Carrie", author: "Theodore Dreiser" },
      { title: "A Handful of Dust", author: "Evelyn Waugh" },
      { title: "As I Lay Dying", author: "William Faulkner" },
      { title: "All the King's Men", author: "Robert Penn Warren" },
      { title: "The Bridge of San Luis Rey", author: "Thornton Wilder" },
      { title: "Howards End", author: "E.M. Forster" },
      { title: "Go Tell It on the Mountain", author: "James Baldwin" },
      { title: "The Heart of the Matter", author: "Graham Greene" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Deliverance", author: "James Dickey" },
      { title: "A Dance to the Music of Time", author: "Anthony Powell" },
      { title: "Point Counter Point", author: "Aldous Huxley" },
      { title: "The Sun Also Rises", author: "Ernest Hemingway" },
      { title: "The Secret Agent", author: "Joseph Conrad" },
      { title: "Nostromo", author: "Joseph Conrad" },
      { title: "The Rainbow", author: "D.H. Lawrence" },
      { title: "Women in Love", author: "D.H. Lawrence" },
      { title: "Tropic of Cancer", author: "Henry Miller" },
      { title: "The Naked and the Dead", author: "Norman Mailer" },
      { title: "Portnoy's Complaint", author: "Philip Roth" },
      { title: "Pale Fire", author: "Vladimir Nabokov" },
      { title: "Light in August", author: "William Faulkner" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "The Maltese Falcon", author: "Dashiell Hammett" },
      { title: "Parade's End", author: "Ford Madox Ford" },
      { title: "The Age of Innocence", author: "Edith Wharton" },
      { title: "Zuleika Dobson", author: "Max Beerbohm" },
      { title: "The Moviegoer", author: "Walker Percy" },
      { title: "Death Comes for the Archbishop", author: "Willa Cather" },
      { title: "From Here to Eternity", author: "James Jones" },
      { title: "The Wapshot Chronicles", author: "John Cheever" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "Of Human Bondage", author: "W. Somerset Maugham" },
      { title: "Heart of Darkness", author: "Joseph Conrad" },
      { title: "Main Street", author: "Sinclair Lewis" },
      { title: "The House of Mirth", author: "Edith Wharton" },
      { title: "The Alexandria Quartet", author: "Lawrence Durrell" },
      { title: "A High Wind in Jamaica", author: "Richard Hughes" },
      { title: "A House for Mr Biswas", author: "V.S. Naipaul" },
      { title: "The Day of the Locust", author: "Nathanael West" },
      { title: "A Farewell to Arms", author: "Ernest Hemingway" },
      { title: "Scoop", author: "Evelyn Waugh" },
      { title: "The Prime of Miss Jean Brodie", author: "Muriel Spark" },
      { title: "Finnegans Wake", author: "James Joyce" },
      { title: "Kim", author: "Rudyard Kipling" },
      { title: "A Room with a View", author: "E.M. Forster" },
      { title: "Brideshead Revisited", author: "Evelyn Waugh" },
      { title: "The Adventures of Augie March", author: "Saul Bellow" },
      { title: "Angle of Repose", author: "Wallace Stegner" },
      { title: "A Bend in the River", author: "V.S. Naipaul" },
      { title: "The Death of the Heart", author: "Elizabeth Bowen" },
      { title: "Lord Jim", author: "Joseph Conrad" },
      { title: "Ragtime", author: "E.L. Doctorow" },
      { title: "The Old Wives' Tale", author: "Arnold Bennett" },
      { title: "The Call of the Wild", author: "Jack London" },
      { title: "Loving", author: "Henry Green" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "Tobacco Road", author: "Erskine Caldwell" },
      { title: "Ironweed", author: "William Kennedy" },
      { title: "The Magus", author: "John Fowles" },
      { title: "Wide Sargasso Sea", author: "Jean Rhys" },
      { title: "Under the Net", author: "Iris Murdoch" },
      { title: "Sophie's Choice", author: "William Styron" },
      { title: "The Sheltering Sky", author: "Paul Bowles" },
      { title: "The Postman Always Rings Twice", author: "James M. Cain" },
      { title: "The Ginger Man", author: "J.P. Donleavy" },
      { title: "The Magnificent Ambersons", author: "Booth Tarkington" },
    ]
  },
  telegraph: {
    title: "The Telegraph's Greatest Villains in Literature",
    source: "The Telegraph",
    year: "2008",
    desc: "The most compelling, chilling and unforgettable antagonists ever committed to the page — the books that gave us literature's greatest monsters.",
    books: [
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "Crime and Punishment", author: "Fyodor Dostoevsky" },
      { title: "American Psycho", author: "Bret Easton Ellis" },
      { title: "We Need to Talk About Kevin", author: "Lionel Shriver" },
      { title: "Perfume", author: "Patrick Süskind" },
      { title: "The Talented Mr Ripley", author: "Patricia Highsmith" },
      { title: "Rebecca", author: "Daphne du Maurier" },
      { title: "No Country for Old Men", author: "Cormac McCarthy" },
      { title: "The Silence of the Lambs", author: "Thomas Harris" },
      { title: "Frankenstein", author: "Mary Shelley" },
      { title: "Blood Meridian", author: "Cormac McCarthy" },
      { title: "The Picture of Dorian Gray", author: "Oscar Wilde" },
      { title: "Dracula", author: "Bram Stoker" },
      { title: "Gone Girl", author: "Gillian Flynn" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "The Shining", author: "Stephen King" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Misery", author: "Stephen King" },
      { title: "Battle Royale", author: "Koushun Takami" },
      { title: "Wuthering Heights", author: "Emily Brontë" },
      { title: "Othello", author: "William Shakespeare" },
      { title: "Paradise Lost", author: "John Milton" },
      { title: "The Count of Monte Cristo", author: "Alexandre Dumas" },
      { title: "Great Expectations", author: "Charles Dickens" },
      { title: "Oliver Twist", author: "Charles Dickens" },
      { title: "The Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson" },
      { title: "Moby-Dick", author: "Herman Melville" },
      { title: "The Phantom of the Opera", author: "Gaston Leroux" },
      { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle" },
      { title: "Heart of Darkness", author: "Joseph Conrad" },
      { title: "The Turn of the Screw", author: "Henry James" },
      { title: "One Flew Over the Cuckoo's Nest", author: "Ken Kesey" },
      { title: "The Collector", author: "John Fowles" },
      { title: "Rosemary's Baby", author: "Ira Levin" },
      { title: "The Exorcist", author: "William Peter Blatty" },
      { title: "The Omen", author: "David Seltzer" },
      { title: "Carrie", author: "Stephen King" },
      { title: "It", author: "Stephen King" },
      { title: "Pet Sematary", author: "Stephen King" },
      { title: "The Stand", author: "Stephen King" },
      { title: "Hannibal", author: "Thomas Harris" },
      { title: "Red Dragon", author: "Thomas Harris" },
      { title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson" },
      { title: "Sharp Objects", author: "Gillian Flynn" },
      { title: "The Secret History", author: "Donna Tartt" },
      { title: "And Then There Were None", author: "Agatha Christie" },
      { title: "The Murder of Roger Ackroyd", author: "Agatha Christie" },
      { title: "In Cold Blood", author: "Truman Capote" },
      { title: "The Talented Mr. Ripley", author: "Patricia Highsmith" },
      { title: "A Good Man Is Hard to Find", author: "Flannery O'Connor" },
      { title: "The Wasp Factory", author: "Iain Banks" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Enduring Love", author: "Ian McEwan" },
      { title: "The Comfort of Strangers", author: "Ian McEwan" },
      { title: "The Haunting of Hill House", author: "Shirley Jackson" },
      { title: "We Have Always Lived in the Castle", author: "Shirley Jackson" },
      { title: "Something Wicked This Way Comes", author: "Ray Bradbury" },
      { title: "The Island of Doctor Moreau", author: "H.G. Wells" },
      { title: "The Invisible Man", author: "H.G. Wells" },
      { title: "The War of the Worlds", author: "H.G. Wells" },
      { title: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick" },
      { title: "The Stepford Wives", author: "Ira Levin" },
      { title: "The Boys from Brazil", author: "Ira Levin" },
      { title: "Psycho", author: "Robert Bloch" },
      { title: "The Phantom of the Opera", author: "Gaston Leroux" },
      { title: "The Monk", author: "Matthew Lewis" },
      { title: "The Castle of Otranto", author: "Horace Walpole" },
      { title: "The Mysteries of Udolpho", author: "Ann Radcliffe" },
      { title: "Northanger Abbey", author: "Jane Austen" },
      { title: "Jane Eyre", author: "Charlotte Brontë" },
      { title: "Villette", author: "Charlotte Brontë" },
      { title: "The Woman in White", author: "Wilkie Collins" },
      { title: "The Moonstone", author: "Wilkie Collins" },
      { title: "Bleak House", author: "Charles Dickens" },
      { title: "A Tale of Two Cities", author: "Charles Dickens" },
      { title: "The Hunchback of Notre-Dame", author: "Victor Hugo" },
      { title: "Les Misérables", author: "Victor Hugo" },
      { title: "The Brothers Karamazov", author: "Fyodor Dostoevsky" },
      { title: "Notes from Underground", author: "Fyodor Dostoevsky" },
      { title: "Dead Souls", author: "Nikolai Gogol" },
      { title: "Anna Karenina", author: "Leo Tolstoy" },
      { title: "War and Peace", author: "Leo Tolstoy" },
      { title: "The Master and Margarita", author: "Mikhail Bulgakov" },
      { title: "Child of God", author: "Cormac McCarthy" },
      { title: "Outer Dark", author: "Cormac McCarthy" },
      { title: "The Road", author: "Cormac McCarthy" },
      { title: "Under the Skin", author: "Michel Faber" },
      { title: "The Dice Man", author: "Luke Rhinehart" },
      { title: "Filth", author: "Irvine Welsh" },
      { title: "Trainspotting", author: "Irvine Welsh" },
      { title: "The Killer Inside Me", author: "Jim Thompson" },
      { title: "The Getaway", author: "Jim Thompson" },
      { title: "Clockers", author: "Richard Price" },
      { title: "The Devil All the Time", author: "Donald Ray Pollock" },
      { title: "Tampa", author: "Alissa Nutting" },
      { title: "You", author: "Caroline Kepnes" },
      { title: "My Year of Rest and Relaxation", author: "Ottessa Moshfegh" },
      { title: "Apt Pupil", author: "Stephen King" },
    ]
  },
  bbc: {
    title: "BBC's 100 Novels That Shaped Our World",
    source: "BBC",
    year: "2019",
    desc: "A celebration of fiction that has had a profound impact on culture, society and our understanding of what it means to be human.",
    books: [
      { title: "Frankenstein", author: "Mary Shelley" },
      { title: "Jane Eyre", author: "Charlotte Brontë" },
      { title: "Middlemarch", author: "George Eliot" },
      { title: "The War of the Worlds", author: "H.G. Wells" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "Their Eyes Were Watching God", author: "Zora Neale Hurston" },
      { title: "The Second Sex", author: "Simone de Beauvoir" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez" },
      { title: "The Female Eunuch", author: "Germaine Greer" },
      { title: "Watership Down", author: "Richard Adams" },
      { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams" },
      { title: "If on a winter's night a traveler", author: "Italo Calvino" },
      { title: "The Color Purple", author: "Alice Walker" },
      { title: "Beloved", author: "Toni Morrison" },
      { title: "A Room of One's Own", author: "Virginia Woolf" },
      { title: "Things Fall Apart", author: "Chinua Achebe" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "Wide Sargasso Sea", author: "Jean Rhys" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "The Handmaid's Tale", author: "Margaret Atwood" },
      { title: "The Remains of the Day", author: "Kazuo Ishiguro" },
      { title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling" },
      { title: "The Curious Incident of the Dog in the Night-Time", author: "Mark Haddon" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "In Search of Lost Time", author: "Marcel Proust" },
      { title: "The Trial", author: "Franz Kafka" },
      { title: "The Master and Margarita", author: "Mikhail Bulgakov" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "One Flew Over the Cuckoo's Nest", author: "Ken Kesey" },
      { title: "Slaughterhouse-Five", author: "Kurt Vonnegut" },
      { title: "Song of Solomon", author: "Toni Morrison" },
      { title: "Dracula", author: "Bram Stoker" },
      { title: "Rebecca", author: "Daphne du Maurier" },
      { title: "The Big Sleep", author: "Raymond Chandler" },
      { title: "The Maltese Falcon", author: "Dashiell Hammett" },
      { title: "And Then There Were None", author: "Agatha Christie" },
      { title: "The Spy Who Came in from the Cold", author: "John le Carré" },
      { title: "The Godfather", author: "Mario Puzo" },
      { title: "Gone Girl", author: "Gillian Flynn" },
      { title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson" },
      { title: "Bridget Jones's Diary", author: "Helen Fielding" },
      { title: "Pride and Prejudice", author: "Jane Austen" },
      { title: "Wuthering Heights", author: "Emily Brontë" },
      { title: "Anna Karenina", author: "Leo Tolstoy" },
      { title: "Gone with the Wind", author: "Margaret Mitchell" },
      { title: "The Thorn Birds", author: "Colleen McCullough" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Normal People", author: "Sally Rooney" },
      { title: "A Suitable Boy", author: "Vikram Seth" },
      { title: "Persepolis", author: "Marjane Satrapi" },
      { title: "A Brief History of Seven Killings", author: "Marlon James" },
      { title: "The Lord of the Rings", author: "J.R.R. Tolkien" },
      { title: "The Lion, the Witch and the Wardrobe", author: "C.S. Lewis" },
      { title: "Earthsea", author: "Ursula K. Le Guin" },
      { title: "Jonathan Strange & Mr Norrell", author: "Susanna Clarke" },
      { title: "The Hobbit", author: "J.R.R. Tolkien" },
      { title: "His Dark Materials", author: "Philip Pullman" },
      { title: "A Game of Thrones", author: "George R.R. Martin" },
      { title: "Neuromancer", author: "William Gibson" },
      { title: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick" },
      { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin" },
      { title: "Dune", author: "Frank Herbert" },
      { title: "The Day of the Triffids", author: "John Wyndham" },
      { title: "2001: A Space Odyssey", author: "Arthur C. Clarke" },
      { title: "I, Robot", author: "Isaac Asimov" },
      { title: "Foundation", author: "Isaac Asimov" },
      { title: "Kindred", author: "Octavia E. Butler" },
      { title: "The Jungle Book", author: "Rudyard Kipling" },
      { title: "Winnie-the-Pooh", author: "A.A. Milne" },
      { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" },
      { title: "Charlie and the Chocolate Factory", author: "Roald Dahl" },
      { title: "Noughts & Crosses", author: "Malorie Blackman" },
      { title: "The Diary of a Young Girl", author: "Anne Frank" },
      { title: "Pippi Longstocking", author: "Astrid Lindgren" },
      { title: "Northern Lights", author: "Philip Pullman" },
      { title: "Little Women", author: "Louisa May Alcott" },
      { title: "Charlotte's Web", author: "E.B. White" },
      { title: "The Wind in the Willows", author: "Kenneth Grahame" },
      { title: "Treasure Island", author: "Robert Louis Stevenson" },
      { title: "Black Beauty", author: "Anna Sewell" },
      { title: "The Secret Garden", author: "Frances Hodgson Burnett" },
      { title: "A Little Princess", author: "Frances Hodgson Burnett" },
      { title: "The Railway Children", author: "E. Nesbit" },
      { title: "Swallows and Amazons", author: "Arthur Ransome" },
      { title: "Ballet Shoes", author: "Noel Streatfeild" },
      { title: "The Borrowers", author: "Mary Norton" },
      { title: "The Phantom Tollbooth", author: "Norton Juster" },
      { title: "The Outsiders", author: "S.E. Hinton" },
      { title: "Roll of Thunder, Hear My Cry", author: "Mildred D. Taylor" },
      { title: "Wolf Hall", author: "Hilary Mantel" },
      { title: "White Teeth", author: "Zadie Smith" },
    ]
  },
  time: {
    title: "TIME's 100 Best Novels",
    source: "TIME Magazine",
    year: "2005",
    desc: "TIME critics Lev Grossman and Richard Lacayo's picks for the 100 best English-language novels from 1923 to the present.",
    books: [
      { title: "Beloved", author: "Toni Morrison" },
      { title: "The Complete Stories", author: "Flannery O'Connor" },
      { title: "The Corrections", author: "Jonathan Franzen" },
      { title: "The Stories of John Cheever", author: "John Cheever" },
      { title: "At Swim-Two-Birds", author: "Flann O'Brien" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Blood Meridian", author: "Cormac McCarthy" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "The Crying of Lot 49", author: "Thomas Pynchon" },
      { title: "Slaughterhouse-Five", author: "Kurt Vonnegut" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "White Noise", author: "Don DeLillo" },
      { title: "The Lord of the Rings", author: "J.R.R. Tolkien" },
      { title: "Never Let Me Go", author: "Kazuo Ishiguro" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "The Remains of the Day", author: "Kazuo Ishiguro" },
      { title: "American Pastoral", author: "Philip Roth" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "The Road", author: "Cormac McCarthy" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "A Handful of Dust", author: "Evelyn Waugh" },
      { title: "A House for Mr Biswas", author: "V.S. Naipaul" },
      { title: "In Search of Lost Time", author: "Marcel Proust" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "Light in August", author: "William Faulkner" },
      { title: "The Lion, the Witch and the Wardrobe", author: "C.S. Lewis" },
      { title: "Money", author: "Martin Amis" },
      { title: "The Moviegoer", author: "Walker Percy" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "Naked Lunch", author: "William S. Burroughs" },
      { title: "Native Son", author: "Richard Wright" },
      { title: "Neuromancer", author: "William Gibson" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "One Flew Over the Cuckoo's Nest", author: "Ken Kesey" },
      { title: "The Painted Bird", author: "Jerzy Kosiński" },
      { title: "Pale Fire", author: "Vladimir Nabokov" },
      { title: "A Passage to India", author: "E.M. Forster" },
      { title: "Play It as It Lays", author: "Joan Didion" },
      { title: "Portnoy's Complaint", author: "Philip Roth" },
      { title: "Possession", author: "A.S. Byatt" },
      { title: "The Power and the Glory", author: "Graham Greene" },
      { title: "The Prime of Miss Jean Brodie", author: "Muriel Spark" },
      { title: "Rabbit, Run", author: "John Updike" },
      { title: "Ragtime", author: "E.L. Doctorow" },
      { title: "The Recognitions", author: "William Gaddis" },
      { title: "Revolutionary Road", author: "Richard Yates" },
      { title: "The Sheltering Sky", author: "Paul Bowles" },
      { title: "Snow Crash", author: "Neal Stephenson" },
      { title: "The Sot-Weed Factor", author: "John Barth" },
      { title: "The Sound and the Fury", author: "William Faulkner" },
      { title: "The Spy Who Came in from the Cold", author: "John le Carré" },
      { title: "The Sun Also Rises", author: "Ernest Hemingway" },
      { title: "Their Eyes Were Watching God", author: "Zora Neale Hurston" },
      { title: "Things Fall Apart", author: "Chinua Achebe" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "Tropic of Cancer", author: "Henry Miller" },
      { title: "Ubik", author: "Philip K. Dick" },
      { title: "Under the Net", author: "Iris Murdoch" },
      { title: "Under the Volcano", author: "Malcolm Lowry" },
      { title: "Watchmen", author: "Alan Moore" },
      { title: "White Teeth", author: "Zadie Smith" },
      { title: "Wide Sargasso Sea", author: "Jean Rhys" },
      { title: "Winesburg, Ohio", author: "Sherwood Anderson" },
      { title: "The Wings of the Dove", author: "Henry James" },
      { title: "Women in Love", author: "D.H. Lawrence" },
      { title: "An American Tragedy", author: "Theodore Dreiser" },
      { title: "Animal Farm", author: "George Orwell" },
      { title: "Are You There God? It's Me, Margaret", author: "Judy Blume" },
      { title: "Brideshead Revisited", author: "Evelyn Waugh" },
      { title: "The Bridge of San Luis Rey", author: "Thornton Wilder" },
      { title: "Call It Sleep", author: "Henry Roth" },
      { title: "A Death in the Family", author: "James Agee" },
      { title: "The Death of the Heart", author: "Elizabeth Bowen" },
      { title: "Deliverance", author: "James Dickey" },
      { title: "Dog Soldiers", author: "Robert Stone" },
      { title: "Falconer", author: "John Cheever" },
      { title: "The French Lieutenant's Woman", author: "John Fowles" },
      { title: "The Golden Notebook", author: "Doris Lessing" },
      { title: "Go Tell It on the Mountain", author: "James Baldwin" },
      { title: "Gone with the Wind", author: "Margaret Mitchell" },
      { title: "Gravity's Rainbow", author: "Thomas Pynchon" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "The Heart Is a Lonely Hunter", author: "Carson McCullers" },
      { title: "The Heart of the Matter", author: "Graham Greene" },
      { title: "Herzog", author: "Saul Bellow" },
      { title: "Housekeeping", author: "Marilynne Robinson" },
      { title: "I, Claudius", author: "Robert Graves" },
      { title: "Infinite Jest", author: "David Foster Wallace" },
      { title: "The Jungle", author: "Upton Sinclair" },
      { title: "1984", author: "George Orwell" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "Darkness at Noon", author: "Arthur Koestler" },
      { title: "The Day of the Locust", author: "Nathanael West" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Lucky Jim", author: "Kingsley Amis" },
      { title: "The Man Who Loved Children", author: "Christina Stead" },
      { title: "Loving", author: "Henry Green" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "U.S.A. Trilogy", author: "John Dos Passos" },
    ]
  },
  guardian: {
    title: "The Guardian's 100 Best Novels",
    source: "The Guardian",
    year: "2015",
    desc: "Robert McCrum's selection of the finest novels written in English, from Robinson Crusoe to American Pastoral. A journey through 300 years of the English-language novel.",
    books: [
      { title: "The Pilgrim's Progress", author: "John Bunyan" },
      { title: "Robinson Crusoe", author: "Daniel Defoe" },
      { title: "Gulliver's Travels", author: "Jonathan Swift" },
      { title: "Clarissa", author: "Samuel Richardson" },
      { title: "Tom Jones", author: "Henry Fielding" },
      { title: "The Life and Opinions of Tristram Shandy", author: "Laurence Sterne" },
      { title: "Emma", author: "Jane Austen" },
      { title: "Frankenstein", author: "Mary Shelley" },
      { title: "The Narrative of Arthur Gordon Pym", author: "Edgar Allan Poe" },
      { title: "Vanity Fair", author: "William Makepeace Thackeray" },
      { title: "Jane Eyre", author: "Charlotte Brontë" },
      { title: "David Copperfield", author: "Charles Dickens" },
      { title: "Moby-Dick", author: "Herman Melville" },
      { title: "Middlemarch", author: "George Eliot" },
      { title: "The Adventures of Huckleberry Finn", author: "Mark Twain" },
      { title: "The Picture of Dorian Gray", author: "Oscar Wilde" },
      { title: "The Sign of Four", author: "Arthur Conan Doyle" },
      { title: "Jude the Obscure", author: "Thomas Hardy" },
      { title: "The Turn of the Screw", author: "Henry James" },
      { title: "Heart of Darkness", author: "Joseph Conrad" },
      { title: "Wuthering Heights", author: "Emily Brontë" },
      { title: "The Scarlet Letter", author: "Nathaniel Hawthorne" },
      { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" },
      { title: "Little Women", author: "Louisa May Alcott" },
      { title: "The Way We Live Now", author: "Anthony Trollope" },
      { title: "The Woman in White", author: "Wilkie Collins" },
      { title: "Great Expectations", author: "Charles Dickens" },
      { title: "Silas Marner", author: "George Eliot" },
      { title: "Bleak House", author: "Charles Dickens" },
      { title: "Treasure Island", author: "Robert Louis Stevenson" },
      { title: "Kim", author: "Rudyard Kipling" },
      { title: "The Wonderful Wizard of Oz", author: "L. Frank Baum" },
      { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle" },
      { title: "The Call of the Wild", author: "Jack London" },
      { title: "The Golden Bowl", author: "Henry James" },
      { title: "The Wind in the Willows", author: "Kenneth Grahame" },
      { title: "The Secret Agent", author: "Joseph Conrad" },
      { title: "A Room with a View", author: "E.M. Forster" },
      { title: "The Secret Garden", author: "Frances Hodgson Burnett" },
      { title: "Sons and Lovers", author: "D.H. Lawrence" },
      { title: "The Good Soldier", author: "Ford Madox Ford" },
      { title: "The Thirty-Nine Steps", author: "John Buchan" },
      { title: "The Age of Innocence", author: "Edith Wharton" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "A Passage to India", author: "E.M. Forster" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "The Sun Also Rises", author: "Ernest Hemingway" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "Orlando", author: "Virginia Woolf" },
      { title: "As I Lay Dying", author: "William Faulkner" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "Cold Comfort Farm", author: "Stella Gibbons" },
      { title: "Scoop", author: "Evelyn Waugh" },
      { title: "The Big Sleep", author: "Raymond Chandler" },
      { title: "Party Going", author: "Henry Green" },
      { title: "At Swim-Two-Birds", author: "Flann O'Brien" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "Joy in the Morning", author: "P.G. Wodehouse" },
      { title: "All the King's Men", author: "Robert Penn Warren" },
      { title: "Under the Volcano", author: "Malcolm Lowry" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "The End of the Affair", author: "Graham Greene" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "The Adventures of Augie March", author: "Saul Bellow" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "Voss", author: "Patrick White" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "The Prime of Miss Jean Brodie", author: "Muriel Spark" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "A Single Man", author: "Christopher Isherwood" },
      { title: "In Cold Blood", author: "Truman Capote" },
      { title: "The Bell Jar", author: "Sylvia Plath" },
      { title: "Portnoy's Complaint", author: "Philip Roth" },
      { title: "Mrs Palfrey at the Claremont", author: "Elizabeth Taylor" },
      { title: "Rabbit Redux", author: "John Updike" },
      { title: "Song of Solomon", author: "Toni Morrison" },
      { title: "A Bend in the River", author: "V.S. Naipaul" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "Housekeeping", author: "Marilynne Robinson" },
      { title: "Money", author: "Martin Amis" },
      { title: "An Artist of the Floating World", author: "Kazuo Ishiguro" },
      { title: "The Beginning of Spring", author: "Penelope Fitzgerald" },
      { title: "Possession", author: "A.S. Byatt" },
      { title: "Amongst Women", author: "John McGahern" },
      { title: "Underworld", author: "Don DeLillo" },
      { title: "Disgrace", author: "J.M. Coetzee" },
      { title: "True History of the Kelly Gang", author: "Peter Carey" },
      { title: "The Corrections", author: "Jonathan Franzen" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Fingersmith", author: "Sarah Waters" },
      { title: "The Known World", author: "Edward P. Jones" },
      { title: "Small Island", author: "Andrea Levy" },
      { title: "Never Let Me Go", author: "Kazuo Ishiguro" },
      { title: "The Brief Wondrous Life of Oscar Wao", author: "Junot Díaz" },
      { title: "Wolf Hall", author: "Hilary Mantel" },
      { title: "American Pastoral", author: "Philip Roth" },
    ]
  }
};

// Get a list by ID — tries cache (Supabase) first, falls back to offline data
function getListData(listId) {
  if (listsCache[listId] && listsCache[listId].books?.length) return listsCache[listId];
  if (CURATED_LISTS_OFFLINE[listId]) {
    const off = CURATED_LISTS_OFFLINE[listId];
    return { id: listId, title: off.title, source: off.source, year: off.year, desc: off.desc, is_curated: true, books: off.books };
  }
  return listsCache[listId] || null;
}

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
      sb.from(table).update({ book_key: newKey }).eq('user_id', uid).eq('book_key', oldKey)
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
        const coverUrl = base ? base.replace('http://', 'https://').replace('&edge=curl', '').replace(/zoom=\d+/g, 'zoom=3') : null;
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
    const { data } = await sb
      .from('book_cover_cache')
      .select('cover_url, book_key, year')
      .eq('title_lower', title.toLowerCase())
      .eq('author_lower', author.toLowerCase())
      .maybeSingle();
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
    await sb.from('book_cover_cache').upsert({
      title_lower: title.toLowerCase(),
      author_lower: author.toLowerCase(),
      cover_url: coverUrl,
      book_key: bookKey || title,
      year: year || '',
    }, { onConflict: 'title_lower,author_lower' });
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
          const gCover = base ? base.replace('http://', 'https://').replace('&edge=curl', '').replace(/zoom=\d+/g, 'zoom=3') : null;
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
  // Update in-memory cache
  const key = (title + '||' + author).toLowerCase();
  coverMemCache[key] = { key: bookKey || title, title, author, coverUrl: newCoverUrl, year: year || '' };
  // Update Supabase cache
  if (sb) {
    await sb.from('book_cover_cache').upsert({
      title_lower: title.toLowerCase(),
      author_lower: author.toLowerCase(),
      cover_url: newCoverUrl,
      book_key: bookKey || title,
      year: year || '',
    }, { onConflict: 'title_lower,author_lower' });
  }
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
          const coverUrl = base.replace('http://', 'https://').replace('&edge=curl', '').replace(/zoom=\d+/g, 'zoom=3');
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

// ─── FRIENDS SYSTEM ──────────────────────────────────────────────────────
async function searchUsers(query) {
  if (!sb || !query.trim()) return [];
  try {
    const { data, error } = await sb.from('profiles').select('id, username, bio, avatar_url')
      .ilike('username', `%${query}%`).limit(8);
    if (error) {
      // Fallback: avatar_url column might not exist yet
      const { data: fallback, error: fallbackErr } = await sb.from('profiles').select('id, username, bio')
        .ilike('username', `%${query}%`).limit(8);
      if (fallbackErr) throw fallbackErr;
      return (fallback || []).filter(u => u.id !== state.user?.id);
    }
    return (data || []).filter(u => u.id !== state.user?.id);
  } catch (e) {
    throw e;
  }
}

async function getFriends() {
  if (!sb || !state.user) return [];
  try {
    const { data, error } = await sb.from('friendships')
      .select('friend_id')
      .eq('user_id', state.user.id);
    if (error) return [];
    if (!data?.length) return [];
    const friendIds = data.map(f => f.friend_id);
    // Try with avatar_url first, fallback without
    let profiles;
    const { data: p1, error: e1 } = await sb.from('profiles')
      .select('id, username, bio, avatar_url')
      .in('id', friendIds);
    if (e1) {
      const { data: p2 } = await sb.from('profiles')
        .select('id, username, bio')
        .in('id', friendIds);
      profiles = p2;
    } else {
      profiles = p1;
    }
    return (profiles || []);
  } catch (e) { return []; }
}

async function addFriend(friendId) {
  if (!sb || !state.user) return;
  await sb.from('friendships').upsert({ user_id: state.user.id, friend_id: friendId }, { onConflict: 'user_id,friend_id' });
}

async function removeFriend(friendId) {
  if (!sb || !state.user) return;
  await sb.from('friendships').delete().eq('user_id', state.user.id).eq('friend_id', friendId);
}

async function getFriendActivity(friendId) {
  if (!sb) return [];
  try {
    const { data } = await sb.from('reviews').select('book_key, book_title, rating, created_at')
      .eq('user_id', friendId).order('created_at', { ascending: false }).limit(2);
    return data || [];
  } catch { return []; }
}

async function loadFriendsSidebar() {
  if (!state.user) return;
  const friendsList = document.getElementById('friends-list');
  const friendsCount = document.getElementById('friends-count');
  if (!friendsList) return;

  const friends = await getFriends();
  if (friendsCount) friendsCount.textContent = friends.length ? `(${friends.length})` : '';

  if (!friends.length) {
    friendsList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;font-style:italic">No friends yet. Search above to add some!</p>';
    return;
  }

  let html = '';
  for (const friend of friends) {
    const activity = await getFriendActivity(friend.id);
    const friendAvatarHtml = friend.avatar_url
      ? `<img class="friend-avatar friend-avatar-img" src="${escHtml(friend.avatar_url)}" alt="${escHtml(friend.username)}" onerror="this.outerHTML='<div class=\\'friend-avatar\\'>${(friend.username || '?')[0].toUpperCase()}</div>'">`
      : `<div class="friend-avatar">${(friend.username || '?')[0].toUpperCase()}</div>`;
    html += `
      <div class="friend-item">
        <div class="friend-info friend-info-link" data-user-id="${friend.id}" style="cursor:pointer" title="View ${escHtml(friend.username || 'User')}'s profile">
          ${friendAvatarHtml}
          <div>
            <div class="friend-name">${escHtml(friend.username || 'User')}</div>
            ${activity.length ? `<div class="friend-activity">${activity.map(a =>
              `<span class="friend-activity-item">Reviewed "${escHtml(a.book_title)}" ${'★'.repeat(a.rating || 0)}</span>`
            ).join('')}</div>` : '<div class="friend-activity"><span class="friend-activity-item">No recent activity</span></div>'}
          </div>
        </div>
        <button class="friend-remove-btn" data-friend-id="${friend.id}" title="Remove friend">✕</button>
      </div>`;
  }
  friendsList.innerHTML = html;

  friendsList.querySelectorAll('.friend-info-link').forEach(el => {
    el.addEventListener('click', () => navigate('user', { userId: el.dataset.userId }));
  });

  friendsList.querySelectorAll('.friend-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeFriend(btn.dataset.friendId);
      showToast('Friend removed');
      loadFriendsSidebar();
    });
  });
}

function bindFriendSearch() {
  const input = document.getElementById('friend-search-input');
  const resultsEl = document.getElementById('friend-search-results');
  if (!input || !resultsEl) return;

  // Remove old listeners by replacing element
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  let debounce;
  async function doFriendSearch(q) {
    if (!q) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; return; }
    resultsEl.innerHTML = '<div class="friend-search-item" style="color:var(--text-muted)">Searching…</div>';
    resultsEl.style.display = 'block';
    let users;
    try {
      users = await searchUsers(q);
    } catch (e) {
      resultsEl.innerHTML = `<div class="friend-search-item" style="color:var(--accent-red)">Search failed: ${escHtml(e?.message || 'Check Supabase RLS policies on the profiles table')}</div>`;
      resultsEl.style.display = 'block';
      return;
    }
    const friends = await getFriends();
    const friendIds = new Set(friends.map(f => f.id));
    if (!users.length) { resultsEl.innerHTML = '<div class="friend-search-item" style="color:var(--text-muted)">No users found</div>'; resultsEl.style.display = 'block'; return; }
    resultsEl.innerHTML = users.map(u => {
      const sAvatarHtml = u.avatar_url
        ? `<img class="friend-avatar friend-avatar-img" src="${escHtml(u.avatar_url)}" style="width:28px;height:28px" alt="" onerror="this.outerHTML='<div class=\\'friend-avatar\\' style=\\'width:28px;height:28px;font-size:12px\\'>${(u.username || '?')[0].toUpperCase()}</div>'">`
        : `<div class="friend-avatar" style="width:28px;height:28px;font-size:12px">${(u.username || '?')[0].toUpperCase()}</div>`;
      return `
      <div class="friend-search-item" data-user-id="${u.id}">
        ${sAvatarHtml}
        <span>${escHtml(u.username)}</span>
        ${friendIds.has(u.id) ? '<span style="color:var(--accent-green);font-size:12px">✓ Friends</span>' : `<button class="btn btn-primary btn-sm add-friend-btn" data-user-id="${u.id}" style="margin-left:auto;padding:2px 10px;font-size:11px">Add</button>`}
      </div>
    `}).join('');
    resultsEl.style.display = 'block';
    resultsEl.querySelectorAll('.add-friend-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await addFriend(btn.dataset.userId);
        showToast('Friend added!');
        newInput.value = '';
        resultsEl.innerHTML = '';
        resultsEl.style.display = 'none';
        loadFriendsSidebar();
      });
    });
  }

  // Search as you type (debounced)
  newInput.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = newInput.value.trim();
    if (!q) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; return; }
    debounce = setTimeout(() => doFriendSearch(q), 300);
  });

  // Also search immediately on Enter
  newInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounce);
      const q = newInput.value.trim();
      doFriendSearch(q);
    }
  });
}

// ─── REVIEWS SYSTEM ─────────────────────────────────────────────────────
async function getBookReviews(bookKey) {
  if (!sb) return [];
  try {
    // Fetch reviews first
    const { data: reviews, error } = await sb.from('reviews')
      .select('id, user_id, book_key, book_title, rating, review_text, created_at')
      .eq('book_key', bookKey)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return [];
    if (!reviews?.length) return [];
    // Fetch usernames separately to avoid FK naming issues
    const userIds = [...new Set(reviews.map(r => r.user_id))];
    let profiles;
    const { data: p1, error: e1 } = await sb.from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);
    if (e1) {
      const { data: p2 } = await sb.from('profiles')
        .select('id, username')
        .in('id', userIds);
      profiles = p2;
    } else {
      profiles = p1;
    }
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
    return reviews.map(r => ({
      ...r,
      username: profileMap[r.user_id]?.username || 'Anonymous',
      avatar_url: profileMap[r.user_id]?.avatar_url || null,
    }));
  } catch (e) { return []; }
}

async function submitReview(bookKey, bookTitle, rating, reviewText) {
  if (!sb || !state.user) throw new Error('Must be logged in');
  const { error } = await sb.from('reviews').upsert({
    user_id: state.user.id,
    book_key: bookKey,
    book_title: bookTitle,
    rating: rating || null,
    review_text: reviewText,
  }, { onConflict: 'user_id,book_key' });
  if (error) throw error;
}

async function deleteReview(reviewId) {
  if (!sb) return;
  await sb.from('reviews').delete().eq('id', reviewId);
}

// ─── ROUTER ──────────────────────────────────────────────────────────────
// Blind Date is deliberately client-first: it works anonymously and only uses
// the optional votes table when a signed-in account is available.
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
  if (state.user && sb) sb.from('blind_date_votes').insert({ user_id: state.user.id, book_id: book.key, choice, created_at: vote.timestamp, session_id: game.id }).then(() => {});
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
  document.getElementById('blind-save')?.addEventListener('click', async e => { await toggleWishlist(book); e.currentTarget.textContent = state.wishlist[book.key] ? '✓ Saved to Read Later' : saveLabel; e.currentTarget.classList.toggle('saved', !!state.wishlist[book.key]); });
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
    // content rendered by loadCollectionPage before navigate is called
  } else if (page === 'user') {
    loadUserProfile(params.userId);
  } else if (page === 'wishlist') {
    loadWishlistPage();
  } else if (page === 'lists') {
    loadListsPreviews();
  } else if (page === 'blind-date') {
    loadBlindDatePage();
  }
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
    updateHeroFan();
    homeLoaded = true;
  } catch (e) {
    showToast('Could not load books. Check your connection.', 'error');
  }
}

function updateHeroFan() {
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
    slot.addEventListener('click', () => {
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
    const { data } = await sb.from('lists')
      .select('id, title, list_books(count)')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false })
      .limit(5);
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
    card.addEventListener('click', (e) => {
      if (e.target.closest('.overlay-btn')) return;
      const book = findBookByKey(card.dataset.key) || books.find(b => b.key === card.dataset.key);
      if (book) openBook(book);
    });
  });
  el.querySelectorAll('.overlay-btn.mark-read').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
      // update badge
      const card = el.querySelector(`.book-card[data-key="${CSS.escape(btn.dataset.key)}"]`);
      if (card) refreshCardBadge(card, btn.dataset.key);
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
    btn.addEventListener('click', () => {
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

  await loadAllLists();

  const allLists = Object.values(listsCache);
  const curated = allLists.filter(l => l.is_curated);
  const userLists = allLists.filter(l => !l.is_curated);

  // Popular lists = user lists sorted by book count (proxy for popularity) + curated
  const popular = [...userLists].sort((a, b) => (b.books?.length || 0) - (a.books?.length || 0)).slice(0, 6);
  if (popular.length) {
    popularContainer.innerHTML = popular.map(l => listCardHTML(l, 'user')).join('');
  } else {
    popularContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No lists yet. Create the first one!</div>';
  }

  // Recently created = newest user lists
  const recent = [...userLists].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 6);
  if (recent.length && newSection && newContainer) {
    newSection.style.display = '';
    newContainer.innerHTML = recent.map(l => listCardHTML(l, 'user')).join('');
  }

  // Letterbooxd Recommendations = curated lists
  if (recsContainer) {
    const recsData = curated.length ? curated : CURATED_LIST_IDS.map(id => {
      const list = CURATED_LISTS_OFFLINE[id];
      return list ? { id, title: list.title, source: list.source, year: list.year, desc: list.desc, is_curated: true, books: list.books } : null;
    }).filter(Boolean);
    recsContainer.innerHTML = recsData.map(l => listCardHTML(l, 'curated')).join('');
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
        await deleteUserList(btn.dataset.listId);
        showToast('List deleted');
        listsPageLoaded = false;
        loadListsPreviews();
      });
    });
  });

  loadListPreviewCovers();
  listsPageLoaded = true;
}

function listCardHTML(list, type) {
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

async function loadListPreviewCovers() {
  const allLists = Object.values(listsCache).length ? Object.values(listsCache) : CURATED_LIST_IDS.map(id => ({id, ...(CURATED_LISTS_OFFLINE[id] || {})}));

  for (const list of allLists) {
    const previewEl = document.getElementById(`${list.id}-preview`);
    if (!previewEl || previewEl.dataset.loaded) continue;
    previewEl.dataset.loaded = '1';

    // Load books if not already loaded
    let books = list.books;
    if (!books?.length) {
      books = await loadListBooks(list.id);
    }
    if (!books?.length) continue;

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
      } else if (slots[i]) {
        slots[i].classList.add('is-missing');
        slots[i].textContent = first5[i].title;
        slots[i].title = first5[i].title;
      }
    });
  }
}

function openList(listId) {
  state.currentList = listId;
  navigate('list-detail', { listId });
}

async function loadListDetail(listId) {
  let list = getListData(listId);
  
  // If books not loaded yet, fetch them
  if (!list || !list.books?.length) {
    const books = await loadListBooks(listId);
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

  loadListCovers(list.books, listId);
}

async function loadListCovers(books, listId) {
  const batchSize = 8;
  for (let i = 0; i < books.length; i += batchSize) {
    const batch = books.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(b => {
        // If we already have a cached cover from Supabase list_books, build a result
        if (b.coverUrl && b.bookKey) {
          return Promise.resolve({
            key: b.bookKey, title: b.title, author: b.author,
            coverUrl: b.coverUrl, year: b.year || '', _cached: true,
          });
        }
        // Otherwise go through searchBooksForList (which checks book_cover_cache → Google)
        return searchBooksForList(b.title, b.author);
      })
    );
    results.forEach((r, j) => {
      const idx = i + j;
      const el = document.getElementById(`list-cover-${idx}`);
      if (!el) return;
      if (r.status === 'fulfilled' && r.value) {
        const book = r.value;
        const tile = el.closest('.list-tile');
        if (tile) {
          tile._book = book;
          tile.addEventListener('click', (e) => { if (!e.target.closest('.overlay-btn')) openBook(book); });
          tile.style.cursor = 'pointer';
        }
        if (book.coverUrl) {
          el.innerHTML = `<img src="${book.coverUrl}" alt="${escHtml(book.title)}" class="list-tile-cover-img" onerror="this.style.display='none';this.parentElement.querySelector('.list-tile-placeholder')?.style.display='flex'">
            <div class="list-tile-placeholder" style="display:none"><span class="list-tile-num">${idx+1}</span></div>`;
        }
        // Bind mark-read button
        const readBtn = tile?.querySelector(`.list-mark-read[data-idx="${idx}"]`);
        if (readBtn) {
          const isRead = Object.values(state.readBooks).some(rb => rb.title.toLowerCase() === book.title.toLowerCase());
          if (isRead) { readBtn.textContent = '✓'; readBtn.classList.add('read'); }
          readBtn.onclick = (e) => {
            e.stopPropagation();
            toggleRead(book.key || book.title, book.title, book.author, book.coverUrl, book.year);
            const nowRead = !!state.readBooks[book.key || book.title];
            readBtn.textContent = nowRead ? '✓' : '📖';
            readBtn.classList.toggle('read', nowRead);
            const badge = document.getElementById(`list-read-badge-${idx}`);
            if (badge) badge.innerHTML = nowRead ? '<div class="read-badge" style="position:static;width:16px;height:16px;font-size:8px">✓</div>' : '';
          };
        }
      }
    });
  }
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
    heading.addEventListener('click', () => {
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
  bindAuthorLinks(book.author);
  bindAdminCoverActions(book);
  fetchAndRenderDescription(book.key);
  loadAndRenderReviews(book);
  bindReviewForm(book);
  if (/^OL\d+W$/.test(book.key)) loadAndRenderEditions(book.key);

  document.getElementById('book-back-btn')?.addEventListener('click', () => {
    if (state._prevPage && state._prevPage !== 'book') navigate(state._prevPage);
    else navigate('home');
  });
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.style.display = 'block';
    });
  });

  // Genre tags are clickable — search for that genre
  document.querySelectorAll('.genre-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      navigate('search', { genre: tag.dataset.genre });
    });
  });
}

function bindAuthorLinks(authorName) {
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
  document.getElementById('detail-read-btn')?.addEventListener('click', () => {
    toggleRead(book.key, book.title, book.author, book.coverUrl, book.year);
    const isRead = !!state.readBooks[book.key];
    const btn = document.getElementById('detail-read-btn');
    const statusEl = document.getElementById('detail-status');
    if (btn) { btn.className = `detail-action-btn ${isRead ? 'active-read' : ''}`; btn.innerHTML = `<span>${isRead ? '✓' : '+'}</span> ${isRead ? 'Read' : 'Mark as Read'}`; }
    if (statusEl) statusEl.textContent = isRead ? '✓ Read' : '— Not read';
  });

  document.getElementById('detail-fav-btn')?.addEventListener('click', () => {
    toggleFavorite(book);
    const isFav = state.favorites.some(f => f.key === book.key);
    const btn = document.getElementById('detail-fav-btn');
    if (btn) { btn.className = `detail-action-btn ${isFav ? 'active-fav' : ''}`; btn.innerHTML = `<span>♥</span> ${isFav ? 'Favorited' : 'Add to Favorites'}`; }
  });

  document.getElementById('detail-wish-btn')?.addEventListener('click', () => {
    toggleWishlist(book);
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
      const current = state.ratings[book.key] || 0;
      state.ratings[book.key] = current === val ? 0 : val;
      if (state.user) {
        if (state.ratings[book.key] > 0) {
          await sb.from('ratings').upsert({
            user_id: state.user.id, book_key: book.key, rating: state.ratings[book.key],
            book_title: book.title || null, book_author: book.author || null, cover_url: book.coverUrl || null,
          }, { onConflict: 'user_id,book_key' });
        } else {
          await sb.from('ratings').delete()
            .eq('user_id', state.user.id).eq('book_key', book.key);
        }
      }
      save();
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
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx);
            const chosen = options[idx];
            if (!chosen) return;
            adminUpdateCover(book.title, book.author, chosen.url, book.key, book.year);
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

  document.getElementById('admin-custom-cover')?.addEventListener('click', () => {
    const url = prompt('Paste a cover image URL:');
    if (!url) return;
    if (!url.startsWith('http')) { showToast('Please enter a valid URL', 'error'); return; }
    adminUpdateCover(book.title, book.author, url, book.key, book.year);
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
  const reviews = await getBookReviews(book.key);
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
      await deleteReview(btn.dataset.reviewId);
      showToast('Review deleted');
      loadAndRenderReviews(book);
    });
  });
}

function bindReviewForm(book) {
  let reviewRating = 0;
  const stars = document.querySelectorAll('.review-form-star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
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
  state.searchQuery = genre;

  grid.onclick = e => {
    const btn = e.target.closest('.overlay-btn');
    if (btn) {
      if (btn.classList.contains('mark-read'))
        toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
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
  state.searchQuery = query;
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
    card.addEventListener('click', (e) => {
      if (e.target.closest('.overlay-btn')) return;
      const book = books.find(b => b.key === card.dataset.key);
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
function collectionItemHTML(book) {
  const cover = coverUrl(book.coverUrl || book.cover_url, 'S');
  const rating = book.rating || 0;
  const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
  const date = book.dateRead || book.date_read || '';
  return `<div class="collection-item" data-book-key="${escHtml(book.key || book.book_key || '')}">
    ${cover ? `<img class="collection-item-cover" src="${escHtml(cover)}" alt="" loading="lazy" onerror="this.style.background='var(--bg-secondary)';this.removeAttribute('src')">` : '<div class="collection-item-cover"></div>'}
    <div class="collection-item-info">
      <div class="collection-item-title">${escHtml(book.title || book.book_title || 'Unknown')}</div>
      <div class="collection-item-author">${escHtml(book.author || book.book_author || '')}</div>
    </div>
    <div class="collection-item-right">
      ${stars ? `<div class="collection-item-rating">${stars}</div>` : ''}
      ${date ? `<div class="collection-item-date">${escHtml(relativeDate(date))}</div>` : ''}
    </div>
  </div>`;
}

function loadCollectionPage({ title, books, backPage, backParams = {} }) {
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
    el.addEventListener('click', () => {
      const b = books[i];
      if (b) openBook({ key: b.key || b.book_key, title: b.title || b.book_title, author: b.author || b.book_author, coverUrl: b.coverUrl || b.cover_url, year: b.year || '' });
    });
  });
}

// ─── USER PROFILE (public view) ───────────────────────────────────────────
async function loadUserProfile(userId) {
  if (!sb) return;

  const { data: profile } = await sb.from('profiles').select('username, bio, avatar_url').eq('id', userId).single();
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
    { data: favsData,    error: favsErr },
    { data: readsData,   error: readsErr },
    { data: ratingsData, error: ratingsErr },
    { data: listsData,   error: listsErr },
  ] = await Promise.all([
    sb.from('favorites').select('book_key, title, author, cover_url, position').eq('user_id', userId),
    sb.from('read_books').select('book_key, title, author, cover_url, year, date_read').eq('user_id', userId),
    sb.from('ratings').select('book_key, rating, book_title, book_author, cover_url').eq('user_id', userId).gt('rating', 0),
    sb.from('lists').select('id, title, description').eq('user_id', userId).eq('is_curated', false),
  ]);

  const favs    = (favsData    || []).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const reads   = readsData   || [];
  const ratings = ratingsData || [];
  const lists   = listsData   || [];

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
    loadCollectionPage({ title: `${profile.username}'s Books`, books: reads.map(r => ({ ...r, key: r.book_key, coverUrl: r.cover_url, dateRead: r.date_read })), backPage: 'user', backParams: { userId } })
  );
  document.getElementById('user-stat-item-rated')?.addEventListener('click', () =>
    loadCollectionPage({ title: `${profile.username}'s Rated Books`, books: ratings.map(resolveRatedBook), backPage: 'user', backParams: { userId } })
  );
  document.getElementById('user-stat-item-favs')?.addEventListener('click', () =>
    loadCollectionPage({ title: `${profile.username}'s Favourites`, books: favs.map(f => ({ key: f.book_key, title: f.title, author: f.author, coverUrl: f.cover_url })), backPage: 'user', backParams: { userId } })
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
        slot.addEventListener('click', () => {
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
      el.addEventListener('click', () => {
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

  document.getElementById('user-back-btn')?.addEventListener('click', () => navigate('profile'));
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

  // Stat click → collection page
  document.getElementById('stat-item-read')?.addEventListener('click', () =>
    loadCollectionPage({ title: 'Books Read', books: Object.values(state.readBooks), backPage: 'profile' })
  );
  document.getElementById('stat-item-rated')?.addEventListener('click', () => {
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
  await loadAllLists();
  const myLists = Object.values(listsCache).filter(l => l.user_id === state.user.id);
  if (!myLists.length) { section.style.display = 'none'; return; }

  section.style.display = '';
  grid.innerHTML = myLists.map(list => listCardHTML(list, 'user')).join('');

  grid.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => openList(card.dataset.listId));
  });
  grid.querySelectorAll('.list-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this list?')) return;
      await deleteUserList(btn.dataset.listId);
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
    const first5 = (list.books || []).slice(0, 5);
    const results = await Promise.allSettled(first5.map(b => b.coverUrl ? Promise.resolve({ coverUrl: b.coverUrl }) : searchBooksForList(b.title, b.author)));
    const slots = previewEl.querySelectorAll('.list-placeholder-cover');
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value?.coverUrl) {
        const img = document.createElement('img');
        img.src = coverUrl(r.value.coverUrl, 'S');
        img.alt = first5[i]?.title || '';
        img.style.cssText = 'flex:1;object-fit:cover;border-right:2px solid var(--bg-primary)';
        slots[i]?.replaceWith(img);
      }
    });
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
    btn.addEventListener('click', (e) => { e.stopPropagation(); removeFavorite(parseInt(btn.dataset.idx)); });
  });
  grid.querySelectorAll('.fav-open-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
s      const fav = state.favorites[parseInt(btn.dataset.idx)];
      if (fav) openBook(fav);
    });
  });
  // Also make the whole card clickable (except overlay buttons)
  grid.querySelectorAll('.fav-slot.filled').forEach(slot => {
    slot.addEventListener('click', (e) => {
      if (e.target.closest('.fav-remove-btn') || e.target.closest('.fav-open-btn')) return;
      const idx = parseInt(slot.dataset.slot);
      const fav = state.favorites[idx];
      if (fav) openBook(fav);
    });
  });
}

async function removeFavorite(index) {
  const fav = state.favorites[index];
  state.favorites.splice(index, 1);
  if (state.user && fav) {
    await sb.from('favorites').delete()
      .eq('user_id', state.user.id).eq('book_key', fav.key);
  }
  save();
  renderFavorites();
  showToast('Removed from favourites');
}

function renderReadList() {
  const el = document.getElementById('read-books-list');
  if (!el) return;
  const keys = Object.keys(state.readBooks);
  if (!keys.length) {
    el.innerHTML = `<div class="empty-state"><svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M4 19V6a2 2 0 012-2h12a2 2 0 012 2v13" stroke="currentColor" stroke-width="1.5"/></svg><h3>No books read yet</h3><p>Search for a book and mark it as read</p></div>`;
    return;
  }
  el.innerHTML = keys.map(key => {
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
  if (!requireAuth('track books')) return;
  if (state.readBooks[key]) {
    delete state.readBooks[key];
    showToast(`Removed "${title}" from read list`);
    if (state.user) {
      await sb.from('read_books').delete()
        .eq('user_id', state.user.id).eq('book_key', key);
    }
  } else {
    const dateRead = new Date().toLocaleDateString('en-NL', { month: 'short', year: 'numeric' });
    state.readBooks[key] = { key, title, author, coverUrl, year, dateRead };
    showToast(`Marked "${title}" as read ✓`);
    if (state.user) {
      await sb.from('read_books').upsert({
        user_id: state.user.id, book_key: key, title, author,
        cover_url: coverUrl, year, date_read: dateRead,
      }, { onConflict: 'user_id,book_key' });
    }
  }
  save();
}

async function toggleFavorite(book) {
  if (!requireAuth('add favourites')) return;
  const idx = state.favorites.findIndex(f => f.key === book.key);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    showToast('Removed from favourites');
    if (state.user) {
      await sb.from('favorites').delete()
        .eq('user_id', state.user.id).eq('book_key', book.key);
    }
  } else {
    if (state.favorites.length >= 4) { showToast('You can only have 4 favourites. Remove one first.', 'error'); return; }
    state.favorites.push({ key: book.key, title: book.title, author: book.author, coverUrl: book.coverUrl });
    showToast(`Added "${book.title}" to favourites ♥`);
    if (state.user) {
      await sb.from('favorites').upsert({
        user_id: state.user.id, book_key: book.key, title: book.title,
        author: book.author, cover_url: book.coverUrl, position: state.favorites.length - 1,
      }, { onConflict: 'user_id,book_key' });
    }
  }
  save();
}

// ─── WISHLIST (READ LATER) ──────────────────────────────────────────────
async function toggleWishlist(book) {
  if (!requireAuth('save to wishlist')) return;
  const key = book.key;
  if (state.wishlist[key]) {
    delete state.wishlist[key];
    showToast(`Removed "${book.title}" from Read Later`);
    if (state.user) {
      try { await sb.from('wishlist').delete().eq('user_id', state.user.id).eq('book_key', key); }
      catch (e) { }
    }
  } else {
    const dateAdded = new Date().toISOString();
    state.wishlist[key] = { key, title: book.title, author: book.author, coverUrl: book.coverUrl, year: book.year, dateAdded };
    showToast(`Added "${book.title}" to Read Later 🔖`);
    if (state.user) {
      try {
        await sb.from('wishlist').upsert({
          user_id: state.user.id, book_key: key, title: book.title, author: book.author,
          cover_url: book.coverUrl, year: book.year, date_added: dateAdded,
        }, { onConflict: 'user_id,book_key' });
      } catch (e) { }
    }
  }
  save();
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
  document.getElementById('rating-modal').classList.add('open');
}

function closeRatingModal() {
  document.getElementById('rating-modal').classList.remove('open');
  state.pendingRatingBook = null;
}

async function saveRating(val) {
  const book = state.pendingRatingBook;
  if (!book) return;
  if (!requireAuth('rate books')) return;
  state.ratings[book.key] = (state.ratings[book.key] === val) ? 0 : val;
  if (state.user) {
    if (state.ratings[book.key] > 0) {
      await sb.from('ratings').upsert({
        user_id: state.user.id, book_key: book.key, rating: state.ratings[book.key],
        book_title: book.title || null, book_author: book.author || null, cover_url: book.coverUrl || null,
      }, { onConflict: 'user_id,book_key' });
    } else {
      await sb.from('ratings').delete()
        .eq('user_id', state.user.id).eq('book_key', book.key);
    }
  }
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
  modal.classList.add('open');
}

function closeCreateListModal() {
  clearTimeout(createListSearchTimer);
  createListSearchRequest++;
  document.getElementById('create-list-modal').classList.remove('open');
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
    btn.addEventListener('click', () => {
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
      item.addEventListener('click', () => {
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
    const listId = await createUserList(title, desc, createListBooks);
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
  modal.classList.add('open');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  document.getElementById('auth-error').style.display = 'none';
}

// ─── INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Init auth first
  await initAuth();

  // Nav
  document.querySelectorAll('nav a[data-page]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigate(a.dataset.page);
      document.getElementById('main-nav')?.classList.remove('open');
    });
  });

  // Mobile menu
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('main-nav')?.classList.toggle('open');
  });

  document.getElementById('logo-link')?.addEventListener('click', e => { e.preventDefault(); navigate('home'); });
  document.getElementById('profile-nav-link')?.addEventListener('click', e => { e.preventDefault(); navigate('profile'); });

  // Header auth buttons
  document.getElementById('header-login-btn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('header-signup-btn')?.addEventListener('click', () => openAuthModal('signup'));
  document.getElementById('header-logout-btn')?.addEventListener('click', logOut);
  document.getElementById('profile-logout-btn')?.addEventListener('click', logOut);

  // Auth modal
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });

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
        const data = await signUp(email, password, username || 'Reader');
        closeAuthModal();
        // Show confirmation modal
        document.getElementById('confirm-email-addr').textContent = email;
        document.getElementById('confirm-modal').classList.add('open');
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

  document.getElementById('confirm-ok-btn')?.addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.remove('open');
  });

  // Header search
  document.getElementById('header-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) navigate('search', { query: e.target.value.trim() });
  });

  // Search page
  document.getElementById('search-btn')?.addEventListener('click', () => {
    const q = document.getElementById('main-search-input').value.trim();
    if (q) doSearch(q);
  });
  document.getElementById('main-search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) doSearch(e.target.value.trim());
  });
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const genre = chip.dataset.genre;
      document.getElementById('main-search-input').value = genre;
      doGenreSearch(genre);
    });
  });

  // Hero
  document.getElementById('hero-search-btn')?.addEventListener('click', () => {
    if (state.user) {
      navigate('search');
      setTimeout(() => document.getElementById('main-search-input')?.focus(), 100);
    } else {
      openAuthModal('signup');
    }
  });
  document.getElementById('hero-profile-btn')?.addEventListener('click', () => navigate('profile'));
  document.getElementById('hero-explore-btn')?.addEventListener('click', () => {
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
  document.getElementById('edit-username-btn')?.addEventListener('click', () => {
    const form = document.getElementById('edit-name-form');
    const input = document.getElementById('username-input');
    const bioInput = document.getElementById('bio-input');
    const avatarInput = document.getElementById('avatar-url-input');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    if (input) { input.value = state.username; input.focus(); }
    if (bioInput) bioInput.value = state.bio || '';
    if (avatarInput) avatarInput.value = state.avatarUrl || '';
  });
  document.getElementById('save-username-btn')?.addEventListener('click', async () => {
    const val = document.getElementById('username-input').value.trim();
    const bioVal = document.getElementById('bio-input')?.value.trim() || '';
    const avatarVal = document.getElementById('avatar-url-input')?.value.trim() || '';
    if (val) {
      state.username = val;
      state.bio = bioVal;
      state.avatarUrl = avatarVal;
      if (state.user) {
        const { error: updateErr } = await sb.from('profiles').update({ username: val, bio: bioVal, avatar_url: avatarVal || null }).eq('id', state.user.id);
        if (updateErr) {
          // avatar_url column might not exist yet — try without it
          await sb.from('profiles').update({ username: val, bio: bioVal }).eq('id', state.user.id);
        }
      }
      save();
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

  // Strip white background from bookend images via canvas
  document.querySelectorAll('.bookend-img').forEach(img => {
    const process = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      try {
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < d.data.length; i += 4) {
          if (d.data[i] > 235 && d.data[i+1] > 235 && d.data[i+2] > 235)
            d.data[i+3] = 0;
        }
        ctx.putImageData(d, 0, 0);
        img.src = canvas.toDataURL('image/png');
      } catch(e) { /* CORS blocked — image shows as-is */ }
    };
    if (img.complete && img.naturalWidth) process();
    else img.addEventListener('load', process);
  });

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

  navigate('home');
});
