function foldKey(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ñ/g, "X")
    .replace(/[^A-Z0-9]/g, "");
}

export function confirmTextReads(reads: string[], minVotes = 2): string {
  const values = reads.map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) return "";

  const groups = new Map<string, { count: number; best: string }>();
  for (const value of values) {
    const key = foldKey(value);
    if (!key) continue;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { count: 1, best: value });
      continue;
    }
    current.count += 1;
    if (value.length > current.best.length) current.best = value;
  }

  let winner = "";
  let bestCount = 0;
  for (const group of groups.values()) {
    if (group.count > bestCount) {
      winner = group.best;
      bestCount = group.count;
    }
  }
  if (bestCount >= minVotes) return winner;
  if (values.length >= minVotes && bestCount === 1) {
    return [...groups.values()].sort((a, b) => b.best.length - a.best.length)[0]?.best ?? values[0];
  }
  return winner;
}

export function confirmVotes(reads: string[], minVotes = 2): string {
  const values = reads.map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) return "";

  const groups = new Map<string, { count: number; best: string }>();
  for (const value of values) {
    const key = foldKey(value);
    if (!key) continue;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { count: 1, best: value });
      continue;
    }
    current.count += 1;
    if (value.length > current.best.length) current.best = value;
  }

  let winner = "";
  let bestCount = 0;
  for (const group of groups.values()) {
    if (group.count > bestCount) {
      winner = group.best;
      bestCount = group.count;
    }
  }
  return bestCount >= minVotes ? winner : "";
}

export function confirmMajority(reads: string[]): string {
  return (
    confirmTextReads(reads, 3) ||
    confirmTextReads(reads, 2) ||
    confirmTextReads(reads, 1)
  );
}

export function confirmNameReads(
  reads: Array<{
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
  }>,
): {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
} {
  return {
    apellidoPaterno: confirmMajority(reads.map((item) => item.apellidoPaterno)),
    apellidoMaterno: confirmMajority(reads.map((item) => item.apellidoMaterno)),
    nombre: confirmMajority(reads.map((item) => item.nombre)),
  };
}
