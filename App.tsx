import React, { useState, useEffect, useMemo } from 'react';
import type { Ingredient, Packaging, Recipe, AppSettings, Page, Unit } from './types';
import { IngredientManager } from './components/IngredientManager';
import { PackagingManager } from './components/PackagingManager';
import { Settings } from './components/Settings';
import { Dashboard } from './components/Dashboard';
import { Recipes } from './components/Recipes';
import { RecipePricer } from './components/RecipePricer';
import { RecipeDetails } from './components/RecipeDetails';
import { IngredientForm } from './components/IngredientForm';
import { PackagingForm } from './components/PackagingForm';
import { IngredientDetails } from './components/IngredientDetails';
import { defaultIngredients, defaultPackaging, defaultRecipes, defaultSettings } from './components/defaultData';
import { SunIcon } from './components/icons/SunIcon';
import { MoonIcon } from './components/icons/MoonIcon';
import { ChartBarIcon } from './components/icons/ChartBarIcon';
import { ShoppingBagIcon } from './components/icons/ShoppingBagIcon';
import { BoxIcon } from './components/icons/BoxIcon';
import { BookOpenIcon } from './components/icons/BookOpenIcon';
import { AdjustmentsHorizontalIcon } from './components/icons/AdjustmentsHorizontalIcon';
import { FireIcon } from './components/icons/FireIcon';
import { calculateCosts } from './components/costCalculator';

const usePersistentState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = window.localStorage.getItem(key);
      if (key === 'theme') return (storedValue === 'dark') as T;
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      if (key === 'theme') {
         window.localStorage.setItem(key, state ? 'dark' : 'light');
      } else {
         window.localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
};

