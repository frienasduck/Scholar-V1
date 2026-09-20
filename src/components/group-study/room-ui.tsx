"use client";
import { useState } from "react";
import { Check, Copy, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { copyRoomCode, formatRoomCode } from "./client";
import type { RoomSnapshot } from "@/lib/group-study/types";
import type { GroupRoomController } from "./use-room";
import type { GroupFeatureId } from "@/lib/group-study/features";

export type Workspace = GroupFeatureId | "host";
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gs-empty">
      <h3>{title}</h3>
      <div className="gs-muted">{children}</div>
    </div>
  );
}
export function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="gs-inline">
      <code
        className="gs-code-chip"
        aria-label={`Study code ${formatRoomCode(code)}`}
      >
        {formatRoomCode(code)}
      </code>
      <button
        className="gs-button gs-button-icon"
        aria-label="Copy code"
        onClick={async () => {
          try {
            await copyRoomCode(code);
            setCopied(true);
            setError("");
          } catch {
            setError("Select the code to copy it manually.");
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
      </button>
      {error && <small role="status">{error}</small>}
    </div>
  );
}
export function InviteDialog({
  code,
  open,
  onClose,
}: {
  code: string;
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="gs-dialog">
        <DialogTitle>Study is better together.</DialogTitle>
        <DialogDescription>
          Share this code. Your friends can join without an account.
        </DialogDescription>
        <CodeChip code={code} />
        <button
          className="gs-button gs-button-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `Join my Scholar Group Study room.\nCode: ${formatRoomCode(code)}\n${location.origin}/group-study`,
              );
              setStatus("Invite copied.");
            } catch {
              setStatus("Copy unavailable. Share the code above.");
            }
          }}
        >
          Copy invite text
        </button>
        <p role="status" className="gs-muted">
          {status}
        </p>
      </DialogContent>
    </Dialog>
  );
}
export function Person({
  person,
}: {
  person: RoomSnapshot["participants"][number];
}) {
  return (
    <div className="gs-person">
      <span className="gs-avatar" aria-hidden="true">
        {person.displayName.slice(0, 2).toUpperCase()}
      </span>
      <div className="gs-person-info">
        <div className="gs-person-name">
          {person.displayName}
          {person.handRaised ? " ✋" : ""}
        </div>
        <div className="gs-person-role">
          <span className="gs-presence" data-online={person.online} />
          {person.role === "host" ? "Host · " : ""}
          {person.online ? "Online" : "Away"}
          {person.chatMuted ? " · Chat muted" : ""}
        </div>
      </div>
    </div>
  );
}
export function JoinRequests({
  controller,
}: {
  controller: GroupRoomController;
}) {
  const pending =
    controller.snapshot?.participants.filter((p) => p.status === "pending") ??
    [];
  if (controller.snapshot?.me.role !== "host" || !pending.length) return null;
  return (
    <section
      className="gs-requests gs-glass"
      aria-label="Join requests"
      aria-live="polite"
    >
      {pending.map((p) => (
        <div key={p.id} className="gs-request">
          <Users aria-hidden="true" />
          <span>
            <strong>{p.displayName}</strong> wants to join
          </span>
          <div className="gs-inline">
            <button
              className="gs-button gs-button-primary"
              disabled={controller.busyKeys.includes(`approve:${p.id}`)}
              onClick={() =>
                void controller.action("approve", { participantId: p.id })
              }
            >
              Approve
            </button>
            <button
              className="gs-button"
              disabled={controller.busyKeys.includes(`deny:${p.id}`)}
              onClick={() =>
                void controller.action("deny", { participantId: p.id })
              }
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
