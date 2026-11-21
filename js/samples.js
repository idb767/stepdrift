/* StepDrift · 预置验收样例（与 README 中的期望输出一一对应） */
window.SD = window.SD || {};

SD.samples = [
  {
    id: 'A', name: '样例 A · 连续与可导',
    text: '第1步 考察 $f(x)=|x|$ 在 $x=0$ 处的性态。\n第2步 因为 $\\lim_{x\\to 0}|x|=0=f(0)$，所以 $f$ 在 $x=0$ 处连续。\n第3步 由 $f$ 在 $x=0$ 连续，可知 $f$ 在 $x=0$ 可导。\n第4步 由导数定义，$f\'(0)=\\lim_{x\\to 0}\\frac{|x|}{x}=1$。\n第5步 所以 $f\'(0)=1$，曲线在原点处有切线。'
  },
  {
    id: 'B', name: '样例 B · 洛必达失效',
    text: '第1步 原式为 $\\lim_{x\\to\\infty}\\frac{x+\\sin x}{x}$，属 $\\frac{\\infty}{\\infty}$ 型。\n第2步 由洛必达法则，原式 $=\\lim_{x\\to\\infty}\\frac{1+\\cos x}{1}$。\n第3步 因为 $\\lim_{x\\to\\infty}(1+\\cos x)$ 不存在，所以原极限不存在。'
  },
  {
    id: 'C', name: '样例 C · 秩与解结构',
    text: '第1步 $A$ 为 $3\\times 3$ 矩阵，$\\operatorname{rank}(A)=2<3$，故 $A$ 不可逆。\n第2步 因为 $A$ 不可逆，所以 $Ax=b$ 无解。\n第3步 计算增广矩阵，得 $\\operatorname{rank}([A|b])=2$。\n第4步 由于 $\\operatorname{rank}(A)=\\operatorname{rank}([A|b])=2<3$，故 $Ax=b$ 有无穷多解，自由度为 $3-2=1$。'
  },
  {
    id: 'D', name: '样例 D · 恰有一人',
    text: '第1步 设 $A$ 为甲命中，$B$ 为乙命中，$P(A)=0.6$，$P(B)=0.5$，且 $A,B$ 相互独立。\n第2步 由独立性，$P(A\\cap B)=P(A)P(B)=0.3$。\n第3步 恰有一人命中即 $A\\cup B$，故 $P(A\\cup B)=P(A)+P(B)-P(A\\cap B)=0.8$。\n第4步 所以恰有一人命中的概率为 $0.8$。'
  },
  {
    id: 'E', name: '样例 E · 变形不守恒',
    text: '第1步 原式 $=\\frac{x^2-1}{x-1}$\n第2步 分子分解因式，$=(x-1)(x+1)/(x-1)$\n第3步 约去公因子，$=(x-1)/(x+1)$\n第4步 所以原式 $=1-\\frac{2}{x+1}$'
  }
];
