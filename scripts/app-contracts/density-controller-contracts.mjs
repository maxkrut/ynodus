import assert from "node:assert/strict";
import { loadModule } from "./runtime.mjs";
import { analysisState } from "./fixtures.mjs";

export async function assertDensityController() {
  const { createDensityController } = await loadModule("app/density-controller.ts");
  const { densityScopeIdentity } = await loadModule("shared/density-identity.ts");
  const state = analysisState(), pending = [];
  const rows = state.results;
  const first = [{ older: 1000, younger: 0 }], second = [{ older: 1000, younger: 500 }, { older: 500, younger: 0 }];
  const key = bins => densityScopeIdentity(state.index, ["AA"], "all", null, 7, bins);
  const client = { request: input => new Promise((resolve, reject) => pending.push({ input, resolve, reject })) };
  let renders = 0;
  const update = createDensityController(state, () => client, () => renders++);
  const flush = async () => { for (let i=0;i<5;i++) await Promise.resolve(); };
  update(first); update(second);
  assert.equal(pending.length, 2);
  pending[0].resolve({type:"density",densityKey:key(first),densityRows:[{total:99}]});
  await flush();
  assert.equal(state.densityKey,null,"an old grid cannot commit");
  pending[1].resolve({type:"density",densityKey:key(second),densityRows:[{total:2}]});
  await flush();
  assert.equal(state.densityKey,key(second));
  assert.equal(renders,1);
  assert.equal(update(second).pending,false);
  update(first); update(second);
  pending[2].reject(new Error("superseded")); await flush();
  assert.equal(state.densityRows[0].total,2,"a stale failure cannot clear the ready chart");
  state.analysisBusy=true;
  update(first);
  assert.equal(pending.length,3,"the table query supplies chart data while pending");
  state.analysisBusy=false;
  update(first);
  state.index=null; update(second);
  pending[3].resolve({type:"density",densityKey:"old-index",densityRows:[{total:99}]}); await flush();
  assert.equal(state.densityRows[0].total,2,"an obsolete index cannot commit");
  assert.equal(state.results,rows,"chart-only work never replaces table results");
}
