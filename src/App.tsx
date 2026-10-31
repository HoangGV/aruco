import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppData, ClassItem, SessionState } from './types';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { ClassView } from './components/ClassView';
import { StageView } from './components/StageView';
import { ScannerView } from './components/ScannerView';
import { PairModal } from './components/PairModal';
import { RescueModal } from './components/RescueModal';
import { PrintSheet, printClassCards } from './components/PrintSheet';
import { parseMarkdownQuestions } from './lib/parser';
import { exportToXlsx, downloadText, getStudentList } from './lib/export';
import { portableApi, readyHost, subscribeToStatus, getStatus, closeHost } from './lib/net';

const STORAGE_KEY = 'ndh-tg-v1';

const DEFAULT_SAMPLE_MD = `## Hàm số $y=x^3-3x+1$ có đạo hàm là:
A. $3x^2-3$
B. $x^2-3$
C. $3x^2+1$
D. $3x-3$
Đáp án: A
Giải thích: Ta có $(x^3)' = 3x^2$, $(-3x)' = -3$, $(1)' = 0$. Do đó $y' = 3x^2 - 3$.
Thời gian: 30

## Đồ thị hàm số $y=\\frac{1}{x-2}$ có tiệm cận đứng là $x=2$.
Đáp án: Đúng
Giải thích: Khi $x \\to 2$, mẫu số tiến về $0$ nên $y \\to \\infty$.

## Giá trị nhỏ nhất của $f(x)=x^2-2x+3$ trên đoạn $[0; 3]$ là:
A. $3$
B. $6$
C. $2$
D. $1$
Đáp án: C
Giải thích: $f(x) = (x-1)^2 + 2 \\ge 2$. Dấu bằng xảy ra khi $x = 1 \\in [0;3]$.
Thời gian: 30

## Hàm số $y=-x^3+3x$ đồng biến trên toàn bộ $\\mathbb{R}$.
Đáp án: Sai
Giải thích: $y' = -3x^2 + 3 = 0 \\iff x = \\pm 1$. Đạo hàm đổi dấu nên không đồng biến trên $\\mathbb{R}$.`;

const DEFAULT_STUDENTS = `1. Nguyễn Văn An
2. Trần Thị Bình
3. Lê Văn Cường
4. Phạm Hoàng Dũng
5. Đỗ Minh Hạnh
6. Bùi Quang Huy
7. Vũ Khánh Linh
8. Hoàng Ngọc Mai`;

function getInitialData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.classes)) return parsed;
    }
  } catch {}

  // Check older draft storage if available
  try {
    const old = localStorage.getItem('ndh-draft-html-v2');
    if (old) {
      const p = JSON.parse(old);
      if (p.players && p.questions) {
        return {
          teacher: p.config?.teacher || '',
          classes: [
            {
              id: 'c_migrated',
              name: p.config?.className || 'Lớp 12A1',
              subject: p.config?.subject || 'Toán học',
              names: p.players.map((pl: any) => pl.name).join('\n'),
              md: DEFAULT_SAMPLE_MD,
              sec: p.config?.seconds || 30,
              elim: false,
              results: []
            }
          ]
        };
      }
    }
  } catch {}

  return {
    teacher: 'Thầy Hoàng',
    classes: [
      {
        id: 'c_default',
        name: 'Lớp 12A1',
        subject: 'Toán học',
        names: DEFAULT_STUDENTS,
        md: DEFAULT_SAMPLE_MD,
        sec: 30,
        elim: false,
        results: []
      }
    ]
  };
}

