import React, { useState } from 'react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/storage';
import { X, Pencil, Calendar, DollarSign, User, AlertCircle, Info, Layers, CheckCircle2 } from 'lucide-react';

interface ModalEditarOcorrenciaProps {
  isOpen: boolean;
  onClose: () => void;
  cardName: string;
  monthLabel: string;
  transaction: Transaction | null;
  persons: string[];
  onSaveOccurrence: (updatedTx: {
    id: string;
    descricao: string;
    valor: number;
    data: string;
    pagador: string;
    parcelaAtual: number;
    totalParcelas: number;
    scope: 'only_this' | 'this_and_future';
  }) => void;
}

export const ModalEditarOcorrencia: React.FC<ModalEditarOcorrenciaProps> = ({
  isOpen,
  onClose,
  cardName,
  monthLabel,
  transaction,
  persons,
  onSaveOccurrence,
}) => {
  if (!isOpen || !transaction) return null;

  // Extrai com precisão a parcela atual e total existente no registro
  const parseInitialInstallment = (pStr?: string) => {
    if (!pStr) return { cur: 1, tot: 1 };
    if (pStr.includes('/')) {
      const parts = pStr.split('/');
      const cur = parseInt(parts[0], 10);
      const tot = parseInt(parts[1], 10);
      return {
        cur: isNaN(cur) || cur < 1 ? 1 : cur,
        tot: isNaN(tot) || tot < 1 ? 1 : tot,
      };
    }
    const n = parseInt(pStr, 10);
    if (!isNaN(n) && n >= 1) return { cur: 1, tot: n };
    return { cur: 1, tot: 1 };
  };

  const initialParsed = parseInitialInstallment(transaction.parcelas);

  const [descricao, setDescricao] = useState<string>(transaction.descricao);
  const [valor, setValor] = useState<string>(String(transaction.valor || '').replace('.', ','));
  const [dataStr, setDataStr] = useState<string>(transaction.data || '');
  const [pagador, setPagador] = useState<string>(transaction.pagador || persons[0] || '');
  const [novoPagador, setNovoPagador] = useState<string>('');
  
  // Novos campos: Parcela Atual e Quantidade Total de Parcelas (Tópico 5.1)
  const [parcelaAtual, setParcelaAtual] = useState<number>(initialParsed.cur);
  const [totalParcelas, setTotalParcelas] = useState<number>(initialParsed.tot);

  // Escopo de alteração: Opção A (somente esta ocorrência) vs Opção B (esta e futuras) (Tópico 5.2)
  const [scope, setScope] = useState<'only_this' | 'this_and_future'>('only_this');

  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanDesc = descricao.trim();
    if (!cleanDesc) {
      setErrorMsg('Informe a descrição do lançamento.');
      return;
    }

    const numVal = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    if (isNaN(numVal) || numVal < 0) {
      setErrorMsg('Informe um valor numérico válido.');
      return;
    }

    // Validação estrita de parcelas (Tópico 5.1): inteiros >= 1 e parcela atual <= total
    const numParcelaAtual = Math.floor(Number(parcelaAtual));
    const numTotalParcelas = Math.floor(Number(totalParcelas));

    if (isNaN(numParcelaAtual) || numParcelaAtual < 1) {
      setErrorMsg('O número da parcela atual deve ser um número inteiro maior ou igual a 1.');
      return;
    }

    if (isNaN(numTotalParcelas) || numTotalParcelas < 1) {
      setErrorMsg('A quantidade total de parcelas deve ser um número inteiro maior ou igual a 1.');
      return;
    }

    if (numParcelaAtual > numTotalParcelas) {
      setErrorMsg(`O número da parcela atual (${numParcelaAtual}) não pode ser maior do que a quantidade total de parcelas (${numTotalParcelas}).`);
      return;
    }

    const finalPagador = pagador === '__novo__' ? novoPagador.trim() : pagador.trim();
    if (!finalPagador) {
      setErrorMsg('Informe quem é o pagador ou responsável.');
      return;
    }

    onSaveOccurrence({
      id: transaction.id,
      descricao: cleanDesc,
      valor: numVal,
      data: dataStr.trim() || transaction.data,
      pagador: finalPagador,
      parcelaAtual: numParcelaAtual,
      totalParcelas: numTotalParcelas,
      scope,
    });

    onClose();
  };

  const isTotalDecreased = scope === 'this_and_future' && totalParcelas < initialParsed.tot;
  const isTotalIncreased = scope === 'this_and_future' && totalParcelas > initialParsed.tot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Lançamento / Parcelas</h2>
              <p className="text-xs text-slate-400">
                {cardName} • Fatura de {monthLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1">Descrição do Lançamento:</label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500 font-medium"
            />
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Valor da Parcela (R$):</label>
              <input
                type="text"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Data (DD/MM/AAAA):</label>
              <input
                type="text"
                value={dataStr}
                onChange={(e) => setDataStr(e.target.value)}
                placeholder="Ex: 10/10/2026"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* ======================================================== */}
          {/* TÓPICO 5.1: EDIÇÃO DE QUANTIDADE E NÚMERO DE PARCELAS     */}
          {/* ======================================================== */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Configuração do Parcelamento:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Número da Parcela Atual:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={parcelaAtual}
                    onChange={(e) => setParcelaAtual(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-slate-400 pointer-events-none">
                    de {totalParcelas}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Ex: 2 para a 2ª parcela (2/{totalParcelas})
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Quantidade Total de Parcelas:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-sky-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Sem limite arbitrário de 12 meses
                </span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* TÓPICO 5.2: ESCOPO DA ALTERAÇÃO (OPÇÃO A vs OPÇÃO B)      */}
          {/* ======================================================== */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
            <span className="font-bold text-slate-200 block">
              Alcance da alteração (selecione uma opção):
            </span>

            {/* Opção A */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              scope === 'only_this'
                ? 'bg-sky-500/10 border-sky-500/50 text-white'
                : 'bg-slate-850/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}>
              <input
                type="radio"
                name="editScope"
                value="only_this"
                checked={scope === 'only_this'}
                onChange={() => setScope('only_this')}
                className="mt-0.5 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-xs block text-slate-100">
                  Opção A — Alterar somente esta ocorrência ({monthLabel})
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Altera apenas o registro deste mês específico. Não cria parcelas em outros meses, não apaga parcelas anteriores e não altera meses futuros.
                </p>
              </div>
            </label>

            {/* Opção B */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              scope === 'this_and_future'
                ? 'bg-sky-500/10 border-sky-500/50 text-white'
                : 'bg-slate-850/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}>
              <input
                type="radio"
                name="editScope"
                value="this_and_future"
                checked={scope === 'this_and_future'}
                onChange={() => setScope('this_and_future')}
                className="mt-0.5 text-sky-500 focus:ring-0 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-xs block text-slate-100">
                  Opção B — Alterar todas as ocorrências
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Esta parcela recebe o número informado e as parcelas seguintes são renumeradas em sequência (as anteriores mantêm a numeração). Valor, descrição e pagador são atualizados em todas as parcelas, preservando meses, datas originais e estados de pagamento. Parcelas que passarem do total ficam guardadas e reaparecem se o total aumentar. Todos os outros lançamentos continuam intactos.
                </p>
              </div>
            </label>

            {/* Avisos informativos dinâmicos para a Opção B */}
            {isTotalDecreased && (
              <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  <strong>Aviso de redução:</strong> O total foi reduzido de {initialParsed.tot} para {totalParcelas}. As parcelas excedentes além de {totalParcelas} deixarão de aparecer, mas ficam guardadas e voltam se o total for aumentado novamente.
                </span>
              </div>
            )}

            {isTotalIncreased && (
              <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>
                  <strong>Expansão de parcelas:</strong> O total foi ampliado de {initialParsed.tot} para {totalParcelas}. Parcelas guardadas serão recuperadas e as que ainda faltarem serão geradas automaticamente nos meses seguintes, inclusive através da virada de ano.
                </span>
              </div>
            )}
          </div>

          {/* Pagador / Responsável */}
          <div>
            <label className="font-semibold text-slate-300 block mb-1.5">Pagador / Responsável:</label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {persons.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPagador(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    pagador.toLowerCase() === p.toLowerCase()
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPagador('__novo__')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  pagador === '__novo__'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                + Outro
              </button>
            </div>

            {pagador === '__novo__' && (
              <input
                type="text"
                value={novoPagador}
                onChange={(e) => setNovoPagador(e.target.value)}
                placeholder="Digite o nome do novo pagador"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
                autoFocus
              />
            )}
          </div>

          {/* Botões */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition-all shadow-md shadow-sky-500/20 active:scale-95 cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
