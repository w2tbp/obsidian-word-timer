'use strict';

const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');
const { WritingSession } = require('./lib/counter');

const DEFAULT_SETTINGS = {
  mode: 'word',
  showWpm: true
};

module.exports = class WordTimerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    
    this.session = new WritingSession({
      mode: this.settings.mode,
      showWpm: this.settings.showWpm
    });
    
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('⏱ 写作计时器');
    this.statusBarItem.addClass('word-timer-status-bar');
    
    this.updateInterval = null;
    
    this.addCommand({
      id: 'start-writing-timer',
      name: '开始写作计时',
      callback: () => this.startSession()
    });
    
    this.addCommand({
      id: 'pause-resume-writing-timer',
      name: '暂停/继续写作计时',
      callback: () => this.togglePause()
    });
    
    this.addCommand({
      id: 'stop-writing-timer',
      name: '结束写作计时',
      callback: () => this.stopSession()
    });
    
    this.ribbonIcon = this.addRibbonIcon('clock', '写作计时器', () => {
      if (this.session.isActive()) {
        this.stopSession();
      } else {
        this.startSession();
      }
    });
    
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor, info) => {
        if (!this.session.isActive() || this.session.isPaused()) return;
        const file = info.file;
        if (file) {
          this.session.updateFile(file.path, editor.getValue());
        }
      })
    );
    
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!this.session.isActive() || this.session.isPaused()) return;
        if (leaf && leaf.view && leaf.view.file) {
          const file = leaf.view.file;
          const editor = leaf.view.editor;
          if (file && editor) {
            this.session.updateFile(file.path, editor.getValue());
          }
        }
      })
    );
    
    this.addSettingTab(new WordTimerSettingTab(this.app, this));
  }
  
  onunload() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.session.isActive()) {
      this.session.stop();
    }
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  startSession() {
    if (this.session.isActive()) {
      new Notice('写作计时已在运行中');
      return;
    }
    
    this.session = new WritingSession({
      mode: this.settings.mode,
      showWpm: this.settings.showWpm
    });
    this.session.start();
    
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      const editor = this.app.workspace.getActiveViewOfType(require('obsidian').MarkdownView);
      if (editor && editor.editor) {
        this.session.setBaseline(activeFile.path, 
          require('./lib/counter').countText(editor.editor.getValue(), this.settings.mode));
      }
    }
    
    this.updateStatusBar();
    this.updateInterval = setInterval(() => {
      this.updateStatusBar();
    }, 1000);
    
    new Notice('✍️ 写作计时开始');
  }
  
  togglePause() {
    if (!this.session.isActive()) {
      new Notice('没有正在进行的计时');
      return;
    }
    
    this.session.togglePause();
    
    if (this.session.isPaused()) {
      new Notice('⏸ 写作计时已暂停');
    } else {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        const editor = this.app.workspace.getActiveViewOfType(require('obsidian').MarkdownView);
        if (editor && editor.editor) {
          this.session.updateFile(activeFile.path, editor.editor.getValue());
        }
      }
      new Notice('▶ 写作计时继续');
    }
    
    this.updateStatusBar();
  }
  
  stopSession() {
    if (!this.session.isActive()) {
      new Notice('没有正在进行的计时');
      return;
    }
    
    const summary = this.session.stop();
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.statusBarItem.setText('⏱ 写作计时器');
    
    new Notice(
      `📊 写作汇总\n` +
      `用时：${summary.elapsed}\n` +
      `净增：${summary.netIncrease} ${summary.unit}\n` +
      `速度：${summary.wpm} ${summary.unit}/分`
    );
  }
  
  updateStatusBar() {
    if (this.session.isActive()) {
      this.statusBarItem.setText(this.session.getStatusText());
    }
  }
};

class WordTimerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: '写作字数计时器设置' });
    
    new Setting(containerEl)
      .setName('统计口径')
      .setDesc('选择字数统计的方式')
      .addDropdown(dropdown => dropdown
        .addOption('word', '字数（中文按字，英文按词）')
        .addOption('character', '字符数（含标点空格）')
        .setValue(this.plugin.settings.mode)
        .onChange(async (value) => {
          this.plugin.settings.mode = value;
          await this.plugin.saveSettings();
          if (this.plugin.session.isActive()) {
            this.plugin.session.mode = value;
          }
        }));
    
    new Setting(containerEl)
      .setName('显示每分钟字数')
      .setDesc('在状态栏显示每分钟输入字数')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showWpm)
        .onChange(async (value) => {
          this.plugin.settings.showWpm = value;
          await this.plugin.saveSettings();
          if (this.plugin.session.isActive()) {
            this.plugin.session.showWpm = value;
          }
        }));
  }
}
