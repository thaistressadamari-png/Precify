import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Ingredient, Packaging, Equipment, InvoiceReceipt, InvoicePurchaseItem, Unit, PackagingUnit } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { LinkIcon } from './icons/LinkIcon';
import { SearchIcon } from './icons/SearchIcon';
import { formatCurrency, safeParseFloat } from './utils';
import { findBestMatch } from '../services/receiptScanner';

interface ReviewReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReceipt: Partial<InvoiceReceipt>;
  existingIngredients: Ingredient[];
  existingPackaging: Packaging[];
  existingEquipment?: Equipment[];
  onConfirm: (
    receipt: InvoiceReceipt,
    newIngredients: Ingredient[],
    updatedIngredients: Ingredient[],
    newPackaging: Packaging[],
    updatedPackaging: Packaging[],
    newEquipment?: Equipment[],
    updatedEquipment?: Equipment[]
  ) => void;
}

export const ReviewReceiptModal: React.FC<ReviewReceiptModalProps> = ({
  isOpen,
  onClose,
  initialReceipt,
  existingIngredients,
  existingPackaging,
  existingEquipment = [],
  onConfirm
}) => {
  const [supplier, setSupplier] = useState<string>(initialReceipt.supplier || 'Supermercado / Loja');
  const [date, setDate] = useState<string>(initialReceipt.date || new Date().toISOString().substring(0, 10));
  const [accessKey, setAccessKey] = useState<string>(initialReceipt.accessKey || '');
  const [cnpj, setCnpj] = useState<string>(initialReceipt.cnpj || '');
  const [notes, setNotes] = useState<string>(initialReceipt.notes || '');

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Initialize review items
  const [items, setItems] = useState<InvoicePurchaseItem[]>(() => {
    const rawItems = initialReceipt.items || [];
    return rawItems.map((item, index) => {
      let isLinkExisting = false;
      let existingTargetId: string | undefined = undefined;
      let targetName = item.targetName || item.rawName;
      let category = item.category || 'ingredient';

      if (category === 'equipment') {
        const equipMatch = existingEquipment.find(
          (e) => e.name.toLowerCase().trim() === item.rawName.toLowerCase().trim()
        );
        if (equipMatch) {
          isLinkExisting = true;
          existingTargetId = equipMatch.id;
          targetName = equipMatch.name;
        }
      } else {
        const bestMatch = findBestMatch(
          item.rawName,
          category === 'packaging' ? 'packaging' : 'ingredient',
          existingIngredients,
          existingPackaging
        );
        if (bestMatch) {
          isLinkExisting = true;
          existingTargetId = bestMatch.id;
          targetName = bestMatch.name;
        }
      }

      const targetUnit = (item.targetUnit || (category === 'packaging' || category === 'equipment' ? 'un' : 'g')) as Unit | PackagingUnit | 'un';

      return {
        id: item.id || `item-${Date.now()}-${index}`,
        rawName: item.rawName,
        code: item.code || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'UN',
        unitPrice: item.unitPrice || item.packagePrice || 0,
        totalPrice: item.totalPrice || item.packagePrice || 0,
        category: category,
        linkType: isLinkExisting ? 'existing' : 'new',
        existingTargetId: existingTargetId,
        targetName: targetName,
        packageAmount: item.packageAmount || (category === 'equipment' ? (item.quantity || 1) : 1),
        targetUnit: targetUnit,
        packagePrice: item.packagePrice || item.totalPrice || item.unitPrice || 0
      };
    });
  });

  if (!isOpen) return null;

  // Filter state for searching existing items per item card
  const [searchFilter, setSearchFilter] = useState<{ [itemId: string]: string }>({});

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
          } else if (updated.category === 'equipment') {
            updated.targetUnit = 'un';
            updated.packageAmount = item.quantity || 1;
            const equipMatch = existingEquipment.find(
              (e) => e.name.toLowerCase().trim() === updated.rawName.toLowerCase().trim()
            );
            if (equipMatch) {
              updated.linkType = 'existing';
              updated.existingTargetId = equipMatch.id;
              updated.targetName = equipMatch.name;
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
          } else if (updated.category === 'equipment') {
            const found = existingEquipment.find((e) => e.id === updates.existingTargetId);
            if (found) {
              updated.targetName = found.name;
              updated.targetUnit = 'un';
              if (!updates.packageAmount) {
                updated.packageAmount = found.quantity || 1;
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

  const calculateTotalReceipt = items
    .filter((i) => i.category !== 'ignore')
    .reduce((sum, item) => sum + (item.totalPrice > 0 ? item.totalPrice : item.packagePrice), 0);

  const newIngredientsCount = items.filter((i) => i.category === 'ingredient' && i.linkType === 'new').length;
  const linkedIngredientsCount = items.filter((i) => i.category === 'ingredient' && i.linkType === 'existing').length;
  const newPackagingCount = items.filter((i) => i.category === 'packaging' && i.linkType === 'new').length;
  const linkedPackagingCount = items.filter((i) => i.category === 'packaging' && i.linkType === 'existing').length;
  const newEquipmentCount = items.filter((i) => i.category === 'equipment' && i.linkType === 'new').length;
  const linkedEquipmentCount = items.filter((i) => i.category === 'equipment' && i.linkType === 'existing').length;

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
    const newEquipment: Equipment[] = [];
    const updatedEquipment: Equipment[] = [];

    // Clone current lists
    const currentIngredientsMap = new Map<string, Ingredient>(existingIngredients.map((i) => [i.id, { ...i }]));
    const currentPackagingMap = new Map<string, Packaging>(existingPackaging.map((p) => [p.id, { ...p }]));
    const currentEquipmentMap = new Map<string, Equipment>(existingEquipment.map((e) => [e.id, { ...e }]));

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
      } else if (item.category === 'equipment') {
        if (item.linkType === 'existing' && item.existingTargetId && currentEquipmentMap.has(item.existingTargetId)) {
          const equip = currentEquipmentMap.get(item.existingTargetId)!;
          const updatedEquip: Equipment = {
            ...equip,
            price: packagePrice,
            quantity: packageAmount,
            supplier: supplier || equip.supplier,
            purchaseDate: date || equip.purchaseDate
          };
          currentEquipmentMap.set(item.existingTargetId, updatedEquip);
          updatedEquipment.push(updatedEquip);
        } else {
          // New Equipment
          const newId = `equip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const createdEquip: Equipment = {
            id: newId,
            name: item.targetName || item.rawName,
            price: packagePrice,
            quantity: packageAmount,
            supplier: supplier,
            purchaseDate: date
          };
          currentEquipmentMap.set(newId, createdEquip);
          newEquipment.push(createdEquip);
        }
      }
    });

    const finalReceipt: InvoiceReceipt = {
      id: initialReceipt.id || `receipt-${Date.now()}`,
      supplier: supplier || 'Supermercado',
      date: date,
      cnpj: cnpj || '',
      accessKey: accessKey || '',
      nfcNumber: initialReceipt.nfcNumber || '',
      series: initialReceipt.series || '',
      totalAmount: calculateTotalReceipt,
      paymentMethod: initialReceipt.paymentMethod || 'Cupom Fiscal',
      items: validItems.map((it) => ({
        id: it.id,
        rawName: it.rawName || '',
        code: it.code || '',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'UN',
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice: Number(it.totalPrice) || 0,
        category: it.category || 'ingredient',
        linkType: it.linkType || 'new',
        existingTargetId: it.existingTargetId || '',
        targetName: it.targetName || it.rawName || '',
        packageAmount: Number(it.packageAmount) || 1,
        targetUnit: it.targetUnit || 'g',
        packagePrice: Number(it.packagePrice) || 0
      })),
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    onConfirm(finalReceipt, newIngredients, updatedIngredients, newPackaging, updatedPackaging, newEquipment, updatedEquipment);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 overflow-hidden animate-fade-in">
      <div className="bg-[#FAF3F5] dark:bg-gray-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-rose-200/80 dark:border-gray-700 w-full h-full sm:h-[95vh] sm:max-h-[920px] sm:max-w-4xl flex flex-col overflow-hidden">
        
        {/* =========================================================================
            HEADER (Compatível com Dynamic Island / iPhone Safe Area)
           ========================================================================= */}
        <div 
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.625rem)' }}
          className="bg-white dark:bg-gray-800 border-b border-rose-100 dark:border-gray-700 px-3.5 pb-2.5 sm:py-3 sm:px-4 flex items-center justify-between gap-2 flex-shrink-0 shadow-xs"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-brand-primary text-white tracking-wider shadow-2xs">
                Conferência Fiscal
              </span>
              <h2 className="font-display text-xs sm:text-sm font-bold text-brand-text dark:text-rose-100 truncate">
                Revisar Itens do Cupom
              </h2>
            </div>
            {accessKey ? (
              <p className="text-[10px] text-brand-light-text dark:text-gray-400 font-mono truncate mt-0.5">
                NFC-e: {accessKey}
              </p>
            ) : (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5">
                Cupom sem chave digital
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-brand-light-text hover:text-brand-text dark:hover:text-rose-100 rounded-lg hover:bg-rose-50 dark:hover:bg-gray-700 transition flex-shrink-0"
            title="Fechar"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            SCROLLABLE CONTENT (Metadados + Cards dos Itens + Botão Adicionar Item)
           ========================================================================= */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 bg-rose-50/50 dark:bg-gray-900/90">
          
          {/* Top Metadata Fields (Fornecedor, Data, CNPJ, Total) */}
          <div className="bg-white dark:bg-gray-800 border border-rose-100 dark:border-gray-700 rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 shadow-xs">
            {/* Fornecedor */}
            <div className="bg-rose-50/40 dark:bg-gray-750 border border-rose-100/80 dark:border-gray-600 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-light-text dark:text-gray-400 leading-tight">
                Fornecedor
              </span>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="bg-transparent text-xs font-semibold text-brand-text dark:text-gray-100 outline-none w-full truncate h-5 placeholder:text-gray-400"
                placeholder="Supermercado / Loja..."
              />
            </div>

            {/* Data da Compra */}
            <div className="bg-rose-50/40 dark:bg-gray-750 border border-rose-100/80 dark:border-gray-600 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-light-text dark:text-gray-400 leading-tight">
                Data Compra
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-brand-text dark:text-gray-100 outline-none w-full h-5"
              />
            </div>

            {/* CNPJ */}
            <div className="bg-rose-50/40 dark:bg-gray-750 border border-rose-100/80 dark:border-gray-600 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-light-text dark:text-gray-400 leading-tight">
                CNPJ (Opcional)
              </span>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="bg-transparent text-xs font-mono font-medium text-brand-text dark:text-gray-100 outline-none w-full truncate h-5 placeholder:text-gray-400"
                placeholder="00.000.000/0000-00"
              />
            </div>

            {/* Total do Cupom */}
            <div className="bg-rose-100/60 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1 flex flex-col justify-center">
              <span className="block text-[9px] uppercase font-bold text-brand-primary dark:text-rose-300 leading-tight">
                Total do Cupom
              </span>
              <span className="text-xs sm:text-sm font-bold text-brand-primary dark:text-rose-300 truncate h-5 flex items-center">
                {formatCurrency(calculateTotalReceipt)}
              </span>
            </div>
          </div>

          {/* Empty state if no items */}
          {items.length === 0 && (
            <div className="text-center py-8 px-4 bg-white dark:bg-gray-800 border-2 border-dashed border-rose-200 dark:border-gray-700 rounded-xl my-2">
              <p className="text-xs font-semibold text-brand-text dark:text-gray-300 mb-2">
                Nenhum produto listado neste cupom.
              </p>
              <button
                type="button"
                onClick={handleAddNewManualItem}
                className="py-1.5 px-3 bg-brand-primary hover:bg-rose-600 text-white text-xs font-bold rounded-lg shadow-sm transition"
              >
                + Adicionar Primeiro Item
              </button>
            </div>
          )}

          {/* Product Cards com Alto Contraste, Cores do Sistema e Linha Fiscal Detalhada */}
          {items.map((item, idx) => {
            const isIgnore = item.category === 'ignore';
            const isPackaging = item.category === 'packaging';
            const isIngredient = item.category === 'ingredient';
            const isEquipment = item.category === 'equipment';
            const searchVal = (searchFilter[item.id] || '').toLowerCase().trim();

            const filteredIngredients = existingIngredients.filter((ing) =>
              !searchVal || ing.name.toLowerCase().includes(searchVal)
            );
            const filteredPackaging = existingPackaging.filter((pkg) =>
              !searchVal || pkg.name.toLowerCase().includes(searchVal)
            );
            const filteredEquipment = existingEquipment.filter((equip) =>
              !searchVal || equip.name.toLowerCase().includes(searchVal)
            );

            return (
              <div
                key={item.id}
                className={`rounded-xl border shadow-xs transition-all overflow-hidden ${
                  isIgnore
                    ? 'bg-gray-50/70 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 opacity-60'
                    : item.linkType === 'existing'
                    ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 ring-1 ring-blue-200/60'
                    : 'bg-white dark:bg-gray-800 border-rose-100 dark:border-gray-700'
                }`}
              >
                {/* Linha 1: Número, Nome Completo do Item no Cupom e Lixeira */}
                <div className="bg-rose-50/70 dark:bg-gray-750/80 px-3 py-2 border-b border-rose-100 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-2xs">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-brand-text dark:text-white truncate" title={item.rawName}>
                      {item.rawName || 'Item sem nome'}
                    </span>
                    {item.code && (
                      <span className="text-[9px] text-brand-light-text dark:text-gray-400 font-mono bg-rose-100/60 dark:bg-gray-700 px-1.5 py-0.5 rounded hidden sm:inline flex-shrink-0">
                        #{item.code}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition flex-shrink-0"
                    title="Excluir item deste cupom"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Linha 2: Especificações Fiscais do Cupom (Qtde, UN, Vl. Unitário, Vl. Total) */}
                <div className="px-3 py-1.5 bg-rose-50/30 dark:bg-gray-800/80 border-b border-rose-100/70 dark:border-gray-700/70 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-brand-light-text dark:text-gray-300">
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-md border border-rose-100 dark:border-gray-600 font-medium text-[11px] shadow-2xs">
                      <span className="text-brand-light-text dark:text-gray-400 text-[10px]">Qtde:</span>
                      <strong className="text-brand-text dark:text-white font-bold">{item.quantity}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-md border border-rose-100 dark:border-gray-600 font-medium text-[11px] shadow-2xs">
                      <span className="text-brand-light-text dark:text-gray-400 text-[10px]">UN:</span>
                      <strong className="text-brand-text dark:text-white font-bold">{item.unit || 'UN'}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-md border border-rose-100 dark:border-gray-600 font-medium text-[11px] shadow-2xs">
                      <span className="text-brand-light-text dark:text-gray-400 text-[10px]">Vl. Unit.:</span>
                      <strong className="text-brand-text dark:text-white font-bold">{formatCurrency(item.unitPrice)}</strong>
                    </span>
                  </div>
                  
                  <div className="inline-flex items-center gap-1.5 bg-rose-100/70 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-brand-primary dark:text-rose-300 px-2.5 py-0.5 rounded-md font-medium text-xs shadow-2xs">
                    <span className="text-[10px] font-semibold text-rose-700/80 dark:text-rose-300">Vl. Total:</span>
                    <strong className="font-bold">{formatCurrency(item.totalPrice)}</strong>
                  </div>
                </div>

                {/* Linha 3: Form fields com DESTINO e AÇÃO LADO A LADO no mobile e desktop */}
                <div className="p-2.5 sm:p-3 grid grid-cols-12 gap-2 sm:gap-2.5 items-end">
                  
                  {/* Destino (col-span-6 no mobile, col-span-3 no desktop) */}
                  <div className={isIgnore ? 'col-span-12' : 'col-span-6 sm:col-span-3'}>
                    <label className="block text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1">
                      Destino
                    </label>
                    <select
                      value={item.category}
                      onChange={(e) => handleItemChange(item.id, { category: e.target.value as any })}
                      className="w-full h-8 px-2 text-xs bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-medium text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition"
                    >
                      <option value="ingredient">🥣 Ingrediente</option>
                      <option value="packaging">📦 Embalagem</option>
                      <option value="equipment">🍳 Equipamento</option>
                      <option value="ignore">❌ Ignorar</option>
                    </select>
                  </div>

                  {!isIgnore && (
                    <>
                      {/* Ação (col-span-6 no mobile, col-span-2 no desktop) - LADO A LADO COM DESTINO */}
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1">
                          Ação
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
                              } else if (isEquipment && existingEquipment.length > 0) {
                                targetId = existingEquipment[0].id;
                                targetName = existingEquipment[0].name;
                              }
                            }

                            handleItemChange(item.id, {
                              linkType: newLinkType,
                              existingTargetId: targetId,
                              targetName
                            });
                          }}
                          className={`w-full h-8 px-2 text-xs rounded-lg font-medium outline-none border transition ${
                            item.linkType === 'existing'
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-200'
                              : 'bg-rose-50/40 dark:bg-gray-700 border-rose-200 dark:border-gray-600 text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary'
                          }`}
                        >
                          <option value="new">✨ Novo</option>
                          <option value="existing">🔗 Vincular</option>
                        </select>
                      </div>

                      {/* Nome no Sistema ou Seleção com Pesquisa (col-span-12 no mobile, col-span-4 no desktop) */}
                      <div className="col-span-12 sm:col-span-4">
                        <div className="text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1 flex items-center justify-between">
                          <span>{item.linkType === 'new' ? 'Nome no Sistema' : 'Vincular Existente'}</span>
                          {item.linkType === 'existing' && item.existingTargetId && (
                            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                              <LinkIcon className="w-2.5 h-2.5" /> Vinculado
                            </span>
                          )}
                        </div>

                        {item.linkType === 'new' ? (
                          <input
                            type="text"
                            value={item.targetName}
                            onChange={(e) => handleItemChange(item.id, { targetName: e.target.value })}
                            className="w-full h-8 px-2.5 text-xs bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-medium text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition placeholder:text-gray-400"
                            placeholder="Nome para cadastrar..."
                          />
                        ) : (
                          <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-1.5 space-y-1">
                            {/* Barra de pesquisa rápida para achar o item */}
                            <div className="relative">
                              <SearchIcon className="w-3.5 h-3.5 text-blue-500 absolute left-2 top-2 pointer-events-none" />
                              <input
                                type="text"
                                value={searchFilter[item.id] || ''}
                                onChange={(e) =>
                                  setSearchFilter((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                placeholder="Filtrar existentes..."
                                className="w-full h-7 pl-6 pr-2 text-xs bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-700 rounded text-slate-800 dark:text-gray-100 placeholder:text-gray-400 focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            
                            <select
                              value={item.existingTargetId || ''}
                              onChange={(e) => handleItemChange(item.id, { existingTargetId: e.target.value })}
                              className="w-full h-8 px-2 text-xs bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded font-medium text-blue-950 dark:text-blue-100 focus:ring-1 focus:ring-blue-500 outline-none truncate"
                            >
                              <option value="" disabled>
                                Selecione ({isIngredient ? filteredIngredients.length : isPackaging ? filteredPackaging.length : filteredEquipment.length} encontrados)...
                              </option>
                              {isIngredient &&
                                filteredIngredients.map((ing) => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.name} ({ing.packageAmount}{ing.unit} - {formatCurrency(ing.packagePrice)})
                                  </option>
                                ))}
                              {isPackaging &&
                                filteredPackaging.map((pkg) => (
                                  <option key={pkg.id} value={pkg.id}>
                                    {pkg.name} ({pkg.amount}{pkg.unit} - {formatCurrency(pkg.price)})
                                  </option>
                                ))}
                              {isEquipment &&
                                filteredEquipment.map((equip) => (
                                  <option key={equip.id} value={equip.id}>
                                    {equip.name} ({equip.quantity || 1}un - {formatCurrency(equip.price)})
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Qtd. Embalagem & Unidade (col-span-12 no mobile, col-span-3 no desktop) */}
                      <div className="col-span-12 sm:col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-brand-light-text dark:text-gray-400 tracking-wider mb-1">
                          {isEquipment ? 'Quantidade' : 'Qtd. Emb. & Unid.'}
                        </label>
                        <div className={isEquipment ? 'w-full' : 'grid grid-cols-2 gap-1.5'}>
                          <input
                            type="number"
                            step="any"
                            value={item.packageAmount}
                            onChange={(e) =>
                              handleItemChange(item.id, { packageAmount: safeParseFloat(e.target.value) })
                            }
                            className="w-full h-8 px-2 text-xs text-center bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-semibold text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition"
                            placeholder="Qtd"
                          />
                          {!isEquipment && (
                            <select
                              value={item.targetUnit}
                              onChange={(e) => handleItemChange(item.id, { targetUnit: e.target.value as any })}
                              className="w-full h-8 px-2 text-xs bg-rose-50/40 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-lg font-semibold text-brand-text dark:text-gray-100 focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition"
                            >
                              {isIngredient ? (
                                <>
                                  <option value="g">g</option>
                                  <option value="kg">kg</option>
                                  <option value="ml">ml</option>
                                  <option value="l">l</option>
                                  <option value="un">un</option>
                                </>
                              ) : (
                                <>
                                  <option value="un">un</option>
                                  <option value="pacote">pct</option>
                                  <option value="rolo">rolo</option>
                                  <option value="m">m</option>
                                </>
                              )}
                            </select>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Botão de Adicionar Item no final da rolagem */}
          <div className="pt-2 pb-4 flex justify-center">
            <button
              type="button"
              onClick={handleAddNewManualItem}
              className="py-2 px-4 bg-white dark:bg-gray-800 border-2 border-dashed border-rose-200 dark:border-gray-600 hover:border-brand-primary hover:bg-rose-50/70 dark:hover:bg-gray-700 text-brand-primary dark:text-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <PlusIcon className="w-4 h-4" />
              <span>+ Adicionar Outro Item ao Cupom</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            FOOTER BAR (Compatível com Barra Inferior do iPhone / Home Bar)
           ========================================================================= */}
        <div 
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
          className="p-3 sm:p-3.5 bg-white dark:bg-gray-800 border-t border-rose-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 shadow-xs"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-brand-primary dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-md font-bold text-[11px]">
              ✨ Novos: {newIngredientsCount + newPackagingCount + newEquipmentCount}
            </span>
            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md font-bold text-[11px]">
              🔗 Vincular: {linkedIngredientsCount + linkedPackagingCount + linkedEquipmentCount}
            </span>
            <span className="font-bold text-brand-text dark:text-white text-xs sm:text-sm ml-1">
              Total: {formatCurrency(calculateTotalReceipt)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 text-xs sm:text-sm font-semibold text-brand-light-text dark:text-gray-300 hover:text-brand-text transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAll}
              className="py-2 px-4 bg-brand-primary hover:bg-rose-600 text-white font-bold rounded-xl shadow-md shadow-rose-500/25 transition flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <CheckCircleIcon className="w-4 h-4" />
              <span>Confirmar & Atualizar</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
