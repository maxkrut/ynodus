import assert from "node:assert/strict";
import { compact } from "../semantic-audit/fixtures.mjs";

export function assertResultNeighbors(buildIndex, collect, resetCaches) {
  resetCaches();
  const input = { target: 500, selectedCountries: ["AAA", "BBB"], presenceMode: "all",
    sliceMode: "formed", maxDeltaYbp: 0, minSamples: 5, anchorId: null, scopeAllCountries: false };
  const skipped = buildIndex(compact([-1,-1,-1,-1], [490,510,400,600],
    [[0,0,1],[1,1,1],[2,0,7],[3,1,8]]));
  assert.deepEqual(collect(skipped,input).suggestions, {older:600,younger:400},
    "skip empty nearest dates on both sides instead of dropping their suggestions");
  const none = collect(skipped,{...input,minSamples:99});
  assert.deepEqual(none.suggestions,{older:null,younger:null}, "never propose an implicit All-branches reset");
  const strictQuery = { ...input, minSamples: 0 };
  assert.deepEqual(collect(skipped, strictQuery).suggestions, { older: null, younger: null },
    "no common source date means no strict-zero suggestions, even when individual countries have records");
  resetCaches();
  const shared = buildIndex(compact([-1,-1,-1,-1], [490,510,400,600],
    [[0,0,1],[1,1,1],[2,0,7],[2,1,2],[3,0,3],[3,1,8]]));
  assert.deepEqual(collect(shared, strictQuery).suggestions, {older:600,younger:400},
    "strict zero skips nearer dates missing a selected country");
  assert.deepEqual(collect(shared, { ...strictQuery, selectedCountries: ["AAA","BBB","CCC"] }).suggestions,
    { older: null, younger: null }, "a country absent everywhere cannot silently disappear from suggestions");
  resetCaches();
  const codes=Array.from({length:181},(_,i)=>"A"+String.fromCharCode(65+Math.floor(i/26),65+i%26));
  const samples=codes.flatMap((_,i)=>i<180 ? [[0,i,1],[1,i,1]] : [[1,i,1]]);
  const manyData=compact([-1,-1],[450,650],samples);
  manyData.countryCodes=codes; manyData.countryCounts=codes.map((_,i)=>i<180?2:1);
  manyData.hrasManifestSampleCount=361;
  const many=buildIndex(manyData);
  const manyQuery={...strictQuery,target:450,selectedCountries:codes};
  assert.deepEqual(collect(many,manyQuery).rows,[],"180 of 181 countries is not a strict match");
  assert.deepEqual(collect(many,manyQuery).suggestions,{older:650,younger:null},
    "nearest-date country masks retain all 181 selected countries");
  assert.equal(collect(many,{...manyQuery,minSamples:1}).rows.length,1);

  // Independent oracle: execute the full production query at every supported
  // source date, then compare with the compact sweep. Includes age inversions,
  // equal ages, unknown ages, anchor scope, nested support and changing pools.
  let seed = 12345, checked = 0;
  const random = limit => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed % limit; };
  for (let fixture=0; fixture<18; fixture++) {
    resetCaches();
    const parents=[-1], ages=[900], samples=[];
    for (let i=1;i<9;i++) { parents.push(random(4)===0 ? -1 : random(i)); ages.push(random(5)===0 ? null : 100+100*random(8)); }
    for (let i=0;i<9;i++) for (let country=0;country<3;country++) {
      const count=random(5); if(count) samples.push([i,country,count]);
    }
    const index=buildIndex(compact(parents,ages,samples));
    for (const minimum of [0,3,10,999]) for (const width of [0,50,150]) {
      const query={...input, selectedCountries:["AAA","BBB","CCC"],target:450,
        minSamples:minimum,maxDeltaYbp:width,anchorId:fixture%3===0 ? index.samplesByCountry.get("AAA")?.[0]?.path[0]?.id ?? null : null};
      const result=collect(index,query);
      if(result.rows.length) continue;
      const dates=new Set();
      for(const code of query.selectedCountries) for(const sample of index.samplesByCountry.get(code) ?? []) {
        const start=query.anchorId ? sample.path.findIndex(node=>node.id===query.anchorId) : 0;
        if(start<0) continue;
        for(const node of sample.path.slice(start)) if(node.formedKnown!==false) dates.add(node.formed);
      }
      const valid=[...dates].filter(date=>collect(index,{...query,target:date,includeSuggestions:false}).rows.length);
      const older=valid.filter(date=>date>query.target), younger=valid.filter(date=>date<query.target);
      assert.deepEqual(result.suggestions,{older:older.length?Math.min(...older):null,younger:younger.length?Math.max(...younger):null},
        `nearest query mismatch: fixture=${fixture} min=${minimum} window=${width}`);
      checked++;
    }
  }
  assert.ok(checked>50,"exercise enough empty searches against the independent oracle");
}
