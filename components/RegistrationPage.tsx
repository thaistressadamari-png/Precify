import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { GoogleIcon } from './icons/GoogleIcon';
import type { User } from '../types';
import { trackEvent } from './utils';

interface RegistrationPageProps {
  onRegisterSuccess: (user: User) => void;
  onNavigateToLogin: () => void;
}

const formatPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};

export const RegistrationPage: React.FC<RegistrationPageProps> = ({ onRegisterSuccess, onNavigateToLogin }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    trackEvent('view_register_page');
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'phone') {
      formattedValue = formatPhone(value);
    }
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
        setError('As senhas não coincidem.');
        return;
    }
    if (formData.password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    setLoading(true);
    trackEvent('submit_registration_form', { method: 'email' });

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Update profile in Firebase Auth
        await updateProfile(user, {
            displayName: formData.fullName,
        });

        const trialEndDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4-day free trial
        const trialTimestamp = Timestamp.fromDate(trialEndDate);

        const userData = {
            name: formData.fullName,
            email: user.email,
            phone: formData.phone,
            trialEndsAt: trialTimestamp,
            hasGivenFeedback: false,
            isSubscribed: false,
        };
        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), userData);
        
        const fullUser: User = {
            id: user.uid,
            name: formData.fullName,
            email: user.email!,
            phone: formData.phone,
            trialEndsAt: trialTimestamp,
            hasGivenFeedback: false,
            isSubscribed: false,
        };
        onRegisterSuccess(fullUser);

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            setError('Este e-mail já está em uso. Tente fazer login.');
        } else {
            setError('Ocorreu um erro ao criar a conta. Tente novamente.');
        }
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleLoading(true);
    trackEvent('submit_registration_form', { method: 'google' });
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      let appUser: User;

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
         appUser = {
            id: user.uid,
            email: user.email!,
            name: userData.name,
            phone: userData.phone,
            trialEndsAt: userData.trialEndsAt,
            hasGivenFeedback: userData.hasGivenFeedback,
            isSubscribed: userData.isSubscribed,
            paymentConfirmationClicked: userData.paymentConfirmationClicked,
        };
      } else {
        const trialEndDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4-day free trial
        const trialTimestamp = Timestamp.fromDate(trialEndDate);
        
        const newUserDoc = {
          name: user.displayName || 'Usuário Google',
          email: user.email,
          trialEndsAt: trialTimestamp,
          hasGivenFeedback: false,
          isSubscribed: false,
        };
        await setDoc(userDocRef, newUserDoc);

        appUser = {
            id: user.uid,
            email: user.email!,
            name: newUserDoc.name,
            trialEndsAt: trialTimestamp,
            hasGivenFeedback: false,
            isSubscribed: false,
        };
      }
      onRegisterSuccess(appUser);

    } catch (error: any) {
      setError('Falha ao se cadastrar com o Google. Tente novamente.');
      console.error('Google Sign-up error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-3 bg-white text-brand-text dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary";

  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
            <h1 className="font-display text-6xl font-bold text-brand-primary">Precify</h1>
            <p className="text-brand-light-text dark:text-gray-400 mt-2">Sua confeitaria sob controle.</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-brand-text dark:text-rose-100 mb-2 text-center">Crie sua Conta</h2>
          <p className="text-center text-brand-light-text dark:text-gray-400 mb-6">É rápido, fácil e seguro.</p>
          
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-500 rounded-lg shadow-sm text-sm font-bold text-brand-text dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              <GoogleIcon />
              {googleLoading ? 'Aguarde...' : 'Cadastrar com Google'}
            </button>

            <div className="flex items-center">
              <div className="flex-grow border-t border-rose-200 dark:border-gray-600"></div>
              <span className="flex-shrink mx-4 text-sm text-brand-light-text dark:text-gray-400">OU</span>
              <div className="flex-grow border-t border-rose-200 dark:border-gray-600"></div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Nome Completo" required className={inputClasses} />
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Telefone de Contato" required className={inputClasses} />
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="E-mail" required autoComplete="email" className={inputClasses} />
              <input type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="Senha (mínimo 6 caracteres)" required className={inputClasses} autoComplete="new-password" />
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} placeholder="Confirmar Senha" required className={inputClasses} autoComplete="new-password" />
              
              {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}

              <div>
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-brand-primary hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-transform transform hover:scale-105 disabled:bg-rose-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Criando...' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>

           <div className="text-center mt-6">
              <p className="text-sm text-brand-light-text dark:text-gray-400">
                Já tem uma conta?{' '}
                <button onClick={onNavigateToLogin} className="font-semibold text-brand-primary hover:text-rose-700 dark:text-brand-secondary dark:hover:text-pink-400 focus:outline-none focus:underline">
                  Faça login
                </button>
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};