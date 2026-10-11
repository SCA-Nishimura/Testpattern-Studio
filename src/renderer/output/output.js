'use strict';

(function () {
  const canvas = document.getElementById('stage');
  const hint = document.getElementById('hint');
  const renderer = new TP.Renderer(canvas, { physicalPixels: true });

  setTimeout(() => hint.classList.add('hide'), 2600);

  window.tp.onStateApply((state) => {
    if (state) renderer.setState(state);
  });

  window.tp.pullState().then((state) => {
    if (state) renderer.setState(state);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'F11') {
      e.preventDefault();
      window.tp.requestOutputClose();
    }
  });

  // クリックでヒントを再表示（どのキーで閉じるか忘れたとき用）
  window.addEventListener('mousedown', () => {
    hint.classList.remove('hide');
    setTimeout(() => hint.classList.add('hide'), 2000);
  });
})();
