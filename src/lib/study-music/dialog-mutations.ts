/** Ignore unrelated chat text, progress, animation and thumbnail mutations. */
export function dialogMutationRelevant(records: readonly MutationRecord[]): boolean {
  const containsDialog = (node: Node) => node.nodeType === 1 && (
    (node as Element).matches('[role="dialog"]') || !!(node as Element).querySelector('[role="dialog"]')
  );
  return records.some(record => record.type === "attributes"
    ? record.target.nodeType === 1 && (record.target as Element).matches('[role="dialog"]')
    : [...record.addedNodes, ...record.removedNodes].some(containsDialog));
}
