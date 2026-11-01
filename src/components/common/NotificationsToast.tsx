import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { AppNotification } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Bell,
  PackageCheck,
  Bike,
  Store,
  ShieldAlert,
} from 'lucide-react';

interface SingleToastProps {
  notif: AppNotification;
  onDismiss: (id: string) => void;
}

const SingleToastItem: React.FC<SingleToastProps> = ({ notif, onDismiss }) => {
  const duration = notif.duration || (notif.type === 'error' ? 7000 : notif.type === 'warning' ? 5000 : 3500);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  useEffect(() => {
    let animFrame: number;
    let lastTime = Date.now();

    const updateTimer = () => {
      if (!isPaused) {
        const now = Date.now();
        const delta = now - lastTime;
        lastTime = now;

        remainingTimeRef.current -= delta;
        const pct = Math.max(0, (remainingTimeRef.current / duration) * 100);
        setProgress(pct);

        if (remainingTimeRef.current <= 0) {
          onDismiss(notif.id);
          return;
        }
      } else {
        lastTime = Date.now();
      }
      animFrame = requestAnimationFrame(updateTimer);
    };

    animFrame = requestAnimationFrame(updateTimer);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [notif.id, duration, isPaused, onDismiss]);

  // Color config based on type
  const getConfig = () => {
    switch (notif.type) {
      case 'success':
        return {
          cardBg: 'bg-[#061C14]/95 border-emerald-500/40 shadow-emerald-950/20',
          badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          titleColor: 'text-emerald-300',
          progressColor: 'bg-emerald-500',
        };
      case 'warning':
        return {
          cardBg: 'bg-[#1C1204]/95 border-amber-500/40 shadow-amber-950/20',
          badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          titleColor: 'text-amber-300',
          progressColor: 'bg-amber-500',
        };
      case 'error':
        return {
          cardBg: 'bg-[#1C080B]/95 border-rose-500/40 shadow-rose-950/20',
          badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
          icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
          titleColor: 'text-rose-300',
          progressColor: 'bg-rose-500',
        };
      case 'info':
      default:
        return {
          cardBg: 'bg-[#0B1528]/95 border-blue-500/40 shadow-blue-950/20',
          badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          icon: <Bell className="w-5 h-5 text-blue-400" />,
          titleColor: 'text-blue-300',
          progressColor: 'bg-blue-500',
        };
    }
  };

  const cfg = getConfig();

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      className={`group relative pointer-events-auto w-full rounded-2xl border ${cfg.cardBg} shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 overflow-hidden text-slate-100 font-['Cairo',sans-serif]`}
    >
      <div className="p-3.5 sm:p-4 flex items-start gap-3">
        {/* Icon Badge */}
        <div className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${cfg.badgeBg}`}>
          {cfg.icon}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <h4 className={`text-xs sm:text-sm font-extrabold truncate ${cfg.titleColor}`}>
                {notif.title}
              </h4>
              {notif.orderId && (
                <span className="text-[10px] bg-white/10 text-orange-300 border border-orange-400/30 px-2 py-0.2 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping"></span>
                  طلب #{notif.orderId.slice(-6)}
                </span>
              )}
            </div>

            <span className="text-[10px] text-slate-400 font-medium shrink-0">
              {notif.timestamp}
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            {notif.message}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => onDismiss(notif.id)}
          className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          title="إغلاق الإشعار"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-Dismiss Shrinking Progress Bar */}
      <div className="w-full bg-slate-800/60 h-1 overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ease-linear ${cfg.progressColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const NotificationsToast: React.FC = () => {
  const { notifications, dismissNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 max-w-md w-[92vw] sm:w-[420px] pointer-events-none select-none">
      {notifications.slice(0, 3).map((notif) => (
        <SingleToastItem
          key={notif.id}
          notif={notif}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
};

export default NotificationsToast;
