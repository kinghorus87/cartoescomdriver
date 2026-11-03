
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CardData, FixedExpense, SeedData, SimulatorConfig, ThemeConfig, Transaction, ViewTab } from './types';
import {
  getInitialData,
  exportBackup,
  MESES_NOMES
} from './utils/storage';
import {
  loadAppData as loadBrowserData,
  saveAppData as saveBrowserData,
  resetToOriginalData 
} from './utils/browserStorage';
import { 
  addMonths, 
  diffMonths, 
  CURRENT_REAL_MONTH, 
  parseMonthKey, 
  getCardTransactions,
  pruneOutOfWindowData,
  isMonthInRollingWindow,
  getCurrentSystemMonthKey,
  getRolling36Window
} from './utils/timeline';
import { 
  THEME_BG_PRESETS, 
  getResolvedBgColor,
  getResolvedPanelColor,
  getResolvedAccentColor, 
  getResolvedTextColor,
  getResolvedMutedTextColor,
  getResolvedSubtleTextColor,
  getResolvedBorderColor,
  getResolvedPanelSubtleColor,
  getResolvedInputBgColor,
  getContrastTextColor, 
  isLightColor 
} from './utils/cardColors';
import { Header } from './components/Header';
import { DashboardLimites } from './components/DashboardLimites';
import { MatrizGastosView } from './components/MatrizGastosView';
import { CardView } from './components/CardView';
import { DividasTotaisView } from './components/DividasTotaisView';
import { PesquisarParcelasView } from './components/PesquisarParcelasView';
import { SimuladorGastosView } from './components/SimuladorGastosView';
import { ModalLancamento } from './components/ModalLancamento';
import { ModalAdicionarCartao } from './components/ModalAdicionarCartao';
import { ModalConfirmacao } from './components/ModalConfirmacao';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConfiguracoesView } from './components/ConfiguracoesView';

