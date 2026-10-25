import type { CountryOverview, EvidenceTreeNode } from "../shared/types";
import type { ProfileMatrixOptions } from "./profile-matrix";
import { renderEvidenceForestTable, bindEvidenceTreeKeys } from "./evidence-tree-table";
import { compactTreeOpened, researchMacroSummary, toggleResearchNode, macroResearchForest, macroResearchPaths } from "./research-tree-reading";
import { nodeMacroGroup } from "../shared/haplogroups";
import { activeCountryFilter, deferredResearchRender, restoreCountrySearch } from "./research-display-state";

export type CountryTreeState = { country: string; query: string; limits: Array<[string,number]>;
  macro?: string;
  opened?: string[];
  browse?: boolean;
  searchClosed?: string[]; countrySearch?: string;
  closed?: string[]; countries?: string[]; offset?: number; selected?: string; inspectorOpen?: boolean; countriesOpen?: boolean; treeScrollLeft?: number };
type Options = ProfileMatrixOptions & { root: HTMLElement; onChange: () => void; inspector: (node: EvidenceTreeNode,isRoot:boolean) => string };
export function createCountryOverviewTree(o: Options) {
  let overview: CountryOverview | null=null, state: CountryTreeState | undefined;
  const nodes=new Map<string,EvidenceTreeNode>();
  const find=<T extends HTMLElement=HTMLElement>(selector:string)=>o.root.querySelector<T>(selector);
  bindEvidenceTreeKeys(o.root);
  const inspect=()=>{
    const node=nodes.get(state?.selected??""),host=find("[data-profile-inspector]"),details=find<HTMLDetailsElement>("[data-country-node-details]");
    if(host)host.innerHTML=node?o.inspector(node,false):"";
    if(details){details.hidden=!node;details.open=!!node&&state?.inspectorOpen===true;}
    const countries=find<HTMLDetailsElement>("[data-profile-countries]");if(countries)countries.open=state?.countriesOpen===true;
    restoreCountrySearch(o.root,state?.countrySearch);
  };
  function renderBody():void {
    deferred.cancel();
    const body=find("[data-country-tree-body]");if(!body||!overview||!state)return;
    const supports=(node:EvidenceTreeNode)=>!state!.countries?.length||state!.countries.some(code=>(node.countryCounts.get(code)??0)>0);
    const countryCounts=overview.countryCounts??new Map([[overview.country,overview.total]]);
    const macroRoots=state.macro?macroResearchForest(overview.roots,state.macro).filter(entry=>supports(entry.node)):null;
    const selected=nodes.get(state.selected??"");
    if(!selected||!supports(selected)||(state.macro&&nodeMacroGroup(selected.node)!==state.macro)){
      state.selected=macroRoots?macroRoots[0]?.node.node.id:overview.roots.find(supports)?.node.id;
      state.inspectorOpen=false;state.countriesOpen=false;inspect();
    }
    body.innerHTML=!state.browse && !state.macro && !state.query.trim() ? researchMacroSummary(overview.roots,state.countries??[],o)
      : (macroRoots?macroResearchPaths(macroRoots,o):"")+renderEvidenceForestTable({roots:macroRoots?.map(entry=>entry.node)??overview.roots,countryCounts},{
      query:state.query,searchClosed:state.searchClosed,macro:state.macro,opened:state.opened,closed:state.closed,limits:state.limits,countries:state.countries,selected:state.selected,offset:state.offset,pageSize:100
    },{...o,ancientBreakdown:()=>false});
    const macro=find<HTMLSelectElement>("[data-research-macro]");if(macro)macro.value=state.macro??"";
    const pane=find(".tree-sheet-scroll");if(pane){pane.scrollLeft=state.treeScrollLeft??0;state.offset=Number(pane.dataset.treeOffset);}
    const active = activeCountryFilter(state.countries,countryCounts);
    const filter=find<HTMLSelectElement>("[data-country-tree-filter]");if(filter)filter.value=active[0]??"";
    const reset=find<HTMLButtonElement>(".profile-country-reset");if(reset)reset.disabled=!active.length;
  }
  const deferred=deferredResearchRender(renderBody);
  o.root.addEventListener("input",event=>{
    const input=event.target as HTMLInputElement;if(!state)return;
    if(input.matches("[data-profile-country-search]")){if(state.countrySearch!==input.value){state.countrySearch=input.value;o.onChange();}return;}
    if(!input.matches("[data-country-tree-search]"))return;
    state.query=input.value;state.searchClosed=[];state.offset=0;deferred.schedule();o.onChange();
  });
  o.root.addEventListener("change",event=>{
    const select=event.target as HTMLSelectElement;if(!state||!overview)return;
    if(select.matches("[data-research-macro]")){state.macro=select.value;state.query="";state.browse=false;state.opened=compactTreeOpened(overview.roots,state.macro);const search=find<HTMLInputElement>("[data-country-tree-search]");if(search)search.value="";}
    else if(select.matches("[data-country-tree-filter]"))state.countries=select.value?[select.value]:[];
    else return;
    state.offset=0;renderBody();o.onChange();
  });
  o.root.addEventListener("toggle",event=>{
    const details=event.target;if(!state||!(details instanceof HTMLDetailsElement))return;
    if(details.matches("[data-country-node-details]")&&state.inspectorOpen!==details.open){state.inspectorOpen=details.open;o.onChange();}
    if(details.matches("[data-profile-countries]")&&state.countriesOpen!==details.open){state.countriesOpen=details.open;o.onChange();}
  },true);
  o.root.addEventListener("scroll",event=>{if(state&&event.target instanceof HTMLElement&&event.target.matches(".tree-sheet-scroll")){state.treeScrollLeft=event.target.scrollLeft;o.onChange();}},{capture:true,passive:true});
  o.root.addEventListener("click",event=>{
    if(state&&overview&&(event.target as HTMLElement).closest("[data-research-expand]")){
      state.browse=true;state.opened=undefined;state.closed=[];state.searchClosed=[];state.offset=0;renderBody();o.onChange();return;
    }
    const group=(event.target as HTMLElement).closest<HTMLButtonElement>("[data-research-group], [data-research-collapse]");
    if(group&&state&&overview){
      state.macro=group.dataset.researchGroup??"";state.query="";state.offset=0;state.limits=[];state.opened=compactTreeOpened(overview.roots,state.macro);
      state.browse=false;
      const search=find<HTMLInputElement>("[data-country-tree-search]");if(search)search.value="";
      renderBody();find("[data-research-macro]")?.focus({preventScroll:true});o.onChange();return;
    }
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>("[data-profile-select], [data-evidence-tree-toggle], [data-evidence-tree-more], [data-evidence-tree-page], [data-tree-country], [data-tree-country-reset]");
    if(!button||!state||!overview)return;
    const id=button.dataset.evidenceTreeToggle;
    if(id)toggleResearchNode(state,id);
    if(button.dataset.profileSelect){if(state.selected!==button.dataset.profileSelect){state.countriesOpen=false;state.countrySearch="";}state.selected=button.dataset.profileSelect;state.inspectorOpen=true;inspect();}
    if(button.dataset.evidenceTreeMore){const limits=new Map(state.limits),id=button.dataset.evidenceTreeMore;limits.set(id,(limits.get(id)??20)+20);state.limits=[...limits];}
    if(button.dataset.evidenceTreePage)state.offset=Math.max(0,(state.offset??0)+(button.dataset.evidenceTreePage==="next"?100:-100));
    if(button.dataset.treeCountry||button.hasAttribute("data-tree-country-reset")){state.countries=button.dataset.treeCountry?[button.dataset.treeCountry]:[];state.offset=0;}
    renderBody();
    const focus=id?`[data-evidence-tree-toggle="${CSS.escape(id)}"]`
      :button.dataset.treeCountry?`.matrix-country-heading[data-tree-country="${button.dataset.treeCountry}"]`
      :button.dataset.profileSelect?`[data-profile-select="${CSS.escape(button.dataset.profileSelect)}"]`
      :button.dataset.evidenceTreeMore?`[data-evidence-tree-more="${CSS.escape(button.dataset.evidenceTreeMore)}"]`
      :button.dataset.evidenceTreePage?`[data-evidence-tree-page="${button.dataset.evidenceTreePage}"]:not(:disabled)`
      :button.hasAttribute("data-tree-country-reset")?"[data-country-tree-filter]":null;
    if(focus)(find(focus)??find(".tree-sheet-scroll"))?.focus({preventScroll:true});
    if(button.dataset.evidenceTreePage){const pane=find(".tree-sheet-scroll"),first=pane?.querySelector<HTMLElement>("tbody tr:not(.tree-context-row)");if(pane&&first)pane.scrollTop=Math.max(0,first.offsetTop-(pane.querySelector<HTMLElement>("thead")?.offsetHeight??0));}
    o.onChange();
  });
  function render(value:CountryOverview|null):void {
    deferred.cancel();
    if(!value){overview=null;nodes.clear();return;}
    overview=value;nodes.clear();const pending=[...value.roots];while(pending.length){const node=pending.pop()!;nodes.set(node.node.id,node);pending.push(...node.children);}
    if(state?.country!==value.country)state={country:value.country,query:"",opened:compactTreeOpened(value.roots),limits:[],offset:0,countries:[]};
    if(state.macro&&!value.groups.some(group=>group.project===state!.macro))state.macro="";
    if(!nodes.has(state.selected??""))state.selected=value.roots[0]?.node.id;
    state.countries=state.countries?.filter(code=>(value.countries??[value.country]).includes(code));
    const input=find<HTMLInputElement>("[data-country-tree-search]");if(input)input.value=state.query;
    inspect();renderBody();
  }
  return {render,capture:()=>state?{...state}:undefined,restore:(saved?:CountryTreeState)=>{if(saved && saved.country===overview?.country)state={...saved};}};
}
