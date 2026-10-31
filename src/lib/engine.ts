import type { Player, Question, SessionState, RoundResults, Phase } from '../types';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export const randomHex = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');

export const randomDigits = (): string =>
  String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');

function fail(m: string): never {
  throw new Error(m);
}

export interface EngineInput {
  config: {
    eliminate: boolean;
    seconds: number;
    [key: string]: any;
  };
  players: { id: number; name: string }[];
  questions: Question[];
}

export function cleanInput(input: EngineInput): {
  config: any;
  players: Player[];
  questions: Question[];
} {
  if (!input || typeof input !== 'object') fail('Dữ liệu phòng chưa hợp lệ.');
  const { config, players, questions } = input;
  if (!Array.isArray(players) || !players.length || players.length > 250) {
    fail('Danh sách cần từ 1 đến 250 học sinh.');
  }
  if (!Array.isArray(questions) || !questions.length || questions.length > 200) {
    fail('Bộ đề cần từ 1 đến 200 câu.');
  }

  const ids = new Set<number>();
  const ps: Player[] = players.map(p => {
    if (!Number.isInteger(p.id) || p.id < 1 || p.id > 250 || ids.has(p.id) ||
        typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120) {
      fail('Tên hoặc số thẻ học sinh chưa hợp lệ.');
    }
    ids.add(p.id);
    return { id: p.id, name: p.name.trim(), alive: true, score: 0 };
  });

  const qs = new Set<string>();
  const qu: Question[] = questions.map(q => {
    if (!q || typeof q.id !== 'string' || qs.has(q.id) || !['mcq', 'tf'].includes(q.type) ||
        typeof q.text !== 'string' || !q.text.trim() || q.text.length > 10000) {
      fail('Nội dung hoặc mã câu hỏi chưa hợp lệ.');
    }
    qs.add(q.id);
    const len = q.type === 'tf' ? 2 : 4;
    if (!Array.isArray(q.options) || q.options.length !== len ||
        q.options.some(x => typeof x !== 'string' || !x.trim() || x.length > 4000) ||
        !'ABCD'.slice(0, len).includes(q.answer) || q.answer.length !== 1) {
      fail('Các phương án hoặc đáp án đúng chưa hợp lệ.');
    }
    const seconds = Number(q.seconds || config?.seconds || 30);
    if (!Number.isInteger(seconds) || seconds < 5 || seconds > 600) {
      fail('Thời gian cần là số nguyên từ 5 đến 600 giây.');
    }
    return {
      sourceLabel: String(q.sourceLabel || '').slice(0, 120),
      sourceNumber: Number.isSafeInteger(q.sourceNumber) ? q.sourceNumber : null,
      sourceKind: String(q.sourceKind || '').slice(0, 60),
      id: q.id,
      type: q.type,
      text: q.text,
      options: clone(q.options),
      answer: q.answer,
      explanation: String(q.explanation || '').slice(0, 10000),
      seconds
    };
  });

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    fail('Thiết lập phòng chưa hợp lệ.');
  }

  return { config: clone(config), players: ps, questions: qu };
}

export function createSession(input: EngineInput, now = Date.now()): SessionState {
  const v = cleanInput(input);
  return {
    code: randomDigits(),
    hostKey: randomHex(),
    pairKey: randomHex(),
    pairPin: randomDigits(),
    createdAt: now,
    expiresAt: now + 7 * 86400000,
    config: v.config,
    players: v.players,
    questions: v.questions,
    index: -1,
    phase: 'lobby',
    deadline: null,
    remainingMs: null,
    submissions: {},
    results: null,
    history: [],
    revision: 0,
    scannerSeenAt: null,
    questionCount: v.questions.length
  };
}

export function settleSession(s: SessionState, now = Date.now()): boolean {
  if (!['question', 'paused'].includes(s.phase)) return false;
  const q = s.questions![s.index];
  const eligible = s.players.filter(p => p.alive);
  const results: RoundResults = {
    correctIds: [],
    wrongIds: [],
    missingIds: [],
    counts: { A: 0, B: 0, C: 0, D: 0 },
    total: eligible.length
  };

  for (const p of eligible) {
    const a = s.submissions[p.id];
    if (a && results.counts[a] !== undefined) results.counts[a]++;
    if (a === q.answer) {
      results.correctIds.push(p.id);
      p.score += 10;
    } else {
      (a ? results.wrongIds : results.missingIds).push(p.id);
      if (s.config.eliminate) p.alive = false;
    }
  }

  s.results = results;
  s.phase = 'revealed';
  s.deadline = null;
  s.remainingMs = null;
  s.revision++;
  if (!s.history) s.history = [];
  s.history.push({
    questionId: q.id,
    index: s.index,
    question: clone(q),
    submissions: clone(s.submissions),
    results: clone(results),
    at: now
  });
  return true;
}

export function autoSession(s: SessionState, now = Date.now()): boolean {
  if (s.phase === 'question' && s.deadline && now >= s.deadline) {
    return settleSession(s, now);
  }
  return false;
}

