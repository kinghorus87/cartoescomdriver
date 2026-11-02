import { CardData, Transaction } from '../types';
import { parseMonthKey, isMonthInRollingWindow, formatMonthPill, formatMonthLong } from './timeline';

export type SearchMode = 'restantes' | 'historico' | 'pagos';

export interface SplitPersonDetail {
  id: string;
  pagador: string;
  valor: number;
  parcelas: string;
  mes: number;
  year?: number;
  monthKey: string;
  isPaid: boolean;
  data: string;
  totalParcelasTexto?: string;
}

export interface UnifiedSearchItem {
  id: string;
  data: string;
  descricao: string;
  parcelas: string;
  valorTotal: number;
  valorPendente: number;
  valorPago: number;
  pagadores: string[];
  isDivided: boolean;
  splitDetails: SplitPersonDetail[];
  cartaoNome: string;
  cartaoId: string;
  mes: number;
  year?: number;
  monthKey: string;
  isPaid: boolean;
  isPartiallyPaid: boolean;
  hasPendingPart: boolean;
  purchaseKey: string;
}

export interface PaidItemSummary {
  purchaseKey: string;
  nome: string;
  cartaoNome: string;
  cartaoId: string;
  pagadores: string;
  isDivided: boolean;
  totalParcelasTexto: string;
  valorParcelaMedia: number;
  valorTotal: number;
  periodoMeses: string;
  datas: string;
  parcelasCount: number;
  itens: UnifiedSearchItem[];
  pessoasResumo: {
    pagador: string;
    valorTotal: number;
    parcelasTexto: string;
    todasPagas: boolean;
  }[];
}

export interface SearchResultData {
  allFound: UnifiedSearchItem[];
  parcelasRestantes: UnifiedSearchItem[];
  itensTotalmentePagos: PaidItemSummary[];
  contagemRealRestantes: number;
  contagemRealHistorico: number;
  valorTotalRestante: number;
  valorTotalPagoHistorico: number;
  valorTotalGeralHistorico: number;
  valorTotalItensPagos: number;
  allDescriptions: string[];
  filteredSuggestions: string[];
}

/**
 * Normaliza e limpa a descrição removendo marcações de divisão.
 */
export function cleanDescription(desc: string): string {
  return (desc || '')
    .replace(/\(Divis[ãa]o\)/gi, '')
    .trim();
}

/**
 * Coleta todas as descrições disponíveis no sistema dentro da janela de 36 meses para auto-sugestão.
 */
export function getAllDescriptions(cards: CardData[]): string[] {
  const set = new Set<string>();
  cards.forEach((card) => {
    Object.entries(card.months || {}).forEach(([rawMonthKey, txs]) => {
      const { key: mKey } = parseMonthKey(rawMonthKey);
      if (!isMonthInRollingWindow(mKey)) return;

      if (Array.isArray(txs)) {
        txs.forEach((tx) => {
          if (tx.descricao && tx.descricao.trim()) {
            const limpa = cleanDescription(tx.descricao);
            if (limpa) set.add(limpa);
          }
        });
      }
    });
  });
  return Array.from(set).sort();
}

/**
 * Realiza a busca unificada de itens respeitando:
 * 1. Janela móvel de 36 meses.
 * 2. Agrupamento correto de divisões entre pessoas (sem duplicar lançamentos).
 * 3. As 3 opções de consulta (Parcelas restantes, Histórico completo e Itens já pagos).
 */
