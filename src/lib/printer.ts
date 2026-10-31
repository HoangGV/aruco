import type { ClassItem } from '../types';
import { CardMarkers } from './markers';
import { getStudentList } from './export';

/**
 * Triggers native browser print dialog for student A4 cards directly
 * using an isolated print iframe, ensuring only the cards are printed
 * without any UI elements from the web app.
 */
export function printClassCards(cls: ClassItem): boolean {
  const students = getStudentList(cls);
  if (!students.length) return false;

  // Create an invisible, isolated printing iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return false;

  const pagesHtml = students.map((studentName, i) => {
    const studentId = i + 1;
    const svg = CardMarkers.svg(studentId);
    return `
      <div class="a4-page">
        <div class="card-border">
          <div class="letter-top">
            <span class="l-main">A</span>
            <span class="l-sub">ĐÚNG</span>
          </div>

          <div class="letter-mid">
            <div class="letter-left">
              <span class="l-main">D</span>
            </div>

            <div class="marker-container">
              ${svg}
            </div>

            <div class="letter-right">
              <span class="l-main">B</span>
              <span class="l-sub">SAI</span>
            </div>
          </div>

          <div class="letter-bot">
            <span class="l-main">C</span>
          </div>
        </div>

        <div class="card-footer">
          <div>
            <div class="student-title">#${String(studentId).padStart(2, '0')} · ${studentName}</div>
            <div class="class-title">Lớp: ${cls.name} ${cls.subject ? '· Môn: ' + cls.subject : ''}</div>
          </div>
          <div class="footer-note">
            Hệ thống tương tác NDH<br>
            <b>Xoay đáp án lên trên để chọn</b>
          </div>
        </div>
      </div>
    `;
  }).join('');

  doc.open();
  doc.write(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Phiếu trả lời A4 - ${cls.name}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 210mm;
      background: #ffffff;
      color: #000000;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .a4-page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      padding: 12mm 30mm; /* Lề trái - phải mỗi bên 3cm (30mm) */
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
    }
    .card-border {
      width: 150mm; /* 210mm - 60mm lề = 150mm */
      height: 236mm;
      border: 3.5px dashed #000000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 6mm 4mm;
    }
    .letter-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(0deg);
    }
    .letter-right {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(90deg);
      width: 32px;
    }
    .letter-bot {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(180deg);
    }
    .letter-left {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(-90deg);
      width: 32px;
    }
    .l-main {
      font-size: 28px;
      font-weight: 900;
    }
    .l-sub {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      border-bottom: 2px solid #000000;
      margin-top: 2px;
      padding: 0 3px;
    }
    .letter-mid {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 2mm;
    }
    .marker-container {
      width: 138mm;
      height: 138mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e0e0e0;
    }
    .marker-container svg {
      width: 100%;
      height: 100%;
    }
    .card-footer {
      width: 150mm;
      border-top: 3.5px solid #000000;
      padding-top: 3.5mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .student-title {
      font-size: 18px; /* Cỡ chữ 18 theo đúng yêu cầu */
      font-weight: 800;
      color: #000000;
    }
    .class-title {
      font-size: 13px;
      font-weight: 700;
      color: #333333;
      margin-top: 2px;
    }
    .footer-note {
      font-size: 11px;
      font-weight: 700;
      text-align: right;
      color: #666666;
      line-height: 1.3;
    }
    .footer-note b {
      color: #000000;
      font-weight: 800;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`);
  doc.close();

  // Give DOM 200ms to parse SVG before triggering browser print dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 200);

  return true;
}
