#!/usr/bin/env node
/**
 * 重新生成 README 使用的截图（docs/screenshots/*.png）。
 *
 * 做法：用 Chrome 的调试管道把已构建的扩展真正装进去，打开真实的扩展页面并截图，
 * 页面内容来自本脚本启动的示例文章站点和写入的示例书签，不依赖任何个人数据。
 *
 * 用法：
 *   npm run build:chrome
 *   npm run screenshots
 *
 * 环境变量：
 *   CHROME_PATH  Chrome 可执行文件路径（默认按系统查找）
 *
 * 为什么不用 --load-extension：Chrome 137 起的正式版已忽略该参数，
 * 这里改用 CDP 的 Extensions.loadUnpacked（需要 --remote-debugging-pipe 与
 * --enable-unsafe-extension-debugging）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'dist', 'chrome-mv3');
const outDir = path.join(root, 'docs', 'screenshots');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ARTICLE_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>浏览器扩展的权限模型</title></head><body><article>
<h1>浏览器扩展的权限模型</h1>
<p>浏览器扩展是用 HTML、CSS 和 JavaScript 构建的小程序，运行在浏览器严格管控的沙箱里。权限决定了扩展能做什么，也决定了用户在安装时看到的警告有多长。本段文字刻意写得足够长，以满足正文抽取算法的最小长度要求，让示例剪藏流程可以顺利进行。</p>
<h2>主机权限</h2>
<p>主机权限控制扩展可以读取或修改哪些网站。只在需要时才申请，并且只申请用到的那个站点，可以让安装警告保持简短，也更容易赢得用户的信任。</p>
<pre><code class="language-ts">const granted = await browser.permissions.request({ origins: ['https://example.com/*'] });</code></pre>
<h2>最佳实践</h2>
<ul><li>安装时只声明必需的权限</li><li>在用户点击时申请可选权限</li><li>被拒绝时给出明确的说明</li></ul>
<p>更多细节见 <a href="https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions">官方文档</a>。</p>
</article></body></html>`;

const SEED_BOOKMARKS = [
  ['开发', [
    ['React 官方文档', 'https://react.dev'],
    ['MDN Web Docs', 'https://developer.mozilla.org'],
    ['TypeScript Handbook', 'https://www.typescriptlang.org/docs/'],
    ['Vite 构建工具', 'https://vite.dev'],
    ['Tailwind CSS', 'https://tailwindcss.com'],
    ['WXT 扩展框架', 'https://wxt.dev'],
  ]],
  ['阅读', [
    ['阮一峰的网络日志', 'https://www.ruanyifeng.com/blog/'],
    ['少数派', 'https://sspai.com'],
    ['Hacker News', 'https://news.ycombinator.com'],
  ]],
  ['工具', [
    ['Obsidian', 'https://obsidian.md'],
    ['Excalidraw', 'https://excalidraw.com'],
  ]],
];

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('找不到 Chrome，请通过 CHROME_PATH 指定可执行文件路径');
  return found;
}

function startSiteServer() {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(ARTICLE_HTML);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launch(extensionPath, profile) {
  const child = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const [writer, reader] = [child.stdio[3], child.stdio[4]];
  let nextId = 0;
  const pending = new Map();
  let buffer = '';

  reader.on('data', (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      }
    }
  });

  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)));
    writer.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });

  const { id: extensionId } = await send('Extensions.loadUnpacked', { path: extensionPath });

  async function open(url, { width, height, scale = 2, background = false, locale = 'zh-CN' }) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', background });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const session = (method, params) => send(method, params, sessionId);
    await session('Page.enable');
    await session('Runtime.enable');
    await session('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    await session('Emulation.setLocaleOverride', { locale });
    await session('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 Chrome', acceptLanguage: locale });
    await session('Page.navigate', { url });
    return {
      evaluate: async (expression) => (await session('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value,
      async screenshot(file) {
        const shot = await session('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      },
      close: () => send('Target.closeTarget', { targetId }),
    };
  }

  // 等 Chrome 真正退出后再清理临时目录，否则它还在写 profile，删除会失败
  const quit = () => new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
  });

  return { extensionId, open, quit };
}

// Radix 的标签页在 mousedown 上切换，普通的 click() 不会触发
const clickScript = (pattern, { mouseDown = false } = {}) => `(() => {
  const element = [...document.querySelectorAll('button,a,[role="tab"],[role="button"],div')]
    .filter((node) => ${pattern}.test((node.getAttribute('aria-label') || node.title || node.textContent || '').trim()))
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (!element) return false;
  ${mouseDown ? "element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));" : 'element.click();'}
  return true;
})()`;

async function main() {
  if (!fs.existsSync(path.join(buildDir, 'manifest.json'))) {
    throw new Error('未找到构建产物，请先运行 npm run build:chrome');
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 侧边栏截图需要读取示例文章：在副本里补上主机权限，不改动真实构建产物
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mustard-seed-shots-'));
  const extensionCopy = path.join(workDir, 'extension');
  fs.cpSync(buildDir, extensionCopy, { recursive: true });
  const manifestPath = path.join(extensionCopy, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = ['https://*/*', 'http://*/*'];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const server = await startSiteServer();
  const articleUrl = `http://127.0.0.1:${server.address().port}/article.html`;
  const chrome = await launch(extensionCopy, path.join(workDir, 'profile'));
  const base = `chrome-extension://${chrome.extensionId}`;
  const shot = (name) => path.join(outDir, `${name}.png`);

  try {
    // 前台是示例文章页，扩展页面都用后台标签打开，这样 popup 和侧边栏读到的是这篇文章
    const article = await chrome.open(articleUrl, { width: 1000, height: 700 });
    await sleep(1500);

    const setup = await chrome.open(`${base}/newtab.html`, { width: 1000, height: 700, background: true });
    await sleep(1500);
    await setup.evaluate(`new Promise((resolve) => chrome.storage.local.set({ i18n: 'zh_CN', themeId: 'default', themeMode: 'light' }, () => resolve(true)))`);
    await setup.evaluate(`(async () => {
      const [root] = await chrome.bookmarks.getTree();
      const bar = root.children[0].id;
      for (const [folder, items] of ${JSON.stringify(SEED_BOOKMARKS)}) {
        const created = await chrome.bookmarks.create({ parentId: bar, title: folder });
        for (const [title, url] of items) await chrome.bookmarks.create({ parentId: created.id, title, url });
      }
      return true;
    })()`);

    const popup = await chrome.open(`${base}/popup.html`, { width: 380, height: 520, background: true });
    await sleep(3000);
    await popup.screenshot(shot('popup'));
    await popup.close();
    console.log('popup.png');

    const sidepanel = await chrome.open(`${base}/sidepanel.html`, { width: 420, height: 820, background: true });
    await sleep(5000);
    await sidepanel.evaluate(clickScript('/^(渲染预览|Preview)$/', { mouseDown: true }));
    await sleep(800);
    await sidepanel.screenshot(shot('sidepanel'));
    await sidepanel.close();
    console.log('sidepanel.png');

    // 新标签页要用前台标签：后台标签里浏览器会暂停 CSS 动画，页面的淡入动画永远不会结束，截图会发白
    const newtab = await chrome.open(`${base}/newtab.html`, { width: 1280, height: 760, scale: 1 });
    await sleep(3000);
    await newtab.evaluate(clickScript('/^书签栏/'));
    await sleep(800);
    await newtab.evaluate(clickScript('/^开发/'));
    await sleep(2500); // 等页面的淡入动画结束，否则截图会发白
    await newtab.screenshot(shot('newtab'));
    console.log('newtab.png');

    await newtab.evaluate(clickScript('/^(设置|Settings)$/'));
    await sleep(1000);
    await newtab.evaluate(clickScript('/^Obsidian 剪藏$/'));
    await sleep(2200);
    await newtab.screenshot(shot('settings-obsidian'));
    console.log('settings-obsidian.png');

    await newtab.evaluate(clickScript('/^提示词设置$/'));
    await sleep(800);
    await newtab.evaluate(clickScript('/^剪藏排版$/', { mouseDown: true }));
    await sleep(2200);
    await newtab.screenshot(shot('settings-prompts'));
    console.log('settings-prompts.png');
    await newtab.close();

    await setup.evaluate(`new Promise((resolve) => chrome.storage.local.set({ themeId: 'blueprint', themeMode: 'dark' }, () => resolve(true)))`);
    const blueprint = await chrome.open(`${base}/newtab.html`, { width: 1280, height: 760, scale: 1 });
    await sleep(3000);
    await blueprint.evaluate(clickScript('/^书签栏/'));
    await sleep(800);
    await blueprint.evaluate(clickScript('/^开发/'));
    await sleep(2500);
    await blueprint.screenshot(shot('newtab-blueprint'));
    console.log('newtab-blueprint.png');
    await article.close();
  } finally {
    await chrome.quit();
    server.close();
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
