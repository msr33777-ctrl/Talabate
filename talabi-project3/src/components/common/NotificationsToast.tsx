import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const NotificationsToast: React.FC = () => {
  const { notifications, dismissNotification, setActiveTrackedOrderId, setRole } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((n) => {
        const getIcon = () => {
          switch (n.type) {
            case 'success':
              return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
            case 'warning':
              return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
            case 'error':
              return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
            default:
              return <Info className="w-5 h-5 text-sky-500 shrink-0" />;
          }
        };

        const getBorder = () => {
          switch (n.type) {
            case 'success':
              return 'border-emerald-500/30 bg-emerald-950/80 text-emerald-100';
            case 'warning':
              return 'border-amber-500/30 bg-amber-950/80 text-amber-100';
            case 'error':
              return 'border-rose-500/30 bg-rose-950/80 text-rose-100';
            default:
              return 'border-sky-500/30 bg-slate-900/95 text-slate-100';
          }
        };

        return (
          <div
            key={n.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-3 transition-all duration-300 animate-in slide-in-from-top-2 ${getBorder()}`}
          >
            {getIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-bold leading-tight">{n.title}</h4>
                <span className="text-[10px] opacity-60">{n.timestamp}</span>
              </div>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">{n.message}</p>
              {n.orderId && (
                <button
                  onClick={() => {
                    setActiveTrackedOrderId(n.orderId!);
                    setRole('customer');
                    dismissNotification(n.id);
                  }}
                  className="mt-2 text-[11px] font-bold text-orange-400 hover:text-orange-300 underline"
                >
                  عرض تفاصيل الطلب #{n.orderId}
                </button>
              )}
            </div>
            <button
              onClick={() => dismissNotification(n.id)}
              className="text-slate-400 hover:text-white p-0.5 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
