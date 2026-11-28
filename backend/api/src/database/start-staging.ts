import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, join } from 'node:path';

async function launch() {
  const root = resolve(__dirname, '../../../..');
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production' };
  env.API_PORT = env.PORT || env.API_PORT || '10000';
  env.CORS_ORIGINS ||= env.RENDER_EXTERNAL_URL;
  env.ML_SERVICE_URL = 'http://127.0.0.1:8000';
  if (!env.CORS_ORIGINS) throw new Error('Set CORS_ORIGINS or use the Render-provided external URL');
  const children = new Set<ChildProcess>();
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill('SIGTERM');
    const deadline = setTimeout(() => {
      for (const child of children) child.kill('SIGKILL');
      process.exit(code);
    }, 10000);
    deadline.unref();
    process.exitCode = code;
  }
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop());
  async function run(command: string, args: string[], cwd: string, preparatory = false) {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    children.add(child);
    child.on('error', () => stop(1));
    child.on('exit', code => {
      children.delete(child);
      if (!preparatory && !stopping) stop(code || 1);
    });
    if (preparatory) {
      const [code] = await once(child, 'exit');
      if (code !== 0) { stop(1); throw new Error('Database preparation failed'); }
    }
  }
  await run('node', ['dist/database/prepare-staging.js'], join(root, 'backend/api'), true);
  await run('python', ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--workers', '1'], join(root, 'backend/ml-service'));
  // Restore/validate queued datasets only after Python can receive requests.
  let mlReady = false;
  for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
    try {
      const response = await fetch(`${env.ML_SERVICE_URL}/api/v1/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { mlReady = true; break; }
    } catch { /* Python is still importing its dependencies. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!mlReady || stopping) { stop(1); return; }
  await run('node', ['dist/main.js'], join(root, 'backend/api'));
}
launch().catch(() => { console.error('Staging startup failed; review server configuration.'); process.exitCode = 1; });
