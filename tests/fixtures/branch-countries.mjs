import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

// Hand-counted public aggregates, invented topology; no individual identifiers.
export function branchCountriesFixture() {
  const data = compact([-1, 0, 1, 0, 3], [5500, 5000, 4000, null, 2500],
    [[0, 0, 2], [1, 0, 1], [2, 0, 4], [2, 1, 3], [3, 1, 5], [3, 2, 2], [4, 2, 3]]);
  data.nodeIds = ['R-SYN-ROOT', 'R-SYN-A', 'R-SYN-A1', 'R-SYN-B', 'R-SYN-B1'];
  data.projectIds = ['R']; data.countryCodes = ['RUS', 'POL', 'FRA']; data.countryCounts = [7, 8, 5];
  return data;
}

export function branchCountriesLargeFixture() {
  const parents = [-1], ages = [5500], names = ['R-SYN-ROOT'], samples = [[0, 0, 2]];
  for (let i = 0; i < 60; i++) {
    parents.push(0); ages.push(4000); names.push(`R-SYN-ZERO-${i}`); samples.push([i + 1, 2, 3]);
  }
  parents.push(0); ages.push(null); names.push('R-SYN-SELECTED'); samples.push([61, 0, 1]);
  const data = compact(parents, ages, samples);
  data.nodeIds = names; data.projectIds = ['R']; data.countryCodes = ['RUS', 'POL', 'FRA']; data.countryCounts = [3, 0, 180];
  return data;
}
