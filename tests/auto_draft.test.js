const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const store = {
  FB_CATS: [
    ['man', '사람 (Man)'],
    ['machine', '기계 (Machine)'],
    ['material', '재료 (Material)'],
    ['method', '방법 (Method)'],
    ['measure', '측정 (Measurement)'],
    ['env', '환경 (Environment)'],
  ],
  current() {
    return {
      fields: {
        customer: '테스트 고객사',
        partName: 'HEADER PIN ASSY',
        defectType: '단자 휨',
        defectProcess: '조립 공정',
        defectDesc: '단자 끝단이 접촉 시 마모되며 휨이 발생하고 좌측 선단 외관이 변형된다.',
        qtyDefect: '12',
        qtyCustomerStock: '35',
        qtyInHouseStock: '8',
        qtyWip: '4',
        author: '홍길동',
        d0_symptom: '',
        d0_era: '',
        d2_what: '',
        d2_where: '',
        d2_when: '',
        d2_who: '',
        d2_how: '',
        d2_howmany: '',
        d2_why: '',
        d2_is: '',
        d2_isnot: '',
      },
      photo: {
        shapes: [{ type: 'box', n: 1, note: '단자 끝단 접촉 부위 마모 및 좌측 선단 휨' }],
      },
      why: {
        occur: ['', '', '', '', '', ''],
        escape: ['', '', '', '', '', ''],
      },
      fishbone: {
        problem: '',
        cats: {
          man: [],
          machine: [],
          material: [],
          method: [],
          measure: [],
          env: [],
        },
      },
    };
  },
};

const context = {
  console,
  window: {},
  document: { getElementById() { return null; } },
  Store: store,
};
context.window = context;
context.global = context;

vm.runInNewContext(fs.readFileSync('js/report.js', 'utf8'), context);
const draft = context.Report.buildAutoDraft();

assert.match(draft.d2_howmany, /불량 수량|고객 재고|사내 재고|WIP/i, '규모/추세는 숫자 의미를 라벨과 함께 표시해야 한다');
assert.match(draft.d2_is, /1번 영역.*단자 휨|단자 휨.*1번 영역/i, '영역 설명은 말이 되도록 표현해야 한다');
assert.doesNotMatch(draft.d0_symptom, /휨가/, '주어 조사 결합은 자연스러운 문법이어야 한다');
assert.match(draft.d4_occur, /접촉|마모|휨|외관|변형/i, '불량 현상 상세를 반영한 원인 설명이 필요하다');
assert.ok(Array.isArray(draft.why.occur) && draft.why.occur.length >= 5, '5-Why 발생원인은 5개 이상이어야 한다');
assert.ok(Array.isArray(draft.why.escape) && draft.why.escape.length >= 5, '5-Why 유출원인은 5개 이상이어야 한다');

console.log('auto draft test passed');
