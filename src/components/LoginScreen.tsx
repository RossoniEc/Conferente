import React, { useState } from 'react';
import { PackageCheck, LogIn, Shield, User, KeyRound, Sparkles } from 'lucide-react';
import { UserSession } from '../types';

interface LoginScreenProps {
  onLogin: (user: UserSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [matricula, setMatricula] = useState('CONF-8842');
  const [nome, setNome] = useState('Carlos Eduardo Rossoni');
  const [senha, setSenha] = useState('123456');
  const [turno, setTurno] = useState('1º Turno (06:00 - 14:20)');
  const [role, setRole] = useState<'conferente' | 'supervisor' | 'expedicao'>('conferente');

  const presetUsers: UserSession[] = [
    {
      id: 'usr-1',
      name: 'Carlos Eduardo Rossoni',
      matricula: 'CONF-8842',
      role: 'conferente',
      avatar: '👨‍🏭',
      turno: '1º Turno (06:00 - 14:20)',
    },
    {
      id: 'usr-2',
      name: 'Ana Paula Mendes',
      matricula: 'CONF-7210',
      role: 'conferente',
      avatar: '👩‍🏭',
      turno: '2º Turno (14:00 - 22:20)',
    },
    {
      id: 'usr-3',
      name: 'Marcos Vinicius Souza',
      matricula: 'SUPER-0314',
      role: 'supervisor',
      avatar: '👷‍♂️',
      turno: 'Comercial / Geral',
    },
  ];

  const handleSelectPreset = (u: UserSession) => {
    setNome(u.name);
    setMatricula(u.matricula);
    setRole(u.role);
    if (u.turno) setTurno(u.turno);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !matricula.trim()) return;

    const user: UserSession = {
      id: `usr-${Date.now()}`,
      name: nome.trim(),
      matricula: matricula.trim().toUpperCase(),
      role,
      turno,
      avatar: role === 'supervisor' ? '👷‍♂️' : '👨‍🏭',
    };

    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-white">
      {/* Background Graphic Accents */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/25">
            <PackageCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Carga<span className="text-amber-400">Check</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Sistema Integrado de Conferência de Carga & Expedição
          </p>
        </div>

        {/* Quick Operator Badges */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-400" /> Operadores Rápidos:
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presetUsers.map((u) => {
              const isSelected = matricula === u.matricula;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectPreset(u)}
                  className={`p-2 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                      : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-xl mb-1">{u.avatar}</div>
                  <div className="text-xs font-bold truncate">{u.name.split(' ')[0]}</div>
                  <div className="text-[10px] font-mono text-amber-400">{u.matricula}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center">
              <User className="w-3.5 h-3.5 mr-1 text-amber-400" /> Nome do Conferente
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center">
                <Shield className="w-3.5 h-3.5 mr-1 text-amber-400" /> Matrícula / Crachá
              </label>
              <input
                type="text"
                required
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Ex: CONF-8842"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-amber-400 transition-colors uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center">
                <KeyRound className="w-3.5 h-3.5 mr-1 text-amber-400" /> PIN / Senha
              </label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Turno</label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="1º Turno (06:00 - 14:20)">1º Turno (06:00 - 14:20)</option>
                <option value="2º Turno (14:00 - 22:20)">2º Turno (14:00 - 22:20)</option>
                <option value="3º Turno (22:00 - 06:20)">3º Turno (22:00 - 06:20)</option>
                <option value="Comercial / Geral">Comercial / Geral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Perfil</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'conferente' | 'supervisor' | 'expedicao')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              >
                <option value="conferente">Conferente de Carga</option>
                <option value="supervisor">Supervisor de Armazém</option>
                <option value="expedicao">Expedição / Faturamento</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] text-slate-950 font-black rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 transition-all"
          >
            <LogIn className="w-5 h-5" />
            <span>ACESSAR SISTEMA</span>
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            Compatível com Coletores Android, Tablets industriais e Celulares.
          </p>
        </div>
      </div>
    </div>
  );
};
