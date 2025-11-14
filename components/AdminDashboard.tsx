import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, Timestamp, addDoc, query, orderBy, limit, where, writeBatch } from 'firebase/firestore';
import type { User, ActionHistory } from '../types';
import { ArrowRightOnRectangleIcon } from './icons/ArrowRightOnRectangleIcon';
import { SearchIcon } from './icons/SearchIcon';
import { AdjustmentsHorizontalIcon } from './icons/AdjustmentsHorizontalIcon';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { BulkActionModal } from './BulkActionModal';

const UserActionHistoryLog: React.FC<{ userId: string }> = ({ userId }) => {
    const [actions, setActions] = useState<ActionHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchActions = async () => {
            if (!userId) return;
            setLoading(true);
            setError('');
            try {
                const actionsQuery = query(
                    collection(db, "action_history"),
                    where("userId", "==", userId),
                    limit(50)
                );
                const querySnapshot = await getDocs(actionsQuery);
                const actionsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionHistory));
                actionsList.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
                setActions(actionsList);
            } catch (err) {
                console.error("Error fetching user action history:", err);
                setError('Falha ao carregar o histórico do usuário.');
            } finally {
                setLoading(false);
            }
        };
        fetchActions();
    }, [userId]);

    if (loading) return <p className="text-center py-4 text-sm text-gray-500">Carregando histórico...</p>;
    if (error) return <p className="text-center py-4 text-sm text-red-500">{error}</p>;
    if (actions.length === 0) return <p className="text-center py-4 text-sm text-gray-500">Nenhuma ação registrada para este usuário.</p>;

    return (
        <div className="max-h-64 overflow-y-auto pr-2 space-y-3 rounded-lg bg-rose-50/50 dark:bg-gray-900/50 p-3 border border-rose-200 dark:border-gray-700">
            {actions.map(action => (
                <div key={action.id} className="p-3 bg-white dark:bg-gray-700/50 rounded-md shadow-sm">
                    <p className="text-brand-text dark:text-gray-200 text-sm">{action.description}</p>
                    <p className="text-xs text-brand-light-text dark:text-gray-400 mt-1">
                        {action.timestamp.toDate().toLocaleString('pt-BR')}
                    </p>
                </div>
            ))}
        </div>
    );
};


const UserEditModal: React.FC<{
    user: User;
    onClose: () => void;
    onSave: (userId: string, data: { isSubscribed: boolean, trialEndsAt: Timestamp, role: 'admin' | 'user' }, originalUser: User) => void;
}> = ({ user, onClose, onSave }) => {
    const [isSubscribed, setIsSubscribed] = useState(user.isSubscribed || false);
    const [role, setRole] = useState(user.role || 'user');
    const [trialDate, setTrialDate] = useState(() => {
        if (user.trialEndsAt) {
            return user.trialEndsAt.toDate().toISOString().split('T')[0];
        }
        return '';
    });

    const handleSave = () => {
        let trialTimestamp;
        try {
            if (!trialDate) {
                 throw new Error("Data inválida.");
            }
            const dateWithTime = new Date(trialDate);
            // Adjust for timezone offset to prevent date from shifting
            dateWithTime.setMinutes(dateWithTime.getMinutes() + dateWithTime.getTimezoneOffset());
            trialTimestamp = Timestamp.fromDate(dateWithTime);
        } catch (e) {
            alert('Data inválida.');
            return;
        }
        onSave(user.id, { isSubscribed, trialEndsAt: trialTimestamp, role }, user);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl">
                <div className="p-6 max-h-[90vh] overflow-y-auto">
                    <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Gerenciar Usuário</h2>
                    <div className="space-y-4 text-sm mb-6">
                        <p><strong className="text-brand-light-text dark:text-gray-400 font-medium">Nome:</strong> <span className="text-brand-text dark:text-gray-200">{user.name}</span></p>
                        <p><strong className="text-brand-light-text dark:text-gray-400 font-medium">Email:</strong> <span className="text-brand-text dark:text-gray-200">{user.email}</span></p>
                        <p><strong className="text-brand-light-text dark:text-gray-400 font-medium">Telefone:</strong> <span className="text-brand-text dark:text-gray-200">{user.phone || 'Não informado'}</span></p>
                    </div>
                    <div className="space-y-4 p-4 bg-rose-50 dark:bg-gray-800/50 rounded-lg border border-rose-100 dark:border-gray-700">
                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={isSubscribed} onChange={(e) => setIsSubscribed(e.target.checked)} className="h-5 w-5 rounded text-brand-primary focus:ring-brand-secondary border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"/>
                                <span className="font-medium text-brand-text dark:text-gray-200">Assinatura Ativa</span>
                            </label>
                        </div>
                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={role === 'admin'} onChange={(e) => setRole(e.target.checked ? 'admin' : 'user')} className="h-5 w-5 rounded text-brand-primary focus:ring-brand-secondary border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"/>
                                <span className="font-medium text-brand-text dark:text-gray-200">Tornar Administrador</span>
                            </label>
                        </div>
                        <div>
                            <label htmlFor="trialDate" className="block text-sm font-medium text-brand-light-text dark:text-gray-400 mb-1">Data de Fim do Teste</label>
                            <input
                                type="date"
                                id="trialDate"
                                value={trialDate}
                                onChange={(e) => setTrialDate(e.target.value)}
                                className="block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                            />
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-rose-200 dark:border-gray-700">
                        <h3 className="font-display text-xl text-brand-text dark:text-rose-100 mb-4">Histórico de Ações do Usuário</h3>
                        <UserActionHistoryLog userId={user.id} />
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
        </div>
    );
};


