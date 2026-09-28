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

  /* v0.336: 프로필(티어) 표시 — 기능 없이 예시 값.
   * 티어 엠블럼 에셋 경로·보석(숫자) 위치는 이 테이블 한 곳에서 관리.
   * gx,gy,gr = 1024 기준 보석 중심/반지름 (tier_emblems/work/gems.json) — 표시 크기/1024 배율로 사용. */
  const TIER_TABLE = {
    bronze:   { name: "브론즈",   src: "assets/tier/tier_bronze.png",   gx: 515, gy: 569, gr: 126 },
    silver:   { name: "실버",     src: "assets/tier/tier_silver.png",   gx: 516, gy: 589, gr: 121 },
    gold:     { name: "골드",     src: "assets/tier/tier_gold.png",     gx: 519, gy: 631, gr: 122 },
    platinum: { name: "플래티넘", src: "assets/tier/tier_platinum.png", gx: 514, gy: 612, gr: 108 },
    diamond:  { name: "다이아",   src: "assets/tier/tier_diamond.png",  gx: 520, gy: 610, gr: 102 },
    champion: { name: "챔피언",   src: "assets/tier/tier_champion.png", gx: 511, gy: 598, gr: 89 },
  };
  const TIER_ASSET_V = "0.336";
  const PROFILE_DEMO = { nick: "남탓하면바로던짐", tier: "diamond", div: 2, progress: 35 };
  /** 티어 엠블럼 + 보석 위 세부 단계 숫자. size: "big" | "mini" (숫자 규칙은 lobby.css .tier-em) */
  function tierEmblem(tier, div, size) {
    const t = TIER_TABLE[tier] || TIER_TABLE.diamond;
    const vars = `--gx:${t.gx / 1024};--gy:${t.gy / 1024};--gr:${t.gr / 1024}`;
    return `<div class="tier-em ${size}" style="${vars}"><img src="${t.src}?v=${TIER_ASSET_V}" alt="${t.name}" draggable="false"><span class="tier-num">${div}</span></div>`;
  }
  function profileHtml(statusHtml) {
    const p = PROFILE_DEMO, t = TIER_TABLE[p.tier] || TIER_TABLE.diamond;
    const next = Math.max(1, p.div - 1);
    const pct = Math.max(0, Math.min(100, p.progress | 0));
    const mini = (div, cls) => `
      <div class="lp-mini ${cls}">${tierEmblem(p.tier, div, "mini")}<small>${t.name} ${div}</small></div>`;
    return `
      <div class="lp-top">
        ${tierEmblem(p.tier, p.div, "big")}
        <div class="lp-info">
          <div class="lp-name">${esc(p.nick)}</div>
          <div class="lp-tier">${t.name} ${p.div}</div>
        </div>
        <div class="lp-status">${statusHtml}</div>
      </div>
      <div class="lp-prog">
        ${mini(p.div, "cur")}
        <div class="lp-bar-wrap">
          <div class="lp-label">등급 진척도: <b>${pct}%</b></div>
          <div class="lp-bar"><i style="width:${pct}%"></i></div>
        </div>
        ${mini(next, "next")}
      </div>`;
  }
  const tribeOf = (id) => TRIBES.find(t => t.id === id) || { id, name: id, en: id };
  const iconOf = (id) => (typeof TRIBE_ICONS !== "undefined" && TRIBE_ICONS[id]) || "";
  const esc = (s) => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  /* ---------- generic prompt / confirm ---------- */
  function prompt({ title, text = "", value = "", okText = "확인", cancelText = "취소", input = true, validate, maxLength = 20 }) {
    return new Promise(resolve => {
      const pop = $("fsPromptPop"), inp = $("fsPromptInput"), err = $("fsPromptErr");
      $("fsPromptTitle").textContent = title;
      $("fsPromptText").textContent = text;
      $("fsPromptText").style.display = text ? "" : "none";
      $("fsPromptOk").textContent = okText;
      $("fsPromptCancel").textContent = cancelText;
      inp.maxLength = maxLength;
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

  /* ---------- data ---------- */
  // v0.334: 로컬 덱 여러 개 (game.js loadLocalDecks, 최대 10)
  function localDecks() {
    return loadLocalDecks().map(d => ({ id: "local:" + d.id, lid: d.id, name: d.name, tribe: d.tribe, cards: d.cards.slice(), local: true }));
  }
  const nameRule = (v) => deckNameError(v);
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
  const maxDecks = () => L.online ? ((window.FSNet && FSNet.state.maxDecks) || 10) : LOCAL_DECK_MAX;

  /* ---------- render ---------- */
  function render() {
    const max = maxDecks();
    $("lobbyDeckCount").textContent = L.online ? `${L.decks.length} / ${max}` : `로컬 ${L.decks.length} / ${max}`;
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
    const canAdd = L.decks.length < max;
    if (canAdd) tiles.push(`<div class="lobby-deck add" id="lobbyAddDeck"><div class="lobby-deck-icon plus">+</div><div class="lobby-deck-name">새 덱</div></div>`);
    $("lobbyDecks").innerHTML = tiles.join("");
    $("lobbyDecks").querySelectorAll(".lobby-deck[data-id]").forEach(el => {
      el.onclick = () => { L.selId = el.dataset.id; render(); };
      el.ondblclick = () => editSelected();
    });
    const add = $("lobbyAddDeck");
    if (add) add.onclick = newDeck;

    const acc = window.FSNet && FSNet.account();
    // v0.336: 프로필 영역 (예시 값) + 접속 상태는 오른쪽 위에 작게
    $("lobbyUser").innerHTML = profileHtml(L.online
      ? `<span class="lobby-user-name">${esc(acc.displayName)}</span><button class="lp-link" id="btnLobbyLogout">로그아웃</button>`
      : `<span class="lobby-user-name off">오프라인</span>${window.FSNet && FSNet.isOnline() ? '<button class="lp-link" id="btnLobbyLogin">로그인</button>' : ""}`);
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
    $("btnLobbyRename").disabled = !d; // v0.334: 로컬 덱도 이름 변경·삭제
    $("btnLobbyDelete").disabled = !d;
  }

  /* ---------- actions ---------- */
  async function login() {
    if (!window.FSNet || !FSNet.isOnline()) return false;
    const name = await prompt({
      title: "로그인 (테스트)",
      text: "임시 테스트 로그인입니다. 이름을 입력하세요. (출시 때 스팀 로그인으로 바뀝니다)\n로그인 없이 이 기기 덱으로 하려면 「로컬 모드」.",
      okText: "로그인",
      cancelText: "로컬 모드",
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
  function newDeck() {
    // v0.333: 타이틀 「덱 구성」과 같은 속성 선택 화면 (뒤로 → 로비)
    openTribeSelect("lobby", { onPick: (tr) => openBuilder(tr, [], null), onBack: open });
  }
  function editSelected() {
    const d = selected();
    if (!d) return;
    openBuilder(d.tribe, d.cards, d.local ? { lid: d.lid, name: d.name, local: true } : { id: d.id, name: d.name });
  }
  async function renameSelected() {
    const d = selected();
    if (!d) return;
    const name = await prompt({
      title: "덱 이름 변경", text: `최대 ${DECK_NAME_MAX}자`, value: d.name, okText: "변경", maxLength: DECK_NAME_MAX,
      validate: async (v) => {
        const e = nameRule(v); if (e) return e;
        if (d.local) {
          const list = loadLocalDecks(); const x = list.find(k => k.id === d.lid);
          if (!x) return "덱을 찾을 수 없습니다.";
          x.name = v.replace(/\s+/g, " ").trim(); persistLocalDecks(list); return null;
        }
        const r = await FSNet.renameDeck(d.id, v); return r.ok ? null : (r.message || "변경 실패");
      },
    });
    if (name) refresh();
  }
  async function deleteSelected() {
    const d = selected();
    if (!d) return;
    const ok = await prompt({ title: "덱 삭제", text: `「${d.name}」 덱을 삭제할까요?`, okText: "삭제", input: false });
    if (!ok) return;
    if (d.local) {
      persistLocalDecks(loadLocalDecks().filter(k => k.id !== d.lid));
    } else {
      const r = await FSNet.deleteDeck(d.id);
      if (!r.ok) alert(r.message || "삭제하지 못했습니다.");
    }
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
      maxLength: DECK_NAME_MAX,
      validate: async (v) => {
        const e = nameRule(v); if (e) return e;
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

  /* v0.334: 로그인 안 한(로컬) 저장 — 항상 이름 입력, 로컬 덱 목록(최대 10)에 추가/덮어쓰기. */
  async function saveDraftLocal(cards, tribeId, quiet) {
    const ed = L.edit && L.edit.local ? L.edit : null;
    if (quiet) {
      // "이 덱으로 플레이": 편집 중인 로컬 덱만 카드 갱신 (이름 창 없음)
      if (ed) { const list = loadLocalDecks(); const x = list.find(k => k.id === ed.lid); if (x) { x.cards = cards.slice(); x.tribe = tribeId; persistLocalDecks(list); } }
      return;
    }
    const t = tribeOf(tribeId);
    let saved = null;
    const name = await prompt({
      title: ed ? "덱 저장 (덮어쓰기)" : "덱 저장",
      text: `이 기기에 저장할 덱 이름을 입력하세요. (최대 ${DECK_NAME_MAX}자 · 덱 최대 ${LOCAL_DECK_MAX}개)`,
      value: (ed && ed.name) || (t.name + " 덱"),
      okText: "저장",
      maxLength: DECK_NAME_MAX,
      validate: async (v) => {
        const e = nameRule(v); if (e) return e;
        const nm = v.replace(/\s+/g, " ").trim();
        const list = loadLocalDecks();
        let x = ed && list.find(k => k.id === ed.lid);
        if (x) { x.name = nm; x.tribe = tribeId; x.cards = cards.slice(); }
        else {
          if (list.length >= LOCAL_DECK_MAX) return `로컬 덱은 최대 ${LOCAL_DECK_MAX}개입니다. 로비에서 덱을 삭제하세요.`;
          x = { id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: nm, tribe: tribeId, cards: cards.slice() };
          list.push(x);
        }
        persistLocalDecks(list);
        saved = x;
        return null;
      },
    });
    if (name && saved) {
      L.edit = { lid: saved.id, name: saved.name, local: true };
      L.selId = "local:" + saved.id;
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
  // v0.334: 덱 구성은 로비에서만 들어옴 → 「뒤로」는 로비
  if (back) back.onclick = () => open();

  window.Lobby = { enter, open, refresh, saveDraftToServer, saveDraftLocal, prompt, _state: L };
  if (window.FSNet) FSNet.probe();
})();
