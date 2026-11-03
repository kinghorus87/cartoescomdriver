import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CardData, FixedExpense, Transaction, ThemeConfig } from '../types';
import { formatCurrency, MESES_NOMES } from '../utils/storage';
import { 
  getVisible7Months, 
  getCardTransactions, 
  formatMonthPill, 
  formatMonthLong, 
  addMonths, 
  diffMonths,
  parseMonthKey, 
  formatFullBrazilianNumber, 
  getDueStatus,
  CURRENT_REAL_MONTH,
  getRolling36Window,
  isMonthInRollingWindow
} from '../utils/timeline';
import { 
  Trash2, 
  Plus, 
  RotateCcw, 
  ChevronDown,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Palette,
  PlusCircle,
  Star,
  Pin,
  UserPlus,
  X,
  Archive,
  CreditCard
} from 'lucide-react';
import { ModalEditarCartao } from './ModalEditarCartao';
import { ModalConfirmacao } from './ModalConfirmacao';
import { ModalParcelaFixa } from './ModalParcelaFixa';
import { ModalEditarOcorrencia } from './ModalEditarOcorrencia';
import { BankCardVisual } from './BankCardVisual';
import { getCardColor, CARD_COLOR_PRESETS, extractCardFinalDigits, getAutoContrastTextColor, getResolvedPanelColor } from '../utils/cardColors';

interface CardViewProps {
  cards: CardData[];
  persons: string[];
  hiddenPersons?: string[];
  favoritePersons?: string[];
  onToggleFavoritePerson?: (personName: string) => void;
  onAddPerson?: (personName: string, makeFavorite?: boolean) => void;
  fixedExpenses?: FixedExpense[];
  paidInvoices?: Record<string, boolean>;
  selectedCardId: string;
  onSelectCard: (cardId: string) => void;
  onOpenLancamento: (cardName?: string) => void;
  onDeleteTransaction: (cardId: string, month: string | number, txId: string) => void;
  onDeletePurchaseAndFutureInstallments?: (cardId: string, fromMonthKey: string, targetTx: Transaction) => void;
  onEditOccurrence?: (
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
  ) => void;
  onClearMonth: (cardId: string, month: string | number) => void;
  onClearAllMonths: (cardId: string) => void;
  onUpdateCard: (updatedCard: {
    id: string;
    name: string;
    limite: number;
    dueDay: string;
    finalCard?: string;
    isFisico?: string;
    isVirtual?: string;
    color?: string;
    customImage?: string;
  }) => { success: boolean; message?: string };
  onUpdateCardImage: (cardId: string, customImage?: string) => void;
  onUpdateCardColor?: (cardId: string, color: string) => void;
  onSaveFixedExpense: (expense: Omit<FixedExpense, 'id'> & { id?: string }) => void;
  onDeleteFixedExpense: (expenseId: string) => void;
  onDeleteOrHidePerson: (personName: string) => void;
  onUnhidePerson?: (personName: string) => void;
  onTogglePaidInvoice?: (cardId: string, monthKey: string) => void;
  onTogglePaidTransaction?: (cardId: string, monthKey: string, txId: string) => void;
  onArchiveCard?: (cardId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  themeConfig?: ThemeConfig;
}

export const CardView: React.FC<CardViewProps> = ({
  cards,
  persons,
  hiddenPersons = [],
  favoritePersons = [],
  onToggleFavoritePerson,
  onAddPerson,
  fixedExpenses = [],
  paidInvoices = {},
  selectedCardId,
  onSelectCard,
  onOpenLancamento,
  onDeleteTransaction,
  onDeletePurchaseAndFutureInstallments,
  onEditOccurrence,
  onClearMonth,
  onClearAllMonths,
  onUpdateCard,
  onUpdateCardImage,
  onUpdateCardColor,
  onSaveFixedExpense,
  onDeleteFixedExpense,
  onDeleteOrHidePerson,
  onUnhidePerson,
  onTogglePaidInvoice,
  onTogglePaidTransaction,
  onArchiveCard,
  onDeleteCard,
  themeConfig,
}) => {
  const currentCard = cards.find((c) => c.id === selectedCardId) || cards[0];
  
  // Mês selecionado na fatura (padrão '2026-10')
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(CURRENT_REAL_MONTH);

  // Mês central de referência da janela de 7 meses (padrão '2026-10', ocupando a 4ª posição central)
  const [referenceMonthKey, setReferenceMonthKey] = useState<string>(CURRENT_REAL_MONTH);

  const resolvedPanelColor = getResolvedPanelColor(themeConfig);
  // Mantém o contraste estável ao trocar o mês: o estilo dos próprios balões
  // depende do contraste, então medir o primeiro balão criava uma dependência circular.
  const personValueContrastColor = getAutoContrastTextColor(resolvedPanelColor);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info'>('success');
  const [isAddPersonOpen, setIsAddPersonOpen] = useState<boolean>(false);
  const [cardActionModal, setCardActionModal] = useState<{
    type: 'archive' | 'delete' | 'cannot_delete';
    txCount?: number;
  } | null>(null);
  const [newPersonNameInput, setNewPersonNameInput] = useState<string>('');
  const [newPersonFavoriteCheck, setNewPersonFavoriteCheck] = useState<boolean>(false);
  
  // Lançamento selecionado na fatura para o botão de topo "Apagar lançamento"
  const [selectedTx, setSelectedTx] = useState<{ monthKey: string; tx: Transaction } | null>(null);
  const [isDeleteFutureModalOpen, setIsDeleteFutureModalOpen] = useState<boolean>(false);

  // Lançamento selecionado para exclusão individual pela lixeira da fatura
  const [txToDeleteSingle, setTxToDeleteSingle] = useState<{ monthKey: string; tx: Transaction } | null>(null);

  // Lançamento selecionado para edição pontual da ocorrência deste mês
  const [txToEditSingle, setTxToEditSingle] = useState<{ monthKey: string; tx: Transaction } | null>(null);

  // Popover de seleção de cor do cartão
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);

