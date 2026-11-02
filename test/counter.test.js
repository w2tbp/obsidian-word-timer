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
    s.setBaseline('a.md', 0);
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
  it('tracks updates during pause and adjusts baseline on resume', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0);
    s.updateFile('a.md', '你好世界');
    assert.equal(s.getNetIncrease(), 4);

    s.pause();
    assert.equal(s.isPaused(), true);
    s.updateFile('a.md', '你好世界很多很多字');
    assert.equal(s.getNetIncrease(), 4);

    s.resume();
    assert.equal(s.isPaused(), false);
    assert.equal(s.getNetIncrease(), 4);

    s.updateFile('a.md', '你好世界很多很多字新');
    assert.equal(s.getNetIncrease(), 5);
  });
});

describe('WritingSession - cross-file accumulation', () => {
  it('sums net increase across multiple files', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0);
    s.setBaseline('b.md', 0);
    s.setBaseline('c.md', 0);
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
    s.setBaseline('a.md', 0);
    s.setBaseline('b.md', 0);
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
    s.setBaseline('a.md', 0);
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
    s.setBaseline('a.md', 0);
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
    s.setBaseline('a.md', 0);
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
    s.setBaseline('a.md', 0);
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

describe('Bug A - first-seen file baseline', () => {
  it('does not count existing content when switching to a file', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('start.md', 0);
    const existingContent = '已有内容'.repeat(100);
    s.updateFile('other.md', existingContent);
    assert.equal(s.getNetIncrease(), 0);
  });

  it('counts new content typed after first seeing a file', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('start.md', 0);
    s.updateFile('other.md', '已有内容'.repeat(100));
    assert.equal(s.getNetIncrease(), 0);
    s.updateFile('other.md', '已有内容'.repeat(100) + '新字');
    assert.equal(s.getNetIncrease(), 2);
  });

  it('handles multiple files switched to during session', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0);
    s.updateFile('a.md', '你好');
    assert.equal(s.getNetIncrease(), 2);
    s.updateFile('b.md', 'world test');
    assert.equal(s.getNetIncrease(), 2);
    s.updateFile('c.md', '一二三四五');
    assert.equal(s.getNetIncrease(), 2);
    s.updateFile('a.md', '你好世界');
    assert.equal(s.getNetIncrease(), 4);
  });
});

describe('Bug B - pause does not count towards net increase', () => {
  it('ignores typing during pause after resume', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0);
    s.updateFile('a.md', '字'.repeat(100));
    assert.equal(s.getNetIncrease(), 100);

    s.pause();
    s.updateFile('a.md', '字'.repeat(150));
    assert.equal(s.getNetIncrease(), 100);

    s.resume();
    s.updateFile('a.md', '字'.repeat(150));
    assert.equal(s.getNetIncrease(), 100);
  });

  it('counts new typing after resume', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0);
    s.updateFile('a.md', '字'.repeat(100));
    assert.equal(s.getNetIncrease(), 100);

    s.pause();
    s.updateFile('a.md', '字'.repeat(150));
    s.resume();
    s.updateFile('a.md', '字'.repeat(150));
    assert.equal(s.getNetIncrease(), 100);

    s.updateFile('a.md', '字'.repeat(160));
    assert.equal(s.getNetIncrease(), 110);
  });

  it('handles deletion after resume correctly', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0);
    s.updateFile('a.md', '字'.repeat(100));
    assert.equal(s.getNetIncrease(), 100);

    s.pause();
    s.updateFile('a.md', '字'.repeat(150));
    s.resume();
    s.updateFile('a.md', '字'.repeat(150));
    assert.equal(s.getNetIncrease(), 100);

    s.updateFile('a.md', '字'.repeat(120));
    assert.equal(s.getNetIncrease(), 70);
  });

  it('handles multiple pause-resume cycles', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0);
    s.updateFile('a.md', '字'.repeat(50));
    assert.equal(s.getNetIncrease(), 50);

    s.pause();
    s.updateFile('a.md', '字'.repeat(80));
    s.resume();
    s.updateFile('a.md', '字'.repeat(80));
    assert.equal(s.getNetIncrease(), 50);

    s.updateFile('a.md', '字'.repeat(100));
    assert.equal(s.getNetIncrease(), 70);

    s.pause();
    s.updateFile('a.md', '字'.repeat(120));
    s.resume();
    s.updateFile('a.md', '字'.repeat(120));
    assert.equal(s.getNetIncrease(), 70);
  });
});

describe('Bug C - mode switch recalculates baseline', () => {
  it('resets net to 0 when switching from word to character mode', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0, '');
    s.updateFile('a.md', 'hello world');
    assert.equal(s.getNetIncrease(), 2);

    s.setMode('character');
    assert.equal(s.getNetIncrease(), 0);
  });

  it('counts new content after mode switch', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0, '');
    s.updateFile('a.md', 'hello world');
    assert.equal(s.getNetIncrease(), 2);

    s.setMode('character');
    assert.equal(s.getNetIncrease(), 0);

    s.updateFile('a.md', 'hello world!');
    assert.equal(s.getNetIncrease(), 1);
  });

  it('switches back and forth without negative net', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setBaseline('a.md', 0, '');
    s.updateFile('a.md', '你好世界');
    assert.equal(s.getNetIncrease(), 4);

    s.setMode('character');
    assert.equal(s.getNetIncrease(), 0);

    s.updateFile('a.md', '你好世界！');
    assert.equal(s.getNetIncrease(), 1);

    s.setMode('word');
    assert.equal(s.getNetIncrease(), 0);
  });

  it('handles mode switch with no files', () => {
    const s = new WritingSession({ mode: 'word' });
    s.start();
    s.setMode('character');
    assert.equal(s.getNetIncrease(), 0);
    assert.equal(s.mode, 'character');
  });
});
