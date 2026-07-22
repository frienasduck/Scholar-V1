"use client";

export type MicrophonePermissionState = "prompt" | "granted" | "denied" | "unsupported";

export function microphoneEnvironmentError(): string | null {
  if (typeof window === "undefined") return "Voice input is unavailable here.";
  if (!window.isSecureContext) return "Microphone access requires HTTPS on phones and local-network addresses. Open Scholar from its HTTPS deployment; localhost remains available for desktop development.";
  if (!navigator.mediaDevices?.getUserMedia) return "Microphone access is unavailable in this browser. You can still type to LAM.";
  return null;
}

export async function queryMicrophonePermission(): Promise<MicrophonePermissionState> {
  if (microphoneEnvironmentError()) return "unsupported";
  if (!navigator.permissions?.query) return "prompt";
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state === "granted" || status.state === "denied" ? status.state : "prompt";
  } catch { return "prompt"; }
}

/** Must be called synchronously from a user activation handler. */
export function requestMicrophoneStream(): Promise<MediaStream> {
  const unavailable = microphoneEnvironmentError();
  if (unavailable) return Promise.reject(new Error(unavailable));
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function microphoneErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Microphone access requires")) return error.message;
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) return "Microphone access was blocked. Allow microphone access in your browser’s site settings.";
  if (error instanceof DOMException && error.name === "NotFoundError") return "No microphone was found. Connect or enable a microphone, then try again.";
  if (error instanceof DOMException && error.name === "NotReadableError") return "The microphone is being used by another app or could not be opened.";
  return "LAM could not start the microphone. Check your browser’s microphone permission and try again.";
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
