import React, { useMemo, useState } from 'react';
import type { ClassItem } from '../types';
import { parseMarkdownQuestions, GUIDE } from '../lib/parser';
import { getStudentList } from '../lib/export';

interface ClassViewProps {
  cls: ClassItem;
  onUpdateClass: (updated: Partial<ClassItem>) => void;
  onBackToHome: () => void;
  onPrintCards: () => void;
  onImportMd: () => void;
  onExportMd: () => void;
  onExportClassXlsx: () => void;
  onDeleteResult: (index: number) => void;
  onStartQuiz: () => void;
}

export const ClassView: React.FC<ClassViewProps> = ({
  cls,
  onUpdateClass,
  onBackToHome,
  onPrintCards,
  onImportMd,
  onExportMd,
  onExportClassXlsx,
  onDeleteResult,
  onStartQuiz
}) => {
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const students = useMemo(() => getStudentList(cls), [cls.names]);
  const parsed = useMemo(() => parseMarkdownQuestions(cls.md, cls.sec || 30), [cls.md, cls.sec]);

  return (
    <div className="max-w-5xl mx-auto p-5 space-y-6">
      {/* Navigation action */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <button className="ndh-btn" onClick={onBackToHome}>
          ← Về danh sách lớp
        </button>
        <button
          className="ndh-btn ndh-btn-pri text-lg px-6 py-2.5"
          onClick={onStartQuiz}
        >
          ▶ Bắt đầu kiểm tra
        </button>
      </div>

      {/* Class info */}
      <section className="ndh-box p-4 space-y-3">
        <h2 className="text-xl font-bold border-b-2 border-black pb-2">Thông tin lớp</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="font-semibold block space-y-1">
            <span>Tên lớp</span>
            <input
              type="text"
              className="ndh-input"
              value={cls.name}
              onChange={e => onUpdateClass({ name: e.target.value })}
              placeholder="Ví dụ: 12A1"
            />
          </label>
          <label className="font-semibold block space-y-1">
            <span>Môn học</span>
            <input
              type="text"
              className="ndh-input"
              value={cls.subject}
              onChange={e => onUpdateClass({ subject: e.target.value })}
              placeholder="Ví dụ: Toán học"
            />
          </label>
        </div>
      </section>

      {/* Students & Cards */}
      <section className="ndh-box p-4 space-y-3">
        <h2 className="text-xl font-bold border-b-2 border-black pb-2">Học sinh và bộ thẻ</h2>
        <label className="font-semibold block space-y-1">
          <span>Mỗi dòng một học sinh (số thẻ theo thứ tự dòng, từ số 1)</span>
          <textarea
            className="ndh-input font-mono text-sm leading-relaxed"
            rows={8}
            value={cls.names}
            onChange={e => onUpdateClass({ names: e.target.value })}
            placeholder="1. Nguyễn Văn An&#10;2. Trần Thị Bình&#10;3. Lê Văn Cường"
          />
        </label>
        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <span className="font-semibold text-neutral-700">
            {students.length} học sinh
          </span>
          <button className="ndh-btn" onClick={onPrintCards}>
            🖨 In bộ thẻ của lớp
          </button>
        </div>
      </section>

      {/* Questions (Markdown) */}
      <section className="ndh-box p-4 space-y-3">
        <h2 className="text-xl font-bold border-b-2 border-black pb-2">Câu hỏi (Markdown)</h2>
        <textarea
          className="ndh-input font-mono text-sm leading-relaxed"
          rows={10}
          value={cls.md}
          onChange={e => onUpdateClass({ md: e.target.value })}
          placeholder="## Nội dung câu hỏi...&#10;A. Phương án A&#10;B. Phương án B&#10;C. Phương án C&#10;D. Phương án D&#10;Đáp án: A"
        />

        {/* Validation error or status message */}
        <div
          className={`font-semibold p-2.5 border-2 ${
            parsed.err.length
              ? 'border-red-600 bg-red-50 text-red-700 whitespace-pre-line'
              : 'border-emerald-600 bg-emerald-50 text-emerald-800'
          }`}
        >
          {parsed.err.length
            ? parsed.err.join('\n')
            : `${parsed.qs.length} câu hợp lệ`}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button className="ndh-btn" onClick={onImportMd}>
            Nhập .md
          </button>
          <button className="ndh-btn" onClick={onExportMd}>
            Xuất .md
          </button>
        </div>

        <details className="border-2 border-black p-3 bg-neutral-50 text-sm">
          <summary className="font-bold cursor-pointer select-none">
            Hướng dẫn viết câu hỏi
          </summary>
          <pre className="mt-2 p-3 bg-neutral-200 border-2 border-black overflow-x-auto text-xs font-mono">
            {GUIDE}
          </pre>
          <p className="mt-2 text-neutral-600 font-medium">
            Mỗi câu bắt đầu bằng "## ". Dòng Giải thích và Thời gian không bắt buộc. Ảnh và video dùng cú pháp ![](đường dẫn).
          </p>
        </details>
      </section>

      {/* Settings */}
      <section className="ndh-box p-4 space-y-4">
        <h2 className="text-xl font-bold border-b-2 border-black pb-2">Thiết lập</h2>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="font-semibold block space-y-1">
            <span>Thời gian mỗi câu (giây)</span>
            <input
              type="number"
              min={5}
              max={600}
              className="ndh-input w-36"
              value={cls.sec || 30}
              onChange={e => onUpdateClass({ sec: Math.min(600, Math.max(5, +e.target.value || 30)) })}
            />
          </label>
          <label className="font-semibold flex items-center gap-2 cursor-pointer mt-4">
            <input
              type="checkbox"
              className="w-5 h-5 accent-[#2F54D0]"
              checked={!!cls.elim}
              onChange={e => onUpdateClass({ elim: e.target.checked })}
            />
            <span>Trả lời sai bị loại (có cứu hộ)</span>
          </label>
        </div>
      </section>

      {/* Saved results */}
      <section className="ndh-box p-4 space-y-3">
        <h2 className="text-xl font-bold border-b-2 border-black pb-2">Kết quả đã lưu</h2>
        {(!cls.results || cls.results.length === 0) ? (
          <p className="text-neutral-500 py-2">Chưa có kết quả kiểm tra nào.</p>
        ) : (
          <div className="space-y-2">
            {cls.results.map((r, i) => (
              <div
                key={i}
                className="flex justify-between items-center p-2.5 border-2 border-black bg-neutral-50"
              >
                <span className="font-semibold">
                  {new Date(r.at).toLocaleString('vi-VN')} · {r.total} câu
                </span>
                <button
                  className="ndh-btn ndh-btn-dng py-1 px-3 text-sm"
                  onClick={() => setConfirmDeleteIdx(i)}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        )}
        <div>
          <button className="ndh-btn" onClick={onExportClassXlsx}>
            Xuất lớp này .xlsx
          </button>
        </div>
      </section>

      {/* Big Start Button */}
      <div className="pt-2">
        <button
          className="ndh-btn ndh-btn-pri w-full text-2xl py-4 tracking-wide font-black"
          onClick={onStartQuiz}
        >
          Bắt đầu kiểm tra
        </button>
      </div>

      {/* In-App Confirmation Modal for Xóa kết quả đã lưu */}
      {confirmDeleteIdx !== null && cls.results && cls.results[confirmDeleteIdx] && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="ndh-box p-6 max-w-md w-full space-y-4 bg-white text-black shadow-2xl">
            <h3 className="text-2xl font-black">Xóa kết quả kiểm tra?</h3>
            <p className="text-base font-semibold text-neutral-700">
              Bạn có chắc chắn muốn xóa vĩnh viễn kết quả kiểm tra lúc{' '}
              <span className="text-black font-bold">
                {new Date(cls.results[confirmDeleteIdx].at).toLocaleString('vi-VN')}
              </span>{' '}
              ({cls.results[confirmDeleteIdx].total} câu)? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3 pt-3">
              <button
                className="ndh-btn"
                onClick={() => setConfirmDeleteIdx(null)}
              >
                Hủy bỏ
              </button>
              <button
                className="ndh-btn ndh-btn-dng font-bold"
                onClick={() => {
                  const idx = confirmDeleteIdx;
                  setConfirmDeleteIdx(null);
                  onDeleteResult(idx);
                }}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
