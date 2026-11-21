/* StepDrift · 数值抽样：固定种子伪随机，同一输入永远同一批点 */
window.SD = window.SD || {};

SD.sampling = (function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function fmt(v, digits) {
    if (!isFinite(v)) return '不可求值';
    var d = digits == null ? 4 : digits;
    if (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(2);
    return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
  }

  // 抽样分辨率之内的吸附：1e-6 → 0，0.999999 → 1，避免把抽样误差当成结论
  function snap(v) {
    if (!isFinite(v)) return v;
    if (Math.abs(v) < 1e-4) return 0;
    var r = Math.round(v);
    if (Math.abs(v - r) < 1e-4) return r;
    return v;
  }

  function closeEnough(a, b) {
    var d = Math.abs(a - b);
    return d <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  }

  /* ---------- 代数等价：12 个固定种子抽样点 ---------- */
  function checkEquivalence(prevSrc, nextSrc) {
    var f = SD.math.compile(prevSrc), g = SD.math.compile(nextSrc);
    if (!f || !g) return { verdict: 'unknown' };

    var rnd = mulberry32(42), valid = 0, mismatch = null;
    for (var i = 0; i < 12; i++) {
      var x = -3 + 6 * rnd();
      var a = f(x), b = g(x);
      if (!isFinite(a) || !isFinite(b)) continue;
      valid++;
      if (!closeEnough(a, b) && !mismatch) mismatch = { x: x, left: a, right: b };
    }
    if (valid < 6) return { verdict: 'unknown' };

    if (!mismatch) {
      return { verdict: 'pass', note: '与上一步等价：' + valid + ' 组抽样点一致' };
    }

    // 数值见证：优先取整齐的固定点，便于人工复核
    var candidates = [2, 2.35, -1.5, 0.5, 3.7, -2.2, mismatch.x];
    var witness = null;
    for (var j = 0; j < candidates.length; j++) {
      var cx = candidates[j], la = f(cx), lb = g(cx);
      if (isFinite(la) && isFinite(lb) && !closeEnough(la, lb)) {
        witness = { x: cx, left: la, right: lb };
        break;
      }
    }
    if (!witness) witness = mismatch;
    return {
      verdict: 'fail',
      note: '与上一步不等价：' + valid + ' 组抽样点中出现不一致',
      witness: {
        x: witness.x, left: witness.left, right: witness.right,
        text: '取 x=' + fmt(witness.x, 3) + ' 时，两边分别是 ' + fmt(witness.left, 3) +
              ' 与 ' + fmt(witness.right, 3) + '，差 ' + fmt(Math.abs(witness.left - witness.right), 3)
      }
    };
  }

  /* ---------- 极限抽样 ---------- */
  // target: {kind:'finite', a:0} 或 {kind:'inf', sign:1}
  function sampleLimit(exprSrc, target) {
    var f = SD.math.compile(exprSrc);
    if (!f) return null;
    var left = [], right = [], i, h, x, v;
    if (target.kind === 'inf') {
      for (i = 1; i <= 6; i++) {
        x = Math.pow(10, i) * (target.sign || 1);
        v = f(x);
        if (isFinite(v)) right.push({ x: x, v: v });
      }
      return { side: 'right', left: [], right: right };
    }
    for (i = 1; i <= 6; i++) {
      h = Math.pow(10, -i);
      var lv = f(target.a - h), rv = f(target.a + h);
      if (isFinite(lv)) left.push({ x: target.a - h, v: lv });
      if (isFinite(rv)) right.push({ x: target.a + h, v: rv });
    }
    return { side: 'both', left: left, right: right };
  }

  // 用最细两个尺度估计是否稳定，返回 {converged, estimate}
  function estimate(points) {
    if (points.length < 2) return { converged: false };
    var n = points.length;
    var v1 = points[n - 2].v, v2 = points[n - 1].v;
    var converged = Math.abs(v1 - v2) <= 1e-3 * Math.max(1, Math.abs(v2));
    return { converged: converged, estimate: v2 };
  }

  function analyzeLimit(exprSrc, target, claimedL) {
    var s = sampleLimit(exprSrc, target);
    if (!s) return { verdict: 'unknown' };
    var out = { samples: s };

    if (s.side === 'right') { // x→∞
      if (s.right.length < 2) return { verdict: 'unknown', samples: s };
      var est = estimate(s.right);
      out.estimate = est.converged ? snap(est.estimate) : est.estimate;
      if (est.converged) {
        out.verdict = 'pass';
        out.note = '沿 x→' + ((target.sign || 1) > 0 ? '+' : '-') + '∞ 抽样：函数值趋于 ' + fmt(out.estimate);
        if (claimedL != null && Math.abs(out.estimate - claimedL) > 1e-2) {
          out.verdict = 'fail';
          out.note = '沿 x→∞ 抽样趋于 ' + fmt(out.estimate) + '，与声称值 ' + fmt(claimedL) + ' 不符';
        }
      } else {
        out.verdict = 'oscillating';
        out.note = '沿 x→∞ 抽样：函数值不收敛';
      }
      return out;
    }

    var le = estimate(s.left), re = estimate(s.right);
    out.leftEst = le.converged ? snap(le.estimate) : null;
    out.rightEst = re.converged ? snap(re.estimate) : null;

    if (le.converged && re.converged) {
      if (closeEnough(le.estimate, re.estimate)) {
        out.verdict = 'pass';
        out.note = '数值抽样通过：双侧均趋于 ' + fmt(snap(re.estimate));
        if (claimedL != null && Math.abs(re.estimate - claimedL) > 1e-2) {
          out.verdict = 'fail';
          out.note = '双侧趋于 ' + fmt(snap(re.estimate)) + '，与声称值 ' + fmt(claimedL) + ' 不符';
        }
      } else {
        out.verdict = 'fail';
        out.note = '双侧极限不相等';
        out.twoSided = '左极限 ≈ ' + fmt(snap(le.estimate)) + '，右极限 ≈ ' + fmt(snap(re.estimate)) + ' → 双侧极限不存在';
      }
    } else {
      out.verdict = 'fail';
      out.note = '至少一侧抽样不收敛';
      out.twoSided = '左抽样末值 ' + (s.left.length ? fmt(s.left[s.left.length - 1].v) : '不可求值') +
                     '，右抽样末值 ' + (s.right.length ? fmt(s.right[s.right.length - 1].v) : '不可求值') + ' → 极限不成立';
    }
    return out;
  }

  /* ---------- 摆动证据：固定种子对数均匀采样（N=12, seed=605） ---------- */
  function oscillationRange(exprSrc) {
    var f = SD.math.compile(exprSrc);
    if (!f) return null;
    var rnd = mulberry32(605), mn = Infinity, mx = -Infinity;
    for (var i = 0; i < 12; i++) {
      var x = Math.pow(10, 1 + 5 * rnd());
      var v = f(x);
      if (!isFinite(v)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === Infinity) return null;
    return { min: mn, max: mx, text: '抽样在 ' + fmt(mn, 4) + '~' + mx.toFixed(1) + ' 之间摆动' };
  }

  return {
    checkEquivalence: checkEquivalence,
    analyzeLimit: analyzeLimit,
    oscillationRange: oscillationRange,
    estimate: estimate,
    fmt: fmt
  };
})();
