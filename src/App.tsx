/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ActiveTab, 
  CargoInspection, 
  UserSession, 
  AppSettings, 
  SheetRowDT, 
  SheetRowFAT 
} from './types';
import { storageService } from './services/storage';
import { playBeep } from './services/sound';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { HomeScreen } from './components/HomeScreen';
import { SelectLoadScreen } from './components/SelectLoadScreen';
import { LoadListScreen } from './components/LoadListScreen';
import { LoadInspectionScreen } from './components/LoadInspectionScreen';
import { BillingInspectionScreen } from './components/BillingInspectionScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { HistoryScreen } from './components/HistoryScreen';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    return storageService.getUserSession();
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    return storageService.getSettings();
  });

  const [inspections, setInspections] = useState<CargoInspection[]>(() => {
    return storageService.getInspections();
  });

  const [sheetRowsDT, setSheetRowsDT] = useState<SheetRowDT[]>(() => {
    return storageService.getSheetDT();
  });

  const [sheetRowsFAT, setSheetRowsFAT] = useState<SheetRowFAT[]>(() => {
    return storageService.getSheetFAT();
  });

  const [currentTab, setCurrentTab] = useState<ActiveTab>('home');
  const [activeInspectionId, setActiveInspectionId] = useState<string | null>(() => {
    return storageService.getActiveInspectionId();
  });

  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync state changes with storage
  useEffect(() => {
    if (user) {
      storageService.saveUserSession(user);
    } else {
      storageService.clearUserSession();
    }
  }, [user]);

  useEffect(() => {
    storageService.saveSettings(settings);
    setSoundEnabled(settings.beepSoundEnabled);
  }, [settings]);

  // Avisa quando o navegador não tem mais espaço para salvar (ex.: muitas fotos)
  const [storageFull, setStorageFull] = useState(false);
  useEffect(() => {
    setStorageFull(!storageService.saveInspections(inspections));
  }, [inspections]);

  useEffect(() => {
    storageService.saveSheetDT(sheetRowsDT);
  }, [sheetRowsDT]);

  useEffect(() => {
    storageService.saveSheetFAT(sheetRowsFAT);
  }, [sheetRowsFAT]);

  useEffect(() => {
    storageService.setActiveInspectionId(activeInspectionId);
  }, [activeInspectionId]);

  // Active inspection getter
  const activeInspection = inspections.find((i) => i.id === activeInspectionId) || null;

  // Cada etapa só enxerga as DTs da própria etapa:
  // Conferência de Carga = em conferência; Faturamento = carga finalizada (ainda não faturada)
  const activeConference = activeInspection?.status === 'em_conferencia' ? activeInspection : null;
  const billingTarget = activeInspection?.status === 'concluido' ? activeInspection : null;

  // DTs da planilha LISTA DT que ainda não iniciaram conferência (etapa 1)
  const availableRows = sheetRowsDT.filter(
    (r) => !inspections.some((i) => i.dt.toUpperCase() === r.dt.toUpperCase())
  );
  const availableDtCount = new Set(availableRows.map((r) => r.dt.toUpperCase())).size;
  const availableVolume = availableRows.reduce((a, r) => a + r.quantidade, 0);

  // Ao entrar pelo menu, Tópicos 3 e 4 abrem na lista de DTs da etapa
  const [showConferenceList, setShowConferenceList] = useState(false);
  const [openBillingDirect, setOpenBillingDirect] = useState(false);

  const navigateTo = (tab: ActiveTab) => {
    if (tab === 'load_inspection') setShowConferenceList(true);
    if (tab === 'billing_inspection') setOpenBillingDirect(false);
    setCurrentTab(tab);
  };

  // Handlers
  const handleLogin = (newUser: UserSession) => {
    setUser(newUser);
    playBeep('success', soundEnabled);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentTab('home');
    storageService.clearUserSession();
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSettings((prev) => ({ ...prev, beepSoundEnabled: next }));
  };

  // 1. When load is selected from QR code or DT search
  const handleLoadSelected = (inspection: CargoInspection) => {
    // Add to list if not existing or update
    const existingIndex = inspections.findIndex((i) => i.id === inspection.id || i.dt === inspection.dt);
    let updatedList: CargoInspection[];

    if (existingIndex >= 0) {
      updatedList = inspections.map((i, idx) => (idx === existingIndex ? inspection : i));
    } else {
      updatedList = [inspection, ...inspections];
    }

    setInspections(updatedList);
    setActiveInspectionId(inspection.id);
    // Directly go to Screen 3: Conferência de Carga
    setShowConferenceList(false);
    setCurrentTab('load_inspection');
  };

  // 2. Select inspection from list
  const handleSelectFromList = (inspection: CargoInspection) => {
    setActiveInspectionId(inspection.id);
    setShowConferenceList(false);
    setCurrentTab('load_inspection');
  };

  // 3. Update active inspection during conference
  const handleUpdateInspection = (updated: CargoInspection) => {
    const next = inspections.map((i) => (i.id === updated.id ? updated : i));
    setInspections(next);
  };

  // 3. Finish load inspection
  const handleFinishInspection = (finished: CargoInspection) => {
    handleUpdateInspection(finished);
  };

  // 4. Navigate to billing for a specific inspection
  const handleNavigateBilling = (inspection: CargoInspection) => {
    setActiveInspectionId(inspection.id);
    setOpenBillingDirect(true);
    setCurrentTab('billing_inspection');
  };

  // Reset all data
  const handleResetAllData = () => {
    storageService.resetAllData();
    setSettings(storageService.getSettings());
    setInspections(storageService.getInspections());
    setSheetRowsDT(storageService.getSheetDT());
    setSheetRowsFAT(storageService.getSheetFAT());
    setUser(storageService.getUserSession());
    setActiveInspectionId(null);
    setCurrentTab('home');
    playBeep('success', true);
  };

  // Unauthenticated screen
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased font-sans">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onNavigate={navigateTo}
        onResumeConference={() => activeConference && handleSelectFromList(activeConference)}
        user={user}
        onLogout={handleLogout}
        activeInspection={activeConference}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16 sm:pb-8">
        {storageFull && (
          <div className="max-w-5xl mx-auto px-4 pt-4">
            <div className="bg-rose-600 text-white rounded-2xl px-4 py-3 text-xs font-bold">
              ⚠ Armazenamento do navegador cheio: as últimas alterações (provavelmente fotos) NÃO foram salvas e
              serão perdidas ao recarregar. Remova fotos ou leituras desnecessárias, ou conclua e exporte DTs antigas.
            </div>
          </div>
        )}
        {currentTab === 'home' && (
          <HomeScreen
            onNavigate={navigateTo}
            onResumeConference={() => activeConference && handleSelectFromList(activeConference)}
            user={user}
            inspections={inspections}
            activeInspection={activeConference}
            availableDtCount={availableDtCount}
            availableVolume={availableVolume}
            skuCount={settings.deParaList.length}
          />
        )}

        {currentTab === 'select_load' && (
          <SelectLoadScreen
            onLoadSelected={handleLoadSelected}
            existingInspections={inspections}
            sheetRowsDT={sheetRowsDT}
            sheetDtUrl={settings.googleSheetListaDTUrl}
            onSyncSheetDT={(dt) => setSheetRowsDT(dt)}
            deParaList={settings.deParaList}
            clientNotes={settings.clientNotes}
            listaNegra={settings.listaNegra}
            user={user}
            soundEnabled={soundEnabled}
          />
        )}

        {currentTab === 'load_list' && (
          <LoadListScreen
            inspections={inspections}
            clientNotes={settings.clientNotes}
            listaNegra={settings.listaNegra}
            onSelectInspection={handleSelectFromList}
            onNavigateNewLoad={() => setCurrentTab('select_load')}
          />
        )}

        {currentTab === 'load_inspection' && (
          // A conferência aberta pela lista continua na tela até sair dela (inclusive o fluxo de
          // finalização com Book/e-mail); ao voltar pelo menu, a DT finalizada já não aparece na lista
          activeInspection && !showConferenceList ? (
            <LoadInspectionScreen
              key={activeInspection.id}
              inspection={activeInspection}
              onUpdateInspection={handleUpdateInspection}
              onFinishInspection={handleFinishInspection}
              onNavigateHome={() => setCurrentTab('home')}
              onNavigateBilling={handleNavigateBilling}
              settings={settings}
              user={user}
            />
          ) : (
            // Lista de DTs em conferência: ao tocar, abre o detalhe da conferência
            <LoadListScreen
              inspections={inspections}
              clientNotes={settings.clientNotes}
            listaNegra={settings.listaNegra}
              onSelectInspection={handleSelectFromList}
              onNavigateNewLoad={() => setCurrentTab('select_load')}
              headerTag="Tópico 2 • Execução de Pátio"
              title="Conferência de Carga — Selecione a DT"
              mode="em_processo"
            />
          )
        )}

        {currentTab === 'billing_inspection' && (
          <BillingInspectionScreen
            inspections={inspections}
            sheetRowsFAT={sheetRowsFAT}
            onSaveSheetFAT={(fat) => setSheetRowsFAT(fat)}
            onUpdateInspection={handleUpdateInspection}
            onReturnToConference={(reaberta) => {
              // Volta a DT para a etapa anterior e abre a conferência dela
              setInspections((prev) => prev.map((i) => (i.id === reaberta.id ? reaberta : i)));
              handleSelectFromList(reaberta);
            }}
            onNavigateHome={() => setCurrentTab('home')}
            settings={settings}
            user={user}
            initialInspection={openBillingDirect ? billingTarget : null}
          />
        )}

        {currentTab === 'history' && <HistoryScreen inspections={inspections} settings={settings} />}

        {currentTab === 'settings' && (
          <SettingsScreen
            settings={settings}
            onSaveSettings={(s) => setSettings(s)}
            sheetRowsDT={sheetRowsDT}
            onSaveSheetDT={(dt) => setSheetRowsDT(dt)}
            sheetRowsFAT={sheetRowsFAT}
            onSaveSheetFAT={(fat) => setSheetRowsFAT(fat)}
            onResetAllData={handleResetAllData}
          />
        )}
      </main>

      {/* Mobile Bottom Quick Bar for Fast Switching */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-lg">
        <button
          type="button"
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            currentTab === 'home' ? 'text-amber-600' : 'text-slate-500'
          }`}
        >
          <span className="text-base">🏠</span>
          <span>Início</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('select_load')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            currentTab === 'select_load' ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <span className="text-base">📥</span>
          <span>1. Carga</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('load_inspection')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            currentTab === 'load_inspection' ? 'text-emerald-600 font-black' : 'text-slate-500'
          }`}
        >
          <span className="text-base">📷</span>
          <span>2. Conferir</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('load_list')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            currentTab === 'load_list' ? 'text-amber-600' : 'text-slate-500'
          }`}
        >
          <span className="text-base">📋</span>
          <span>3. Lista</span>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('billing_inspection')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            currentTab === 'billing_inspection' ? 'text-purple-600' : 'text-slate-500'
          }`}
        >
          <span className="text-base">🧾</span>
          <span>4. Fat.</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('settings')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition-colors ${
            currentTab === 'settings' ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          <span className="text-base">⚙️</span>
          <span>6. Config</span>
        </button>
      </div>
    </div>
  );
}
