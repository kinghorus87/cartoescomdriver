
import { CardData, Transaction, SeedData } from '../types';

export const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export interface ParsedMonth {
  year: number;
  month: number;
  key: string;
}

/**
 * Retorna a chave 'AAAA-MM' do mês atual do sistema.
 */
export function getCurrentSystemMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Mês real atual de referência do sistema.
 * Atualizado automaticamente conforme a data do computador.
 */
export const CURRENT_REAL_MONTH = getCurrentSystemMonthKey();

/**
 * Converte qualquer formato de mês para { year, month, key }.
 */
export function parseMonthKey(val: string | number | undefined): ParsedMonth {
  if (!val) {
    return parseMonthKey(CURRENT_REAL_MONTH);
  }

  const str = String(val).trim();

  if (/^\d{1,2}$/.test(str)) {
    const m = Math.max(1, Math.min(12, parseInt(str, 10)));

    return {
      year: 2026,
      month: m,
      key: `2026-${String(m).padStart(2, '0')}`
    };
  }

  if (/^\d{4}-\d{2}$/.test(str)) {
    const [yStr, mStr] = str.split('-');
    const year = parseInt(yStr, 10);
    const month = Math.max(1, Math.min(12, parseInt(mStr, 10)));

    return {
      year,
      month,
      key: `${year}-${String(month).padStart(2, '0')}`
    };
  }

  return parseMonthKey(CURRENT_REAL_MONTH);
}

/**
 * Retorna uma chave 'AAAA-MM'.
 */
export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Adiciona N meses a uma chave mantendo a cronologia entre anos.
 */
export function addMonths(monthKey: string, count: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const totalMonths = year * 12 + (month - 1) + count;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;

  return toMonthKey(newYear, newMonth);
}

/**
 * Diferença em meses entre duas chaves (to - from).
 */
