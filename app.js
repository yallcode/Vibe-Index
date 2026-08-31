// Firebase setup.
// Get these six values from the Firebase console: the gear icon, then
// Project settings, then Your apps, then the web app, then SDK setup
// and configuration. These are not secret, it is fine for them to be
// visible in frontend code.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import {
  getAuth,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
  getAdditionalUserInfo,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBIQa6Ykh6149gWU1PfnBxzKuWF_s6c-mY',
  authDomain: 'vibemodded-index.firebaseapp.com',
  projectId: 'vibemodded-index',
  storageBucket: 'vibemodded-index.firebasestorage.app',
  messagingSenderId: '182624398225',
  appId: '1:182624398225:web:4e24a4255938f224408830',
};

// Anyone whose UID is in this list gets the Admin tab (Approve, Reject,
// Delete, Feature). To add someone else, just put their UID in quotes
// with a comma between each one, like the two already here. This list
// has to match ADMIN_UIDS in firestore.rules exactly and in the same
// order does not matter, but every UID here needs to also be there, or
// their clicks will show up in the UI but get rejected by the server.
const ADMIN_UIDS = ['440QtDjzU7RYumA18x6h7BagIMi2', 'RtupX72YrbYPK7ai4ot0Lbu3oCo1'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const githubProvider = new GithubAuthProvider();

function isAdmin(user) {
  return !!user && ADMIN_UIDS.includes(user.uid);
}

// DOM references.
const loginBtn = document.getElementById('login-btn');
const navMods = document.getElementById('nav-mods');
const navDevelopers = document.getElementById('nav-developers');
const navAdmin = document.getElementById('nav-admin');
const navSettings = document.getElementById('nav-settings');
const navProfile = document.getElementById('nav-profile');
const viewMods = document.getElementById('view-mods');
const viewDevelopers = document.getElementById('view-developers');
const viewDeveloperProfile = document.getElementById('view-developer-profile');
const viewModDetail = document.getElementById('view-mod-detail');
const developerProfileContent = document.getElementById('developer-profile-content');
const modDetailContent = document.getElementById('mod-detail-content');
const devProfileBackBtn = document.getElementById('dev-profile-back');
const modDetailBackBtn = document.getElementById('mod-detail-back');
const viewProfile = document.getElementById('view-profile');
const viewAdmin = document.getElementById('view-admin');
const viewSettings = document.getElementById('view-settings');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const authError = document.getElementById('auth-error');

const profileAvatar = document.getElementById('profile-avatar');
const displayNameForm = document.getElementById('display-name-form');
const displayNameInput = document.getElementById('display-name-input');
const profileStatus = document.getElementById('profile-status');
const logoutBtn = document.getElementById('logout-btn');

const modForm = document.getElementById('mod-form');
const submitStatus = document.getElementById('submit-status');
const modsList = document.getElementById('mods-list');
const modCount = document.getElementById('mod-count');
const pendingList = document.getElementById('pending-list');
const approvedList = document.getElementById('approved-list');
const rejectedList = document.getElementById('rejected-list');

const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const filterMine = document.getElementById('filter-mine');
const filterFeatured = document.getElementById('filter-featured');
const tagFiltersEl = document.getElementById('tag-filters');
const platformFiltersEl = document.getElementById('platform-filters');
const activeFilterBanner = document.getElementById('active-filter-banner');
const activeFilterText = document.getElementById('active-filter-text');
const clearFilterBtn = document.getElementById('clear-filter-btn');
const developersList = document.getElementById('developers-list');
const adminPendingList = document.getElementById('admin-pending-list');
const adminApprovedList = document.getElementById('admin-approved-list');
const filtersToggleBtn = document.getElementById('filters-toggle-btn');
const filtersPanel = document.getElementById('filters-panel');
const languageSelect = document.getElementById('language-select');

const PLATFORM_LABELS = {
  win: 'Windows',
  mac: 'macOS',
  'mac-intel': 'macOS Intel',
  'mac-arm': 'macOS ARM',
  android: 'Android',
  android32: 'Android 32 bit',
  android64: 'Android 64 bit',
  ios: 'iOS',
};

// State.
let allMods = []; // every approved mod, fetched once and filtered or sorted in memory

// Turns any string into a plain lowercase, dash separated slug. Used as a
// fallback link for a mod when it has no modId from mod.json, which
// should be rare since Geode requires that field, but better safe.
function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function modRouteKey(mod) {
  return mod.modId || `${slugify(mod.developer || mod.authorName)}.${slugify(mod.name)}`;
}

// Simple hash based routing, so links like #/developer/ReYeCode,
// #/tag/Utility, or #/mod/geode.node-ids work directly, are shareable,
// and do not need a second HTML file or any server side rewrite rules,
// since the part after the # never gets sent to GitHub Pages at all.
function applyHashRoute() {
  const hash = window.location.hash;
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  if (parts[0] === 'developer' && parts[1]) {
    renderDeveloperProfile(decodeURIComponent(parts[1]));
    showView('developer-profile');
  } else if (parts[0] === 'tag' && parts[1]) {
    const tagName = decodeURIComponent(parts[1]);
    const checkbox = tagFiltersEl.querySelector(`.tag-filter-checkbox[value="${CSS.escape(tagName)}"]`);
    if (checkbox) checkbox.checked = true;
    showView('mods');
  } else if (parts[0] === 'mod' && parts[1]) {
    const key = decodeURIComponent(parts[1]);
    const mod = allMods.find((m) => modRouteKey(m) === key);
    if (mod) {
      renderModDetail(mod);
      showView('mod-detail');
    } else {
      showView('mods');
    }
  }
}
window.addEventListener('hashchange', () => {
  applyHashRoute();
  renderModsList();
});

// View switching.
function showView(view) {
  viewMods.classList.toggle('hidden', view !== 'mods');
  viewDevelopers.classList.toggle('hidden', view !== 'developers');
  viewDeveloperProfile.classList.toggle('hidden', view !== 'developer-profile');
  viewModDetail.classList.toggle('hidden', view !== 'mod-detail');
  viewProfile.classList.toggle('hidden', view !== 'profile');
  viewAdmin.classList.toggle('hidden', view !== 'admin');
  viewSettings.classList.toggle('hidden', view !== 'settings');
  navMods.classList.toggle('active', view === 'mods');
  navDevelopers.classList.toggle('active', view === 'developers');
  navSettings.classList.toggle('active', view === 'settings');
}
function backToMods() {
  if (window.location.hash) window.location.hash = '';
  showView('mods');
}
devProfileBackBtn.addEventListener('click', backToMods);
modDetailBackBtn.addEventListener('click', backToMods);

navMods.addEventListener('click', backToMods);
navDevelopers.addEventListener('click', () => {
  showView('developers');
  renderDevelopers();
});
navProfile.addEventListener('click', () => showView('profile'));
navAdmin.addEventListener('click', () => {
  showView('admin');
  loadAdmin();
});
navSettings.addEventListener('click', () => showView('settings'));

// The filter panel is only collapsed behind this button on small screens,
// see the media query in style.css. On a wide screen the button stays
// hidden and the panel is always visible.
filtersToggleBtn.addEventListener('click', () => {
  filtersPanel.classList.toggle('open');
});

// Only English actually works right now, so this just remembers the
// choice for later. The other options are disabled in the markup.
const savedLanguage = window.localStorage.getItem('vm_language') || 'en';
languageSelect.value = savedLanguage;
languageSelect.addEventListener('change', () => {
  window.localStorage.setItem('vm_language', languageSelect.value);
});

// Auth.
loginBtn.addEventListener('click', async () => {
  authError.classList.add('hidden');
  try {
    const result = await signInWithPopup(auth, githubProvider);
    const info = getAdditionalUserInfo(result);
    const githubUsername = info?.username || '';
    // Saved so we can check repo ownership later, even in a session
    // where the person did not just click through the login popup.
    await setDoc(
      doc(db, 'users', result.user.uid),
      {
        githubUsername,
        displayName: result.user.displayName || '',
        avatarUrl: result.user.photoURL || '',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    authError.textContent = `Login failed: ${err.message}`;
    authError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.classList.add('hidden');
    navProfile.classList.remove('hidden');
    navAdmin.classList.toggle('hidden', !isAdmin(user));
    userAvatar.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email || 'logged in';
    profileAvatar.src = user.photoURL || '';
    displayNameInput.value = user.displayName || '';
    loadMyMods();
  } else {
    loginBtn.classList.remove('hidden');
    navProfile.classList.add('hidden');
    navAdmin.classList.add('hidden');
    showView('mods');
    pendingList.innerHTML = '';
    approvedList.innerHTML = '';
    rejectedList.innerHTML = '';
  }
  renderModsList(); // "only my mods" depends on being logged in or not
});

displayNameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  profileStatus.textContent = 'Saving...';
  try {
    await updateProfile(user, { displayName: displayNameInput.value.trim() });
    userName.textContent = user.displayName;
    profileStatus.textContent = 'Updated.';
  } catch (err) {
    profileStatus.textContent = `Error: ${err.message}`;
  }
});

// Helpers.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
function platformLabel(key) {
  return PLATFORM_LABELS[key] || key;
}

// Public mods list.
async function loadMods() {
  modsList.innerHTML = '<p class="muted">Loading mods...</p>';
  try {
    // Just a plain equality filter on purpose, no orderBy here. Firestore
    // keeps automatic indexes for single field filters like this one, so
    // this works with zero setup. Sorting happens client side instead,
    // in renderModsList below, which we needed to do anyway to support
    // the Most downloaded and Name sort options.
    const modsQuery = query(collection(db, 'mods'), where('status', '==', 'approved'));
    const snapshot = await getDocs(modsQuery);
    allMods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    buildDynamicFilters();
    applyHashRoute();
    renderModsList();
  } catch (err) {
    console.error(err);
    modsList.innerHTML = '<p class="muted">Could not load mods. Open the browser console to see the exact error, it usually points straight at the problem.</p>';
  }
}

// Builds the Tags and Platform checkbox lists from whatever tags and
// platforms actually show up across the current mods, instead of a
// fixed list that could go stale.
function buildDynamicFilters() {
  const tags = new Set();
  const platforms = new Set();
  allMods.forEach((m) => {
    (m.tags || []).forEach((t) => tags.add(t));
    (m.platforms || []).forEach((p) => platforms.add(p));
  });

  tagFiltersEl.innerHTML = tags.size
    ? [...tags].sort().map((t) => `
      <label class="checkbox-row">
        <input type="checkbox" class="tag-filter-checkbox" value="${escapeAttr(t)}"> ${escapeHtml(t)}
      </label>`).join('')
    : '<p class="muted small">No tags yet.</p>';

  platformFiltersEl.innerHTML = platforms.size
    ? [...platforms].sort().map((p) => `
      <label class="checkbox-row">
        <input type="checkbox" class="platform-filter-checkbox" value="${escapeAttr(p)}"> ${escapeHtml(platformLabel(p))}
      </label>`).join('')
    : '<p class="muted small">No platform data yet.</p>';

  tagFiltersEl.querySelectorAll('.tag-filter-checkbox').forEach((cb) => cb.addEventListener('change', renderModsList));
  platformFiltersEl.querySelectorAll('.platform-filter-checkbox').forEach((cb) => cb.addEventListener('change', renderModsList));
}

function renderModsList() {
  const term = searchInput.value.trim().toLowerCase();
  const selectedTags = [...tagFiltersEl.querySelectorAll('.tag-filter-checkbox:checked')].map((cb) => cb.value);
  const selectedPlatforms = [...platformFiltersEl.querySelectorAll('.platform-filter-checkbox:checked')].map((cb) => cb.value);
  const onlyMine = filterMine.checked;
  const onlyFeatured = filterFeatured.checked;
  const user = auth.currentUser;

  const hasActiveFilters = !!term || selectedTags.length > 0 || selectedPlatforms.length > 0 || onlyMine || onlyFeatured;
  if (hasActiveFilters) {
    activeFilterText.textContent = 'Filters are active';
    activeFilterBanner.classList.remove('hidden');
  } else {
    activeFilterBanner.classList.add('hidden');
  }

  let mods = allMods.filter((m) => {
    if (term) {
      const haystack = `${m.name} ${m.description} ${m.developer}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (selectedTags.length && !selectedTags.some((t) => (m.tags || []).includes(t))) return false;
    if (selectedPlatforms.length && !selectedPlatforms.some((p) => (m.platforms || []).includes(p))) return false;
    if (onlyMine && (!user || m.authorId !== user.uid)) return false;
    if (onlyFeatured && !m.featured) return false;
    return true;
  });

  const sortBy = sortSelect.value;
  mods = mods.slice().sort((a, b) => {
    if (sortBy === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return (b.downloads || 0) - (a.downloads || 0); // downloads is the default
  });

  modCount.textContent = mods.length ? `${mods.length} indexed` : '';

  if (mods.length === 0) {
    modsList.innerHTML = allMods.length === 0
      ? '<p class="muted">No mods have been approved yet. Once one is approved it will show up here.</p>'
      : '<p class="muted">Nothing matches your current filters. Try clearing one.</p>';
    return;
  }

  modsList.innerHTML = mods
    .map(
      (mod, i) => `
    <article class="mod-card">
      <div class="mod-card-top">
        <span class="mod-index">No. ${String(mods.length - i).padStart(3, '0')}</span>
        ${mod.version ? `<span class="mod-version">v${escapeHtml(mod.version)}</span>` : ''}
      </div>
      <h3 class="mod-name">
        <button type="button" class="mod-name-link" data-mod-route="${escapeAttr(modRouteKey(mod))}">
          ${mod.featured ? '<span class="featured-star" title="Featured">*</span>' : ''}${escapeHtml(mod.name)}
        </button>
      </h3>
      <p class="mod-desc">${escapeHtml(mod.description || 'No description provided.')}</p>
      <div class="mod-badges">
        ${(mod.tags || []).map((t) => `<button type="button" class="mod-badge" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`).join('')}
        ${(mod.platforms || []).map((p) => `<span class="mod-badge">${escapeHtml(platformLabel(p))}</span>`).join('')}
      </div>
      <div class="mod-author">
        <img src="${escapeAttr(mod.authorAvatar)}" alt="">
        <button type="button" class="mod-author-link" data-developer="${escapeAttr(mod.developer || mod.authorName)}">${escapeHtml(mod.developer || mod.authorName)}</button>
      </div>
      <div class="mod-downloads">${(mod.downloads || 0).toLocaleString()} downloads</div>
      <div class="mod-links">
        <a class="download-link" data-mod-id="${mod.id}" href="${escapeAttr(mod.downloadUrl)}" target="_blank" rel="noopener">Download</a>
        ${mod.repoUrl ? `<a class="secondary" href="${escapeAttr(mod.repoUrl)}" target="_blank" rel="noopener">Source</a>` : ''}
      </div>
    </article>`
    )
    .join('');
}

// Clicking a tag, a developer name, or a mod name updates the URL hash,
// which is what actually applies the filter or opens the page, see
// applyHashRoute above. This makes every one of these a real shareable
// link, not just in memory state. Shared so the developer profile page's
// "Top mods" list can reuse the exact same behavior.
function handleModRowClick(e) {
  const modBtn = e.target.closest('[data-mod-route]');
  if (modBtn) {
    window.location.hash = `#/mod/${encodeURIComponent(modBtn.dataset.modRoute)}`;
    return true;
  }
  const tagBtn = e.target.closest('[data-tag]');
  if (tagBtn) {
    window.location.hash = `#/tag/${encodeURIComponent(tagBtn.dataset.tag)}`;
    return true;
  }
  const devBtn = e.target.closest('.mod-author-link');
  if (devBtn) {
    window.location.hash = `#/developer/${encodeURIComponent(devBtn.dataset.developer)}`;
    return true;
  }
  return false;
}

modsList.addEventListener('click', (e) => {
  if (handleModRowClick(e)) return;
  const link = e.target.closest('.download-link');
  if (!link) return;
  const id = link.dataset.modId;
  updateDoc(doc(db, 'mods', id), { downloads: increment(1) }).catch((err) => console.error(err));
});

searchInput.addEventListener('input', renderModsList);
sortSelect.addEventListener('change', renderModsList);
filterMine.addEventListener('change', renderModsList);
filterFeatured.addEventListener('change', renderModsList);
clearFilterBtn.addEventListener('click', () => {
  searchInput.value = '';
  filterMine.checked = false;
  filterFeatured.checked = false;
  tagFiltersEl.querySelectorAll('.tag-filter-checkbox').forEach((cb) => (cb.checked = false));
  platformFiltersEl.querySelectorAll('.platform-filter-checkbox').forEach((cb) => (cb.checked = false));
  renderModsList();
});

// Developers view.
function renderDevelopers() {
  const counts = new Map();
  allMods.forEach((m) => {
    const name = m.developer || m.authorName || 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  const developers = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  developersList.innerHTML = developers.length
    ? developers
        .map(
          ([name, count]) => `
      <button class="developer-card" data-developer="${escapeAttr(name)}">
        <div class="developer-name">${escapeHtml(name)}</div>
        <div class="developer-count">${count} mod${count === 1 ? '' : 's'}</div>
      </button>`
        )
        .join('')
    : '<p class="muted">No developers yet.</p>';

  developersList.querySelectorAll('.developer-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.hash = `#/developer/${encodeURIComponent(btn.dataset.developer)}`;
    });
  });
}

// A single clickable row used in the "Top mods" list on a developer's
// profile page, styled differently from the grid cards on the main
// Mods page since it reads better as a compact list here.
function modRowHtml(mod) {
  return `
    <button type="button" class="mod-row" data-mod-route="${escapeAttr(modRouteKey(mod))}">
      <span class="mod-row-icon">${escapeHtml((mod.name || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="mod-row-main">
        <span class="mod-row-name">${escapeHtml(mod.name)} ${mod.version ? `<span class="mod-version">v${escapeHtml(mod.version)}</span>` : ''}</span>
        <span class="mod-row-desc">${escapeHtml(mod.description || 'No description provided.')}</span>
      </span>
      <span class="mod-row-downloads">${(mod.downloads || 0).toLocaleString()} downloads</span>
    </button>`;
}

// A whole developer profile page: avatar, mod count, a link to their
// GitHub, and every approved mod they have. This is what #/developer/x
// actually renders now, it used to just filter the main grid.
function renderDeveloperProfile(name) {
  const mods = allMods.filter((m) => (m.developer || m.authorName) === name);
  const avatar = mods[0]?.authorAvatar || '';

  developerProfileContent.innerHTML = `
    <div class="profile-header">
      <img class="profile-header-avatar" src="${escapeAttr(avatar)}" alt="">
      <div class="profile-header-info">
        <h2>${escapeHtml(name)}</h2>
        <p class="muted">${mods.length} mod${mods.length === 1 ? '' : 's'}</p>
      </div>
      <a class="btn btn-ghost" href="https://github.com/${encodeURIComponent(name)}" target="_blank" rel="noopener">GitHub</a>
    </div>
    <h3>Top mods</h3>
    <div class="mod-row-list">
      ${mods.length ? mods.map(modRowHtml).join('') : '<p class="muted">No approved mods yet.</p>'}
    </div>
  `;
}
developerProfileContent.addEventListener('click', handleModRowClick);

// A full mod detail page, this is what #/mod/{id} renders. {id} is the
// modId from mod.json when there is one, which Geode requires, so this
// should cover every real submission.
function renderModDetail(mod) {
  modDetailContent.innerHTML = `
    <div class="mod-detail-header">
      <div class="mod-detail-icon">${escapeHtml((mod.name || '?').trim().charAt(0).toUpperCase())}</div>
      <div>
        <h2>${mod.featured ? '<span class="featured-star" title="Featured">*</span>' : ''}${escapeHtml(mod.name)}</h2>
        <button type="button" class="mod-author-link" data-developer="${escapeAttr(mod.developer || mod.authorName)}">${escapeHtml(mod.developer || mod.authorName)}</button>
      </div>
    </div>
    <div class="mod-detail-body">
      <div class="panel mod-detail-main">
        <p>${escapeHtml(mod.description || 'No description provided.')}</p>
        ${(mod.tags || []).length ? `<div class="mod-badges">${mod.tags.map((t) => `<button type="button" class="mod-badge" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="mod-detail-side panel">
        ${mod.version ? `<div class="stat-row"><span class="muted">Version</span><span>${escapeHtml(mod.version)}</span></div>` : ''}
        <div class="stat-row"><span class="muted">Downloads</span><span>${(mod.downloads || 0).toLocaleString()}</span></div>
        ${(mod.platforms || []).length ? `<div class="stat-row"><span class="muted">Platforms</span><span>${mod.platforms.map((p) => escapeHtml(platformLabel(p))).join(', ')}</span></div>` : ''}
        ${mod.modId ? `<div class="stat-row"><span class="muted">ID</span><span class="mono-text">${escapeHtml(mod.modId)}</span></div>` : ''}
        <a class="btn btn-primary mod-detail-download" data-mod-id="${mod.id}" href="${escapeAttr(mod.downloadUrl)}" target="_blank" rel="noopener">Download</a>
        ${mod.repoUrl ? `<a class="btn btn-ghost" href="${escapeAttr(mod.repoUrl)}" target="_blank" rel="noopener">Source code</a>` : ''}
      </div>
    </div>
  `;
  const downloadBtn = modDetailContent.querySelector('.mod-detail-download');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      updateDoc(doc(db, 'mods', downloadBtn.dataset.modId), { downloads: increment(1) }).catch((err) => console.error(err));
    });
  }
}
modDetailContent.addEventListener('click', handleModRowClick);

// Your mods, shown on the profile page.
async function loadMyMods() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const mineQuery = query(collection(db, 'mods'), where('authorId', '==', user.uid));
    const snapshot = await getDocs(mineQuery);
    const mine = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    mine.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    renderMyMods(pendingList, mine.filter((m) => m.status === 'pending'), 'No pending mods.');
    renderMyMods(approvedList, mine.filter((m) => m.status === 'approved'), 'No approved mods yet.');
    renderMyMods(rejectedList, mine.filter((m) => m.status === 'rejected'), 'No rejected mods.');
  } catch (err) {
    console.error(err);
  }
}

