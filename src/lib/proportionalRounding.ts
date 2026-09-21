/**
 * Reparte `total` (entero) proporcionalmente a `weights`, garantizando que la suma de los
 * resultados sea EXACTAMENTE `total` — método del mayor residuo (Hare-Niemeyer): cada monto
 * se trunca hacia abajo y los colones sobrantes se asignan uno por uno a quienes tengan la
 * mayor parte decimal descartada. Un redondeo simple por persona no garantiza esa suma exacta.
 * Si `weights` suma 0 (nadie tiene horas), devuelve todos ceros sin dividir por cero.
 */
export function distributeProportionally(total: number, weights: number[]): number[] {
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  if (sumWeights <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => (total * w) / sumWeights);
  const floors = raw.map(Math.floor);
  const distributed = floors.reduce((a, b) => a + b, 0);
  let leftover = total - distributed;

  const order = raw
    .map((r, i) => ({ i, remainder: r - floors[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  const result = [...floors];
  for (let k = 0; k < order.length && leftover > 0; k++, leftover--) {
    result[order[k].i] += 1;
  }
  return result;
}
