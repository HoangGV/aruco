import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraSession, calculateFrameSize, allowedAnswer, filterAcknowledged, getCameraErrorMessage } from '../lib/camera';
import { CardMarkers } from '../lib/markers';
import { portableApi, joinScanner } from '../lib/net';
import { gameAudio } from '../lib/audio';

interface ScannerViewProps {
  initialCode?: string;
  initialPair?: string;
  onExit?: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  initialCode = '',
  initialPair = '',
  onExit
}) => {
  const [roomCode] = useState(initialCode);
  const [joined, setJoined] = useState(false);
  const [scannerKey, setScannerKey] = useState('');
  const [sessionState, setSessionState] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('Đang kết nối…');
  const [logs, setLogs] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<CameraSession | null>(null);
  const trackerRef = useRef<any>(null);
  const isBusyRef = useRef(false);
  const stateRef = useRef<any>(null);
  const scannerKeyRef = useRef('');

  stateRef.current = sessionState;
  scannerKeyRef.current = scannerKey;

  const handleJoin = useCallback(async (codeToJoin: string, pairKeyOrPin: string) => {
    if (!codeToJoin.trim()) {
      setStatusMsg('Chưa có mã phòng. Hãy quét mã QR từ máy tính.');
      return;
    }
    setStatusMsg('Đang ghép nối…');
    try {
      const res = await joinScanner(codeToJoin.trim(), pairKeyOrPin.trim(), (nextState) => {
        setSessionState(nextState);
      });
      setScannerKey(res.scannerKey);
      setSessionState(res.state);
      setJoined(true);
      setStatusMsg('Đã kết nối phòng ' + codeToJoin);
      try {
        sessionStorage.setItem('ndh-pair-' + codeToJoin, pairKeyOrPin);
      } catch {}
    } catch (err: any) {
      setStatusMsg(err.message || 'Chưa kết nối được. Hãy quét lại mã QR.');
    }
  }, []);

  // Auto-connect when scanned via QR code
  useEffect(() => {
    const code = initialCode || new URLSearchParams(window.location.search).get('scan') || '';
    const pair = initialPair || (window.location.hash.startsWith('#pair=') ? decodeURIComponent(window.location.hash.slice(6)) : '');
    const cachedPair = code ? sessionStorage.getItem('ndh-pair-' + code) || '' : '';
    const keyToUse = pair || cachedPair;

    if (code) {
      handleJoin(code, keyToUse);
    } else {
      setStatusMsg('Hãy quét mã QR từ màn hình máy tính để kết nối.');
    }
  }, [initialCode, initialPair, handleJoin]);

  // Periodic poll scanner state
  useEffect(() => {
    if (!joined || !roomCode) return;
    const interval = setInterval(async () => {
      try {
        const res = await portableApi(
          `/rooms/${roomCode}?role=scanner`,
          'GET',
          null,
          scannerKeyRef.current
        );
        if (res.state) {
          setSessionState(res.state);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [joined, roomCode]);

  // Start Camera
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      if (!sessionRef.current) {
        sessionRef.current = new CameraSession({
          onInterrupted: msg => setStatusMsg(msg)
        });
      }
      setStatusMsg('Đang mở camera…');
      await sessionRef.current.open(videoRef.current, { facingMode: 'environment' });
      trackerRef.current = CardMarkers.createTracker({ stableReads: 3, minStableMs: 400 });
      setCameraActive(true);
      setStatusMsg(scannerKeyRef.current ? 'Đã kết nối máy tính' : 'Camera đã bật');

      if (!hiddenCanvasRef.current) {
        hiddenCanvasRef.current = document.createElement('canvas');
      }

      runDetectionLoop();
    } catch (e: any) {
      setStatusMsg(getCameraErrorMessage(e));
      setCameraActive(false);
    }
  };

  // Stop Camera (Requirement 1: toggle camera)
  const stopCamera = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    setCameraActive(false);
    setStatusMsg('Camera đã tắt');
    if (overlayCanvasRef.current) {
      const g = overlayCanvasRef.current.getContext('2d');
      g?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  const sendBatch = async (fresh: any[]) => {
    if (isBusyRef.current || !stateRef.current?.currentQuestion) return;
    isBusyRef.current = true;
    const curQ = stateRef.current.currentQuestion;
    const batch = fresh.map(d => ({ id: d.id, answer: d.answer }));

    try {
      const r = await portableApi(
        `/rooms/${roomCode}/answers`,
        'POST',
        { questionId: curQ.id, batch },
        scannerKeyRef.current
      );

      const previousSubmissions = stateRef.current?.submissions || {};
      const ok = filterAcknowledged(batch, r.state, roomCode, curQ.id);
      if (ok.length) {
        gameAudio.beep();
        const newEntries = ok.map(a => {
          const p = r.state.players?.find((pl: any) => pl.id === a.id);
          const oldAns = previousSubmissions[a.id];
          if (oldAns && oldAns !== a.answer) {
            return `${p?.name || `Học sinh ${a.id}`}: ${a.answer} (đổi từ ${oldAns})`;
          }
          return `${p?.name || `Học sinh ${a.id}`}: ${a.answer}`;
        });
        setLogs(prev => [...newEntries, ...prev].slice(0, 10));
      }
      if (r.state) setSessionState(r.state);
    } catch (e: any) {
      setStatusMsg(e.message || 'Lỗi gửi đáp án');
    } finally {
      isBusyRef.current = false;
    }
  };

  const runDetectionLoop = () => {
    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    const hidden = hiddenCanvasRef.current;
    const session = sessionRef.current;

    if (!video || !overlay || !hidden || !session?.stream) return;

    if (stateRef.current?.phase === 'question' && video.videoWidth > 0) {
      const { width: w, height: h } = calculateFrameSize(video.videoWidth, video.videoHeight, 800);
      hidden.width = overlay.width = w;
      hidden.height = overlay.height = h;

      const fx = hidden.getContext('2d', { willReadFrequently: true });
      const g = overlay.getContext('2d');

      if (fx && g) {
        fx.drawImage(video, 0, 0, w, h);
        const imageData = fx.getImageData(0, 0, w, h);
        const found = CardMarkers.detect(imageData);

        g.clearRect(0, 0, w, h);
        g.lineWidth = 4;
        g.strokeStyle = '#2F54D0';

        const valid = found.filter(d => {
          const p = stateRef.current.players?.find((pl: any) => pl.id === d.id);
          // Draw marker outline polygon
          g.beginPath();
          d.corners.forEach((c: any, idx: number) => {
            if (idx === 0) g.moveTo(c.x, c.y);
            else g.lineTo(c.x, c.y);
          });
          g.closePath();
          g.stroke();

          return (
            p &&
            p.alive &&
            allowedAnswer(d.answer, stateRef.current.currentQuestion.type) &&
            CardMarkers.assess(d, w, h, 36).ok
          );
        });

        if (trackerRef.current) {
          const fresh = trackerRef.current.observe(valid, performance.now());
          if (fresh.length) {
            sendBatch(fresh);
          }
        }
      }
    }

    setTimeout(runDetectionLoop, 120);
  };

  // Requirement 2: Status format (câu số bao nhiêu/tổng số câu và trạng thái đang mở/đã đóng)
  const isQuestionOpen = sessionState?.phase === 'question';
  const isPaused = sessionState?.phase === 'paused';
  const statusLabel = isQuestionOpen
    ? 'Đang mở'
    : isPaused
    ? 'Tạm dừng'
    : 'Đã đóng';

  const statusBg = isQuestionOpen
    ? 'bg-emerald-600 text-white'
    : isPaused
    ? 'bg-amber-500 text-black'
    : 'bg-neutral-800 text-white';

  const questionIndex = sessionState?.index !== undefined && sessionState.index >= 0
    ? sessionState.index + 1
    : 1;
  const totalQuestions = sessionState?.questionCount || 0;

  return (
    <div className="max-w-2xl mx-auto p-3 md:p-4 space-y-3">
      {/* Top Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[#2F54D0]">NDH · Quét thẻ</h1>
          <p className="text-xs md:text-sm font-semibold text-neutral-600">{statusMsg}</p>
        </div>
        {onExit && (
          <button className="ndh-btn text-sm py-1 px-3" onClick={onExit}>
            Đóng
          </button>
        )}
      </div>

      {/* Requirement 2: Clean Question & Status Indicator (No full text) */}
      <div className="ndh-box p-3 flex justify-between items-center bg-white shadow-sm">
        <div className="text-lg md:text-xl font-black">
          {sessionState ? (
            `Câu ${questionIndex}/${totalQuestions}`
          ) : (
            'Đang kết nối phiên…'
          )}
        </div>
        <div className={`text-sm md:text-base font-black px-3 py-1 uppercase tracking-wide ${statusBg}`}>
          {statusLabel}
        </div>
      </div>

      {/* Camera Live Viewport (Maximum space - Requirement 1) */}
      <div className="ndh-box overflow-hidden relative aspect-4/3 md:aspect-16/10 bg-black w-full shadow-lg">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-contain"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-white p-4 text-center space-y-3">
            <span className="text-4xl">📷</span>
            <span className="font-bold text-lg">Camera đang tắt</span>
            <p className="text-xs text-neutral-400 max-w-xs">
              Bấm nút bên dưới để bật camera và hướng về các thẻ ArUco của học sinh
            </p>
          </div>
        )}
      </div>

      {/* Requirement 1: Camera Toggle Button (Bật/Tắt camera) */}
      <div>
        {cameraActive ? (
          <button
            className="ndh-btn ndh-btn-dng w-full py-3 text-lg md:text-xl font-black flex items-center justify-center gap-2"
            onClick={stopCamera}
          >
            ⏹ Tắt camera
          </button>
        ) : (
          <button
            className="ndh-btn ndh-btn-pri w-full py-3.5 text-lg md:text-xl font-black flex items-center justify-center gap-2"
            onClick={startCamera}
          >
            📷 Bật camera quét thẻ
          </button>
        )}
      </div>

      {/* Live Recognized Answers Feed */}
      <section className="ndh-box p-3 space-y-2 bg-white">
        <div className="flex justify-between items-center border-b-2 border-black pb-1">
          <h3 className="font-bold text-sm">
            Thẻ đã nhận gần nhất ({logs.length})
          </h3>
          {logs.length > 0 && (
            <button
              className="text-xs text-neutral-500 hover:text-black font-semibold"
              onClick={() => setLogs([])}
            >
              Xóa log
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <p className="text-neutral-500 text-xs md:text-sm py-2 text-center">
            {isQuestionOpen
              ? 'Đang chờ học sinh giơ thẻ… Giữ yên camera hướng vào lớp.'
              : 'Câu hỏi chưa mở. Chờ giáo viên bấm Bắt đầu trên máy tính.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-xs md:text-sm">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="p-1.5 border border-black bg-emerald-50 text-emerald-950 font-bold flex items-center gap-1.5"
              >
                <span className="text-emerald-600">✓</span> {log}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
