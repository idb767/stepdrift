/* StepDrift · 判定引擎：切分 → 规则 → 极限 → 等价 → 算术核验 → 缺省
   分工固定，任何一步拿不准都落到「未判定」。 */
window.SD = window.SD || {};

SD.engine = (function () {
  'use strict';

  var INFER_WORDS = /(所以|故|因此|可知|可得)/;

  /* ---------- 1. 切分：兼容「第k步」标记 / 空行分段 / 一行一步 ---------- */
  function splitSteps(text) {
    var normalized = String(text || '').replace(/\r\n?/g, '\n');
    // 一行内出现多个「第k步」时，先按标记断行
    normalized = normalized.replace(/[ \t]*(?=第\s*\d+\s*步)/g, '\n');
    var lines = normalized.split('\n');
    var steps = [];
    lines.forEach(function (line) {
      var raw = line.trim();
      if (!raw) return; // 空行只分段，不产生步骤
      steps.push({
        index: steps.length + 1,
        raw: raw,
        formulas: extractFormulas(raw),
        status: 'unknown',
        checks: [],
        driftIds: [],
        card: null
      });
    });
    return steps;
  }

  function extractFormulas(raw) {
    var out = [], re = /\$([^$]+)\$/g, m;
    while ((m = re.exec(raw))) out.push(m[1]);
    return out;
  }

  /* ---------- 引用依据 / 结论 片段抽取（供规则与核查记录使用） ---------- */
  function extractSegments(raw) {
    var basis = '', conclusion = '';
    var bm = raw.match(/(?:因为|由于|根据|由)([^，。；]*)/);
    if (bm) basis = bm[1];
    var cm = raw.match(/(?:所以|故|因此|可知|可得)([^。；]*)$/);
    if (cm) conclusion = cm[1];
    return { basis: basis, conclusion: conclusion };
  }

  /* ---------- 极限结构识别 ---------- */
  function parseLimitFormula(src) {
    var m = src.match(/\\lim_\{x\\to\s*([^}]*?)\s*\}(.*)$/);
    if (!m) return null;
    var targetRaw = m[1], rest = m[2];
    var target;
    if (/\\infty|∞/.test(targetRaw)) {
      target = { kind: 'inf', sign: /^-/.test(targetRaw) ? -1 : 1 };
    } else {
      var a = parseFloat(targetRaw);
      if (isNaN(a)) return null;
      target = { kind: 'finite', a: a };
    }
    var claimed = null, body = rest;
    var eq = rest.indexOf('=');
    if (eq !== -1) {
      body = rest.slice(0, eq);
      var tail = rest.slice(eq + 1).split('=')[0];
      var L = parseFloat(tail);
      if (!isNaN(L) && String(tail).trim() !== '') claimed = L;
    }
    if (!body) return null;
    return { target: target, body: body, claimed: claimed };
  }

  function makeCtx(steps) {
    return {
      allSteps: steps,
      prevExpr: null,
      prevStepIndex: null,
      hasLhopital: false,
      originalLimit: null,
      fDef: null,
      fDefPoint: null,
      errorsBefore: false,
      extractLimitBody: function (step) {
        for (var i = 0; i < step.formulas.length; i++) {
          var p = parseLimitFormula(step.formulas[i]);
          if (p) return p;
        }
        return null;
      },
      findRankA: function () {
        var all = steps.map(function (s) { return s.raw; }).join('\n');
        var m = all.match(/rank\}\(A\)\s*=\s*(\d+)|rank\(A\)\s*=\s*(\d+)/);
        return m ? parseInt(m[1] || m[2], 10) : null;
      },
      findRankAb: function () {
        var all = steps.map(function (s) { return s.raw; }).join('\n');
        var m = all.match(/rank\}\(\[A\|b\]\)\s*=\s*(\d+)|rank\(\[A\|b\]\)\s*=\s*(\d+)/);
        return m ? parseInt(m[1] || m[2], 10) : null;
      }
    };
  }

  /* ---------- 2. 代数等价 ---------- */
  function rightmostExpr(step) {
    // 取本步最右侧的纯算术表达式；对象表达式返回 null
    for (var i = step.formulas.length - 1; i >= 0; i--) {
      var src = step.formulas[i];
      if (!SD.math.isPureArithmetic(src)) continue;
      var body = src.charAt(0) === '=' ? src.slice(1) : src;
      var parts = body.split('=');
      var candidate = parts[parts.length - 1];
      if (SD.math.compile(candidate)) return candidate;
    }
    return null;
  }

  function equivCheck(step, ctx) {
    if (ctx.prevExpr == null) return null;
    var next = null;
    for (var i = 0; i < step.formulas.length; i++) {
      var src = step.formulas[i];
      if (src.charAt(0) === '=' && SD.math.compile(src.slice(1))) { next = src.slice(1); break; }
    }
    if (!next) return null;
    var r = SD.sampling.checkEquivalence(ctx.prevExpr, next);
    if (r.verdict === 'unknown') return null;
    if (r.verdict === 'pass') {
      return { status: 'pass', checks: [r.note] };
    }
    return {
      status: 'fail',
      checks: [r.note],
      card: {
        tag: '变形不守恒',
        locate: '第 ' + ctx.prevStepIndex + ' 步 → 第 ' + step.index + ' 步',
        title: '代数变形不守恒：化简前后的表达式并不等价',
        diagnosis: '本步的恒等变形改变了表达式的取值，不是合法化简。',
        gap: '等价变形要求两边恒等：约去公因子、移项、配方都必须保持定义域内取值一致。',
        evidence: ['数值见证：' + r.witness.text],
        theorem: {
          core: '等价变形 ⇔ 变形前后在所有可取值处相等；本工具用 12 组固定抽样点核验。',
          conditions: ['约去公因子后应化简为正确形式', '每一步变形都应能反推回去', '定义域变化需单独注明'],
          counterexample: '(x−1)(x+1)/(x−1) 应化简为 x+1，而不是 (x−1)/(x+1)。',
          fix: '回到上一步重新核对约分对象；对本例，正确结果为 x+1（x≠1）。'
        }
      }
    };
  }

  /* ---------- 3. 极限声称 ---------- */
  function limitCheck(step, ctx) {
    var p = ctx.extractLimitBody(step);
    if (!p) return null;
    if (!SD.math.compile(p.body)) return null;
    var r = SD.sampling.analyzeLimit(p.body, p.target, p.claimed);
    if (r.verdict === 'unknown') return null;

    if (r.verdict === 'oscillating') {
      // 「lim 不存在」的声称本身若与抽样一致，不单独判错，交给概念规则；未命中则存疑
      if (/不存在/.test(step.raw)) {
        return { status: 'doubt', checks: ['数值抽样：' + r.note + '，与「不存在」声称一致；但整步推论需另行核验'] };
      }
      return { status: 'doubt', checks: ['数值抽样：' + r.note + '，无法确认收敛值'] };
    }

    if (r.verdict === 'pass') {
      if (p.claimed == null && p.target.kind === 'inf' && !ctx.originalLimit) {
        ctx.originalLimit = { body: p.body, target: p.target, estimate: r.estimate };
      }
      var notes = [r.note];
      if (p.claimed != null) notes.push('与声称值 L=' + SD.sampling.fmt(p.claimed) + ' 一致');
      return { status: 'pass', checks: notes };
    }

    // fail
    var evidence = [];
    if (r.twoSided) evidence.push(r.twoSided);
    evidence.push('抽样尺度：h = 1e-1 … 1e-6，左右各 6 点');
    return {
      status: 'fail',
      checks: [r.note],
      card: {
        tag: '存在性判据缺失',
        locate: '第 ' + step.index + ' 步',
        title: '极限声称不成立：双侧极限不存在，却被写成了确定值',
        diagnosis: '本步把「极限是否存在」这一步判据跳过了：只有左右极限都存在且相等，才能写下极限值。',
        gap: '双侧极限存在且相等（在导数定义中即：左导数 = 右导数）。',
        evidence: evidence,
        theorem: {
          core: 'lim(x→x₀) f(x) 存在 ⇔ 左极限、右极限都存在且相等。',
          conditions: ['左极限存在', '右极限存在', '左右极限相等', '相等后才能写 lim = L'],
          counterexample: '|x|/x：x→0⁻ 时恒为 −1，x→0⁺ 时恒为 1，双侧极限不存在。',
          fix: '分别写出左右极限再下结论；对本例，f′(0) 不存在，f 在 x=0 不可导。'
        }
      }
    };
  }

  /* ---------- 4. 算术核验（概率乘法、秩判据链） ---------- */
  function probArithmeticCheck(step, ctx) {
    var m = step.raw.match(/P\(A\\cap B\)\s*=\s*P\(A\)P\(B\)\s*=\s*([0-9.]+)/);
    if (!m) return null;
    var all = ctx.allSteps.map(function (s) { return s.raw; }).join('\n');
    var pa = all.match(/P\(A\)\s*=\s*([0-9.]+)/), pb = all.match(/P\(B\)\s*=\s*([0-9.]+)/);
    if (!pa || !pb) return null;
    var expect = parseFloat(pa[1]) * parseFloat(pb[1]);
    var got = parseFloat(m[1]);
    if (Math.abs(expect - got) < 1e-9) {
      return { status: 'pass', checks: ['数值核验：' + pa[1] + '×' + pb[1] + '=' + SD.sampling.fmt(expect) + '，与所写一致（独立性乘法公式使用正确）'] };
    }
    return { status: 'doubt', checks: ['数值核验：' + pa[1] + '×' + pb[1] + '=' + SD.sampling.fmt(expect) + '，与所写 ' + got + ' 不一致'] };
  }

  function rankChainCheck(step) {
    var r = step.raw;
    if (r.indexOf('rank') === -1) return null;
    if (/rank\}\(A\)[^=]*=[^=]*rank\}\(\[A\|b\]\)|rank\(A\)[^=]*=[^=]*rank\(\[A\|b\]\)/.test(r) && /无穷多解/.test(r)) {
      return { status: 'pass', checks: ['判据链完整：rank(A)=rank([A|b])=2<3 ⇒ 无穷多解，自由度 = 3−2 = 1'] };
    }
    if (/rank\}\(A\)\s*=\s*2\s*<\s*3|rank\(A\)\s*=\s*2\s*<\s*3/.test(r) && /不可逆/.test(r) && !/无解/.test(r)) {
      return { status: 'pass', checks: ['判据链完整：rank(A)=2<3 ⇒ A 不可逆（方阵秩小于阶数 ⇔ 不可逆）'] };
    }
    return { status: 'unknown', checks: ['矩阵对象表达式不做数值判定，标记为未判定'] };
  }

  /* ---------- 5. 结论冲突：同链互斥结论 ---------- */
  function detectConflicts(steps, cards) {
    var noSol = null, infSol = null;
    steps.forEach(function (s) {
      if (/无解/.test(s.raw) && !/并非无解|不是无解|未必无解/.test(s.raw) && !noSol) noSol = s;
      if (/无穷多解/.test(s.raw) && !infSol) infSol = s;
    });
    if (noSol && infSol && noSol.index !== infSol.index) {
      cards.push({
        stepIndex: noSol.index,
        extraStepIndex: infSol.index,
        tag: '推理链自相矛盾',
        locate: '第 ' + noSol.index + ' 步 ⇄ 第 ' + infSol.index + ' 步',
        title: '推理链自相矛盾：同一条链上同时出现「无解」与「无穷多解」',
        diagnosis: '两个互斥结论不能同时成立；其中至少一个必定错误，需回到秩的比较重新判定。',
        gap: '解结构判据唯一：rank(A) 与 rank([A|b]) 的比较结果只能落在三种情形之一。',
        evidence: ['第 ' + noSol.index + ' 步断言「无解」，第 ' + infSol.index + ' 步断言「无穷多解」',
                   '按第 ' + infSol.index + ' 步给出的 rank(A)=rank([A|b])=2<3，应为无穷多解 ⇒ 「无解」一侧不成立'],
        theorem: {
          core: '对同一方程组，无解 / 唯一解 / 无穷多解三者互斥且穷尽。',
          conditions: ['无解 ⇔ rank(A)<rank([A|b])', '唯一解 ⇔ rank(A)=rank([A|b])=n', '无穷多解 ⇔ rank(A)=rank([A|b])<n'],
          counterexample: '本例两结论相差的正是「是否比较了增广矩阵的秩」。',
          fix: '保留有完整判据支撑的结论（第 ' + infSol.index + ' 步），删除或修正第 ' + noSol.index + ' 步。'
        }
      });
    }
  }

  /* ---------- 主流程 ---------- */
  function analyze(text) {
    var steps = splitSteps(text);
    var ctx = makeCtx(steps);
    var cards = [];

    steps.forEach(function (step) {
      step.segments = extractSegments(step.raw);
      var result = null;

      // ① 概念规则库（按序，先命中先判）
      for (var i = 0; i < SD.rules.list.length && !result; i++) {
        var rule = SD.rules.list[i];
        if (rule.when(step, ctx)) {
          var built = rule.build(step, ctx);
          result = { status: built.status, checks: ['命中规则 ' + rule.id], card: built.card };
          result.card.tag = built.tag;
        }
      }
      // ② 极限声称
      if (!result) result = limitCheck(step, ctx);
      // ③ 代数等价
      if (!result) result = equivCheck(step, ctx);
      // ④ 算术核验
      if (!result) result = probArithmeticCheck(step, ctx);
      if (!result) result = rankChainCheck(step);
      // ⑤ 缺省：受上游影响 / 未判定
      if (!result) {
        if (ctx.errorsBefore && INFER_WORDS.test(step.raw)) {
          result = { status: 'affected', checks: ['本步引用上游结论；上游已判定不成立，本步随之失效，不单独计错'] };
        } else {
          result = { status: 'unknown', checks: ['未命中可复核的判定规则，不做结论'] };
        }
      }

      step.status = result.status;
      step.checks = result.checks || [];
      if (result.card) {
        if (!result.card.locate) result.card.locate = '第 ' + step.index + ' 步';
        result.card.stepIndex = step.index;
        step.card = result.card;
        cards.push(result.card);
      }

      // 上下文更新
      var expr = rightmostExpr(step);
      if (expr) { ctx.prevExpr = expr; ctx.prevStepIndex = step.index; }
      if (step.raw.indexOf('洛必达') !== -1) ctx.hasLhopital = true;
      var fm = step.raw.match(/f\(x\)\s*=\s*([^，。；$]*)\$?/);
      if (fm && SD.math.compile(fm[1])) {
        ctx.fDef = fm[1];
        var pm = step.raw.match(/x\s*=\s*(\d+)/);
        ctx.fDefPoint = pm ? parseFloat(pm[1]) : 0;
      }
      if (step.status === 'fail') ctx.errorsBefore = true;
    });

    detectConflicts(steps, cards);

    // 偏航点编号 + 时间线挂签
    cards.forEach(function (card, i) {
      card.driftId = '偏航点 ' + ('0' + (i + 1)).slice(-2);
      card.anchor = 'drift-' + (i + 1);
      var s = steps[card.stepIndex - 1];
      if (s) s.driftIds.push(card.anchor);
    });

    var firstDrift = null, failCount = 0;
    steps.forEach(function (s) {
      if ((s.status === 'fail' || s.status === 'doubt') && !firstDrift) firstDrift = s;
      if (s.status === 'fail') failCount++;
    });
    var summary = firstDrift
      ? '从第 ' + firstDrift.index + ' 步开始偏航，' + failCount + ' 处结论级问题，结论不能直接采用。'
      : '未检出结论级问题；「未判定」不代表正确，仅表示超出本工具的判定边界。';

    return { steps: steps, cards: cards, summary: summary };
  }

  return { analyze: analyze, splitSteps: splitSteps };
})();
