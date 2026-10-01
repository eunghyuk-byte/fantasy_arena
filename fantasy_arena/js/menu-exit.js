/* Shared by the title and settings menu. A future wrapper may supply quit(). */
(() => {
  async function requestExit() {
    const notice = document.getElementById('exitNotice');
    if (notice) notice.textContent = '';
    try {
      const bridge = window.fantasyArenaDesktop;
      if (bridge && typeof bridge.quit === 'function') {
        const result = await bridge.quit();
        if (result !== false && !(result && result.ok === false)) return;
      }
    } catch (_) { /* Fall back to the browser's supported close request. */ }
    try { window.close(); } catch (_) { /* Guidance below remains available. */ }
    setTimeout(() => {
      if (!window.closed && notice) notice.textContent = '브라우저 탭을 닫아 종료해주세요.';
    }, 200);
  }
  for (const id of ['btnTitleQuit', 'btnQuit']) {
    const button = document.getElementById(id);
    if (button) button.onclick = requestExit;
  }
})();
