// A bracket, as the page builds its local ones: single elimination, one-on-one, entrants seeded at random, the top seeds
// given byes into round 2 when there aren't a power of two of them, and a best-of-three final. a, b and w are entrant
// indexes.
function seedOrder(size) {               // 1 meets the last seed; 1 and 2 can only meet in the final
  let order = [1];
  while (order.length < size) order = order.flatMap(sd => [sd, order.length * 2 + 1 - sd]);
  return order;
}
export function makeBracket(entrants) {
  const n = entrants.length;
  let size = 2;
  while (size < n) size *= 2;
  const order = seedOrder(size), rounds = [];
  rounds.push(Array.from({ length: size / 2 }, (_, i) => {
    const a = order[2 * i] - 1, b = order[2 * i + 1] - 1;
    return { a: a < n ? a : null, b: b < n ? b : null, w: null };
  }));
  for (let m = size / 4; m >= 1; m /= 2) rounds.push(Array.from({ length: m }, () => ({ a: null, b: null, w: null })));
  Object.assign(rounds[rounds.length - 1][0], { bo: 3, s: [0, 0] });
  const B = { entrants, rounds };
  advance(B);
  return B;
}
// winners into the next round; a bye, or an entrant who left, gives the match to the other side
export function advance(B) {
  B.rounds.forEach((round, r) => round.forEach((m, i) => {
    if (m.w === null) {
      if (r === 0 && (m.a === null) !== (m.b === null)) m.w = m.a ?? m.b;
      else if (m.a !== null && m.b !== null && (B.entrants[m.a].gone || B.entrants[m.b].gone)) m.w = B.entrants[m.a].gone ? m.b : m.a;
    }
    const next = B.rounds[r + 1];
    if (next && m.w !== null) next[i >> 1][i % 2 ? 'b' : 'a'] = m.w;
  }));
}
export function nextMatch(B) {
  for (let r = 0; r < B.rounds.length; r++)
    for (let i = 0; i < B.rounds[r].length; i++) { const m = B.rounds[r][i]; if (m.a !== null && m.b !== null && m.w === null) return { r, i, m }; }
  return null;
}
export const champion = B => B.rounds[B.rounds.length - 1][0].w;
