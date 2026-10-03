export type ConnectorCapability = "READ_FILES" | "IMPORT_FILES" | "SEARCH";
export const connectorProviders = [{ id: "google-drive", name: "Google Drive", authentication: "oauth2", capabilities: ["READ_FILES", "IMPORT_FILES", "SEARCH"] as ConnectorCapability[], scope: "https://www.googleapis.com/auth/drive.file", supportedTypes: ["application/pdf", "application/vnd.google-apps.document"] }] as const;
export type ConnectorId = typeof connectorProviders[number]["id"];
