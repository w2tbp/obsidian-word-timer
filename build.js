'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

const mainPath = path.join(rootDir, 'main.js');
const counterPath = path.join(rootDir, 'lib', 'counter.js');
const manifestPath = path.join(rootDir, 'manifest.json');
const stylesPath = path.join(rootDir, 'styles.css');

for (const p of [mainPath, counterPath, manifestPath, stylesPath]) {
  if (!fs.existsSync(p)) {
    console.error(`missing required file: ${p}`);
    process.exit(1);
  }
}

const mainSrc = fs.readFileSync(mainPath, 'utf8');
const counterSrc = fs.readFileSync(counterPath, 'utf8');

const REQUIRE_PATTERN = /(const\s*\{\s*WritingSession\s*,\s*countText\s*\}\s*=\s*)require\(\s*['"]\.\/lib\/counter['"]\s*\)\s*;/;

const match = mainSrc.match(REQUIRE_PATTERN);
if (!match) {
  console.error('build.js: could not find require(\'./lib/counter\') in main.js — inline target missing.');
  process.exit(1);
}

const counterWrapped =
  `(function() {\n` +
  `  var module = { exports: {} };\n` +
  `  var exports = module.exports;\n` +
  counterSrc.split('\n').map(l => '  ' + l).join('\n') + '\n' +
  `  return module.exports;\n` +
  `})()`;

const bundled = mainSrc.replace(REQUIRE_PATTERN, `$1${counterWrapped};`);

if (bundled.includes("require('./lib/counter')") || bundled.includes('require("./lib/counter")')) {
  console.error('build.js: failed to inline require(\'./lib/counter\') — still present after replacement.');
  process.exit(1);
}

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

fs.writeFileSync(path.join(distDir, 'main.js'), bundled);
fs.copyFileSync(manifestPath, path.join(distDir, 'manifest.json'));
fs.copyFileSync(stylesPath, path.join(distDir, 'styles.css'));

console.log('build: wrote dist/main.js, dist/manifest.json, dist/styles.css');
