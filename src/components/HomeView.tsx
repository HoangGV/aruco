import React from 'react';
import type { AppData, ClassItem } from '../types';
import { parseMarkdownQuestions } from '../lib/parser';
import { getStudentList } from '../lib/export';

interface HomeViewProps {
  data: AppData;
  onUpdateTeacher: (name: string) => void;
  onOpenClass: (id: string) => void;
  onAddClass: () => void;
  onExportXlsx: () => void;
  onBackup: () => void;
  onRestore: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  data,
  onUpdateTeacher,
  onOpenClass,
  onAddClass,
  onExportXlsx,
  onBackup,
  onRestore
}) => {
  return (
    <div className="max-w-5xl mx-auto p-5 space-y-6">
      {/* Top quick actions */}
      <div className="flex gap-3 flex-wrap items-center">
        <button className="ndh-btn" onClick={onExportXlsx}>
          Xuất kết quả .xlsx
        </button>
        <button className="ndh-btn" onClick={onBackup}>
          Sao lưu
        </button>
        <button className="ndh-btn" onClick={onRestore}>
          Nhập dữ liệu
        </button>
      </div>

      {/* Teacher information */}
      <section className="ndh-box p-4 space-y-3">
        <h2 className="text-xl font-bold border-b-2 border-black pb-2">Giáo viên</h2>
        <label className="font-semibold block space-y-1">
          <span>Họ và tên</span>
          <input
            type="text"
            className="ndh-input text-lg"
            value={data.teacher}
            onChange={e => onUpdateTeacher(e.target.value)}
            placeholder="Ví dụ: NgĐ Hoàng"
            autoComplete="name"
          />
        </label>
      </section>

      {/* Classes list */}
      <section className="ndh-box p-4 space-y-4">
        <div className="flex justify-between items-center border-b-2 border-black pb-2">
          <h2 className="text-xl font-bold">Các lớp</h2>
          <span className="text-sm text-neutral-600 font-semibold">
            {data.classes.length} lớp học
          </span>
        </div>

        {data.classes.length === 0 ? (
          <p className="text-neutral-600 py-6 text-center font-medium">
            Chưa có lớp nào. Hãy bấm "Thêm lớp" để tạo lớp đầu tiên.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.classes.map(c => {
              const students = getStudentList(c);
              const parseResult = parseMarkdownQuestions(c.md, c.sec || 30);
              return (
                <div key={c.id} className="ndh-box p-4 flex flex-col justify-between gap-3 hover:shadow-md transition">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-black">{c.name || 'Lớp chưa đặt tên'}</h3>
                    <div className="text-neutral-700 font-medium">{c.subject || 'Chưa có môn học'}</div>
                    <div className="text-sm text-neutral-500 font-semibold">
                      {students.length} học sinh · {parseResult.qs.length} câu hỏi
                    </div>
                  </div>
                  <button
                    className="ndh-btn ndh-btn-pri w-full text-center"
                    onClick={() => onOpenClass(c.id)}
                  >
                    Mở lớp
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div>
          <button className="ndh-btn" onClick={onAddClass}>
            + Thêm lớp mới
          </button>
        </div>
      </section>
    </div>
  );
};
