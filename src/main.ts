import { Plugin, WorkspaceLeaf, Notice, EventRef, MarkdownView } from "obsidian";
import { DevEcoCodeSettings, DEFAULT_SETTINGS, DEVECO_CODE_VIEW_TYPE } from "./types";
import { DevEcoCodeView } from "./ui/DevEcoCodeView";
import { ViewManager } from "./ui/ViewManager";
import { DevEcoCodeSettingTab } from "./settings/SettingsTab";
import { ServerManager, ServerState } from "./server/ServerManager";
import { registerDevEcoCodeIcons, DEVECO_CODE_ICON_NAME } from "./icons";
import { DevEcoCodeClient } from "./client/DevEcoCodeClient";
import { ContextManager } from "./context/ContextManager";
import { ExecutableResolver } from "./server/ExecutableResolver";

export default class DevEcoCodePlugin extends Plugin {
  settings: DevEcoCodeSettings = DEFAULT_SETTINGS;
  private processManager: ServerManager;
  private stateChangeCallbacks: Array<(state: ServerState) => void> = [];
  private devecoCodeClient: DevEcoCodeClient;
  private contextManager: ContextManager;
  private viewManager: ViewManager;
  private cachedIframeUrl: string | null = null;
  private lastBaseUrl: string | null = null;

  async onload(): Promise<void> {
    console.log("Loading DevEco Code plugin");

    registerDevEcoCodeIcons();

    await this.loadSettings();

    await this.attemptAutodetect();

    const projectDirectory = this.getProjectDirectory();

    this.processManager = new ServerManager(this.settings, projectDirectory);
    this.processManager.on("stateChange", (state: ServerState) => {
      this.notifyStateChange(state);
    });

    this.processManager.on("projectDirectoryChanged", async (newDirectory: string) => {
      this.settings.projectDirectory = newDirectory;
      await this.saveData(this.settings);
      this.refreshClientState();
      if (this.getServerState() === "running") {
        await this.stopServer();
        await this.startServer();
      }
    });

    this.devecoCodeClient = new DevEcoCodeClient(
      this.getApiBaseUrl(),
      this.getServerUrl(),
      projectDirectory
    );
    this.lastBaseUrl = this.getServerUrl();

    this.contextManager = new ContextManager({
      app: this.app,
      settings: this.settings,
      client: this.devecoCodeClient,
      getServerState: () => this.getServerState(),
      getCachedIframeUrl: () => this.cachedIframeUrl,
      setCachedIframeUrl: (url) => {
        this.cachedIframeUrl = url;
      },
      registerEvent: (ref) => this.registerEvent(ref),
    });

    this.viewManager = new ViewManager({
      app: this.app,
      settings: this.settings,
      client: this.devecoCodeClient,
      contextManager: this.contextManager,
      getCachedIframeUrl: () => this.cachedIframeUrl,
      setCachedIframeUrl: (url) => {
        this.cachedIframeUrl = url;
      },
      getServerState: () => this.getServerState(),
    });

    console.log(
      "[DevEco Code] Configured with project directory:",
      projectDirectory
    );

    this.registerView(
      DEVECO_CODE_VIEW_TYPE,
      (leaf) => new DevEcoCodeView(leaf, this)
    );
    this.addSettingTab(new DevEcoCodeSettingTab(
      this.app,
      this,
      this.settings,
      this.processManager,
      () => this.saveSettings()
    ));

    this.addRibbonIcon(DEVECO_CODE_ICON_NAME, "DevEco Code", () => {
      void this.viewManager.activateView();
    });

    this.addCommand({
      id: "toggle-deveco-code-view",
      name: "Toggle DevEco Code panel",
      callback: () => {
        void this.viewManager.toggleView();
      },
      hotkeys: [
        {
          modifiers: ["Mod", "Shift"],
          key: "d",
        },
      ],
    });

    this.addCommand({
      id: "start-deveco-code-server",
      name: "Start DevEco Code server",
      callback: () => {
        this.startServer();
      },
    });

    this.addCommand({
      id: "stop-deveco-code-server",
      name: "Stop DevEco Code server",
      callback: () => {
        this.stopServer();
      },
    });

    if (this.settings.autoStart) {
      this.app.workspace.onLayoutReady(async () => {
        await this.startServer();
      });
    }

    this.contextManager.updateSettings(this.settings);
    this.processManager.on("stateChange", (state: ServerState) => {
      if (state === "running") {
        void this.contextManager.handleServerRunning();
      }
    });

    this.registerCleanupHandlers();

    console.log("DevEco Code plugin loaded");
  }

