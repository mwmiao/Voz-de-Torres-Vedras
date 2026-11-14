/** Entidades adjudicantes acompanhadas: o Município e os SMAS. */
export const AWARDING_ENTITIES = [
  { nif: "502173653", name: "Município de Torres Vedras" },
  { nif: "680015973", name: "SMAS de Torres Vedras" },
] as const;

export const MUNICIPAL_NIFS: string[] = AWARDING_ENTITIES.map((entity) => entity.nif);
