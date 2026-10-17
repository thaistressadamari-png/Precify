import React, { useState, useMemo } from 'react';
import type { PurchaseOrder, Recipe, Ingredient } from '../types';
import { formatCurrency } from './utils';
import { formatAmountWithUnit, formatOrderForWhatsApp, generatePurchaseOrder } from './shoppingCalculator';
import { ConfirmModal } from './ConfirmModal';
import { SearchIcon } from './icons/SearchIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';

interface ShoppingListManagerProps {
  purchaseOrders: PurchaseOrder[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  fillings: Recipe[];
  onSaveOrder: (order: PurchaseOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onNavigateToRecipes: () => void;
  selectedOrderId?: string | null;
  onSelectOrder?: (orderId: string | null) => void;
}

export const ShoppingListManager: React.FC<ShoppingListManagerProps> = ({
  purchaseOrders,
  recipes,
  ingredients,
  fillings,
  onSaveOrder,
  onDeleteOrder,
  onNavigateToRecipes,
  selectedOrderId: externalSelectedOrderId,
  onSelectOrder: externalOnSelectOrder,
}) => {
  const [internalSelectedOrderId, setInternalSelectedOrderId] = useState<string | null>(null);
  const activeOrderId = externalSelectedOrderId !== undefined ? externalSelectedOrderId : internalSelectedOrderId;
  const setActiveOrderId = (id: string | null) => {
    if (externalOnSelectOrder) externalOnSelectOrder(id);
    setInternalSelectedOrderId(id);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // Estados para modal de criação rápida
  const [newOrderName, setNewOrderName] = useState('');
  const [selectedRecipesMap, setSelectedRecipesMap] = useState<Record<string, number>>({});
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  const currentOrder = useMemo(() => {
    if (!activeOrderId) return null;
    return purchaseOrders.find(o => o.id === activeOrderId) || null;
  }, [purchaseOrders, activeOrderId]);

  // Filtro de ordens de compra
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(order => {
      const matchesSearch =
        order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.recipes.some(r => r.recipeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        order.items.some(i => i.ingredientName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  // Estatísticas do topo
  const stats = useMemo(() => {
    const total = purchaseOrders.length;
    const pending = purchaseOrders.filter(o => o.status === 'pending').length;
    const inProgress = purchaseOrders.filter(o => o.status === 'in_progress').length;
    const completed = purchaseOrders.filter(o => o.status === 'completed').length;
    const totalEstimated = purchaseOrders
      .filter(o => o.status !== 'completed')
      .reduce((sum, o) => sum + (o.totalEstimatedCost || 0), 0);

    return { total, pending, inProgress, completed, totalEstimated };
  }, [purchaseOrders]);

  // Ações dentro da ordem ativa
  const handleToggleItemCheck = (itemId: string) => {
    if (!currentOrder) return;
    const updatedItems = currentOrder.items.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    // Se todos marcados, sugere ou atualiza status para completed
    const allChecked = updatedItems.length > 0 && updatedItems.every(i => i.checked);
    const anyChecked = updatedItems.some(i => i.checked);
    let newStatus = currentOrder.status;
    if (allChecked) {
      newStatus = 'completed';
    } else if (anyChecked && currentOrder.status === 'pending') {
      newStatus = 'in_progress';
    }

    onSaveOrder({
      ...currentOrder,
      items: updatedItems,
      status: newStatus,
    });
  };

  const handleUpdateItemPackages = (itemId: string, delta: number) => {
    if (!currentOrder) return;
    const updatedItems = currentOrder.items.map(item => {
      if (item.id === itemId) {
        const newPkgCount = Math.max(1, item.packagesToBuy + delta);
        const newEstimatedCost = newPkgCount * item.packagePrice;
        return {
          ...item,
          packagesToBuy: newPkgCount,
          estimatedCost: newEstimatedCost,
        };
      }
      return item;
    });

    const newTotalCost = updatedItems.reduce((acc, curr) => acc + curr.estimatedCost, 0);

    onSaveOrder({
      ...currentOrder,
      items: updatedItems,
      totalEstimatedCost: newTotalCost,
    });
  };

  const handleToggleCheckAll = () => {
    if (!currentOrder) return;
    const allChecked = currentOrder.items.every(i => i.checked);
    const updatedItems = currentOrder.items.map(i => ({ ...i, checked: !allChecked }));
    onSaveOrder({
      ...currentOrder,
      items: updatedItems,
      status: !allChecked ? 'completed' : 'in_progress',
    });
  };

  const handleUpdateStatus = (status: 'pending' | 'in_progress' | 'completed') => {
    if (!currentOrder) return;
    onSaveOrder({ ...currentOrder, status });
  };

  const handleUpdateNotes = (notes: string) => {
    if (!currentOrder) return;
    onSaveOrder({ ...currentOrder, notes });
  };

  const handleCopyWhatsApp = () => {
    if (!currentOrder) return;
    const text = formatOrderForWhatsApp(currentOrder);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });
  };

  const handleOpenWhatsAppWeb = () => {
    if (!currentOrder) return;
    const text = formatOrderForWhatsApp(currentOrder);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  // Criação rápida de ordem via modal
  const handleOpenCreateModal = () => {
    setSelectedRecipesMap({});
    const now = new Date();
    setNewOrderName(`Produção ${now.toLocaleDateString('pt-BR')}`);
    setModalSearchTerm('');
    setIsCreateModalOpen(true);
  };

  const handleToggleRecipeInModal = (recipeId: string) => {
    setSelectedRecipesMap(prev => {
      const next = { ...prev };
      if (next[recipeId]) {
        delete next[recipeId];
      } else {
        next[recipeId] = 1;
      }
      return next;
    });
  };

  const handleModalBatchChange = (recipeId: string, batches: number) => {
    setSelectedRecipesMap(prev => ({
      ...prev,
      [recipeId]: Math.max(0.5, batches),
    }));
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selections = Object.entries(selectedRecipesMap)
      .map(([recipeId, batches]) => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return null;
        return { recipe, batches };
      })
      .filter((s): s is { recipe: Recipe; batches: number } => s !== null);

    if (selections.length === 0) {
      alert('Selecione pelo menos uma receita para gerar a lista de compras.');
      return;
    }

    const newOrder = generatePurchaseOrder(selections, ingredients, fillings, newOrderName);
    onSaveOrder(newOrder);
    setIsCreateModalOpen(false);
    setActiveOrderId(newOrder.id);
  };

  // Renderização da Visão de Detalhes de uma Ordem de Compra
  if (currentOrder) {
    const totalItemsCount = currentOrder.items.length;
    const checkedItemsCount = currentOrder.items.filter(i => i.checked).length;
    const percentDone = totalItemsCount > 0 ? Math.round((checkedItemsCount / totalItemsCount) * 100) : 0;

    return (
      <div className="space-y-6 animate-fade-in print:m-0 print:p-0">
        {/* Toast de Cópia */}
        {copiedToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
            <CheckCircleIcon className="w-6 h-6 text-emerald-200" />
            <span className="font-semibold text-sm">Lista copiada! Cole direto no WhatsApp.</span>
          </div>
        )}

        {/* Barra superior de ações */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
          <button
            onClick={() => setActiveOrderId(null)}
            className="flex items-center gap-2 text-brand-primary dark:text-rose-300 font-semibold text-sm hover:underline"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Voltar para todas as listas</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyWhatsApp}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3.5 rounded-lg shadow-sm text-sm transition"
              title="Copiar texto formatado para área de transferência"
            >
              <span>Copiar p/ WhatsApp</span>
            </button>
            <button
              onClick={handleOpenWhatsAppWeb}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-3.5 rounded-lg shadow-sm text-sm transition"
              title="Abrir no WhatsApp"
            >
              <span>Abrir WhatsApp</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3.5 rounded-lg shadow-sm text-sm transition"
              title="Imprimir lista"
            >
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={() => setOrderToDelete(currentOrder)}
              className="flex items-center gap-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 text-brand-primary dark:text-rose-200 font-bold py-2 px-3 rounded-lg text-sm transition"
              title="Excluir esta ordem"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Excluir</span>
            </button>
          </div>
        </div>

        {/* Card do Cabeçalho da Ordem */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rose-100 dark:border-gray-700">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-text dark:text-rose-100">
                  {currentOrder.name}
                </h1>
                <select
                  value={currentOrder.status}
                  onChange={(e) => handleUpdateStatus(e.target.value as any)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border uppercase tracking-wider ${
                    currentOrder.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700'
                      : currentOrder.status === 'in_progress'
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700'
                      : 'bg-rose-100 text-brand-primary border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700'
                  }`}
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Compras</option>
                  <option value="completed">Concluída</option>
                </select>
              </div>
              <p className="text-xs text-brand-light-text dark:text-gray-400 mt-1">
                Criada em {new Date(currentOrder.createdAt).toLocaleDateString('pt-BR')} às{' '}
                {new Date(currentOrder.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Totalizador Estimado */}
            <div className="bg-rose-50 dark:bg-gray-700/60 p-4 rounded-xl border border-rose-200/60 dark:border-gray-600 flex flex-col items-start md:items-end">
              <span className="text-xs font-semibold text-brand-light-text dark:text-gray-400 uppercase tracking-wider">
                Custo Estimado da Compra
              </span>
              <span className="font-display text-2xl font-bold text-brand-primary dark:text-rose-300 tabular-nums">
                {formatCurrency(currentOrder.totalEstimatedCost)}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {currentOrder.items.reduce((acc, i) => acc + i.packagesToBuy, 0)} embalagens comerciais no total
              </span>
            </div>
          </div>

          {/* Receitas Associadas */}
          {currentOrder.recipes.length > 0 && (
            <div className="mt-4">
              <span className="text-xs font-semibold text-brand-light-text dark:text-gray-400 uppercase tracking-wider">
                Receitas na Produção:
              </span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {currentOrder.recipes.map(r => (
                  <div
                    key={r.recipeId}
                    className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-gray-700 rounded-lg border border-rose-200 dark:border-gray-600 text-xs font-medium text-brand-text dark:text-gray-200"
                  >
                    <BookOpenIcon className="w-3.5 h-3.5 text-brand-primary dark:text-rose-300" />
                    <span className="font-semibold">{r.recipeName}</span>
                    <span className="text-brand-light-text dark:text-gray-400">({r.batches}x fornadas)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de Progresso do Checklist */}
          <div className="mt-5 print:hidden">
            <div className="flex justify-between items-center text-xs font-semibold mb-1">
              <span className="text-brand-text dark:text-gray-200">
                Progresso das Compras: {checkedItemsCount} de {totalItemsCount} itens marcados ({percentDone}%)
              </span>
              <button
                onClick={handleToggleCheckAll}
                className="text-xs text-brand-primary dark:text-rose-300 hover:underline font-semibold"
              >
                {checkedItemsCount === totalItemsCount ? 'Desmarcar todos' : 'Marcar todos como comprados'}
              </button>
            </div>
            <div className="w-full bg-rose-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${percentDone}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tabela de Itens a Comprar */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-rose-100 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-display text-xl font-bold text-brand-text dark:text-rose-100">
              Itens a Comprar ({currentOrder.items.length})
            </h2>
            <span className="text-xs text-brand-light-text dark:text-gray-400 italic">
              Arredondado para pacotes comerciais fechados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-rose-50/70 dark:bg-gray-700/50 text-[11px] font-bold text-brand-light-text dark:text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center print:hidden">OK</th>
                  <th className="py-3 px-4">Ingrediente</th>
                  <th className="py-3 px-4">Qtd. Necessária</th>
                  <th className="py-3 px-4">Embalagem Comercial</th>
                  <th className="py-3 px-4 text-center">Comprar (Pacotes)</th>
                  <th className="py-3 px-4 text-right">Preço Estimado</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100/60 dark:divide-gray-700">
                {currentOrder.items.map(item => (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-rose-50/40 dark:hover:bg-gray-700/30 ${
                      item.checked ? 'bg-emerald-50/40 dark:bg-emerald-950/20 opacity-75' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleToggleItemCheck(item.id)}
                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                      />
                    </td>
                    <td className="py-3 px-4 font-semibold text-brand-text dark:text-gray-200">
                      <span className={item.checked ? 'line-through text-gray-400 dark:text-gray-500' : ''}>
                        {item.ingredientName}
                      </span>
                      {item.supplier && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                          Fornecedor: {item.supplier}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-brand-light-text dark:text-gray-300 tabular-nums">
                      {formatAmountWithUnit(item.totalRequiredAmount, item.recipeUnit)}
                    </td>
                    <td className="py-3 px-4 text-brand-light-text dark:text-gray-300">
                      {item.packageAmount} {item.packageUnit}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemPackages(item.id, -1)}
                          className="print:hidden w-6 h-6 rounded bg-rose-100 hover:bg-rose-200 dark:bg-gray-700 text-brand-primary dark:text-rose-200 text-xs font-bold transition flex items-center justify-center disabled:opacity-30"
                          disabled={item.packagesToBuy <= 1}
                          title="Diminuir 1 pacote"
                        >
                          -
                        </button>
                        <span className="font-bold text-sm bg-rose-100 dark:bg-gray-700 text-brand-primary dark:text-rose-200 px-2.5 py-1 rounded-lg tabular-nums">
                          {item.packagesToBuy} {item.packagesToBuy === 1 ? 'pacote' : 'pacotes'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemPackages(item.id, 1)}
                          className="print:hidden w-6 h-6 rounded bg-rose-100 hover:bg-rose-200 dark:bg-gray-700 text-brand-primary dark:text-rose-200 text-xs font-bold transition flex items-center justify-center"
                          title="Adicionar 1 pacote extra"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-brand-light-text dark:text-gray-300 tabular-nums">
                      {formatCurrency(item.packagePrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-brand-text dark:text-rose-100 tabular-nums">
                      {formatCurrency(item.estimatedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-rose-50/80 dark:bg-gray-700/70 border-t-2 border-rose-200 dark:border-gray-600 font-bold">
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-brand-text dark:text-rose-100">
                    Total Estimado ({currentOrder.items.reduce((acc, i) => acc + i.packagesToBuy, 0)} embalagens)
                  </td>
                  <td className="py-3 px-4 text-center text-brand-primary dark:text-rose-300">
                    {currentOrder.items.reduce((acc, i) => acc + i.packagesToBuy, 0)} un
                  </td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right text-base text-brand-primary dark:text-rose-300 tabular-nums">
                    {formatCurrency(currentOrder.totalEstimatedCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Bloco de Observações da Ordem */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 print:hidden">
          <label className="block text-sm font-semibold text-brand-text dark:text-gray-200 mb-2">
            Anotações de Compras (Ex: Fornecedor preferido, marcas, substitutos):
          </label>
          <textarea
            value={currentOrder.notes || ''}
            onChange={(e) => handleUpdateNotes(e.target.value)}
            placeholder="Digite notas adicionais para lembrar durante as compras..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-rose-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary"
          />
        </div>

        <ConfirmModal
          isOpen={orderToDelete !== null}
          title="Excluir Ordem de Compra"
          message={`Tem certeza que deseja excluir a ordem de compra "${orderToDelete?.name}"? Esta ação não pode ser desfeita.`}
          onConfirm={() => {
            if (orderToDelete) {
              onDeleteOrder(orderToDelete.id);
              setOrderToDelete(null);
              setActiveOrderId(null);
            }
          }}
          onCancel={() => setOrderToDelete(null)}
          confirmText="Excluir Ordem"
        />
      </div>
    );
  }

  // Renderização da Listagem Principal de Todas as Ordens de Compra
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">Lista de Compras</h1>
          <p className="text-sm text-brand-light-text dark:text-gray-400 mt-1">
            Gere ordens de compra a partir de receitas com cálculo automático de pacotes comerciais inteiros.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNavigateToRecipes}
            className="flex items-center gap-2 bg-rose-100 hover:bg-rose-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-brand-primary dark:text-rose-200 font-bold py-2.5 px-4 rounded-xl shadow-sm text-sm transition"
          >
            <BookOpenIcon className="w-5 h-5" />
            <span>Selecionar nas Receitas</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-transform transform hover:scale-105 text-sm"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Nova Ordem de Compra</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-2xl border border-rose-100 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-semibold text-brand-light-text dark:text-gray-400 uppercase tracking-wider">
            Total de Listas
          </span>
          <div className="font-display text-2xl font-bold text-brand-text dark:text-rose-100 mt-1 tabular-nums">
            {stats.total}
          </div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-2xl border border-rose-100 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider">
            Pendentes
          </span>
          <div className="font-display text-2xl font-bold text-rose-600 dark:text-rose-300 mt-1 tabular-nums">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-2xl border border-rose-100 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Em Compras
          </span>
          <div className="font-display text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1 tabular-nums">
            {stats.inProgress}
          </div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-2xl border border-rose-100 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-semibold text-brand-light-text dark:text-gray-400 uppercase tracking-wider">
            Custo Estimado Aberto
          </span>
          <div className="font-display text-2xl font-bold text-brand-primary dark:text-rose-300 mt-1 tabular-nums">
            {formatCurrency(stats.totalEstimated)}
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 p-1 bg-rose-50 dark:bg-gray-700/60 rounded-xl w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-gray-600 text-brand-primary dark:text-rose-200 shadow-sm'
                  : 'text-brand-light-text dark:text-gray-300 hover:text-brand-text'
              }`}
            >
              Todas ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-white dark:bg-gray-600 text-rose-600 dark:text-rose-200 shadow-sm'
                  : 'text-brand-light-text dark:text-gray-300 hover:text-brand-text'
              }`}
            >
              Pendentes ({stats.pending})
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                statusFilter === 'in_progress'
                  ? 'bg-white dark:bg-gray-600 text-amber-600 dark:text-amber-200 shadow-sm'
                  : 'text-brand-light-text dark:text-gray-300 hover:text-brand-text'
              }`}
            >
              Em Compras ({stats.inProgress})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                statusFilter === 'completed'
                  ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-200 shadow-sm'
                  : 'text-brand-light-text dark:text-gray-300 hover:text-brand-text'
              }`}
            >
              Concluídas ({stats.completed})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <input
              type="search"
              placeholder="Buscar por lista, receita ou item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-rose-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary text-sm"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Lista de Ordens de Compra */}
        {filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map(order => {
              const totalItems = order.items.length;
              const checkedItems = order.items.filter(i => i.checked).length;
              const percent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
              const totalPackages = order.items.reduce((acc, i) => acc + i.packagesToBuy, 0);

              return (
                <div
                  key={order.id}
                  onClick={() => setActiveOrderId(order.id)}
                  className="bg-rose-50/70 dark:bg-gray-700/50 rounded-2xl shadow-md border border-rose-200 dark:border-gray-600 p-5 flex flex-col justify-between hover:border-brand-primary dark:hover:border-rose-400 hover:shadow-lg transition cursor-pointer group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h3 className="font-display text-lg font-bold text-brand-text dark:text-rose-100 group-hover:text-brand-primary dark:group-hover:text-rose-300 transition line-clamp-1">
                        {order.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${
                          order.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                            : order.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                            : 'bg-rose-100 text-brand-primary dark:bg-rose-900/60 dark:text-rose-200'
                        }`}
                      >
                        {order.status === 'completed' ? 'Concluída' : order.status === 'in_progress' ? 'Em Compras' : 'Pendente'}
                      </span>
                    </div>

                    <p className="text-xs text-brand-light-text dark:text-gray-400 mb-3">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')} · {totalItems} itens ({totalPackages} pacotes)
                    </p>

                    {/* Resumo das Receitas */}
                    {order.recipes.length > 0 && (
                      <div className="space-y-1 mb-4">
                        <span className="text-[11px] font-semibold text-brand-light-text dark:text-gray-400 uppercase tracking-wider block">
                          Receitas:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {order.recipes.slice(0, 3).map(r => (
                            <span
                              key={r.recipeId}
                              className="text-xs bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-rose-200/60 dark:border-gray-600 text-brand-text dark:text-gray-200 truncate max-w-[200px]"
                            >
                              {r.recipeName} ({r.batches}x)
                            </span>
                          ))}
                          {order.recipes.length > 3 && (
                            <span className="text-xs text-brand-light-text dark:text-gray-400 px-1 py-0.5">
                              +{order.recipes.length - 3} mais
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Progresso de Compras */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center text-[11px] text-brand-light-text dark:text-gray-400 mb-1">
                        <span>Checklist</span>
                        <span>{checkedItems}/{totalItems} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-rose-200/60 dark:bg-gray-600 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-rose-200/60 dark:border-gray-600 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-brand-light-text dark:text-gray-400 uppercase block">Custo Estimado</span>
                      <span className="font-display font-bold text-brand-primary dark:text-rose-300 text-base tabular-nums">
                        {formatCurrency(order.totalEstimatedCost)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOrderToDelete(order)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition"
                        title="Excluir ordem"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <ClipboardListIcon className="w-16 h-16 mx-auto text-rose-300 dark:text-gray-600 mb-4" />
            <h3 className="font-display text-xl font-bold text-brand-text dark:text-rose-100 mb-2">
              Nenhuma ordem de compra encontrada
            </h3>
            <p className="text-sm text-brand-light-text dark:text-gray-400 max-w-md mx-auto mb-6">
              Você pode selecionar receitas no menu de receitas para calcular os ingredientes e fornadas automaticamente, ou criar uma lista avulsa agora.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={onNavigateToRecipes}
                className="bg-rose-100 hover:bg-rose-200 dark:bg-gray-700 text-brand-primary dark:text-rose-200 font-bold py-2 px-4 rounded-xl text-sm transition"
              >
                Ir para Minhas Receitas
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-sm transition shadow-md"
              >
                Nova Ordem de Compra
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criação Rápida de Ordem de Compra */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-rose-100 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-rose-100 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="font-display text-2xl font-bold text-brand-text dark:text-rose-100">
                  Criar Ordem de Compra
                </h2>
                <p className="text-xs text-brand-light-text dark:text-gray-400 mt-0.5">
                  Selecione as receitas e defina a quantidade de fornadas para calcular as embalagens.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold px-2"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
              <div>
                <label className="block text-sm font-semibold text-brand-text dark:text-gray-200 mb-1.5">
                  Nome da Ordem de Compra:
                </label>
                <input
                  type="text"
                  required
                  value={newOrderName}
                  onChange={(e) => setNewOrderName(e.target.value)}
                  placeholder="Ex: Produção de Sábado, Encomenda Casamento..."
                  className="w-full px-3.5 py-2 text-sm border border-rose-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-brand-text dark:text-gray-200">
                    Selecione as Receitas:
                  </label>
                  <span className="text-xs text-brand-primary dark:text-rose-300 font-bold">
                    {Object.keys(selectedRecipesMap).length} selecionada(s)
                  </span>
                </div>

                <div className="relative mb-3">
                  <input
                    type="search"
                    placeholder="Filtrar receitas pelo nome..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-rose-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200"
                  />
                  <SearchIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border border-rose-100 dark:border-gray-700 rounded-xl p-2 bg-rose-50/40 dark:bg-gray-900/30">
                  {recipes
                    .filter(r => r.name.toLowerCase().includes(modalSearchTerm.toLowerCase()))
                    .map(recipe => {
                      const isSelected = selectedRecipesMap[recipe.id] !== undefined;
                      const batchCount = selectedRecipesMap[recipe.id] || 1;

                      return (
                        <div
                          key={recipe.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                            isSelected
                              ? 'bg-rose-100/70 border-brand-primary dark:bg-gray-700 dark:border-rose-400'
                              : 'bg-white dark:bg-gray-800 border-rose-100 dark:border-gray-700 hover:border-rose-200'
                          }`}
                        >
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleRecipeInModal(recipe.id)}
                              className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary"
                            />
                            <div className="truncate">
                              <span className="text-sm font-semibold text-brand-text dark:text-gray-200 block truncate">
                                {recipe.name}
                              </span>
                              <span className="text-[11px] text-brand-light-text dark:text-gray-400">
                                Rendimento: {recipe.yieldAmount} {recipe.yieldUnit}
                              </span>
                            </div>
                          </label>

                          {isSelected && (
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-brand-light-text dark:text-gray-400">Fornadas:</span>
                              <input
                                type="number"
                                min="0.1"
                                step="0.5"
                                value={batchCount}
                                onChange={(e) => handleModalBatchChange(recipe.id, parseFloat(e.target.value) || 1)}
                                className="w-16 px-2 py-1 text-xs border border-rose-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-center font-bold"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {recipes.length === 0 && (
                    <div className="text-center py-6 text-sm text-gray-400">
                      Nenhuma receita cadastrada ainda.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-rose-100 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={Object.keys(selectedRecipesMap).length === 0}
                  className="px-5 py-2 text-sm font-bold bg-brand-primary hover:bg-rose-700 text-white rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Gerar Ordem de Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      <ConfirmModal
        isOpen={orderToDelete !== null}
        title="Excluir Ordem de Compra"
        message={`Tem certeza que deseja excluir a ordem de compra "${orderToDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => {
          if (orderToDelete) {
            onDeleteOrder(orderToDelete.id);
            setOrderToDelete(null);
          }
        }}
        onCancel={() => setOrderToDelete(null)}
        confirmText="Excluir Ordem"
      />
    </div>
  );
};
