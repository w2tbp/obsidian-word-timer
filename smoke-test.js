'use strict';

const { WritingSession, countWords } = require('./lib/counter');

let allPassed = true;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) allPassed = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}：期望 ${expected}，实际 ${actual}`);
}

console.log('=== 冒烟测试：写作计时器逻辑验证 ===\n');

// ── 场景 1：基础流程 ──
console.log('场景 1：基础流程（输入→暂停→继续→删除→结束）');
{
  const session = new WritingSession({ mode: 'word' });
  session.start();
  session.setBaseline('test.md', 0);

  session.updateFile('test.md', '今'.repeat(100));
  check('输入 100 字后净增', session.getNetIncrease(), 100);

  session.pause();
  check('暂停后净增冻结', session.getNetIncrease(), 100);

  session.updateFile('test.md', '今'.repeat(150));
  check('暂停中输入 50 字，净增仍冻结', session.getNetIncrease(), 100);

  session.resume();
  session.updateFile('test.md', '今'.repeat(150));
  check('恢复后净增不变（baseline 已调整）', session.getNetIncrease(), 100);

  session.updateFile('test.md', '今'.repeat(130));
  check('删除 20 字后净增（130-50=80）', session.getNetIncrease(), 80);

  const summary = session.stop();
  check('结束汇总净增', summary.netIncrease, 80);
  console.log(`  汇总：用时 ${summary.elapsed}，净增 ${summary.netIncrease} ${summary.unit}\n`);
}

// ── 场景 2：Bug A —— 切换到已有内容的文件 ──
console.log('场景 2：切换到已有大段内容的文件（Bug A 验证）');
{
  const session = new WritingSession({ mode: 'word' });
  session.start();
  session.setBaseline('start.md', 0);

  const existingContent = '已有内容'.repeat(100);
  const existingWordCount = countWords(existingContent);
  console.log(`  目标文件原有 ${existingWordCount} 字`);

  session.updateFile('other.md', existingContent);
  check('切换到已有文件后净增应为 0', session.getNetIncrease(), 0);

  const newContent = existingContent + '新写两个字';
  const newWordCount = countWords(newContent);
  console.log(`  新写文本共 ${newWordCount} 字（原有 ${existingWordCount} + 新增 ${newWordCount - existingWordCount}）`);
  session.updateFile('other.md', newContent);
  check('在已有文件上新写 5 字后净增', session.getNetIncrease(), 5);

  const anotherContent = '全新文件内容三个字';
  const anotherWordCount = countWords(anotherContent);
  console.log(`  新文件内容 ${anotherWordCount} 字`);
  session.updateFile('another.md', anotherContent);
  check('切到新文件（首次见到，baseline=当前字数）净增不变', session.getNetIncrease(), 5);

  const anotherContent2 = '全新文件内容三个字又加了';
  const anotherWordCount2 = countWords(anotherContent2);
  console.log(`  新文件追加后 ${anotherWordCount2} 字（新增 ${anotherWordCount2 - anotherWordCount}）`);
  session.updateFile('another.md', anotherContent2);
  check('在新文件上追加 3 字后净增', session.getNetIncrease(), 8);

  session.stop();
  console.log();
}

// ── 场景 3：Bug B —— 暂停期间打字恢复后不补计 ──
console.log('场景 3：暂停期间打字，恢复后不补计（Bug B 验证）');
{
  const session = new WritingSession({ mode: 'word' });
  session.start();
  session.setBaseline('a.md', 0);

  session.updateFile('a.md', '字'.repeat(100));
  check('初始输入 100 字', session.getNetIncrease(), 100);

  session.pause();
  session.updateFile('a.md', '字'.repeat(150));
  check('暂停中打了 50 字，净增冻结', session.getNetIncrease(), 100);

  session.resume();
  session.updateFile('a.md', '字'.repeat(150));
  check('恢复后净增仍为 100（不补计）', session.getNetIncrease(), 100);

  session.updateFile('a.md', '字'.repeat(200));
  check('恢复后再打 50 字，净增 150', session.getNetIncrease(), 150);

  session.pause();
  session.updateFile('a.md', '字'.repeat(180));
  check('再次暂停，删除了 20 字，净增冻结', session.getNetIncrease(), 150);

  session.resume();
  session.updateFile('a.md', '字'.repeat(180));
  check('再次恢复，baseline 下调吸收删除，净增仍 150', session.getNetIncrease(), 150);

  session.updateFile('a.md', '字'.repeat(200));
  check('继续打字回到 200，净增 170', session.getNetIncrease(), 170);

  session.stop();
  console.log();
}

// ── 场景 4：Bug C —— 会话中切换字数/字符数口径 ──
console.log('场景 4：会话中切换统计口径（Bug C 验证）');
{
  const session = new WritingSession({ mode: 'word' });
  session.start();
  session.setBaseline('a.md', 0, '');

  session.updateFile('a.md', 'hello world');
  check('字数模式下 2 个英文单词', session.getNetIncrease(), 2);

  session.setMode('character');
  check('切换到字符模式后净增归 0', session.getNetIncrease(), 0);

  session.updateFile('a.md', 'hello world!');
  check('多打 1 个字符（感叹号）', session.getNetIncrease(), 1);

  session.setMode('word');
  check('切回字数模式后净增归 0', session.getNetIncrease(), 0);

  session.stop();
  console.log();
}

// ── 总结 ──
console.log('=== 验证结果 ===');
if (allPassed) {
  console.log('✓ 全部通过');
} else {
  console.log('✗ 存在失败项');
}
process.exit(allPassed ? 0 : 1);
