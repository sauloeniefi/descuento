/**
 * Classifica o preço atual contra o próprio histórico do produto, em vez de
 * depender de um preço-alvo escolhido no chute.
 *
 * A janela é de 90 dias e a referência é o percentil: "onde este preço fica
 * entre os preços já vistos". Percentil é robusto a promoções isoladas, que
 * distorcem a média.
 */

export type PriceLevel = "otimo" | "bom" | "normal" | "caro";

/** Abaixo disso o histórico é curto demais para classificar. */
export const MIN_SAMPLES = 5;

/** Janela usada nas estatísticas (dias). Também usada no SQL de listProducts. */
export const WINDOW_DAYS = 90;

export const levelLabel: Record<PriceLevel, string> = {
  otimo: "Ótimo",
  bom: "Bom",
  normal: "Normal",
  caro: "Caro",
};

export interface PriceStats {
  /** Último preço coletado. */
  current: number | null;
  /** Coletas dentro da janela. */
  samples: number;
  /** Coletas da janela com preço <= o atual (base do percentil). */
  atOrBelow: number;
  /** Menor preço da janela. */
  min: number | null;
  /** Primeiro quartil da janela: preço que só 25% das coletas bateram. */
  p25: number | null;
  /** Preço-alvo definido pelo usuário, se houver. */
  target: number | null;
}

export interface PriceAnalysis {
  level: PriceLevel | null;
  /** 0 a 1: fração das coletas da janela com preço <= o atual. */
  percentile: number | null;
  /** Alvo realista sugerido pelo histórico. */
  suggestedTarget: number | null;
  /** Aviso quando o alvo do usuário nunca chegou perto de acontecer. */
  targetWarning: string | null;
  opportunity: string | null;
}

export function analyzePrice(s: PriceStats, allTimeMin: number | null, allTimeSamples: number): PriceAnalysis {
  const percentile = s.current != null && s.samples >= MIN_SAMPLES ? s.atOrBelow / s.samples : null;
  const level = percentile == null ? null : percentile <= 0.1 ? "otimo" : percentile <= 0.3 ? "bom" : percentile <= 0.7 ? "normal" : "caro";
  const suggestedTarget = s.samples >= MIN_SAMPLES && s.p25 != null ? Math.round(s.p25 * 100) / 100 : null;

  return {
    level,
    percentile,
    suggestedTarget,
    targetWarning: targetWarning(s),
    opportunity: opportunity(s, level, percentile, allTimeMin, allTimeSamples),
  };
}

/** O alvo é inalcançável se nem o menor preço da janela chegou perto dele. */
function targetWarning(s: PriceStats): string | null {
  if (s.target == null || s.min == null || s.samples < MIN_SAMPLES) return null;
  if (s.target >= s.min) return null;
  const faltam = Math.round((1 - s.target / s.min) * 100);
  if (faltam < 10) return null;
  return `Alvo ${faltam}% abaixo do menor preço dos últimos ${WINDOW_DAYS} dias — dificilmente será atingido.`;
}

function opportunity(
  s: PriceStats,
  level: PriceLevel | null,
  percentile: number | null,
  allTimeMin: number | null,
  allTimeSamples: number,
): string | null {
  if (s.current == null) return null;
  if (s.target != null && s.current <= s.target) return "Abaixo do preço-alvo";
  if (allTimeSamples >= 3 && allTimeMin != null && s.current <= allTimeMin) return "Menor preço já registrado";
  // Um mínimo antigo continua no cartão para comparação, mas não impede o
  // aviso de que este é o menor preço do período recente.
  if (s.samples >= MIN_SAMPLES && s.min != null && s.current <= s.min) return `Menor preço em ${WINDOW_DAYS} dias`;
  if (level === "otimo" && percentile != null) {
    return `Entre os ${Math.max(1, Math.round(percentile * 100))}% mais baratos em ${WINDOW_DAYS} dias`;
  }
  return null;
}
