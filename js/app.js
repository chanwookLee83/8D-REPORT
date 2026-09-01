/* ===== 앱 부트스트랩 & 폼 바인딩 ===== */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let saveTimer = null;
  const saveStatus = $('#saveStatus');

  function markDirty() {
    saveStatus.textContent = '저장 중…';
    saveStatus.classList.add('dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveStatus.textContent = '저장됨';
      saveStatus.classList.remove('dirty');
    }, 350);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.hidden = true), 2200);
  }

  function afterChange() {
    markDirty();
    Report.updateProgress();
    refreshPicker();
    if ($('.panel[data-panel="preview"]').classList.contains('is-active')) Report.render();
  }

  /* ---------- 탭 ---------- */
  function initTabs() {
    $$('#tabs .tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('#tabs .tab').forEach((b) => b.classList.toggle('is-active', b === btn));
        $$('.panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === btn.dataset.tab));
        if (btn.dataset.tab === 'preview') Report.render();
        if (btn.dataset.tab === 'fishbone') Fishbone.renderDiagram();
        if (btn.dataset.tab === 'photo') Annotate.render();
        if (btn.dataset.tab === 'd8') $$('.panel[data-panel="d8"] textarea').forEach(autoGrow);
        window.scrollTo(0, 0);
      });
    });
  }

  /* ---------- 일반 필드 바인딩 ---------- */
  function autoGrow(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    if (!el.offsetParent && el.offsetHeight === 0) return; // 화면에 없으면 측정 불가 — 표시될 때 다시 조정
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }

  function bindFields() {
    $$('[data-field]').forEach((el) => {
      const key = el.dataset.field;
      const ev = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        Store.current().fields[key] = el.value;
        autoGrow(el);
        Store.touch();
        afterChange();
      });
    });
    $$('details.d8').forEach((d) => {
      d.addEventListener('toggle', () => {
        if (d.open) $$('textarea', d).forEach(autoGrow);
      });
    });
  }

  function fillFields() {
    const fields = Store.current().fields || {};
    $$('[data-field]').forEach((el) => {
      el.value = fields[el.dataset.field] || '';
      autoGrow(el);
    });
  }

  /* ---------- 5-Why ---------- */
  const WHY_LABELS = ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5', '근본원인'];
  function renderWhy() {
    $$('.why-chain').forEach((box) => {
      const which = box.dataset.why;
      const arr = Store.current().why[which];
      box.innerHTML = '';
      WHY_LABELS.forEach((lbl, i) => {
        const row = document.createElement('div');
        row.className = 'why-row' + (i === 5 ? ' root' : '');
        row.innerHTML = '<span class="lbl">' + lbl + '</span><input>';
        const inp = row.querySelector('input');
        inp.value = arr[i] || '';
        inp.placeholder = i === 5 ? '검증된 근본 원인' : '왜? …';
        inp.addEventListener('input', () => {
          arr[i] = inp.value;
          Store.touch();
          afterChange();
        });
        box.appendChild(row);
      });
    });
  }

  /* ---------- 동적 테이블 (D1 팀원 / D6 조치) ---------- */
  const TABLE_DEFS = {
    d1: { key: 'd1', cols: [['name', 'text'], ['dept', 'text'], ['role', 'text']], blank: () => ({ name: '', dept: '', role: '' }) },
    d6: { key: 'd6', cols: [['action', 'text'], ['owner', 'text'], ['due', 'date'], ['done', 'date'], ['result', 'text']], blank: () => ({ action: '', owner: '', due: '', done: '', result: '' }) },
  };
  function renderTable(name) {
    const def = TABLE_DEFS[name];
    const tbody = $('#' + name + 'Table tbody');
    if (!tbody) return;
    const list = Store.current()[def.key];
    tbody.innerHTML = '';
    list.forEach((item, idx) => {
      const tr = document.createElement('tr');
      def.cols.forEach(([c, type]) => {
        const td = document.createElement('td');
        const inp = document.createElement('input');
        inp.type = type;
        inp.value = item[c] || '';
        inp.addEventListener('input', () => {
          item[c] = inp.value;
          Store.touch();
          afterChange();
        });
        td.appendChild(inp);
        tr.appendChild(td);
      });
      const td = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        list.splice(idx, 1);
        Store.touch();
        renderTable(name);
        afterChange();
      });
      td.appendChild(del);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
  }
  function initTableButtons() {
    $$('[data-add-row]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.addRow;
        Store.current()[TABLE_DEFS[name].key].push(TABLE_DEFS[name].blank());
        Store.touch();
        renderTable(name);
        afterChange();
      });
    });
  }

  /* ---------- D7 문서 체크리스트 ---------- */
  function renderD7Docs() {
    const wrap = $('#d7Docs');
    if (!wrap) return;
    const docs = Store.current().d7docs;
    wrap.innerHTML = '';
    Store.D7_DOCS.forEach(([k, label]) => {
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox"> ' + label;
      const cb = l.querySelector('input');
      cb.checked = !!docs[k];
      cb.addEventListener('change', () => {
        docs[k] = cb.checked;
        Store.touch();
        afterChange();
      });
      wrap.appendChild(l);
    });
  }

  /* ---------- 대책서 선택기 ---------- */
  function refreshPicker() {
    const sel = $('#reportPicker');
    const cur = Store.current();
    sel.innerHTML = '';
    Store.all().forEach((r) => {
      const o = document.createElement('option');
      o.value = r.id;
      const d = new Date(r.updatedAt);
      o.textContent = Store.title(r) + '  ·  ' + (d.getMonth() + 1) + '/' + d.getDate();
      if (r.id === cur.id) o.selected = true;
      sel.appendChild(o);
    });
  }

  function loadReport() {
    fillFields();
    renderWhy();
    renderTable('d1');
    renderTable('d6');
    renderD7Docs();
    Annotate.load();
    Fishbone.load();
    Report.updateProgress();
    Report.render();
    refreshPicker();
    saveStatus.textContent = '저장됨';
    saveStatus.classList.remove('dirty');
  }

  /* ---------- 메뉴 / 신규 / 백업 ---------- */
  function initMenu() {
    $('#reportPicker').addEventListener('change', (e) => {
      Store.setCurrent(e.target.value);
      loadReport();
    });
    $('#newReportBtn').addEventListener('click', () => {
      Store.create();
      loadReport();
      toast('새 대책서를 만들었습니다');
      $$('#tabs .tab')[0].click();
    });
    $('#autoDraftBtn').addEventListener('click', () => {
      Report.applyAutoDraft();
      loadReport();
      toast('8D 초안이 자동 작성되었습니다');
    });

    // AI 키 설정 박스
    const aiKeyInput = $('#aiKeyInput');
    const aiKeyStatus = $('#aiKeyStatus');
    const aiSettings = $('#aiSettings');
    function refreshAiKeyUI() {
      if (aiKeyInput) aiKeyInput.value = AI.getKey();
      if (aiKeyStatus) aiKeyStatus.textContent = AI.hasKey() ? '저장됨 ✓' : '미설정';
      const mn = $('#aiModelName');
      if (mn) mn.textContent = AI.getModel();
    }
    refreshAiKeyUI();
    if (aiKeyInput) {
      $('#aiKeySave').addEventListener('click', () => {
        AI.setKey(aiKeyInput.value);
        refreshAiKeyUI();
        toast(AI.hasKey() ? 'API 키를 저장했습니다' : 'API 키를 삭제했습니다');
      });
      $('#aiKeyClear').addEventListener('click', () => {
        AI.setKey('');
        refreshAiKeyUI();
        toast('API 키를 삭제했습니다');
      });
    }

    const aiBtn = $('#aiPhotoBtn');
    aiBtn.addEventListener('click', async () => {
      if (!AI.isOnline()) {
        toast('오프라인 상태입니다. «✍ 8D 자동 작성»을 사용하세요.');
        return;
      }
      if (!AI.hasKey()) {
        if (aiSettings) aiSettings.open = true;
        if (aiKeyInput) aiKeyInput.focus();
        toast('먼저 «🔑 AI 사진 분석 설정»에서 API 키를 입력·저장하세요');
        return;
      }
      const photo = Annotate.composite();
      if (!photo) {
        toast('«불량 사진» 탭에서 사진을 먼저 업로드하세요');
        return;
      }
      if (!confirm('AI가 불량 사진을 근거로 8D 대책서 전체(D0~D8)와 5-Why·특성요인도를 새로 작성합니다.\n해당 항목의 기존 내용은 덮어써집니다. 계속할까요?')) return;
      const markers = (Store.current().photo.shapes || [])
        .filter((s) => s.type !== 'pen' && s.n)
        .map((s) => ({ n: s.n, note: (s.note || '').trim() }));
      const label = aiBtn.textContent;
      aiBtn.disabled = true;
      aiBtn.textContent = '📷 분석 중… (약 1분)';
      try {
        const { result } = await AI.analyze(photo, Store.current().fields || {}, markers);
        const n = Report.applyPhotoAnalysis(result);
        loadReport();
        toast(n ? 'AI 8D 작성 완료 — ' + n + '개 항목. 날짜·수량 등은 직접 확인해 채우세요.' : '분석 완료 — 반영할 결과가 없습니다.');
      } catch (e) {
        toast('분석 실패: ' + (e && e.message ? e.message : e));
      } finally {
        aiBtn.disabled = false;
        aiBtn.textContent = label;
      }
    });

    const menuBtn = $('#menuBtn');
    const menuList = $('#menuList');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuList.hidden = !menuList.hidden;
    });
    document.addEventListener('click', () => (menuList.hidden = true));
    menuList.addEventListener('click', (e) => e.stopPropagation());

    menuList.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (!act) return;
      menuList.hidden = true;
      if (act === 'duplicate') {
        Store.duplicate();
        loadReport();
        toast('대책서를 복제했습니다');
      } else if (act === 'delete') {
        if (confirm('현재 대책서를 삭제할까요? 되돌릴 수 없습니다.')) {
          Store.remove(Store.current().id);
          loadReport();
          toast('삭제되었습니다');
        }
      } else if (act === 'export') {
        const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'quality-reports_' + Store.todayISO() + '.json';
        a.click();
      } else if (act === 'import') {
        $('#importFile').click();
      } else if (act === 'aikey') {
        $$('#tabs .tab').forEach((b) => {
          if (b.dataset.tab === 'preview') b.click();
        });
        const box = $('#aiSettings');
        if (box) {
          box.open = true;
          box.scrollIntoView({ block: 'center' });
          const inp = $('#aiKeyInput');
          if (inp) inp.focus();
        }
      }
    });

    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const n = Store.importJSON(fr.result);
          loadReport();
          toast(n + '건을 불러왔습니다');
        } catch (err) {
          toast('불러오기 실패: ' + err.message);
        }
      };
      fr.readAsText(file);
      e.target.value = '';
    });
  }

  window.addEventListener('qcr:quota', () => toast('저장 공간이 부족합니다. 오래된 대책서를 삭제하거나 백업 후 정리하세요.'));

  /* ---------- PWA ---------- */
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  /* ---------- 시작 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    Store.current();
    initTabs();
    bindFields();
    initTableButtons();
    initMenu();
    Annotate.mount(afterChange);
    Fishbone.mount(afterChange);
    Report.mount();
    loadReport();
    initPWA();
  });
})();
