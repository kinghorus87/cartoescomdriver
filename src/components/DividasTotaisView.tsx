import React, { useState, useMemo } from 'react';
import { CardData, Transaction } from '../types';
import { formatCurrency, MESES_NOMES } from '../utils/storage';
import { 
  parseMonthKey, 
  toMonthKey, 
  getCurrentSystemMonthKey, 
  getVisible7Months, 
  addMonths, 
  diffMonths,
  getRolling36Window,
  formatMonthPill, 
  formatMonthLong 
} from '../utils/timeline';
import { EditableTitle } from './EditableTitle';
import { useColumnResize } from '../utils/useColumnResize';
import { 
  Users, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Calendar, 
  CreditCard,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';

interface DividasTotaisViewProps {
  cards: CardData[];
  persons: string[];
  paidInvoices?: Record<string, boolean>;
  onSelectCard: (cardId: string) => void;
  initialYear?: number;
  onYearChange?: (year: number) => void;
  customTitles?: Record<string, string>;
  onSaveCustomTitle?: (key: string, title: string) => void;
}

interface DividaItem {
  id: string;
  data: string;
  descricao: string;
  parcelas: string;
  valor: number;
  pagador: string;
  cartaoNome: string;
  cartaoId: string;
  mes: number;
  year: number;
  dueDayNumber: number;
  isPaid?: boolean;
}

type SortField = 'cartao' | 'data' | 'descricao' | 'parcela' | 'valor' | 'padrao_vencimento' | 'pagador';

export const DividasTotaisView: React.FC<DividasTotaisViewProps> = ({
  cards,
  persons,
  paidInvoices = {},
  onSelectCard,
  initialYear = new Date().getFullYear(),
  onYearChange,
  customTitles = {},
  onSaveCustomTitle,
}) => {
  const { colWidths, isCustomized, handleMouseDown, resetWidths } = useColumnResize('dividas');
  // Seletor de Pessoa visual: padrão 'TODOS' (Item 10)
  const [selectedPerson, setSelectedPerson] = useState<string>('TODOS');
  const [showPersonDropdown, setShowPersonDropdown] = useState<boolean>(false);

  // Navegação Temporal Dinâmica: Padrão Real de Cartões e Meses
  // Inicia sempre no mês e ano atuais do sistema (dinâmico)
  const currentRealMonthKey = useMemo(() => getCurrentSystemMonthKey(), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | 'todos'>(currentRealMonthKey);
  const [referenceMonthKey, setReferenceMonthKey] = useState<string>(currentRealMonthKey);
  const [sortField, setSortField] = useState<SortField>('padrao_vencimento');

  const { startMonthKey, endMonthKey } = useMemo(() => getRolling36Window(), []);

  // Janela com 7 meses consecutivos: 3 anteriores, mês centralizado e 3 posteriores
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

  // Navegação pelos chevrons (avança e retrocede com bloqueio nas extremidades)
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

  // Ao clicar em qualquer mês: seleciona e centraliza na 4ª posição da janela
  const handleSelectMonth = (mKey: string) => {
    setSelectedMonthKey(mKey);
    setReferenceMonthKey(mKey);
    const parsed = parseMonthKey(mKey);
    if (onYearChange && parsed.year) {
      onYearChange(parsed.year);
    }
  };

  const currentRefYear = parseMonthKey(referenceMonthKey).year;

  // Parse due day string to number for sorting (ex: "dia 01" -> 1, "dia 28" -> 28, else 99)
  const parseDueDay = (dueStr: string): number => {
    if (!dueStr) return 99;
    const match = dueStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 99;
  };

  // Coleta todas as pessoas reais cadastradas em cartões e lançamentos (Item 10)
  const allKnownPersons = useMemo(() => {
    const set = new Set<string>();
    persons.forEach((p) => {
      if (p && p.trim()) set.add(p.trim());
    });
    cards.forEach((card) => {
      Object.values(card.months || {}).forEach((txs) => {
        if (Array.isArray(txs)) {
          txs.forEach((tx) => {
            if (tx.pagador && tx.pagador.trim()) {
              set.add(tx.pagador.trim());
            }
          });
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards, persons]);

  // Coleta as dívidas filtradas estritamente pelo período selecionado (mês da barra de 7 meses ou ano todo)
  const rawDividas = useMemo(() => {
    const list: DividaItem[] = [];
    const isAll = selectedPerson === 'TODOS';
    const termClean = selectedPerson.toLowerCase().trim();
    const seen = new Set<string>();

    cards.forEach((card) => {
      const dueNum = parseDueDay(card.dueDay);

      Object.entries(card.months || {}).forEach(([mStr, txs]) => {
        if (!Array.isArray(txs)) return;
        const parsed = parseMonthKey(mStr);
        const y = parsed.year;
        const m = parsed.month;
        const mKey = parsed.key;

        // Se 'todos' estiver selecionado, exibe todos os meses do ano de referência atual
        if (selectedMonthKey === 'todos') {
          if (y !== currentRefYear) return;
        } else {
          // Filtra pelo mês e ano exatos da pílula selecionada (ex: '2026-10', '2027-01')
          if (mKey !== selectedMonthKey) return;
        }

        const isInvoicePaid = Boolean(paidInvoices[`${card.id}_${toMonthKey(y, m)}`]);

        txs.forEach((tx) => {
          if (!tx || !tx.id) return;
          const dedupeKey = `${card.id}_${y}_${m}_${tx.id}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);

          const pagadorClean = (tx.pagador || '').toLowerCase().trim();
          if (isAll || pagadorClean === termClean) {
            list.push({
              id: tx.id,
              data: tx.data || '',
              descricao: tx.descricao || '',
              parcelas: tx.parcelas || '',
              valor: tx.valor || 0,
              pagador: tx.pagador,
              cartaoNome: card.name,
              cartaoId: card.id,
              mes: m,
              year: y,
              dueDayNumber: dueNum,
              isPaid: isInvoicePaid || Boolean(tx.pago),
            });
          }
        });
      });
    });

    return list;
  }, [cards, selectedPerson, selectedMonthKey, currentRefYear, paidInvoices]);

  // Aplica ordenação (Item 12: suporte a ordenação por pagador quando Todos selecionado)
  const sortedDividas = useMemo(() => {
    const list = [...rawDividas];

    if (sortField === 'pagador' && selectedPerson === 'TODOS') {
      list.sort((a, b) => {
        const pagA = (a.pagador || '').toLowerCase();
        const pagB = (b.pagador || '').toLowerCase();
        if (pagA !== pagB) return pagA.localeCompare(pagB);
        return a.cartaoNome.localeCompare(b.cartaoNome);
      });
    } else if (sortField === 'padrao_vencimento') {
      list.sort((a, b) => {
        if (a.dueDayNumber !== b.dueDayNumber) {
          return a.dueDayNumber - b.dueDayNumber;
        }
        return a.cartaoNome.localeCompare(b.cartaoNome);
      });
    } else if (sortField === 'parcela') {
      list.sort((a, b) => {
        const getProgress = (parcStr: string) => {
          if (parcStr.includes('/')) {
            const parts = parcStr.split('/');
            const atual = parseFloat(parts[0]) || 1;
            const total = parseFloat(parts[1]) || 1;
            return { remaining: total - atual, total };
          }
          const num = parseFloat(parcStr) || 1;
          return { remaining: num, total: num };
        };

        const progA = getProgress(a.parcelas);
        const progB = getProgress(b.parcelas);

        if (progA.remaining !== progB.remaining) {
          return progA.remaining - progB.remaining;
        }
        return progA.total - progB.total;
      });
    } else if (sortField === 'cartao') {
      list.sort((a, b) => a.cartaoNome.localeCompare(b.cartaoNome));
    } else if (sortField === 'data') {
      list.sort((a, b) => a.data.localeCompare(b.data));
    } else if (sortField === 'descricao') {
      list.sort((a, b) => a.descricao.localeCompare(b.descricao));
    } else if (sortField === 'valor') {
      list.sort((a, b) => b.valor - a.valor);
    }

    return list;
  }, [rawDividas, sortField, selectedPerson]);

  const totalSomaDividas = sortedDividas.reduce((acc, item) => item.isPaid ? acc : acc + item.valor, 0);
  const totalQuitadoDividas = sortedDividas.reduce((acc, item) => item.isPaid ? acc + item.valor : acc, 0);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortField('padrao_vencimento');
    } else {
      setSortField(field);
    }
  };

  const isShowingAll = selectedPerson === 'TODOS';

  return (
    <div className="space-y-4 max-w-4xl lg:max-w-5xl mx-auto w-full">
      {/* Cabeçalho e Painel de Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-4.5 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <EditableTitle
                titleKey="dividas_totais"
                defaultTitle="Dívidas Totais"
                customTitles={customTitles}
                onSaveCustomTitle={onSaveCustomTitle}
                className="text-base font-bold text-white"
              />
              <p className="text-xs text-slate-400">
                Acompanhamento consolidado de parcelas por responsável e ano
              </p>
            </div>
          </div>

          {/* NOVO SELETOR VISUAL DE RESPONSÁVEL: [ Todos ] [ Responsável ▾ ] (Item 10) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold block mr-1">
              Responsável:
            </span>

            <div className="flex items-center gap-1.5 relative">
              {/* Botão Todos Fixo */}
              <button
                type="button"
                onClick={() => {
                  setSelectedPerson('TODOS');
                  setShowPersonDropdown(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isShowingAll
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                Todos
              </button>

              {/* Botão com Dropdown de Responsáveis Reais */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPersonDropdown(!showPersonDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    !isShowingAll
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                  }`}
                >
                  <span className="capitalize">{!isShowingAll ? selectedPerson : 'Selecionar'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showPersonDropdown && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in">
                    {allKnownPersons.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500 italic">Nenhum responsável cadastrado</div>
                    ) : (
                      allKnownPersons.map((p) => {
                        const isCurrent = selectedPerson.toLowerCase().trim() === p.toLowerCase().trim();
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setSelectedPerson(p);
                              setShowPersonDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold capitalize hover:bg-slate-800 flex items-center justify-between cursor-pointer ${
                              isCurrent
                                ? 'text-amber-400 bg-slate-800/80 font-bold'
                                : 'text-slate-300'
                            }`}
                          >
                            <span>{p}</span>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO TEMPORAL: 7 MESES CONSECUTIVOS (MODELO CARTÕES E MESES) */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Identificação do período apurado */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-300 font-bold">
              {selectedMonthKey === 'todos'
                ? `Ano Todo de ${currentRefYear}`
                : formatMonthLong(selectedMonthKey)}
            </span>
            {selectedMonthKey !== currentRealMonthKey && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonthKey(currentRealMonthKey);
                  setReferenceMonthKey(currentRealMonthKey);
                  const parsed = parseMonthKey(currentRealMonthKey);
                  if (onYearChange && parsed.year) {
                    onYearChange(parsed.year);
                  }
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer ml-1"
                title="Voltar ao mês atual de referência"
              >
                (Voltar ao Mês Atual)
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Faixa Horizontal com 7 MESES — Clicar centraliza na 4ª posição */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
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
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {visible7Months.map((mKey) => {
                  const isSelected = selectedMonthKey === mKey;
                  const pillLabel = formatMonthPill(mKey);

                  return (
                    <div key={mKey} className="flex flex-col items-center min-w-[50px]">
                      <button
                        type="button"
                        onClick={() => handleSelectMonth(mKey)}
                        className={`w-full text-center px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {pillLabel}
                      </button>
                      {/* Indicador de Seleção embaixo do Pill */}
                      {isSelected && (
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-indigo-600 mt-0.5"></div>
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

            {/* Opção de Visualizar Ano Todo */}
            <button
              type="button"
              onClick={() => setSelectedMonthKey('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                selectedMonthKey === 'todos'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
              }`}
              title={`Ver todos os lançamentos do ano de ${currentRefYear}`}
            >
              Ano Todo ({currentRefYear})
            </button>
          </div>
        </div>

        {/* Critérios de Ordenação (Item 12: suporte a ordenação por pagador quando Todos selecionado) */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span className="font-semibold text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" /> Ordenação:
          </span>

          <label 
            onClick={() => handleToggleSort('cartao')}
            className="flex items-center gap-1.5 cursor-pointer hover:text-white"
          >
            {sortField === 'cartao' ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
            <span>Cartão</span>
          </label>

          <label 
            onClick={() => handleToggleSort('data')}
            className="flex items-center gap-1.5 cursor-pointer hover:text-white"
          >
            {sortField === 'data' ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
            <span>Data</span>
          </label>

          <label 
            onClick={() => handleToggleSort('descricao')}
            className="flex items-center gap-1.5 cursor-pointer hover:text-white"
          >
            {sortField === 'descricao' ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
            <span>Descrição</span>
          </label>

          <label 
            onClick={() => handleToggleSort('parcela')}
            title="Ordena pelas compras que estão mais perto de acabar (total - atual)"
            className="flex items-center gap-1.5 cursor-pointer hover:text-white font-medium text-amber-300"
          >
            {sortField === 'parcela' ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 text-slate-600" />}
            <span>Parcela (Perto de Acabar)</span>
          </label>

          <label 
            onClick={() => handleToggleSort('valor')}
            className="flex items-center gap-1.5 cursor-pointer hover:text-white"
          >
            {sortField === 'valor' ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-600" />}
            <span>Valor (Maior)</span>
          </label>

          {/* Ordenação por Pagador ativa quando Todos selecionado (Item 12) */}
          {isShowingAll && (
            <label 
              onClick={() => handleToggleSort('pagador')}
              className="flex items-center gap-1.5 cursor-pointer hover:text-white font-medium text-amber-300"
            >
              {sortField === 'pagador' ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 text-slate-600" />}
              <span>Pagador (A-Z)</span>
            </label>
          )}

          <span className="text-[11px] text-slate-500 ml-auto">
            {sortField === 'padrao_vencimento' ? 'Padrão: Vencimento do Cartão' : `Ordenado por: ${sortField}`}
          </span>
        </div>
      </div>

      {/* Resumo Total e Resultados */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-850 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400 font-medium">
              Dívidas de <strong className="text-white">{selectedMonthKey === 'todos' ? `Ano Todo (${currentRefYear})` : formatMonthLong(selectedMonthKey)}</strong> para <strong className="text-white uppercase">{isShowingAll ? 'Todos os Responsáveis' : selectedPerson}</strong>:
            </span>
            <span className="text-xs bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-full font-bold">
              {sortedDividas.length} parcelas
            </span>
            {isCustomized && (
              <button
                type="button"
                onClick={resetWidths}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer ml-2"
                title="Restaurar larguras padrão das colunas"
              >
                Restaurar larguras automáticas
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {totalQuitadoDividas > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Quitado:</span>
                <span className="font-bold font-mono text-emerald-400">
                  {formatCurrency(totalQuitadoDividas)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Total pendente:</span>
              <span className="text-lg font-bold font-mono text-amber-300">
                {formatCurrency(totalSomaDividas)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabela com Colunas Dinâmicas Compactadas e Padronizadas */}
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse text-xs text-left text-slate-300">
            <thead className="bg-slate-800 text-slate-300 uppercase text-xs font-bold border-b border-slate-700">
              <tr>
                <th 
                  style={{ width: colWidths['data'] || 95, minWidth: 85 }}
                  className="relative px-2.5 py-2 whitespace-nowrap font-mono"
                >
                  Data
                  <div 
                    onMouseDown={(e) => handleMouseDown('data', e, 70)} 
                    className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 z-20" 
                    title="Arraste para redimensionar"
                  />
                </th>
                <th 
                  style={{ width: colWidths['descricao'] || undefined, minWidth: 160 }}
                  className="relative px-2.5 py-2 whitespace-normal"
                >
                  Descrição
                  <div 
                    onMouseDown={(e) => handleMouseDown('descricao', e, 150)} 
                    className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 z-20" 
                    title="Arraste para redimensionar"
                  />
                </th>
                <th 
                  style={{ width: colWidths['parcela'] || 80, minWidth: 70 }}
                  className="relative px-2 py-2 text-center whitespace-nowrap font-mono"
                >
                  Parcela
                  <div 
                    onMouseDown={(e) => handleMouseDown('parcela', e, 60)} 
                    className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 z-20" 
                    title="Arraste para redimensionar"
                  />
                </th>
                <th 
                  style={{ width: colWidths['valor'] || 110, minWidth: 95 }}
                  className="relative px-2.5 py-2 text-right pr-2.5 whitespace-nowrap font-mono"
                >
                  Valor
                  <div 
                    onMouseDown={(e) => handleMouseDown('valor', e, 85)} 
                    className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 z-20" 
                    title="Arraste para redimensionar"
                  />
                </th>
                <th 
                  style={{ width: colWidths['pagador'] || colWidths['responsavel'] || 125, minWidth: 105 }}
                  className="relative px-2.5 py-2 whitespace-nowrap"
                >
                  Responsável
                  <div 
                    onMouseDown={(e) => handleMouseDown('pagador', e, 90)} 
                    className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 z-20" 
                    title="Arraste para redimensionar"
                  />
                </th>
                <th 
                  style={{ width: colWidths['cartao'] || 125, minWidth: 110 }}
                  className="relative px-2.5 py-2 whitespace-nowrap"
                >
                  Cartão
                  <div 
                    onMouseDown={(e) => handleMouseDown('cartao', e, 100)} 
                    className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 z-20" 
                    title="Arraste para redimensionar"
                  />
                </th>
                <th 
                  style={{ width: colWidths['acao'] || 85, minWidth: 75 }}
                  className="relative px-2 py-2 text-center whitespace-nowrap"
                >
                  Ação
                  <div 
                    onMouseDown={(e) => handleMouseDown('acao', e, 70)} 
                    className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 z-20" 
                    title="Arraste para redimensionar"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedDividas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-400 text-xs sm:text-sm">
                    Nenhuma despesa localizada no período {selectedMonthKey === 'todos' ? `de ${currentRefYear}` : `(${formatMonthLong(selectedMonthKey)})`} com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                sortedDividas.map((item, idx) => (
                  <tr key={`${item.cartaoId}_${item.year}_${item.mes}_${item.id}_${idx}`} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-2.5 py-2 font-mono text-white text-xs sm:text-[13px] whitespace-nowrap">
                      {item.data || '-'}
                    </td>
                    <td className="px-2.5 py-2 font-medium text-white text-xs sm:text-[13.5px] max-w-sm truncate">
                      <span>{item.descricao}</span>
                      {selectedMonthKey === 'todos' && (
                        <span className="ml-1.5 text-[11px] text-slate-400 font-normal">
                          ({MESES_NOMES[item.mes - 1]} de {item.year})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center font-mono whitespace-nowrap text-xs sm:text-[13px]">
                      <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700 text-xs sm:text-[12.5px] font-bold">
                        {item.parcelas || '-'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right pr-2.5 font-mono font-bold text-xs sm:text-[13.5px] whitespace-nowrap">
                      {item.isPaid ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="line-through text-slate-500 font-normal">{formatCurrency(item.valor)}</span>
                          <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-sans font-bold">
                            Quitada
                          </span>
                        </div>
                      ) : (
                        <span className="text-emerald-400">{formatCurrency(item.valor)}</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap font-medium text-amber-300/90 capitalize text-xs sm:text-[13px]">
                      {item.pagador || 'Não informado'}
                    </td>
                    <td className="px-2.5 py-2 font-medium text-slate-300 whitespace-nowrap text-xs sm:text-[13px]">
                      {item.cartaoNome}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => onSelectCard(item.cartaoId)}
                        className="text-xs sm:text-[13px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer hover:underline"
                      >
                        Abrir Cartão
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {sortedDividas.length > 0 && (
              <tfoot className="bg-slate-800 font-bold border-t-2 border-slate-700 text-white">
                <tr>
                  <td colSpan={3} className="px-2.5 py-2 text-xs sm:text-sm">
                    TOTAL PENDENTE A PAGAR ({selectedMonthKey === 'todos' ? `Ano ${currentRefYear}` : formatMonthPill(selectedMonthKey)})
                  </td>
                  <td className="px-2.5 py-2 text-right pr-2.5 font-mono text-amber-300 text-xs sm:text-base font-bold">
                    {formatCurrency(totalSomaDividas)}
                  </td>
                  <td colSpan={3} className="px-2.5 py-2 text-slate-400 font-normal text-xs sm:text-[13px]">
                    {sortedDividas.length} parcelas ({sortedDividas.filter((d) => !d.isPaid).length} pendentes)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
