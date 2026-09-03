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
        row.innerHTML = '<span class="lbl">' + lbl + '</span><textarea rows="1"></textarea>';
        const inp = row.querySelector('textarea');
        inp.value = arr[i] || '';
        inp.placeholder = i === 5 ? '검증된 근본 원인' : '왜? …';
        inp.addEventListener('input', () => {
          arr[i] = inp.value;
          autoGrow(inp);
          Store.touch();
          afterChange();
        });
        box.appendChild(row);
        autoGrow(inp);
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

  /* ---------- AI 분석 범위 선택 ---------- */
  const AI_SCOPE_LS = 'qcr.aiScope.v1';
  function initAiScope() {
    const wrap = $('#aiScopeList');
    if (!wrap || !AI.SECTION_ORDER) return;
    let saved = null;
    try { const raw = localStorage.getItem(AI_SCOPE_LS); if (raw) saved = new Set(JSON.parse(raw)); } catch (e) {}
    wrap.innerHTML = '';
    AI.SECTION_ORDER.forEach((key) => {
      const sec = AI.SECTIONS[key];
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox" data-scope="' + key + '"> ' + sec.label;
      const cb = l.querySelector('input');
      cb.checked = saved ? saved.has(key) : true;
      cb.addEventListener('change', saveAiScope);
      wrap.appendChild(l);
    });
    const all = $('#aiScopeAll'), none = $('#aiScopeNone');
    if (all) all.addEventListener('click', () => { setAllScope(true); });
    if (none) none.addEventListener('click', () => { setAllScope(false); });
  }
  function setAllScope(on) {
    $$('#aiScopeList input[data-scope]').forEach((cb) => { cb.checked = on; });
    saveAiScope();
  }
  function getAiScope() {
    return $$('#aiScopeList input[data-scope]:checked').map((cb) => cb.dataset.scope);
  }
  function saveAiScope() {
    try { localStorage.setItem(AI_SCOPE_LS, JSON.stringify(getAiScope())); } catch (e) {}
  }

  /* ---------- AI 공통 헬퍼 ---------- */
  function aiPreflight() {
    if (!AI.isOnline()) { toast('오프라인 상태입니다. «✍ 템플릿 작성»을 사용하세요.'); return false; }
    if (!AI.hasKey()) {
      const s = $('#aiSettings'); if (s) s.open = true;
      const k = $('#aiKeyInput'); if (k) k.focus();
      toast('먼저 «🔑 AI 사진 분석 설정»에서 API 키를 입력·저장하세요');
      return false;
    }
    if (!Annotate.composite()) { toast('«불량 사진» 탭에서 사진을 먼저 업로드하세요'); return false; }
    return true;
  }

  function aiCollectMarkers() {
    return (Store.current().photo.shapes || [])
      .filter((s) => s.type !== 'pen' && s.n)
      .map((s) => ({ n: s.n, note: (s.note || '').trim() }));
  }

  // 전체 사진 + 각 표시영역 확대 크롭 + 참고 사진
  function aiCollectImages() {
    const images = [{ label: '전체 불량 사진 (빨간 박스·번호 = 표시 영역)', dataUrl: Annotate.composite() }];
    (Annotate.markerCrops(6) || []).forEach((c) => {
      images.push({ label: '표시 영역 ' + c.n + ' 확대' + (c.note ? ' — ' + c.note : ''), dataUrl: c.dataUrl });
    });
    (Store.current().refPhotos || []).forEach((u, i) => {
      images.push({ label: '참고 사진 ' + (i + 1), dataUrl: u });
    });
    return images;
  }

  /* ---------- 항목별 AI 보강 (D4 5-Why / D5 대책) ---------- */
  function initAiAssist() {
    $$('[data-ai-assist]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!aiPreflight()) return;
        const kind = btn.dataset.aiAssist;
        const isWhy = kind === 'why_occur' || kind === 'why_escape';
        const msg = isWhy
          ? '작성한 원인을 베이스로 AI가 5-Why를 전개합니다.\n해당 5-Why 체인의 기존 내용은 덮어써집니다. 계속할까요?'
          : '작성한 내용을 베이스로 AI가 이 항목을 보강합니다.\n기존 내용은 덮어써집니다. 계속할까요?';
        if (!confirm(msg)) return;
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = '✦ 분석 중…';
        try {
          const out = await AI.assist(kind, {
            fields: Store.current().fields || {},
            why: Store.current().why || { occur: [], escape: [] },
            markers: aiCollectMarkers(),
            images: isWhy ? aiCollectImages() : [{ label: '전체 불량 사진', dataUrl: Annotate.composite() }],
          });
          if (isWhy) {
            const ch = kind === 'why_occur' ? 'occur' : 'escape';
            Store.current().why[ch] = out.why;
            Store.touch();
            renderWhy();
            afterChange();
            toast('5-Why 전개 완료 — 내용을 확인·수정하세요');
          } else {
            Store.current().fields[kind] = out.text;
            Store.touch();
            const ta = $('[data-field="' + kind + '"]');
            if (ta) { ta.value = out.text; autoGrow(ta); }
            afterChange();
            toast('보강 완료 — 내용을 확인·수정하세요');
          }
        } catch (e) {
          toast('실패: ' + (e && e.message ? e.message : e));
        } finally {
          btn.disabled = false;
          btn.textContent = label;
        }
      });
    });

    // 특성요인도 6M AI 보강
    const fbBtn = $('#fbAiBtn');
    if (fbBtn) fbBtn.addEventListener('click', async () => {
      if (!AI.isOnline()) { toast('오프라인 상태입니다.'); return; }
      if (!AI.hasKey()) {
        const s = $('#aiSettings'); if (s) s.open = true;
        toast('미리보기 탭 «🔑 AI 사진 분석 설정»에서 API 키를 먼저 입력하세요');
        return;
      }
      if (!confirm('현재 6M 편집 내용 + 사진·보조 정보를 근거로 AI가 특성요인도를 보강합니다.\n각 카테고리의 원인 목록이 새로 정리됩니다(기존 원인·하위원인은 유지 시도). 계속할까요?')) return;
      const label = fbBtn.textContent;
      fbBtn.disabled = true;
      fbBtn.textContent = '✦ 6M 보강 중… (약 30초)';
      try {
        const out = await AI.assist('fishbone', {
          fields: Store.current().fields || {},
          why: Store.current().why || { occur: [], escape: [] },
          markers: aiCollectMarkers(),
          images: aiCollectImages(),
          fishbone: Store.current().fishbone || { problem: '', cats: {} },
        });
        const fb = Store.current().fishbone || (Store.current().fishbone = { problem: '', cats: {} });
        let n = 0;
        Store.FB_CATS.forEach(([k]) => {
          const list = (out.fishbone && out.fishbone[k]) || [];
          if (list.length) { fb.cats[k] = list; n += list.length; }
        });
        if (!(fb.problem || '').trim()) {
          const fx = Store.current().fields || {};
          fb.problem = (fx.partName || '해당 부품') + ' ' + (fx.defectType || '불량') + ' 발생 원인 분석';
        }
        Store.touch();
        Fishbone.load();
        afterChange();
        toast(n ? '6M 보강 완료 — 원인 ' + n + '개. 내용을 확인·수정하세요' : '보강 결과가 없습니다');
      } catch (e) {
        toast('실패: ' + (e && e.message ? e.message : e));
      } finally {
        fbBtn.disabled = false;
        fbBtn.textContent = label;
      }
    });
  }

  /* ---------- 메뉴 / 신규 / 백업 ---------- */
  function initMenu() {
    $('#reportPicker').addEventListener('change', (e) => {
      Store.setCurrent(e.target.value);
      loadReport();
    });
    $('#newReportBtn').addEventListener('click', () => {
      Store.create();
      if (Annotate.reset) Annotate.reset();   // 이전 대책서의 사진·표시·참고사진 초기화
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
    const aiEffort = $('#aiEffort');
    const aiTwoStage = $('#aiTwoStage');
    function refreshAiOpts() {
      if (aiEffort) aiEffort.value = AI.getEffort();
      if (aiTwoStage) aiTwoStage.checked = AI.getTwoStage();
    }
    refreshAiKeyUI();
    refreshAiOpts();
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
    if (aiEffort) aiEffort.addEventListener('change', () => { AI.setEffort(aiEffort.value); refreshAiOpts(); });
    if (aiTwoStage) aiTwoStage.addEventListener('change', () => AI.setTwoStage(aiTwoStage.checked));

    const aiBtn = $('#aiPhotoBtn');
    const aiClarifyBtn = $('#aiClarifyBtn');
    const qBox = $('#aiQuestionBox');

    async function runAiAnalysis() {
      const scope = getAiScope();
      if (!scope.length) { toast('«🎯 AI 분석 범위 선택»에서 최소 1개 구획을 체크하세요'); return; }
      const label = aiBtn.textContent;
      aiBtn.disabled = true;
      aiClarifyBtn.disabled = true;
      const onStage = (s) => { aiBtn.textContent = '📷 ' + s; };
      onStage('분석 중… (1~2분)');
      try {
        const { result } = await AI.analyze(aiCollectImages(), Store.current().fields || {}, aiCollectMarkers(), { onStage: onStage, scope: scope });
        const n = Report.applyPhotoAnalysis(result, AI.scopeFilter(scope));
        loadReport();
        toast(n ? 'AI 작성 완료 — ' + n + '개 항목. 날짜·수량 등은 직접 확인해 채우세요.' : '분석 완료 — 반영할 결과가 없습니다.');
      } catch (e) {
        toast('분석 실패: ' + (e && e.message ? e.message : e));
      } finally {
        aiBtn.disabled = false;
        aiClarifyBtn.disabled = false;
        aiBtn.textContent = label;
      }
    }

    aiBtn.addEventListener('click', () => {
      if (!aiPreflight()) return;
      const scope = getAiScope();
      if (!scope.length) { toast('«🎯 AI 분석 범위 선택»에서 최소 1개 구획을 체크하세요'); return; }
      const names = scope.map((k) => (AI.SECTIONS[k] || {}).label || k).join(', ');
      if (!confirm('선택한 구획을 AI가 작성합니다:\n\n' + names + '\n\n해당 항목의 기존 내용은 덮어써집니다. 계속할까요?')) return;
      runAiAnalysis();
    });

    // ── 출력 문서 언어 (국문 / English / 병기) + AI 영문 번역 ──
    const LANG_LS = 'qcr.reportLang.v1';
    const langSel = $('#reportLang');
    const trBtn = $('#reportTranslateBtn');
    if (langSel) {
      try { const v = localStorage.getItem(LANG_LS); if (v) langSel.value = v; } catch (e) {}
      Report.setLang(langSel.value);
      langSel.addEventListener('change', () => {
        try { localStorage.setItem(LANG_LS, langSel.value); } catch (e) {}
        Report.setLang(langSel.value);
      });
    }
    function collectTranslatable() {
      const r = Store.current();
      // 서술 + 짧은 자유 텍스트(회사·인명·설비·부서·역할) 모두 포함
      const KEYS = ['defectType', 'defectDesc', 'defectProcess',
        'customer', 'customerPlant', 'vehicle', 'supplier', 'author', 'dept', 'approver',
        'd0_symptom', 'd0_era', 'd0_owner',
        'd2_what', 'd2_where', 'd2_when', 'd2_who', 'd2_how', 'd2_howmany', 'd2_why', 'd2_is', 'd2_isnot',
        'd3_action', 'd3_result', 'd3_verify', 'd3_owner',
        'd4_occur', 'd4_escape', 'd4_verify',
        'd5_occur', 'd5_escape', 'd5_risk', 'd5_basis',
        'd6_effect', 'd7_lesson', 'd7_std', 'd8_closing', 'd8_approver',
        'd1_champion', 'd1_leader'];
      const fields = {};
      KEYS.forEach((k) => { const v = ((r.fields || {})[k] || '').trim(); if (v) fields[k] = v; });
      const why = {
        occur: ((r.why || {}).occur || []).map((x) => x || ''),
        escape: ((r.why || {}).escape || []).map((x) => x || ''),
      };
      const cats = {};
      const fbc = (r.fishbone || {}).cats || {};
      Object.keys(fbc).forEach((k) => {
        const list = (fbc[k] || []).filter((c) => (c.text || '').trim() || (c.subs || []).some(Boolean));
        if (list.length) cats[k] = list.map((c) => ({ text: c.text || '', subs: (c.subs || []).filter(Boolean) }));
      });
      const d1 = (r.d1 || []).map((m) => ({ name: m.name || '', dept: m.dept || '', role: m.role || '' }));
      const d6 = (r.d6 || []).map((x) => ({ action: x.action || '', owner: x.owner || '', result: x.result || '' }));
      return {
        fields: fields, why: why,
        fishbone: { problem: (r.fishbone || {}).problem || '', cats: cats },
        d1: d1, d6: d6,
      };
    }
    if (trBtn) {
      trBtn.addEventListener('click', async () => {
        if (!AI.isOnline()) { toast('오프라인 상태입니다.'); return; }
        if (!AI.hasKey()) { const s = $('#aiSettings'); if (s) s.open = true; toast('먼저 API 키를 설정하세요'); return; }
        const payload = collectTranslatable();
        const hasContent = Object.keys(payload.fields).length
          || payload.why.occur.some(Boolean) || payload.why.escape.some(Boolean)
          || Object.keys(payload.fishbone.cats).length || payload.fishbone.problem.trim();
        if (!hasContent) { toast('번역할 대책서 내용이 없습니다'); return; }
        const label = trBtn.textContent;
        trBtn.disabled = true;
        trBtn.textContent = '🌐 번역 중… (약 30초)';
        try {
          const en = await AI.translate(payload);
          Store.current().i18n = {
            fields: (en && en.fields) || {},
            why: (en && en.why) || {},
            fishbone: (en && en.fishbone) || {},
            d1: (en && Array.isArray(en.d1)) ? en.d1 : [],
            d6: (en && Array.isArray(en.d6)) ? en.d6 : [],
            updatedAt: Date.now(),
          };
          Store.touch();
          if (langSel && langSel.value === 'ko') {
            langSel.value = 'both';
            try { localStorage.setItem(LANG_LS, 'both'); } catch (e) {}
          }
          Report.setLang(langSel ? langSel.value : 'both');
          markDirty();
          toast('영문 번역 완료 — 미리보기·인쇄에 반영됩니다');
        } catch (e) {
          toast('번역 실패: ' + (e && e.message ? e.message : e));
        } finally {
          trBtn.disabled = false;
          trBtn.textContent = label;
        }
      });
    }

    // ── 되묻기 모드 ──
    aiClarifyBtn.addEventListener('click', async () => {
      if (!aiPreflight()) return;
      const label = aiClarifyBtn.textContent;
      aiClarifyBtn.disabled = true;
      aiBtn.disabled = true;
      aiClarifyBtn.textContent = '❓ 질문 생성 중…';
      try {
        const { questions } = await AI.askQuestions(aiCollectImages(), Store.current().fields || {}, aiCollectMarkers());
        if (!questions.length) { toast('추가 질문 없음 — 바로 «AI 8D 분석·작성»을 실행하세요'); return; }
        const ol = $('#aiQuestionList');
        ol.innerHTML = '';
        questions.forEach((q) => { const li = document.createElement('li'); li.textContent = q; ol.appendChild(li); });
        const ans = $('#aiAnswerInput');
        ans.value = Store.current().fields.aux_answers || '';
        qBox.hidden = false;
        qBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        ans.focus();
      } catch (e) {
        toast('질문 생성 실패: ' + (e && e.message ? e.message : e));
      } finally {
        aiClarifyBtn.disabled = false;
        aiBtn.disabled = false;
        aiClarifyBtn.textContent = label;
      }
    });
    $('#aiQuestionCancel').addEventListener('click', () => { qBox.hidden = true; });
    $('#aiAnswerSubmit').addEventListener('click', () => {
      const ans = $('#aiAnswerInput').value.trim();
      Store.current().fields.aux_answers = ans;
      Store.touch();
      const auxAns = $('[data-field="aux_answers"]');
      if (auxAns) auxAns.value = ans;
      qBox.hidden = true;
      const names = getAiScope().map((k) => (AI.SECTIONS[k] || {}).label || k).join(', ');
      if (!confirm('입력한 답변을 반영해 선택한 구획을 새로 작성합니다:\n\n' + (names || '(선택된 구획 없음)') + '\n\n기존 내용은 덮어써집니다. 계속할까요?')) return;
      runAiAnalysis();
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
    initAiScope();
    initMenu();
    initAiAssist();
    Annotate.mount(afterChange);
    Fishbone.mount(afterChange);
    Report.mount();
    loadReport();
    initPWA();
  });
})();
