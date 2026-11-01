import type { Question, QuestionType } from '../types';

export const GUIDE = `## Nội dung câu hỏi (có thể nhiều dòng)
![mô tả](https://.../hinh.jpg)
![video](https://.../clip.mp4)
A. Phương án A
B. Phương án B
C. Phương án C
D. Phương án D
Đáp án: B
Giải thích: Lời giải thích (không bắt buộc)
Thời gian: 30

## Câu đúng/sai (A = Đúng, B = Sai)
Đáp án: Đúng`;

export function parseMarkdownQuestions(text: string, defaultSeconds = 30): { qs: Question[]; err: string[] } {
  const qs: Question[] = [];
  const err: string[] = [];

  (text || '').split(/^##[ \t]+/m).slice(1).forEach((b, i) => {
    const q = {
      t: [] as string[],
      o: {} as Record<string, string>,
      a: '',
      e: [] as string[],
      s: 0
    };
    let mode: 't' | 'o' | 'a' | 'e' | 's' = 't';
    let last = '';
    let m: RegExpMatchArray | null;

    for (const raw of b.split('\n')) {
      const l = raw.trimEnd();
      if ((m = l.match(/^([A-D])[.)]\s*(.*)$/))) {
        q.o[m[1]] = m[2];
        mode = 'o';
        last = m[1];
      } else if ((m = l.match(/^(?:Đáp án|Dap an)\s*:\s*(.+)$/i))) {
        q.a = m[1].trim();
        mode = 'a';
      } else if ((m = l.match(/^(?:Giải thích|Giai thich)\s*:\s*(.*)$/i))) {
        q.e.push(m[1]);
        mode = 'e';
      } else if ((m = l.match(/^(?:Thời gian|Thoi gian)\s*:\s*(\d+)/i))) {
        q.s = +m[1];
        mode = 's';
      } else if (mode === 't') {
        q.t.push(l);
      } else if (mode === 'e') {
        q.e.push(l);
      } else if (mode === 'o' && l.trim()) {
        q.o[last] += '\n' + l;
      }
    }

    const keys = Object.keys(q.o).sort().join('');
    const n = i + 1;
    const A = q.a.toUpperCase().replace(/Á/g, 'A');
    let type: QuestionType;
    let opts: string[];
    let ans = '';

    if (keys === 'ABCD') {
      type = 'mcq';
      opts = ['A', 'B', 'C', 'D'].map(k => q.o[k]);
      ans = /^[A-D]/.test(A) ? A[0] : '';
    } else if (keys === 'AB' || (keys === '' && /^(Đ|D|S|TRUE|FALSE|A|B)/i.test(q.a))) {
      type = 'tf';
      opts = keys ? [q.o.A, q.o.B] : ['Đúng', 'Sai'];
      ans = /^(Đ|DUNG|TRUE|A\b)/i.test(q.a) ? 'A' : /^(S|SAI|FALSE|B\b)/i.test(q.a) ? 'B' : '';
    } else {
      err.push(`Câu ${n}: cần đủ 4 phương án A–D (hoặc 2 phương án A, B cho Đúng/Sai).`);
      return;
    }

    const qText = q.t.join('\n').trim();
    if (!qText) {
      err.push(`Câu ${n}: thiếu nội dung câu hỏi.`);
    } else if (!ans) {
      err.push(`Câu ${n}: thiếu hoặc sai dòng "Đáp án:".`);
    } else if (opts.some(x => !String(x).trim())) {
      err.push(`Câu ${n}: có phương án trống.`);
    } else {
      qs.push({
        id: 'q' + n,
        type,
        text: qText,
        options: opts,
        answer: ans,
        explanation: q.e.join('\n').trim(),
        seconds: q.s >= 5 && q.s <= 600 ? q.s : defaultSeconds
      });
    }
  });

  return { qs, err };
}

export interface ParsedQuizItem {
  title: string;
  subject: string;
  md: string;
  sec: number;
}

export const BULK_GUIDE = `# Đề thi số 1
Môn: Toán học
## Hàm số $y=x^3-3x+1$ có đạo hàm là:
A. $3x^2-3$
B. $x^2-3$
C. $3x^2+1$
D. $3x-3$
Đáp án: A
Giải thích: Ta có $(x^3)' = 3x^2$, $(-3x)' = -3$.
Thời gian: 30

# Đề kiểm tra số 2 cho lớp 10
Môn: Vật lý
## Dao động điều hòa có phương trình $x = A\\cos(\\omega t + \\varphi)$.
Đáp án: Đúng
Thời gian: 30`;

/**
 * Phân tích văn bản markdown chứa nhiều bộ đề thi được phân tách bằng "# Tên đề thi"
 */
export function parseBulkQuizMarkdown(
  text: string,
  defaultSubject = 'Toán học',
  defaultSec = 30
): ParsedQuizItem[] {
  const lines = (text || '').split('\n');
  const quizzes: ParsedQuizItem[] = [];
  let currentTitle: string | null = null;
  let currentSubject = defaultSubject;
  let currentSec = defaultSec;
  let currentBody: string[] = [];

  const flush = () => {
    if (currentTitle && currentBody.length > 0) {
      quizzes.push({
        title: currentTitle.trim(),
        subject: currentSubject.trim() || defaultSubject,
        md: currentBody.join('\n').trim(),
        sec: currentSec
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Nhận diện dòng bắt đầu bằng "# " đơn lẻ (không phải "## " câu hỏi)
    const headingMatch = line.match(/^#[ \t]+(.*)$/);
    if (headingMatch && !line.startsWith('##')) {
      flush();
      currentTitle = headingMatch[1].trim();
      currentSubject = defaultSubject;
      currentSec = defaultSec;
      currentBody = [];
      continue;
    }

    if (currentTitle) {
      // Dòng tùy chọn môn học hoặc thời gian ngay dưới tiêu đề đề thi
      const subMatch = line.match(/^(?:Môn|Mon|Môn học|Mon hoc)\s*:\s*(.+)$/i);
      const secMatch = line.match(/^(?:Thời gian|Thoi gian)\s*:\s*(\d+)$/i);
      if (subMatch && currentBody.length === 0) {
        currentSubject = subMatch[1].trim();
        continue;
      }
      if (secMatch && currentBody.length === 0) {
        currentSec = Math.max(5, Math.min(600, +secMatch[1] || 30));
        continue;
      }
      currentBody.push(line);
    }
  }

  flush();
  return quizzes;
}

