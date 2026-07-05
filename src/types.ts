export type ViewLocation = "sidebar" | "main";

export interface DevEcoCodeSettings {
  port: number;
  hostname: string;
  autoStart: boolean;
  devecoCodePath: string;
  projectDirectory: string;
  startupTimeout: number;
  defaultViewLocation: ViewLocation;
  injectWorkspaceContext: boolean;
  maxNotesInContext: number;
  maxSelectionLength: number;
  customCommand: string;
  useCustomCommand: boolean;
}

export const DEFAULT_SETTINGS: DevEcoCodeSettings = {
  port: 14096,
  hostname: "127.0.0.1",
  autoStart: false,
  devecoCodePath: "deveco",
  projectDirectory: "",
  startupTimeout: 45000,
  defaultViewLocation: "sidebar",
  injectWorkspaceContext: false,
  maxNotesInContext: 20,
  maxSelectionLength: 2000,
  customCommand: "",
  useCustomCommand: false,
};

export const DEVECO_CODE_VIEW_TYPE = "deveco-code-view";
