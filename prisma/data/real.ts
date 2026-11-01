// Dados reais, transcritos de fontes oficiais consultadas em 2026-11-01.
// Os títulos das decisões seguem os editais; os resultados nunca são inferidos.

import type { Body, Outcome, SourceType, VoteMode } from "@prisma/client";

export const RETRIEVED_AT = new Date("2026-11-01T10:00:00Z");

const AM_UPLOADS = "https://www.am-tvedras.pt/wp-content/uploads";
const CM = "https://www.cm-tvedras.pt";

export type SourceSeed = {
  key: string;
  name: string;
  title: string;
  url: string;
  type: SourceType;
  publishedAt?: string;
  excerpt?: string;
};

const AM_NAME = "Assembleia Municipal de Torres Vedras";
const CM_NAME = "Câmara Municipal de Torres Vedras";

export const SOURCES: SourceSeed[] = [
  { key: "cm-composicao", name: CM_NAME, title: "Composição da Câmara Municipal", url: `${CM}/o/composicaocm`, type: "PAGINA_OFICIAL" },
  { key: "cm-regimento-pagina", name: CM_NAME, title: "Regimento da Câmara Municipal", url: `${CM}/municipio/camara-municipal/regimento`, type: "PAGINA_OFICIAL" },
  { key: "cm-atas", name: CM_NAME, title: "Atas da Câmara Municipal", url: `${CM}/documentos/editaisatas/atascm`, type: "PAGINA_OFICIAL" },
  { key: "cm-gestao", name: CM_NAME, title: "Documentos de gestão", url: `${CM}/documentos/gestao/`, type: "ORCAMENTO" },
  { key: "cm-transparencia", name: CM_NAME, title: "Transparência", url: `${CM}/transparencia`, type: "PAGINA_OFICIAL" },
  { key: "cm-contratacao", name: CM_NAME, title: "Contratação pública", url: `${CM}/municipio/camara-municipal/contratacao-publica/`, type: "PAGINA_OFICIAL" },
  { key: "cm-edital-149", name: CM_NAME, title: "Edital n.º 149/2026 — Reunião pública do executivo do mês de outubro de 2026", url: `${CM}/documentos/editaisatas/editaiscm?id=3377`, type: "EDITAL", publishedAt: "2026-10-19" },
  { key: "cm-edital-140", name: CM_NAME, title: "Edital n.º 140/2026 — Reunião pública do executivo do mês de setembro de 2026", url: `${CM}/documentos/editaisatas/editaiscm?id=3368`, type: "EDITAL" },
  { key: "cm-minuta-2710", name: CM_NAME, title: "Ata em minuta — Reunião ordinária de 27 de outubro de 2026", url: `${CM}/assets/upload/documentos/2026/10/27/10-27/10-27.pdf`, type: "MINUTA", publishedAt: "2026-10-27" },
  { key: "cm-minuta-2010", name: CM_NAME, title: "Ata em minuta — Reunião ordinária de 20 de outubro de 2026", url: `${CM}/assets/upload/documentos/2026/10/27/10-20/10-20.pdf`, type: "MINUTA", publishedAt: "2026-10-27" },
  { key: "cm-minuta-2909", name: CM_NAME, title: "Ata em minuta — Reunião ordinária de 29 de setembro de 2026", url: `${CM}/assets/upload/documentos/2026/10/27/09-29/09-29.pdf`, type: "MINUTA", publishedAt: "2026-10-27" },
  { key: "cm-ata-15", name: CM_NAME, title: "Ata n.º 15/2026", url: `${CM}/assets/upload/documentos/2026/09/09/atacm1523-06-2026/atacm1523-06-2026.pdf`, type: "ATA", publishedAt: "2026-09-09" },
  { key: "cm-ata-14", name: CM_NAME, title: "Ata n.º 14/2026", url: `${CM}/assets/upload/documentos/2026/09/09/atacm1409-06-2026/atacm1409-06-2026.pdf`, type: "ATA", publishedAt: "2026-09-09" },
  { key: "cm-orc-relatorio-2026", name: CM_NAME, title: "Orçamento 2026 — Relatório", url: `${CM}/assets/upload/documentos-gestao/2026/01/06/rom-5/rom-5.pdf`, type: "ORCAMENTO", publishedAt: "2026-01-06" },
  { key: "cm-orc-receita-2026", name: CM_NAME, title: "Orçamento 2026 — Orçamento da Receita", url: `${CM}/assets/upload/documentos-gestao/2026/01/06/1orec-2/1orec-2.pdf`, type: "ORCAMENTO", publishedAt: "2026-01-06" },
  { key: "cm-orc-despesa-2026", name: CM_NAME, title: "Orçamento 2026 — Orçamento da Despesa", url: `${CM}/assets/upload/documentos-gestao/2026/01/06/2odes-2/2odes-2.pdf`, type: "ORCAMENTO", publishedAt: "2026-01-06" },
  { key: "cm-gop-2026", name: CM_NAME, title: "Orçamento 2026 — Grandes Opções do Plano", url: `${CM}/assets/upload/documentos-gestao/2026/01/06/8gops-2/8gops-2.pdf`, type: "ORCAMENTO", publishedAt: "2026-01-06" },
  { key: "cm-contas-2025", name: CM_NAME, title: "Prestação de contas 2025 — Relatório de gestão", url: `${CM}/assets/upload/documentos-gestao/2026/06/03/rg-10/rg-10.pdf`, type: "ORCAMENTO", publishedAt: "2026-06-03" },

  { key: "am-composicao", name: AM_NAME, title: "Composição 2026-2029", url: "https://www.am-tvedras.pt/composicao26/", type: "PAGINA_OFICIAL" },
  { key: "am-comissoes", name: AM_NAME, title: "Comissões", url: "https://www.am-tvedras.pt/comissoes/", type: "PAGINA_OFICIAL" },
  { key: "am-agenda", name: AM_NAME, title: "Agenda das sessões", url: "https://www.am-tvedras.pt/sessoes/agenda/", type: "PAGINA_OFICIAL" },
  { key: "am-participacao", name: AM_NAME, title: "Participação pública", url: "https://www.am-tvedras.pt/sessoes/participacao-publica/", type: "PAGINA_OFICIAL" },
  { key: "am-atas", name: AM_NAME, title: "Atas", url: "https://www.am-tvedras.pt/sessoes/atas/", type: "PAGINA_OFICIAL" },
  { key: "am-documentos", name: AM_NAME, title: "Documentos das sessões", url: "https://www.am-tvedras.pt/sessoes/documentos/", type: "PAGINA_OFICIAL" },
  { key: "am-ed-1-2026", name: AM_NAME, title: "Edital n.º 1/2026 — Sessão ordinária de 23 e 29 de dezembro: deliberações", url: "https://www.am-tvedras.pt/sessoes/editais/edital-n-o1-2026/", type: "EDITAL", publishedAt: "2026-01-06" },
  { key: "am-ed-4-2026", name: AM_NAME, title: "Edital n.º 4/2026 — Sessão ordinária de 24 de fevereiro: deliberações", url: `${AM_UPLOADS}/2026/03/Edital-n.o-4-2026-Deliberacoes.pdf`, type: "EDITAL", publishedAt: "2026-02-25" },
  { key: "am-ed-8-2026", name: AM_NAME, title: "Edital n.º 8/2026 — Sessão ordinária de 29 de abril e 4 de maio: deliberações", url: `${AM_UPLOADS}/2026/05/Edital-n.o-8-2026_signed.pdf`, type: "EDITAL", publishedAt: "2026-05-06" },
  { key: "am-ed-10-2026", name: AM_NAME, title: "Edital n.º 10/2026 — Sessão ordinária de 24 de junho: deliberações", url: `${AM_UPLOADS}/2026/08/Edital-n.o-10-2026_signed.pdf`, type: "EDITAL", publishedAt: "2026-06-30" },
  { key: "am-ed-11-2026", name: AM_NAME, title: "Edital n.º 11/2026 — Sessão ordinária de 30 de setembro", url: "https://www.am-tvedras.pt/11709-2/", type: "EDITAL" },
  { key: "am-ed-12-2026", name: AM_NAME, title: "Edital n.º 12/2026 — Sessão ordinária de 14 de outubro", url: "https://www.am-tvedras.pt/edital-n-12-2026/", type: "EDITAL" },
  { key: "am-ata-9-2025", name: AM_NAME, title: "Ata n.º 9/2025 — Sessão de 23 e 29 de dezembro de 2025", url: `${AM_UPLOADS}/2026/05/Ata-9AM-23-e-29-dez-2026.pdf`, type: "ATA" },
  { key: "am-ata-1-2026", name: AM_NAME, title: "Ata n.º 1/2026 — Sessão de 24 de fevereiro", url: `${AM_UPLOADS}/2026/05/Ata-1AM-24-02.pdf`, type: "ATA" },
  { key: "am-info-2406", name: AM_NAME, title: "Informação sobre a atividade municipal — Assembleia Municipal de 24 de junho", url: `${AM_UPLOADS}/2026/08/Informacao_Presidente_AM_24.06.2026.pdf`, type: "DOCUMENTO_PDF", publishedAt: "2026-06-23" },
  { key: "am-doc-hospital", name: AM_NAME, title: "Moção “Pela urgente definição da localização e do perfil assistencial do novo Hospital do Oeste”", url: `${AM_UPLOADS}/2026/08/Mocao-hospital.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-hospital-2025", name: AM_NAME, title: "Moção Conjunta — Pelo Novo Hospital do Oeste", url: `${AM_UPLOADS}/2025/12/Mocao-conjunta-Pelo-Novo-hospital-do-Oeste-AM-12-12.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-animal", name: AM_NAME, title: "Recomendação — Programa de proteção animal integrado", url: `${AM_UPLOADS}/2026/08/Recomendacao-programa-proteccaao-animal.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-piscinas", name: AM_NAME, title: "Recomendação — Classificação das piscinas do Vimeiro", url: `${AM_UPLOADS}/2026/08/Recomendacao-piscinas.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-louvor-scut", name: AM_NAME, title: "Voto de Louvor Conjunto ao Sport Clube União Torreense", url: `${AM_UPLOADS}/2026/08/Voto-louvor-scut.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-seguranca", name: AM_NAME, title: "Recomendação — Videovigilância e polícia municipal", url: `${AM_UPLOADS}/2026/05/4-Recomendacao-Seguranca-Unidos.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-vinho", name: AM_NAME, title: "Recomendação — Criação do Museu do Vinho em Torres Vedras", url: `${AM_UPLOADS}/2026/05/1-Proposta-Museu-do-Vinho-Chega.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-estradas", name: AM_NAME, title: "Moção — Reparação das estradas nacionais afetadas pelas intempéries", url: `${AM_UPLOADS}/2026/05/6-Mocao-Reparacao-Estradas-PS.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-ensino", name: AM_NAME, title: "Moção — Pela Defesa do Ensino Superior na Área da Saúde em Torres Vedras", url: `${AM_UPLOADS}/2026/05/5-Mocao-Defesa-Ensino-Suprerior-PS.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-clima", name: AM_NAME, title: "Recomendação — Reforço na prevenção e combate aos efeitos das alterações climáticas", url: `${AM_UPLOADS}/2026/03/Recomendação.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-doc-louvor-fev", name: AM_NAME, title: "Voto de Louvor — A todos os que no terreno foram o rosto da resiliência", url: `${AM_UPLOADS}/2026/03/Voto-de-Louvor.pdf`, type: "DOCUMENTO_PDF" },
  { key: "am-video-2312", name: AM_NAME, title: "Vídeo — Sessão ordinária de 23 de dezembro de 2025", url: "https://www.youtube.com/watch?v=LQV-W7JtIdg", type: "VIDEO" },
  { key: "am-video-2912", name: AM_NAME, title: "Vídeo — Continuação da sessão ordinária, 29 de dezembro de 2025", url: "https://www.youtube.com/watch?v=7VE5YxyEoNs", type: "VIDEO" },
  { key: "am-video-2402", name: AM_NAME, title: "Vídeo — Sessão ordinária de 24 de fevereiro de 2026", url: "https://www.youtube.com/watch?v=HgIQevvN62c", type: "VIDEO" },
  { key: "am-video-2904", name: AM_NAME, title: "Vídeo — Sessão ordinária de 29 de abril de 2026", url: "https://www.youtube.com/watch?v=_qjlRpYFTKk", type: "VIDEO" },
  { key: "am-video-0405", name: AM_NAME, title: "Vídeo — Sessão ordinária de 4 de maio de 2026", url: "https://www.youtube.com/watch?v=kWW6kf9sg7c", type: "VIDEO" },
  { key: "am-video-2406", name: AM_NAME, title: "Vídeo — Sessão ordinária de 24 de junho de 2026", url: "https://www.youtube.com/watch?v=r2a87gF8m-c", type: "VIDEO" },
  { key: "am-video-1410", name: AM_NAME, title: "Vídeo — Sessão ordinária de 14 de outubro de 2026", url: "https://www.youtube.com/watch?v=J46RNx6WgYI", type: "VIDEO" },

  { key: "base-dataset", name: "IMPIC — Portal BASE, em dados.gov.pt", title: "Contratos Públicos — Portal Base — IMPIC — Contratos de 2012 a 2026", url: "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2026/", type: "DATASET", publishedAt: "2026-11-01" },
  { key: "base-pesquisa", name: "Portal BASE (IMPIC)", title: "Contratos com o Município como entidade adjudicante", url: "https://www.base.gov.pt/Base/pt/ResultadosPesquisa?type=contratos&query=adjudicanteid%3D579", type: "CONTRATO" },
];

export const PARTICIPATION_CM =
  "As reuniões públicas têm um período de intervenção do público de até 60 minutos, na primeira hora da manhã. A inscrição faz-se no início desse período, indicando nome, contacto e assunto. Cada pessoa dispõe de até 5 minutos.";

export const PARTICIPATION_AM =
  "Qualquer cidadão com idade eleitoral pode usar da palavra, inscrevendo-se no início da sessão. O período aberto ao público decorre depois da aprovação das atas: até 30 minutos em sessões ordinárias e 15 em extraordinárias.";

export type MeetingSeed = {
  slug: string;
  body: Body;
  date: string;
  hasTime?: boolean;
  title: string;
  location?: string;
  status?: "CONVOCADA" | "REALIZADA";
  participation?: string;
  sources: string[];
};

export const MEETINGS: MeetingSeed[] = [
  { slug: "am-2025-12-23", body: "ASSEMBLEIA_MUNICIPAL", date: "2025-12-23T12:00:00Z", hasTime: false, title: "Sessão ordinária (23 e 29 de dezembro de 2025)", sources: ["am-ed-1-2026", "am-ata-9-2025", "am-video-2312", "am-video-2912"] },
  { slug: "am-2026-02-24", body: "ASSEMBLEIA_MUNICIPAL", date: "2026-02-24T21:00:00Z", title: "Sessão ordinária de 24 de fevereiro de 2026", location: "Auditório dos Paços do Concelho, Praça do Município, Torres Vedras", sources: ["am-ed-4-2026", "am-ata-1-2026", "am-video-2402"] },
  { slug: "am-2026-04-29", body: "ASSEMBLEIA_MUNICIPAL", date: "2026-04-29T12:00:00Z", hasTime: false, title: "Sessão ordinária de 29 de abril de 2026", sources: ["am-ed-8-2026", "am-video-2904"] },
  { slug: "am-2026-05-04", body: "ASSEMBLEIA_MUNICIPAL", date: "2026-05-04T12:00:00Z", hasTime: false, title: "Continuação da sessão ordinária, 4 de maio de 2026", sources: ["am-ed-8-2026", "am-video-0405"] },
  { slug: "am-2026-06-24", body: "ASSEMBLEIA_MUNICIPAL", date: "2026-06-24T12:00:00Z", hasTime: false, title: "Sessão ordinária de 24 de junho de 2026", sources: ["am-ed-10-2026", "am-video-2406", "am-info-2406"] },
  { slug: "am-2026-09-30", body: "ASSEMBLEIA_MUNICIPAL", date: "2026-09-30T20:00:00Z", title: "Sessão ordinária de 30 de setembro de 2026", location: "Salão Paroquial da Ponte do Rol, Largo do Salão Paroquial, Ponte do Rol", sources: ["am-ed-11-2026"] },
  { slug: "am-2026-10-14", body: "ASSEMBLEIA_MUNICIPAL", date: "2026-10-14T20:00:00Z", title: "Sessão ordinária de 14 de outubro de 2026", location: "Salão Paroquial da Carvoeira, Largo da Igreja, Carvoeira", sources: ["am-ed-12-2026", "am-video-1410"] },
  { slug: "cm-2026-06-09", body: "EXECUTIVO_MUNICIPAL", date: "2026-06-09T12:00:00Z", hasTime: false, title: "Reunião de 9 de junho de 2026 (Ata n.º 14/2026)", sources: ["cm-ata-14"] },
  { slug: "cm-2026-06-23", body: "EXECUTIVO_MUNICIPAL", date: "2026-06-23T12:00:00Z", hasTime: false, title: "Reunião de 23 de junho de 2026 (Ata n.º 15/2026)", sources: ["cm-ata-15"] },
  { slug: "cm-2026-09-29", body: "EXECUTIVO_MUNICIPAL", date: "2026-09-29T12:00:00Z", hasTime: false, title: "Reunião ordinária de 29 de setembro de 2026", sources: ["cm-minuta-2909", "cm-edital-140"] },
  { slug: "cm-2026-10-20", body: "EXECUTIVO_MUNICIPAL", date: "2026-10-20T12:00:00Z", hasTime: false, title: "Reunião ordinária de 20 de outubro de 2026", sources: ["cm-minuta-2010"] },
  { slug: "cm-2026-10-27", body: "EXECUTIVO_MUNICIPAL", date: "2026-10-27T09:30:00Z", title: "Reunião pública de 27 de outubro de 2026", location: "Salão Paroquial da Carvoeira, Largo da Igreja", participation: PARTICIPATION_CM, sources: ["cm-edital-149", "cm-minuta-2710"] },
];

const U = "UNANIMIDADE" as const;
const M = "MAIORIA" as const;
const N = "NAO_APLICAVEL" as const;
const A = "APROVADO" as const;
const R = "REPROVADO" as const;
const T = "TOMADA_CONHECIMENTO" as const;
const P = "POR_PUBLICAR" as const;

/** [ponto, proposta, título, resultado, modo de votação, fontes adicionais] */
type Row = [string, string | null, string, Outcome, VoteMode, string[]?];

export const DECISIONS: { meeting: string; source: string; rows: Row[] }[] = [
  {
    meeting: "am-2025-12-23",
    source: "am-ed-1-2026",
    rows: [
      ["1", "36/CM/2025", "Taxa de IMI para 2025, a cobrar em 2026: 0,35% em prédios urbanos, com reduções ligadas a arrendamento e dependentes", A, M],
      ["2", "37/CM/2025", "Participação variável no IRS de 3,75% sobre rendimentos de 2025, a cobrar em 2027", A, M],
      ["3", "38/CM/2025", "Derrama de 1,00% sobre o lucro tributável de 2025, a cobrar em 2026, e de 0,01% para volume de negócios até 150 000 €", A, U],
      ["4", "39/CM/2025", "Taxa municipal de direitos de passagem de 0,25% sobre a faturação mensal em 2026", A, U],
      ["5", "40/CM/2025", "Documentos previsionais do Município para 2026", A, M],
      ["6", "41/CM/2025", "Documentos previsionais dos SMAS para 2026", A, M],
      ["7", "42/CM/2025", "Recursos financeiros para as freguesias em 2026, no valor de 4 098 000,00 €", A, U],
      ["8.1", "43/CM/2025", "Aditamento ao contrato com a Promotorres E.M. — gestão do Mercado Municipal", A, M],
      ["8.2", "44/CM/2025", "Aditamento ao contrato com a Promotorres E.M. — organização e gestão de eventos", A, U],
      ["8.3", "45/CM/2025", "Aditamento ao contrato com a Promotorres E.M. — gestão da Expotorres", A, M],
      ["8.4", "46/CM/2025", "Aditamento ao contrato com a Promotorres E.M. — gestão do estacionamento", A, M],
      ["9", "47/CM/2025", "Carta Educativa para 2025/2035", A, U],
      ["10", "38/AM/2025", "Informação do Presidente da Câmara sobre a atividade municipal e a situação financeira", T, N],
      ["10.1", "39/AM/2025", "Cedências de parcelas de terreno para o domínio público", T, N],
      ["10.2", "40/AM/2025", "Apoios a freguesias", T, N],
    ],
  },
  {
    meeting: "am-2026-02-24",
    source: "am-ed-4-2026",
    rows: [
      ["1", "01/CM/2026", "1.ª revisão ao Orçamento e às Grandes Opções do Plano de 2026 da Câmara Municipal", A, U],
      ["2", "02/CM/2026", "1.ª revisão ao Orçamento e às Grandes Opções do Plano de 2026 dos SMAS — integração do saldo da gerência de 2025", A, U],
      ["3", "03/CM/2026", "Repartição de encargos da empreitada de construção da Escola Básica de A-dos-Cunhados, no total de 6 329 269,97 € acrescidos de IVA", A, U],
      ["4", "01/AM/2026", "Informação do Presidente da Câmara sobre a atividade municipal e a situação financeira", T, N],
      ["4.1", "02/AM/2026", "Cedências de parcelas de terreno para o domínio público", T, N],
      ["4.2", "03/AM/2026", "Apoios a freguesias", T, N],
      ["5", "04/AM/2026", "Recomendação pelo reforço na prevenção e no combate face aos efeitos das alterações climáticas", A, M, ["am-doc-clima", "am-ata-1-2026"]],
      ["5", "04/AM/2026", "Voto de Louvor a todos os que no terreno foram o rosto da resiliência da comunidade", A, U, ["am-doc-louvor-fev"]],
    ],
  },
  {
    meeting: "am-2026-04-29",
    source: "am-ed-8-2026",
    rows: [
      ["1", "04/CM/2026", "Documentos de Prestação de Contas de 2025 da Câmara Municipal", A, U],
      ["2", "05/CM/2026", "Relatório Integrado — Atividades e Gestão de 2025 dos SMAS", A, U],
      ["3", "06/CM/2026", "2.ª adenda ao contrato-programa para organização e gestão de eventos com a Promotorres E.M.", A, U],
      ["4", "07/CM/2026", "Alteração à estrutura orgânica e ao regulamento de organização dos serviços municipais", A, M],
      ["5", "08/CM/2026", "Alteração ao Mapa de Pessoal da Câmara Municipal, a vigorar a partir de 01/06/2026", A, U],
    ],
  },
  {
    meeting: "am-2026-05-04",
    source: "am-ed-8-2026",
    rows: [
      ["6", "09/CM/2026", "Alteração da estrutura orgânica e do regulamento dos SMAS", A, M],
      ["7", "10/CM/2026", "Mapa de Pessoal dos SMAS, a vigorar a partir de 01/06/2026", A, U],
      ["8", "11/CM/2026", "2.ª revisão aos documentos previsionais de 2026 da Câmara Municipal", A, U],
      ["9", "12/CM/2026", "2.ª revisão aos documentos previsionais de 2026 dos SMAS", A, U],
      ["10", "13/CM/2026", "Denúncia dos contratos de delegação de competências celebrados com juntas de freguesia", T, N],
      ["11", "05/AM/2026", "Relatório Anual de 2025 da Comissão de Proteção de Crianças e Jovens de Torres Vedras", T, N],
      ["12", "06/AM/2026", "Informação do Presidente da Câmara sobre a atividade municipal e a situação financeira", T, N],
      ["12.1", "07/AM/2026", "Cedências de parcelas de terreno para o domínio público", T, N],
      ["12.2", "08/AM/2026", "Apoios a freguesias", T, N],
      ["13", "09/AM/2026", "Recomendação para a criação do Museu do Vinho em Torres Vedras e da comissão instaladora", A, M, ["am-doc-vinho"]],
      ["13", "09/AM/2026", "Moção de saudação pela passagem do Sport Clube União Torriense à final da Taça de Portugal", A, U],
      ["13", "09/AM/2026", "Recomendação sobre videovigilância e criação da polícia municipal — remetida à Comissão Permanente de Proteção Civil e Segurança", "REMETIDO", U, ["am-doc-seguranca"]],
      ["13", "09/AM/2026", "Moção “Pela Defesa do Ensino Superior na Área da Saúde em Torres Vedras”", R, M, ["am-doc-ensino"]],
      ["13", "09/AM/2026", "Moção “Pela reparação urgente das estradas nacionais afetadas pelas intempéries de inverno no concelho de Torres Vedras”", A, U, ["am-doc-estradas"]],
      ["Aditamento", "14/CM/2026", "Repartição de encargos — prorrogação de prazo do projeto de reabilitação do edifício do Bingo, no âmbito do 1.º Direito", A, U],
    ],
  },
  {
    meeting: "am-2026-06-24",
    source: "am-ed-10-2026",
    rows: [
      ["1", "15/CM/2026", "Prestação de Contas Consolidadas do Município de Torres Vedras de 2025", A, U],
      ["2", "16/CM/2026", "4.ª revisão ao Orçamento e às Grandes Opções do Plano 2026 da Câmara Municipal", A, U],
      ["3", "17/CM/2026", "Aditamentos aos contratos-programa com a Promotorres E.M.", A, M],
      ["4", "18/CM/2026", "Designação de júris — provimento de cargos de direção intermédia da Câmara Municipal", A, M],
      ["5", "19/CM/2026", "Designação de júris — cargos de direção intermédia dos SMAS", A, M],
      ["6", "20/CM/2026", "Repartição de encargos — projeto de reabilitação do edifício na Rua Almirante Gago Coutinho, no âmbito do 1.º Direito", A, U],
      ["7", "21/CM/2026", "Repartição de encargos — projeto de reabilitação do edifício na Rua da Paz n.º 6 e 6A e Travessa do Castelo n.º 9, no âmbito do 1.º Direito", A, U],
      ["8", "10/AM/2026", "Regimento da Assembleia Municipal Jovem de Torres Vedras", A, U],
      ["9", "11/AM/2026", "Informação do Presidente da Câmara sobre a atividade municipal e a situação financeira", T, N, ["am-info-2406"]],
      ["9.1", "12/AM/2026", "Cedências de parcelas de terreno para o domínio público", T, N],
      ["9.2", "13/AM/2026", "Apoios a freguesias", T, N],
      ["10", "14/AM/2026", "Recomendação para a classificação das piscinas do Vimeiro como Património de Interesse Municipal", R, M, ["am-doc-piscinas"]],
      ["10", "14/AM/2026", "Recomendação para a criação de um programa de proteção animal integrado", A, M, ["am-doc-animal"]],
      ["10", "14/AM/2026", "Moção “Pela urgente definição da localização e do perfil assistencial do novo Hospital do Oeste”", A, M, ["am-doc-hospital"]],
      ["10", "14/AM/2026", "Voto de louvor conjunto ao Sport Clube União Torreense pela conquista da Taça de Portugal", A, U, ["am-doc-louvor-scut"]],
    ],
  },
  {
    meeting: "am-2026-10-14",
    source: "am-ed-12-2026",
    rows: [
      ["1", "22/CM/2026", "Relatório intercalar da situação económica e financeira do 1.º semestre de 2026 da Câmara Municipal e dos SMAS", P, N],
      ["2", "23/CM/2026", "5.ª revisão ao Orçamento e às Grandes Opções do Plano de 2026", P, N],
      ["3", "24/CM/2026", "Descentralização para as freguesias: atualização dos recursos financeiros para 2027", P, N],
      ["4", "25/CM/2026", "Aquisição de dois prédios rústicos em Santa Cruz para habitação a custos controlados e/ou arrendamento acessível", P, N],
      ["5", "26/CM/2026", "Empréstimo de médio e longo prazo até 2 725 300,00 € para a aquisição em Santa Cruz", P, N],
      ["6", "27/CM/2026", "Empréstimo de médio e longo prazo até 16 000 000,00 € para o projeto “Medicina ULisboa” — Campus de Torres Vedras", P, N],
      ["7", "28, 29 e 30/CM/2026", "Criação da Polícia Municipal: regulamento do serviço, alteração ao mapa de pessoal e à organização dos serviços", P, N],
      ["8", "31/CM/2026", "Designação do Conselho Municipal de Educação para 2025–2029", P, N],
      ["9", "32/CM/2026", "Compromisso plurianual para fornecimento de eletricidade em mercado livre, por concurso público internacional", P, N],
      ["10", "33/CM/2026", "Compromisso plurianual para projeto de reabilitação do edifício da Rua Serpa Pinto, n.os 8–10, no âmbito do 1.º Direito", P, N],
      ["11", "34/CM/2026", "Designação do júri para o cargo de Chefe de Divisão dos SMAS", P, N],
      ["12", "15/AM/2026", "Constituição de comissões", P, N],
    ],
  },
];

export const EXECUTIVE = [
  { name: "Sérgio Paulo Matias Galvão", role: "Presidente da Câmara", party: "Unidos por Torres Vedras", portfolios: ["Administração Geral de Serviços", "Cooperação Autárquica", "Economia e Finanças", "Recursos Humanos", "Obras Municipais", "Captação e Gestão de Financiamentos", "Auditoria e Controlo Interno", "Comunicação e Marca"] },
  { name: "Diogo Ribeiro de Oliveira Guia", role: "Vice-Presidente", party: "Unidos por Torres Vedras", portfolios: ["Ambiente, mundo rural, mar e sustentabilidade", "Internacionalização, geminações e desenvolvimento estratégico", "Gestão de informação, inovação, desenvolvimento e segurança", "Eficiência, Tecnologia e IA", "Proteção Civil", "Desporto", "Apoio às empresas e ao investimento", "Juventude"] },
  { name: "Rita João de Maya Gomes Sammer", role: "Vereadora", party: "Unidos por Torres Vedras", portfolios: ["Educação", "Saúde e bem-estar", "Desenvolvimento social, inclusão e envelhecimento ativo", "Coesão social e desenvolvimento humano"] },
  { name: "Ana Bárbara Antunes do Carmo da Silva Amaro", role: "Vereadora", party: "Unidos por Torres Vedras", portfolios: ["Urbanismo", "Habitação", "Trânsito, mobilidade e estacionamento", "Planeamento estratégico e ordenamento territorial", "Gestão de espaços públicos e qualidade de vida"] },
  { name: "Rui Manuel Estrela da Silva", role: "Vereador", party: "Unidos por Torres Vedras", portfolios: ["Associativismo e Cidadania", "Cultura e Identidade", "Turismo", "Património Cultural e preservação da memória", "Bibliotecas e Museus", "Galerias, Artes Visuais e Performativas"] },
  { name: "Francisco João Pacheco Martins", role: "Vereador", party: "PS — Partido Socialista", portfolios: [] },
  { name: "Rui Pedro Avelar Lopes", role: "Vereador", party: "PS — Partido Socialista", portfolios: [] },
  { name: "Felicidade Maria da Silva Santos Vital de Alcântara", role: "Vereadora", party: "CHEGA", portfolios: [] },
  { name: "Bruno Manuel Ferreira Vitorino", role: "Vereador", party: "PS — Partido Socialista", portfolios: [] },
];

/** Nomes completos da Ata n.º 1/2026 e da página de comissões; partido e freguesia da composição 2026-2029. */
export const ASSEMBLY_BOARD = [
  { name: "Helena Isabel Ribeiro Ferreira Runa", role: "Presidente da Assembleia Municipal", party: "UTV" },
  { name: "Ilídio Paulo Antunes Santos", role: "1.º Secretário da Mesa", party: "UTV" },
  { name: "Mário Jorge da Glória Agostinho", role: "2.º Secretário da Mesa", party: "UTV" },
];

export const ASSEMBLY_DEPUTIES = [
  "Carlos Manuel Soares Miguel",
  "Jorge Carlos Ferreira dos Santos",
  "Maria Leonor Varela Silva Malhado",
  "Luís Carlos Jordão de Sousa Lopes",
  "Carlos Alberto Pontes Filipe",
  "Andreia Filipa Alves Caldas",
  "Maria Manuela Hortas da Silva Pacheco",
  "Tânia Isabel Ramos Mourato Jerónimo",
  "Rui José Prudêncio",
  "Vanda Raquel Inácio da Silva",
  "Beatriz Silva Pereira",
  "Dina Teresa Antunes de Sousa Almeida",
  "Herculano Manuel Cosme Raposo",
  "Hugo Gerardo Fernandes Pereira da Silva Lucas",
  "António João Leal da Costa Bastos",
  "José António do Vale Paulos",
  "Ana Teresa de Carvalho dos Santos",
  "Fernando Manuel Rodrigues Pinto Varela dos Santos",
  "Susana Maria Ribeiro das Neves",
  "Fernando Manuel Osório Guerra",
  "Susana Mónica da Silva José",
  "Artur Alexandre dos Santos Narciso",
  "João Paulo Moreira dos Reis",
  "Paula Cristina dos Santos Lopes",
];

export const PARISH_PRESIDENTS = [
  { name: "Sérgio Alexandre Simões Ferreira", parish: "A dos Cunhados", party: "UTV" },
  { name: "José Francisco Damas Antunes", parish: "Campelos e Outeiro da Cabeça", party: "UTV" },
  { name: "Nuno Carlos Lopes Pinto Pedro", parish: "Carvoeira e Carmões", party: "PS" },
  { name: "Telma Filipa Francisco Mota", parish: "Dois Portos", party: "PS" },
  { name: "Vasco Augusto Bernardes Forcada", parish: "Freiria", party: "PS" },
  { name: "João Marcelo Garcia Marques", parish: "Maceira", party: "UTV" },
  { name: "Mário João Rodrigues Matias", parish: "Maxial e Monte Redondo", party: "PS" },
  { name: "Jorge da Vaza dos Santos", parish: "Ponte do Rol", party: "UTV" },
  { name: "João de Deus Tomás Elias", parish: "Ramalhal", party: "PS" },
  { name: "Humberto Manuel Sebastião Gomes", parish: "Runa", party: "UTV" },
  { name: "Dalila do Carmo Miranda de Jesus", parish: "Santa Maria, S. Pedro e Matacães", party: "UTV" },
  { name: "António José Silva Alves", parish: "São Pedro da Cadeira", party: "PS" },
  { name: "Mário João Ferreira Gomes", parish: "Silveira", party: "UTV" },
  { name: "Francisco José Teodoro Martins", parish: "Turcifal", party: "UTV" },
  { name: "Ana Clara Gomes dos Santos", parish: "Ventosa", party: "UTV" },
];

export const COMMITTEES: { name: string; chair?: string; members: string[] }[] = [
  { name: "Comissão Permanente de Educação, Cultura, Juventude e Associativismo", chair: "Luís Carlos Jordão de Sousa Lopes", members: ["Andreia Filipa Alves Caldas", "Beatriz Silva Pereira", "Hugo Gerardo Fernandes Pereira da Silva Lucas", "Fernando Manuel Rodrigues Pinto Varela dos Santos", "Vanda Raquel Inácio da Silva", "Fernando Manuel Osório Guerra"] },
  { name: "Comissão Permanente de Economia, Turismo e Empreendedorismo", chair: "Dina Teresa Antunes de Sousa Almeida", members: ["Ilídio Paulo Antunes Santos", "Maria Leonor Varela Silva Malhado", "Artur Alexandre dos Santos Narciso", "Paula Cristina dos Santos Lopes", "Fernando Manuel Rodrigues Pinto Varela dos Santos", "Fernando Manuel Osório Guerra"] },
  { name: "Comissão Permanente de Urbanismo, Ordenamento do Território e Habitação", chair: "António João Leal da Costa Bastos", members: ["João Paulo Moreira dos Reis", "Carlos Manuel Soares Miguel", "José António do Vale Paulos", "Carlos Alberto Pontes Filipe", "Vanda Raquel Inácio da Silva", "Fernando Manuel Osório Guerra"] },
  { name: "Comissão Permanente de Mobilidade e Transportes", chair: "Tânia Isabel Ramos Mourato Jerónimo", members: ["Susana Mónica da Silva José", "António José Silva Alves", "Hugo Gerardo Fernandes Pereira da Silva Lucas", "Paula Cristina dos Santos Lopes", "Carlos Alberto Pontes Filipe", "Fernando Manuel Osório Guerra"] },
  { name: "Comissão Permanente do Orçamento e Finanças", chair: "Helena Isabel Ribeiro Ferreira Runa", members: ["Tânia Isabel Ramos Mourato Jerónimo", "Carlos Manuel Soares Miguel", "Rui José Prudêncio", "Vanda Raquel Inácio da Silva", "Fernando Manuel Rodrigues Pinto Varela dos Santos", "Fernando Manuel Osório Guerra"] },
  { name: "Comissão Permanente de Ambiente, Mundo Rural e Sustentabilidade", chair: "Ana Teresa de Carvalho dos Santos", members: ["Luís Carlos Jordão de Sousa Lopes", "Mário João Rodrigues Matias", "João de Deus Tomás Elias", "Carlos Alberto Pontes Filipe", "Paula Cristina dos Santos Lopes", "Fernando Manuel Osório Guerra"] },
  { name: "Comissão Permanente de Saúde, Desporto e Envelhecimento Ativo", members: ["Herculano Manuel Cosme Raposo", "Rui José Prudêncio", "Susana Maria Ribeiro das Neves", "Fernando Manuel Rodrigues Pinto Varela dos Santos", "Carlos Alberto Pontes Filipe", "Fernando Manuel Osório Guerra", "Jorge Carlos Ferreira dos Santos"] },
  { name: "Comissão Permanente de Proteção Civil e Segurança", chair: "Dalila do Carmo Miranda de Jesus", members: ["Mário Jorge da Glória Agostinho", "José António do Vale Paulos", "Nuno Carlos Lopes Pinto Pedro", "Vanda Raquel Inácio da Silva", "Paula Cristina dos Santos Lopes", "Fernando Manuel Osório Guerra"] },
];

/** Contagens e sentido de voto registados nas atas: [fragmento do título, a favor, contra, abstenções, nota]. */
export const VOTE_COUNTS: [string, number, number, number, string?, string?][] = [
  ["Taxa de IMI para 2025", 22, 16, 4, "A favor: Unidos por Torres Vedras. Contra: PS e PCP. Abstenções: Chega.", "am-ata-9-2025"],
  ["Participação variável no IRS", 26, 16, 0, undefined, "am-ata-9-2025"],
  ["Documentos previsionais do Município para 2026", 38, 4, 0, "Contra: Grupo Municipal do Chega.", "am-ata-9-2025"],
  ["Documentos previsionais dos SMAS para 2026", 38, 4, 0, "Contra: Grupo Municipal do Chega.", "am-ata-9-2025"],
  ["gestão do Mercado Municipal", 38, 0, 4, "Abstenções: Grupo Municipal do Chega.", "am-ata-9-2025"],
  ["gestão da Expotorres", 38, 0, 4, "Abstenções: Grupo Municipal do Chega.", "am-ata-9-2025"],
  ["gestão do estacionamento", 38, 0, 4, "Abstenções: Grupo Municipal do Chega.", "am-ata-9-2025"],
  ["alterações climáticas", 41, 0, 1, "Absteve-se Herculano Raposo.", "am-ata-1-2026"],
];

export type BudgetSeed = {
  year: number;
  kind: "RESUMO" | "RECEITA" | "DESPESA" | "SITUACAO_FINANCEIRA";
  label: string;
  amount: number;
  approximate?: boolean;
  asOf?: string;
  note?: string;
  source: string;
};

const ATA9_NOTE = "Valor aproximado, referido na discussão do orçamento. O valor exato consta dos documentos previsionais.";
const REVISION_NOTE = "Exposição do Presidente da Câmara sobre a 1.ª revisão, registada em ata.";

export const BUDGET: BudgetSeed[] = [
  { year: 2026, kind: "RESUMO", label: "Orçamento da Câmara Municipal", amount: 116000000, approximate: true, asOf: "2025-12-23", note: ATA9_NOTE, source: "am-ata-9-2025" },
  { year: 2026, kind: "RESUMO", label: "Orçamento dos SMAS", amount: 25000000, approximate: true, asOf: "2025-12-23", note: ATA9_NOTE, source: "am-ata-9-2025" },
  { year: 2026, kind: "DESPESA", label: "Despesas de capital previstas", amount: 40000000, approximate: true, asOf: "2025-12-23", note: ATA9_NOTE, source: "am-ata-9-2025" },
  { year: 2026, kind: "DESPESA", label: "Recursos financeiros para as freguesias (descentralização)", amount: 4098000, asOf: "2025-12-29", note: "Valor total deliberado para 2026.", source: "am-ed-1-2026" },
  { year: 2026, kind: "RECEITA", label: "Saldo de gerência integrado na 1.ª revisão", amount: 11886179.26, asOf: "2026-02-24", note: REVISION_NOTE, source: "am-ata-1-2026" },
  { year: 2026, kind: "DESPESA", label: "Saldo: receita consignada às estradas integradas na autarquia", amount: 3582128.79, asOf: "2026-02-24", note: REVISION_NOTE, source: "am-ata-1-2026" },
  { year: 2026, kind: "DESPESA", label: "Saldo: reforço para as juntas de freguesia", amount: 2000000, asOf: "2026-02-24", note: REVISION_NOTE, source: "am-ata-1-2026" },
  { year: 2026, kind: "DESPESA", label: "Saldo: quotizações e transferências da OesteCIM", amount: 1652000, asOf: "2026-02-24", note: REVISION_NOTE, source: "am-ata-1-2026" },
  { year: 2026, kind: "DESPESA", label: "Saldo: betuminoso para as vias municipais", amount: 1500000, asOf: "2026-02-24", note: REVISION_NOTE, source: "am-ata-1-2026" },

  { year: 2026, kind: "SITUACAO_FINANCEIRA", label: "Total de disponibilidades", amount: 22128870.49, asOf: "2026-06-19", source: "am-info-2406" },
  { year: 2026, kind: "SITUACAO_FINANCEIRA", label: "Dívida de médio e longo prazo (empréstimos e locações financeiras)", amount: 14445842.08, asOf: "2026-06-19", source: "am-info-2406" },
  { year: 2026, kind: "SITUACAO_FINANCEIRA", label: "Dívida de curto prazo: acordos, apoios, delegação de competências e contratos-programa", amount: 66344.68, asOf: "2026-06-19", source: "am-info-2406" },
  { year: 2026, kind: "SITUACAO_FINANCEIRA", label: "Dívida de curto prazo: outras dívidas a fornecedores e credores", amount: 1236163.42, asOf: "2026-06-19", source: "am-info-2406" },
  { year: 2026, kind: "SITUACAO_FINANCEIRA", label: "Dívida total da autarquia", amount: 14180307.91, asOf: "2026-06-19", note: "Valor sem a contribuição das entidades relevantes para os limites de dívida, por falta de informação à data, conforme a própria fonte.", source: "am-info-2406" },
  { year: 2026, kind: "SITUACAO_FINANCEIRA", label: "Limite da dívida total para 2026", amount: 135780133.43, asOf: "2026-06-19", source: "am-info-2406" },
];

/** Disponibilidades comunicadas à Assembleia Municipal, para comparar datas. */
export const CASH_HISTORY = [
  { date: "2025-12-22", amount: 16519528.59, source: "am-ata-9-2025" },
  { date: "2026-02-23", amount: 11940893.2, source: "am-ata-1-2026" },
];

export type IssueSeed = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  stage: string;
  dates: { date: string; label: string }[];
  /** Fragmento do título das decisões relacionadas. */
  decisions: string[];
  sources: string[];
  claims: { text: string; sources: string[] }[];
};

export const ISSUES: IssueSeed[] = [
  {
    slug: "criacao-policia-municipal",
    title: "Criação da Polícia Municipal de Torres Vedras",
    category: "Segurança e espaço público",
    summary: "A Assembleia Municipal tem na ordem de trabalhos a criação da Polícia Municipal, com o regulamento do serviço e alterações ao mapa de pessoal e à organização dos serviços.",
    stage: "Em apreciação na Assembleia Municipal",
    dates: [
      { date: "2026-05-04", label: "Recomendação remetida à Comissão Permanente de Proteção Civil e Segurança" },
      { date: "2026-10-14", label: "Propostas 28, 29 e 30/CM/2026 na ordem de trabalhos" },
    ],
    decisions: ["Recomendação sobre videovigilância", "Criação da Polícia Municipal"],
    sources: ["am-ed-12-2026", "am-ed-8-2026", "am-doc-seguranca"],
    claims: [{ text: "A ordem de trabalhos prevê decidir a submissão do regulamento e da alteração ao mapa de pessoal a ratificação por resolução do Conselho de Ministros.", sources: ["am-ed-12-2026"] }],
  },
  {
    slug: "novo-hospital-do-oeste",
    title: "Localização e perfil do novo Hospital do Oeste",
    category: "Saúde",
    summary: "A Assembleia Municipal aprovou moções sobre o novo Hospital do Oeste, a mais recente pedindo a definição urgente da sua localização e do seu perfil assistencial.",
    stage: "Posição aprovada pela Assembleia Municipal",
    dates: [{ date: "2026-06-24", label: "Moção aprovada por maioria" }],
    decisions: ["novo Hospital do Oeste"],
    sources: ["am-doc-hospital", "am-doc-hospital-2025", "am-ed-10-2026"],
    claims: [{ text: "A moção de 24 de junho de 2026 foi aprovada por maioria.", sources: ["am-ed-10-2026"] }],
  },
  {
    slug: "habitacao-santa-cruz-1-direito",
    title: "Habitação: terrenos em Santa Cruz e programa 1.º Direito",
    category: "Habitação",
    summary: "Estão em apreciação a aquisição de dois prédios rústicos em Santa Cruz para habitação a custos controlados e/ou arrendamento acessível e projetos de reabilitação no âmbito do 1.º Direito.",
    stage: "Em apreciação na Assembleia Municipal",
    dates: [
      { date: "2026-06-24", label: "Aprovadas repartições de encargos de projetos do 1.º Direito" },
      { date: "2026-10-14", label: "Propostas 25, 26 e 33/CM/2026 na ordem de trabalhos" },
    ],
    decisions: ["Santa Cruz", "1.º Direito"],
    sources: ["am-ed-12-2026", "am-ed-10-2026"],
    claims: [{ text: "A proposta 26/CM/2026 prevê um empréstimo até 2 725 300,00 € para financiar a aquisição.", sources: ["am-ed-12-2026"] }],
  },
  {
    slug: "campus-medicina-ulisboa",
    title: "Empréstimo para o Campus “Medicina ULisboa”",
    category: "Educação",
    summary: "A proposta 27/CM/2026 pede autorização para um empréstimo de médio e longo prazo até 16 000 000,00 € destinado ao projeto “Medicina ULisboa” — Campus de Torres Vedras.",
    stage: "Em apreciação na Assembleia Municipal",
    dates: [{ date: "2026-10-14", label: "Proposta 27/CM/2026 na ordem de trabalhos" }],
    decisions: ["Medicina ULisboa", "Ensino Superior na Área da Saúde"],
    sources: ["am-ed-12-2026", "am-doc-ensino"],
    claims: [{ text: "O edital indica um spread de 0,14% sobre a Euribor a 6 meses.", sources: ["am-ed-12-2026"] }],
  },
  {
    slug: "orcamento-municipal-2026",
    title: "Orçamento municipal de 2026 e respetivas revisões",
    category: "Orçamento municipal",
    summary: "O orçamento de 2026 foi aprovado em dezembro de 2025 e tem sido objeto de revisões votadas na Assembleia Municipal.",
    stage: "Em execução",
    dates: [
      { date: "2025-12-23", label: "Documentos previsionais aprovados por maioria" },
      { date: "2026-10-14", label: "5.ª revisão na ordem de trabalhos" },
    ],
    decisions: ["Documentos previsionais", "revisão ao Orçamento", "revisão aos documentos previsionais"],
    sources: ["am-ed-1-2026", "am-ata-9-2025", "cm-orc-relatorio-2026", "cm-gop-2026", "am-ed-12-2026"],
    claims: [{ text: "Os documentos previsionais do Município foram aprovados por maioria, com 38 votos a favor e 4 contra.", sources: ["am-ata-9-2025"] }],
  },
  {
    slug: "impostos-municipais-2026",
    title: "IMI, IRS e derrama: taxas municipais",
    category: "Orçamento municipal",
    summary: "Em dezembro de 2025, a Assembleia Municipal aprovou uma taxa de IMI de 0,35% em prédios urbanos, cobrada em 2026, uma participação variável no IRS de 3,75% e uma derrama de 1,00%.",
    stage: "Decidido para este ano",
    dates: [{ date: "2025-12-23", label: "Taxas deliberadas em sessão ordinária" }],
    decisions: ["Taxa de IMI", "Participação variável no IRS", "Derrama de 1,00%"],
    sources: ["am-ed-1-2026", "am-ata-9-2025"],
    claims: [],
  },
  {
    slug: "reparacao-estradas-nacionais",
    title: "Reparação das estradas nacionais após as intempéries",
    category: "Mobilidade e transportes",
    summary: "A Assembleia Municipal aprovou por unanimidade uma moção pela reparação urgente das estradas nacionais afetadas pelas intempéries de inverno no concelho.",
    stage: "Posição aprovada pela Assembleia Municipal",
    dates: [{ date: "2026-05-04", label: "Moção aprovada por unanimidade" }],
    decisions: ["reparação urgente das estradas"],
    sources: ["am-doc-estradas", "am-ed-8-2026"],
    claims: [],
  },
  {
    slug: "escola-basica-a-dos-cunhados",
    title: "Construção da Escola Básica de A-dos-Cunhados",
    category: "Obras públicas",
    summary: "A Assembleia Municipal autorizou a repartição de encargos da empreitada, no total de 6 329 269,97 € acrescidos de IVA, entre 2026 e 2028.",
    stage: "Contrato celebrado",
    dates: [
      { date: "2026-02-24", label: "Repartição de encargos autorizada por unanimidade" },
      { date: "2026-03-11", label: "Contrato celebrado, segundo o Portal BASE" },
    ],
    decisions: ["Escola Básica de A-dos-Cunhados"],
    sources: ["am-ed-4-2026", "base-pesquisa"],
    claims: [{ text: "O edital indica um prazo máximo de execução de 728 dias de calendário.", sources: ["am-ed-4-2026"] }],
  },
  {
    slug: "adaptacao-alteracoes-climaticas",
    title: "Prevenção face às alterações climáticas",
    category: "Ambiente e resíduos",
    summary: "A Assembleia Municipal aprovou uma recomendação à Câmara Municipal pelo reforço na prevenção e no combate aos efeitos das alterações climáticas, depois das intempéries do início de 2026.",
    stage: "Recomendação aprovada",
    dates: [{ date: "2026-02-24", label: "Recomendação aprovada com 41 votos a favor e 1 abstenção" }],
    decisions: ["alterações climáticas"],
    sources: ["am-doc-clima", "am-ata-1-2026", "am-ed-4-2026"],
    claims: [],
  },
  {
    slug: "museu-do-vinho",
    title: "Criação do Museu do Vinho em Torres Vedras",
    category: "Cultura e eventos",
    summary: "A Assembleia Municipal aprovou uma recomendação à Câmara Municipal para a criação do Museu do Vinho e da respetiva comissão instaladora.",
    stage: "Recomendação aprovada",
    dates: [{ date: "2026-05-04", label: "Recomendação aprovada por maioria" }],
    decisions: ["Museu do Vinho"],
    sources: ["am-doc-vinho", "am-ed-8-2026"],
    claims: [],
  },
];
