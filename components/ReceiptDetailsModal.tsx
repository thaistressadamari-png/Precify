import React from 'react';
import { createPortal } from 'react-dom';
import type { InvoiceReceipt } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { formatCurrency } from './utils';

interface ReceiptDetailsModalProps {
  receipt: InvoiceReceipt | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export const ReceiptDetailsModal: React.FC<ReceiptDetailsModalProps> = ({
  receipt,
  onClose,
  onDelete
}) => {
  if (!receipt) return null;

  const formattedDate = new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-rose-100 dark:border-gray-700 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-rose-100 dark:border-gray-700 flex justify-between items-center bg-rose-50/60 dark:bg-gray-800/60">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary bg-rose-100 dark:bg-rose-900/40 px-2.5 py-0.5 rounded-full">
              Cupom Fiscal / Nota
            </span>
            <h2 className="font-display text-2xl font-bold text-brand-text dark:text-rose-100 mt-1">
              {receipt.supplier}
            </h2>
            <p className="text-xs text-brand-light-text dark:text-gray-400 mt-0.5">
              Emitido em {formattedDate} {receipt.cnpj ? `• CNPJ: ${receipt.cnpj}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-rose-100 dark:hover:bg-gray-700 transition"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Metadata Summary */}
        <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-rose-50/30 dark:bg-gray-900/30 border-b border-rose-100 dark:border-gray-700 text-xs sm:text-sm">
          <div>
            <p className="text-gray-400 text-[11px] uppercase font-semibold">Valor Total</p>
            <p className="font-bold text-lg text-brand-primary">{formatCurrency(receipt.totalAmount)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-[11px] uppercase font-semibold">Itens Registrados</p>
            <p className="font-bold text-base text-brand-text dark:text-gray-200">{receipt.items.length} itens</p>
          </div>
          <div>
            <p className="text-gray-400 text-[11px] uppercase font-semibold">Pagamento</p>
            <p className="font-medium text-brand-text dark:text-gray-200">{receipt.paymentMethod || 'Não especificado'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-[11px] uppercase font-semibold">Série / Número</p>
            <p className="font-mono text-brand-text dark:text-gray-200">{receipt.series ? `Série ${receipt.series}` : 'NFC-e'}</p>
          </div>
        </div>

        {/* Access key if present */}
        {receipt.accessKey && (
          <div className="px-6 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-b border-rose-100/50 dark:border-gray-700 text-xs font-mono text-gray-500 dark:text-gray-400 break-all">
            <span className="font-bold text-gray-700 dark:text-gray-300 mr-2">Chave de Acesso:</span>
            {receipt.accessKey}
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <h3 className="font-semibold text-sm text-brand-text dark:text-gray-200 mb-2">Itens do Cupom</h3>
          <div className="border border-rose-100 dark:border-gray-700 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-rose-50/60 dark:bg-gray-700/60 text-brand-light-text dark:text-gray-300 font-semibold border-b border-rose-100 dark:border-gray-700">
                <tr>
                  <th className="p-3">Descrição / Produto</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-right">Qtd. / Un</th>
                  <th className="p-3 text-right">Unitário</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100/60 dark:divide-gray-700/60">
                {receipt.items.map((item, i) => (
                  <tr key={item.id || i} className="hover:bg-rose-50/30 dark:hover:bg-gray-700/30">
                    <td className="p-3 font-medium text-brand-text dark:text-gray-200">
                      <div>{item.targetName || item.rawName}</div>
                      {item.rawName !== item.targetName && (
                        <div className="text-[11px] text-gray-400 font-mono">Original: {item.rawName}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.category === 'ingredient'
                          ? 'bg-rose-100 dark:bg-rose-900/40 text-brand-primary dark:text-rose-200'
                          : item.category === 'packaging'
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.category === 'ingredient' ? '🥣 Ingrediente' : item.category === 'packaging' ? '📦 Embalagem' : 'Ignorado'}
                      </span>
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-gray-300">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="p-3 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="p-3 text-right font-bold text-brand-text dark:text-white">
                      {formatCurrency(item.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-rose-50/50 dark:bg-gray-800/80 border-t border-rose-100 dark:border-gray-700 flex justify-between items-center">
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Tem certeza que deseja excluir o registro deste cupom fiscal?')) {
                  onDelete(receipt.id);
                  onClose();
                }
              }}
              className="px-4 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition flex items-center gap-1.5"
            >
              <TrashIcon className="w-4 h-4" />
              Excluir Cupom
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-brand-primary hover:bg-rose-600 text-white font-semibold rounded-xl transition ml-auto text-xs sm:text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
