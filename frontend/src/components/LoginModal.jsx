import { useState } from 'react';
import { X, Phone, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { sendOtp, verifyOtp as verifyOtpApi } from '../api/apiClient';

export default function LoginModal({ open, onClose }) {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '']);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState('');
    const { login } = useAuth();

    const handleSendOtp = async () => {
        if (phone.length !== 10) return;
        setLoading(true);
        setApiError('');
        try {
            await sendOtp(phone);
            setStep(2);
        } catch (e) {
            // Fallback: go to step 2 even if backend unreachable (mock mode)
            console.warn('[OTP] API error, using mock fallback:', e.message);
            setStep(2);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 4) return;
        setLoading(true);
        setApiError('');
        try {
            const res = await verifyOtpApi(phone, otpString, name);
            if (res.success && res.data?.token) {
                localStorage.setItem('dechta_token', res.data.token);
                login(res.data.user?.name || name, phone);
                resetAndClose();
            } else {
                setApiError(res.message || 'Verification failed');
            }
        } catch (e) {
            // Fallback: accept any OTP if backend unreachable (mock mode)
            console.warn('[OTP] Verify API error, using mock fallback:', e.message);
            setStep(3);
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const res = await verifyOtpApi(phone, otp.join(''), name.trim());
            if (res.success && res.data?.token) {
                localStorage.setItem('dechta_token', res.data.token);
            }
        } catch (_) { /* token save is best-effort */ }
        login(name.trim(), phone);
        resetAndClose();
        setLoading(false);
    };

    const resetAndClose = () => {
        setStep(1); setPhone(''); setOtp(['', '', '', '']); setName(''); setApiError(''); onClose();
    };

    const handleOtpChange = (i, v) => {
        if (v.length > 1) return;
        const newOtp = [...otp]; newOtp[i] = v; setOtp(newOtp);
        if (v && i < 3) document.getElementById(`otp-${i + 1}`)?.focus();
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[200]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden z-10">
                <button onClick={resetAndClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-cyan-600" />
                </div>
                {apiError && <p className="text-red-500 text-sm mb-3">{apiError}</p>}
                {step === 1 && (<div><h2 className="text-2xl font-black dark:text-white mb-2">Login / Sign Up</h2><p className="text-sm text-gray-500 mb-6">Enter your phone number</p>
                    <div className="flex items-center gap-2 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4"><span className="font-bold text-gray-500">+91</span>
                        <input type="tel" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} className="flex-1 font-bold text-lg focus:outline-none dark:bg-transparent dark:text-white" placeholder="Phone" /></div>
                    <button onClick={handleSendOtp} disabled={phone.length !== 10 || loading} className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold disabled:opacity-50">{loading ? 'Sending...' : 'Send OTP'}</button></div>)}
                {step === 2 && (<div><h2 className="text-2xl font-black dark:text-white mb-2">Verify OTP</h2><p className="text-sm text-gray-500 mb-1">Sent to +91 {phone}</p>
                    <p className="text-xs text-cyan-600 mb-4 font-semibold">Mock OTP: 1234</p>
                    <div className="flex gap-3 justify-center mb-6">{otp.map((d, i) => (
                        <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={d} onChange={e => handleOtpChange(i, e.target.value)} className="otp-input w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none dark:bg-transparent dark:text-white" />
                    ))}</div>
                    <button onClick={handleVerifyOtp} disabled={loading} className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold disabled:opacity-50">{loading ? 'Verifying...' : 'Verify'}</button></div>)}
                {step === 3 && (<div><h2 className="text-2xl font-black dark:text-white mb-2">Your Name</h2><p className="text-sm text-gray-500 mb-6">Tell us who you are</p>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border-2 border-gray-200 dark:border-slate-700 rounded-xl p-3 font-bold text-lg focus:outline-none mb-4 dark:bg-transparent dark:text-white" placeholder="Full Name" />
                    <button onClick={handleFinish} disabled={loading} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Check className="w-5 h-5" />{loading ? 'Saving...' : 'Done'}</button></div>)}
            </div>
        </div>
    );
}
