import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getProfile } from '../api/apiClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    // authLoading = true while we check localStorage for existing session
    // Prevents flash of login modal before we know if user is already logged in
    const [authLoading, setAuthLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userData, setUserData] = useState({
        name: '', phone: '', email: '', initials: '', avatar: null,
        addresses: [], bookings: [], wishlist: [], wishlistFolders: [], ratings: {},
        walletBalance: 0, transactions: []
    });

    // ── Restore session on mount (same approach as vendor app) ──
    useEffect(() => {
        const token = localStorage.getItem('dechta_token');
        if (!token) {
            setAuthLoading(false);
            return;
        }

        // Token exists — fetch profile from backend to restore user data
        getProfile()
            .then((res) => {
                if (res.success && res.data) {
                    const name = full_name || '';
                    const initials = name
                        ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        : String(phone || '').slice(-2) || 'U';
                    
                    // Load wallet data from localStorage
                    const savedWallet = JSON.parse(localStorage.getItem(`dechta_wallet_${phone}`) || '{"balance":0,"transactions":[]}');

                    setUserData(prev => ({ 
                        ...prev, 
                        name, 
                        phone: String(phone || ''), 
                        email: email || '', 
                        initials,
                        walletBalance: savedWallet.balance,
                        transactions: savedWallet.transactions
                    }));
                    setIsLoggedIn(true);
                } else {
                    localStorage.removeItem('dechta_token');
                }
            })
            .catch(() => {
                // Backend unreachable — try decoding token payload as fallback
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const name = payload.name || '';
                    const phone = String(payload.phone || '');
                    const initials = name
                        ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                        : phone.slice(-2) || 'U';
                    setUserData(prev => ({ ...prev, name, phone, initials }));
                    setIsLoggedIn(true);
                } catch {
                    localStorage.removeItem('dechta_token');
                }
            })
            .finally(() => {
                setAuthLoading(false);
            });
    }, []);

    const login = useCallback((name, phone) => {
        const initials = name
            ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            : String(phone).slice(-2);
        
        const savedWallet = JSON.parse(localStorage.getItem(`dechta_wallet_${phone}`) || '{"balance":0,"transactions":[]}');

        setUserData(prev => ({ 
            ...prev, 
            name, 
            phone: String(phone), 
            initials,
            walletBalance: savedWallet.balance,
            transactions: savedWallet.transactions
        }));
        setIsLoggedIn(true);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('dechta_token');
        setIsLoggedIn(false);
        setUserData({
            name: '', phone: '', email: '', initials: '', avatar: null,
            addresses: [], bookings: [], wishlist: [], wishlistFolders: [], ratings: {},
            walletBalance: 0, transactions: []
        });
    }, []);

    const updateProfile = useCallback((updates) => {
        setUserData(prev => {
            const updated = { ...prev, ...updates };
            if (updates.name) {
                updated.initials = updates.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            }
            return updated;
        });
    }, []);

    const addAddress = useCallback((address) => {
        setUserData(prev => ({
            ...prev,
            addresses: [...prev.addresses, { ...address, id: Date.now(), selected: prev.addresses.length === 0 }]
        }));
    }, []);

    const selectAddress = useCallback((id) => {
        setUserData(prev => ({
            ...prev,
            addresses: prev.addresses.map(a => ({ ...a, selected: a.id === id }))
        }));
    }, []);

    const toggleWishlist = useCallback((productId) => {
        setUserData(prev => {
            const inMain = prev.wishlist.includes(productId);
            if (inMain) return { ...prev, wishlist: prev.wishlist.filter(id => id !== productId) };
            return { ...prev, wishlist: [...prev.wishlist, productId] };
        });
    }, []);

    const createWishlistFolder = useCallback((name) => {
        setUserData(prev => ({
            ...prev,
            wishlistFolders: [...(prev.wishlistFolders || []), { id: Date.now(), name, items: [] }]
        }));
    }, []);

    const addToWishlistFolder = useCallback((folderId, productId) => {
        setUserData(prev => ({
            ...prev,
            wishlist: prev.wishlist.filter(id => id !== productId),
            wishlistFolders: prev.wishlistFolders.map(f =>
                f.id === folderId
                    ? { ...f, items: f.items.includes(productId) ? f.items : [...f.items, productId] }
                    : f
            )
        }));
    }, []);

    const removeFromWishlistFolder = useCallback((folderId, productId) => {
        setUserData(prev => ({
            ...prev,
            wishlistFolders: prev.wishlistFolders.map(f =>
                f.id === folderId ? { ...f, items: f.items.filter(id => id !== productId) } : f
            )
        }));
    }, []);

    const deleteWishlistFolder = useCallback((folderId) => {
        setUserData(prev => {
            const folder = prev.wishlistFolders.find(f => f.id === folderId);
            const itemsToReturn = folder ? folder.items : [];
            return {
                ...prev,
                wishlist: [...new Set([...prev.wishlist, ...itemsToReturn])],
                wishlistFolders: prev.wishlistFolders.filter(f => f.id !== folderId)
            };
        });
    }, []);

    const addBooking = useCallback((booking) => {
        setUserData(prev => ({ ...prev, bookings: [booking, ...prev.bookings] }));
    }, []);

    const updateBookingStatus = useCallback((bookingId, status) => {
        setUserData(prev => ({
            ...prev,
            bookings: prev.bookings.map(b => b.id === bookingId ? { ...b, status } : b)
        }));
    }, []);

    const addProductRating = useCallback((productId, rating) => {
        setUserData(prev => ({
            ...prev,
            ratings: { ...prev.ratings, [productId]: rating }
        }));
    }, []);

    const topUpWallet = useCallback((amount) => {
        setUserData(prev => {
            const newBalance = prev.walletBalance + amount;
            const newTransaction = {
                id: Date.now(),
                type: 'credit',
                amount,
                description: 'Wallet Top-up',
                date: new Date().toISOString()
            };
            const newTransactions = [newTransaction, ...prev.transactions];
            
            // Persist
            localStorage.setItem(`dechta_wallet_${prev.phone}`, JSON.stringify({
                balance: newBalance,
                transactions: newTransactions
            }));

            return {
                ...prev,
                walletBalance: newBalance,
                transactions: newTransactions
            };
        });
    }, []);

    const payWithWallet = useCallback((amount, description) => {
        let success = false;
        setUserData(prev => {
            if (prev.walletBalance < amount) {
                success = false;
                return prev;
            }
            const newBalance = prev.walletBalance - amount;
            const newTransaction = {
                id: Date.now(),
                type: 'debit',
                amount,
                description: description || 'Payment',
                date: new Date().toISOString()
            };
            const newTransactions = [newTransaction, ...prev.transactions];
            
            // Persist
            localStorage.setItem(`dechta_wallet_${prev.phone}`, JSON.stringify({
                balance: newBalance,
                transactions: newTransactions
            }));

            success = true;
            return {
                ...prev,
                walletBalance: newBalance,
                transactions: newTransactions
            };
        });
        return success;
    }, []);

    const formatINR = useCallback((amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }, []);

    return (
        <AuthContext.Provider value={{
            authLoading,
            isLoggedIn, userData, login, logout, updateProfile,
            addAddress, selectAddress, toggleWishlist,
            createWishlistFolder, addToWishlistFolder, removeFromWishlistFolder, deleteWishlistFolder,
            addBooking, updateBookingStatus, addProductRating,
            topUpWallet, payWithWallet, formatINR
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);