import React, { useState } from 'react';
import type { Ingredient, Packaging, InvoiceReceipt, InvoicePurchaseItem, Unit, PackagingUnit } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { LinkIcon, SparklesIcon } from './icons/LinkIcon';
import { formatCurrency, safeParseFloat } from './utils';
import { findBestMatch } from '../services/receiptScanner';

interface ReviewReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReceipt: Partial<InvoiceReceipt>;
  existingIngredients: Ingredient[];
  existingPackaging: Packaging[];
  onConfirm: (
    receipt: InvoiceReceipt,
    newIngredients: Ingredient[],
    updatedIngredients: Ingredient[],
    newPackaging: Packaging[],
    updatedPackaging: Packaging[]
  ) => void;
}

export const ReviewReceiptModal: React.FC<ReviewReceiptModalProps> = ({
  isOpen,
  onClose,
  initialReceipt,
  existingIngredients,
  existingPackaging,
  onConfirm
}) => {
  const [supplier, setSupplier] = useState<string>(initialReceipt.supplier || 'Supermercado / Loja');
  const [date, setDate] = useState<string>(initialReceipt.date || new Date().toISOString().substring(0, 10));
  const [accessKey, setAccessKey] = useState<string>(initialReceipt.accessKey || '');
  const [cnpj, setCnpj] = useState<string>(initialReceipt.cnpj || '');
  const [notes, setNotes] = useState<string>(initialReceipt.notes || '');

  // Initialize review items
  const [items, setItems] = useState<InvoicePurchaseItem[]>(() => {
    const rawItems = initialReceipt.items || [];
    return rawItems.map((item, index) => {
      const bestMatch = findBestMatch(
        item.rawName,
        item.category === 'packaging' ? 'packaging' : 'ingredient',
        existingIngredients,
        existingPackaging
      );

      const isLinkExisting = !!bestMatch;
      const targetUnit = (item.targetUnit || 'g') as Unit | PackagingUnit;

      return {
        id: item.id || `item-${Date.now()}-${index}`,
        rawName: item.rawName,
        code: item.code || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'UN',
        unitPrice: item.unitPrice || item.packagePrice || 0,
        totalPrice: item.totalPrice || item.packagePrice || 0,
        category: item.category || 'ingredient',
        linkType: isLinkExisting ? 'existing' : 'new',
        existingTargetId: isLinkExisting ? bestMatch?.id : undefined,
        targetName: isLinkExisting ? (bestMatch?.name || item.rawName) : item.targetName || item.rawName,
        packageAmount: item.packageAmount || 1,
        targetUnit: targetUnit,
        packagePrice: item.packagePrice || item.totalPrice || item.unitPrice || 0
      };
    });
  });

  if (!isOpen) return null;

  const handleItemChange = (id: string, updates: Partial<InvoicePurchaseItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, ...updates };

        // If category changes, reset or re-evaluate link
        if (updates.category && updates.category !== item.category) {
          if (updated.category === 'packaging') {
            updated.targetUnit = 'un';
            const match = findBestMatch(updated.rawName, 'packaging', existingIngredients, existingPackaging);
            if (match) {
              updated.linkType = 'existing';
              updated.existingTargetId = match.id;
              updated.targetName = match.name;
            } else {
              updated.linkType = 'new';
              updated.existingTargetId = undefined;
            }
          } else if (updated.category === 'ingredient') {
            updated.targetUnit = 'g';
            const match = findBestMatch(updated.rawName, 'ingredient', existingIngredients, existingPackaging);
            if (match) {
              updated.linkType = 'existing';
              updated.existingTargetId = match.id;
              updated.targetName = match.name;
            } else {
              updated.linkType = 'new';
              updated.existingTargetId = undefined;
            }
          }
        }

        // If existingTargetId changes, update targetName and unit
        if (updates.existingTargetId) {
          if (updated.category === 'ingredient') {
            const found = existingIngredients.find((i) => i.id === updates.existingTargetId);
            if (found) {
              updated.targetName = found.name;
              updated.targetUnit = found.unit;
              if (!updates.packageAmount) {
                updated.packageAmount = found.packageAmount;
              }
            }
          } else if (updated.category === 'packaging') {
            const found = existingPackaging.find((p) => p.id === updates.existingTargetId);
            if (found) {
              updated.targetName = found.name;
              updated.targetUnit = found.unit;
              if (!updates.packageAmount) {
                updated.packageAmount = found.amount;
              }
            }
          }
        }

        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewManualItem = () => {
    const newItem: InvoicePurchaseItem = {
      id: `manual-${Date.now()}`,
      rawName: 'Novo Item',
      quantity: 1,
      unit: 'UN',
      unitPrice: 0,
      totalPrice: 0,
      category: 'ingredient',
      linkType: 'new',
      targetName: 'Novo Ingrediente',
      packageAmount: 1000,
      targetUnit: 'g',
      packagePrice: 0
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleAutoLinkAll = () => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.category === 'ignore') return item;
        const match = findBestMatch(
          item.rawName,
          item.category === 'packaging' ? 'packaging' : 'ingredient',
          existingIngredients,
          existingPackaging
        );
        if (match) {
          const targetObj =
            item.category === 'ingredient'
              ? existingIngredients.find((i) => i.id === match.id)
              : existingPackaging.find((p) => p.id === match.id);

          return {
            ...item,
            linkType: 'existing',
            existingTargetId: match.id,
            targetName: match.name,
            targetUnit: (targetObj as any)?.unit || item.targetUnit,
            packageAmount: (targetObj as any)?.packageAmount || (targetObj as any)?.amount || item.packageAmount
          };
        }
        return item;
      })
    );
  };

  const calculateTotalReceipt = items
    .filter((i) => i.category !== 'ignore')
    .reduce((sum, item) => sum + (item.totalPrice > 0 ? item.totalPrice : item.packagePrice), 0);

  const newIngredientsCount = items.filter((i) => i.category === 'ingredient' && i.linkType === 'new').length;
  const linkedIngredientsCount = items.filter((i) => i.category === 'ingredient' && i.linkType === 'existing').length;
  const newPackagingCount = items.filter((i) => i.category === 'packaging' && i.linkType === 'new').length;
  const linkedPackagingCount = items.filter((i) => i.category === 'packaging' && i.linkType === 'existing').length;

  const handleConfirmAll = () => {
    const validItems = items.filter((i) => i.category !== 'ignore');

    if (validItems.length === 0) {
      alert('Nenhum item válido para importar.');
      return;
    }

    const newIngredients: Ingredient[] = [];
    const updatedIngredients: Ingredient[] = [];
    const newPackaging: Packaging[] = [];
    const updatedPackaging: Packaging[] = [];

    // Clone current lists
    const currentIngredientsMap = new Map<string, Ingredient>(existingIngredients.map((i) => [i.id, { ...i }]));
    const currentPackagingMap = new Map<string, Packaging>(existingPackaging.map((p) => [p.id, { ...p }]));

    validItems.forEach((item) => {
      const packagePrice = item.packagePrice > 0 ? item.packagePrice : item.totalPrice;
      const packageAmount = item.packageAmount > 0 ? item.packageAmount : 1;

      if (item.category === 'ingredient') {
        if (item.linkType === 'existing' && item.existingTargetId && currentIngredientsMap.has(item.existingTargetId)) {
          const ing = currentIngredientsMap.get(item.existingTargetId)!;
          const newPurchase = {
            id: `purch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date: date,
            supplier: supplier || ing.supplier || '',
            packagePrice: packagePrice,
            packageAmount: packageAmount,
            unit: (item.targetUnit as Unit) || ing.unit
          };
          const updatedHistory = [...(ing.history || []), newPurchase];
          const sortedHistory = updatedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestPurchase = sortedHistory[0];

          const updatedIng: Ingredient = {
            ...ing,
            supplier: latestPurchase.supplier,
            packagePrice: latestPurchase.packagePrice,
            packageAmount: latestPurchase.packageAmount,
            unit: latestPurchase.unit,
            purchaseDate: latestPurchase.date,
            history: sortedHistory
          };
          currentIngredientsMap.set(item.existingTargetId, updatedIng);
          updatedIngredients.push(updatedIng);
        } else {
          // New Ingredient
          const newId = `ing-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const initialPurchase = {
            id: `purch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            date: date,
            supplier: supplier,
            packagePrice: packagePrice,
            packageAmount: packageAmount,
            unit: (item.targetUnit as Unit) || 'g'
          };
          const createdIng: Ingredient = {
            id: newId,
            name: item.targetName || item.rawName,
            supplier: supplier,
            packagePrice: packagePrice,
            packageAmount: packageAmount,
            unit: (item.targetUnit as Unit) || 'g',
            purchaseDate: date,
            history: [initialPurchase]
          };
          currentIngredientsMap.set(newId, createdIng);
          newIngredients.push(createdIng);
        }
      } else if (item.category === 'packaging') {
        if (item.linkType === 'existing' && item.existingTargetId && currentPackagingMap.has(item.existingTargetId)) {
          const pkg = currentPackagingMap.get(item.existingTargetId)!;
          const updatedPkg: Packaging = {
            ...pkg,
            price: packagePrice,
            amount: packageAmount,
            unit: (item.targetUnit as PackagingUnit) || pkg.unit
          };
          currentPackagingMap.set(item.existingTargetId, updatedPkg);
          updatedPackaging.push(updatedPkg);
        } else {
          // New Packaging
          const newId = `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const createdPkg: Packaging = {
            id: newId,
            name: item.targetName || item.rawName,
            price: packagePrice,
            amount: packageAmount,
            unit: (item.targetUnit as PackagingUnit) || 'un'
          };
          currentPackagingMap.set(newId, createdPkg);
          newPackaging.push(createdPkg);
        }
      }
    });

    const finalReceipt: InvoiceReceipt = {
      id: initialReceipt.id || `receipt-${Date.now()}`,
      supplier: supplier || 'Supermercado',
      date: date,
      cnpj: cnpj || undefined,
      accessKey: accessKey || undefined,
      nfcNumber: initialReceipt.nfcNumber,
      series: initialReceipt.series,
      totalAmount: calculateTotalReceipt,
      paymentMethod: initialReceipt.paymentMethod,
      items: validItems,
      notes: notes || undefined,
      createdAt: new Date().toISOString()
    };

    onConfirm(finalReceipt, newIngredients, updatedIngredients, newPackaging, updatedPackaging);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-rose-100 dark:border-gray-700 w-full max-w-5xl my-6 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-rose-100 dark:border-gray-700 flex justify-between items-center bg-rose-50/60 dark:bg-gray-800/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-full bg-brand-primary/10 text-brand-primary dark:bg-rose-900/40 dark:text-rose-300">
                Conferência de Cupom Fiscal
              </span>
              {accessKey && (
                <span className="text-xs text-brand-light-text dark:text-gray-400 font-mono hidden sm:inline">
                  Chave: {accessKey.substring(0, 10)}...{accessKey.substring(34)}
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl font-bold text-brand-text dark:text-rose-100 mt-1">
              Revisar Itens & Vincular aos Cadastros
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-rose-100 dark:hover:bg-gray-700 transition"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Receipt General Metadata Inputs */}
        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 border-b border-rose-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-brand-light-text dark:text-gray-400 mb-1">
              Fornecedor / Supermercado
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-rose-50/50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="Ex: Supermercados Cavicchiolli"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-light-text dark:text-gray-400 mb-1">
              Data da Compra
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-rose-50/50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-light-text dark:text-gray-400 mb-1">
              CNPJ (Opcional)
            </label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full px-3 py-2 bg-rose-50/50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="43.259.548/0027-00"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-light-text dark:text-gray-400 mb-1">
              Valor Total do Cupom
            </label>
            <div className="w-full px-3 py-2 bg-brand-primary/5 dark:bg-brand-primary/10 border border-brand-primary/30 rounded-xl text-base font-bold text-brand-primary">
              {formatCurrency(calculateTotalReceipt)}
            </div>
          </div>
        </div>

        {/* Action bar above table */}
        <div className="px-4 sm:px-6 py-3 bg-rose-50/30 dark:bg-gray-900/30 flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-brand-text dark:text-gray-200">
              Itens Identificados ({items.length})
            </span>
            <button
              type="button"
              onClick={handleAutoLinkAll}
              className="py-1 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-amber-300 dark:border-amber-700"
              title="Detecta automaticamente se algum item possui nome similar a um ingrediente ou embalagem cadastrado"
            >
              <SparklesIcon className="w-4 h-4" />
              Auto-Vincular por Nome
            </button>
          </div>
          <button
            type="button"
            onClick={handleAddNewManualItem}
            className="py-1 px-3 bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 hover:bg-rose-50 dark:hover:bg-gray-600 text-brand-text dark:text-gray-200 rounded-lg text-xs font-semibold transition flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            Adicionar Item Manual
          </button>
        </div>

        {/* Items List (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {items.map((item, idx) => {
            const isIgnore = item.category === 'ignore';
            const isPackaging = item.category === 'packaging';
            const isIngredient = item.category === 'ingredient';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isIgnore
                    ? 'bg-gray-100/70 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 opacity-60'
                    : item.linkType === 'existing'
                    ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 shadow-sm'
                    : 'bg-white dark:bg-gray-800/90 border-rose-100 dark:border-gray-700 shadow-sm'
                }`}
              >
                {/* Item Top Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-rose-100/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-rose-100 dark:bg-gray-700 text-brand-primary dark:text-rose-200 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-semibold text-brand-text dark:text-rose-100">
                      {item.rawName}
                    </span>
                    {item.code && (
                      <span className="text-[10px] text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        Cód: {item.code}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-brand-light-text dark:text-gray-400 mr-2">
                        {item.quantity} {item.unit} x {formatCurrency(item.unitPrice)} =
                      </span>
                      <span className="font-bold text-brand-text dark:text-white">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      title="Excluir item deste cupom"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Item Controls Row */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
                  {/* Category Selector */}
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-brand-light-text dark:text-gray-400 mb-1">
                      Destino do Item
                    </label>
                    <select
                      value={item.category}
                      onChange={(e) => handleItemChange(item.id, { category: e.target.value as any })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-primary outline-none"
                    >
                      <option value="ingredient">🥣 Ingrediente</option>
                      <option value="packaging">📦 Embalagem</option>
                      <option value="ignore">❌ Ignorar / Não Insumo</option>
                    </select>
                  </div>

                  {!isIgnore && (
                    <>
                      {/* Link Type (New vs Existing) */}
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-brand-light-text dark:text-gray-400 mb-1 flex items-center justify-between">
                          <span>Ação de Cadastro</span>
                          {item.linkType === 'existing' && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" /> Vinculado
                            </span>
                          )}
                        </label>
                        <select
                          value={item.linkType}
                          onChange={(e) => {
                            const newLinkType = e.target.value as 'new' | 'existing';
                            let targetId: string | undefined = undefined;
                            let targetName = item.targetName;

                            if (newLinkType === 'existing') {
                              if (isIngredient && existingIngredients.length > 0) {
                                targetId = existingIngredients[0].id;
                                targetName = existingIngredients[0].name;
                              } else if (isPackaging && existingPackaging.length > 0) {
                                targetId = existingPackaging[0].id;
                                targetName = existingPackaging[0].name;
                              }
                            }

                            handleItemChange(item.id, {
                              linkType: newLinkType,
                              existingTargetId: targetId,
                              targetName
                            });
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-primary outline-none"
                        >
                          <option value="new">✨ Cadastrar como Novo</option>
                          <option value="existing">🔗 Vincular a Existente</option>
                        </select>
                      </div>

                      {/* Product Name or Selection */}
                      <div className="md:col-span-3">
                        {item.linkType === 'new' ? (
                          <>
                            <label className="block text-[11px] font-semibold text-brand-light-text dark:text-gray-400 mb-1">
                              Nome no Sistema
                            </label>
                            <input
                              type="text"
                              value={item.targetName}
                              onChange={(e) => handleItemChange(item.id, { targetName: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-primary outline-none"
                              placeholder="Ex: Nata Frimesa"
                            />
                          </>
                        ) : (
                          <>
                            <label className="block text-[11px] font-semibold text-blue-700 dark:text-blue-300 mb-1">
                              Selecionar Item Existente
                            </label>
                            <select
                              value={item.existingTargetId || ''}
                              onChange={(e) => handleItemChange(item.id, { existingTargetId: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-blue-50 dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-xl font-semibold text-blue-900 dark:text-blue-100 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              <option value="" disabled>
                                Escolha um item...
                              </option>
                              {isIngredient &&
                                existingIngredients.map((ing) => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.name} ({ing.packageAmount} {ing.unit} - {formatCurrency(ing.packagePrice)})
                                  </option>
                                ))}
                              {isPackaging &&
                                existingPackaging.map((pkg) => (
                                  <option key={pkg.id} value={pkg.id}>
                                    {pkg.name} ({pkg.amount} {pkg.unit} - {formatCurrency(pkg.price)})
                                  </option>
                                ))}
                            </select>
                          </>
                        )}
                      </div>

                      {/* Package Amount & Unit */}
                      <div className="md:col-span-3 grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-brand-light-text dark:text-gray-400 mb-1">
                            Qtd. Embalagem
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={item.packageAmount}
                            onChange={(e) =>
                              handleItemChange(item.id, { packageAmount: safeParseFloat(e.target.value) })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-primary outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-brand-light-text dark:text-gray-400 mb-1">
                            Unidade
                          </label>
                          <select
                            value={item.targetUnit}
                            onChange={(e) => handleItemChange(item.id, { targetUnit: e.target.value as any })}
                            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl font-medium focus:ring-2 focus:ring-brand-primary outline-none"
                          >
                            {isIngredient ? (
                              <>
                                <option value="g">g (Gramas)</option>
                                <option value="kg">kg (Quilos)</option>
                                <option value="ml">ml (Mililitros)</option>
                                <option value="l">l (Litros)</option>
                                <option value="un">un (Unidade)</option>
                              </>
                            ) : (
                              <>
                                <option value="un">un (Unidade)</option>
                                <option value="pacote">pacote</option>
                                <option value="rolo">rolo</option>
                                <option value="m">m (Metros)</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Summary & Action */}
        <div className="p-4 sm:p-6 bg-rose-50/80 dark:bg-gray-900/80 border-t border-rose-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <span className="px-3 py-1 bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 rounded-lg font-semibold">
              ✨ Novos: {newIngredientsCount + newPackagingCount}
            </span>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 rounded-lg font-semibold">
              🔗 Vinculados a Atualizar: {linkedIngredientsCount + linkedPackagingCount}
            </span>
            <span className="font-bold text-brand-text dark:text-white">
              Total: {formatCurrency(calculateTotalReceipt)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-brand-text transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAll}
              className="py-3 px-6 bg-brand-primary hover:bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-500/25 transition flex items-center gap-2 text-xs sm:text-sm"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Confirmar e Atualizar Cadastros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
