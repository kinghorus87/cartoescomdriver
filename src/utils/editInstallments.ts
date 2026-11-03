import { ArchivedInstallment, CardData, Transaction } from '../types';
import {
  addMonths,
  diffMonths,
  getCardTransactions,
  getRolling36Window,
  isMonthInRollingWindow,
  parseMonthKey,
} from './timeline';

/**
 * Dados enviados pelo ModalEditarOcorrencia (Opção B — Alterar todas as ocorrências).
 */
export interface AllOccurrencesEditInput {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  pagador: string;
  parcelaAtual: number;
  totalParcelas: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const isDivisao = (desc: string): boolean => desc.toLowerCase().includes('(divis');

const cleanBaseDesc = (desc: string): string =>
  desc.replace(/\(Divis[ãa]o\)/gi, '').trim().toLowerCase();

const isFixed = (t: Transaction): boolean => t.parcelas === 'Fixa' || t.id.startsWith('fixed-');

/**
 * Identificador confiável da compra. Usa o `purchaseId` e, para registros antigos
 * (importados da planilha ou criados antes do purchaseId), gera um identificador
 * compatível a partir da linha original ou do prefixo timestamp do id.
 */
export function resolvePurchaseId(card: CardData, tx: Transaction): string | null {
  if (tx.purchaseId) return tx.purchaseId;
  if (tx.linha !== undefined) return `pur-linha-${card.id}-${tx.linha}`;
  if (tx.id.startsWith('tx-')) return `pur-${tx.id.split('-').slice(0, 2).join('-')}`;
  return null;
}

/**
 * Consumo de limite de um conjunto de parcelas: parcelas já pagas já devolveram
 * seu valor ao limite (ver handleTogglePaidTransaction) e por isso não contam.
 */
const limitConsumption = (txs: Transaction[]): number =>
  round2(txs.reduce((acc, t) => acc + (t.pago ? 0 : Number(t.valor) || 0), 0));

const parseCurrent = (t: Transaction): number => {
  if (t.parcelas && t.parcelas.includes('/')) {
    return parseInt(t.parcelas.split('/')[0], 10) || 1;
  }
  return 1;
};

interface ActiveRec {
  monthKey: string;
  tx: Transaction;
  role: boolean; // true = registro "(Divisão)" (segundo pagador)
}

let idCounter = 0;
const newTxId = (num: number, role: boolean): string => {
  idCounter += 1;
  return `tx-${Date.now()}-${num}-${role ? 2 : 1}-${idCounter}`;
};

/**
 * OPÇÃO B — Alterar todas as ocorrências.
 *
 * - A ocorrência editada recebe o número informado; as ocorrências dos meses
 *   seguintes são renumeradas em sequência (número = informado + meses de distância).
 * - Parcelas anteriores à editada mantêm o número (só o total é atualizado).
 * - Parcelas que ultrapassam o total saem da sequência e são GUARDADAS em
 *   `card.archivedInstallments` (persistido junto com o cartão). Quando a numeração
 *   ou o total voltam a comportá-las, são restauradas com seus dados originais
 *   (mês, data, valor, descrição, pagador e situação de pagamento), sem duplicar.
 * - Compras divididas: os dois registros (pagador 1 e "(Divisão)") de cada mês são
 *   renumerados juntos; valor e pagador só mudam no registro que foi editado.
 * - A data só é alterada na ocorrência editada (e na sua metade da divisão); as
 *   demais mantêm a data original.
 * - O limite disponível é ajustado pela diferença entre o consumo anterior e o novo.
 */
export function applyAllOccurrencesEdit(
  card: CardData,
  monthKey: string,
  input: AllOccurrencesEditInput
): CardData {
  const { key: editedMonth } = parseMonthKey(monthKey);
  const existingTx = getCardTransactions(card, editedMonth).find((t) => t.id === input.id);
  if (!existingTx || isFixed(existingTx)) return card;

  const purchaseId = resolvePurchaseId(card, existingTx);
  // Se não for possível identificar com segurança todas as parcelas, não altera
  if (!purchaseId) return card;

  const editedRole = isDivisao(existingTx.descricao);
  const newNumber = input.parcelaAtual;
  const newTotal = input.totalParcelas;
  const baseDesc = input.descricao.replace(/\s*\(Divis[ãa]o\)/gi, '').trim() || input.descricao;
  const descFor = (div: boolean): string => (div ? `${baseDesc} (Divisão)` : baseDesc);
  const targetCleanDesc = cleanBaseDesc(existingTx.descricao);
  const dateChanged = input.data !== existingTx.data;

  const isSamePurchase = (t: Transaction): boolean => {
    if (isFixed(t)) return false;
    if (t.purchaseId && t.purchaseId === purchaseId) return true;
    if (existingTx.purchaseId && t.purchaseId) return existingTx.purchaseId === t.purchaseId;
    if (existingTx.linha !== undefined && t.linha !== undefined) {
      return existingTx.linha === t.linha && cleanBaseDesc(t.descricao) === targetCleanDesc;
    }
    if (existingTx.id.startsWith('tx-') && t.id.startsWith('tx-')) {
      return (
        existingTx.id.split('-').slice(0, 2).join('-') === t.id.split('-').slice(0, 2).join('-')
      );
    }
    return false;
  };

  // 1. Localiza todas as parcelas ativas da compra, em todos os meses do cartão
  const monthSet = new Set<string>();
  Object.keys(card.months || {}).forEach((k) => monthSet.add(parseMonthKey(k).key));
  getRolling36Window().months.forEach((k) => monthSet.add(k));
  const monthKeys = Array.from(monthSet).sort();

  const activeRecs: ActiveRec[] = [];
  monthKeys.forEach((mk) => {
    getCardTransactions(card, mk).forEach((t) => {
      if (isSamePurchase(t)) activeRecs.push({ monthKey: mk, tx: t, role: isDivisao(t.descricao) });
    });
  });
  if (activeRecs.length === 0) return card;

  const activeSlots = new Set(activeRecs.map((r) => `${r.monthKey}|${r.role}`));
  const allArchived = card.archivedInstallments || [];
  const purchaseArchived = allArchived.filter((a) => a.tx.purchaseId === purchaseId);
  const otherArchived = allArchived.filter((a) => a.tx.purchaseId !== purchaseId);

  // 2. Aplica os dados compartilhados da compra
  const applyShared = (tx: Transaction): Transaction => {
    const role = isDivisao(tx.descricao);
    return {
      ...tx,
      purchaseId,
      descricao: descFor(role),
      valor: role === editedRole ? input.valor : tx.valor,
      pagador: role === editedRole ? input.pagador : tx.pagador,
    };
  };

  const numberFor = (mk: string): number => newNumber + diffMonths(editedMonth, mk);

  const replaced = new Map<string, Transaction | null>(); // id -> nova versão (null = saiu da sequência)
  const added = new Map<string, Transaction[]>(); // mês -> registros restaurados/criados
  const keptArchived: ArchivedInstallment[] = [...otherArchived];
  const known: { monthKey: string; tx: Transaction; role: boolean }[] = []; // estado final p/ modelos
  const finalActive: Transaction[] = [];

  activeRecs.forEach((r) => {
    const offset = diffMonths(editedMonth, r.monthKey);
    let next = applyShared(r.tx);
    if (dateChanged && r.monthKey === editedMonth) next = { ...next, data: input.data };

    if (offset < 0) {
      // Anterior à ocorrência editada: mantém o número, só acompanha o novo total
      const cur = parseCurrent(r.tx);
      if (r.tx.parcelas && r.tx.parcelas.includes('/') && cur <= newTotal) {
        next = { ...next, parcelas: `${cur}/${newTotal}` };
      }
      replaced.set(r.tx.id, next);
      finalActive.push(next);
      known.push({ monthKey: r.monthKey, tx: next, role: r.role });
      return;
    }

    const num = numberFor(r.monthKey);
    if (num >= 1 && num <= newTotal) {
      next = { ...next, parcelas: `${num}/${newTotal}` };
      replaced.set(r.tx.id, next);
      finalActive.push(next);
    } else {
      replaced.set(r.tx.id, null);
      keptArchived.push({ monthKey: r.monthKey, tx: next });
    }
    known.push({ monthKey: r.monthKey, tx: next, role: r.role });
  });

  // 3. Parcelas guardadas anteriormente: restaura as que voltaram a caber na sequência
  purchaseArchived.forEach((a) => {
    const mk = parseMonthKey(a.monthKey).key;
    const role = isDivisao(a.tx.descricao);
    const offset = diffMonths(editedMonth, mk);

    // Anterior à ocorrência editada ou fora da janela de 36 meses: continua guardada, intacta
    if (offset < 0 || !isMonthInRollingWindow(mk)) {
      keptArchived.push(a);
      known.push({ monthKey: mk, tx: a.tx, role });
      return;
    }
    // Já existe parcela ativa desse mês/pagador: não duplica
    if (activeSlots.has(`${mk}|${role}`)) return;

    const num = numberFor(mk);
    const next = applyShared(a.tx);
    if (num >= 1 && num <= newTotal) {
      const restored = { ...next, parcelas: `${num}/${newTotal}` };
      added.set(mk, [...(added.get(mk) || []), restored]);
      finalActive.push(restored);
    } else {
      keptArchived.push({ monthKey: mk, tx: next });
    }
    known.push({ monthKey: mk, tx: next, role });
  });

  // 4. Total aumentado além do que existe (ativo ou guardado): gera as parcelas que faltam
  const lastKnown = known.reduce(
    (acc, k) => (diffMonths(acc, k.monthKey) > 0 ? k.monthKey : acc),
    editedMonth
  );
  const templates = new Map<boolean, Transaction>();
  [...known]
    .sort((a, b) => diffMonths(a.monthKey, b.monthKey))
    .forEach((k) => templates.set(k.role, k.tx));

  for (let mk = addMonths(lastKnown, 1); ; mk = addMonths(mk, 1)) {
    const num = numberFor(mk);
    if (num > newTotal || !isMonthInRollingWindow(mk)) break;
    templates.forEach((tpl, role) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pago, linha, ...rest } = tpl;
      const created: Transaction = {
        ...rest,
        id: newTxId(num, role),
        parcelas: `${num}/${newTotal}`,
      };
      added.set(mk, [...(added.get(mk) || []), created]);
      finalActive.push(created);
    });
  }

  // 5. Reescreve somente os meses afetados, preservando os demais lançamentos e a ordem
  const updatedMonths: Record<string, Transaction[]> = { ...card.months };
  const touched = new Set<string>([...activeRecs.map((r) => r.monthKey), ...added.keys()]);
  touched.forEach((mk) => {
    const out: Transaction[] = [];
    getCardTransactions(card, mk).forEach((t) => {
      if (!replaced.has(t.id)) {
        out.push(t);
        return;
      }
      const next = replaced.get(t.id);
      if (next) out.push(next);
    });
    (added.get(mk) || []).forEach((t) => out.push(t));

    const { key, year, month } = parseMonthKey(mk);
    updatedMonths[key] = out;
    if (year === 2026) updatedMonths[String(month)] = out;
  });

  // 6. Limite: diferença entre o consumo anterior e o novo estado da compra
  const before = limitConsumption(activeRecs.map((r) => r.tx));
  const after = limitConsumption(finalActive);
  const newDisponivel = Math.min(
    card.limite,
    Math.max(0, round2(card.disponivel + (before - after)))
  );

  const result: CardData = { ...card, disponivel: newDisponivel, months: updatedMonths };
  if (keptArchived.length > 0 || card.archivedInstallments) {
    result.archivedInstallments = keptArchived;
  }
  return result;
}
