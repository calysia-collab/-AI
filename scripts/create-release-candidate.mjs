import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const verifyPassed = process.argv.includes('--verify-passed');

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function toTimestamp(date = new Date()) {
  return date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  const content = await readFile(path, 'utf8');
  return JSON.parse(content.replace(/^\uFEFF/, ''));
}

async function findLatestPassedStagingReport() {
  const outputsDir = join(root, 'outputs');
  if (!existsSync(outputsDir)) return null;
  const entries = (await readdir(outputsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('staging-validation-'))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const entry of entries) {
    const directory = join(outputsDir, entry);
    const summary = await readJsonIfExists(join(directory, 'summary.json'));
    if (summary?.status === 'passed') {
      return {
        directory,
        name: entry,
        startedAt: summary.startedAt,
        finishedAt: summary.finishedAt,
        status: summary.status,
        checks: summary.checks || {}
      };
    }
  }
  return null;
}

const generatedAt = new Date();
const packageInfo = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const rcName = process.env.SASHA_RC_NAME || `v${packageInfo.version}-rc1`;
const gitStatus = runGit(['status', '--short']);
const dirtyFiles = gitStatus.split(/\r?\n/).filter(Boolean);
const staging = await findLatestPassedStagingReport();
const reportDirectory = join(root, 'outputs', `release-candidate-${toTimestamp(generatedAt)}`);
await mkdir(reportDirectory, { recursive: true });

const externalAcceptance = [
  {
    id: 'managed-postgresql',
    label: 'Managed PostgreSQL migration and dump/restore',
    requiredEvidence: 'postgres:test, phase2:postgres-scale, pg_dump/pg_restore logs'
  },
  {
    id: 'kms-secret-manager',
    label: 'KMS or secret manager key rotation',
    requiredEvidence: 'data:protection:audit output with plaintextValues=0 and oldKeyFiles=0'
  },
  {
    id: 'domain-tls-cookie',
    label: 'Public HTTPS domain and Secure Cookie validation',
    requiredEvidence: 'staging:endpoint output with HTTPS, HSTS, HttpOnly, Secure, SameSite=Strict'
  },
  {
    id: 'clamav',
    label: 'Malware scanning with EICAR rejection',
    requiredEvidence: 'staging:clamav output showing clean and infected paths'
  },
  {
    id: 'ocr-provider',
    label: 'Production OCR provider with deidentified real policy samples',
    requiredEvidence: 'OCR confidence, correction audit, approval, and data retention sign-off'
  },
  {
    id: 'device-signoff',
    label: 'Windows, macOS, iPhone, and Android acceptance',
    requiredEvidence: 'Completed deploy/browser-acceptance.md checklist'
  }
];

const manifest = {
  status: staging && verifyPassed ? 'ready_for_external_staging' : 'blocked',
  rcName,
  generatedAt: generatedAt.toISOString(),
  package: {
    name: packageInfo.name,
    version: packageInfo.version
  },
  git: {
    branch: runGit(['branch', '--show-current']),
    commit: runGit(['rev-parse', 'HEAD']),
    shortCommit: runGit(['rev-parse', '--short', 'HEAD']),
    remote: runGit(['remote', 'get-url', 'origin']),
    dirtyFiles
  },
  localReleaseVerification: {
    command: 'npm run verify:release',
    passed: verifyPassed
  },
  dockerStaging: staging,
  externalAcceptance
};

const checklist = [
  '# 莎莎保險助理工作台 RC 封版包',
  '',
  `- RC 名稱：${manifest.rcName}`,
  `- 產生時間：${manifest.generatedAt}`,
  `- Git 分支：${manifest.git.branch || 'unknown'}`,
  `- Git Commit：${manifest.git.shortCommit || 'unknown'}`,
  `- 本機正式驗證：${verifyPassed ? '已通過' : '尚未確認'}`,
  `- Docker staging：${staging ? `${staging.name} 已通過` : '尚未找到通過報告'}`,
  `- 目前狀態：${manifest.status}`,
  '',
  '## 已完成',
  '',
  '- 階段 0：正式版基礎安全、帳號、資料保護。',
  '- 階段 1：PostgreSQL、備份還原、金鑰輪替、ClamAV、HTTPS staging gate。',
  '- 階段 2：客戶 360、背景匯入、盲索引搜尋、版本化 API。',
  '- 階段 3：OCR 工作流、人工校正、審核通過建立保單。',
  '',
  '## 外部驗收缺口',
  '',
  ...externalAcceptance.map((item) => `- [ ] ${item.label}：${item.requiredEvidence}`),
  '',
  '## 下一步指令',
  '',
  '1. 在真實外部 staging 補齊 deploy/external-staging.env.example 的環境變數。',
  '2. 執行 run-external-staging-acceptance.bat。',
  '3. 依 deploy/browser-acceptance.md 完成手機與電腦實機簽署。',
  '4. 外部驗收全通過後，才開始階段 4 外部資料與通知串接。',
  ''
].join('\n');

await writeFile(join(reportDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(join(reportDirectory, 'checklist.md'), checklist, 'utf8');
await writeFile(join(root, 'outputs', 'latest-release-candidate.json'), `${JSON.stringify({
  reportDirectory,
  rcName: manifest.rcName,
  status: manifest.status,
  generatedAt: manifest.generatedAt
}, null, 2)}\n`, 'utf8');

if (!staging) {
  throw new Error('No passed Docker staging report found under outputs/staging-validation-*.');
}
if (!verifyPassed) {
  throw new Error('Release verification was not marked as passed.');
}

console.log(JSON.stringify({
  status: manifest.status,
  rcName: manifest.rcName,
  reportDirectory,
  stagingReport: staging.name,
  externalAcceptanceItems: externalAcceptance.length
}, null, 2));
