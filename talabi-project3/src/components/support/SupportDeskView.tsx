import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CANNED_SUPPORT_RESPONSES } from '../../data/initialData';
import {
  Headphones,
  Search,
  Send,
  User,
  Bike,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  MessageSquare,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export const SupportDeskView: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    sendSupportMessage,
    updateConversationStatus,
    setActiveTrackedOrderId,
    setRole,
  } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'customer' | 'courier' | 'open'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');

  const currentConv = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.relatedOrderId && c.relatedOrderId.includes(searchQuery));
    if (!matchesSearch) return false;

    if (filterType === 'customer') return c.userRole === 'customer';
    if (filterType === 'courier') return c.userRole === 'courier';
    if (filterType === 'open') return c.status === 'open';
    return true;
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentConv) return;
    sendSupportMessage(currentConv.id, inputText.trim());
    setInputText('');
  };

  const handleUseCanned = (phrase: string) => {
    if (!currentConv) return;
    sendSupportMessage(currentConv.id, phrase);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 text-slate-800">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#172554] to-slate-900 text-white rounded-3xl p-5 mb-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-lg text-white">مركز خدمة العملاء والدعم الفني المباشر</h2>
            <p className="text-xs text-slate-300">محادثات الدعم الفوري للزبائن ومناديب التوصيل في العراق</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
            النظام يعمل بكفاءة 100%
          </span>
        </div>
      </div>

      {/* Main Support Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* Left / Inbox Column (5 cols) */}
        <div className="md:col-span-5 border-l border-slate-200 flex flex-col bg-slate-50/60">
          {/* Search & Filter */}
          <div className="p-3.5 border-b border-slate-200 space-y-2 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث بالاسم، الموضوع، أو رقم الطلب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  filterType === 'all' ? 'bg-[#172554] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل ({conversations.length})
              </button>
              <button
                onClick={() => setFilterType('open')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  filterType === 'open' ? 'bg-[#172554] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                مفتوحة ({conversations.filter((c) => c.status === 'open').length})
              </button>
              <button
                onClick={() => setFilterType('customer')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  filterType === 'customer' ? 'bg-[#172554] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الزبائن
              </button>
              <button
                onClick={() => setFilterType('courier')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  filterType === 'courier' ? 'bg-[#172554] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                المناديب
              </button>
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">لا توجد محادثات تطابق البحث</p>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = currentConv?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveConversationId(c.id)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-50/80 border-r-4 border-r-orange-500'
                        : 'hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            c.userRole === 'courier'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {c.userRole === 'courier' ? <Bike className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{c.userName}</h4>
                          <span className="text-[10px] text-slate-400">{c.userPhone}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">{c.lastUpdated}</span>
                    </div>

                    <p className="text-xs font-semibold text-slate-700 mt-1 line-clamp-1">
                      {c.subject}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {c.lastMessage}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1">
                      {c.relatedOrderId ? (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100/60 px-1.5 py-0.2 rounded">
                          طلب #{c.relatedOrderId}
                        </span>
                      ) : (
                        <span></span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          c.status === 'open'
                            ? 'bg-amber-100 text-amber-800'
                            : c.status === 'pending'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {c.status === 'open' ? 'تذكرة مفتوحة' : c.status === 'pending' ? 'قيد المتابعة' : 'تم الحل'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right / Chat Thread Column (7 cols) */}
        {currentConv ? (
          <div className="md:col-span-7 flex flex-col bg-white">
            {/* Chat Header */}
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                    currentConv.userRole === 'courier'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {currentConv.userRole === 'courier' ? <Bike className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-xs text-slate-900">{currentConv.userName}</h3>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 rounded font-semibold">
                      {currentConv.userRole === 'courier' ? 'مندوب' : 'زبون'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{currentConv.subject}</p>
                </div>
              </div>

              {/* Action buttons: Resolve / View Order */}
              <div className="flex items-center gap-2">
                {currentConv.relatedOrderId && (
                  <button
                    onClick={() => {
                      setActiveTrackedOrderId(currentConv.relatedOrderId!);
                      setRole('customer');
                    }}
                    className="p-1.5 text-xs text-orange-600 hover:bg-orange-50 rounded-lg flex items-center gap-1 font-bold border border-orange-200"
                    title="معاينة الطلب المتعلق بالتذكرة"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>الطلب #{currentConv.relatedOrderId}</span>
                  </button>
                )}

                <button
                  onClick={() =>
                    updateConversationStatus(
                      currentConv.id,
                      currentConv.status === 'resolved' ? 'open' : 'resolved'
                    )
                  }
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1 transition-colors ${
                    currentConv.status === 'resolved'
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{currentConv.status === 'resolved' ? 'إعادة فتح' : 'إغلاق وحل المشكلة'}</span>
                </button>
              </div>
            </div>

            {/* Messages body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f8fafc]/50">
              {currentConv.messages.map((m) => {
                const isStaff = m.isAgent;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[80%] ${
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
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                      <span>{m.senderName}</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Canned Quick Responses */}
            <div className="px-4 py-2 border-t border-slate-100 bg-white">
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1 scrollbar-none">
                <span className="text-slate-400 font-bold shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-orange-500" />
                  ردود جاهزة:
                </span>
                {CANNED_SUPPORT_RESPONSES.map((resp, i) => (
                  <button
                    key={i}
                    onClick={() => handleUseCanned(resp)}
                    className="bg-slate-100 hover:bg-orange-50 hover:text-orange-900 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap text-[10px] font-medium transition-colors"
                  >
                    {resp}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <input
                type="text"
                placeholder="اكتب ردك للعميل أو الكابتن هنا..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2.5 bg-[#F47721] hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow flex items-center gap-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="md:col-span-7 flex items-center justify-center text-slate-400 text-xs p-8">
            اختر محادثة لعرض التفاصيل
          </div>
        )}
      </div>
    </div>
  );
};
