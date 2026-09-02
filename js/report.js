/* ===== 미리보기 / 출력 문서 생성 ===== */
(function (global) {
  let docEl, progressEl;
  let lang = 'ko'; // 'ko' | 'en' | 'both'

  function setLang(v) {
    lang = (v === 'en' || v === 'both') ? v : 'ko';
    render();
  }
  function getLang() { return lang; }

  function esc(t) {
    return (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function nl(t) {
    return esc(t).replace(/\n/g, '<br>');
  }
  function val(v, empty) {
    v = (v == null ? '' : String(v)).trim();
    return v ? nl(v) : '<span class="empty">' + (empty || '—') + '</span>';
  }
  function T(ko) {
    return (global.I18N && I18N.t) ? I18N.t(ko) : ko;
  }
  // 고정 라벨/제목 — 언어 모드에 따라 KO / EN / 병기
  function L(ko) {
    if (lang === 'ko') return esc(ko);
    const en = T(ko);
    if (lang === 'en') return esc(en);
    return esc(ko) + (en !== ko ? '<span class="doc-en-lbl"> / ' + esc(en) + '</span>' : '');
  }
  // 자유 서술 필드 값 — report.i18n.fields[key] 에 캐시된 영문 사용
  function enOf(key) {
    return (((Store.current().i18n || {}).fields) || {})[key] || '';
  }
  function fv(key, empty) {
    const ko = f(key);
    const en = String(enOf(key) || '').trim();
    if (lang === 'ko') return val(ko, empty);
    if (lang === 'en') return en ? nl(en) : val(ko, empty);
    if (!ko.trim()) return val('', empty);
    return nl(ko) + (en ? '<div class="doc-en">' + nl(en) + '</div>' : '');
  }
  // 짧은 enum 값 (확인됨/승인 등) — 사전만
  function ev(key) {
    const ko = f(key);
    if (!ko.trim()) return val('');
    if (lang === 'ko') return esc(ko);
    const en = T(ko);
    if (lang === 'en') return esc(en);
    return esc(ko) + (en !== ko ? ' / ' + esc(en) : '');
  }
  // 짧은 자유 텍스트 (이름·회사·설비 등) — report.i18n.fields 캐시, 한 줄 인라인
  function fi(key) {
    const ko = f(key).trim();
    const en = String(enOf(key) || '').trim();
    if (!ko && !en) return '';
    if (lang === 'ko') return esc(ko);
    if (lang === 'en') return esc(en || ko);
    return esc(ko) + (en && en !== ko ? '<span class="doc-en-lbl"> / ' + esc(en) + '</span>' : '');
  }
  // 임의의 ko/en 문자열 쌍 (테이블 셀 등) — fi 와 동일 규칙
  function tv(ko, en) {
    ko = String(ko == null ? '' : ko).trim();
    en = String(en == null ? '' : en).trim();
    if (!ko && !en) return val('');
    if (lang === 'ko') return nl(ko);
    if (lang === 'en') return nl(en || ko);
    return nl(ko) + (en && en !== ko ? '<span class="doc-en-lbl"> / ' + esc(en) + '</span>' : '');
  }
  // 여러 조각(fi 결과 HTML 또는 esc된 문자열)을 " / " 로 병합, 빈 값 제외
  function joinParts(arr) {
    const parts = arr.filter((s) => s && s.replace(/<[^>]*>/g, '').trim());
    return parts.length ? parts.join(' / ') : val('');
  }

  function f(k) {
    return (Store.current().fields || {})[k] || '';
  }

  function koreanParticle(text, type) {
    const s = String(text || '').trim();
    if (!s) return type === 'subject' ? '가' : type === 'topic' ? '는' : type === 'object' ? '를' : '와';
    const last = s[s.length - 1];
    const code = last.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const hasBatchim = ((code - 0xAC00) % 28) !== 0;
      if (type === 'subject') return hasBatchim ? '이' : '가';
      if (type === 'topic') return hasBatchim ? '은' : '는';
      if (type === 'object') return hasBatchim ? '을' : '를';
      if (type === 'with') return hasBatchim ? '과' : '와';
    }
    return type === 'subject' ? '가' : type === 'topic' ? '는' : type === 'object' ? '를' : '와';
  }

  function rows(pairs, wide) {
    return (
      '<table' + (wide ? ' class="wide"' : '') + '>' +
      pairs.map(([k, v]) => '<tr><th>' + L(k) + '</th><td>' + v + '</td></tr>').join('') +
      '</table>'
    );
  }

  function sectionHead(tag, title) {
    return '<h2><span class="tag">' + (lang === 'ko' ? esc(tag) : esc(T(tag))) + '</span>' + L(title) + '</h2>';
  }

  function whyBox(arr, enArr) {
    const labels = ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5', '근본원인'];
    enArr = Array.isArray(enArr) ? enArr : [];
    const steps = labels
      .map((lbl, i) => {
        const ko = (arr[i] || '').trim();
        const en = (enArr[i] || '').trim();
        const has = lang === 'en' ? (en || ko) : ko;
        if (!has) return '';
        let body;
        if (lang === 'ko') body = esc(ko);
        else if (lang === 'en') body = esc(en || ko);
        else body = esc(ko) + (en ? '<span class="doc-en"> ' + esc(en) + '</span>' : '');
        return '<span class="step"><b>' + L(lbl) + ':</b> ' + body + '</span>';
      })
      .filter(Boolean)
      .join('');
    return steps ? '<div class="why-box">' + steps + '</div>' : '<p class="empty">' + L('미작성') + '</p>';
  }

  function qtyList() {
    const items = [
      ['불량 수량', f('qtyDefect')],
      ['고객 재고', f('qtyCustomerStock')],
      ['사내 재고', f('qtyInHouseStock')],
      ['공정 재고(WIP)', f('qtyWip')],
    ].map(([lbl, v]) => {
      const s = String(v == null ? '' : v).trim();
      const num = s === '' ? '<span class="empty">—</span>' : esc(s) + ' EA';
      return '<span class="qty-item"><b>' + L(lbl) + '</b> ' + num + '</span>';
    });
    return '<span class="qty-list">' + items.join('<span class="qty-sep">/</span>') + '</span>';
  }

  function markerTable() {
    const shapes = (Store.current().photo.shapes || []).filter((s) => s.type !== 'pen');
    if (!shapes.length) return '';
    return (
      '<table><tr><th style="width:40px">' + L('No') + '</th><th>' + L('표시 영역 불량 내용') + '</th></tr>' +
      shapes.map((s) => '<tr><td>' + s.n + '</td><td>' + val(s.note, '내용 미작성') + '</td></tr>').join('') +
      '</table>'
    );
  }

  function render() {
    if (!docEl) return;
    const r = Store.current();
    const photo = (global.Annotate && Annotate.composite()) || '';
    const refs = r.refPhotos || [];
    const fbSVG = (global.Fishbone && Fishbone.svgString()) || '';
    let h = '';

    h += '<h1>' + L('품질 대책서 (8D Report)') + '</h1>';
    if (lang !== 'ko' && !(r.i18n && r.i18n.fields)) {
      h += '<p class="doc-note no-print">※ 서술 내용의 영문 번역이 아직 없습니다. «🌐 영문 번역(AI)» 버튼을 누르면 채워집니다. (라벨·제목은 즉시 번역됨)</p>';
    }
    const ph = (ko) => (lang === 'ko' ? ko : T(ko));
    const subCust = f('customer').trim() ? fi('customer') : '<span class="empty">' + esc(ph('고객사')) + '</span>';
    const subPart = f('partName').trim() ? esc(f('partName')) : '<span class="empty">' + esc(ph('부품명')) + '</span>';
    h += '<p class="doc-sub">' + subCust + ' &nbsp;|&nbsp; ' + subPart + ' &nbsp;|&nbsp; ' + fv('defectType', ph('불량 유형')) + '</p>';

    // 문서/제품 정보
    h += sectionHead('INFO', '문서 및 제품 정보');
    h += '<div class="two-col">';
    h += rows([
      ['문서번호', val(f('docNo'))],
      ['개정(Rev.)', val(f('rev'))],
      ['작성일', val(f('writeDate'))],
      ['작성자 / 부서', joinParts([fi('author'), fi('dept')])],
      ['승인자', fi('approver')],
    ]);
    h += rows([
      ['고객사', fi('customer')],
      ['고객 공장/라인', fi('customerPlant')],
      ['부품명 / P/N', val([f('partName'), f('partNo')].filter(Boolean).join(' / '))],
      ['적용 차종', fi('vehicle')],
      ['협력사 / 공정', fi('supplier')],
    ]);
    h += '</div>';

    // 불량 개요
    h += sectionHead('개요', '불량 개요');
    h += rows([
      ['불량 유형', fv('defectType')],
      ['불량 등급', ev('defectGrade')],
      ['발생 공정', fi('defectProcess')],
      ['수량 현황', qtyList()],
      ['납품 LOT / 생산일자', val(f('lotNo'))],
      ['발생일 / 접수일', val([f('occurDate'), f('receiveDate')].filter(Boolean).join(' / '))],
      ['초도(D+3) / 최종 회신', val([f('interimDue'), f('finalDue')].filter(Boolean).join(' / '))],
      ['불량 현상 상세', fv('defectDesc')],
    ], true);

    // 불량 사진
    if (photo || markerTable()) {
      h += sectionHead('PHOTO', '불량 사진 및 표시 영역');
      if (photo) h += '<div class="photo-block"><img src="' + photo + '" alt="불량 사진"></div>';
      h += markerTable();
    }
    if (refs.length) {
      h += '<div class="two-col">' + refs.map((s) => '<div class="photo-block"><img src="' + s + '"></div>').join('') + '</div>';
    }

    // D0
    h += sectionHead('D0', '준비 & 비상 대응 조치 (ERA)');
    h += rows([
      ['증상 인식 / 초기 상황', fv('d0_symptom')],
      ['비상 대응 조치', fv('d0_era')],
      ['조치일 / 담당', joinParts([f('d0_date') ? esc(f('d0_date')) : '', fi('d0_owner')])],
      ['ERA 유효성', ev('d0_verify')],
    ], true);

    // D1
    h += sectionHead('D1', '팀 구성');
    h += rows([
      ['챔피언 / 후원자', fi('d1_champion')],
      ['팀 리더', fi('d1_leader')],
    ], true);
    if ((r.d1 || []).length) {
      const d1En = (r.i18n && Array.isArray(r.i18n.d1)) ? r.i18n.d1 : [];
      h += '<table><tr><th style="width:auto">' + L('이름') + '</th><th>' + L('부서') + '</th><th>' + L('역할 / 담당') + '</th></tr>' +
        r.d1.map((m, i) => {
          const e = d1En[i] || {};
          return '<tr><td>' + tv(m.name, e.name) + '</td><td>' + tv(m.dept, e.dept) + '</td><td>' + tv(m.role, e.role) + '</td></tr>';
        }).join('') +
        '</table>';
    }

    // D2
    h += sectionHead('D2', '문제 정의 (5W2H · IS / IS NOT)');

    // 5W2H — 항목별 독립 블록
    h += '<div class="d2-def">' +
      [
        ['What', '무엇이', 'd2_what'],
        ['Where', '어디서 (부위/공정)', 'd2_where'],
        ['When', '언제', 'd2_when'],
        ['Who', '누가 발견', 'd2_who'],
        ['How', '검출 방법', 'd2_how'],
        ['How many', '규모 / 추세', 'd2_howmany'],
      ].map(([en, ko, key]) =>
        '<div class="d2-item"><div class="d2-k"><span class="d2-en">' + en + '</span>' + (lang === 'en' ? '' : esc(ko)) + '</div>' +
        '<div class="d2-v">' + fv(key) + '</div></div>'
      ).join('') +
      '</div>';

    // 왜 문제인가 — 독립 강조 블록
    h += '<div class="d2-why"><div class="d2-why-h">' + L('왜 문제인가 · 고객 영향') + '</div>' +
      '<div class="d2-why-b">' + fv('d2_why') + '</div></div>';

    // IS / IS NOT 비교
    h += '<div class="d2-isnot">' +
      '<div class="d2-is"><div class="d2-k">' + L('IS · 발생한다') + '</div><div class="d2-v">' + fv('d2_is') + '</div></div>' +
      '<div class="d2-isn"><div class="d2-k">' + L('IS NOT · 발생하지 않는다') + '</div><div class="d2-v">' + fv('d2_isnot') + '</div></div>' +
      '</div>';

    // D3
    h += sectionHead('D3', '봉쇄(임시) 조치 — ICA');
    h += rows([
      ['임시 조치 내용', fv('d3_action')],
      ['실시일 / 담당', joinParts([f('d3_date') ? esc(f('d3_date')) : '', fi('d3_owner')])],
      ['선별 수량 / 결과', fv('d3_result')],
      ['유효성 검증', fv('d3_verify')],
    ], true);

    // D4
    h += sectionHead('D4', '근본 원인 분석 (Root Cause)');
    h += rows([
      ['발생 원인 (Occurrence)', fv('d4_occur')],
      ['유출 원인 (Detection)', fv('d4_escape')],
    ], true);
    const whyEn = (r.i18n && r.i18n.why) || {};
    h += '<p><b>' + L('5-Why — 발생 원인') + '</b></p>' + whyBox(r.why.occur, whyEn.occur);
    h += '<p><b>' + L('5-Why — 유출 원인') + '</b></p>' + whyBox(r.why.escape, whyEn.escape);
    h += rows([['원인 검증 방법 / 근거', fv('d4_verify')]], true);
    if (fbSVG && (Store.current().fishbone.problem || hasFbCauses())) {
      const fbOut = (lang !== 'ko' && r.i18n && r.i18n.fishbone && global.Fishbone && Fishbone.svgStringFrom)
        ? Fishbone.svgStringFrom(mergeFishboneEn(Store.current().fishbone, r.i18n.fishbone, lang))
        : fbSVG;
      h += '<p><b>' + L('특성요인도 (Fishbone)') + '</b></p><div class="fb-diagram">' + fbOut + '</div>';
    }

    // D5
    h += sectionHead('D5', '영구 시정 조치 선정 (PCA)');
    h += rows([
      ['발생 방지 대책', fv('d5_occur')],
      ['유출 방지 대책', fv('d5_escape')],
      ['부작용 / 위험성 검토', fv('d5_risk')],
      ['선정 근거 (대안 비교)', fv('d5_basis')],
    ], true);

    // D6
    h += sectionHead('D6', '시정 조치 실행 & 검증');
    if ((r.d6 || []).length) {
      const d6En = (r.i18n && Array.isArray(r.i18n.d6)) ? r.i18n.d6 : [];
      h += '<table><tr><th style="width:auto">' + L('조치 내용') + '</th><th>' + L('담당') + '</th><th>' + L('완료예정') + '</th><th>' + L('완료일') + '</th><th>' + L('검증 결과') + '</th></tr>' +
        r.d6.map((x, i) => {
          const e = d6En[i] || {};
          return '<tr><td>' + tv(x.action, e.action) + '</td><td>' + tv(x.owner, e.owner) + '</td><td>' + val(x.due) + '</td><td>' + val(x.done) + '</td><td>' + tv(x.result, e.result) + '</td></tr>';
        }).join('') +
        '</table>';
    }
    h += rows([
      ['양산 적용일 / LOT', val([f('d6_massdate'), f('d6_masslot')].filter(Boolean).join(' / '))],
      ['효과 검증 결과 (전/후)', fv('d6_effect')],
    ], true);

    // D7
    h += sectionHead('D7', '재발 방지 & 수평 전개');
    const docs = Store.D7_DOCS.filter(([k]) => r.d7docs[k]).map(([, label]) => (lang === 'ko' ? label : T(label)));
    h += rows([
      ['개정 / 반영 문서', docs.length ? esc(docs.join(', ')) : '<span class="empty">' + L('선택 항목 없음') + '</span>'],
      ['수평 전개', fv('d7_lesson')],
      ['표준화 / 교육', fv('d7_std')],
    ], true);

    // D8
    h += sectionHead('D8', '종결 & 팀 노고 치하');
    h += rows([
      ['종결 코멘트 / 팀 노고', fv('d8_closing')],
      ['종결 승인자 / 종결일', joinParts([fi('d8_approver'), f('d8_date') ? esc(f('d8_date')) : ''])],
      ['고객 승인 여부', ev('d8_customerOk')],
    ], true);

    docEl.innerHTML = h;
  }

  /* 특성요인도 데이터에 영문을 얹어 임시 데이터 생성 (EN/병기 모드용) */
  function mergeFishboneEn(fbData, fbEn, mode) {
    fbEn = fbEn || {};
    const cats = {};
    Object.keys(fbData.cats || {}).forEach((k) => {
      const ko = fbData.cats[k] || [];
      const en = (fbEn.cats && fbEn.cats[k]) || [];
      cats[k] = ko.map((c, i) => {
        const enText = (en[i] && en[i].text) || en[i] || '';
        const text = mode === 'en' ? (enText || c.text) : (enText ? c.text + ' / ' + enText : c.text);
        const subs = (c.subs || []).map((s, j) => {
          const es = (en[i] && en[i].subs && en[i].subs[j]) || '';
          return mode === 'en' ? (es || s) : (es ? s + ' / ' + es : s);
        });
        return { text: text, subs: subs };
      });
    });
    const pKo = fbData.problem || '';
    const pEn = fbEn.problem || '';
    const problem = mode === 'en' ? (pEn || pKo) : (pEn ? pKo + ' / ' + pEn : pKo);
    return { problem: problem, cats: cats };
  }

  function hasFbCauses() {
    const c = Store.current().fishbone.cats;
    return Object.keys(c).some((k) => (c[k] || []).some((x) => x.text || (x.subs || []).some(Boolean)));
  }

  /* ---- D8 진행률 ---- */
  const D8_KEYS = {
    D0: ['d0_symptom', 'd0_era'],
    D1: ['d1_leader'],
    D2: ['d2_what', 'd2_where'],
    D3: ['d3_action'],
    D4: ['d4_occur'],
    D5: ['d5_occur'],
    D6: ['d6_effect'],
    D7: ['d7_lesson'],
    D8: ['d8_closing'],
  };
  function updateProgress() {
    if (!progressEl) return;
    // 필터가 없으면(초기 화면) 첫 단계 D0을 선택된 것으로 표시
    const active = progressEl.dataset.filter || 'D0';
    progressEl.innerHTML = Object.keys(D8_KEYS)
      .map((d) => {
        const done = D8_KEYS[d].every((k) => (f(k) || '').trim());
        const activeClass = active === d ? ' is-active' : '';
        const doneClass = done ? ' done' : '';
        return '<button type="button" class="d8-step' + activeClass + doneClass + '" data-step="' + d + '">' + d + '</button>';
      })
      .join('');

    progressEl.querySelectorAll('button[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = btn.dataset.step;
        const next = progressEl.dataset.filter === step ? '' : step;
        progressEl.dataset.filter = next;

        document.querySelectorAll('details.d8').forEach((detail) => {
          const tag = detail.querySelector('.d8-tag')?.textContent?.trim();
          const visible = !next || tag === next;
          detail.hidden = !visible;
          detail.open = !next || tag === next;
        });

        updateProgress();
      });
    });
  }

  function buildAutoDraft() {
    const r = Store.current();
    const f = r.fields || {};
    const part = f.partName || '해당 부품';
    const customer = f.customer || '고객사';
    const defect = f.defectType || '불량';
    const process = f.defectProcess || '해당 공정';
    const date = f.occurDate || f.receiveDate || f.writeDate || '';
    const qty = [
      ['불량 수량', f.qtyDefect],
      ['고객 재고', f.qtyCustomerStock],
      ['사내 재고', f.qtyInHouseStock],
      ['WIP', f.qtyWip],
    ].filter(([, v]) => String(v || '').trim() !== '');
    const qtyText = qty.length ? qty.map(([label, v]) => `${label} ${v}EA`).join(' / ') : '미기재';

    const markerList = (r.photo.shapes || []).filter((s) => s.type !== 'pen' && (s.note || '').trim());
    const markers = markerList.length
      ? markerList.map((s) => `${s.n}번 영역의 ${s.note.trim()}`).join('; ')
      : '사진상 불량 위치 표시';
    const defectDetail = (f.defectDesc || '').trim();
    const defectBasis = defectDetail
      ? `불량 현상 상세는 "${defectDetail}"로 기록되었고, 사진상 ${markers}를 기준으로 판별되었다.`
      : `사진상 ${markers}를 기준으로 불량 위치를 확인하였다.`;
    const defectSubj = `${defect}${koreanParticle(defect, 'subject')}`;
    const defectTopic = `${defect}${koreanParticle(defect, 'topic')}`;
    const defectObj = `${defect}${koreanParticle(defect, 'object')}`;

    const whyOccur = [
      `${process}에서 조립 작업 시 ${defectSubj} 발생하였고, ${defectBasis} 이를 바탕으로 조립 시 외력 집중과 접촉부 마모가 재발 원인으로 확인되었다.`,
      `${part}의 단자 형상 및 가공 상태가 조립 시 외력에 취약하여 ${defectSubj} 발생하였고, ${defectDetail ? '상세 현상 설명에 따른 좌측 선단 변형' : '사진상 변형 부위'}이 더욱 심화되었다.`,
      `작업자가 단자 배치 위치와 압입 강도를 일관되게 제어하지 못하여, 부품 위치 편차가 누적되면서 ${defectSubj} 발생하였다.`,
      `설비 정렬 및 가이드 상태가 기준 범위를 벗어나 있었고, 조립 시 편심이 발생하면서 단자 접촉부 마모와 ${defectSubj} 유발되었다.`,
      `기존 검사 항목이 조립 후 변형 상태를 충분히 검출하지 못하였고, ${defectDetail || '불량 부위의 외관 변형'}이 누적되어 고객 선적 단계에서 드러났다.`,
      `조립 시점의 ${defectTopic} 부품 형상, 설비 편차, 작업자 제어, 검사 누락이 복합적으로 작용한 결과로 확인되었다.`
    ];

    const whyEscape = [
      `조립 공정에서 ${defectDetail || '단자 휨'}이 발생하였으나, 기존 검사는 외관 결함 중심으로 수행되어 접촉부 마모와 선단 변형을 충분히 식별하지 못하였다.`,
      `검사 기준서에 변형 허용 범위와 기준 시점이 명확히 정의되지 않아, ${defectDetail || '변형 상태'}가 기준 초과 여부로 누락되었다.`,
      `계측기 보정 및 라인별 점검 일정이 미흡하여, 공정 중 발생한 편심과 접촉부 마모가 조기에 검출되지 않았다.`,
      `불량 발생 위치가 집중된 구역이 명시되지 않아, 동일 유형의 ${defect}와 외관 변형이 다른 조립 라인으로 전파되었다.`,
      `공정별 관리 지표가 생산량 중심으로 설정되어 있어, 품질 이상 징후를 조기 탐지하는 기준이 부족하였다.`,
      `변형 유발 요인이 특정 부위로 집중되었지만, 사전 예방 기준이 부재하여 유출이 발생하였다.`
    ];

    return {
      d0_symptom: `${customer}에서 ${part} 부품의 ${defect}${koreanParticle(defect, 'subject')}${date ? ' ' + date + ' 이후' : ''} 확인되었고, ${process}에서 이상 발생이 인지되었다.`,
      d0_era: `불량품 보류 및 재고 잠금, 관련 LOT 선별, 고객 출하 전 검증, 생산 중단·유보 조치 및 영향 범위를 즉시 공유하여 추가 유출을 차단하였다.`,
      d2_what: `${part} 부품의 ${defect}${koreanParticle(defect, 'topic')} 조립 공정에서 확인되었으며, ${defectDetail || '불량 현상 상세는 기록되지 않았다.'}`,
      d2_where: `${process} 내 단자 조립 구간에서 발생하였고, ${markers}로 확인되었다.`,
      d2_when: `${date || '발견 시점'} 이후 확인되었으며, 누적 발생 추세를 확인하였다.`,
      d2_who: `${f.author || '담당자'} 및 고객·공장 검출자가 확인하였고, 조립 라인별 확인 결과를 공유하였다.`,
      d2_how: `현장 육안 점검, 사진 기반 위치 확인, 검사표 검토 및 현상 분석을 통하여 ${defectDetail || '불량 특성을 확인'}하였다.`,
      d2_howmany: `${qtyText}로 확인되었으며, 불량 발생 건수와 누적 영향 범위가 증가 추세로 나타났다.`,
      d2_why: `${customer}의 품질 기준 및 사용 조건상 ${defect}${koreanParticle(defect, 'subject')} 허용 기준을 초과하였고, ${defectDetail || '접촉부 마모와 선단 변형'}로 인한 기능 및 외관 문제로 고객 영향이 발생할 가능성이 확인되었다.`,
      d2_is: `${process}에서 ${defect}${koreanParticle(defect, 'subject')} 발생하였고, ${markers}와 관련된 불량 특성이 확인되었다.`,
      d2_isnot: `동일 부품의 다른 공정 및 정상 생산 조건에서는 ${defect}${koreanParticle(defect, 'subject')} 발생이 관찰되지 않아, 특정 조건 또는 위치에서만 유발되었다.`,
      d3_action: `관련 LOT에 대한 전수 선별 및 재검사, 고객 재고·사내 재고 보류, 임시 조치 기준을 적용하여 추가 출하를 차단하고 공정별 중점 점검을 실시하였다.`,
      d3_result: `선별 대상 전수 점검 후 영향 범위 진단 및 불량 유출 방지 조치를 완료하였다.`,
      d3_verify: `선별율 100% 적용, 영향 범위 확인 후 추가 고객 불량 발생 0건을 유지하였다.`,
      d4_occur: `${process}에서 ${defect}${koreanParticle(defect, 'subject')} 발생한 원인은 조립 조건 편차, 부품 형상 영향, 설비 정렬 불량 및 작업자 제어 미흡이 복합적으로 작용하였고, ${defectDetail || '사진상 접촉부 마모와 선단 휨'}이 재발을 가속화한 것으로 판단되었다.`,
      d4_escape: `기존 검사 항목이 ${defect}${koreanParticle(defect, 'object')} 충분히 검출하지 못하였고, 불량 부위의 위치 및 특성, ${defectDetail || '접촉부 마모와 외관 변형'}이 누락되어 유출되었다.`,
      d5_occur: `공정 기준 재설정, 설비 점검 및 보정, 작업 표준 강화, 주요 체크 항목 추가 및 불량 시 조치 절차 정립을 추진하였다.`,
      d5_escape: `검사 기준 개선, 계측기 점검, 검사 체크리스트 보완 및 샘플링 강화를 통하여 조기 탐지와 유출 차단을 실시하였다.`,
      d5_risk: `신규 공정 기준 적용 시 생산량 저하 또는 작업자 적응 시간 증가 가능성이 있으나, 통제 방안을 마련하여 리스크를 최소화하였다.`,
      d5_basis: `대안 비교 결과, 현장 적용성·효율성·검증 가능성을 기준으로 우수한 대책을 선정하였다.`,
      d6_effect: `시정 조치 전후 비교에서 ${defect}${koreanParticle(defect, 'subject')} 발생률 감소 및 공정 불량 유출이 억제되었음을 확인하였다.`,
      d7_lesson: `유사 부품 및 타 라인에 동일 유사 불량이 재발하지 않도록 교육·표준화·검사 기준을 확산하고 공정별 점검을 강화하였다.`,
      d7_std: `작업표준서, 검사 기준서, PFMEA 및 관리계획서 내용을 반영하여 표준화 및 교육을 수행하였다.`,
      d8_closing: `${customer}와 ${part} 부품에 대한 ${defect} 이슈는 원인 분석, 시정 조치 및 검증 완료 후 종결되었다. 팀의 신속한 대응과 협력이 결실을 이루었으며, 재발 방지를 위해 지속적으로 관리하였다.`,
      d8_customerOk: '승인',
      why: {
        occur: whyOccur,
        escape: whyEscape,
      },
    };
  }

  function applyAutoDraft() {
    const draft = buildAutoDraft();
    const target = Store.current();
    const fields = target.fields || (target.fields = {});
    Object.entries(draft).forEach(([key, value]) => {
      if (key === 'why') {
        target.why = value;
        return;
      }
      fields[key] = value;
    });

    const fb = target.fishbone || (target.fishbone = { problem: '', cats: {} });
    fb.problem = `${target.fields.partName || '해당 부품'} ${target.fields.defectType || '불량'} 발생 원인 분석`;
    Store.FB_CATS.forEach(([key]) => {
      if (!fb.cats[key]) fb.cats[key] = [];
    });

    const causes = {
      man: ['작업자 교육 및 지침 미흡', '공정별 검사 기준 숙지 부족', '작업자별 습관 차이'],
      machine: ['설비 조정 편차', '기계 정렬 불량', '센서 및 계측기 오차'],
      material: ['원재료 물성 편차', '투입 자재 불량', '공정 전후 소재 상태 차이'],
      method: ['작업 표준 미흡', '검사 기준 부적정', '공정별 관리 간격 미흡'],
      measure: ['검사 기준 해석 차이', '계측기 보정 누락', '검사 시점 및 샘플링 편차'],
      env: ['온도/습도 변동', '습기 및 오염 환경 영향', '공정 주변 환경 조건 변화'],
    };

    Store.FB_CATS.forEach(([key]) => {
      fb.cats[key] = (causes[key] || []).map((text) => ({ text, subs: [] }));
    });

    Store.touch();
    return draft;
  }

  /* ---- AI 사진 분석 결과 반영 (해당 항목을 AI 결과로 덮어씀 · AI가 낸 값만)
   * allow: { fields:Set<string>, why:bool, fishbone:bool, regions:bool } — 지정 시 그 범위만 반영 ---- */
  function applyPhotoAnalysis(result, allow) {
    if (!result || typeof result !== 'object') return 0;
    const target = Store.current();
    const fields = target.fields || (target.fields = {});
    const okField = (k) => !allow || !allow.fields || allow.fields.has(k);
    let filled = 0;
    const setField = (k, v) => {
      if (!okField(k)) return;
      v = (v == null ? '' : String(v)).trim();
      if (!v) return; // AI가 값을 안 낸 항목은 기존 내용 유지
      fields[k] = v;
      filled++;
    };

    const rf = result.fields || {};
    setField('defectType', rf.defectType || result.defect_type_guess);

    [
      'defectDesc',
      'd0_symptom', 'd0_era',
      'd2_what', 'd2_where', 'd2_when', 'd2_who', 'd2_how', 'd2_howmany', 'd2_why', 'd2_is', 'd2_isnot',
      'd3_action', 'd3_result', 'd3_verify',
      'd4_occur', 'd4_escape', 'd4_verify',
      'd5_occur', 'd5_escape', 'd5_risk', 'd5_basis',
      'd6_effect',
      'd7_lesson', 'd7_std',
      'd8_closing',
    ].forEach((k) => setField(k, rf[k]));

    if (okField('defectDesc') && !(fields.defectDesc || '').trim()) setField('defectDesc', result.defect_summary);

    // 5-Why (발생/유출) — AI가 배열을 내면 해당 채널 전체를 덮어씀
    const w = (!allow || allow.why) ? (result.why || {}) : {};
    if (!target.why) target.why = { occur: ['', '', '', '', '', ''], escape: ['', '', '', '', '', ''] };
    ['occur', 'escape'].forEach((which) => {
      const arr = Array.isArray(w[which]) ? w[which] : null;
      if (!arr) return;
      const next = arr.slice(0, 6).map((x) => (x == null ? '' : String(x).trim()));
      while (next.length < 6) next.push('');
      target.why[which] = next;
      filled += next.filter(Boolean).length;
    });

    // 특성요인도(6M) — AI가 낸 카테고리만 교체
    const fbIn = (!allow || allow.fishbone) ? (result.fishbone || {}) : {};
    const fb = target.fishbone || (target.fishbone = { problem: '', cats: {} });
    if ((!allow || allow.fishbone) && !(fb.problem || '').trim()) {
      fb.problem = (fields.partName || '해당 부품') + ' ' + (fields.defectType || '불량') + ' 발생 원인 분석';
    }
    Store.FB_CATS.forEach(([key]) => {
      const list = Array.isArray(fbIn[key]) ? fbIn[key] : null;
      if (list) {
        const items = list
          .map((t) => (t == null ? '' : String(t).trim()))
          .filter(Boolean)
          .map((text) => ({ text, subs: [] }));
        if (items.length) {
          fb.cats[key] = items;
          filled += items.length;
        }
      } else if (!fb.cats[key]) {
        fb.cats[key] = [];
      }
    });

    if ((!allow || allow.regions) && global.Annotate && Annotate.importRegions) {
      filled += Annotate.importRegions(result.regions) || 0;
    }

    Store.touch();
    return filled;
  }

  function mount() {
    docEl = document.getElementById('reportDoc');
    progressEl = document.getElementById('d8Progress');
    const p = document.getElementById('printBtn');
    if (p) p.addEventListener('click', () => window.print());
  }

  global.Report = { mount, render, updateProgress, buildAutoDraft, applyAutoDraft, applyPhotoAnalysis, setLang, getLang };
})(window);