export function diffMonths(fromKey: string, toKey: string): number {
  const { year: y1, month: m1 } = parseMonthKey(fromKey);
  const { year: y2, month: m2 } = parseMonthKey(toKey);

  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Gera um intervalo consecutivo de meses.
 */
export function generateMonthRange(startKey: string, count: number): string[] {
  const list: string[] = [];

  for (let i = 0; i < count; i++) {
    list.push(addMonths(startKey, i));
  }

  return list;
}

export interface Rolling36Window {
  startMonthKey: string;  // Ex: Jan/2025 quando âncora é Jan/2026 (-12 meses)
  endMonthKey: string;    // Ex: Dez/2027 quando âncora é Jan/2026 (+23 meses) -> Total: 36 meses
  anchorMonthKey: string; // Ex: Jan/2026 (mês atual do computador)
  months: string[];       // Lista com exatamente as 36 chaves 'AAAA-MM'
}

/**
 * Retorna a Janela Móvel contínua de exatamente 36 meses baseada na data atual do computador.
 * Conforme regras do sistema:
 * - Etapa 1: Jan/2025 a Dez/2027 (36 meses) quando âncora for Jan/2026 (-12 meses a +23 meses)
 * - Etapa 2: Fev/2025 a Jan/2028 (36 meses) quando avançar para Fev/2026
 * - Etapa 3: Mar/2025 a Fev/2028 (36 meses) quando avançar para Mar/2026
 * 100% offline, sem dependência de internet ou servidores externos.
 */
export function getRolling36Window(anchorMonthKey?: string): Rolling36Window {
  const anchor = anchorMonthKey ? parseMonthKey(anchorMonthKey).key : getCurrentSystemMonthKey();
  const startMonthKey = addMonths(anchor, -12);
  const endMonthKey = addMonths(anchor, 23);
  const months = generateMonthRange(startMonthKey, 36);

  return {
    startMonthKey,
    endMonthKey,
    anchorMonthKey: anchor,
    months,
  };
}

/**
 * Verifica se um mês 'AAAA-MM' está estritamente dentro da janela móvel de 36 meses.
 */
export function isMonthInRollingWindow(monthKey: string | number | undefined, anchorMonthKey?: string): boolean {
  if (!monthKey) return false;
  const parsed = parseMonthKey(monthKey);
  const { startMonthKey, endMonthKey } = getRolling36Window(anchorMonthKey);
  return diffMonths(startMonthKey, parsed.key) >= 0 && diffMonths(parsed.key, endMonthKey) >= 0;
}

/**
 * Verifica se um mês é anterior ao início da janela móvel de 36 meses (já expirou e deve ser excluído definitivamente).
 */
export function isMonthOlderThanWindow(monthKey: string | number | undefined, anchorMonthKey?: string): boolean {
  if (!monthKey) return false;
  const parsed = parseMonthKey(monthKey);
  const { startMonthKey } = getRolling36Window(anchorMonthKey);
  return diffMonths(startMonthKey, parsed.key) < 0;
}

/**
 * Exclusão definitiva de dados que saíram da janela móvel de 36 meses.
 * - Apaga permanentemente todos os lançamentos de meses anteriores a startMonthKey.
 * - Apaga apenas as parcelas daqueles meses expirados, preservando as parcelas nos meses dentro da janela.
 * - Apaga registros de faturas pagas (paidInvoices) vinculados a meses fora da janela.
 * - Não mantém backups, lixeira ou histórico oculto desses dados.
 */
export function pruneOutOfWindowData(data: SeedData, anchorMonthKey?: string): {
  data: SeedData;
  prunedMonthsCount: number;
  prunedTxsCount: number;
} {
  const { startMonthKey, endMonthKey } = getRolling36Window(anchorMonthKey);
  let prunedMonthsCount = 0;
  let prunedTxsCount = 0;

  // 1. Limpeza permanente em todos os cartões
  const updatedCards = (data.cards || []).map((card) => {
    let cardModified = false;
    const newMonths: Record<string, Transaction[]> = {};

    Object.entries(card.months || {}).forEach(([mKey, txs]) => {
      const parsed = parseMonthKey(mKey);

      // Exclui permanentemente se for anterior ao início da janela móvel de 36 meses
      if (diffMonths(startMonthKey, parsed.key) < 0) {
        cardModified = true;
        prunedMonthsCount++;
        if (Array.isArray(txs)) {
          prunedTxsCount += txs.length;
        }
        return; // Excluído definitivamente sem cópias
      }

      // Não permite meses além do final da janela (não liberados antes do avanço)
      if (diffMonths(parsed.key, endMonthKey) < 0) {
        cardModified = true;
        prunedMonthsCount++;
        if (Array.isArray(txs)) {
          prunedTxsCount += txs.length;
        }
        return;
      }

      // Preserva integralmente meses válidos dentro da janela de 36 meses
      newMonths[mKey] = txs;
    });

    // Parcelas guardadas (retiradas da sequência) de meses já expirados também são excluídas
    let newArchived = card.archivedInstallments;
    if (newArchived && newArchived.length > 0) {
      const keptArchived = newArchived.filter(
        (a) => diffMonths(startMonthKey, parseMonthKey(a.monthKey).key) >= 0
      );
      if (keptArchived.length !== newArchived.length) {
        cardModified = true;
        prunedTxsCount += newArchived.length - keptArchived.length;
        newArchived = keptArchived;
      }
    }

    if (!cardModified) return card;
    return {
      ...card,
      months: newMonths,
      ...(newArchived ? { archivedInstallments: newArchived } : {}),
    };
  });

  // 2. Limpeza permanente de status de faturas pagas fora da janela
  const newPaidInvoices: Record<string, boolean> = {};
  let paidModified = false;

  Object.entries(data.paidInvoices || {}).forEach(([invKey, isPaid]) => {
    const lastUnderscore = invKey.lastIndexOf('_');
    if (lastUnderscore !== -1) {
      const rawMonth = invKey.slice(lastUnderscore + 1);
      const parsed = parseMonthKey(rawMonth);
      if (diffMonths(startMonthKey, parsed.key) < 0 || diffMonths(parsed.key, endMonthKey) < 0) {
        paidModified = true;
        return; // Excluído definitivamente
      }
    }
    newPaidInvoices[invKey] = isPaid;
  });

  // 3. Limpeza do simulador de gastos para meses fora da janela
  const newSavedValues: Record<string, any> = {};
  let simModified = false;

  if (data.simulator?.savedValues) {
    Object.entries(data.simulator.savedValues).forEach(([k, v]) => {
      if (/^\d{4}-\d{2}$/.test(k)) {
        const parsed = parseMonthKey(k);
        if (diffMonths(startMonthKey, parsed.key) < 0 || diffMonths(parsed.key, endMonthKey) < 0) {
          simModified = true;
          return;
        }
      }
      newSavedValues[k] = v;
    });
  }

  const resultData: SeedData = {
    ...data,
    cards: updatedCards,
    paidInvoices: paidModified ? newPaidInvoices : (data.paidInvoices || {}),
    simulator: {
      ...data.simulator,
      savedValues: simModified ? newSavedValues : (data.simulator?.savedValues || {}),
    },
  };

  return {
    data: resultData,
    prunedMonthsCount,
    prunedTxsCount,
  };
}

/**
 * Retorna as opções de meses estritamente delimitadas pela janela móvel contínua de 36 meses.
 * 100% offline e dinâmica.
 */
export function getDynamicMonthRange(
  extraKeys: (string | undefined)[] = [],
  yearsAhead: number = 20,
  yearsPast: number = 3
): string[] {
  const { months } = getRolling36Window();
  return months;
}

/**
 * Formato abreviado: Out/26, Jan/27, Fev/28.
 */
export function formatMonthPill(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const name = MESES_NOMES[month - 1].slice(0, 3);
  const shortYear = String(year).slice(-2);

  return `${name}/${shortYear}`;
}

/**
 * Formato por extenso: Outubro de 2026.
 */
export function formatMonthLong(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);

  return `${MESES_NOMES[month - 1]} de ${year}`;
}

