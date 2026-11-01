/**
 * Resumos simples, gerados por regras a partir de campos oficiais. Não há modelos de linguagem
 * nem leitura de PDF: cada frase vem de um campo do registo, ou é uma definição genérica.
 *
 * - `simple` só contém factos do registo.
 * - `meaning` é contexto geral escrito pela plataforma, nunca uma conclusão sobre o caso.
 * - Títulos que não se percebem sozinhos ficam sem resumo.
 */

import type { Contract, Decision, Meeting, Outcome, Source } from "@prisma/client";
import { BODY_LABEL, formatDate, formatEur, OUTCOME_LABEL, voteSummary } from "./format";

export const SUMMARY_UNAVAILABLE = "Resumo não disponível. Consulte o documento oficial.";

export const SUMMARY_TYPE_LABEL: Record<string, string> = {
  reuniao: "Reunião",
  decisao: "Decisão",
  contrato: "Contrato",
  regulamento: "Regulamento",
  orcamento: "Orçamento",
  documento: "Documento",
  procedimento: "Concurso",
};

export type SummaryDraft = {
  entityType: string;
  entityKey: string;
  title: string;
  available: boolean;
  simple: string | null;
  meaning: string | null;
  decidedBy: string;
  status: string;
  date: Date | null;
  href: string | null;
  sourceUrl: string;
};

const CONTEXT_RULES: [RegExp, string][] = [
  [/\bimi\b/i, "O IMI é o imposto anual pago pelos proprietários de imóveis, e parte das regras é definida por cada município."],
  [/\birs\b/i, "Os municípios podem ficar com uma parte do IRS dos seus residentes ou devolvê-la aos contribuintes."],
  [/derrama/i, "A derrama é um imposto municipal sobre o lucro das empresas."],
  [/direitos de passagem/i, "Esta taxa incide sobre a faturação dos serviços de comunicações eletrónicas e pode ser refletida na fatura dos clientes."],
  [/documentos previsionais|or[çc]amento/i, "O orçamento define quanto o Município prevê receber e gastar durante o ano."],
  [/empr[ée]stimo/i, "Um empréstimo é dinheiro que o Município recebe e terá de devolver com juros, nos prazos contratados."],
  [/regulamento/i, "Um regulamento define regras aplicáveis no concelho. O texto oficial indica a quem se aplica e desde quando."],
  [/recomenda[çc][ãa]o|mo[çc][ãa]o|sauda[çc][ãa]o|voto de/i, "Uma moção ou recomendação exprime uma posição ou um pedido do órgão. Por si só, não altera regras nem orçamentos."],
];

const PROCEDURE_RULES: [RegExp, string][] = [
  [/concurso p[úu]blico/i, "Num concurso público, qualquer interessado que cumpra os requisitos pode apresentar proposta."],
  [/concurso limitado/i, "Num concurso limitado, só os candidatos qualificados numa primeira fase apresentam proposta."],
  [/consulta pr[ée]via/i, "Na consulta prévia, a entidade convida diretamente várias entidades a apresentar proposta."],
  [/ajuste direto/i, "No ajuste direto, a entidade convida diretamente um fornecedor, dentro dos limites previstos na lei."],
  [/acordo-quadro/i, "Este contrato decorre de um acordo-quadro, que fixa condições prévias para compras futuras."],
];

/** "O Município de...", "Os SMAS..." em vez de um genérico "a entidade". */
function subject(name: string): string {
  if (/^Munic[íi]pio/i.test(name)) return `O ${name}`;
  if (/^(SMAS|Servi[çc]os)/i.test(name)) return `Os ${name}`;
  if (/^(C[âa]mara|Assembleia|Uni[ãa]o|Freguesia)/i.test(name)) return `A ${name}`;
  return `A entidade ${name}`;
}

const firstMatch = (rules: [RegExp, string][], text: string) => rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;

const stripDot = (text: string) => text.trim().replace(/[.;:]+$/, "");

/** Sem isto, resumir-se-iam nomes de ficheiro como "AM2021_EDITAL 13". */
export function isClearTitle(title: string): boolean {
  if (/_|^Documento da Assembleia|\.pdf$/i.test(title)) return false;
  const words = title.match(/\p{L}{3,}/gu) ?? [];
  return words.length >= 4;
}

const OUTCOME_VERB: Record<Outcome, string | null> = {
  APROVADO: "aprovou",
  REPROVADO: "rejeitou",
  ADIADO: "adiou",
  RETIRADO: "retirou da discussão",
  TOMADA_CONHECIMENTO: "tomou conhecimento de",
  REMETIDO: "remeteu a comissão",
  POR_PUBLICAR: null,
};

