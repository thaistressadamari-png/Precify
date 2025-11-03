import React from 'react';

interface AdminChoicePageProps {
  onGoToApp: () => void;
  onGoToAdmin: () => void;
}

export const AdminChoicePage: React.FC<AdminChoicePageProps> = ({ onGoToApp, onGoToAdmin }) => {
  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-w-md mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
        <h1 className="font-display text-3xl font-bold text-brand-primary mb-4">Bem-vindo, Admin!</h1>
        <p className="text-brand-light-text dark:text-gray-400 mb-8">Para onde você gostaria de ir?</p>
        <div className="space-y-4">
          <button onClick={onGoToApp} className="w-full bg-brand-secondary hover:bg-pink-500 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            Ir para o Precify
          </button>
          <button onClick={onGoToAdmin} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            Ir para o Painel de Gerenciamento
          </button>
        </div>
      </div>
    </div>
  );
};
