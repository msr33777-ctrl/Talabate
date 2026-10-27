import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { CustomerView } from './components/customer/CustomerView';
import { MerchantView } from './components/merchant/MerchantView';
import { CourierView } from './components/courier/CourierView';
import { AdminView } from './components/admin/AdminView';
import { SupportDeskView } from './components/support/SupportDeskView';
import { NotificationsToast } from './components/common/NotificationsToast';
import {
  Wifi,
  Battery,
  Signal,
  Smartphone,
  Monitor,
  ShoppingBag,
  Store,
  Bike,
  ShieldAlert,
  Headphones,
} from 'lucide-react';

const MainContent: React.FC = () => {
  const { role, isMobileFrame, setIsMobileFrame } = useApp();

  const renderActiveView = () => {
    switch (role) {
      case 'customer':
        return <CustomerView />;
      case 'merchant':
        return <MerchantView />;
      case 'courier':
        return <CourierView />;
      case 'admin':
        return <AdminView />;
      case 'support':
        return <SupportDeskView />;
      default:
        return <CustomerView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif]">
      {/* Top Global Navigation Bar */}
      <Header />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 overflow-x-hidden">
        {isMobileFrame ? (
          /* Android Phone Simulation Container */
          <div className="w-full max-w-[420px] my-auto">
            {/* Phone Device Shell */}
            <div className="relative mx-auto rounded-[46px] border-[10px] border-slate-800 bg-[#F8FAFC] shadow-2xl overflow-hidden ring-1 ring-white/10 text-slate-800 flex flex-col min-h-[820px] max-h-[88vh]">
              {/* Android Top Bezel / Status Bar */}
              <div className="bg-[#172554] text-white px-6 pt-3 pb-2 flex items-center justify-between text-[11px] font-bold select-none shrink-0 z-30">
                <div className="flex items-center gap-1.5">
                  <span>4:30</span>
                  <span className="text-[10px] bg-orange-500/80 text-white px-1 rounded font-black">طلبي</span>
                </div>

                {/* Camera punch-hole simulation */}
                <div className="w-3.5 h-3.5 rounded-full bg-black border border-slate-700/80 -mt-1 shadow-inner"></div>

                <div className="flex items-center gap-1.5 text-slate-300">
                  <Signal className="w-3 h-3 text-emerald-400" />
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px]">98%</span>
                    <Battery className="w-3.5 h-3.5 fill-current text-white" />
                  </div>
                </div>
              </div>

              {/* Scrollable Android App Screen */}
              <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
                {renderActiveView()}
              </div>

              {/* Android Bottom Navigation Pill Gesture Bar */}
              <div className="bg-[#F8FAFC] py-2 px-6 flex items-center justify-center shrink-0 border-t border-slate-200/80 z-30">
                <div className="w-32 h-1 bg-slate-400 rounded-full"></div>
              </div>
            </div>

            {/* Hint underneath phone frame */}
            <div className="text-center mt-3 text-xs text-slate-400 flex items-center justify-center gap-2">
              <span>معاينة واجهة Android الموحدة</span>
              <span>•</span>
              <button
                onClick={() => setIsMobileFrame(false)}
                className="text-orange-400 font-bold hover:underline"
              >
                التبديل إلى شاشة سطح المكتب الكاملة
              </button>
            </div>
          </div>
        ) : (
          /* Full Desktop / Responsive View */
          <div className="w-full bg-[#F8FAFC] rounded-3xl shadow-2xl border border-slate-800 min-h-[85vh] text-slate-800 overflow-hidden">
            {renderActiveView()}
          </div>
        )}
      </main>

      {/* Floating Notifications */}
      <NotificationsToast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
