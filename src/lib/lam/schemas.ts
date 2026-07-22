import { z } from "zod";

export const lamSourceSchema = z.object({ label: z.string().trim().min(1).max(240), route: z.string().trim().max(240).optional() }).strict();
export const lamResponseBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string().max(12_000) }).strict(),
  z.object({ type: z.literal("heading"), content: z.string().max(240) }).strict(),
  z.object({ type: z.literal("bullets"), items: z.array(z.string().max(1_000)).max(20) }).strict(),
  z.object({ type: z.literal("formula"), expression: z.string().max(1_000), explanation: z.string().max(2_000).optional() }).strict(),
  z.object({ type: z.literal("definition"), term: z.string().max(240), meaning: z.string().max(2_000) }).strict(),
  z.object({ type: z.literal("source"), source: lamSourceSchema }).strict(),
  z.object({ type: z.literal("action"), label: z.string().max(120), action: z.string().max(80) }).strict(),
  z.object({ type: z.literal("progress"), label: z.string().max(160), value: z.number().min(0).max(100) }).strict(),
]);
export type LamResponseBlock = z.infer<typeof lamResponseBlockSchema>;

export const lamResponseSchema = z.object({
  messageId: z.string().min(1).max(160), title: z.string().max(240).optional(),
  blocks: z.array(lamResponseBlockSchema).max(40), sources: z.array(lamSourceSchema).max(12).default([]),
  suggestedActions: z.array(z.object({ id: z.string().max(80), label: z.string().max(120) }).strict()).max(5).default([]),
  conversationTitle: z.string().max(80).optional(),
}).strict();

export function parseLamTextBlocks(content: string): LamResponseBlock[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: LamResponseBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  const flushParagraph = () => { if (paragraph.length) blocks.push({ type: "text", content: paragraph.join("\n").trim() }); paragraph = []; };
  const flushBullets = () => { if (bullets.length) blocks.push({ type: "bullets", items: bullets }); bullets = []; };
  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);
    const formula = line.match(/^\$\$(.+)\$\$$/);
    if (formula) { flushParagraph(); flushBullets(); blocks.push({ type: "formula", expression: `$$${formula[1]}$$` }); }
    else if (heading) { flushParagraph(); flushBullets(); blocks.push({ type: "heading", content: heading[1] }); }
    else if (bullet) { flushParagraph(); bullets.push(bullet[1]); }
    else if (!line.trim()) { flushParagraph(); flushBullets(); }
    else paragraph.push(line);
  }
  flushParagraph(); flushBullets();
  return blocks.length ? blocks : [{ type: "text", content }];
}