function renderMyMods(container, mods, emptyText) {
  if (mods.length === 0) {
    container.innerHTML = `<p class="muted">${emptyText}</p>`;
    return;
  }
  container.innerHTML = mods
    .map(
      (m) => `
    <div class="my-mod-row">
      <span>${escapeHtml(m.name)} ${m.version ? `<span class="mod-version">v${escapeHtml(m.version)}</span>` : ''}</span>
      ${m.status === 'rejected' && m.rejectionReason ? `<span class="muted">${escapeHtml(m.rejectionReason)}</span>` : ''}
    </div>`
    )
    .join('');
}

// Admin view.
async function loadAdmin() {
  const user = auth.currentUser;
  if (!isAdmin(user)) return;

  try {
    const pendingQuery = query(collection(db, 'mods'), where('status', '==', 'pending'));
    const pendingSnap = await getDocs(pendingQuery);
    const pending = pendingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    adminPendingList.innerHTML = pending.length
      ? pending
          .map(
            (m) => `
        <div class="admin-row">
          <div class="admin-row-info">
            ${escapeHtml(m.name)} ${m.version ? `v${escapeHtml(m.version)}` : ''}
            <span class="muted">by ${escapeHtml(m.developer)}, submitted by ${escapeHtml(m.authorName)}</span>
            <span class="muted"><a href="${escapeAttr(m.repoUrl)}" target="_blank" rel="noopener">${escapeHtml(m.repoUrl)}</a></span>
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-approve small" data-approve="${m.id}">Approve</button>
            <button class="btn btn-reject small" data-reject="${m.id}">Reject</button>
            <button class="btn btn-ghost small" data-delete="${m.id}">Delete</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="muted">Nothing pending.</p>';

    adminPendingList.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => setModStatus(btn.dataset.approve, 'approved'));
    });
    adminPendingList.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reason = window.prompt('Reason for rejecting, this is shown to the person who submitted it:', '');
        if (reason === null) return;
        setModStatus(btn.dataset.reject, 'rejected', reason);
      });
    });
    adminPendingList.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMod(btn.dataset.delete));
    });

    const approvedQuery = query(collection(db, 'mods'), where('status', '==', 'approved'));
    const approvedSnap = await getDocs(approvedQuery);
    const approved = approvedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    adminApprovedList.innerHTML = approved.length
      ? approved
          .map(
            (m) => `
        <div class="admin-row">
          <div class="admin-row-info">${escapeHtml(m.name)} ${m.featured ? '<span class="featured-star">featured</span>' : ''}</div>
          <div class="admin-row-actions">
            <button class="btn btn-ghost small" data-toggle-feature="${m.id}" data-current="${m.featured ? '1' : '0'}">
              ${m.featured ? 'Unfeature' : 'Feature'}
            </button>
            <button class="btn btn-ghost small" data-delete="${m.id}">Delete</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="muted">No approved mods yet.</p>';

    adminApprovedList.querySelectorAll('[data-toggle-feature]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nextFeatured = btn.dataset.current !== '1';
        await updateDoc(doc(db, 'mods', btn.dataset.toggleFeature), { featured: nextFeatured });
        loadAdmin();
        loadMods();
      });
    });
    adminApprovedList.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMod(btn.dataset.delete));
    });
  } catch (err) {
    console.error(err);
  }
}

