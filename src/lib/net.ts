import { PortableEngine } from './engine';
import type { SessionState } from '../types';
import Peer from 'peerjs';

const PREFIX = 'ndh-tuongtacgiay-v1-';
const STORE = 'ndh-rooms-v1';

let hostState: SessionState | null = null;
let peer: Peer | null = null;
let peerOpening: Promise<void> | null = null;
let peerCode = '';
let peerReady = false;
let peerError = '';

let clientPeer: Peer | null = null;
let clientConnection: any = null;
let clientCode = '';
let scannerKey = '';
let lastClientState: any = null;
let openingClient: Promise<any> | null = null;
let requestNo = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }>();
const connectedClients = new Set<any>();

// Local event listeners for in-app state sync
const stateListeners = new Set<(state: SessionState) => void>();
const statusListeners = new Set<(status: any) => void>();

function persist() {
  if (!hostState) return;
  try {
    const rooms = JSON.parse(localStorage.getItem(STORE) || '{}');
    for (const [k, v] of Object.entries(rooms)) {
      if (!v || (v as any).expiresAt < Date.now()) delete rooms[k];
    }
    rooms[hostState.code] = hostState;
    const keys = Object.keys(rooms);
    while (keys.length > 4) delete rooms[keys.shift()!];
    localStorage.setItem(STORE, JSON.stringify(rooms));
  } catch {}
}

function load(code: string, key: string): SessionState {
  if (hostState?.code === code && hostState.hostKey === key) return hostState;
  let s: SessionState | undefined;
  try {
    s = JSON.parse(localStorage.getItem(STORE) || '{}')[code];
  } catch {}
  if (!s || s.hostKey !== key || (s.expiresAt && s.expiresAt < Date.now())) {
    throw new Error('Phiên không còn trên thiết bị này. Hãy tạo phiên mới.');
  }
  hostState = s;
  return s;
}

function envelope(state: any) {
  return { state, serverTime: Date.now() };
}

export function getStatus() {
  return {
    connected: peerReady,
    phoneConnected: [...connectedClients].some(c => c.open && c._authed),
    connecting: !!peerOpening,
    error: peerError,
    clientsCount: connectedClients.size
  };
}

function emitStatus() {
  const stat = getStatus();
  statusListeners.forEach(fn => fn(stat));
}

function broadcast() {
  if (!hostState) return;
  const state = PortableEngine.view(hostState, 'scanner') as SessionState;
  for (const c of connectedClients) {
    if (c.open && c._authed) {
      try {
        c.send({ kind: 'state', ...envelope(state) });
      } catch {}
    }
  }
  persist();
  stateListeners.forEach(fn => fn(hostState!));
  emitStatus();
}

export function closeHost() {
  for (const c of connectedClients) c.close();
  connectedClients.clear();
  if (peer) {
    try {
      peer.destroy();
    } catch {}
    peer = null;
  }
  peerOpening = null;
  peerReady = false;
  peerCode = '';
  emitStatus();
}

