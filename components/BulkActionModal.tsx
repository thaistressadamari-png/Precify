import React, { useState } from 'react';

interface BulkActionModalProps {
  isOpen: boolean;
  action: 'extend' | 'subscribe';
  selectedCount: number;
  onClose: () => void;
  onConfirm: (action: 'extend' | 'subscribe', value?: any) => void;
  loading: boolean;
}

export const BulkActionModal: React.FC<BulkActionModalProps> = ({ isOpen, action, selectedCount, onClose, onConfirm, loading }) => {
  const [days, setDays] = useState(7);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (action === 'extend') {
      if (days > 0) {
        onConfirm('extend', days);
      } else {
        alert("Por favor, insira um número de dias válido.");
      }
    } else {
      onConfirm('subscribe');
    }
  };

  const title = action === 'extend' ? 'Prorrogar Período de Teste' : 'Confirmar Assinatura';
  const confirmText = action === 'extend' ? `Prorrogar Teste para ${selectedCount} usuários` : `Confirmar para ${selectedCount} usuários`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 text-center">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-2">{title}</h2>
        <p className="text-brand-light-text dark:text-gray-400 mb-6">
          Você está prestes a modificar <strong className="text-brand-text dark:text-gray-200">{selectedCount}</strong> usuários selecionados.
        </p>

        {action === 'extend' && (
          <div className="mb-6 text-left">
            <label htmlFor="days" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Dias a adicionar ao teste</label>
            <input
              type="number"
              id="days"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
              min="1"
              step="1"
            />
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-6 rounded-lg shadow-md"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-6 rounded-lg shadow-md disabled:bg-rose-300"
          >
            {loading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};