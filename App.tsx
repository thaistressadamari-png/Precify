
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Ingredient, Packaging, Recipe, AppSettings, Page, Unit, User, GlobalConfig, InvoiceReceipt } from './types';
import { IngredientManager } from './components/IngredientManager';
import { PackagingManager } from './components/PackagingManager';
import { PurchasesManager } from './components/PurchasesManager';
import { Settings } from './components/Settings';
import { Dashboard } from './components/Dashboard';
import { Recipes } from './components/Recipes';
import { RecipePricer } from './components/RecipePricer';
import { RecipeDetails } from './components/RecipeDetails';
import { IngredientForm } from './components/IngredientForm';
import { PackagingForm } from './components/PackagingForm';
import { IngredientDetails } from './components/IngredientDetails';
import { SupportSystem } from './components/SupportSystem';
import { defaultIngredients, defaultPackaging, defaultRecipes, defaultSettings } from './components/defaultData';
import { SunIcon } from './components/icons/SunIcon';
import { MoonIcon } from './components/icons/MoonIcon';
import { ChartBarIcon } from './components/icons/ChartBarIcon';
import { ReceiptIcon } from './components/icons/ReceiptIcon';
import { ShoppingBagIcon } from './components/icons/ShoppingBagIcon';
import { BoxIcon } from './components/icons/BoxIcon';
import { BookOpenIcon } from './components/icons/BookOpenIcon';
import { AdjustmentsHorizontalIcon } from './components/icons/AdjustmentsHorizontalIcon';
import { QuestionMarkCircleIcon } from './components/icons/QuestionMarkCircleIcon';
import { FireIcon } from './components/icons/FireIcon';
import { calculateCosts } from './components/costCalculator';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { ArrowRightOnRectangleIcon } from './components/icons/ArrowRightOnRectangleIcon';
import { RegistrationPage } from './components/RegistrationPage';
import { auth, db } from './components/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { SubscriptionPage } from './components/SubscriptionPage';
import { FeedbackModal } from './components/FeedbackModal';
import { AdminDashboard } from './components/AdminDashboard';
import { trackEvent } from './components/utils';
import { AdjustmentsVerticalIcon } from './components/icons/AdjustmentsVerticalIcon';

const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const newTheme = isDarkMode ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return [isDarkMode, setIsDarkMode] as const;
};

