'use client';

import { createContext, useContext } from 'react';
import type { User as UserType } from '@/lib/types';

export interface UserContextType {
  currentUser: UserType | null;
  setCurrentUser: (user: UserType | null) => void;
}

export const UserContext = createContext<UserContextType>({
  currentUser: null,
  setCurrentUser: () => {},
});

export const useCurrentUser = () => useContext(UserContext);