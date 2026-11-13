import type { PrismaClient } from "@prisma/client";
import type { PoliteHttp } from "../fetchers/http";
import type { Collected } from "../types";

export type CollectorInput = { http: PoliteHttp; db: PrismaClient; revision: string | null; now: Date };
export type Collector = (input: CollectorInput) => Promise<Collected>;
