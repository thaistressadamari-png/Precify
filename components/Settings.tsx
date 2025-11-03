import React, { useState, useEffect } from 'react';
import type { AppSettings, User } from '../types';
import { auth } from './firebase';
import { updateProfile, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updateEmail } from 'firebase/auth';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  user: User;
  onUserUpdate: (updatedData: Partial<User>) => Promise<void>;
}

const inputFieldClasses = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary";
const buttonClasses = "bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:bg-rose-300 disabled:cursor-not-allowed";

interface PasswordPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  loading: boolean;
}

const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({ isOpen, onClose, onConfirm, loading }) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      onConfirm(password);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in z-50">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <h2 className="font-display text-xl text-brand-text dark:text-rose-100 mb-2">Confirme sua identidade</h2>
        <p className="text-brand-light-text dark:text-gray-400 mb-4 text-sm">Por segurança, por favor, insira sua senha atual para continuar.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputFieldClasses}
          placeholder="Sua senha"
          autoFocus
          required
        />
        <div className="flex justify-center gap-4 mt-6">
          <button type="button" onClick={onClose} disabled={loading} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className={buttonClasses}>
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  );
};


export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, user, onUserUpdate }) => {
  const [name, setName] = useState(user.name);
  const [newEmail, setNewEmail] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  
  const [nameLoading, setNameLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);
  
  const handleSettingsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onUpdateSettings({ ...settings, [name]: parseFloat(value) || 0 });
  };

  const handleSaveName = async () => {
    if (!auth.currentUser || name.trim() === '' || name.trim() === user.name) return;
    setNameLoading(true);
    try {
        await updateProfile(auth.currentUser, { displayName: name.trim() });
        await onUserUpdate({ name: name.trim() });
        alert('Nome atualizado com sucesso!');
    } catch (error) {
        alert('Ocorreu um erro ao atualizar o nome.');
        console.error("Error updating name:", error);
    } finally {
        setNameLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    setPasswordLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert('Um e-mail para redefinição de senha foi enviado para seu endereço. Verifique sua caixa de entrada e spam.');
    } catch (error) {
      alert('Ocorreu um erro ao enviar o e-mail de redefinição.');
      console.error("Error sending password reset email:", error);
    } finally {
        setPasswordLoading(false);
    }
  };

  const handleInitiateEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail && newEmail !== user.email) {
      setShowPasswordPrompt(true);
    } else {
      alert("Por favor, insira um e-mail diferente do atual.");
    }
  };

  const handleConfirmEmailChange = async (password: string) => {
    if (!auth.currentUser || !password || !newEmail) {
      alert("Senha ou e-mail inválido.");
      return;
    }
    setEmailLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      await updateEmail(auth.currentUser, newEmail);
      await onUserUpdate({ email: newEmail });

      alert("E-mail atualizado com sucesso! Um e-mail de verificação foi enviado para o novo endereço.");
      setShowPasswordPrompt(false);
      setNewEmail('');
    } catch (error: any) {
      setShowPasswordPrompt(false);
      if (error.code === 'auth/wrong-password') {
        alert("Senha incorreta. Tente novamente.");
      } else if (error.code === 'auth/email-already-in-use') {
        alert("Este e-mail já está em uso por outra conta.");
      } else {
        alert("Ocorreu um erro ao atualizar o e-mail.");
      }
      console.error(error);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <>
    <div className="space-y-8 animate-fade-in">
      <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">Configurações</h1>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Gerenciamento da Conta</h2>
        <div className="space-y-6">
          {/* Name Change */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label htmlFor="userName" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Nome Completo</label>
              <input type="text" id="userName" value={name} onChange={(e) => setName(e.target.value)} className={inputFieldClasses} />
            </div>
            <button onClick={handleSaveName} disabled={nameLoading || name === user.name} className={buttonClasses}>
              {nameLoading ? 'Salvando...' : 'Salvar Nome'}
            </button>
          </div>

          {/* Email Change */}
          <form onSubmit={handleInitiateEmailChange} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label htmlFor="userEmail" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">E-mail</label>
              <input type="email" id="userEmail" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputFieldClasses} placeholder={user.email} />
            </div>
            <button type="submit" disabled={emailLoading || !newEmail || newEmail === user.email} className={buttonClasses}>
              {emailLoading ? 'Alterando...' : 'Alterar E-mail'}
            </button>
          </form>

          {/* Password Change */}
          <div>
            <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Senha</label>
            <button onClick={handlePasswordReset} disabled={passwordLoading} className={`${buttonClasses} mt-1 w-full md:w-auto`}>
              {passwordLoading ? 'Enviando e-mail...' : 'Alterar Senha'}
            </button>
            <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Um link para redefinição será enviado para seu e-mail.</p>
          </div>

        </div>
      </div>
      
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Custos, Fiscais e Alertas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
                <label htmlFor="laborCostPerHour" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Custo da Hora de Trabalho (R$/h)</label>
                <input type="number" name="laborCostPerHour" id="laborCostPerHour" value={settings.laborCostPerHour || ''} onChange={handleSettingsInputChange} className={inputFieldClasses} placeholder="15,00" step="0.01" min="0"/>
            </div>
             <div>
                <label htmlFor="kwhPrice" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Custo do kWh de Energia (R$)</label>
                <input type="number" name="kwhPrice" id="kwhPrice" value={settings.kwhPrice || ''} onChange={handleSettingsInputChange} className={inputFieldClasses} placeholder="1,20" step="0.01" min="0"/>
            </div>
             <div>
                <label htmlFor="gasCanisterPrice" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Preço do Botijão de Gás (13kg, R$)</label>
                <input type="number" name="gasCanisterPrice" id="gasCanisterPrice" value={settings.gasCanisterPrice || ''} onChange={handleSettingsInputChange} className={inputFieldClasses} placeholder="120,00" step="0.01" min="0"/>
                 <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Baseado em ~60h de uso.</p>
            </div>
            <div>
                <label htmlFor="taxPercentage" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Imposto (%)</label>
                <input type="number" name="taxPercentage" id="taxPercentage" value={settings.taxPercentage || ''} onChange={handleSettingsInputChange} className={inputFieldClasses} placeholder="8" step="0.01" min="0"/>
                <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Alíquota de imposto (ex: SIMPLES Nacional) que incide sobre o PREÇO DE VENDA FINAL.</p>
            </div>
            <div>
                <label htmlFor="ingredientOutdatedDays" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Notificar preço desatualizado (dias)</label>
                <input type="number" name="ingredientOutdatedDays" id="ingredientOutdatedDays" value={settings.ingredientOutdatedDays || ''} onChange={handleSettingsInputChange} className={inputFieldClasses} placeholder="45" step="1" min="1"/>
                <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Avisar se um ingrediente não for atualizado por mais de X dias.</p>
            </div>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Fórmulas Utilizadas</h2>
        <div className="space-y-4 text-sm text-brand-light-text dark:text-gray-300">
            <div className="p-4 bg-rose-50 dark:bg-gray-700/50 rounded-lg border border-rose-100 dark:border-gray-600">
                <p className="font-semibold text-brand-text dark:text-gray-100">1. Custo de Produção (CP)</p>
                <p className="mt-1">É a soma de todos os custos diretos para fazer a receita.</p>
                <code className="block bg-rose-100 dark:bg-gray-600 p-2 rounded-md my-1 text-brand-text dark:text-rose-100 text-xs md:text-sm">CP = Custo dos Ingredientes + Embalagens + Mão de Obra + Energia + Gás</code>
            </div>
            <div className="p-4 bg-rose-50 dark:bg-gray-700/50 rounded-lg border border-rose-100 dark:border-gray-600">
                <p className="font-semibold text-brand-text dark:text-gray-100">2. Preço de Venda Final (PV)</p>
                <p className="mt-1">A fórmula embute os custos percentuais (impostos, taxas) no preço final para garantir que seu lucro desejado seja líquido.</p>
                <code className="block bg-rose-100 dark:bg-gray-600 p-2 rounded-md my-1 text-brand-text dark:text-rose-100 text-xs md:text-sm">PV = (CP * (1 + %Lucro)) / (1 - %Impostos - %Custos Variáveis)</code>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">O lucro é calculado sobre o Custo de Produção, e o resultado é dividido pela fração restante após descontar os custos percentuais, ajustando o preço "para cima".</p>
            </div>
            <div className="p-4 bg-rose-50 dark:bg-gray-700/50 rounded-lg border border-rose-100 dark:border-gray-600">
                <p className="font-semibold text-brand-text dark:text-gray-100">Recheios e Bases</p>
                <p className="mt-1">Para recheios, o sistema calcula apenas o <strong>Custo de Produção (CP)</strong>. Impostos e lucro são aplicados somente na receita final que utiliza esse recheio, evitando dupla taxação.</p>
            </div>
        </div>
      </div>

    </div>
    <PasswordPromptModal 
        isOpen={showPasswordPrompt}
        onClose={() => setShowPasswordPrompt(false)}
        onConfirm={handleConfirmEmailChange}
        loading={emailLoading}
    />
    </>
  );
};
