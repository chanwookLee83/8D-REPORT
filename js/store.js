/* ===== 저장소 (localStorage) & 상태 관리 ===== */
(function (global) {
  const KEY = 'qcr.reports.v1';
  const CUR = 'qcr.current.v1';

  const FB_CATS = [
    ['man', '사람 (Man)'],
    ['machine', '기계 (Machine)'],
    ['material', '재료 (Material)'],
    ['method', '방법 (Method)'],
    ['measure', '측정 (Measurement)'],
    ['env', '환경 (Environment)'],
  ];

  const D7_DOCS = [
    ['pfmea', 'PFMEA 개정'],
    ['controlPlan', '관리계획서(Control Plan) 개정'],
    ['workStd', '작업표준서 개정'],
    ['checkSheet', '검사기준서 / 체크시트 개정'],
    ['boundarySample', '한도견본 재설정'],
    ['poka', 'Poka-Yoke(방오화) 적용'],
    ['training', '작업자 교육 실시'],
    ['auditPlan', '공정감사(LPA) 반영'],
  ];

  function uid() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function todayISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function blankReport() {
    const fb = { problem: '', cats: {} };
    FB_CATS.forEach(([k]) => (fb.cats[k] = []));
    const d7 = {};
    D7_DOCS.forEach(([k]) => (d7[k] = false));
    return {
      id: uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fields: { writeDate: todayISO(), rev: '0' },
      photo: { base: '', shapes: [] },
      refPhotos: [],
      d1: [],
      d6: [],
      why: { occur: ['', '', '', '', '', ''], escape: ['', '', '', '', '', ''] },
      d7docs: d7,
      fishbone: fb,
    };
  }

  function loadAll() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  const Store = {
    FB_CATS,
    D7_DOCS,
    todayISO,
    _list: loadAll(),
    _curId: localStorage.getItem(CUR) || null,

    all() {
      return this._list.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    },

    current() {
      let r = this._list.find((x) => x.id === this._curId);
      if (!r) {
        if (this._list.length) {
          r = this._list[0];
        } else {
          r = blankReport();
          this._list.push(r);
        }
        this._curId = r.id;
        this._persist();
      }
      return r;
    },

    setCurrent(id) {
      this._curId = id;
      localStorage.setItem(CUR, id);
    },

    create() {
      const r = blankReport();
      this._list.push(r);
      this.setCurrent(r.id);
      this._persist();
      return r;
    },

    duplicate() {
      const src = this.current();
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = uid();
      copy.createdAt = copy.updatedAt = Date.now();
      copy.fields = Object.assign({}, copy.fields, {
        docNo: (copy.fields.docNo || '') + '-copy',
      });
      this._list.push(copy);
      this.setCurrent(copy.id);
      this._persist();
      return copy;
    },

    remove(id) {
      this._list = this._list.filter((x) => x.id !== id);
      if (this._curId === id) this._curId = this._list[0] ? this._list[0].id : null;
      this._persist();
    },

    touch() {
      const r = this.current();
      r.updatedAt = Date.now();
      this._persist();
    },

    _persist() {
      if (this._curId) localStorage.setItem(CUR, this._curId);
      if (!saveAll(this._list)) {
        global.dispatchEvent(new CustomEvent('qcr:quota'));
      }
    },

    title(r) {
      const f = r.fields || {};
      const t = [f.customer, f.partName, f.defectType].filter(Boolean).join(' · ');
      return t || '(제목 없음)';
    },

    exportJSON() {
      return JSON.stringify({ app: 'qcr', version: 1, exportedAt: Date.now(), reports: this._list }, null, 2);
    },

    importJSON(text) {
      const data = JSON.parse(text);
      const incoming = Array.isArray(data) ? data : data.reports;
      if (!Array.isArray(incoming)) throw new Error('형식이 올바르지 않습니다.');
      const ids = new Set(this._list.map((x) => x.id));
      incoming.forEach((r) => {
        if (!r.id || ids.has(r.id)) r.id = uid();
        r.updatedAt = r.updatedAt || Date.now();
        this._list.push(r);
      });
      this._persist();
      return incoming.length;
    },
  };

  global.Store = Store;
})(window);
