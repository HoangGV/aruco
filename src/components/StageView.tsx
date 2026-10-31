import React, { useEffect, useState, useMemo } from 'react';
import type { SessionState, ClassItem } from '../types';
import { MarkdownView } from './MarkdownView';
import { gameAudio } from '../lib/audio';
import confetti from 'canvas-confetti';

interface StageViewProps {
  cls: ClassItem;
  room: SessionState;
  theme: 'dark' | 'cream';
  phoneConnected: boolean;
  onThemeToggle: () => void;
  onAction: (act: string, extra?: any) => void;
  onOpenPairModal: () => void;
  onOpenRescueModal: () => void;
  onExportXlsx: () => void;
  onExit: () => void;
}

interface ExtractedMedia {
  alt: string;
  url: string;
  isVideo: boolean;
}

export const StageView: React.FC<StageViewProps> = ({
  cls,
  room,
  theme,
  phoneConnected,
  onThemeToggle,
  onAction,
  onOpenPairModal,
  onOpenRescueModal,
  onExportXlsx,
  onExit
}) => {
  const [seconds, setSeconds] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Sound effects on stage transitions
  useEffect(() => {
    if (room.phase === 'revealed') {
      const correctCount = room.results?.correctIds?.length || 0;
      gameAudio.reveal(correctCount > 0, room.results?.wrongIds?.length || 0);
      if (correctCount > 0) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      }
    } else if (room.phase === 'finished') {
      gameAudio.reveal(true);
      confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 } });
    }
  }, [room.phase, room.index]);

  // Tick countdown timer
  useEffect(() => {
    const updateTime = () => {
      if (room.phase === 'paused') {
        setSeconds(Math.max(0, Math.ceil((room.remainingMs || 0) / 1000)));
      } else if (room.phase === 'question' && room.deadline) {
        const ms = room.deadline - Date.now();
        const left = Math.max(0, Math.ceil(ms / 1000));
        setSeconds(left);
        if (left <= 5 && left > 0) {
          gameAudio.tick(left);
        }
      } else {
        setSeconds(room.currentQuestion?.seconds || cls.sec || 30);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 200);
    return () => clearInterval(interval);
  }, [room.phase, room.deadline, room.remainingMs, room.currentQuestion, cls.sec]);

  const q = room.currentQuestion;
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#000000' : '#F8F9FA';
  const textColor = isDark ? '#ffffff' : '#000000';
  const borderColor = isDark ? '#ffffff' : '#000000';

  const alivePlayers = room.players.filter(p => p.alive);
  const deadCount = room.players.filter(p => !p.alive).length;
  const submissionsCount = Object.keys(room.submissions || {}).length;
  const isLastQuestion = room.index + 1 >= (room.questionCount || room.questions?.length || 0);

  // Extract media from question text to optimize layout (Requirement 4)
  const { questionTextOnly, mediaItems } = useMemo(() => {
    if (!q?.text) return { questionTextOnly: '', mediaItems: [] };
    const media: ExtractedMedia[] = [];
    const textLines: string[] = [];

    for (const line of q.text.split('\n')) {
      const match = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (match) {
        const [, alt, url] = match;
        const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url) || alt.toLowerCase() === 'video';
        media.push({ alt, url, isVideo });
      } else {
        textLines.push(line);
      }
    }

    return {
      questionTextOnly: textLines.join('\n').trim(),
      mediaItems: media
    };
  }, [q?.text]);

  const hasMedia = mediaItems.length > 0;

  return (
    <div
      className="fixed inset-0 flex flex-col z-40 select-none overflow-hidden transition-colors duration-200"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Top stage viewport */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col justify-between max-w-7xl mx-auto w-full">
        {/* Phase: Lobby */}
        {room.phase === 'lobby' && (
          <div className="my-auto text-center space-y-6">
            <h1 className="text-4xl md:text-7xl font-black tracking-tight">
              {cls.name}
            </h1>
            <p className="text-2xl md:text-4xl font-semibold opacity-90">
              Sẵn sàng · {room.players.length} học sinh · {room.questionCount} câu hỏi
            </p>
            <div className="pt-8">
              <button
                className="ndh-btn ndh-btn-pri text-2xl md:text-3xl px-10 py-5 font-black uppercase tracking-wider shadow-2xl"
                onClick={() => onAction('start')}
              >
                Bắt đầu ngay
              </button>
            </div>
          </div>
        )}

        {/* Phase: Question / Paused / Revealed */}
        {(room.phase === 'question' || room.phase === 'paused' || room.phase === 'revealed') && q && (
          <div className="space-y-4 flex-1 flex flex-col justify-between">
            {/* Question Top Header Bar */}
            <div className="flex justify-between items-center border-b-4 pb-3" style={{ borderColor }}>
              <div className="flex items-center gap-4">
                <span className="text-2xl md:text-4xl font-black">
                  Câu {room.index + 1}/{room.questionCount}
                </span>
                <span className="text-base md:text-2xl opacity-80 font-bold">
                  {submissionsCount}/{alivePlayers.length} thẻ đã nhận
                </span>
              </div>
              <div
                className={`text-2xl md:text-4xl font-black px-6 py-1 border-4 min-w-[4ch] text-center ${
                  room.phase === 'question' && seconds <= 5 ? 'animate-pulse bg-red-600 text-white border-white' : ''
                }`}
                style={{ borderColor: room.phase === 'question' && seconds <= 5 ? '#ffffff' : borderColor }}
              >
                {room.phase === 'revealed' ? 'HẾT GIỜ' : seconds}
              </div>
            </div>

            {/* Question Text Prompt */}
            <div className="text-2xl md:text-4xl font-black leading-snug py-1">
              <MarkdownView content={questionTextOnly || q.text} />
            </div>

            {/* If Paused notice */}
            {room.phase === 'paused' ? (
              <div className="my-auto text-center py-10">
                <span className="text-4xl md:text-6xl font-black tracking-wider uppercase border-4 px-10 py-4 inline-block" style={{ borderColor }}>
                  ĐÃ TẠM DỪNG
                </span>
              </div>
            ) : (
              /* Content Area: Split 2 columns if media exists (Requirement 4) */
              <div
                className={`my-auto gap-4 md:gap-6 ${
                  hasMedia
                    ? 'grid grid-cols-1 md:grid-cols-2 items-center'
                    : 'grid grid-cols-1 md:grid-cols-2'
                }`}
              >
                {/* Left Column: Media display if question has image/video */}
                {hasMedia && (
                  <div className="flex flex-col items-center justify-center p-3 border-4 bg-black/5 max-h-[52vh] overflow-hidden" style={{ borderColor }}>
                    {mediaItems.map((item, idx) => (
                      <div key={idx} className="w-full flex items-center justify-center">
                        {item.isVideo ? (
                          <video
                            src={item.url}
                            controls
                            playsInline
                            className="max-h-[46vh] max-w-full object-contain mx-auto border-2"
                            style={{ borderColor }}
                          />
                        ) : (
                          <img
                            src={item.url}
                            alt={item.alt}
                            className="max-h-[46vh] max-w-full object-contain mx-auto border-2 shadow-md"
                            style={{ borderColor }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Options Column / Grid */}
                <div
                  className={`gap-3 md:gap-4 ${
                    hasMedia
                      ? 'flex flex-col justify-center'
                      : 'grid grid-cols-1 md:grid-cols-2 col-span-2'
                  }`}
                >
                  {q.options.map((opt, i) => {
                    const letter = 'ABCD'[i];
                    const isCorrect = letter === q.answer;
                    const revealed = room.phase === 'revealed';

                    // Requirement 3: Vivid Green for correct answer (#0B6B2E)
                    let optBg = 'transparent';
                    let optColor = textColor;
                    let optBorder = 'border-4';
                    let optBorderColor = borderColor;
                    let optOpacity = '1';
                    let letterBg = 'transparent';
                    let letterColor = textColor;

                    if (revealed) {
                      if (isCorrect) {
                        optBg = '#0B6B2E'; // Vivid Green background
                        optColor = '#ffffff'; // Crisp white text
                        optBorder = 'border-8 outline-4 outline-dashed outline-offset-2';
                        optBorderColor = '#0B6B2E';
                        letterBg = '#ffffff'; // Inverted letter badge
                        letterColor = '#0B6B2E';
                      } else {
                        optBorder = 'border-4 border-dashed';
                        optOpacity = '0.35';
                      }
                    }

                    return (
                      <div
                        key={letter}
                        className={`p-3 md:p-5 flex items-start gap-4 transition-all ${optBorder}`}
                        style={{
                          backgroundColor: optBg,
                          color: optColor,
                          borderColor: optBorderColor,
                          opacity: optOpacity
                        }}
                      >
                        <i
                          className="not-italic font-black text-2xl md:text-4xl border-4 px-3 py-1 flex-none"
                          style={{
                            backgroundColor: letterBg,
                            color: letterColor,
                            borderColor: optColor
                          }}
                        >
                          {letter}
                        </i>
                        <div className="text-xl md:text-3xl font-bold flex-1 leading-snug">
                          <MarkdownView content={opt} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Explanation & Elimination Info when revealed */}
            {room.phase === 'revealed' && (
              <div className="space-y-3">
                {q.explanation && (
                  <div className="border-4 p-3 md:p-4 text-lg md:text-xl font-semibold bg-black/10 dark:bg-white/10" style={{ borderColor }}>
                    <b className="underline mr-2 text-emerald-600 dark:text-emerald-400">Giải thích:</b>
                    <MarkdownView content={q.explanation} className="inline-block" />
                  </div>
                )}
                {room.config.eliminate && (
                  <div className="text-lg md:text-xl font-bold text-red-500">
                    Đã bị loại: {deadCount} học sinh
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase: Finished Leaderboard */}
        {room.phase === 'finished' && (
          <div className="space-y-6 my-auto">
            <div className="border-b-4 pb-4 flex justify-between items-center" style={{ borderColor }}>
              <h1 className="text-4xl md:text-6xl font-black">
                Kết quả chung cuộc · {cls.name}
              </h1>
              <span className="text-2xl font-bold">
                {room.questionCount} câu hỏi
              </span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto border-4" style={{ borderColor }}>
              <table className="w-full text-left text-xl md:text-2xl border-collapse">
                <thead>
                  <tr className="border-b-4 font-black" style={{ borderColor }}>
                    <th className="p-3 border-r-2" style={{ borderColor }}>Hạng</th>
                    <th className="p-3 border-r-2" style={{ borderColor }}>Số thẻ</th>
                    <th className="p-3 border-r-2" style={{ borderColor }}>Học sinh</th>
                    <th className="p-3 text-right">Số câu đúng</th>
                  </tr>
                </thead>
                <tbody>
                  {[...room.players]
                    .sort((a, b) => b.score - a.score)
                    .map((p, idx) => (
                      <tr
                        key={p.id}
                        className={`border-b-2 ${idx < 3 ? 'font-black bg-yellow-500/10' : ''}`}
                        style={{ borderColor }}
                      >
                        <td className="p-3 border-r-2 font-mono" style={{ borderColor }}>
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                        </td>
                        <td className="p-3 border-r-2 font-mono" style={{ borderColor }}>
                          {String(p.id).padStart(2, '0')}
                        </td>
                        <td className="p-3 border-r-2" style={{ borderColor }}>
                          {p.name}
                        </td>
                        <td className="p-3 text-right font-bold">
                          {p.score / 10} / {room.questionCount}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <footer className="h-20 border-t-4 border-black bg-white text-black flex items-center justify-between px-6 gap-3 flex-wrap overflow-x-auto no-print">
        {/* Dynamic game actions */}
        <div className="flex items-center gap-3">
          {room.phase === 'lobby' && (
            <button className="ndh-btn ndh-btn-pri" onClick={() => onAction('start')}>
              ▶ Bắt đầu
            </button>
          )}

          {room.phase === 'question' && (
            <>
              <button className="ndh-btn" onClick={() => onAction('pause')}>
                ⏸ Tạm dừng
              </button>
              <button className="ndh-btn ndh-btn-pri" onClick={() => onAction('reveal')}>
                👁 Công bố đáp án
              </button>
            </>
          )}

          {room.phase === 'paused' && (
            <>
              <button className="ndh-btn ndh-btn-pri" onClick={() => onAction('resume')}>
                ▶ Tiếp tục
              </button>
              <button className="ndh-btn" onClick={() => onAction('reveal')}>
                👁 Công bố đáp án
              </button>
            </>
          )}

          {room.phase === 'revealed' && (
            <>
              <button className="ndh-btn ndh-btn-pri" onClick={() => onAction('next')}>
                {isLastQuestion ? 'Xem kết quả' : 'Câu tiếp theo →'}
              </button>
              {room.config.eliminate && (
                <button className="ndh-btn" onClick={onOpenRescueModal}>
                  🚑 Cứu hộ học sinh
                </button>
              )}
            </>
          )}

          {room.phase === 'finished' && (
            <>
              <button className="ndh-btn ndh-btn-pri" onClick={onExportXlsx}>
                📊 Xuất .xlsx
              </button>
              <button className="ndh-btn" onClick={() => onAction('reset')}>
                🔄 Làm lại bộ này
              </button>
            </>
          )}
        </div>

        {/* Companion and Utility Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-sm bg-neutral-100 px-3 py-1.5 border-2 border-black">
            <span
              className={`w-3.5 h-3.5 rounded-none border border-black inline-block ${
                phoneConnected ? 'bg-emerald-600' : 'bg-neutral-300'
              }`}
            />
            <span>Điện thoại {phoneConnected ? '(Đã nối)' : ''}</span>
          </div>

          <button className="ndh-btn" onClick={onOpenPairModal}>
            📱 Ghép nối điện thoại
          </button>

          <button className="ndh-btn" onClick={onThemeToggle}>
            Nền: {theme === 'dark' ? 'đen' : 'kem'}
          </button>

          {/* Requirement 5: In-app confirmation modal for Thoát */}
          <button
            className="ndh-btn ndh-btn-dng"
            onClick={() => setShowExitConfirm(true)}
          >
            Thoát
          </button>
        </div>
      </footer>

      {/* In-App Confirmation Modal for Thoát (Requirement 5) */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="ndh-box p-6 max-w-md w-full space-y-4 bg-white text-black shadow-2xl">
            <h3 className="text-2xl font-black">Thoát khỏi bài kiểm tra?</h3>
            <p className="text-base font-semibold text-neutral-700">
              Bạn có chắc chắn muốn kết thúc bài kiểm tra này và quay về danh sách?
            </p>
            <div className="flex justify-end gap-3 pt-3">
              <button
                className="ndh-btn"
                onClick={() => setShowExitConfirm(false)}
              >
                Tiếp tục làm bài
              </button>
              <button
                className="ndh-btn ndh-btn-dng"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
              >
                Xác nhận thoát
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
