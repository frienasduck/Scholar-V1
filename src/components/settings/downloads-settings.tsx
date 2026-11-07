"use client";

import { useState } from "react";
import { ArrowRight, Download, HardDrive, Wifi, WifiOff } from "lucide-react";
import { navigateTo } from "@/lib/nav-event";
import { profileGetJSON, profileGetItem } from "@/lib/profile-storage";

interface DownloadedSummary {
  title?: string;
  type?: string;
  sizeMB?: number;
  downloadedAt?: number;
}

const DOWNLOAD_KEY = "dl-downloaded";
const OFFLINE_KEY = "dl-offline";
const STORAGE_LIMIT_MB = 500;

export function DownloadsSettings({ scholarClass }: { scholarClass: 9 | 11 }) {
  const [items] = useState<DownloadedSummary[]>(() => {
    const stored = profileGetJSON<DownloadedSummary[]>(scholarClass, DOWNLOAD_KEY, []);
    return Array.isArray(stored) ? stored : [];
  });
  const [offline] = useState(() => profileGetItem(scholarClass, OFFLINE_KEY) === "1");

  const size = items.reduce((sum, item) => sum + (Number(item.sizeMB) || 0), 0);
  const recent = [...items]
    .sort((a, b) => (b.downloadedAt ?? 0) - (a.downloadedAt ?? 0))
    .slice(0, 3);
  const usedPercent = Math.min(100, Math.round((size / STORAGE_LIMIT_MB) * 100));

  const openDownloads = () => {
    navigateTo("resources", { mode: "downloads" });
  };

  return (
    <div className="space-y-4">
      <div className="asme-glass rounded-3xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <Download className="h-4 w-4 text-sky-300" /> Downloads
            </h3>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              Files you saved for offline study in Resources. Downloads are stored on this device,
              scoped to your Class {scholarClass} profile.
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
              offline
                ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {offline ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
            {offline ? "Offline mode on" : "Online"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Downloaded files
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">{items.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Storage used
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">{size.toFixed(1)} MB</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400"
                style={{ width: `${Math.max(2, usedPercent)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-white/35">
              {usedPercent}% of the {STORAGE_LIMIT_MB} MB offline cap
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Offline preference
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white">
              {offline ? <WifiOff className="h-3.5 w-3.5 text-amber-300" /> : <Wifi className="h-3.5 w-3.5 text-emerald-300" />}
              {offline ? "Prefer downloaded files" : "Use the full library"}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-white/35">
              Change this switch inside Resources → Downloads.
            </p>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              <HardDrive className="h-3 w-3" /> Recently downloaded
            </p>
            <ul className="mt-2 divide-y divide-white/5">
              {recent.map((item, index) => (
                <li
                  key={`${item.title ?? "item"}-${item.downloadedAt ?? index}`}
                  className="flex items-center justify-between gap-3 py-1.5 text-xs"
                >
                  <span className="truncate text-white/75">{item.title || "Saved file"}</span>
                  <span className="shrink-0 text-white/35">
                    {typeof item.sizeMB === "number" ? `${item.sizeMB.toFixed(2)} MB` : "Saved"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openDownloads}
            className="flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/10 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-400/20"
          >
            Open Resources · Downloads <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <p className="text-xs text-white/35">
            Downloads are managed, exported and deleted from the Resources workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
