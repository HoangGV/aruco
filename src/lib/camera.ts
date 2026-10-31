/* Camera session management */

export function getPlatformInfo() {
  if (typeof navigator === 'undefined') return { ios: false, android: false, embedded: false, browser: 'Chrome' };
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return {
    ios,
    android: /Android/i.test(ua),
    embedded: /FBAN|FBAV|Instagram|Zalo|Line\//i.test(ua),
    browser: ios ? 'Safari' : 'Chrome'
  };
}

export function getCameraErrorMessage(error: any): string {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Chưa được cấp quyền camera. Mở bằng Safari trên iOS hoặc Chrome trên Android, cho phép camera cho trang này rồi bấm Bật camera lại.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Camera đang bận hoặc bị gián đoạn. Đóng ứng dụng đang dùng camera rồi bấm Bật camera lại.';
    case 'NotFoundError':
      return 'Không tìm thấy camera. Kiểm tra quyền và thử camera khác.';
    case 'OverconstrainedError':
      return 'Camera không đáp ứng thiết lập. Chọn lại camera sau rồi thử lại.';
    default:
      return error?.message || 'Chưa mở được camera. Hãy thử lại.';
  }
}

export function calculateFrameSize(width: number, height: number, longEdge = 800) {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export class CameraSession {
  private serial = 0;
  stream: MediaStream | null = null;
  video: HTMLVideoElement | null = null;
  private listeners: [EventTarget, string, EventListener][] = [];
  private muteTimer: any = null;
  private onInterrupted: (msg: string) => void;

  constructor({ onInterrupted = () => {} }: { onInterrupted?: (msg: string) => void } = {}) {
    this.onInterrupted = onInterrupted;
  }

  close() {
    this.serial++;
    clearTimeout(this.muteTimer);
    for (const [target, name, handler] of this.listeners) {
      target.removeEventListener?.(name, handler);
    }
    this.listeners = [];
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      try {
        this.video.pause();
      } catch {}
      this.video.srcObject = null;
      this.video = null;
    }
  }

  async open(video: HTMLVideoElement, { deviceId = '', facingMode = 'environment' }: { deviceId?: string; facingMode?: string } = {}) {
    this.close();
    const currentSerial = this.serial;

    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Mở qua HTTPS bằng Safari trên iOS hoặc Chrome trên Android để dùng camera.');
    }

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    const preferred: MediaStreamConstraints = {
      audio: false,
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facingMode } }),
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 15, max: 24 }
      }
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(preferred);
    } catch (e: any) {
      if (!['OverconstrainedError', 'NotFoundError'].includes(e.name)) throw e;
      if (currentSerial !== this.serial) throw new Error('Đã dừng yêu cầu camera.');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facingMode } }
      });
    }

    if (currentSerial !== this.serial) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('Đã dừng yêu cầu camera.');
    }

    this.stream = stream;
    this.video = video;
    video.srcObject = stream;

    let timer: any;
    try {
      await Promise.race([
        video.play(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Camera chưa phát hình. Bấm Bật camera lại.')), 8000);
        })
      ]);
      if (currentSerial !== this.serial) throw new Error('Đã dừng yêu cầu camera.');
    } catch (e) {
      if (currentSerial === this.serial) this.close();
      throw e;
    } finally {
      clearTimeout(timer);
    }

    const track = stream.getVideoTracks()[0];
    if (!track) {
      this.close();
      throw new Error('Camera không cung cấp hình ảnh.');
    }

    const interrupt = () => {
      if (currentSerial === this.serial) {
        this.close();
        this.onInterrupted('Camera bị gián đoạn. Bấm Tiếp tục camera để mở lại.');
      }
    };

    const addL = (name: string, fn: EventListener) => {
      track.addEventListener(name, fn);
      this.listeners.push([track, name, fn]);
    };

    addL('ended', interrupt);
    addL('mute', () => {
      clearTimeout(this.muteTimer);
      this.muteTimer = setTimeout(interrupt, 2500);
    });
    addL('unmute', () => clearTimeout(this.muteTimer));

    return { stream, track };
  }
}

export function allowedAnswer(answer: string, type: string) {
  return typeof answer === 'string' && answer.length === 1 && (type === 'tf' ? 'AB' : 'ABCD').includes(answer);
}

export function filterAcknowledged(
  batch: { id: number; answer: string }[],
  state: any,
  code: string,
  questionId: string
) {
  if (!state || state.code !== code || state.currentQuestion?.id !== questionId) return [];
  return batch.filter(a => state.submissions?.[a.id] === a.answer);
}
