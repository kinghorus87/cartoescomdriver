import React, { useState, useMemo } from 'react';
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
  Layers
} from 'lucide-react';
import { 
  searchItems, 
  SearchMode, 
  UnifiedSearchItem, 
  PaidItemSummary 
} from '../utils/searchItems';
import { EditableTitle } from './EditableTitle';
import { useColumnResize } from '../utils/useColumnResize';

interface PesquisarParcelasViewProps {
  cards: CardData[];
  onSelectCard: (cardId: string) => void;
  customTitles?: Record<string, string>;
  onSaveCustomTitle?: (key: string, title: string) => void;
  paidInvoices?: Record<string, boolean>;
}

export const PesquisarParcelasView: React.FC<PesquisarParcelasViewProps> = ({
  cards,
  onSelectCard,
  customTitles = {},
  onSaveCustomTitle,
  paidInvoices = {},
}) => {
  const { colWidths, isCustomized, handleMouseDown, resetWidths } = useColumnResize('pesquisar');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCartaoName, setSelectedCartaoName] = useState<string>('todos');
  const [showItemSuggestions, setShowItemSuggestions] = useState<boolean>(false);
  
  // Três Modos de Consulta: Padrão = 'restantes'
  const [searchMode, setSearchMode] = useState<SearchMode>('restantes');

  // Controle de itens expandidos para compras divididas
  const [expandedDividedItems, setExpandedDividedItems] = useState<Record<string, boolean>>({});

  // Controle de itens expandidos no Modo 3 (Itens Já Pagos)
  const [expandedPaidItems, setExpandedPaidItems] = useState<Record<string, boolean>>({});

  const toggleExpandDivided = (key: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedDividedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleExpandPaidItem = (key: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedPaidItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Consulta e classificação dos dados via helper compartilhado
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

  return (
    <div className="space-y-4 max-w-4xl lg:max-w-5xl mx-auto w-full">
      {/* Cabeçalho e Painel de Filtros do frmProcurarParcela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-4.5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <EditableTitle
              titleKey="pesquisar_itens"
              defaultTitle="Pesquisar Itens"
              customTitles={customTitles}
              onSaveCustomTitle={onSaveCustomTitle}
              className="text-base font-bold text-white"
            />
            <p className="text-xs text-slate-400">
              Consulta dinâmica integrada à janela móvel contínua de 36 meses
            </p>
          </div>
        </div>

        {/* 3 Modos de Consulta no topo da área de pesquisa */}
        <div className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-slate-950/70 rounded-xl border border-slate-800">
            {/* Opção 1: Parcelas Restantes (Padrão) */}
            <button
              type="button"
              onClick={() => setSearchMode('restantes')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'restantes'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/25 ring-1 ring-teal-400'
                  : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>1. Parcelas Restantes (Padrão)</span>
            </button>

            {/* Opção 2: Histórico Completo */}
            <button
              type="button"
              onClick={() => setSearchMode('historico')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'historico'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/25 ring-1 ring-teal-400'
                  : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>2. Histórico Completo</span>
            </button>

            {/* Opção 3: Itens Já Pagos */}
            <button
              type="button"
              onClick={() => setSearchMode('pagos')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                searchMode === 'pagos'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/25 ring-1 ring-teal-400'
                  : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>3. Itens Já Pagos</span>
            </button>
          </div>

          <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {searchMode === 'restantes' && 'Modo 1: Mostrando apenas parcelas com pagamento pendente.'}
              {searchMode === 'historico' && 'Modo 2: Mostrando histórico completo (pagas e pendentes) com status de evolução.'}
              {searchMode === 'pagos' && 'Modo 3: Mostrando apenas compras que foram 100% quitadas.'}
            </span>
            <span className="text-slate-500">Janela de 36 meses ativa</span>
          </div>
        </div>

        {/* Linha dos campos de busca */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Campo de Busca de Item */}
          <div className="relative">
            <label className="text-xs text-slate-400 font-semibold mb-1 block">
              Palavra ou Item a Procurar:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowItemSuggestions(true);
                }}
                onFocus={() => setShowItemSuggestions(true)}
                placeholder="Ex: perfume, celular, mercado..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-9 py-2 text-sm font-medium focus:outline-none focus:border-teal-500"
              />
              {searchTerm.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setShowItemSuggestions(false);
                  }}
                  title="Limpar campo de pesquisa"
                  aria-label="Limpar campo de pesquisa"
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700/80 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Menu Flutuante de Itens */}
            {showItemSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-20 divide-y divide-slate-700/60">
                {filteredSuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSearchTerm(item);
                      setShowItemSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-white hover:bg-teal-600/30 hover:text-teal-300 transition-colors cursor-pointer truncate"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro por Cartão */}
          <div>
            <label className="text-xs text-slate-400 font-semibold mb-1 block">
              Filtrar por Cartão:
            </label>
            <div className="relative">
              <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={selectedCartaoName}
                onChange={(e) => setSelectedCartaoName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm font-medium focus:outline-none focus:border-teal-500 cursor-pointer"
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
        </div>

        {/* Resumo e Totalizadores por Modo */}
        {searchTerm.trim() && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {searchMode === 'restantes' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Total de Parcelas Restantes:</span>
                  <span className="font-bold font-mono text-teal-400 text-sm sm:text-base">
                    {contagemRealRestantes}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Lançamentos Encontrados:</span>
                  <span className="font-bold font-mono text-white text-sm">
                    {parcelasRestantes.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Valor Total Restante:</span>
                  <span className="font-bold font-mono text-amber-400 text-sm sm:text-base">
                    {formatCurrency(valorTotalRestante)}
                  </span>
                </div>
              </>
            )}

            {searchMode === 'historico' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Total de Parcelas:</span>
                  <span className="font-bold font-mono text-teal-400 text-sm sm:text-base">
                    {contagemRealHistorico}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Pagas:</span>
                  <span className="font-bold font-mono text-emerald-400 text-sm">
                    {formatCurrency(valorTotalPagoHistorico)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Pendentes:</span>
                  <span className="font-bold font-mono text-amber-400 text-sm">
                    {formatCurrency(valorTotalRestante)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Total Geral:</span>
                  <span className="font-bold font-mono text-white text-sm">
                    {formatCurrency(valorTotalGeralHistorico)}
                  </span>
                </div>
              </>
            )}

            {searchMode === 'pagos' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Total de Itens Quitados:</span>
                  <span className="font-bold font-mono text-emerald-400 text-sm sm:text-base">
                    {itensTotalmentePagos.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Valor Total Pago:</span>
                  <span className="font-bold font-mono text-teal-400 text-sm sm:text-base">
                    {formatCurrency(valorTotalItensPagos)}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  * Apenas compras onde 100% das parcelas foram quitadas.
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabela de Resultados com Colunas Dinâmicas */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isCustomized && (
          <div className="px-4 py-2 bg-slate-850 border-b border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={resetWidths}
              className="text-[11px] text-teal-400 hover:text-teal-300 underline font-medium cursor-pointer"
              title="Restaurar larguras padrão das colunas"
            >
              Restaurar larguras automáticas
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          {/* RENDERIZAÇÃO PARA MODOS 1 E 2: TABELA DE PARCELAS COM EXPANSÃO DE DIVISÕES */}
          {searchMode !== 'pagos' ? (
            <table className="w-full table-auto border-collapse text-xs sm:text-sm text-left text-slate-300">
              <thead className="bg-slate-800 text-slate-300 uppercase text-xs sm:text-[12px] font-bold border-b border-slate-700">
                <tr>
                  <th 
                    style={{ width: colWidths['data'] || 95, minWidth: 85 }}
                    className="relative px-2.5 py-2.5 whitespace-nowrap font-mono"
                  >
                    Data
                    <div 
                      onMouseDown={(e) => handleMouseDown('data', e, 75)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['descricao'] || undefined, minWidth: 160 }}
                    className="relative px-2.5 py-2.5 whitespace-normal"
                  >
                    Descrição
                    <div 
                      onMouseDown={(e) => handleMouseDown('descricao', e, 150)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['parcela'] || 80, minWidth: 70 }}
                    className="relative px-2 py-2.5 text-center whitespace-nowrap font-mono"
                  >
                    Parcela
                    <div 
                      onMouseDown={(e) => handleMouseDown('parcela', e, 65)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['valor'] || 110, minWidth: 95 }}
                    className="relative px-2.5 py-2.5 text-right whitespace-nowrap font-mono"
                  >
                    Valor
                    <div 
                      onMouseDown={(e) => handleMouseDown('valor', e, 85)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>

                  {/* Coluna Status exclusiva do Modo 2: Histórico Completo */}
                  {searchMode === 'historico' && (
                    <th 
                      style={{ width: colWidths['status'] || 100, minWidth: 85 }}
                      className="relative px-2 py-2.5 text-center whitespace-nowrap"
                    >
                      Status
                      <div 
                        onMouseDown={(e) => handleMouseDown('status', e, 75)} 
                        className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                        title="Arraste para redimensionar"
                      />
                    </th>
                  )}

                  <th 
                    style={{ width: colWidths['responsavel'] || 125, minWidth: 105 }}
                    className="relative px-2.5 py-2.5 whitespace-nowrap"
                  >
                    Responsável
                    <div 
                      onMouseDown={(e) => handleMouseDown('responsavel', e, 95)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['cartao'] || 125, minWidth: 110 }}
                    className="relative px-2.5 py-2.5 whitespace-nowrap"
                  >
                    Cartão
                    <div 
                      onMouseDown={(e) => handleMouseDown('cartao', e, 100)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['acao'] || 85, minWidth: 75 }}
                    className="relative px-2 py-2.5 text-center whitespace-nowrap"
                  >
                    Ação
                    <div 
                      onMouseDown={(e) => handleMouseDown('acao', e, 70)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {!searchTerm.trim() ? (
                  <tr>
                    <td 
                      colSpan={searchMode === 'historico' ? 8 : 7} 
                      className="px-3 py-10 text-center text-slate-400 text-xs sm:text-sm"
                    >
                      Digite um termo acima para pesquisar despesas em todos os cartões.
                    </td>
                  </tr>
                ) : (searchMode === 'restantes' ? parcelasRestantes : allFound).length === 0 ? (
                  <tr>
                    <td 
                      colSpan={searchMode === 'historico' ? 8 : 7} 
                      className="px-3 py-10 text-center text-slate-400 text-xs sm:text-sm"
                    >
                      {searchMode === 'restantes'
                        ? `Nenhuma parcela pendente correspondente a "${searchTerm}" foi encontrada.`
                        : `Nenhum item correspondente a "${searchTerm}" foi encontrado.`}
                    </td>
                  </tr>
                ) : (
                  (searchMode === 'restantes' ? parcelasRestantes : allFound).map((item) => {
                    const isExpanded = Boolean(expandedDividedItems[item.id]);

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-2.5 py-2 font-mono text-white text-xs sm:text-[13px] whitespace-nowrap">
                            {item.data || '-'}
                          </td>
                          <td className="px-2.5 py-2 font-semibold text-white text-xs sm:text-[13.5px] max-w-sm truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Ícone de Expandir/Recolher quando houver divisão entre pessoas */}
                              {item.isDivided && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleExpandDivided(item.id, e)}
                                  className="text-amber-400 hover:text-amber-300 p-0.5 rounded cursor-pointer transition-transform hover:scale-110 shrink-0"
                                  title={isExpanded ? 'Recolher detalhes da divisão' : 'Ver divisão entre as pessoas'}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                  )}
                                </button>
                              )}

                              <span>{item.descricao}</span>

                              <span className="text-[11px] text-slate-400 font-normal">
                                ({MESES_NOMES[item.mes - 1]}{item.year ? ` de ${item.year}` : ''})
                              </span>

                              {/* Indicador de divisão */}
                              {item.isDivided && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold">
                                  <Users className="w-2.5 h-2.5" />
                                  <span>Dividida ({item.splitDetails.length}p)</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center font-mono whitespace-nowrap">
                            <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700 text-xs sm:text-[12.5px] font-bold">
                              {item.parcelas || '-'}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-teal-400 text-xs sm:text-[13.5px] whitespace-nowrap">
                            {formatCurrency(searchMode === 'restantes' ? item.valorPendente : item.valorTotal)}
                          </td>

                          {/* Badge de Status no Modo 2 */}
                          {searchMode === 'historico' && (
                            <td className="px-2 py-2 text-center whitespace-nowrap">
                              {item.isPaid ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Paga</span>
                                </span>
                              ) : item.isPartiallyPaid ? (
                                <span className="inline-flex items-center gap-1 bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                  <span>Parcial</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                  <Clock className="w-3 h-3" />
                                  <span>Pendente</span>
                                </span>
                              )}
                            </td>
                          )}

                          <td className="px-2.5 py-2 text-amber-300/90 whitespace-nowrap font-semibold capitalize text-xs sm:text-[13px]">
                            {item.pagadores.join(' / ') || 'Não informado'}
                          </td>
                          <td className="px-2.5 py-2 font-medium text-slate-200 text-xs sm:text-[13px] whitespace-nowrap">
                            {item.cartaoNome}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectCard(item.cartaoId)}
                              className="text-xs sm:text-[13px] text-teal-400 hover:text-teal-300 font-semibold cursor-pointer hover:underline"
                            >
                              Abrir Cartão
                            </button>
                          </td>
                        </tr>

                        {/* DETALHAMENTO AO EXPANDIR COMPRAS DIVIDIDAS */}
                        {item.isDivided && isExpanded && (
                          <tr className="bg-slate-950/70 border-b border-slate-800">
                            <td colSpan={searchMode === 'historico' ? 8 : 7} className="p-3 pl-8">
                              <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                      Divisão desta parcela ({item.parcelas}) entre as pessoas:
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    Mês de referência: <strong className="text-white">{MESES_NOMES[item.mes - 1]} de {item.year || 2026}</strong>
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                                  {item.splitDetails.map((sub, sIdx) => (
                                    <div
                                      key={`${sub.id}-${sIdx}`}
                                      className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between gap-1.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-white capitalize text-xs truncate">
                                          {sub.pagador}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-700/80 px-1.5 py-0.5 rounded">
                                          Parc {sub.parcelas}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between pt-1 border-t border-slate-700/40">
                                        <span className="font-mono font-bold text-teal-300 text-xs sm:text-sm">
                                          {formatCurrency(sub.valor)}
                                        </span>

                                        {sub.isPaid ? (
                                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                            <span>Paga</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                            <Clock className="w-2.5 h-2.5" />
                                            <span>Pendente</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* RENDERIZAÇÃO PARA MODO 3: ITENS JÁ PAGOS COM EXPANSÃO */
            <table className="w-full table-auto border-collapse text-xs sm:text-sm text-left text-slate-300">
              <thead className="bg-slate-800 text-slate-300 uppercase text-xs sm:text-[12px] font-bold border-b border-slate-700">
                <tr>
                  <th 
                    style={{ width: colWidths['descricao'] || undefined, minWidth: 180 }}
                    className="relative px-3 py-2.5"
                  >
                    Item Quitado
                    <div 
                      onMouseDown={(e) => handleMouseDown('descricao', e, 160)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['parcela'] || 130, minWidth: 110 }}
                    className="relative px-2.5 py-2.5 text-center whitespace-nowrap"
                  >
                    Parcelas
                    <div 
                      onMouseDown={(e) => handleMouseDown('parcela', e, 100)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['data'] || 140, minWidth: 120 }}
                    className="relative px-2.5 py-2.5 text-center whitespace-nowrap"
                  >
                    Período / Meses
                    <div 
                      onMouseDown={(e) => handleMouseDown('data', e, 110)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['valor'] || 130, minWidth: 110 }}
                    className="relative px-2.5 py-2.5 text-right whitespace-nowrap font-mono"
                  >
                    Valor Total Pago
                    <div 
                      onMouseDown={(e) => handleMouseDown('valor', e, 100)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['responsavel'] || 130, minWidth: 110 }}
                    className="relative px-2.5 py-2.5 whitespace-nowrap"
                  >
                    Responsável
                    <div 
                      onMouseDown={(e) => handleMouseDown('responsavel', e, 100)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['cartao'] || 120, minWidth: 100 }}
                    className="relative px-2.5 py-2.5 whitespace-nowrap"
                  >
                    Cartão
                    <div 
                      onMouseDown={(e) => handleMouseDown('cartao', e, 90)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['status'] || 100, minWidth: 90 }}
                    className="relative px-2 py-2.5 text-center whitespace-nowrap"
                  >
                    Status
                    <div 
                      onMouseDown={(e) => handleMouseDown('status', e, 80)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                  <th 
                    style={{ width: colWidths['acao'] || 90, minWidth: 80 }}
                    className="relative px-2 py-2.5 text-center whitespace-nowrap"
                  >
                    Ação
                    <div 
                      onMouseDown={(e) => handleMouseDown('acao', e, 70)} 
                      className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-teal-500/50 active:bg-teal-500 z-20" 
                      title="Arraste para redimensionar"
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {!searchTerm.trim() ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-400 text-xs sm:text-sm">
                      Digite um termo acima para buscar compras 100% quitadas.
                    </td>
                  </tr>
                ) : itensTotalmentePagos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-400 text-xs sm:text-sm">
                      Nenhum item totalmente quitado correspondente a "{searchTerm}" foi encontrado na janela de 36 meses.
                    </td>
                  </tr>
                ) : (
                  itensTotalmentePagos.map((item) => {
                    const isExpanded = Boolean(expandedPaidItems[item.purchaseKey]);

                    return (
                      <React.Fragment key={item.purchaseKey}>
                        <tr className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-white text-xs sm:text-sm">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => toggleExpandPaidItem(item.purchaseKey, e)}
                                className="text-slate-400 hover:text-teal-300 p-0.5 rounded cursor-pointer"
                                title={isExpanded ? 'Recolher detalhes das parcelas' : 'Ver parcelas quitadas deste item'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-teal-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                              <span className="truncate">{item.nome}</span>
                              {item.isDivided && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold">
                                  <Users className="w-2.5 h-2.5" />
                                  <span>Dividida</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 text-center whitespace-nowrap font-mono text-xs">
                            <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700 font-bold">
                              {item.totalParcelasTexto}
                            </span>
                            <span className="block text-[10.5px] text-slate-400 mt-0.5 font-normal">
                              ({formatCurrency(item.valorParcelaMedia)} / parc)
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-center whitespace-nowrap text-xs text-slate-300 font-medium">
                            <span>{item.periodoMeses}</span>
                            {item.datas && (
                              <span className="block text-[10px] text-slate-500 font-mono">
                                {item.datas}
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-mono font-bold text-teal-400 text-xs sm:text-sm whitespace-nowrap">
                            {formatCurrency(item.valorTotal)}
                          </td>
                          <td className="px-2.5 py-2.5 text-amber-300/90 whitespace-nowrap font-semibold capitalize text-xs">
                            {item.pagadores}
                          </td>
                          <td className="px-2.5 py-2.5 font-medium text-slate-200 text-xs whitespace-nowrap">
                            {item.cartaoNome}
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Quitado</span>
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectCard(item.cartaoId)}
                              className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer hover:underline"
                            >
                              Abrir Cartão
                            </button>
                          </td>
                        </tr>

                        {/* Detalhamento expandido das parcelas do item quitado */}
                        {isExpanded && (
                          <tr className="bg-slate-950/70 border-b border-slate-800">
                            <td colSpan={8} className="p-3 pl-8">
                              <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
                                {/* Se for dividida, mostra resumo por pessoa */}
                                {item.isDivided && item.pessoasResumo && (
                                  <div className="space-y-1 mb-2 pb-2 border-b border-slate-800">
                                    <span className="text-[10.5px] font-bold text-amber-300 uppercase tracking-wider block">
                                      Divisão total por pessoa (100% quitada):
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                      {item.pessoasResumo.map((pr) => (
                                        <div key={pr.pagador} className="p-2 rounded bg-slate-800/80 border border-slate-700/60 flex justify-between items-center text-xs">
                                          <span className="font-semibold text-white capitalize">{pr.pagador}</span>
                                          <span className="font-mono font-bold text-emerald-400">{formatCurrency(pr.valorTotal)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                                  Histórico das parcelas quitadas deste item ({item.itens.length} ocorrências):
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {item.itens.map((sub, sIdx) => (
                                    <div
                                      key={`${sub.id}-${sIdx}`}
                                      className="flex items-center justify-between p-2 rounded bg-slate-800/80 border border-slate-700/60 text-xs"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-teal-400">
                                          {sub.parcelas || `${sIdx + 1}/${item.itens.length}`}
                                        </span>
                                        <span className="text-slate-300">
                                          {MESES_NOMES[sub.mes - 1]}/{String(sub.year).slice(-2)}
                                        </span>
                                        {sub.isDivided && (
                                          <span className="text-[10px] text-amber-300/80 font-medium">
                                            ({sub.pagadores.join('/')})
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono font-semibold text-emerald-400">
                                        {formatCurrency(sub.valorTotal)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
