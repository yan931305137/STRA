/**
 * Sandbox Runner
 *
 * Writes generated HTML to a temp file, serves it with a static server,
 * and uses Playwright to automate runtime checks.
 */
import { chromium, type Browser, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import type { Framework, RunnerResult, ConsoleError, BenchmarkConfig } from '../types/index.js';

// ─── Static file server for serving generated HTML ───
class StaticServer {
  private server: http.Server | null = null;
  private port: number = 0;

  async start(directory: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const filePath = path.join(directory, req.url === '/' ? 'index.html' : (req.url || 'index.html'));
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
        };
        const contentType = mimeTypes[ext] || 'text/plain';

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
      });

      this.server.listen(port, () => {
        this.port = port;
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }
}

// ─── Runner ───
export async function runGeneratedCode(
  framework: Framework,
  taskId: string,
  code: string,
  config: BenchmarkConfig
): Promise<RunnerResult> {
  const startedAt = Date.now();
  const consoleErrors: ConsoleError[] = [];
  const consoleWarnings: string[] = [];
  let browser: Browser | null = null;
  let page: Page | null = null;
  let server: StaticServer | null = null;
  const port = 8100 + FRAMEWORK_PORT_OFFSET[framework];

  try {
    // 1. Write generated code to temp file
    const workDir = path.join(config.outputDir, 'sandbox', framework, taskId);
    fs.mkdirSync(workDir, { recursive: true });
    const htmlPath = path.join(workDir, 'index.html');
    fs.writeFileSync(htmlPath, code, 'utf-8');

    // 2. Start static server
    server = new StaticServer();
    await server.start(workDir, port);

    // 3. Launch Playwright
    browser = await chromium.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();

    // Capture console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          message: msg.text(),
          timestamp: Date.now(),
        });
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      });
    });

    // 4. Navigate to the generated page
    const url = `http://localhost:${port}/`;
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: config.timeout,
    });

    const startupTimeMs = Date.now() - startedAt;

    // 5. Take screenshot
    const screenshot = await page.screenshot({ type: 'png' }).catch(() => undefined);

    // 6. Get DOM snapshot
    const domSnapshot = await page.evaluate(() => document.body?.innerHTML || '');

    // 7. Check for white screen
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const noWhiteScreen = bodyText.trim().length > 0 || domSnapshot.length > 100;

    await browser.close();
    await server.stop();

    return {
      framework,
      taskId,
      success: true,
      startedAt,
      finishedAt: Date.now(),
      startupTimeMs,
      consoleErrors,
      consoleWarnings,
      screenshot,
      domSnapshot,
    };
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.stop().catch(() => {});

    return {
      framework,
      taskId,
      success: false,
      startedAt,
      finishedAt: Date.now(),
      startupTimeMs: Date.now() - startedAt,
      consoleErrors,
      consoleWarnings,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run functional tests via Playwright — simulate user interactions
 */
export async function runFunctionalTests(
  framework: Framework,
  taskId: string,
  code: string,
  config: BenchmarkConfig
): Promise<{
  formPresent: boolean;
  buttonPresent: boolean;
  inputFieldsPresent: boolean;
  tabSwitchWorks: boolean;
  formValidationWorks: boolean;
  stateChanges: boolean;
}> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let server: StaticServer | null = null;
  const port = 8200 + FRAMEWORK_PORT_OFFSET[framework];

  const result = {
    formPresent: false,
    buttonPresent: false,
    inputFieldsPresent: false,
    tabSwitchWorks: false,
    formValidationWorks: false,
    stateChanges: false,
  };

  try {
    // Write and serve
    const workDir = path.join(config.outputDir, 'sandbox', framework, taskId + '-func');
    fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(path.join(workDir, 'index.html'), code, 'utf-8');

    server = new StaticServer();
    await server.start(workDir, port);

    browser = await chromium.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();

    await page.goto(`http://localhost:${port}/`, {
      waitUntil: 'networkidle',
      timeout: config.timeout,
    });

    // Wait for dynamic rendering (STRA creates DOM via JS, needs time to render)
    await page.waitForTimeout(1500);

    // Check: form present
    const formCount = await page.locator('form').count();
    const formLikeCount = await page.locator('[role="form"], .form, form, fieldset').count();
    result.formPresent = formCount > 0 || formLikeCount > 0;

    // Check: buttons present
    const buttonCount = await page.locator('button, input[type="submit"], [role="button"]').count();
    result.buttonPresent = buttonCount > 0;

    // Check: input fields present
    const inputCount = await page.locator('input, textarea, select').count();
    result.inputFieldsPresent = inputCount >= 2;

    // Check: tab switch
    try {
      const tabButtons = page.locator(
        '[role="tab"], .tab, [data-tab], button:has-text("Login"), button:has-text("Register"), a:has-text("Login"), a:has-text("Register")'
      );
      const tabCount = await tabButtons.count();
      if (tabCount >= 2) {
        const beforeHTML = await page.evaluate(() => document.body?.innerHTML || '');
        await tabButtons.nth(1).click({ timeout: 3000 });
        await page.waitForTimeout(500);
        const afterHTML = await page.evaluate(() => document.body?.innerHTML || '');
        result.tabSwitchWorks = beforeHTML !== afterHTML;
      }
    } catch {
      result.tabSwitchWorks = false;
    }

    // Check: form validation
    try {
      const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Register")').first();
      if ((await submitBtn.count()) > 0) {
        await submitBtn.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        // Check if error messages appeared
        const errorElements = await page.locator('.error, [role="alert"], .invalid, .warning, [aria-invalid="true"]').count();
        const pageContent = await page.evaluate(() => document.body?.innerText || '');
        const hasValidationText =
          pageContent.includes('required') ||
          pageContent.includes('invalid') ||
          pageContent.includes('empty') ||
          pageContent.includes('请输入') ||
          pageContent.includes('不能为空');
        result.formValidationWorks = errorElements > 0 || hasValidationText;
      }
    } catch {
      result.formValidationWorks = false;
    }

    // Check: state changes on interaction
    try {
      const inputs = page.locator('input[type="text"], input[type="email"], input:not([type])').first();
      if ((await inputs.count()) > 0) {
        const beforeVal = await inputs.inputValue();
        await inputs.fill('test@example.com');
        const afterVal = await inputs.inputValue();
        result.stateChanges = beforeVal !== afterVal;
      }
    } catch {
      result.stateChanges = false;
    }

    await browser.close();
    await server.stop();
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.stop().catch(() => {});
  }

  return result;
}

const FRAMEWORK_PORT_OFFSET: Record<Framework, number> = {
  react: 0,
  vue: 1,
  str: 2,
};
