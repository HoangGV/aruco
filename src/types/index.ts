export interface StudentResult {
  id: number;
  name: string;
  score: number;
}

export interface ClassResult {
  at: number;
  total: number;
  rows: StudentResult[];
}

export interface ClassItem {
  id: string;
  name: string;
  subject: string;
  names: string;
  md: string;
  sec: number;
  elim: boolean;
  results: ClassResult[];
}

export interface AppData {
  teacher: string;
  classes: ClassItem[];
}

export type QuestionType = 'mcq' | 'tf';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  answer: string;
  explanation: string;
  seconds: number;
  sourceLabel?: string;
  sourceNumber?: number | null;
  sourceKind?: string;
}

export interface Player {
  id: number;
  name: string;
  alive: boolean;
  score: number;
}

export interface RoundResults {
  correctIds: number[];
  wrongIds: number[];
  missingIds: number[];
  counts: Record<string, number>;
  total: number;
}

export interface GameHistoryItem {
  questionId: string;
  index: number;
  question: Question;
  submissions: Record<number, string>;
  results: RoundResults;
  at: number;
}

export type Phase = 'lobby' | 'question' | 'paused' | 'revealed' | 'finished';

export interface SessionState {
  code: string;
  hostKey?: string;
  pairKey?: string;
  pairPin?: string;
  createdAt?: number;
  expiresAt?: number;
  config: {
    eliminate: boolean;
    seconds: number;
  };
  players: Player[];
  questions?: Question[];
  currentQuestion?: Question | null;
  index: number;
  phase: Phase;
  deadline: number | null;
  remainingMs: number | null;
  submissions: Record<number, string>;
  results: RoundResults | null;
  history?: GameHistoryItem[];
  revision: number;
  questionCount: number;
  scannerSeenAt: number | null;
}

export interface MarkerDetection {
  id: number;
  answer: 'A' | 'B' | 'C' | 'D';
  corners: { x: number; y: number }[];
  angle: number;
  hammingDistance: number;
}
