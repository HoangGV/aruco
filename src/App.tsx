import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppData, ClassItem, SessionState, QuizBank } from './types';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { ClassView } from './components/ClassView';
import { QuizBankView } from './components/QuizBankView';
import { StageView } from './components/StageView';
import { ScannerView } from './components/ScannerView';
import { PairModal } from './components/PairModal';
import { RescueModal } from './components/RescueModal';
import { PrintSheet, printClassCards } from './components/PrintSheet';
import { parseMarkdownQuestions } from './lib/parser';
import { exportToXlsx, downloadText, getStudentList } from './lib/export';
import { portableApi, readyHost, subscribeToStatus, getStatus, closeHost } from './lib/net';
import { DEFAULT_TEACHER, SAMPLE_CLASSES, SAMPLE_QUIZ_BANKS } from './lib/sampleData';

const STORAGE_KEY = 'ndh-tg-v1';

function getInitialData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.classes)) {
        // Đổi tên "Thầy Hoàng" thành "NgĐ Hoàng" nếu là dữ liệu cũ
        let teacher = parsed.teacher || DEFAULT_TEACHER;
        if (teacher === 'Thầy Hoàng') {
          teacher = DEFAULT_TEACHER;
        }
        return {
          teacher,
          classes: parsed.classes.length > 0 ? parsed.classes : SAMPLE_CLASSES,
          quizBanks:
            Array.isArray(parsed.quizBanks) && parsed.quizBanks.length > 0
              ? parsed.quizBanks
              : SAMPLE_QUIZ_BANKS
        };
      }
    }
  } catch {}

  return {
    teacher: DEFAULT_TEACHER,
    classes: SAMPLE_CLASSES,
    quizBanks: SAMPLE_QUIZ_BANKS
  };
}

function getInitialView(): 'home' | 'class' | 'stage' | 'scanner' | 'quizBanks' {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('scan')) return 'scanner';
  const path = window.location.pathname;
  if (
    path === '/bo-cau-hoi' ||
    path.startsWith('/bo-cau-hoi') ||
    urlParams.get('tab') === 'bo-cau-hoi' ||
    window.location.hash === '#/bo-cau-hoi'
  ) {
    return 'quizBanks';
  }
  return 'home';
}

