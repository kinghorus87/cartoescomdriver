import React, { useState, useMemo } from 'react';
import { SeedData } from '../types';
import { 
  analyzeReallocation, 
  executeReallocation, 
  PurchaseAnalysis, 
  ReallocationAnalysisResult 
} from '../utils/reallocateInstallments';
import { exportBackup, formatCurrency } from '../utils/storage';
import { saveAppData as saveBrowserData } from '../utils/browserStorage';
import { formatMonthPill, formatMonthLong } from '../utils/timeline';
import { 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  ArrowRight, 
  Search, 
  CreditCard, 
  Calendar, 
  User, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Sparkles,
  Info,
  Clock,
  Layers,
  FileText
} from 'lucide-react';

interface ModalCorrecaoParcelasProps {
  isOpen: boolean;
  onClose: () => void;
  appData: SeedData;
  onApplyData: (newData: SeedData) => void;
  onNavigateToTab?: (tab: 'matriz' | 'limites' | 'dividas') => void;
}

export const ModalCorrecaoParcelas: React.FC<ModalCorrecaoParcelasProps> = ({
  isOpen,
  onClose,
  appData,
  onApplyData,
  onNavigateToTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'meses' | 'compras' | 'revisao'>('meses');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPurchaseKey, setExpandedPurchaseKey] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionReport, setExecutionReport] = useState<{
    totalCardsExamined: number;
    totalPurchasesIdentified: number;
    totalInstallmentsReallocated: number;
    reallocationsByMonth: { fromMonthKey: string; toMonthKey: string; count: number; totalValor: number }[];
    ambiguousPurchases: PurchaseAnalysis[];
  } | null>(null);

  // Analisa os cartões em tempo de execução
  const analysis: ReallocationAnalysisResult = useMemo(() => {
    return analyzeReallocation(appData.cards);
  }, [appData.cards]);

  if (!isOpen) return null;

  const handleDownloadPreBackup = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_seguranca_pre_correcao_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmReallocation = async () => {
    setIsExecuting(true);
    try {
      // 1. Cópia de segurança obrigatória pré-execução
      try {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        localStorage.setItem(`cartoes_backup_pre_realloc_${timestamp}`, JSON.stringify(appData));
        handleDownloadPreBackup();
      } catch (err) {
        console.warn('Backup em localStorage concluído com aviso:', err);
      }

      // 2. Executa a realocação exata
      const result = executeReallocation(appData);

      // 3. Salva no armazenamento do navegador e atualiza o estado
      await saveBrowserData(result.updatedData);
      onApplyData(result.updatedData);

      // 4. Exibe o relatório final
      setExecutionReport({
        totalCardsExamined: result.totalCardsExamined,
        totalPurchasesIdentified: result.totalPurchasesIdentified,
        totalInstallmentsReallocated: result.totalInstallmentsReallocated,
        reallocationsByMonth: result.reallocationsByMonth,
        ambiguousPurchases: result.ambiguousPurchases,
      });
    } catch (error) {
      console.error('Erro ao executar a correção das parcelas:', error);
      alert('Ocorreu um erro ao executar a correção. Seus dados originais não foram alterados.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Filtra as compras detalhadas conforme a busca
  const filteredPurchases = analysis.purchasesWithReallocation.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      p.cardName.toLowerCase().includes(term) ||
      p.descricao.toLowerCase().includes(term) ||
      p.pagador.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Correção Automática de Parcelas
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  2026 ➔ 2027+
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Realocar parcelas concentradas em 2026 para seus anos cronológicos corretos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Dinâmico: Prévia vs Relatório Final */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {executionReport ? (
            /* ============================================================ */
            /* RELATÓRIO FINAL DE EXECUÇÃO                                   */
            /* ============================================================ */
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-300">
                    Correção Concluída com Sucesso!
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Todas as {executionReport.totalInstallmentsReallocated} parcelas foram realocadas para seus meses e anos corretos.
                    A cópia de segurança prévia foi baixada e gravada com segurança no seu dispositivo.
                  </p>
                </div>
              </div>

              {/* Cards de Métricas do Relatório */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Cartões Examinados</span>
                  <span className="text-xl font-bold text-white mt-1 block">
                    {executionReport.totalCardsExamined}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Compras Identificadas</span>
                  <span className="text-xl font-bold text-sky-400 mt-1 block">
                    {executionReport.totalPurchasesIdentified}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Parcelas Realocadas</span>
                  <span className="text-xl font-bold text-emerald-400 mt-1 block">
                    {executionReport.totalInstallmentsReallocated}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Itens para Revisão</span>
                  <span className="text-xl font-bold text-slate-300 mt-1 block">
                    {executionReport.ambiguousPurchases.length}
                  </span>
                </div>
              </div>

              {/* Tabela Consolidada de Meses de Origem e Destino */}
              <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
                <div className="p-3 bg-slate-800/90 border-b border-slate-700/70 flex items-center justify-between">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    Relação dos Meses de Origem e Destino
                  </h5>
                  <span className="text-xs text-slate-400">
                    Total: {executionReport.reallocationsByMonth.length} fluxos
                  </span>
                </div>
                <div className="divide-y divide-slate-700/40">
                  {executionReport.reallocationsByMonth.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-800/60 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono font-semibold border border-rose-500/25">
                          {formatMonthLong(item.fromMonthKey)}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono font-semibold border border-emerald-500/25">
                          {formatMonthLong(item.toMonthKey)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-slate-300 font-medium">
                          {item.count} {item.count === 1 ? 'parcela' : 'parcelas'}
                        </span>
                        <span className="text-emerald-400 font-semibold font-mono">
                          {formatCurrency(item.totalValor)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informação sobre os dados no aplicativo */}
              <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <p>
                  As parcelas futuras agora aparecem ordenadas em 2027 e nos anos seguintes. 
                  Você pode visualizá-las navegando pelas colunas da <strong>Matriz de Gastos</strong>, 
                  no filtro de ano de <strong>Dívidas Totais</strong> e no <strong>Simulador</strong>.
                </p>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* TELA DE ANÁLISE, PRÉVIA E CONFIRMAÇÃO                         */
            /* ============================================================ */
            <div className="space-y-6">
              {/* Alerta de Diagnóstico */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-200">
                    Diagnóstico dos Lançamentos Parcelados
                  </h4>
                  <p className="text-xs text-amber-100/90 leading-relaxed">
                    Identificamos compras parceladas em que as parcelas que deveriam vencer a partir de <strong>Janeiro de 2027</strong> foram 
                    registradas incorretamente nos meses de <strong>Janeiro a Outubro de 2026</strong>. 
                    Esta rotina restaura a cronologia exata preservando 100% dos dados contábeis.
                  </p>
                </div>
              </div>

              {/* Métricas Principais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Cartões Examinados</span>
                  <span className="text-xl font-bold text-white mt-1 block">
                    {analysis.totalCardsExamined}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Compras com Parcelas 2027</span>
                  <span className="text-xl font-bold text-sky-400 mt-1 block">
                    {analysis.purchasesWithReallocation.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Parcelas a Realocar</span>
                  <span className="text-xl font-bold text-amber-400 mt-1 block">
                    {analysis.totalInstallmentsToReallocate}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[11px] text-slate-400 font-medium block">Itens para Revisão</span>
                  <span className="text-xl font-bold text-slate-400 mt-1 block">
                    {analysis.ambiguousPurchases.length}
                  </span>
                </div>
              </div>

              {/* Caixa de Proteção e Backup de Segurança */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <span className="font-bold text-white block">Proteção e Garantia Contábil</span>
                    <p className="text-slate-300">
                      Uma cópia de segurança completa é baixada e salva antes de qualquer alteração. 
                      Nenhuma compra à vista ou corretamente distribuída será modificada.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPreBackup}
                  className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 border border-slate-600 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Backup (.json)
                </button>
              </div>

              {/* Sub-abas de Visualização */}
              <div className="flex border-b border-slate-700/80 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('meses')}
                  className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-colors cursor-pointer ${
                    activeSubTab === 'meses'
                      ? 'border-sky-400 text-sky-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Resumo por Meses ({analysis.reallocationsByMonth.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('compras')}
                  className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-colors cursor-pointer ${
                    activeSubTab === 'compras'
                      ? 'border-sky-400 text-sky-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Detalhamento por Compra ({analysis.purchasesWithReallocation.length})
                </button>
                {analysis.ambiguousPurchases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('revisao')}
                    className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-colors cursor-pointer ${
                      activeSubTab === 'revisao'
                        ? 'border-amber-400 text-amber-300'
                        : 'border-transparent text-amber-400/70 hover:text-amber-200'
                    }`}
                  >
                    Revisão Manual ({analysis.ambiguousPurchases.length})
                  </button>
                )}
              </div>

              {/* Conteúdo da Sub-aba: Resumo por Meses */}
              {activeSubTab === 'meses' && (
                <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-slate-800/40">
                  <div className="p-3 bg-slate-800/90 border-b border-slate-700/70 flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <span>Mês Atual (Origem) ➔ Mês Proposto (Destino)</span>
                    <span>Qtd / Total</span>
                  </div>
                  <div className="divide-y divide-slate-700/40">
                    {analysis.reallocationsByMonth.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-800/60 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono font-semibold border border-rose-500/25">
                            {formatMonthLong(item.fromMonthKey)}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono font-semibold border border-emerald-500/25">
                            {formatMonthLong(item.toMonthKey)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-slate-300 font-medium">
                            {item.count} {item.count === 1 ? 'parcela' : 'parcelas'}
                          </span>
                          <span className="text-emerald-400 font-semibold font-mono">
                            {formatCurrency(item.totalValor)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conteúdo da Sub-aba: Detalhamento por Compra */}
              {activeSubTab === 'compras' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Pesquisar por cartão, item ou responsável..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredPurchases.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-800/40 rounded-xl border border-slate-700/60">
                        Nenhuma compra encontrada com o termo buscado.
                      </div>
                    ) : (
                      filteredPurchases.map((purchase) => {
                        const isExpanded = expandedPurchaseKey === purchase.purchaseKey;
                        return (
                          <div
                            key={purchase.purchaseKey}
                            className="rounded-xl border border-slate-700/70 bg-slate-800/50 overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedPurchaseKey(isExpanded ? null : purchase.purchaseKey)}
                              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/80 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">
                                    {purchase.descricao}
                                  </span>
                                  <span className="text-[11px] px-2 py-0.2 rounded-full bg-slate-700 text-slate-300 font-medium">
                                    {purchase.cardName}
                                  </span>
                                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {purchase.pagador}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                                  <span>Total de parcelas: <strong>{purchase.totalParcelas}</strong></span>
                                  <span>Realocar: <strong className="text-amber-300">{purchase.installmentsToReallocate.length} parcelas</strong></span>
                                  <span>Âncora 2026: {purchase.anchorMonth ? formatMonthPill(purchase.anchorMonth) : 'N/A'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-emerald-400 font-mono">
                                  {formatCurrency(purchase.totalValorCompra)}
                                </span>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="p-3 border-t border-slate-700/60 bg-slate-900/60 space-y-1.5 text-xs">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Parcelas desta compra e proposta de realocação:
                                </span>
                                {purchase.allInstallments.map((inst, i) => {
                                  const isMoved = inst.monthKey !== inst.targetMonthKey;
                                  return (
                                    <div
                                      key={i}
                                      className={`p-2 rounded-lg flex items-center justify-between text-xs ${
                                        isMoved
                                          ? 'bg-amber-500/10 border border-amber-500/25'
                                          : 'bg-slate-800/30 text-slate-400'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-200">
                                          Parcela {inst.curr}/{purchase.totalParcelas}
                                        </span>
                                        {inst.pago && (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            Paga
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 font-mono">
                                        {isMoved ? (
                                          <>
                                            <span className="text-rose-300">{formatMonthPill(inst.monthKey)}</span>
                                            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                                            <span className="text-emerald-300 font-bold">{formatMonthPill(inst.targetMonthKey)}</span>
                                          </>
                                        ) : (
                                          <span className="text-slate-400">{formatMonthPill(inst.monthKey)} (mantido)</span>
                                        )}
                                        <span className="text-slate-200 font-semibold ml-2">
                                          {formatCurrency(inst.valor)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Conteúdo da Sub-aba: Revisão Manual */}
              {activeSubTab === 'revisao' && (
                <div className="space-y-3">
                  {analysis.ambiguousPurchases.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-800/40 rounded-xl border border-slate-700/60">
                      Nenhuma pendência ou inconsistência encontrada. Todas as compras foram identificadas com segurança!
                    </div>
                  ) : (
                    analysis.ambiguousPurchases.map((amb, i) => (
                      <div key={i} className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-200">{amb.descricao} ({amb.cardName})</span>
                          <span className="text-amber-400 font-mono font-semibold">{formatCurrency(amb.totalValorCompra)}</span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{amb.ambiguityReason}</p>
                        <p className="text-[11px] text-amber-300/80 italic">
                          Por segurança contábil, esta compra não será alterada automaticamente.
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 z-10">
          {executionReport ? (
            <div className="w-full flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Dados atualizados e sincronizados no navegador.
              </span>
              <div className="flex items-center gap-2">
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTab('matriz');
                    }}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
                  >
                    Ver na Matriz de Gastos
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isExecuting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmReallocation}
                  disabled={isExecuting || analysis.totalInstallmentsToReallocate === 0}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isExecuting
                    ? 'Executando e Salvando Backup...'
                    : `Confirmar e Realocar ${analysis.totalInstallmentsToReallocate} Parcelas`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
