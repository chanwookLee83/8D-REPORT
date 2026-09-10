/* ===== 불량 사진 업로드 & 영역 표시 ===== */
(function (global) {
  let canvas, ctx, holder, emptyBox, toolbar, colorInput, markerListEl, d2EchoEl;
  let img = null;
  let tool = 'box';
  let drawing = false;
  let start = null;
  let cur = null;
  let onChange = function () {};

  const MAXDIM = 1600;

  function photo() {
    return Store.current().photo;
  }

  function fileToImage(file, cb) {
    const fr = new FileReader();
    fr.onload = function () {
      const im = new Image();
      im.onload = function () {
        let w = im.naturalWidth,
          h = im.naturalHeight;
        const scale = Math.min(1, MAXDIM / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        cb(c.toDataURL('image/jpeg', 0.82));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* 파일을 그대로 dataURL 로 (PDF 도면 등, 리사이즈 없이) */
  function fileToDataURL(file, cb) {
    const fr = new FileReader();
    fr.onload = function () { cb(fr.result); };
    fr.readAsDataURL(file);
  }

  /* 도면: 이미지면 리사이즈, PDF면 원본 dataURL */
  function loadDrawingFile(file, cb) {
    if (file.type === 'application/pdf') fileToDataURL(file, cb);
    else fileToImage(file, cb);
  }

  function loadBase(cb) {
    const p = photo();
    if (!p.base) {
      img = null;
      if (cb) cb();
      return;
    }
    const im = new Image();
    im.onload = function () {
      img = im;
      if (cb) cb();
    };
    im.src = p.base;
  }

  function numberedShapes() {
    return photo().shapes.filter((s) => s.type !== 'pen');
  }

  function renumber() {
    let n = 0;
    photo().shapes.forEach((s) => {
      if (s.type !== 'pen') s.n = ++n;
    });
  }

  /* ---- 그리기 ---- */
  function drawShape(g, s, sx, sy) {
    g.strokeStyle = s.color;
    g.fillStyle = s.color;
    g.lineWidth = Math.max(2, (img ? img.naturalWidth : 800) * 0.004);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const P = s.points.map((p) => ({ x: p.x * sx, y: p.y * sy }));

    if (s.type === 'pen') {
      g.beginPath();
      P.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      return;
    }
    const a = P[0],
      b = P[1] || P[0];
    if (s.type === 'box') {
      g.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (s.type === 'ellipse') {
      g.beginPath();
      g.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      g.stroke();
    } else if (s.type === 'arrow') {
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const hl = g.lineWidth * 5;
      g.beginPath();
      g.moveTo(b.x, b.y);
      g.lineTo(b.x - hl * Math.cos(ang - 0.4), b.y - hl * Math.sin(ang - 0.4));
      g.lineTo(b.x - hl * Math.cos(ang + 0.4), b.y - hl * Math.sin(ang + 0.4));
      g.closePath();
      g.fill();
    }
    if (s.n) {
      const bx = s.type === 'arrow' ? a.x : Math.min(a.x, b.x);
      const by = s.type === 'arrow' ? a.y : Math.min(a.y, b.y);
      badge(g, bx, by, s.n);
    }
  }

  function badge(g, x, y, n) {
    const r = Math.max(13, (img ? img.naturalWidth : 800) * 0.02);
    g.beginPath();
    g.fillStyle = '#e11d48';
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '700 ' + Math.round(r * 1.2) + 'px -apple-system, Segoe UI, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), x, y + 1);
  }

  function render() {
    if (!canvas) return;
    if (!img) {
      canvas.hidden = true;
      emptyBox.hidden = false;
      return;
    }
    emptyBox.hidden = true;
    canvas.hidden = false;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    photo().shapes.forEach((s) => drawShape(ctx, s, 1, 1));
    if (cur) drawShape(ctx, cur, 1, 1);
  }

  /* ---- 합성 이미지 (미리보기용) ---- */
  function composite() {
    const p = photo();
    if (!p.base) return '';
    if (!img) return p.base;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    p.shapes.forEach((s) => drawShape(g, s, 1, 1));
    return c.toDataURL('image/jpeg', 0.85);
  }

  /* ---- 표시 영역 확대 크롭 (AI 분석용) ----
   * 각 마커(박스/화살표/원)의 경계 상자를 여유를 두고 잘라 별도 이미지로 만든다.
   * 전체 사진 1장만 볼 때보다 미세 결함(크랙·웰드라인·표면)을 훨씬 잘 판독한다. */
  function markerCrops(maxCount) {
    const p = photo();
    if (!img || !p.base) return [];
    const W = img.naturalWidth, H = img.naturalHeight;
    const shapes = numberedShapes().slice(0, maxCount || 6);
    return shapes.map((s) => {
      const xs = s.points.map((q) => q.x), ys = s.points.map((q) => q.y);
      let x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      const minSz = Math.min(W, H) * 0.14;
      if (x1 - x0 < minSz) { const c = (x0 + x1) / 2; x0 = c - minSz / 2; x1 = c + minSz / 2; }
      if (y1 - y0 < minSz) { const c = (y0 + y1) / 2; y0 = c - minSz / 2; y1 = c + minSz / 2; }
      const padX = (x1 - x0) * 0.55, padY = (y1 - y0) * 0.55;
      x0 = Math.max(0, Math.round(x0 - padX)); x1 = Math.min(W, Math.round(x1 + padX));
      y0 = Math.max(0, Math.round(y0 - padY)); y1 = Math.min(H, Math.round(y1 + padY));
      const cw = Math.max(1, x1 - x0), ch = Math.max(1, y1 - y0);
      const oc = document.createElement('canvas');
      oc.width = cw; oc.height = ch;
      const g = oc.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
      return { n: s.n, note: (s.note || '').trim(), dataUrl: oc.toDataURL('image/jpeg', 0.9) };
    });
  }

  /* ---- 포인터 ---- */
  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
      x: ((t.clientX - rect.left) / rect.width) * canvas.width,
      y: ((t.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function down(e) {
    if (!img) return;
    e.preventDefault();
    drawing = true;
    start = pos(e);
    cur = { type: tool, color: colorInput.value, points: [start] };
    if (tool === 'pen') cur.points = [start];
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    if (tool === 'pen') cur.points.push(p);
    else cur.points[1] = p;
    render();
  }

  function up() {
    if (!drawing) return;
    drawing = false;
    const s = cur;
    cur = null;
    if (!s) return;
    if (s.type === 'pen') {
      if (s.points.length > 1) photo().shapes.push(s);
    } else {
      const a = s.points[0],
        b = s.points[1] || a;
      if (Math.abs(b.x - a.x) > 6 || Math.abs(b.y - a.y) > 6) {
        s.note = '';
        photo().shapes.push(s);
      }
    }
    renumber();
    commit();
  }

  function commit() {
    Store.touch();
    render();
    renderMarkers();
    onChange();
  }

  /* ---- AI 분석 결과 → 마커 영역 자동 생성 ---- */
  function importRegions(regions) {
    if (!img || !Array.isArray(regions) || !regions.length) return 0;
    if (numberedShapes().length) return 0; // 사용자가 이미 표시한 영역이 있으면 건드리지 않음
    const W = img.naturalWidth,
      H = img.naturalHeight;
    let added = 0;
    regions.forEach((r) => {
      const b = r && r.box;
      if (!Array.isArray(b) || b.length < 4) return;
      let [x, y, w, h] = b.map(Number);
      if ([x, y, w, h].some((n) => !isFinite(n))) return;
      x = Math.max(0, Math.min(0.99, x));
      y = Math.max(0, Math.min(0.99, y));
      w = Math.max(0.02, Math.min(1 - x, w));
      h = Math.max(0.02, Math.min(1 - y, h));
      photo().shapes.push({
        type: 'box',
        color: '#e11d48',
        points: [{ x: x * W, y: y * H }, { x: (x + w) * W, y: (y + h) * H }],
        note: (r.note == null ? '' : String(r.note)),
      });
      added++;
    });
    if (added) {
      renumber();
      commit();
    }
    return added;
  }

  /* ---- 마커 목록 ---- */
  function renderMarkers() {
    if (!markerListEl) return;
    const ns = numberedShapes();
    if (!ns.length) {
      markerListEl.innerHTML = '<p class="empty-note">아직 표시된 영역이 없습니다.</p>';
    } else {
      markerListEl.innerHTML = '';
      ns.forEach((s) => {
        const row = document.createElement('div');
        row.className = 'marker-row';
        row.innerHTML =
          '<div class="marker-badge">' + s.n + '</div>' +
          '<textarea placeholder="' + s.n + '번 영역의 불량 내용 (현상/부위/치수 등)"></textarea>' +
          '<button class="del">삭제</button>';
        const ta = row.querySelector('textarea');
        ta.value = s.note || '';
        ta.addEventListener('input', () => {
          s.note = ta.value;
          Store.touch();
          renderEcho();
          onChange();
        });
        row.querySelector('.del').addEventListener('click', () => {
          const p = photo();
          p.shapes = p.shapes.filter((x) => x !== s);
          renumber();
          commit();
        });
        markerListEl.appendChild(row);
      });
    }
    renderEcho();
  }

  function renderEcho() {
    if (!d2EchoEl) return;
    const ns = numberedShapes();
    if (!ns.length) {
      d2EchoEl.innerHTML = '<p class="empty-note">불량 사진 탭에서 영역을 표시하면 여기에 표시됩니다.</p>';
      return;
    }
    d2EchoEl.innerHTML = ns
      .map((s) => '<div class="mk"><b>' + s.n + '</b><span>' + (esc(s.note) || '(내용 미작성)') + '</span></div>')
      .join('');
  }

  function esc(t) {
    return (t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ---- 양품(OK) 기준 사진 ---- */
  function renderOkPhoto() {
    const box = document.getElementById('okPhotoBox');
    const im = document.getElementById('okPhotoImg');
    if (!box || !im) return;
    const url = Store.current().okPhoto || '';
    if (url) { im.src = url; box.hidden = false; } else { im.removeAttribute('src'); box.hidden = true; }
  }

  /* ---- 도면 (이미지 또는 PDF) ---- */
  function isPdfUrl(u) { return /^data:application\/pdf/.test(u || ''); }
  function renderDrawing() {
    const box = document.getElementById('drawingBox');
    const im = document.getElementById('drawingImg');
    const pdf = document.getElementById('drawingPdf');
    if (!box) return;
    const url = Store.current().drawing || '';
    if (!url) { box.hidden = true; if (im) im.removeAttribute('src'); return; }
    box.hidden = false;
    if (isPdfUrl(url)) {
      if (im) im.hidden = true;
      if (pdf) { pdf.hidden = false; }
    } else {
      if (pdf) pdf.hidden = true;
      if (im) { im.hidden = false; im.src = url; }
    }
  }

  /* ---- 참고 사진 (유형·설명 라벨 포함) ---- */
  function refEntry(e) {
    return (typeof e === 'string') ? { url: e, kind: '', note: '' } : e;
  }
  function renderRefs() {
    const grid = document.getElementById('refPhotoGrid');
    if (!grid) return;
    const list = Store.current().refPhotos;
    grid.innerHTML = '';
    list.forEach((raw, i) => {
      const e = list[i] = refEntry(raw);
      const fig = document.createElement('figure');
      const opts = ['<option value="">유형 미지정</option>']
        .concat((Store.REF_KINDS || []).map((k) => '<option' + (e.kind === k ? ' selected' : '') + '>' + k + '</option>'))
        .join('');
      fig.innerHTML =
        '<img src="' + e.url + '" alt="참고 사진 ' + (i + 1) + '">' +
        '<button class="ref-del" title="삭제">×</button>' +
        '<select class="ref-kind">' + opts + '</select>' +
        '<input class="ref-note" placeholder="설명 (예: 단자 3번 결합부)" value="' + esc(e.note || '') + '">';
      fig.querySelector('.ref-del').addEventListener('click', () => {
        list.splice(i, 1);
        Store.touch();
        renderRefs();
        onChange();
      });
      fig.querySelector('.ref-kind').addEventListener('change', (ev) => { e.kind = ev.target.value; Store.touch(); onChange(); });
      fig.querySelector('.ref-note').addEventListener('input', (ev) => { e.note = ev.target.value; Store.touch(); onChange(); });
      grid.appendChild(fig);
    });
  }

  /* ---- 초기화 ---- */
  function mount(changeCb) {
    onChange = changeCb || function () {};
    canvas = document.getElementById('annCanvas');
    ctx = canvas.getContext('2d');
    holder = document.getElementById('canvasHolder');
    emptyBox = document.getElementById('canvasEmpty');
    toolbar = document.getElementById('annToolbar');
    colorInput = document.getElementById('annColor');
    markerListEl = document.getElementById('markerList');
    d2EchoEl = document.getElementById('d2MarkerEcho');

    document.getElementById('photoInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      fileToImage(f, (url) => {
        photo().base = url;
        photo().shapes = [];
        Store.touch();
        loadBase(() => {
          render();
          renderMarkers();
          onChange();
        });
      });
      e.target.value = '';
    });

    document.getElementById('refPhotoInput').addEventListener('change', (e) => {
      const files = [...e.target.files];
      let left = files.length;
      files.forEach((f) =>
        fileToImage(f, (url) => {
          Store.current().refPhotos.push({ url: url, kind: '', note: '' });
          if (--left === 0) {
            Store.touch();
            renderRefs();
            onChange();
          }
        })
      );
      e.target.value = '';
    });

    const okInput = document.getElementById('okPhotoInput');
    if (okInput) okInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      fileToImage(f, (url) => {
        Store.current().okPhoto = url;
        Store.touch();
        renderOkPhoto();
        onChange();
      });
      e.target.value = '';
    });
    const okClear = document.getElementById('okPhotoClear');
    if (okClear) okClear.addEventListener('click', () => {
      Store.current().okPhoto = '';
      Store.touch();
      renderOkPhoto();
      onChange();
    });

    const dwInput = document.getElementById('drawingInput');
    if (dwInput) dwInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.type === 'application/pdf' && f.size > 4.5 * 1024 * 1024) {
        alert('도면 PDF가 너무 큽니다 (' + (f.size / 1048576).toFixed(1) + 'MB). 4MB 이하 PDF 또는 이미지(캡처)로 올려 주세요.');
        e.target.value = '';
        return;
      }
      loadDrawingFile(f, (url) => {
        Store.current().drawing = url;
        Store.touch();
        renderDrawing();
        onChange();
      });
      e.target.value = '';
    });
    const dwClear = document.getElementById('drawingClear');
    if (dwClear) dwClear.addEventListener('click', () => {
      Store.current().drawing = '';
      Store.touch();
      renderDrawing();
      onChange();
    });

    toolbar.querySelectorAll('[data-tool]').forEach((b) =>
      b.addEventListener('click', () => {
        tool = b.dataset.tool;
        toolbar.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('is-active', x === b));
      })
    );

    document.getElementById('annUndo').addEventListener('click', () => {
      photo().shapes.pop();
      renumber();
      commit();
    });
    document.getElementById('annClear').addEventListener('click', () => {
      if (!photo().shapes.length) return;
      if (!confirm('표시된 내용을 모두 지울까요?')) return;
      photo().shapes = [];
      commit();
    });

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up);
  }

  function load() {
    loadBase(() => {
      render();
      renderMarkers();
      renderRefs();
      renderOkPhoto();
      renderDrawing();
    });
  }

  /* 사진·표시·참고사진 상태를 완전히 비운다 (신규 대책서 시작 시) */
  function reset() {
    const cur0 = Store.current();
    const p = photo();
    p.base = '';
    p.shapes = [];
    cur0.drawing = '';
    if (Array.isArray(cur0.refPhotos)) cur0.refPhotos.length = 0;
    cur0.okPhoto = '';
    img = null;
    cur = null;
    drawing = false;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    ['photoInput', 'refPhotoInput', 'okPhotoInput', 'drawingInput'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (Store.touch) Store.touch();
    render();
    renderMarkers();
    renderRefs();
    renderOkPhoto();
    renderDrawing();
  }

  global.Annotate = { mount, load, reset, composite, markerCrops, render, renderMarkers, renderOkPhoto, renderDrawing, importRegions };
})(window);
