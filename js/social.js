// ─── FRIENDS SYSTEM ──────────────────────────────────────────────────────
async function searchUsers(query) {
  if (!sb || !query.trim()) return [];
  const { data } = await queryResult(sb.from('profiles').select('id, username, bio, avatar_url')
    .ilike('username', `%${query}%`).limit(8));
  return (data || []).filter(u => u.id !== state.user?.id);
}

async function getFriends() {
  if (!sb || !state.user) return [];
  try {
    const { data } = await queryResult(sb.from('friendships')
      .select('friend_id')
      .eq('user_id', state.user.id));
    if (!data?.length) return [];
    const friendIds = data.map(f => f.friend_id);
    const { data: profiles } = await queryResult(sb.from('profiles')
      .select('id, username, bio, avatar_url').in('id', friendIds));
    return (profiles || []);
  } catch (e) { return []; }
}

async function addFriend(friendId) {
  if (!sb || !state.user) return;
  return saveMutation(queryResult(sb.from('friendships').upsert({ user_id: state.user.id, friend_id: friendId }, { onConflict: 'user_id,friend_id', ignoreDuplicates: true })));
}

async function removeFriend(friendId) {
  if (!sb || !state.user) return;
  return saveMutation(queryResult(sb.from('friendships').delete().eq('user_id', state.user.id).eq('friend_id', friendId)));
}

async function getFriendActivity(friendId) {
  if (!sb) return [];
  try {
    const { data } = await queryResult(sb.from('reviews').select('book_key, book_title, rating, created_at')
      .eq('user_id', friendId).order('created_at', { ascending: false }).limit(2));
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
      if (!await removeFriend(btn.dataset.friendId)) return;
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
  let requestId = 0;
  async function doFriendSearch(q) {
    if (!q) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; return; }
    if (q.length < 2) {
      resultsEl.innerHTML = '<div class="friend-search-item" style="color:var(--text-muted)">Type at least 2 characters.</div>';
      resultsEl.style.display = 'block';
      return;
    }
    const currentRequest = ++requestId;
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
    if (currentRequest !== requestId) return;
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
        if (!await addFriend(btn.dataset.userId)) return;
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
    const { data: reviews } = await queryResult(sb.from('reviews')
      .select('id, user_id, book_key, book_title, rating, review_text, created_at')
      .eq('book_key', bookKey)
      .order('created_at', { ascending: false })
      .limit(20));
    if (!reviews?.length) return [];
    // Fetch usernames separately to avoid FK naming issues
    const userIds = [...new Set(reviews.map(r => r.user_id))];
    const { data: profiles } = await queryResult(sb.from('profiles')
      .select('id, username, avatar_url').in('id', userIds));
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
    return reviews.map(r => ({
      ...r,
      username: profileMap[r.user_id]?.username || 'Anonymous',
      avatar_url: profileMap[r.user_id]?.avatar_url || null,
    }));
  } catch (e) { throw new Error('Reviews could not be loaded.'); }
}

async function submitReview(bookKey, bookTitle, rating, reviewText) {
  if (!sb || !state.user) throw new Error('Must be logged in');
  await queryResult(sb.from('reviews').upsert({
    user_id: state.user.id,
    book_key: bookKey,
    book_title: bookTitle,
    rating: rating || null,
    review_text: reviewText,
  }, { onConflict: 'user_id,book_key' }));
}

async function deleteReview(reviewId) {
  if (!sb) return;
  return saveMutation(queryResult(sb.from('reviews').delete().eq('id', reviewId)));
}
