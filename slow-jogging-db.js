const baseVideos = window.slowJoggingVideos || [];
let customVideos = normalizeStoredVideos(safeJsonParse(localStorage.getItem("slowJoggingCustomVideos"), []));

const state = {
  query: "",
  region: "全部",
  style: "全部",
  heat: "全部",
  tags: new Set(),
  selected: new Set(),
  favorites: new Set(safeJsonParse(localStorage.getItem("slowJoggingFavorites"), [])),
  view: "all",
  sort: "heat"
};

const heatRank = {
  "very-high": 4,
  high: 3,
  medium: 2,
  low: 1
};

const heatLabel = {
  "very-high": "高熱度",
  high: "熱門",
  medium: "中等",
  low: "小眾"
};

const els = {
  totalVideos: document.querySelector("#totalVideos"),
  totalChannels: document.querySelector("#totalChannels"),
  favoriteCount: document.querySelector("#favoriteCount"),
  searchInput: document.querySelector("#searchInput"),
  regionFilter: document.querySelector("#regionFilter"),
  styleFilter: document.querySelector("#styleFilter"),
  heatFilter: document.querySelector("#heatFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  tagCloud: document.querySelector("#tagCloud"),
  resetFiltersBtn: document.querySelector("#resetFiltersBtn"),
  selectedCount: document.querySelector("#selectedCount"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  importInput: document.querySelector("#importInput"),
  addVideoForm: document.querySelector("#addVideoForm"),
  videoUrlInput: document.querySelector("#videoUrlInput"),
  videoTitleInput: document.querySelector("#videoTitleInput"),
  videoChannelInput: document.querySelector("#videoChannelInput"),
  videoRegionInput: document.querySelector("#videoRegionInput"),
  videoStyleInput: document.querySelector("#videoStyleInput"),
  videoDurationInput: document.querySelector("#videoDurationInput"),
  videoHeatInput: document.querySelector("#videoHeatInput"),
  videoTagsInput: document.querySelector("#videoTagsInput"),
  videoNoteInput: document.querySelector("#videoNoteInput"),
  statusLine: document.querySelector("#statusLine"),
  viewTabs: document.querySelector("#viewTabs"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCount: document.querySelector("#resultCount"),
  videoGrid: document.querySelector("#videoGrid")
};

function allVideos() {
  return [...baseVideos, ...customVideos];
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeStoredVideos(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => item && (item.id || item.url) && item.title)
    .map(item => ({
      channel: "自訂影片",
      region: "自訂",
      style: "自訂",
      duration: "-",
      heat: "low",
      note: "自訂新增影片。",
      ...item,
      id: item.id || parseYoutubeId(item.url || ""),
      tags: Array.isArray(item.tags) ? item.tags : normalizeTags(String(item.tags || ""), ["自訂"]),
      custom: true
    }))
    .filter(item => item.id);
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function durationSeconds(duration) {
  const parts = String(duration || "").split(":").map(Number);
  if (parts.some(part => Number.isNaN(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function thumbnailUrl(video) {
  return `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
}

function setStatus(message, type = "info") {
  els.statusLine.textContent = message;
  els.statusLine.dataset.type = type;
}

function saveFavorites() {
  localStorage.setItem("slowJoggingFavorites", JSON.stringify([...state.favorites]));
}

function saveCustomVideos() {
  localStorage.setItem("slowJoggingCustomVideos", JSON.stringify(customVideos));
}

function parseYoutubeId(value) {
  const text = value.trim();
  const direct = text.match(/^[a-zA-Z0-9_-]{11}$/);
  if (direct) return text;

  try {
    const url = new URL(text);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "").slice(0, 11);
    if (url.searchParams.get("v")) return url.searchParams.get("v").slice(0, 11);
    const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shorts) return shorts[1];
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed) return embed[1];
  } catch {
    return "";
  }

  return "";
}

function normalizeTags(value, fallbackTags = []) {
  const tags = value
    .split(/[,，、]/)
    .map(tag => tag.trim())
    .filter(Boolean);
  return [...new Set(tags.length > 0 ? tags : fallbackTags)];
}

function populateSelect(select, values, allLabel = "全部") {
  select.innerHTML = [allLabel, ...values].map(value => (
    `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`
  )).join("");
}

function initFilters() {
  const videos = allVideos();
  populateSelect(els.regionFilter, unique(videos.map(video => video.region)));
  populateSelect(els.styleFilter, unique(videos.map(video => video.style)));
  populateSelect(els.heatFilter, Object.keys(heatLabel).map(key => heatLabel[key]));

  const importantTags = [
    "初學",
    "180BPM",
    "30分鐘",
    "20分鐘",
    "原地跑",
    "室內",
    "徐棟英",
    "銀髮",
    "低衝擊",
    "高流量",
    "中文",
    "日文",
    "韓文",
    "英文"
  ];
  const extraTags = unique(videos.flatMap(video => video.tags || []))
    .filter(tag => !importantTags.includes(tag))
    .slice(0, 12);
  const visibleTags = [...importantTags, ...extraTags];

  els.tagCloud.innerHTML = visibleTags.map(tag => (
    `<button class="tag-button ${state.tags.has(tag) ? "active" : ""}" data-tag="${escapeAttr(tag)}" type="button">${escapeHtml(tag)}</button>`
  )).join("");
}

function filterVideos() {
  const query = state.query.trim().toLowerCase();
  let videos = allVideos().filter(video => {
    const heatText = heatLabel[video.heat] || video.heat;
    const haystack = [
      video.title,
      video.channel,
      video.region,
      video.style,
      video.duration,
      video.note,
      heatText,
      video.tags.join(" ")
    ].join(" ").toLowerCase();

    const queryMatch = !query || haystack.includes(query);
    const regionMatch = state.region === "全部" || video.region === state.region;
    const styleMatch = state.style === "全部" || video.style === state.style;
    const heatMatch = state.heat === "全部" || heatText === state.heat;
    const tagMatch = state.tags.size === 0 || [...state.tags].every(tag => video.tags.includes(tag));
    const viewMatch =
      state.view === "all" ||
      (state.view === "favorites" && state.favorites.has(video.id));

    return queryMatch && regionMatch && styleMatch && heatMatch && tagMatch && viewMatch;
  });

  videos.sort((a, b) => {
    if (state.sort === "duration") return durationSeconds(b.duration) - durationSeconds(a.duration);
    if (state.sort === "channel") return a.channel.localeCompare(b.channel, "zh-Hant") || a.title.localeCompare(b.title, "zh-Hant");
    if (state.sort === "favorite") return Number(state.favorites.has(b.id)) - Number(state.favorites.has(a.id)) || heatRank[b.heat] - heatRank[a.heat];
    return heatRank[b.heat] - heatRank[a.heat] || durationSeconds(b.duration) - durationSeconds(a.duration);
  });

  return videos;
}

function renderStats() {
  const videos = allVideos();
  els.totalVideos.textContent = videos.length;
  els.totalChannels.textContent = unique(videos.map(video => video.channel)).length;
  els.favoriteCount.textContent = state.favorites.size;
  els.selectedCount.textContent = state.selected.size;
}

function renderVideos() {
  const visible = filterVideos();
  const titleMap = {
    all: "全部影片",
    favorites: "我的最愛"
  };

  els.resultTitle.textContent = titleMap[state.view];
  els.resultCount.textContent = `${visible.length} 部符合`;

  if (visible.length === 0) {
    els.videoGrid.innerHTML = `<div class="empty-state">沒有符合的影片，請調整搜尋或分類標籤。</div>`;
    renderStats();
    return;
  }

  els.videoGrid.innerHTML = visible.map(video => {
    const selected = state.selected.has(video.id);
    const favorite = state.favorites.has(video.id);
    return `
      <article class="video-card ${selected ? "selected" : ""}" data-id="${escapeAttr(video.id)}">
        <div class="cover">
          <img src="${thumbnailUrl(video)}" alt="${escapeAttr(video.title)} 封面" loading="lazy" />
          <span class="cover-badge">${escapeHtml(video.region)} · ${escapeHtml(heatLabel[video.heat] || video.heat)}</span>
          <span class="duration-badge">${escapeHtml(video.duration)}</span>
        </div>
        <div class="video-body">
          <h3>${escapeHtml(video.title)}</h3>
          <div class="channel-line">
            <span>${escapeHtml(video.channel)}</span>
            <span>${escapeHtml(video.style)}</span>
          </div>
          <p class="note">${escapeHtml(video.note)}</p>
          <div class="meta-tags">
            ${video.tags.slice(0, 5).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="card-actions">
            <label class="select-label">
              <input type="checkbox" data-action="select" ${selected ? "checked" : ""} />
              勾選
            </label>
            <button class="favorite-button ${favorite ? "active" : ""}" data-action="favorite" type="button" title="加入最愛" aria-label="加入最愛">${favorite ? "★" : "☆"}</button>
            <a class="open-button" href="${escapeAttr(video.url)}" target="_blank" rel="noreferrer" title="開啟影片" aria-label="開啟影片">▶</a>
            ${video.custom ? `<button class="delete-button" data-action="delete" type="button" title="刪除自訂影片" aria-label="刪除自訂影片">刪除</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");

  renderStats();
}

function selectedOrVisibleVideos() {
  const selected = allVideos().filter(video => state.selected.has(video.id));
  return selected.length > 0 ? selected : filterVideos();
}

function downloadBlob(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 60000);
}

function resetFilters() {
  state.query = "";
  state.region = "全部";
  state.style = "全部";
  state.heat = "全部";
  state.tags.clear();
  state.view = "all";
  state.sort = "heat";
  els.searchInput.value = "";
  els.regionFilter.value = "全部";
  els.styleFilter.value = "全部";
  els.heatFilter.value = "全部";
  els.sortSelect.value = "heat";
  document.querySelectorAll(".tag-button").forEach(button => button.classList.remove("active"));
  document.querySelectorAll(".tab-button").forEach(button => button.classList.toggle("active", button.dataset.view === "all"));
  renderVideos();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

els.searchInput.addEventListener("input", event => {
  state.query = event.target.value;
  renderVideos();
});

els.regionFilter.addEventListener("change", event => {
  state.region = event.target.value;
  renderVideos();
});

els.styleFilter.addEventListener("change", event => {
  state.style = event.target.value;
  renderVideos();
});

els.heatFilter.addEventListener("change", event => {
  state.heat = event.target.value;
  renderVideos();
});

els.sortSelect.addEventListener("change", event => {
  state.sort = event.target.value;
  renderVideos();
});

els.tagCloud.addEventListener("click", event => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;
  const tag = button.dataset.tag;
  if (state.tags.has(tag)) {
    state.tags.delete(tag);
  } else {
    state.tags.add(tag);
  }
  button.classList.toggle("active", state.tags.has(tag));
  renderVideos();
});

els.viewTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  document.querySelectorAll(".tab-button").forEach(tab => tab.classList.toggle("active", tab === button));
  renderVideos();
});

els.videoGrid.addEventListener("click", event => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  const id = card.dataset.id;
  const action = event.target.dataset.action;

  if (action === "select") {
    event.target.checked ? state.selected.add(id) : state.selected.delete(id);
    renderVideos();
  }

  if (action === "favorite") {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    saveFavorites();
    renderVideos();
  }

  if (action === "delete") {
    customVideos = customVideos.filter(video => video.id !== id);
    state.selected.delete(id);
    state.favorites.delete(id);
    saveCustomVideos();
    saveFavorites();
    initFilters();
    renderVideos();
    setStatus("已刪除自訂影片。");
  }
});

els.resetFiltersBtn.addEventListener("click", resetFilters);

els.exportJsonBtn.addEventListener("click", () => {
  const videos = selectedOrVisibleVideos();
  downloadBlob(JSON.stringify({ exportedAt: new Date().toISOString(), videos }, null, 2), "slow-jogging-videos.json", "application/json;charset=utf-8");
  setStatus("已匯出 JSON。");
});

els.addVideoForm.addEventListener("submit", event => {
  event.preventDefault();
  const id = parseYoutubeId(els.videoUrlInput.value);
  if (!id) {
    setStatus("請輸入有效的 YouTube 影片連結。");
    return;
  }

  if (allVideos().some(video => video.id === id)) {
    setStatus("這支影片已經在資料庫裡。");
    return;
  }

  const region = els.videoRegionInput.value;
  const style = els.videoStyleInput.value;
  const newVideo = {
    id,
    title: els.videoTitleInput.value.trim(),
    channel: els.videoChannelInput.value.trim(),
    region,
    style,
    duration: els.videoDurationInput.value.trim() || "-",
    heat: els.videoHeatInput.value,
    tags: normalizeTags(els.videoTagsInput.value, [region, style, "自訂"]),
    note: els.videoNoteInput.value.trim() || "自訂新增影片。",
    url: `https://youtu.be/${id}`,
    custom: true
  };

  customVideos = [...customVideos, newVideo];
  saveCustomVideos();
  els.addVideoForm.reset();
  els.videoRegionInput.value = "臺灣";
  els.videoStyleInput.value = "原地跑";
  els.videoHeatInput.value = "medium";
  state.selected.add(id);
  initFilters();
  renderVideos();
  setStatus("已新增影片，並自動勾選。");
});

els.importInput.addEventListener("change", async event => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    const items = Array.isArray(imported) ? imported : imported.videos;
    if (!Array.isArray(items)) throw new Error("JSON 必須是陣列，或包含 videos 陣列。");
    const normalized = items
      .map(item => ({
        ...item,
        id: item.id || parseYoutubeId(item.url || "")
      }))
      .filter(item => item.id && item.title && item.url)
      .map(item => ({
        channel: "自訂匯入",
        region: "自訂",
        style: "自訂",
        duration: "-",
        heat: "low",
        note: "批次匯入影片。",
        custom: true,
        ...item,
        tags: Array.isArray(item.tags) ? item.tags : normalizeTags(String(item.tags || ""), ["自訂"])
      }));
    const knownIds = new Set(allVideos().map(video => video.id));
    const newItems = normalized
      .filter(item => !knownIds.has(item.id))
      .map(item => ({ ...item, custom: true }));
    customVideos = [...customVideos, ...newItems];
    saveCustomVideos();
    initFilters();
    renderVideos();
    setStatus(`已匯入 ${newItems.length} 筆新資料。`);
  } catch (error) {
    setStatus(`匯入失敗：${error.message}`);
  } finally {
    event.target.value = "";
  }
});

initFilters();
renderVideos();
