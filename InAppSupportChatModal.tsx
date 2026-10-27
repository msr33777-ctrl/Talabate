import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Send,
  Headphones,
  HelpCircle,
  AlertCircle,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface InAppSupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  relatedOrderId?: string;
}

export const InAppSupportChatModal: React.FC<InAppSupportChatModalProps> = ({
  isOpen,
  onClose,
  relatedOrderId,
}) => {
  const {
    conversations,
    currentUser,
    startSupportConversation,
    sendSupportMessage,
  } = useApp();

  const [inputMessage, setInputMessage] = useState('');
  const [subjectInput, setSubjectInput] = useState(
    relatedOrderId ? `استفسار حول الطلب #${relatedOrderId}` : 'استفسار أو شكوى عامة'
  );

  if (!isOpen) return null;

  // Find existing conversation for this user and order, or latest
  const userConv = conversations.find(
    (c) =>
      c.userId === currentUser.id &&
      (relatedOrderId ? c.relatedOrderId === relatedOrderId : true)
  ) || conversations.find((c) => c.userId === currentUser.id);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    if (userConv) {
      sendSupportMessage(userConv.id, inputMessage.trim());
    } else {
      const newId = startSupportConversation(subjectInput, relatedOrderId);
      sendSupportMessage(newId, inputMessage.trim());
    }
    setInputMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in text-slate-800">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#172554] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs">الدعم الفني والشكاوى المباشر</h3>
              <p className="text-[10px] text-slate-300">
                {relatedOrderId ? `بخصوص الطلب #${relatedOrderId}` : 'فريق خدمة عملاء طلبي متاح لمساعدتك'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f8fafc]">
          {!userConv ? (
            <div className="text-center py-6 space-y-3">
              <MessageSquare className="w-10 h-10 text-orange-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">مرحباً بك في خدمة عملاء طلبي!</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                اكتب استفسارك أو مشكلتك وسيجيب عليك أحد موظفي الدعم فوراً.
              </p>
            </div>
          ) : (
            userConv.messages.map((m) => {
              const isStaff = m.isAgent;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] ${
                    isStaff ? 'mr-auto items-end' : 'ml-auto items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isStaff
                        ? 'bg-[#172554] text-white rounded-tr-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                    }`}
                  >
                    <p>{m.text}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                    {m.senderName} • {m.timestamp}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            placeholder="اكتب رسالتك أو تفاصيل الشكوى هنا..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1 p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="px-4 py-2.5 bg-[#F47721] hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow flex items-center gap-1 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>إرسال</span>
          </button>
        </form>
      </div>
    </div>
  );
};
