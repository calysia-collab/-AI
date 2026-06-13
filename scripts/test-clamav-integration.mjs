import { createClamdScanner } from '../api/attachment-storage.mjs';

const host = String(process.env.SASHA_CLAMD_HOST || '').trim();
if (!host) throw new Error('SASHA_CLAMD_HOST is required.');

const scanner = createClamdScanner({
  host,
  port: Number(process.env.SASHA_CLAMD_PORT || 3310),
  timeoutMs: Number(process.env.SASHA_CLAMD_TIMEOUT_MS || 10_000)
});
const deadline = Date.now() + Number(process.env.SASHA_CLAMD_WAIT_MS || 5 * 60 * 1000);

async function waitForScanner() {
  let result;
  do {
    result = await scanner(Buffer.from('Sasha staging clean scan probe.', 'utf8'));
    if (result.status === 'clean') return result;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  } while (Date.now() < deadline);
  throw new Error(`ClamAV did not become ready: ${result?.detail || 'unknown error'}`);
}

const clean = await waitForScanner();
const eicar = Buffer.from(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  'ascii'
);
const infected = await scanner(eicar);
if (infected.status !== 'infected') {
  throw new Error(`ClamAV did not detect the EICAR test signature: ${infected.detail}`);
}

console.log(JSON.stringify({
  status: 'ok',
  clean,
  infected
}, null, 2));
