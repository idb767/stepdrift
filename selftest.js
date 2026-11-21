const fs = require('fs');
const path = require('path');
global.window = global;
const base = path.join(__dirname, 'js');
['parser.js', 'sampling.js', 'rules.js', 'engine.js', 'samples.js'].forEach(f => {
  eval(fs.readFileSync(path.join(base, f), 'utf8'));
});

SD.samples.forEach(s => {
  const r = SD.engine.analyze(s.text);
  console.log('\n===== 样例 ' + s.id + ' =====');
  console.log('摘要: ' + r.summary);
  r.steps.forEach(st => {
    console.log('  第' + st.index + '步 [' + st.status + '] ' + st.checks.join(' / '));
  });
  r.cards.forEach(c => {
    console.log('  [' + c.driftId + '] ' + c.locate + ' | ' + c.tag);
    console.log('    标题: ' + c.title);
    console.log('    缺的条件: ' + c.gap);
    c.evidence.forEach(e => console.log('    证据: ' + e));
  });
});

// 确定性
const a1 = JSON.stringify(SD.engine.analyze(SD.samples[0].text));
const a2 = JSON.stringify(SD.engine.analyze(SD.samples[0].text));
console.log('\n确定性(样例A两次一致): ' + (a1 === a2));
