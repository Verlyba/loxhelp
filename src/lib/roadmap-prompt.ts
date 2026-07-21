// Builds the copy-paste prompt (+ JSON template) a teacher takes to any AI
// chat, alongside the school's ŠVP PDF, to produce one subject's roadmap.

export interface RoadmapTopicDraft {
  title: string;
  covers: string;
  outcomes: string;
}

export const ROADMAP_JSON_TEMPLATE = {
  topics: [
    {
      title: "Název tematického celku",
      covers: "Co se v tomto celku probírá (učivo) podle ŠVP.",
      outcomes: "Co má žák po probrání umět (výstupy) podle ŠVP.",
    },
  ],
};

export function roadmapJsonTemplateText(): string {
  return JSON.stringify(ROADMAP_JSON_TEMPLATE, null, 2);
}

export function buildRoadmapPrompt(subject: string, part: string, grade: string): string {
  const scope = part.trim()
    ? `předmětu „${subject.trim()}“, část „${part.trim()}“, ${grade.trim()}`
    : `předmětu „${subject.trim()}“, ${grade.trim()}`;

  return `Jsi asistent připravující výukovou roadmapu ze školního vzdělávacího programu (ŠVP).

V přiloženém ŠVP dokumentu (PDF) najdi řádky týkající se ${scope}. ŠVP má u každého předmětu dva sloupce: co se má probrat (učivo) a co má žák umět (výstupy).

Pro každý tematický celek/období v pořadí, jak jde v ŠVP za sebou, vytvoř jeden objekt s poli:
- "title": krátký název tématu/celku
- "covers": co se má probrat — přepiš/shrň sloupec "učivo" pro tento celek
- "outcomes": co má žák umět — přepiš/shrň sloupec "výstupy" pro tento celek

Odpověz POUZE JSON objektem přesně podle této šablony, žádný další text kolem:

${roadmapJsonTemplateText()}`;
}
