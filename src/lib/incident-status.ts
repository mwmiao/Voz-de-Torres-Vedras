import type { VerificationStatus } from "@prisma/client";

/**
 * Cada estado tem forma, ícone e texto próprios: a cor nunca é o único sinal.
 * Confirmado: cheio, com visto. Reportado: contorno grosso, com jornal.
 * Não confirmado: contorno tracejado, com ponto de interrogação. Em apuramento: relógio e anel pulsante.
 */
export const STATUS_ICON: Record<VerificationStatus, string> = {
  CONFIRMADO: "M3.5 8.5l3 3 6-7",
  REPORTADO: "M3 3.5h10v9H3zM5.5 6h5M5.5 8.5h5M5.5 11h3",
  NAO_CONFIRMADO: "M6 6a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6M8 11.5v.5",
  EM_APURAMENTO: "M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 5v3.2l2 1.3",
};

export const STATUS_CLASS: Record<VerificationStatus, string> = {
  CONFIRMADO: "status-confirmado",
  REPORTADO: "status-reportado",
  NAO_CONFIRMADO: "status-nao-confirmado",
  EM_APURAMENTO: "status-em-apuramento",
};

export const statusSvg = (status: VerificationStatus, className = "status-icon") =>
  `<svg aria-hidden="true" viewBox="0 0 16 16" class="${className}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${STATUS_ICON[status]}"/></svg>`;