function beginQuestion(s: SessionState, i: number, now: number) {
  s.index = i;
  s.phase = 'question';
  s.deadline = now + s.questions![i].seconds * 1000;
  s.remainingMs = null;
  s.submissions = {};
  s.results = null;
  s.revision++;
}

export function actSession(s: SessionState, action: string, now = Date.now(), arg?: any): SessionState {
  autoSession(s, now);
  switch (action) {
    case 'start':
      if (s.phase === 'question') break;
      if (s.phase !== 'lobby') fail('Hãy dùng Chơi lại hoặc Câu tiếp theo.');
      beginQuestion(s, 0, now);
      break;

    case 'next':
      if (s.phase !== 'revealed') fail('Cần công bố câu hiện tại trước.');
      if (s.index + 1 >= s.questions!.length || (s.config.eliminate && !s.players.some(p => p.alive))) {
        s.phase = 'finished';
        s.revision++;
      } else {
        beginQuestion(s, s.index + 1, now);
      }
      break;

    case 'pause':
      if (s.phase === 'paused') break;
      if (s.phase !== 'question') fail('Không có câu đang đếm giờ.');
      s.remainingMs = Math.max(0, (s.deadline || now) - now);
      s.deadline = null;
      s.phase = 'paused';
      s.revision++;
      break;

    case 'resume':
      if (s.phase === 'question') break;
      if (s.phase !== 'paused') fail('Câu hỏi chưa tạm dừng.');
      s.deadline = now + (s.remainingMs || 0);
      s.remainingMs = null;
      s.phase = 'question';
      s.revision++;
      break;

    case 'reveal':
      if (['revealed', 'finished'].includes(s.phase)) break;
      if (!['question', 'paused'].includes(s.phase)) fail('Chưa có câu để công bố.');
      settleSession(s, now);
      break;

    case 'finish':
      if (s.phase === 'finished') break;
      settleSession(s, now);
      s.phase = 'finished';
      s.revision++;
      break;

    case 'rescue':
      (arg && arg.ids || []).forEach((id: number) => {
        const p = s.players.find(x => x.id === id);
        if (p) p.alive = true;
      });
      s.revision++;
      break;

    case 'reset':
      s.players.forEach(p => {
        p.alive = true;
        p.score = 0;
      });
      s.index = -1;
      s.phase = 'lobby';
      s.deadline = null;
      s.remainingMs = null;
      s.submissions = {};
      s.results = null;
      s.history = [];
      s.revision++;
      break;

    default:
      fail('Lệnh điều khiển chưa hợp lệ.');
  }
  return s;
}

export function submitAnswers(s: SessionState, input: { questionId: string; batch: { id: number; answer: string }[] }, now = Date.now()): number {
  autoSession(s, now);
  if (s.phase !== 'question') fail('Đã đóng lượt trả lời.');
  const curQ = s.questions![s.index];
  if (!input || input.questionId !== curQ.id) {
    fail('Câu hỏi đã thay đổi. Hãy chờ đồng bộ.');
  }
  if (!Array.isArray(input.batch) || !input.batch.length || input.batch.length > 250) {
    fail('Lượt gửi đáp án chưa hợp lệ.');
  }

  const valid = 'ABCD'.slice(0, curQ.type === 'tf' ? 2 : 4);
  const seen = new Set<number>();
  for (const a of input.batch) {
    const p = s.players.find(x => x.id === a.id);
    if (!p || !p.alive || seen.has(a.id) || typeof a.answer !== 'string' || a.answer.length !== 1 || !valid.includes(a.answer)) {
      fail('Có số thẻ hoặc lựa chọn chưa hợp lệ.');
    }
    seen.add(a.id);
  }

  let changed = false;
  for (const a of input.batch) {
    if (s.submissions[a.id] !== a.answer) {
      s.submissions[a.id] = a.answer;
      changed = true;
    }
  }
  if (changed) s.revision++;
  return input.batch.length;
}

export function viewSession(s: SessionState, role: 'host' | 'scanner' = 'host', now = Date.now()): Partial<SessionState> {
  autoSession(s, now);
  const curQ = s.questions ? s.questions[s.index] : null;
  const out: any = {
    code: s.code,
    config: clone(s.config),
    players: clone(s.players),
    index: s.index,
    phase: s.phase,
    deadline: s.deadline,
    remainingMs: s.remainingMs,
    submissions: clone(s.submissions),
    results: clone(s.results),
    revision: s.revision,
    scannerSeenAt: s.scannerSeenAt,
    questionCount: s.questions ? s.questions.length : (s.questionCount || 0),
    currentQuestion: curQ ? clone(curQ) : null
  };

  if (role === 'host') {
    out.questions = clone(s.questions);
    out.history = clone(s.history);
    out.pairKey = s.pairKey;
    out.pairPin = s.pairPin;
  } else if (out.currentQuestion && !['revealed', 'finished'].includes(s.phase)) {
    delete out.currentQuestion.answer;
    delete out.currentQuestion.explanation;
  }
  return out;
}

export const PortableEngine = {
  create: createSession,
  auto: autoSession,
  act: actSession,
  submit: submitAnswers,
  view: viewSession,
  randomHex,
  randomDigits
};
