import "server-only";
import { listDriveFiles, importDrivePdf, disconnectDrive } from "./google-drive";
import type { ConnectorId } from "./registry";
export type FileConnectorAdapter = { list: typeof listDriveFiles; importPdf: typeof importDrivePdf; disconnect: typeof disconnectDrive };
export const connectorAdapters: Record<ConnectorId, FileConnectorAdapter> = { "google-drive": { list: listDriveFiles, importPdf: importDrivePdf, disconnect: disconnectDrive } };
