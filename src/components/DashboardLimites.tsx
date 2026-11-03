import React, { useState, useEffect, useMemo } from 'react';
import { CardData, ThemeConfig } from '../types';
import { formatCurrency, MESES_NOMES } from '../utils/storage';
import {
  getDueStatus,
  getCardTransactions,
  toMonthKey,
  parseMonthKey,
  CURRENT_REAL_MONTH,
  getRolling36Window,
  isMonthInRollingWindow,
} from '../utils/timeline';
import {
  getCardColor,
  cleanCardName,
  extractDueDayNumber,
  getResolvedAccentColor,
  getContrastTextColor,
  isDarkAccent,
  THEME_BG_PRESETS,
  THEME_ACCENT_PRESETS,
  THEME_PANEL_PRESETS,
  THEME_TEXT_PRESETS,
  COMPLETE_THEME_PRESETS,
  TEXT_COLOR_PRESETS,
  extractCardFinalDigits,
  getResolvedBgColor,
  getResolvedPanelColor,
  getResolvedTextColor,
  getResolvedMutedTextColor,
  getResolvedBorderColor,
  isLightColor,
} from '../utils/cardColors';
import {
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlusCircle,
  Palette,
  RotateCcw,
  Type,
  X,
  Trash2,
  Archive,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Layers
} from 'lucide-react';
import { ModalConfirmacao } from './ModalConfirmacao';
import { EditableTitle } from './EditableTitle';
import { ModalPesquisaRapida } from './ModalPesquisaRapida';

interface DashboardLimitesProps {
  cards: CardData[];
  persons: string[];
  paidInvoices?: Record<string, boolean>;
  onSelectCard: (cardId: string) => void;
  onOpenAddCard?: () => void;
  onOpenLancamento?: () => void;
  onRemoveCard?: (cardId: string) => void;
  onArchiveCard?: (cardId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  onReactivateCard?: (cardId: string) => void;
  themeConfig?: ThemeConfig;
  onUpdateThemeConfig?: (theme: ThemeConfig) => void;
  onUpdateCardTextColor?: (cardId: string, textColor: string) => void;
  customTitles?: Record<string, string>;
  onSaveCustomTitle?: (key: string, newTitle: string) => void;
}

export const DashboardLimites: React.FC<DashboardLimitesProps> = ({
  cards,
  paidInvoices = {},
  onSelectCard,
  onOpenAddCard,
  onOpenLancamento,
  onRemoveCard,
  onArchiveCard,
  onDeleteCard,
  onReactivateCard,
  themeConfig,
  onUpdateThemeConfig,
  onUpdateCardTextColor,
  customTitles,
  onSaveCustomTitle,
}) => {
  // Mês inicial baseado na data atual do computador
  const [selectedMonth, setSelectedMonth] = useState<number>(
    () => Number(CURRENT_REAL_MONTH.split('-')[1])
  );

  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState<boolean>(false);
  const [activeTextColorPickerCardId, setActiveTextColorPickerCardId] = useState<string | null>(null);
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);
  const [cardActionModal, setCardActionModal] = useState<{
    type: 'archive' | 'delete' | 'cannot_delete';
    card: CardData;
    txCount?: number;
  } | null>(null);
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Ano atual baseado na referência dinâmica do sistema
  const currentYear = Number(CURRENT_REAL_MONTH.split('-')[0]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const rolling36 = useMemo(() => getRolling36Window(), []);
  const { startMonthKey, endMonthKey } = rolling36;

  const availableYears = useMemo(() => {
    const startYear = parseMonthKey(startMonthKey).year;
    const endYear = parseMonthKey(endMonthKey).year;
    const list: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      list.push(y);
    }
    return list;
  }, [startMonthKey, endMonthKey]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const mKey = toMonthKey(year, selectedMonth);
    if (!isMonthInRollingWindow(mKey)) {
      for (let m = 1; m <= 12; m++) {
        if (isMonthInRollingWindow(toMonthKey(year, m))) {
          setSelectedMonth(m);
          break;
        }
      }
    }
  };

