
/* global AR */
/**
 * Load js-aruco2's cv.js and aruco.js before this script. No DOM or camera needed.
 *
 * CardMarkers.svg(studentId): raw dictionary SVG, including its white quiet zone.
 * IDs are integers 1..250; dictionary ID is studentId - 1. Print physical labels
 * A above, B right, C below, D left OUTSIDE the SVG's white quiet zone.
 *
 * CardMarkers.detect(rgbaImageData): all unambiguous markers, sorted by student ID.
 * Each result is { id, answer, corners, angle, hammingDistance }. Corners retain
 * the detector's canonical clockwise order (do not sort them by screen position).
 * Angle is edge 0->1 in clockwise image degrees, in [0, 360). The label pointing
 * up is the answer: clockwise card turns 0/90/180/270 give A/D/C/B. A deviation
 * greater than 25 degrees is omitted. Supply unmirrored camera pixels.
 *
 * Identity takes priority over recall: only EXACT dictionary matches are accepted,
 * with no bit-error correction. Damaged/blurred cards may therefore be missed.
 * Duplicate student IDs in one image are omitted rather than choosing a card.
 *
 * const tracker = CardMarkers.createTracker({ stableReads: 2 }); // 2 (default) or 3
 * tracker.observe(CardMarkers.detect(imageData), performance.now()) returns only
 * newly stable detections. Call once per frame, including frames with no reads.
 * Matching answers must be consecutive; a missing/conflicting read breaks a run.
 * An emitted answer stays suppressed until a different answer becomes stable,
 * or the ID has been absent for >=1000 ms. `now` is monotonic milliseconds (defaults
 * to Date.now()); a backwards clock clears tracking. reset() clears all tracking,
 * e.g. when starting a new question. Returned detections contain no send side effects.
 */
