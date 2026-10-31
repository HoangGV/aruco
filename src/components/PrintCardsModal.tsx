import React, { useState } from 'react';
import type { ClassItem } from '../types';
import { CardMarkers } from '../lib/markers';
import { getStudentList } from '../lib/export';

interface PrintCardsModalProps {
  cls: ClassItem;
  onClose: () => void;
}

export const PrintCardsModal: React.FC<PrintCardsModalProps> = ({ cls, onClose }) => {
  const students = getStudentList(cls);
  const [layout, setLayout] = useState<'compact' | 'standard'>('compact');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto print-modal-overlay">
      {/* Modal Actions Header - hidden completely during print */}
      <div className="sticky top-0 bg-white border-b-4 border-black p-4 flex justify-between items-center gap-4 flex-wrap z-10 no-print max-w-5xl mx-auto my-4 shadow-2xl">
        <div>
          <h2 className="text-2xl font-black">In bộ thẻ: {cls.name}</h2>
          <p className="text-sm font-semibold text-neutral-600">
            {students.length} học sinh · Thẻ ArUco chuẩn hoá · Hướng dẫn A (Đúng), B (Sai)
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 font-semibold text-sm">
            <span>Cách bố trí:</span>
            <select
              className="border-2 border-black p-1.5 font-medium"
              value={layout}
              onChange={e => setLayout(e.target.value as any)}
            >
              <option value="compact">3 thẻ / hàng (Khổ A4)</option>
              <option value="standard">2 thẻ lớn / hàng (Quét xa)</option>
            </select>
          </label>
          <button
            className="ndh-btn ndh-btn-pri text-lg px-6 flex items-center gap-2"
            onClick={handlePrint}
            title="Nhấn để in hoặc chọn 'Lưu dưới dạng PDF'"
          >
            🖨 In thẻ / Xuất PDF
          </button>
          <button className="ndh-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>

      {/* Cards Display Sheet */}
      <div className="bg-white p-6 max-w-5xl mx-auto min-h-screen my-4 shadow-2xl print-sheet">
        {students.length === 0 ? (
          <p className="text-neutral-500 py-12 text-center text-lg font-semibold">
            Chưa có học sinh nào. Hãy nhập danh sách học sinh trước.
          </p>
        ) : (
          <div
            className={`grid gap-4 ${
              layout === 'compact'
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
            }`}
          >
            {students.map((studentName, i) => {
              const studentId = i + 1;
              const svgContent = CardMarkers.svg(studentId);

              return (
                <div
                  key={studentId}
                  className={`relative border-2 border-dashed border-black text-center flex flex-col justify-between items-center p-3 print-card-item bg-white ${
                    layout === 'compact' ? 'h-[9.4cm]' : 'h-[13cm] p-5'
                  }`}
                >
                  {/* Option A at Top (A = Đúng) */}
                  <div className="flex flex-col items-center leading-none pt-1">
                    <b className="text-3xl font-black tracking-wide">A</b>
                    <span className="text-[11px] font-black tracking-wider text-black mt-0.5 border-b border-black px-1">
                      ĐÚNG
                    </span>
                  </div>

                  {/* Middle row: D (Left) - ArUco Marker SVG - B (Right with B = Sai) */}
                  <div className="w-full flex items-center justify-between px-2">
                    {/* D Left */}
                    <div className="flex flex-col items-center leading-none">
                      <b className="text-3xl font-black">D</b>
                    </div>

                    {/* ArUco Marker */}
                    <div
                      className={`flex items-center justify-center p-1 bg-white border border-neutral-200 ${
                        layout === 'compact' ? 'w-[4.5cm] h-[4.5cm]' : 'w-[6.2cm] h-[6.2cm]'
                      }`}
                      dangerouslySetInnerHTML={{ __html: svgContent }}
                    />

                    {/* B Right (B = Sai) */}
                    <div className="flex flex-col items-center leading-none">
                      <b className="text-3xl font-black tracking-wide">B</b>
                      <span className="text-[11px] font-black tracking-wider text-black mt-0.5 border-b border-black px-1">
                        SAI
                      </span>
                    </div>
                  </div>

                  {/* Option C at Bottom */}
                  <div className="flex flex-col items-center leading-none">
                    <b className="text-3xl font-black tracking-wide">C</b>
                  </div>

                  {/* Footer with Student ID & Student Name */}
                  <div className="border-t-2 border-black w-full pt-1.5 pb-0.5 mt-1">
                    <p className="font-black text-base truncate text-black">
                      #{String(studentId).padStart(2, '0')} · {studentName}
                    </p>
                    <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">
                      {cls.name} {cls.subject ? `· ${cls.subject}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
