import { CardData, SeedData, Transaction } from '../types';
import { parseMonthKey, addMonths, formatMonthPill, formatMonthLong, diffMonths } from './timeline';
import { formatCurrency } from './storage';

export interface ReallocationItem {
  cardId: string;
  cardName: string;
  txId: string;
  descricao: string;
  pagador: string;
  valor: number;
  parcelaStr: string;
  curr: number;
  total: number;
  currentMonthKey: string;
  targetMonthKey: string;
  pago?: boolean;
  data?: string;
  purchaseId?: string;
}

export interface PurchaseAnalysis {
  purchaseKey: string;
  cardId: string;
  cardName: string;
  descricao: string;
  pagador: string;
  totalParcelas: number;
  totalValorCompra: number;
  hasWrap: boolean;
  anchorInstallment?: number;
  anchorMonth?: string;
  installmentsToReallocate: ReallocationItem[];
  allInstallments: {
    txId: string;
    curr: number;
    monthKey: string;
    targetMonthKey: string;
    valor: number;
    pago?: boolean;
    data?: string;
  }[];
  isAmbiguous: boolean;
  ambiguityReason?: string;
}

export interface MonthConsolidatedMove {
  fromMonthKey: string;
  toMonthKey: string;
  count: number;
  totalValor: number;
}

export interface ReallocationAnalysisResult {
  totalCardsExamined: number;
  totalPurchasesIdentified: number;
  totalInstallmentsToReallocate: number;
  reallocationsByMonth: MonthConsolidatedMove[];
  purchasesWithReallocation: PurchaseAnalysis[];
  ambiguousPurchases: PurchaseAnalysis[];
}

interface RawTxItem {
  cardId: string;
  cardName: string;
  monthKey: string;
  origKey: string;
  tx: Transaction;
  curr: number;
  total: number;
}

/**
 * Analisa todos os cartões para detectar parcelas que sofreram wrap-around de 2026 para 2027+
 */
