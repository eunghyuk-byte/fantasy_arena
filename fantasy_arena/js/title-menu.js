/* Keep touch feedback visible while held, including browsers delaying :active. */
(() => {
  const buttons = document.querySelectorAll('#titleMenu button');
  for (const button of buttons) {
    const clear = () => button.classList.remove('is-pressed');
    button.addEventListener('pointerdown', event => {
      if (event.button === 0 && !button.disabled) button.classList.add('is-pressed');
    });
    for (const event of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture', 'blur']) {
      button.addEventListener(event, clear);
    }
    window.addEventListener('blur', clear);
  }
})();