export function searchItems(
  cards: CardData[],
  searchTerm: string,
  selectedCartaoName: string = 'todos',
  paidInvoices: Record<string, boolean> = {}
): SearchResultData {
  const term = searchTerm.trim().toLowerCase();
  const allDescriptions = getAllDescriptions(cards);

  const filteredSuggestions = !term
    ? allDescriptions.slice(0, 15)
    : allDescriptions.filter((d) => d.toLowerCase().includes(term));

  if (!term) {
    return {
      allFound: [],
      parcelasRestantes: [],
      itensTotalmentePagos: [],
      contagemRealRestantes: 0,
      contagemRealHistorico: 0,
      valorTotalRestante: 0,
      valorTotalPagoHistorico: 0,
      valorTotalGeralHistorico: 0,
      valorTotalItensPagos: 0,
      allDescriptions,
      filteredSuggestions,
    };
  }

  // Mapa de agrupamento por ocorrência de parcela (evita duplicação de divisões)
  // Chave: cardId + purchaseId/cleanDesc + parcelas + monthKey
  const installmentMap = new Map<string, {
    card: CardData;
    monthKey: string;
    month: number;
    year?: number;
    txs: Transaction[];
  }>();

  // Mapa de compras inteiras para o Modo 3 (Itens Já Pagos)
  const fullPurchasesMap = new Map<string, Map<string, {
    card: CardData;
    monthKey: string;
    month: number;
    year?: number;
    txs: Transaction[];
  }>>();

  cards.forEach((card) => {
    if (selectedCartaoName !== 'todos' && card.name.toLowerCase() !== selectedCartaoName.toLowerCase()) {
      return;
    }

    Object.entries(card.months || {}).forEach(([rawMonthKey, txs]) => {
      if (!Array.isArray(txs)) return;
      const { year, month, key: mKey } = parseMonthKey(rawMonthKey);

      // Limita estritamente à janela de 36 meses
      if (!isMonthInRollingWindow(mKey)) return;

      txs.forEach((tx) => {
        const descLower = (tx.descricao || '').toLowerCase();
        if (!descLower.includes(term)) return;

        const cleanDesc = cleanDescription(tx.descricao);
        const cleanDescLower = cleanDesc.toLowerCase();
        const denom = tx.parcelas?.includes('/') ? tx.parcelas.split('/')[1] : '1';

        const purchaseKey = tx.purchaseId
          ? `${card.id}_${tx.purchaseId}`
          : `${card.id}_${cleanDescLower}_${denom}`;

        const occurrenceKey = `${purchaseKey}_${tx.parcelas || '1'}_${mKey}`;

        if (!installmentMap.has(occurrenceKey)) {
          installmentMap.set(occurrenceKey, {
            card,
            monthKey: mKey,
            month,
            year,
            txs: [],
          });
        }
        installmentMap.get(occurrenceKey)!.txs.push(tx);

        if (!fullPurchasesMap.has(purchaseKey)) {
          fullPurchasesMap.set(purchaseKey, new Map());
        }
        const pMap = fullPurchasesMap.get(purchaseKey)!;
        if (!pMap.has(occurrenceKey)) {
          pMap.set(occurrenceKey, {
            card,
            monthKey: mKey,
            month,
            year,
            txs: [],
          });
        }
        pMap.get(occurrenceKey)!.txs.push(tx);
      });
    });
  });

  const isCardMonthPaid = (cardId: string, mKey: string, month: number, year?: number) => {
    return Boolean(
      paidInvoices[`${cardId}_${mKey}`] ||
      (year === 2026 && paidInvoices[`${cardId}_${month}`])
    );
  };

  // Converte ocorrências agrupadas em UnifiedSearchItem
  const allUnifiedItems: UnifiedSearchItem[] = [];

  installmentMap.forEach((entry, occKey) => {
    const { card, monthKey, month, year, txs } = entry;
    const invoicePaid = isCardMonthPaid(card.id, monthKey, month, year);

    // Deduplica transações idênticas que possam ter vindo de chaves legadas
    const seenTxId = new Set<string>();
    const uniqueTxs: Transaction[] = [];
    txs.forEach((t) => {
      const key = `${t.id || ''}_${t.descricao}_${t.valor}_${t.pagador}_${t.parcelas}`;
      if (!seenTxId.has(key)) {
        seenTxId.add(key);
        uniqueTxs.push(t);
      }
    });

    const first = uniqueTxs[0];
    const cleanDesc = cleanDescription(first.descricao);
    const denom = first.parcelas?.includes('/') ? first.parcelas.split('/')[1] : '1';
    const totalParcelasTexto = first.parcelas?.includes('/') ? `${denom}x` : '1x';

    const purchaseKey = first.purchaseId
      ? `${card.id}_${first.purchaseId}`
      : `${card.id}_${cleanDesc.toLowerCase()}_${denom}`;

    const splitDetails: SplitPersonDetail[] = uniqueTxs.map((t) => {
      const isPaid = Boolean(t.pago || invoicePaid);
      return {
        id: t.id,
        pagador: t.pagador || 'Não informado',
        valor: Number(t.valor) || 0,
        parcelas: t.parcelas || '1/1',
        mes: month,
        year,
        monthKey,
        isPaid,
        data: t.data || first.data || '',
        totalParcelasTexto,
      };
    });

    const valorTotal = splitDetails.reduce((sum, s) => sum + s.valor, 0);
    const valorPago = splitDetails.reduce((sum, s) => sum + (s.isPaid ? s.valor : 0), 0);
    const valorPendente = splitDetails.reduce((sum, s) => sum + (!s.isPaid ? s.valor : 0), 0);

    const isAllPaid = splitDetails.every((s) => s.isPaid);
    const isAnyPaid = splitDetails.some((s) => s.isPaid);
    const hasPendingPart = splitDetails.some((s) => !s.isPaid);

    const payersSet = new Set<string>();
    splitDetails.forEach((s) => {
      if (s.pagador && s.pagador.trim()) payersSet.add(s.pagador.trim());
    });
    const pagadores = Array.from(payersSet);

    // Identifica se é compra dividida: possui mais de uma pessoa ou mais de um lançamento agrupado
    const isDivided = splitDetails.length > 1;

    allUnifiedItems.push({
      id: occKey,
      data: first.data || '',
      descricao: cleanDesc,
      parcelas: first.parcelas || '',
      valorTotal,
      valorPendente,
      valorPago,
      pagadores,
      isDivided,
      splitDetails,
      cartaoNome: card.name,
      cartaoId: card.id,
      mes: month,
      year,
      monthKey,
      isPaid: isAllPaid,
      isPartiallyPaid: isAnyPaid && !isAllPaid,
      hasPendingPart,
      purchaseKey,
    });
  });

  // Ordenação cronológica e por parcela (1/10, 2/10...)
  const sortFn = (a: UnifiedSearchItem, b: UnifiedSearchItem) => {
    const getNum = (str: string) => {
      if (str.includes('/')) return parseInt(str.split('/')[0], 10) || 0;
      return parseInt(str, 10) || 0;
    };
    const diffParcela = getNum(a.parcelas) - getNum(b.parcelas);
    if (diffParcela !== 0) return diffParcela;
    if (a.year && b.year && a.year !== b.year) return a.year - b.year;
    return a.mes - b.mes;
  };

  allUnifiedItems.sort(sortFn);

  // 1. Histórico Completo
  const uniqueKeysHistorico = new Set<string>();
  let totalPagoHist = 0;
  let totalGeralHist = 0;

  allUnifiedItems.forEach((item) => {
    totalGeralHist += item.valorTotal;
    totalPagoHist += item.valorPago;
    const chave = item.parcelas ? `${item.descricao}|${item.parcelas}` : `${item.descricao}|${item.monthKey}|${item.id}`;
    uniqueKeysHistorico.add(chave);
  });

  // 2. Parcelas Restantes (Apenas as que têm pendência de pagamento)
  const parcelasRestantes = allUnifiedItems.filter((item) => item.hasPendingPart);
  const uniqueKeysRestantes = new Set<string>();
  let totalRestanteVal = 0;

  parcelasRestantes.forEach((item) => {
    totalRestanteVal += item.valorPendente;
    const chave = item.parcelas ? `${item.descricao}|${item.parcelas}` : `${item.descricao}|${item.monthKey}|${item.id}`;
    uniqueKeysRestantes.add(chave);
  });

  // 3. Itens Já Pagos: compras onde 100% de todas as parcelas e divisões estão quitadas
  const itensTotalmentePagos: PaidItemSummary[] = [];
  let somaTotalItensPagos = 0;

  fullPurchasesMap.forEach((pMap, purchaseKey) => {
    // Reúne todos os UnifiedSearchItem desta compra
    const purchaseItems = allUnifiedItems.filter((u) => u.purchaseKey === purchaseKey);
    if (purchaseItems.length === 0) return;

    // Se qualquer parcela ou divisão tiver pendência, a compra NÃO está totalmente quitada
    const allPaid = purchaseItems.every((item) => item.isPaid);
    if (!allPaid) return;

    const firstItem = purchaseItems[0];
    const totalValor = purchaseItems.reduce((acc, item) => acc + item.valorTotal, 0);

    // Responsáveis gerais
    const payersSet = new Set<string>();
    purchaseItems.forEach((item) => {
      item.pagadores.forEach((p) => payersSet.add(p));
    });
    const pagadoresStr = Array.from(payersSet).join(' / ') || 'Não informado';

    // Qtd de parcelas
    let totalParcelasTexto = `${purchaseItems.length}x`;
    if (firstItem.parcelas && firstItem.parcelas.includes('/')) {
      const denom = firstItem.parcelas.split('/')[1];
      totalParcelasTexto = `${denom}x`;
    } else if (purchaseItems.length === 1) {
      totalParcelasTexto = '1x (À vista)';
    }

    // Período de meses
    const sorted = [...purchaseItems].sort(sortFn);
    const firstMonth = formatMonthPill(sorted[0].monthKey);
    const lastMonth = formatMonthPill(sorted[sorted.length - 1].monthKey);
    const periodoMeses = firstMonth === lastMonth ? firstMonth : `${firstMonth} a ${lastMonth}`;

    // Datas
    const datas = sorted.map((t) => t.data).filter(Boolean).slice(0, 2).join(', ');

    // Resumo de divisão por pessoa na compra quitada
    const personTotalMap = new Map<string, number>();
    sorted.forEach((item) => {
      item.splitDetails.forEach((s) => {
        const cur = personTotalMap.get(s.pagador) || 0;
        personTotalMap.set(s.pagador, cur + s.valor);
      });
    });

    const pessoasResumo = Array.from(personTotalMap.entries()).map(([pagador, val]) => ({
      pagador,
      valorTotal: val,
      parcelasTexto: totalParcelasTexto,
      todasPagas: true,
    }));

    somaTotalItensPagos += totalValor;

    itensTotalmentePagos.push({
      purchaseKey,
      nome: firstItem.descricao,
      cartaoNome: firstItem.cartaoNome,
      cartaoId: firstItem.cartaoId,
      pagadores: pagadoresStr,
      isDivided: payersSet.size > 1,
      totalParcelasTexto,
      valorParcelaMedia: Math.round((totalValor / Math.max(1, purchaseItems.length)) * 100) / 100,
      valorTotal: totalValor,
      periodoMeses,
      datas,
      parcelasCount: purchaseItems.length,
      itens: sorted,
      pessoasResumo,
    });
  });

  itensTotalmentePagos.sort((a, b) => b.valorTotal - a.valorTotal);

  return {
    allFound: allUnifiedItems,
    parcelasRestantes,
    itensTotalmentePagos,
    contagemRealRestantes: uniqueKeysRestantes.size,
    contagemRealHistorico: uniqueKeysHistorico.size,
    valorTotalRestante: totalRestanteVal,
    valorTotalPagoHistorico: totalPagoHist,
    valorTotalGeralHistorico: totalGeralHist,
    valorTotalItensPagos: somaTotalItensPagos,
    allDescriptions,
    filteredSuggestions,
  };
}
