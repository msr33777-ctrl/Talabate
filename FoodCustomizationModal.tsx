import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, AlertCircle, ShoppingBag } from 'lucide-react';
import { Product, ProductOptionGroup, ProductOptionItem } from '../../types';

interface FoodCustomizationModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    selectedOptionGroups: {
      groupTitle: string;
      selectedItems: { name: string; price: number }[];
    }[],
    notes: string
  ) => void;
}

export const FoodCustomizationModal: React.FC<FoodCustomizationModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  // Selected option map: { [groupId]: Set of optionIds }
  const [selectedOptions, setSelectedOptions] = useState<{ [groupId: string]: string[] }>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize defaults on open or product change
  useEffect(() => {
    if (!isOpen || !product) return;
    setQuantity(1);
    setNotes('');
    setValidationError(null);

    const initialSelections: { [groupId: string]: string[] } = {};

    if (product.optionGroups && product.optionGroups.length > 0) {
      product.optionGroups.forEach((grp) => {
        // Find default or first if required
        const defaultOpt = grp.options.find((o) => o.isDefault);
        if (defaultOpt) {
          initialSelections[grp.id] = [defaultOpt.id];
        } else if (grp.isRequired && grp.options.length > 0) {
          initialSelections[grp.id] = [grp.options[0].id];
        } else {
          initialSelections[grp.id] = [];
        }
      });
    } else if (product.options && product.options.length > 0) {
      // Legacy simple options fallback
      initialSelections['legacy'] = [];
    }

    setSelectedOptions(initialSelections);
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  // Toggle or select option
  const handleSelectOption = (group: ProductOptionGroup, option: ProductOptionItem) => {
    setSelectedOptions((prev) => {
      const current = prev[group.id] || [];
      const isRadio = group.maxSelect === 1;

      if (isRadio) {
        return {
          ...prev,
          [group.id]: [option.id],
        };
      }

      // Checkbox multi-select
      const isAlreadySelected = current.includes(option.id);
      if (isAlreadySelected) {
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== option.id),
        };
      }

      // Check max limit
      const maxAllowed = group.maxSelect || 99;
      if (current.length >= maxAllowed) {
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...current, option.id],
      };
    });
    setValidationError(null);
  };

  // Toggle legacy options
  const handleToggleLegacyOption = (optionId: string) => {
    setSelectedOptions((prev) => {
      const current = prev['legacy'] || [];
      return {
        ...prev,
        legacy: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  };

  // Calculate extra price from selections
  let extraPrice = 0;
  if (product.optionGroups && product.optionGroups.length > 0) {
    product.optionGroups.forEach((grp) => {
      const selectedIds = selectedOptions[grp.id] || [];
      selectedIds.forEach((optId) => {
        const item = grp.options.find((o) => o.id === optId);
        if (item) extraPrice += item.price;
      });
    });
  } else if (product.options && product.options.length > 0) {
    const legacySelected = selectedOptions['legacy'] || [];
    legacySelected.forEach((optId) => {
      const item = product.options?.find((o) => o.id === optId);
      if (item) extraPrice += item.price;
    });
  }

  const unitPrice = product.price + extraPrice;
  const totalPrice = unitPrice * quantity;

  // Handle final add
  const handleConfirm = () => {
    // Validate required groups
    if (product.optionGroups && product.optionGroups.length > 0) {
      for (const grp of product.optionGroups) {
        const selected = selectedOptions[grp.id] || [];
        if (grp.isRequired && selected.length === 0) {
          setValidationError(`يرجى تحديد اختيار لمجموعة: ${grp.title}`);
          return;
        }
        if (grp.minSelect && selected.length < grp.minSelect) {
          setValidationError(`يرجى اختيار ما لا يقل عن ${grp.minSelect} في: ${grp.title}`);
          return;
        }
      }
    }

    // Format selected groups
    const formattedGroups: {
      groupTitle: string;
      selectedItems: { name: string; price: number }[];
    }[] = [];

    if (product.optionGroups && product.optionGroups.length > 0) {
      product.optionGroups.forEach((grp) => {
        const selectedIds = selectedOptions[grp.id] || [];
        if (selectedIds.length > 0) {
          const items = grp.options
            .filter((o) => selectedIds.includes(o.id))
            .map((o) => ({ name: o.name, price: o.price }));
          formattedGroups.push({
            groupTitle: grp.title,
            selectedItems: items,
          });
        }
      });
    } else if (product.options && product.options.length > 0) {
      const legacySelected = selectedOptions['legacy'] || [];
      if (legacySelected.length > 0) {
        const items = product.options
          .filter((o) => legacySelected.includes(o.id))
          .map((o) => ({ name: o.name, price: o.price }));
        formattedGroups.push({
          groupTitle: 'إضافات مفضلة',
          selectedItems: items,
        });
      }
    }

    onAddToCart(product, quantity, formattedGroups, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100"
        dir="rtl"
      >
        {/* Header Cover / Close */}
        <div className="relative">
          <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            <button
              onClick={onClose}
              className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 flex items-center justify-center shadow-md transition-all active:scale-95"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="absolute bottom-3 right-4 left-4 text-white">
              <span className="text-xs bg-[#F47721] text-white px-2 py-0.5 rounded-full font-medium mb-1 inline-block">
                {product.category}
              </span>
              <h3 className="text-lg font-bold text-white drop-shadow-sm leading-tight">
                {product.name}
              </h3>
              <p className="text-xs text-white/90 font-medium">
                يبدأ من {product.price.toLocaleString()} د.ع
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Options Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {product.description && (
            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              {product.description}
            </p>
          )}

          {/* Validation Error Alert */}
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Option Groups */}
          {product.optionGroups && product.optionGroups.length > 0 ? (
            product.optionGroups.map((grp) => {
              const selectedIds = selectedOptions[grp.id] || [];
              const isRadio = grp.maxSelect === 1;

              return (
                <div key={grp.id} className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{grp.title}</h4>
                      <p className="text-[11px] text-slate-400">
                        {isRadio ? 'اختر خياراً واحداً' : grp.maxSelect ? `اختر حتى ${grp.maxSelect}` : 'اختياري'}
                      </p>
                    </div>
                    {grp.isRequired ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        مطلوب
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-200/70 text-slate-600 font-medium px-2 py-0.5 rounded-full">
                        اختياري
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {grp.options.map((opt) => {
                      const isSelected = selectedIds.includes(opt.id);

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(grp, opt)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all border ${
                            isSelected
                              ? 'bg-orange-50 border-[#F47721] text-slate-900 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-[#F47721] border-[#F47721] text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="font-medium text-right">{opt.name}</span>
                          </div>

                          <span className={`font-semibold ${opt.price > 0 ? 'text-[#F47721]' : 'text-slate-400'}`}>
                            {opt.price > 0 ? `+${opt.price.toLocaleString()} د.ع` : 'مجاناً'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : product.options && product.options.length > 0 ? (
            /* Legacy Options List */
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-sm">إضافات وتفضيلات الوجبة</h4>
                <span className="text-[10px] bg-slate-200/70 text-slate-600 font-medium px-2 py-0.5 rounded-full">
                  اختياري
                </span>
              </div>
              <div className="space-y-1.5">
                {product.options.map((opt) => {
                  const isSelected = (selectedOptions['legacy'] || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleLegacyOption(opt.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all border ${
                        isSelected
                          ? 'bg-orange-50 border-[#F47721] text-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-[#F47721] border-[#F47721] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span className="font-medium text-right">{opt.name}</span>
                      </div>
                      <span className="font-semibold text-[#F47721]">
                        +{opt.price.toLocaleString()} د.ع
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Notes for Chef / Store */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ملاحظات أو طلبات خاصة للمطبخ
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: بدون بصل، صوص زيادة ع الجانب..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#F47721] text-slate-800"
            />
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-3">
          <div className="flex items-center justify-between">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-40"
                disabled={quantity <= 1}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold text-sm text-slate-800 w-5 text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Price Preview */}
            <div className="text-left">
              <span className="text-[10px] text-slate-400 block">المجموع الإجمالي</span>
              <span className="font-extrabold text-base text-[#172554]">
                {totalPrice.toLocaleString()} د.ع
              </span>
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 bg-[#F47721] hover:bg-[#e06816] active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>إضافة إلى السلة ({totalPrice.toLocaleString()} د.ع)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
