import React, { useEffect, useState } from 'react';
import { PackageCheck, Volume2, VolumeX, LogOut, ChevronLeft, Truck, Maximize, Minimize } from 'lucide-react';
import { ActiveTab, CargoInspection, UserSession } from '../types';

interface NavbarProps {
  currentTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onResumeConference: () => void;
  user: UserSession;
  onLogout: () => void;
  activeInspection?: CargoInspection | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigate,
  onResumeConference,
  user,
  onLogout,
  activeInspection,
  soundEnabled,
  onToggleSound,
}) => {
  // Tela cheia via Fullscreen API; acompanha também a saída pela tecla Esc / gesto do sistema
  const fullscreenSupported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch (err) {
      console.warn('Tela cheia indisponível:', err);
    }
  };

  const getTabTitle = (tab: ActiveTab) => {
    switch (tab) {
      case 'select_load':
        return '1. Selecionar Carga';
      case 'load_list':
        return '3. Lista de Carga';
      case 'load_inspection':
        return '2. Conferência de Carga';
      case 'billing_inspection':
        return '4. Conferência Faturamento';
      case 'history':
        return '5. Histórico de DTs';
      case 'settings':
        return '6. Configurações';
      default:
        return 'Menu Principal';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        {/* Left Side: Brand or Back */}
        <div className="flex items-center space-x-2">
          {currentTab !== 'home' ? (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="h-10 pl-2 pr-3 sm:pl-2.5 sm:pr-4 -ml-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 active:scale-95 flex items-center gap-1 transition-colors"
              title="Voltar ao Menu Principal"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="text-sm font-bold">Menu</span>
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <PackageCheck className="w-5 h-5 text-slate-900" />
            </div>
          )}

          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Carga<span className="text-amber-400">Check</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono font-bold">
                WMS
              </span>
            </div>
            {currentTab !== 'home' && (
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[150px] sm:max-w-none">
                {getTabTitle(currentTab)}
              </p>
            )}
          </div>
        </div>

        {/* Center: Active load pill if in inspection */}
        {activeInspection && currentTab !== 'load_inspection' && (
          <button
            type="button"
            onClick={onResumeConference}
            className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <Truck className="w-3.5 h-3.5" />
            <span>Carga Ativa: {activeInspection.dt} ({activeInspection.placa})</span>
          </button>
        )}

        {/* Right Side: Sound Toggle & User session */}
        <div className="flex items-center space-x-2">
          {/* Tela cheia (some nos navegadores sem suporte, ex.: Safari do iPhone) */}
          {fullscreenSupported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Exibir em tela cheia'}
              className={`p-2 rounded-xl text-xs transition-colors ${
                isFullscreen ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          )}

          {/* Sound Mute/Unmute */}
          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Som do Scanner Ativado' : 'Som do Scanner Desativado'}
            className={`p-2 rounded-xl text-xs transition-colors ${
              soundEnabled
                ? 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                : 'bg-slate-800/60 text-slate-500 hover:bg-slate-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* User Badge */}
          <div className="flex items-center pl-1 sm:pl-2 border-l border-slate-800 space-x-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shadow-inner">
              {user.avatar || '👷'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-200 leading-tight truncate max-w-[110px]">{user.name}</p>
              <p className="text-[10px] text-amber-400 font-mono leading-tight">{user.matricula}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Sair do Sistema"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
