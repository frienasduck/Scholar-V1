export const BRIDGE_VERSION = 1 as const;

export type WebToNativeMessage =
  | { type: "WEB_READY"; version: 1; payload: { url: string } }
  | { type: "UI_STATE"; version: 1; payload: { hasOverlay: boolean } }
  | {
      type: "HAPTIC";
      version: 1;
      payload: { style: "selection" | "success" | "warning" | "error" };
    }
  | {
      type: "OPEN_EXTERNAL_URL";
      version: 1;
      payload: { url: string };
    }
  | {
      type: "SHARE_CONTENT";
      version: 1;
      payload: { title?: string; text: string; url?: string };
    };

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWebToNativeMessage(raw: string): WebToNativeMessage | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(message) || message.version !== BRIDGE_VERSION || typeof message.type !== "string") {
    return null;
  }

  const payload = message.payload;
  if (!isObject(payload)) return null;

  switch (message.type) {
    case "WEB_READY":
      return typeof payload.url === "string"
        ? { type: "WEB_READY", version: 1, payload: { url: payload.url } }
        : null;
    case "UI_STATE":
      return typeof payload.hasOverlay === "boolean"
        ? { type: "UI_STATE", version: 1, payload: { hasOverlay: payload.hasOverlay } }
        : null;
    case "HAPTIC": {
      const allowed = ["selection", "success", "warning", "error"] as const;
      return allowed.includes(payload.style as (typeof allowed)[number])
        ? {
            type: "HAPTIC",
            version: 1,
            payload: { style: payload.style as (typeof allowed)[number] },
          }
        : null;
    }
    case "OPEN_EXTERNAL_URL":
      return typeof payload.url === "string"
        ? { type: "OPEN_EXTERNAL_URL", version: 1, payload: { url: payload.url } }
        : null;
    case "SHARE_CONTENT":
      return typeof payload.text === "string" &&
        (payload.title === undefined || typeof payload.title === "string") &&
        (payload.url === undefined || typeof payload.url === "string")
        ? {
            type: "SHARE_CONTENT",
            version: 1,
            payload: {
              text: payload.text,
              ...(typeof payload.title === "string" ? { title: payload.title } : {}),
              ...(typeof payload.url === "string" ? { url: payload.url } : {}),
            },
          }
        : null;
    default:
      return null;
  }
}

export function createNativeMessage(
  type: "NATIVE_BACK" | "APP_STATE" | "SAFE_AREA",
  payload: JsonObject,
): string {
  return JSON.stringify({ type, version: BRIDGE_VERSION, payload });
}
