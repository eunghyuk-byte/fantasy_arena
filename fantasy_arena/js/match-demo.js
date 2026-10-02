(() => {
  // Visual simulated count: never a server population or queue measurement.
  const panel=document.getElementById('matchDemo');
  if (!panel) return;
  panel.hidden=false;
  const lobby=document.getElementById('lobby');
  const count=document.getElementById('matchDemoCount'), dots=document.getElementById('matchDemoDots');
  if (!lobby || !count || !dots) return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let countTimer=null, dotTimer=null, phase=1, suspended=false;
  function updateCount() {
    let value=10+Math.floor(Math.random()*91);
    if (value===Number(count.textContent)) value=value===100?10:value+1;
    count.textContent=String(value);
  }
  function stop() {
    if (countTimer!==null) clearInterval(countTimer);
    if (dotTimer!==null) clearInterval(dotTimer);
    countTimer=dotTimer=null;
  }
  function sync() {
    if (suspended || document.hidden || !lobby.classList.contains('active')) { stop(); return; }
    if (countTimer!==null) return;
    updateCount(); phase=1; dots.textContent=reduced.matches?'...':'.';
    countTimer=setInterval(updateCount,4000);
    if (!reduced.matches) dotTimer=setInterval(()=>{phase=phase%3+1;dots.textContent='.'.repeat(phase);},700);
  }
  new MutationObserver(sync).observe(lobby,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',()=>{suspended=true;stop();});
  window.addEventListener('pageshow',()=>{suspended=false;sync();});
  reduced.addEventListener('change',()=>{stop();sync();});
  sync();
})();