  async onunload(): Promise<void> {
    this.contextManager.destroy();
    await this.stopServer();
    this.app.workspace.detachLeavesOfType(DEVECO_CODE_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    if (loaded && loaded.opencodePath && !loaded.devecoCodePath) {
      loaded.devecoCodePath = loaded.opencodePath;
      delete loaded.opencodePath;
    }
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }

  private async attemptAutodetect(): Promise<void> {
    if (this.settings.devecoCodePath || this.settings.useCustomCommand) {
      return;
    }

    console.log("[DevEco Code] Attempting to autodetect deveco executable...");

    const detectedPath = ExecutableResolver.resolve("deveco");

    if (detectedPath && detectedPath !== "deveco") {
      console.log("[DevEco Code] Autodetected deveco at:", detectedPath);
      this.settings.devecoCodePath = detectedPath;
      await this.saveData(this.settings);
      new Notice(`DevEco Code executable found at ${detectedPath}`);
    } else {
      console.log("[DevEco Code] Could not autodetect deveco executable");
      new Notice("Could not find deveco. Please check Settings");
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.processManager.updateSettings(this.settings);
    this.refreshClientState();
    this.contextManager.updateSettings(this.settings);
    this.viewManager.updateSettings(this.settings);
  }

  async startServer(): Promise<boolean> {
    const success = await this.processManager.start();
    if (success) {
      new Notice("DevEco Code server started");
      const initialized = await this.devecoCodeClient.initializeProject();
      if (!initialized) {
        console.warn("[DevEco Code] Failed to initialize project on server");
      }
    } else {
      const error = this.processManager.getLastError();
      if (error) {
        new Notice(`DevEco Code failed to start: ${error}`, 10000);
      } else {
        new Notice("DevEco Code failed to start. Check Settings for details.", 5000);
      }
    }
    return success;
  }

  async stopServer(): Promise<void> {
    await this.processManager.stop();
    new Notice("DevEco Code server stopped");
  }

  getServerState(): ServerState {
    return this.processManager.getState() ?? "stopped";
  }

  getLastError(): string | null {
    return this.processManager.getLastError() ?? null;
  }

  getServerUrl(): string {
    return this.processManager.getUrl();
  }

  getApiBaseUrl(): string {
    return `http://${this.settings.hostname}:${this.settings.port}`;
  }

  getStoredIframeUrl(): string | null {
    return this.cachedIframeUrl;
  }

  setCachedIframeUrl(url: string | null): void {
    this.cachedIframeUrl = url;
  }

  onServerStateChange(callback: (state: ServerState) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  private notifyStateChange(state: ServerState): void {
    for (const callback of this.stateChangeCallbacks) {
      callback(state);
    }
  }

  private refreshClientState(): void {
    const nextUiBaseUrl = this.getServerUrl();
    const nextApiBaseUrl = this.getApiBaseUrl();
    const projectDirectory = this.getProjectDirectory();
    this.devecoCodeClient.updateBaseUrl(nextApiBaseUrl, nextUiBaseUrl, projectDirectory);

    if (this.lastBaseUrl && this.lastBaseUrl !== nextUiBaseUrl) {
      this.cachedIframeUrl = null;
    }

    this.lastBaseUrl = nextUiBaseUrl;
  }

  refreshContextForView(view: DevEcoCodeView): void {
    void this.contextManager.refreshContextForView(view);
  }

  async ensureSessionUrl(view: DevEcoCodeView): Promise<void> {
    await this.viewManager.ensureSessionUrl(view);
  }

  getProjectDirectory(): string {
    if (this.settings.projectDirectory) {
      console.log("[DevEco Code] Using project directory from settings:", this.settings.projectDirectory);
      return this.settings.projectDirectory;
    }
    const adapter = this.app.vault.adapter as any;
    const vaultPath = adapter.basePath || "";
    if (!vaultPath) {
      console.warn("[DevEco Code] Warning: Could not determine vault path");
    }
    console.log("[DevEco Code] Using vault path as project directory:", vaultPath);
    return vaultPath;
  }

  private registerCleanupHandlers(): void {
    this.registerEvent(
      this.app.workspace.on("quit", () => {
        console.log("[DevEco Code] Obsidian quitting - performing sync cleanup");
        this.stopServer();
      })
    );
  }
}
