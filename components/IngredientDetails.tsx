

import React, { useMemo, useState } from 'react';
import type { Ingredient, Purchase } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { getPricePerBaseUnit } from './costCalculator';
import { formatCurrency } from './utils';
import { ConfirmModal } from './ConfirmModal';

interface IngredientDetailsProps {
  ingredient: Ingredient;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredientId: string) => void;
  onDeletePurchase: (ingredientId: string, purchaseId: string) => void;
  onClose: () => void;
}

type Period = '30d' | '6m' | '1y' | 'all';

const LineChart: React.FC<{ data: { date: Date; price: number }[] }> = ({ data }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; price: string } | null>(null);

    const width = 400;
    const height = 220;
    const margin = { top: 20, right: 15, bottom: 30, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const { minPrice, maxPrice, minDate, maxDate } = useMemo(() => {
        if (data.length === 0) return { minPrice: 0, maxPrice: 1, minDate: new Date(), maxDate: new Date() };
        const prices = data.map(d => d.price);
        const dates = data.map(d => d.date.getTime());
        const pricePadding = (Math.max(...prices) - Math.min(...prices)) * 0.05 || 0.1;
        return {
            minPrice: Math.min(...prices) - pricePadding,
            maxPrice: Math.max(...prices) + pricePadding,
            minDate: new Date(Math.min(...dates)),
            maxDate: new Date(Math.max(...dates)),
        };
    }, [data]);

    const xScale = (date: Date) => {
        if (maxDate.getTime() === minDate.getTime()) return margin.left + innerWidth / 2;
        return margin.left + ((date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * innerWidth;
    };
    
    const yScale = (price: number) => {
         if (maxPrice <= minPrice) return margin.top + innerHeight / 2;
        return margin.top + innerHeight - ((price - minPrice) / (maxPrice - minPrice)) * innerHeight;
    };

    const linePath = data.map(d => `${xScale(d.date)},${yScale(d.price)}`).join(' L ');
    
    const yAxisTicks = 4;
    const yGridLines = useMemo(() => Array.from({ length: yAxisTicks + 1 }, (_, i) => {
        const price = minPrice + (i * (maxPrice - minPrice)) / yAxisTicks;
        return {
            y: yScale(price),
            label: formatCurrency(price),
        };
    }), [minPrice, maxPrice, yScale]);

    return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <g>
            {/* Y Axis Grid Lines & Labels */}
            {yGridLines.map((tick, i) => (
                <g key={i} className="text-gray-400">
                    <line x1={margin.left} y1={tick.y} x2={width - margin.right} y2={tick.y} className="stroke-current text-gray-200 dark:text-gray-700" strokeDasharray="2,2" />
                    <text x={margin.left - 8} y={tick.y} textAnchor="end" alignmentBaseline="middle" className="text-xs fill-current">{tick.label}</text>
                </g>
            ))}
            
            {/* X Axis Line */}
            <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} className="stroke-current text-gray-300 dark:text-gray-600" />
            
            {/* X Axis Labels */}
            {data.length > 0 && (
                <g className="text-gray-400">
                    <text x={margin.left} y={height - margin.bottom + 15} textAnchor="start" alignmentBaseline="middle" className="text-xs fill-current">
                        {minDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: '2-digit'})}
                    </text>
                    {maxDate.getTime() !== minDate.getTime() &&
                        <text x={width - margin.right} y={height - margin.bottom + 15} textAnchor="end" alignmentBaseline="middle" className="text-xs fill-current">
                            {maxDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: '2-digit'})}
                        </text>
                    }
                </g>
            )}

            {/* Line */}
            {data.length > 1 && <path d={`M ${linePath}`} fill="none" strokeWidth="2" className="stroke-current text-brand-secondary" />}

            {/* Points and Labels */}
            {data.map((d, i) => (
              <g key={i}>
                <circle 
                  cx={xScale(d.date)} 
                  cy={yScale(d.price)} 
                  r="5" 
                  className="fill-current text-brand-primary cursor-pointer stroke-2 stroke-white dark:stroke-gray-800"
                  onMouseEnter={() => setTooltip({
                      x: (xScale(d.date) / width) * 100,
                      y: (yScale(d.price) / height) * 100,
                      date: d.date.toLocaleDateString('pt-BR'),
                      price: formatCurrency(d.price)
                  })}
                  onMouseLeave={() => setTooltip(null)}
                />
                <text
                    x={xScale(d.date)}
                    y={yScale(d.price) - 10}
                    textAnchor="middle"
                    className="text-xs fill-current text-brand-text dark:text-gray-300 font-semibold"
                >
                    {formatCurrency(d.price)}
                </text>
              </g>
            ))}
        </g>
      </svg>
      {tooltip && (
        <div className="absolute p-2 text-xs text-white bg-gray-800 rounded-md shadow-lg pointer-events-none" style={{ left: `${tooltip.x}%`, top: `${tooltip.y}%`, transform: `translate(-50%, -120%)` }}>
            <div>{tooltip.date}</div>
            <div className="font-bold">{tooltip.price}</div>
        </div>
      )}
    </div>
    );
};

