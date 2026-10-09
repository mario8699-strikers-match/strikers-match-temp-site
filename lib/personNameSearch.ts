export function normalizePersonName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLocaleLowerCase('es-MX')
    .replace(/\s+/g, ' ');
}

export function searchByClosestName<T>(
  entries: T[],
  query: string,
  getName: (entry: T) => string,
  maximumResults = 20
) {
  const normalizedQuery = normalizePersonName(query);
  if (!normalizedQuery) return [];

  const queryTokens = normalizedQuery.split(' ');
  return entries
    .map((entry) => {
      const name = normalizePersonName(getName(entry));
      return { entry, name, score: personNameMatchScore(name, normalizedQuery, queryTokens) };
    })
    .filter((result) => result.score !== null)
    .sort((resultA, resultB) => (
      resultA.score! - resultB.score!
      || resultA.name.localeCompare(resultB.name, 'es', { sensitivity: 'base' })
    ))
    .slice(0, maximumResults)
    .map((result) => result.entry);
}

function personNameMatchScore(name: string, query: string, queryTokens: string[]) {
  if (!name) return null;

  const exactPosition = name.indexOf(query);
  if (exactPosition >= 0) {
    return exactPosition + Math.abs(name.length - query.length) / 100;
  }

  const nameTokens = name.split(' ');
  let tokenDistance = 0;
  for (const queryToken of queryTokens) {
    const closestDistance = Math.min(...nameTokens.map((nameToken) => (
      tokenMatchDistance(queryToken, nameToken)
    )));
    const allowedDistance = queryToken.length <= 3
      ? 0
      : Math.max(1, Math.floor(queryToken.length * 0.3));
    if (closestDistance > allowedDistance) {
      const fullDistance = levenshteinDistance(query, name);
      const similarity = 1 - fullDistance / Math.max(query.length, name.length, 1);
      return similarity >= 0.55 ? 100 + fullDistance : null;
    }
    tokenDistance += closestDistance;
  }

  return 10 + tokenDistance + Math.abs(nameTokens.length - queryTokens.length) / 10;
}

function tokenMatchDistance(queryToken: string, nameToken: string) {
  if (nameToken === queryToken) return 0;
  if (nameToken.startsWith(queryToken) || queryToken.startsWith(nameToken)) return 0.25;
  return levenshteinDistance(queryToken, nameToken);
}

function levenshteinDistance(valueA: string, valueB: string) {
  const previous = Array.from({ length: valueB.length + 1 }, (_, index) => index);
  const current = new Array<number>(valueB.length + 1);

  for (let indexA = 1; indexA <= valueA.length; indexA += 1) {
    current[0] = indexA;
    for (let indexB = 1; indexB <= valueB.length; indexB += 1) {
      const substitutionCost = valueA[indexA - 1] === valueB[indexB - 1] ? 0 : 1;
      current[indexB] = Math.min(
        current[indexB - 1] + 1,
        previous[indexB] + 1,
        previous[indexB - 1] + substitutionCost
      );
    }
    for (let index = 0; index <= valueB.length; index += 1) previous[index] = current[index];
  }

  return previous[valueB.length];
}