type DecisionInput = Pick<Decision, "slug" | "title" | "outcome" | "voteMode" | "votesFor" | "votesAgainst" | "abstentions" | "proposalRef"> & {
  meeting: Pick<Meeting, "slug" | "body" | "date">;
  sources: Pick<Source, "url" | "official">[];
};

export function summarizeDecision(decision: DecisionInput): SummaryDraft | null {
  const sourceUrl = decision.sources.find((source) => source.official)?.url;
  if (!sourceUrl) return null;
  const body = BODY_LABEL[decision.meeting.body];
  const date = formatDate(decision.meeting.date);
  const title = stripDot(decision.title);
  const verb = OUTCOME_VERB[decision.outcome];
  const sentences = verb
    ? [`A ${body.replace("Executivo Municipal", "Câmara Municipal")} ${verb} o ponto «${title}», na reunião de ${date}.`]
    : [`O ponto «${title}» esteve em apreciação na reunião de ${date}.`, "A deliberação ainda não está publicada, pelo que o resultado não é conhecido."];
  if (["APROVADO", "REPROVADO"].includes(decision.outcome)) sentences.push(`Resultado da votação: ${voteSummary(decision)}.`);
  if (decision.proposalRef) sentences.push(`Referência da proposta: ${decision.proposalRef}.`);
  return {
    entityType: "decisao",
    entityKey: decision.slug,
    title,
    available: true,
    simple: sentences.join(" "),
    meaning: firstMatch(CONTEXT_RULES, decision.title),
    decidedBy: body,
    status: OUTCOME_LABEL[decision.outcome],
    date: decision.meeting.date,
    href: `/reunioes/${decision.meeting.slug}`,
    sourceUrl,
  };
}

type MeetingInput = Pick<Meeting, "slug" | "body" | "date" | "title" | "location" | "status"> & {
  decisions: Pick<Decision, "outcome">[];
  sources: Pick<Source, "url" | "official">[];
};

export function summarizeMeeting(meeting: MeetingInput, now: Date): SummaryDraft | null {
  const sourceUrl = meeting.sources.find((source) => source.official)?.url;
  if (!sourceUrl) return null;
  const body = BODY_LABEL[meeting.body];
  const date = formatDate(meeting.date);
  const place = meeting.location ? `, em ${meeting.location}` : "";
  const future = meeting.date > now;
  const sentences = [future ? `Está convocada uma reunião do ${body} para ${date}${place}.`.replace("do Assembleia", "da Assembleia") : `O ${body} reuniu a ${date}${place}.`.replace("O Assembleia", "A Assembleia")];
  if (meeting.decisions.length > 0) {
    const approved = meeting.decisions.filter((decision) => decision.outcome === "APROVADO").length;
    const rejected = meeting.decisions.filter((decision) => decision.outcome === "REPROVADO").length;
    sentences.push(`Estão registados ${meeting.decisions.length} pontos, com ${approved} aprovados e ${rejected} rejeitados.`);
  } else {
    sentences.push("Os pontos desta reunião não estão transcritos aqui: a lista consta do documento oficial.");
  }
  return {
    entityType: "reuniao",
    entityKey: meeting.slug,
    title: meeting.title,
    available: true,
    simple: sentences.join(" "),
    meaning: null,
    decidedBy: body,
    status: future ? "Convocada" : "Realizada",
    date: meeting.date,
    href: `/reunioes/${meeting.slug}`,
    sourceUrl,
  };
}

type ContractInput = Pick<Contract, "baseId" | "title" | "awardingBody" | "supplierName" | "supplierIsPerson" | "procedureType" | "priceEur" | "signedAt" | "durationDays"> & {
  sources: Pick<Source, "url" | "official">[];
};

export function summarizeContract(contract: ContractInput): SummaryDraft | null {
  const sourceUrl = contract.sources.find((source) => source.official)?.url;
  if (!sourceUrl) return null;
  const title = stripDot(contract.title);
  const supplier = contract.supplierIsPerson ? "uma pessoa singular, identificada no Portal BASE" : contract.supplierName;
  const when = contract.signedAt ? ` a ${formatDate(contract.signedAt)}` : "";
  const sentences = [
    `${subject(contract.awardingBody)} celebrou um contrato com ${supplier}${when}, por ${formatEur(contract.priceEur)}.`,
    `Objeto do contrato: ${title}.`,
    `Tipo de procedimento: ${contract.procedureType}${contract.durationDays ? `, com prazo de ${contract.durationDays} dias` : ""}.`,
  ];
  return {
    entityType: "contrato",
    entityKey: contract.baseId,
    title,
    available: isClearTitle(contract.title),
    simple: isClearTitle(contract.title) ? sentences.join(" ") : null,
    meaning: isClearTitle(contract.title) ? firstMatch(PROCEDURE_RULES, contract.procedureType) : null,
    decidedBy: contract.awardingBody,
    status: "Celebrado",
    date: contract.signedAt,
    href: `/contratos?q=${encodeURIComponent(contract.title.slice(0, 40))}`,
    sourceUrl,
  };
}

