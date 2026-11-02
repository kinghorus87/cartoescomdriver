import React, { useState } from 'react';
import { CloudDownload, CloudUpload, LoaderCircle } from 'lucide-react';
import { SeedData } from '../types';
import { loadBackupFromGoogleDrive, saveBackupToGoogleDrive } from '../utils/googleDrive';
import { ModalConfirmacao } from './ModalConfirmacao';

interface GoogleDriveBackupProps {
  appData: SeedData;
  onUpdateAppData: (data: SeedData) => void;
}

const configured = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim());

export const GoogleDriveBackup: React.FC<GoogleDriveBackupProps> = ({ appData, onUpdateAppData }) => {
  const [busy, setBusy] = useState<'save' | 'load' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<SeedData | null>(null);
  const supported = configured;

  const handleSave = async () => {
    setBusy('save');
    setFeedback(null);
    try {
      await saveBackupToGoogleDrive(appData);
      setFeedback({ text: 'Cópia atualizada no Google Drive.' });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível salvar no Google Drive.', error: true });
    } finally {
      setBusy(null);
    }
  };

  const handleLoad = async () => {
    setBusy('load');
    setFeedback(null);
    try {
      const backup = await loadBackupFromGoogleDrive();
      setPendingRestore(backup.data);
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'Não foi possível carregar do Google Drive.', error: true });
    } finally {
      setBusy(null);
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    onUpdateAppData(pendingRestore);
    setPendingRestore(null);
    setFeedback({ text: 'Dados restaurados do Google Drive.' });
  };

  return (
    <section className="p-4 rounded-2xl border border-sky-500/25 bg-sky-500/5 space-y-3">
      <div>
        <h4 className="text-sm font-bold text-white">Cópia de segurança no Google Drive</h4>
        <p className="text-xs text-slate-400 mt-1">
          Salva ou restaura um arquivo chamado <strong>Cartões - backup.json</strong> na sua conta. A sincronização é manual.
        </p>
      </div>

      {!supported && (
        <p className="text-xs text-amber-300">
          A conexão precisa de um ID OAuth do Google. Consulte GOOGLE_DRIVE_SETUP.md.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!supported || Boolean(busy)}
          className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2"
        >
          {busy === 'save' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          Salvar cópia no Drive
        </button>
        <button
          type="button"
          onClick={handleLoad}
          disabled={!supported || Boolean(busy)}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2 border border-slate-700"
        >
          {busy === 'load' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
          Restaurar do Drive
        </button>
      </div>

      {feedback && (
        <p className={`text-xs ${feedback.error ? 'text-rose-300' : 'text-emerald-300'}`} role="status">
          {feedback.text}
        </p>
      )}

      <ModalConfirmacao
        isOpen={Boolean(pendingRestore)}
        title="Restaurar dados do Google Drive?"
        message="Os dados atuais deste Cartões serão substituídos pelos dados do backup. Deseja continuar?"
        confirmLabel="Restaurar"
        cancelLabel="Cancelar"
        onConfirm={confirmRestore}
        onClose={() => setPendingRestore(null)}
      />
    </section>
  );
};
