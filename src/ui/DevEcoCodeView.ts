import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { DEVECO_CODE_VIEW_TYPE } from "../types";
import { DEVECO_CODE_ICON_NAME } from "../icons";
import type DevEcoCodePlugin from "../main";
import type { ServerState } from "../server/types";

export class DevEcoCodeView extends ItemView {
  plugin: DevEcoCodePlugin;
  private iframeEl: HTMLIFrameElement | null = null;
  private currentState: ServerState = "stopped";
  private unsubscribeStateChange: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DevEcoCodePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return DEVECO_CODE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "DevEco Code";
  }

  getIcon(): string {
    return DEVECO_CODE_ICON_NAME;
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("deveco-code-container");

    this.unsubscribeStateChange = this.plugin.onServerStateChange((state: ServerState) => {
      this.currentState = state;
      this.updateView();
    });

    this.currentState = this.plugin.getServerState();
    this.updateView();

    if (this.currentState === "stopped") {
      this.plugin.startServer();
    }
  }

  async onClose(): Promise<void> {
    if (this.unsubscribeStateChange) {
      this.unsubscribeStateChange();
      this.unsubscribeStateChange = null;
    }

    if (this.iframeEl) {
      const iframeUrl = this.iframeEl.src;
      if (iframeUrl.includes("/session/")) {
        this.plugin.setCachedIframeUrl(iframeUrl);
      }
      this.iframeEl.src = "about:blank";
      this.iframeEl = null;
    }
  }

  private updateView(): void {
    switch (this.currentState) {
      case "stopped":
        this.renderStoppedState();
        break;
      case "starting":
        this.renderStartingState();
        break;
      case "running":
        this.renderRunningState();
        break;
      case "error":
        this.renderErrorState();
        break;
    }
  }

  private renderStoppedState(): void {
    this.contentEl.empty();

    const statusContainer = this.contentEl.createDiv({
      cls: "deveco-code-status-container",
    });

    const iconEl = statusContainer.createDiv({ cls: "deveco-code-status-icon" });
    setIcon(iconEl, "power-off");

    statusContainer.createEl("h3", { text: "DevEco Code is stopped" });
    statusContainer.createEl("p", {
      text: "Click the button below to start the DevEco Code server.",
      cls: "deveco-code-status-message",
    });

    const startButton = statusContainer.createEl("button", {
      text: "Start DevEco Code",
      cls: "mod-cta",
    });
    startButton.addEventListener("click", () => {
      this.plugin.startServer();
    });
  }

  private renderStartingState(): void {
    this.contentEl.empty();

    const statusContainer = this.contentEl.createDiv({
      cls: "deveco-code-status-container",
    });

    const loadingEl = statusContainer.createDiv({ cls: "deveco-code-loading" });
    loadingEl.createDiv({ cls: "deveco-code-spinner" });

    statusContainer.createEl("h3", { text: "Starting DevEco Code..." });
    statusContainer.createEl("p", {
      text: "Please wait while the server starts up.",
      cls: "deveco-code-status-message",
    });
  }

  private renderRunningState(): void {
    this.contentEl.empty();

    const headerEl = this.contentEl.createDiv({ cls: "deveco-code-header" });

    const titleSection = headerEl.createDiv({ cls: "deveco-code-header-title" });
    const iconEl = titleSection.createSpan();
    setIcon(iconEl, DEVECO_CODE_ICON_NAME);
    titleSection.createSpan({ text: "DevEco Code" });

    const actionsEl = headerEl.createDiv({ cls: "deveco-code-header-actions" });

    const reloadButton = actionsEl.createEl("button", {
      attr: { "aria-label": "Reload" },
    });
    setIcon(reloadButton, "refresh-cw");
    reloadButton.addEventListener("click", () => {
      this.reloadIframe();
    });

    const stopButton = actionsEl.createEl("button", {
      attr: { "aria-label": "Stop server" },
    });
    setIcon(stopButton, "square");
    stopButton.addEventListener("click", () => {
      this.plugin.stopServer();
    });

    const iframeContainer = this.contentEl.createDiv({
      cls: "deveco-code-iframe-container",
    });

    const iframeUrl = this.plugin.getStoredIframeUrl() ?? this.plugin.getServerUrl();
    console.log("[DevEco Code] Loading iframe with URL:", iframeUrl);

    this.iframeEl = iframeContainer.createEl("iframe", {
      cls: "deveco-code-iframe",
      attr: {
        src: iframeUrl,
        frameborder: "0",
        allow: "clipboard-read; clipboard-write",
      },
    });

    this.iframeEl.addEventListener("error", () => {
      console.error("Failed to load DevEco Code iframe");
    });

    this.iframeEl.addEventListener("focus", () => {
      this.plugin.refreshContextForView(this);
    });

    this.iframeEl.addEventListener("pointerdown", () => {
      this.plugin.refreshContextForView(this);
    });

    void this.plugin.ensureSessionUrl(this);
  }

  getIframeUrl(): string | null {
    return this.iframeEl?.src ?? null;
  }

  setIframeUrl(url: string): void {
    if (this.iframeEl && this.iframeEl.src !== url) {
      this.iframeEl.src = url;
    }
  }

  private renderErrorState(): void {
    this.contentEl.empty();

    const statusContainer = this.contentEl.createDiv({
      cls: "deveco-code-status-container deveco-code-error",
    });

    const iconEl = statusContainer.createDiv({ cls: "deveco-code-status-icon" });
    setIcon(iconEl, "alert-circle");

    statusContainer.createEl("h3", { text: "Failed to start DevEco Code" });

    const errorMessage = this.plugin.getLastError();
    if (errorMessage) {
      statusContainer.createEl("p", {
        text: errorMessage,
        cls: "deveco-code-status-message deveco-code-error-message",
      });
    } else {
      statusContainer.createEl("p", {
        text: "There was an error starting the DevEco Code server.",
        cls: "deveco-code-status-message",
      });
    }

    const buttonContainer = statusContainer.createDiv({
      cls: "deveco-code-button-group",
    });

    const retryButton = buttonContainer.createEl("button", {
      text: "Retry",
      cls: "mod-cta",
    });
    retryButton.addEventListener("click", () => {
      this.plugin.startServer();
    });

    const settingsButton = buttonContainer.createEl("button", {
      text: "Open Settings",
    });
    settingsButton.addEventListener("click", () => {
      (this.app as any).setting.open();
      (this.app as any).setting.openTabById("deveco-code-obsidian");
    });
  }

  private reloadIframe(): void {
    if (this.iframeEl) {
      const src = this.iframeEl.src;
      this.iframeEl.src = "about:blank";
      setTimeout(() => {
        if (this.iframeEl) {
          this.iframeEl.src = src;
        }
      }, 100);
    }
  }
}
