import React, { useState } from 'react';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, setAuthPersistence, googleProvider, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleIcon } from './icons/GoogleIcon';

interface LoginPageProps {
  onNavigateToLanding: () => void;
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToLanding, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        await setAuthPersistence(rememberMe);
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged in App.tsx will handle the rest
    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            setError('E-mail ou senha incorretos. Tente novamente.');
        } else {
            setError('Ocorreu um erro ao fazer login. Tente novamente.');
            console.error(error);
        }
        setPassword('');
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await setAuthPersistence(true); // Always remember Google sign-in
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore, if not, create a document
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          name: user.displayName,
          email: user.email,
        });
      }
      // onAuthStateChanged will handle navigation
    } catch (error: any) {
      setError('Falha ao fazer login com o Google. Tente novamente.');
      console.error('Google Sign-in error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
            <h1 className="font-display text-6xl font-bold text-brand-primary">Precify</h1>
            <p className="text-brand-light-text dark:text-gray-400 mt-2">Sua confeitaria sob controle.</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 relative">
          <button onClick={onNavigateToLanding} className="absolute top-4 left-4 p-2 text-brand-light-text dark:text-gray-400 hover:text-brand-primary dark:hover:text-rose-300 transition-colors rounded-full hover:bg-rose-100 dark:hover:bg-gray-700">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-brand-text dark:text-rose-100 mb-2 text-center">Bem-vindo(a)!</h2>
          <p className="text-center text-brand-light-text dark:text-gray-400 mb-6">Faça login para continuar.</p>
          
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-500 rounded-lg shadow-sm text-sm font-bold text-brand-text dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              <GoogleIcon />
              {googleLoading ? 'Aguarde...' : 'Entrar com Google'}
            </button>

            <div className="flex items-center">
              <div className="flex-grow border-t border-rose-200 dark:border-gray-600"></div>
              <span className="flex-shrink mx-4 text-sm text-brand-light-text dark:text-gray-400">OU</span>
              <div className="flex-grow border-t border-rose-200 dark:border-gray-600"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-brand-light-text dark:text-gray-400 sr-only">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-3 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-brand-light-text dark:text-gray-400 sr-only">Senha</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-3 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                  placeholder="********"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-brand-primary focus:ring-brand-secondary border-gray-300 dark:border-gray-500 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-brand-light-text dark:text-gray-400">
                  Salvar login
                </label>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}

              <div>
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-brand-primary hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-transform transform hover:scale-105 disabled:bg-rose-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Entrando...' : 'Entrar com E-mail'}
                </button>
              </div>
            </form>
          </div>

           <div className="text-center mt-6">
              <p className="text-sm text-brand-light-text dark:text-gray-400">
                Não tem uma conta?{' '}
                <button onClick={onNavigateToRegister} className="font-semibold text-brand-primary hover:text-rose-700 dark:text-brand-secondary dark:hover:text-pink-400 focus:outline-none focus:underline">
                  Cadastre-se
                </button>
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};
