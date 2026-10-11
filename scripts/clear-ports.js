import { execSync } from 'node:child_process';

const ports = [4173, 4174, 8787];

function run(command) {
  try {
    execSync(command, { stdio: 'ignore' });
  } catch {
    // Ignore failing cleanup commands for ports that are not in use.
  }
}

for (const port of ports) {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    try {
      const output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const listenerPattern = new RegExp(`^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, 'i');
      const pids = [...new Set(output
        .split(/\r?\n/)
        .map((line) => line.match(listenerPattern)?.[1])
        .filter(Boolean))];
      for (const pid of pids) {
        if (pid === '0') continue;
        run(`cmd.exe /c taskkill /PID ${pid} /F`);
      }
    } catch {
      // No process found on this port.
    }
  } else {
    try {
      const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
      const pids = output.split(/\s+/).filter(Boolean);
      for (const pid of pids) {
        if (/^\d+$/.test(pid) && pid !== '0') run(`kill ${pid}`);
      }
    } catch {
      // No process found on this port.
    }
  }
}
