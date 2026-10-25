import type { CountryOverview, EvidenceTreeNode } from "../shared/types";
import type { ProfileMatrixOptions } from "./profile-matrix";
import { renderEvidenceForestTable, bindEvidenceTreeKeys } from "./evidence-tree-table";

export type CountryTreeState = { country: string; query: string; limits: Array<[string,number]>;
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
  };
  function renderBody():void {
    const body=find("[data-country-tree-body]");if(!body||!overview||!state)return;
    const supports=(node:EvidenceTreeNode)=>!state!.countries?.length||state!.countries.some(code=>(node.countryCounts.get(code)??0)>0);
    const selected=nodes.get(state.selected??"");
    if(!selected||!supports(selected)){
      state.selected=overview.roots.find(supports)?.node.id;state.countriesOpen=false;inspect();
    }
    const countryCounts=overview.countryCounts??new Map([[overview.country,overview.total]]);
    body.innerHTML=renderEvidenceForestTable({roots:overview.roots,countryCounts},{
      query:state.query,closed:state.closed,limits:state.limits,countries:state.countries,selected:state.selected,offset:state.offset,pageSize:100
    },{...o,ancientBreakdown:()=>false});
    const pane=find(".tree-sheet-scroll");if(pane){pane.scrollLeft=state.treeScrollLeft??0;state.offset=Number(pane.dataset.treeOffset);}
    const filter=find<HTMLSelectElement>("[data-country-tree-filter]");if(filter)filter.value=state.countries?.[0]??"";
    const reset=find<HTMLButtonElement>(".profile-country-reset");if(reset)reset.disabled=!state.countries?.length;
  }
  o.root.addEventListener("input",event=>{
    const input=event.target as HTMLInputElement;if(!state||!input.matches("[data-country-tree-search]"))return;
    state.query=input.value;state.offset=0;renderBody();o.onChange();
  });
  o.root.addEventListener("change",event=>{
    const select=event.target as HTMLSelectElement;if(!state||!select.matches("[data-country-tree-filter]"))return;
    state.countries=select.value?[select.value]:[];state.closed=[];state.offset=0;renderBody();o.onChange();
  });
  o.root.addEventListener("toggle",event=>{
    const details=event.target;if(!state||!(details instanceof HTMLDetailsElement))return;
    if(details.matches("[data-country-node-details]")&&state.inspectorOpen!==details.open){state.inspectorOpen=details.open;o.onChange();}
    if(details.matches("[data-profile-countries]")&&state.countriesOpen!==details.open){state.countriesOpen=details.open;o.onChange();}
  },true);
  o.root.addEventListener("scroll",event=>{if(state&&event.target instanceof HTMLElement&&event.target.matches(".tree-sheet-scroll")){state.treeScrollLeft=event.target.scrollLeft;o.onChange();}},{capture:true,passive:true});
  o.root.addEventListener("click",event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>("[data-profile-select], [data-evidence-tree-toggle], [data-evidence-tree-more], [data-evidence-tree-page], [data-tree-country], [data-tree-country-reset]");
    if(!button||!state||!overview)return;
    const id=button.dataset.evidenceTreeToggle;
    if(id){const closed=new Set(state.closed);closed.has(id)?closed.delete(id):closed.add(id);state.closed=[...closed];}
    if(button.dataset.profileSelect){if(state.selected!==button.dataset.profileSelect)state.countriesOpen=false;state.selected=button.dataset.profileSelect;state.inspectorOpen=true;inspect();}
    if(button.dataset.evidenceTreeMore){const limits=new Map(state.limits),id=button.dataset.evidenceTreeMore;limits.set(id,(limits.get(id)??20)+20);state.limits=[...limits];}
    if(button.dataset.evidenceTreePage)state.offset=Math.max(0,(state.offset??0)+(button.dataset.evidenceTreePage==="next"?100:-100));
    if(button.dataset.treeCountry||button.hasAttribute("data-tree-country-reset")){state.countries=button.dataset.treeCountry?[button.dataset.treeCountry]:[];state.closed=[];state.offset=0;}
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
    if(!value){overview=null;nodes.clear();return;}
    overview=value;nodes.clear();const pending=[...value.roots];while(pending.length){const node=pending.pop()!;nodes.set(node.node.id,node);pending.push(...node.children);}
    if(state?.country!==value.country)state={country:value.country,query:"",closed:[],limits:[],offset:0,countries:[]};
    if(!nodes.has(state.selected??""))state.selected=value.roots[0]?.node.id;
    state.countries=state.countries?.filter(code=>(value.countries??[value.country]).includes(code));
    const input=find<HTMLInputElement>("[data-country-tree-search]");if(input)input.value=state.query;
    inspect();renderBody();
  }
  return {render,capture:()=>state?{...state}:undefined,restore:(saved?:CountryTreeState)=>{if(saved && saved.country===overview?.country)state={...saved};}};
}
