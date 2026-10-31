import React from 'react';
import type { ClassItem } from '../types';
import { CardMarkers } from '../lib/markers';
import { getStudentList } from '../lib/export';

interface PrintCardsModalProps {
  cls: ClassItem;
  onClose: () => void;
}

export const PrintCardsModal: React.FC<PrintCardsModalProps> = ({ cls, onClose }) => {
  const students = getStudentList(cls);

  const handlePrint = () => {
    window.print();
  };

  // Generate standalone HTML file for guaranteed PDF export on any device
  const handleExportStandaloneHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Phiếu trả lời A4 - ${cls.name}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; color: #000; font-family: "Segoe UI", system-ui, sans-serif; }
    .page {
      width: 210mm;
      height: 297mm;
      page-break-after: always;
      break-after: page;
      padding: 10mm 14mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      background: #fff;
    }
    .card-frame {
      width: 100%;
      height: 240mm;
      border: 3.5px dashed #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 8mm;
      position: relative;
    }
    .letter-a {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(0deg);
    }
    .letter-b {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(90deg);
    }
    .letter-c {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(180deg);
    }
    .letter-d {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      transform: rotate(270deg);
    }
    .letter-main {
      font-size: 54px;
      font-weight: 900;
    }
    .letter-sub {
      font-size: 16px;
      font-weight: 800;
      border-bottom: 2px solid #000;
      padding: 0 4px;
      margin-top: 2px;
    }
    .mid-row {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 4mm;
    }
    .marker-box {
      width: 140mm;
      height: 140mm;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #ccc;
    }
    .marker-box svg {
      width: 100%;
      height: 100%;
    }
    .card-footer {
      width: 100%;
      border-top: 3.5px solid #000;
      padding-top: 4mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .student-info {
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .class-info {
      font-size: 16px;
      font-weight: 700;
      color: #333;
    }
    .hint-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #2F54D0;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      z-index: 9999;
    }
    .hint-bar button {
      background: #fff;
      color: #000;
      border: 2px solid #000;
      padding: 6px 16px;
      font-weight: bold;
      cursor: pointer;
    }
    @media print {
      .hint-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="hint-bar">
    <span>Phiếu trả lời ${cls.name} (${students.length} trang A4) · Bấm Ctrl + P hoặc nút In để lưu file PDF</span>
    <button onclick="window.print()">In thẻ / Lưu PDF</button>
  </div>
  ${students.map((studentName, i) => {
    const studentId = i + 1;
    const svg = CardMarkers.svg(studentId);
    return `
    <div class="page">
      <div class="card-frame">
        <div class="letter-a">
          <span class="letter-main">A</span>
          <span class="letter-sub">ĐÚNG</span>
        </div>

        <div class="mid-row">
          <div class="letter-d">
            <span class="letter-main">D</span>
          </div>

          <div class="marker-box">
            ${svg}
          </div>

          <div class="letter-b">
            <span class="letter-main">B</span>
            <span class="letter-sub">SAI</span>
          </div>
        </div>

        <div class="letter-c">
          <span class="letter-main">C</span>
        </div>
      </div>

      <div class="card-footer">
        <div>
          <div class="student-info">#${String(studentId).padStart(2, '0')} · ${studentName}</div>
          <div class="class-info">Lớp: ${cls.name} ${cls.subject ? '· Môn: ' + cls.subject : ''}</div>
        </div>
        <div style="font-size: 13px; font-weight: 600; text-align: right; color: #555;">
          Hệ thống tương tác NDH<br>Chọn đáp án nào, xoay chữ đó lên trên
        </div>
      </div>
    </div>`;
  }).join('')}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // Fallback download if popup is blocked
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bo-the-A4-${cls.name}.html`;
      a.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      {/* Modal Actions Header - hidden on print */}
      <div className="sticky top-0 bg-white border-b-4 border-black p-4 flex justify-between items-center gap-4 flex-wrap z-10 no-print max-w-5xl mx-auto my-4 shadow-2xl">
        <div>
          <h2 className="text-2xl font-black">Bộ phiếu trả lời A4: {cls.name}</h2>
          <p className="text-sm font-bold text-neutral-700">
            {students.length} học sinh · Mỗi học sinh 1 trang A4 hoàn chỉnh · Chữ xoay theo hướng giơ thẻ
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="ndh-btn ndh-btn-pri text-lg px-6 flex items-center gap-2"
            onClick={handlePrint}
            title="Mở hộp thoại in, chọn 'Lưu dưới dạng PDF'"
          >
            🖨 In ngay / Lưu PDF
          </button>

          <button
            className="ndh-btn text-base px-4 bg-emerald-100 hover:bg-emerald-200"
            onClick={handleExportStandaloneHtml}
            title="Mở file in trong tab riêng biệt để xuất PDF không bị lỗi"
          >
            📄 Mở trang in độc lập
          </button>

          <button className="ndh-btn" onClick={onClose}>
            ✕ Đóng
          </button>
        </div>
      </div>

      {/* Notice info on preview screen */}
      <div className="max-w-4xl mx-auto mb-4 bg-amber-50 border-3 border-black p-3 text-sm font-semibold no-print">
        💡 <b>Mẹo xuất PDF chuẩn:</b> Trong hộp thoại in của trình duyệt, tại mục <b>Máy in đích (Destination)</b> chọn <b>Lưu dưới dạng PDF (Save as PDF)</b>. Bố cục sẽ tự động chia <b>1 học sinh = đúng 1 trang A4</b>.
      </div>

      {/* Main Print Container: Only this container is printed */}
      <div id="print-area">
        {students.length === 0 ? (
          <div className="bg-white p-12 text-center text-lg font-bold text-neutral-500 max-w-4xl mx-auto">
            Chưa có học sinh nào. Hãy nhập danh sách học sinh trước.
          </div>
        ) : (
          students.map((studentName, i) => {
            const studentId = i + 1;
            const svgContent = CardMarkers.svg(studentId);

            return (
              <div key={studentId} className="a4-card-page mx-auto shadow-2xl my-6 print:my-0 print:shadow-none">
                {/* Dashed outer card frame for student positioning */}
                <div className="w-full h-[236mm] border-[3.5px] border-dashed border-black flex flex-col justify-between items-center p-6 relative bg-white">
                  {/* Top Edge: A (ĐÚNG) - Facing upward (rotate-0) */}
                  <div className="flex flex-col items-center leading-none select-none">
                    <b className="text-6xl font-black tracking-wider">A</b>
                    <span className="text-sm font-black tracking-widest text-black mt-1 border-b-2 border-black px-2">
                      ĐÚNG
                    </span>
                  </div>

                  {/* Middle Row: D (Left, rotate 270) - ArUco Marker - B (Right, rotate 90) */}
                  <div className="w-full flex items-center justify-between px-2">
                    {/* D Left: rotated -90deg (270deg) so when student rotates card with D at top, D is right-side up! */}
                    <div className="flex flex-col items-center leading-none select-none -rotate-90 origin-center w-16">
                      <b className="text-6xl font-black">D</b>
                    </div>

                    {/* Big ArUco Center Marker (140mm x 140mm) */}
                    <div
                      className="w-[140mm] h-[140mm] flex items-center justify-center p-2 bg-white border border-neutral-300"
                      dangerouslySetInnerHTML={{ __html: svgContent }}
                    />

                    {/* B Right: rotated 90deg clockwise so when student rotates card with B at top, B is right-side up! */}
                    <div className="flex flex-col items-center leading-none select-none rotate-90 origin-center w-16">
                      <b className="text-6xl font-black tracking-wider">B</b>
                      <span className="text-sm font-black tracking-widest text-black mt-1 border-b-2 border-black px-2">
                        SAI
                      </span>
                    </div>
                  </div>

                  {/* Bottom Edge: C - Upside down (rotate 180) so when card is flipped with C at top, C is right-side up! */}
                  <div className="flex flex-col items-center leading-none select-none rotate-180 origin-center">
                    <b className="text-6xl font-black tracking-wider">C</b>
                  </div>
                </div>

                {/* Card Footer: Student ID, Student Name, Class, and Subject */}
                <div className="w-full border-t-[3.5px] border-black pt-3 mt-2 flex justify-between items-end">
                  <div>
                    <h3 className="text-2xl font-black text-black tracking-tight">
                      #{String(studentId).padStart(2, '0')} · {studentName}
                    </h3>
                    <p className="text-base font-bold text-neutral-700 mt-0.5">
                      Lớp: {cls.name} {cls.subject ? `· Môn: ${cls.subject}` : ''}
                    </p>
                  </div>

                  <div className="text-right text-xs font-bold text-neutral-600 leading-tight">
                    Hệ thống tương tác NDH<br />
                    <span className="text-black font-black">Chọn đáp án nào, xoay chữ đó lên trên</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