export default function App() {
  // Abertura direta: sem tela de login, sem usuário e senha, 100% local
  const [data, setData] = useState<SeedData>(() => getInitialData());
  const [dataReady, setDataReady] = useState(false);
  const initialLoadDone = useRef(false);
  const savedSessionDataRef = useRef<SeedData>(JSON.parse(JSON.stringify(data)) as SeedData);
  const [isExitPromptOpen, setIsExitPromptOpen] = useState(false);
  const [isSessionClosed, setIsSessionClosed] = useState(false);
  const [isExitActionBusy, setIsExitActionBusy] = useState(false);
  const [exitActionError, setExitActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('limites');
  const [isMiniSimPinned, setIsMiniSimPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cartoes_matriz_mini_sim_pinned_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [miniSimSelectedMonthKey, setMiniSimSelectedMonthKey] = useState<string>(() => getCurrentSystemMonthKey());
  const [miniSimReferenceMonthKey, setMiniSimReferenceMonthKey] = useState<string>(() => getCurrentSystemMonthKey());
  const [selectedCardId, setSelectedCardId] = useState<string>(() => data.cards[0]?.id || '');
  const [isLancamentoOpen, setIsLancamentoOpen] = useState<boolean>(false);
  const [lancamentoDefaultCard, setLancamentoDefaultCard] = useState<string>('');
  const [isAddCardOpen, setIsAddCardOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('cartoes_matriz_mini_sim_pinned_v1', String(isMiniSimPinned));
    } catch {
      // A preferência continua valendo durante a sessão mesmo se o navegador bloquear o armazenamento.
    }
  }, [isMiniSimPinned]);

  // Mantém selectedCardId sincronizado com os cartões existentes
  useEffect(() => {
    if (data.cards.length > 0) {
      if (!data.cards.some((c) => c.id === selectedCardId)) {
        setSelectedCardId(data.cards[0].id);
      }
    } else if (selectedCardId) {
      setSelectedCardId('');
    }
  }, [data.cards, selectedCardId]);

  // Redirecionamento de segurança se a aba ativa for desativada nas preferências
  useEffect(() => {
    const tabPrefs = data.tabPreferences || { pesquisar: true, dividas: true, simulador: true };
    if (activeTab === 'pesquisar' && tabPrefs.pesquisar === false) {
      setActiveTab('limites');
    } else if (activeTab === 'dividas' && tabPrefs.dividas === false) {
      setActiveTab('limites');
    } else if (activeTab === 'simulador' && tabPrefs.simulador === false) {
      setActiveTab('limites');
    }
  }, [activeTab, data.tabPreferences]);

  // Estado para Modal de Confirmação Seguro
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Carregamento inicial a partir do armazenamento local do navegador
  useEffect(() => {
    let canceled = false;

    const init = async () => {
      try {
        const loaded = await loadBrowserData();
        if (!canceled && loaded && Array.isArray(loaded.cards)) {
          // Aplica poda de dados fora da janela móvel de 36 meses
          const { data: pruned, prunedMonthsCount, prunedTxsCount } = pruneOutOfWindowData(loaded);
          if (prunedMonthsCount > 0 || prunedTxsCount > 0) {
            saveBrowserData(pruned).then((result) => {
              if (!result.success) console.error(result.error);
            }).catch(console.error);
          }
          savedSessionDataRef.current = JSON.parse(JSON.stringify(pruned)) as SeedData;
          setData(pruned);
        }
      } catch (err) {
        console.error('Erro ao carregar os dados locais:', err);
      }

      if (!canceled) {
        initialLoadDone.current = true;
        setDataReady(true);
      }
    };

    init();

    return () => {
      canceled = true;
    };
  }, []);

  // Monitoramento dinâmico da virada de mês para avanço automático da janela de 36 meses
  useEffect(() => {
    if (!dataReady || isSessionClosed) return;

    const checkMonthRoll = () => {
      setData((current) => {
        const { data: pruned, prunedMonthsCount, prunedTxsCount } = pruneOutOfWindowData(current);
        if (prunedMonthsCount > 0 || prunedTxsCount > 0) {
          saveBrowserData(pruned).then((result) => {
            if (!result.success) console.error(result.error);
          }).catch(console.error);
          return pruned;
        }
        return current;
      });
    };

    // Verifica a cada minuto e sempre que o usuário retornar à janela
    const timer = setInterval(checkMonthRoll, 60000);
    window.addEventListener('focus', checkMonthRoll);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', checkMonthRoll);
    };
  }, [dataReady, isSessionClosed]);

  // Salvamento contínuo e atômico a cada alteração
  useEffect(() => {
    if (!dataReady || !initialLoadDone.current || isSessionClosed) return;
    saveBrowserData(data).then((result) => {
      if (!result.success) console.error(result.error);
    }).catch((err) => {
      console.error('Falha ao persistir dados locais:', err);
    });
  }, [data, dataReady, isSessionClosed]);

  const handleRequestAppExit = () => {
    setExitActionError(null);
    setIsExitPromptOpen(true);
  };

  const handleFinishAppExit = async (saveCurrentChanges: boolean) => {
    setIsExitActionBusy(true);
    setExitActionError(null);

    const dataToKeep = saveCurrentChanges
      ? data
      : (JSON.parse(JSON.stringify(savedSessionDataRef.current)) as SeedData);

    try {
      const result = await saveBrowserData(dataToKeep);
      if (!result.success) {
        setExitActionError(result.error || 'Não foi possível salvar os dados antes de sair.');
        return;
      }

      savedSessionDataRef.current = JSON.parse(JSON.stringify(dataToKeep)) as SeedData;
      if (!saveCurrentChanges) setData(dataToKeep);
      setIsExitPromptOpen(false);
      setIsSessionClosed(true);
      // Browsers may refuse to close windows opened by the user. When allowed
      // (for example, a single-entry installed PWA window), close after the
      // save/restore finishes; otherwise the closed-session screen remains.
      try {
        window.close();
      } catch {
        // The fallback screen explains that the user can close with the system X.
      }
    } catch (error) {
      setExitActionError(error instanceof Error ? error.message : 'Não foi possível finalizar a saída.');
    } finally {
      setIsExitActionBusy(false);
    }
  };

  const handleOpenLancamento = (cardName?: string) => {
    if (data.cards.length === 0) {
      setIsAddCardOpen(true);
      return;
    }
    if (cardName) {
      setLancamentoDefaultCard(cardName);
    } else {
      const current = data.cards.find((c) => c.id === selectedCardId);
      setLancamentoDefaultCard(current ? current.name : data.cards[0]?.name || '');
    }
    setIsLancamentoOpen(true);
  };

  const handleSaveLancamento = (params: {
    cartaoNome: string;
    dataCompra: string;
    descricao: string;
    valorParcela: number;
    totalParcelas: number;
    mesInicial: string;
    pagador1: string;
    dividir: boolean;
    pagador2?: string;
  }) => {
    const purchaseId = `pur-${Date.now()}`;
    const valorTotalCompra = Math.round(params.valorParcela * params.totalParcelas * 100) / 100;

    const updatedCards = data.cards.map((card) => {
      if (card.name.toLowerCase() !== params.cartaoNome.toLowerCase()) {
        return card;
      }

      const updatedMonths = { ...card.months };
      const valorTotal = valorTotalCompra;
      const valorDividido = params.dividir
        ? Math.round((valorTotal / 2 / params.totalParcelas) * 100) / 100
        : params.valorParcela;

      for (let i = 1; i <= params.totalParcelas; i++) {
        const mesPara = addMonths(params.mesInicial, i - 1);
        if (!isMonthInRollingWindow(mesPara)) {
          // Não lança parcelas em meses futuros antes de a janela avançar
          continue;
        }
        const { year, month: mNum } = parseMonthKey(mesPara);
        const currentTxs = [...getCardTransactions(card, mesPara)];
        const parcelaTexto = `${i}/${params.totalParcelas}`;

        currentTxs.push({
          id: `tx-${Date.now()}-${i}-1`,
          purchaseId,
          data: params.dataCompra,
          descricao: params.descricao,
          parcelas: parcelaTexto,
          valor: params.dividir ? valorDividido : params.valorParcela,
          pagador: params.pagador1,
        });

        if (params.dividir && params.pagador2) {
          currentTxs.push({
            id: `tx-${Date.now()}-${i}-2`,
            purchaseId,
            data: params.dataCompra,
            descricao: `${params.descricao} (Divisão)`,
            parcelas: parcelaTexto,
            valor: valorDividido,
            pagador: params.pagador2,
          });
        }

        updatedMonths[mesPara] = currentTxs;
        if (year === 2026) {
          updatedMonths[String(mNum)] = currentTxs;
        }
      }

      for (let m = 1; m <= 12; m++) {
        const mKey = `2026-${String(m).padStart(2, '0')}`;
        if (updatedMonths[mKey]) {
          updatedMonths[String(m)] = updatedMonths[mKey];
        }
      }

      // Reduz o limite disponível pelo valor total contratado da compra
      const newDisponivel = Math.max(
        0,
        Math.round((card.disponivel - valorTotal) * 100) / 100
      );

      return {
        ...card,
        disponivel: newDisponivel,
        months: updatedMonths,
      };
    });

    const normalizePerson = (name: string, list: string[]): string[] => {
      const clean = name.trim();
      if (!clean) return list;
      const exists = list.some((p) => p.toLowerCase().trim() === clean.toLowerCase());
      if (!exists) {
        return [...list, clean];
      }
      return list;
    };

    let updatedPersons = normalizePerson(params.pagador1, data.persons);
    if (params.dividir && params.pagador2) {
      updatedPersons = normalizePerson(params.pagador2, updatedPersons);
    }

    const newHidden = (data.hiddenPersons || []).filter(
      (h) =>
        h.toLowerCase().trim() !== params.pagador1.toLowerCase().trim() &&
        (!params.pagador2 || h.toLowerCase().trim() !== params.pagador2.toLowerCase().trim())
    );

    const cardNameClean = params.cartaoNome.trim();
    const updatedSimulator = {
      ...data.simulator,
      mensalCards: (data.simulator?.mensalCards || []).some(
        (c) => c.toLowerCase() === cardNameClean.toLowerCase()
      ) || (data.simulator?.quinzenaCards || []).some(
        (c) => c.toLowerCase() === cardNameClean.toLowerCase()
      )
        ? (data.simulator?.mensalCards || [])
        : [...(data.simulator?.mensalCards || []), cardNameClean],
    };

    setData((prev) => ({
      ...prev,
      cards: updatedCards,
      persons: updatedPersons,
      hiddenPersons: newHidden,
      simulator: updatedSimulator,
    }));
  };

  const handleUpdateCardImage = (cardId: string, customImage?: string) => {
    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => {
        if (c.id !== cardId) return c;
        return {
          ...c,
          customImage,
        };
      }),
    }));
  };

  // Exclusão individual da lixeira da fatura
  const handleDeleteSingleTransaction = (
    cardId: string,
    month: string | number,
    txId: string
  ) => {
    const { key: monthKey, year, month: mNum } = parseMonthKey(month);

    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => {
        if (c.id !== cardId) return c;

        const currentTxs = getCardTransactions(c, monthKey);
        const txToDelete = currentTxs.find((t) => t.id === txId);
        const filteredTxs = currentTxs.filter((t) => t.id !== txId);
        const removedVal = txToDelete?.valor || 0;

        const newDisponivel = Math.min(
          c.limite,
          Math.round((c.disponivel + removedVal) * 100) / 100
        );

        const updatedMonths = {
          ...c.months,
          [monthKey]: filteredTxs,
        };

        if (year === 2026) {
          updatedMonths[String(mNum)] = filteredTxs;
        }

        return {
          ...c,
          disponivel: newDisponivel,
          months: updatedMonths,
        };
      }),
    }));
  };

  // Exclusão completa da compra selecionada e de todas as suas parcelas futuras
  const handleDeletePurchaseAndFutureInstallments = (
    cardId: string,
    fromMonthKey: string,
    targetTx: Transaction
  ) => {
    const isSamePurchase = (target: Transaction, candidate: Transaction): boolean => {
      if (candidate.parcelas === 'Fixa' || candidate.id.startsWith('fixed-')) {
        return target.id === candidate.id;
      }
      if (target.parcelas === 'Fixa' || target.id.startsWith('fixed-')) {
        return target.id === candidate.id;
      }
      if (target.purchaseId && candidate.purchaseId) {
        return target.purchaseId === candidate.purchaseId;
      }
      if (target.linha !== undefined && candidate.linha !== undefined) {
        const cleanTarget = target.descricao
          .replace(/\(Divis[ãa]o\)/gi, '')
          .trim()
          .toLowerCase();
        const cleanCand = candidate.descricao
          .replace(/\(Divis[ãa]o\)/gi, '')
          .trim()
          .toLowerCase();
        return target.linha === candidate.linha && cleanTarget === cleanCand;
      }
      const targetPrefix = target.id.startsWith('tx-')
        ? target.id.split('-').slice(0, 2).join('-')
        : '';
      const candPrefix = candidate.id.startsWith('tx-')
        ? candidate.id.split('-').slice(0, 2).join('-')
        : '';
      if (targetPrefix && candPrefix && targetPrefix === candPrefix) {
        return true;
      }
      const cleanTargetDesc = target.descricao
        .replace(/\(Divis[ãa]o\)/gi, '')
        .trim()
        .toLowerCase();
      const cleanCandDesc = candidate.descricao
        .replace(/\(Divis[ãa]o\)/gi, '')
        .trim()
        .toLowerCase();
      if (cleanTargetDesc === cleanCandDesc) {
        const targetDenom = target.parcelas?.includes('/')
          ? target.parcelas.split('/')[1]
          : null;
        const candDenom = candidate.parcelas?.includes('/')
          ? candidate.parcelas.split('/')[1]
          : null;
        if (targetDenom && candDenom && targetDenom === candDenom) {
          return true;
        }
      }
      return target.id === candidate.id;
    };

    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => {
        if (c.id !== cardId) return c;

        let totalRemovedValue = 0;
        const updatedMonths = { ...c.months };

        Object.keys(updatedMonths).forEach((mKey) => {
          const diff = diffMonths(fromMonthKey, mKey);
          if (diff >= 0) {
            const currentTxs = updatedMonths[mKey] || [];
            const remainingTxs: Transaction[] = [];

            currentTxs.forEach((t) => {
              if (isSamePurchase(targetTx, t)) {
                totalRemovedValue += t.valor || 0;
              } else {
                remainingTxs.push(t);
              }
            });

            updatedMonths[mKey] = remainingTxs;
          }
        });

        for (let m = 1; m <= 12; m++) {
          const mKey = `2026-${String(m).padStart(2, '0')}`;
          if (diffMonths(fromMonthKey, mKey) >= 0 && updatedMonths[mKey]) {
            updatedMonths[String(m)] = updatedMonths[mKey];
          }
        }

        const newDisponivel = Math.min(
          c.limite,
          Math.round((c.disponivel + totalRemovedValue) * 100) / 100
        );

        return {
          ...c,
          disponivel: newDisponivel,
          months: updatedMonths,
        };
      }),
    }));
  };

  // Marcar fatura como paga e atualizar o limite disponível
  const handleTogglePaidInvoice = (cardId: string, monthKey: string) => {
    const normalizedMonthKey = parseMonthKey(monthKey).key;
    const normKey = `${cardId}_${normalizedMonthKey}`;

    setData((prev) => {
      const currentPaidInvoices = prev.paidInvoices || {};
      const isCurrentlyPaid = Boolean(currentPaidInvoices[normKey]);
      const nextPaidValue = !isCurrentlyPaid;

      const updatedCards = prev.cards.map((card) => {
        if (card.id !== cardId) return card;

        const invoiceTransactions = getCardTransactions(card, normalizedMonthKey);
        const invoiceTotal = Math.round(
          invoiceTransactions.reduce(
            (total, transaction) => total + (Number(transaction.valor) || 0),
            0
          ) * 100
        ) / 100;

        if (invoiceTotal <= 0) {
          return card;
        }

        const calculatedDisponivel = nextPaidValue
          ? card.disponivel + invoiceTotal
          : card.disponivel - invoiceTotal;

        const newDisponivel = Math.round(
          Math.max(0, Math.min(card.limite, calculatedDisponivel)) * 100
        ) / 100;

        return {
          ...card,
          disponivel: newDisponivel,
        };
      });

      return {
        ...prev,
        cards: updatedCards,
        paidInvoices: {
          ...currentPaidInvoices,
          [normKey]: nextPaidValue,
        },
      };
    });
  };

  // Marcar/desmarcar transação individual como paga (Item 5)
  const handleTogglePaidTransaction = (
    cardId: string,
    monthKey: string,
    txId: string
  ) => {
    const { key: normKey, year, month: mNum } = parseMonthKey(monthKey);

    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => {
        if (c.id !== cardId) return c;

        const currentTxs = getCardTransactions(c, normKey);
        const targetTx = currentTxs.find((t) => t.id === txId);
        if (!targetTx) return c;

        const nextPago = !targetTx.pago;
        const updatedTxs = currentTxs.map((t) =>
          t.id === txId ? { ...t, pago: nextPago } : t
        );

        const updatedMonths = {
          ...c.months,
          [normKey]: updatedTxs,
        };

        if (year === 2026) {
          updatedMonths[String(mNum)] = updatedTxs;
        }

        // Se marcou como pago, devolve ao limite disponível; se desmarcou, debita
        const diff = nextPago ? (targetTx.valor || 0) : -(targetTx.valor || 0);
        const newDisponivel = Math.round(
          Math.max(0, Math.min(c.limite, c.disponivel + diff)) * 100
        ) / 100;

        return {
          ...c,
          disponivel: newDisponivel,
          months: updatedMonths,
        };
      }),
    }));
  };

  const handleClearMonth = (cardId: string, month: string | number) => {
    const card = data.cards.find((c) => c.id === cardId);
    if (!card) return;

    const { key: monthKey, year, month: mNum } = parseMonthKey(month);
    const monthLabel = `${MESES_NOMES[mNum - 1]} de ${year}`;

    setConfirmModal({
      isOpen: true,
      title: `Limpar ${monthLabel}?`,
      message: `Tem certeza de que deseja apagar todos os lançamentos do mês de ${monthLabel} no cartão "${card.name}"?`,
      isDestructive: true,
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          cards: prev.cards.map((c) => {
            if (c.id !== cardId) return c;

            const updatedMonths = {
              ...c.months,
              [monthKey]: [],
            };

            if (year === 2026) {
              updatedMonths[String(mNum)] = [];
            }

            return {
              ...c,
              months: updatedMonths,
            };
          }),
        }));
      },
    });
  };

  // Gestão de parcelas fixas
  const handleSaveFixedExpense = (expense: Omit<FixedExpense, 'id'> & { id?: string }) => {
    const expenseId = expense.id || `fe-${Date.now()}`;

    const newExpense: FixedExpense = {
      ...expense,
      id: expenseId,
      dataCriacao: expense.id
        ? (data.fixedExpenses?.find((f) => f.id === expense.id)?.dataCriacao || new Date().toISOString())
        : new Date().toISOString(),
    };

    setData((prev) => {
      const existing = (prev.fixedExpenses || []).filter((f) => f.id !== expenseId);
      return {
        ...prev,
        fixedExpenses: [...existing, newExpense],
      };
    });
  };

  const handleDeleteFixedExpense = (expenseId: string) => {
    setData((prev) => ({
      ...prev,
      fixedExpenses: (prev.fixedExpenses || []).filter((f) => f.id !== expenseId),
    }));
  };

  // Injeção de parcelas fixas no mês real atual, com data e chave corretas
  useEffect(() => {
    if (!data.fixedExpenses) return;

    const currentMonthKey = CURRENT_REAL_MONTH;
    const { year, month } = parseMonthKey(currentMonthKey);

    setData((prev) => {
      let hasChanges = false;

      const updatedCards = prev.cards.map((card) => {
        const fixedMap = new Map<string, FixedExpense>();

        (prev.fixedExpenses || [])
          .filter((fe) => fe.cardId === card.id && fe.ativo)
          .forEach((fe) => {
            if (fe && fe.id) fixedMap.set(fe.id, fe);
          });

        const cardFixed = Array.from(fixedMap.values());

        const regularMap = new Map<string, Transaction>();
        const existingTxs = getCardTransactions(card, currentMonthKey);

        existingTxs.forEach((t) => {
          if (t && t.id && !t.id.startsWith('fixed-')) {
            regularMap.set(t.id, t);
          }
        });

        const finalTxs: Transaction[] = Array.from(regularMap.values());

        const lastDayOfMonth = new Date(year, month, 0).getDate();

        cardFixed.forEach((fe) => {
          const diaMes = Number(fe.diaMes) || 10;
          const safeDay = Math.min(Math.max(1, diaMes), lastDayOfMonth);
          const dayStr = String(safeDay).padStart(2, '0');
          const monthStr = String(month).padStart(2, '0');

          finalTxs.push({
            id: `fixed-${fe.id}-${currentMonthKey}`,
            data: `${dayStr}/${monthStr}/${year}`,
            descricao: fe.descricao,
            parcelas: 'Fixa',
            valor: fe.valor,
            pagador: fe.pagador || '',
          });
        });

        const isDifferent =
          finalTxs.length !== existingTxs.length ||
          finalTxs.some((t, i) => {
            const cur = existingTxs[i];
            return (
              !cur ||
              cur.id !== t.id ||
              cur.valor !== t.valor ||
              cur.descricao !== t.descricao ||
              cur.pagador !== t.pagador ||
              cur.data !== t.data
            );
          });

        if (isDifferent) {
          hasChanges = true;

          const updatedMonths = {
            ...card.months,
            [currentMonthKey]: finalTxs,
          };

          // Mantém a compatibilidade com os meses numéricos antigos de 2026,
          // sem sobrescrever o mês errado em outros anos.
          if (year === 2026) {
            updatedMonths[String(month)] = finalTxs;
          }

          return {
            ...card,
            months: updatedMonths,
          };
        }

        return card;
      });

      if (!hasChanges) return prev;

      return {
        ...prev,
        cards: updatedCards,
      };
    });
  }, [data.fixedExpenses]);

  // Gestão segura de pessoas
  const personHasFinancialRecords = (personName: string): boolean => {
    const clean = personName.toLowerCase().trim();
    if (!clean) return false;

    for (const card of data.cards) {
      for (const txs of Object.values(card.months || {})) {
        if (Array.isArray(txs)) {
          if (txs.some((t) => t.pagador?.toLowerCase().trim() === clean)) {
            return true;
          }
        }
      }
    }

    if ((data.fixedExpenses || []).some((fe) => fe.pagador?.toLowerCase().trim() === clean)) {
      return true;
    }

    return false;
  };

  const handleDeleteOrHidePerson = (personName: string) => {
    const clean = personName.trim();
    if (!clean) return;

    const hasRecords = personHasFinancialRecords(clean);

    if (!hasRecords) {
      setConfirmModal({
        isOpen: true,
        title: `Excluir "${clean}"?`,
        message: `Esta pessoa não possui lançamentos nem histórico financeiro registrado em nenhum cartão. O cadastro será excluído definitivamente. Deseja prosseguir?`,
        isDestructive: true,
        onConfirm: () => {
          setData((prev) => ({
            ...prev,
            persons: prev.persons.filter((p) => p.toLowerCase().trim() !== clean.toLowerCase()),
            hiddenPersons: (prev.hiddenPersons || []).filter(
              (h) => h.toLowerCase().trim() !== clean.toLowerCase()
            ),
          }));
        },
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: `Ocultar "${clean}"?`,
        message: `Atenção: "${clean}" possui compras e histórico financeiro registrados. Para preservar a integridade contábil das faturas e dos gráficos, ela será ocultada com segurança dos resumos e matrizes, mantendo os registros intactos no banco de dados local. Deseja ocultar?`,
        isDestructive: false,
        onConfirm: () => {
          setData((prev) => {
            const currentHidden = prev.hiddenPersons || [];
            if (currentHidden.some((h) => h.toLowerCase().trim() === clean.toLowerCase())) {
              return prev;
            }
            return {
              ...prev,
              hiddenPersons: [...currentHidden, clean],
            };
          });
        },
      });
    }
  };

  const handleUnhidePerson = (personName: string) => {
    const clean = personName.trim();
    setData((prev) => ({
      ...prev,
      hiddenPersons: (prev.hiddenPersons || []).filter(
        (h) => h.toLowerCase().trim() !== clean.toLowerCase()
      ),
    }));
  };

  const handleClearAllMonths = (cardId: string) => {
    const card = data.cards.find((c) => c.id === cardId);
    if (!card) return;

    setConfirmModal({
      isOpen: true,
      title: `Limpar TODOS os 12 Meses de ${card.name}?`,
      message: `Atenção: Esta ação apagará todas as tabelas de Janeiro a Dezembro no cartão "${card.name}". Esta ação espelha o Módulo 4 do Excel. Deseja prosseguir?`,
      isDestructive: true,
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          cards: prev.cards.map((c) => {
            if (c.id !== cardId) return c;

            const emptyMonths: Record<number, any[]> = {};
            for (let m = 1; m <= 12; m++) {
              emptyMonths[m] = [];
            }

            return {
              ...c,
              months: emptyMonths,
            };
          }),
        }));
      },
    });
  };

  const handleSaveSimulatorConfig = (newConfig: SimulatorConfig) => {
    setData((prev) => ({
      ...prev,
      simulator: newConfig,
    }));
  };

  const handleResetToSeed = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Limpar e Zerar Todos os Dados?',
      message: 'Esta ação irá limpar completamente os dados salvos no navegador (localStorage). Todas as tabelas, cartões cadastrados, faturas e a matriz de gastos ficarão totalmente zeradas para você começar do zero.',
      isDestructive: true,
      onConfirm: async () => {
        const fresh = await resetToOriginalData();
        setData(fresh);
        setSelectedCardId('');
      },
    });
  };

  const handleCardSelectedFromDashboard = (cardId: string) => {
    setSelectedCardId(cardId);
    setActiveTab('cartoes');
  };

  const handleUpdateCard = (updated: {
    id: string;
    name: string;
    limite: number;
    dueDay: string;
    finalCard?: string;
    isFisico?: string;
    isVirtual?: string;
    color?: string;
    customImage?: string;
    exibirIdentificacao?: boolean;
  }): { success: boolean; message?: string } => {
    const trimmedName = updated.name.trim();

    if (!trimmedName) {
      return { success: false, message: 'O nome do cartão é obrigatório.' };
    }

    const oldCard = data.cards.find((c) => c.id === updated.id);
    if (!oldCard) {
      return { success: false, message: 'Cartão não encontrado.' };
    }

    const duplicate = data.cards.some(
      (c) => c.id !== updated.id && c.name.toLowerCase().trim() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      return { success: false, message: 'Já existe outro cartão com este nome. Escolha um nome diferente.' };
    }

    const oldName = oldCard.name;
    const limitDiff = updated.limite - oldCard.limite;
    const newDisponivel = Math.round((oldCard.disponivel + limitDiff) * 100) / 100;

    const updatedCards = data.cards.map((c) => {
      if (c.id !== updated.id) return c;

      return {
        ...c,
        name: trimmedName,
        limite: updated.limite,
        disponivel: newDisponivel,
        dueDay: updated.dueDay,
        finalCard: updated.finalCard !== undefined ? updated.finalCard : c.finalCard,
        isFisico: updated.isFisico !== undefined ? updated.isFisico : c.isFisico,
        isVirtual: updated.isVirtual !== undefined ? updated.isVirtual : c.isVirtual,
        color: updated.color !== undefined ? updated.color : c.color,
        customImage: updated.customImage !== undefined ? (updated.customImage || undefined) : c.customImage,
        exibirIdentificacao: updated.exibirIdentificacao !== undefined ? updated.exibirIdentificacao : c.exibirIdentificacao,
      };
    });

    const updatedCardsList = (data.cardsList || []).map((n) =>
      n.toLowerCase() === oldName.toLowerCase() ? trimmedName : n
    );

    const updatedSimulator = {
      ...data.simulator,
      mensalCards: (data.simulator?.mensalCards || []).map((n) =>
        n.toLowerCase() === oldName.toLowerCase() ? trimmedName : n
      ),
      quinzenaCards: (data.simulator?.quinzenaCards || []).map((n) =>
        n.toLowerCase() === oldName.toLowerCase() ? trimmedName : n
      ),
    };

    setData((prev) => ({
      ...prev,
      cards: updatedCards,
      cardsList: updatedCardsList,
      simulator: updatedSimulator,
    }));

    return { success: true, message: `Cartão "${trimmedName}" atualizado com sucesso!` };
  };

  // Adicionar e remover cartões
  const handleAddCard = (newCardData: {
    name: string;
    limite: number;
    dueDay: string;
    color: string;
    customImage?: string;
    finalCard: string;
    isFisico: string;
    isVirtual: string;
    exibirIdentificacao?: boolean;
  }): { success: boolean; message?: string } => {
    const cleanName = newCardData.name.trim();

    if (!cleanName) {
      return { success: false, message: 'Nome obrigatório.' };
    }

    const id = `card-${Date.now()}`;
    const newCard: CardData = {
      id,
      name: cleanName,
      limite: newCardData.limite,
      disponivel: newCardData.limite,
      dueDay: newCardData.dueDay,
      color: newCardData.color,
      customImage: newCardData.customImage,
      finalCard: newCardData.finalCard,
      isFisico: newCardData.isFisico,
      isVirtual: newCardData.isVirtual,
      exibirIdentificacao: newCardData.exibirIdentificacao !== undefined ? newCardData.exibirIdentificacao : false,
      months: {},
    };

    setData((prev) => ({
      ...prev,
      cards: [...prev.cards, newCard],
      cardsList: [...(prev.cardsList || []), cleanName],
      simulator: {
        ...prev.simulator,
        mensalCards: [...(prev.simulator?.mensalCards || []).filter((c) => c.toLowerCase() !== cleanName.toLowerCase()), cleanName],
      },
    }));

    setSelectedCardId(id);
    setActiveTab('cartoes');
    return { success: true, message: `Cartão "${cleanName}" cadastrado com sucesso!` };
  };

  const handleArchiveCard = (cardId: string) => {
    const cardToArchive = data.cards.find((c) => c.id === cardId);
    if (!cardToArchive) return;

    const cleanName = cardToArchive.name.toLowerCase().trim();
    const updatedCardsList = (data.cardsList || []).filter(
      (n) => n.toLowerCase().trim() !== cleanName
    );

    const updatedSimulator = {
      ...data.simulator,
      mensalCards: (data.simulator?.mensalCards || []).filter(
        (n) => n.toLowerCase().trim() !== cleanName
      ),
      quinzenaCards: (data.simulator?.quinzenaCards || []).filter(
        (n) => n.toLowerCase().trim() !== cleanName
      ),
    };

    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, archived: true } : c)),
      cardsList: updatedCardsList,
      simulator: updatedSimulator,
    }));

    if (selectedCardId === cardId) {
      const remaining = data.cards.filter((c) => c.id !== cardId && !c.archived);
      if (remaining.length > 0) {
        setSelectedCardId(remaining[0].id);
      }
    }
  };

  const handleDeleteCard = (cardId: string) => {
    const cardToDelete = data.cards.find((c) => c.id === cardId);
    if (!cardToDelete) return;

    const cleanName = cardToDelete.name.toLowerCase().trim();
    const updatedCardsList = (data.cardsList || []).filter(
      (n) => n.toLowerCase().trim() !== cleanName
    );

    const updatedSimulator = {
      ...data.simulator,
      mensalCards: (data.simulator?.mensalCards || []).filter(
        (n) => n.toLowerCase().trim() !== cleanName
      ),
      quinzenaCards: (data.simulator?.quinzenaCards || []).filter(
        (n) => n.toLowerCase().trim() !== cleanName
      ),
    };

    setData((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
      cardsList: updatedCardsList,
      simulator: updatedSimulator,
      fixedExpenses: (prev.fixedExpenses || []).filter((fe) => fe.cardId !== cardId),
    }));

    if (selectedCardId === cardId) {
      const remaining = data.cards.filter((c) => c.id !== cardId && !c.archived);
      if (remaining.length > 0) {
        setSelectedCardId(remaining[0].id);
      } else {
        setSelectedCardId('');
      }
    }
  };

  const handleRemoveCard = (cardId: string) => {
    const cardToRemove = data.cards.find((c) => c.id === cardId);
    if (!cardToRemove) return;

    const totalTransactions = Object.values(cardToRemove.months || {}).reduce(
      (acc, txs) => acc + (Array.isArray(txs) ? txs.length : 0),
      0
    );

    if (totalTransactions > 0) {
      handleArchiveCard(cardId);
    } else {
      handleDeleteCard(cardId);
    }
  };

  const handleReactivateCard = (cardId: string) => {
    setData((prev) => {
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card) return prev;
      return {
        ...prev,
        cards: prev.cards.map((c) => (c.id === cardId ? { ...c, archived: false } : c)),
        cardsList: prev.cardsList?.includes(card.name)
          ? prev.cardsList
          : [...(prev.cardsList || []), card.name],
      };
    });
  };

  // Edição pontual de ocorrência (Opção A vs Opção B)
  const handleEditOccurrence = (
    cardId: string,
    monthKey: string,
    updatedTx: {
      id: string;
      descricao: string;
      valor: number;
      data: string;
      pagador: string;
      parcelaAtual: number;
      totalParcelas: number;
      scope: 'only_this' | 'this_and_future';
    }
  ) => {
    const { key: normKey, year, month: mNum } = parseMonthKey(monthKey);
    const newParcelaStr = `${updatedTx.parcelaAtual}/${updatedTx.totalParcelas}`;

    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => {
        if (c.id !== cardId) return c;

        const currentTxs = getCardTransactions(c, normKey);
        const existingTx = currentTxs.find((t) => t.id === updatedTx.id);
        if (!existingTx) return c;

        const oldVal = existingTx.valor || 0;

        // OPÇÃO A: altera somente esta ocorrência do mês selecionado
        if (updatedTx.scope === 'only_this') {
          const diffVal = oldVal - updatedTx.valor;
          const updatedTxs = currentTxs.map((t) => {
            if (t.id !== updatedTx.id) return t;
            return {
              ...t,
              descricao: updatedTx.descricao,
              valor: updatedTx.valor,
              data: updatedTx.data,
              pagador: updatedTx.pagador,
              parcelas: newParcelaStr,
            };
          });

          const updatedMonths = {
            ...c.months,
            [normKey]: updatedTxs,
          };

          if (year === 2026) {
            updatedMonths[String(mNum)] = updatedTxs;
          }

          const newDisponivel = Math.round((c.disponivel + diffVal) * 100) / 100;

          return {
            ...c,
            disponivel: newDisponivel,
            months: updatedMonths,
          };
        }

        // OPÇÃO B: altera esta ocorrência e todos os meses futuros vinculados
        const consistentPurchaseId =
          existingTx.purchaseId ||
          (existingTx.linha !== undefined
            ? `pur-linha-${existingTx.linha}`
            : `pur-${Date.now()}`);

        const isSamePurchase = (t: Transaction): boolean => {
          if (t.parcelas === 'Fixa' || t.id.startsWith('fixed-')) return false;
          if (existingTx.purchaseId && t.purchaseId) {
            return existingTx.purchaseId === t.purchaseId;
          }
          if (existingTx.linha !== undefined && t.linha !== undefined) {
            const clean1 = existingTx.descricao
              .replace(/\(Divis[ãa]o\)/gi, '')
              .trim()
              .toLowerCase();
            const clean2 = t.descricao
              .replace(/\(Divis[ãa]o\)/gi, '')
              .trim()
              .toLowerCase();
            return existingTx.linha === t.linha && clean1 === clean2;
          }
          if (existingTx.id.startsWith('tx-') && t.id.startsWith('tx-')) {
            const p1 = existingTx.id.split('-').slice(0, 2).join('-');
            const p2 = t.id.split('-').slice(0, 2).join('-');
            if (p1 === p2) return true;
          }
          const clean1 = existingTx.descricao
            .replace(/\(Divis[ãa]o\)/gi, '')
            .trim()
            .toLowerCase();
          const clean2 = t.descricao
            .replace(/\(Divis[ãa]o\)/gi, '')
            .trim()
            .toLowerCase();
          return clean1 === clean2;
        };

        const updatedMonths = { ...c.months };
        let netDiffValue = oldVal - updatedTx.valor;

        const thisMonthUpdatedTxs = (updatedMonths[normKey] || []).map((t) => {
          if (t.id !== updatedTx.id) return t;
          return {
            ...t,
            purchaseId: consistentPurchaseId,
            descricao: updatedTx.descricao,
            valor: updatedTx.valor,
            data: updatedTx.data,
            pagador: updatedTx.pagador,
            parcelas: newParcelaStr,
          };
        });

        updatedMonths[normKey] = thisMonthUpdatedTxs;

        const remainingNeeded = Math.max(0, updatedTx.totalParcelas - updatedTx.parcelaAtual);

        for (let offset = 1; offset <= Math.max(remainingNeeded, 48); offset++) {
          const futureMonthKey = addMonths(normKey, offset);
          const shouldExist = offset <= remainingNeeded;
          const futureInstallmentNum = updatedTx.parcelaAtual + offset;
          const futureParcelaStr = `${futureInstallmentNum}/${updatedTx.totalParcelas}`;

          const currentFutureTxs = updatedMonths[futureMonthKey] || [];
          const existingFutureTx = currentFutureTxs.find((t) => isSamePurchase(t));

          if (shouldExist) {
            if (existingFutureTx) {
              netDiffValue += existingFutureTx.valor - updatedTx.valor;
              updatedMonths[futureMonthKey] = currentFutureTxs.map((t) => {
                if (!isSamePurchase(t)) return t;
                return {
                  ...t,
                  purchaseId: consistentPurchaseId,
                  descricao: updatedTx.descricao,
                  valor: updatedTx.valor,
                  pagador: updatedTx.pagador,
                  parcelas: futureParcelaStr,
                };
              });
            } else {
              netDiffValue -= updatedTx.valor;
              const newTx: Transaction = {
                id: `tx-${Date.now()}-${futureInstallmentNum}`,
                purchaseId: consistentPurchaseId,
                data: updatedTx.data,
                descricao: updatedTx.descricao,
                parcelas: futureParcelaStr,
                valor: updatedTx.valor,
                pagador: updatedTx.pagador,
              };
              updatedMonths[futureMonthKey] = [...currentFutureTxs, newTx];
            }
          } else if (existingFutureTx) {
            netDiffValue += existingFutureTx.valor;
            updatedMonths[futureMonthKey] = currentFutureTxs.filter(
              (t) => !isSamePurchase(t)
            );
          }
        }

        for (let m = 1; m <= 12; m++) {
          const mKey = `2026-${String(m).padStart(2, '0')}`;
          if (updatedMonths[mKey]) {
            updatedMonths[String(m)] = updatedMonths[mKey];
          }
        }

        const newDisponivel = Math.round((c.disponivel + netDiffValue) * 100) / 100;

        return {
          ...c,
          disponivel: newDisponivel,
          months: updatedMonths,
        };
      }),
      persons:
        updatedTx.pagador &&
        !prev.persons.some(
          (p) => p.toLowerCase().trim() === updatedTx.pagador.toLowerCase().trim()
        )
          ? [...prev.persons, updatedTx.pagador.trim()]
          : prev.persons,
    }));
  };

  const handleUpdateCardColor = (cardId: string, color: string) => {
    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, color } : c)),
    }));
  };

  const handleUpdateCardTextColor = (cardId: string, textColor: string) => {
    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, textColor } : c)),
    }));
  };

  const handleUpdateThemeConfig = (theme: ThemeConfig) => {
    setData((prev) => ({
      ...prev,
      themeConfig: theme,
    }));
  };

  // Resolução das 4 Cores Independentes do Tema
  const resolvedBg = getResolvedBgColor(data.themeConfig);
  const resolvedPanel = getResolvedPanelColor(data.themeConfig);
  const resolvedAccent = getResolvedAccentColor(data.themeConfig);
  const resolvedText = getResolvedTextColor(data.themeConfig);
  const resolvedMutedText = getResolvedMutedTextColor(resolvedText, resolvedPanel);
  const resolvedSubtleText = getResolvedSubtleTextColor(resolvedText, resolvedPanel);
  const resolvedBorder = getResolvedBorderColor(resolvedPanel);
  const resolvedPanelSubtle = getResolvedPanelSubtleColor(resolvedPanel);
  const resolvedInputBg = getResolvedInputBgColor(resolvedPanel);
  const accentTextColor = getContrastTextColor(resolvedAccent);
  const isLight = isLightColor(resolvedBg) || isLightColor(resolvedPanel);

  // Aplicação instantânea das 4 variáveis CSS de tema no documentElement (:root)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-bg', resolvedBg);
    root.style.setProperty('--theme-panel', resolvedPanel);
    root.style.setProperty('--theme-panel-subtle', resolvedPanelSubtle);
    root.style.setProperty('--theme-border', resolvedBorder);
    root.style.setProperty('--theme-accent', resolvedAccent);
    root.style.setProperty('--theme-accent-text', accentTextColor);
    root.style.setProperty('--theme-text', resolvedText);
    root.style.setProperty('--theme-text-muted', resolvedMutedText);
    root.style.setProperty('--theme-text-subtle', resolvedSubtleText);
    root.style.setProperty('--theme-input-bg', resolvedInputBg);
    root.style.setProperty('--theme-input-border', resolvedBorder);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolvedPanel);
    }
  }, [resolvedBg, resolvedPanel, resolvedPanelSubtle, resolvedBorder, resolvedAccent, accentTextColor, resolvedText, resolvedMutedText, resolvedSubtleText, resolvedInputBg]);

  const handleSaveCustomTitle = (key: string, newTitle: string) => {
    setData((prev) => ({
      ...prev,
      customTitles: {
        ...(prev.customTitles || {}),
        [key]: newTitle,
      },
    }));
  };

  // Pagadores favoritos
  const effectiveFavoritePersons = useMemo(() => {
    if (data.favoritePersons && data.favoritePersons.length > 0) {
      return data.favoritePersons;
    }
    return [];
  }, [data.favoritePersons]);

  const handleToggleFavoritePerson = (personName: string) => {
    const clean = personName.trim();
    const isFav = effectiveFavoritePersons.some((f) => f.toLowerCase().trim() === clean.toLowerCase());
    const updatedFavs = isFav
      ? effectiveFavoritePersons.filter((f) => f.toLowerCase().trim() !== clean.toLowerCase())
      : [...effectiveFavoritePersons, clean];
    setData((prev) => ({
      ...prev,
      favoritePersons: updatedFavs,
    }));
  };

  const handleAddPerson = (personName: string, makeFavorite = false) => {
    const clean = personName.trim();
    if (!clean) return;

    setData((prev) => {
      const alreadyHas = prev.persons.some((p) => p.toLowerCase().trim() === clean.toLowerCase());
      const updatedPersons = alreadyHas ? prev.persons : [...prev.persons, clean];
      const isFav = effectiveFavoritePersons.some((f) => f.toLowerCase().trim() === clean.toLowerCase());
      const updatedFavs = makeFavorite && !isFav ? [...effectiveFavoritePersons, clean] : (prev.favoritePersons || effectiveFavoritePersons);
      return {
        ...prev,
        persons: updatedPersons,
        favoritePersons: updatedFavs,
      };
    });
  };

  if (isSessionClosed) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-5 font-sans"
        style={{ backgroundColor: resolvedBg, color: resolvedText }}
      >
        <section
          className="w-full max-w-md rounded-2xl border p-6 text-center shadow-xl"
          style={{ backgroundColor: resolvedPanel, borderColor: resolvedBorder }}
        >
          <h1 className="text-xl font-bold">Sessão encerrada</h1>
          <p className="mt-2 text-sm opacity-75">Se a janela continuar aberta, feche pelo X do sistema. Esse X também mantém o salvamento automático normal.</p>
          <button
            type="button"
            onClick={() => setIsSessionClosed(false)}
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ backgroundColor: resolvedAccent, color: accentTextColor }}
          >
            Voltar ao aplicativo
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      className="theme-app-container min-h-screen flex flex-col font-sans transition-colors duration-150"
      style={{
        backgroundColor: resolvedBg,
        color: resolvedText,
        backgroundImage: isLight
          ? `radial-gradient(circle at 50% 0%, ${resolvedAccent}12, transparent 80%)`
          : `radial-gradient(circle at 50% 0%, ${resolvedAccent}22, transparent 75%)`,
      }}
    >
      {/* Cabeçalho Principal Organizado */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        accentColor={resolvedAccent}
        accentTextColor={accentTextColor}
        panelColor={resolvedPanel}
        textColor={resolvedText}
        mutedTextColor={resolvedMutedText}
        tabPreferences={data.tabPreferences}
        customHeaderTitle={data.customHeaderTitle}
        customTabNames={data.customTabNames}
        onRequestExit={handleRequestAppExit}
      />

      {isExitPromptOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-exit-title"
            className="w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{ backgroundColor: resolvedPanel, borderColor: resolvedBorder, color: resolvedText }}
          >
            <div>
              <h2 id="app-exit-title" className="text-lg font-bold">Encerrar o Cartões?</h2>
              <p className="mt-2 text-sm opacity-75">Escolha o que fazer com esta sessão. O X da janela continua mantendo o salvamento automático.</p>
              <p className="mt-2 text-xs opacity-60">“Sair sem salvar” restaura os dados que estavam salvos quando você abriu o app.</p>
            </div>

            {exitActionError && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300" role="alert">{exitActionError}</p>}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleFinishAppExit(true)}
                disabled={isExitActionBusy}
                className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: resolvedAccent, color: accentTextColor }}
              >
                {isExitActionBusy ? 'Salvando…' : 'Salvar e sair'}
              </button>
              <button
                type="button"
                onClick={() => void handleFinishAppExit(false)}
                disabled={isExitActionBusy}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: resolvedBorder, backgroundColor: resolvedBg, color: resolvedText }}
              >
                Sair sem salvar
              </button>
              <button
                type="button"
                onClick={() => setIsExitPromptOpen(false)}
                disabled={isExitActionBusy}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold opacity-75 hover:opacity-100 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Conteúdo Principal das Telas */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto py-5 px-3 sm:px-6 lg:px-8">
        {activeTab === 'limites' && (
          <DashboardLimites
            cards={data.cards}
            persons={data.persons.filter(
              (p) =>
                !(data.hiddenPersons || []).some(
                  (h) => h.toLowerCase().trim() === p.toLowerCase().trim()
                )
            )}
            paidInvoices={data.paidInvoices || {}}
            onSelectCard={handleCardSelectedFromDashboard}
            onOpenAddCard={() => setIsAddCardOpen(true)}
            onOpenLancamento={() => handleOpenLancamento()}
            onRemoveCard={handleRemoveCard}
            onArchiveCard={handleArchiveCard}
            onDeleteCard={handleDeleteCard}
            onReactivateCard={handleReactivateCard}
            themeConfig={data.themeConfig}
            onUpdateThemeConfig={handleUpdateThemeConfig}
            onUpdateCardTextColor={handleUpdateCardTextColor}
            customTitles={data.customTitles}
            onSaveCustomTitle={handleSaveCustomTitle}
          />
        )}

        {activeTab === 'matriz' && (
          <MatrizGastosView
            cards={data.cards}
            persons={data.persons.filter(
              (p) =>
                !(data.hiddenPersons || []).some(
                  (h) => h.toLowerCase().trim() === p.toLowerCase().trim()
                )
            )}
            paidInvoices={data.paidInvoices || {}}
            onSelectCard={handleCardSelectedFromDashboard}
            customTitles={data.customTitles}
            onSaveCustomTitle={handleSaveCustomTitle}
            simulatorConfig={data.simulator}
            fixedExpenses={data.fixedExpenses || []}
            isMiniSimPinned={isMiniSimPinned}
            onToggleMiniSimPinned={() => setIsMiniSimPinned((pinned) => !pinned)}
            onCloseMiniSim={() => setIsMiniSimPinned(false)}
            selectedMonthKey={miniSimSelectedMonthKey}
            onSelectedMonthKeyChange={setMiniSimSelectedMonthKey}
            referenceMonthKey={miniSimReferenceMonthKey}
            onReferenceMonthKeyChange={setMiniSimReferenceMonthKey}
          />
        )}

        {activeTab === 'cartoes' && (
          <CardView
            cards={data.cards.filter((c) => !c.archived)}
            persons={data.persons}
            hiddenPersons={data.hiddenPersons || []}
            favoritePersons={effectiveFavoritePersons}
            onToggleFavoritePerson={handleToggleFavoritePerson}
            onAddPerson={handleAddPerson}
            fixedExpenses={data.fixedExpenses || []}
            paidInvoices={data.paidInvoices || {}}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            onOpenLancamento={handleOpenLancamento}
            onDeleteTransaction={handleDeleteSingleTransaction}
            onDeletePurchaseAndFutureInstallments={handleDeletePurchaseAndFutureInstallments}
            onEditOccurrence={handleEditOccurrence}
            onClearMonth={handleClearMonth}
            onClearAllMonths={handleClearAllMonths}
            onUpdateCard={handleUpdateCard}
            onUpdateCardImage={handleUpdateCardImage}
            onUpdateCardColor={handleUpdateCardColor}
            onSaveFixedExpense={handleSaveFixedExpense}
            onDeleteFixedExpense={handleDeleteFixedExpense}
            onDeleteOrHidePerson={handleDeleteOrHidePerson}
            onUnhidePerson={handleUnhidePerson}
            onTogglePaidInvoice={handleTogglePaidInvoice}
            onTogglePaidTransaction={handleTogglePaidTransaction}
            onArchiveCard={handleArchiveCard}
            onDeleteCard={handleDeleteCard}
            themeConfig={data.themeConfig}
          />
        )}

        {activeTab === 'dividas' && (
          <DividasTotaisView
            cards={data.cards}
            persons={data.persons.filter(
              (p) =>
                !(data.hiddenPersons || []).some(
                  (h) => h.toLowerCase().trim() === p.toLowerCase().trim()
                )
            )}
            paidInvoices={data.paidInvoices || {}}
            onSelectCard={handleCardSelectedFromDashboard}
            initialYear={data.dividasSelectedYear}
            onYearChange={(year) => setData((prev) => ({ ...prev, dividasSelectedYear: year }))}
            customTitles={data.customTitles}
            onSaveCustomTitle={handleSaveCustomTitle}
          />
        )}

        {activeTab === 'pesquisar' && (
          <PesquisarParcelasView
            cards={data.cards}
            paidInvoices={data.paidInvoices || {}}
            onSelectCard={handleCardSelectedFromDashboard}
            customTitles={data.customTitles}
            onSaveCustomTitle={handleSaveCustomTitle}
          />
        )}

        {activeTab === 'simulador' && (
          <SimuladorGastosView
            cards={data.cards}
            persons={data.persons}
            config={data.simulator}
            fixedExpenses={data.fixedExpenses || []}
            onSaveConfig={handleSaveSimulatorConfig}
            customTitles={data.customTitles}
            onSaveCustomTitle={handleSaveCustomTitle}
          />
        )}

        {activeTab === 'configuracoes' && (
          <ConfiguracoesView
            appData={data}
            onUpdateAppData={setData}
            accentColor={resolvedAccent}
            accentTextColor={accentTextColor}
            panelColor={resolvedPanel}
            textColor={resolvedText}
          />
        )}
      </main>

      {/* Modal de Lançamento de Parcelas */}
      <ModalLancamento
        isOpen={isLancamentoOpen}
        onClose={() => setIsLancamentoOpen(false)}
        cards={data.cards.filter((c) => !c.archived)}
        persons={data.persons}
        favoritePersons={effectiveFavoritePersons}
        onToggleFavoritePerson={handleToggleFavoritePerson}
        onAddNewPerson={handleAddPerson}
        defaultCardName={lancamentoDefaultCard}
        onSaveLancamento={handleSaveLancamento}
      />

      {/* Modal de Adicionar Novo Cartão */}
      <ModalAdicionarCartao
        isOpen={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        existingCards={data.cards}
        onAddCard={handleAddCard}
      />

      {/* Modal de Confirmação Segura */}
      <ModalConfirmacao
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        isDestructive={confirmModal.isDestructive}
      />

      {/* Indicador de Status Offline */}
      <OfflineIndicator />
    </div>
  );
}
