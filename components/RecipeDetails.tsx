import React, { useMemo, useState } from 'react';
import type { Recipe, Ingredient, Packaging, AppSettings } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { calculateCosts, convertToBaseUnitAmount } from './costCalculator';
import { formatCurrency } from './utils';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { ConfirmModal } from './ConfirmModal';

declare global {
  interface Window {
    html2pdf: any;
  }
}

interface RecipeDetailsProps {
  recipe: Recipe;
  ingredients: Ingredient[];
  packagingItems: Packaging[];
  settings: AppSettings;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
  onClose: () => void;
  type: 'recipe' | 'filling';
}

const PieChart: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;

  let cumulativeAngle = 0;

  const slices = data.map((item, index) => {
    const angle = (item.value / total) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const endAngle = cumulativeAngle;

    const startX = 50 + 40 * Math.cos((startAngle - 90) * (Math.PI / 180));
    const startY = 50 + 40 * Math.sin((startAngle - 90) * (Math.PI / 180));
    const endX = 50 + 40 * Math.cos((endAngle - 90) * (Math.PI / 180));
    const endY = 50 + 40 * Math.sin((endAngle - 90) * (Math.PI / 180));
    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = `M 50,50 L ${startX},${startY} A 40,40 0 ${largeArcFlag},1 ${endX},${endY} Z`;

    return { ...item, pathData, startAngle, endAngle };
  });

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {slices.map((slice) => (
          <g 
            key={slice.name} 
            onMouseEnter={() => setHoveredSlice(slice.name)} 
            onMouseLeave={() => setHoveredSlice(null)}
          >
            <path d={slice.pathData} fill={slice.color} className="transition-transform duration-200" style={{ transformOrigin: '50% 50%', transform: hoveredSlice === slice.name ? 'scale(1.05)' : 'scale(1)' }}/>
          </g>
        ))}
      </svg>
      {hoveredSlice && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-800/80 text-white text-center p-2 rounded-md shadow-lg">
            <p className="font-bold text-sm">{hoveredSlice}</p>
            <p className="text-xs">{formatCurrency(slices.find(s => s.name === hoveredSlice)?.value || 0)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const RecipeDetails: React.FC<RecipeDetailsProps> = ({ recipe, ingredients, packagingItems, settings, onEdit, onDelete, onClose, type }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const costBreakdown = useMemo(() => {
    return calculateCosts(recipe, ingredients, packagingItems, settings, type);
  }, [recipe, ingredients, packagingItems, settings, type]);

  const chartData = useMemo(() => {
    const data = [
      { name: 'Ingredientes', value: costBreakdown.ingredientsCost, color: '#F472B6' },
      { name: 'Embalagens', value: costBreakdown.packagingCost, color: '#FB923C' },
      { name: 'Mão de Obra', value: costBreakdown.laborCost, color: '#60A5FA' },
      { name: 'Energia', value: costBreakdown.energyCost, color: '#FACC15' },
      { name: 'Gás', value: costBreakdown.gasCost, color: '#A78BFA' },
      { name: 'Impostos', value: costBreakdown.taxValue, color: '#9CA3AF' },
      { name: 'Taxas Variáveis', value: costBreakdown.variableCostsValue, color: '#34D399' },
    ];
    return data.filter(item => item.value > 0).sort((a, b) => b.value - a.value);
  }, [costBreakdown]);
  
  const hasPreparationMethod = recipe.preparationMethod && recipe.preparationMethod.some(step => step.trim() !== '');
  const hasObservations = recipe.observations && recipe.observations.some(obs => obs.trim() !== '');
  
  const confirmDelete = () => {
    onDelete(recipe.id);
    setShowDeleteConfirm(false);
  };

  const handleGeneratePdf = async () => {
    if (typeof window.html2pdf !== 'function') {
      alert("Erro: A biblioteca de geração de PDF não foi carregada. Tente recarregara página.");
      return;
    }
    
    try {
      // Explicitly wait for the 'Antonio' font to be loaded before measuring its width.
      // This prevents issues where the font isn't ready on the first PDF generation,
      // which would cause an incorrect text width calculation.
      await document.fonts.load('600 21px Antonio');
    } catch (err) {
      console.error('Font could not be loaded for PDF generation:', err);
      // Proceeding anyway. The layout might be incorrect if a fallback font is used.
    }

    const tempSpan = document.createElement('span');
    tempSpan.style.fontFamily = 'Antonio, sans-serif';
    tempSpan.style.fontSize = '21px';
    tempSpan.style.fontWeight = '600';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.innerText = recipe.name.toUpperCase();
    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.getBoundingClientRect().width;
    document.body.removeChild(tempSpan);

    const barHeight = Math.max(181, textWidth + 40);
    const pathH = barHeight - (181 - 180.04);
    const pathCurveControlY = pathH - (180.04 - 173.66);
    const pathVerticalLineEndY = pathH - (180.04 - 165.78);

    let ingredientesHtml = '';
    recipe.ingredientSections.forEach(section => {
      if (recipe.ingredientSections.length > 1 || section.name !== "Ingredientes") {
        ingredientesHtml += `<div style="font-family: Antonio, sans-serif; font-weight: 600; font-size: 14px; margin-top: 8px; margin-bottom: 4px;">${section.name}</div>`;
      }
      section.ingredients.forEach(ing => {
        const ingData = ingredients.find(i => i.id === ing.ingredientId);
        ingredientesHtml += `<div>• ${ing.amount}${ing.unit} ${ingData ? ingData.name : 'Ingrediente Excluído'}</div>`;
      });
    });

    const preparoHtml = type === 'recipe' && hasPreparationMethod ? recipe.preparationMethod!.map(step => `<div>• ${step}</div>`).join('') : '';
    const observacoesTitle = recipe.observationsTitle || 'OBSERVAÇÕES';
    const observacoesListHtml = type === 'recipe' && hasObservations ? recipe.observations!.map(obs => `<div>• ${obs}</div>`).join('') : '';

    const measureElement = document.createElement('div');
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.left = '-9999px';
    document.body.appendChild(measureElement);

    const baseStyle = "font-family: Inter, sans-serif; font-size: 12px; line-height: 1.5; word-wrap: break-word;";
    const titleStyle = "color: black; font-size: 18px; font-family: Antonio, sans-serif; font-weight: 600; word-wrap: break-word; margin-bottom: 10px;";

    const ingredientsContainer = document.createElement('div');
    ingredientsContainer.style.width = '180px';
    ingredientsContainer.innerHTML = `<div style="${titleStyle}">INGREDIENTES</div><div style="${baseStyle}">${ingredientesHtml}</div>`;
    measureElement.appendChild(ingredientsContainer);
    const ingredientsHeight = ingredientsContainer.clientHeight;
    
    let preparoHeight = 0;
    if (type === 'recipe' && hasPreparationMethod) {
      const preparoContainer = document.createElement('div');
      preparoContainer.style.width = '190px';
      preparoContainer.innerHTML = `<div style="${titleStyle}">MODO DE PREPARO</div><div style="${baseStyle}">${preparoHtml}</div>`;
      measureElement.appendChild(preparoContainer);
      preparoHeight = preparoContainer.clientHeight;
    }
    
    let observationsHeight = 0;
    if (type === 'recipe' && hasObservations) {
        const obsContainer = document.createElement('div');
        obsContainer.style.width = '420px';
        obsContainer.innerHTML = `<div style="text-align: center; ${titleStyle}">${observacoesTitle.toUpperCase()}</div><div style="text-align: left; ${baseStyle}">${observacoesListHtml}</div>`;
        measureElement.appendChild(obsContainer);
        observationsHeight = obsContainer.clientHeight;
    }
    
    document.body.removeChild(measureElement);

    const cardTop = 143.35;
    const cardPadding = 25;
    const mainContentHeight = Math.max(ingredientsHeight, preparoHeight);
    const observationsSectionHeight = type === 'recipe' && hasObservations ? cardPadding + observationsHeight : 0;
    const totalContentHeight = mainContentHeight + observationsSectionHeight;
    const newCardHeight = totalContentHeight + (cardPadding * 2);
    const finalCardHeight = Math.max(401, newCardHeight);

    const mainContentHtml = `
      <div style="display: flex; flex-direction: row; justify-content: flex-start; gap: 30px; align-items: flex-start;">
        <div style="width: 180px; flex-shrink: 0;">
            <div style="${titleStyle}">INGREDIENTES</div>
            <div style="${baseStyle}">${ingredientesHtml}</div>
        </div>
        ${(type === 'recipe' && hasPreparationMethod) ? `
          <div style="width: 190px; flex-shrink: 0;">
              <div style="${titleStyle}">MODO DE PREPARO</div>
              <div style="${baseStyle}">${preparoHtml}</div>
          </div>
        ` : ''}
      </div>
    `;

    const observationsHtml = (type === 'recipe' && hasObservations) ? `
        <div style="margin-top: ${cardPadding}px;">
            <div style="text-align: center; ${titleStyle}">${observacoesTitle.toUpperCase()}</div>
            <div style="text-align: left; ${baseStyle}">${observacoesListHtml}</div>
        </div>
    ` : '';
    
    const bleed = 20;
    const pdfPageWidth = 595.28;
    const oversizedWidth = pdfPageWidth + (bleed * 2);
    const centralizingOffset = 43; // Offset to center the content block

    const element = document.createElement('div');
    element.innerHTML = `
      <div style="
        width: ${oversizedWidth}px; 
        height: 841.89px; 
        position: relative; 
        margin-left: -${bleed}px; 
        padding: 0;
        border: none;
        box-sizing: border-box;
        overflow: hidden; 
        background-color: #E1E1E1;
      ">
        
            <div style="position: absolute; left: ${8.97 + bleed + centralizingOffset}px; top: ${cardTop}px; width: 491.33px; height: ${finalCardHeight}px; background: white; border-radius: 33.77px; z-index: 2;"></div>
            
            <div style="position: absolute; left: ${96 + bleed + centralizingOffset}px; top: 22px; color: black; font-size: 68px; font-family: Antonio, sans-serif; word-wrap: break-word; z-index: 6;">
              <span style="font-weight: 100;">FICHA</span> <span style="font-weight: 300;">TÉCNICA</span>
            </div>
            
            <div style="position: absolute; left: ${bleed + centralizingOffset}px; top: 142px; z-index: 4;">
              <svg width="52" height="${barHeight}" viewBox="0 0 52 ${barHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.28 ${pathH}H14.26C6.38 ${pathH} 0 ${pathCurveControlY} 0 ${pathVerticalLineEndY}V14.26C0 6.38001 6.38 0 14.26 0H37.28C45.16 0 51.54 6.38001 51.54 14.26V${pathVerticalLineEndY}C51.54 ${pathCurveControlY} 45.15 ${pathH} 37.28 ${pathH}Z" fill="black"/>
              </svg>
            </div>
            
            <div style="position: absolute; left: ${bleed + centralizingOffset}px; top: 142px; width: 52px; height: ${barHeight}px; display: flex; align-items: center; justify-content: center; overflow: hidden; z-index: 5;">
              <div style="transform: rotate(-90deg); color: white; font-size: 21px; font-family: Antonio, sans-serif; font-weight: 600; white-space: nowrap; text-align: center;">${recipe.name.toUpperCase()}</div>
            </div>
            
            <div style="position: absolute; left: ${61 + bleed + centralizingOffset}px; top: ${cardTop + cardPadding}px; width: 420px; box-sizing: border-box; z-index: 3;">
                ${mainContentHtml}
                ${observationsHtml}
            </div>
      </div>`;
    
    const pdfElement = element.firstElementChild as HTMLElement;

    if (pdfElement) {
      const filename = `Ficha_Tecnica_${recipe.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'px', format: [595.28, 841.89], orientation: 'portrait' },
      };
      
      window.html2pdf().from(pdfElement).set(opt).save();
    }
  };


  return (
    <>
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">{recipe.name}</h1>
                {recipe.category && (
                    <span className="px-3 py-1 bg-rose-100 dark:bg-gray-700 text-brand-primary dark:text-rose-200 text-xs font-bold rounded-full uppercase tracking-wider">
                        {recipe.category}
                    </span>
                )}
            </div>
            <p className="text-brand-light-text dark:text-gray-400">Rendimento Bruto: {recipe.yieldAmount} {recipe.yieldUnit}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onClose} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
              <ArrowLeftIcon className="w-5 h-5"/> Voltar
          </button>
          <button onClick={() => onEdit(recipe)} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <PencilIcon className="w-5 h-5"/> Editar
          </button>
          <button onClick={handleGeneratePdf} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <DocumentArrowDownIcon className="w-5 h-5"/> Gerar PDF
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
            <TrashIcon className="w-5 h-5"/> Excluir
          </button>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {type === 'recipe' ? (
                <>
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                        <p className="text-sm text-brand-light-text dark:text-gray-400">Custo Total</p>
                        <p className="font-display text-4xl font-bold text-brand-text dark:text-rose-100">{formatCurrency(costBreakdown.totalCost)}</p>
                    </div>
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                        <p className="text-sm text-green-700 dark:text-green-300">Preço de Venda</p>
                        <p className="font-display text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(costBreakdown.finalSalePrice)}</p>
                    </div>
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                        <p className="text-sm text-purple-700 dark:text-purple-300">Lucro Bruto</p>
                        <p className="font-display text-4xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(costBreakdown.profitValue)}</p>
                    </div>
                </>
            ) : (
                <>
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                        <p className="text-sm text-brand-light-text dark:text-gray-400">Custo Total do Recheio</p>
                        <p className="font-display text-4xl font-bold text-brand-text dark:text-rose-100">{formatCurrency(costBreakdown.totalCost)}</p>
                    </div>
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                        <p className="text-sm text-blue-700 dark:text-blue-300">Rendimento Líquido</p>
                        <p className="font-display text-4xl font-bold text-blue-600 dark:text-blue-400">{costBreakdown.netYieldAmount.toFixed(2)} {recipe.yieldUnit}</p>
                    </div>
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-center">
                        <p className="text-sm text-green-700 dark:text-green-300">Preço por Kg</p>
                        <p className="font-display text-4xl font-bold text-green-600 dark:text-green-400">{formatCurrency(costBreakdown.pricePerKg)}</p>
                    </div>
                </>
            )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
            <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Análise de Custos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <PieChart data={chartData} />
              </div>
              <div>
                <ul className="space-y-3">
                  {chartData.map(item => (
                    <li key={item.name} className="flex justify-between items-center text-base">
                        <div className="flex items-center gap-3">
                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></span>
                            <span className="text-brand-light-text dark:text-gray-400">{item.name}</span>
                        </div>
                        <div className="text-right">
                            <span className="font-semibold text-brand-text dark:text-gray-200">{formatCurrency(item.value)}</span>
                            <span className="ml-2 text-sm font-mono text-gray-500 dark:text-gray-500">
                              {costBreakdown.finalSalePrice > 0 ? `(${(item.value / costBreakdown.finalSalePrice * 100).toFixed(1)}%)` : '(0.0%)'}
                            </span>
                        </div>
                    </li>
                  ))}
                  <li className="flex justify-between items-center text-lg pt-2 border-t border-rose-200 dark:border-gray-600">
                    <span className="font-bold text-brand-text dark:text-rose-100">Preço Final</span>
                    <span className="font-bold text-brand-text dark:text-rose-100">{formatCurrency(costBreakdown.finalSalePrice)}</span>
                  </li>
                </ul>
              </div>
            </div>
        </div>
        <div className="lg:col-span-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
            <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">
                {type === 'recipe' ? 'Detalhes do Preço' : 'Listas de Itens'}
            </h2>
            {type === 'recipe' ? (
                <ul className="space-y-2 text-sm">
                    <li className="flex justify-between items-center">
                        <span className="text-brand-light-text dark:text-gray-400">Custo de Produção (Base)</span>
                        <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{formatCurrency(costBreakdown.baseCost)}</span>
                    </li>
                    <li className="flex justify-between items-center">
                        <span className="text-brand-light-text dark:text-gray-400">(+) Impostos ({recipe.taxPercentage !== undefined ? recipe.taxPercentage : settings.taxPercentage}%)</span>
                        <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{formatCurrency(costBreakdown.taxValue)}</span>
                    </li>
                    <li className="flex justify-between items-center">
                        <span className="text-brand-light-text dark:text-gray-400">(+) Custos Variáveis ({recipe.variableCostsPercentage || 0}%)</span>
                        <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{formatCurrency(costBreakdown.variableCostsValue)}</span>
                    </li>
                     <li className="flex justify-between items-center border-t border-rose-200 dark:border-gray-600 pt-1">
                        <span className="text-brand-text dark:text-rose-100 font-semibold">(=) Custo Total</span>
                        <span className="font-mono text-brand-text dark:text-rose-100 font-semibold">{formatCurrency(costBreakdown.totalCost)}</span>
                    </li>
                    <li className="flex justify-between items-center mt-2">
                        <span className="text-brand-light-text dark:text-gray-400">(+) Lucro Desejado ({recipe.profitMargin || 0}%)</span>
                        <span className="font-mono font-semibold text-brand-text dark:text-gray-200">{formatCurrency(costBreakdown.profitValue)}</span>
                    </li>
                    <li className="flex justify-between items-center font-bold text-lg text-green-600 dark:text-green-400 border-t-2 border-green-200 dark:border-green-700 pt-2 mt-2">
                        <span>(=) Preço de Venda Final</span>
                        <span className="font-mono">{formatCurrency(costBreakdown.finalSalePrice)}</span>
                    </li>
                     <li className="flex justify-between items-center text-base mt-1">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">Preço por {recipe.yieldUnit}</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{formatCurrency(costBreakdown.salePricePerUnit)}</span>
                    </li>
                </ul>
            ) : (
                <div className="space-y-4">
                     <div>
                        <h3 className="font-semibold text-brand-primary dark:text-brand-secondary mb-1">Ingredientes</h3>
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
                          {recipe.ingredientSections.flatMap(s => s.ingredients).map(ing => {
                              const ingData = ingredients.find(i => i.id === ing.ingredientId);
                              if (!ingData) return <div key={ing.id} className="text-rose-500 italic text-sm">Ingrediente não encontrado</div>;
                              const cost = (ingData.packagePrice / convertToBaseUnitAmount(ingData.packageAmount, ingData.unit)) * convertToBaseUnitAmount(ing.amount, ing.unit);
                              return (
                                <div key={ing.id} className="flex justify-between text-sm">
                                  <span className="text-brand-light-text dark:text-gray-400">{ingData.name} ({ing.amount}{ing.unit})</span>
                                  <span className="font-mono text-brand-text dark:text-gray-300">{formatCurrency(cost)}</span>
                                </div>
                              );
                          })}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Lista de Ingredientes</h2>
           <div className="space-y-4 max-h-96 overflow-y-auto pr-2 text-base">
              {recipe.ingredientSections.map(section => (
                <div key={section.id}>
                  {recipe.ingredientSections.length > 1 && <h3 className="font-semibold text-brand-primary dark:text-brand-secondary mb-1">{section.name}</h3>}
                  <ul className="space-y-1 pl-2 border-l-2 border-rose-100 dark:border-gray-700">
                    {section.ingredients.map(ing => {
                      const ingData = ingredients.find(i => i.id === ing.ingredientId);
                      if (!ingData) return <li key={ing.id} className="text-rose-500 italic">Ingrediente não encontrado</li>;
                       const cost = (ingData.packagePrice / convertToBaseUnitAmount(ingData.packageAmount, ingData.unit)) * convertToBaseUnitAmount(ing.amount, ing.unit);
                      return (
                        <li key={ing.id} className="flex justify-between">
                            <span className="text-brand-light-text dark:text-gray-400">{ingData.name} ({ing.amount}{ing.unit})</span>
                            <span className="font-mono text-brand-text dark:text-gray-300">{formatCurrency(cost)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Lista de Embalagens</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 text-base">
              {recipe.packaging.length > 0 ? (
                <ul className="space-y-1">
                    {recipe.packaging.map(pkg => {
                        const pkgData = packagingItems.find(p => p.id === pkg.packagingId);
                        if(!pkgData) return <li key={pkg.id} className="text-rose-500 italic">Embalagem não encontrada</li>;
                        const cost = (pkgData.price / pkgData.amount) * pkg.amount;
                        return (
                            <li key={pkg.id} className="flex justify-between">
                                <span className="text-brand-light-text dark:text-gray-400">{pkgData.name} (x{pkg.amount})</span>
                                <span className="font-mono text-brand-text dark:text-gray-300">{formatCurrency(cost)}</span>
                            </li>
                        );
                    })}
                </ul>
              ) : <p className="text-brand-light-text dark:text-gray-400 italic">Nenhuma embalagem adicionada.</p>}
          </div>
        </div>
      </div>

      {(type === 'recipe' && hasPreparationMethod) && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
              <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Modo de Preparo</h2>
              <ol className="list-decimal list-inside space-y-2 text-brand-light-text dark:text-gray-300">
                  {recipe.preparationMethod!.map((step, index) => (
                      <li key={index} className="pl-2 whitespace-pre-wrap">{step}</li>
                  ))}
              </ol>
          </div>
      )}

      {(type === 'recipe' && hasObservations) && (
          <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 ${!hasPreparationMethod && 'md:col-start-1'}`}>
              <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">{recipe.observationsTitle || 'Observações'}</h2>
              <ul className="list-disc list-inside space-y-2 text-brand-light-text dark:text-gray-300">
                  {recipe.observations!.map((obs, index) => (
                      <li key={index} className="pl-2 whitespace-pre-wrap">{obs}</li>
                  ))}
              </ul>
          </div>
      )}

    </div>
    <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir "${recipe.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
};