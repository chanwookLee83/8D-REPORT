/* ===== 출력 문서 영문 사전 (고정 라벨·제목) =====
 * 자유 서술 내용은 AI.translate 로 번역해 report.i18n 에 캐시한다. */
(function (global) {
  const DICT = {
    // 문서 제목 / 헤더
    '품질 대책서 (8D Report)': '8D Corrective Action Report',
    '고객사': 'Customer',
    '부품명': 'Part Name',
    '불량 유형': 'Defect Type',

    // 섹션 태그 / 제목
    '개요': 'OVERVIEW',
    '문서 및 제품 정보': 'Document & Product Information',
    '불량 개요': 'Defect Overview',
    '불량 사진 및 표시 영역': 'Defect Photo & Marked Areas',
    '준비 & 비상 대응 조치 (ERA)': 'Preparation & Emergency Response Action (ERA)',
    '팀 구성': 'Team Formation',
    '문제 정의 (5W2H · IS / IS NOT)': 'Problem Definition (5W2H · IS / IS NOT)',
    '봉쇄(임시) 조치 — ICA': 'Interim Containment Action (ICA)',
    '근본 원인 분석 (Root Cause)': 'Root Cause Analysis',
    '영구 시정 조치 선정 (PCA)': 'Permanent Corrective Action (PCA)',
    '시정 조치 실행 & 검증': 'Corrective Action Implementation & Verification',
    '재발 방지 & 수평 전개': 'Prevention & Horizontal Deployment',
    '종결 & 팀 노고 치하': 'Closure & Team Recognition',

    // INFO / 제품
    '문서번호': 'Document No.',
    '개정(Rev.)': 'Revision',
    '작성일': 'Issue Date',
    '작성자 / 부서': 'Author / Dept.',
    '승인자': 'Approver',
    '고객 공장/라인': 'Customer Plant / Line',
    '부품명 / P/N': 'Part Name / P/N',
    '적용 차종': 'Vehicle Model',
    '협력사 / 공정': 'Supplier / Process',

    // 개요
    '불량 등급': 'Defect Grade',
    '발생 공정': 'Process of Occurrence',
    '수량 현황': 'Quantity Status',
    '납품 LOT / 생산일자': 'Delivery LOT / Production Date',
    '발생일 / 접수일': 'Occurrence Date / Receipt Date',
    '초도(D+3) / 최종 회신': 'Initial (D+3) / Final Reply',
    '불량 현상 상세': 'Defect Description (Detail)',
    '불량 수량': 'Defect Qty',
    '고객 재고': 'Customer Stock',
    '사내 재고': 'In-house Stock',
    '공정 재고(WIP)': 'WIP',

    // PHOTO
    'No': 'No',
    '표시 영역 불량 내용': 'Marked Area — Defect Description',
    '내용 미작성': 'not entered',

    // D0
    '증상 인식 / 초기 상황': 'Symptom Recognition / Initial Situation',
    '비상 대응 조치': 'Emergency Response Action',
    '조치일 / 담당': 'Action Date / Owner',
    'ERA 유효성': 'ERA Effectiveness',

    // D1
    '챔피언 / 후원자': 'Champion / Sponsor',
    '팀 리더': 'Team Leader',
    '이름': 'Name',
    '부서': 'Dept.',
    '역할 / 담당': 'Role / Responsibility',

    // D2
    '무엇이': 'What',
    '어디서 (부위/공정)': 'Where (area/process)',
    '언제': 'When',
    '누가 발견': 'Who detected',
    '검출 방법': 'How detected',
    '규모 / 추세': 'How many / trend',
    '왜 문제인가 · 고객 영향': 'Why it is a problem · Customer impact',
    'IS · 발생한다': 'IS · occurs',
    'IS NOT · 발생하지 않는다': 'IS NOT · does not occur',

    // D3
    '임시 조치 내용': 'Interim Action',
    '실시일 / 담당': 'Date / Owner',
    '선별 수량 / 결과': 'Sorted Qty / Result',
    '유효성 검증': 'Effectiveness Verification',

    // D4
    '발생 원인 (Occurrence)': 'Occurrence Cause',
    '유출 원인 (Detection)': 'Detection (Escape) Cause',
    '원인 검증 방법 / 근거': 'Cause Verification Method / Evidence',
    '5-Why — 발생 원인': '5-Why — Occurrence Cause',
    '5-Why — 유출 원인': '5-Why — Detection Cause',
    '특성요인도 (Fishbone)': 'Cause-and-Effect Diagram (Fishbone)',
    'Why 1': 'Why 1', 'Why 2': 'Why 2', 'Why 3': 'Why 3', 'Why 4': 'Why 4', 'Why 5': 'Why 5',
    '근본원인': 'Root Cause',

    // D5
    '발생 방지 대책': 'Occurrence Prevention',
    '유출 방지 대책': 'Detection (Escape) Prevention',
    '부작용 / 위험성 검토': 'Side-effect / Risk Review',
    '선정 근거 (대안 비교)': 'Selection Basis (Alternatives Compared)',

    // D6
    '조치 내용': 'Action',
    '담당': 'Owner',
    '완료예정': 'Due',
    '완료일': 'Done',
    '검증 결과': 'Verification Result',
    '양산 적용일 / LOT': 'Mass-production Date / LOT',
    '효과 검증 결과 (전/후)': 'Effectiveness Result (before/after)',

    // D7
    '개정 / 반영 문서': 'Revised / Reflected Documents',
    '수평 전개': 'Horizontal Deployment',
    '표준화 / 교육': 'Standardization / Training',
    '선택 항목 없음': 'none selected',
    'PFMEA 개정': 'PFMEA revised',
    '관리계획서(Control Plan) 개정': 'Control Plan revised',
    '작업표준서 개정': 'Work Instruction revised',
    '검사기준서 / 체크시트 개정': 'Inspection Standard / Check Sheet revised',
    '한도견본 재설정': 'Boundary Sample reset',
    'Poka-Yoke(방오화) 적용': 'Poka-Yoke applied',
    '작업자 교육 실시': 'Operator training conducted',
    '공정감사(LPA) 반영': 'Layered Process Audit (LPA) reflected',

    // D8
    '종결 코멘트 / 팀 노고': 'Closure Comment / Team Effort',
    '종결 승인자 / 종결일': 'Closure Approver / Closure Date',
    '고객 승인 여부': 'Customer Approval',

    // 짧은 enum 값
    '확인됨': 'Confirmed', '진행중': 'In progress', '승인': 'Approved', '미승인': 'Not approved',
    '미작성': 'not written',
    'Critical (안전/법규)': 'Critical (safety / regulation)',
    'Major (기능)': 'Major (function)',
    'Minor (외관)': 'Minor (appearance)',
  };

  function t(ko) {
    const k = (ko == null ? '' : String(ko)).trim();
    return DICT[k] || ko;
  }

  global.I18N = { t: t, DICT: DICT };
})(window);
