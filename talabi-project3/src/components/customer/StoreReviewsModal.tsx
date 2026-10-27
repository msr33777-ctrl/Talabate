import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Store, OrderRating } from '../../types';
import {
  Star,
  X,
  CheckCircle2,
  ThumbsUp,
  MessageSquare,
  ShieldCheck,
  Bike,
  Sparkles,
} from 'lucide-react';

interface StoreReviewsModalProps {
  store: Store;
  isOpen: boolean;
  onClose: () => void;
}

export const StoreReviewsModal: React.FC<StoreReviewsModalProps> = ({
  store,
  isOpen,
  onClose,
}) => {
  const { getStoreRatings } = useApp();
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);

  if (!isOpen) return null;

  const storeRatings = getStoreRatings(store.id);

  // Filter ratings
  const filteredRatings = selectedStarFilter
    ? storeRatings.filter((r) => r.storeRating === selectedStarFilter)
    : storeRatings;

  // Rating distribution calculations
  const totalCount = storeRatings.length;
  const countPerStar: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  storeRatings.forEach((r) => {
    if (countPerStar[r.storeRating] !== undefined) {
      countPerStar[r.storeRating]++;
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col my-auto text-slate-800">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={store.logo}
              alt={store.name}
              className="w-10 h-10 rounded-2xl object-cover border border-slate-200"
            />
            <div>
              <h3 className="font-extrabold text-base text-[#172554]">{store.name}</h3>
              <p className="text-[11px] text-slate-400">آراء وتقييمات زبائن طلبي الموثقة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Rating Summary Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-3xl p-5 border border-amber-200/80 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center sm:text-right shrink-0">
              <span className="text-4xl font-black text-[#172554] block">{store.rating}</span>
              <div className="flex items-center justify-center sm:justify-start gap-1 text-amber-500 my-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(store.rating) ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500 font-bold block">
                مبني على {store.ratingCount || totalCount} تقييم حقيقي
              </span>
            </div>

            {/* Bars */}
            <div className="flex-1 w-full space-y-1.5 text-xs">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = countPerStar[stars] || 0;
                const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="w-8 text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      {stars} <Star className="w-3 h-3 fill-amber-500 text-amber-500 inline" />
                    </span>
                    <div className="flex-1 h-2 bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <span className="w-6 text-[10px] text-slate-400 text-left">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedStarFilter(null)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap ${
                selectedStarFilter === null
                  ? 'bg-[#172554] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              جميع التقييمات ({storeRatings.length})
            </button>
            {[5, 4, 3, 2, 1].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStarFilter(s === selectedStarFilter ? null : s)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-colors whitespace-nowrap ${
                  selectedStarFilter === s
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{s}</span>
                <Star className={`w-3 h-3 ${selectedStarFilter === s ? 'fill-white' : 'fill-amber-500 text-amber-500'}`} />
                <span>({countPerStar[s] || 0})</span>
              </button>
            ))}
          </div>

          {/* Reviews List */}
          <div className="space-y-3">
            {filteredRatings.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">لا توجد تقييمات مطابقة لهذا الفلتر بعد.</p>
              </div>
            ) : (
              filteredRatings.map((review) => (
                <div
                  key={review.id}
                  className="bg-white border border-slate-100 rounded-2xl p-4 shadow-2xs space-y-2.5 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center">
                        {review.customerName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-slate-900">{review.customerName}</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            طلب موثق
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{review.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <span className="text-xs font-black ml-1">{review.storeRating}</span>
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < review.storeRating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Compliment Tags */}
                  {review.storeTags && review.storeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {review.storeTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-orange-50 text-orange-800 px-2 py-0.5 rounded-md font-bold border border-orange-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Comment */}
                  {review.storeComment && (
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      "{review.storeComment}"
                    </p>
                  )}

                  {/* Courier Note if rated together */}
                  {review.courierName && review.courierRating && (
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Bike className="w-3.5 h-3.5 text-slate-400" />
                        الكابتن: <strong className="text-slate-700">{review.courierName}</strong>
                      </span>
                      <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {review.courierRating} نجوم
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
