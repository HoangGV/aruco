import { AR } from './aruco.js';
import type { MarkerDetection } from '../types';

const TOTAL = 250;
const DICTIONARY = 'ARUCO_MIP_36h12';
const TOLERANCE = 25;
const EXPIRY_MS = 1000;
const ANSWERS_BY_TURN: ('A' | 'D' | 'C' | 'B')[] = ['A', 'D', 'C', 'B'];

let dictionaryInstance: any = null;
let detectorInstance: any = null;

function validId(id: number): boolean {
  return Number.isInteger(id) && id >= 1 && id <= TOTAL;
}

function getDictionary() {
  if (!dictionaryInstance) {
    dictionaryInstance = new AR.Dictionary(DICTIONARY);
  }
  return dictionaryInstance;
}

function getDetector() {
  if (!detectorInstance) {
    detectorInstance = new AR.Detector({ dictionaryName: DICTIONARY, maxHammingDistance: 0 });
  }
  return detectorInstance;
}

export function generateCardSvg(id: number): string {
  if (!validId(id)) {
    throw new RangeError('Student marker ID must be an integer from 1 to 250.');
  }
  return getDictionary().generateSVG(id - 1);
}

function canonicalCorners(corners: { x: number; y: number }[]): boolean {
  if (!Array.isArray(corners) || corners.length !== 4 ||
      !corners.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return false;
  }
  return corners.every((p, i) => {
    const q = corners[(i + 1) % 4];
    const r = corners[(i + 2) % 4];
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) > 0;
  });
}

export function detectMarkers(imageData: ImageData): MarkerDetection[] {
  if (!imageData || !Number.isInteger(imageData.width) || imageData.width <= 0 ||
      !Number.isInteger(imageData.height) || imageData.height <= 0 ||
      !imageData.data || imageData.data.length !== imageData.width * imageData.height * 4) {
    throw new TypeError('CardMarkers.detect expects width, height and RGBA image data.');
  }

  const detector = getDetector();
  const rawMarkers = detector.detect(imageData);
  const results: MarkerDetection[] = [];
  const counts = new Map<number, number>();

  for (const marker of rawMarkers) {
    if (!marker || !Number.isInteger(marker.id) || marker.id < 0 || marker.id >= TOTAL ||
        marker.hammingDistance !== 0 || !canonicalCorners(marker.corners)) continue;

    const id = marker.id + 1;
    counts.set(id, (counts.get(id) || 0) + 1);
    const corners = marker.corners;
    const angle = (Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) *
      180 / Math.PI + 360) % 360;
    const turn = Math.round(angle / 90);
    if (Math.abs(angle - turn * 90) > TOLERANCE) continue;

    results.push({
      id,
      answer: ANSWERS_BY_TURN[turn % 4],
      corners: corners.map((p: any) => ({ x: p.x, y: p.y })),
      angle,
      hammingDistance: marker.hammingDistance
    });
  }

  return results.filter(marker => counts.get(marker.id) === 1).sort((a, b) => a.id - b.id);
}

export function assessMarker(marker: MarkerDetection, width: number, height: number, minEdge = 36) {
  const bad = (message: string) => ({ ok: false, message });
  if (!marker || !validId(marker.id) || marker.hammingDistance !== 0 || !canonicalCorners(marker.corners)) {
    return bad('Mã chưa rõ, giữ yên và tránh che mã.');
  }
  const c = marker.corners;
  if (c.some(p => p.x < 3 || p.y < 3 || p.x > width - 3 || p.y > height - 3)) {
    return bad('Đưa đủ bốn góc mã vào khung.');
  }
  const edges = c.map((p, i) => Math.hypot(c[(i + 1) % 4].x - p.x, c[(i + 1) % 4].y - p.y));
  if (Math.min(...edges) < minEdge) {
    return bad('Mã quá nhỏ, tiến gần hoặc in thẻ lớn hơn.');
  }
  if (Math.max(...edges) / Math.min(...edges) > 2.8) {
    return bad('Thẻ nghiêng nhiều, hướng mặt mã về camera.');
  }
  const angle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 360) % 360;
  const top = angle(c[0], c[1]), bottom = angle(c[3], c[2]);
  const difference = Math.abs(((top - bottom + 540) % 360) - 180);
  if (difference > 24 || !Number.isFinite(marker.angle) || Math.abs(marker.angle - Math.round(marker.angle / 90) * 90) > 22) {
    return bad('Xoay chữ đáp án thẳng lên cạnh trên.');
  }
  return { ok: true, message: 'Mã rõ, đang kiểm tra liên tiếp.' };
}

export interface TrackerOptions {
  stableReads?: number;
  minStableMs?: number;
}

export function createMarkerTracker({ stableReads = 2, minStableMs = 0 }: TrackerOptions = {}) {
  if (stableReads !== 2 && stableReads !== 3) {
    throw new RangeError('stableReads must be 2 or 3 consecutive observations.');
  }
  if (!Number.isFinite(minStableMs) || minStableMs < 0) {
    throw new RangeError('minStableMs must be nonnegative.');
  }

  interface State {
    lastSeen: number;
    pendingAnswer: string | null;
    reads: number;
    emittedAnswer: string | null;
    since: number;
  }

  const states = new Map<number, State>();
  let lastNow: number | undefined;

  function reset() {
    states.clear();
    lastNow = undefined;
  }

  function observe(detections: MarkerDetection[], now = Date.now()): MarkerDetection[] {
    if (!Array.isArray(detections) || !Number.isFinite(now)) {
      throw new TypeError('observe expects a detections array and finite milliseconds.');
    }
    if (lastNow !== undefined && now < lastNow) reset();
    lastNow = now;

    for (const [id, state] of states) {
      if (now - state.lastSeen >= EXPIRY_MS) states.delete(id);
    }

    const unique = new Map<number, MarkerDetection | null>();
    for (const detection of detections) {
      if (!detection || !validId(detection.id) || !ANSWERS_BY_TURN.includes(detection.answer)) continue;
      if (!unique.has(detection.id)) unique.set(detection.id, detection);
      else if (unique.get(detection.id)?.answer !== detection.answer) unique.set(detection.id, null);
    }

    for (const [id, state] of states) {
      if (!unique.get(id)) {
        state.pendingAnswer = null;
        state.reads = 0;
      }
    }

    const emitted: MarkerDetection[] = [];
    for (const [id, detection] of unique) {
      if (!detection) continue;
      let state = states.get(id);
      if (!state) {
        state = { lastSeen: now, pendingAnswer: null, reads: 0, emittedAnswer: null, since: now };
        states.set(id, state);
      }
      state.lastSeen = now;
      if (state.pendingAnswer !== detection.answer) state.since = now;
      state.reads = state.pendingAnswer === detection.answer ? Math.min(state.reads + 1, stableReads) : 1;
      state.pendingAnswer = detection.answer;

      if (state.reads === stableReads && now - state.since >= minStableMs && state.emittedAnswer !== detection.answer) {
        state.emittedAnswer = detection.answer;
        emitted.push({ ...detection });
      }
    }
    return emitted.sort((a, b) => a.id - b.id);
  }

  return { observe, reset };
}

export const CardMarkers = {
  total: TOTAL,
  svg: generateCardSvg,
  detect: detectMarkers,
  assess: assessMarker,
  createTracker: createMarkerTracker
};
