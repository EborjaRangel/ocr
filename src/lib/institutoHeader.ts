function fold(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S")
    .replace(/\|/g, "I");
}

export function scoreInstitutoHeader(text: string): number {
  const value = fold(text);
  let score = 0;
  if (/INST[I1L]TUT[O0]/.test(value)) score += 20;
  if (/NAC[I1L][O0]NAL/.test(value)) score += 8;
  if (/ELECT[O0]RAL/.test(value)) score += 8;
  if (/CREDENC[I1L]AL/.test(value)) score += 6;
  if (/V[O0]TAR/.test(value)) score += 4;
  if (/SECC(?:I[O0]N)?/.test(value)) score -= 8;
  if (/V[I1L]GENC[I1L]A/.test(value)) score -= 8;
  if (/MUN[I1L]C[I1L]P[I1L][O0]/.test(value)) score -= 6;
  if (/L[O0]CAL[I1L]DAD/.test(value)) score -= 6;
  return score;
}

export function headerLooksUpright(scoreA: number, scoreB: number): boolean {
  return scoreA >= 12 && scoreA > scoreB;
}

export function pickHeaderWinner(scoreA: number, scoreB: number): 0 | 1 {
  if (scoreB >= 12 && scoreB > scoreA) return 1;
  return 0;
}
