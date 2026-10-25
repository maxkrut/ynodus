import assert from 'node:assert/strict';
import { loadModule } from './runtime.mjs';
import { hierarchyMacrogroupsFixture } from '../../tests/fixtures/hierarchy-macrogroups.mjs';
import { parseCsv } from '../semantic-audit/csv.mjs';

export async function assertHierarchyMacrogroups() {
  const { buildIndex } = await loadModule('worker/index-builder.ts');
  const { expandNodes } = await loadModule('worker/hierarchy-nodes.ts');
  const { collectRowsAtTarget } = await loadModule('worker/slice-analysis.ts');
  const { nodeMacroGroup } = await loadModule('shared/haplogroups.ts');
  const { groupFillColor } = await loadModule('shared/group-palette.ts');
  const { availableResultMacroGroups, filterRowsByMacroGroup } = await loadModule('app/result-filter.ts');
  const { resultsCsvText } = await loadModule('app/export-csv.ts');
  const { countryOverviewForCountry } = await loadModule('worker/evidence-profile.ts');
  const data = hierarchyMacrogroupsFixture(), index = buildIndex(data);
  const expected = new Map([
    ['R-SYN-BASAL','R'], ['R-SYN-BROAD-A','R1a'], ['R-SYN-BROAD-B','R1b'],
    ['R-SYN-CONFLICT-B','R1b'], ['I-SYN-BROAD-1','I1'], ['I-SYN-BROAD-2','I2'],
    ['J-SYN-BROAD-1','J1'], ['J-SYN-CONFLICT-2','J2'], ['R-SYN-OTHER-ROOT','R'],
  ]);
  const expanded = expandNodes(data);
  const overview = countryOverviewForCountry(index, 'RUS');
  assert.equal(overview.total, 45);
  assert.equal(overview.groups.reduce((sum,group)=>sum+group.total,0), 45);
  assert.deepEqual(Object.fromEntries(overview.groups.map(group=>[group.project,group.total])),
    {R:10,R1b:10,I1:5,I2:5,J1:5,J2:5,R1a:5});
  assert.equal(overview.groups.find(group=>group.project==='R1b').assignments
    .find(item=>item.node.id==='R-SYN-CONFLICT-B').node.project, 'R1a');
  for (const [id, group] of expected) {
    const i = data.nodeIds.indexOf(id), node = expanded[id];
    assert.equal(node.macroGroup, group, `real ancestry determines ${id}`);
    assert.equal(node.project, data.projectIds[data.nodes[i][0]], 'source project is preserved');
    assert.equal(node.parent, data.nodes[i][1] < 0 ? null : data.nodeIds[data.nodes[i][1]]);
    assert.equal(node.formed, data.nodes[i][2]);
    assert.notEqual(groupFillColor(group), '#999999', 'resolved groups have a stable palette entry');
  }
  // Parent indices may point forward; a star is a descendant, not a new group anchor.
  const reversed = expandNodes({projectIds:['R'], nodeIds:['R1b*','R1b'], nodes:[[0,1,4000],[0,-1,5000]]});
  assert.equal(reversed['R1b*'].macroGroup, 'R1b');
  assert.equal(nodeMacroGroup({project:'UNKNOWN'}), 'UNKNOWN', 'unanchored legacy scopes keep source metadata');
  const query = {target:5500,selectedCountries:['RUS','POL'],presenceMode:'all',sliceMode:'formed',
    maxDeltaYbp:0,minSamples:0,anchorId:null,scopeAllCountries:false,includeSuggestions:false};
  const formed = collectRowsAtTarget(index, query);
  assert.equal(formed.rows.length, 8);
  for (const row of formed.rows) assert.equal(nodeMacroGroup(row.node), expected.get(row.node.id));
  for (const row of formed.densityRows) if (expected.has(row.node.id)) {
    assert.equal(nodeMacroGroup(row.node), expected.get(row.node.id), 'density retains the same derived identity');
    if (row.parentId) assert.equal(row.parentMacroGroup, nodeMacroGroup(expanded[row.parentId]), 'parent-group colour follows the actual parent, including parents outside the time interval');
  }
  const crossing = collectRowsAtTarget(index, {...query,target:5250,sliceMode:'crossing'});
  assert.equal(crossing.rows.length, 1);
  assert.equal(crossing.rows[0].node.id, 'R-SYN-BROAD-B');
  assert.equal(crossing.rows[0].node.project, 'R');
  assert.equal(nodeMacroGroup(crossing.rows[0].node), 'R1b');
  assert.equal(nodeMacroGroup(crossing.rows[0].crossingChild), 'R1b');
  const groups = availableResultMacroGroups(formed.rows);
  assert.deepEqual(groups, ['I1','I2','J1','J2','R','R1a','R1b']);
  assert.deepEqual(availableResultMacroGroups(crossing.rows), ['R1b'], 'each selector uses only its own table');
  const selected = filterRowsByMacroGroup(formed.rows, 'R1b');
  assert.deepEqual(selected.map(row=>row.node.id), ['R-SYN-BROAD-B']);
  const csv = parseCsv(resultsCsvText({formedRows:selected,crossingRows:filterRowsByMacroGroup(crossing.rows,'R1b'),
    selectedCountries:['RUS','POL'],targetYbp:5500,targetYear:'3551',targetEra:'BCE',presenceMode:'all',minResultSamples:0,
    macroGroupFilter:'R1b',crossingMacroGroupFilter:null,formatCalendar:String,subcladeUrl:id=>`https://example.invalid/${id}`}));
  assert.equal(csv.length, 2);
  for (const row of csv) assert.equal(row.macrogroup, 'R1b', 'CSV and the table use one macrogroup identity');
  assert.equal(csv.find(row=>row.result_mode==='formed').macrogroup_filter, 'R1b');
  assert.equal(csv.find(row=>row.result_mode==='crossing').macrogroup_filter, '', 'Formed filter does not leak into Crossing metadata');
  const independent = parseCsv(resultsCsvText({formedRows:filterRowsByMacroGroup(formed.rows,'I1'),
    crossingRows:crossing.rows,selectedCountries:['RUS','POL'],targetYbp:5500,targetYear:'3551',targetEra:'BCE',
    presenceMode:'all',minResultSamples:0,macroGroupFilter:'I1',crossingMacroGroupFilter:'R1b',
    formatCalendar:String,subcladeUrl:id=>`https://example.invalid/${id}`}));
  assert.deepEqual(independent.map(row=>[row.result_mode,row.macrogroup,row.macrogroup_filter]),
    [['formed','I1','I1'],['crossing','R1b','R1b']]);
}
