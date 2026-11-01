import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Headphones, X, Send, CheckCircle2 } from 'lucide-react';

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
    startSupportConversation,
    sendSupportMessage,
    currentUser,
  } = useApp();

  const [messageText, setMessageText] = useState('');
  const [subject, setSubject] = useState(
    relatedOrderId ? `استفسار عن طلب #${relatedOrderId}` : 'استفسار عام عن خدمة طلبي'
  );

  if (!isOpen) return null;

  const myConversation = conversations.find(
    (c) => c.userId === currentUser.id && (relatedOrderId ? c.relatedOrderId === relatedOrderId : true)
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (!myConversation) {
      const convId = startSupportConversation(subject, relatedOrderId);
      sendSupportMessage(convId, messageText);
    } else {
      sendSupportMessage(myConversation.id, messageText);
    }
    setMessageText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-['Cairo',sans-serif]">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 shadow-2xl flex flex-col h-[520px] text-slate-800">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">محادثة الدعم المباشر</h3>
              <p className="text-[11px] text-slate-500">فريق خدمة عملاء طلبي بخدمتك فورياً</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!myConversation ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <p className="text-xs font-bold text-slate-600">مرحباً بك! كيف يمكننا مساعدتك اليوم؟</p>
              <p className="text-[11px]">اكتب استفسارك بالأسفل وسيبدأ موظف الدعم بمتابعة طلبك فوراً.</p>
            </div>
          ) : (
            myConversation.messages.map((m) => {
              const isMe = m.senderId === currentUser.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] ${isMe ? 'mr-auto items-end' : 'ml-auto items-start'}`}
                >
                  <span className="text-[10px] text-slate-400 mb-0.5">{m.senderName} • {m.timestamp}</span>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-[#F47721] text-white rounded-br-none shadow-xs'
                        : 'bg-slate-100 text-slate-800 rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="pt-3 border-t flex items-center gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="px-4 py-2.5 bg-[#F47721] hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <span>إرسال</span>
            <Send className="w-3.5 h-3.5 transform rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
};
