
'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, runTransaction, addDoc, serverTimestamp, query, writeBatch, Timestamp, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import type { User, Transaction, PurchasedSatellite } from '@/lib/types';
import { createTransaction } from '@/services/transactionService';

interface AuthContextType {
    user: User | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    updateUser: (data: Partial<User>) => Promise<void>;
    purchasedSatellites: PurchasedSatellite[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasedSatellites, setPurchasedSatellites] = useState<PurchasedSatellite[]>([]);
    const router = useRouter();
    const pathname = usePathname();

    const handleRedirect = useCallback((user: User | null) => {
        const isAuthRoute = pathname === '/';
        const isSuperAdminRoute = pathname.startsWith('/superadmin');
        const isDashboardRoute = pathname.startsWith('/dashboard');

        if (user) {
            // If user is logged in and on the auth page, redirect them
            if (isAuthRoute) {
                if (user.role === 'superadmin') {
                    router.push('/superadmin');
                } else {
                    router.push('/dashboard');
                }
            }
        } else {
            // If user is not logged in, redirect from protected routes
            if (isSuperAdminRoute || isDashboardRoute) {
               router.push('/');
           }
        }
    }, [router, pathname]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
            setFirebaseUser(fbUser);
            setLoading(true);

            if (fbUser) {
                const userDocRef = doc(db, 'users', fbUser.uid);
                const unsubUser = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        const userData = { id: doc.id, ...doc.data() } as User;
                        setUser(userData);
                        handleRedirect(userData);
                    } else {
                        setUser(null);
                        handleRedirect(null); 
                    }
                    setLoading(false);
                });

                const satellitesQuery = query(collection(db, 'users', fbUser.uid, 'purchasedSatellites'), orderBy('purchaseDate', 'desc'));
                const unsubSatellites = onSnapshot(satellitesQuery, (snapshot) => {
                    const userSatellites = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            id: doc.id,
                            purchaseDate: (data.purchaseDate as Timestamp).toDate(),
                            lastYieldDate: data.lastYieldDate ? (data.lastYieldDate as Timestamp).toDate() : undefined
                        } as PurchasedSatellite;
                    });
                    setPurchasedSatellites(userSatellites);
                });
                
                return () => {
                    unsubUser();
                    unsubSatellites();
                };

            } else {
                setUser(null);
                setFirebaseUser(null);
                setPurchasedSatellites([]);
                setLoading(false);
                handleRedirect(null);
            }
        });

        return () => {
            unsubscribeAuth();
        };
    }, [handleRedirect]);

    const updateUser = useCallback(async (data: Partial<User>) => {
        if (!firebaseUser) throw new Error("No user is signed in to update.");
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userDocRef, data);
    }, [firebaseUser]);


    const value = { user, firebaseUser, loading, updateUser, purchasedSatellites };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
