"use client";

import { useMemo, useState } from "react";
import { Check, Coins, Download, Eye, Lock, Palette, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { STORE_CATEGORIES, STORE_PRODUCTS, type StoreProduct } from "@/data/store-catalog";
import { useStore } from "@/lib/store";
import { equipTheme, getEquippedTheme } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReadyBackgroundVideo } from "@/components/ready-background-video";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";

function productFile(product: StoreProduct) {
  const body = [
    `# ${product.name}`,
    "",
    product.longDescription,
    "",
    "## Included",
    ...product.contents.map((item) => `- ${item}`),
    "",
    "## Study use",
    `Use this ${STORE_CATEGORIES.find((category) => category.id === product.category)?.label.toLowerCase()} item as a starting point. Adapt it to the current chapter and verify academic facts against the official textbook.`,
    "",
    `Product ID: ${product.id}`,
    "Created by Scholar. This file contains original application-generated content.",
  ].join("\n");
  return new Blob([body], { type: "text/markdown;charset=utf-8" });
}

function downloadProduct(product: StoreProduct) {
  const blob = productFile(product);
  if (!blob.size) throw new Error("Generated file was empty.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${product.id}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function StoreView() {
  const scholarClass = useStore((state) => state.user.scholarClass);
  const access = useScholarAccess();
  const coins = useStore((state) => state.coins);
  const purchases = useStore((state) => state.purchases);
  const purchaseItem = useStore((state) => state.purchaseItem);
  const addXP = useStore((state) => state.addXP);
  const pushActivity = useStore((state) => state.pushActivity);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<StoreProduct | null>(null);
  const [confirm, setConfirm] = useState<StoreProduct | null>(null);
  const [equipped, setEquipped] = useState(() => getEquippedTheme(scholarClass));
  const ownedIds = useMemo(() => new Set(purchases.map((purchase) => purchase.id)), [purchases]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return STORE_PRODUCTS.filter((item) => (category === "all" || item.category === category)
      && (!query || `${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(query)));
  }, [category, search]);

  const buy = async () => {
    if (!confirm) return;
    const authorization = await fetch("/api/store/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: confirm.id }) });
    if (!authorization.ok) {
      const value = await authorization.json().catch(() => ({}));
      if (authorization.status === 403) window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } }));
      toast.error(value.error === "PLUS_REQUIRED" ? "This Store item requires Scholar Plus." : (value.error || "Purchase could not be authorized."));
      return;
    }
    if (coins < confirm.price) { toast.error("Not enough coins", { description: `You need ${confirm.price - coins} more coins.` }); return; }
    if (purchaseItem(confirm.id, confirm.price, confirm.name, confirm.category)) {
      addXP(15);
      pushActivity({ type: "store", text: `Purchased ${confirm.name}`, icon: "🛍️" });
      toast.success(`${confirm.name} added to your library`, { description: `-${confirm.price} coins · +15 XP` });
    }
    setConfirm(null);
  };

  const useItem = (item: StoreProduct) => {
    if (item.themeId) {
      equipTheme(scholarClass, item.themeId);
      setEquipped(item.themeId);
      toast.success(`${item.name} equipped`);
      return;
    }
    try { downloadProduct(item); toast.success(`${item.name} downloaded`); }
    catch (error) { toast.error("Download failed", { description: error instanceof Error ? error.message : "Try again." }); }
  };

  const isOwned = (item: StoreProduct) => ownedIds.has(item.id);

  return (
    <div className="relative -m-3 min-h-[calc(100vh-4rem)] overflow-hidden bg-black sm:-m-4 lg:-m-6">
      <ReadyBackgroundVideo
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
        readinessId="store"
        className="z-0"
      />
      <div className="absolute inset-0 z-0 bg-black/65" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6 p-4 pb-12 sm:p-6">
      <header className="overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Scholar Store</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Useful upgrades, not mystery boxes.</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Preview every product before spending. Purchases remain separate for Class {scholarClass} and can be restored from this profile.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <Coins className="h-5 w-5 text-amber-500" /><div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p><p className="text-xl font-semibold tabular-nums">{coins}</p></div>
          </div>
        </div>
      </header>

      <section className="space-y-4" aria-label="Store catalog controls">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, subjects, or tags…" className="pl-9" /></div>
          <Button variant="outline" onClick={() => toast.success(`${purchases.length} purchases restored`, { description: "Purchases are loaded from this class profile." })}><RefreshCw className="mr-2 h-4 w-4" /> Restore purchases</Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product categories">
          {[{ id: "all", label: "All" }, ...STORE_CATEGORIES].map((item) => <button key={item.id} onClick={() => setCategory(item.id)} role="tab" aria-selected={category === item.id} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${category === item.id ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-muted"}`}>{item.label}</button>)}
        </div>
      </section>

      {visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const owned = isOwned(item);
            const isEquipped = item.themeId === equipped;
            return <article key={item.id} className="flex min-h-72 flex-col rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: `${item.accent}20`, color: item.accent }}>{item.themeId ? <Palette className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}</span>
                <div className="flex flex-wrap justify-end gap-1.5">{item.requiresPlus && <Badge className="bg-violet-500/20 text-violet-200">Plus</Badge>}{isEquipped ? <Badge>Equipped</Badge> : owned ? <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Owned</Badge> : <Badge variant="outline"><Coins className="mr-1 h-3 w-3" />{item.price}</Badge>}</div>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{item.name}</h2><p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{tag}</span>)}</div>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                <Button variant="outline" onClick={() => setPreview(item)}><Eye className="mr-1.5 h-4 w-4" />Preview</Button>
                {owned ? <Button onClick={() => useItem(item)}>{item.themeId ? <Palette className="mr-1.5 h-4 w-4" /> : <Download className="mr-1.5 h-4 w-4" />}{item.themeId ? (isEquipped ? "Equipped" : "Equip") : "Download"}</Button> : item.requiresPlus && !access.has("store_plus_items") ? <Button onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus" } }))}><Lock className="mr-1.5 h-4 w-4" />Unlock</Button> : <Button onClick={() => setConfirm(item)}><Lock className="mr-1.5 h-4 w-4" />Buy</Button>}
              </div>
            </article>;
          })}
        </div>
      ) : <div className="rounded-3xl border border-dashed border-border p-12 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No products match those filters.</p><button onClick={() => { setSearch(""); setCategory("all"); }} className="mt-2 text-sm text-primary hover:underline">Clear filters</button></div>}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}><DialogContent><DialogHeader><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>{preview?.longDescription}</DialogDescription></DialogHeader>{preview && <div className="space-y-4"><div className="flex gap-2">{preview.contents.map((value) => <span key={value} className="rounded-lg bg-muted px-2 py-1 text-xs">{value}</span>)}</div>{preview.themeId && <div className="flex gap-2">{[preview.accent, "#0f172a", "#f8fafc"].map((color) => <span key={color} className="h-14 flex-1 rounded-xl border border-border" style={{ background: color }} />)}</div>}</div>}<DialogFooter>{preview && (isOwned(preview) ? <Button onClick={() => useItem(preview)}>{preview.themeId ? "Equip theme" : "Download item"}</Button> : <Button onClick={() => { setConfirm(preview); setPreview(null); }}>Buy for {preview.price} coins</Button>)}</DialogFooter></DialogContent></Dialog>

      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}><DialogContent><DialogHeader><DialogTitle>Confirm purchase</DialogTitle><DialogDescription>{confirm?.name} will be added permanently to the current Class {scholarClass} profile.</DialogDescription></DialogHeader>{confirm && <div className="flex justify-between rounded-xl bg-muted p-3 text-sm"><span>Balance after purchase</span><strong>{coins - confirm.price} coins</strong></div>}<DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button><Button onClick={buy} disabled={!confirm || coins < confirm.price}>Confirm purchase</Button></DialogFooter></DialogContent></Dialog>

      <div className="flex justify-center"><Button variant="ghost" onClick={() => { equipTheme(scholarClass, "theme-default"); setEquipped("theme-default"); toast.success("Default theme restored"); }}>Restore default theme</Button></div>
      </div>
    </div>
  );
}

export default StoreView;
