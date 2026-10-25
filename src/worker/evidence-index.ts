import type { SampleRecord } from "./types";
import type { SignatureRow } from "../shared/types";

type EvidenceIndexes = {
  signatureIndex: Map<string, SignatureRow>;
  samplesByClade: Map<string, SampleRecord[]>;
};

export function buildEvidenceIndexes(samples: readonly SampleRecord[]): EvidenceIndexes {
  const signatureIndex = new Map<string, SignatureRow>();
  const samplesByClade = new Map<string, SampleRecord[]>();

  for (const sample of samples) {
    for (const node of sample.path) {
      const signature =
        signatureIndex.get(node.id) ??
        ({
          node,
          total: 0,
          countryCounts: new Map<string, number>(),
        } satisfies SignatureRow);

      signature.total += sample.count;
      if (sample.ancientCount !== undefined) {
        signature.ancientTotal = (signature.ancientTotal ?? 0) + sample.ancientCount;
        signature.ancientCountryCounts ??= new Map();
        signature.ancientCountryCounts.set(sample.country, (signature.ancientCountryCounts.get(sample.country) ?? 0) + sample.ancientCount);
      }
      signature.countryCounts.set(
        sample.country,
        (signature.countryCounts.get(sample.country) ?? 0) + sample.count,
      );
      signatureIndex.set(node.id, signature);

      const cladeSamples = samplesByClade.get(node.id) ?? [];
      cladeSamples.push(sample);
      samplesByClade.set(node.id, cladeSamples);
    }
  }

  return { signatureIndex, samplesByClade };
}
