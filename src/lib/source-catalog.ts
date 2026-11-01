/**
 * Catálogo das origens de dados. Só tem metadados, para poder ser lido pelas páginas;
 * a recolha de cada origem está em ingestion/sources.
 */

export type FetchMethod = "API" | "FICHEIRO" | "SCRAPER" | "TRANSCRICAO";

export type SourceDefinition = {
  id: string;
  name: string;
  baseUrl: string;
  method: FetchMethod;
  frequencyHours: number;
  /** Falso quando não há forma legítima e fiável de recolher automaticamente. */
  enabled: boolean;
  description: string;
  /** Regras aplicadas ao validar os registos. */
  validation: string;
  /** Política de acesso: autenticação, limites e restrições conhecidas. */
  access: string;
  disabledReason?: string;
};

const DAY = 24;
const WEEK = 7 * DAY;

export const SOURCE_CATALOG: SourceDefinition[] = [
  {
    id: "am-documentos",
    name: "Assembleia Municipal: documentos publicados",
    baseUrl: "https://www.am-tvedras.pt/wp-json/wp/v2/media",
    method: "API",
    frequencyHours: DAY,
    enabled: true,
    description: "Atas, editais, moções, recomendações e relatórios em PDF, desde 2025.",
    validation: "URL oficial, título e data de publicação em cada documento.",
    access: "API pública do site, sem autenticação. Paginada, a 100 registos por página.",
  },
  {
    id: "am-editais",
    name: "Assembleia Municipal: editais e sessões",
    baseUrl: "https://www.am-tvedras.pt/wp-json/wp/v2/pages",
    method: "API",
    frequencyHours: DAY,
    enabled: true,
    description: "Editais publicados como páginas, de onde se obtêm as sessões convocadas.",
    validation: "Título com número de edital; sessão só com data reconhecida.",
    access: "API pública do site, sem autenticação. Paginada, a 100 registos por página.",
  },
  {
    id: "am-situacao-financeira",
    name: "Assembleia Municipal: situação financeira do Município",
    baseUrl: "https://www.am-tvedras.pt/sessoes/info-do-pres-da-camara/",
    method: "FICHEIRO",
    frequencyHours: DAY,
    enabled: true,
    description: "Disponibilidades e dívida, lidas das informações do Presidente da Câmara em PDF.",
    validation: "Falha se o PDF não tiver a data de referência e o total de disponibilidades.",
    access: "PDF públicos, localizados pela API do site.",
  },
  {
    id: "am-composicao",
    name: "Assembleia Municipal: composição e comissões",
    baseUrl: "https://www.am-tvedras.pt/composicao26/",
    method: "SCRAPER",
    frequencyHours: WEEK,
    enabled: true,
    description: "Deteta alterações nas páginas de composição e comissões.",
    validation: "Falha se a página não mencionar a mesa e os deputados municipais.",
    access: "Páginas públicas, a respeitar o robots.txt.",
  },
  {
    id: "base-contratos",
    name: "Portal BASE: contratos públicos",
    baseUrl: "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2026/",
    method: "API",
    frequencyHours: WEEK,
    enabled: true,
    description: "Contratos do Município e dos SMAS, a partir dos dados abertos do IMPIC.",
    validation: "Identificador, entidade adjudicante, preço numérico e URL do Portal BASE.",
    access: "API pública de dados.gov.pt, sem chave. Ficheiro anual comprimido, com cerca de 50 MB.",
  },
  {
    id: "base-anuncios",
    name: "Portal BASE: anúncios de procedimentos",
    baseUrl: "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-anuncios-de-2012-a-2026/",
    method: "API",
    frequencyHours: WEEK,
    enabled: true,
    description: "Concursos públicos e anúncios publicados em Diário da República.",
    validation: "NIF da entidade, número do anúncio e URL do Diário da República.",
    access: "API pública de dados.gov.pt, sem chave.",
  },
  {
    id: "base-modificacoes",
    name: "Portal BASE: modificações contratuais",
    baseUrl: "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-modificacoes-contratuais-de-2012-a-2026/",
    method: "API",
    frequencyHours: WEEK,
    enabled: true,
    description: "Alterações a contratos já registados.",
    validation: "Só entra se o contrato já existir na plataforma.",
    access: "API pública de dados.gov.pt, sem chave.",
  },
  {
    id: "cm-editais",
    name: "Câmara Municipal: editais",
    baseUrl: "https://www.cm-tvedras.pt/documentos/editaisatas/editaiscm",
    method: "SCRAPER",
    frequencyHours: DAY,
    enabled: true,
    description: "Editais e reuniões do Executivo convocadas.",
    validation: "Falha com menos de 100 editais ou sem o formato «Edital N.º».",
    access: "Sem API. Só páginas HTML públicas, a respeitar o robots.txt.",
  },
  {
    id: "cm-atas",
    name: "Câmara Municipal: atas",
    baseUrl: "https://www.cm-tvedras.pt/documentos/editaisatas/atascm",
    method: "SCRAPER",
    frequencyHours: DAY,
    enabled: true,
    description: "Índice de atas e de atas em minuta. Os PDF são ligados, mas não recolhidos.",
    validation: "Falha com menos de 50 atas.",
    access: "Sem API. O robots.txt exclui os PDF, pelo que só se lê o índice.",
  },
  {
    id: "cm-gestao",
    name: "Câmara Municipal: documentos de gestão",
    baseUrl: "https://www.cm-tvedras.pt/documentos/gestao/",
    method: "SCRAPER",
    frequencyHours: WEEK,
    enabled: true,
    description: "Orçamentos, alterações, execução e prestação de contas. Os PDF são ligados, mas não recolhidos.",
    validation: "Falha com menos de 50 documentos.",
    access: "Sem API. O robots.txt exclui os PDF, pelo que os valores não são extraídos.",
  },
  {
    id: "cm-regulamentos",
    name: "Câmara Municipal: regulamentos",
    baseUrl: "https://www.cm-tvedras.pt/documentos/regulamentos/",
    method: "SCRAPER",
    frequencyHours: WEEK,
    enabled: true,
    description: "Regulamentos municipais publicados.",
    validation: "Falha com menos de 10 regulamentos.",
    access: "Sem API. Só páginas HTML públicas, a respeitar o robots.txt.",
  },
  {
    id: "cm-contratacao",
    name: "Câmara Municipal: procedimentos de contratação",
    baseUrl: "https://www.cm-tvedras.pt/municipio/camara-municipal/contratacao-publica/",
    method: "SCRAPER",
    frequencyHours: WEEK,
    enabled: true,
    description: "Anúncios e relatórios de procedimentos em curso.",
    validation: "Falha com menos de 5 procedimentos.",
    access: "Sem API. O robots.txt exclui os PDF, pelo que só se lê a página.",
  },
  {
    id: "cm-composicao",
    name: "Câmara Municipal: composição e pelouros",
    baseUrl: "https://www.cm-tvedras.pt/o/composicaocm",
    method: "SCRAPER",
    frequencyHours: WEEK,
    enabled: true,
    description: "Eleitos do Executivo, forças políticas e pelouros.",
    validation: "Falha com menos de 7 eleitos.",
    access: "Sem API. Só páginas HTML públicas, a respeitar o robots.txt.",
  },
  {
    id: "dre-legislacao",
    name: "Diário da República: legislação relevante",
    baseUrl: "https://diariodarepublica.pt/",
    method: "SCRAPER",
    frequencyHours: WEEK,
    enabled: false,
    description: "Atos publicados que afetem o Município.",
    validation: "Por definir.",
    access: "Mapas do site públicos, sem indicação da entidade.",
    disabledReason:
      "Sem API pública: os mapas do site não indicam a entidade, pelo que filtrar Torres Vedras exigiria abrir cada ato. Os anúncios de procedimentos do Município chegam pela origem base-anuncios.",
  },
  {
    id: "transcricao-oficial",
    name: "Transcrição de documentos oficiais",
    baseUrl: "https://www.am-tvedras.pt/sessoes/editais/",
    method: "TRANSCRICAO",
    frequencyHours: 0,
    enabled: true,
    description: "Decisões, votos e valores transcritos de editais e atas. Atualizada por importação ou no seed.",
    validation: "Cada linha exige uma fonte de domínio oficial.",
    access: "Não é recolhida automaticamente.",
  },
];