async function setModStatus(modId, status, rejectionReason = null) {
  try {
    await updateDoc(doc(db, 'mods', modId), { status, rejectionReason });
    loadAdmin();
    loadMods();
  } catch (err) {
    window.alert(`Could not update that mod: ${err.message}`);
  }
}

async function deleteMod(modId) {
  if (!window.confirm('Delete this mod for good? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'mods', modId));
    loadAdmin();
    loadMods();
  } catch (err) {
    window.alert(`Could not delete that mod: ${err.message}`);
  }
}

// GitHub mod.json scanner.
function parseRepoUrl(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

// GitHub base64 encodes file contents with line breaks mixed in, so this
// strips those and decodes it properly as UTF 8, otherwise descriptions
// with accented letters or emoji come out broken.
function base64ToUtf8(b64) {
  const clean = b64.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function scanAndSubmitMod(repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw new Error("That doesn't look like a github.com repository link");
  const { owner, repo } = parsed;
  const user = auth.currentUser;

  // Ownership check. The repo's real owner has to match the GitHub
  // account currently signed in, so nobody can index someone else's mod
  // under their own name.
  const userDocSnap = await getDoc(doc(db, 'users', user.uid));
  const githubUsername = userDocSnap.exists() ? userDocSnap.data().githubUsername : null;

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!repoRes.ok) throw new Error(`Repo ${owner}/${repo} was not found, it needs to be public`);
  const repoData = await repoRes.json();
  const actualOwner = repoData.owner?.login || owner;

  if (!githubUsername || actualOwner.toLowerCase() !== githubUsername.toLowerCase()) {
    throw new Error(
      `This repo belongs to "${actualOwner}", but you are logged in as "${githubUsername || 'unknown'}". You can only submit mods from your own repos.`
    );
  }

  // mod.json from the repo root. api.github.com allows this kind of
  // request from a browser, the release download links used below do
  // not, which is why we read the manifest here instead of opening the
  // .geode file itself.
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/mod.json`);
  if (!metaRes.ok) {
    throw new Error(`Could not find mod.json at the root of ${owner}/${repo}`);
  }
  const metaJson = await metaRes.json();
  const modJson = JSON.parse(base64ToUtf8(metaJson.content));

  const developer =
    modJson.developer ||
    (Array.isArray(modJson.developers) ? modJson.developers.join(', ') : '') ||
    'Unknown';
  const tags = Array.isArray(modJson.tags) ? modJson.tags : [];
  const platforms = modJson.gd && typeof modJson.gd === 'object' ? Object.keys(modJson.gd) : [];

  // Latest release, so we can find the actual .geode file to link to.
  const releaseRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
  if (!releaseRes.ok) {
    throw new Error(`${owner}/${repo} does not have any releases yet. Publish one with a .geode file attached first.`);
  }
  const release = await releaseRes.json();
  const asset = (release.assets || []).find((a) => a.name.endsWith('.geode'));
  if (!asset) {
    throw new Error('The latest release does not have a .geode file attached to it.');
  }

  await addDoc(collection(db, 'mods'), {
    modId: modJson.id || '',
    name: modJson.name || repo,
    description: modJson.description || '',
    version: modJson.version || release.tag_name || '',
    developer,
    tags,
    platforms,
    repoUrl: `https://github.com/${owner}/${repo}`,
    downloadUrl: asset.browser_download_url,
    authorId: user.uid,
    authorName: user.displayName || 'anonymous',
    authorAvatar: user.photoURL || '',
    status: 'pending',
    rejectionReason: null,
    featured: false,
    downloads: 0,
    createdAt: serverTimestamp(),
  });

  return modJson.name || repo;
}

modForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('mod-repo-url');
  submitStatus.textContent = 'Scanning repo...';
  try {
    const name = await scanAndSubmitMod(input.value);
    input.value = '';
    submitStatus.textContent = `Submitted "${name}". It is pending review now.`;
    loadMyMods();
  } catch (err) {
    submitStatus.textContent = `Error: ${err.message}`;
  }
});

loadMods();
