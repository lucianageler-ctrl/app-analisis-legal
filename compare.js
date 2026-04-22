function extractBlocks(text) {
  const source = normalizeText(text);
  if (!source) return [];

  const articleRegex = /(?:^|\n)\s*(ART[IÍ]CULO|Art\.?|Artículo)\s+([0-9]+(?:°|º)?|[A-Z])\s*[:.-]?/gim;
  const matches = [...source.matchAll(articleRegex)];

  if (matches.length) {
    const blocks = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.index;
      const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
      blocks.push({
        id: String(current[2]).replace(/[°º]/g, ""),
        kind: "article",
        title: current[0].trim(),
        content: source.slice(start, end).trim()
      });
    }
    return blocks;
  }

  return source
    .split(/\n\s*\n/)
    .map((content, index) => ({
      id: String(index + 1),
      kind: "block",
      title: `Bloque ${index + 1}`,
      content: content.trim()
    }))
    .filter((b) => b.content);
}

function compareDocs(docA, docB) {
  const aBlocks = docA.blocks || [];
  const bBlocks = docB.blocks || [];

  const aMap = new Map(aBlocks.map((b) => [b.id, b]));
  const bMap = new Map(bBlocks.map((b) => [b.id, b]));

  const added = [];
  const removed = [];
  const modified = [];

  for (const [id, a] of aMap) {
    const b = bMap.get(id);
    if (!b) {
      removed.push({ id, a });
      continue;
    }
    if (normalizeText(a.content) !== normalizeText(b.content)) {
      modified.push({ id, a, b });
    }
  }

  for (const [id, b] of bMap) {
    if (!aMap.has(id)) {
      added.push({ id, b });
    }
  }

  return {
    added,
    removed,
    modified,
    totalA: aBlocks.length,
    totalB: bBlocks.length
  };
}
