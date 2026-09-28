/* v0.331 Lobby: my deck list (left) + matching (right). Hearthstone-style.
 * Online (server + login): decks come from the server (max 10 per account).
 * Offline: shows the local per-tribe decks (localStorage "runestone-decks"); matching is disabled.
 * Matching is a waiting screen + cancel only in this step. */
(function () {
  const $ = (id) => document.getElementById(id);
  const L = {
    decks: [],
    selId: null,
    online: false,
    fromLobby: false,   // builder opened from lobby -> back returns here
    edit: null,         // { id, name } server deck being edited in the builder
    waitTimer: null,
  };

  const tribeOf = (id) => TRIBES.find(t => t.id === id) || { id, name: id, en: id };
  const iconOf = (id) => (typeof TRIBE_ICONS !== "undefined" && TRIBE_ICONS[id]) || "";
  const esc = (s) => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  /* ---------- generic prompt / confirm ---------- */
  function prompt({ title, text = "", value = "", okText = "확인", input = true, validate }) {
    return new Promise(resolve => {
      const pop = $("fsPromptPop"), inp = $("fsPromptInput"), err = $("fsPromptErr");
      $("fsPromptTitle").textContent = title;
      $("fsPromptText").textContent = text;
      $("fsPromptText").style.display = text ? "" : "none";
      $("fsPromptOk").textContent = okText;
      inp.style.display = input ? "" : "none";
      inp.value = value;
      err.textContent = "";
      pop.classList.add("show");
      if (input) setTimeout(() => { inp.focus(); inp.select(); }, 30);
      const done = async (ok) => {
        if (ok && input) {
          const v = inp.value.trim();
          if (!v) { err.textContent = "이름을 입력하세요."; return; }
          if (validate) {
            const e = await validate(v);
            if (e) { err.textContent = e; return; }
          }
        }
        cleanup();
        pop.classList.remove("show");
        resolve(ok ? (input ? inp.value.trim() : true) : null);
      };
      const onOk = () => done(true), onCancel = () => done(false);
      const onKey = (e) => { if (e.key === "Enter") onOk(); else if (e.key === "Escape") onCancel(); };
      function cleanup() {
        $("fsPromptOk").removeEventListener("click", onOk);
        $("fsPromptCancel").removeEventListener("click", onCancel);
        inp.removeEventListener("keydown", onKey);
      }
      $("fsPromptOk").addEventListener("click", onOk);
      $("fsPromptCancel").addEventListener("click", onCancel);
      inp.addEventListener("keydown", onKey);
    });
  }

  function pickTribe() {
    return new Promise(resolve => {
      const pop = $("fsTribePop"), grid = $("fsTribeGrid");
      grid.innerHTML = TRIBES.filter(t => t.open).map(t => `
        <button class="fs-tribe" data-id="${t.id}" style="--tc:${t.color}">
          <img src="${iconOf(t.id)}" alt=""><span>${esc(t.name)}</span>
        </button>`).join("");
      const close = (v) => { pop.classList.remove("show"); resolve(v); };
      grid.querySelectorAll(".fs-tribe").forEach(b => { b.onclick = () => close(b.dataset.id); });
      $("fsTribeCancel").onclick = () => close(null);
      pop.classList.add("show");
    });
  }

  /* ---------- data ---------- */
  function localDecks() {
    const map = (typeof loadSavedDecks === "function") ? loadSavedDecks() : {};
    return TRIBES.filter(t => Array.isArray(map[t.id]) && map[t.id].length === 30)
      .map(t => ({ id: "local:" + t.id, name: t.name + " 덱", tribe: t.id, cards: map[t.id].slice(), local: true }));
  }
  async function refresh() {
    L.online = !!(window.FSNet && FSNet.isLoggedIn());
    if (L.online) {
      const r = await FSNet.listDecks();
      if (r.ok) L.decks = r.decks;
      else { L.online = FSNet.isLoggedIn(); L.decks = L.online ? [] : localDecks(); }
    } else {
      L.decks = localDecks();
    }
    if (!L.decks.find(d => String(d.id) === String(L.selId))) L.selId = L.decks.length ? L.decks[0].id : null;
    render();
  }
  const selected = () => L.decks.find(d => String(d.id) === String(L.selId)) || null;
  const maxDecks = () => (window.FSNet && FSNet.state.maxDecks) || 10;

  /* ---------- render ---------- */
  function render() {
    const max = maxDecks();
    $("lobbyDeckCount").textContent = L.online ? `${L.decks.length} / ${max}` : `로컬 ${L.decks.length}`;
    const notice = $("lobbyNotice");
    if (!L.online) {
      notice.textContent = (window.FSNet && FSNet.isOnline())
        ? "로그인하지 않아 이 기기의 덱만 보여요."
        : "서버에 연결되지 않아 이 기기에 저장된 덱만 보여요. 매칭은 서버 연결이 필요합니다.";
      notice.style.display = "";
    } else notice.style.display = "none";

    const tiles = L.decks.map(d => `
      <div class="lobby-deck ${String(d.id) === String(L.selId) ? "sel" : ""}" data-id="${esc(d.id)}" style="--tc:${tribeOf(d.tribe).color || "#9a7b32"}" title="${esc(d.name)}">
        <div class="lobby-deck-icon"><img src="${iconOf(d.tribe)}" alt="${esc(tribeOf(d.tribe).en)}" draggable="false"></div>
        <div class="lobby-deck-name">${esc(d.name)}</div>
      </div>`);
    const canAdd = L.online ? L.decks.length < max : true;
    if (canAdd) tiles.push(`<div class="lobby-deck add" id="lobbyAddDeck"><div class="lobby-deck-icon plus">+</div><div class="lobby-deck-name">새 덱</div></div>`);
    $("lobbyDecks").innerHTML = tiles.join("");
    $("lobbyDecks").querySelectorAll(".lobby-deck[data-id]").forEach(el => {
      el.onclick = () => { L.selId = el.dataset.id; render(); };
      el.ondblclick = () => editSelected();
    });
    const add = $("lobbyAddDeck");
    if (add) add.onclick = newDeck;

    const acc = window.FSNet && FSNet.account();
    $("lobbyUser").innerHTML = L.online
      ? `<span class="lobby-user-name">${esc(acc.displayName)}</span><button class="menu-btn ghost" id="btnLobbyLogout">로그아웃</button>`
      : `<span class="lobby-user-name off">오프라인</span>${window.FSNet && FSNet.isOnline() ? '<button class="menu-btn ghost" id="btnLobbyLogin">로그인</button>' : ""}`;
    const lo = $("btnLobbyLogout"); if (lo) lo.onclick = async () => { await FSNet.logout(); refresh(); };
    const li = $("btnLobbyLogin"); if (li) li.onclick = async () => { if (await login()) refresh(); };

    const d = selected();
    $("lobbySel").innerHTML = d ? `
      <div class="lobby-sel-icon"><img src="${iconOf(d.tribe)}" alt="" draggable="false"></div>
      <div class="lobby-sel-name">${esc(d.name)}</div>
      <div class="lobby-sel-meta">${esc(tribeOf(d.tribe).name)} · ${d.cards.length}장${d.local ? " · 이 기기" : ""}</div>`
      : `<div class="lobby-sel-empty">덱을 고르거나<br>「새 덱」으로 만드세요.</div>`;
    $("btnMatch").disabled = !(d && L.online);
    $("btnMatch").title = L.online ? "" : "매칭은 서버 로그인 후 가능합니다.";
    $("btnLobbyAi").disabled = !d;
    $("btnLobbyEdit").disabled = !d;
    $("btnLobbyRename").disabled = !(d && !d.local);
    $("btnLobbyDelete").disabled = !(d && !d.local);
  }

  /* ---------- actions ---------- */
  async function login() {
    if (!window.FSNet || !FSNet.isOnline()) return false;
    const name = await prompt({
      title: "로그인 (테스트)",
      text: "임시 테스트 로그인입니다. 이름을 입력하세요. (출시 때 스팀 로그인으로 바뀝니다)",
      okText: "로그인",
      validate: async (v) => { const r = await FSNet.devLogin(v); return r.ok ? null : (r.message || "로그인 실패"); },
    });
    return !!name;
  }
  async function enter() {
    if (window.FSNet && !FSNet.state.probed) await FSNet.probe();
    if (window.FSNet && FSNet.isOnline() && !FSNet.isLoggedIn()) await login();
    open();
  }
  function open() {
    hideScreens();
    $("lobby").classList.add("active");
    try { Bgm.to("menu", 600); } catch (e) {}
    L.fromLobby = false;
    L.edit = null;
    refresh();
  }
  function openBuilder(tribeId, cards, edit) {
    const t = TRIBES.find(x => x.id === tribeId);
    if (!t) return;
    selectedHero = t;
    L.fromLobby = true;
    L.edit = edit;
    draftDeck = cards.slice();
    showBuilder();
    draftDeck = cards.slice(); // showBuilder refills an empty draft from local storage
    sanitizeDraftDeck();
    renderBuilder();
  }
  async function newDeck() {
    const tr = await pickTribe();
    if (tr) openBuilder(tr, [], null);
  }
  function editSelected() {
    const d = selected();
    if (!d) return;
    openBuilder(d.tribe, d.cards, d.local ? null : { id: d.id, name: d.name });
  }
  async function renameSelected() {
    const d = selected();
    if (!d || d.local) return;
    const name = await prompt({
      title: "덱 이름 변경", value: d.name, okText: "변경",
      validate: async (v) => { const r = await FSNet.renameDeck(d.id, v); return r.ok ? null : (r.message || "변경 실패"); },
    });
    if (name) refresh();
  }
  async function deleteSelected() {
    const d = selected();
    if (!d || d.local) return;
    const ok = await prompt({ title: "덱 삭제", text: `「${d.name}」 덱을 삭제할까요?`, okText: "삭제", input: false });
    if (!ok) return;
    const r = await FSNet.deleteDeck(d.id);
    if (!r.ok) alert(r.message || "삭제하지 못했습니다.");
    L.selId = null;
    refresh();
  }
  function playAi() {
    const d = selected();
    if (!d) return;
    const t = TRIBES.find(x => x.id === d.tribe);
    if (!t) return;
    selectedHero = t;
    window._deckOverride = d.cards.slice();
    startGame(true);
  }
  function startMatch() {
    const d = selected();
    if (!d || !L.online) return;
    $("lobbyWaitDeck").textContent = `${d.name} · ${tribeOf(d.tribe).name}`;
    $("lobbyWait").classList.add("show");
    const t0 = Date.now();
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000);
      $("lobbyWaitTime").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    };
    tick();
    clearInterval(L.waitTimer);
    L.waitTimer = setInterval(tick, 500);
    // Next step: POST /api/match/queue { deckId } + WebSocket for the match result.
  }
  function cancelMatch() {
    clearInterval(L.waitTimer);
    L.waitTimer = null;
    $("lobbyWait").classList.remove("show");
  }

  /* Called by saveDraftDeck() when logged in. */
  async function saveDraftToServer(cards, tribeId, quiet) {
    if (quiet) {
      // "이 덱으로 플레이": only sync the deck being edited, no prompt.
      if (L.edit && L.edit.id) FSNet.updateDeck(L.edit.id, { tribe: tribeId, cards });
      return;
    }
    const t = tribeOf(tribeId);
    let saved = null;
    const name = await prompt({
      title: L.edit ? "덱 저장 (덮어쓰기)" : "덱 저장",
      text: L.edit ? "이름을 확인하고 저장하세요." : `서버에 저장할 덱 이름을 입력하세요. (계정당 최대 ${maxDecks()}개)`,
      value: (L.edit && L.edit.name) || (t.name + " 덱"),
      okText: "저장",
      validate: async (v) => {
        const r = L.edit
          ? await FSNet.updateDeck(L.edit.id, { name: v, tribe: tribeId, cards })
          : await FSNet.createDeck({ name: v, tribe: tribeId, cards });
        if (!r.ok) return r.message || "저장하지 못했습니다.";
        saved = r.deck;
        return null;
      },
    });
    if (name && saved) {
      L.edit = { id: saved.id, name: saved.name };
      L.selId = saved.id;
      alert(`「${saved.name}」 덱을 저장했습니다.`);
    }
  }

  /* ---------- wiring ---------- */
  $("btnLobby").onclick = enter;
  $("btnLobbyBack").onclick = () => { cancelMatch(); backTitle(); };
  $("btnLobbyEdit").onclick = editSelected;
  $("btnLobbyRename").onclick = renameSelected;
  $("btnLobbyDelete").onclick = deleteSelected;
  $("btnLobbyAi").onclick = playAi;
  $("btnMatch").onclick = startMatch;
  $("btnMatchCancel").onclick = cancelMatch;
  const back = $("btnBackMenu");
  if (back) back.onclick = () => { if (L.fromLobby) open(); else backTitle(); };
  const deckBtn = $("btnDeck");
  if (deckBtn) {
    const prev = deckBtn.onclick;
    deckBtn.onclick = (e) => { L.fromLobby = false; L.edit = null; if (prev) prev.call(deckBtn, e); };
  }

  window.Lobby = { enter, open, refresh, saveDraftToServer, prompt, _state: L };
  if (window.FSNet) FSNet.probe();
})();
