import type { UserAuth } from '../types';

export const defaultUsers: UserAuth[] = [
    {
        id: 'user-1',
        name: 'Ana Confeiteira',
        email: 'ana@precify.com',
        password: 'confeitaria123'
    },
    {
        id: 'user-2',
        name: 'João Padeiro',
        email: 'joao@precify.com',
        password: 'password456'
    }
];