/**
 * Retorna os 7 meses consecutivos centralizando
 * o mês de referência na 4ª posição, estritamente limitados à janela móvel de 36 meses.
 */
export function getVisible7Months(
  referenceMonth: string,
  timelineStart?: string
): string[] {
  const { startMonthKey, endMonthKey } = getRolling36Window();
  const effectiveStart = timelineStart && diffMonths(timelineStart, startMonthKey) >= 0 ? timelineStart : startMonthKey;

  let startMonth = addMonths(referenceMonth, -3);

  // Não permite ultrapassar o início da janela de 36 meses
  if (diffMonths(effectiveStart, startMonth) < 0) {
    startMonth = effectiveStart;
  }

  // Não permite ultrapassar o final da janela de 36 meses
  const maxStart = addMonths(endMonthKey, -6);
  if (diffMonths(startMonth, maxStart) < 0) {
    startMonth = maxStart;
  }

  return generateMonthRange(startMonth, 7);
}

/**
 * Retorna as transações de um cartão para uma chave AAAA-MM,
 * mantendo compatibilidade com chaves legadas numéricas.
 */
export function getCardTransactions(
  card: CardData,
  monthKey: string
): Transaction[] {
  if (!card || !card.months) return [];

  const { year, month, key: normalized } = parseMonthKey(monthKey);

  const byKey = Array.isArray(card.months[normalized])
    ? card.months[normalized]
    : [];

  let legacy: Transaction[] = [];

  if (year === 2026) {
    const rawLegacy = card.months[String(month)] || (card.months as any)[month];

    if (Array.isArray(rawLegacy)) {
      legacy = rawLegacy;
    }
  }

  const map = new Map<string, Transaction>();

  legacy.forEach((t) => {
    if (t && t.id) map.set(t.id, t);
  });

  byKey.forEach((t) => {
    if (t && t.id) map.set(t.id, t);
  });

  return Array.from(map.values());
}

/**
 * Formatação numérica brasileira.
 */
export function formatFullBrazilianNumber(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val || 0);
}

/**
 * Formatação em moeda brasileira.
 */
export function formatFullBrazilianCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
}

export interface DueStatus {
  status: 'no_prazo' | 'a_vencer' | 'atrasado';
  label: string;
  colorClass: string;
  badgeClass: string;
  diffDays: number;
}

/**
 * Retorna a situação do vencimento da fatura.
 */
export function getDueStatus(
  dueDay: string | number | undefined,
  monthKey: string,
  referenceDate: Date = new Date()
): DueStatus {
  const { year, month } = parseMonthKey(monthKey);

  const day = Math.max(
    1,
    Math.min(
      31,
      parseInt(String(dueDay || '10').replace(/\D/g, ''), 10) || 10
    )
  );

  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const dueDate = new Date(year, month - 1, day);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'atrasado',
      label: 'Atrasado',
      colorClass: 'text-rose-400',
      badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      diffDays,
    };
  }

  if (diffDays <= 5) {
    return {
      status: 'a_vencer',
      label: 'A vencer',
      colorClass: 'text-amber-400',
      badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      diffDays,
    };
  }

  return {
    status: 'no_prazo',
    label: 'No prazo',
    colorClass: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
    diffDays,
  };
}
