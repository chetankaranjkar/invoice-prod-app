import express from 'express';
import { spawn } from 'child_process';
import { readFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const invoiceApp = join(root, 'invoice-app');
const testProject = join(root, 'InvoiceApp.Tests');

const app = express();
app.use(express.json());

app.get('/api/run-tests', async (req, res) => {
  const results = {
    backend: null,
    frontend: null,
    timestamp: new Date().toISOString(),
  };

  try {
    // Run .NET tests
    const dotnetResult = await runDotnetTests();
    results.backend = dotnetResult;

    // Run Vitest
    const vitestResult = await runVitestTests();
    results.frontend = vitestResult;
  } catch (err) {
    console.error(err);
  }

  res.json(results);
});

async function runDotnetTests() {
  return new Promise((resolve) => {
    const resultsDir = join(root, 'test-results');
    const trxPath = join(resultsDir, 'dotnet-results.trx');
    mkdirSync(resultsDir, { recursive: true });

    const proc = spawn(
      'dotnet',
      ['test', testProject, '--results-directory', resultsDir, '--logger', 'trx;LogFileName=dotnet-results.trx'],
      { cwd: root, shell: true }
    );

    let stderr = '';
    let stdout = '';
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });

    proc.on('close', (code) => {
      try {
        if (!existsSync(trxPath)) {
          let found = null;
          const walk = (dir) => {
            try {
              for (const e of readdirSync(dir, { withFileTypes: true })) {
                const p = join(dir, e.name);
                if (e.isFile() && e.name.endsWith('.trx')) {
                  found = p;
                  return;
                }
                if (e.isDirectory()) walk(p);
              }
            } catch (_) {}
          };
          walk(resultsDir);
          if (found) {
            const xml = readFileSync(found, 'utf-8');
            resolve(parseTrx(xml));
            return;
          }
          throw new Error('TRX file not found. ' + (stderr || stdout).slice(0, 300));
        }
        const xml = readFileSync(trxPath, 'utf-8');
        resolve(parseTrx(xml));
      } catch (e) {
        resolve({
          name: 'Backend (.NET)',
          total: 0,
          passed: 0,
          failed: code !== 0 ? 1 : 0,
          duration: 0,
          tests: [{ name: 'Dotnet test failed', passed: false, error: (stderr || stdout || String(e)).slice(0, 500) }],
        });
      }
    });
  });
}

function parseTrx(xml) {
  const tests = [];
  const resultRegex = /<UnitTestResult[^>]*testName="([^"]*)"[^>]*outcome="(Passed|Failed)"[^>]*(?:duration="([^"]*)")?[^>]*>/g;
  const durationRegex = /<Times[^>]*creation="[^"]*"[^>]*execution="([^"]*)"/;
  let m;
  while ((m = resultRegex.exec(xml)) !== null) {
    const [, name, outcome, duration] = m;
    const durationMs = duration ? parseDuration(duration) : 0;
    tests.push({
      name: decodeXml(name),
      passed: outcome === 'Passed',
      duration: durationMs,
    });
  }
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;
  let durationMs = 0;
  const dm = xml.match(durationRegex);
  if (dm) durationMs = parseDuration(dm[1]);
  return {
    name: 'Backend (.NET)',
    total: tests.length,
    passed,
    failed,
    duration: durationMs,
    tests,
  };
}

function parseDuration(s) {
  if (!s) return 0;
  const match = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return 0;
  const [, h = 0, m = 0, sec = 0] = match;
  return (parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(sec)) * 1000;
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function runVitestTests() {
  return new Promise((resolve) => {
    const proc = spawn(
      'npx',
      ['vitest', 'run', '--reporter=json'],
      { cwd: invoiceApp, shell: true }
    );

    let stderr = '';
    let stdout = '';
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });

    proc.on('close', () => {
      try {
        let raw = stdout.trim();
        if (!raw) throw new Error('No Vitest output. ' + stderr.slice(0, 200));
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) raw = jsonMatch[0];
        const data = JSON.parse(raw);
        const tests = [];
        const files = data.testResults || data.files || [];
        for (const file of files) {
          const assertions = file.assertionResults || file.tasks || [];
          for (const test of assertions) {
            const status = test.status ?? test.result?.state;
            const passed = status === 'passed' || status === 'pass';
            tests.push({
              name: test.fullName || test.name || test.title || test.task?.name,
              passed,
              duration: test.duration ?? test.result?.duration,
              error: test.failureMessages?.[0] ?? test.result?.error?.message,
              steps: test.ancestorTitles?.length ? test.ancestorTitles : undefined,
            });
          }
        }
        const passed = tests.filter((t) => t.passed).length;
        const failed = tests.filter((t) => !t.passed).length;
        resolve({
          name: 'Frontend (Vitest)',
          total: tests.length,
          passed,
          failed,
          duration: data.startTime && data.endTime ? data.endTime - data.startTime : 0,
          tests,
        });
      } catch (e) {
        resolve({
          name: 'Frontend (Vitest)',
          total: 0,
          passed: 0,
          failed: 1,
          tests: [{ name: 'Vitest failed', passed: false, error: (stderr || String(e)).slice(0, 500) }],
        });
      }
    });
  });
}

const PORT = 5175;
app.listen(PORT, () => {
  console.log(`Test API server running at http://localhost:${PORT}`);
});
