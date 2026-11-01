import type { AlertSeverity, AlertType, Prisma } from "@prisma/client";

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  METEOROLOGIA: "Meteorologia",
  PROTECAO_CIVIL: "Proteção civil",
  MOBILIDADE: "Mobilidade e trânsito",
  AGUA: "Água",
  RESIDUOS: "Resíduos",
  SAUDE: "Saúde pública",
  SERVICOS: "Serviços municipais",
  SEGURANCA: "Segurança",
  CONSULTA: "Consulta pública",
  AVISO_MUNICIPAL: "Aviso municipal",
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  INFORMATIVO: "Informativo",
  ATENCAO: "Atenção",
  IMPORTANTE: "Importante",
  CRITICO: "Crítico",
};

export const SEVERITY_ORDER: AlertSeverity[] = ["CRITICO", "IMPORTANTE", "ATENCAO", "INFORMATIVO"];

/** Freguesias listadas no site da Câmara. `patterns` é texto sem acentos, como em searchKey. */
export const FREGUESIAS = [
  { slug: "a-dos-cunhados", name: "A dos Cunhados", patterns: ["a dos cunhados"] },
  { slug: "campelos-outeiro-cabeca", name: "Campelos e Outeiro da Cabeça", patterns: ["campelos", "outeiro da cabeca"] },
  { slug: "carvoeira-carmoes", name: "Carvoeira e Carmões", patterns: ["carvoeira", "carmoes"] },
  { slug: "dois-portos", name: "Dois Portos", patterns: ["dois portos"] },
  { slug: "freiria", name: "Freiria", patterns: ["freiria"] },
  { slug: "maceira", name: "Maceira", patterns: ["maceira"] },
  { slug: "maxial-monte-redondo", name: "Maxial e Monte Redondo", patterns: ["maxial", "monte redondo"] },
  { slug: "ponte-do-rol", name: "Ponte do Rol", patterns: ["ponte do rol"] },
  { slug: "ramalhal", name: "Ramalhal", patterns: ["ramalhal"] },
  { slug: "runa", name: "Runa", patterns: ["runa"] },
  { slug: "santa-maria-sao-pedro-matacaes", name: "Santa Maria, São Pedro e Matacães", patterns: ["matacaes", "santa maria, sao pedro"] },
  { slug: "sao-pedro-da-cadeira", name: "São Pedro da Cadeira", patterns: ["sao pedro da cadeira"] },
  { slug: "silveira", name: "Silveira", patterns: ["silveira"] },
  { slug: "turcifal", name: "Turcifal", patterns: ["turcifal"] },
  { slug: "ventosa", name: "Ventosa", patterns: ["ventosa"] },
];

export const FREGUESIAS_URL = "https://www.cm-tvedras.pt/municipio/freguesias/";

export const activeAlertWhere = (now: Date): Prisma.AlertWhereInput => ({ OR: [{ endsAt: null }, { endsAt: { gte: now } }] });
export const expiredAlertWhere = (now: Date): Prisma.AlertWhereInput => ({ endsAt: { lt: now } });
