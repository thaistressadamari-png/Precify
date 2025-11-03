import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, Timestamp, addDoc, query, orderBy, limit } from 'firebase/firestore';
import type { User, ActionHistory } from '../types';
import { ArrowRightOnRectangleIcon } from './icons/ArrowRightOnRectangleIcon';
import { SearchIcon } from './icons/SearchIcon';
import { AdjustmentsHorizontalIcon } from './icons/AdjustmentsHorizontalIcon';

const UserEditModal: React.FC<{
    user: User;
    onClose: () => void;
    onSave: (userId: string, data: { isSubscribed: boolean, trialEndsAt: Timestamp }, originalUser: User) => void;
}> = ({ user, onClose, onSave }) => {
    const [isSubscribed, setIsSubscribed] = useState(user.isSubscribed || false);
    const [trialDate, setTrialDate] = useState(() => {
        if (user.trialEndsAt) {
            return user.trialEndsAt.toDate().toISOString().split('T')[0];
        }
        return '';
    });

    const handleSave = () => {
        let trialTimestamp;
        try {
            const dateWithTime = new Date(`${trialDate}T12:00:00.000Z`);
            trialTimestamp = Timestamp.fromDate(dateWithTime);
        } catch (e) {
            alert('Data inválida.');
            return;
        }
        onSave(user.id, { isSubscribed, trialEndsAt: trialTimestamp }, user);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Gerenciar Usuário</h2>
                <div className="space-y-4 text-sm">
                    <p><strong className="text-brand-light-text dark:text-gray-400">Nome:</strong> {user.name}</p>
                    <p><strong className="text-brand-light-text dark:text-gray-400">Email:</strong> {user.email}</p>
                    <p><strong className="text-brand-light-text dark:text-gray-400">Telefone:</strong> {user.phone || 'Não informado'}</p>
                </div>
                <div className="mt-6 space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-brand-text dark:text-gray-200">
                            <input type="checkbox" checked={isSubscribed} onChange={(e) => setIsSubscribed(e.target.checked)} className="h-5 w-5 rounded text-brand-primary focus:ring-brand-secondary"/>
                            <span>Assinatura Ativa</span>
                        </label>
                    </div>
                    <div>
                        <label htmlFor="trialDate" className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Data de Fim do Teste</label>
                        <input
                            type="date"
                            id="trialDate"
                            value={trialDate}
                            onChange={(e) => setTrialDate(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-8">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg">
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

const ActionHistoryLog: React.FC = () => {
    const [actions, setActions] = useState<ActionHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchActions = async () => {
            setLoading(true);
            try {
                const actionsQuery = query(collection(db, "action_history"), orderBy("timestamp", "desc"), limit(100));
                const querySnapshot = await getDocs(actionsQuery);
                const actionsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionHistory));
                setActions(actionsList);
            } catch (err) {
                console.error(err);
                setError('Falha ao carregar o histórico de ações.');
            } finally {
                setLoading(false);
            }
        };
        fetchActions();
    }, []);

    if (loading) return <p className="text-center py-8">Carregando histórico...</p>;
    if (error) return <p className="text-center py-8 text-red-500">{error}</p>;

    return (
        <div className="max-h-[65vh] overflow-y-auto">
            <ul className="space-y-3">
                {actions.map(action => (
                    <li key={action.id} className="p-3 bg-rose-50 dark:bg-gray-700/50 rounded-lg border border-rose-200 dark:border-gray-600">
                        <p className="text-brand-text dark:text-gray-200 text-sm">{action.description}</p>
                        <p className="text-xs text-brand-light-text dark:text-gray-400 mt-1">
                            {action.timestamp.toDate().toLocaleString('pt-BR')}
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
};


export const AdminDashboard: React.FC<{ onLogout: () => void; currentUser: User; }> = ({ onLogout, currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'history'>('users');

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "users"));
                const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
                setUsers(usersList);
            } catch (err) {
                console.error(err);
                setError('Falha ao carregar usuários.');
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleUpdateUser = async (userId: string, data: { isSubscribed: boolean, trialEndsAt: Timestamp }, originalUser: User) => {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, data);
            
            // Log action
            const changes = [];
            if (originalUser.isSubscribed !== data.isSubscribed) {
                changes.push(`status de assinatura para '${data.isSubscribed ? 'Ativo' : 'Inativo'}'`);
            }
            const originalDate = originalUser.trialEndsAt?.toDate().toISOString().split('T')[0];
            const newDate = data.trialEndsAt.toDate().toISOString().split('T')[0];
            if (originalDate !== newDate) {
                changes.push(`data final do teste para '${newDate}'`);
            }
            if(changes.length > 0) {
                 await addDoc(collection(db, 'action_history'), {
                    timestamp: Timestamp.now(),
                    actionType: 'ADMIN_STATUS_CHANGE',
                    description: `Admin '${currentUser.name}' alterou ${changes.join(' e ')} para o usuário '${originalUser.name}'.`,
                    adminId: currentUser.id,
                    adminName: currentUser.name,
                    userId: originalUser.id,
                    userName: originalUser.name,
                });
            }

            setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, ...data } : u));
            setEditingUser(null);
        } catch (err) {
            console.error(err);
            alert('Falha ao atualizar usuário.');
        }
    };
    
    const getUserStatus = (user: User): { text: string; color: string } => {
        if (user.isSubscribed) {
            return { text: 'Ativo', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
        }
        if (user.trialEndsAt) {
            if (user.trialEndsAt.toDate() > new Date()) {
                const daysLeft = Math.ceil((user.trialEndsAt.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return { text: `Em Teste (${daysLeft}d)`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
            }
            return { text: 'Expirado', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' };
        }
        return { text: 'Pendente', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    };

    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);
    
    const TabButton: React.FC<{tabId: 'users' | 'history'; children: React.ReactNode;}> = ({ tabId, children }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === tabId
                ? 'text-brand-primary border-brand-primary'
                : 'text-brand-light-text dark:text-gray-400 border-transparent hover:text-brand-text dark:hover:text-gray-200'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="bg-rose-50 dark:bg-gray-900 min-h-screen text-brand-text dark:text-gray-200 font-sans">
            <div className="container mx-auto px-4 py-8">
                <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
                    <h1 className="font-display text-3xl font-bold text-brand-primary">Painel de Gerenciamento</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm">Olá, {currentUser.name.split(' ')[0]}</span>
                        <button onClick={onLogout} className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700">
                            <ArrowRightOnRectangleIcon className="w-5 h-5"/>
                            <span>Sair</span>
                        </button>
                    </div>
                </header>

                <main>
                    <div className="border-b border-rose-200 dark:border-gray-700 mb-6">
                        <nav className="flex space-x-2">
                            <TabButton tabId="users">Usuários</TabButton>
                            <TabButton tabId="history">Histórico de Ações</TabButton>
                        </nav>
                    </div>
                
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                        {activeTab === 'users' && (
                          <>
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                                <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Usuários ({filteredUsers.length})</h2>
                                <div className="relative">
                                    <input 
                                        type="search"
                                        placeholder="Buscar por nome ou email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 pr-4 py-2 w-full sm:w-64 border border-rose-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-brand-secondary focus:border-brand-secondary"
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <SearchIcon className="w-5 h-5 text-gray-400" />
                                    </div>
                                </div>
                            </div>
                            {loading && <p className="text-center py-8">Carregando usuários...</p>}
                            {error && <p className="text-center py-8 text-red-500">{error}</p>}

                            {!loading && !error && (
                                <div className="max-h-[65vh] overflow-y-auto">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 bg-rose-50 dark:bg-gray-700/80 backdrop-blur-sm">
                                            <tr>
                                                <th className="p-3 text-sm font-semibold text-brand-light-text dark:text-gray-400">Nome</th>
                                                <th className="p-3 text-sm font-semibold text-brand-light-text dark:text-gray-400 hidden md:table-cell">Email</th>
                                                <th className="p-3 text-sm font-semibold text-brand-light-text dark:text-gray-400 hidden lg:table-cell">Fim do Teste</th>
                                                <th className="p-3 text-sm font-semibold text-brand-light-text dark:text-gray-400">Status</th>
                                                <th className="p-3 text-sm font-semibold text-brand-light-text dark:text-gray-400 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
                                            {filteredUsers.map(user => {
                                                const status = getUserStatus(user);
                                                return (
                                                    <tr key={user.id} className="hover:bg-rose-50 dark:hover:bg-gray-700/50">
                                                        <td className="p-3 font-medium text-brand-text dark:text-gray-200">{user.name}</td>
                                                        <td className="p-3 text-brand-light-text dark:text-gray-400 hidden md:table-cell">{user.email}</td>
                                                        <td className="p-3 text-brand-light-text dark:text-gray-400 hidden lg:table-cell">
                                                            {user.trialEndsAt ? user.trialEndsAt.toDate().toLocaleDateString('pt-BR') : 'N/A'}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${status.color}`}>
                                                                {status.text}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <button onClick={() => setEditingUser(user)} className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-gray-600">
                                                                <AdjustmentsHorizontalIcon className="w-5 h-5"/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                          </>
                        )}
                        {activeTab === 'history' && (
                           <>
                             <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Últimas 100 Ações</h2>
                             <ActionHistoryLog />
                           </>
                        )}
                    </div>
                </main>
            </div>

            {editingUser && (
                <UserEditModal 
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSave={handleUpdateUser}
                />
            )}
        </div>
    );
};