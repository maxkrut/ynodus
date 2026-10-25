import { compact } from "../../scripts/semantic-audit/fixtures.mjs";

// Invented subclades and aggregate counts; no individual sample identifiers.
export function layoutFixture() {
  const countries = ["RUS", "POL", "UKR", "DEU", "FIN", "GBR", "FRA", "AUT", "ITA", "KAZ", "CHN", "IND"];
  const parents = [], ages = [], samples = [], projects = [], names = [];
  for (let project = 0; project < 3; project++) {
    const prefix = ["R", "I", "J"][project], root = parents.length;
    parents.push(-1); ages.push(18000); projects.push(project); names.push(`${prefix}-SYN-ROOT`);
    for (let branch = 0; branch < 5; branch++) {
      const top = parents.length;
      parents.push(root); ages.push(5500 + branch * 15); projects.push(project); names.push(`${prefix}-SYN-${100 + branch}`);
      for (let leaf = 0; leaf < (branch === 0 ? 18 : 2); leaf++) {
        const node = parents.length;
        parents.push(top); ages.push(4800 - leaf * 100); projects.push(project); names.push(`${prefix}-SYN-${200 + branch * 20 + leaf}`);
        for (let country = 0; country < countries.length; country++) {
          if ((leaf + branch + country) % 3 !== 0) samples.push([node, country, 2 + ((leaf + country + project) % 8)]);
        }
      }
    }
    const bridge = parents.length;
    parents.push(root, bridge); ages.push(7500, 2500); projects.push(project, project);
    names.push(`${prefix}-SYN-900`, `${prefix}-SYN-901`);
    samples.push([bridge + 1, 0, 11], [bridge + 1, 1, 7]);
  }
  const data = compact(parents, ages, samples);
  data.nodeIds = names;
  data.nodes = parents.map((parent, i) => [projects[i], parent, ages[i]]);
  data.projectIds = ["R", "I", "J"];
  data.countryCodes = countries;
  data.countryCounts = countries.map((_, country) => samples.filter(row => row[1] === country).reduce((sum, row) => sum + row[2], 0));
  return data;
}

export const layoutQuery = "/?lang=ru&countries=RUS,POL,UKR,DEU,FIN,GBR&presence=any&target=5500&window=100&min=0";

export function countryForestFixture() {
  // Exactly 800 terminal assignments: 798 leaves plus direct root/branch records.
  const parents = [-1, 0], ages = [null, 5000], projects = [0, 0];
  const names = ["R-SYN-ROOT", "R-SYN-BRANCH"], samples = [[0, 0, 5], [1, 0, 3]];
  for (let i = 0; i < 600; i++) {
    samples.push([parents.length, 0, 1]);
    parents.push(1); ages.push(4500); projects.push(0); names.push(`R-SYN-L${String(i).padStart(3, "0")}`);
  }
  const otherRoot = parents.length;
  parents.push(-1); ages.push(18000); projects.push(1); names.push("I-SYN-ROOT");
  for (let i = 0; i < 198; i++) {
    samples.push([parents.length, 0, 1]);
    parents.push(otherRoot); ages.push(4000); projects.push(1); names.push(`I-SYN-L${String(i).padStart(3, "0")}`);
  }
  const data = compact(parents, ages, samples);
  data.nodeIds = names;
  data.nodes = parents.map((parent, i) => [projects[i], parent, ages[i]]);
  data.projectIds = ["R", "I"];
  data.countryCodes = ["RUS"];
  data.countryCounts = [806];
  return data;
}

export function countryDeepFixture() {
  const parents = Array.from({ length: 16 }, (_, i) => i - 1);
  const ages = parents.map((_, i) => 18000 - i * 500);
  const data = compact(parents, ages, [[15, 0, 1]]);
  data.nodeIds = parents.map((_, i) => `R-SYN-DEPTH-${i}`);
  data.nodes = parents.map((parent, i) => [0, parent, ages[i]]);
  data.projectIds = ["R"];
  data.countryCodes = ["RUS"];
  data.countryCounts = [1];
  return data;
}
