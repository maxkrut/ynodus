export type CountryRegionKey =
  | "africa"
  | "asia"
  | "europe"
  | "northAmerica"
  | "southAmerica"
  | "oceania"
  | "other";

const REGION_CODES: Record<Exclude<CountryRegionKey, "other">, ReadonlySet<string>> = {
  africa: codeSet(`
    AGO BDI BEN BFA BWA CAF CMR COD CPV DJI DZA EGY ERI ESH ETH GAB GHA GIN GMB GNB
    KEN LBR LBY MAR MDG MLI MRT NAM NER NGA RWA SDN SEN SLE SOM SSD SWZ TCD TUN UGA
    ZAF ZWE
  `),
  asia: codeSet(`
    AFG ARM AZE BGD BHR CHN CYP GEO HKG IDN IND IRN IRQ ISR JOR JPN KAZ KGZ KHM KOR
    KWT LAO LBN LKA MAC MMR MNG MYS NPL OMN PAK PHL PRK PSE QAT SAU SGP SYR THA TJK
    TKM TUR TWN UAE UZB VNM YEM
  `),
  europe: codeSet(`
    ALA ALB AND AUT BEL BGR BIH BLR CHE CZE DEU DNK ENG ESP EST FIN FRA FRO GBR GGY GIB
    GRC HRV HUN IMN IRL ISL ITA JEY LTU LUX LVA MDA MKD MLT MNE NLD NOR POL PRT ROU
    RUS SCT SRB SVK SVN SWE UKR WLS
  `),
  northAmerica: codeSet(`
    ANT BMU BRB CAN CRI CUB DMA DOM GRD GRL GTM HND HTI JAM MEX MSR MTQ NIC PAN PRI SLV
    TTO USA VCT VGB
  `),
  southAmerica: codeSet(`
    ARG BOL BRA CHL COL ECU GUY PER PRY SUR URY VEN
  `),
  oceania: codeSet(`
    AUS GUM NZL PNG PYF WSM
  `),
};

const REGION_ORDER: CountryRegionKey[] = [
  "europe",
  "asia",
  "africa",
  "northAmerica",
  "southAmerica",
  "oceania",
  "other",
];

export function countryRegionKey(code: string): CountryRegionKey {
  const normalized = code.toUpperCase();
  for (const region of REGION_ORDER) {
    if (region !== "other" && REGION_CODES[region].has(normalized)) return region;
  }
  return "other";
}

export function countryRegionOrder(region: CountryRegionKey): number {
  return REGION_ORDER.indexOf(region);
}

function codeSet(value: string): ReadonlySet<string> {
  return new Set(value.trim().split(/\s+/));
}
