import { createContext, useContext, useState } from 'react';

const LocationContext = createContext();

const DEFAULT_ADDRESS = {
    label: 'Select Delivery Location',
    street: '',
    city: '',
    state: '',
    zip: '',
    instructions: '',
    lat: null,
    lng: null,
};

export function LocationProvider({ children }) {
    const [deliveryAddress, setDeliveryAddress] = useState(() => {
        try {
            const saved = localStorage.getItem('dechta_delivery_address');
            return saved ? JSON.parse(saved) : DEFAULT_ADDRESS;
        } catch {
            return DEFAULT_ADDRESS;
        }
    });
    const [locationModalOpen, setLocationModalOpen] = useState(false);

    const updateDeliveryAddress = (addr) => {
        setDeliveryAddress(addr);
        try {
            localStorage.setItem('dechta_delivery_address', JSON.stringify(addr));
        } catch {
            // ignore storage errors
        }
    };

    return (
        <LocationContext.Provider value={{
            deliveryAddress,
            setDeliveryAddress: updateDeliveryAddress,
            locationModalOpen,
            setLocationModalOpen,
        }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
}
