import React, { useState } from 'react';

interface FeedbackModalProps {
  onSubmit: (feedback: string) => void;
  loading: boolean;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ onSubmit, loading }) => {
  const [feedback, setFeedback] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.trim()) {
      onSubmit(feedback);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-8">
        <h2 className="font-display text-3xl text-brand-text dark:text-rose-100 mb-2 text-center">Seu período de testes acabou!</h2>
        <p className="text-brand-light-text dark:text-gray-400 mb-6 text-center">
          Adoraríamos saber sua opinião para continuar melhorando o Precify. Por favor, conte-nos o que achou da plataforma.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="O que você mais gostou? O que podemos melhorar? Sua opinião é muito importante!"
            className="w-full h-32 p-3 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary resize-none"
            required
            minLength={10}
          />
          <button
            type="submit"
            disabled={loading || feedback.trim().length < 10}
            className="mt-4 w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-brand-primary hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-transform transform hover:scale-105 disabled:bg-rose-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Enviar Feedback e Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
};