const App: React.FC = () => {
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const initialLoadComplete = useRef(false);
  
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    paymentLink: 'https://pay.kiwify.com.br/4ISfOEL',
    trialDays: 4
  });

  const userId = activeUser?.id || null;
  
  const [page, setPage] = useState<Page>('dashboard');
  const [ingredients, setIngredients] = useState<Ingredient[]>(defaultIngredients);
  const [packaging, setPackaging] = useState<Packaging[]>(defaultPackaging);
  const [recipes, setRecipes] = useState<Recipe[]>(defaultRecipes);
  const [fillings, setFillings] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [receipts, setReceipts] = useState<InvoiceReceipt[]>([]);
  
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');
  
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

  const [showSubscriptionFlow, setShowSubscriptionFlow] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Fetch Global Config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "app_config", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalConfig(docSnap.data() as GlobalConfig);
      }
    });
    return () => unsub();
  }, []);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              if (user.email && userData.email !== user.email) {
                  await updateDoc(userDocRef, { email: user.email });
                  userData.email = user.email;
              }
              trackEvent('login', { method: user.providerData[0]?.providerId || 'email' });
              const isAdmin = userData.role === 'admin' || user.email?.toLowerCase() === 'jacques.cesar123@gmail.com';
              const fullUser: User = {
                id: user.uid,
                email: user.email!,
                name: userData.name,
                phone: userData.phone,
                trialEndsAt: userData.trialEndsAt,
                hasGivenFeedback: userData.hasGivenFeedback,
                isSubscribed: userData.isSubscribed,
                paymentConfirmationClicked: userData.paymentConfirmationClicked,
                role: userData.role
              };
              setIsCurrentUserAdmin(isAdmin);
              setActiveUser(fullUser);
              const trialExpired = fullUser.trialEndsAt && fullUser.trialEndsAt.toDate() < new Date();
              const isSubscribed = fullUser.isSubscribed;
              const hasGivenFeedback = fullUser.hasGivenFeedback;
              if (trialExpired && !isSubscribed && !isAdmin) {
                setShowSubscriptionFlow(true);
                if (!hasGivenFeedback) setShowFeedbackModal(true);
              } else {
                setShowSubscriptionFlow(false);
                setShowFeedbackModal(false);
              }
            } else {
               trackEvent('sign_up', { method: user.providerData[0]?.providerId || 'email' });
                const trialEndDate = new Date(Date.now() + globalConfig.trialDays * 24 * 60 * 60 * 1000);
                const trialTimestamp = Timestamp.fromDate(trialEndDate);
                const newUserDoc = {
                  name: user.displayName || 'Usuário Google',
                  email: user.email,
                  trialEndsAt: trialTimestamp,
                  hasGivenFeedback: false,
                  isSubscribed: false,
                  role: 'user',
                };
                await setDoc(userDocRef, newUserDoc);
                const fullUser: User = { id: user.uid, email: user.email!, name: newUserDoc.name, trialEndsAt: trialTimestamp, hasGivenFeedback: false, isSubscribed: false, role: 'user' };
                setActiveUser(fullUser);
            }
        } catch (error) {
            console.error(error);
            await signOut(auth);
            setActiveUser(null);
        }
      } else {
        setActiveUser(null);
        setPage('dashboard');
        setView('landing');
        setShowSubscriptionFlow(false);
        setShowFeedbackModal(false);
        setIsAdminMode(false);
        setIsCurrentUserAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [globalConfig.trialDays]);

  useEffect(() => {
    if (!userId) {
        setIngredients(defaultIngredients);
        setPackaging(defaultPackaging);
        setRecipes(defaultRecipes);
        setFillings([]);
        setSettings(defaultSettings);
        setReceipts([]);
        initialLoadComplete.current = false;
        setDataLoading(false);
        return;
    }
    setDataLoading(true);
    initialLoadComplete.current = false;
    const fetchData = async () => {
        const userDocRef = doc(db, "appData", userId);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setIngredients(data.ingredients || defaultIngredients);
                setPackaging(data.packaging || defaultPackaging);
                setRecipes(data.recipes || defaultRecipes);
                setFillings(data.fillings || []);
                setSettings(data.settings || defaultSettings);
                setReceipts(data.receipts || []);
            }
            initialLoadComplete.current = true;
        } catch (error) {
            console.error(error);
        } finally {
            setDataLoading(false);
        }
    };
    fetchData();
  }, [userId]);
  
  const saveData = useCallback(async (dataToSave: any) => {
    if (!userId) return;
    const userDocRef = doc(db, "appData", userId);
    try { await setDoc(userDocRef, dataToSave); } catch (error) { console.error(error); }
  }, [userId]);

  useEffect(() => {
    const handler = setTimeout(() => {
        if (userId && initialLoadComplete.current) {
            saveData({ ingredients, packaging, recipes, fillings, settings, receipts });
        }
    }, 1500);
    return () => clearTimeout(handler);
  }, [ingredients, packaging, recipes, fillings, settings, receipts, userId, saveData]);
  
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

  const handleSaveRecipe = (recipe: Recipe) => {
    setRecipes(prev => {
      const exists = prev.some(r => r.id === recipe.id);
      if (exists) return prev.map(r => r.id === recipe.id ? recipe : r);
      return [...prev, recipe];
    });
    setPage('recipes');
    setRecipeToEdit(null);
  };
  const handleEditRecipe = (recipe: Recipe) => { setRecipeToEdit(recipe); setPage('recipe-pricer'); };
  const handleDeleteRecipe = (recipeId: string) => { setRecipes(prev => prev.filter(r => r.id !== recipeId)); setPage('recipes'); setRecipeToView(null); };
  const handleViewRecipeDetails = (recipe: Recipe) => { setRecipeToView(recipe); setPage('recipe-details'); }
  const handleAddNewRecipe = () => { setRecipeToEdit(null); setPage('recipe-pricer'); };

  const handleSaveFilling = (filling: Recipe) => {
    setFillings(prev => {
      const exists = prev.some(r => r.id === filling.id);
      if (exists) return prev.map(r => r.id === filling.id ? filling : r);
      return [...prev, filling];
    });
    setPage('fillings');
    setFillingToEdit(null);
  };
  const handleEditFilling = (filling: Recipe) => { setFillingToEdit(filling); setPage('filling-pricer'); };
  const handleDeleteFilling = (fillingId: string) => { setFillings(prev => prev.filter(r => r.id !== fillingId)); setPage('fillings'); setFillingToView(null); };
  const handleViewFillingDetails = (filling: Recipe) => { setFillingToView(filling); setPage('filling-details'); };
  const handleAddNewFilling = () => { setFillingToEdit(null); setPage('filling-pricer'); };

  const handleAddNewIngredient = () => { setIngredientToEdit(null); setIngredientFormMode('create'); setPage('ingredient-form'); };
  const handleEditIngredient = (ingredient: Ingredient) => { setIngredientToEdit(ingredient); setIngredientFormMode('edit'); setPage('ingredient-form'); };
  const handleStartAddPurchase = (ingredient: Ingredient) => { setIngredientToEdit(ingredient); setIngredientFormMode('addPurchase'); setPage('ingredient-form'); };
  const handleViewIngredientDetails = (ingredient: Ingredient) => { setIngredientToView(ingredient); setPage('ingredient-details'); };
  
  const handleDeleteIngredient = (ingredientId: string) => {
    setIngredients(prev => prev.filter(i => i.id !== ingredientId));
    if (ingredientToView?.id === ingredientId) {
      setIngredientToView(null);
      setPage('ingredients');
    }
  };

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
    } else setPage('ingredients');
  };

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
  const handleDeletePackaging = (packagingId: string) => { setPackaging(prev => prev.filter(p => p.id !== packagingId)); };

  const handleSaveReceipt = (receipt: InvoiceReceipt) => {
    setReceipts(prev => {
      const exists = prev.some(r => r.id === receipt.id);
      if (exists) return prev.map(r => r.id === receipt.id ? receipt : r);
      return [receipt, ...prev];
    });
  };

  const handleDeleteReceipt = (receiptId: string) => {
    setReceipts(prev => prev.filter(r => r.id !== receiptId));
  };

  const handleBatchUpdateCatalog = (
    newIngredients: Ingredient[],
    updatedIngredients: Ingredient[],
    newPackaging: Packaging[],
    updatedPackaging: Packaging[]
  ) => {
    if (newIngredients.length > 0 || updatedIngredients.length > 0) {
      setIngredients(prev => {
        let next = [...prev];
        updatedIngredients.forEach(updated => {
          next = next.map(i => i.id === updated.id ? updated : i);
        });
        newIngredients.forEach(newItem => {
          if (!next.some(i => i.id === newItem.id)) {
            next.push(newItem);
          }
        });
        return next;
      });
    }

    if (newPackaging.length > 0 || updatedPackaging.length > 0) {
      setPackaging(prev => {
        let next = [...prev];
        updatedPackaging.forEach(updated => {
          next = next.map(p => p.id === updated.id ? updated : p);
        });
        newPackaging.forEach(newItem => {
          if (!next.some(p => p.id === newItem.id)) {
            next.push(newItem);
          }
        });
        return next;
      });
    }
  };

  const handleLogout = () => signOut(auth).catch(console.error);
  
  const handleUserUpdate = async (updatedData: any) => {
    if (!activeUser) return;
    try {
        const userDocRef = doc(db, "users", activeUser.id);
        await updateDoc(userDocRef, updatedData);
        setActiveUser(prevUser => prevUser ? { ...prevUser, ...updatedData } : null);
    } catch (error) { throw error; }
  };

  const handleFeedbackSubmit = async (feedback: string) => {
    if (!activeUser) return;
    setIsSubmittingFeedback(true);
    try {
        await addDoc(collection(db, 'feedback'), { userId: activeUser.id, userName: activeUser.name, feedback, submittedAt: new Date() });
        await updateDoc(doc(db, "users", activeUser.id), { hasGivenFeedback: true });
        setActiveUser(prev => prev ? {...prev, hasGivenFeedback: true} : null);
        setShowFeedbackModal(false);
    } catch (error) { console.error(error); } finally { setIsSubmittingFeedback(false); }
  };
  
  const handleUserPaymentConfirmation = async () => {
    if (!activeUser || activeUser.paymentConfirmationClicked) return;
    const currentTrialEnd = activeUser.trialEndsAt ? activeUser.trialEndsAt.toDate() : new Date();
    const newTrialEnd = new Date(currentTrialEnd.getTime() + 1 * 24 * 60 * 60 * 1000);
    const newTrialTimestamp = Timestamp.fromDate(newTrialEnd);
    setActiveUser(prev => prev ? {...prev, paymentConfirmationClicked: true, trialEndsAt: newTrialTimestamp} : null);
    setShowSubscriptionFlow(false);
    try {
        await updateDoc(doc(db, "users", activeUser.id), { paymentConfirmationClicked: true, trialEndsAt: newTrialTimestamp });
        await addDoc(collection(db, 'action_history'), { timestamp: Timestamp.now(), actionType: 'USER_CONFIRMED_PAYMENT', description: `Usuário '${activeUser.name}' confirmou o pagamento.`, userId: activeUser.id, userName: activeUser.name });
    } catch (error) { console.error(error); }
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard ingredients={ingredients} recipes={recipes} fillings={fillings} packaging={packaging} settings={settings} setPage={setPage} onGoToEditRecipe={handleEditRecipe} onGoToEditIngredient={handleStartAddPurchase} />;
      case 'purchases':
        return (
          <PurchasesManager
            receipts={receipts}
            ingredients={ingredients}
            packaging={packaging}
            onSaveReceipt={handleSaveReceipt}
            onDeleteReceipt={handleDeleteReceipt}
            onBatchUpdateCatalog={handleBatchUpdateCatalog}
          />
        );
      case 'ingredients':
        return <IngredientManager ingredients={ingredients} onAddNew={handleAddNewIngredient} onEdit={handleEditIngredient} onDelete={handleDeleteIngredient} onViewDetails={handleViewIngredientDetails} onImport={setIngredients} highlightedId={highlightedIngredientId} onHighlightComplete={() => setHighlightedIngredientId(null)} onDuplicate={(i) => handleSaveIngredient({...i, id: Date.now().toString(), name: i.name + ' (Cópia)'})} />;
      case 'packaging':
        return <PackagingManager packaging={packaging} onAddNew={handleAddNewPackaging} onEdit={handleEditPackaging} onDelete={handleDeletePackaging} onImport={setPackaging} onDuplicate={(p) => handleSavePackaging({...p, id: Date.now().toString(), name: p.name + ' (Cópia)'})} />;
      case 'recipes':
        return <Recipes recipes={recipes} type="recipe" onAddNew={handleAddNewRecipe} onEdit={handleEditRecipe} onDelete={handleDeleteRecipe} onViewDetails={handleViewRecipeDetails} ingredients={ingredientsWithFillings} packagingItems={packaging} settings={settings} onImport={setRecipes} onDuplicate={(r) => handleSaveRecipe({...r, id: Date.now().toString(), name: r.name + ' (Cópia)'})} />;
      case 'fillings':
        return <Recipes recipes={fillings} type="filling" onAddNew={handleAddNewFilling} onEdit={handleEditFilling} onDelete={handleDeleteFilling} onViewDetails={handleViewFillingDetails} ingredients={ingredients} packagingItems={packaging} settings={settings} onImport={setFillings} onDuplicate={(f) => handleSaveFilling({...f, id: Date.now().toString(), name: f.name + ' (Cópia)'})} />;
      case 'settings':
        return <Settings settings={settings} onUpdateSettings={setSettings} user={activeUser!} onUserUpdate={handleUserUpdate} />;
      case 'support':
        return <SupportSystem user={activeUser!} />;
      case 'recipe-pricer':
        return <RecipePricer ingredients={ingredientsWithFillings} packagingItems={packaging} settings={settings} type="recipe" onSave={handleSaveRecipe} onCancel={() => setPage('recipes')} recipeToEdit={recipeToEdit} />;
      case 'recipe-details':
        return recipeToView ? <RecipeDetails recipe={recipeToView} type="recipe" ingredients={ingredientsWithFillings} packagingItems={packaging} settings={settings} onEdit={handleEditRecipe} onDelete={handleDeleteRecipe} onClose={() => setPage('recipes')} /> : null;
      case 'filling-pricer':
        return <RecipePricer ingredients={ingredients} packagingItems={packaging} settings={settings} type="filling" onSave={handleSaveFilling} onCancel={() => setPage('fillings')} recipeToEdit={fillingToEdit} />;
      case 'filling-details':
        return fillingToView ? <RecipeDetails recipe={fillingToView} type="filling" ingredients={ingredients} packagingItems={packaging} settings={settings} onEdit={handleEditFilling} onDelete={handleDeleteFilling} onClose={() => setPage('fillings')} /> : null;
      case 'ingredient-form':
        return <IngredientForm onSave={handleSaveIngredient} onCancel={() => setPage('ingredients')} ingredientToEdit={ingredientToEdit} mode={ingredientFormMode} />;
      case 'packaging-form':
        return <PackagingForm onSave={handleSavePackaging} onCancel={() => setPage('packaging')} packagingToEdit={packagingToEdit} />;
      case 'ingredient-details':
        return ingredientToView ? <IngredientDetails ingredient={ingredientToView} onEdit={handleStartAddPurchase} onDelete={handleDeleteIngredient} onDeletePurchase={(id, pid) => setIngredients(prev => prev.map(i => i.id === id ? {...i, history: i.history.filter(h => h.id !== pid)} : i))} onClose={() => setPage('ingredients')} /> : null;
      default: return <div>Página não encontrada</div>;
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
  
  const NavItem: React.FC<{ label: string; targetPage: Page; icon: React.ElementType }> = ({ label, targetPage, icon: Icon }) => (
    <button onClick={() => setPage(targetPage)} className={`flex flex-col items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors w-full text-left lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 ${activePage === targetPage ? 'bg-brand-primary text-white' : 'text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700'}`}>
      <Icon className="w-6 h-6"/><span className={`mt-1 text-xs lg:mt-0 lg:text-base ${activePage === targetPage ? 'block' : 'hidden'} md:block`}>{label}</span>
    </button>
  );

  if (authLoading) return <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center"><h1 className="font-display text-4xl font-bold text-brand-primary animate-pulse">Precify</h1></div>;

  if (!activeUser) {
    if (view === 'landing') return <LandingPage onNavigateToRegister={() => setView('register')} onNavigateToLogin={() => setView('login')} />;
    if (view === 'register') return <RegistrationPage onRegisterSuccess={setActiveUser} onNavigateToLogin={() => setView('login')} globalConfig={globalConfig} />;
    return <LoginPage onNavigateToLanding={() => setView('landing')} onNavigateToRegister={() => setView('register')} globalConfig={globalConfig} />;
  }

  if (isAdminMode) return <AdminDashboard onLogout={handleLogout} currentUser={activeUser} onGoToApp={() => setIsAdminMode(false)} globalConfig={globalConfig} />;

  if (showSubscriptionFlow) return <><SubscriptionPage user={activeUser} onPaymentConfirmationClick={handleUserPaymentConfirmation} onLogout={handleLogout} globalConfig={globalConfig} />{showFeedbackModal && <FeedbackModal onSubmit={handleFeedbackSubmit} loading={isSubmittingFeedback} />}</>;

  if (dataLoading) return <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex flex-col items-center justify-center"><h1 className="font-display text-4xl font-bold text-brand-primary animate-pulse">Precify</h1><p className="mt-4 text-brand-light-text">Carregando seus dados...</p></div>;

  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen text-brand-text dark:text-gray-200 font-sans transition-colors">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <h1 className="font-display text-3xl font-bold text-brand-primary">Precify</h1>
             <div className="flex items-center gap-4">
              <span className="text-brand-light-text dark:text-gray-300 hidden sm:block">Olá, <span className="font-semibold text-brand-text dark:text-rose-100">{activeUser.name.split(' ')[0]}</span></span>
              {isCurrentUserAdmin && <button onClick={() => setIsAdminMode(true)} className="flex items-center gap-2 p-2 rounded-lg text-sm text-brand-light-text hover:bg-rose-100"><AdjustmentsVerticalIcon className="w-6 h-6" /><span className="hidden md:block">Painel Admin</span></button>}
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center gap-2 p-2 rounded-lg text-sm text-brand-light-text hover:bg-rose-100">{isDarkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}</button>
            </div>
        </header>
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <aside className="lg:col-span-2 mb-8 lg:mb-0">
            <nav className="flex lg:flex-col justify-around lg:justify-start lg:space-y-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                <NavItem label="Dashboard" targetPage="dashboard" icon={ChartBarIcon}/>
                <NavItem label="Compras" targetPage="purchases" icon={ReceiptIcon}/>
                <NavItem label="Ingredientes" targetPage="ingredients" icon={ShoppingBagIcon}/>
                <NavItem label="Embalagens" targetPage="packaging" icon={BoxIcon}/>
                <NavItem label="Receitas" targetPage="recipes" icon={BookOpenIcon}/>
                <NavItem label="Recheios" targetPage="fillings" icon={FireIcon}/>
                <NavItem label="Ajustes" targetPage="settings" icon={AdjustmentsHorizontalIcon}/>
                <NavItem label="Suporte" targetPage="support" icon={QuestionMarkCircleIcon}/>
                 <div className="border-t border-rose-100 my-2 hidden lg:block"></div>
                <button onClick={handleLogout} className="flex flex-col items-center justify-center p-2 rounded-lg text-sm font-medium w-full text-left lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 text-brand-light-text hover:bg-rose-100"><ArrowRightOnRectangleIcon className="w-6 h-6"/><span className="mt-1 text-xs lg:mt-0 hidden md:block">Sair</span></button>
            </nav>
          </aside>
          <main className="lg:col-span-10">{renderPage()}</main>
        </div>
      </div>
    </div>
  );
};

export default App;
