'use strict';

const { WritingSession, countWords } = require('./lib/counter');

console.log('=== 冒烟测试：写作计时器逻辑验证 ===\n');

const session = new WritingSession({ mode: 'word' });

console.log('1. 开始会话');
session.start();
console.log(`   状态：active=${session.isActive()}, paused=${session.isPaused()}`);
console.log(`   净增：${session.getNetIncrease()} 字\n`);

console.log('2. 输入 100 字');
const content100 = '今'.repeat(100);
session.updateFile('test.md', content100);
console.log(`   当前字数：${countWords(content100)}`);
console.log(`   净增：${session.getNetIncrease()} 字`);
console.log(`   状态栏：${session.getStatusText()}\n`);

console.log('3. 暂停');
session.pause();
console.log(`   状态：paused=${session.isPaused()}`);
console.log(`   净增：${session.getNetIncrease()} 字\n`);

console.log('4. 暂停期间输入 50 字（不应增加）');
const content150 = '今'.repeat(150);
session.updateFile('test.md', content150);
console.log(`   实际字数：${countWords(content150)}`);
console.log(`   净增：${session.getNetIncrease()} 字（应该还是 100）\n`);

console.log('5. 继续');
session.resume();
console.log(`   状态：paused=${session.isPaused()}`);
console.log(`   净增：${session.getNetIncrease()} 字`);
console.log(`   注意：恢复时需要同步实际文件状态（150字），但保持净增为100`);
console.log(`   模拟：更新baseline以吸收暂停期间的变化\n`);

console.log('6. 删除 20 字（从暂停前的100字状态删除）');
const content80 = '今'.repeat(80);
session.updateFile('test.md', content80);
console.log(`   当前字数：${countWords(content80)}`);
console.log(`   净增：${session.getNetIncrease()} 字（应该是 100 - 20 = 80）`);
console.log(`   状态栏：${session.getStatusText()}\n`);

console.log('7. 结束会话');
const summary = session.stop();
console.log(`   状态：active=${session.isActive()}`);
console.log(`   汇总：`);
console.log(`     - 用时：${summary.elapsed}`);
console.log(`     - 净增：${summary.netIncrease} ${summary.unit}`);
console.log(`     - 速度：${summary.wpm} ${summary.unit}/分\n`);

console.log('=== 验证结果 ===');
const success = summary.netIncrease === 80;
console.log(success ? '✓ 通过：净增为 80 字，符合预期' : '✗ 失败：净增不为 80 字');
console.log(`  期望：80 字`);
console.log(`  实际：${summary.netIncrease} 字\n`);

process.exit(success ? 0 : 1);
