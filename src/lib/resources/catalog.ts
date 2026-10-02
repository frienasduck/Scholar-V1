import "server-only";
import catalog from "./catalog.json";
import snapshots from "./snapshots.json";
import type { ResourceRecord, Snapshot } from "./types";
export const BUILTIN_RESOURCES = catalog as ResourceRecord[];
export const BUILTIN_SNAPSHOTS = snapshots as Snapshot[];
