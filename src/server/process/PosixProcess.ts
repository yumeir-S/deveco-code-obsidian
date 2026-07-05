import { ChildProcess, spawn, SpawnOptions } from "child_process";
import { existsSync } from "fs";
import { DevEcoCodeProcess } from "./DevEcoCodeProcess";

export class PosixProcess implements DevEcoCodeProcess {
  start(
    command: string,
    args: string[],
    options: SpawnOptions
  ): ChildProcess {
    return spawn(command, args, {
      ...options,
      detached: true,
    });
  }

  async stop(proc: ChildProcess): Promise<void> {
    const pid = proc.pid;
    if (!pid) {
      return;
    }

    console.log("[DevEco Code] Stopping server process tree, PID:", pid);

    await this.killProcessGroup(pid, "SIGTERM");
    const gracefulExited = await this.waitForExit(proc, 2000);

    if (gracefulExited) {
      console.log("[DevEco Code] Server stopped gracefully");
      return;
    }

    console.log("[DevEco Code] Process didn't exit gracefully, sending SIGKILL");

    await this.killProcessGroup(pid, "SIGKILL");
    const forceExited = await this.waitForExit(proc, 3000);

    if (forceExited) {
      console.log("[DevEco Code] Server stopped with SIGKILL");
    } else {
      console.error("[DevEco Code] Failed to stop server within timeout");
    }
  }

  async verifyCommand(command: string): Promise<string | null> {
    if (command.startsWith('/') || command.startsWith('./')) {
      const fs = require('fs');
      try {
        fs.accessSync(command, fs.constants.X_OK);
        return null;
      } catch (err: any) {
        if (existsSync(command)) {
          return `'${command}' exists but is not executable. Run: chmod +x ${command}`;
        }
        return `Executable not found at '${command}'. Check Settings → DevEco Code path, or click "Autodetect"`;
      }
    }
    return null;
  }

  private async killProcessGroup(
    pid: number,
    signal: "SIGTERM" | "SIGKILL"
  ): Promise<void> {
    try {
      process.kill(-pid, signal);
    } catch (error) {
      console.log(`[DevEco Code] Signal ${signal} failed (process may already be gone)`);
    }
  }

  private async waitForExit(
    proc: ChildProcess,
    timeoutMs: number
  ): Promise<boolean> {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      return true;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);

      const onExit = () => {
        cleanup();
        resolve(true);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        proc.off("exit", onExit);
        proc.off("error", onExit);
      };

      proc.once("exit", onExit);
      proc.once("error", onExit);
    });
  }
}
