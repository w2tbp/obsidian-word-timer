'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const DIST_MAIN = path.resolve(__dirname, '..', 'dist', 'main.js');

describe('dist bundle', () => {
  before(() => {
    if (!fs.existsSync(DIST_MAIN)) {
      throw new Error('dist/main.js not found — run `node build.js` before tests');
    }
  });

  it('does not contain require(\'./lib/counter\')', () => {
    const src = fs.readFileSync(DIST_MAIN, 'utf8');
    assert.ok(
      !src.includes("require('./lib/counter')") && !src.includes('require("./lib/counter")'),
      'bundled main.js must not reference ./lib/counter'
    );
  });

  it('still requires obsidian (external)', () => {
    const src = fs.readFileSync(DIST_MAIN, 'utf8');
    assert.match(src, /require\(\s*['"]obsidian['"]\s*\)/, 'must keep require("obsidian")');
  });

  it('exports a constructible class when obsidian is stubbed', () => {
    const stubPath = 'obsidian-stub-bundle-test';
    class FakePlugin {
      addStatusBarItem() { return { setText() {}, addClass() {} }; }
      addRibbonIcon() { return null; }
      addCommand() {}
      registerEvent() {}
      registerInterval(x) { return x; }
      addSettingTab() {}
      loadData() { return Promise.resolve(null); }
      saveData() { return Promise.resolve(); }
    }
    class FakeNotice {}
    class FakePluginSettingTab {}
    class FakeSetting {
      setName() { return this; }
      setDesc() { return this; }
      addDropdown() { return this; }
      addToggle() { return this; }
    }
    class FakeMarkdownView {}

    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function (request, ...rest) {
      if (request === 'obsidian') return stubPath;
      return origResolve.call(this, request, ...rest);
    };
    require.cache[stubPath] = {
      id: stubPath,
      filename: stubPath,
      loaded: true,
      exports: {
        Plugin: FakePlugin,
        Notice: FakeNotice,
        PluginSettingTab: FakePluginSettingTab,
        Setting: FakeSetting,
        MarkdownView: FakeMarkdownView
      }
    };

    try {
      delete require.cache[DIST_MAIN];
      const PluginClass = require(DIST_MAIN);
      assert.equal(typeof PluginClass, 'function', 'module export must be a class/function');

      const instance = new PluginClass({ workspace: { on() { return null; }, getActiveFile() { return null; }, getActiveViewOfType() { return null; } } }, null);
      assert.ok(instance instanceof FakePlugin, 'instance must extend stubbed Plugin');
      assert.equal(typeof instance.onload, 'function');
      assert.equal(typeof instance.onunload, 'function');
      assert.equal(typeof instance.startSession, 'function');
    } finally {
      Module._resolveFilename = origResolve;
      delete require.cache[stubPath];
      delete require.cache[DIST_MAIN];
    }
  });

  it('contains the inlined WritingSession implementation', () => {
    const src = fs.readFileSync(DIST_MAIN, 'utf8');
    assert.match(src, /class WritingSession/, 'counter class must be inlined');
    assert.match(src, /function countWords/, 'counter helpers must be inlined');
  });
});
