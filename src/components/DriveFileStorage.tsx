import React, { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, FileJson, LoaderCircle, RefreshCw, Save, Unplug } from 'lucide-react';
import { SeedData } from '../types';
import {
  activateFileWithCurrentData,
  activateFileWithExistingData,
  chooseExistingDataFile,
  chooseNewDataFile,
  DataFileStatus,
  disconnectDataFile,
  getDataFileStatus,
  PendingDataFile,
  requestSavedDataFile,
} from '../utils/browserStorage';
import { ModalConfirmacao } from './ModalConfirmacao';

interface DriveFileStorageProps {
  appData: SeedData;
  onUpdateAppData: (data: SeedData) => void;
}

const defaultStatus: DataFileStatus = { state: 'not-connected' };

export const DriveFileStorage: React.FC<DriveFileStorageProps> = ({ appData, onUpdateAppData }) => {
  const [status, setStatus] = useState<DataFileStatus>(defaultStatus);
  const [pending, setPending] = useState<PendingDataFile | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  const refreshStatus = async () => {
    try { setStatus(await getDataFileStatus()); } catch { setStatus(defaultStatus); }
  };

  useEffect(() => {
    void refreshStatus();
    const handleStatusChange = () => void refreshStatus();
    window.addEventListener('cartoes:data-file-status-change', handleStatusChange);
    return () => window.removeEventListener('cartoes:data-file-status-change', handleStatusChange);
  }, []);

  const chooseFile = async (create: boolean) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = create ? await chooseNewDataFile() : await chooseExistingDataFile();
      setPending(result);
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível selecionar o arquivo.', error: true });
      }
    } finally { setBusy(false); }
  };

  const reconnect = async () => {
    setBusy(true);
    setFeedback(null);
    try { setPending(await requestSavedDataFile()); }
    catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível acessar o arquivo salvo.', error: true });
      await refreshStatus();
    } finally { setBusy(false); }
  };

  const loadFile = async () => {
    if (!pending?.data) return;
    setBusy(true);
    try {
      const loaded = await activateFileWithExistingData(pending);
      onUpdateAppData(loaded);
      setPending(null);
      setFeedback({ text: 'Dados carregados do arquivo selecionado.' });
      await refreshStatus();
    } catch (error) { setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível carregar o arquivo.', error: true }); }
    finally { setBusy(false); }
  };

  const saveCurrentDataToFile = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await activateFileWithCurrentData(pending, appData);
      setPending(null);
      setConfirmReplaceOpen(false);
      setFeedback({ text: 'Arquivo conectado e atualizado com os dados atuais.' });
      await refreshStatus();
    } catch (error) { setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível gravar o arquivo.', error: true }); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    try {
      await disconnectDataFile();
      setFeedback({ text: 'Arquivo desconectado. Ele continua no local escolhido.' });
      await refreshStatus();
    } catch (error) { setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível desconectar o arquivo.', error: true }); }
  };

  const statusText: Record<DataFileStatus['state'], string> = {
    unsupported: 'Este navegador não oferece acesso direto a arquivos. Use Chrome ou Edge em localhost ou HTTPS.',
    'not-connected': 'Os dados ficam neste navegador até você escolher um arquivo local.',
    connected: `Conectado: ${status.fileName} — alterações são salvas automaticamente.`,
    'permission-required': `Autorize novamente o acesso a ${status.fileName}.`,
    'missing-file': `O arquivo ${status.fileName} não está mais disponível no local salvo.`,
    'empty-file': `O arquivo ${status.fileName} está vazio. Você pode gravar nele os dados atuais.`,
    'invalid-file': `O arquivo ${status.fileName} não contém dados válidos do Cartões.`,
  };
  const needsReconnect = status.state === 'permission-required' || status.state === 'missing-file';

  return (
    <section className="p-4 rounded-2xl border border-sky-500/25 bg-sky-500/5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-300 border border-sky-500/20 shrink-0"><Cloud className="w-4 h-4" /></div>
        <div>
          <h4 className="text-sm font-bold text-white">Arquivo local de dados</h4>
          <p className="text-xs text-slate-400 mt-1">Escolha um arquivo JSON em qualquer pasta do computador. Para sincronizar entre PCs, escolha-o dentro da pasta sincronizada pelo Google Drive para computador.</p>
        </div>
      </div>

      <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${status.state === 'connected' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : status.state === 'invalid-file' ? 'bg-rose-500/10 border-rose-500/25 text-rose-300' : 'bg-slate-900/70 border-slate-700 text-slate-300'}`}>
        {status.state === 'invalid-file' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <FileJson className="w-4 h-4 shrink-0" />}
        <span>{statusText[status.state]}</span>
      </div>

      {status.lastWriteError && <p className="text-xs text-rose-300" role="alert">Falha ao gravar no arquivo: {status.lastWriteError}</p>}

      {status.state !== 'unsupported' && <div className="flex flex-wrap gap-2">
        {needsReconnect ? (
          <button type="button" onClick={reconnect} disabled={busy} className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2">
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Reconectar arquivo
          </button>
        ) : <>
          <button type="button" onClick={() => void chooseFile(false)} disabled={busy} className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2">
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />} Selecionar arquivo existente
          </button>
          <button type="button" onClick={() => void chooseFile(true)} disabled={busy} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center gap-2">
            <Save className="w-4 h-4" /> Criar ou escolher local do arquivo
          </button>
        </>}
        {status.state !== 'not-connected' && <button type="button" onClick={disconnect} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700"><Unplug className="w-4 h-4" /> Desconectar</button>}
      </div>}

      {pending && <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2.5">
        <p className="text-xs text-amber-200">{pending.data ? `O arquivo ${pending.file.name} já contém dados. Escolha qual versão manter.` : pending.invalidFile ? `O arquivo ${pending.file.name} não parece ser um JSON válido do Cartões. Você pode substituí-lo após confirmar.` : `O arquivo ${pending.file.name} está vazio. Você pode gravar nele os dados atuais.`}</p>
        <div className="flex flex-wrap gap-2">
          {pending.data && <button type="button" onClick={loadFile} disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold">Carregar arquivo</button>}
          {pending.data || pending.invalidFile ? <button type="button" onClick={() => setConfirmReplaceOpen(true)} disabled={busy} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-semibold border border-slate-700">Substituir pelo atual</button> : <button type="button" onClick={saveCurrentDataToFile} disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold">Gravar dados atuais no arquivo</button>}
          <button type="button" onClick={() => setPending(null)} disabled={busy} className="px-3 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-semibold">Cancelar</button>
        </div>
      </div>}

      {feedback && <p className={`text-xs ${feedback.error ? 'text-rose-300' : 'text-emerald-300'}`} role="status">{feedback.text}</p>}
      <p className="text-[11px] text-slate-500">O navegador pode ocultar o caminho completo e pedir autorização novamente em cada computador. Em celulares, use a importação e exportação JSON. Evite abrir e editar o mesmo arquivo simultaneamente em dois dispositivos.</p>

      <ModalConfirmacao
        isOpen={confirmReplaceOpen}
        title="Substituir o arquivo selecionado?"
        message={`O conteúdo atual de ${pending?.file.name || 'arquivo'} será substituído pelos dados deste navegador. Deseja continuar?`}
        confirmLabel="Substituir arquivo"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={saveCurrentDataToFile}
        onClose={() => setConfirmReplaceOpen(false)}
      />
    </section>
  );
};
