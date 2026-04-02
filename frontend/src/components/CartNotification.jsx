import { useEffect } from 'react';

export default function CartNotification({ item, onClose }) {
    useEffect(() => {
        if (!item) return;
        const timer = setTimeout(onClose, 1500);
        return () => clearTimeout(timer);
    }, [item, onClose]);

    if (!item) return null;

    return (
        <div className="fixed top-24 right-4 md:right-8 z-[150] w-[320px] bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-800 p-4 transition-all duration-300 animate-bounce-in">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Added to Cart</p>
                    <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{item.name}</p>
                    <p className="font-black text-qc-primary mt-0.5">₹{item.price.toLocaleString('en-IN')}</p>
                </div>
                <img src={item.img || 'https://via.placeholder.com/50'} className="w-12 h-12 rounded-lg object-contain bg-gray-50 dark:bg-slate-800 p-1 shrink-0 border border-gray-100 dark:border-slate-700" alt={item.name} />
            </div>
        </div>
    );
}
