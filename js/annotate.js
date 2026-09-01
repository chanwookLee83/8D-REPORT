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

  /* ---- 참고 사진 ---- */
  function renderRefs() {
    const grid = document.getElementById('refPhotoGrid');
    if (!grid) return;
    const list = Store.current().refPhotos;
    grid.innerHTML = '';
    list.forEach((src, i) => {
      const fig = document.createElement('figure');
      fig.innerHTML = '<img src="' + src + '" alt="참고 사진 ' + (i + 1) + '"><button>×</button>';
      fig.querySelector('button').addEventListener('click', () => {
        list.splice(i, 1);
        Store.touch();
        renderRefs();
        onChange();
      });
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
          Store.current().refPhotos.push(url);
          if (--left === 0) {
            Store.touch();
            renderRefs();
            onChange();
          }
        })
      );
      e.target.value = '';
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
    });
  }

  global.Annotate = { mount, load, composite, render, renderMarkers, importRegions };
})(window);
