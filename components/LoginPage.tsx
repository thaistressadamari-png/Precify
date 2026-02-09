
import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { signInWithPopup, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider, db } from './firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { GoogleIcon } from './icons/GoogleIcon';
import { trackEvent } from './utils';
import type { GlobalConfig } from '../types';

interface LoginPageProps {
  onNavigateToLanding: () => void;
  onNavigateToRegister: () => void;
  globalConfig: GlobalConfig;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToLanding, onNavigateToRegister, globalConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    trackEvent('view_login_page');
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    trackEvent('submit_login_form', { method: 'email' });

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
        setError('E-mail ou senha inválidos. Tente novamente.');
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    trackEvent('submit_login_form', { method: 'google' });
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const trialEndDate = new Date(Date.now() + (globalConfig.trialDays || 4) * 24 * 60 * 60 * 1000);
        const trialTimestamp = Timestamp.fromDate(trialEndDate);
        await setDoc(userDocRef, {
          name: user.displayName || 'Usuário Google',
          email: user.email,
          trialEndsAt: trialTimestamp,
          hasGivenFeedback: false,
          isSubscribed: false,
        });
      }
    } catch (error: any) {
      setError('Falha ao fazer login com o Google. Tente novamente.');
      console.error('Google Sign-in error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Por favor, digite seu e-mail para redefinir a senha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Se o seu e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e spam.');
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError('Ocorreu um erro ao tentar redefinir a senha. Verifique o e-mail digitado.');
    } finally {
      setLoading(false);
    }
  };


  const inputClasses = "block w-full px-3 py-3 bg-white text-brand-text dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary";
  const labelClasses = "block text-sm font-medium text-brand-light-text dark:text-gray-400 mb-1";


  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-sm mx-auto">
        <div className="text-center mb-8">
            <h1 className="font-display text-6xl font-bold text-brand-primary">Precify</h1>
            <p className="text-brand-light-text dark:text-gray-400 mt-2">Sua confeitaria sob controle.</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 relative">
          <button onClick={onNavigateToLanding} className="absolute top-4 left-4 p-2 text-brand-light-text dark:text-gray-400 hover:text-brand-primary dark:hover:text-rose-300 transition-colors rounded-full hover:bg-rose-100 dark:hover:bg-gray-700">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-brand-text dark:text-rose-100 mb-2 text-center">Acessar Conta</h2>
          <p className="text-center text-brand-light-text dark:text-gray-400 mb-6">Entre com seus dados abaixo.</p>
          
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-500 rounded-lg shadow-sm text-sm font-bold text-brand-text dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              <GoogleIcon />
              {googleLoading ? 'Aguarde...' : 'Continuar com Google'}
            </button>

            <div className="flex items-center">
              <div className="flex-grow border-t border-rose-200 dark:border-gray-600"></div>
              <span className="flex-shrink mx-4 text-sm text-brand-light-text dark:text-gray-400">OU</span>
              <div className="flex-grow border-t border-rose-200 dark:border-gray-600"></div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className={labelClasses}>E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClasses}
                  placeholder="seu@email.com"
                />
              </div>

               <div>
                <div className="flex justify-between items-center">
                    <label htmlFor="password" className={labelClasses}>Senha</label>
                    <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={loading || googleLoading}
                        className="text-xs font-semibold text-brand-primary hover:text-rose-700 dark:text-brand-secondary dark:hover:text-pink-400 focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Esqueceu a senha?
                    </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClasses + " mt-0"}
                  placeholder="Sua senha"
                />
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