export async function readyHost(code: string): Promise<void> {
  if (!hostState || hostState.code !== code) throw new Error('Chưa có phiên chơi.');
  if (peerReady && peerCode === code) return;
  if (peerOpening && peerCode === code) return peerOpening;

  if (peerCode && peerCode !== code) closeHost();
  peerCode = code;
  peerError = '';

  peerOpening = new Promise((resolve, reject) => {
    let settled = false;
    const p = (peer = new Peer(PREFIX + code, { debug: 0 }));
    const timer = setTimeout(() => done(new Error('Máy chủ ghép nối chưa phản hồi. Kiểm tra Internet rồi thử lại.')), 18000);

    function done(err?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peerOpening = null;
      if (err) {
        peerError = err.message;
        peerReady = false;
        p.destroy();
        if (peer === p) peer = null;
        reject(err);
      } else {
        peerReady = true;
        resolve();
      }
      emitStatus();
    }

    p.on('open', () => {
      if (settled) {
        peerReady = true;
        peerError = '';
        emitStatus();
      } else {
        done();
      }
    });

    p.on('error', (e: any) => {
      const msg = e?.type === 'unavailable-id'
        ? 'Mã phòng đang được dùng ở cửa sổ khác.'
        : 'Chưa thể kết nối PeerJS WebRTC.';
      const err = new Error(msg);
      if (!settled) done(err);
      else {
        peerError = err.message;
        emitStatus();
      }
    });

    p.on('connection', (c: any) => {
      if (connectedClients.size >= 8) {
        c.close();
        return;
      }
      connectedClients.add(c);
      c._authed = false;
      let failures = 0;
      const joinTimer = setTimeout(() => {
        if (!c._authed) c.close();
      }, 12000);

      c.on('data', (m: any) => {
        if (!m || typeof m !== 'object') return;
        try {
          if (m.kind === 'join') {
            if (!hostState || hostState.code !== code || ![hostState.pairKey, hostState.pairPin].includes(String(m.pairKey || ''))) {
              if (++failures >= 3) c.close();
              throw new Error('Mã ghép nối chưa đúng. Quét lại QR hoặc kiểm tra mã PIN.');
            }
            c._authed = true;
            clearTimeout(joinTimer);
            hostState.scannerSeenAt = Date.now();
            c.send({
              kind: 'reply',
              id: m.id,
              ok: true,
              value: { scannerKey: PortableEngine.randomHex(), ...envelope(PortableEngine.view(hostState, 'scanner')) }
            });
            emitStatus();
            return;
          }

          if (!c._authed) throw new Error('Cần ghép nối lại điện thoại.');
          hostState.scannerSeenAt = Date.now();
          let accepted: number | undefined;

          if (m.kind === 'answers') {
            accepted = PortableEngine.submit(hostState, m.body);
            broadcast();
          }

          c.send({
            kind: 'reply',
            id: m.id,
            ok: true,
            value: {
              ...(accepted !== undefined ? { accepted } : {}),
              ...envelope(PortableEngine.view(hostState, 'scanner'))
            }
          });
        } catch (e: any) {
          persist();
          try {
            c.send({ kind: 'reply', id: m.id, ok: false, error: e.message });
          } catch {}
        }
      });

      c.on('close', () => {
        clearTimeout(joinTimer);
        connectedClients.delete(c);
        emitStatus();
      });

      c.on('error', () => {
        connectedClients.delete(c);
        emitStatus();
      });
    });
  });

  emitStatus();
  return peerOpening;
}

function rpc(kind: string, body: any = {}, timeout = 6500): Promise<any> {
  if (!clientConnection?.open) {
    return Promise.reject(new Error('Điện thoại mất kết nối. Giữ máy tính đang mở.'));
  }
  const id = ++requestNo;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Chưa nhận xác nhận từ máy tính.'));
    }, timeout);
    pendingRequests.set(id, { resolve, reject, timer });
    try {
      clientConnection.send({ kind, id, ...(kind === 'join' ? body : { body }) });
    } catch (e) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(e);
    }
  });
}

export function stopClient() {
  for (const p of pendingRequests.values()) {
    clearTimeout(p.timer);
    p.reject(new Error('Đang kết nối lại.'));
  }
  pendingRequests.clear();
  clientConnection?.close();
  clientConnection = null;
  if (clientPeer && !hostState) {
    clientPeer.destroy();
    clientPeer = null;
  }
  scannerKey = '';
}

