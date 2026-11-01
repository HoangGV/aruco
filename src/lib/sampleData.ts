import type { ClassItem, QuizBank } from '../types';

export const DEFAULT_TEACHER = 'NgĐ Hoàng';

export const DEFAULT_STUDENTS = `1. Nguyễn Văn An
2. Trần Thị Bình
3. Lê Văn Cường
4. Phạm Hoàng Dũng
5. Đỗ Minh Hạnh
6. Bùi Quang Huy
7. Vũ Khánh Linh
8. Hoàng Ngọc Mai`;

export const SAMPLE_MD_TOAN = `## Hàm số $y=x^3-3x+1$ có đạo hàm là:
A. $3x^2-3$
B. $x^2-3$
C. $3x^2+1$
D. $3x-3$
Đáp án: A
Giải thích: Ta có $(x^3)' = 3x^2$, $(-3x)' = -3$, $(1)' = 0$. Do đó $y' = 3x^2 - 3$.
Thời gian: 30

## Đồ thị hàm số $y=\\frac{1}{x-2}$ có tiệm cận đứng là đường thẳng $x=2$.
Đáp án: Đúng
Giải thích: Khi $x \\to 2$, mẫu số tiến về $0$ nên $y \\to \\infty$. Do đó $x=2$ là tiệm cận đứng.
Thời gian: 25

## Giá trị nhỏ nhất của hàm số $f(x)=x^2-2x+3$ trên đoạn $[0; 3]$ bằng:
A. $3$
B. $6$
C. $2$
D. $1$
Đáp án: C
Giải thích: $f(x) = (x-1)^2 + 2 \\ge 2$ với mọi $x$. Dấu bằng xảy ra khi $x = 1 \\in [0;3]$.
Thời gian: 30

## Hàm số $y=-x^3+3x$ đồng biến trên toàn bộ tập số thực $\\mathbb{R}$.
Đáp án: Sai
Giải thích: Ta có $y' = -3x^2 + 3 = 0 \\iff x = \\pm 1$. Đạo hàm đổi dấu nên hàm số không đồng biến trên $\\mathbb{R}$.
Thời gian: 25

## Tích phân $I = \\int_0^1 (2x + 1)\\,dx$ có giá trị bằng:
A. $1$
B. $2$
C. $3$
D. $4$
Đáp án: B
Giải thích: $I = \\left[ x^2 + x \\right]_0^1 = (1 + 1) - 0 = 2$.
Thời gian: 30`;

export const SAMPLE_MD_VAT_LY = `## Một vật dao động điều hòa với phương trình $x = 4\\cos(2\\pi t + \\frac{\\pi}{3})$ (cm). Biên độ dao động của vật là:
A. $2$ cm
B. $4$ cm
C. $8$ cm
D. $2\\pi$ cm
Đáp án: B
Giải thích: Phương trình dao động điều hòa tổng quát $x = A\\cos(\\omega t + \\varphi)$, ở đây $A = 4$ cm.
Thời gian: 30

## Chu kỳ dao động nhỏ của con lắc đơn chiều dài $l$ ở nơi có gia tốc trọng trường $g$ là $T = 2\\pi\\sqrt{\\frac{l}{g}}$.
Đáp án: Đúng
Giải thích: Công thức chu kỳ con lắc đơn là $T = 2\\pi\\sqrt{\\frac{l}{g}}$, không phụ thuộc khối lượng vật nặng.
Thời gian: 25

## Trong thí nghiệm Y-âng về giao thoa ánh sáng, khoảng vân $i$ được tính theo công thức nào sau đây?
A. $i = \\frac{\\lambda D}{a}$
B. $i = \\frac{\\lambda a}{D}$
C. $i = \\frac{a D}{\\lambda}$
D. $i = \\frac{\\lambda}{a D}$
Đáp án: A
Giải thích: Khoảng cách giữa hai vân sáng liên tiếp là khoảng vân $i = \\frac{\\lambda D}{a}$.
Thời gian: 30

## Sóng cơ lan truyền được trong chân không.
Đáp án: Sai
Giải thích: Sóng cơ là dao động lan truyền trong môi trường vật chất đàn hồi (rắn, lỏng, khí), không lan truyền được trong chân không.
Thời gian: 20`;

export const SAMPLE_MD_SINH_HOC = `## Phép lai $Aa \\times Aa$ cho đời con $F_1$ có tỉ lệ kiểu hình trội : lặn (trội hoàn toàn) là:
A. $1 : 1$
B. $3 : 1$
C. $1 : 2 : 1$
D. $9 : 3 : 3 : 1$
Đáp án: B
Giải thích: Phép lai một cặp tính trạng của Menđen cho tỉ lệ kiểu gen $1AA : 2Aa : 1aa$, kiểu hình trội : lặn là $3 : 1$.
Thời gian: 30

## Trong cấu trúc của phân tử ADN, nguyên tắc bổ sung giữa các nucleotit là:
A. $A - U$ và $G - X$
B. $A - T$ và $G - X$
C. $A - G$ và $T - X$
D. $A - X$ và $T - G$
Đáp án: B
Giải thích: Ở ADN, Adenin liên kết với Timin bằng 2 liên kết hiđro ($A-T$), Guanin liên kết với Xitozin bằng 3 liên kết hiđro ($G-X$).
Thời gian: 30

## Đột biến gen là những biến đổi trong cấu trúc của gen liên quan đến một hoặc một số cặp nuclêôtit.
Đáp án: Đúng
Giải thích: Theo định nghĩa sinh học 12, đột biến gen là những biến đổi trong cấu trúc của gen, phổ biến nhất là đột biến điểm.
Thời gian: 25`;

export const SAMPLE_QUIZ_BANKS: QuizBank[] = [
  {
    id: 'qb_toan_12',
    title: 'Đề 1: Khảo sát hàm số & Giải tích 12',
    subject: 'Toán học',
    md: SAMPLE_MD_TOAN,
    sec: 30,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'qb_vat_ly_12',
    title: 'Đề 2: Dao động điều hòa & Sóng ánh sáng',
    subject: 'Vật lý',
    md: SAMPLE_MD_VAT_LY,
    sec: 30,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000
  },
  {
    id: 'qb_sinh_hoc_12',
    title: 'Đề 3: Quy luật di truyền & Đột biến gen',
    subject: 'Sinh học',
    md: SAMPLE_MD_SINH_HOC,
    sec: 30,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

export const SAMPLE_CLASSES: ClassItem[] = [
  {
    id: 'c_12a1',
    name: 'Lớp 12A1',
    subject: 'Toán học',
    names: DEFAULT_STUDENTS,
    md: SAMPLE_MD_TOAN,
    sec: 30,
    elim: false,
    results: []
  },
  {
    id: 'c_12a2',
    name: 'Lớp 12A2',
    subject: 'Vật lý',
    names: DEFAULT_STUDENTS,
    md: SAMPLE_MD_VAT_LY,
    sec: 30,
    elim: false,
    results: []
  }
];
