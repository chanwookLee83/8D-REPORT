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

  /* 글자 폭 추정 (CJK ≈ 폰트크기, 라틴 ≈ 0.56×) — 캔버스 여백 계산용 */
  function isWide(cp) {
    return (cp >= 0x1100 && cp <= 0x11FF) || (cp >= 0x3000 && cp <= 0x9FFF)
      || (cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFF00 && cp <= 0xFFEF);
  }
  function textW(str, fs) {
    let w = 0;
    for (const ch of String(str || '')) {
      w += (isWide(ch.codePointAt(0)) ? 1.03 : 0.56) * fs;
    }
    return w;
  }

  function buildSVG() {
    const data = fb();
    const cats = Store.FB_CATS.map(([k, label]) => ({ k, label, causes: (data.cats[k] || []).filter((c) => c.text || (c.subs || []).some(Boolean)) }));
    const top = cats.slice(0, 3);
    const bottom = cats.slice(3, 6);

    const colW = 320;
    const leftPad = 40;
    const rowGap = 24;
    const FS_CAUSE = 13, FS_SUB = 11, FS_CAT = 13, FS_PROB = 13;

    // 내용을 그리면서 실제 경계 상자를 추적 → 잘림 없이 캔버스 크기·여백 계산
    const bb = { x0: 0, y0: 0, x1: 0, y1: 0 };
    function ext(x, y) {
      if (x < bb.x0) bb.x0 = x;
      if (y < bb.y0) bb.y0 = y;
      if (x > bb.x1) bb.x1 = x;
      if (y > bb.y1) bb.y1 = y;
    }

    function blockH(cat) {
      let h = 76;
      cat.causes.forEach((c) => { h += rowGap + (c.subs || []).filter(Boolean).length * (FS_SUB + 5); });
      return Math.max(140, h);
    }
    const topH = Math.max(...top.map(blockH), 150);
    const botH = Math.max(...bottom.map(blockH), 150);
    const spineY = topH + 44;
    const headX = leftPad + colW * 3 + 30;

    const A = '#4f46e5', INK = '#1e2230', SOFT = '#4d5464', HALO = '#ffffff';
    let s = '';

    function line(x1, y1, x2, y2, stroke, w) {
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}"/>`;
      ext(x1, y1); ext(x2, y2);
    }
    // 선과 겹쳐도 읽히도록 글자에 흰색 외곽선(paint-order)
    function label(x, y, str, fs, fill, anchor, weight) {
      anchor = anchor || 'start';
      s += `<text x="${x}" y="${y}" font-size="${fs}" fill="${fill}" text-anchor="${anchor}"`
        + (weight ? ` font-weight="${weight}"` : '')
        + ` paint-order="stroke" stroke="${HALO}" stroke-width="3.5" stroke-linejoin="round">${esc(str)}</text>`;
      const w = textW(str, fs);
      const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
      ext(left - 2, y - fs); ext(left + w + 2, y + fs * 0.35);
    }

    // 스파인 + 화살표 머리
    line(leftPad, spineY, headX, spineY, INK, 3);
    s += `<polygon points="${headX},${spineY - 10} ${headX + 18},${spineY} ${headX},${spineY + 10}" fill="${INK}"/>`;
    ext(headX + 18, spineY);

    // 머리(문제) 박스
    const plines = wrap(data.problem || '문제(특성)를 입력하세요', 12);
    const pboxW = Math.max(200, ...plines.map((l) => textW(l, FS_PROB) + 30));
    const pboxH = plines.length * (FS_PROB + 6) + 18;
    s += `<rect x="${headX + 20}" y="${spineY - pboxH / 2}" width="${pboxW}" height="${pboxH}" rx="10" fill="${A}"/>`;
    ext(headX + 20, spineY - pboxH / 2); ext(headX + 20 + pboxW, spineY + pboxH / 2);
    plines.forEach((ln, i) => {
      s += `<text x="${headX + 20 + pboxW / 2}" y="${spineY - pboxH / 2 + 20 + i * (FS_PROB + 6)}" fill="#fff" font-size="${FS_PROB}" font-weight="700" text-anchor="middle">${esc(ln)}</text>`;
    });

    function drawCat(cat, idx, isTop) {
      const anchorX = leftPad + colW * idx + colW * 0.66;
      const bh = isTop ? topH : botH;
      const tipX = anchorX - colW * 0.34;
      const tipY = isTop ? spineY - bh : spineY + bh;
      line(anchorX, spineY, tipX, tipY, SOFT, 2.5);

      // 카테고리 라벨 알약
      const clw = textW(cat.label, FS_CAT) + 26;
      const cly = tipY + (isTop ? -12 : 26);
      s += `<rect x="${tipX - clw / 2}" y="${cly - FS_CAT - 3}" width="${clw}" height="${FS_CAT + 12}" rx="8" fill="${A}" opacity="0.14"/>`;
      ext(tipX - clw / 2, cly - FS_CAT - 3); ext(tipX + clw / 2, cly + 9);
      s += `<text x="${tipX}" y="${cly}" fill="${A}" font-size="${FS_CAT}" font-weight="700" text-anchor="middle">${esc(cat.label)}</text>`;

      const n = cat.causes.length;
      cat.causes.forEach((c, j) => {
        const f = (j + 1) / (n + 1);
        const px = anchorX + (tipX - anchorX) * f;
        const py = spineY + (tipY - spineY) * f;
        const lineLen = 140;
        line(px, py, px - lineLen, py, SOFT, 1.6);
        label(px - 10, py - 6, c.text || '(원인)', FS_CAUSE, INK, 'end');
        (c.subs || []).filter(Boolean).forEach((sub, si) => {
          const sy = py + (FS_SUB + 6) + si * (FS_SUB + 5);
          line(px - lineLen + 12, py, px - lineLen + 26, sy, '#b8bcc8', 1.2);
          label(px - lineLen + 30, sy + 3, sub, FS_SUB, SOFT, 'start');
        });
      });
    }
    top.forEach((c, i) => drawCat(c, i, true));
    bottom.forEach((c, i) => drawCat(c, i, false));

    const M = 18;
    const W = Math.ceil(bb.x1 - bb.x0 + M * 2);
    const H = Math.ceil(bb.y1 - bb.y0 + M * 2);
    const tx = (M - bb.x0).toFixed(1), ty = (M - bb.y0).toFixed(1);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" `
      + `font-family="'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',-apple-system,'Segoe UI',sans-serif">`
      + `<rect width="${W}" height="${H}" fill="#fff"/><g transform="translate(${tx},${ty})">${s}</g></svg>`;
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
      const iw = im.naturalWidth || im.width || 1200;
      const ih = im.naturalHeight || im.height || 700;
      // 작은 도표는 더 크게, 큰 도표도 최소 2.5배 — 목표 가로 ~3000px, 상한 4배
      const scale = Math.max(2.5, Math.min(4, 3000 / iw));
      const c = document.createElement('canvas');
      c.width = Math.round(iw * scale);
      c.height = Math.round(ih * scale);
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.drawImage(im, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => {
        const dl = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = dl;
        a.download = 'fishbone_' + Store.todayISO() + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(dl), 1500);
      }, 'image/png');
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      alert('다이어그램 이미지를 생성하지 못했습니다. 다시 시도해 주세요.');
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
