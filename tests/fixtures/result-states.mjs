import { compact } from '../../scripts/semantic-audit/fixtures.mjs';
const resultCountries = ['RUS','POL','UKR','DEU','FIN','GBR','FRA','AUT','ITA','KAZ','CHN','IND','USA','CAN','ESP','PRT','NOR','SWE','DNK','NLD'];
export const resultStateQuery = '/?view=time&lang=ru&target=5500&window=100&min=0&presence=any&crossing=1&countries=' + resultCountries.join(',');
export function resultStatesFixture() {
  const parents=[], ages=[], samples=[], names=[], projects=[];
  for(let i=0;i<120;i++) {
    parents.push(-1); ages.push(5500+i%5); projects.push(i%2);
    names.push((i%2 ? 'I' : 'R') + '-SYN-LONG-IDENTIFIER-' + String(i).padStart(3,'0'));
    for(let c=0;c<resultCountries.length;c++) samples.push([i,c,1+(i+c)%9]);
  }
  for(let i=0;i<3;i++) {
    const n=parents.length; parents.push(-1,n); ages.push(18000,2500); projects.push(0,0);
    names.push('R-SYN-PARENT-LONG-' + i,'R-SYN-CHILD-LONG-' + i);
    samples.push([n+1,0,5]);
  }
  const data=compact(parents,ages,samples);data.nodeIds=names;data.projectIds=['R1a','I2'];data.countryCodes=resultCountries;
  data.countryCounts=resultCountries.map((_,c)=>samples.filter(row=>row[1]===c).reduce((sum,row)=>sum+row[2],0));
  data.hrasManifestSampleCount=data.countryCounts.reduce((a,b)=>a+b,0);
  data.nodes.forEach((node,i)=>node[0]=projects[i]);return data;
}
