import React from 'react';
import { ArrowRightOnRectangleIcon } from './icons/ArrowRightOnRectangleIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { User } from '../types';

interface SubscriptionPageProps {
  user: User;
  onPaymentConfirmationClick: () => void;
  onLogout: () => void;
}

const Feature: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-2 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300 rounded-full">
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <h3 className="font-semibold text-brand-text dark:text-rose-100">{title}</h3>
            <p className="text-sm text-brand-light-text dark:text-gray-400">{children}</p>
        </div>
    </div>
);

export const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ user, onPaymentConfirmationClick, onLogout }) => {
  const userName = user.name.split(' ')[0];
  
  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans animate-fade-in">
        <div className="absolute top-4 right-4">
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5"/>
              <span>Sair</span>
            </button>
        </div>
        <div className="w-full max-w-3xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 md:p-12 rounded-2xl shadow-2xl border border-rose-100 dark:border-gray-700 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-brand-text dark:text-white leading-tight mb-2">
                Obrigado pelo seu feedback, {userName}!
            </h1>
            <p className="text-lg text-brand-light-text dark:text-gray-300 mb-8">
                Continue no controle da sua confeitaria com o plano anual do Precify.
            </p>

            <div className="grid md:grid-cols-2 gap-6 text-left mb-8">
                <Feature icon={CalculatorIcon} title="Precificação Automática Ilimitada">
                    Crie e precifique quantas receitas e recheios precisar, sem limites.
                </Feature>
                <Feature icon={ClipboardListIcon} title="Controle Total de Ingredientes">
                    Gerencie todos os seus ingredientes, compras e fornecedores com um histórico completo.
                </Feature>
                <Feature icon={ChartBarIcon} title="Análise de Lucratividade">
                    Entenda de onde vem seu lucro com gráficos e relatórios detalhados por receita.
                </Feature>
                <Feature icon={DocumentArrowDownIcon} title="Fichas Técnicas em PDF">
                    Gere fichas técnicas profissionais para organizar sua produção e manter o padrão de qualidade.
                </Feature>
            </div>

            <div className="bg-rose-50 dark:bg-gray-700/50 p-6 rounded-xl border border-rose-200 dark:border-gray-600">
                <p className="font-display text-lg text-brand-text dark:text-rose-100">Acesso Anual Completo</p>
                <p className="font-display text-5xl font-bold text-brand-primary my-2">R$ 47,90</p>
                <p className="text-brand-light-text dark:text-gray-400">por ano</p>
            </div>
            
            <a 
              href="https://pay.kiwify.com.br/4ISfOEL"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block w-full max-w-sm bg-brand-primary hover:bg-rose-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-lg"
            >
              Quero Assinar Agora!
            </a>

            <div className="mt-6">
                <button 
                  onClick={onPaymentConfirmationClick} 
                  className="text-sm text-brand-light-text dark:text-gray-400 hover:text-brand-primary dark:hover:text-rose-300 underline disabled:text-gray-500 disabled:no-underline disabled:cursor-not-allowed"
                  disabled={user.paymentConfirmationClicked}
                >
                  {user.paymentConfirmationClicked ? 'Confirmação recebida, aguarde.' : 'Já paguei, liberar meu acesso'}
                </button>
            </div>

        </div>
    </div>
  );
};