type SourceInput = Pick<Source, "url" | "title" | "name" | "type" | "publishedAt" | "official" | "data">;

const dateClause = (date: Date | null) => (date ? `, com data de ${formatDate(date)}` : "");

const BUDGET_MEANING: [RegExp, string][] = [
  [/presta[çc][ãa]o de contas/i, "A prestação de contas mostra quanto foi efetivamente recebido e gasto no ano."],
  [/execu[çc][ãa]o/i, "Os mapas de execução comparam o que foi orçamentado com o que já foi recebido ou gasto."],
  [/revis[ãa]o|altera[çc][ãa]o/i, "Uma alteração ou revisão muda a distribuição das verbas previstas no orçamento."],
  [/or[çc]amento|gop|grandes op[çc][õo]es/i, "O orçamento define quanto o Município prevê receber e gastar durante o ano."],
];

export function summarizeSource(source: SourceInput): SummaryDraft | null {
  if (!source.official) return null;
  const base = { entityKey: source.url, title: source.title, decidedBy: source.name, date: source.publishedAt, href: null, sourceUrl: source.url };
  const unavailable = { available: false, simple: null, meaning: null };
  const data = (source.data ?? {}) as Record<string, unknown>;

  switch (source.type) {
    case "REGULAMENTO": {
      const clear = isClearTitle(source.title);
      return {
        ...base,
        entityType: "regulamento",
        status: "Publicado",
        ...(clear
          ? { available: true, simple: `${subject(source.name)} publicou o documento «${stripDot(source.title)}»${dateClause(source.publishedAt)}. O texto em vigor consta do documento oficial.`, meaning: "Um regulamento define regras aplicáveis no concelho. O texto oficial indica a quem se aplica e desde quando." }
          : unavailable),
      };
    }
    case "ORCAMENTO": {
      const section = typeof data.seccao === "string" ? data.seccao : null;
      const year = typeof data.ano === "string" ? data.ano : null;
      return {
        ...base,
        entityType: "orcamento",
        status: "Publicado",
        ...(section && year
          ? { available: true, simple: `A Câmara Municipal publicou o documento «${stripDot(source.title)}», da secção ${section}, referente a ${year}${dateClause(source.publishedAt)}. Os valores constam do documento oficial.`, meaning: firstMatch(BUDGET_MEANING, `${section} ${source.title}`) }
          : unavailable),
      };
    }
    case "CONCURSO": {
      const price = typeof data.precoBase === "number" ? ` O preço base indicado é de ${formatEur(data.precoBase)}.` : "";
      const deadline = typeof data.dataLimite === "string" ? ` A data-limite indicada é ${data.dataLimite}.` : "";
      const title = source.title.replace(/^Anúncio de procedimento:\s*/, "");
      const clear = isClearTitle(title);
      return {
        ...base,
        entityType: "procedimento",
        status: "Publicado",
        ...(clear ? { available: true, simple: `Foi publicado o procedimento «${stripDot(title)}»${dateClause(source.publishedAt)}.${price}${deadline}`, meaning: "Um procedimento é a fase em que a entidade pública procura fornecedores, antes de celebrar um contrato." } : unavailable),
      };
    }
    case "ATA":
    case "MINUTA":
    case "EDITAL":
    case "DOCUMENTO_PDF": {
      const clear = isClearTitle(source.title);
      const meaning =
        source.type === "ATA" ? "Uma ata é o registo oficial do que foi discutido e votado numa reunião."
        : source.type === "MINUTA" ? "Uma ata em minuta é a versão aprovada no fim da reunião, antes da ata final."
        : source.type === "EDITAL" ? "Um edital é uma comunicação oficial afixada e publicada para conhecimento geral."
        : firstMatch(CONTEXT_RULES, source.title);
      return {
        ...base,
        entityType: "documento",
        status: "Publicado",
        ...(clear ? { available: true, simple: `${subject(source.name)} publicou o documento «${stripDot(source.title)}»${dateClause(source.publishedAt)}. O conteúdo completo consta do documento oficial.`, meaning } : unavailable),
      };
    }
    default:
      return null;
  }
}