(function (root) {
  'use strict';

  const TOTAL = 250;
  const DICTIONARY = 'ARUCO_MIP_36h12';
  const TOLERANCE = 25;
  const EXPIRY_MS = 1000;
  const ANSWERS_BY_TURN = ['A', 'D', 'C', 'B'];
  let dictionary;
  let detector;

  function validId(id) {
    return Number.isInteger(id) && id >= 1 && id <= TOTAL;
  }

  function aruco() {
    if (!root.AR || !root.AR.Dictionary || !root.AR.Detector) {
      throw new Error('CardMarkers requires js-aruco2 cv.js and aruco.js.');
    }
    return root.AR;
  }

  function svg(id) {
    if (!validId(id)) {
      throw new RangeError('Student marker ID must be an integer from 1 to 250.');
    }
    if (!dictionary) dictionary = new (aruco().Dictionary)(DICTIONARY);
    return dictionary.generateSVG(id - 1);
  }

  function canonicalCorners(corners) {
    if (!Array.isArray(corners) || corners.length !== 4 ||
        !corners.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) {
      return false;
    }
    // Reject degenerate/non-convex geometry without changing canonical corner order.
    return corners.every((p, i) => {
      const q = corners[(i + 1) % 4];
      const r = corners[(i + 2) % 4];
      return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) > 0;
    });
  }

  function detect(imageData) {
    if (!imageData || !Number.isInteger(imageData.width) || imageData.width <= 0 ||
        !Number.isInteger(imageData.height) || imageData.height <= 0 ||
        !imageData.data || imageData.data.length !== imageData.width * imageData.height * 4) {
      throw new TypeError('CardMarkers.detect expects width, height and RGBA image data.');
    }
    if (!detector) {
      // js-aruco2's default tau=12 allows distances 0..11, which is too permissive
      // for assigning student identities. Zero still accepts exact matches.
      detector = new (aruco().Detector)({ dictionaryName: DICTIONARY, maxHammingDistance: 0 });
    }
    const results = [];
    const counts = new Map();
    for (const marker of detector.detect(imageData)) {
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
        corners: corners.map(p => ({ x: p.x, y: p.y })),
        angle,
        hammingDistance: marker.hammingDistance
      });
    }
    return results.filter(marker => counts.get(marker.id) === 1).sort((a, b) => a.id - b.id);
  }

  function readable(marker, width, height, minEdge = 32) {
    if (!marker || !validId(marker.id) || marker.hammingDistance !== 0 || !canonicalCorners(marker.corners)) return false;
    const c=marker.corners;
    if(c.some(p=>p.x<3||p.y<3||p.x>width-3||p.y>height-3))return false;
    const edges=c.map((p,i)=>Math.hypot(c[(i+1)%4].x-p.x,c[(i+1)%4].y-p.y));
    if(Math.min(...edges)<minEdge||Math.max(...edges)/Math.min(...edges)>2.8)return false;
    const turn=Math.round(marker.angle/90);
    return Math.abs(marker.angle-turn*90)<=22;
  }

  function createTracker({ stableReads = 2, minStableMs = 0 } = {}) {
    if (stableReads !== 2 && stableReads !== 3) {
      throw new RangeError('stableReads must be 2 or 3 consecutive observations.');
    }
    if(!Number.isFinite(minStableMs)||minStableMs<0)throw new RangeError('minStableMs must be nonnegative.');
    const states = new Map();
    let lastNow;

    function reset() {
      states.clear();
      lastNow = undefined;
    }

    function observe(detections, now = Date.now()) {
      if (!Array.isArray(detections) || !Number.isFinite(now)) {
        throw new TypeError('observe expects a detections array and finite milliseconds.');
      }
      if (lastNow !== undefined && now < lastNow) reset();
      lastNow = now;
      for (const [id, state] of states) {
        if (now - state.lastSeen >= EXPIRY_MS) states.delete(id);
      }

      // At most one vote per ID per frame; conflicting copies count as no read.
      const unique = new Map();
      for (const detection of detections) {
        if (!detection || !validId(detection.id) ||
            !ANSWERS_BY_TURN.includes(detection.answer)) continue;
        if (!unique.has(detection.id)) unique.set(detection.id, detection);
        else if (unique.get(detection.id)?.answer !== detection.answer) unique.set(detection.id, null);
      }
      for (const [id, state] of states) {
        if (!unique.get(id)) {
          state.pendingAnswer = null;
          state.reads = 0;
        }
      }

      const emitted = [];
      for (const [id, detection] of unique) {
        if (!detection) continue;
        let state = states.get(id);
        if (!state) {
          state = { lastSeen: now, pendingAnswer: null, reads: 0, emittedAnswer: null, since: now };
          states.set(id, state);
        }
        state.lastSeen = now;
        if(state.pendingAnswer!==detection.answer)state.since=now;
        state.reads = state.pendingAnswer === detection.answer ? Math.min(state.reads + 1, stableReads) : 1;
        state.pendingAnswer = detection.answer;
        if (state.reads === stableReads && now-state.since>=minStableMs && state.emittedAnswer !== detection.answer) {
          state.emittedAnswer = detection.answer;
          emitted.push({ ...detection });
        }
      }
      return emitted.sort((a, b) => a.id - b.id);
    }

    return { observe, reset };
  }

  function assess(marker,width,height,minEdge=36) {
    const bad=message=>({ok:false,message});
    if(!marker||!validId(marker.id)||marker.hammingDistance!==0||!canonicalCorners(marker.corners))return bad('Mã chưa rõ, giữ yên và tránh che mã.');
    const c=marker.corners;
    if(c.some(p=>p.x<3||p.y<3||p.x>width-3||p.y>height-3))return bad('Đưa đủ bốn góc mã vào khung.');
    const edges=c.map((p,i)=>Math.hypot(c[(i+1)%4].x-p.x,c[(i+1)%4].y-p.y));
    if(Math.min(...edges)<minEdge)return bad('Mã quá nhỏ, tiến gần hoặc in thẻ lớn hơn.');
    if(Math.max(...edges)/Math.min(...edges)>2.8)return bad('Thẻ nghiêng nhiều, hướng mặt mã về camera.');
    const angle=(a,b)=>(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+360)%360;
    const top=angle(c[0],c[1]),bottom=angle(c[3],c[2]);
    const difference=Math.abs(((top-bottom+540)%360)-180);
    if(difference>24||!Number.isFinite(marker.angle)||Math.abs(marker.angle-Math.round(marker.angle/90)*90)>22)return bad('Xoay chữ đáp án thẳng lên cạnh trên.');
    return {ok:true,message:'Mã rõ, đang kiểm tra liên tiếp.'};
  }

  root.CardMarkers = Object.freeze({ total: TOTAL, svg, detect, readable, assess, createTracker });
})(typeof window === 'undefined' ? globalThis : window);

