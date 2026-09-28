// appship landing page: terminal replay, copy buttons, scroll reveal.
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Terminal replay ----------
  // Output mirrors the real CLI (src/log.js, src/commands/doctor.js, src/fastlane.js).
  const ok = (msg) => `  <span class="t-ok">✓</span> ${msg}`;
  const step = (msg) => `<span class="t-step">▸ ${msg}</span>`;
  const ask = (msg) => `<span class="t-q">?</span> ${msg} <span class="t-dim">(y/N)</span> `;

  const SCRIPT = [
    { cmd: 'appship doctor' },
    { out: step('Environment'), wait: 260 },
    { out: ok('Node 22.12.0') },
    { out: ok('fastlane 2.232.2') },
    { out: step('Security'), wait: 260 },
    { out: ok('No key files tracked by git') },
    { out: ok('.gitignore protects release/keys/') },
    { out: step('iOS · store listing'), wait: 260 },
    { out: ok('Metadata OK for en-US, vi') },
    { out: step('Android · questionnaire'), wait: 260 },
    { out: ok('All answers present') },
    { out: '' },
    { out: ok('Ready — 0 warning(s)'), wait: 400 },
    { cmd: 'appship upload --build', pause: 900 },
    { out: '  ios: build/ios/ipa/WordBank.ipa', wait: 700 },
    { out: step('fastlane ios upload'), wait: 1100 },
    { out: '  android: build/app/outputs/bundle/release/app-release.aab', wait: 700 },
    { out: step('fastlane android upload'), wait: 1100 },
    { cmd: 'appship submit --ios', pause: 900 },
    { out: ask('Submit Word Bank 1.4.0 build (latest) for App Review?'), answer: 'y', wait: 500 },
    { out: step('fastlane ios submit'), wait: 900 },
  ];

  const term = document.getElementById('term');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function typeInto(el, text, speed = 55) {
    for (const ch of text) {
      el.insertAdjacentText('beforeend', ch);
      await sleep(speed + Math.random() * 40);
    }
  }

  function newLine(html = '') {
    const line = document.createElement('div');
    line.innerHTML = html || '&nbsp;';
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
    return line;
  }

  const cursor = document.createElement('span');
  cursor.className = 'cursor';

  async function play() {
    term.style.whiteSpace = 'pre-wrap';
    for (;;) {
      term.textContent = '';
      for (const item of SCRIPT) {
        if (item.cmd) {
          await sleep(item.pause ?? 500);
          const line = newLine('<span class="t-cmd"><span class="t-ps">$</span> <span class="typed"></span></span>');
          const typed = line.querySelector('.typed');
          line.firstChild.appendChild(cursor);
          await sleep(350);
          await typeInto(typed, item.cmd);
          await sleep(300);
          cursor.remove();
        } else {
          await sleep(item.wait ?? 90);
          const line = newLine(item.out);
          if (item.answer) {
            line.appendChild(cursor);
            await sleep(800);
            cursor.before(item.answer);
            cursor.remove();
          }
        }
      }
      const idle = newLine('<span class="t-ps">$</span> ');
      idle.appendChild(cursor);
      await sleep(5000);
    }
  }

  if (term && !reduceMotion) play();

  // ---------- Copy buttons ----------
  document.querySelectorAll('.copy').forEach((btn) => {
    // Buttons without data-copy sit in a code card header and copy that card's block.
    const block = btn.closest('.code-card')?.querySelector('pre code');
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy ?? block.innerText;
      const done = () => {
        btn.textContent = 'Copied';
        btn.classList.add('done');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('done');
        }, 1600);
      };
      const selectFallback = () => {
        const code = block ?? btn.parentElement.querySelector('code');
        const range = document.createRange();
        range.selectNodeContents(code);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = 'Press ⌘C';
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, selectFallback);
      else selectFallback();
    });
  });

  // ---------- Nav shadow ----------
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Docs: highlight the current section in the table of contents ----------
  const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          tocLinks.forEach((a) => a.classList.remove('active'));
          byId.get(e.target.id)?.classList.add('active');
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    byId.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  // ---------- Scroll reveal ----------
  // Elements are visible by default; only those below the fold animate as they enter.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    document.querySelectorAll('.reveal').forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight) io.observe(el);
    });
  }
})();
