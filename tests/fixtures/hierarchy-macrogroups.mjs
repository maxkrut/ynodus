import { compact } from '../../scripts/semantic-audit/fixtures.mjs';

// Public group names with invented descendants; source projects deliberately disagree.
export function hierarchyMacrogroupsFixture() {
  const parents = [-1,0,0,-1,3,3,-1,6,6,0,1,2,11,4,5,7,8,-1,17];
  const ages = [15000,7000,7000,15000,7000,7000,15000,7000,7000,
    5500,5500,5500,5000,5500,5500,5500,5500,15000,5500];
  const samples = [9,10,11,12,13,14,15,16,18].flatMap(node => [[node,0,5],[node,1,3]]);
  const data = compact(parents, ages, samples);
  data.nodeIds = ['R','R1a','R1b','I','I1','I2','J','J1','J2',
    'R-SYN-BASAL','R-SYN-BROAD-A','R-SYN-BROAD-B','R-SYN-CONFLICT-B',
    'I-SYN-BROAD-1','I-SYN-BROAD-2','J-SYN-BROAD-1','J-SYN-CONFLICT-2',
    'X-SYN-ROOT','R-SYN-OTHER-ROOT'];
  data.projectIds = ['R','R1a','R1b','I','I1','I2','J','J1','J2','UNCLASSIFIED'];
  const projects = [0,1,2,3,4,5,6,7,8,0,0,0,1,3,3,6,7,9,0];
  data.nodes.forEach((node, i) => { node[0] = projects[i]; });
  data.countryCodes = ['RUS','POL','FRA'];
  return data;
}
