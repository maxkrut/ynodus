import type { CountryOverview, Locale, TreeIndexSummary } from "../shared/types";
import { localizedText, type TextKey } from "./i18n";
import { escapeHtml as h } from "../shared/html";
import { renderCountryListHtml, type CountryPanelContext } from "./country-panel";
import { COUNTRY_PRESETS } from "./presets";
import { availablePresetCountries } from "./query-model";

type Options={root:HTMLElement;index:()=>TreeIndexSummary|null;locale:()=>Locale;t:(key:TextKey)=>string;
  countryName:(code:string)=>string;countryFlag:(code:string)=>string;formatNumber:(n:number)=>string;onApply:(countries:string[])=>void};
export function createCountryComparisonPicker(o:Options){
  let overview:CountryOverview|null=null,key="",opened=false,filter="",preset="",draft=new Set<string>();
  const find=<T extends HTMLElement=HTMLElement>(selector:string)=>o.root.querySelector<T>(selector);
  const selected=()=>overview?.countries??(overview?[overview.country]:[]);
  const context=():CountryPanelContext=>({index:o.index(),locale:o.locale(),t:o.t,countryName:o.countryName,countryFlag:o.countryFlag,formatNumber:o.formatNumber,
    activePreset:null,selectedCountries:draft,countryFilter:filter,localizedText:value=>localizedText(value,o.locale())});
  function counter(){const count=find("[data-comparison-count]");if(count)count.textContent=`${o.t("selectedCountries")}: ${o.formatNumber(draft.size)}`;
    const apply=find<HTMLButtonElement>("[data-comparison-apply]");if(apply)apply.disabled=selected().length===draft.size&&selected().every(code=>draft.has(code));}
  function list(){const host=find("[data-comparison-list]");if(host)host.innerHTML=renderCountryListHtml(context());
    const primary=find<HTMLInputElement>(`[data-comparison-list] input[value="${overview?.country}"]`);if(primary)primary.disabled=true;counter();}
  function close(){opened=false;find<HTMLDialogElement>("[data-comparison-dialog]")?.close();find("[data-country-comparison-open]")?.focus();}
  function show(){const dialog=find<HTMLDialogElement>("[data-comparison-dialog]");if(dialog&&!dialog.open)dialog.showModal();}
  function render(value:CountryOverview|null){
    overview=value;if(!value){opened=false;return;}
    const next=value.country+":"+selected().join();if(key!==next){key=next;opened=false;filter="";preset="";draft=new Set(selected());}
    const host=find("[data-country-comparison-picker]");if(!host)return;
    host.innerHTML=`<dialog class="country-comparison-dialog" data-comparison-dialog aria-labelledby="country-comparison-title"><header><strong id="country-comparison-title">${h(o.t("countryComparisonChoose"))}</strong><button type="button" data-comparison-close aria-label="${h(o.t("closeCountryPicker"))}">×</button></header>
      <div class="country-comparison-tools"><label>${h(o.t("conditionalPresets"))}<select data-comparison-preset><option value="">${h(o.t("choosePreset"))}</option>${COUNTRY_PRESETS.map(item=>`<option value="${h(item.key)}"${item.key===preset?" selected":""}>${h(localizedText(item.label,o.locale()))}</option>`).join("")}</select></label>
      <label>${h(o.t("filterCountries"))}<input type="search" data-comparison-search value="${h(filter)}" autocomplete="off"></label><small>${h(o.t("presetSelectionCaveat"))}</small></div>
      <div class="country-list" data-comparison-list></div><footer><span data-comparison-count role="status"></span><button type="button" data-comparison-close>${h(o.t("countryComparisonCancel"))}</button><button type="button" class="accent-button" data-comparison-apply>${h(o.t("countryComparisonApply"))}</button></footer></dialog>`;
    list();if(opened)show();
  }
  o.root.addEventListener("input",event=>{const input=event.target as HTMLInputElement;if(input.matches("[data-comparison-search]")){filter=input.value;list();}});
  o.root.addEventListener("change",event=>{
    const input=event.target as HTMLInputElement;if(!overview)return;
    if(input.matches("[data-comparison-list] [data-country-code]")){input.checked?draft.add(input.value):draft.delete(input.value);counter();}
    if(input.matches("[data-comparison-preset]")){preset=input.value;const item=COUNTRY_PRESETS.find(item=>item.key===preset);if(item){draft=new Set([overview.country,...availablePresetCountries(o.index(),item)]);list();}}
  });
  o.root.addEventListener("cancel",event=>{if((event.target as HTMLElement).matches("[data-comparison-dialog]"))opened=false;},true);
  o.root.addEventListener("click",event=>{
    const dialog=find<HTMLDialogElement>("[data-comparison-dialog]");
    if(dialog&&event.target===dialog){const box=dialog.getBoundingClientRect();
      if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();return;}
    if(!overview)return;const button=(event.target as HTMLElement).closest<HTMLButtonElement>("button");if(!button)return;
    if(button.hasAttribute("data-country-comparison-open")){draft=new Set(selected());filter="";preset="";opened=true;render(overview);show();}
    if(button.hasAttribute("data-comparison-close"))close();
    if(button.hasAttribute("data-comparison-apply")){const countries=[...draft].sort();close();o.onApply(countries);}
    if(button.dataset.countryComparisonRemove)o.onApply(selected().filter(code=>code!==button.dataset.countryComparisonRemove));
    if(button.closest("[data-comparison-list]")&&button.dataset.countryAction){draft=new Set(button.dataset.countryAction==="all"?[...(o.index()?.countries.keys()??[])]:[]);draft.add(overview.country);list();}
  });
  return{render};
}
