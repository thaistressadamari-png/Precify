import React, { useState } from 'react';
import { auth, db, googleProvider } from './firebase';
import { sendSignInLinkToEmail, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleIcon } from './icons/GoogleIcon';

interface RegistrationPageProps {
  onRegisterSuccess: () => void;
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
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

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
    setLoading(true);
    setLinkSent(false);

    const actionCodeSettings = {
      url: window.location.origin, // Redirect to the main page after sign-in
      handleCodeInApp: true,
    };

    try {
      // Store profile data temporarily, to be picked up after email verification
      const profileData = {
        name: formData.fullName,
        phone: formData.phone,
      };
      window.localStorage.setItem(`pending_registration_${formData.email}`, JSON.stringify(profileData));
      
      await sendSignInLinkToEmail(auth, formData.email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', formData.email);
      setLinkSent(true);

    } catch (error: any) {
      setError('Ocorreu um erro ao enviar o link. Verifique seus dados e tente novamente.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          name: user.displayName,
          email: user.email,
        });
      }
    } catch (error: any) {
      setError('Falha ao se cadastrar com o Google. Tente novamente.');
      console.error('Google Sign-up error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-3 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary";

  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
            <h1 className="font-display text-6xl font-bold text-brand-primary">Precify</h1>
            <p className="text-brand-light-text dark:text-gray-400 mt-2">Sua confeitaria sob controle.</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-brand-text dark:text-rose-100 mb-2 text-center">Crie sua Conta</h2>
          <p className="text-center text-brand-light-text dark:text-gray-400 mb-6">É rápido e fácil, sem precisar de senha.</p>
          
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
            
            {linkSent ? (
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/50 rounded-lg">
                    <p className="font-semibold text-green-700 dark:text-green-300">Link de acesso enviado!</p>
                    <p className="text-sm text-green-600 dark:text-green-400">Verifique sua caixa de entrada (e spam) e clique no link para completar seu cadastro e acessar sua conta.</p>
              </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Nome Completo" required className={inputClasses} />
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Telefone de Contato" required className={inputClasses} />
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="E-mail" required autoComplete="email" className={inputClasses} />
                  
                  {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}

                  <div>
                    <button
                      type="submit"
                      disabled={loading || googleLoading}
                      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-brand-primary hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-transform transform hover:scale-105 disabled:bg-rose-300 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Enviando...' : 'Criar Conta com E-mail'}
                    </button>
                  </div>
                </form>
            )}
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