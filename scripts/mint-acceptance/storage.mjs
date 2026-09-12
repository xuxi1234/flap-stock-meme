import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Stop, requireThat, freshJournal, stringify, validateJournal } from './core.mjs';

// One journal per operating-system user, shared across repository copies/branches.
export const stateDirectory = () => path.join(os.homedir(), '.flap-stock-meme', 'mint-acceptance');
export function openStore(directory = stateDirectory()) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lockPath = path.join(directory, 'runner.lock');
  const journalPath = path.join(directory, 'journal.json');
  let lock;
  try { lock = fs.openSync(lockPath, 'wx', 0o600); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    // Never silently remove a lock, including after a crash or on another host.
    throw new Stop(`已有执行锁。确认没有脚本进程运行后，手动删除 ${lockPath} 再续跑；保留 journal.json。`);
  }
  fs.writeFileSync(lock, stringify({ pid: process.pid, host: os.hostname() })); fs.fsyncSync(lock);
  let closed = false;
  const close = () => { if (!closed) { closed = true; fs.closeSync(lock); fs.unlinkSync(lockPath); } };
  const save = journal => {
    validateJournal(journal);
    const temporary = path.join(directory, 'journal.tmp');
    const fd = fs.openSync(temporary, 'w', 0o600);
    try { fs.writeFileSync(fd, stringify(journal) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, journalPath);
    // Persist rename on platforms supporting directory fsync. Windows does not.
    if (process.platform !== 'win32') { const dir = fs.openSync(directory, 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); } }
  };
  try {
    const journal = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : freshJournal();
    validateJournal(journal); return { journal, save, close, journalPath };
  } catch (error) { close(); throw error; }
}

export function hiddenKeyPrompt() {
  requireThat(process.stdin.isTTY && process.stdout.isTTY && process.stdin.setRawMode, '私钥只能在本机交互终端输入；不接受管道、参数、环境变量或文件。');
  return new Promise((resolve, reject) => {
    let input = ''; const previousRaw = process.stdin.isRaw;
    process.stdout.write('输入固定验收钱包的私钥（不显示字符，直接回车提交，Ctrl+C 取消）：');
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(Boolean(previousRaw)); process.stdin.pause(); process.stdout.write('\n'); };
    const onData = data => {
      for (const char of data.toString('utf8')) {
        if (char === '\u0003') { input = ''; cleanup(); reject(new Stop('已取消，未发送新的交易。')); return; }
        if (char === '\r' || char === '\n') { const result = input.trim(); input = ''; cleanup(); resolve(result); return; }
        if (char === '\u007f' || char === '\b') input = input.slice(0, -1);
        else if (input.length < 128 && /[0-9a-fA-Fx]/.test(char)) input += char;
      }
    };
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data', onData);
  });
}
