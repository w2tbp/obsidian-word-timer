'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');

const DIST_MAIN = path.resolve(__dirname, '..', 'dist', 'main.js');
const BUILD_SCRIPT = path.resolve(__dirname, '..', 'build.js');

describe('dist bundle', () => {
  before(() => {
    if (!fs.existsSync(DIST_MAIN)) {
      try {
        execFileSync(process.execPath, [BUILD_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err) {
        const stderr = err.stderr ? err.stderr.toString() : '';
        const stdout = err.stdout ? err.stdout.toString() : '';
        assert.fail(
          `auto-build failed (exit ${err.status}).\n` +
          `stdout: ${stdout}\nstderr: ${stderr}`
        );
      }
      assert.ok(fs.existsSync(DIST_MAIN), 'dist/main.js still missing after build');
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
