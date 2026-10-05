import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const staging = new URL('../dist/lambda/', import.meta.url);
const zipPath = new URL('../dist/e-swap-api-cognito.zip', import.meta.url);

await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(new URL('../src/', import.meta.url), new URL('./src/', staging), { recursive: true });
await cp(new URL('../package.json', import.meta.url), new URL('./package.json', staging));
await cp(new URL('../node_modules/', import.meta.url), new URL('./node_modules/', staging), { recursive: true });

const result = spawnSync('zip', ['-qr', zipPath.pathname, '.'], {
  cwd: staging,
  stdio: 'inherit'
});
if (result.error?.code === 'ENOENT') {
  throw new Error('The zip command is required. On Windows, use the included deploy.ps1 script, which uses Compress-Archive.');
}
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Created ${zipPath.pathname}`);
