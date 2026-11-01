#!/usr/bin/env node
/* 404호 소각로 — 단일 HTML 빌드
   index.html 이 참조하는 로컬 CSS/JS 를 전부 인라인해 dist/incinerator-404.html 하나로 만든다.
   결과 파일은 더블클릭(file://)이나 휴대폰 파일 앱에서 그대로 열 수 있다.
   이미지 에셋(assets/...)은 경로 그대로 두므로, 이미지를 쓰려면 dist 옆에 assets 폴더를 함께 둔다.

   사용법: node tools/build.js                       → dist/incinerator-404.html
          node tools/build.js out.html              → 지정 경로로 출력
          node tools/build.js --fragment out.html   → <html>/<head>/<body> 껍데기를 뺀 조각
                                                      (껍데기를 씌워 주는 호스팅용, 예: Claude 아티팩트) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const outArg = args.filter((a) => !a.startsWith('--'))[0];
const out = path.resolve(ROOT, outArg || 'dist/incinerator-404.html');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// </script> 가 문자열 안에 있어도 HTML 파서가 끊지 않도록
const safeScript = (src) => src.replace(/<\/script/gi, '<\\/script');

let n = 0;
html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g, (_, href) => { n++; return `<style>\n${read(href)}\n</style>`; });
html = html.replace(/<script src="(?!https?:)([^"]+)"><\/script>/g, (_, src) => { n++; return `<script>\n/* ${src} */\n${safeScript(read(src))}\n</script>`; });

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
html = html.replace('<head>', `<head>\n<!-- 빌드: ${stamp} UTC · tools/build.js 로 생성된 파일입니다. 직접 고치지 말고 원본을 고친 뒤 다시 빌드하세요. -->`);

if (fragment) {
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<\/?html[^>]*>\s*/gi, '')
    .replace(/<\/?head>\s*/gi, '')
    .replace(/<\/?body>\s*/gi, '')
    .replace(/<meta charset="utf-8">\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '');
  // 제목을 맨 앞으로
  const t = html.match(/<title>[^<]*<\/title>\s*/);
  if (t) html = t[0] + html.replace(t[0], '');
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`인라인 ${n}개 → ${path.relative(ROOT, out)} (${(html.length / 1024).toFixed(1)} KB)`);
