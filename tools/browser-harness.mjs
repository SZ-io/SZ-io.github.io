// Serves the site and drives headless Chrome over the DevTools Protocol.
// No dependencies: uses Node's http server and built-in WebSocket (Node 22+).

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TIMEOUT = 5000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const KEYS = {
  Tab: { code: 'Tab', windowsVirtualKeyCode: 9 },
  Enter: { code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Escape: { code: 'Escape', windowsVirtualKeyCode: 27 },
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startServer() {
  const server = createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://local').pathname));
    const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': TYPES['.html'] });
      response.end(await readFile(join(ROOT, '404.html')));
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

class Connection {
  #nextId = 1;
  #pending = new Map();
  #listeners = new Set();

  constructor(socket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const { resolve, reject, method } = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        if (message.error) {
          reject(new Error(`${method}: ${message.error.message}`));
        } else {
          resolve(message.result);
        }
      } else {
        this.#listeners.forEach((listener) => listener(message));
      }
    });
    this.socket = socket;
  }

  send(method, params = {}, sessionId) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  listen(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

class Page {
  // Anything the site must never produce: uncaught errors, CSP violations, logged errors.
  problems = [];
  requests = [];

  constructor(connection, sessionId, contextId) {
    this.connection = connection;
    this.sessionId = sessionId;
    this.contextId = contextId;
    this.stopListening = connection.listen((message) => {
      if (message.sessionId === sessionId) {
        this.#onEvent(message);
      }
    });
  }

  #onEvent({ method, params }) {
    if (method === 'Runtime.exceptionThrown') {
      this.problems.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
      this.problems.push(params.entry.text);
    } else if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      this.problems.push(params.args.map((arg) => arg.value ?? arg.description).join(' '));
    } else if (method === 'Network.requestWillBeSent') {
      this.requests.push(params.request.url);
    } else if (method === 'Page.loadEventFired') {
      this.onLoad?.();
    }
  }

  send(method, params) {
    return this.connection.send(method, params, this.sessionId);
  }

  async goto(url) {
    const loaded = new Promise((resolve) => {
      this.onLoad = resolve;
    });
    await this.send('Page.navigate', { url });
    await loaded;
  }

  async reload() {
    const loaded = new Promise((resolve) => {
      this.onLoad = resolve;
    });
    await this.send('Page.reload');
    await loaded;
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(`${expression}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }
    return result.value;
  }

  async waitFor(expression) {
    const deadline = Date.now() + TIMEOUT;
    while (Date.now() < deadline) {
      if (await this.evaluate(expression)) {
        return;
      }
      await delay(10);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async mouse(type, x, y, extra = {}) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  }

  async #center(selector) {
    const box = await this.evaluate(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    return box;
  }

  async hover(selector) {
    const { x, y } = await this.#center(selector);
    await this.mouse('mouseMoved', x, y);
  }

  async click(selector) {
    const { x, y } = await this.#center(selector);
    await this.mouse('mouseMoved', x, y);
    await this.mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
    await this.mouse('mouseReleased', x, y, { button: 'left', clickCount: 1 });
  }

  async press(key) {
    const definition = KEYS[key];
    await this.send('Input.dispatchKeyEvent', {
      type: definition.text ? 'keyDown' : 'rawKeyDown',
      key,
      ...definition,
    });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, ...definition });
  }

  async screenshot(path) {
    const { writeFile } = await import('node:fs/promises');
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(path, Buffer.from(data, 'base64'));
  }

  async close() {
    this.stopListening();
    await this.connection.send('Target.disposeBrowserContext', { browserContextId: this.contextId });
  }
}

export async function launchBrowser() {
  const chrome =
    process.env.CHROME_PATH ||
    ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
      existsSync,
    );
  if (!chrome) {
    throw new Error('Chrome not found. Set CHROME_PATH.');
  }

  const profile = mkdtempSync(join(tmpdir(), 'site-test-'));
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  const portFile = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 15000;
  while (!existsSync(portFile) || readFileSync(portFile, 'utf8').split('\n').length < 2) {
    if (Date.now() > deadline) {
      child.kill();
      throw new Error('Chrome did not start.');
    }
    await delay(50);
  }

  const [port, path] = readFileSync(portFile, 'utf8').split('\n');
  const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const connection = new Connection(socket);

  return {
    // Each page gets its own browser context, so storage starts empty.
    async newPage({ width = 1280, height = 800, javaScript = true, colorScheme, reducedMotion, blocked, init } = {}) {
      const { browserContextId } = await connection.send('Target.createBrowserContext');
      const { targetId } = await connection.send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await connection.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new Page(connection, sessionId, browserContextId);

      await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map((method) => page.send(method)));
      await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });

      const features = [];
      if (colorScheme) {
        features.push({ name: 'prefers-color-scheme', value: colorScheme });
      }
      if (reducedMotion) {
        features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
      }
      if (features.length > 0) {
        await page.send('Emulation.setEmulatedMedia', { features });
      }
      if (!javaScript) {
        await page.send('Emulation.setScriptExecutionDisabled', { value: true });
      }
      if (blocked) {
        await page.send('Network.setBlockedURLs', { urls: blocked });
      }
      if (init) {
        await page.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
      }
      return page;
    },

    async close() {
      socket.close();
      child.kill();
      await delay(100);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