export async function joinScanner(code: string, pairKey: string, onStateUpdate?: (st: any) => void): Promise<any> {
  // Check if we are running in same browser window or session
  if (hostState && hostState.code === code) {
    if (![hostState.pairKey, hostState.pairPin].includes(pairKey)) {
      throw new Error('Mã ghép nối chưa đúng.');
    }
    scannerKey = PortableEngine.randomHex();
    hostState.scannerSeenAt = Date.now();
    clientCode = code;
    return { scannerKey, ...envelope(PortableEngine.view(hostState, 'scanner')) };
  }

  if (clientConnection?.open && clientCode === code && scannerKey) {
    return { scannerKey, ...envelope(lastClientState) };
  }
  if (openingClient) return openingClient;

  openingClient = (async () => {
    stopClient();
    clientCode = code;
    const p = (clientPeer = new Peer({ debug: 0 }));

    await new Promise<void>((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => end(new Error('Chưa thể kết nối tới máy tính qua WebRTC.')), 18000);

      function end(err?: Error) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      }

      p.on('error', (e: any) => end(new Error('Lỗi kết nối WebRTC: ' + e?.type)));
      p.on('open', () => {
        const c = (clientConnection = p.connect(PREFIX + code, { reliable: true }));
        c.on('open', () => end());
        c.on('error', (e: any) => end(new Error('Không kết nối được phòng: ' + e?.type)));
        c.on('close', () => {
          for (const a of pendingRequests.values()) {
            clearTimeout(a.timer);
            a.reject(new Error('Mất kết nối với máy tính.'));
          }
          pendingRequests.clear();
        });
        c.on('data', (m: any) => {
          if (!m || typeof m !== 'object') return;
          if (m.kind === 'state') {
            lastClientState = m.state;
            if (onStateUpdate) onStateUpdate(m.state);
            return;
          }
          if (m.kind === 'reply') {
            const req = pendingRequests.get(m.id);
            if (!req) return;
            clearTimeout(req.timer);
            pendingRequests.delete(m.id);
            if (m.ok) {
              lastClientState = m.value?.state || lastClientState;
              req.resolve(m.value);
            } else {
              req.reject(new Error(m.error || 'Không gửi được đáp án.'));
            }
          }
        });
      });
    });

    const result = await rpc('join', { pairKey });
    scannerKey = result.scannerKey;
    return result;
  })()
    .catch(e => {
      stopClient();
      throw e;
    })
    .finally(() => {
      openingClient = null;
    });

  return openingClient;
}

export async function portableApi(path: string, method = 'GET', body?: any, key = ''): Promise<any> {
  if (method === 'POST' && path === '/rooms') {
    closeHost();
    hostState = PortableEngine.create(body);
    persist();
    emitStatus();
    return {
      code: hostState.code,
      hostKey: hostState.hostKey,
      pairKey: hostState.pairKey,
      pairPin: hostState.pairPin,
      ...envelope(PortableEngine.view(hostState))
    };
  }

  const m = path.match(/^\/rooms\/(\d{6})(?:\/(join|action|answers))?(?:\?role=(host|scanner))?$/);
  if (!m) throw new Error('Đường dẫn phiên không hợp lệ.');
  const [, code, op, role] = m;

  if (op === 'join') {
    return joinScanner(code, body?.pairKey);
  }

  // If scanner sending answers via peer RPC
  if ((role === 'scanner' || (op === 'answers' && key === scannerKey)) && scannerKey) {
    if (code !== clientCode && (!hostState || hostState.code !== code)) {
      throw new Error('Sai mã phòng.');
    }
    if (clientConnection?.open) {
      return await rpc(op === 'answers' ? 'answers' : 'get', body || {});
    }
  }

  // Local authoritative handling
  const s = load(code, key);
  const rev = s.revision;
  PortableEngine.auto(s);
  let accepted: number | undefined;

  if (method === 'POST' && op === 'action') {
    PortableEngine.act(s, body?.action, Date.now(), body);
  } else if (method === 'POST' && op === 'answers') {
    accepted = PortableEngine.submit(s, body);
  }

  if (s.revision !== rev) broadcast();
  else persist();

  return {
    ...(accepted !== undefined ? { accepted } : {}),
    ...envelope(PortableEngine.view(s))
  };
}

// Global auto tick
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (hostState) {
      const changed = PortableEngine.auto(hostState);
      if (changed) broadcast();
    }
  }, 200);
}

export function subscribeToStatus(fn: (status: any) => void) {
  statusListeners.add(fn);
  fn(getStatus());
  return () => {
    statusListeners.delete(fn);
  };
}

export function subscribeToState(fn: (state: SessionState) => void) {
  stateListeners.add(fn);
  if (hostState) fn(hostState);
  return () => {
    stateListeners.delete(fn);
  };
}
