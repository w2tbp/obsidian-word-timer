'use strict';

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
const WORD_RE = /[A-Za-z0-9]+/g;

function countWords(text) {
  if (typeof text !== 'string') return 0;
  let count = 0;
  const cjk = text.match(CJK_RE);
  if (cjk) count += cjk.length;
  const stripped = text.replace(CJK_RE, ' ');
  const words = stripped.match(WORD_RE);
  if (words) count += words.length;
  return count;
}

function countCharacters(text) {
  return typeof text === 'string' ? text.length : 0;
}

function countText(text, mode) {
  return mode === 'character' ? countCharacters(text) : countWords(text);
}

class WritingSession {
  constructor(opts) {
    this.mode = (opts && opts.mode) || 'word';
    this.showWpm = opts && typeof opts.showWpm === 'boolean' ? opts.showWpm : true;
    this.reset();
  }

  reset() {
    this.active = false;
    this.paused = false;
    this.startTime = 0;
    this.pauseStart = 0;
    this.totalPausedMs = 0;
    this.baselines = Object.create(null);
    this.currentCounts = Object.create(null);
    this.currentTexts = Object.create(null);
    this.pauseCounts = Object.create(null);
    this.lastNet = 0;
  }

  start() {
    this.reset();
    this.active = true;
    this.startTime = Date.now();
  }

  pause() {
    if (this.active && !this.paused) {
      this.paused = true;
      this.pauseStart = Date.now();
      this.lastNet = this._computeNet();
      this.pauseCounts = Object.assign(Object.create(null), this.currentCounts);
    }
  }

  resume() {
    if (this.active && this.paused) {
      this.paused = false;
      this.totalPausedMs += Date.now() - this.pauseStart;
      this.pauseStart = 0;
      for (const file in this.currentCounts) {
        if (file in this.pauseCounts) {
          this.baselines[file] += this.currentCounts[file] - this.pauseCounts[file];
        } else {
          this.baselines[file] = this.currentCounts[file];
        }
      }
      this.pauseCounts = Object.create(null);
    }
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  isActive() { return this.active; }
  isPaused() { return this.paused; }

  updateFile(filePath, text) {
    if (!this.active) return;
    const n = countText(text, this.mode);
    this.currentCounts[filePath] = n;
    this.currentTexts[filePath] = text;
    if (!(filePath in this.baselines)) {
      if (!this.paused) {
        this.baselines[filePath] = n;
      }
    }
  }

  setBaseline(filePath, count, text) {
    this.baselines[filePath] = count;
    if (!(filePath in this.currentCounts)) {
      this.currentCounts[filePath] = count;
    }
    if (text !== undefined) {
      this.currentTexts[filePath] = text;
    }
  }

  setMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    for (const file in this.currentTexts) {
      const newCount = countText(this.currentTexts[file], newMode);
      this.currentCounts[file] = newCount;
      this.baselines[file] = newCount;
    }
  }

  _computeNet() {
    let total = 0;
    for (const file in this.currentCounts) {
      const base = this.baselines[file] || 0;
      const cur = this.currentCounts[file] || 0;
      const diff = cur - base;
      if (diff > 0) total += diff;
    }
    return total;
  }

  getNetIncrease() {
    if (this.paused) return this.lastNet;
    this.lastNet = this._computeNet();
    return this.lastNet;
  }

  getElapsedMs() {
    if (!this.active) return 0;
    const now = this.paused ? this.pauseStart : Date.now();
    return now - this.startTime - this.totalPausedMs;
  }

  getWpm() {
    const ms = this.getElapsedMs();
    if (ms <= 0) return 0;
    const minutes = ms / 60000;
    if (minutes < 0.05) return 0;
    return Math.round(this.getNetIncrease() / minutes);
  }

  formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  getStatusText() {
    const elapsed = this.formatDuration(this.getElapsedMs());
    const net = this.getNetIncrease();
    const unit = this.mode === 'character' ? '字符' : '字';
    let text = `⏱ 用时 ${elapsed} · 净增 ${net} ${unit}`;
    if (this.showWpm) {
      text += ` · ${this.getWpm()} ${unit}/分`;
    }
    if (this.paused) text = `⏸ ${text}（已暂停）`;
    return text;
  }

  stop() {
    if (!this.active) return null;
    const summary = {
      elapsedMs: this.getElapsedMs(),
      elapsed: this.formatDuration(this.getElapsedMs()),
      netIncrease: this.getNetIncrease(),
      wpm: this.getWpm(),
      mode: this.mode,
      unit: this.mode === 'character' ? '字符' : '字'
    };
    this.active = false;
    this.paused = false;
    return summary;
  }
}

module.exports = {
  countWords,
  countCharacters,
  countText,
  WritingSession
};
