/* ==========================================================================
   404호 소각로 — 게임 엔진 (상태 관리 · 진행 · UI)
   window.GAME_DATA (또는 window.STORY_DATA) 를 읽어 화면을 구동한다.
   이 파일에는 스토리 문장을 넣지 않는다. 화면에 나오는 이야기 텍스트는 전부 데이터에서 온다.
   ========================================================================== */
(function () {
  'use strict';

  // ════════════════════════ 1. 유틸 ════════════════════════
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chars = (s) => Array.from(String(s == null ? '' : s));
  function hash(str) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; }
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const Sfx = window.Sfx || new Proxy({}, { get: () => () => {} });

  function mixHex(hex, withHex, t) {
    const p = (x) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(x || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    const a = p(hex), b = p(withHex);
    if (!a || !b) return withHex;
    return '#' + a.map((v, i) => Math.round(v * t + b[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  }

  // ════════════════════════ 2. 데이터 정규화 · 점검 ════════════════════════
  const WARN = [];
  const warned = new Set();
  function warn(msg) { if (warned.has(msg)) return; warned.add(msg); WARN.push(msg); console.warn('[GAME_DATA] ' + msg); }

  const DEFAULT_RULES = {
    requireGrade: true,
    gradeTable: [{ grade: 'S', min: 200 }, { grade: 'A', min: 120 }, { grade: 'B', min: 60 }, { grade: 'C', min: 0 }],
    hideSuspicion: 15,
    wrongGradeSuspicion: 5,
    quotaMissSuspicion: 20,
    maxSuspicion: 100,
    startSuspicion: 0,
    baseLight: 0.4,
    hideDarken: 0.05,
    hintSelfMemories: true
  };
  const KNOWN_EFFECTS = ['shake', 'glitch', 'flash', 'flicker', 'dark'];
  const MOOD_NAMES = (Sfx.MOOD_NAMES && Sfx.MOOD_NAMES.length) ? Sfx.MOOD_NAMES : ['office', 'calm', 'tense', 'dread', 'warm', 'sad', 'mystery', 'truth', 'climax', 'silence'];
  const SYSTEM_NAMES = ['시스템', 'SYSTEM', 'System', 'system'];

  const RAW = window.GAME_DATA || window.STORY_DATA || null;
  const MEM = {};      // id → memory
  const D = normalize(adaptData(RAW));
  const TOTAL_SELF = Object.values(MEM).filter((m) => m.isProtagonistMemory).length;
  const DATA_SIG = D.chapters.map((c) => c.id + ':' + c.seizedMemories.length).join('|');
  const rules = D.meta.rules;
  validate();

  /**
   * 호환 계층: 제미나이 v1 형식을 규격으로 옮긴다. 이미 규격대로인 데이터는 그대로 통과한다.
   *  - meta.protagonistId            → meta.protagonist
   *  - assets.portraits(그룹)        → characters[화자].portraits (대사 줄의 portrait 경로로 화자를 찾음)
   *  - endings.inputPrompt + 각 엔딩의 triggerKeywords → 마지막 챕터의 finale
   *  - notebook.linkedMemoryId       → 그 압류품이 나오는 날부터 수첩에 보임 (condition 이 없을 때)
   *  - 모든 압류품에 grade 가 적혀 있음 → 판독기가 등급을 자동 판정 (rules.requireGrade 기본 false)
   */
  function adaptData(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const d = Object.assign({}, raw);
    const m = Object.assign({}, d.meta || {});
    if (m.protagonistId != null && !m.protagonist) m.protagonist = { id: String(m.protagonistId), name: '#' + m.protagonistId };
    const chapters = arr(d.chapters).slice();
    const lines = [];
    const collect = (ls) => arr(ls).forEach((l) => { if (l && typeof l === 'object') lines.push(l); });
    chapters.forEach((c) => {
      if (!c) return;
      collect(c.dialogues); collect(c.outroDialogues);
      arr(c.events).forEach((ev) => collect(ev && ev.dialogues));
      arr(c.seizedMemories).forEach((mm) => { if (mm) { collect(mm.onBurn); collect(mm.onHide); } });
    });
    // 엔딩: 문자열 값(inputPrompt)은 엔딩이 아니다. triggerKeywords 는 최후의 타이핑 정답이 된다.
    let inputPrompt = null;
    const endings = {}, answers = [];
    Object.entries(d.endings && typeof d.endings === 'object' ? d.endings : {}).forEach(([k, v]) => {
      if (typeof v === 'string') { if (k === 'inputPrompt') inputPrompt = v; return; }
      endings[k] = v;
      arr(v).forEach((x) => {
        if (!x) return;
        collect(x.dialogues);
        if (Array.isArray(x.triggerKeywords) && x.triggerKeywords.length) answers.push({ match: x.triggerKeywords.slice(), ending: k });
      });
    });
    d.endings = endings;
    if (chapters.length && (answers.length || inputPrompt) && !chapters.some((c) => c && c.finale)) {
      const li = chapters.length - 1;
      chapters[li] = Object.assign({}, chapters[li], { finale: { prompt: inputPrompt || '', answers } });
    }
    // 초상화 그룹 → 화자
    const groups = (d.assets && d.assets.portraits) || {};
    const characters = Object.assign({}, d.characters || {});
    const palette = ['#c94a3a', '#8a8170', '#9fb7d9', '#b49a5f', '#7f9f86', '#a77fb5'];
    let pi = Object.keys(characters).length;
    lines.forEach((l) => {
      if (!l.speaker || SYSTEM_NAMES.includes(l.speaker)) return;
      let c = characters[l.speaker];
      if (!c) { c = characters[l.speaker] = { color: palette[pi++ % palette.length] }; }
      else characters[l.speaker] = c = Object.assign({}, c);
      if (l.portrait && (!c.portraits || !Object.keys(c.portraits).length)) {
        const g = Object.values(groups).find((grp) => grp && typeof grp === 'object' && Object.values(grp).includes(l.portrait));
        if (g) c.portraits = Object.assign({}, g);
      }
    });
    d.characters = characters;
    // 수첩: 연결된 압류품이 나오는 날부터
    const memDay = {};
    chapters.forEach((c, i) => arr(c && c.seizedMemories).forEach((mm) => { if (mm && mm.id) memDay[mm.id] = i + 1; }));
    d.notebook = arr(d.notebook).map((e) => {
      if (!e || typeof e !== 'object') return e;
      const x = Object.assign({}, e);
      const day = memDay[x.linkedMemoryId];
      if (x.linkedMemoryId && x.condition == null && day) { x.condition = 'day>=' + day; if (x.day == null) x.day = day; }
      return x;
    });
    // 등급
    const mems = [];
    chapters.forEach((c) => arr(c && c.seizedMemories).forEach((mm) => mems.push(mm)));
    m.rules = Object.assign({}, m.rules || {});
    if (m.rules.requireGrade == null && mems.length && mems.every((mm) => mm && mm.grade)) m.rules.requireGrade = false;
    d.meta = m;
    d.chapters = chapters;
    return d;
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') {
      warn('window.GAME_DATA 를 찾을 수 없습니다. data/story-data.js 가 엔진보다 먼저 로드되는지 확인하세요.');
      raw = { chapters: [] };
    }
    const m = raw.meta || {};
    const r = Object.assign({}, DEFAULT_RULES, m.rules || {});
    r.gradeTable = arr(r.gradeTable).length ? arr(r.gradeTable).slice().sort((a, b) => (b.min || 0) - (a.min || 0)) : DEFAULT_RULES.gradeTable;
    const protagonist = Object.assign({ id: '0404', name: '#0404' }, m.protagonist || {});
    const selfNames = new Set(['#' + protagonist.id, String(protagonist.id), protagonist.name, '나', '주인공'].concat(arr(protagonist.aliases)));
    const meta = {
      title: m.title || '404호 소각로',
      subtitle: m.subtitle || 'Incinerator No. 404',
      protagonist, selfNames, rules: r,
      systemNames: new Set(SYSTEM_NAMES.concat(arr(m.systemSpeakers))),
      gameOverEnding: m.gameOverEnding || null,
      defaultEnding: m.defaultEnding || null,
      manual: arr(m.manual)
    };

    const chapters = arr(raw.chapters).map((c, i) => {
      c = c || {};
      return {
        index: i,
        id: c.id || ('ch' + (i + 1)),
        title: c.title || ('제' + (i + 1) + '일차'),
        date: c.date || '',
        quota: Number(c.quota) || 0,
        background: c.background || null,
        bgmMood: c.bgmMood || null,
        dialogues: arr(c.dialogues),
        outroDialogues: arr(c.outroDialogues),
        events: arr(c.events),
        seizedMemories: arr(c.seizedMemories).map((mm, j) => normMem(mm, c, i, j)),
        finale: c.finale || null,
        next: c.next == null ? null : c.next,
        skipReport: !!c.skipReport
      };
    });

    const characters = {};
    Object.entries(raw.characters || {}).forEach(([k, v]) => {
      v = v || {};
      characters[k] = { displayName: v.displayName || v.name || k, color: v.color || '#8a8170', portraits: v.portraits || {} };
    });

    const notebook = arr(raw.notebook).map((e, i) => ({
      id: (e && e.id) || ('nb_' + (i + 1)),
      title: (e && e.title) || '',
      text: (e && e.text) || '',
      day: e && e.day != null ? e.day : null,
      condition: e && e.condition,
      erasedBy: arr(e && e.erasedBy),
      linkedMemoryId: (e && e.linkedMemoryId) || null,
      redactKeyword: (e && e.redactKeyword) || null
    }));
    // 기억 쪽에서 지정한 erasesNotebook 도 수첩 항목에 연결 ("all" 이면 수첩 전체)
    Object.values(MEM).forEach((mm) => {
      const list = mm.erasesNotebook === 'all' || arr(mm.erasesNotebook).includes('all') ? notebook.map((x) => x.id) : arr(mm.erasesNotebook);
      list.forEach((nid) => {
        const e = notebook.find((x) => x.id === nid);
        if (e) { if (!e.erasedBy.includes(mm.id)) e.erasedBy.push(mm.id); } else warn(`${mm.id}.erasesNotebook: 수첩 항목 "${nid}" 이 없습니다.`);
      });
    });

    const endings = {};
    Object.entries(raw.endings || {}).forEach(([k, v]) => { endings[k] = arr(v).map((x) => Object.assign({ title: '', epilogue: '', dialogues: [] }, x)); });

    return { meta, chapters, characters, notebook, endings };
  }

  function normMem(mm, c, ci, j) {
    mm = mm || {};
    const id = mm.id || (`${c.id || 'ch' + (ci + 1)}_mem${j + 1}`);
    if (!mm.id) warn(`${c.id || '챕터 ' + (ci + 1)}의 ${j + 1}번째 압류품에 id 가 없어 "${id}" 로 지정했습니다.`);
    if (MEM[id]) warn(`압류품 id 중복: "${id}"`);
    const out = Object.assign({}, mm, {
      id,
      chapterId: c.id,
      owner: mm.owner == null ? '' : mm.owner,
      title: mm.title == null ? '' : mm.title,
      previewText: mm.previewText == null ? '' : mm.previewText,
      calories: Number(mm.calories) || 0,
      isProtagonistMemory: !!mm.isProtagonistMemory,
      onBurn: arr(mm.onBurn),
      onHide: arr(mm.onHide)
    });
    MEM[id] = out;
    return out;
  }

  // 조건식·참조 점검: 제미나이가 넣은 데이터의 오타를 미리 잡아 타이틀 화면에 보여준다
  function validate() {
    if (!D.chapters.length) warn('chapters 가 비어 있습니다.');
    const chapterIds = new Set(D.chapters.map((c) => c.id));
    const endingIds = new Set(Object.keys(D.endings));
    const speakersSeen = new Set();

    const checkCond = (cond, where) => {
      arr(cond).forEach((c) => {
        if (c == null || typeof c === 'boolean') return;
        if (typeof c === 'object') { ['all', 'any'].forEach((k) => c[k] && checkCond(c[k], where)); if (c.not) checkCond(c.not, where); return; }
        String(c).split(/\|\||&&/).forEach((atom) => {
          const t = atom.trim().replace(/^!+/, '').trim();
          if (!t) return;
          let m;
          if ((m = /^(burned|hidden|processed)\s*:\s*(.+)$/.exec(t))) { if (!MEM[m[2].trim()]) warn(`${where}: 조건 "${t}" 의 압류품 "${m[2].trim()}" 이 없습니다.`); return; }
          if ((m = /^(quotaMet|quotaMissed)\s*:\s*(.+)$/.exec(t))) { if (!chapterIds.has(m[2].trim())) warn(`${where}: 조건 "${t}" 의 챕터 "${m[2].trim()}" 이 없습니다.`); return; }
          if (/^(flag|chapter)\s*:/.test(t)) return;
          if (/^(suspicion|burnedSelf|burnedCount|hiddenCount|heat|totalHeat|day)\s*(>=|<=|==|!=|>|<|=)\s*-?\d+(\.\d+)?$/.test(t)) return;
          warn(`${where}: 해석할 수 없는 조건식 "${t}"`);
        });
      });
    };
    const checkText = (txt, where) => {
      const re = /\[\[([^|\]]+)\|([^\]]*)\]\]/g; let m;
      while ((m = re.exec(String(txt || '')))) { const k = m[1].trim(); if (!MEM[k]) checkCond(k, where + ' [[…]]'); }
    };
    const checkLines = (lines, where) => {
      const labels = new Set(arr(lines).map((l) => l && l.label).filter(Boolean));
      arr(lines).forEach((l, i) => {
        if (!l || typeof l !== 'object') { warn(`${where}[${i}]: 대사 줄이 객체가 아닙니다.`); return; }
        const w = `${where}[${i}]`;
        checkCond(l.condition, w); checkText(l.text, w);
        if (l.speaker && !D.characters[l.speaker] && !D.meta.selfNames.has(l.speaker) && !D.meta.systemNames.has(l.speaker) && !['나레이션', 'narration'].includes(l.speaker) && !speakersSeen.has(l.speaker)) {
          speakersSeen.add(l.speaker); warn(`${w}: characters 에 "${l.speaker}" 정의가 없어 기본 실루엣으로 표시합니다.`);
        }
        if (l.bgmMood && !MOOD_NAMES.includes(l.bgmMood)) warn(`${w}: 알 수 없는 bgmMood "${l.bgmMood}" (사용 가능: office, calm, tense, dread, warm, sad, silence)`);
        if (l.effect && !KNOWN_EFFECTS.includes(l.effect)) warn(`${w}: 알 수 없는 effect "${l.effect}" (사용 가능: ${KNOWN_EFFECTS.join(', ')})`);
        if (l.sfx && Sfx.SFX && !Sfx.SFX.includes(l.sfx)) warn(`${w}: 알 수 없는 sfx "${l.sfx}" (사용 가능: ${Sfx.SFX.join(', ')})`);
        if (l.goto && l.goto !== 'end' && !labels.has(l.goto)) warn(`${w}: goto "${l.goto}" 라벨이 같은 대사 목록 안에 없습니다.`);
        arr(l.choices).forEach((c, k) => {
          checkCond(c.condition, `${w}.choices[${k}]`); checkText(c.text, `${w}.choices[${k}]`);
          if (c.goto && c.goto !== 'end' && !labels.has(c.goto)) warn(`${w}.choices[${k}]: goto "${c.goto}" 라벨이 없습니다.`);
        });
      });
    };

    D.chapters.forEach((c) => {
      const w = c.id;
      if (!c.quota && c.seizedMemories.length) warn(`${w}: quota 가 0 입니다 (할당량 판정이 항상 달성으로 처리됨).`);
      const maxHeat = c.seizedMemories.reduce((a, mm) => a + mm.calories, 0);
      if (c.quota > maxHeat) warn(`${w}: 할당량 ${c.quota} 이 그날 압류품 열량 합계 ${maxHeat} 보다 커서 달성할 수 없습니다.`);
      checkLines(c.dialogues, `${w}.dialogues`);
      checkLines(c.outroDialogues, `${w}.outroDialogues`);
      c.events.forEach((ev, i) => {
        checkCond(ev.condition, `${w}.events[${i}]`);
        if (typeof ev.after === 'string' && !['start', 'end'].includes(ev.after) && !MEM[ev.after]) warn(`${w}.events[${i}]: after "${ev.after}" 압류품이 없습니다.`);
        checkLines(ev.dialogues, `${w}.events[${i}].dialogues`);
      });
      c.seizedMemories.forEach((m) => {
        const mw = `${w}.${m.id}`;
        ['title', 'previewText'].forEach((k) => { if (!m[k]) warn(`${mw}: ${k} 가 비어 있습니다.`); });
        if (!m.calories) warn(`${mw}: calories 가 0 입니다.`);
        if (rules.requireGrade && m.grade && !rules.gradeTable.some((g) => g.grade === m.grade)) warn(`${mw}: grade "${m.grade}" 가 gradeTable 에 없습니다.`);
        checkCond(m.condition, mw); checkText(m.previewText, mw); checkText(m.title, mw);
        checkLines(m.onBurn, `${mw}.onBurn`); checkLines(m.onHide, `${mw}.onHide`);
      });
      if (c.finale) {
        if (!arr(c.finale.answers).length) warn(`${w}.finale: answers 가 비어 있습니다.`);
        arr(c.finale.answers).forEach((a, i) => { if (!endingIds.has(a.ending)) warn(`${w}.finale.answers[${i}]: 엔딩 "${a.ending}" 이 endings 에 없습니다.`); checkCond(a.condition, `${w}.finale.answers[${i}]`); });
        if (c.finale.fallbackEnding && !endingIds.has(c.finale.fallbackEnding)) warn(`${w}.finale: fallbackEnding "${c.finale.fallbackEnding}" 이 없습니다.`);
      }
      arr(c.next).forEach((n) => {
        if (typeof n === 'string') { if (n.startsWith('ending:')) { if (!endingIds.has(n.slice(7))) warn(`${w}.next: 엔딩 "${n.slice(7)}" 이 없습니다.`); } else if (!chapterIds.has(n)) warn(`${w}.next: 챕터 "${n}" 이 없습니다.`); }
        else if (n) { checkCond(n.condition, `${w}.next`); if (n.chapter && !chapterIds.has(n.chapter)) warn(`${w}.next: 챕터 "${n.chapter}" 이 없습니다.`); if (n.ending && !endingIds.has(n.ending)) warn(`${w}.next: 엔딩 "${n.ending}" 이 없습니다.`); }
      });
    });
    D.notebook.forEach((e) => {
      checkCond(e.condition, `notebook.${e.id}`); checkText(e.text, `notebook.${e.id}`);
      e.erasedBy.forEach((id) => { if (!MEM[id]) warn(`notebook.${e.id}.erasedBy: 압류품 "${id}" 이 없습니다.`); });
      if (e.linkedMemoryId && !MEM[e.linkedMemoryId]) warn(`notebook.${e.id}.linkedMemoryId: 압류품 "${e.linkedMemoryId}" 이 없습니다.`);
      if (e.redactKeyword && !e.text.includes(e.redactKeyword)) warn(`notebook.${e.id}: redactKeyword "${e.redactKeyword}" 가 본문에 없습니다.`);
    });
    Object.entries(D.endings).forEach(([k, vs]) => vs.forEach((v, i) => { checkCond(v.condition, `endings.${k}[${i}]`); checkLines(v.dialogues, `endings.${k}[${i}].dialogues`); }));
    if (D.meta.gameOverEnding && !endingIds.has(D.meta.gameOverEnding)) warn(`meta.gameOverEnding "${D.meta.gameOverEnding}" 이 endings 에 없습니다.`);
    if (!D.chapters.some((c) => c.finale) && !D.meta.defaultEnding) warn('finale 이 있는 챕터도, meta.defaultEnding 도 없습니다. 마지막 챕터 뒤에는 기본 종료 화면이 나옵니다.');
  }

  // ════════════════════════ 3. 저장 ════════════════════════
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  };
  const KEY_SAVE = 'incinerator404.save.v1';
  const KEY_META = 'incinerator404.meta.v1';
  const KEY_SET = 'incinerator404.settings.v1';
  const settings = Object.assign({ speed: 28, muted: false }, LS.get(KEY_SET, {}));
  const saveSettings = () => LS.set(KEY_SET, settings);

  // ════════════════════════ 4. 상태 · 조건식 ════════════════════════
  function freshState() {
    return {
      chapterIndex: 0, phase: 'title',
      burned: [], hidden: [], processed: [], flags: [],
      suspicion: Number(rules.startSuspicion) || 0,
      burnedSelf: 0, totalHeat: 0, dayHeat: 0,
      quota: {}, grades: {}, dayLog: [], history: [],
      firedEvents: [], seenNotebook: [], finaleAnswer: null, extraMuffle: 0
    };
  }
  let S = freshState();

  function saveGame() { LS.set(KEY_SAVE, { v: 1, sig: DATA_SIG, at: Date.now(), state: S }); }
  function loadSave() { const s = LS.get(KEY_SAVE, null); return s && s.sig === DATA_SIG && s.state ? s : null; }

  const curChapter = () => D.chapters[S.chapterIndex] || null;
  const corruptLevel = () => (TOTAL_SELF ? clamp(S.burnedSelf / TOTAL_SELF, 0, 1) : 0);

  function evalCond(c) {
    if (c == null || c === '') return true;
    if (typeof c === 'boolean') return c;
    if (Array.isArray(c)) return c.every(evalCond);
    if (typeof c === 'object') {
      if (c.all) return arr(c.all).every(evalCond);
      if (c.any) return arr(c.any).some(evalCond);
      if (c.not) return !evalCond(c.not);
      return true;
    }
    const s = String(c).trim();
    if (s.includes('||')) return s.split('||').some((p) => evalCond(p));
    if (s.includes('&&')) return s.split('&&').every((p) => evalCond(p));
    let t = s, neg = false;
    while (t.startsWith('!')) { neg = !neg; t = t.slice(1).trim(); }
    const r = evalAtom(t);
    return neg ? !r : r;
  }
  function evalAtom(t) {
    let m;
    if ((m = /^(burned|hidden|processed|flag|quotaMet|quotaMissed|chapter)\s*:\s*(.+)$/.exec(t))) {
      const v = m[2].trim();
      switch (m[1]) {
        case 'burned': return S.burned.includes(v);
        case 'hidden': return S.hidden.includes(v);
        case 'processed': return S.processed.includes(v);
        case 'flag': return S.flags.includes(v);
        case 'quotaMet': return S.quota[v] === true;
        case 'quotaMissed': return S.quota[v] === false;
        case 'chapter': return !!curChapter() && curChapter().id === v;
      }
    }
    if ((m = /^(suspicion|burnedSelf|burnedCount|hiddenCount|heat|totalHeat|day)\s*(>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/.exec(t))) {
      const vars = { suspicion: S.suspicion, burnedSelf: S.burnedSelf, burnedCount: S.burned.length, hiddenCount: S.hidden.length, heat: S.dayHeat, totalHeat: S.totalHeat, day: S.chapterIndex + 1 };
      const a = vars[m[1]], b = Number(m[3]);
      switch (m[2]) { case '>=': return a >= b; case '<=': return a <= b; case '>': return a > b; case '<': return a < b; case '!=': return a !== b; default: return a === b; }
    }
    return false;
  }

  function addFlag(f) { if (f && !S.flags.includes(f)) S.flags.push(f); }
  function addSuspicion(n) { if (!n) return; S.suspicion = clamp(S.suspicion + Number(n), 0, Math.max(100, rules.maxSuspicion || 100)); updateHUD(); }
  function applyEffects(o) {
    if (!o) return;
    arr(o.setFlags).forEach(addFlag);
    arr(o.clearFlags).forEach((f) => { S.flags = S.flags.filter((x) => x !== f); });
    const e = o.effects;
    if (e) {
      arr(e.setFlags).forEach(addFlag);
      arr(e.clearFlags).forEach((f) => { S.flags = S.flags.filter((x) => x !== f); });
      if (e.suspicion) addSuspicion(e.suspicion);
      if (e.heat) { S.dayHeat += Number(e.heat) || 0; S.totalHeat += Number(e.heat) || 0; }
    }
  }
  /** burnEffects / hideEffects 처럼 효과 객체 자체를 받는 경우 */
  /** 먹먹함 = 자기 기억 훼손도 + 데이터 효과(muffle) 누적 */
  function applyMuffle() { Sfx.setMuffle(clamp(corruptLevel() * 0.85 + (S.extraMuffle || 0), 0, 1)); }
  function applyEffectObject(e) {
    if (!e) return;
    if (e.muffle) { S.extraMuffle = clamp((S.extraMuffle || 0) + Number(e.muffle), 0, 1); applyMuffle(); Sfx.muffleDip(); }
    arr(e.setFlags).forEach(addFlag);
    arr(e.clearFlags).forEach((f) => { S.flags = S.flags.filter((x) => x !== f); });
    if (e.suspicion) addSuspicion(e.suspicion);
    if (e.heat) { S.dayHeat += Number(e.heat) || 0; S.totalHeat += Number(e.heat) || 0; }
  }
  function gradeFor(m) {
    if (m.grade) return m.grade;
    const row = rules.gradeTable.find((g) => m.calories >= (g.min || 0));
    return row ? row.grade : rules.gradeTable[rules.gradeTable.length - 1].grade;
  }

  // ════════════════════════ 5. 텍스트 (검열 표기 · 훼손) ════════════════════════
  /** "[[mem_201|이리나]]" → mem_201 을 태우면 █ 로 가려지는 구간. 키가 압류품 id 가 아니면 조건식으로 본다. */
  function segments(text) {
    const s = String(text == null ? '' : text)
      .replace(/\{player\}/g, D.meta.protagonist.name)
      .replace(/\{id\}/g, D.meta.protagonist.id);
    const out = [];
    const re = /\[\[([^|\]]+)\|([^\]]*)\]\]/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ t: s.slice(last, m.index), r: false });
      const key = m[1].trim();
      out.push({ t: m[2], r: MEM[key] ? S.burned.includes(key) : evalCond(key) });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ t: s.slice(last), r: false });
    return out;
  }
  const blot = (t) => '█'.repeat(chars(t).length);
  function plain(text) { return segments(text).map((g) => (g.r ? blot(g.t) : g.t)).join(''); }

  const GLYPHS = chars('█▓▒░#%&?¿※∎ㅁㅂㄱㅎ');
  function corruptHTML(text, level, seed, tick) {
    const segs = segments(text);
    let out = '', i = 0;
    for (const g of segs) {
      if (g.r) { out += '<span class="redact">' + blot(g.t) + '</span>'; continue; }
      for (const ch of chars(g.t)) {
        i++;
        if (level > 0 && !/\s/.test(ch) && (hash(seed + ':' + i) < level * 0.75 || hash(seed + ':' + (tick || 0) + ':' + i) < level * 0.25)) {
          out += '<span class="cor">' + esc(GLYPHS[Math.floor(hash(seed + 'g' + i + ':' + (tick || 0)) * GLYPHS.length)]) + '</span>';
        } else out += esc(ch);
      }
    }
    return out;
  }
  const richHTML = (text) => corruptHTML(text, 0, '');

  // ════════════════════════ 6. DOM ════════════════════════
  const E = {};
  ['app', 'hud', 'hudBadge', 'hudDay', 'gaugeHeat', 'gaugeSus', 'btnSound', 'btnMenu', 'stage', 'windowView', 'scene', 'bgImage', 'portrait', 'portraitImg', 'silhouette', 'silhouetteName',
    'dialogue', 'dialogueBody', 'speaker', 'dialogueText', 'choices', 'desk', 'tray', 'trayList', 'trayCount', 'reader', 'readerSlot', 'readerScreen', 'readerIdle', 'readerContent', 'gradeRow',
    'btnBurn', 'btnHide', 'furnace', 'furnaceMouth', 'fireCanvas', 'furnaceVal', 'tools', 'toolNotebook', 'toolManual', 'toolCalendar', 'toolDrawer', 'badgeNotebook', 'badgeDrawer', 'calIcon',
    'btnEndShift', 'vignette', 'glitchLayer', 'toasts', 'modal', 'modalCard', 'modalClose', 'modalBody', 'screenTitle', 'titleStamp', 'titleMain', 'titleSub', 'btnNew', 'btnContinue', 'titleMeta',
    'titleWarn', 'titleWarnSum', 'titleWarnList', 'screenDay', 'dayDate', 'dayTitle', 'dayQuota', 'screenReport', 'reportCard', 'screenFinale', 'finaleCanvas', 'finalePrompt', 'finaleForm',
    'finaleInput', 'finaleSubmit', 'finaleMsg', 'finaleFly', 'screenEnding', 'endingTitle', 'endingText', 'endingStats', 'btnEndingBack', 'debugPanel'
  ].forEach((id) => { E[id] = $(id); });
  const root = document.documentElement;
  const gradeBtns = Array.from(E.gradeRow.querySelectorAll('.grade-btn'));

  const ui = {
    dialogueOpen: false, busy: false, current: null,
    pickResolver: null, actionResolver: null, endShift: null, finaleSubmit: null,
    advance: null, choiceKeys: null, modalClose: null, modalTimer: null,
    remaining: [], lastNotebookVisible: 0, fireLevel: 0.3
  };

  // ════════════════════════ 7. 진행 제어 (중단 가능한 대기) ════════════════════════
  class Abort extends Error {}
  class GameOver extends Error {}
  const pending = new Set();
  function wait(fn) {
    return new Promise((resolve, reject) => {
      const p = { reject };
      pending.add(p);
      fn((v) => { if (!pending.has(p)) return; pending.delete(p); resolve(v); });
    });
  }
  const sleep = (ms) => wait((res) => setTimeout(res, ms));
  function abortFlow() {
    const ps = Array.from(pending); pending.clear();
    ps.forEach((p) => p.reject(new Abort()));
    ui.advance = ui.pickResolver = ui.actionResolver = ui.endShift = ui.finaleSubmit = ui.choiceKeys = null;
  }
  function checkGameOver() {
    if (S.phase === 'ending') return;
    if (rules.maxSuspicion > 0 && S.suspicion >= rules.maxSuspicion) throw new GameOver();
  }

  // ════════════════════════ 8. HUD · 밝기 · 연출 ════════════════════════
  function updateHUD() {
    const ch = curChapter();
    const q = ch ? ch.quota : 0;
    E.hudDay.textContent = ch && S.phase !== 'title' ? plain(ch.title) : '—';
    const heatBar = E.gaugeHeat.querySelector('i'), heatVal = E.gaugeHeat.querySelector('.gauge-val');
    heatBar.style.width = (q > 0 ? clamp(S.dayHeat / q, 0, 1) * 100 : (S.dayHeat > 0 ? 100 : 0)) + '%';
    heatVal.textContent = q > 0 ? `${S.dayHeat}/${q}` : `${S.dayHeat}`;
    const maxS = rules.maxSuspicion || 100;
    E.gaugeSus.querySelector('i').style.width = clamp(S.suspicion / maxS, 0, 1) * 100 + '%';
    E.gaugeSus.querySelector('.gauge-val').textContent = `${Math.round(S.suspicion)}`;
    E.gaugeSus.classList.toggle('warn', S.suspicion >= maxS * 0.7);
    const lvl = corruptLevel();
    E.hudBadge.innerHTML = '<span class="hud-role">감정평가사 </span>' + corruptHTML('#' + D.meta.protagonist.id, lvl * 0.6, 'badge');
    E.calIcon.innerHTML = corruptHTML(String(S.chapterIndex + 1), lvl * 0.4, 'calicon');
    E.furnaceVal.textContent = S.dayHeat;
    root.style.setProperty('--corrupt', lvl.toFixed(3));
    updateNotebookBadge();
    updateLight();
  }
  function computeLight() {
    const ch = curChapter();
    const q = ch ? ch.quota : 0;
    const ratio = q > 0 ? clamp(S.dayHeat / q, 0, 1) : 1;
    return clamp(rules.baseLight + (1 - rules.baseLight) * ratio - rules.hideDarken * S.hidden.length, 0.15, 1);
  }
  function updateLight() {
    const inGame = !['title'].includes(S.phase);
    const l = inGame ? computeLight() : 1;
    root.style.setProperty('--lum', l.toFixed(3));
    const ch = curChapter();
    const ratio = ch && ch.quota > 0 ? clamp(S.dayHeat / ch.quota, 0, 1) : 0.5;
    ui.fireLevel = 0.2 + ratio * 0.8;
    root.style.setProperty('--fire', ui.fireLevel.toFixed(3));
    Sfx.setFire(inGame ? ui.fireLevel : 0.25);
  }
  function restartClass(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
  function fx(name) {
    if (!name) return;
    if (reduceMotion && name !== 'flash' && name !== 'dark') return;
    switch (name) {
      case 'shake': restartClass(E.app, 'shake', 450); break;
      case 'glitch': restartClass(E.app, 'glitch', 480); restartClass(E.glitchLayer, 'on', 480); Sfx.glitch(1); break;
      case 'flash': restartClass(E.app, 'flash', 950); break;
      case 'flicker': restartClass(E.windowView, 'flicker', 900); break;
      case 'dark': root.style.setProperty('--lum', '0.12'); setTimeout(updateLight, 1600); break;
      default: break;
    }
  }
  function toast(html, cls, ms) {
    const t = h('div', 'toast ' + (cls || ''));
    t.innerHTML = html;
    E.toasts.appendChild(t);
    while (E.toasts.children.length > 3) E.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 420); }, ms || 3600);
  }
  function setBackground(path) {
    if (!path || path === 'none') { E.bgImage.classList.remove('on'); return; }
    const img = new Image();
    img.onload = () => { E.bgImage.style.backgroundImage = `url("${path}")`; E.bgImage.classList.add('on'); };
    img.onerror = () => warn(`배경 이미지를 불러오지 못했습니다: ${path}`);
    img.src = path;
  }

  // ════════════════════════ 9. 대화 ════════════════════════
  function setDialogueOpen(on) {
    ui.dialogueOpen = on;
    E.dialogue.classList.toggle('on', on);
    if (!on) { E.dialogue.classList.remove('wait'); E.choices.innerHTML = ''; }
    refreshLock(); setControls();
  }
  function showPortrait(sp, expr, override) {
    const ch = D.characters[sp] || { displayName: sp, color: '#8a8170', portraits: {} };
    const p = override || (ch.portraits && (ch.portraits[expr] || ch.portraits.default || ch.portraits.neutral)) || null;
    E.portrait.classList.add('on');
    E.portrait.dataset.speaker = sp; E.portrait.dataset.expression = expr || '';
    E.silhouette.style.setProperty('--c', mixHex(ch.color, '#121317', 0.32));
    E.silhouetteName.textContent = plain(ch.displayName || sp);
    if (p) {
      if (E.portraitImg.dataset.src !== p) {
        E.portraitImg.dataset.src = p;
        E.portrait.classList.remove('has-img');
        E.portraitImg.onload = () => { if (E.portraitImg.dataset.src === p) E.portrait.classList.add('has-img'); };
        E.portraitImg.onerror = () => { E.portrait.classList.remove('has-img'); warn(`초상화를 불러오지 못했습니다: ${p}`); };
        E.portraitImg.src = p;
      }
    } else {
      E.portrait.classList.remove('has-img');
      delete E.portraitImg.dataset.src;
      E.portraitImg.removeAttribute('src');
    }
  }
  const hidePortrait = () => E.portrait.classList.remove('on');

  /** 한 글자씩 출력. ui.advance 를 부르면 즉시 끝까지 출력된다. */
  async function typeText(el, text, opts) {
    opts = opts || {};
    const segs = segments(text);
    el.innerHTML = '';
    const speed = opts.speed != null ? opts.speed : settings.speed;
    let skip = speed <= 0;
    ui.advance = () => { skip = true; };
    let n = 0;
    for (const g of segs) {
      let node;
      if (g.r) { node = h('span', 'redact'); el.appendChild(node); } else { node = document.createTextNode(''); el.appendChild(node); }
      for (const c of chars(g.t)) {
        if (g.r) node.textContent += '█'; else node.data += c;
        if (skip) continue;
        n++;
        if (opts.sound !== false && !/\s/.test(c)) {
          if (g.r) { if (n % 3 === 0) Sfx.glitch(0.12); }
          else if (opts.heavy) Sfx.type(true);
          else if (n % 2 === 0) Sfx.type(false);
        }
        let d = speed;
        if (/[.,!?…。、·~]/.test(c)) d += speed * 4;
        if (c === '\n') d += speed * 3;
        await sleep(d);
      }
    }
    ui.advance = null;
  }

  async function showLine(L, noWait) {
    const sp = L.speaker == null ? '' : String(L.speaker);
    const isNarr = sp === '' || sp === '나레이션' || sp === 'narration';
    const isSystem = !isNarr && D.meta.systemNames.has(sp);
    const isSelf = !isNarr && !isSystem && D.meta.selfNames.has(sp);
    const ch = D.characters[sp];
    E.speaker.textContent = isNarr ? '' : plain(ch ? ch.displayName : sp);
    E.speaker.style.setProperty('--nc', isSelf ? '#cfd6dd' : (ch && ch.color) || '');
    E.dialogue.classList.toggle('narration', isNarr);
    E.dialogue.classList.toggle('self', isSelf);
    E.dialogue.classList.toggle('system', isSystem);
    if (isSystem) E.speaker.style.setProperty('--nc', 'var(--amber)');
    if (isSystem || L.portrait === null || L.hidePortrait) hidePortrait();
    else if (!isNarr && !isSelf) showPortrait(sp, L.expression, L.portrait);
    E.choices.innerHTML = '';
    E.dialogue.classList.remove('wait');
    setDialogueOpen(true);
    E.dialogueBody.scrollTop = 0;
    await typeText(E.dialogueText, L.text, { speed: L.speed });
    if (noWait) return;
    E.dialogue.classList.add('wait');
    await wait((res) => { ui.advance = () => { ui.advance = null; res(); }; });
    E.dialogue.classList.remove('wait');
  }

  function showChoices(list) {
    if (!list.length) return Promise.resolve(null);
    setDialogueOpen(true);
    E.dialogue.classList.remove('wait');
    E.choices.innerHTML = '';
    return wait((res) => {
      list.forEach((c, i) => {
        const b = h('button', 'choice-btn');
        b.innerHTML = `<span style="opacity:.5;font-family:var(--f-mono);margin-right:8px">${i + 1}</span>` + richHTML(c.text);
        b.addEventListener('click', (ev) => { ev.stopPropagation(); Sfx.click(); E.choices.innerHTML = ''; ui.choiceKeys = null; res(c); });
        E.choices.appendChild(b);
      });
      ui.choiceKeys = (k) => { const b = E.choices.children[k]; if (b) b.click(); };
      E.dialogueBody.scrollTop = E.dialogueBody.scrollHeight;
    });
  }

  function applyLine(L) {
    if (L.bgmMood) Sfx.setMood(L.bgmMood);
    if (L.background !== undefined) setBackground(L.background);
    if (L.sfx) Sfx.play(L.sfx);
    if (L.effect) fx(L.effect);
    applyEffects(L);
  }

  async function runDialogue(lines, opts) {
    lines = arr(lines);
    if (!lines.length) return;
    opts = opts || {};
    const labels = {};
    lines.forEach((l, i) => { if (l && l.label) labels[l.label] = i; });
    let i = 0, guard = 0;
    try {
      while (i < lines.length && guard++ < 5000) {
        const L = lines[i];
        if (!L || typeof L !== 'object' || !evalCond(L.condition)) { i++; continue; }
        applyLine(L);
        const choices = arr(L.choices).filter((c) => evalCond(c.condition));
        if (L.text != null && L.text !== '') await showLine(L, choices.length > 0);
        let jump = L.goto || null;
        if (choices.length) {
          const c = await showChoices(choices);
          if (c) { applyEffects(c); if (c.goto) jump = c.goto; }
        }
        updateHUD();
        if (L.end || jump === 'end') break;
        if (jump && labels[jump] != null) { i = labels[jump]; continue; }
        i++;
      }
    } finally {
      setDialogueOpen(false);
      if (!opts.keepPortrait) hidePortrait();
    }
  }
  /** 대화 후 의심도 한도 확인까지 */
  async function dialogue(lines, opts) { await runDialogue(lines, opts); checkGameOver(); }

  // ════════════════════════ 10. 데스크 ════════════════════════
  const serial = (m) => m.serial || String(m.id).toUpperCase().replace(/_/g, '-');
  const ownerHTML = (m) => (m.ownerRedacted ? `<span class="redact">${blot(m.owner || '██████')}</span>` : richHTML(m.owner));

  function refreshLock() {
    const locked = S.phase !== 'work' || ui.dialogueOpen || ui.busy;
    E.desk.classList.toggle('locked', locked);
  }
  function setControls() {
    const m = ui.current;
    const ready = !!m && !ui.busy && S.phase === 'work' && !ui.dialogueOpen;
    const graded = !!(m && S.grades[m.id]);
    gradeBtns.forEach((b) => {
      b.disabled = !ready || !rules.requireGrade || graded;
      b.classList.toggle('picked', !!(m && graded && S.grades[m.id].given === b.dataset.grade));
    });
    E.btnBurn.disabled = !ready || (rules.requireGrade && !graded);
    E.btnHide.disabled = !ready;
    E.btnBurn.classList.toggle('attn', ready && (!rules.requireGrade || graded));
  }
  function renderTray(list) {
    E.trayList.innerHTML = '';
    list.forEach((m) => E.trayList.appendChild(makeCard(m)));
    E.trayCount.textContent = list.length;
  }
  function makeCard(m) {
    const b = h('button', 'mem-card');
    b.type = 'button';
    b.dataset.id = m.id;
    if (m.ownerRedacted) b.classList.add('unreg');
    if (m.isProtagonistMemory && rules.hintSelfMemories) b.classList.add('self-hint');
    b.innerHTML = `<span class="crystal"></span><span class="mc-id">${esc(serial(m))}</span><span class="mc-owner">${ownerHTML(m)}</span>`;
    b.setAttribute('aria-label', `압류 결정 ${serial(m)} 판독기에 투입`);
    attachDrag(b, m);
    return b;
  }
  const canPick = () => !!ui.pickResolver && !ui.current && !ui.busy && !ui.dialogueOpen && S.phase === 'work';
  function pick(m) { if (canPick()) { const r = ui.pickResolver; ui.pickResolver = null; r(m); } }
  function overReader(e) { const r = E.reader.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
  function attachDrag(card, m) {
    let sx = 0, sy = 0, ghost = null, dragging = false, pid = null, ox = 0, oy = 0;
    card.addEventListener('pointerdown', (e) => {
      if (!canPick() || (e.button != null && e.button !== 0)) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; dragging = false;
      try { card.setPointerCapture(pid); } catch (err) { /* 미지원 */ }
    });
    card.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
        dragging = true;
        const r = card.getBoundingClientRect();
        ghost = card.cloneNode(true); ghost.classList.add('drag-ghost');
        ghost.style.width = r.width + 'px'; ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px';
        ox = sx - r.left; oy = sy - r.top;
        document.body.appendChild(ghost); card.classList.add('dragging');
        Sfx.paper();
      }
      if (dragging) {
        ghost.style.left = (e.clientX - ox) + 'px'; ghost.style.top = (e.clientY - oy) + 'px';
        E.reader.classList.toggle('drop-ok', overReader(e));
      }
    });
    const end = (e, cancel) => {
      if (pid !== e.pointerId) return;
      pid = null;
      if (dragging) {
        const ok = !cancel && overReader(e);
        if (ghost) ghost.remove(); ghost = null;
        card.classList.remove('dragging'); E.reader.classList.remove('drop-ok');
        if (ok) pick(m);
      } else if (!cancel) pick(m);
      dragging = false;
    };
    card.addEventListener('pointerup', (e) => end(e, false));
    card.addEventListener('pointercancel', (e) => end(e, true));
    card.addEventListener('click', (e) => { if (e.detail === 0) pick(m); }); // 키보드(Enter/Space)
  }

  function fly(fromRect, toEl, o) {
    const to = toEl.getBoundingClientRect();
    const w = o.w || Math.min(fromRect.width * 0.8, 170), hh = o.h || 54;
    const el = h('div', 'fly-card', o.label || '');
    const x0 = fromRect.left + fromRect.width / 2 - w / 2, y0 = fromRect.top + fromRect.height / 2 - hh / 2;
    Object.assign(el.style, { left: x0 + 'px', top: y0 + 'px', width: w + 'px', height: hh + 'px' });
    document.body.appendChild(el);
    const dx = to.left + to.width / 2 - (x0 + w / 2), dy = to.top + to.height / 2 - (y0 + hh / 2);
    const dur = reduceMotion ? 150 : (o.dur || 520);
    if (!el.animate) { el.remove(); return sleep(10); }
    const anim = el.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${o.scale != null ? o.scale : 0.3}) rotate(${o.rot != null ? o.rot : 20}deg)`, opacity: o.fade ? 0.1 : 0.9 }
    ], { duration: dur, easing: o.easing || 'cubic-bezier(.55,0,.8,.4)', fill: 'forwards' });
    return wait((res) => { anim.onfinish = () => { el.remove(); res(); }; setTimeout(() => { el.remove(); res(); }, dur + 400); });
  }

  function resetReader() {
    E.readerContent.innerHTML = '';
    E.readerScreen.classList.remove('loaded', 'self');
    const st = E.readerScreen.querySelector('.rd-stamp'); if (st) st.remove();
    ui.current = null;
    Sfx.setHum(false);
    setControls();
  }

  async function loadReader(m, card) {
    ui.busy = true; refreshLock(); setControls();
    resetReader();
    Sfx.insert();
    if (card) {
      const r = card.getBoundingClientRect();
      card.remove();
      E.trayCount.textContent = E.trayList.children.length;
      await fly(r, E.readerSlot, { label: serial(m), scale: 0.6, rot: 0, h: 40, dur: 380, easing: 'ease-in' });
    }
    Sfx.setHum(true);
    E.readerScreen.classList.add('loaded');
    E.readerScreen.classList.toggle('self', !!(m.isProtagonistMemory && rules.hintSelfMemories));
    const c = E.readerContent;
    c.innerHTML = '';
    const prog = h('div', 'rd-head');
    prog.innerHTML = '<span>판독 중…</span><span class="pb"></span>';
    c.appendChild(prog);
    for (let k = 0; k <= 8; k++) {
      prog.querySelector('.pb').textContent = '█'.repeat(k) + '░'.repeat(8 - k);
      if (k % 2 === 0) Sfx.beep(520 + k * 70, 0.025);
      await sleep(reduceMotion ? 10 : 55);
    }
    c.innerHTML = '';
    const head = h('div', 'rd-head'); head.innerHTML = `<span>판독 결과</span><span>${esc(serial(m))}</span>`;
    c.appendChild(head);
    const dl = h('dl', 'rd-fields');
    dl.innerHTML = `<dt>소유자</dt><dd>${ownerHTML(m)}</dd><dt>제목</dt><dd class="rd-title">${richHTML(m.title)}</dd>`;
    c.appendChild(dl);
    if (m.image) {
      const fig = h('figure', 'rd-image'); const img = h('img'); img.alt = ''; img.src = m.image;
      img.onerror = () => { fig.remove(); warn(`압류품 이미지를 불러오지 못했습니다: ${m.image}`); };
      fig.appendChild(img); c.appendChild(fig);
    }
    const p = h('p', 'rd-preview'); c.appendChild(p);
    await typeText(p, m.previewText, { speed: Math.round(settings.speed * 0.8) });
    if (m.memo) {
      Sfx.paper();
      const memo = h('div', 'rd-memo');
      memo.innerHTML = `<span class="rd-memo-label">— 손글씨 메모 —</span>${richHTML(m.memo)}`;
      c.appendChild(memo);
      await sleep(250);
    }
    const cal = h('div', 'rd-cal'); cal.innerHTML = '<span>열량</span><b>0</b><small></small>'; c.appendChild(cal);
    const b = cal.querySelector('b');
    const steps = reduceMotion ? 1 : 14;
    for (let k = 1; k <= steps; k++) { b.textContent = Math.round(m.calories * k / steps); if (k % 3 === 0) Sfx.beep(900 + k * 20, 0.02); await sleep(30); }
    if (!rules.requireGrade) {
      cal.querySelector('small').textContent = '판독기 자동 판정';
      await sleep(180);
      putStamp(gradeFor(m));
      Sfx.stamp();
    }
    c.scrollTop = c.scrollHeight;
    ui.current = m;
    ui.busy = false; refreshLock(); setControls();
  }

  function putStamp(g) {
    const old = E.readerScreen.querySelector('.rd-stamp'); if (old) old.remove();
    const st = h('div', 'rd-stamp' + (String(g).length > 1 ? ' long' : ''), g);
    E.readerScreen.appendChild(st);
  }
  function stampGrade(g) {
    const m = ui.current;
    if (!m || S.grades[m.id] || ui.busy) return;
    S.grades[m.id] = { given: g, correct: gradeFor(m) };
    Sfx.stamp();
    putStamp(g);
    setControls();
  }

  function showResult(m, action, wrong) {
    const box = h('div', 'rd-result ' + action);
    const cons = action === 'burn' ? m.burnConsequence : m.hideConsequence;
    const headline = action === 'burn'
      ? `▶ 소각 완료 · 열량 +${m.calories}${wrong ? `\n▶ 등급 오판정 (정답 ${S.grades[m.id].correct}) · 감찰 의심 +${rules.wrongGradeSuspicion}` : ''}`
      : `▶ 서랍에 은닉 · 감찰 의심 +${m.suspicion != null ? m.suspicion : rules.hideSuspicion}`;
    box.innerHTML = esc(headline) + (cons ? '\n\n' + richHTML(cons) : '');
    E.readerContent.appendChild(box);
    E.readerContent.scrollTop = E.readerContent.scrollHeight;
  }

  async function doBurn(m) {
    ui.busy = true; refreshLock(); setControls();
    const g = S.grades[m.id];
    const wrong = !!(g && g.given !== g.correct);
    const before = notebookSnapshot();
    Sfx.setHum(false);
    await fly(E.readerScreen.getBoundingClientRect(), E.furnaceMouth, { label: serial(m), scale: 0.15, rot: 40, fade: true, dur: 620 });
    Sfx.burn();
    restartClass(E.furnace, 'flare', 950);
    if (ui.fire) ui.fire.boost(2.2);
    S.burned.push(m.id); S.processed.push(m.id);
    S.dayHeat += m.calories; S.totalHeat += m.calories;
    if (m.isProtagonistMemory) S.burnedSelf++;
    applyEffectObject(m.burnEffects);
    if (wrong) addSuspicion(rules.wrongGradeSuspicion);
    S.dayLog.push({ id: m.id, action: 'burn', title: m.title, grade: g ? g.given : null, correct: g ? g.correct : gradeFor(m), wrong, heat: m.calories, cons: m.burnConsequence });
    S.history.push({ day: S.chapterIndex + 1, id: m.id, action: 'burn' });
    updateHUD();
    showResult(m, 'burn', wrong);
    toast(`소각 · ${esc(plain(m.title))} <b>+${m.calories}</b>`, 'burn', 2600);
    if (m.isProtagonistMemory) await selfMemoryLoss(before);
    else await sleep(400);
  }

  async function doHide(m) {
    ui.busy = true; refreshLock(); setControls();
    Sfx.setHum(false);
    await fly(E.readerScreen.getBoundingClientRect(), E.toolDrawer, { label: serial(m), scale: 0.35, rot: -8, fade: true, dur: 520 });
    Sfx.drawer();
    S.hidden.push(m.id); S.processed.push(m.id);
    const sus = m.suspicion != null ? Number(m.suspicion) : rules.hideSuspicion;
    addSuspicion(sus);
    applyEffectObject(m.hideEffects);
    S.dayLog.push({ id: m.id, action: 'hide', title: m.title, sus, cons: m.hideConsequence });
    S.history.push({ day: S.chapterIndex + 1, id: m.id, action: 'hide' });
    updateHUD();
    showResult(m, 'hide');
    toast(`은닉 · ${esc(plain(m.title))} · 감찰 의심 +${sus}`, 'hide', 2600);
    await sleep(450);
  }

  /** 자기 기억을 태운 순간: 글리치 → 먹먹해짐 → 수첩 문장이 █ 로 지워지는 장면 */
  async function selfMemoryLoss(before) {
    fx('glitch');
    Sfx.muffleDip();
    applyMuffle();
    updateHUD();
    const after = notebookSnapshot();
    const changed = Object.keys(after).some((id) => before[id] && after[id].some((r, k) => r && !before[id][k]));
    await sleep(700);
    if (changed) {
      await wait((res) => { openNotebook(before).then(res); });
    }
  }

  // ════════════════════════ 11. 수첩 · 매뉴얼 · 달력 · 서랍 · 메뉴 ════════════════════════
  /** 수첩 한 항목을 글자 단위로 펼친다. part: 't' 제목, 'x' 본문. r: 가려짐 */
  function entryRedactions(e) {
    const erased = e.erasedBy.some((id) => S.burned.includes(id));
    const kws = [];
    if (e.redactKeyword && e.linkedMemoryId && S.burned.includes(e.linkedMemoryId)) kws.push(e.redactKeyword);
    S.burned.forEach((id) => { const k = MEM[id] && MEM[id].redactKeyword; if (k && !kws.includes(k)) kws.push(k); });
    const out = [];
    const push = (text, part) => {
      const start = out.length;
      segments(text).forEach((g) => chars(g.t).forEach((c) => out.push({ c, r: erased || g.r, part })));
      kws.forEach((kw) => {
        const k = chars(kw);
        if (!k.length) return;
        for (let i = start; i + k.length <= out.length; i++) {
          let hit = true;
          for (let j = 0; j < k.length; j++) if (out[i + j].c !== k[j]) { hit = false; break; }
          if (hit) for (let j = 0; j < k.length; j++) out[i + j].r = true;
        }
      });
    };
    if (e.title) push(e.title, 't');
    push(e.text, 'x');
    return out;
  }
  function visibleNotebook() { return D.notebook.filter((e) => evalCond(e.condition)); }
  function notebookSnapshot() {
    const snap = {};
    visibleNotebook().forEach((e) => { snap[e.id] = entryRedactions(e).map((x) => x.r); });
    return snap;
  }
  function updateNotebookBadge() {
    const vis = visibleNotebook();
    const unseen = vis.filter((e) => !S.seenNotebook.includes(e.id));
    E.badgeNotebook.classList.toggle('on', unseen.length > 0 && S.phase !== 'title');
    if (vis.length > ui.lastNotebookVisible && (S.phase === 'work' || S.phase === 'outro')) toast('개인 수첩에 새 기록', '', 2400);
    ui.lastNotebookVisible = vis.length;
  }

  function openModal(render, cls, live) {
    if (ui.modalClose) closeModal();
    E.modalCard.className = 'modal-card paper ' + (cls || '');
    E.modalBody.innerHTML = '';
    let tick = 0;
    render(E.modalBody, tick);
    E.modal.hidden = false;
    E.modalCard.scrollTop = 0;
    Sfx.paper();
    if (live && corruptLevel() > 0) ui.modalTimer = setInterval(() => { tick++; const st = E.modalCard.scrollTop; E.modalBody.innerHTML = ''; render(E.modalBody, tick); E.modalCard.scrollTop = st; if (tick % 3 === 0) Sfx.glitch(0.08); }, 1600);
    return new Promise((res) => { ui.modalClose = res; });
  }
  function closeModal() {
    if (E.modal.hidden) return;
    E.modal.hidden = true;
    clearInterval(ui.modalTimer); ui.modalTimer = null;
    const c = ui.modalClose; ui.modalClose = null;
    if (c) c();
  }

  function openNotebook(animateFrom) {
    const lvl = corruptLevel();
    const vis = visibleNotebook();
    const fresh = vis.filter((e) => !S.seenNotebook.includes(e.id)).map((e) => e.id);
    vis.forEach((e) => { if (!S.seenNotebook.includes(e.id)) S.seenNotebook.push(e.id); });
    updateNotebookBadge();
    const flips = [];
    const p = openModal((body) => {
      body.innerHTML = `<h2>개인 수첩</h2><p class="sub">감정평가사 ${corruptHTML('#' + D.meta.protagonist.id, lvl * 0.6, 'nbsub')}</p>`;
      if (!vis.length) { body.appendChild(h('div', 'nb-empty', '…')); return; }
      const ul = h('ul', 'nb-list');
      vis.forEach((e) => {
        const li = h('li');
        if (fresh.includes(e.id) && !animateFrom) li.classList.add('new');
        if (e.day != null) li.appendChild(h('span', 'nb-date', e.day + '일'));
        const prev = animateFrom && animateFrom[e.id];
        const titleEl = e.title ? h('span', 'nb-title') : null;
        if (titleEl) li.appendChild(titleEl);
        entryRedactions(e).forEach((x, k) => {
          const s = h('span');
          if (x.r) {
            if (prev && !prev[k]) { s.textContent = x.c; flips.push(s); }
            else { s.textContent = '█'; s.className = 'redact'; }
          } else s.textContent = x.c;
          (x.part === 't' && titleEl ? titleEl : li).appendChild(s);
        });
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }, 'notebook');
    if (flips.length) {
      const step = Math.min(35, 2600 / flips.length);
      Sfx.scribble(Math.min(2.8, 0.3 + flips.length * step / 1000));
      flips.forEach((s, i) => setTimeout(() => { s.textContent = '█'; s.className = 'redact redacting'; }, 250 + i * step));
    }
    return p;
  }

  function openManual() {
    return openModal((body, tick) => {
      const lvl = corruptLevel() * 0.5;
      const C = (t, seed) => corruptHTML(t, lvl, 'man' + seed, tick);
      const rows = rules.gradeTable.map((g, i) => {
        const upper = i > 0 ? rules.gradeTable[i - 1].min : null;
        const range = upper != null ? `${g.min} 이상 ${upper} 미만` : `${g.min} 이상`;
        return `<tr><td>${C(g.grade, 'g' + i)}</td><td>${C(range, 'r' + i)}</td></tr>`;
      }).join('');
      const steps = [
        '압류 결정을 트레이에서 판독기로 옮긴다. (끌어오기 또는 누르기)',
        rules.requireGrade ? '판독된 열량을 등급표와 대조해 등급 도장을 찍는다.' : '판독된 열량과 등급을 확인한다.',
        '[소각] 결정의 열량이 등대 출력에 더해진다.',
        '[은닉] 결정은 서랍에 보관되며 감찰 의심도가 오른다.',
        `하루 할당량을 채우지 못하면 감찰 의심도가 ${rules.quotaMissSuspicion} 오른다.`
      ];
      body.innerHTML = `<h2>${C('소각과 업무 매뉴얼', 'h')}</h2><p class="sub">${C('제 404 소각로 비치용', 's')}</p>
        ${rules.requireGrade ? `<h3 style="font-size:14px;margin:12px 0 0">${C('연료 등급표', 'th')}</h3>
        <table><thead><tr><th>${C('등급', 'c1')}</th><th>${C('열량', 'c2')}</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
        <h3 style="font-size:14px;margin:12px 0 6px">${C('업무 절차', 'ph')}</h3>
        <ol class="manual-text">${steps.map((s, i) => `<li>${C(s, 'st' + i)}</li>`).join('')}</ol>
        ${D.meta.manual.length ? `<h3 style="font-size:14px;margin:14px 0 6px">${C('규정', 'rh')}</h3><ul class="manual-text">${D.meta.manual.map((s, i) => `<li>${C(s, 'm' + i)}</li>`).join('')}</ul>` : ''}`;
    }, '', true);
  }

  function openCalendar() {
    return openModal((body, tick) => {
      const lvl = corruptLevel() * 0.6;
      const C = (t, seed) => corruptHTML(t, lvl, 'cal' + seed, tick);
      const n = Math.max(7, Math.ceil(D.chapters.length / 7) * 7);
      let cells = '';
      for (let i = 0; i < n; i++) {
        const cls = i >= D.chapters.length ? 'blank' : i < S.chapterIndex ? 'past' : i === S.chapterIndex ? 'today' : '';
        cells += `<div class="cal-cell ${cls}">${i < D.chapters.length ? C(String(i + 1), 'd' + i) : ''}</div>`;
      }
      const list = D.chapters.slice(0, S.chapterIndex + 1).map((c, i) => `<li><b>${C(i + 1 + '일', 'l' + i)}</b><span>${C(c.title, 't' + i)}${c.date ? ' · ' + C(c.date, 'dt' + i) : ''}</span></li>`).join('');
      body.innerHTML = `<h2>${C('근무 달력', 'h')}</h2><p class="sub">${C('소각과 · 404호', 's')}</p><div class="cal-grid">${cells}</div><ul class="cal-list">${list}</ul>`;
    }, '', true);
  }

  function openDrawer() {
    return openModal((body) => {
      const items = S.hidden.map((id) => MEM[id]).filter(Boolean);
      body.innerHTML = `<h2>서랍</h2><p class="sub">은닉한 압류품 ${items.length}건</p>`;
      if (!items.length) { body.appendChild(h('p', 'sub', '비어 있다.')); return; }
      items.forEach((m) => {
        const d = h('div', 'drawer-item');
        d.innerHTML = `<div class="di-meta">${esc(serial(m))} · ${ownerHTML(m)} · 열량 ${m.calories}</div><h3>${richHTML(m.title)}</h3><p>${richHTML(m.previewText)}</p>${m.memo ? `<p style="font-family:var(--f-hand);font-size:20px;color:#1f2a55">${richHTML(m.memo)}</p>` : ''}`;
        body.appendChild(d);
      });
    });
  }

  function openMenu() {
    const speeds = [['느림', 45], ['보통', 28], ['빠름', 14], ['즉시', 0]];
    return openModal((body) => {
      body.innerHTML = '<h2>메뉴</h2><p class="sub">설정은 이 브라우저에 저장됩니다.</p>';
      const list = h('div', 'menu-list');
      const sp = h('div'); sp.innerHTML = '<div class="sub" style="margin:0 0 4px">대사 속도</div>';
      const seg = h('div', 'seg');
      speeds.forEach(([label, v]) => {
        const b = h('button', settings.speed === v ? 'on' : '', label);
        b.onclick = () => { settings.speed = v; saveSettings(); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
        seg.appendChild(b);
      });
      sp.appendChild(seg); list.appendChild(sp);
      const snd = h('button', '', settings.muted ? '소리 켜기' : '소리 끄기');
      snd.onclick = () => { toggleSound(); snd.textContent = settings.muted ? '소리 켜기' : '소리 끄기'; };
      list.appendChild(snd);
      if (S.phase !== 'title') {
        const back = h('button', '', '처음 화면으로 (현재 날의 시작부터 이어하기 가능)');
        back.onclick = () => { closeModal(); showTitle(); };
        list.appendChild(back);
      }
      const del = h('button', '', '저장 데이터 삭제');
      del.onclick = () => { LS.del(KEY_SAVE); del.textContent = '삭제했습니다'; del.disabled = true; refreshTitle(); };
      list.appendChild(del);
      body.appendChild(list);
    });
  }

  function toggleSound() {
    settings.muted = !settings.muted; saveSettings();
    Sfx.setMuted(settings.muted);
    E.btnSound.classList.toggle('off', settings.muted);
  }

  // ════════════════════════ 12. 하루 진행 단계 ════════════════════════
  async function showDayCard(ch) {
    E.dayDate.innerHTML = richHTML(ch.date);
    E.dayTitle.innerHTML = richHTML(ch.title);
    E.dayQuota.textContent = ch.quota > 0 ? `오늘의 할당량 ${ch.quota}` : '';
    E.screenDay.hidden = false;
    E.dayTitle.style.animation = 'none'; void E.dayTitle.offsetWidth; E.dayTitle.style.animation = '';
    Sfx.stamp();
    try {
      await wait((res) => {
        const t = setTimeout(done, 2600);
        function done() { clearTimeout(t); ui.advance = null; res(); }
        ui.advance = done;
      });
    } finally { E.screenDay.hidden = true; }
  }

  async function fireEvents(ch, key, count) {
    for (let i = 0; i < ch.events.length; i++) {
      const ev = ch.events[i];
      const id = ch.id + '#' + i;
      if (S.firedEvents.includes(id)) continue;
      const a = ev.after;
      const hit = (typeof a === 'number' && a === count && key !== 'start' && key !== 'end') || a === key;
      if (hit && evalCond(ev.condition)) { S.firedEvents.push(id); await dialogue(ev.dialogues); }
    }
  }

  async function workPhase(ch, mems) {
    S.phase = 'work';
    ui.remaining = mems.slice();
    renderTray(mems);
    resetReader();
    refreshLock(); setControls();
    await fireEvents(ch, 'start', 0);
    let count = 0;
    while (ui.remaining.length) {
      refreshLock(); setControls();
      const m = await wait((res) => { ui.pickResolver = res; });
      ui.remaining = ui.remaining.filter((x) => x !== m);
      const card = E.trayList.querySelector(`[data-id="${CSS.escape(m.id)}"]`);
      await loadReader(m, card);
      const act = await wait((res) => { ui.actionResolver = res; });
      ui.actionResolver = null;
      if (act === 'burn') await doBurn(m); else await doHide(m);
      ui.current = null; ui.busy = false; refreshLock(); setControls();
      count++;
      checkGameOver();
      await dialogue(act === 'burn' ? m.onBurn : m.onHide);
      await fireEvents(ch, m.id, count);
      checkGameOver();
    }
    await fireEvents(ch, 'end', count);
    E.btnEndShift.hidden = false;
    Sfx.chime();
    await wait((res) => { ui.endShift = res; });
    ui.endShift = null;
    E.btnEndShift.hidden = true;
    Sfx.setHum(false);
  }

  async function dayReport(ch) {
    const met = ch.quota <= 0 || S.dayHeat >= ch.quota;
    S.quota[ch.id] = met;
    if (!met) addSuspicion(rules.quotaMissSuspicion);
    const items = S.dayLog.map((x) => {
      const tag = x.action === 'burn' ? `<span class="tag burn">소각${x.grade || x.correct ? ' ' + esc(x.grade || x.correct) : ''}</span>` : '<span class="tag hide">은닉</span>';
      const extra = x.action === 'burn' ? ` · +${x.heat}${x.wrong ? ` · <b style="color:#a4321e">오판정(${esc(x.correct)})</b>` : ''}` : ` · 의심 +${x.sus}`;
      return `<li>${tag}${richHTML(x.title)}<small style="font-family:var(--f-mono);color:#6d6252">${extra}</small>${x.cons ? `<span class="cons">${richHTML(x.cons)}</span>` : ''}</li>`;
    }).join('');
    E.reportCard.innerHTML = `
      <h2>업무 보고서</h2>
      <p class="sub">${esc(plain(ch.title))} · 감정평가사 ${corruptHTML('#' + D.meta.protagonist.id, corruptLevel() * 0.6, 'rep')}</p>
      <div class="report-row"><span>할당량</span><span>${ch.quota}</span></div>
      <div class="report-row"><span>생산 열량</span><span>${S.dayHeat}</span></div>
      <div class="report-row"><span>감찰 의심도</span><span>${Math.round(S.suspicion)}${met ? '' : ` (할당량 미달 +${rules.quotaMissSuspicion})`}</span></div>
      <ul class="report-items">${items || '<li>처리 내역 없음</li>'}</ul>
      <button class="big-btn" id="btnReportOk">퇴근</button>`;
    E.screenReport.hidden = false;
    Sfx.paper();
    const stampTimer = setTimeout(() => {
      const st = h('div', 'report-stamp' + (met ? ' ok' : ''), met ? '달성' : '미달');
      E.reportCard.appendChild(st); Sfx.stamp();
    }, 500);
    try {
      await wait((res) => { $('btnReportOk').onclick = () => { Sfx.click(); res(); }; });
    } finally { clearTimeout(stampTimer); E.screenReport.hidden = true; }
    updateHUD();
    checkGameOver();
  }

  const normName = (s) => String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, '').replace(/^#+/, '').toLowerCase();

  async function finalePhase(ch) {
    const f = ch.finale || {};
    S.phase = 'finale'; refreshLock();
    E.finaleMsg.textContent = '';
    E.finaleInput.value = '';
    E.finaleInput.disabled = false;
    E.finaleInput.placeholder = plain(f.placeholder || '');
    E.screenFinale.hidden = false;
    Sfx.setMood(f.bgmMood || 'dread');
    Sfx.setFire(0.9);
    await typeText(E.finalePrompt, f.prompt || '', { heavy: true, speed: Math.max(settings.speed, 20) });
    try { E.finaleInput.focus({ preventScroll: true }); } catch (e) { E.finaleInput.focus(); }
    for (;;) {
      const val = await wait((res) => { ui.finaleSubmit = res; });
      const norm = normName(val);
      if (!norm) { Sfx.deny(); continue; }
      const ans = arr(f.answers).find((a) => evalCond(a.condition) && arr(a.match).some((x) => normName(x) === norm));
      if (ans || f.fallbackEnding) {
        ui.finaleSubmit = null;
        E.finaleInput.disabled = true;
        E.finaleMsg.textContent = '';
        if (ans) applyEffects(ans);
        S.finaleAnswer = val;
        await feedLetters(val);
        E.screenFinale.hidden = true;
        return ans ? ans.ending : f.fallbackEnding;
      }
      Sfx.deny(); fx('shake');
      E.finaleMsg.innerHTML = richHTML(f.mismatchText || '등록되지 않은 식별명입니다. 다시 입력하십시오.');
      try { E.finaleInput.select(); } catch (e) { /* 무시 */ }
    }
  }

  async function feedLetters(val) {
    const from = E.finaleInput.getBoundingClientRect();
    const to = E.finaleCanvas.getBoundingClientRect();
    const cs = chars(val.trim());
    E.finaleInput.value = '';
    E.finaleInput.placeholder = '';
    Sfx.whoosh();
    const anims = cs.map((c, i) => {
      const s = h('span', 'fly-char', c);
      const x = from.left + from.width / 2 + (i - (cs.length - 1) / 2) * 26 - 10;
      const y = from.top + from.height / 2 - 16;
      Object.assign(s.style, { left: x + 'px', top: y + 'px' });
      E.finaleFly.appendChild(s);
      const dx = to.left + to.width / 2 - x, dy = to.top + to.height * 0.7 - y;
      if (!s.animate) return Promise.resolve();
      const a = s.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.3}px, ${dy * 0.2 - 30}px) scale(1.3) rotate(${(Math.random() - 0.5) * 40}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) scale(.2) rotate(${(Math.random() - 0.5) * 360}deg)`, opacity: 0 }
      ], { duration: reduceMotion ? 200 : 1100, delay: i * 120, easing: 'cubic-bezier(.5,0,.75,1)', fill: 'forwards' });
      return new Promise((r) => { a.onfinish = () => { s.remove(); r(); }; });
    });
    await wait((res) => { Promise.all(anims).then(res); });
    Sfx.burn();
    if (ui.finaleFire) ui.finaleFire.boost(3);
    fx('flash');
    await sleep(1500);
  }

  function resolveEnding(id) {
    const vs = D.endings[id];
    if (!vs || !vs.length) return null;
    return vs.find((v) => evalCond(v.condition)) || vs[vs.length - 1];
  }

  async function playEnding(id) {
    S.phase = 'ending';
    refreshLock();
    LS.del(KEY_SAVE);
    const meta = LS.get(KEY_META, { endings: [] });
    if (id && !meta.endings.includes(id)) { meta.endings.push(id); LS.set(KEY_META, meta); }
    E.screenFinale.hidden = true;
    E.btnEndShift.hidden = true;
    let e = resolveEnding(id);
    if (!e) {
      warn(`엔딩 "${id}" 데이터가 없어 기본 종료 화면을 표시합니다.`);
      e = { title: '기록 종료', epilogue: `(엔딩 데이터 없음: ${id || '-'})`, dialogues: [] };
    }
    if (e.background) setBackground(e.background);
    if (e.bgmMood) Sfx.setMood(e.bgmMood);
    await runDialogue(e.dialogues);
    E.endingTitle.innerHTML = richHTML(e.title);
    E.endingText.innerHTML = '';
    E.endingText.hidden = !e.epilogue;
    E.endingStats.innerHTML = [
      ['소각', S.burned.length], ['은닉', S.hidden.length], ['지워진 자기 기억', S.burnedSelf], ['총 열량', S.totalHeat], ['감찰 의심', Math.round(S.suspicion)]
    ].map(([k, v]) => `<span>${k} ${v}</span>`).join('');
    E.screenEnding.hidden = false;
    E.btnEndingBack.hidden = true;
    await sleep(700);
    await typeText(E.endingText, e.epilogue || '', { speed: Math.round(settings.speed * 1.3) });
    E.btnEndingBack.hidden = false;
  }

  // ════════════════════════ 13. 챕터 진행 ════════════════════════
  async function playChapter(ch) {
    S.chapterIndex = ch.index;
    S.phase = 'intro';
    S.dayHeat = 0; S.dayLog = [];
    saveGame();
    resetReader(); renderTray([]);
    E.btnEndShift.hidden = true;
    setBackground(ch.background);
    if (ch.bgmMood) Sfx.setMood(ch.bgmMood);
    ui.lastNotebookVisible = visibleNotebook().length;
    updateHUD();
    await showDayCard(ch);
    await dialogue(ch.dialogues);
    const mems = ch.seizedMemories.filter((m) => evalCond(m.condition) && !S.processed.includes(m.id));
    if (mems.length) {
      await workPhase(ch, mems);
      if (!ch.skipReport) await dayReport(ch);
      else S.quota[ch.id] = ch.quota <= 0 || S.dayHeat >= ch.quota;
    } else if (S.quota[ch.id] == null) S.quota[ch.id] = true;
    S.phase = 'outro'; refreshLock();
    await dialogue(ch.outroDialogues);
  }

  function resolveNext(ch) {
    const n = ch.next;
    const byId = (id) => { const c = D.chapters.find((x) => x.id === id); return c ? { index: c.index } : { index: D.chapters.length }; };
    if (n == null) return { index: ch.index + 1 };
    if (typeof n === 'string') return n.startsWith('ending:') ? { ending: n.slice(7) } : byId(n);
    for (const opt of arr(n)) {
      if (typeof opt === 'string') return opt.startsWith('ending:') ? { ending: opt.slice(7) } : byId(opt);
      if (opt && evalCond(opt.condition)) return opt.ending ? { ending: opt.ending } : byId(opt.chapter);
    }
    return { index: ch.index + 1 };
  }

  async function runFrom(index) {
    let idx = index;
    try {
      for (;;) {
        const ch = D.chapters[idx];
        if (!ch) { await playEnding(D.meta.defaultEnding); return; }
        await playChapter(ch);
        if (ch.finale) { const endId = await finalePhase(ch); await playEnding(endId); return; }
        const nx = resolveNext(ch);
        if (nx.ending) { await playEnding(nx.ending); return; }
        idx = nx.index;
      }
    } catch (err) {
      if (err instanceof Abort) return;
      if (err instanceof GameOver) {
        abortFlow();
        closeModal();
        E.screenReport.hidden = true; E.screenDay.hidden = true;
        setDialogueOpen(false);
        try { await playEnding(D.meta.gameOverEnding); } catch (e2) { if (!(e2 instanceof Abort)) console.error(e2); }
        return;
      }
      console.error(err);
      toast('엔진 오류: ' + esc(err.message), 'warn', 9000);
    }
  }

  // ════════════════════════ 14. 타이틀 · 시작 ════════════════════════
  function hideScreens() { [E.screenDay, E.screenReport, E.screenFinale, E.screenEnding].forEach((s) => { s.hidden = true; }); }
  function refreshTitle() {
    const tt = String(D.meta.title), cut = tt.indexOf(':');
    if (cut > 0) { E.titleStamp.innerHTML = richHTML(tt.slice(0, cut).trim()); E.titleMain.innerHTML = richHTML(tt.slice(cut + 1).trim()); }
    else E.titleMain.innerHTML = richHTML(tt);
    E.titleSub.innerHTML = richHTML(D.meta.subtitle);
    const save = loadSave();
    E.btnContinue.hidden = !save;
    if (save) E.btnContinue.textContent = `이어서 근무 · ${S && D.chapters[save.state.chapterIndex] ? (save.state.chapterIndex + 1) + '일차' : ''}`;
    const meta = LS.get(KEY_META, { endings: [] });
    const total = Object.keys(D.endings).length;
    E.titleMeta.textContent = total ? `확인한 엔딩 ${meta.endings.filter((x) => D.endings[x]).length} / ${total}` : '';
    E.titleWarn.hidden = !WARN.length;
    if (WARN.length) {
      E.titleWarnSum.textContent = `데이터 점검: 확인할 항목 ${WARN.length}건`;
      E.titleWarnList.innerHTML = WARN.map((w) => `<li>${esc(w)}</li>`).join('');
    }
  }
  function showTitle() {
    abortFlow();
    closeModal();
    hideScreens();
    setDialogueOpen(false); hidePortrait();
    S = freshState();
    ui.busy = false;
    resetReader(); renderTray([]);
    E.btnEndShift.hidden = true;
    E.bgImage.classList.remove('on');
    Sfx.setMuffle(0); Sfx.setMood('calm');
    updateHUD();
    refreshTitle();
    E.screenTitle.hidden = false;
  }
  function startGame(fromSave) {
    Sfx.init(); Sfx.setMuted(settings.muted);
    abortFlow();
    hideScreens();
    E.screenTitle.hidden = true;
    let idx = 0;
    S = freshState();
    ui.busy = false; ui.current = null;
    if (fromSave) {
      const s = loadSave();
      if (s) { S = Object.assign(freshState(), s.state); idx = S.chapterIndex; }
    }
    S.phase = 'intro';
    applyMuffle();
    updateHUD();
    runFrom(idx);
  }

  // ════════════════════════ 15. 불꽃 캔버스 ════════════════════════
  function FireFX(canvas, getLevel) {
    const c = canvas.getContext('2d');
    if (!c) return { boost() {} };
    let w = 1, hh = 1, boost = 0;
    const P = [];
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); hh = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize();
    function frame() {
      requestAnimationFrame(frame);
      if (document.hidden || canvas.offsetParent === null) return;
      const lvl = getLevel();
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, w, hh);
      c.globalCompositeOperation = 'lighter';
      const scale = Math.max(0.6, w / 140);
      const n = Math.round(1 + lvl * 3 + boost * 6);
      for (let i = 0; i < n; i++) {
        P.push({ x: w * (0.5 + (Math.random() - 0.5) * 0.75), y: hh + 6, vx: (Math.random() - 0.5) * 0.5, vy: -(0.7 + Math.random() * 1.5) * Math.max(1, hh / 140), life: 0, max: 36 + Math.random() * 36, r: (7 + Math.random() * 10) * scale, ph: Math.random() * 6 });
      }
      boost *= 0.965;
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.life++;
        const t = p.life / p.max;
        if (t >= 1) { P.splice(i, 1); continue; }
        p.x += p.vx + Math.sin(p.life * 0.12 + p.ph) * 0.4;
        p.y += p.vy * (0.6 + lvl * 0.7 + boost * 0.4);
        const r = p.r * (1 - t * 0.65) * (0.6 + lvl * 0.6 + boost * 0.25);
        const a = (1 - t) * (0.32 + lvl * 0.25);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255,${(215 - t * 140) | 0},${(110 - t * 100) | 0},${a})`);
        g.addColorStop(1, 'rgba(255,50,0,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
      }
      if (P.length > 500) P.splice(0, P.length - 500);
    }
    requestAnimationFrame(frame);
    return { boost(v) { boost = Math.min(4, boost + v); } };
  }

  // ════════════════════════ 16. 디버그 패널 (#debug) ════════════════════════
  function setupDebug() {
    if (!/debug/.test(location.hash + location.search)) return;
    const p = E.debugPanel; p.hidden = false;
    const render = () => {
      p.innerHTML = '<b>DEBUG</b><br>';
      D.chapters.forEach((c, i) => { const b = h('button', '', c.id); b.onclick = () => { Sfx.init(); abortFlow(); closeModal(); hideScreens(); E.screenTitle.hidden = true; S.phase = 'intro'; runFrom(i); }; p.appendChild(b); });
      [['의심 +20', () => addSuspicion(20)], ['열량 +100', () => { S.dayHeat += 100; updateHUD(); }], ['자기기억 소각 +1', () => { S.burnedSelf++; applyMuffle(); updateHUD(); }],
        ['글리치', () => fx('glitch')], ['세이브 삭제', () => LS.del(KEY_SAVE)], ['상태', () => { pre.textContent = JSON.stringify(S, null, 1); }]
      ].forEach(([l, f]) => { const b = h('button', '', l); b.onclick = f; p.appendChild(b); });
      const pre = h('pre'); p.appendChild(pre);
    };
    render();
  }

  // ════════════════════════ 17. 입력 연결 · 부팅 ════════════════════════
  function bind() {
    E.btnNew.addEventListener('click', () => { Sfx.init(); Sfx.click(); startGame(false); });
    E.btnContinue.addEventListener('click', () => { Sfx.init(); Sfx.click(); startGame(true); });
    E.btnEndingBack.addEventListener('click', () => { Sfx.click(); showTitle(); });
    E.btnSound.addEventListener('click', (e) => { e.stopPropagation(); Sfx.init(); toggleSound(); });
    E.btnMenu.addEventListener('click', (e) => { e.stopPropagation(); Sfx.init(); openMenu(); });

    const advance = () => { if (ui.advance) ui.advance(); };
    E.windowView.addEventListener('click', (e) => { if (e.target.closest('.choice-btn')) return; advance(); });
    E.desk.addEventListener('click', (e) => { if (ui.dialogueOpen && !e.target.closest('.tool')) advance(); });
    E.readerScreen.addEventListener('click', () => { if (!ui.dialogueOpen) advance(); });
    E.screenDay.addEventListener('click', advance);
    E.screenEnding.addEventListener('click', (e) => { if (!e.target.closest('button')) advance(); });
    E.finalePrompt.addEventListener('click', advance);

    E.gradeRow.addEventListener('click', (e) => { const b = e.target.closest('.grade-btn'); if (b && !b.disabled) stampGrade(b.dataset.grade); });
    E.btnBurn.addEventListener('click', () => { if (!E.btnBurn.disabled && ui.actionResolver) ui.actionResolver('burn'); });
    E.btnHide.addEventListener('click', () => { if (!E.btnHide.disabled && ui.actionResolver) ui.actionResolver('hide'); });
    E.btnEndShift.addEventListener('click', () => { Sfx.click(); if (ui.endShift) ui.endShift(); });

    E.toolNotebook.addEventListener('click', (e) => { e.stopPropagation(); openNotebook(); });
    E.toolManual.addEventListener('click', (e) => { e.stopPropagation(); openManual(); });
    E.toolCalendar.addEventListener('click', (e) => { e.stopPropagation(); openCalendar(); });
    E.toolDrawer.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });
    E.modalClose.addEventListener('click', closeModal);
    E.modal.addEventListener('click', (e) => { if (e.target === E.modal) closeModal(); });

    E.finaleForm.addEventListener('submit', (e) => { e.preventDefault(); if (ui.finaleSubmit) ui.finaleSubmit(E.finaleInput.value); });
    E.finaleInput.addEventListener('input', () => Sfx.type(true));
    E.finaleInput.addEventListener('keydown', (e) => { if (e.key === 'Backspace') Sfx.type(true); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!E.modal.hidden) closeModal(); return; }
      if (!E.modal.hidden) return;
      const typing = document.activeElement === E.finaleInput;
      if (typing) return;
      if (ui.choiceKeys && /^[1-9]$/.test(e.key)) { e.preventDefault(); ui.choiceKeys(Number(e.key) - 1); return; }
      if ((e.key === ' ' || e.key === 'Enter') && ui.advance) {
        if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !ui.dialogueOpen) return;
        e.preventDefault(); advance();
      }
    });
    // 첫 입력에서 오디오 잠금 해제 (iOS)
    const unlock = () => { if (Sfx.ready) Sfx.init(); };
    document.addEventListener('pointerdown', unlock, { passive: true });
  }

  function boot() {
    bind();
    E.btnSound.classList.toggle('off', settings.muted);
    E.gradeRow.hidden = !rules.requireGrade;
    ui.fire = FireFX(E.fireCanvas, () => ui.fireLevel);
    ui.finaleFire = FireFX(E.finaleCanvas, () => 0.7);
    setupDebug();
    showTitle();
  }

  // 외부(테스트·디버그)용 핸들
  window.Incinerator = {
    get state() { return S; }, data: D, warnings: WARN, evalCond, plain,
    ui, runFrom, showTitle, startGame,
    _pick: (id) => pick(MEM[id]), _act: (a) => ui.actionResolver && ui.actionResolver(a), _grade: stampGrade,
    _advance: () => ui.advance && ui.advance(), _submitFinale: (v) => ui.finaleSubmit && ui.finaleSubmit(v),
    _endShift: () => ui.endShift && ui.endShift()
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
