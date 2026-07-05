import { ChildProcess, spawn, SpawnOptions } from "child_process";
import { DevEcoCodeProcess } from "./DevEcoCodeProcess";

export class WindowsProcess implements DevEcoCodeProcess {
  private static currentProcess: ChildProcess | null = null;
  private static cleanupHandlerRegistered = false;

  start(
    command: string,
    args: string[],
    options: SpawnOptions
  ): ChildProcess {
    const proc = spawn(command, args, {
      ...options,
      shell: true,
      windowsHide: true,
    });

    WindowsProcess.currentProcess = proc;
    WindowsProcess.registerCleanupHandler();

    return proc;
  }

  async stop(proc: ChildProcess): Promise<void> {
    const pid = proc.pid;
    if (!pid) {
      WindowsProcess.currentProcess = null;
      return;
    }

    console.log("[DevEco Code] Stopping server process tree, PID:", pid);

    try {
      const { execSync } = require("child_process");
      const output = execSync(
        `powershell -Command "Get-CimInstance Win32_Process -Filter \\"ParentProcessId=${pid}\\" | Select-Object ProcessId"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      );

      const lines = output.split("\n").slice(3);
      for (const line of lines) {
        const childPid = line.trim();
        if (childPid && !isNaN(parseInt(childPid))) {
          try {
            execSync(`taskkill /F /PID ${childPid}`, { stdio: "ignore" });
          } catch {
            // Child may already be gone
          }
        }
      }
    } catch {
      // PowerShell lookup failed, continue to other methods
    }

    try {
      await this.execAsync(`taskkill /F /PID ${pid}`);
    } catch {
      // Parent may already be gone
    }

    WindowsProcess.currentProcess = null;

    await this.waitForExit(proc, 5000);
  }

  private static registerCleanupHandler(): void {
    if (WindowsProcess.cleanupHandlerRegistered) {
      return;
    }

    if (typeof window !== "undefined" && !process.env.CI) {
      window.addEventListener("beforeunload", () => {
        if (WindowsProcess.currentProcess?.pid) {
          WindowsProcess.killProcessSync(WindowsProcess.currentProcess.pid);
        }
      });
      WindowsProcess.cleanupHandlerRegistered = true;
    }
  }

  private static killProcessSync(pid: number): void {
    try {
      const { execSync } = require("child_process");

      try {
        const output = execSync(
          `powershell -Command "Get-CimInstance Win32_Process -Filter \\"ParentProcessId=${pid}\\" | Select-Object ProcessId"`,
          { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
        );

        const lines = output.split("\n").slice(3);
        for (const line of lines) {
          const childPid = line.trim();
          if (childPid && !isNaN(parseInt(childPid))) {
            try {
              execSync(`taskkill /F /PID ${childPid}`, { stdio: "ignore" });
            } catch {
              // Child may already be gone
            }
          }
        }
      } catch {
        // PowerShell lookup failed
      }

      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      } catch {
        // Parent may already be gone
      }
    } catch {
      // Process may already be gone
    }
  }

  async verifyCommand(command: string): Promise<string | null> {
    try {
      await this.execAsync(`where "${command}"`);
      return null;
    } catch {
      return `Executable not found at '${command}'. Check Settings → DevEco Code path, or click "Autodetect"`;
    }
  }

  private async waitForExit(
    proc: ChildProcess,
    timeoutMs: number
  ): Promise<void> {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      return;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);

      const onExit = () => {
        cleanup();
        resolve();
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

  private execAsync(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { exec } = require("child_process");
      exec(command, (error: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
