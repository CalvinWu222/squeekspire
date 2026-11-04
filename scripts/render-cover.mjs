/** Render the original local canvas scene with installed Chromium/Edge. No deps or network.
 * Run: node scripts/render-cover.mjs
 * Optional: SQUEEKSPIRE_BROWSER=<path to Chromium-compatible executable>
 * Both PNG exports use their own art direction; the square is not a crop.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const executable = process.env.SQUEEKSPIRE_BROWSER || `${process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`;
const port = Number(process.env.SQUEEKSPIRE_COVER_CDP_PORT || 9351);
const outputDir = resolve('docs/cover');
const profileDir = resolve('.tmp/cover-edge');
const sleep = ms => new Promise(done => setTimeout(done, ms));
let browser, socket, id = 0;
const pending = new Map();
const report = { source: 'docs/cover/scene.html', renderer: 'Headless Edge / Canvas 2D', images: [] };

async function until(check, timeout = 25000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value; } catch { /* Startup polling. */ }
    await sleep(100);
  }
  throw new Error('Timed out waiting for cover renderer');
}
function send(method, params = {}) {
  return new Promise((done, fail) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); fail(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(key, { done, fail, timer });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
try {
  await mkdir(outputDir, { recursive: true });
  await mkdir(profileDir, { recursive: true });
  browser = spawn(executable, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions',
    '--metrics-recording-only', '--no-pings', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => { console.error(error); process.exitCode = 1; });
  const page = await until(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1000) });
    return (await response.json()).find(page => page.type === 'page');
  });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data), call = pending.get(message.id);
    if (!call) return;
    clearTimeout(call.timer); pending.delete(message.id);
    if (message.error) call.fail(new Error(JSON.stringify(message.error))); else call.done(message.result);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [name, width, height, shape] of [['cover-1200x630.png',1200,630,'wide'],['cover-512.png',512,512,'square']]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${pathToFileURL(resolve(outputDir, 'scene.html')).href}?shape=${shape}` });
    await until(() => evaluate('window.__coverReady === true'));
    await evaluate('document.fonts.ready.then(() => true)');
    const dataUrl = await evaluate('document.querySelector("canvas").toDataURL("image/png")');
    const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) throw new Error(`Wrong dimensions for ${name}`);
    await writeFile(resolve(outputDir, name), bytes);
    report.images.push({ file: name, width, height, bytes: bytes.length });
    console.log(`[cover] ${name}: ${width} × ${height}, ${bytes.length} bytes`);
  }
  await writeFile(resolve(outputDir, 'render-report.json'), JSON.stringify(report, null, 2) + '\n');
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close'); } catch { /* Browser may exit before replying. */ }
    socket.close();
  }
  for (const call of pending.values()) clearTimeout(call.timer);
  if (browser && browser.exitCode === null) browser.kill();
}
