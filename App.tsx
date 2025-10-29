import React, { useState, useEffect } from 'react';
import type { Ingredient, Packaging, Recipe, AppSettings, Page } from './types';
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
  const [settings, setSettings] = usePersistentState<AppSettings>('settings', defaultSettings);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);
  const [recipeToView, setRecipeToView] = useState<Recipe | null>(null);
  const [ingredientToEdit, setIngredientToEdit] = useState<Ingredient | null>(null);
  const [ingredientFormMode, setIngredientFormMode] = useState<'create' | 'edit' | 'addPurchase'>('create');
  const [ingredientToView, setIngredientToView] = useState<Ingredient | null>(null);
  const [highlightedIngredientId, setHighlightedIngredientId] = useState<string | null>(null);
  const [packagingToEdit, setPackagingToEdit] = useState<Packaging | null>(null);
  const [isDarkMode, setIsDarkMode] = useDarkMode();

  useEffect(() => {
    // One-time data migration for ingredients to ensure each purchase has a unit.
    const needsMigration = ingredients.some(ing => !ing.history || ing.history.some(p => p.unit === undefined));
    if (needsMigration) {
        const migratedIngredients = ingredients.map(ing => {
            let history = ing.history;

            // Step 1: If history doesn't exist, create it from the root ingredient properties.
            if (!history) {
                history = [{
                    id: ing.id + '-' + new Date().getTime(),
                    date: ing.purchaseDate || new Date().toISOString().split('T')[0],
                    supplier: ing.supplier,
                    packagePrice: ing.packagePrice,
                    packageAmount: ing.packageAmount,
                    unit: ing.unit, // Ensure unit is included
                }];
            }

            // Step 2: Ensure every purchase in history has a unit.
            const historyWithUnits = history.map(p => {
                if (p.unit !== undefined) return p;
                // If a purchase is missing a unit, fall back to the ingredient's main unit.
                return { ...p, unit: ing.unit };
            });

            // Step 3: Sort history to ensure the latest purchase is first.
            const sortedHistory = historyWithUnits.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Step 4: Ensure the top-level ingredient properties reflect the latest purchase.
            const latestPurchase = sortedHistory[0];
            
            if (!latestPurchase) {
              return {
                ...ing,
                history: sortedHistory,
              };
            }

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
}, []);


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

  const handleEditRecipe = (recipe: Recipe) => {
    setRecipeToEdit(recipe);
    setPage('recipe-pricer');
  };

  const handleDeleteRecipe = (recipeId: string) => {
    setRecipes(prev => prev.filter(r => r.id !== recipeId));
    setPage('recipes');
    setRecipeToView(null);
  };
  
  const handleViewDetails = (recipe: Recipe) => {
      setRecipeToView(recipe);
      setPage('recipe-details');
  }

  const handleAddNewRecipe = () => {
    setRecipeToEdit(null);
    setPage('recipe-pricer');
  };
  
  const handleCancelRecipePricer = () => {
    setRecipeToEdit(null);
    setPage('recipes');
  }

  const handleAddNewIngredient = () => {
    setIngredientToEdit(null);
    setIngredientFormMode('create');
    setPage('ingredient-form');
  };

  const handleEditIngredient = (ingredient: Ingredient) => {
    setIngredientToEdit(ingredient);
    setIngredientFormMode('edit');
    setPage('ingredient-form');
  };

  const handleStartAddPurchase = (ingredient: Ingredient) => {
    setIngredientToEdit(ingredient);
    setIngredientFormMode('addPurchase');
    setPage('ingredient-form');
  };
  
  const handleViewIngredientDetails = (ingredient: Ingredient) => {
    setIngredientToView(ingredient);
    setPage('ingredient-details');
  };

  const handleSaveIngredient = (ingredient: Ingredient) => {
    const wasEditing = !!ingredientToEdit;

    setIngredients(prev => {
      const exists = prev.some(i => i.id === ingredient.id);
      if (exists) {
        return prev.map(i => (i.id === ingredient.id ? ingredient : i));
      }
      return [...prev, ingredient];
    });
    setIngredientToEdit(null);

    if (wasEditing) {
      if (ingredientFormMode === 'addPurchase') {
        setIngredientToView(ingredient);
        setPage('ingredient-details');
      } else { // edit mode
        setHighlightedIngredientId(ingredient.id);
        setPage('ingredients');
      }
    } else { // create mode
      setPage('ingredients');
    }
  };
  
  const handleCancelIngredientForm = () => {
    const previousPage = ingredientToEdit ? 'ingredient-details' : 'ingredients';
    const ingredientToKeepViewing = ingredientToEdit;
    setIngredientToEdit(null);
    
    if (previousPage === 'ingredient-details' && ingredientToKeepViewing) {
      setIngredientToView(ingredientToKeepViewing);
      setPage('ingredient-details');
    } else {
      setPage('ingredients');
    }
  };
  
  const handleDeleteIngredient = (ingredientId: string) => {
    setIngredients(prev => prev.filter(i => i.id !== ingredientId));
    setPage('ingredients');
    setIngredientToView(null);
  };

  const handleDeletePurchase = (ingredientId: string, purchaseId: string) => {
    setIngredients(prevIngredients => {
      const ingredientIndex = prevIngredients.findIndex(i => i.id === ingredientId);
      if (ingredientIndex === -1) return prevIngredients;

      const newIngredients = [...prevIngredients];
      // Deep copy ingredient to avoid mutation issues
      const ingredient = JSON.parse(JSON.stringify(newIngredients[ingredientIndex]));

      const initialHistoryLength = ingredient.history.length;
      ingredient.history = ingredient.history.filter((p: any) => p.id !== purchaseId);

      if (ingredient.history.length === initialHistoryLength) {
          return prevIngredients; // No change
      }

      if (ingredient.history.length === 0) {
          ingredient.packagePrice = 0;
          ingredient.packageAmount = 0;
          ingredient.purchaseDate = undefined;
          ingredient.supplier = undefined;
      } else {
          ingredient.history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestPurchase = ingredient.history[0];
          ingredient.packagePrice = latestPurchase.packagePrice;
          ingredient.packageAmount = latestPurchase.packageAmount;
          ingredient.unit = latestPurchase.unit;
          ingredient.purchaseDate = latestPurchase.date;
          ingredient.supplier = latestPurchase.supplier;
      }
      
      newIngredients[ingredientIndex] = ingredient;
      
      if (ingredientToView?.id === ingredientId) {
          setIngredientToView(ingredient);
      }

      return newIngredients;
    });
  };

  const handleAddNewPackaging = () => {
    setPackagingToEdit(null);
    setPage('packaging-form');
  };

  const handleEditPackaging = (pkg: Packaging) => {
    setPackagingToEdit(pkg);
    setPage('packaging-form');
  };

  const handleSavePackaging = (pkg: Packaging) => {
    setPackaging(prev => {
      const exists = prev.some(p => p.id === pkg.id);
      if (exists) {
        return prev.map(p => (p.id === pkg.id ? pkg : p));
      }
      return [...prev, pkg];
    });
    setPage('packaging');
    setPackagingToEdit(null);
  };

  const handleCancelPackagingForm = () => {
    setPackagingToEdit(null);
    setPage('packaging');
  };

  const handleDeletePackaging = (packagingId: string) => {
    setPackaging(prev => prev.filter(p => p.id !== packagingId));
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard 
          ingredients={ingredients} 
          recipes={recipes} 
          packaging={packaging} 
          settings={settings} 
          setPage={setPage} 
          onGoToEdit={handleEditRecipe}
          onGoToEditIngredient={handleStartAddPurchase}
        />;
      case 'ingredients':
        return <IngredientManager 
          ingredients={ingredients} 
          onAddNew={handleAddNewIngredient}
          onEdit={handleEditIngredient}
          onDelete={handleDeleteIngredient}
          onViewDetails={handleViewIngredientDetails}
          onImport={setIngredients}
          highlightedId={highlightedIngredientId}
          onHighlightComplete={() => setHighlightedIngredientId(null)}
        />;
      case 'packaging':
        return <PackagingManager
          packaging={packaging}
          onAddNew={handleAddNewPackaging}
          onEdit={handleEditPackaging}
          onDelete={handleDeletePackaging}
          onImport={setPackaging}
        />;
      case 'recipes':
        return <Recipes 
            recipes={recipes} 
            onAddNew={handleAddNewRecipe}
            onEdit={handleEditRecipe} 
            onDelete={handleDeleteRecipe} 
            onViewDetails={handleViewDetails}
            ingredients={ingredients}
            packagingItems={packaging}
            settings={settings}
            onImport={setRecipes}
        />;
      case 'settings':
        return <Settings settings={settings} onUpdateSettings={setSettings} />;
      case 'recipe-pricer':
        return <RecipePricer 
            ingredients={ingredients} 
            packagingItems={packaging} 
            settings={settings}
            onSave={handleSaveRecipe}
            onCancel={handleCancelRecipePricer}
            recipeToEdit={recipeToEdit}
        />;
       case 'recipe-details':
        return recipeToView ? <RecipeDetails 
            recipe={recipeToView}
            ingredients={ingredients}
            packagingItems={packaging}
            settings={settings}
            onEdit={handleEditRecipe}
            onDelete={handleDeleteRecipe}
            onClose={() => setPage('recipes')}
        /> : null;
       case 'ingredient-form':
        return <IngredientForm
          onSave={handleSaveIngredient}
          onCancel={handleCancelIngredientForm}
          ingredientToEdit={ingredientToEdit}
          mode={ingredientFormMode}
        />;
      case 'packaging-form':
        return <PackagingForm
          onSave={handleSavePackaging}
          onCancel={handleCancelPackagingForm}
          packagingToEdit={packagingToEdit}
        />;
      case 'ingredient-details':
        return ingredientToView ? <IngredientDetails 
          ingredient={ingredientToView}
          onEdit={handleStartAddPurchase}
          onDelete={handleDeleteIngredient}
          onDeletePurchase={handleDeletePurchase}
          onClose={() => setPage('ingredients')}
        /> : null;
      default:
        return <div>Página não encontrada</div>;
    }
  };

  const getBasePage = (currentPage: Page): Page => {
    if (currentPage === 'recipe-pricer' || currentPage === 'recipe-details') return 'recipes';
    if (currentPage === 'ingredient-form' || currentPage === 'ingredient-details') return 'ingredients';
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
        setRecipeToView(null);
        setRecipeToEdit(null);
        setIngredientToEdit(null);
        setIngredientToView(null);
        setPackagingToEdit(null);
      }}
      className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 rounded-lg text-sm md:text-base font-medium transition-colors w-full text-left ${activePage === targetPage ? 'bg-brand-primary text-white' : 'text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700'}`}
    >
      <Icon className="w-6 h-6"/>
      <span className={`${activePage === targetPage ? 'inline text-xs' : 'hidden'} md:inline md:text-base`}>{label}</span>
    </button>
  );

  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen text-brand-text dark:text-gray-200 font-sans transition-colors">
      <div className="container mx-auto px-4 py-8">
        <div className="md:grid md:grid-cols-12 md:gap-8">
          <aside className="md:col-span-2 mb-8 md:mb-0">
            <div className="sticky top-8">
              <h1 className="font-display text-2xl font-bold text-brand-primary mb-6 hidden md:block">Precify</h1>
              <nav className="flex md:flex-col justify-around md:justify-start md:space-y-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                <NavItem label="Dashboard" targetPage="dashboard" icon={ChartBarIcon}/>
                <NavItem label="Ingredientes" targetPage="ingredients" icon={ShoppingBagIcon}/>
                <NavItem label="Embalagens" targetPage="packaging" icon={BoxIcon}/>
                <NavItem label="Receitas" targetPage="recipes" icon={BookOpenIcon}/>
                <NavItem label="Ajustes" targetPage="settings" icon={AdjustmentsHorizontalIcon}/>
                 <div className="hidden md:block border-t border-rose-200 dark:border-gray-700 my-2"></div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 rounded-lg text-sm md:text-base font-medium transition-colors w-full text-left text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700">
                    {isDarkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                    <span className="hidden md:inline">{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>
              </nav>
            </div>
          </aside>
          <main className="md:col-span-10">
            {renderPage()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;