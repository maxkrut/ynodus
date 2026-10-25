import assert from 'node:assert/strict';
import {loadModule} from './runtime.mjs';

export async function assertResearchReading() {
  const {densityParentGroups} = await loadModule('app/density-parent-groups.ts');
  const row = (id,parentId,formed) => ({node:{id,formed,project:'R',macroGroup:'R1a'},parentId,parentMacroGroup:'R',total:1});
  const rows=[row('R-SYN-A','R-SYN-P',5000),row('R-SYN-B','R-SYN-P',5000),
    row('R-SYN-C','R-SYN-Q',5000),row('R-SYN-D','R-SYN-P',5100),
    row('R-SYN-E',null,5000),row('R-SYN-F',null,5000)];
  const groups=densityParentGroups([...rows,rows[0]]);
  assert.equal(groups.length,5,'only same-parent, same-date siblings group; unresolved roots stay separate');
  assert.deepEqual(groups[0].rows.map(row=>row.node.id),['R-SYN-A','R-SYN-B']);
  assert.equal(groups[0].macroGroup,'R');
  assert.equal(densityParentGroups([...rows].reverse()).length,5);
  const {renderDensityBucketGrid}=await loadModule('app/density-bucket-view.ts');
  const bin={older:6000,younger:4000,start:0,end:1,logarithmic:false};
  const ctx={locale:'en',t:key=>key,formatNumber:String,densityMeasure:'count'};
  assert.match(renderDensityBucketGrid(rows,new Set(),ctx,[bin]).html,/data-density-value="6"/);
  const parentHtml=renderDensityBucketGrid(rows,new Set(['R-SYN-B']),{...ctx,densityUnit:'parents'},[bin]).html;
  assert.match(parentHtml,/data-density-value="5"/);
  assert.match(parentHtml,/densityCurrentResults: 1/,'outline follows underlying member evidence');
  assert.match(renderDensityBucketGrid(rows,new Set(),{...ctx,densityUnit:'parents',densityMeasure:'per1000'},[bin]).html,/data-density-value="2.5"/);
  const {compactTreeOpened,researchMacroSummary,macroResearchForest,toggleResearchNode}=await loadModule('app/research-tree-reading.ts');
  const leaf=(id,macro,counts,children=[])=>({node:{id,macroGroup:macro,project:'R',formed:5000,formedKnown:true},
    total:counts.reduce((n,[,v])=>n+v,0),countryCounts:new Map(counts),directTotal:counts.reduce((n,[,v])=>n+v,0)-children.reduce((n,c)=>n+c.total,0),children});
  const a=leaf('R-SYN-A','R1a',[['RUS',2]]),b=leaf('R-SYN-B','R1b',[['POL',3]]);
  const middle=leaf('R-SYN-M','R1a',[['RUS',2]],[a]);
  const root=leaf('R-SYN-ROOT','R',[['RUS',2],['POL',3]],[middle,b]);
  assert.deepEqual(compactTreeOpened([root]),['R-SYN-ROOT']);
  assert.deepEqual(compactTreeOpened([root],'R1a'),['R-SYN-M','R-SYN-ROOT'],'real ancestors and first matching level remain accessible');
  const scoped=macroResearchForest([root],'R1a');
  assert.deepEqual(scoped.map(item=>item.node.node.id),['R-SYN-M']);
  assert.deepEqual(scoped[0].path.map(item=>item.node.id),['R-SYN-ROOT'],'scope roots disclose their real source ancestry separately');
  assert.equal(scoped[0].node.children[0],a,'scoping preserves real immediate edges and node counts');
  const summary=researchMacroSummary([root],[],{t:key=>key,formatNumber:String});
  assert.match(summary,/data-research-group="R1a"/);assert.match(summary,/data-research-group="R1b"/);
  assert.doesNotMatch(summary,/data-research-group="R"/,'ancestor totals are not terminal samples');
  const selected=researchMacroSummary([root],['RUS'],{t:key=>key,formatNumber:String});
  assert.match(selected,/<b>2<\/b>/);assert.doesNotMatch(selected,/data-research-group="R1b"/);
  const {renderEvidenceForestTable}=await loadModule('app/evidence-tree-table.ts');
  const opts={t:key=>key,formatNumber:String,formatCalendar:String,countryName:String,countryFlag:String};
  const model={roots:[root],countryCounts:root.countryCounts,anchorId:root.node.id};
  const search={query:'SYN-A',opened:[root.node.id]};
  assert.match(renderEvidenceForestTable(model,search,opts),/data-tree-node="R-SYN-A"/);
  toggleResearchNode(search,middle.node.id);
  assert.doesNotMatch(renderEvidenceForestTable(model,search,opts),/data-tree-node="R-SYN-A"/,'explicit collapse works while retaining the query');
  assert.deepEqual(search.opened,[root.node.id],'search collapse does not mutate the pre-search expansion');
  toggleResearchNode(search,middle.node.id);
  assert.match(renderEvidenceForestTable(model,search,opts),/data-tree-node="R-SYN-A"/);
  const basal=renderEvidenceForestTable(model,{macro:'R'},opts);
  assert.match(basal,/researchMacroContext/,'hidden descendant macrogroups are disclosed even when the visible root itself matches');
  const {activeCountryFilter}=await loadModule('app/research-display-state.ts');
  assert.deepEqual(activeCountryFilter(['RUS'],a.countryCounts),[]);
  assert.deepEqual(activeCountryFilter(['POL','RUS'],root.countryCounts),[]);
  assert.deepEqual(activeCountryFilter(['POL'],root.countryCounts),['POL']);
  assert.doesNotMatch(renderEvidenceForestTable(model,{countries:['RUS','POL']},opts),/data-tree-country="[^"]+" aria-pressed="true"|data-tree-country-reset/);
}
