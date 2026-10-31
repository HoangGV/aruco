import React from 'react';
import type { ClassItem } from '../types';
import { CardMarkers } from '../lib/markers';
import { getStudentList } from '../lib/export';
export { printClassCards } from '../lib/printCards';

interface PrintSheetProps {
  cls: ClassItem;
}

/**
 * PrintSheet Component
 * Mỗi thẻ là 1 trang A4 chuẩn (210mm x 297mm).
 * Khung thẻ 170mm cách lề trái - phải mỗi bên 2cm (tổng 2 lề 4cm).
 * Tên học sinh cỡ 18px.
 * Hướng đáp án xoay 4 chiều chuẩn.
 */
export const PrintSheet: React.FC<PrintSheetProps> = ({ cls }) => {
  const students = getStudentList(cls);

  if (students.length === 0) return null;

  return (
    <div className="print-area">
      {students.map((studentName, i) => {
        const studentId = i + 1;
        const svgContent = CardMarkers.svg(studentId);

        return (
          <article key={studentId} className="a4-card-page">
            {/* Khung thẻ 170mm cách lề trái - phải 2cm */}
            <div className="card-border-box">
              {/* Cạnh TRÊN: A (ĐÚNG) - 0° */}
              <div className="card-edge-top">
                <span className="card-letter-a">A</span>
                <span className="card-tag-dung">ĐÚNG</span>
              </div>

              {/* Hàng giữa: D (-90°) - Mã ArUco SVG - B (90°) */}
              <div className="card-middle-row">
                <div className="card-edge-left">
                  <span className="card-letter-d">D</span>
                </div>

                <div
                  className="card-marker-wrap"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />

                <div className="card-edge-right">
                  <span className="card-letter-b">B</span>
                  <span className="card-tag-sai">SAI</span>
                </div>
              </div>

              {/* Cạnh DƯỚI: C - 180° */}
              <div className="card-edge-bottom">
                <span className="card-letter-c">C</span>
              </div>
            </div>

            {/* Chân thẻ: STT, Tên học sinh cỡ 18px, Lớp, Môn học */}
            <footer className="card-footer-info">
              <div className="card-footer-left">
                <div className="card-student-name">
                  #{String(studentId).padStart(2, '0')} · {studentName}
                </div>
                <div className="card-class-info">
                  Lớp: {cls.name || '---'} {cls.subject ? `· Môn: ${cls.subject}` : ''}
                </div>
              </div>

              <div className="card-footer-right">
                <div>Hệ thống tương tác NDH</div>
                <b>Xoay đáp án lên trên để chọn</b>
              </div>
            </footer>
          </article>
        );
      })}
    </div>
  );
};
