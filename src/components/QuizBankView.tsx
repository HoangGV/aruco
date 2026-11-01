import React, { useState, useMemo } from 'react';
import type { QuizBank, ClassItem } from '../types';
import { parseMarkdownQuestions, parseBulkQuizMarkdown, GUIDE, BULK_GUIDE } from '../lib/parser';
import { downloadText } from '../lib/export';

interface QuizBankViewProps {
  quizBanks: QuizBank[];
  classes: ClassItem[];
  onSaveQuizBank: (quiz: QuizBank) => void;
  onSaveBulkQuizBanks: (quizzes: QuizBank[]) => void;
  onDeleteQuizBank: (id: string) => void;
  onApplyToClass: (quiz: QuizBank, classId: string) => void;
  onNavigateToClasses: () => void;
  onShowToast: (msg: string) => void;
}

export const QuizBankView: React.FC<QuizBankViewProps> = ({
  quizBanks,
  classes,
  onSaveQuizBank,
  onSaveBulkQuizBanks,
  onDeleteQuizBank,
  onApplyToClass,
  onNavigateToClasses,
  onShowToast
}) => {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // Single quiz modal state
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizBank | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('Toán học');
  const [formSec, setFormSec] = useState(30);
  const [formMd, setFormMd] = useState('');

  // Bulk quiz modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkDefaultSubject, setBulkDefaultSubject] = useState('Toán học');

  // Apply to class modal state
  const [applyingQuiz, setApplyingQuiz] = useState<QuizBank | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || '');

  // Delete confirm modal state
  const [deletingQuiz, setDeletingQuiz] = useState<QuizBank | null>(null);

  // Preview quiz modal state
  const [previewingQuiz, setPreviewingQuiz] = useState<QuizBank | null>(null);

  // Available subjects from quiz banks
  const subjects = useMemo(() => {
    const set = new Set<string>();
    quizBanks.forEach(q => {
      if (q.subject) set.add(q.subject.trim());
    });
    return Array.from(set);
  }, [quizBanks]);

  // Filtered quiz banks
  const filteredQuizzes = useMemo(() => {
    return quizBanks.filter(q => {
      const matchSearch =
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.subject.toLowerCase().includes(search.toLowerCase()) ||
        q.md.toLowerCase().includes(search.toLowerCase());
      const matchSubject = selectedSubject === 'all' || q.subject === selectedSubject;
      return matchSearch && matchSubject;
    });
  }, [quizBanks, search, selectedSubject]);

  // Open single quiz create/edit
  const handleOpenCreateSingle = () => {
    setEditingQuiz(null);
    setFormTitle(`Đề thi số ${quizBanks.length + 1}`);
    setFormSubject('Toán học');
    setFormSec(30);
    setFormMd(`## Câu hỏi 1...
A. Phương án A
B. Phương án B
C. Phương án C
D. Phương án D
Đáp án: A
Giải thích: Lời giải ngắn gọn
Thời gian: 30`);
    setIsSingleModalOpen(true);
  };

  const handleOpenEditSingle = (quiz: QuizBank) => {
    setEditingQuiz(quiz);
    setFormTitle(quiz.title);
    setFormSubject(quiz.subject || 'Toán học');
    setFormSec(quiz.sec || 30);
    setFormMd(quiz.md || '');
    setIsSingleModalOpen(true);
  };

  const handleSaveSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      onShowToast('Vui lòng nhập tên đề thi.');
      return;
    }
    const parsed = parseMarkdownQuestions(formMd, formSec);
    if (!parsed.qs.length) {
      onShowToast('Đề thi chưa có câu hỏi hợp lệ nào.');
      return;
    }

    const newQuiz: QuizBank = {
      id: editingQuiz ? editingQuiz.id : 'qb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: formTitle.trim(),
      subject: formSubject.trim() || 'Toán học',
      sec: formSec,
      md: formMd.trim(),
      createdAt: editingQuiz ? editingQuiz.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    onSaveQuizBank(newQuiz);
    setIsSingleModalOpen(false);
    onShowToast(`Đã lưu đề thi "${newQuiz.title}" (${parsed.qs.length} câu).`);
  };

  // Open bulk modal
  const handleOpenBulk = () => {
    setBulkText(BULK_GUIDE);
    setBulkDefaultSubject('Toán học');
    setIsBulkModalOpen(true);
  };

  // Parsed bulk preview
  const bulkParsedItems = useMemo(() => {
    return parseBulkQuizMarkdown(bulkText, bulkDefaultSubject);
  }, [bulkText, bulkDefaultSubject]);

  const handleSaveBulk = () => {
    if (!bulkParsedItems.length) {
      onShowToast('Chưa tìm thấy đề thi hợp lệ. Dùng cú pháp "# Tên đề thi" ở đầu mỗi đề.');
      return;
    }

    const newQuizzes: QuizBank[] = bulkParsedItems.map((item, idx) => ({
      id: 'qb_' + (Date.now() + idx) + '_' + Math.random().toString(36).slice(2, 6),
      title: item.title,
      subject: item.subject,
      sec: item.sec || 30,
      md: item.md,
      createdAt: Date.now() + idx,
      updatedAt: Date.now() + idx
    }));

    onSaveBulkQuizBanks(newQuizzes);
    setIsBulkModalOpen(false);
    onShowToast(`Đã tạo thành công ${newQuizzes.length} bộ đề thi mới!`);
  };

  // Duplicate a quiz
  const handleDuplicate = (quiz: QuizBank) => {
    const dup: QuizBank = {
      id: 'qb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: `${quiz.title} (Bản sao)`,
      subject: quiz.subject,
      sec: quiz.sec,
      md: quiz.md,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    onSaveQuizBank(dup);
    onShowToast(`Đã nhân bản thành công "${dup.title}".`);
  };

  // Export single or all md
  const handleExportSingleMd = (quiz: QuizBank) => {
    downloadText(`${quiz.title.replace(/\s+/g, '_')}.md`, quiz.md, 'text/markdown');
    onShowToast(`Đã xuất file Markdown: ${quiz.title}`);
  };

  const handleExportAllMd = () => {
    const allText = quizBanks
      .map(q => `# ${q.title}\nMôn: ${q.subject}\nThời gian: ${q.sec || 30}\n\n${q.md}`)
      .join('\n\n---\n\n');
    downloadText(`Kho_de_thi_${new Date().toISOString().slice(0, 10)}.md`, allText, 'text/markdown');
    onShowToast(`Đã xuất toàn bộ ${quizBanks.length} bộ đề ra file Markdown.`);
  };

  // Single form validation
  const singleParsed = useMemo(() => {
    return parseMarkdownQuestions(formMd, formSec);
  }, [formMd, formSec]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Banner & Navigation */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b-4 border-black pb-4">

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            className="ndh-btn bg-amber-200 hover:bg-amber-300 font-bold"
            onClick={handleOpenBulk}
            title="Tạo nhiều đề cùng lúc bằng cú pháp # Tên đề"
          >
            📑 Tạo hàng loạt (#)
          </button>
          <button
            className="ndh-btn ndh-btn-pri text-base font-bold"
            onClick={handleOpenCreateSingle}
          >
            + Thêm đề mới
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            className="ndh-input text-sm font-semibold"
            placeholder="🔍 Tìm kiếm đề thi theo tên, môn học, câu hỏi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            className={`ndh-btn text-xs py-1 px-3 ${
              selectedSubject === 'all' ? 'ndh-btn-pri' : 'bg-white'
            }`}
            onClick={() => setSelectedSubject('all')}
          >
            Tất cả ({quizBanks.length})
          </button>
          {subjects.map(sub => {
            const count = quizBanks.filter(q => q.subject === sub).length;
            return (
              <button
                key={sub}
                className={`ndh-btn text-xs py-1 px-3 ${
                  selectedSubject === sub ? 'ndh-btn-pri' : 'bg-white'
                }`}
                onClick={() => setSelectedSubject(sub)}
              >
                {sub} ({count})
              </button>
            );
          })}
        </div>

        <div>
          <button className="ndh-btn text-xs py-1.5 px-3" onClick={handleExportAllMd}>
            📤 Xuất tất cả .md
          </button>
        </div>
      </div>

      {/* Grid of Quiz Bank Cards */}
      {filteredQuizzes.length === 0 ? (
        <div className="ndh-box p-12 text-center space-y-4 bg-white">
          <div className="text-5xl">📚</div>
          <h3 className="text-xl font-bold">Chưa có đề thi nào phù hợp</h3>
          <p className="text-neutral-600 font-medium max-w-md mx-auto">
            {search || selectedSubject !== 'all'
              ? 'Không tìm thấy bộ đề phù hợp với bộ lọc hiện tại. Hãy thử tìm từ khóa khác.'
              : 'Kho đề thi đang trống. Thầy cô có thể tạo đề mới hoặc nhập hàng loạt bằng nút bên trên.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button className="ndh-btn ndh-btn-pri" onClick={handleOpenCreateSingle}>
              + Tạo đề đầu tiên
            </button>
            <button className="ndh-btn bg-amber-200 hover:bg-amber-300 font-bold" onClick={handleOpenBulk}>
              📑 Nhập hàng loạt (#)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredQuizzes.map(quiz => {
            const parsed = parseMarkdownQuestions(quiz.md, quiz.sec || 30);
            return (
              <div
                key={quiz.id}
                className="ndh-box p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-shadow bg-white relative group"
              >
                <div className="space-y-2.5">
                  {/* Subject badge and time */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 border border-black">
                      {quiz.subject || 'Chung'}
                    </span>
                    <span className="text-xs font-bold text-neutral-500">
                      ⏱ {quiz.sec || 30}s / câu
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-black leading-snug line-clamp-2">
                    {quiz.title}
                  </h3>

                  {/* Status & count */}
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 border-2 ${
                        parsed.err.length
                          ? 'border-red-600 bg-red-50 text-red-700'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {parsed.err.length ? 'Có lỗi cú pháp' : `${parsed.qs.length} câu hỏi hợp lệ`}
                    </span>
                    <span className="text-xs text-neutral-400">
                      Cập nhật: {new Date(quiz.updatedAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t-2 border-black space-y-2">
                  {/* Apply to class button */}
                  <button
                    className="ndh-btn ndh-btn-pri w-full py-2 text-sm font-black flex items-center justify-center gap-1.5"
                    onClick={() => {
                      setApplyingQuiz(quiz);
                      if (classes.length > 0) setTargetClassId(classes[0].id);
                    }}
                  >
                    ▶ Gán vào lớp học
                  </button>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      className="ndh-btn py-1 px-1.5 text-xs text-center font-bold"
                      onClick={() => setPreviewingQuiz(quiz)}
                      title="Xem trước câu hỏi"
                    >
                      👁 Xem
                    </button>
                    <button
                      className="ndh-btn py-1 px-1.5 text-xs text-center font-bold"
                      onClick={() => handleOpenEditSingle(quiz)}
                      title="Chỉnh sửa đề thi"
                    >
                      ✏ Sửa
                    </button>
                    <button
                      className="ndh-btn py-1 px-1.5 text-xs text-center font-bold"
                      onClick={() => handleDuplicate(quiz)}
                      title="Nhân bản đề này"
                    >
                      📋 Nhân
                    </button>
                    <button
                      className="ndh-btn ndh-btn-dng py-1 px-1.5 text-xs text-center font-bold"
                      onClick={() => setDeletingQuiz(quiz)}
                      title="Xóa đề này"
                    >
                      🗑 Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Tạo/Sửa từng bộ đề riêng */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 md:p-6 z-50 overflow-y-auto">
          <div className="ndh-box p-6 max-w-3xl w-full bg-white space-y-4 my-auto shadow-2xl">
            <div className="flex justify-between items-center border-b-2 border-black pb-3">
              <h3 className="text-xl md:text-2xl font-black">
                {editingQuiz ? 'Chỉnh sửa bộ đề thi' : 'Tạo bộ đề thi mới'}
              </h3>
              <button
                className="text-2xl font-black text-neutral-500 hover:text-black"
                onClick={() => setIsSingleModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingle} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="font-semibold block space-y-1 md:col-span-2">
                  <span>Tên đề thi *</span>
                  <input
                    type="text"
                    required
                    className="ndh-input font-bold"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Ví dụ: Đề số 1 - Khảo sát hàm số"
                  />
                </label>
                <label className="font-semibold block space-y-1">
                  <span>Môn học</span>
                  <input
                    type="text"
                    className="ndh-input"
                    value={formSubject}
                    onChange={e => setFormSubject(e.target.value)}
                    placeholder="Ví dụ: Toán học"
                  />
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="font-semibold block space-y-1">
                  <span>Thời gian mặc định mỗi câu (giây)</span>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    className="ndh-input w-36"
                    value={formSec}
                    onChange={e => setFormSec(Math.max(5, Math.min(600, +e.target.value || 30)))}
                  />
                </label>
                <div className="text-xs font-semibold text-neutral-600 mt-5">
                  Có thể ghi đè riêng cho từng câu bằng dòng <code className="bg-neutral-200 px-1">Thời gian: 45</code>
                </div>
              </div>

              {/* Questions Markdown Input */}
              <label className="font-semibold block space-y-1">
                <span>Nội dung câu hỏi (Markdown)</span>
                <textarea
                  className="ndh-input font-mono text-xs md:text-sm leading-relaxed"
                  rows={10}
                  value={formMd}
                  onChange={e => setFormMd(e.target.value)}
                  placeholder="## Nội dung câu hỏi...&#10;A. Phương án A&#10;B. Phương án B&#10;C. Phương án C&#10;D. Phương án D&#10;Đáp án: A&#10;Giải thích: Lời giải&#10;Thời gian: 30"
                />
              </label>

              {/* Validation Status */}
              <div
                className={`font-semibold p-2.5 border-2 text-sm ${
                  singleParsed.err.length
                    ? 'border-red-600 bg-red-50 text-red-700 whitespace-pre-line'
                    : 'border-emerald-600 bg-emerald-50 text-emerald-800'
                }`}
              >
                {singleParsed.err.length
                  ? singleParsed.err.join('\n')
                  : `✓ Hợp lệ: ${singleParsed.qs.length} câu hỏi sẵn sàng`}
              </div>

              <details className="border-2 border-black p-2.5 bg-neutral-50 text-xs">
                <summary className="font-bold cursor-pointer select-none">
                  Xem hướng dẫn định dạng câu hỏi
                </summary>
                <pre className="mt-2 p-2 bg-neutral-200 border border-black overflow-x-auto font-mono text-xs">
                  {GUIDE}
                </pre>
              </details>

              <div className="flex justify-end gap-3 pt-2 border-t-2 border-black">
                <button
                  type="button"
                  className="ndh-btn"
                  onClick={() => setIsSingleModalOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="ndh-btn ndh-btn-pri font-bold px-6">
                  {editingQuiz ? 'Lưu thay đổi' : 'Tạo đề thi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Tạo hàng loạt (Nhiều bài kiểm tra cùng lúc bằng "# Tên đề") */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 sm:p-4 md:p-6 z-50 overflow-y-auto">
          <div className="ndh-box p-4 sm:p-5 md:p-6 max-w-7xl w-full bg-white shadow-2xl my-auto flex flex-col max-h-[92vh] sm:max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b-2 border-black pb-3 flex-none">
              <div>
                <span className="text-xs font-black uppercase tracking-wider bg-amber-300 text-black px-2 py-0.5 border border-black mr-2">
                  HÀNG LOẠT
                </span>
                <h3 className="text-xl md:text-2xl font-black inline">
                  Tạo cùng lúc nhiều bài kiểm tra
                </h3>
              </div>
              <button
                className="text-2xl font-black text-neutral-500 hover:text-black leading-none p-1 cursor-pointer"
                onClick={() => setIsBulkModalOpen(false)}
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Instruction description */}
            <div className="py-2 text-xs sm:text-sm font-semibold text-neutral-700 flex-none">
              Thêm dòng <code className="bg-amber-100 px-1.5 py-0.5 border border-black font-bold"># Tên đề thi</code> trước mỗi bộ câu hỏi. Hệ thống sẽ tự động tách và tạo riêng từng card đề thi tương ứng!
            </div>

            {/* Modal Body: Scrollable container on small screens, flex layout on desktop */}
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-visible my-1 pr-0.5 sm:pr-1">
              {/* 7 : 3 Ratio Layout: 7 parts Markdown Editor (col-span-7) vs 3 parts Preview (col-span-3) */}
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:gap-5 h-full">
                {/* Cột trái (7 phần): Nội dung văn bản Markdown */}
                <div className="lg:col-span-7 flex flex-col h-full min-h-[260px] lg:min-h-0 space-y-1.5">
                  <div className="flex justify-between items-center flex-none">
                    <label className="font-bold text-xs sm:text-sm block">
                      Nội dung văn bản (Markdown)
                    </label>
                    <label className="text-xs font-semibold flex items-center gap-1.5">
                      <span>Môn mặc định:</span>
                      <input
                        type="text"
                        className="border border-black px-1.5 py-0.5 text-xs w-28 font-medium bg-white"
                        value={bulkDefaultSubject}
                        onChange={e => setBulkDefaultSubject(e.target.value)}
                      />
                    </label>
                  </div>
                  <textarea
                    className="ndh-input font-mono text-xs sm:text-sm leading-relaxed w-full flex-1 min-h-[220px] lg:min-h-[380px] resize-y lg:resize-none p-3"
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={BULK_GUIDE}
                  />
                </div>

                {/* Cột phải (3 phần): Xem trước kết quả nhận diện */}
                <div className="lg:col-span-3 flex flex-col h-full min-h-[200px] lg:min-h-0 space-y-1.5">
                  <div className="flex justify-between items-center flex-none">
                    <span className="font-bold text-xs sm:text-sm">
                      Xem trước ({bulkParsedItems.length} đề thi)
                    </span>
                    {bulkParsedItems.length > 0 && (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 border border-emerald-600">
                        Sẵn sàng lưu
                      </span>
                    )}
                  </div>

                  <div className="border-2 border-black bg-neutral-50 p-2.5 sm:p-3 overflow-y-auto flex-1 min-h-[160px] lg:min-h-[380px] space-y-2">
                    {bulkParsedItems.length === 0 ? (
                      <div className="p-4 sm:p-6 text-center text-neutral-500 text-xs">
                        Chưa phát hiện dòng tiêu đề đề thi nào bắt đầu bằng <code className="font-bold"># Tên đề</code>. Hãy xem mẫu ở bên trái.
                      </div>
                    ) : (
                      bulkParsedItems.map((item, idx) => {
                        const qCount = parseMarkdownQuestions(item.md, item.sec).qs.length;
                        return (
                          <div
                            key={idx}
                            className="p-2.5 border-2 border-black bg-white space-y-1 shadow-sm break-words"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-black text-blue-700">ĐỀ #{idx + 1}</span>
                              <span className="bg-neutral-200 px-1.5 py-0.5 font-bold">
                                {item.subject} · {item.sec}s
                              </span>
                            </div>
                            <div className="font-black text-sm line-clamp-2">{item.title}</div>
                            <div className="text-xs text-neutral-600 font-semibold">
                              {qCount} câu hỏi hợp lệ
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer: Guaranteed separated by border-t-2 and flex-none */}
            <div className="flex-none pt-3 mt-2 border-t-2 border-black flex justify-end gap-3 bg-white">
              <button
                type="button"
                className="ndh-btn"
                onClick={() => setIsBulkModalOpen(false)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="ndh-btn ndh-btn-pri font-bold px-6"
                disabled={bulkParsedItems.length === 0}
                onClick={handleSaveBulk}
              >
                Lưu tất cả ({bulkParsedItems.length} bộ đề)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Gán vào lớp học */}
      {applyingQuiz && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="ndh-box p-6 max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h3 className="text-2xl font-black">Gán đề thi vào lớp học</h3>
            <p className="text-sm font-semibold text-neutral-700">
              Chọn lớp học để nạp bộ đề <b className="text-black">"{applyingQuiz.title}"</b>. Nội dung câu hỏi và thời gian của lớp sẽ được cập nhật và thầy cô vẫn có thể chỉnh sửa tự do.
            </p>

            {classes.length === 0 ? (
              <div className="p-3 bg-amber-50 border-2 border-amber-600 text-amber-800 text-xs font-semibold">
                Chưa có lớp học nào trong danh sách. Hãy quay về trang chính để tạo lớp trước.
              </div>
            ) : (
              <label className="font-semibold block space-y-1">
                <span>Chọn lớp nhận đề thi:</span>
                <select
                  className="ndh-input font-bold"
                  value={targetClassId}
                  onChange={e => setTargetClassId(e.target.value)}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.subject || 'Chưa có môn'}) · {c.names.split('\n').filter(Boolean).length} học sinh
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t-2 border-black">
              <button className="ndh-btn" onClick={() => setApplyingQuiz(null)}>
                Hủy bỏ
              </button>
              <button
                className="ndh-btn ndh-btn-pri font-bold"
                disabled={classes.length === 0}
                onClick={() => {
                  if (applyingQuiz && targetClassId) {
                    onApplyToClass(applyingQuiz, targetClassId);
                    setApplyingQuiz(null);
                  }
                }}
              >
                Xác nhận gán vào lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Xác nhận xóa đề thi */}
      {deletingQuiz && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="ndh-box p-6 max-w-md w-full bg-white space-y-4 shadow-2xl">
            <h3 className="text-2xl font-black">Xóa bộ đề thi?</h3>
            <p className="text-base font-semibold text-neutral-700">
              Bạn có chắc chắn muốn xóa vĩnh viễn đề thi <b className="text-black">"{deletingQuiz.title}"</b>?
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t-2 border-black">
              <button className="ndh-btn" onClick={() => setDeletingQuiz(null)}>
                Hủy bỏ
              </button>
              <button
                className="ndh-btn ndh-btn-dng font-bold"
                onClick={() => {
                  onDeleteQuizBank(deletingQuiz.id);
                  setDeletingQuiz(null);
                  onShowToast(`Đã xóa đề thi "${deletingQuiz.title}".`);
                }}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Xem trước câu hỏi */}
      {previewingQuiz && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 md:p-6 z-50 overflow-y-auto">
          <div className="ndh-box p-6 max-w-3xl w-full bg-white space-y-4 my-auto shadow-2xl">
            <div className="flex justify-between items-center border-b-2 border-black pb-3">
              <div>
                <span className="text-xs font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 border border-black mr-2">
                  {previewingQuiz.subject}
                </span>
                <h3 className="text-xl md:text-2xl font-black inline">
                  {previewingQuiz.title}
                </h3>
              </div>
              <button
                className="text-2xl font-black text-neutral-500 hover:text-black"
                onClick={() => setPreviewingQuiz(null)}
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-4 p-2">
              <pre className="p-3 bg-neutral-100 border-2 border-black text-xs md:text-sm font-mono whitespace-pre-wrap">
                {previewingQuiz.md}
              </pre>
            </div>

            <div className="flex justify-between items-center pt-3 border-t-2 border-black">
              <button
                className="ndh-btn text-xs font-bold"
                onClick={() => handleExportSingleMd(previewingQuiz)}
              >
                📥 Tải file .md
              </button>
              <div className="flex gap-2">
                <button
                  className="ndh-btn"
                  onClick={() => setPreviewingQuiz(null)}
                >
                  Đóng
                </button>
                <button
                  className="ndh-btn ndh-btn-pri font-bold"
                  onClick={() => {
                    const q = previewingQuiz;
                    setPreviewingQuiz(null);
                    setApplyingQuiz(q);
                  }}
                >
                  ▶ Dùng đề này cho lớp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
