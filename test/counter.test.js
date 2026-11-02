'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { countWords, countCharacters, countText, WritingSession } = require('../lib/counter');

describe('countWords', () => {
  it('counts Chinese characters individually', () => {
    assert.equal(countWords('你好世界'), 4);
    assert.equal(countWords('今天天气真好'), 6);
  });

  it('counts English words as one each', () => {
    assert.equal(countWords('hello world'), 2);
    assert.equal(countWords('The quick brown fox'), 4);
  });

  it('counts consecutive alphanumeric as one word', () => {
    assert.equal(countWords('hello123'), 1);
    assert.equal(countWords('abc123def'), 1);
    assert.equal(countWords('test42'), 1);
  });

  it('handles mixed Chinese and English', () => {
    assert.equal(countWords('你好world'), 3);
    assert.equal(countWords('hello世界'), 3);
    assert.equal(countWords('今天写了100words'), 5);
  });

  it('ignores pure punctuation and whitespace', () => {
    assert.equal(countWords('   '), 0);
    assert.equal(countWords('，。！？'), 0);
    assert.equal(countWords('...'), 0);
    assert.equal(countWords('  , . !  '), 0);
  });

  it('handles empty string', () => {
    assert.equal(countWords(''), 0);
  });

  it('handles non-string input', () => {
    assert.equal(countWords(null), 0);
    assert.equal(countWords(undefined), 0);
    assert.equal(countWords(123), 0);
  });

  it('handles multiline text', () => {
    assert.equal(countWords('hello\nworld\n你好'), 4);
  });
});

describe('countCharacters', () => {
  it('counts all characters including punctuation and spaces', () => {
    assert.equal(countCharacters('你好'), 2);
    assert.equal(countCharacters('hello'), 5);
    assert.equal(countCharacters('hello world'), 11);
    assert.equal(countCharacters('，。！'), 3);
  });

  it('handles empty and non-string', () => {
    assert.equal(countCharacters(''), 0);
    assert.equal(countCharacters(null), 0);
  });
});

describe('countText', () => {
  it('switches between word and character mode', () => {
    const text = '你好hello world！';
    assert.equal(countText(text, 'word'), 4);
    assert.equal(countText(text, 'character'), text.length);
  });
});

describe('WritingSession - net increase floor at 0', () => {
  it('does not go negative when deleting more than typed', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.updateFile('a.md', '你好世界');
    assert.equal(s.getNetIncrease(), 4);
    s.updateFile('a.md', '你好');
    assert.equal(s.getNetIncrease(), 2);
    s.updateFile('a.md', '');
    assert.equal(s.getNetIncrease(), 0);
    s.updateFile('a.md', '');
    assert.equal(s.getNetIncrease(), 0);
  });
});

describe('WritingSession - pause freezes counting', () => {
  it('ignores updates while paused', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.updateFile('a.md', '你好世界');
    assert.equal(s.getNetIncrease(), 4);
    s.pause();
    assert.equal(s.isPaused(), true);
    s.updateFile('a.md', '你好世界很多很多字');
    assert.equal(s.getNetIncrease(), 4);
    s.resume();
    assert.equal(s.isPaused(), false);
    const netAfterResume = s.getNetIncrease();
    assert.equal(netAfterResume, 4);
    s.updateFile('a.md', '新内容三个字');
    assert.equal(s.getNetIncrease(), 6);
  });
});

describe('WritingSession - cross-file accumulation', () => {
  it('sums net increase across multiple files', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.updateFile('a.md', '你好');
    s.updateFile('b.md', 'world');
    assert.equal(s.getNetIncrease(), 3);
    s.updateFile('a.md', '你好世界');
    assert.equal(s.getNetIncrease(), 5);
    s.updateFile('c.md', 'test');
    assert.equal(s.getNetIncrease(), 6);
  });

  it('does not reset when switching files', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.updateFile('a.md', '一二三');
    assert.equal(s.getNetIncrease(), 3);
    s.updateFile('b.md', 'four five');
    assert.equal(s.getNetIncrease(), 5);
    s.updateFile('a.md', '一二三四五');
    assert.equal(s.getNetIncrease(), 7);
  });
});

describe('WritingSession - reset', () => {
  it('clears all state on reset', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.updateFile('a.md', '你好世界');
    assert.equal(s.getNetIncrease(), 4);
    const summary = s.stop();
    assert.equal(summary.netIncrease, 4);
    assert.equal(s.isActive(), false);
    s.start();
    assert.equal(s.getNetIncrease(), 0);
    assert.equal(s.isActive(), true);
  });
});

describe('WritingSession - stop summary', () => {
  it('returns summary with elapsed and net increase', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.updateFile('a.md', 'hello world 你好');
    const summary = s.stop();
    assert.equal(summary.netIncrease, 4);
    assert.ok(summary.elapsedMs >= 0);
    assert.equal(typeof summary.elapsed, 'string');
    assert.equal(summary.unit, '字');
  });

  it('uses character unit when mode is character', () => {
    const s = new WritingSession({ mode: 'character' });
    s.start();
    s.updateFile('a.md', 'hello');
    const summary = s.stop();
    assert.equal(summary.netIncrease, 5);
    assert.equal(summary.unit, '字符');
  });
});

describe('WritingSession - elapsed excludes paused time', () => {
  it('does not count paused duration', async () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.updateFile('a.md', 'test');
    s.pause();
    await new Promise(r => setTimeout(r, 100));
    s.resume();
    const elapsed = s.getElapsedMs();
    assert.ok(elapsed < 80, `elapsed should exclude paused time, got ${elapsed}ms`);
  });
});

describe('WritingSession - baseline from setBaseline', () => {
  it('uses provided baseline for existing file content', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 100);
    const content116 = '一'.repeat(116);
    s.updateFile('a.md', content116);
    const net = s.getNetIncrease();
    assert.equal(net, 16);
  });
});
