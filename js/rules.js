/* StepDrift · 概念规则库
   新增规则：向 SD.rules.list 追加 { id, tag, when(step, ctx), build(step, ctx) }。
   when 返回 true 即命中；build 返回 { status, tag, card }，文案全部来自本文件模板。 */
window.SD = window.SD || {};

SD.rules = (function () {
  'use strict';

  var fmt = function (v) { return SD.sampling.fmt(v); };

  function grabPA(ctx) {
    var all = ctx.allSteps.map(function (s) { return s.raw; }).join('\n');
    function num(re) { var m = all.match(re); return m ? parseFloat(m[1]) : null; }
    return {
      pA: num(/P\(A\)\s*=\s*([0-9.]+)/),
      pB: num(/P\(B\)\s*=\s*([0-9.]+)/),
      pAB: num(/P\(A\\cap B\)\s*=\s*P\(A\)P\(B\)\s*=\s*([0-9.]+)/)
    };
  }

  var list = [
    /* ---------- R1：连续 → 可导（蕴含方向反转） ---------- */
    {
      id: 'R-CONT-DERIV',
      tag: '充分必要条件混淆',
      when: function (step) {
        var r = step.raw;
        if (r.indexOf('连续') === -1 || r.indexOf('可导') === -1) return false;
        if (/(不一定|未必|不能|不可导)/.test(r)) return false;
        var m = r.match(/(可知|所以|故|因此|则)/);
        if (!m) return false;
        var premise = r.slice(0, m.index), conclusion = r.slice(m.index + m[0].length);
        return premise.indexOf('连续') !== -1 && conclusion.indexOf('可导') !== -1;
      },
      build: function (step, ctx) {
        var evidence = ['方向核验：可导 ⇒ 连续 成立；连续 ⇒ 可导 不成立（本步把方向用反了）'];
        if (ctx.fDef && ctx.fDefPoint != null) {
          var f = SD.math.compile(ctx.fDef);
          if (f) {
            var a = ctx.fDefPoint;
            var ld = (f(a - 1e-6) - f(a)) / -1e-6;
            var rd = (f(a + 1e-6) - f(a)) / 1e-6;
            if (isFinite(ld) && isFinite(rd) && Math.abs(ld - rd) > 1e-3) {
              evidence.push('反例数值核验：f(x)=|x| 在 x=0 处，左差商 ≈ ' + fmt(ld) +
                            '，右差商 ≈ ' + fmt(rd) + '，双侧不相等 ⇒ 不可导');
            }
          }
        }
        return {
          status: 'fail',
          tag: '充分必要条件混淆',
          card: {
            title: '「连续 ⇒ 可导」方向不成立：连续只是可导的必要条件，不是充分条件',
            diagnosis: '本步由「连续」直接断言「可导」，跳过了可导性本身的判据。',
            gap: '导数定义式的双侧极限存在性：左导数、右导数都必须存在且相等。',
            evidence: evidence,
            theorem: {
              core: '可导 ⇒ 连续；连续 ⇏ 可导。f 在 x₀ 可导 ⇔ 差商 (f(x₀+h)−f(x₀))/h 在 h→0 时双侧极限存在且相等。',
              conditions: ['f 在 x₀ 的邻域内有定义', '左导数存在', '右导数存在', '左导数 = 右导数'],
              counterexample: 'f(x)=|x| 在 x=0 连续（lim|x|=0=f(0)），但左导数 = −1、右导数 = 1，不可导。',
              fix: '删掉「连续 ⇒ 可导」这一步，回到定义分别求左右差商极限，相等才能写可导。'
            }
          }
        };
      }
    },

    /* ---------- R2：洛必达前提未验证 ---------- */
    {
      id: 'R-LHOPITAL-PRE',
      tag: '定理适用条件未验证',
      when: function (step, ctx) {
        var r = step.raw;
        if (r.indexOf('洛必达') === -1 || /不存在/.test(r)) return false;
        // 本步给出的极限经抽样确认收敛时，前提③已有数值证据，不再记「存疑」
        var expr = ctx && ctx.extractLimitBody ? ctx.extractLimitBody(step) : null;
        if (expr && SD.math.compile(expr.body)) {
          var res = SD.sampling.analyzeLimit(expr.body, expr.target, expr.claimed);
          if (res.verdict === 'pass') return false;
        }
        return true;
      },
      build: function (step, ctx) {
        var evidence = ['已声明：∞/∞ 型（第 1 步）；未验证：分子分母可导且分母导数非零、导数之比极限存在'];
        var expr = ctx.extractLimitBody(step);
        if (expr) {
          var range = SD.sampling.oscillationRange(expr.body);
          if (range) {
            evidence.push('导数之比数值抽样：' + range.text + '，极限不存在 ⇒ 第三条前提不成立');
          }
        }
        return {
          status: 'doubt',
          tag: '定理适用条件未验证',
          card: {
            title: '套用洛必达法则前，三条前提没有全部核验',
            diagnosis: '「由洛必达法则」只是方法声称；本步未核验导数之比的极限是否存在，记为「前提存疑」。',
            gap: '分子分母在邻域内可导且分母导数非零；导数之比的极限存在（或为 ∞）。',
            evidence: evidence,
            theorem: {
              core: '0/0 或 ∞/∞ 型且前提全部满足时，lim f/g = lim f′/g′。',
              conditions: ['该邻域内 f、g 可导且 g′≠0', '原式确为 0/0 或 ∞/∞ 型', 'lim f′/g′ 存在或为 ∞'],
              counterexample: 'lim(x→∞)(x+sin x)/x：导数之比 1+cos x 无极限，前提③不成立，但原极限 = 1。',
              fix: '先逐条核验前提；前提③不成立时应换方法（同除、夹逼），且不得反推原极限不存在。'
            }
          }
        };
      }
    },

    /* ---------- R3：由「导数之比无极限」推出「原极限不存在」 ---------- */
    {
      id: 'R-LHOPITAL-INVERSE',
      tag: '充分必要条件混淆',
      when: function (step, ctx) {
        return ctx.hasLhopital && /原极限不存在|原式不存在/.test(step.raw) && /不存在/.test(step.raw);
      },
      build: function (step, ctx) {
        var evidence = [];
        var expr = ctx.extractLimitBody(step);
        if (expr) {
          var range = SD.sampling.oscillationRange(expr.body);
          if (range) evidence.push('导数之比不收敛（' + range.text + '）只能说明洛必达失效');
        }
        if (ctx.originalLimit && ctx.originalLimit.estimate != null) {
          evidence.push('原极限沿 x→+∞ 抽样趋于 ' + fmt(ctx.originalLimit.estimate) + ' —— 失效 ≠ 不存在');
        } else {
          evidence.push('方向核验：lim f′/g′ 不存在 ⇒ 洛必达不适用；原极限是否存在需独立判定');
        }
        return {
          status: 'fail',
          tag: '充分必要条件混淆',
          card: {
            title: '方法失效被误当成结论不成立：洛必达用不出，不等于原极限不存在',
            diagnosis: '本步由「导数之比无极限」推出「原极限不存在」，这是反向误用：法则前提不成立时，结论只能回到原式另找方法。',
            gap: '原极限本身的独立判定：同除、夹逼、等价无穷小或直接抽样。',
            evidence: evidence,
            theorem: {
              core: 'lim f′/g′ 不存在时，洛必达法则不适用；原极限仍可能存在。',
              conditions: ['区分「方法前提不成立」与「命题为假」', '更换独立方法后再下结论'],
              counterexample: '(x+sin x)/x = 1 + (sin x)/x，导数之比 1+cos x 摆动，但原极限 = 1。',
              fix: '同除以 x 得 1+(sin x)/x，由 |sin x / x| ≤ 1/|x| → 0，夹逼得原极限 = 1。'
            }
          }
        };
      }
    },

    /* ---------- R4：A 不可逆 → Ax=b 无解 ---------- */
    {
      id: 'R-RANK-NOSOL',
      tag: '解结构判据缺失',
      when: function (step) {
        return step.raw.indexOf('不可逆') !== -1 && /无解/.test(step.raw) &&
               /(所以|故|因此|可知|则)/.test(step.raw);
      },
      build: function (step, ctx) {
        var evidence = ['方向核验：不可逆仅说明 rank(A)<n；是否无解取决于 rank(A) 与 rank([A|b]) 是否相等'];
        var rA = ctx.findRankA(), rAb = ctx.findRankAb();
        if (rA != null && rAb != null) {
          evidence.push('本例后续给出 rank(A)=' + rA + '、rank([A|b])=' + rAb +
                        '，秩相等 ⇒ 方程组相容（有解），与「无解」直接矛盾');
        }
        return {
          status: 'fail',
          tag: '解结构判据缺失',
          card: {
            title: '由「A 不可逆」推不出「Ax=b 无解」：解的个数要看秩的比较',
            diagnosis: '不可逆只排除「唯一解」，并不排除「无穷多解」；本步把两种情形混为一谈。',
            gap: 'rank(A) 与 rank([A|b]) 的比较：无解 ⇔ rank(A) < rank([A|b])。',
            evidence: evidence,
            theorem: {
              core: 'Ax=b 的解结构由 rank(A) 与 rank([A|b]) 的关系决定，而非仅由 A 是否可逆决定。',
              conditions: ['rank(A)<rank([A|b]) ⇔ 无解', 'rank(A)=rank([A|b])=n ⇔ 唯一解', 'rank(A)=rank([A|b])<n ⇔ 无穷多解'],
              counterexample: 'rank(A)=rank([A|b])=2<3 时，A 不可逆，但方程组有无穷多解（自由度 1）。',
              fix: '先写增广矩阵并比较秩，再断言解的个数；「不可逆」之后只能接「无唯一解」。'
            }
          }
        };
      }
    },

    /* ---------- R5：「恰有一人」写成 A∪B ---------- */
    {
      id: 'R-EXACTLY-ONE',
      tag: '事件与对象语义误读',
      when: function (step) {
        var r = step.raw;
        if (!/恰有一人|恰好一人|恰有一个/.test(r)) return false;
        if (!/\\cup|∪/.test(r)) return false;
        // 已写出互斥分解（含补事件记号）时，事件翻译是对的，不再计错
        return !/\\bar|\\overline|\u0304|Ā|B̄|对立|互斥/.test(r);
      },
      build: function (step, ctx) {
        var p = grabPA(ctx);
        var evidence = [];
        if (p.pA != null && p.pB != null) {
          var correct = p.pA * (1 - p.pB) + (1 - p.pA) * p.pB;
          var union = p.pA + p.pB - p.pA * p.pB;
          evidence.push('正确分解：(A∩B̄)∪(Ā∩B) = ' + fmt(p.pA) + '×' + fmt(1 - p.pB) + ' + ' +
                        fmt(1 - p.pA) + '×' + fmt(p.pB) + ' = ' + fmt(correct));
          evidence.push('所写 ' + fmt(union) + ' 与 ' + fmt(correct) + ' 之差 ' + fmt(union) + '−' +
                        fmt(correct) + '=' + fmt(union - correct) + ' 正好是 P(A∩B)（两人同时命中被多算了一次）');
        } else {
          evidence.push('集合核验：A∪B 包含 A∩B；恰有一人 = (A∩B̄)∪(Ā∩B)，两者相差 P(A∩B)');
        }
        evidence.push('算术没错，错在事件先被认错了');
        return {
          status: 'fail',
          tag: '事件与对象语义误读',
          card: {
            title: '「恰有一人命中」不是 A∪B：A∪B 是「至少一人命中」',
            diagnosis: '本步的事件翻译错了：A∪B 把「两人都命中」也算了进去，后续加法公式本身并没有算错。',
            gap: '互斥分解：恰有一人 = (A∩B̄)∪(Ā∩B)，必须排除 A∩B。',
            evidence: evidence,
            theorem: {
              core: 'A∪B = 至少一人；恰有一人 = (A∩B̄)∪(Ā∩B)；P(A∪B) − P(恰有一人) = P(A∩B)。',
              conditions: ['先明确问题所问的事件，再写符号', '「恰有」类表述要排除同时发生', '独立时 P(A∩B)=P(A)P(B)'],
              counterexample: '本例 0.8 是「至少一人命中」的概率；「恰有一人」应为 0.5。',
              fix: '用互斥分解重写：P = P(A)P(B̄)+P(Ā)P(B)；或 P(A∪B)−P(A∩B)。'
            }
          }
        };
      }
    }
  ];

  return { list: list };
})();
