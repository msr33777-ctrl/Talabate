import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Phone, X, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface PhoneAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifiedSuccess?: (phone: string) => void;
  title?: string;
  subtitle?: string;
}

export const PhoneAuthModal: React.FC<PhoneAuthModalProps> = ({
  isOpen,
  onClose,
  onVerifiedSuccess,
  title = 'تسجيل الدخول برقم الهاتف',
  subtitle,
}) => {
  const { addNotification } = useApp();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCodeSent(true);
      addNotification('رمز التحقق', 'تم إرسال رمز التحقق إلى رقم هاتفك (رمز تجريبي: 123456)', 'info');
    }, 800);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === '123456' || verificationCode.length >= 4) {
      addNotification('تم التحقق بنجاح', 'تم تأكيد رقم الهاتف بنجاح', 'success');
      if (onVerifiedSuccess) {
        onVerifiedSuccess(phoneNumber || '07701234567');
      }
      onClose();
    } else {
      addNotification('رمز غير صحيح', 'يرجى إدخال رمز التحقق التجريبي: 123456', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-['Cairo',sans-serif]">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{title}</h3>
              {subtitle && <p className="text-[10px] text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!codeSent ? (
          <form onSubmit={handleSendCode} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف العراقي</label>
              <input
                type="tel"
                dir="ltr"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0770 123 4567"
                className="w-full bg-slate-50 border border-slate-300 px-3 py-2.5 rounded-xl text-xs font-bold focus:border-orange-500 text-right outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#EF3838] hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق SMS'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">أدخل رمز التحقق (رمز تجريبي: 123456)</label>
              <input
                type="text"
                dir="ltr"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-slate-50 border border-slate-300 px-3 py-2.5 rounded-xl text-xs font-bold text-center tracking-widest text-lg outline-none focus:border-orange-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تأكيد وتسجيل الدخول</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
