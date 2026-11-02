import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CardData } from '../types';
import { formatCurrency, MESES_NOMES } from '../utils/storage';
import { 
  Search, 
  CreditCard, 
  X, 
  CheckCircle2, 
  Clock, 
  History, 
  ChevronDown, 
  ChevronUp, 
  Check,
  Users,
  ExternalLink,
  Layers
} from 'lucide-react';
import { 
  searchItems, 
  SearchMode, 
  UnifiedSearchItem, 
  PaidItemSummary 
} from '../utils/searchItems';

interface ModalPesquisaRapidaProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardData[];
  onSelectCard: (cardId: string) => void;
  paidInvoices?: Record<string, boolean>;
}

export const ModalPesquisaRapida: React.FC<ModalPesquisaRapidaProps> = ({
  isOpen,
  onClose,
  cards,
  onSelectCard,
  paidInvoices = {},
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCartaoName, setSelectedCartaoName] = useState<string>('todos');
  const [searchMode, setSearchMode] = useState<SearchMode>('restantes');
  const [showItemSuggestions, setShowItemSuggestions] = useState<boolean>(false);
  const [expandedDividedItems, setExpandedDividedItems] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
      setSelectedCartaoName('todos');
      setSearchMode('restantes');
      setExpandedDividedItems({});
      setShowItemSuggestions(false);
    }
  }, [isOpen]);

  // Tecla ESC para fechar o popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedDividedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const {
    allFound,
    parcelasRestantes,
    itensTotalmentePagos,
    contagemRealRestantes,
    contagemRealHistorico,
    valorTotalRestante,
    valorTotalPagoHistorico,
    valorTotalGeralHistorico,
    valorTotalItensPagos,
    filteredSuggestions,
  } = useMemo(() => {
    return searchItems(cards, searchTerm, selectedCartaoName, paidInvoices);
  }, [cards, searchTerm, selectedCartaoName, paidInvoices]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Compacto do Popup */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                Pesquisa Rápida de Itens
              </h3>
              <p className="text-[11px] text-slate-400">
                Atalho direto no Painel de Limites (Janela de 36 meses)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar pesquisa rápida (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Opções de Consulta (Compactas para Popup) */}
        <div className="p-3 bg-slate-950/30 border-b border-slate-800/80 shrink-0 space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            {/* Opção 1: Parcelas Restantes */}
            <button
              type="button"
              onClick={() => setSearchMode('restantes')}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'restantes'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 ring-1 ring-teal-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Restantes</span>
            </button>

            {/* Opção 2: Histórico Completo */}
            <button
              type="button"
              onClick={() => setSearchMode('historico')}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'historico'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 ring-1 ring-teal-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Histórico</span>
            </button>

            {/* Opção 3: Itens Já Pagos */}
            <button
              type="button"
              onClick={() => setSearchMode('pagos')}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'pagos'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 ring-1 ring-teal-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Já Pagos</span>
            </button>
          </div>

          {/* Campo de Busca e Filtro de Cartão */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowItemSuggestions(true);
                }}
                onFocus={() => setShowItemSuggestions(true)}
                placeholder="Digitar item ou despesa..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-teal-500 shadow-inner"
              />
              {searchTerm.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setShowItemSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Menu de Sugestões Flutuante */}
              {showItemSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-36 overflow-y-auto z-30 divide-y divide-slate-700/60">
                  {filteredSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSearchTerm(item);
                        setShowItemSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-teal-600/30 hover:text-teal-300 transition-colors cursor-pointer truncate"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-4 relative">
              <select
                value={selectedCartaoName}
                onChange={(e) => setSelectedCartaoName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="todos">Todos os cartões</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resumo compacto de resultados */}
          {searchTerm.trim() && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
              {searchMode === 'restantes' && (
                <>
                  <span>
                    Parcelas restantes: <strong className="text-teal-400 font-mono font-bold">{contagemRealRestantes}</strong> ({parcelasRestantes.length} ocorrências)
                  </span>
                  <span>
                    Total pendente: <strong className="text-amber-400 font-mono font-bold">{formatCurrency(valorTotalRestante)}</strong>
                  </span>
                </>
              )}

              {searchMode === 'historico' && (
                <>
                  <span>
                    Total: <strong className="text-teal-400 font-mono font-bold">{contagemRealHistorico} parcelas</strong>
                  </span>
                  <span>
                    Pagas: <strong className="text-emerald-400 font-mono">{formatCurrency(valorTotalPagoHistorico)}</strong> | Pendentes: <strong className="text-amber-400 font-mono">{formatCurrency(valorTotalRestante)}</strong>
                  </span>
                </>
              )}

              {searchMode === 'pagos' && (
                <>
                  <span>
                    Compras quitadas: <strong className="text-emerald-400 font-mono font-bold">{itensTotalmentePagos.length}</strong>
                  </span>
                  <span>
                    Total pago: <strong className="text-teal-400 font-mono font-bold">{formatCurrency(valorTotalItensPagos)}</strong>
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Lista Compacta de Resultados (Resumida para Popup) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-800/60">
          {!searchTerm.trim() ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-600 stroke-[1.5]" />
              <p className="font-semibold text-slate-300">Digite uma palavra acima para pesquisar</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Localiza itens em todos os cartões dentro dos 36 meses vigentes
              </p>
            </div>
          ) : searchMode !== 'pagos' ? (
            /* LISTAGEM PARA MODOS 1 E 2 */
            (searchMode === 'restantes' ? parcelasRestantes : allFound).length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                Nenhuma parcela encontrada para "{searchTerm}".
              </div>
            ) : (
              (searchMode === 'restantes' ? parcelasRestantes : allFound).map((item) => {
                const isExpanded = Boolean(expandedDividedItems[item.id]);

                return (
                  <div key={item.id} className="pt-2.5 first:pt-0 space-y-1.5">
                    {/* Linha Resumida do Item */}
                    <div className="flex items-start justify-between gap-2.5 bg-slate-800/40 hover:bg-slate-800/70 p-2.5 rounded-xl border border-slate-800 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-xs sm:text-sm truncate">
                            {item.descricao}
                          </span>

                          <span className="text-[10.5px] bg-slate-800 text-slate-300 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700">
                            {item.parcelas}
                          </span>

                          <span className="text-[11px] text-slate-400 font-medium">
                            {MESES_NOMES[item.mes - 1]}/{String(item.year).slice(-2)}
                          </span>

                          {/* Distintivo de Compra Dividida */}
                          {item.isDivided && (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(item.id, e)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer transition-all"
                              title="Clique para ver a divisão entre as pessoas"
                            >
                              <Users className="w-3 h-3" />
                              <span>Dividida ({item.splitDetails.length} pessoas)</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                          <span className="font-medium text-slate-300">{item.cartaoNome}</span>
                          <span>•</span>
                          <span className="text-amber-300/90 font-medium">
                            {item.pagadores.join(' / ') || 'Não informado'}
                          </span>
                          {item.data && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-500">{item.data}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Lado Direito: Valor, Status e Ação */}
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-teal-400 text-xs sm:text-sm">
                          {formatCurrency(searchMode === 'restantes' ? item.valorPendente : item.valorTotal)}
                        </span>

                        {searchMode === 'historico' && (
                          <div className="text-[10px]">
                            {item.isPaid ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Paga</span>
                              </span>
                            ) : item.isPartiallyPaid ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                <span>Parcial</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Pendente</span>
                              </span>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onSelectCard(item.cartaoId);
                            onClose();
                          }}
                          className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold cursor-pointer underline flex items-center gap-1 mt-0.5"
                          title="Abrir detalhes no cartão"
                        >
                          <span>Ver Cartão</span>
                        </button>
                      </div>
                    </div>

                    {/* Detalhamento Expandido da Divisão entre Pessoas */}
                    {item.isDivided && isExpanded && (
                      <div className="ml-3 pl-3 border-l-2 border-amber-500/40 bg-slate-950/60 rounded-r-xl p-2.5 space-y-1.5 text-xs animate-in fade-in">
                        <span className="text-[10.5px] font-bold text-amber-300 uppercase tracking-wider block">
                          Divisão registrada desta parcela ({item.parcelas}):
                        </span>
                        <div className="space-y-1">
                          {item.splitDetails.map((sub, sIdx) => (
                            <div 
                              key={`${sub.id}-${sIdx}`}
                              className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11.5px]"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white capitalize">{sub.pagador}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  (Parc {sub.parcelas})
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-teal-300">
                                  {formatCurrency(sub.valor)}
                                </span>
                                {sub.isPaid ? (
                                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    Paga
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    Pendente
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* LISTAGEM PARA MODO 3: ITENS JÁ PAGOS */
            itensTotalmentePagos.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                Nenhum item totalmente quitado encontrado para "{searchTerm}".
              </div>
            ) : (
              itensTotalmentePagos.map((item) => {
                const isExpanded = Boolean(expandedDividedItems[item.purchaseKey]);

                return (
                  <div key={item.purchaseKey} className="pt-2.5 first:pt-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2.5 bg-slate-800/40 hover:bg-slate-800/70 p-2.5 rounded-xl border border-slate-800 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-xs sm:text-sm truncate">
                            {item.nome}
                          </span>

                          <span className="text-[10.5px] bg-slate-800 text-slate-300 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700">
                            {item.totalParcelasTexto}
                          </span>

                          <span className="text-[11px] text-slate-400 font-medium">
                            {item.periodoMeses}
                          </span>

                          {/* Botão de Expandir Divisão ou Histórico de Parcelas Quitadas */}
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(item.purchaseKey, e)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25 cursor-pointer transition-all"
                            title="Ver detalhamento das parcelas quitadas"
                          >
                            {item.isDivided ? <Users className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                            <span>{item.isDivided ? 'Dividida' : 'Parcelas'} ({item.parcelasCount})</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                          <span className="font-medium text-slate-300">{item.cartaoNome}</span>
                          <span>•</span>
                          <span className="text-amber-300/90 font-medium">{item.pagadores}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-400">{formatCurrency(item.valorParcelaMedia)} / parc</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                          {formatCurrency(item.valorTotal)}
                        </span>

                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Quitado</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectCard(item.cartaoId);
                            onClose();
                          }}
                          className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold cursor-pointer underline flex items-center gap-1 mt-0.5"
                          title="Abrir detalhes no cartão"
                        >
                          <span>Ver Cartão</span>
                        </button>
                      </div>
                    </div>

                    {/* Detalhamento Expandido de Compras Quitadas e Divisões */}
                    {isExpanded && (
                      <div className="ml-3 pl-3 border-l-2 border-emerald-500/40 bg-slate-950/60 rounded-r-xl p-2.5 space-y-2 text-xs animate-in fade-in">
                        {/* Se for dividida, mostra resumo por pessoa */}
                        {item.isDivided && item.pessoasResumo && (
                          <div className="space-y-1 mb-2 pb-2 border-b border-slate-800">
                            <span className="text-[10.5px] font-bold text-amber-300 uppercase tracking-wider block">
                              Divisão de valores por pessoa (100% quitada):
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {item.pessoasResumo.map((pr) => (
                                <div key={pr.pagador} className="p-1.5 rounded bg-slate-900 border border-slate-800 flex justify-between items-center text-[11px]">
                                  <span className="font-semibold text-white capitalize">{pr.pagador}</span>
                                  <span className="font-mono font-bold text-emerald-400">{formatCurrency(pr.valorTotal)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                          Parcelas quitadas deste item ({item.itens.length}):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto pr-1">
                          {item.itens.map((sub) => (
                            <div 
                              key={sub.id}
                              className="flex items-center justify-between p-1.5 rounded bg-slate-900/90 border border-slate-800 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-teal-400">{sub.parcelas}</span>
                                <span className="text-slate-300">{MESES_NOMES[sub.mes - 1]}/{String(sub.year).slice(-2)}</span>
                                {sub.isDivided && (
                                  <span className="text-[9.5px] text-amber-400/90">({sub.pagadores.join('/')})</span>
                                )}
                              </div>
                              <span className="font-mono font-semibold text-emerald-400">
                                {formatCurrency(sub.valorTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Rodapé Compacto */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>
            {searchMode === 'restantes' && 'Mostrando apenas parcelas pendentes'}
            {searchMode === 'historico' && 'Mostrando parcelas pagas e pendentes'}
            {searchMode === 'pagos' && 'Mostrando compras 100% quitadas'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