const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = usePersistentState<boolean>('theme', document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return [isDarkMode, setIsDarkMode] as const;
};

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('dashboard');
  const [ingredients, setIngredients] = usePersistentState<Ingredient[]>('ingredients', defaultIngredients);
  const [packaging, setPackaging] = usePersistentState<Packaging[]>('packaging', defaultPackaging);
  const [recipes, setRecipes] = usePersistentState<Recipe[]>('recipes', defaultRecipes);
  const [fillings, setFillings] = usePersistentState<Recipe[]>('fillings', []);
  const [settings, setSettings] = usePersistentState<AppSettings>('settings', defaultSettings);
  
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  const [recipeToView, setRecipeToView] = useState<Recipe | null>(null);
  const [fillingToEdit, setFillingToEdit] = useState<Recipe | null>(null);
  const [fillingToView, setFillingToView] = useState<Recipe | null>(null);

  const [ingredientToEdit, setIngredientToEdit] = useState<Ingredient | null>(null);
  const [ingredientFormMode, setIngredientFormMode] = useState<'create' | 'edit' | 'addPurchase'>('create');
  const [ingredientToView, setIngredientToView] = useState<Ingredient | null>(null);
  const [highlightedIngredientId, setHighlightedIngredientId] = useState<string | null>(null);
  const [packagingToEdit, setPackagingToEdit] = useState<Packaging | null>(null);
  const [isDarkMode, setIsDarkMode] = useDarkMode();

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

  useEffect(() => {
    // One-time data migration for ingredients to ensure each purchase has a unit.
    const needsIngredientMigration = ingredients.some(ing => !ing.history || ing.history.some(p => p.unit === undefined));
    if (needsIngredientMigration) {
        const migratedIngredients = ingredients.map(ing => {
            let history = ing.history;
            if (!history) {
                history = [{
                    id: ing.id + '-' + new Date().getTime(),
                    date: ing.purchaseDate || new Date().toISOString().split('T')[0],
                    supplier: ing.supplier,
                    packagePrice: ing.packagePrice,
                    packageAmount: ing.packageAmount,
                    unit: ing.unit,
                }];
            }
            const historyWithUnits = history.map(p => ({ ...p, unit: p.unit || ing.unit }));
            const sortedHistory = historyWithUnits.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const latestPurchase = sortedHistory[0];
            if (!latestPurchase) return { ...ing, history: sortedHistory };
            return {
                ...ing,
                supplier: latestPurchase.supplier,
                packagePrice: latestPurchase.packagePrice,
                packageAmount: latestPurchase.packageAmount,
                unit: latestPurchase.unit,
                purchaseDate: latestPurchase.date,
                history: sortedHistory,
            };
        });
        setIngredients(migratedIngredients);
    }
    
    // One-time data migration for recipes to add evaporationPercentage
    const needsRecipeMigration = recipes.some(r => r.evaporationPercentage === undefined);
    if (needsRecipeMigration) {
      setRecipes(prev => prev.map(r => r.evaporationPercentage === undefined ? { ...r, evaporationPercentage: 0 } : r));
    }

    const needsFillingMigration = fillings.some(r => r.evaporationPercentage === undefined);
    if (needsFillingMigration) {
      setFillings(prev => prev.map(r => r.evaporationPercentage === undefined ? { ...r, evaporationPercentage: 0 } : r));
    }
}, []);


  // --- RECIPE HANDLERS ---
  const handleSaveRecipe = (recipe: Recipe) => {
    setRecipes(prev => {
      const exists = prev.some(r => r.id === recipe.id);
      if (exists) {
        return prev.map(r => r.id === recipe.id ? recipe : r);
      }
      return [...prev, recipe];
    });
    setPage('recipes');
    setRecipeToEdit(null);
  };
  const handleEditRecipe = (recipe: Recipe) => { setRecipeToEdit(recipe); setPage('recipe-pricer'); };
  const handleDeleteRecipe = (recipeId: string) => { setRecipes(prev => prev.filter(r => r.id !== recipeId)); setPage('recipes'); setRecipeToView(null); };
  const handleViewRecipeDetails = (recipe: Recipe) => { setRecipeToView(recipe); setPage('recipe-details'); }
  const handleAddNewRecipe = () => { setRecipeToEdit(null); setPage('recipe-pricer'); };
  const handleCancelRecipePricer = () => { setRecipeToEdit(null); setPage('recipes'); }

  // --- FILLING HANDLERS ---
  const handleSaveFilling = (filling: Recipe) => {
    setFillings(prev => {
      const exists = prev.some(r => r.id === filling.id);
      if (exists) {
        return prev.map(r => r.id === filling.id ? filling : r);
      }
      return [...prev, filling];
    });
    setPage('fillings');
    setFillingToEdit(null);
  };
  const handleEditFilling = (filling: Recipe) => { setFillingToEdit(filling); setPage('filling-pricer'); };
  const handleDeleteFilling = (fillingId: string) => { setFillings(prev => prev.filter(r => r.id !== fillingId)); setPage('fillings'); setFillingToView(null); };
  const handleViewFillingDetails = (filling: Recipe) => { setFillingToView(filling); setPage('filling-details'); };
  const handleAddNewFilling = () => { setFillingToEdit(null); setPage('filling-pricer'); };
  const handleCancelFillingPricer = () => { setFillingToEdit(null); setPage('fillings'); };


  // --- INGREDIENT HANDLERS ---
  const handleAddNewIngredient = () => { setIngredientToEdit(null); setIngredientFormMode('create'); setPage('ingredient-form'); };
  const handleEditIngredient = (ingredient: Ingredient) => { setIngredientToEdit(ingredient); setIngredientFormMode('edit'); setPage('ingredient-form'); };
  const handleStartAddPurchase = (ingredient: Ingredient) => { setIngredientToEdit(ingredient); setIngredientFormMode('addPurchase'); setPage('ingredient-form'); };
  const handleViewIngredientDetails = (ingredient: Ingredient) => { setIngredientToView(ingredient); setPage('ingredient-details'); };
  const handleSaveIngredient = (ingredient: Ingredient) => {
    const wasEditing = !!ingredientToEdit;
    setIngredients(prev => {
      const exists = prev.some(i => i.id === ingredient.id);
      if (exists) return prev.map(i => (i.id === ingredient.id ? ingredient : i));
      return [...prev, ingredient];
    });
    setIngredientToEdit(null);
    if (wasEditing) {
      if (ingredientFormMode === 'addPurchase') {
        setIngredientToView(ingredient); setPage('ingredient-details');
      } else {
        setHighlightedIngredientId(ingredient.id); setPage('ingredients');
      }
    } else {
      setPage('ingredients');
    }
  };
  const handleCancelIngredientForm = () => {
    const previousPage = ingredientToEdit ? 'ingredient-details' : 'ingredients';
    const ingredientToKeepViewing = ingredientToEdit;
    setIngredientToEdit(null);
    if (previousPage === 'ingredient-details' && ingredientToKeepViewing) {
      setIngredientToView(ingredientToKeepViewing); setPage('ingredient-details');
    } else {
      setPage('ingredients');
    }
  };
  const handleDeleteIngredient = (ingredientId: string) => { setIngredients(prev => prev.filter(i => i.id !== ingredientId)); setPage('ingredients'); setIngredientToView(null); };
  const handleDeletePurchase = (ingredientId: string, purchaseId: string) => {
    setIngredients(prevIngredients => {
      const ingredientIndex = prevIngredients.findIndex(i => i.id === ingredientId);
      if (ingredientIndex === -1) return prevIngredients;
      const newIngredients = [...prevIngredients];
      const ingredient = JSON.parse(JSON.stringify(newIngredients[ingredientIndex]));
      ingredient.history = ingredient.history.filter((p: any) => p.id !== purchaseId);
      if (ingredient.history.length === 0) {
          ingredient.packagePrice = 0; ingredient.packageAmount = 0; ingredient.purchaseDate = undefined; ingredient.supplier = undefined;
      } else {
          ingredient.history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestPurchase = ingredient.history[0];
          ingredient.packagePrice = latestPurchase.packagePrice; ingredient.packageAmount = latestPurchase.packageAmount; ingredient.unit = latestPurchase.unit; ingredient.purchaseDate = latestPurchase.date; ingredient.supplier = latestPurchase.supplier;
      }
      newIngredients[ingredientIndex] = ingredient;
      if (ingredientToView?.id === ingredientId) { setIngredientToView(ingredient); }
      return newIngredients;
    });
  };

  // --- PACKAGING HANDLERS ---
  const handleAddNewPackaging = () => { setPackagingToEdit(null); setPage('packaging-form'); };
  const handleEditPackaging = (pkg: Packaging) => { setPackagingToEdit(pkg); setPage('packaging-form'); };
  const handleSavePackaging = (pkg: Packaging) => {
    setPackaging(prev => {
      const exists = prev.some(p => p.id === pkg.id);
      if (exists) return prev.map(p => (p.id === pkg.id ? pkg : p));
      return [...prev, pkg];
    });
    setPage('packaging'); setPackagingToEdit(null);
  };
  const handleCancelPackagingForm = () => { setPackagingToEdit(null); setPage('packaging'); };
  const handleDeletePackaging = (packagingId: string) => { setPackaging(prev => prev.filter(p => p.id !== packagingId)); };


  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard 
          ingredients={ingredients} 
          recipes={recipes} 
          fillings={fillings}
          packaging={packaging} 
          settings={settings} 
          setPage={setPage} 
          onGoToEditRecipe={handleEditRecipe}
          onGoToEditIngredient={handleStartAddPurchase}
        />;
      case 'ingredients':
        return <IngredientManager 
          ingredients={ingredients} 
          onAddNew={handleAddNewIngredient} onEdit={handleEditIngredient} onDelete={handleDeleteIngredient}
          onViewDetails={handleViewIngredientDetails} onImport={setIngredients} highlightedId={highlightedIngredientId}
          onHighlightComplete={() => setHighlightedIngredientId(null)}
        />;
      case 'packaging':
        return <PackagingManager
          packaging={packaging}
          onAddNew={handleAddNewPackaging} onEdit={handleEditPackaging} onDelete={handleDeletePackaging}
          onImport={setPackaging}
        />;
      case 'recipes':
        return <Recipes 
            recipes={recipes} type="recipe" onAddNew={handleAddNewRecipe} onEdit={handleEditRecipe} 
            onDelete={handleDeleteRecipe} onViewDetails={handleViewRecipeDetails}
            ingredients={ingredientsWithFillings} packagingItems={packaging} settings={settings} onImport={setRecipes}
        />;
      case 'fillings':
        return <Recipes 
            recipes={fillings} type="filling" onAddNew={handleAddNewFilling} onEdit={handleEditFilling} 
            onDelete={handleDeleteFilling} onViewDetails={handleViewFillingDetails}
            ingredients={ingredients} packagingItems={packaging} settings={settings} onImport={setFillings}
        />;
      case 'settings':
        return <Settings settings={settings} onUpdateSettings={setSettings} />;
      case 'recipe-pricer':
        return <RecipePricer 
            ingredients={ingredientsWithFillings} packagingItems={packaging} settings={settings} type="recipe"
            onSave={handleSaveRecipe} onCancel={handleCancelRecipePricer} recipeToEdit={recipeToEdit}
        />;
       case 'recipe-details':
        return recipeToView ? <RecipeDetails 
            recipe={recipeToView} type="recipe" ingredients={ingredientsWithFillings} packagingItems={packaging} settings={settings}
            onEdit={handleEditRecipe} onDelete={handleDeleteRecipe} onClose={() => setPage('recipes')}
        /> : null;
      case 'filling-pricer':
        return <RecipePricer 
            ingredients={ingredients} packagingItems={packaging} settings={settings} type="filling"
            onSave={handleSaveFilling} onCancel={handleCancelFillingPricer} recipeToEdit={fillingToEdit}
        />;
       case 'filling-details':
        return fillingToView ? <RecipeDetails 
            recipe={fillingToView} type="filling" ingredients={ingredients} packagingItems={packaging} settings={settings}
            onEdit={handleEditFilling} onDelete={handleDeleteFilling} onClose={() => setPage('fillings')}
        /> : null;
       case 'ingredient-form':
        return <IngredientForm
          onSave={handleSaveIngredient} onCancel={handleCancelIngredientForm}
          ingredientToEdit={ingredientToEdit} mode={ingredientFormMode}
        />;
      case 'packaging-form':
        return <PackagingForm
          onSave={handleSavePackaging} onCancel={handleCancelPackagingForm}
          packagingToEdit={packagingToEdit}
        />;
      case 'ingredient-details':
        return ingredientToView ? <IngredientDetails 
          ingredient={ingredientToView} onEdit={handleStartAddPurchase} onDelete={handleDeleteIngredient}
          onDeletePurchase={handleDeletePurchase} onClose={() => setPage('ingredients')}
        /> : null;
      default:
        return <div>Página não encontrada</div>;
    }
  };

  const getBasePage = (currentPage: Page): Page => {
    if (['recipe-pricer', 'recipe-details'].includes(currentPage)) return 'recipes';
    if (['filling-pricer', 'filling-details'].includes(currentPage)) return 'fillings';
    if (['ingredient-form', 'ingredient-details'].includes(currentPage)) return 'ingredients';
    if (currentPage === 'packaging-form') return 'packaging';
    return currentPage;
  };
  const activePage = getBasePage(page);
  
  const NavItem: React.FC<{
    label: string;
    targetPage: Page;
    icon: React.ElementType;
  }> = ({ label, targetPage, icon: Icon }) => (
    <button 
      onClick={() => {
        setPage(targetPage);
        setRecipeToView(null); setRecipeToEdit(null);
        setFillingToView(null); setFillingToEdit(null);
        setIngredientToEdit(null); setIngredientToView(null);
        setPackagingToEdit(null);
      }}
      className={`flex flex-col items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors w-full text-left lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 ${activePage === targetPage ? 'bg-brand-primary text-white' : 'text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700'}`}
    >
      <Icon className="w-6 h-6"/>
      <span className={`mt-1 text-xs lg:mt-0 lg:text-base ${activePage === targetPage ? 'block' : 'hidden'} md:block`}>{label}</span>
    </button>
  );

  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen text-brand-text dark:text-gray-200 font-sans transition-colors">
      <div className="container mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <aside className="lg:col-span-2 mb-8 lg:mb-0">
            <div className="sticky top-8">
              <h1 className="font-display text-2xl font-bold text-brand-primary mb-6 hidden lg:block">Precify</h1>
              <nav className="flex lg:flex-col justify-around lg:justify-start lg:space-y-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                <NavItem label="Dashboard" targetPage="dashboard" icon={ChartBarIcon}/>
                <NavItem label="Ingredientes" targetPage="ingredients" icon={ShoppingBagIcon}/>
                <NavItem label="Embalagens" targetPage="packaging" icon={BoxIcon}/>
                <NavItem label="Receitas" targetPage="recipes" icon={BookOpenIcon}/>
                <NavItem label="Recheios" targetPage="fillings" icon={FireIcon}/>
                <NavItem label="Ajustes" targetPage="settings" icon={AdjustmentsHorizontalIcon}/>
                 <div className="hidden lg:block border-t border-rose-200 dark:border-gray-700 my-2"></div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex flex-col items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors w-full text-left text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2">
                    {isDarkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                    <span className="hidden md:block mt-1 text-xs lg:mt-0 lg:text-base">{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>
              </nav>
            </div>
          </aside>
          <main className="lg:col-span-10">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;