export function analyzeReallocation(cards: CardData[]): ReallocationAnalysisResult {
  const allTxs: RawTxItem[] = [];

  for (const card of cards) {
    for (const [mKey, txs] of Object.entries(card.months || {})) {
      if (!Array.isArray(txs)) continue;
      const parsed = parseMonthKey(mKey);
      for (const tx of txs) {
        if (!tx || !tx.parcelas) continue;
        if (tx.parcelas === 'Fixa' || tx.id.startsWith('fixed-')) continue;

        const match = String(tx.parcelas).trim().match(/^(\d+)\s*\/\s*(\d+)$/);
        if (!match) continue;

        const curr = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (total <= 1) continue; // À vista ou parcela única não é alterada

        allTxs.push({
          cardId: card.id,
          cardName: card.name,
          monthKey: parsed.key,
          origKey: mKey,
          tx,
          curr,
          total,
        });
      }
    }
  }

  // Deduplica transações se o mesmo ID estiver listado tanto na chave legada (ex: "1") quanto na ISO ("2026-01")
  const seenTx = new Set<string>();
  const uniqueTxs: RawTxItem[] = [];
  for (const item of allTxs) {
    const uniqueKey = `${item.cardId}_${item.monthKey}_${item.tx.id}`;
    if (!seenTx.has(uniqueKey)) {
      seenTx.add(uniqueKey);
      uniqueTxs.push(item);
    }
  }

  // Agrupa compras por cartão e fluxo de parcelas
  const groups = new Map<string, RawTxItem[]>();
  for (const item of uniqueTxs) {
    const cleanDesc = (item.tx.descricao || '').replace(/\(Divis[ãa]o\)/gi, '').trim().toLowerCase();
    const pagador = (item.tx.pagador || '').trim().toLowerCase();
    const isDivisao = /\(Divis[ãa]o\)/i.test(item.tx.descricao || '') ? '_div' : '_orig';

    const key = item.tx.purchaseId
      ? `${item.cardId}__pid_${item.tx.purchaseId}__${pagador}${isDivisao}`
      : `${item.cardId}__${cleanDesc}__${item.total}__${pagador}${isDivisao}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const purchasesWithReallocation: PurchaseAnalysis[] = [];
  const ambiguousPurchases: PurchaseAnalysis[] = [];
  const reallocationsByMonthMap = new Map<string, { count: number; totalValor: number }>();
  let totalInstallmentsToReallocate = 0;

  for (const [grpKey, items] of groups.entries()) {
    items.sort((a, b) => a.curr - b.curr);

    // Verifica integridade: não deve haver duplicatas do mesmo número de parcela
    const currCount = new Map<number, number>();
    for (const it of items) {
      currCount.set(it.curr, (currCount.get(it.curr) || 0) + 1);
    }
    const hasDuplicateCurr = Array.from(currCount.values()).some((count) => count > 1);

    const firstItem = items[0];
    const totalParcelas = firstItem.total;
    const totalValorCompra = Math.round(items.reduce((sum, it) => sum + (Number(it.tx.valor) || 0), 0) * 100) / 100;

    // Detecta se houve virada (wrap-around) de ano onde parcela com número maior está em mês menor de 2026
    let wrapIndex = -1;
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i];
      const b = items[i + 1];
      if (b.curr > a.curr) {
        const parsedA = parseMonthKey(a.monthKey);
        const parsedB = parseMonthKey(b.monthKey);
        if (parsedA.year === 2026 && parsedB.year === 2026 && parsedB.month < parsedA.month) {
          wrapIndex = i;
          break;
        }
      }
    }

    if (wrapIndex === -1) {
      // Compra sem wrap-around, já distribuída corretamente ou contida em 2026
      continue;
    }

    if (hasDuplicateCurr) {
      ambiguousPurchases.push({
        purchaseKey: grpKey,
        cardId: firstItem.cardId,
        cardName: firstItem.cardName,
        descricao: firstItem.tx.descricao,
        pagador: firstItem.tx.pagador,
        totalParcelas,
        totalValorCompra,
        hasWrap: true,
        isAmbiguous: true,
        ambiguityReason: 'Parcelas com mesmo número duplicadas na compra. Necessita conferência manual.',
        installmentsToReallocate: [],
        allInstallments: items.map((it) => ({
          txId: it.tx.id,
          curr: it.curr,
          monthKey: it.monthKey,
          targetMonthKey: it.monthKey,
          valor: it.tx.valor,
          pago: it.tx.pago,
          data: it.tx.data,
        })),
      });
      continue;
    }

    const anchorItem = items[wrapIndex];
    const toReallocate: ReallocationItem[] = [];

    const allInstallments = items.map((it) => {
      let targetMonthKey = it.monthKey;
      if (it.curr > anchorItem.curr) {
        targetMonthKey = addMonths(anchorItem.monthKey, it.curr - anchorItem.curr);
      }

      if (targetMonthKey !== it.monthKey) {
        toReallocate.push({
          cardId: it.cardId,
          cardName: it.cardName,
          txId: it.tx.id,
          descricao: it.tx.descricao,
          pagador: it.tx.pagador,
          valor: it.tx.valor,
          parcelaStr: `${it.curr}/${it.total}`,
          curr: it.curr,
          total: it.total,
          currentMonthKey: it.monthKey,
          targetMonthKey,
          pago: it.tx.pago,
          data: it.tx.data,
          purchaseId: it.tx.purchaseId,
        });

        const mapKey = `${it.monthKey} ➔ ${targetMonthKey}`;
        const current = reallocationsByMonthMap.get(mapKey) || { count: 0, totalValor: 0 };
        current.count++;
        current.totalValor = Math.round((current.totalValor + (Number(it.tx.valor) || 0)) * 100) / 100;
        reallocationsByMonthMap.set(mapKey, current);
        totalInstallmentsToReallocate++;
      }

      return {
        txId: it.tx.id,
        curr: it.curr,
        monthKey: it.monthKey,
        targetMonthKey,
        valor: it.tx.valor,
        pago: it.tx.pago,
        data: it.tx.data,
      };
    });

    purchasesWithReallocation.push({
      purchaseKey: grpKey,
      cardId: firstItem.cardId,
      cardName: firstItem.cardName,
      descricao: firstItem.tx.descricao,
      pagador: firstItem.tx.pagador,
      totalParcelas,
      totalValorCompra,
      hasWrap: true,
      anchorInstallment: anchorItem.curr,
      anchorMonth: anchorItem.monthKey,
      installmentsToReallocate: toReallocate,
      allInstallments,
      isAmbiguous: false,
    });
  }

  // Ordena resumo de meses cronologicamente
  const reallocationsByMonth: MonthConsolidatedMove[] = Array.from(reallocationsByMonthMap.entries())
    .map(([key, val]) => {
      const [from, to] = key.split(' ➔ ');
      return {
        fromMonthKey: from,
        toMonthKey: to,
        count: val.count,
        totalValor: val.totalValor,
      };
    })
    .sort((a, b) => a.fromMonthKey.localeCompare(b.fromMonthKey));

  return {
    totalCardsExamined: cards.length,
    totalPurchasesIdentified: groups.size,
    totalInstallmentsToReallocate,
    reallocationsByMonth,
    purchasesWithReallocation,
    ambiguousPurchases,
  };
}

export interface ReallocationExecutionResult {
  updatedData: SeedData;
  totalCardsExamined: number;
  totalPurchasesIdentified: number;
  totalInstallmentsReallocated: number;
  reallocationsByMonth: MonthConsolidatedMove[];
  ambiguousPurchases: PurchaseAnalysis[];
}

/**
 * Executa a realocação das parcelas identificadas de 2026 para 2027+,
 * preservando todas as propriedades, valores e pagadores.
 */
export function executeReallocation(appData: SeedData): ReallocationExecutionResult {
  const analysis = analyzeReallocation(appData.cards);

  // Mapeia por cartão quais transações devem mudar de mês
  const movesByCard = new Map<string, ReallocationItem[]>();
  for (const p of analysis.purchasesWithReallocation) {
    for (const item of p.installmentsToReallocate) {
      if (!movesByCard.has(item.cardId)) {
        movesByCard.set(item.cardId, []);
      }
      movesByCard.get(item.cardId)!.push(item);
    }
  }

  let totalInstallmentsReallocated = 0;

  const updatedCards = appData.cards.map((card) => {
    const cardMoves = movesByCard.get(card.id);
    if (!cardMoves || cardMoves.length === 0) return card;

    const txsToMoveMap = new Map<string, ReallocationItem>();
    for (const m of cardMoves) {
      txsToMoveMap.set(m.txId, m);
    }

    const newMonths: Record<string, Transaction[]> = {};

    // 1. Remove as parcelas que se moveram dos meses de origem (tanto ISO 'AAAA-MM' quanto chaves legadas numéricas)
    for (const [mKey, txs] of Object.entries(card.months || {})) {
      if (!Array.isArray(txs)) continue;
      const parsed = parseMonthKey(mKey);

      const remaining = txs.filter((t) => {
        const move = txsToMoveMap.get(t.id);
        if (move && move.currentMonthKey === parsed.key) {
          return false; // Remove do mês de origem
        }
        return true;
      });

      newMonths[mKey] = remaining;
    }

    // 2. Insere as parcelas nos meses de destino
    for (const move of cardMoves) {
      const targetKey = move.targetMonthKey;
      if (!newMonths[targetKey]) {
        newMonths[targetKey] = [];
      }

      // Previne duplicações
      if (!newMonths[targetKey].some((t) => t.id === move.txId)) {
        // Encontra o objeto completo original da transação
        let originalTx: Transaction | undefined;
        for (const txs of Object.values(card.months || {})) {
          if (Array.isArray(txs)) {
            const found = txs.find((t) => t.id === move.txId);
            if (found) {
              originalTx = found;
              break;
            }
          }
        }

        const txToAdd: Transaction = originalTx
          ? { ...originalTx }
          : {
              id: move.txId,
              descricao: move.descricao,
              valor: move.valor,
              data: move.data || '01/01/2026',
              pagador: move.pagador,
              parcelas: move.parcelaStr,
              pago: move.pago,
              purchaseId: move.purchaseId,
            };

        newMonths[targetKey].push(txToAdd);
        totalInstallmentsReallocated++;
      }
    }

    return {
      ...card,
      months: newMonths,
    };
  });

  const updatedData: SeedData = {
    ...appData,
    cards: updatedCards,
  };

  return {
    updatedData,
    totalCardsExamined: analysis.totalCardsExamined,
    totalPurchasesIdentified: analysis.totalPurchasesIdentified,
    totalInstallmentsReallocated,
    reallocationsByMonth: analysis.reallocationsByMonth,
    ambiguousPurchases: analysis.ambiguousPurchases,
  };
}