export function App() {
  const [data, setData] = useState<AppData>(getInitialData);
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'class' | 'stage' | 'scanner' | 'quizBanks'>(getInitialView);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stageTheme, setStageTheme] = useState<'dark' | 'cream'>('dark');
  const [room, setRoom] = useState<SessionState | null>(null);
  const [hostKey, setHostKey] = useState<string>('');
  const [phoneConnected, setPhoneConnected] = useState(false);

  // Modals
  const [showPairModal, setShowPairModal] = useState(false);
  const [showRescueModal, setShowRescueModal] = useState(false);

  // Hidden file inputs
  const fileMdRef = useRef<HTMLInputElement | null>(null);
  const fileJsonRef = useRef<HTMLInputElement | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const lastSavedCodeRef = useRef<string>('');

  const currentClass = data.classes.find(c => c.id === currentClassId);

  // Persist data
  const saveData = useCallback((newData: AppData) => {
    setData(newData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch {
      showToast('Không thể lưu vào bộ nhớ trình duyệt. Hãy tải file sao lưu.');
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Navigate function maintaining slug history
  const navigateTo = useCallback((targetView: 'home' | 'quizBanks' | 'class') => {
    if (targetView === 'quizBanks') {
      window.history.pushState(null, '', '/bo-cau-hoi');
      setView('quizBanks');
      setCurrentClassId(null);
    } else if (targetView === 'home') {
      window.history.pushState(null, '', '/');
      setView('home');
      setCurrentClassId(null);
    } else {
      setView('class');
    }
  }, []);

  // Sync with browser back/forward and hash changes
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('scan')) {
        setView('scanner');
        return;
      }
      if (
        path === '/bo-cau-hoi' ||
        path.startsWith('/bo-cau-hoi') ||
        urlParams.get('tab') === 'bo-cau-hoi' ||
        window.location.hash === '#/bo-cau-hoi'
      ) {
        setView('quizBanks');
      } else {
        setView(currentClassId ? 'class' : 'home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentClassId]);

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('ndh-theme');
    if (savedTheme === 'cream' || savedTheme === 'dark') {
      setStageTheme(savedTheme);
    }
  }, []);

  // Listen to PeerJS network connection status
  useEffect(() => {
    const unsub = subscribeToStatus(status => {
      setPhoneConnected(!!status.phoneConnected);
    });
    return unsub;
  }, []);

  // Periodic poll during active stage
  useEffect(() => {
    if (view !== 'stage' || !room || !hostKey) return;
    const interval = setInterval(async () => {
      try {
        const res = await portableApi(`/rooms/${room.code}?role=host`, 'GET', null, hostKey);
        if (res.state) {
          setRoom(res.state);

          // Save results automatically when quiz finishes
          if (res.state.phase === 'finished' && currentClass && lastSavedCodeRef.current !== res.state.code) {
            lastSavedCodeRef.current = res.state.code;
            const updatedClasses = data.classes.map(c => {
              if (c.id === currentClass.id) {
                const historyCount = res.state.history?.length || res.state.questionCount || 1;
                const scores: { id: number; name: string; score: number }[] = res.state.players.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  score: p.score
                }));
                const newRes = {
                  at: Date.now(),
                  total: historyCount,
                  rows: scores
                };
                return {
                  ...c,
                  results: [newRes, ...(c.results || [])]
                };
              }
              return c;
            });
            saveData({ ...data, classes: updatedClasses });
            showToast('Đã tự động lưu kết quả kiểm tra của lớp!');
          }
        }
      } catch {}
    }, 1200);
    return () => clearInterval(interval);
  }, [view, room, hostKey, currentClass, data, saveData, showToast]);

  // Class action handlers
  const handleAddClass = () => {
    const newId = 'c_' + Date.now();
    const newClass: ClassItem = {
      id: newId,
      name: `Lớp mới ${data.classes.length + 1}`,
      subject: 'Toán học',
      names: '1. Nguyễn Văn An\n2. Trần Thị Bình\n3. Lê Văn Cường',
      md: SAMPLE_CLASSES[0].md,
      sec: 30,
      elim: false,
      results: []
    };
    saveData({ ...data, classes: [newClass, ...data.classes] });
    setCurrentClassId(newId);
    setView('class');
    showToast('Đã tạo lớp học mới.');
  };

  const handleUpdateClass = (updated: Partial<ClassItem>) => {
    if (!currentClassId) return;
    const updatedClasses = data.classes.map(c => {
      if (c.id === currentClassId) {
        return { ...c, ...updated };
      }
      return c;
    });
    saveData({ ...data, classes: updatedClasses });
  };

  const handleDeleteClass = (id: string) => {
    const updatedClasses = data.classes.filter(c => c.id !== id);
    saveData({ ...data, classes: updatedClasses });
    if (currentClassId === id) {
      setCurrentClassId(null);
      navigateTo('home');
    }
    showToast('Đã xóa lớp học.');
  };

  const handleStartQuiz = async () => {
    if (!currentClass) return;
    const students = getStudentList(currentClass);
    if (!students.length) {
      showToast('Lớp chưa có học sinh. Hãy nhập danh sách tên học sinh.');
      return;
    }
    const parseResult = parseMarkdownQuestions(currentClass.md, currentClass.sec || 30);
    if (!parseResult.qs.length) {
      showToast('Chưa có câu hỏi hợp lệ. Hãy kiểm tra lại cú pháp Markdown.');
      return;
    }

    try {
      showToast('Đang khởi tạo phòng thi...');
      const players = students.map((name, i) => ({
        id: i + 1,
        name,
        alive: true,
        score: 0
      }));

      const res = await portableApi('/rooms', 'POST', {
        config: {
          className: currentClass.name,
          subject: currentClass.subject,
          seconds: currentClass.sec || 30,
          eliminate: !!currentClass.elim,
          sound: true,
          music: true,
          volume: 0.8
        },
        players,
        questions: parseResult.qs
      });

      if (res.state && res.hostKey) {
        setRoom(res.state);
        setHostKey(res.hostKey);
        setView('stage');

        // Automatically open WebRTC datachannel listening
        try {
          await readyHost(res.state.code);
        } catch (e: any) {
          console.warn('WebRTC Host initialization notice:', e);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi tạo phòng thi');
    }
  };

  const handleStageAction = async (act: string, extra?: any) => {
    if (!room || !hostKey) return;
    try {
      const res = await portableApi(
        `/rooms/${room.code}/action`,
        'POST',
        { action: act, ...extra },
        hostKey
      );
      if (res.state) {
        setRoom(res.state);
      }
    } catch (e: any) {
      showToast(e.message || 'Lỗi thao tác sân khấu');
    }
  };

  const handleDeleteResult = (idx: number) => {
    if (!currentClassId) return;
    const updated = data.classes.map(c => {
      if (c.id === currentClassId) {
        const results = [...(c.results || [])];
        results.splice(idx, 1);
        return { ...c, results };
      }
      return c;
    });
    saveData({ ...data, classes: updated });
    showToast('Đã xóa kết quả kiểm tra.');
  };

  const handlePrintCards = () => {
    if (!currentClass) return;
    printClassCards(currentClass, showToast);
  };

  // Quiz Bank Handlers
  const handleSaveQuizBank = (quiz: QuizBank) => {
    const existing = (data.quizBanks || []).some(q => q.id === quiz.id);
    let updatedQuizBanks: QuizBank[];
    if (existing) {
      updatedQuizBanks = (data.quizBanks || []).map(q => (q.id === quiz.id ? quiz : q));
    } else {
      updatedQuizBanks = [quiz, ...(data.quizBanks || [])];
    }
    saveData({ ...data, quizBanks: updatedQuizBanks });
  };

  const handleSaveBulkQuizBanks = (newQuizzes: QuizBank[]) => {
    const updated = [...newQuizzes, ...(data.quizBanks || [])];
    saveData({ ...data, quizBanks: updated });
  };

  const handleDeleteQuizBank = (id: string) => {
    const updated = (data.quizBanks || []).filter(q => q.id !== id);
    saveData({ ...data, quizBanks: updated });
  };

  const handleApplyQuizToClass = (quiz: QuizBank, classId: string) => {
    const updatedClasses = data.classes.map(c => {
      if (c.id === classId) {
        return {
          ...c,
          md: quiz.md,
          sec: quiz.sec || c.sec || 30,
          subject: c.subject || quiz.subject
        };
      }
      return c;
    });
    saveData({ ...data, classes: updatedClasses });
    setCurrentClassId(classId);
    setView('class');
    window.history.pushState(null, '', '/');
    showToast(`Đã nạp bộ đề "${quiz.title}" vào lớp! Thầy cô có thể chỉnh sửa tự do.`);
  };

  const handleSaveCurrentAsQuizBank = (
    title: string,
    subject: string,
    md: string,
    sec: number
  ) => {
    const newQuiz: QuizBank = {
      id: 'qb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      subject,
      md,
      sec,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const updated = [newQuiz, ...(data.quizBanks || [])];
    saveData({ ...data, quizBanks: updated });
    showToast(`Đã lưu "${title}" vào kho đề thi!`);
  };

  // Import / Export handlers
  const handleExportAllXlsx = () => {
    exportToXlsx(data.classes, data.teacher);
    showToast('Đang tải file Excel kết quả toàn bộ các lớp.');
  };

  const handleExportClassXlsx = () => {
    if (currentClass) {
      exportToXlsx([currentClass], data.teacher);
      showToast('Đang tải file Excel kết quả lớp ' + currentClass.name);
    }
  };

  const handleBackup = () => {
    downloadText('NDH-sao-luu.json', JSON.stringify(data, null, 2), 'application/json');
    showToast('Đã tải bản sao lưu dữ liệu.');
  };

  const handleRestoreClick = () => {
    fileJsonRef.current?.click();
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.classes)) {
        throw new Error('Định dạng sao lưu không hợp lệ.');
      }
      saveData({
        teacher: parsed.teacher || DEFAULT_TEACHER,
        classes: parsed.classes,
        quizBanks: Array.isArray(parsed.quizBanks) ? parsed.quizBanks : SAMPLE_QUIZ_BANKS
      });
      showToast('Đã khôi phục dữ liệu thành công.');
    } catch {
      showToast('Tệp sao lưu không hợp lệ.');
    }
  };

  const handleImportMdClick = () => {
    fileMdRef.current?.click();
  };

  const handleImportMdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentClass) return;
    try {
      const text = await file.text();
      handleUpdateClass({ md: text });
      showToast('Đã nhập câu hỏi từ file Markdown.');
    } catch {
      showToast('Không đọc được file Markdown.');
    }
  };

  const handleExportMd = () => {
    if (!currentClass) return;
    downloadText(
      `${currentClass.name || 'lop'}-cau-hoi.md`,
      currentClass.md || '',
      'text/markdown'
    );
    showToast('Đã tải file câu hỏi Markdown.');
  };

  const handleThemeToggle = () => {
    const nextTheme = stageTheme === 'dark' ? 'cream' : 'dark';
    setStageTheme(nextTheme);
    localStorage.setItem('ndh-theme', nextTheme);
  };

  const handleExitStage = () => {
    closeHost();
    setRoom(null);
    setHostKey('');
    setView('class');
  };

  // URL Hash/Scan pairing for companion scanner
  const urlScanCode = new URLSearchParams(window.location.search).get('scan') || '';
  const urlPairHash = window.location.hash.startsWith('#pair=')
    ? decodeURIComponent(window.location.hash.slice(6))
    : '';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-black">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-black text-white font-bold border-2 border-white px-5 py-2.5 z-50 shadow-2xl transition max-w-lg text-center"
        >
          {toastMessage}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileMdRef}
        type="file"
        accept=".md,.txt"
        className="hidden"
        onChange={handleImportMdFile}
      />
      <input
        ref={fileJsonRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleRestoreFile}
      />

      {/* App Header (except inside full stage) */}
      {view !== 'stage' && (
        <Header
          subtitle={
            view === 'class'
              ? currentClass?.name
              : view === 'scanner'
              ? 'Quét thẻ'
              : undefined
          }
          activeTab={view === 'quizBanks' ? 'quizBanks' : 'classes'}
          onNavigateTab={tab => navigateTo(tab === 'quizBanks' ? 'quizBanks' : 'home')}
          onHomeClick={() => navigateTo('home')}
        >
          {view === 'home' && (
            <button
              className="ndh-btn text-sm py-1.5 px-3 flex items-center gap-1.5"
              onClick={() => setView('scanner')}
            >
              📷 Máy quét thẻ
            </button>
          )}

          {view === 'class' && (
            <>
              <button
                className="ndh-btn text-sm py-1.5 px-3"
                onClick={() => navigateTo('home')}
              >
                Danh sách lớp
              </button>
              <button
                className="ndh-btn ndh-btn-pri text-sm py-1.5 px-3"
                onClick={handleStartQuiz}
              >
                ▶ Bắt đầu kiểm tra
              </button>
            </>
          )}

          {view === 'scanner' && (
            <button
              className="ndh-btn text-sm py-1.5 px-3"
              onClick={() => setView(currentClassId ? 'class' : 'home')}
            >
              Về bảng điều khiển
            </button>
          )}
        </Header>
      )}

      {/* Main Content Router */}
      <main className="flex-1">
        {view === 'home' && (
          <HomeView
            data={data}
            onUpdateTeacher={name => saveData({ ...data, teacher: name })}
            onOpenClass={id => {
              setCurrentClassId(id);
              setView('class');
            }}
            onAddClass={handleAddClass}
            onExportXlsx={handleExportAllXlsx}
            onBackup={handleBackup}
            onRestore={handleRestoreClick}
          />
        )}

        {view === 'quizBanks' && (
          <QuizBankView
            quizBanks={data.quizBanks || []}
            classes={data.classes}
            onSaveQuizBank={handleSaveQuizBank}
            onSaveBulkQuizBanks={handleSaveBulkQuizBanks}
            onDeleteQuizBank={handleDeleteQuizBank}
            onApplyToClass={handleApplyQuizToClass}
            onNavigateToClasses={() => navigateTo('home')}
            onShowToast={showToast}
          />
        )}

        {view === 'class' && currentClass && (
          <ClassView
            cls={currentClass}
            quizBanks={data.quizBanks || []}
            onUpdateClass={handleUpdateClass}
            onBackToHome={() => navigateTo('home')}
            onPrintCards={handlePrintCards}
            onImportMd={handleImportMdClick}
            onExportMd={handleExportMd}
            onExportClassXlsx={handleExportClassXlsx}
            onDeleteResult={handleDeleteResult}
            onStartQuiz={handleStartQuiz}
            onSaveCurrentAsQuizBank={handleSaveCurrentAsQuizBank}
          />
        )}

        {view === 'stage' && currentClass && room && (
          <StageView
            cls={currentClass}
            room={room}
            theme={stageTheme}
            phoneConnected={phoneConnected}
            onThemeToggle={handleThemeToggle}
            onAction={handleStageAction}
            onOpenPairModal={() => setShowPairModal(true)}
            onOpenRescueModal={() => setShowRescueModal(true)}
            onExportXlsx={handleExportClassXlsx}
            onExit={handleExitStage}
          />
        )}

        {view === 'scanner' && (
          <ScannerView
            initialCode={urlScanCode || room?.code || ''}
            initialPair={urlPairHash || room?.pairKey || ''}
            onExit={() => setView(room ? 'stage' : currentClassId ? 'class' : 'home')}
          />
        )}
      </main>

      {/* Modals */}
      {showPairModal && room && currentClass && (
        <PairModal
          className={currentClass.name}
          roomCode={room.code}
          pairKey={room.pairKey || ''}
          pairPin={room.pairPin || ''}
          onClose={() => setShowPairModal(false)}
          onShowToast={showToast}
        />
      )}

      {showRescueModal && room && (
        <RescueModal
          deadPlayers={room.players.filter(p => !p.alive)}
          onRescue={ids => handleStageAction('rescue', { ids })}
          onClose={() => setShowRescueModal(false)}
        />
      )}

      {/* Always ready print sheets for current class */}
      {currentClass && <PrintSheet cls={currentClass} />}
    </div>
  );
}

export default App;
