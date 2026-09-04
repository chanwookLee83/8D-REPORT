/* ===== AI 사진 분석 (BYOK · Anthropic API 직접 호출) =====
 * 온라인 + 사용자 API 키가 있을 때만 동작. 키는 이 브라우저(localStorage)에만 저장되고
 * api.anthropic.com 으로만 전송된다. 오프라인/키 없음이면 기존 템플릿 자동작성(Report.applyAutoDraft)을 쓴다.
 */
(function (global) {
  const KEY_LS = 'qcr.anthropicKey.v1';
  const MODEL_LS = 'qcr.aiModel.v1';
  const EFFORT_LS = 'qcr.aiEffort.v1';
  const TWOSTAGE_LS = 'qcr.aiTwoStage.v1';
  const DEFAULT_MODEL = 'claude-opus-5'; // 콘솔에서 AI.setModel('claude-sonnet-5') 등으로 변경 가능
  const DEFAULT_EFFORT = 'high';
  const EFFORTS = ['medium', 'high', 'xhigh'];
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) {
    try { if (v && v.trim()) localStorage.setItem(k, v.trim()); else localStorage.removeItem(k); } catch (e) {}
  }

  function getKey() { return lsGet(KEY_LS); }
  function setKey(v) { lsSet(KEY_LS, v); }
  function getModel() { return lsGet(MODEL_LS) || DEFAULT_MODEL; }
  function setModel(v) { lsSet(MODEL_LS, v); }
  function getEffort() { const v = lsGet(EFFORT_LS); return EFFORTS.indexOf(v) >= 0 ? v : DEFAULT_EFFORT; }
  function setEffort(v) { lsSet(EFFORT_LS, EFFORTS.indexOf(v) >= 0 ? v : ''); }
  function getTwoStage() { return lsGet(TWOSTAGE_LS) === '1'; }
  function setTwoStage(on) { lsSet(TWOSTAGE_LS, on ? '1' : ''); }
  function hasKey() { return !!getKey(); }
  function isOnline() { return navigator.onLine !== false; }
  function available() { return isOnline() && hasKey(); }

  function splitDataUrl(dataUrl) {
    const m = /^data:(image\/[a-zA-Z]+);base64,(.+)$/.exec(dataUrl || '');
    return m ? { media_type: m[1], data: m[2] } : null;
  }

  /* 사출·조립 부품 불량의 표준 원인 계통 — D4·5-Why를 공정 파라미터 수준으로 유도.
   * 사진·정보로 부품 유형(사출 성형품 / 조립품)을 판단해 해당 계통으로 전개한다. */
  const DOMAIN = [
    '## 불량 표준 원인 계통 (D4·5-Why 작성 근거) — "발생 원인 / 유출 원인" 순',
    '',
    '### A. 플라스틱 사출 성형 부품',
    '- 미성형(Short Shot): 발생=사출압/보압 부족, 수지 용융온도·금형온도 낮음, 충전속도 느림, 게이트/러너 과소·막힘, 벤트 불량(에어트랩), 재료 수분·유동성 저하, 계량 부족, 노즐 막힘 / 유출=미성형 판정 기준(한도견본) 미흡, 말단부·리브·보스 사각지대 미검, 샘플검사, 검사 조도 부족',
    '- 크랙/파손: 발생=취출 시 무리한 이젝션, 잔류응력·과보압, 냉각 부족, 재생재 과다로 취화, 조립 압입력 과다 / 유출=미세 크랙 육안 한계, 조립 후 발생분 미검출',
    '- 웰드라인/플로마크: 발생=유동 선단 합류부 온도 저하, 벤트 불량, 게이트 배치·수 / 유출=외관 등급·한도견본 모호',
    '- 싱크마크: 발생=보압 부족·시간 짧음, 두께 과대부 냉각 불균일, 금형온도 높음',
    '- 플래시(버): 발생=형체력 부족, 파팅면 마모·이물, 과사출, 수지온도 과다',
    '- 이물 혼입/흑점: 발생=호퍼·건조기 오염, 재생재 관리 미흡, 배럴 체류·탄화, 분진 / 유출=색상 대비 낮아 육안 한계',
    '- 변형/휨(Warpage): 발생=냉각 불균일, 잔류응력, 취출 후 방치·적재, 게이트 위치 / 유출=치수 게이지·검사구 미적용',
    '- 치수 불량: 발생=수축률 관리 미흡, 금형 마모, 성형조건(압력·온도·시간) 변동 / 유출=측정 주기·샘플 수 부족',
    '',
    '### B. 조립 부품 (압입·체결·용착·클립·커넥터·하네스)',
    '- 단자/터미널 휨·변형: 발생=압입 정렬 불량, 가이드·지그 마모, 삽입력 과다, 부품 형상 취약, 하네스 텐션 / 유출=조립 후 변형·삽입깊이 검사 항목 부재, 육안 한계',
    '- 미삽입·불완전 체결(하프 래치): 발생=삽입력 부족, 걸림음(클릭) 미확인, 커넥터 정렬 불량, 부품 간섭, 작업 순서 누락 / 유출=체결력·삽입깊이 측정 미실시, 팝업 게이지 미적용',
    '- 오조립·부품 누락·방향 오류: 발생=유사 부품 혼입, 식별 표시 부족, 지그 포카요케 부재, 작업표준 미준수 / 유출=최종 검사 항목 누락, 형상 유사로 육안 통과',
    '- 나사 체결 불량(토크 미달·과다·이중·미체결): 발생=드라이버 토크 세팅·검교정, 나사 착좌 불량, 크로스 스레드, 체결 카운트 관리 부재 / 유출=토크 이력 미기록, 체결 카운트 미검증',
    '- 압입 깊이·압입력 이상: 발생=프레스 스트로크·하중 설정, 압입 지그 마모, 부품 치수 산포, 윤활 조건 / 유출=압입 하중·변위 모니터링 미적용',
    '- 스냅핏·클립 파손·미체결: 발생=과도한 삽입각, 클립 치수·재질 산포, 취성(저온·재생재), 반복 체결 / 유출=체결 상태 촉감·인장 검사 부재',
    '- 용착(열·초음파·스핀) 불량: 발생=용착 에너지·시간·압력·홀드 설정, 혼(horn)·앤빌 마모, 접합면 이물·단차, 부스터 열화 / 유출=용착 강도(인장·기밀) 샘플링 부족, 비드 외관 판정 모호',
    '- 도통·접촉 불량(커넥터·단자): 발생=단자 삽입 불완전, 크림핑 압착고 불량, 산화·이물, 하우징 변형 / 유출=도통 검사·삽입력 시험 미실시',
    '- 이물·오염(그리스·칩·수분): 발생=지그·공구 관리, 세척 공정능력, 작업환경 분진, 취급 중 접촉 / 유출=청정도 기준·검사 방법 미정의',
    '- 외관 손상(스크래치·찍힘·크랙): 발생=취급·적재·이송 중 간섭, 지그 접촉면 보호 미흡, 공구 슬립 / 유출=한도견본 부재, 검사 조도·각도 기준 미흡',
    '- 조립체 치수·단차·유격 불량: 발생=부품 공차 누적, 조립 순서·기준면 관리, 클램프력 편차 / 유출=조립체 게이지·검사구 미적용',
  ].join('\n');

  const SYSTEM = [
    '당신은 자동차 사출·조립 부품 품질 엔지니어입니다. 불량 사진과 정보를 근거로 8D 대책서 전체(D0~D8)를 실제 제출용 문서로 작성합니다.',
    '먼저 부품 유형을 판단합니다: 플라스틱 사출 성형품인지, 조립품(압입·나사체결·용착·클립·커넥터·하네스)인지 사진·부품명·발생 공정으로 구분하고, 해당 계통(위 표준 원인 계통 A 또는 B)의 메커니즘으로만 원인·대책을 전개합니다.',
    '조립품이면 사출 파라미터(사출압·보압·수지온도)가 아니라 삽입력·체결 토크·압입 하중/변위·용착 에너지·정렬 지그·포카요케·도통/삽입깊이 검사 수준으로 구체화합니다. 사출품이면 성형 조건 수준으로 구체화합니다.',
    '문체: 실제 대책서에 그대로 들어갈 완결된 서술체. 각 항목은 이미 수행했거나 확정한 조치를 기술하듯 "~함", "~조치함", "~재설정함", "~로 확인됨" 같은 종결형 평서문으로 씁니다.',
    '금지: "~해야 합니다", "~하는 것이 좋습니다", "~할 필요가 있습니다", "다음과 같이 진행합니다" 등 지침서·설명서 말투. 절차를 나열하지 말고 결과·판단을 단정적으로 기술합니다.',
    '간결하게: 군더더기 없이 핵심만. 한 항목은 1~3문장. 전문 용어(공정 파라미터·검사 기준)를 정확히 사용합니다.',
    '검증 항목(d3_verify·d4_verify·d6_effect 등)은 "달성 여부 확인:" 으로 시작하고 판정 지표와 목표치를 제시합니다. 예: "달성 여부 확인: 봉쇄율 100%, 추가 유출 0건 (선별 기록 대조)".',
    '작업자가 입력한 "불량 유형"과 사진에 표기한 "표시 영역" 내용은 확정된 사실로 간주합니다. 사진 해상도가 낮아도 이 정보를 신뢰하고 해당 불량의 메커니즘에 근거해 원인·대책을 전개합니다.',
    '예1: 표시 영역에 "미성형"이 있으면 미성형(Short Shot)으로 확정하고, D4·5-Why·D5를 사출압·보압·수지온도·금형온도·게이트·벤트 수준으로 기술합니다.',
    '예2: 표시 영역에 "단자 휨" 또는 "커넥터 미체결"이 있으면 조립 불량으로 확정하고, D4·5-Why·D5를 삽입력·정렬 지그 마모·클릭음 확인·삽입깊이 게이지·포카요케 수준으로 기술합니다. "작업자 부주의" 같은 일반론은 금지.',
    '첨부 이미지는 [이미지 N] 라벨과 함께 전체 사진·표시영역 확대 크롭·참고 사진 순으로 제공됩니다. 확대 크롭에서 관찰되는 미세 현상(크랙 방향, 웰드라인, 압흔, 단차, 이물)을 우선 활용합니다.',
    '사진에서 관찰되는 사실과 표준 원인 계통에 근거한 추정을 구분하고, 추정에는 "~로 추정됨"을 붙입니다.',
    '날짜·수량·LOT번호·인명은 지어내지 말고 해당 자리에 "[확인]" 을 넣어 미확정 값임을 표시합니다. 예: "격리 수량 [확인] EA".',
    '출력은 지정된 형태의 JSON 객체 하나만. 마크다운 코드펜스나 설명 문장을 붙이지 마세요. 모든 문자열 값은 한국어.',
  ].join(' ');

  const SHAPE_HINT = {
    defect_summary: '사진과 표시 영역으로 확인되는 불량 요약 (1~2문장)',
    defect_type_guess: '불량 유형 (입력값/표시가 있으면 그대로. 예: 미성형(Short Shot))',
    confidence: 'high | medium | low',
    regions: [{ box: [0.12, 0.34, 0.2, 0.15], note: '해당 영역의 불량 내용(현상/부위)' }],
    fields: {
      defectType: '불량 유형',
      defectDesc: '불량 현상 상세 (부위·범위·정도)',
      d0_symptom: 'D0 증상 인식 / 초기 상황 (관찰 사실 위주로 간결하게)',
      d0_era: 'D0 비상 대응 조치 — 시행한 불량품 격리·재고 홀드·출하 정지·대상 LOT 선별·고객 통보를 단정적으로 기술',
      d2_what: 'D2 What — 무엇이 (부품·현상)',
      d2_where: 'D2 Where — 어디서 (부위/게이트 반대편·말단부 등)',
      d2_when: 'D2 When — 언제 (미확정이면 "[확인]")',
      d2_who: 'D2 Who — 누가 발견 (미확정이면 "[확인]")',
      d2_how: 'D2 How — 검출 방법 / 판정 기준',
      d2_howmany: 'D2 How many — 규모/추세 (수량 미확정이면 "[확인]")',
      d2_why: 'D2 Why — 왜 문제인가 (기능/조립/외관 영향)',
      d2_is: 'D2 IS — 발생한다 (조건)',
      d2_isnot: 'D2 IS NOT — 발생하지 않는다 (대비 조건)',
      d3_action: 'D3 봉쇄(임시) 조치 — 시행한 전수 선별·재검사 범위, 대상 LOT, 격리 방법을 단정적으로 기술',
      d3_result: 'D3 선별 결과 (검사 수량·불량 수량, 미확정이면 "[확인]")',
      d3_verify: 'D3 유효성 검증 — "달성 여부 확인:" + 봉쇄율 %·추가 유출 건수 등 판정 지표',
      d4_occur: 'D4 발생 원인 — 공정 파라미터 수준으로 단정',
      d4_escape: 'D4 유출 원인 — 검사 체계의 공백',
      d4_verify: 'D4 원인 검증 — "달성 여부 확인:" + 재현시험 결과·성형조건 로그 대조 등 검증 근거',
      d5_occur: 'D5 발생 방지(영구) 대책 — 재설정한 공정 조건·표준·설비 조치',
      d5_escape: 'D5 유출 방지(영구) 대책 — 개정한 검사기준·계측기·샘플링·Poka-Yoke',
      d5_risk: 'D5 부작용 / 위험성 검토 (사이클타임, 생산성, 작업자 적응 등)',
      d5_basis: 'D5 대책 선정 근거 (대안 비교 결과)',
      d6_effect: 'D6 효과 검증 — "달성 여부 확인:" + 시정 전/후 불량률 비교·목표치 대비 판정',
      d7_lesson: 'D7 수평 전개 (유사 부품·공정·타 라인 반영)',
      d7_std: 'D7 표준화 / 교육 (작업표준서·검사기준서·PFMEA·관리계획서 반영 내용)',
      d8_closing: 'D8 종결 코멘트 / 팀 노고 치하',
    },
    why: {
      occur: ['Why1', 'Why2', 'Why3', 'Why4', 'Why5', '근본원인(검증 대상)'],
      escape: ['Why1', 'Why2', 'Why3', 'Why4', 'Why5', '근본원인(검증 대상)'],
    },
    d6_actions: [
      {
        type: 'TRC | MRC (기술적/관리적 시정조치)',
        area: '발생 | 유출',
        action: 'D5 대책을 실행 단위로 나눈 시정 조치 (종결형 평서문)',
        owner: '담당 (인명 미확정이면 [확인])',
        due: '완료 예정일 ([확인])',
        done: '완료일 ([확인])',
        result: '검증 결과 — "달성 여부 확인:" + 지표',
      },
    ],
    fishbone: {
      man: ['원인', '원인'],
      machine: ['원인', '원인'],
      material: ['원인', '원인'],
      method: ['원인', '원인'],
      measure: ['원인', '원인'],
      env: ['원인', '원인'],
    },
    notes: '분석 한계 / 실측·성형조건 데이터로 확인이 필요한 사항 (간결한 목록형)',
  };

  /* AI가 작성할 수 있는 구획 — 사용자가 개별 선택 */
  const SECTIONS = {
    overview: { label: '불량 개요 (유형·현상·표시영역)', fields: ['defectType', 'defectDesc'], regions: true },
    d0: { label: 'D0 비상 대응', fields: ['d0_symptom', 'd0_era'] },
    d2: { label: 'D2 문제 정의 (5W2H·IS/IS NOT)', fields: ['d2_what', 'd2_where', 'd2_when', 'd2_who', 'd2_how', 'd2_howmany', 'd2_why', 'd2_is', 'd2_isnot'] },
    d3: { label: 'D3 봉쇄(임시) 조치', fields: ['d3_action', 'd3_result', 'd3_verify'] },
    d4: { label: 'D4 근본 원인 + 5-Why', fields: ['d4_occur', 'd4_escape', 'd4_verify'], why: true },
    d5: { label: 'D5 영구 시정 대책', fields: ['d5_occur', 'd5_escape', 'd5_risk', 'd5_basis'] },
    d6: { label: 'D6 시정 조치 실행·검증 (조치 표 + 효과 검증)', fields: ['d6_effect'], d6actions: true },
    d7: { label: 'D7 표준화·수평 전개', fields: ['d7_lesson', 'd7_std'] },
    d8: { label: 'D8 종결', fields: ['d8_closing'] },
    fishbone: { label: '특성요인도 (6M)', fishbone: true },
  };
  const SECTION_ORDER = ['overview', 'd0', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'fishbone'];

  function normScope(scope) {
    const valid = (Array.isArray(scope) ? scope : []).filter((s) => SECTIONS[s]);
    return valid.length ? valid : SECTION_ORDER.slice();
  }

  /* 선택된 구획만 담은 출력 형태 힌트 */
  function shapeForScope(scope) {
    const set = new Set(normScope(scope));
    const out = {
      defect_summary: SHAPE_HINT.defect_summary,
      defect_type_guess: SHAPE_HINT.defect_type_guess,
      confidence: SHAPE_HINT.confidence,
    };
    if (set.has('overview')) out.regions = SHAPE_HINT.regions;
    const fields = {};
    SECTION_ORDER.forEach((s) => {
      if (!set.has(s)) return;
      (SECTIONS[s].fields || []).forEach((k) => { if (SHAPE_HINT.fields[k]) fields[k] = SHAPE_HINT.fields[k]; });
    });
    if (Object.keys(fields).length) out.fields = fields;
    if (set.has('d4')) out.why = SHAPE_HINT.why;
    if (set.has('d6')) out.d6_actions = SHAPE_HINT.d6_actions;
    if (set.has('fishbone')) out.fishbone = SHAPE_HINT.fishbone;
    out.notes = SHAPE_HINT.notes;
    return out;
  }

  /* Report.applyPhotoAnalysis 용 필터: 어떤 키/채널을 반영할지 */
  function scopeFilter(scope) {
    const set = new Set(normScope(scope));
    const fields = new Set();
    SECTION_ORDER.forEach((s) => {
      if (!set.has(s)) return;
      (SECTIONS[s].fields || []).forEach((k) => fields.add(k));
    });
    return {
      fields: fields,
      why: set.has('d4'),
      fishbone: set.has('fishbone'),
      regions: set.has('overview'),
      overview: set.has('overview'),
      d6: set.has('d6'),
    };
  }

  function scopeLabels(scope) {
    return normScope(scope).map((s) => SECTIONS[s].label).join(', ');
  }

  function auxLines(fields) {
    return [
      ['부품 유형(지정)', fields.aux_partType],
      ['발생 추세', fields.aux_trend],
      ['금형·호기/캐비티·설비', fields.aux_equip],
      ['재료 등급·로트·색상', fields.aux_material],
      ['성형/조립 조건 실측', fields.aux_condition],
      ['최근 4M 변경점', fields.aux_change],
      ['유사 과거 이력·재발 여부', fields.aux_history],
      ['기타 특이사항', fields.aux_extra],
      ['되묻기 답변', fields.aux_answers],
    ]
      .filter(([, v]) => (v == null ? '' : String(v)).trim())
      .map(([k, v]) => '- ' + k + ': ' + String(v).trim())
      .join('\n');
  }

  function buildPrompt(fields, markers, imgCount, observations, scope) {
    const sc = normScope(scope);
    const partial = sc.length < SECTION_ORDER.length;
    const ctx = [
      ['고객사', fields.customer],
      ['부품명', fields.partName],
      ['P/N', fields.partNo],
      ['불량 유형(입력값)', fields.defectType],
      ['발생 공정', fields.defectProcess],
      ['불량 현상 상세(입력값)', fields.defectDesc],
    ]
      .filter(([, v]) => (v == null ? '' : String(v)).trim())
      .map(([k, v]) => '- ' + k + ': ' + v)
      .join('\n') || '- (기본 정보 미입력)';

    const mk = (markers && markers.length)
      ? markers.map((m) => '- ' + m.n + '번: ' + (m.note || '(내용 미기재)')).join('\n')
      : '- (표시 영역 없음)';

    const aux = auxLines(fields);

    return [
      '## 기본 정보',
      ctx,
      '',
      '## 표시 영역 — 작업자가 사진에 직접 표기 (확정 사실)',
      mk,
      '',
    ].concat(
      aux ? ['## 보조 정보 — 작성자 제공 (사실로 신뢰. 근본원인·대책을 이 값에 맞춰 구체화)', aux, ''] : []
    ).concat(
      observations && observations.trim()
        ? ['## 1차 비전 관찰 결과 (동일 사진을 먼저 관찰한 결과. 이 관찰 사실을 근거로 8D 전개)', observations.trim(), '']
        : []
    ).concat([
      DOMAIN,
      '',
      '## 요청',
      '첨부한 ' + (imgCount ? imgCount + '장의 ' : '') + '이미지(전체 사진의 빨간 박스·번호 = 위 표시 영역, 이어지는 확대 크롭은 각 표시 영역, 마지막 참고 사진)와 위 정보를 근거로, 실제 제출용 8D 대책서를 아래 형태의 JSON 객체 하나로 출력하세요.',
      partial
        ? '★ 이번 분석 대상 구획: ' + scopeLabels(sc) + '. 아래 JSON 형태에 있는 키만 작성하고, 그 외 항목은 JSON에서 완전히 생략하세요.'
        : '',
      JSON.stringify(shapeForScope(sc), null, 2),
      '',
      '- 먼저 부품 유형(사출 성형품 / 조립품)을 판정하고 그 계통으로 원인·대책을 전개합니다.',
      '- 위 JSON 형태에 포함된 fields 항목만 채우되, 설명서·지침 말투("~해야 합니다")가 아니라 이미 수행·확정한 조치를 기술하는 종결형 평서문("~함", "~재설정함", "~로 확인됨")으로 씁니다.',
      '- 각 항목 1~3문장, 군더더기 없이 간결하게. 원인·대책은 공정 파라미터·검사 기준 수준으로 단정합니다.',
      '- 검증 항목(d3_verify·d4_verify·d6_effect)은 "달성 여부 확인:" 으로 시작하고 판정 지표·목표치를 제시합니다.',
      '- 불량 유형 입력값 또는 표시 영역 내용이 있으면 그것을 확정으로 삼고 원인·대책을 전개합니다.',
      sc.indexOf('d4') >= 0 ? '- why.occur / why.escape 는 각 6개 항목(Why1~5 + 근본원인). 앞 단계의 답이 다음 "왜?"의 전제가 되도록 인과로 연결합니다.' : '',
      sc.indexOf('d6') >= 0 ? '- d6_actions 는 D5 대책을 실행 단위로 나눈 배열(보통 3~6개). 각 항목: type 은 "TRC"(설비·금형·공정조건·Poka-Yoke 등 기술적) 또는 "MRC"(표준서 개정·교육·전담자 지정 등 관리적), area 는 "발생" 또는 "유출", action 은 종결형 평서문, owner·due·done 은 미확정이면 "[확인]", result 는 "달성 여부 확인:" 형식. 발생·유출 각각 최소 1개씩 포함.' : '',
      sc.indexOf('fishbone') >= 0 ? '- fishbone 은 6M(man·machine·material·method·measure·env) 카테고리별 원인 2~4개.' : '',
      sc.indexOf('overview') >= 0 ? '- regions.box 는 좌상단 (0,0) ~ 우하단 (1,1) 정규화 [x, y, w, h]. 표시 영역이 이미 있거나 표시할 것이 없으면 빈 배열.' : '',
      '- 날짜·수량·LOT·인명은 지어내지 말고 해당 자리에 "[확인]" 표기.',
    ]).join('\n');
  }

  function extractJSON(text) {
    let t = (text || '').trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s === -1 || e === -1 || e < s) throw new Error('응답에서 JSON을 찾지 못했습니다.');
    return JSON.parse(t.slice(s, e + 1));
  }

  function imageBlock(dataUrl) {
    const im = splitDataUrl(dataUrl);
    return im ? { type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } } : null;
  }

  /* images: [{label, dataUrl}, ...] 또는 하위호환용 단일 dataURL 문자열 → 라벨+이미지 블록 배열 */
  function buildImageContent(images) {
    const list = Array.isArray(images) ? images : [{ label: '전체 불량 사진', dataUrl: images }];
    const content = [];
    let imgCount = 0;
    list.forEach((it) => {
      const block = imageBlock(it && it.dataUrl);
      if (!block) return;
      imgCount++;
      content.push({ type: 'text', text: '[이미지 ' + imgCount + '] ' + (it.label || '사진') });
      content.push(block);
    });
    return { content: content, imgCount: imgCount };
  }

  /* 저수준: 한 번의 messages 요청을 스트리밍으로 보내고 누적 텍스트를 돌려준다.
   * (thinking_delta 는 무시하고 text_delta 만 누적) */
  async function streamMessages(userContent, sysPrompt, maxTokens) {
    const key = getKey();
    if (!key) throw new Error('API 키가 설정되지 않았습니다.');
    const body = {
      model: getModel(),
      max_tokens: maxTokens || 32000,
      stream: true,
      system: sysPrompt,
      thinking: { type: 'adaptive' },
      output_config: { effort: getEffort() },
      messages: [{ role: 'user', content: userContent }],
    };

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('네트워크 오류: ' + (e && e.message ? e.message : e));
    }

    if (!res.ok) {
      let raw = '';
      try { raw = await res.text(); } catch (e) {}
      let msg = '';
      try { msg = (JSON.parse(raw).error || {}).message || ''; } catch (e) {}
      if (res.status === 401) msg = 'API 키가 올바르지 않습니다.';
      throw new Error('API 오류 (' + res.status + ')' + (msg ? ': ' + msg : ''));
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', stopReason = null, usage = null, model = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let ev;
        try { ev = JSON.parse(payload); } catch (e) { continue; }
        if (ev.type === 'error') throw new Error('스트림 오류: ' + ((ev.error || {}).message || ''));
        if (ev.type === 'message_start') model = (ev.message || {}).model || null;
        else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') text += ev.delta.text;
        else if (ev.type === 'message_delta') {
          if (ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
          if (ev.usage) usage = ev.usage;
        }
      }
    }

    if (stopReason === 'refusal') throw new Error('모델이 응답을 거부했습니다.');
    if (!text.trim()) throw new Error('응답에 텍스트가 없습니다.');
    return { text: text, stopReason: stopReason, usage: usage, model: model };
  }

  /* ── 1차: 비전 관찰만 (8D 전개 없이 사진에서 보이는 사실만) ── */
  const OBSERVE_SYSTEM =
    '당신은 자동차 사출·조립 부품 품질 엔지니어입니다. 지금은 원인 분석·대책을 하지 않고, 첨부 사진에서 관찰되는 사실만 정리합니다. ' +
    '전체 사진과 표시 영역 확대 크롭을 모두 살펴, 불량의 형태·위치·방향·크기·표면 상태·주변 형상(게이트/파팅라인/리브/체결부/단자 등)과의 관계를 구체적으로 기술합니다. ' +
    '추정에는 "~로 추정됨"을 붙이고, 확실하지 않으면 불확실하다고 적습니다. 8D 항목·대책·일반론은 쓰지 마세요. 한국어 불릿 목록으로만.';

  function observePrompt(fields, markers, imgCount) {
    const mk = (markers && markers.length)
      ? markers.map((m) => '- ' + m.n + '번: ' + (m.note || '(내용 미기재)')).join('\n')
      : '- (표시 영역 없음)';
    return [
      '## 정보',
      '- 부품명: ' + (fields.partName || '(미입력)'),
      '- 불량 유형(입력값): ' + (fields.defectType || '(미입력)'),
      '- 발생 공정: ' + (fields.defectProcess || '(미입력)'),
      '',
      '## 표시 영역 (작업자 표기)',
      mk,
      '',
      '## 요청',
      '첨부한 ' + imgCount + '장의 이미지를 관찰해, 다음을 불릿으로 정리하세요. (8D·대책 금지)',
      '- 부품 유형 판단: 사출 성형품 / 조립품 / 복합 중 무엇으로 보이는지와 근거',
      '- 표시 영역별 관찰: 불량 형태(크랙·변형·미성형·이물·버·단차 등), 위치·방향·범위, 표면 상태',
      '- 주변 형상과의 관계 (게이트/웰드라인/파팅면/리브/보스/체결부/단자/커넥터 등)',
      '- 사진으로는 알 수 없어 실측·이력 확인이 필요한 항목',
    ].join('\n');
  }

  /* ── 되묻기: 근본원인 확정에 필요한 질문 3~6개 ── */
  const QUESTION_SYSTEM =
    '당신은 자동차 사출·조립 부품 품질 엔지니어입니다. 첨부 사진과 정보를 보고, 근본원인(D4)·재발방지(D5)를 정확히 확정하기 위해 ' +
    '작성자에게 물어야 할 핵심 질문만 3~6개 뽑습니다. 사진·입력값으로 이미 알 수 있는 것은 묻지 않습니다. ' +
    '각 질문은 한 문장, 구체적으로 (예: "3호기 성형조건 중 최근 변경된 항목과 변경 전후 값은?"). ' +
    'JSON 객체 하나만 출력: {"questions": ["...", "..."]}. 다른 텍스트·코드펜스 금지.';

  function parseQuestions(text) {
    const obj = extractJSON(text);
    const arr = obj && Array.isArray(obj.questions) ? obj.questions : [];
    return arr.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 8);
  }

  function questionPrompt(fields, markers, imgCount) {
    const mk = (markers && markers.length)
      ? markers.map((m) => '- ' + m.n + '번: ' + (m.note || '(내용 미기재)')).join('\n')
      : '- (표시 영역 없음)';
    const aux = auxLines(fields);
    return [
      '## 정보',
      '- 부품명: ' + (fields.partName || '(미입력)'),
      '- 불량 유형(입력값): ' + (fields.defectType || '(미입력)'),
      '- 발생 공정: ' + (fields.defectProcess || '(미입력)'),
      '- 불량 현상 상세: ' + (fields.defectDesc || '(미입력)'),
      '',
      '## 표시 영역 (작업자 표기)',
      mk,
      '',
      aux ? '## 이미 제공된 보조 정보 (이 내용은 다시 묻지 마세요)\n' + aux + '\n' : '',
      '## 요청',
      '첨부한 ' + imgCount + '장의 이미지와 위 정보를 보고, 근본원인(D4)·재발방지(D5)를 정확히 확정하기 위해 작성자에게 물어야 할 핵심 질문만 3~6개 뽑아 JSON 으로 출력하세요: {"questions": ["...", "..."]}',
    ].join('\n');
  }

  /* 근본원인 확정에 필요한 질문 목록을 받아온다 */
  async function askQuestions(images, fields, markers) {
    if (!isOnline()) throw new Error('오프라인 상태입니다. 온라인에서 다시 시도하세요.');
    const built = buildImageContent(images);
    if (!built.imgCount) throw new Error('불량 사진을 먼저 업로드하세요.');
    const content = built.content.concat([
      { type: 'text', text: questionPrompt(fields || {}, markers || [], built.imgCount) },
    ]);
    const out = await streamMessages(content, QUESTION_SYSTEM, 4000);
    return { questions: parseQuestions(out.text), usage: out.usage, model: out.model };
  }

  /* ── 항목 단위 보강 (작성자 초안 기반) ──
   * D4 발생/유출 원인 → 5-Why 전개, D5 각 대책 → 문장 보강 */
  const ASSIST = {
    why_occur: {
      base: 'd4_occur', shape: 'why',
      instr: '작성자의 "발생 원인" 초안을 출발점으로 발생 원인의 5-Why를 전개하세요. why 배열은 정확히 6개(Why1~Why5 + 근본원인). '
        + '앞 항목의 답이 다음 "왜?"의 전제가 되도록 인과로 연결하고, 마지막은 검증 가능한 근본원인. '
        + '사출품이면 성형 조건(사출압·보압·수지온도·금형온도·게이트·벤트), 조립품이면 삽입력·체결 토크·압입 하중/변위·정렬 지그·검사 수준까지 내려갈 것. '
        + '초안이 비어 있으면 사진·불량 유형·표시 영역·보조 정보를 근거로 새로 작성.',
    },
    why_escape: {
      base: 'd4_escape', shape: 'why',
      instr: '작성자의 "유출 원인" 초안을 출발점으로 유출(검출 실패) 원인의 5-Why를 전개하세요. why 배열은 정확히 6개. '
        + '검사 기준·판정 기준·계측기·샘플링·검사 항목·검사 조도/시점의 공백 관점으로 인과 연결. 마지막은 검증 가능한 근본원인.',
    },
    d5_occur: {
      base: 'd5_occur', shape: 'text',
      instr: '발생 방지(영구) 대책을 작성자 초안 기반으로 보강. 재설정한 공정/조립 조건·표준화·설비 조치를 종결형 평서문 1~3문장으로 단정.',
    },
    d5_escape: {
      base: 'd5_escape', shape: 'text',
      instr: '유출 방지(영구) 대책을 작성자 초안 기반으로 보강. 개정한 검사 기준·계측기·샘플링·Poka-Yoke를 1~3문장으로 단정.',
    },
    d5_risk: {
      base: 'd5_risk', shape: 'text',
      instr: '부작용/위험성 검토. 위 대책 시행 시 사이클타임·생산성·작업자 적응·타 특성 영향 등의 위험과 통제 방안을 1~2문장.',
    },
    d5_basis: {
      base: 'd5_basis', shape: 'text',
      instr: '대책 선정 근거. 검토한 대안과, 현장 적용성·효율성·검증 가능성 관점의 비교 결과를 1~2문장.',
    },
    fishbone: {
      shape: 'fishbone',
      instr: '작성자가 편집 중인 6M(man·machine·material·method·measure·env) 특성요인도를 보강합니다. '
        + '① 기존에 입력된 원인은 표현만 다듬어 유지하고, 그 하위원인(subs)도 그대로 둡니다. '
        + '② 부품 유형(사출/조립) 계통과 사진·표시 영역·보조 정보에 근거해 누락된 핵심 원인을 카테고리별 2~4개가 되도록 채웁니다. '
        + '③ 각 원인은 공정 파라미터·설비·검사 기준 수준의 구체적 명사구(한 줄). "작업자 부주의" 같은 일반론 금지. '
        + '④ 근거가 없는 카테고리는 비워도 됩니다.',
    },
  };

  const ASSIST_SYSTEM =
    '당신은 자동차 사출·조립 부품 품질 엔지니어입니다. 작성자가 쓴 8D 초안 중 지정된 한 항목만 보강합니다. '
    + '작성자의 초안 의도를 유지하면서 부품 유형(사출/조립) 계통의 메커니즘으로 구체화합니다. '
    + '문체는 실제 대책서에 그대로 들어갈 종결형 평서문("~함", "~재설정함", "~로 확인됨"). "~해야 합니다"류 지침 말투 금지. '
    + '지어낸 날짜·수량·LOT·인명은 "[확인]"으로 표기. 출력은 지정된 JSON 객체 하나만, 코드펜스 금지, 값은 한국어.';

  function assistPrompt(kind, fields, why, markers, fishbone) {
    const cfg = ASSIST[kind];
    const mk = (markers && markers.length)
      ? markers.map((m) => '- ' + m.n + '번: ' + (m.note || '(내용 미기재)')).join('\n')
      : '- (표시 영역 없음)';
    const aux = auxLines(fields);
    const cur = [
      ['D2 What', fields.d2_what],
      ['D4 발생 원인', fields.d4_occur],
      ['D4 유출 원인', fields.d4_escape],
      ['5-Why(발생) 현재', ((why && why.occur) || []).filter(Boolean).join(' → ')],
      ['5-Why(유출) 현재', ((why && why.escape) || []).filter(Boolean).join(' → ')],
      ['D5 발생 방지 대책', fields.d5_occur],
      ['D5 유출 방지 대책', fields.d5_escape],
      ['D5 부작용/위험성', fields.d5_risk],
      ['D5 선정 근거', fields.d5_basis],
    ]
      .filter(([, v]) => (v == null ? '' : String(v)).trim())
      .map(([k, v]) => '- ' + k + ': ' + String(v).trim())
      .join('\n') || '- (아직 작성된 항목 없음)';
    const shapeHint = cfg.shape === 'why'
      ? '{"why": ["Why1", "Why2", "Why3", "Why4", "Why5", "근본원인(검증 대상)"]}'
      : cfg.shape === 'fishbone'
        ? '{"fishbone": {"man": [{"text": "원인", "subs": ["하위원인"]}], "machine": [], "material": [], "method": [], "measure": [], "env": []}}'
        : '{"text": "..."}';

    let baseBlock;
    if (cfg.shape === 'fishbone') {
      const fbc = (fishbone && fishbone.cats) || {};
      const lines = ['man', 'machine', 'material', 'method', 'measure', 'env'].map((k) => {
        const list = (fbc[k] || []).filter((c) => (c.text || '').trim() || (c.subs || []).some(Boolean));
        if (!list.length) return '- ' + k + ': (비어 있음)';
        return '- ' + k + ': ' + list.map((c) => (c.text || '').trim() + ((c.subs || []).filter(Boolean).length ? ' [하위: ' + c.subs.filter(Boolean).join(', ') + ']' : '')).join(' / ');
      });
      baseBlock = ['## 현재 특성요인도(6M) 편집 내용 (이 내용을 유지·보강)',
        '문제(특성): ' + ((fishbone && fishbone.problem) || '(미입력)'), lines.join('\n')].join('\n');
    } else {
      const baseText = (fields[cfg.base] || '').trim();
      baseBlock = '## 작성자 초안 — 이번에 보강할 항목: ' + kind + '\n' + (baseText || '(비어 있음 — 위 근거로 새로 작성)');
    }

    return [
      '## 기본 정보',
      '- 부품명: ' + (fields.partName || '(미입력)'),
      '- 불량 유형(입력값): ' + (fields.defectType || '(미입력)'),
      '- 발생 공정: ' + (fields.defectProcess || '(미입력)'),
      '- 불량 현상 상세: ' + (fields.defectDesc || '(미입력)'),
      '',
      '## 표시 영역 (작업자 표기)',
      mk,
      '',
    ].concat(aux ? ['## 보조 정보 (작성자 제공 · 사실로 신뢰)', aux, ''] : []).concat([
      '## 현재 8D 작성 상태 (참고)',
      cur,
      '',
      baseBlock,
      '',
      DOMAIN,
      '',
      '## 요청',
      cfg.instr,
      '아래 JSON 객체 하나만 출력하세요: ' + shapeHint,
    ]).join('\n');
  }

  /* kind: why_occur|why_escape|d5_occur|d5_escape|d5_risk|d5_basis|fishbone
   * opts: { fields, why, markers, images, fishbone } → {why:[6]} | {text} | {fishbone:{man:[{text,subs}]...}} */
  async function assist(kind, opts) {
    if (!isOnline()) throw new Error('오프라인 상태입니다. 온라인에서 다시 시도하세요.');
    if (!getKey()) throw new Error('API 키가 설정되지 않았습니다.');
    if (!ASSIST[kind]) throw new Error('알 수 없는 보강 항목: ' + kind);
    opts = opts || {};
    const f = opts.fields || {};
    const why = opts.why || { occur: [], escape: [] };
    const built = buildImageContent(opts.images || []);
    const content = built.content.concat([
      { type: 'text', text: assistPrompt(kind, f, why, opts.markers || [], opts.fishbone) },
    ]);
    const out = await streamMessages(content, ASSIST_SYSTEM, 8000);
    const obj = extractJSON(out.text);
    const shape = ASSIST[kind].shape;
    if (shape === 'why') {
      let arr = obj && Array.isArray(obj.why) ? obj.why.map((x) => String(x == null ? '' : x).trim()) : [];
      arr = arr.slice(0, 6);
      while (arr.length < 6) arr.push('');
      return { why: arr, usage: out.usage, model: out.model };
    }
    if (shape === 'fishbone') {
      const fb = (obj && obj.fishbone) || {};
      const out6 = {};
      ['man', 'machine', 'material', 'method', 'measure', 'env'].forEach((k) => {
        const list = Array.isArray(fb[k]) ? fb[k] : [];
        out6[k] = list.map((c) => {
          if (typeof c === 'string') return { text: c.trim(), subs: [] };
          return {
            text: String((c && c.text) || '').trim(),
            subs: (c && Array.isArray(c.subs) ? c.subs : []).map((s) => String(s || '').trim()).filter(Boolean),
          };
        }).filter((c) => c.text);
      });
      return { fishbone: out6, usage: out.usage, model: out.model };
    }
    return { text: obj && obj.text != null ? String(obj.text).trim() : '', usage: out.usage, model: out.model };
  }

  /* ── 대책서 내용 영문 번역 ── */
  const TRANSLATE_SYSTEM =
    '당신은 자동차 품질 8D 대책서 전문 번역가입니다. 한국어 대책서 내용을 고객 제출용 전문 영문으로 번역합니다. '
    + '자동차 8D / CAR 표준 용어를 사용하고, 종결형 평서문을 유지합니다("was reset to...", "confirmed", "100% containment applied"). '
    + '"[확인]"은 "[TBD]"로 옮기고, 수치·단위·기호·P/N·LOT·차종 코드는 그대로 둡니다. '
    + '인명은 국립국어원 로마자 표기법으로 옮깁니다(예: 이찬욱 → Lee Chan-wook, 이주형 → Lee Ju-hyung). '
    + '회사명·지명·설비명은 통용 영문 표기 또는 로마자로 옮기되 호기·라인 번호는 유지합니다(예: 5호기 → Unit 5, 팔탄 → Paltan, 유라 → Yura). '
    + '부서·직책은 영문으로 번역합니다(생산기술팀 → Production Engineering Team, 공정 엔지니어 → Process Engineer). '
    + '모든 값을 빠짐없이 번역하고, 입력 JSON과 완전히 동일한 키·배열 구조로 값만 영문으로 채운 JSON 객체 하나만 출력합니다. 코드펜스·설명 금지.';

  /* payload: { fields:{key:ko}, why:{occur:[],escape:[]},
   *            fishbone:{problem, cats:{man:[{text,subs:[]}]}}, d1:[{name,dept,role}], d6:[{action,owner,result}] } */
  async function translate(payload) {
    if (!isOnline()) throw new Error('오프라인 상태입니다. 온라인에서 다시 시도하세요.');
    if (!getKey()) throw new Error('API 키가 설정되지 않았습니다.');
    const text = [
      '## 번역할 8D 대책서 내용 (JSON)',
      JSON.stringify(payload, null, 1),
      '',
      '## 출력',
      '위와 동일한 키·배열 구조의 JSON 하나. 모든 값을 영문으로 (fields 의 회사·인명·설비·부서·역할 포함, 하나도 빠뜨리지 말 것).',
      'why.occur / why.escape 는 배열 길이(6)·순서 유지(빈 문자열도 그대로).',
      'fishbone.cats 각 원인은 {"text": "...", "subs": ["..."]} 형태·배열 길이·순서 유지.',
      'd1 은 [{"name","dept","role"}], d6 은 [{"action","owner","result"}] 배열 길이·순서 유지.',
    ].join('\n');
    const out = await streamMessages([{ type: 'text', text: text }], TRANSLATE_SYSTEM, 16000);
    return extractJSON(out.text);
  }

  /* images: [{label, dataUrl}, ...] 또는 단일 dataURL 문자열
   * opts: { twoStage:boolean, onStage:fn(label), scope:string[] } */
  async function analyze(images, fields, markers, opts) {
    if (!isOnline()) throw new Error('오프라인 상태입니다. 온라인에서 다시 시도하세요.');
    if (!getKey()) throw new Error('API 키가 설정되지 않았습니다.');
    opts = opts || {};
    const f = fields || {};
    const mk = markers || [];
    const scope = normScope(opts.scope);
    const built = buildImageContent(images);
    if (!built.imgCount) throw new Error('불량 사진을 먼저 업로드하세요.');

    const twoStage = opts.twoStage != null ? opts.twoStage : getTwoStage();
    let observations = '';
    if (twoStage) {
      if (opts.onStage) opts.onStage('1/2 사진 관찰 중…');
      const obs = await streamMessages(
        built.content.concat([{ type: 'text', text: observePrompt(f, mk, built.imgCount) }]),
        OBSERVE_SYSTEM,
        8000
      );
      observations = obs.text || '';
    }

    if (opts.onStage) opts.onStage(twoStage ? '2/2 8D 작성 중…' : '8D 작성 중…');
    const content = built.content.concat([
      { type: 'text', text: buildPrompt(f, mk, built.imgCount, observations, scope) },
    ]);
    const out = await streamMessages(content, SYSTEM, 32000);
    return { result: extractJSON(out.text), scope: scope, observations: observations, usage: out.usage, model: out.model };
  }

  global.AI = {
    hasKey, getKey, setKey, getModel, setModel, getEffort, setEffort, getTwoStage, setTwoStage,
    available, isOnline, analyze, askQuestions, assist, translate, scopeFilter, SECTIONS, SECTION_ORDER,
    EFFORTS, DEFAULT_MODEL, DEFAULT_EFFORT,
  };
})(window);