export function App() {
  const [data, setData] = useState<AppData>(getInitialData);
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'class' | 'stage' | 'scanner'>('home');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stageTheme, setStageTheme] = useState<'dark' | 'cream'>('dark');
  const [room, setRoom] = useState<SessionState | null>(null);
  const [hostKey, setHostKey] = useState<string>('');
  const [phoneConnected, setPhoneConnected] = useState(false);

  // Modals
  const [showPairModal, setShowPairModal] = useState(false);
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

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

  // Check URL parameters for companion scanner
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scanCode = urlParams.get('scan');
    if (scanCode) {
      setView('scanner');
    }

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
                const newResult = {
                  at: Date.now(),
                  total: historyCount,
                  rows: res.state.players.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    score: p.score / 10
                  }))
                };
                return {
                  ...c,
                  results: [newResult, ...(c.results || [])]
                };
              }
              return c;
            });
            saveData({ ...data, classes: updatedClasses });
            showToast('Đã tự động lưu kết quả kiểm tra.');
          }
        }
      } catch {}
    }, 400);

    return () => clearInterval(interval);
  }, [view, room, hostKey, currentClass, data, saveData, showToast]);

  // Stage action handler
  const handleStageAction = async (action: string, extra: any = {}) => {
    if (!room || !hostKey) return;
    try {
      const res = await portableApi(
        `/rooms/${room.code}/action`,
        'POST',
        { action, ...extra },
        hostKey
      );
      if (res.state) {
        setRoom(res.state);
      }
    } catch (e: any) {
      showToast(e.message || 'Lỗi điều khiển phòng');
    }
  };

  // Start quiz session
  const handleStartQuiz = async () => {
    if (!currentClass) return;
    const students = getStudentList(currentClass);
    if (!students.length) return showToast('Hãy nhập danh sách học sinh.');
    if (students.length > 250) return showToast('Tối đa 250 học sinh mỗi lớp.');

    const parsed = parseMarkdownQuestions(currentClass.md, currentClass.sec || 30);
    if (parsed.err.length || !parsed.qs.length) {
      return showToast(parsed.err[0] || 'Hãy nhập ít nhất một câu hỏi hợp lệ.');
    }

    try {
      const res = await portableApi(
        '/rooms',
        'POST',
        {
          config: {
            eliminate: !!currentClass.elim,
            seconds: currentClass.sec || 30,
            className: currentClass.name,
            subject: currentClass.subject,
            teacher: data.teacher
          },
          players: students.map((name, i) => ({ id: i + 1, name })),
          questions: parsed.qs
        },
        ''
      );

      setHostKey(res.hostKey);
      setRoom(res.state);
      lastSavedCodeRef.current = '';
      setView('stage');

      // Initialize WebRTC signaling
      readyHost(res.state.code)
        .then(() => {
          setPhoneConnected(getStatus().phoneConnected);
        })
        .catch(() => {});
    } catch (e: any) {
      showToast(e.message || 'Không thể tạo phiên kiểm tra');
    }
  };

  // Class Management Handlers
  const handleAddClass = () => {
    const newClass: ClassItem = {
      id: 'c_' + Date.now().toString(36),
      name: 'Lớp mới',
      subject: '',
      names: '',
      md: '',
      sec: 30,
      elim: false,
      results: []
    };
    const updated = [...data.classes, newClass];
    saveData({ ...data, classes: updated });
    setCurrentClassId(newClass.id);
    setView('class');
    showToast('Đã thêm lớp mới.');
  };

  const handleUpdateClass = (updatedFields: Partial<ClassItem>) => {
    if (!currentClassId) return;
    const updated = data.classes.map(c =>
      c.id === currentClassId ? { ...c, ...updatedFields } : c
    );
    saveData({ ...data, classes: updated });
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
      saveData({ teacher: parsed.teacher || '', classes: parsed.classes });
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
          onHomeClick={() => setView('home')}
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
                onClick={() => setView('home')}
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

        {view === 'class' && currentClass && (
          <ClassView
            cls={currentClass}
            onUpdateClass={handleUpdateClass}
            onBackToHome={() => setView('home')}
            onPrintCards={handlePrintCards}
            onImportMd={handleImportMdClick}
            onExportMd={handleExportMd}
            onExportClassXlsx={handleExportClassXlsx}
            onDeleteResult={handleDeleteResult}
            onStartQuiz={handleStartQuiz}
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