  // Estados para Parcelas Fixas (Despesas Recorrentes)
  const [isFixedModalOpen, setIsFixedModalOpen] = useState<boolean>(false);
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);
  const [isFixedSectionOpen, setIsFixedSectionOpen] = useState<boolean>(false);
  const [fixedToDelete, setFixedToDelete] = useState<FixedExpense | null>(null);
  const [showHiddenPersons, setShowHiddenPersons] = useState<boolean>(false);

  // Garante que a seção de parcelas fixas inicie sempre recolhida ao carregar e ao trocar de cartão
  React.useEffect(() => {
    setIsFixedSectionOpen(false);
  }, [selectedCardId]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSaveEdit = (updatedCard: {
    id: string;
    name: string;
    limite: number;
    dueDay: string;
    finalCard?: string;
    isFisico?: string;
    isVirtual?: string;
    color?: string;
    customImage?: string;
  }) => {
    const result = onUpdateCard(updatedCard);
    if (result.success) {
      showToast(result.message || 'Cartão atualizado com sucesso!', 'success');
    }
    return result;
  };

  // Upload e compressão de foto personalizada do cartão
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCard) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione um arquivo de imagem válido.', 'info');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 640;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          onUpdateCardImage(currentCard.id, compressed);
          showToast(`Imagem do cartão "${currentCard.name}" atualizada com sucesso!`, 'success');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!currentCard) return;
    onUpdateCardImage(currentCard.id, undefined);
    showToast(`Imagem do cartão "${currentCard.name}" removida.`, 'info');
  };

  // Disparo do botão "Apagar lançamento" da barra de topo (Tópico 2.1)
  const handleTriggerDeleteFuture = () => {
    if (!selectedTx) {
      showToast('Selecione uma compra abaixo na lista para apagar.', 'info');
      return;
    }
    setIsDeleteFutureModalOpen(true);
  };

  // Confirmação da exclusão da compra e todas as suas parcelas do mês atual e futuras (Tópico 2.1 & 2.2)
  const handleConfirmDeleteFuture = () => {
    if (!selectedTx || !currentCard) return;
    if (onDeletePurchaseAndFutureInstallments) {
      onDeletePurchaseAndFutureInstallments(currentCard.id, selectedTx.monthKey, selectedTx.tx);
    } else {
      onDeleteTransaction(currentCard.id, selectedTx.monthKey, selectedTx.tx.id);
    }
    showToast(`Compra "${selectedTx.tx.descricao}" e suas parcelas futuras foram apagadas com sucesso!`, 'success');
    setSelectedTx(null);
    setIsDeleteFutureModalOpen(false);
  };

  // Confirmação da lixeira individual da fatura (Tópico 2.3): apenas a ocorrência daquele mês
  const handleConfirmDeleteSingle = () => {
    if (!txToDeleteSingle || !currentCard) return;
    onDeleteTransaction(currentCard.id, txToDeleteSingle.monthKey, txToDeleteSingle.tx.id);
    showToast(`Lançamento "${txToDeleteSingle.tx.descricao}" deste mês foi apagado com sucesso.`, 'success');
    if (selectedTx?.tx.id === txToDeleteSingle.tx.id) {
      setSelectedTx(null);
    }
    setTxToDeleteSingle(null);
  };

  // Centralização ao clicar em qualquer mês (Tópico 3): o mês clicado vai para a 4ª posição (centro da janela de 7 meses)
  const handleSelectMonth = (mKey: string) => {
    setSelectedMonthKey(mKey);
    setReferenceMonthKey(mKey);
    setSelectedTx(null);
  };

  const rolling36 = useMemo(() => getRolling36Window(), []);
  const { startMonthKey, endMonthKey } = rolling36;

  // Janela de 7 meses sincronizada para a faixa de pílulas e o gráfico (delimitada nos 36 meses)
  const visible7Months = useMemo(() => {
    return getVisible7Months(referenceMonthKey);
  }, [referenceMonthKey]);

  // Bloqueio rigoroso nas extremidades da janela móvel de 36 meses
  const canPrevWindow = useMemo(() => {
    if (!visible7Months.length) return false;
    return diffMonths(startMonthKey, visible7Months[0]) > 0;
  }, [startMonthKey, visible7Months]);

  const canNextWindow = useMemo(() => {
    if (!visible7Months.length) return false;
    return diffMonths(visible7Months[visible7Months.length - 1], endMonthKey) > 0;
  }, [endMonthKey, visible7Months]);

  // Navegação manual da janela através dos chevrons com bloqueio nas extremidades
  const handlePrevWindow = () => {
    if (!canPrevWindow) return;
    setReferenceMonthKey((prev) => {
      const target = addMonths(prev, -1);
      return diffMonths(startMonthKey, target) < 0 ? startMonthKey : target;
    });
  };

  const handleNextWindow = () => {
    if (!canNextWindow) return;
    setReferenceMonthKey((prev) => {
      const target = addMonths(prev, 1);
      return diffMonths(target, endMonthKey) < 0 ? endMonthKey : target;
    });
  };

  // No painel do cartão, exibe apenas responsáveis com lançamentos neste cartão.
  const allCardPersons = useMemo(() => {
    const set = new Set<string>();
    if (currentCard) {
      Object.values(currentCard.months || {}).forEach((txs) => {
        if (Array.isArray(txs)) {
          txs.forEach((t) => {
            if (t.pagador && t.pagador.trim()) {
              set.add(t.pagador.trim());
            }
          });
        }
      });
    }
    return Array.from(set);
  }, [currentCard]);

  // Pessoas visíveis (excluindo as ocultadas em hiddenPersons) ordenadas de forma consistente
  const visibleCardPersons = useMemo(() => {
    const list = allCardPersons.filter(
      (p) => !(hiddenPersons || []).some((h) => h.toLowerCase().trim() === p.toLowerCase().trim())
    );
    const favs = favoritePersons || [];
    return [...list].sort((a, b) => {
      const aFav = favs.some((f) => f.toLowerCase().trim() === a.toLowerCase().trim());
      const bFav = favs.some((f) => f.toLowerCase().trim() === b.toLowerCase().trim());
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [allCardPersons, hiddenPersons, favoritePersons]);

  // Parcelas fixas associadas a este cartão
  const cardFixedExpenses = useMemo(() => {
    if (!currentCard) return [];
    return (fixedExpenses || []).filter((fe) => fe.cardId === currentCard.id);
  }, [fixedExpenses, currentCard]);

  // Status de pagamento da fatura selecionada (Tópico 4)
  const isInvoicePaid = Boolean(paidInvoices[`${currentCard?.id}_${selectedMonthKey}`]);

  // Situação do vencimento da fatura (Tópico 6)
  const invoiceDueStatus = useMemo(() => {
    return getDueStatus(currentCard?.dueDay, selectedMonthKey);
  }, [currentCard?.dueDay, selectedMonthKey]);

  const getCardTotalTransactionsCount = (card: CardData): number => {
    const seen = new Set<string>();
    Object.values(card.months || {}).forEach((txs) => {
      if (Array.isArray(txs)) {
        txs.forEach((t) => seen.add(t.id));
      }
    });
    return seen.size;
  };

  if (!currentCard || cards.length === 0) {
    return (
      <div className="w-full text-slate-100 font-sans py-4">
        <div className="bg-[#111625] border border-slate-800/90 rounded-3xl p-10 sm:p-14 text-center shadow-2xl max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mx-auto mb-4 text-slate-400 shadow-inner">
            <PlusCircle className="w-8 h-8 text-sky-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Nenhum Cartão Cadastrado</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            O sistema está totalmente zerado. Cadastre o seu primeiro cartão para acompanhar faturas mensais, gerenciar parcelas e visualizar gráficos de despesas.
          </p>
          <button
            onClick={() => onOpenLancamento()}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adicionar Primeiro Cartão</span>
          </button>
        </div>
      </div>
    );
  }

  // Lançamentos do mês selecionado
  const monthTxs = getCardTransactions(currentCard, selectedMonthKey);
  const totalMonthExpense = monthTxs.reduce((acc, t) => acc + (t.valor || 0), 0);

  const totalPaidInMonth = isInvoicePaid
    ? totalMonthExpense
    : monthTxs.filter((t) => t.pago).reduce((acc, t) => acc + (t.valor || 0), 0);
  const totalPendingInMonth = Math.max(0, totalMonthExpense - totalPaidInMonth);

  // Gastos e pagamentos por pessoa no mês selecionado
  const getPersonSpentStats = (person: string) => {
    const personTxs = monthTxs.filter(
      (t) => t.pagador?.toLowerCase().trim() === person.toLowerCase().trim()
    );
    const total = personTxs.reduce((acc, t) => acc + (t.valor || 0), 0);
    const paid = isInvoicePaid 
      ? total 
      : personTxs.filter((t) => t.pago).reduce((acc, t) => acc + (t.valor || 0), 0);
    const pending = Math.max(0, total - paid);
    return { total, paid, pending, count: personTxs.length };
  };

  const getPersonSpentInCard = (person: string): number => {
    return getPersonSpentStats(person).total;
  };

  // Dados para o Gráfico de Faturas dos 7 MESES SINCRONIZADOS (Tópico 2)
  const chart7MonthsData = visible7Months.map((mKey) => {
    const txs = getCardTransactions(currentCard, mKey);
    const total = txs.reduce((acc, t) => acc + (t.valor || 0), 0);
    return {
      monthKey: mKey,
      pillName: formatMonthPill(mKey),
      longName: formatMonthLong(mKey),
      total,
      txCount: txs.length,
    };
  });

  const maxChartVal = Math.max(...chart7MonthsData.map((d) => d.total), 400);

  // SVG Chart Dimensions (Otimizado: elementos mais próximos e textos maiores)
  const chartWidth = 430;
  const chartHeight = 150;
  const paddingLeft = 24;
  const paddingRight = 24;
  const paddingTop = 18;
  const paddingBottom = 24;
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const points = chart7MonthsData.map((d, idx) => {
    const x = paddingLeft + (idx / 6) * usableWidth;
    const normalizedY = d.total / maxChartVal;
    const y = paddingTop + (1 - normalizedY) * usableHeight;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  return (
    <div className="space-y-4 w-full text-slate-100 font-sans">
      {/* Input oculto para upload de foto do cartão */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`border px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-150 ${
          toastType === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-2">
            {toastType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white font-bold ml-3 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. BARRA DE TOPO COM FOTO EM DESTAQUE E SEM ÍCONE EXTRA   */}
      {/* ======================================================== */}
      <div 
        className="bg-[#111625] border border-slate-800/90 rounded-2xl px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl transition-all"
        style={{ borderTopColor: getCardColor(currentCard), borderTopWidth: '3px' }}
      >
        {/* Esquerda: Foto em Destaque (Aumentada moderadamente e sem ícone ao lado - Tópico 1) + Nome do Cartão */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Representação visual do cartão (Desenho estilizado ou foto personalizada) */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative w-32 h-20 sm:w-36 sm:h-22 rounded-xl overflow-hidden border border-teal-500/30 hover:border-teal-400/60 shadow-lg group cursor-pointer shrink-0 transition-transform active:scale-95 bg-[#0a0f1d]"
            title="Clique para escolher ou trocar a foto do cartão"
          >
            <BankCardVisual
              name={currentCard.name}
              color={getCardColor(currentCard)}
              textColor={currentCard.textColor}
              finalDigits={extractCardFinalDigits(currentCard.isFisico || currentCard.isVirtual)}
              customImage={currentCard.customImage}
              showOverlayHover={true}
              overlayText={currentCard.customImage ? 'Trocar Foto' : 'Adicionar Foto'}
              className="w-full h-full"
            />
          </div>

          {/* Nome do Cartão (Dropdown) e opções */}
          <div className="relative flex-1 md:flex-initial">
            <div className="flex items-center gap-2">
              {/* Bolinha Seletora de Cor do Cartão */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  className="w-5 h-5 rounded-full border-2 border-white/40 shadow-md shrink-0 cursor-pointer transition-transform hover:scale-115"
                  style={{ backgroundColor: getCardColor(currentCard) }}
                  title="Alterar cor de destaque deste cartão"
                />

                {isColorPickerOpen && (
                  <div 
                    className="absolute top-7 left-0 z-50 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl space-y-2.5 animate-in fade-in w-56 text-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-slate-400 font-bold block">Escolher cor do cartão:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {CARD_COLOR_PRESETS.map((p) => (
                        <button
                          key={p.color}
                          type="button"
                          onClick={() => {
                            onUpdateCardColor?.(currentCard.id, p.color);
                            setIsColorPickerOpen(false);
                            showToast(`Cor do cartão alterada.`, 'success');
                          }}
                          className="w-7 h-7 rounded-full border border-white/20 hover:scale-115 transition-transform cursor-pointer shadow-sm"
                          style={{ backgroundColor: p.color }}
                          title={p.name}
                        />
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-medium">Cor livre:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={getCardColor(currentCard)}
                          onChange={(e) => {
                            onUpdateCardColor?.(currentCard.id, e.target.value);
                          }}
                          className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCardColor?.(currentCard.id, '');
                        setIsColorPickerOpen(false);
                        showToast(`Cor redefinida para o padrão do banco.`, 'info');
                      }}
                      className="w-full text-center text-[10.5px] text-slate-400 hover:text-amber-400 font-semibold pt-1 block cursor-pointer transition-colors"
                    >
                      Redefinir para cor padrão
                    </button>
                  </div>
                )}
              </div>

              {/* Identificação Visual do Cartão com Ícone Amarelo e Sem Truncamento Indevido */}
              <div className="flex items-center gap-2.5 min-w-0">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
                <div className="relative flex items-center min-w-0">
                  <select
                    value={currentCard.id}
                    onChange={(e) => {
                      onSelectCard(e.target.value);
                      setSelectedTx(null);
                    }}
                    className="appearance-none bg-transparent hover:bg-slate-800/40 text-white font-extrabold text-base sm:text-lg lg:text-xl tracking-wide uppercase pl-1 pr-7 py-0.5 rounded-lg focus:outline-none cursor-pointer max-w-[260px] sm:max-w-[420px] md:max-w-none"
                    title={currentCard.name}
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white font-normal text-sm normal-case">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 -ml-6 pointer-events-none shrink-0" />
                </div>
              </div>
            </div>

            {currentCard.customImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 mt-1 pl-1 cursor-pointer transition-colors"
                title="Voltar ao modelo padrão com nome e cor"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Voltar ao modelo padrão</span>
              </button>
            )}
          </div>
        </div>

        {/* Direita: Gestão Exclusiva do Cartão (Editar, Arquivar, Excluir) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Editar cartão */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            title="Editar dados cadastrais, limite e vencimento deste cartão"
            className="flex items-center gap-1.5 bg-[#162032] hover:bg-[#1c2a42] text-teal-400 hover:text-teal-300 border border-teal-500/30 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar cartão</span>
          </button>

          {/* Arquivar cartão */}
          {onArchiveCard && (
            <button
              onClick={() => {
                const txCount = getCardTotalTransactionsCount(currentCard);
                setCardActionModal({ type: 'archive', txCount });
              }}
              title="Arquivar cartão preservando todas as compras e histórico contábil"
              className="flex items-center gap-1.5 bg-[#162032] hover:bg-amber-500/15 text-slate-300 hover:text-amber-300 border border-slate-700/80 hover:border-amber-500/40 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Arquivar cartão</span>
            </button>
          )}

          {/* Excluir cartão */}
          {(onDeleteCard || onArchiveCard) && (
            <button
              onClick={() => {
                const txCount = getCardTotalTransactionsCount(currentCard);
                if (txCount > 0) {
                  setCardActionModal({ type: 'cannot_delete', txCount });
                } else {
                  setCardActionModal({ type: 'delete', txCount: 0 });
                }
              }}
              title="Excluir cartão definitivamente"
              className="flex items-center gap-1.5 bg-[#162032] hover:bg-red-500/15 text-slate-300 hover:text-red-400 border border-slate-700/80 hover:border-red-500/40 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Excluir cartão</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* NOVO LAYOUT: COLUNA ESQUERDA (LIMITES + RESUMO + GRÁFICO) */}
      {/*              COLUNA DIREITA (DETALHAMENTO DE FATURAS)     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* COLUNA ESQUERDA: LIMITES (MANTIDO) + RESUMO (MODERADAMENTE REDUZIDO) + GRÁFICO */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Parte superior: Limites (esq) e Resumo (dir reduzido moderadamente) */}
          <div className="grid grid-cols-1 sm:grid-cols-[1.14fr_0.86fr] gap-3.5 items-start">
            {/* Painel 1: INFORMAÇÕES E LIMITES (Lado esquerdo) */}
            <div className="bg-[#111625] border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg self-start">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Informações e Limites
                </h3>

            <div className="space-y-3.5">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Limite Contratado</span>
                <span className="text-sm font-bold text-white font-mono">
                  {currentCard.limite > 0 ? formatCurrency(currentCard.limite) : 'Não informado'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Limite Disponível</span>
                <span className="text-sm font-bold text-white font-mono">
                  {formatCurrency(currentCard.disponivel)}
                </span>
              </div>

              <div className="py-1 border-b border-slate-800/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Vencimento da Fatura:</span>
                  <span className="text-sm font-bold text-amber-400">
                    {currentCard.dueDay ? (currentCard.dueDay.replace(/\D/g, '') || currentCard.dueDay) : 'Não informado'}
                  </span>
                </div>
                {isInvoicePaid && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    ✓ Fatura Paga
                  </span>
                )}
              </div>

              {(() => {
                const fisicoDigits = extractCardFinalDigits(currentCard.isFisico);
                const virtualDigits = extractCardFinalDigits(currentCard.isVirtual);
                const shouldShowIdentification = currentCard.exibirIdentificacao !== false && (Boolean(fisicoDigits) || Boolean(virtualDigits));

                if (!shouldShowIdentification) return null;

                return (
                  <div className="pt-1 space-y-1.5 border-b border-slate-800/60 pb-3">
                    {fisicoDigits && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Final Físico:</span>
                        <span className="font-mono font-bold text-sm text-white">
                          •••• {fisicoDigits}
                        </span>
                      </div>
                    )}
                    {virtualDigits && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Final Virtual:</span>
                        <span className="font-mono font-bold text-sm text-white">
                          •••• {virtualDigits}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SEÇÃO + PARCELAS FIXAS */}
              <div className="pt-1">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsFixedSectionOpen(!isFixedSectionOpen)}
                    className="flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer group"
                  >
                    <span>+ Parcelas fixas</span>
                    {cardFixedExpenses.length > 0 && (
                      <span className="bg-teal-500/20 text-teal-300 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                        {cardFixedExpenses.length}
                      </span>
                    )}
                    {isFixedSectionOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-300" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-300" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingFixedExpense(null);
                      setIsFixedModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[11px] bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>Nova</span>
                  </button>
                </div>

                {isFixedSectionOpen && (
                  <div className="mt-2 space-y-2 bg-[#0c1220] border border-slate-800/80 rounded-xl p-2.5">
                    {cardFixedExpenses.length === 0 ? (
                      <div className="text-[11px] text-slate-400 py-2 text-center">
                        Nenhuma parcela fixa cadastrada neste cartão.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5">
                        {cardFixedExpenses.map((fe, idx) => (
                          <div 
                            key={`${fe.id}-${idx}`} 
                            className="flex items-center justify-between p-2 rounded-lg bg-[#141c2e] border border-slate-700/60 text-xs"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white truncate text-xs">
                                  {fe.descricao}
                                </span>
                                <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                                  fe.ativo !== false 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-slate-700 text-slate-400'
                                }`}>
                                  {fe.ativo !== false ? 'Ativa' : 'Inativa'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>Dia {fe.diaMes || 10}</span>
                                {fe.pagador && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-400 capitalize">{fe.pagador}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-bold text-white text-xs">
                                {formatCurrency(fe.valor)}
                              </span>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFixedExpense(fe);
                                    setIsFixedModalOpen(true);
                                  }}
                                  title="Editar parcela fixa"
                                  className="p-1 text-slate-400 hover:text-teal-300 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFixedToDelete(fe)}
                                  title="Excluir parcela fixa"
                                  className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status da Fatura do Mês */}
              <div className="pt-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0c1220] border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold tracking-wider">
                      Fatura de {formatMonthPill(selectedMonthKey)}:
                    </span>
                    <span className={`font-extrabold flex items-center gap-1 text-xs ${
                      isInvoicePaid ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {isInvoicePaid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>PAGA</span>
                        </>
                      ) : (
                        <span>EM ABERTO</span>
                      )}
                    </span>
                  </div>

                  {onTogglePaidInvoice && (
                    <button
                      type="button"
                      onClick={() => onTogglePaidInvoice(currentCard.id, selectedMonthKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 shadow-md ${
                        isInvoicePaid
                          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-600'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-950/40 active:scale-95'
                      }`}
                      title={isInvoicePaid ? 'Clique para desmarcar quitação da fatura' : 'Marcar esta fatura como paga'}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isInvoicePaid ? 'text-slate-300' : 'text-white'}`} />
                      <span>{isInvoicePaid ? 'Desfazer' : 'Marcar como paga'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Painel 2: RESUMO DO RESPONSÁVEL (Moderadamente mais estreito, liberando espaço para o Detalhamento) */}
        <div className="bg-[#111625] border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Resumo por Responsável no Cartão
                </h3>
                <p className="text-xs text-slate-400">
                  Apuração referente a <strong className="text-white">{formatMonthLong(selectedMonthKey)}</strong>
                </p>
              </div>

              {/* Totalizador da Fatura */}
              <span className="text-xs bg-[#0b2922] text-emerald-400 font-bold px-3 py-1.5 rounded-xl border border-emerald-500/30 font-mono flex items-center gap-1.5 self-start sm:self-auto">
                {totalPaidInMonth > 0 && totalPendingInMonth > 0 ? (
                  <>
                    <span>Pendente: {formatCurrency(totalPendingInMonth)}</span>
                    <span className="text-emerald-300/60 font-normal">| Pago: {formatCurrency(totalPaidInMonth)}</span>
                  </>
                ) : isInvoicePaid || (totalMonthExpense > 0 && totalPendingInMonth === 0) ? (
                  <span>Total: {formatCurrency(totalMonthExpense)} (Quitada)</span>
                ) : (
                  <span>Total: {formatCurrency(totalMonthExpense)}</span>
                )}
              </span>
            </div>

            {/* Ações do Resumo: Novo Pagador */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {onAddPerson && (
                <button
                  type="button"
                  onClick={() => {
                    setNewPersonNameInput('');
                    setNewPersonFavoriteCheck(false);
                    setIsAddPersonOpen(true);
                  }}
                  title="Cadastrar novo pagador / responsável"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Novo Pagador</span>
                </button>
              )}
            </div>

            {/* Grid dos Responsáveis Visíveis — Apresentação compacta comportando ~2 por vez, expandindo a altura conforme a quantidade */}
            {visibleCardPersons.length === 0 ? (
              <div className="py-6 px-3 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                Nenhum pagador cadastrado nesta conta.
                {onAddPerson && (
                  <button
                    type="button"
                    onClick={() => setIsAddPersonOpen(true)}
                    className="block mx-auto mt-2 text-teal-400 hover:text-teal-300 font-bold underline cursor-pointer"
                  >
                    + Cadastrar primeiro pagador
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Cabeçalho de duas colunas: Responsável | Valor | Responsável | Valor */}
                <div className="grid grid-cols-2 gap-2 px-1 mb-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/80 pb-1">
                  <div className="flex items-center justify-between pr-1">
                    <span>Responsável</span>
                    <span>Valor</span>
                  </div>
                  <div className="flex items-center justify-between pr-1">
                    <span>Responsável</span>
                    <span>Valor</span>
                  </div>
                </div>

                {/* Lista de responsáveis em duas colunas, compacta e expansível com Contraste Automático nos Valores */}
                <div 
                  className={`grid grid-cols-2 gap-2 overflow-y-auto pr-0.5 transition-all duration-300 ${
                    visibleCardPersons.length <= 4 
                      ? 'max-h-[160px]' 
                      : visibleCardPersons.length <= 8 
                        ? 'max-h-[250px]' 
                        : 'max-h-[380px]'
                  }`}
                >
                  {visibleCardPersons.map((p) => {
                    const stats = getPersonSpentStats(p);
                    const isFullyPaid = isInvoicePaid || (stats.total > 0 && stats.pending === 0);
                    const isFavorite = (favoritePersons || []).some(
                      (f) => f.toLowerCase().trim() === p.toLowerCase().trim()
                    );
                    const displayVal = stats.total === 0 ? 0 : (isFullyPaid ? stats.total : stats.pending);

                    return (
                      <div 
                        key={p} 
                        className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-1.5 group transition-all ${
                          stats.total > 0 
                            ? isFullyPaid 
                              ? 'border-emerald-500/50 shadow-xs'
                              : personValueContrastColor === '#000000'
                                ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-xs'
                                : 'bg-[#151c2e] border-slate-700/80 text-white shadow-xs' 
                            : personValueContrastColor === '#000000'
                              ? 'bg-slate-50 border-slate-200 text-slate-400'
                              : 'bg-[#0d1320] border-slate-800/60 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0 pr-1">
                          <span 
                            style={{ color: personValueContrastColor === '#000000' ? '#0f172a' : '#f1f5f9' }}
                            className="text-xs font-semibold capitalize truncate" 
                            title={p}
                          >
                            {p}
                          </span>
                          {isFavorite && (
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isFullyPaid && stats.total > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Quitado" />
                          )}
                          <span 
                            style={{ color: stats.total === 0 ? undefined : personValueContrastColor }}
                            className={`text-xs font-bold font-mono whitespace-nowrap ${
                              stats.total === 0 ? 'text-slate-500' : ''
                            }`}
                          >
                            {stats.total === 0 ? '-' : formatCurrency(displayVal)}
                          </span>

                          <div className="hidden group-hover:flex items-center gap-0.5 pl-0.5">
                            {onToggleFavoritePerson && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFavoritePerson(p);
                                }}
                                title={isFavorite ? `Desafixar ${p} dos favoritos` : `Fixar ${p} como favorito`}
                                className="text-slate-500 hover:text-amber-400 p-0.5 cursor-pointer"
                              >
                                <Star className={`w-2.5 h-2.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteOrHidePerson(p);
                              }}
                              title={`Excluir ou ocultar ${p}`}
                              className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Linha discreta para pessoas ocultas (se existirem) */}
            {(hiddenPersons && hiddenPersons.length > 0) && (
              <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowHiddenPersons(!showHiddenPersons)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showHiddenPersons ? <EyeOff className="w-3.5 h-3.5 text-teal-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                  <span>
                    {hiddenPersons.length} responsável(is) com histórico antigo oculto(s)
                  </span>
                  <span className="text-teal-400 underline ml-1">
                    {showHiddenPersons ? 'Ocultar detalhes' : 'Ver / Reativar'}
                  </span>
                </button>

                {showHiddenPersons && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {hiddenPersons.map((hp) => (
                      <span 
                        key={hp}
                        className="inline-flex items-center gap-1.5 bg-[#151c2e] border border-slate-700 text-slate-300 px-2 py-0.5 rounded-lg text-[10px]"
                      >
                        <span className="capitalize">{hp}</span>
                        {onUnhidePerson && (
                          <button
                            type="button"
                            onClick={() => onUnhidePerson(hp)}
                            title="Reexibir nos resumos"
                            className="text-teal-400 hover:text-teal-300 font-bold ml-1 cursor-pointer"
                          >
                            Reativar
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 text-[11px] text-slate-500 flex justify-between items-center border-t border-slate-800/60">
            <span>{visibleCardPersons.length} responsáveis ativos</span>
            <span className="text-emerald-400">Atualização em tempo real</span>
          </div>
        </div>
      </div>

          {/* 2. GRÁFICO DE FATURAS — ABAIXO DOS DOIS COMPONENTES SUPERIORES */}
          {/* Largura compacta alinhada com o painel de Informações de Limites */}
          <div className="w-full sm:w-[calc((100%-0.875rem)*0.57)] bg-[#111625] border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs sm:text-sm font-bold text-teal-300 tracking-wide">
                Faturas — Janela de 7 Meses
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                Sincronizado
              </span>
            </div>

            {/* Contêiner com rolagem caso atinja a largura reduzida, preservando dados e legendas */}
            <div className="relative w-full overflow-x-auto overflow-y-hidden pb-1 pt-1 scrollbar-thin">
              <div 
                className={`w-full min-w-[340px] relative select-none transition-all duration-300 flex items-center justify-center ${
                  visibleCardPersons.length <= 4 
                    ? 'h-44 sm:h-50' 
                    : visibleCardPersons.length <= 8 
                      ? 'h-36 sm:h-40' 
                      : 'h-32 sm:h-34 min-h-[130px]'
                }`}
              >
              <svg 
                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                className="w-full h-full overflow-visible"
              >
                <defs>
                  {/* Gradiente da Barra Padrão */}
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity="0.1" />
                  </linearGradient>

                  {/* Gradiente da Barra Selecionada */}
                  <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.25" />
                  </linearGradient>

                  {/* Filtro de Glow para a linha vermelha */}
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#f43f5e" floodOpacity="0.7" />
                  </filter>
                </defs>

                {/* Linhas de Grade Horizontais */}
                {[0.25, 0.5, 0.75, 1].map((level) => {
                  const y = paddingTop + (1 - level) * usableHeight;
                  return (
                    <line
                      key={level}
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                {/* Barras Verticais dos 7 Meses */}
                {points.map((p) => {
                  const barWidth = 32;
                  const barH = chartHeight - paddingBottom - p.y;
                  const isSelected = selectedMonthKey === p.monthKey;

                  return (
                    <g key={p.monthKey} className="cursor-pointer" onClick={() => handleSelectMonth(p.monthKey)}>
                      <rect
                        x={p.x - barWidth / 2}
                        y={p.y}
                        width={barWidth}
                        height={Math.max(barH, 4)}
                        rx={5}
                        fill={isSelected ? 'url(#barGradientActive)' : 'url(#barGradient)'}
                        stroke={isSelected ? '#2dd4bf' : 'none'}
                        strokeWidth={isSelected ? 1.5 : 0}
                        className="transition-all duration-300 hover:opacity-90"
                      />

                      {/* Rótulo de Valor acima do ponto: VALOR COMPLETO BRASILEIRO COM FONTE MAIOR */}
                      {p.total > 0 && (
                        <text
                          x={p.x}
                          y={p.y - 5}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          R$ {formatFullBrazilianNumber(p.total)}
                        </text>
                      )}

                      {/* Nome do Mês abaixo com fonte maior e destaque */}
                      <text
                        x={p.x}
                        y={chartHeight - 6}
                        textAnchor="middle"
                        fill={isSelected ? '#2dd4bf' : '#cbd5e1'}
                        fontSize="11"
                        fontWeight="bold"
                        className="tracking-tight"
                      >
                        {p.pillName}
                      </text>
                    </g>
                  );
                })}

                {/* Linha Vermelha Neon conectando os 7 pontos */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#neonGlow)"
                />

                {/* Círculos nos Vértices */}
                {points.map((p) => {
                  const isSelected = selectedMonthKey === p.monthKey;
                  return (
                    <circle
                      key={`circle-${p.monthKey}`}
                      cx={p.x}
                      cy={p.y}
                      r={isSelected ? 5 : 3.5}
                      fill={isSelected ? '#ffffff' : '#f43f5e'}
                      stroke="#f43f5e"
                      strokeWidth={isSelected ? 2.5 : 1}
                      className="cursor-pointer"
                      onClick={() => handleSelectMonth(p.monthKey)}
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-1 text-center text-[10.5px] text-slate-500">
            Clique nas barras ou pílulas para centralizar a apuração da fatura no mês desejado.
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* COLUNA DIREITA: DETALHAMENTO DE FATURAS AMPLIADO         */}
      {/* Inicia no topo da tela e ocupa toda a coluna direita     */}
      {/* ======================================================== */}
      <div className="lg:col-span-6 bg-[#111625] border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col justify-between space-y-3">
          <div className="space-y-3 flex-1 flex flex-col">
            {/* Faixa Horizontal com 7 MESES — Clicar centraliza na 4ª posição */}
            <div className="flex items-center gap-1.5 pb-2.5 border-b border-slate-800/80">
              {/* Botão Janela Anterior */}
              <button
                type="button"
                onClick={handlePrevWindow}
                disabled={!canPrevWindow}
                className={`p-1 rounded text-slate-400 transition-colors shrink-0 ${
                  canPrevWindow
                    ? 'hover:text-white hover:bg-slate-800 cursor-pointer'
                    : 'opacity-25 cursor-not-allowed hover:text-slate-400 hover:bg-transparent'
                }`}
                title={canPrevWindow ? "Avançar janela para o mês anterior" : "Início da janela móvel de 36 meses atingido"}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* 7 Pílulas de Meses Sincronizadas */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar flex-1">
                {visible7Months.map((mKey) => {
                  const isSelected = selectedMonthKey === mKey;
                  const pillLabel = formatMonthPill(mKey);

                  return (
                    <div key={mKey} className="flex flex-col items-center flex-1 min-w-[44px]">
                      <button
                        type="button"
                        onClick={() => handleSelectMonth(mKey)}
                        className={`w-full text-center px-1 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#10b981] text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'bg-[#162032] text-slate-300 hover:bg-[#1c2a42]'
                        }`}
                      >
                        {pillLabel}
                      </button>
                      {/* Indicador de Seleção embaixo do Pill */}
                      {isSelected && (
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#10b981] mt-0.5"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Botão Janela Próxima */}
              <button
                type="button"
                onClick={handleNextWindow}
                disabled={!canNextWindow}
                className={`p-1 rounded text-slate-400 transition-colors shrink-0 ${
                  canNextWindow
                    ? 'hover:text-white hover:bg-slate-800 cursor-pointer'
                    : 'opacity-25 cursor-not-allowed hover:text-slate-400 hover:bg-transparent'
                }`}
                title={canNextWindow ? "Avançar janela para o próximo mês" : "Final da janela móvel de 36 meses atingido"}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Cabeçalho da Fatura do Mês Selecionado com Ações e Totalizador */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase text-white tracking-wider">
                  {formatMonthLong(selectedMonthKey)}
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                  {monthTxs.length} lançamentos
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* 1. Novo Lançamento neste Cartão */}
                <button
                  type="button"
                  onClick={() => onOpenLancamento(currentCard.name)}
                  className="flex items-center gap-1.5 bg-[#10b981] hover:bg-[#059669] text-slate-950 font-bold px-2.5 py-1 rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  title="Novo lançamento neste cartão"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Novo Lançamento</span>
                </button>

                {/* 2. Apagar lançamento selecionado */}
                <button
                  type="button"
                  onClick={handleTriggerDeleteFuture}
                  title={selectedTx ? `Apagar "${selectedTx.tx.descricao}" e parcelas futuras` : 'Selecione uma compra na fatura abaixo para apagar'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer border ${
                    selectedTx
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/50 shadow-red-500/10'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700/80'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Apagar Lançamento</span>
                </button>

                {/* 3. Marcar fatura inteira como paga */}
                {onTogglePaidInvoice && (
                  <button
                    type="button"
                    onClick={() => onTogglePaidInvoice(currentCard.id, selectedMonthKey)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-sm ${
                      isInvoicePaid
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-950/40 active:scale-95'
                    }`}
                    title={isInvoicePaid ? 'Clique para desmarcar quitação da fatura' : 'Marcar esta fatura como paga'}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isInvoicePaid ? 'text-emerald-400' : 'text-white'}`} />
                    <span>{isInvoicePaid ? 'Fatura Paga' : 'Marcar como paga'}</span>
                  </button>
                )}

                <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                  {formatCurrency(totalMonthExpense)}
                </span>
              </div>
            </div>

            {/* Lista de Transações da Fatura — Organizada em Colunas Fixas Sem Barra de Rolagem Horizontal */}
            <div className="flex-1 max-h-[460px] lg:max-h-[500px] min-h-[260px] overflow-y-auto overflow-x-hidden pr-0.5">
              {monthTxs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Nenhum lançamento registrado para {formatMonthLong(selectedMonthKey)}.
                </div>
              ) : (
                <table className="w-full table-auto border-collapse text-left">
                  <thead className="sticky top-0 bg-[#0d1627] z-10 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-2 whitespace-nowrap text-left w-[88px] sm:w-[94px]">Data</th>
                      <th className="py-2.5 px-2 text-center min-w-[95px]">Descrição</th>
                      <th className="py-2.5 px-1.5 text-center whitespace-nowrap w-[60px] sm:w-[68px]">Parcelas</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap w-[86px] sm:w-[94px]">Valor</th>
                      <th className="py-2.5 px-2 text-left whitespace-nowrap w-[94px] sm:w-[105px]">Responsável</th>
                      <th className="py-2.5 px-1 text-center whitespace-nowrap w-[52px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {monthTxs.map((tx, idx) => {
                      const isSelected = selectedTx?.tx.id === tx.id;

                      return (
                        <tr
                          key={`${tx.id}-${idx}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTx(null);
                            } else {
                              setSelectedTx({ monthKey: selectedMonthKey, tx });
                            }
                          }}
                          className={`group transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/15 text-white font-medium shadow-xs'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          {/* 1. Data da Compra com Ação de Pago */}
                          <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                            <div className="flex items-center gap-1.5">
                              {onTogglePaidTransaction && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePaidTransaction(currentCard.id, selectedMonthKey, tx.id);
                                  }}
                                  title={tx.pago ? 'Marcar lançamento como em aberto' : 'Marcar este lançamento como pago'}
                                  className={`p-0.5 rounded-md transition-all cursor-pointer shrink-0 ${
                                    tx.pago
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                                      : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-800'
                                  }`}
                                >
                                  <CheckCircle2 className={`w-3.5 h-3.5 ${tx.pago ? 'text-emerald-400' : 'text-slate-400'}`} />
                                </button>
                              )}
                              <span className="text-xs sm:text-[13.5px] font-bold font-mono text-teal-300">
                                {tx.data || '-'}
                              </span>
                            </div>
                          </td>

                          {/* 2. Descrição Centralizada dentro de sua própria coluna */}
                          <td className="py-2.5 px-2 text-center align-middle">
                            <div className="flex items-center justify-center gap-1.5 max-w-[170px] sm:max-w-xs mx-auto">
                              <span 
                                className={`text-xs sm:text-[13.5px] font-semibold truncate ${tx.pago ? 'line-through text-slate-400' : 'text-white'}`}
                                title={tx.descricao}
                              >
                                {tx.descricao}
                              </span>
                              {tx.pago && (
                                <span className="text-[9.5px] bg-emerald-950/90 text-emerald-300 font-bold px-1 py-0.2 rounded border border-emerald-500/40 shrink-0">
                                  Pago
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 3. Quantidade de Parcelas em coluna separada com alinhamento vertical */}
                          <td className="py-2.5 px-1.5 text-center whitespace-nowrap align-middle">
                            {tx.parcelas ? (
                              <span className={`inline-block font-mono font-bold text-[11px] sm:text-xs px-1.5 py-0.5 rounded ${
                                tx.parcelas === 'Fixa'
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  : 'bg-slate-800 text-slate-200 border border-slate-700/60'
                              }`}>
                                {tx.parcelas}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>

                          {/* 4. Valor em coluna própria, alinhado à direita com destaque */}
                          <td className="py-2.5 px-2 text-right pr-2 whitespace-nowrap align-middle font-mono font-extrabold text-xs sm:text-sm">
                            <span className={tx.pago ? 'text-emerald-400' : 'text-white'}>
                              {formatCurrency(tx.valor)}
                            </span>
                          </td>

                          {/* 5. Nome do Responsável em coluna separada depois do valor */}
                          <td className="py-2.5 px-2 text-left whitespace-nowrap align-middle">
                            <span 
                              title={tx.pagador || 'Não informado'}
                              className="inline-block text-[11px] sm:text-xs font-semibold text-amber-400 capitalize px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 max-w-[90px] sm:max-w-[105px] truncate"
                            >
                              {tx.pagador || 'Não informado'}
                            </span>
                          </td>

                          {/* 6. Botões de Editar e Excluir — Totalmente visíveis à direita sem necessidade de barra de rolagem */}
                          <td className="py-2.5 px-1 text-center whitespace-nowrap align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTxToEditSingle({ monthKey: selectedMonthKey, tx });
                                }}
                                title="Editar ocorrência deste mês"
                                className="text-slate-400 hover:text-sky-400 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTxToDeleteSingle({ monthKey: selectedMonthKey, tx });
                                }}
                                title="Apagar lançamento somente deste mês"
                                className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Rodapé da Fatura */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={() => onClearMonth(currentCard.id, selectedMonthKey)}
              className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer text-[11px]"
            >
              Limpar este mês
            </button>
            <button
              type="button"
              onClick={() => onOpenLancamento(currentCard.name)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-[3]" /> Adicionar lançamento
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Editar Cartão */}
      <ModalEditarCartao
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        card={currentCard}
        onSave={handleSaveEdit}
      />

      {/* Modal para Cadastrar / Editar Parcela Fixa */}
      <ModalParcelaFixa
        isOpen={isFixedModalOpen}
        onClose={() => {
          setIsFixedModalOpen(false);
          setEditingFixedExpense(null);
        }}
        cards={cards}
        defaultCardId={currentCard.id}
        persons={persons}
        editingExpense={editingFixedExpense}
        onSaveExpense={(exp) => {
          onSaveFixedExpense(exp);
          showToast(
            editingFixedExpense
              ? 'Parcela fixa atualizada com sucesso!'
              : 'Parcela fixa adicionada com sucesso!',
            'success'
          );
        }}
      />

      {/* Confirmação de Exclusão de Parcela Fixa */}
      <ModalConfirmacao
        isOpen={!!fixedToDelete}
        title="Excluir parcela fixa?"
        message={fixedToDelete ? `Deseja realmente excluir a parcela fixa "${fixedToDelete.descricao}" no valor de ${formatCurrency(fixedToDelete.valor)}? Ela será removida também da fatura do mês atual e das projeções do simulador.` : ''}
        confirmLabel="Excluir Parcela Fixa"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (fixedToDelete) {
            onDeleteFixedExpense(fixedToDelete.id);
            showToast(`Parcela fixa "${fixedToDelete.descricao}" excluída com sucesso.`, 'success');
            setFixedToDelete(null);
          }
        }}
        onClose={() => setFixedToDelete(null)}
      />

      {/* Modal de Confirmação para Ação "Apagar lançamento" (Compra e parcelas futuras - Tópico 2.1) */}
      <ModalConfirmacao
        isOpen={isDeleteFutureModalOpen}
        title="Apagar compra e parcelas futuras?"
        message={selectedTx ? `Deseja realmente apagar a compra "${selectedTx.tx.descricao}"? Esta ação removerá a ocorrência selecionada de ${formatMonthLong(selectedTx.monthKey)} e todas as parcelas vinculadas deste cartão no mês atual e nos meses futuros.` : ''}
        confirmLabel="Apagar Compra e Futuras"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDeleteFuture}
        onClose={() => setIsDeleteFutureModalOpen(false)}
      />

      {/* Modal de Confirmação para Lixeira Individual da Fatura (Apenas este mês - Tópico 2.3) */}
      <ModalConfirmacao
        isOpen={!!txToDeleteSingle}
        title="Apagar lançamento deste mês?"
        message={txToDeleteSingle ? `Deseja realmente apagar o lançamento "${txToDeleteSingle.tx.descricao}" no valor de ${formatCurrency(txToDeleteSingle.tx.valor)} da fatura de ${formatMonthLong(txToDeleteSingle.monthKey)}? Somente a ocorrência deste mês será excluída.` : ''}
        confirmLabel="Apagar Este Mês"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDeleteSingle}
        onClose={() => setTxToDeleteSingle(null)}
      />

      {/* Modal de Edição Pontual da Ocorrência deste Mês */}
      <ModalEditarOcorrencia
        isOpen={!!txToEditSingle}
        onClose={() => setTxToEditSingle(null)}
        cardName={currentCard.name}
        monthLabel={formatMonthLong(selectedMonthKey)}
        transaction={txToEditSingle?.tx || null}
        persons={visibleCardPersons}
        onSaveOccurrence={(updatedTx) => {
          if (txToEditSingle && onEditOccurrence) {
            onEditOccurrence(currentCard.id, txToEditSingle.monthKey, updatedTx);
            if (updatedTx.scope !== 'only_this') {
              showToast(`Lançamento "${updatedTx.descricao}" e todas as ocorrências atualizadas com sucesso!`, 'success');
            } else {
              showToast(`Lançamento "${updatedTx.descricao}" atualizado com sucesso nesta fatura.`, 'success');
            }
          }
        }}
      />

      {/* Modal de Cadastro Rápido de Novo Pagador / Responsável */}
      {isAddPersonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Cadastrar Novo Pagador</h3>
                  <p className="text-[11px] text-slate-400">Vincule um novo pagador exclusivo da sua conta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddPersonOpen(false);
                  setNewPersonNameInput('');
                  setNewPersonFavoriteCheck(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const clean = newPersonNameInput.trim();
                if (!clean) return;
                onAddPerson?.(clean, newPersonFavoriteCheck);
                showToast(`Pagador "${clean}" cadastrado com sucesso!`, 'success');
                setIsAddPersonOpen(false);
                setNewPersonNameInput('');
                setNewPersonFavoriteCheck(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome do Pagador / Responsável:
                </label>
                <input
                  type="text"
                  value={newPersonNameInput}
                  onChange={(e) => setNewPersonNameInput(e.target.value)}
                  placeholder="Ex: João, Lucas, Trabalho..."
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                <input
                  type="checkbox"
                  checked={newPersonFavoriteCheck}
                  onChange={(e) => setNewPersonFavoriteCheck(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Fixar este pagador como favorito</span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddPersonOpen(false);
                    setNewPersonNameInput('');
                  }}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newPersonNameInput.trim()}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Salvar Pagador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE GESTÃO DO CARTÃO (ARQUIVAR / EXCLUIR) */}
      {cardActionModal && (
        <ModalConfirmacao
          isOpen={Boolean(cardActionModal)}
          title={
            cardActionModal.type === 'archive'
              ? `Arquivar Cartão "${currentCard.name}"?`
              : cardActionModal.type === 'cannot_delete'
              ? `Não é Seguro Excluir — Dados Vinculados`
              : `Excluir Cartão "${currentCard.name}"?`
          }
          message={
            cardActionModal.type === 'archive'
              ? `Ao arquivar o cartão "${currentCard.name}", todas as ${cardActionModal.txCount || 0} compras, parcelas, faturas e registros contábeis serão 100% preservados com segurança. O cartão sairá das listas ativas para novos lançamentos e poderá ser consultado ou reativado no Painel de Limites.`
              : cardActionModal.type === 'cannot_delete'
              ? `Atenção: O cartão "${currentCard.name}" possui ${cardActionModal.txCount} lançamentos vinculados no seu histórico financeiro. Para evitar perda contábil e faturas órfãs, este cartão não pode ser excluído diretamente. Deseja arquivá-lo com segurança para preservar todo o histórico?`
              : `Deseja realmente excluir definitivamente o cartão "${currentCard.name}"? Este cartão não possui histórico ou lançamentos registrados.`
          }
          confirmLabel={
            cardActionModal.type === 'archive'
              ? 'Arquivar Cartão com Segurança'
              : cardActionModal.type === 'cannot_delete'
              ? 'Arquivar Cartão com Segurança'
              : 'Excluir Definitivamente'
          }
          cancelLabel="Cancelar"
          isDestructive={cardActionModal.type === 'delete'}
          onConfirm={() => {
            const cId = currentCard.id;
            if (cardActionModal.type === 'archive' || cardActionModal.type === 'cannot_delete') {
              onArchiveCard?.(cId);
              showToast(`Cartão "${currentCard.name}" arquivado com sucesso.`, 'info');
            } else if (cardActionModal.type === 'delete') {
              onDeleteCard?.(cId);
              showToast(`Cartão "${currentCard.name}" excluído definitivamente.`, 'info');
            }
            setCardActionModal(null);
          }}
          onClose={() => setCardActionModal(null)}
        />
      )}
    </div>
  );
};