  // Auto-fechar menus e seletores de cor ao clicar fora
  useEffect(() => {
    if (!activeCardMenuId && !activeTextColorPickerCardId) return;

    const handleWindowClick = () => {
      setActiveCardMenuId(null);
      setActiveTextColorPickerCardId(null);
    };

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [activeCardMenuId, activeTextColorPickerCardId]);

  const resolvedBg = getResolvedBgColor(themeConfig);
  const resolvedPanel = getResolvedPanelColor(themeConfig);
  const resolvedAccent = getResolvedAccentColor(themeConfig);
  const resolvedText = getResolvedTextColor(themeConfig);
  const resolvedMutedText = getResolvedMutedTextColor(resolvedText, resolvedPanel);
  const accentTextColor = getContrastTextColor(resolvedAccent);
  const isAccentDark = isDarkAccent(resolvedAccent);
  const accentTitleBadgeColor = isAccentDark ? '#ffffff' : resolvedAccent;

  const activeCards = cards.filter((c) => !c.archived);
  const archivedCards = cards.filter((c) => c.archived);

  const sortedCards = [...activeCards].sort((a, b) => {
    const dayA = extractDueDayNumber(a.dueDay);
    const dayB = extractDueDayNumber(b.dueDay);

    if (dayA !== dayB) return dayA - dayB;

    return a.name.localeCompare(b.name);
  });

  // Total da fatura do cartão no mês selecionado
  const getCardMonthTotal = (card: CardData, month: number): number => {
    const mKey = toMonthKey(selectedYear, month);
    const txs = getCardTransactions(card, mKey);

    return txs.reduce((acc, t) => acc + (t.valor || 0), 0);
  };

  // Total em aberto da fatura do cartão no mês selecionado
  const getCardMonthOpenTotal = (card: CardData, month: number): number => {
    const mKey = toMonthKey(selectedYear, month);
    const txs = getCardTransactions(card, mKey);

    return txs
      .filter((t) => !t.pago)
      .reduce((acc, t) => acc + (t.valor || 0), 0);
  };

  const getCardTotalTransactionsCount = (card: CardData): number => {
    const seen = new Set<string>();
    Object.values(card.months || {}).forEach((txs) => {
      if (Array.isArray(txs)) {
        txs.forEach((t) => seen.add(t.id));
      }
    });
    return seen.size;
  };

  // Chave da fatura usando o ano selecionado, sem ano fixo
  const monthKey = toMonthKey(selectedYear, selectedMonth);

  const currentBgPreset = themeConfig?.bgPreset || 'deep-navy';
  const currentAccentPreset = themeConfig?.accentPreset || 'sky';

  return (
    <div className="w-full space-y-4 text-slate-100 font-sans">
      {/* BARRA DE CONTROLE SUPERIOR */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 shadow-xl transition-all"
        style={{ borderTop: `3px solid ${resolvedAccent}` }}
      >
        <div>
          <div className="flex items-center gap-2">
            <EditableTitle
              titleKey="painel_limites"
              defaultTitle="Painel de Limites"
              customTitles={customTitles}
              onSaveTitle={onSaveCustomTitle || (() => {})}
              className="text-base sm:text-lg font-bold text-white tracking-tight"
              tag="h1"
            />
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full border transition-colors"
              style={{
                backgroundColor: `${resolvedAccent}20`,
                borderColor: `${resolvedAccent}60`,
                color: accentTitleBadgeColor,
              }}
            >
              {activeCards.length} Cartões Ativos
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Acompanhamento central de limites individuais, saldos e vencimentos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1.5 rounded-xl">
            <span className="text-xs text-slate-300 font-medium">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {MESES_NOMES.map((m, idx) => {
                const mKey = toMonthKey(selectedYear, idx + 1);
                const isAllowed = isMonthInRollingWindow(mKey);
                return (
                  <option key={m} value={idx + 1} disabled={!isAllowed}>
                    {m} {!isAllowed ? '(Fora da janela)' : ''}
                  </option>
                );
              })}
            </select>
            <span className="text-xs text-slate-300 font-medium ml-1">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Botão de Pesquisa Rápida (Atalho Compacto) */}
          <button
            type="button"
            onClick={() => setIsQuickSearchOpen(true)}
            title="Pesquisa rápida de itens e parcelas (Janela de 36 meses)"
            className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-teal-400 hover:text-teal-300 border border-teal-500/30 hover:border-teal-400/50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Pesquisar</span>
          </button>

          {/* Botão Adicionar Cartão */}
          {onOpenAddCard && (
            <button
              onClick={onOpenAddCard}
              style={{
                backgroundColor: resolvedAccent,
                color: accentTextColor,
                boxShadow: `0 4px 12px ${resolvedAccent}30`,
              }}
              className="flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-md"
            >
              <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Adicionar Cartão</span>
            </button>
          )}

          {/* Botão Parcelas */}
          {onOpenLancamento && (
            <button
              onClick={onOpenLancamento}
              className="flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
              title="Lançar nova compra, parcelas ou despesa fixa"
            >
              <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Parcelas</span>
            </button>
          )}

          <button
            onClick={() => setIsThemeModalOpen(true)}
            title="Personalizar cores livres e tema de destaque do aplicativo"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" style={{ color: resolvedAccent }} />
            <span className="hidden sm:inline">Tema &amp; Destaque</span>
          </button>
        </div>
      </div>

      {/* GRADE DE CARTÕES */}
      <div
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl transition-all"
        style={{ borderTop: `2px solid ${resolvedAccent}40` }}
      >
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">
              Cartões, Vencimentos e Limites
            </h2>
            <p className="text-[11px] text-slate-400">
              Clique em qualquer balão para abrir os lançamentos ou gerenciar o cartão
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {sortedCards.length} cartões
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
          {sortedCards.length === 0 ? (
            <div className="col-span-full py-12 px-4 text-center border border-dashed border-slate-700/80 rounded-2xl bg-slate-800/20">
              <PlusCircle className="w-10 h-10 mx-auto mb-2.5 text-slate-500" />
              <h3 className="text-sm font-bold text-white mb-1">Nenhum cartão cadastrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                O painel de limites está 100% zerado. Cadastre o seu primeiro cartão para acompanhar limites contratados e disponíveis.
              </p>
              {onOpenAddCard && (
                <button
                  type="button"
                  onClick={onOpenAddCard}
                  style={{ backgroundColor: resolvedAccent, color: accentTextColor }}
                  className="inline-flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Cadastrar Primeiro Cartão</span>
                </button>
              )}
            </div>
          ) : (
            sortedCards.map((card) => {
              const faturaTotal = getCardMonthTotal(card, selectedMonth);
              const isPaid = Boolean(paidInvoices[`${card.id}_${monthKey}`]);
              const faturaAberta = isPaid ? 0 : getCardMonthOpenTotal(card, selectedMonth);
              const isZero = faturaAberta === 0;
              const dueStatus = getDueStatus(card.dueDay, monthKey);
              const cardColor = getCardColor(card);
              const cardTextColor = card.textColor || '#ffffff';
              const isColorPickerOpen = activeTextColorPickerCardId === card.id;

              const usedAmount = Math.max(0, card.limite - card.disponivel);
              const usedPct = card.limite > 0
                ? Math.min(100, Math.max(0, (usedAmount / card.limite) * 100))
                : 0;

              const dueDayNumber = extractDueDayNumber(card.dueDay);
              const dueDayText = dueDayNumber > 0
                ? String(dueDayNumber).padStart(2, '0')
                : '';

              return (
                <div
                  key={card.id}
                  onClick={() => onSelectCard(card.id)}
                  className="w-full rounded-xl p-3.5 transition-all cursor-pointer group shadow-md flex flex-col justify-between relative overflow-visible border border-white/10 hover:shadow-xl hover:scale-[1.01]"
                  style={{
                    backgroundColor: cardColor,
                    color: cardTextColor,
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-white/80 shadow-sm" />
                          <h3
                            className="text-xs sm:text-sm font-bold tracking-tight truncate drop-shadow-sm"
                            style={{ color: cardTextColor }}
                            title={card.name}
                          >
                            {cleanCardName(card.name)}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1 mt-1 pl-3.5">
                          <span
                            className="text-xs sm:text-[13px] font-semibold flex items-center gap-1.5"
                            style={{ color: cardTextColor, opacity: 0.95 }}
                          >
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {dueDayText
                              ? `Vencimento: dia ${dueDayText}`
                              : 'Vencimento não informado'}
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveTextColorPickerCardId(isColorPickerOpen ? null : card.id)}
                            title="Escolher cor dos textos deste balão"
                            className="w-4.5 h-4.5 rounded-full border border-white/40 shadow-sm flex items-center justify-center transition-transform hover:scale-110 cursor-pointer bg-black/25"
                          >
                            <span
                              className="w-2 h-2 rounded-full shadow-inner"
                              style={{ backgroundColor: cardTextColor }}
                            />
                          </button>

                          {isColorPickerOpen && (
                            <div className="absolute right-0 top-6 z-50 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl space-y-2.5 w-52 text-slate-100 animate-in fade-in">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                  <Type className="w-3 h-3 text-sky-400" />
                                  Cor do Texto
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTextColorPickerCardId(null)}
                                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] text-slate-400 block font-semibold">Tons Rápidos:</span>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {TEXT_COLOR_PRESETS.map((tc) => (
                                    <button
                                      key={tc.color}
                                      type="button"
                                      onClick={() => {
                                        onUpdateCardTextColor?.(card.id, tc.color);
                                        setActiveTextColorPickerCardId(null);
                                      }}
                                      title={tc.name}
                                      className="w-6 h-6 rounded-lg border border-white/20 hover:scale-115 transition-transform flex items-center justify-center cursor-pointer shadow-sm"
                                      style={{ backgroundColor: tc.color }}
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2">
                                <span className="text-[10px] text-slate-400 font-medium">Cor livre:</span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="color"
                                    value={cardTextColor.startsWith('#') ? cardTextColor : '#ffffff'}
                                    onChange={(e) => onUpdateCardTextColor?.(card.id, e.target.value)}
                                    className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    value={cardTextColor}
                                    onChange={(e) => onUpdateCardTextColor?.(card.id, e.target.value)}
                                    className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-center text-white"
                                    placeholder="#fff"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {(onArchiveCard || onDeleteCard || onRemoveCard) && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCardMenuId(activeCardMenuId === card.id ? null : card.id);
                                setActiveTextColorPickerCardId(null);
                              }}
                              title="Gerenciar cartão (arquivar ou excluir)"
                              className="w-5 h-5 rounded-full border border-white/30 hover:border-white/60 bg-black/30 hover:bg-black/55 flex items-center justify-center transition-all cursor-pointer opacity-85 hover:opacity-100"
                            >
                              <MoreVertical className="w-3 h-3" style={{ color: cardTextColor }} />
                            </button>

                            {activeCardMenuId === card.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-6.5 z-50 p-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl space-y-1 w-44 text-slate-100 animate-in fade-in"
                              >
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                                  Gerenciar Cartão
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCardMenuId(null);
                                    setCardActionModal({
                                      type: 'archive',
                                      card,
                                      txCount: getCardTotalTransactionsCount(card),
                                    });
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-amber-300 hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
                                >
                                  <Archive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Arquivar cartão</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCardMenuId(null);
                                    const txCount = getCardTotalTransactionsCount(card);
                                    if (txCount > 0) {
                                      setCardActionModal({
                                        type: 'cannot_delete',
                                        card,
                                        txCount,
                                      });
                                    } else {
                                      setCardActionModal({
                                        type: 'delete',
                                        card,
                                        txCount: 0,
                                      });
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                  <span>Excluir cartão</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* INFORMAÇÃO DA FATURA */}
                    <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center justify-between gap-2">
                      <div>
                        <span
                          className="text-sm sm:text-[14px] block font-normal tracking-tight drop-shadow-sm"
                          style={{ color: cardTextColor, opacity: 0.95 }}
                        >
                          Fatura de {MESES_NOMES[selectedMonth - 1]} {isPaid ? '(Quitada)' : ''}
                        </span>
                        <span
                          className="font-mono font-bold text-lg sm:text-xl leading-tight drop-shadow-sm block mt-0.5"
                          style={{ color: cardTextColor }}
                        >
                          {formatCurrency(faturaAberta)}
                        </span>
                        {isPaid && faturaTotal > 0 && (
                          <span className="text-[11px] font-mono font-semibold opacity-90 block mt-0.5" style={{ color: cardTextColor }}>
                            Paga: {formatCurrency(faturaTotal)}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-green-600 text-white border border-green-500 backdrop-blur-sm shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                            <span>Paga</span>
                          </span>
                        ) : isZero ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-semibold bg-black/40 border border-white/30 backdrop-blur-sm">
                            Sem gastos
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold border backdrop-blur-sm shadow-xs ${
                              /atrasad|atraso|vencid/i.test(dueStatus.label)
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-cyan-600 text-white border-cyan-500'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{dueStatus.label}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* LIMITES INDIVIDUAIS */}
                    <div className="mt-2 pt-1.5 border-t border-white/20 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-normal text-xs sm:text-sm" style={{ color: cardTextColor, opacity: 0.9 }}>
                          Disponível:
                        </span>
                        <span
                          className="font-bold font-mono text-sm sm:text-base drop-shadow-sm"
                          style={{ color: cardTextColor }}
                        >
                          {formatCurrency(card.disponivel)}
                        </span>
                      </div>

                      {card.limite > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-medium" style={{ color: cardTextColor, opacity: 0.8 }}>
                            Limite Total:
                          </span>
                          <span
                            className="font-bold font-mono"
                            style={{ color: cardTextColor, opacity: 0.95 }}
                          >
                            {formatCurrency(card.limite)}
                          </span>
                        </div>
                      )}

                      {card.exibirIdentificacao !== false && extractCardFinalDigits(card.isFisico || card.isVirtual) ? (
                        <div className="flex justify-between items-center text-[11px] pt-0.5">
                          <span className="font-medium" style={{ color: cardTextColor, opacity: 0.8 }}>
                            Identificação:
                          </span>
                          <span
                            className="font-mono text-[10px] font-bold tracking-wider px-1.5 py-0.2 rounded bg-black/25 border border-white/20 shadow-xs"
                            style={{ color: cardTextColor }}
                          >
                            •••• {extractCardFinalDigits(card.isFisico || card.isVirtual)}
                          </span>
                        </div>
                      ) : null}

                      {card.limite > 0 && (
                        <div className="w-full bg-black/25 rounded-full h-1 overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${usedPct}%`,
                              backgroundColor: cardTextColor,
                              opacity: 0.8
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="mt-1.5 pt-1 flex items-center justify-between text-[9.5px] font-medium transition-opacity"
                    style={{ color: cardTextColor, opacity: 0.85 }}
                  >
                    <span>Ver fatura</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CARTÕES ARQUIVADOS */}
      {archivedCards.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-md transition-all">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-400" />
              <span>Cartões Desativados / Arquivados ({archivedCards.length})</span>
              <span className="text-[10px] text-slate-500 font-normal">
                (Histórico e faturas preservados com segurança)
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-sky-400">
              <span>{showArchived ? 'Recolher' : 'Visualizar ou Reativar'}</span>
              {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showArchived && (
            <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in">
              {archivedCards.map((card) => {
                const txCount = getCardTotalTransactionsCount(card);

                return (
                  <div
                    key={card.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-200 block truncate">
                        {cleanCardName(card.name)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {txCount} lançamentos preservados
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectCard(card.id)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold cursor-pointer"
                      >
                        Ver Faturas
                      </button>

                      {onReactivateCard && (
                        <button
                          type="button"
                          onClick={() => onReactivateCard(card.id)}
                          className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE PERSONALIZAÇÃO DE TEMA E CORES */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 text-xs space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${resolvedAccent}20`, color: resolvedAccent }}
                >
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Personalizar Cores &amp; Tema</h3>
                  <p className="text-slate-400">
                    Escolha livremente a cor de fundo e o tom de destaque geral
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsThemeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. TEMAS COMPLETOS */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-300 block text-xs">
                Temas Prontos Coordenados:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COMPLETE_THEME_PRESETS.map((p) => {
                  const isActive =
                    resolvedBg.toLowerCase() === p.bg.toLowerCase() &&
                    resolvedPanel.toLowerCase() === p.panel.toLowerCase() &&
                    resolvedAccent.toLowerCase() === p.accent.toLowerCase() &&
                    resolvedText.toLowerCase() === p.text.toLowerCase();

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onUpdateThemeConfig?.({
                          ...themeConfig,
                          themePreset: p.id,
                          bgPreset: p.id,
                          customBg: p.bg,
                          customPanelColor: p.panel,
                          customAccent: p.accent,
                          customTextColor: p.text,
                        });
                      }}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive ? 'ring-2 border-white' : 'border-slate-800 hover:border-slate-700'
                      }`}
                      style={{ backgroundColor: p.panel }}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: p.bg }} />
                        <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: p.panel }} />
                        <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: p.accent }} />
                        <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: p.text }} />
                      </div>
                      <div className="text-[11px] font-bold truncate" style={{ color: p.text }}>{p.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. COR DO FUNDO GERAL */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300 block text-xs">
                  1. Fundo Geral:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={resolvedBg}
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customBg: e.target.value,
                      });
                    }}
                    className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeConfig?.customBg || resolvedBg}
                    placeholder="#071326"
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customBg: e.target.value,
                      });
                    }}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-sky-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {THEME_BG_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        bgPreset: preset.id,
                        customBg: preset.color,
                      });
                    }}
                    className={`p-1.5 rounded-lg border text-left text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      resolvedBg.toLowerCase() === preset.color.toLowerCase()
                        ? 'border-sky-400 text-white'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    style={{ backgroundColor: preset.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.tagColor }} />
                    <span className="truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. COR DE DESTAQUE */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300 block text-xs">
                  2. Destaque (Ações e Abas):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={resolvedAccent}
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customAccent: e.target.value,
                      });
                    }}
                    className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={resolvedAccent}
                    placeholder="#38bdf8"
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customAccent: e.target.value,
                      });
                    }}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-fuchsia-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {THEME_ACCENT_PRESETS.map((accent) => (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        accentPreset: accent.id,
                        customAccent: accent.color,
                      });
                    }}
                    className={`px-2 py-1 rounded-lg border flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${
                      resolvedAccent.toLowerCase() === accent.color.toLowerCase()
                        ? 'border-white text-white'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    style={{ backgroundColor: `${accent.color}25` }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent.color }} />
                    <span>{accent.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. COR DOS PAINÉIS E CAIXAS */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300 block text-xs">
                  3. Painéis e Caixas:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={resolvedPanel}
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customPanelColor: e.target.value,
                      });
                    }}
                    className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={resolvedPanel}
                    placeholder="#0f172a"
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customPanelColor: e.target.value,
                      });
                    }}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {THEME_PANEL_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        panelPreset: p.id,
                        customPanelColor: p.color,
                      });
                    }}
                    className={`p-1.5 rounded-lg border text-left text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      resolvedPanel.toLowerCase() === p.color.toLowerCase()
                        ? 'border-emerald-400 text-white'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    style={{ backgroundColor: p.color }}
                  >
                    <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. COR DAS LETRAS E LEGENDAS */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300 block text-xs">
                  4. Letras e Legendas:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={resolvedText}
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customTextColor: e.target.value,
                      });
                    }}
                    className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={resolvedText}
                    placeholder="#f8fafc"
                    onChange={(e) => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        customTextColor: e.target.value,
                      });
                    }}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-sky-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {THEME_TEXT_PRESETS.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onUpdateThemeConfig?.({
                        ...themeConfig,
                        textPreset: t.id,
                        customTextColor: t.color,
                      });
                    }}
                    className={`p-1.5 rounded-lg border text-left text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 bg-slate-950/70 ${
                      resolvedText.toLowerCase() === t.color.toLowerCase()
                        ? 'border-sky-400'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full border border-slate-600" style={{ backgroundColor: t.color }} />
                    <span className="truncate" style={{ color: t.color }}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onUpdateThemeConfig?.({
                    bgPreset: 'deep-ocean',
                    accentPreset: 'sky',
                    panelPreset: 'slate',
                    textPreset: 'white-ice',
                    customBg: '#071326',
                    customPanelColor: '#0f172a',
                    customAccent: '#38bdf8',
                    customTextColor: '#f8fafc',
                  });
                }}
                className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrão</span>
              </button>

              <button
                type="button"
                onClick={() => setIsThemeModalOpen(false)}
                style={{
                  backgroundColor: resolvedAccent,
                  color: accentTextColor,
                }}
                className="px-4 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO */}
      {cardActionModal && (
        <ModalConfirmacao
          isOpen={Boolean(cardActionModal)}
          title={
            cardActionModal.type === 'archive'
              ? `Arquivar Cartão "${cardActionModal.card.name}"?`
              : cardActionModal.type === 'cannot_delete'
              ? `Não é Seguro Excluir — Dados Vinculados`
              : `Excluir Cartão "${cardActionModal.card.name}"?`
          }
          message={
            cardActionModal.type === 'archive'
              ? `Ao arquivar o cartão "${cardActionModal.card.name}", todas as ${cardActionModal.txCount || 0} compras, parcelas, faturas e registros contábeis serão 100% preservados com total segurança. O cartão sairá das listas ativas para novos lançamentos e poderá ser consultado ou reativado a qualquer momento.`
              : cardActionModal.type === 'cannot_delete'
              ? `Atenção: O cartão "${cardActionModal.card.name}" possui ${cardActionModal.txCount} lançamentos vinculados no seu histórico financeiro. Para evitar perda de dados e faturas órfãs, este cartão não pode ser excluído diretamente. Deseja arquivá-lo com segurança para preservar todo o histórico?`
              : `Deseja realmente excluir definitivamente o cartão "${cardActionModal.card.name}"? Este cartão não possui histórico ou lançamentos registrados.`
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
            const cardId = cardActionModal.card.id;

            if (cardActionModal.type === 'archive' || cardActionModal.type === 'cannot_delete') {
              if (onArchiveCard) {
                onArchiveCard(cardId);
              } else if (onRemoveCard) {
                onRemoveCard(cardId);
              }
            } else if (cardActionModal.type === 'delete') {
              if (onDeleteCard) {
                onDeleteCard(cardId);
              } else if (onRemoveCard) {
                onRemoveCard(cardId);
              }
            }

            setCardActionModal(null);
          }}
          onClose={() => setCardActionModal(null)}
        />
      )}

      {/* POPUP DE PESQUISA RÁPIDA (ACESSO DIRETO DO PAINEL DE LIMITES) */}
      <ModalPesquisaRapida
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        cards={cards}
        onSelectCard={onSelectCard}
        paidInvoices={paidInvoices}
      />
    </div>
  );
};