export const IngredientDetails: React.FC<IngredientDetailsProps> = ({ ingredient, onEdit, onDelete, onClose, onDeletePurchase }) => {
    const [period, setPeriod] = useState<Period>('all');
    const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);

    const sortedHistory = useMemo(() => {
        if (!ingredient.history) return [];
        return [...ingredient.history].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [ingredient.history]);

    const latestPrice = useMemo(() => {
        if (!sortedHistory[0]) return null;
        return getPricePerBaseUnit(sortedHistory[0].packagePrice, sortedHistory[0].packageAmount, sortedHistory[0].unit);
    }, [sortedHistory]);

    const priceComparison = useMemo(() => {
        if (sortedHistory.length < 2) return null;
        
        const latest = getPricePerBaseUnit(sortedHistory[0].packagePrice, sortedHistory[0].packageAmount, sortedHistory[0].unit);
        const previous = getPricePerBaseUnit(sortedHistory[1].packagePrice, sortedHistory[1].packageAmount, sortedHistory[1].unit);

        const valueDiff = latest.pricePerUnit - previous.pricePerUnit;
        const percentDiff = previous.pricePerUnit > 0 ? (valueDiff / previous.pricePerUnit) * 100 : 0;

        return { value: valueDiff, percent: percentDiff };
    }, [sortedHistory]);

    const chartData = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const filteredHistory = ingredient.history.filter(p => {
            if (period === 'all') return true;
            
            const [year, month, day] = p.date.split('-').map(Number);
            const purchaseDate = new Date(year, month - 1, day);

            const targetDate = new Date(today);
            if (period === '30d') targetDate.setDate(today.getDate() - 30);
            if (period === '6m') targetDate.setMonth(today.getMonth() - 6);
            if (period === '1y') targetDate.setFullYear(today.getFullYear() - 1);

            return purchaseDate >= targetDate;
        });
    
        return filteredHistory
            .map(p => {
                const { pricePerUnit } = getPricePerBaseUnit(p.packagePrice, p.packageAmount, p.unit);
                const [year, month, day] = p.date.split('-').map(Number);
                return {
                    date: new Date(year, month - 1, day),
                    price: pricePerUnit,
                };
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [ingredient, period]);

    const PriceDiffIndicator = () => {
        if (!priceComparison) return <p className="text-sm text-brand-light-text dark:text-gray-400">Sem dados para comparação.</p>;
        
        const isIncrease = priceComparison.value > 0;
        const isSame = priceComparison.value === 0;
        const colorClass = isSame ? 'text-gray-500' : isIncrease ? 'text-red-500' : 'text-green-500';

        return (
            <div className={`flex items-center gap-2 ${colorClass}`}>
                <span className="text-2xl font-bold">
                    {isSame ? '' : (isIncrease ? '▲' : '▼')} {formatCurrency(Math.abs(priceComparison.value))}
                </span>
                <span className="text-lg">({isIncrease ? '+' : ''}{priceComparison.percent.toFixed(1)}%)</span>
            </div>
        );
    }

    const confirmPurchaseDelete = () => {
      if (purchaseToDelete) {
        onDeletePurchase(ingredient.id, purchaseToDelete.id);
        setPurchaseToDelete(null);
      }
    };
    
  return (
    <>
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">{ingredient.name}</h1>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
              <ArrowLeftIcon className="w-5 h-5"/> Voltar
          </button>
          <button onClick={() => onEdit(ingredient)} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <PencilIcon className="w-5 h-5"/> Nova Compra
          </button>
          <button onClick={() => onDelete(ingredient.id)} className="flex items-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <TrashIcon className="w-5 h-5"/> Excluir
          </button>
        </div>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                <p className="text-sm text-brand-light-text dark:text-gray-400">Fornecedor Atual</p>
                <p className="font-display text-2xl font-bold text-brand-text dark:text-rose-100">{ingredient.supplier || 'Não informado'}</p>
            </div>
             <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                <p className="text-sm text-brand-light-text dark:text-gray-400">Preço Atual</p>
                <p className="font-display text-2xl font-bold text-brand-text dark:text-rose-100">{latestPrice ? `${formatCurrency(latestPrice.pricePerUnit)} / ${latestPrice.baseUnitLabel}` : 'N/A'}</p>
            </div>
             <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                <p className="text-sm text-brand-light-text dark:text-gray-400">Variação vs. Compra Anterior</p>
                <PriceDiffIndicator />
            </div>
      </div>
      
       <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
            <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-2">Variação de Preço ao Longo do Tempo</h2>
            <div className="flex justify-center flex-wrap gap-2 mb-4">
                {(['30d', '6m', '1y', 'all'] as const).map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-full transition-colors ${
                            period === p 
                            ? 'bg-brand-primary text-white shadow-sm' 
                            : 'bg-rose-100 hover:bg-rose-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-brand-light-text dark:text-gray-300'
                        }`}
                    >
                        {p === '30d' && '30 dias'}
                        {p === '6m' && '6 meses'}
                        {p === '1y' && '1 ano'}
                        {p === 'all' && 'Tudo'}
                    </button>
                ))}
            </div>
            {chartData.length > 0 ? (
                <LineChart data={chartData} />
            ) : (
                <div className="text-center text-brand-light-text dark:text-gray-400 italic py-10">
                    <p>{period === 'all' ? 'Dados insuficientes para gerar gráfico.' : 'Nenhum dado de compra neste período.'}</p>
                </div>
            )}
       </div>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Histórico de Compras</h2>
        <div className="max-h-96 overflow-y-auto pr-2">
            {sortedHistory.length > 0 ? (
                <table className="w-full text-left">
                    <thead className="sticky top-0 bg-rose-50 dark:bg-gray-700/80 backdrop-blur-sm">
                        <tr>
                            <th className="p-2 text-sm font-semibold text-brand-light-text dark:text-gray-400">Data</th>
                            <th className="p-2 text-sm font-semibold text-brand-light-text dark:text-gray-400">Fornecedor</th>
                            <th className="p-2 text-sm font-semibold text-brand-light-text dark:text-gray-400 text-right">Quantidade</th>
                            <th className="p-2 text-sm font-semibold text-brand-light-text dark:text-gray-400 text-right">Valor</th>
                            <th className="p-2 text-sm font-semibold text-brand-light-text dark:text-gray-400 text-right">Preço / Un. Base</th>
                            <th className="p-2 text-sm font-semibold text-brand-light-text dark:text-gray-400 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
                        {sortedHistory.map((purchase: Purchase) => {
                            const { pricePerUnit, baseUnitLabel } = getPricePerBaseUnit(purchase.packagePrice, purchase.packageAmount, purchase.unit);
                            return (
                                <tr key={purchase.id} className="hover:bg-rose-50 dark:hover:bg-gray-700/50">
                                    <td className="p-2 text-brand-text dark:text-gray-300">{new Date(purchase.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                    <td className="p-2 text-brand-text dark:text-gray-300">{purchase.supplier || 'N/A'}</td>
                                    <td className="p-2 text-brand-text dark:text-gray-300 text-right font-mono">{purchase.packageAmount}{purchase.unit}</td>
                                    <td className="p-2 text-brand-text dark:text-gray-300 text-right font-mono">{formatCurrency(purchase.packagePrice)}</td>
                                    <td className="p-2 text-brand-text dark:text-gray-300 text-right font-mono">{formatCurrency(pricePerUnit)} / {baseUnitLabel}</td>
                                    <td className="p-2 text-right">
                                        <button 
                                          onClick={() => setPurchaseToDelete(purchase)}
                                          aria-label="Excluir compra" 
                                          className="text-rose-400 hover:text-brand-primary dark:text-gray-400 dark:hover:text-rose-400 p-1 rounded-full hover:bg-rose-100 dark:hover:bg-gray-600 transition-colors"
                                        >
                                          <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <p className="text-center text-brand-light-text dark:text-gray-400 italic py-4">Nenhum histórico de compra encontrado.</p>
            )}
        </div>
      </div>
    </div>
    <ConfirmModal
        isOpen={!!purchaseToDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir esta compra de ${purchaseToDelete?.date ? new Date(purchaseToDelete.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''}? Esta ação não pode ser desfeita.`}
        onConfirm={confirmPurchaseDelete}
        onCancel={() => setPurchaseToDelete(null)}
    />
    </>
  );
};
