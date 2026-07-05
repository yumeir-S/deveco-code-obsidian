import { existsSync } from "fs";
import { homedir, platform } from "os";
import { join, basename, isAbsolute } from "path";
import { execSync } from "child_process";

export class ExecutableResolver {
  static resolve(configuredPath: string): string {
    if (isAbsolute(configuredPath) && existsSync(configuredPath)) {
      return configuredPath;
    }

    const execName = basename(configuredPath) || configuredPath;
    const searchDirs = this.getSearchDirectories();

    for (const dir of searchDirs) {
      const fullPath = join(dir, execName);
      if (existsSync(fullPath)) {
        console.log("[DevEco Code] Found executable at:", fullPath);
        return fullPath;
      }
    }

    console.log("[DevEco Code] Executable not found in common paths, using configured:", configuredPath);
    return configuredPath;
  }

  static resolveFromPath(execName: string): string | null {
    try {
      const command = platform() === "win32" ? "where" : "which";
      const result = execSync(`${command} "${execName}"`, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
      const path = result.trim().split("\n")[0];
      if (path && existsSync(path)) {
        return path;
      }
    } catch {
      // Command not found in PATH
    }
    return null;
  }

  private static getSearchDirectories(): string[] {
    const currentPlatform = platform();
    const homeDir = homedir();
    const searchDirs: string[] = [];

    if (currentPlatform === "linux" || currentPlatform === "darwin") {
      searchDirs.push(
        join(homeDir, ".local", "bin"),
        join(homeDir, ".deveco", "bin"),
        join(homeDir, ".bun", "bin"),
        join(homeDir, ".npm-global", "bin"),
        join(homeDir, ".opencode", "bin")
      );

      const nvmDirs = this.expandNvmDirectories(homeDir);
      searchDirs.push(...nvmDirs);

      searchDirs.push("/usr/local/bin", "/usr/bin");

      if (currentPlatform === "darwin") {
        searchDirs.push("/opt/homebrew/bin");
      }
    } else if (currentPlatform === "win32") {
      const localAppData = process.env.LOCALAPPDATA || join(homeDir, "AppData", "Local");
      const userProfile = process.env.USERPROFILE || homeDir;

      searchDirs.push(
        join(localAppData, "deveco", "bin"),
        join(localAppData, "opencode", "bin"),
        join(userProfile, ".bun", "bin"),
        join(userProfile, ".local", "bin")
      );

      const npmGlobalPath = this.resolveNpmGlobalPath();
      if (npmGlobalPath) {
        searchDirs.push(npmGlobalPath);
      }
    }

    return searchDirs;
  }

  private static expandNvmDirectories(homeDir: string): string[] {
    const nvmBaseDir = join(homeDir, ".nvm", "versions", "node");
    const nvmDirs: string[] = [];

    try {
      if (existsSync(nvmBaseDir)) {
        const { readdirSync } = require("fs");
        const versions = readdirSync(nvmBaseDir, { withFileTypes: true });
        for (const version of versions) {
          if (version.isDirectory()) {
            nvmDirs.push(join(nvmBaseDir, version.name, "bin"));
          }
        }
      }
    } catch {
      // nvm directory doesn't exist or is not accessible
    }

    return nvmDirs;
  }

  private static resolveNpmGlobalPath(): string | null {
    try {
      const result = execSync("npm prefix -g", { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
      const prefix = result.trim();
      if (prefix) {
        return join(prefix, "node_modules", ".bin");
      }
    } catch {
      // npm not available
    }
    return null;
  }
}
