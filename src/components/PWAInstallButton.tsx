import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { DownloadCloud, Smartphone, X, Check } from 'lucide-react';

export const PWAInstallButton: React.FC<{ accentColor?: string }> = ({ accentColor = '#38bdf8' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Instalar aplicativo (PWA)"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <DownloadCloud className="w-4 h-4" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Instalar no iPhone / iPad"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-all cursor-pointer"
        >
          <Smartphone className="w-4 h-4" />
          <span className="hidden sm:inline">Instalar no iOS</span>
          <span className="sm:hidden">App iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-white animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-sky-400" />
                  <h3 className="font-semibold text-sm">Instalar no iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px]">1</span>
                  <p>Toque no botão <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima) na barra do Safari.</p>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px]">2</span>
                  <p>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</p>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[11px]">
                    <Check className="w-3 h-3" />
                  </span>
                  <p>Pronto! O app abrirá como um aplicativo nativo em tela cheia.</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
