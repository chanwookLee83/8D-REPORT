/* ===== 특성요인도 (Fishbone) 편집기 + SVG 다이어그램 ===== */
(function (global) {
  let editorEl, diagramEl, problemInput;
  let onChange = function () {};

  function fb() {
    return Store.current().fishbone;
  }
  function esc(t) {
    return (t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ---------- 편집기 ---------- */
  function renderEditor() {
    if (!editorEl) return;
    const data = fb();
    editorEl.innerHTML = '';
    Store.FB_CATS.forEach(([key, label]) => {
      const list = data.cats[key] || (data.cats[key] = []);
      const box = document.createElement('div');
      box.className = 'fb-cat';
      box.innerHTML = '<h4>' + label + '</h4>';

      list.forEach((cause, ci) => {
        const c = document.createElement('div');
        c.className = 'fb-cause';
        c.innerHTML =
          '<div class="main">' +
          '<input placeholder="주요 원인" />' +
          '<button class="fb-mini sub">＋가시</button>' +
          '<button class="fb-mini del">×</button>' +
          '</div><div class="subs"></div>';
        const inp = c.querySelector('.main input');
        inp.value = cause.text || '';
        inp.addEventListener('input', () => {
          cause.text = inp.value;
          save();
        });
        c.querySelector('.del').addEventListener('click', () => {
          list.splice(ci, 1);
          save(true);
        });
        const subsEl = c.querySelector('.subs');
        (cause.subs || (cause.subs = [])).forEach((s, si) => {
          const row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = '<input placeholder="하위 원인" /><button class="fb-mini">×</button>';
          const si2 = row.querySelector('input');
          si2.value = s;
          si2.addEventListener('input', () => {
            cause.subs[si] = si2.value;
            save();
          });
          row.querySelector('button').addEventListener('click', () => {
            cause.subs.splice(si, 1);
            save(true);
          });
          subsEl.appendChild(row);
        });
        c.querySelector('.sub').addEventListener('click', () => {
          cause.subs.push('');
          save(true);
        });
        box.appendChild(c);
      });

      const add = document.createElement('button');
      add.className = 'fb-add';
      add.textContent = '＋ ' + label.split(' ')[0] + ' 원인 추가';
      add.addEventListener('click', () => {
        list.push({ text: '', subs: [] });
        save(true);
      });
      box.appendChild(add);
      editorEl.appendChild(box);
    });
  }

  function save(rerenderEditor) {
    Store.touch();
    if (rerenderEditor) renderEditor();
    renderDiagram();
    onChange();
  }

  /* ---------- SVG 다이어그램 ---------- */
  function wrap(text, n) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((w) => {
      if ((line + ' ' + w).trim().length > n) {
        if (line) lines.push(line);
        line = w;
      } else line = (line + ' ' + w).trim();
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function buildSVG() {
    const data = fb();
    const cats = Store.FB_CATS.map(([k, label]) => ({ k, label, causes: (data.cats[k] || []).filter((c) => c.text || (c.subs || []).some(Boolean)) }));
    const top = cats.slice(0, 3);
    const bottom = cats.slice(3, 6);

    const colW = 300;
    const leftPad = 60;
    const rowH = 22;

    function blockH(cat) {
      let h = 60;
      cat.causes.forEach((c) => {
        h += rowH + (c.subs || []).filter(Boolean).length * 16;
      });
      return Math.max(120, h);
    }
    const topH = Math.max(...top.map(blockH), 140);
    const botH = Math.max(...bottom.map(blockH), 140);
    const spineY = topH + 30;
    const W = leftPad + colW * 3 + 260;
    const H = spineY + botH + 30;
    const headX = leftPad + colW * 3 + 20;

    const A = '#4f46e5';
    const INK = '#1e2230';
    const SOFT = '#5b6172';
    let s = '';

    // 스파인
    s += `<line x1="${leftPad}" y1="${spineY}" x2="${headX}" y2="${spineY}" stroke="${INK}" stroke-width="3"/>`;
    s += `<polygon points="${headX},${spineY - 9} ${headX + 16},${spineY} ${headX},${spineY + 9}" fill="${INK}"/>`;
    // 머리(문제) 박스
    const plines = wrap(data.problem || '문제(특성)를 입력하세요', 12);
    const boxH = plines.length * 16 + 16;
    s += `<rect x="${headX + 18}" y="${spineY - boxH / 2}" width="220" height="${boxH}" rx="10" fill="${A}"/>`;
    plines.forEach((ln, i) => {
      s += `<text x="${headX + 128}" y="${spineY - boxH / 2 + 20 + i * 16}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${esc(ln)}</text>`;
    });

    function drawCat(cat, idx, isTop) {
      const anchorX = leftPad + colW * idx + colW * 0.62;
      const bh = isTop ? topH : botH;
      const tipX = anchorX - colW * 0.32;
      const tipY = isTop ? spineY - bh : spineY + bh;
      let g = `<line x1="${anchorX}" y1="${spineY}" x2="${tipX}" y2="${tipY}" stroke="${SOFT}" stroke-width="2.5"/>`;
      // 카테고리 라벨
      g += `<rect x="${tipX - 66}" y="${tipY + (isTop ? -30 : 6)}" width="132" height="24" rx="8" fill="${A}" opacity="0.12"/>`;
      g += `<text x="${tipX}" y="${tipY + (isTop ? -13 : 22)}" fill="${A}" font-size="12.5" font-weight="700" text-anchor="middle">${esc(cat.label)}</text>`;

      const n = cat.causes.length;
      cat.causes.forEach((c, j) => {
        const f = (j + 1) / (n + 1);
        const px = anchorX + (tipX - anchorX) * f;
        const py = spineY + (tipY - spineY) * f;
        const lineLen = 150;
        g += `<line x1="${px}" y1="${py}" x2="${px - lineLen}" y2="${py}" stroke="${SOFT}" stroke-width="1.6"/>`;
        g += `<text x="${px - 8}" y="${py - 5}" fill="${INK}" font-size="12" text-anchor="end">${esc(c.text || '(원인)')}</text>`;
        (c.subs || []).filter(Boolean).forEach((sub, si) => {
          const sy = py + 14 + si * 15;
          g += `<line x1="${px - lineLen + 10}" y1="${py}" x2="${px - lineLen + 24}" y2="${sy}" stroke="#b8bcc8" stroke-width="1.2"/>`;
          g += `<text x="${px - lineLen + 28}" y="${sy + 3}" fill="${SOFT}" font-size="10.5">${esc(sub)}</text>`;
        });
      });
      return g;
    }

    top.forEach((c, i) => (s += drawCat(c, i, true)));
    bottom.forEach((c, i) => (s += drawCat(c, i, false)));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="-apple-system, Segoe UI, Malgun Gothic, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${s}</svg>`;
  }

  function renderDiagram() {
    if (!diagramEl) return;
    diagramEl.innerHTML = buildSVG();
  }

  function svgString() {
    return buildSVG();
  }

  function downloadPNG() {
    const svg = buildSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = function () {
      const scale = 2;
      const c = document.createElement('canvas');
      c.width = im.width * scale;
      c.height = im.height * scale;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.scale(scale, scale);
      g.drawImage(im, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'fishbone_' + Store.todayISO() + '.png';
        a.click();
      });
    };
    im.src = url;
  }

  function mount(changeCb) {
    onChange = changeCb || function () {};
    editorEl = document.getElementById('fbEditor');
    diagramEl = document.getElementById('fbDiagram');
    problemInput = document.getElementById('fbProblem');
    if (problemInput) {
      problemInput.addEventListener('input', () => {
        fb().problem = problemInput.value;
        Store.touch();
        renderDiagram();
        onChange();
      });
    }
    const dl = document.getElementById('fbDownload');
    if (dl) dl.addEventListener('click', downloadPNG);
  }

  function load() {
    if (problemInput) problemInput.value = fb().problem || '';
    renderEditor();
    renderDiagram();
  }

  global.Fishbone = { mount, load, renderDiagram, renderEditor, svgString };
})(window);
