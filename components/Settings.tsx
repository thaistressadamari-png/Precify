import React from 'react';
import type { AppSettings } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const inputFieldClasses = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary";

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings }) => {
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onUpdateSettings({ ...settings, [name]: parseFloat(value) || 0 });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">Configurações</h1>
      
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Custos, Fiscais e Alertas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
                <label htmlFor="laborCostPerHour" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Custo da Hora de Trabalho (R$/h)</label>
                <input type="number" name="laborCostPerHour" id="laborCostPerHour" value={settings.laborCostPerHour || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="15,00" step="0.01" min="0"/>
            </div>
             <div>
                <label htmlFor="kwhPrice" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Custo do kWh de Energia (R$)</label>
                <input type="number" name="kwhPrice" id="kwhPrice" value={settings.kwhPrice || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="1,20" step="0.01" min="0"/>
            </div>
             <div>
                <label htmlFor="gasCanisterPrice" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Preço do Botijão de Gás (13kg, R$)</label>
                <input type="number" name="gasCanisterPrice" id="gasCanisterPrice" value={settings.gasCanisterPrice || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="120,00" step="0.01" min="0"/>
                 <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Baseado em ~60h de uso.</p>
            </div>
            <div>
                <label htmlFor="taxPercentage" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Imposto (%)</label>
                <input type="number" name="taxPercentage" id="taxPercentage" value={settings.taxPercentage || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="8" step="0.01" min="0"/>
                <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Alíquota de imposto (ex: SIMPLES Nacional) que incide sobre o PREÇO DE VENDA FINAL.</p>
            </div>
            <div>
                <label htmlFor="ingredientOutdatedDays" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Notificar preço desatualizado (dias)</label>
                <input type="number" name="ingredientOutdatedDays" id="ingredientOutdatedDays" value={settings.ingredientOutdatedDays || ''} onChange={handleInputChange} className={inputFieldClasses} placeholder="45" step="1" min="1"/>
                <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Avisar se um ingrediente não for atualizado por mais de X dias.</p>
            </div>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Fórmulas Utilizadas</h2>
        <div className="space-y-4 text-sm text-brand-light-text dark:text-gray-300">
          <div className="p-4 bg-rose-50 dark:bg-gray-700/50 rounded-lg border border-rose-100 dark:border-gray-600">
            <p className="font-semibold text-brand-text dark:text-gray-100">Preço de Venda da Receita</p>
            <code className="block bg-rose-100 dark:bg-gray-600 p-2 rounded-md my-1 text-brand-text dark:text-rose-100 text-xs md:text-sm">Preço = Custo de Produção * (1 + %Lucro) / (1 - %Impostos - %Custos Variáveis)</code>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">"Custo de Produção" é a soma de todos os custos diretos. Impostos e custos variáveis são calculados sobre o preço de venda final para garantir a margem de lucro desejada.</p>
          </div>
          <div className="p-4 bg-rose-50 dark:bg-gray-700/50 rounded-lg border border-rose-100 dark:border-gray-600">
            <p className="font-semibold text-brand-text dark:text-gray-100">Custo Total do Recheio</p>
            <code className="block bg-rose-100 dark:bg-gray-600 p-2 rounded-md my-1 text-brand-text dark:text-rose-100 text-xs md:text-sm">Custo de Produção (sem impostos ou taxas)</code>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Para recheios, o imposto não é aplicado diretamente, pois ele se tornará parte do custo da receita final que o utiliza.</p>
          </div>
        </div>
      </div>

    </div>
  );
};