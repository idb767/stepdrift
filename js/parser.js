/* StepDrift · 数学表达式解析：LaTeX 预处理 + tokenizer + 递归下降 + 求值
   只支持纯算术表达式；rank(A)、A∪B、[A|b] 等对象表达式在入口被拒绝。 */
window.SD = window.SD || {};

SD.math = (function () {
  'use strict';

  var FUNCS = ['sin', 'cos', 'tan', 'ln', 'exp', 'sqrt', 'abs'];

  /* ---------- 对象表达式识别：出现即跳过 ---------- */
  function isPureArithmetic(src) {
    if (!src) return false;
    if (/\\(cup|cap|operatorname|begin|bar|overline|vec|mathbin|subset|in|forall|exists|lim|log)\b/.test(src)) return false;
    if (/[∪∩⊂∈∀∃]/.test(src)) return false;
    if (/\[[^\]]*\|[^\]]*\]/.test(src)) return false; // [A|b]
    if (/rank\s*\(/i.test(src)) return false;
    if (/P\s*\(/.test(src)) return false;
    if (/[A-HJ-Z]/.test(src.replace(/\\[a-zA-Z]+/g, ''))) return false; // 矩阵/事件大写字母
    return true;
  }

  /* ---------- LaTeX → 纯文本表达式 ---------- */
  function readGroup(s, i) { // s[i] === '{'，返回 {body, next}
    var depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { depth--; if (depth === 0) return { body: s.slice(i + 1, j), next: j + 1 }; }
    }
    return { body: s.slice(i + 1), next: s.length };
  }

  function latexToExpr(src) {
    var s = src;
    // 函数名必须在去空格前替换，并保留一个空格作为与变量的边界（tokenizer 会跳过空白）
    s = s.replace(/\\(sin|cos|tan|ln|exp)\b/g, '$1 ');
    s = s.replace(/\\pi\b/g, 'pi ');
    s = s.replace(/\\(cdot|times)/g, '*');
    s = s.replace(/\\(left|right|,|;|!|:)/g, ' ');

    var guard = 0;
    while (s.indexOf('\\frac') !== -1 && guard++ < 30) {
      var i = s.indexOf('\\frac');
      var p = i + 5;
      if (s[p] !== '{') { s = s.replace('\\frac', ''); continue; }
      var num = readGroup(s, p);
      if (s[num.next] !== '{') { s = s.slice(0, i) + s.slice(num.next); continue; }
      var den = readGroup(s, num.next);
      s = s.slice(0, i) + '((' + num.body + ')/(' + den.body + '))' + s.slice(den.next);
    }

    guard = 0;
    while (/\\sqrt/.test(s) && guard++ < 30) {
      var k = s.search(/\\sqrt/);
      var q = k + 5;
      if (s[q] === '{') {
        var g = readGroup(s, q);
        s = s.slice(0, k) + 'sqrt(' + g.body + ')' + s.slice(g.next);
      } else {
        s = s.slice(0, k) + 'sqrt(' + (s[q] || '') + ')' + s.slice(q + 1);
      }
    }

    guard = 0;
    while (/\^\{/.test(s) && guard++ < 50) {
      var c = s.indexOf('^{');
      var g2 = readGroup(s, c + 1);
      s = s.slice(0, c) + '^(' + g2.body + ')' + s.slice(g2.next);
    }

    // 绝对值：成对竖线 → abs(...)
    if ((s.match(/\|/g) || []).length >= 2) {
      var out = '', open = false;
      for (var m = 0; m < s.length; m++) {
        if (s[m] === '|') { out += open ? ')' : 'abs('; open = !open; }
        else out += s[m];
      }
      s = out;
    }
    return s;
  }

  /* ---------- tokenizer ---------- */
  function tokenize(s) {
    var tokens = [], i = 0;
    while (i < s.length) {
      var ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        var num = ch; i++;
        while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
        tokens.push({ t: 'num', v: parseFloat(num) });
        continue;
      }
      if (/[a-zA-Z]/.test(ch)) {
        var word = ch; i++;
        while (i < s.length && /[a-zA-Z]/.test(s[i])) { word += s[i]; i++; }
        tokens.push({ t: 'id', v: word });
        continue;
      }
      if ('+-*/^()'.indexOf(ch) !== -1) { tokens.push({ t: ch }); i++; continue; }
      return null; // 含无法识别的字符 → 整体放弃
    }
    return tokens;
  }

  /* ---------- 递归下降 ----------
     expr   := term (('+'|'-') term)*
     term   := unary (('*'|'/'|隐式) unary)*
     unary  := '-' unary | power
     power  := primary ('^' unary)?        右结合
     primary:= num | id | id '(' expr ')' | '(' expr ')'                */
  function parse(tokens) {
    var pos = 0;
    function peek() { return tokens[pos]; }
    function eat(t) { if (peek() && peek().t === t) { pos++; return true; } return false; }

    function primary() {
      var tk = peek();
      if (!tk) return null;
      if (tk.t === 'num') { pos++; return { k: 'num', v: tk.v }; }
      if (tk.t === '(') { pos++; var e = expr(); if (!eat(')')) return null; return e; }
      if (tk.t === 'id') {
        pos++;
        if (eat('(')) {
          if (FUNCS.indexOf(tk.v) === -1) return null;
          var arg = expr();
          if (!eat(')')) return null;
          return { k: 'call', name: tk.v, arg: arg };
        }
        if (tk.v === 'pi') return { k: 'num', v: Math.PI };
        if (tk.v === 'e') return { k: 'num', v: Math.E };
        if (tk.v === 'x') return { k: 'var' };
        if (FUNCS.indexOf(tk.v) !== -1) { // 无括号函数：sin x
          var a = primary();
          return a ? { k: 'call', name: tk.v, arg: a } : null;
        }
        return null;
      }
      return null;
    }
    function power() {
      var base = primary();
      if (!base) return null;
      if (eat('^')) {
        var ex = unary();
        return ex ? { k: 'bin', op: '^', l: base, r: ex } : null;
      }
      return base;
    }
    function unary() {
      if (eat('-')) { var u = unary(); return u ? { k: 'neg', a: u } : null; }
      if (eat('+')) return unary();
      return power();
    }
    function term() {
      var left = unary();
      if (!left) return null;
      for (;;) {
        var tk = peek();
        if (!tk) break;
        if (tk.t === '*' || tk.t === '/') {
          pos++;
          var r = unary();
          if (!r) return null;
          left = { k: 'bin', op: tk.t, l: left, r: r };
        } else if (tk.t === 'num' || tk.t === 'id' || tk.t === '(') { // 隐式乘法
          var r2 = unary();
          if (!r2) return null;
          left = { k: 'bin', op: '*', l: left, r: r2 };
        } else break;
      }
      return left;
    }
    function expr() {
      var left = term();
      if (!left) return null;
      for (;;) {
        var tk = peek();
        if (!tk || (tk.t !== '+' && tk.t !== '-')) break;
        pos++;
        var r = term();
        if (!r) return null;
        left = { k: 'bin', op: tk.t, l: left, r: r };
      }
      return left;
    }

    var ast = expr();
    if (!ast || pos !== tokens.length) return null;
    return ast;
  }

  /* ---------- 求值 ---------- */
  function evalNode(n, x) {
    switch (n.k) {
      case 'num': return n.v;
      case 'var': return x;
      case 'neg': return -evalNode(n.a, x);
      case 'bin':
        var l = evalNode(n.l, x), r = evalNode(n.r, x);
        if (n.op === '+') return l + r;
        if (n.op === '-') return l - r;
        if (n.op === '*') return l * r;
        if (n.op === '/') return r === 0 ? NaN : l / r;
        if (n.op === '^') return Math.pow(l, r);
        return NaN;
      case 'call':
        var a = evalNode(n.arg, x);
        switch (n.name) {
          case 'sin': return Math.sin(a);
          case 'cos': return Math.cos(a);
          case 'tan': return Math.tan(a);
          case 'ln': return a > 0 ? Math.log(a) : NaN;
          case 'exp': return Math.exp(a);
          case 'sqrt': return a >= 0 ? Math.sqrt(a) : NaN;
          case 'abs': return Math.abs(a);
        }
    }
    return NaN;
  }

  /* 编译：latex 源码 → 可求值函数；失败返回 null */
  function compile(latexSrc) {
    if (!isPureArithmetic(latexSrc)) return null;
    var plain = latexToExpr(latexSrc);
    // 仅允许 x 作为变量；其余字母（去掉函数名/常数/空白后）一律拒绝
    var stripped = plain.replace(/sin|cos|tan|ln|exp|sqrt|abs|pi|e|x|[0-9+\-*/^().\s]/g, '');
    if (stripped) return null;
    var tokens = tokenize(plain);
    if (!tokens || !tokens.length) return null;
    var ast = parse(tokens);
    if (!ast) return null;
    return function (x) { return evalNode(ast, x); };
  }

  return {
    compile: compile,
    isPureArithmetic: isPureArithmetic,
    latexToExpr: latexToExpr
  };
})();
