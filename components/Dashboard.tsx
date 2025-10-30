

import React, { useMemo } from 'react';
import type { Ingredient, Recipe, AppSettings, Packaging, Page, Unit } from '../types';
import { ShoppingBagIcon } from './icons/ShoppingBagIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { AdjustmentsHorizontalIcon } from './icons/AdjustmentsHorizontalIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { calculateCosts } from './costCalculator';
import { formatCurrency } from './utils';

interface DashboardProps {
  ingredients: Ingredient[];
  recipes: Recipe[];
  fillings: Recipe[];
  packaging: Packaging[];
  settings: AppSettings;
  setPage: (page: Page) => void;
  onGoToEditRecipe: (recipe: Recipe) => void;
  onGoToEditIngredient: (ingredient: Ingredient) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ ingredients, recipes, fillings, packaging, settings, setPage, onGoToEditRecipe, onGoToEditIngredient }) => {

  const ingredientsWithFillings = useMemo(() => {
    const fillingsAsIngredients: Ingredient[] = fillings
      .filter(f => calculateCosts(f, ingredients, packaging, settings, 'filling').netYieldAmount > 0)
      .map(filling => {
        const costs = calculateCosts(filling, ingredients, packaging, settings, 'filling');
        return {
            id: `filling-${filling.id}`,
            name: `${filling.name} (Recheio)`,
            packagePrice: costs.totalCost,
            packageAmount: costs.netYieldAmount,
            unit: filling.yieldUnit as Unit,
            history: [],
        };
    });
    return [...ingredients, ...fillingsAsIngredients];
  }, [ingredients, fillings, packaging, settings]);

  const recipesWithCalculatedCosts = useMemo(() => {
    return recipes.map(recipe => ({
      ...recipe,
      ...calculateCosts(recipe, ingredientsWithFillings, packaging, settings, 'recipe'),
    }));
  }, [recipes, ingredientsWithFillings, packaging, settings]);
  
  const topProfitableRecipes = recipesWithCalculatedCosts
    .filter(r => r.profitValue > 0)
    .sort((a, b) => b.profitValue - a.profitValue)
    .slice(0, 5);
    
  const alerts = useMemo(() => {
    const recipesWithMissingItems = recipes.filter(recipe => {
        const hasMissingIngredient = recipe.ingredientSections?.some(section =>
            section.ingredients.some(
                recipeIng => !ingredientsWithFillings.find(ing => ing.id === recipeIng.ingredientId)
            )
        );
        const hasMissingPackaging = recipe.packaging.some(
            recipePkg => !packaging.find(pkg => pkg.id === recipePkg.packagingId)
        );
        return hasMissingIngredient || hasMissingPackaging;
    });

    const uniqueRecipesWithMissingItems = Array.from(new Set(recipesWithMissingItems.map(r => r.id)))
        .map(id => recipes.find(r => r.id === id)!);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date
    const outdatedIngredients = ingredients.filter(ing => {
        if (!ing.purchaseDate) return false;
        const purchaseDate = new Date(ing.purchaseDate);
        const diffTime = today.getTime() - purchaseDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > (settings.ingredientOutdatedDays || 45);
    });


    return { recipesWithMissingItems: uniqueRecipesWithMissingItems, outdatedIngredients };
  }, [recipes, ingredients, ingredientsWithFillings, packaging, settings.ingredientOutdatedDays]);

  const StatCard: React.FC<{
    icon: React.ElementType,
    label: string,
    value: string | number,
    colorClass: string,
    onClick?: () => void
  }> = ({ icon: Icon, label, value, colorClass, onClick }) => {
    const cardContent = (
      <div className="flex items-center gap-4">
        <div className={`${colorClass} text-white p-3 rounded-full`}>
          <Icon className="w-8 h-8" />
        </div>
        <div>
          <p className="text-4xl font-bold text-brand-text dark:text-white">{value}</p>
          <p className="text-brand-light-text dark:text-gray-400">{label}</p>
        </div>
      </div>
    );

    const cardClasses = "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 w-full text-left";

    if (onClick) {
      return (
        <button onClick={onClick} className={`${cardClasses} transition-transform transform hover:scale-105 hover:shadow-xl`}>
          {cardContent}
        </button>
      );
    }
    return <div className={cardClasses}>{cardContent}</div>;
  };

  const hasAlerts = alerts.recipesWithMissingItems.length > 0 || alerts.outdatedIngredients.length > 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            icon={ShoppingBagIcon}
            label="Ingredientes Cadastrados"
            value={ingredients.length}
            colorClass="bg-brand-primary"
            onClick={() => setPage('ingredients')}
        />
        <StatCard 
            icon={BookOpenIcon}
            label="Receitas Criadas"
            value={recipes.length}
            colorClass="bg-brand-secondary"
            onClick={() => setPage('recipes')}
        />
        <StatCard 
            icon={AdjustmentsHorizontalIcon}
            label="Valor da Hora Trabalhada"
            value={formatCurrency(settings.laborCostPerHour)}
            colorClass="bg-brand-accent"
            onClick={() => setPage('settings')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 h-full">
            <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Painel de Avisos</h2>
            {!hasAlerts ? (
                <div className="flex flex-col items-center justify-center text-center h-full py-10">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mb-4" />
                    <p className="font-semibold text-brand-text dark:text-gray-200">Tudo em ordem!</p>
                    <p className="text-sm text-brand-light-text dark:text-gray-400">Nenhum aviso para suas receitas ou ingredientes.</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {alerts.recipesWithMissingItems.map(recipe => (
                        <li key={`missing-${recipe.id}`} className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-gray-700/50 rounded-lg border border-rose-200 dark:border-gray-600">
                            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
                            <div>
                                <button onClick={() => onGoToEditRecipe(recipe)} className="font-semibold text-brand-text dark:text-rose-100 hover:underline text-left">{recipe.name}</button>
                                <p className="text-sm text-brand-light-text dark:text-gray-400">
                                    Contém ingredientes ou embalagens que foram excluídos. O cálculo do custo pode estar incorreto.
                                </p>
                            </div>
                        </li>
                    ))}
                     {alerts.outdatedIngredients.map(ingredient => (
                        <li key={`outdated-${ingredient.id}`} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-gray-700/50 rounded-lg border border-blue-200 dark:border-gray-600">
                            <InformationCircleIcon className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                            <div>
                                <button onClick={() => onGoToEditIngredient(ingredient)} className="font-semibold text-brand-text dark:text-rose-100 hover:underline text-left">{ingredient.name}</button>
                                <p className="text-sm text-brand-light-text dark:text-gray-400">
                                    Preço não atualizado há mais de {settings.ingredientOutdatedDays} dias. Clique para registrar uma nova compra.
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 h-full">
            <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Top 5 Receitas Mais Lucrativas</h2>
            {topProfitableRecipes.length > 0 ? (
            <ul className="space-y-3">
                {topProfitableRecipes.map((recipe, index) => (
                <li key={recipe.id} className="flex justify-between items-center bg-rose-50 dark:bg-gray-700/50 p-4 rounded-lg border border-rose-200 dark:border-gray-600">
                    <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-brand-accent">#{index + 1}</span>
                    <div>
                            <p className="font-semibold text-brand-text dark:text-gray-200">{recipe.name}</p>
                            <p className="text-sm text-brand-light-text dark:text-gray-400">Venda: {formatCurrency(recipe.finalSalePrice)}</p>
                    </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-green-600 dark:text-green-400 text-lg">{formatCurrency(recipe.profitValue)}</p>
                        <p className="text-sm text-brand-light-text dark:text-gray-400">Lucro Bruto (Total)</p>
                    </div>
                </li>
                ))}
            </ul>
            ) : (
            <p className="text-center text-brand-light-text dark:text-gray-400 italic py-4">Nenhuma receita com lucro calculado para classificar.</p>
            )}
        </div>
      </div>
    </div>
  );
};
