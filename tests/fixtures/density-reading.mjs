import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

// One dated subclade has 2,483 samples; 15 unrelated older subclades share a bin.
export function densityReadingFixture(withSameAgeChild = false, olderCount = 15) {
  const parents = [-1], ages = [8600], ids = ['R-SYN-FOUND'];
  const samples = [[0, 0, 2000 - Number(withSameAgeChild)], [0, 1, 483 - Number(withSameAgeChild)]];
  const projects = [0];
  for (let i = 1; i <= olderCount; i++) {
    parents.push(-1); ages.push(15000); ids.push(`SYN-OLD-${String(i).padStart(2, '0')}`);
    projects.push(i <= 5 ? 1 : i <= 10 ? 2 : 0);
    samples.push([i, 0, i === 1 ? 9 : 3], [i, 1, 2]);
  }
  parents.push(-1); ages.push(null); ids.push('R-SYN-UNKNOWN'); projects.push(0);
  samples.push([olderCount + 1, 2, 10]);
  if (withSameAgeChild) {
    parents.push(0); ages.push(8600); ids.push('R-SYN-SAME-AGE'); projects.push(0);
    samples.push([olderCount + 2, 0, 1], [olderCount + 2, 1, 1]);
  }
  const data = compact(parents, ages, samples);
  data.nodeIds = ids; data.projectIds = ['R1a', 'I2', 'J2']; data.countryCodes = ['RUS', 'POL', 'FRA'];
  data.nodes.forEach((node, index) => { node[0] = projects[index]; });
  return data;
}

// A dominant R segment with seven tiny labelled groups, including long codes.
export function densityMacroLabelsFixture() {
  const data = densityReadingFixture(false, 47);
  data.projectIds = ['R1a', 'I2', 'J2', 'A00', 'A0-T', 'GHIJK', 'HIJK', 'IJK'];
  for (let index = 1; index <= 47; index++) data.nodes[index][0] = index <= 40 ? 0 : index - 40;
  return data;
}