export const AdminDashboard: React.FC<{ onLogout: () => void; currentUser: User; onGoToApp: () => void; }> = ({ onLogout, currentUser, onGoToApp }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [filter, setFilter] = useState<'all' | 'trial' | 'subscribed' | 'expired'>('all');
    
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<'extend' | 'subscribe' | null>(null);
    const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);

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

    const handleUpdateUser = async (userId: string, data: { isSubscribed: boolean, trialEndsAt: Timestamp, role: 'admin' | 'user' }, originalUser: User) => {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, data);
            
            const changes = [];
            if (originalUser.isSubscribed !== data.isSubscribed) {
                changes.push(`status de assinatura para '${data.isSubscribed ? 'Ativo' : 'Inativo'}'`);
            }
            const originalDate = originalUser.trialEndsAt?.toDate().toISOString().split('T')[0];
            const newDate = data.trialEndsAt.toDate().toISOString().split('T')[0];
            if (originalDate !== newDate) {
                changes.push(`data final do teste para '${newDate}'`);
            }
            if ((originalUser.role || 'user') !== data.role) {
                changes.push(`permissão para '${data.role === 'admin' ? 'Admin' : 'Usuário'}'`);
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
                    details: { from: { isSubscribed: originalUser.isSubscribed, trialEndsAt: originalDate, role: originalUser.role || 'user' }, to: data },
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
        const now = new Date();
        return users
            .filter(user => {
                const trialEnds = user.trialEndsAt?.toDate();
                const hasTrialEnded = trialEnds && trialEnds <= now;

                switch (filter) {
                    case 'subscribed':
                        return user.isSubscribed;
                    case 'trial':
                        return !user.isSubscribed && trialEnds && !hasTrialEnded;
                    case 'expired':
                        return !user.isSubscribed && hasTrialEnded;
                    case 'all':
                    default:
                        return true;
                }
            })
            .filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [users, searchTerm, filter]);
    
    const handleSelectUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allFilteredIds = new Set(filteredUsers.map(u => u.id));
            setSelectedUserIds(allFilteredIds);
        } else {
            setSelectedUserIds(new Set());
        }
    };
    
    const handleBulkUpdate = async (action: 'extend' | 'subscribe', days?: number) => {
        setBulkUpdateLoading(true);
        const batch = writeBatch(db);
        const usersToUpdate = users.filter(u => selectedUserIds.has(u.id));
        const updatedUsersLocally: User[] = [];

        for (const user of usersToUpdate) {
            const userRef = doc(db, 'users', user.id);
            let updatedData: Partial<User> = {};
            let description = '';

            if (action === 'extend' && days) {
                const currentTrialEnd = user.trialEndsAt ? user.trialEndsAt.toDate() : new Date();
                const newTrialEnd = new Date(currentTrialEnd.getTime());
                newTrialEnd.setDate(newTrialEnd.getDate() + days);
                const trialEndsAt = Timestamp.fromDate(newTrialEnd);
                updatedData = { trialEndsAt };
                description = `Admin '${currentUser.name}' estendeu o teste em ${days} dias para ${user.name}.`;
            } else if (action === 'subscribe') {
                updatedData = { isSubscribed: true };
                description = `Admin '${currentUser.name}' marcou ${user.name} como assinante.`;
            }

            batch.update(userRef, updatedData);
            updatedUsersLocally.push({ ...user, ...updatedData });
            
            const historyRef = doc(collection(db, 'action_history'));
            batch.set(historyRef, {
                timestamp: Timestamp.now(),
                actionType: 'ADMIN_STATUS_CHANGE',
                description,
                adminId: currentUser.id,
                adminName: currentUser.name,
                userId: user.id,
                userName: user.name,
            });
        }

        try {
            await batch.commit();
            setUsers(prevUsers =>
                prevUsers.map(u => updatedUsersLocally.find(upd => upd.id === u.id) || u)
            );
            alert(`${usersToUpdate.length} usuários atualizados com sucesso!`);
        } catch (e) {
            console.error("Bulk update error:", e);
            alert("Ocorreu um erro ao atualizar os usuários.");
        } finally {
            setBulkUpdateLoading(false);
            setSelectedUserIds(new Set());
            setBulkAction(null);
        }
    };


    return (
        <div className="bg-rose-50 dark:bg-gray-900 min-h-screen text-brand-text dark:text-gray-200 font-sans">
            <div className="container mx-auto px-4 py-8">
                <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
                    <h1 className="font-display text-3xl font-bold text-brand-primary">Painel de Gerenciamento</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-sm hidden sm:block">Olá, {currentUser.name.split(' ')[0]}</span>
                        <button onClick={onGoToApp} className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700">
                            <ArrowUturnLeftIcon className="w-5 h-5"/>
                            <span className="hidden md:block">Ir para App</span>
                        </button>
                        <button onClick={onLogout} className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors text-brand-light-text dark:text-gray-400 hover:bg-rose-100 dark:hover:bg-gray-700">
                            <ArrowRightOnRectangleIcon className="w-5 h-5"/>
                            <span className="hidden md:block">Sair</span>
                        </button>
                    </div>
                </header>

                <main>
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                            <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Usuários ({users.length})</h2>
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
                        
                        <div className="flex justify-start flex-wrap gap-2 mb-4 border-b border-rose-100 dark:border-gray-700 pb-4">
                            {([
                                { key: 'all', label: 'Todos' },
                                { key: 'trial', label: 'Em Teste' },
                                { key: 'subscribed', label: 'Pagos' },
                                { key: 'expired', label: 'Expirados' },
                            ] as const).map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key)}
                                    className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                                        filter === f.key
                                        ? 'bg-brand-primary text-white shadow-sm'
                                        : 'bg-rose-100 hover:bg-rose-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-brand-light-text dark:text-gray-300'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {loading && <p className="text-center py-8">Carregando usuários...</p>}
                        {error && <p className="text-center py-8 text-red-500">{error}</p>}

                        {!loading && !error && (
                            <div className="max-h-[65vh] overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-rose-50 dark:bg-gray-700/80 backdrop-blur-sm">
                                        <tr>
                                            <th className="p-3 w-4">
                                                <input
                                                    type="checkbox"
                                                    onChange={handleSelectAll}
                                                    checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                                                    className="h-4 w-4 rounded text-brand-primary focus:ring-brand-secondary border-gray-300 dark:border-gray-600"
                                                />
                                            </th>
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
                                                <tr key={user.id} className={`transition-colors ${selectedUserIds.has(user.id) ? 'bg-rose-100 dark:bg-gray-700' : 'hover:bg-rose-50 dark:hover:bg-gray-700/50'}`}>
                                                    <td className="p-3">
                                                         <input
                                                            type="checkbox"
                                                            checked={selectedUserIds.has(user.id)}
                                                            onChange={() => handleSelectUser(user.id)}
                                                            className="h-4 w-4 rounded text-brand-primary focus:ring-brand-secondary border-gray-300 dark:border-gray-600"
                                                        />
                                                    </td>
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
                        {selectedUserIds.size > 0 && (
                            <div className="bg-rose-100/80 dark:bg-gray-700/80 backdrop-blur-sm p-3 rounded-lg mt-4 flex items-center justify-between shadow-lg animate-fade-in-up">
                                <span className="font-semibold text-brand-text dark:text-gray-200 text-sm">{selectedUserIds.size} usuários selecionados</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setBulkAction('extend')} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-md text-sm">Prorrogar Teste</button>
                                    <button onClick={() => setBulkAction('subscribe')} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-md text-sm">Marcar como Pagos</button>
                                </div>
                            </div>
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
            
            {bulkAction && (
                <BulkActionModal
                    isOpen={!!bulkAction}
                    action={bulkAction}
                    selectedCount={selectedUserIds.size}
                    onClose={() => setBulkAction(null)}
                    onConfirm={handleBulkUpdate}
                    loading={bulkUpdateLoading}
                />
            )}
        </div>
    );
};