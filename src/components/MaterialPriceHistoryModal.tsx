import { FC, useState, useEffect, FormEvent } from 'react';
import { Material, PurchasePriceRecord } from '../types';
import { 
  X, 
  Tag, 
  Save, 
  Store, 
  Calendar, 
  FileText, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Building2,
  AlertCircle
} from 'lucide-react';

interface MaterialPriceHistoryModalProps {
  isOpen: boolean;
  material: Material | null;
  onClose: () => void;
  onSavePriceHistory: (material: Material) => Promise<void>;
  isAdmin?: boolean;
}

export const MaterialPriceHistoryModal: FC<MaterialPriceHistoryModalProps> = ({
  isOpen,
  material,
  onClose,
  onSavePriceHistory,
  isAdmin = true
}) => {
  // Initialize 3 slots of purchase price memory
  const [purchases, setPurchases] = useState<PurchasePriceRecord[]>([
    { date: '', unitPrice: 0, supplier: '', docNo: '' },
    { date: '', unitPrice: 0, supplier: '', docNo: '' },
    { date: '', unitPrice: 0, supplier: '', docNo: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (material) {
      const existing = material.recentPurchases || [];
      const slots: PurchasePriceRecord[] = [
        existing[0] ? { ...existing[0] } : { date: new Date().toISOString().split('T')[0], unitPrice: material.unitPrice || 0, supplier: 'ร้านค้าคู่สัญญา วก.มมส.', docNo: '' },
        existing[1] ? { ...existing[1] } : { date: '', unitPrice: 0, supplier: '', docNo: '' },
        existing[2] ? { ...existing[2] } : { date: '', unitPrice: 0, supplier: '', docNo: '' }
      ];
      setPurchases(slots);
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [material]);

  if (!isOpen || !material) return null;

  const handleSlotChange = (index: number, field: keyof PurchasePriceRecord, value: any) => {
    setPurchases(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Clean non-empty purchase records
      const cleanPurchases: PurchasePriceRecord[] = purchases
        .filter(p => (Number(p.unitPrice) > 0 || (p.supplier && p.supplier.trim().length > 0)))
        .map(p => ({
          date: p.date || new Date().toISOString().split('T')[0],
          unitPrice: Math.max(0, Number(p.unitPrice) || 0),
          supplier: (p.supplier || 'ไม่ระบุร้านค้า').trim(),
          docNo: (p.docNo || '').trim(),
          quantity: p.quantity ? Number(p.quantity) : undefined
        }))
        .slice(0, 3);

      // Latest purchase price (slot 1) becomes current unit price
      const latestPrice = cleanPurchases[0]?.unitPrice && cleanPurchases[0].unitPrice > 0 
        ? cleanPurchases[0].unitPrice 
        : material.unitPrice;

      const updatedMat: Material = {
        ...material,
        unitPrice: latestPrice,
        recentPurchases: cleanPurchases.length > 0 ? cleanPurchases : undefined,
        lastUpdated: new Date().toISOString()
      };

      await onSavePriceHistory(updatedMat);
      setSuccessMsg('บันทึกการจดจำราคาซื้อ 3 ครั้งล่าสุดเรียบร้อยแล้ว');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const slotLabels = [
    { title: 'ครั้งที่ 1 (ล่าสุด)', badge: 'ราคารับเข้าล่าสุด', color: 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20' },
    { title: 'ครั้งที่ 2', badge: 'ก่อนหน้า', color: 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/20' },
    { title: 'ครั้งที่ 3', badge: 'ย้อนหลัง', color: 'border-slate-300 bg-slate-50/50 dark:bg-slate-900/30' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col text-slate-900 dark:text-white my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-300/40 shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800">
                  {material.id}
                </span>
                <span className="text-xs text-slate-400">{material.category}</span>
              </div>
              <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-white mt-0.5">
                จดจำราคาซื้อ 3 ครั้งล่าสุด — {material.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Top Info Banner */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  บันทึกประวัติราคาซื้อ 3 ครั้งล่าสุดว่ากี่บาท ซื้อจากร้านไหน
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  ราคาต่อหน่วยทั้งหมดที่แสดงทุกหน้า จะอิงตามราคารับเข้าพัสดุล่าสุด (ครั้งที่ 1) โดยอัตโนมัติ
                </p>
              </div>
            </div>
            <div className="shrink-0 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-center">
              <span className="text-[10px] text-slate-400 block">ราคาปัจจุบันในระบบ</span>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                ฿{(material.unitPrice || 0).toLocaleString()} / {material.unit}
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 3 Purchase Price Slots */}
          <div className="space-y-3.5">
            {purchases.map((slot, index) => {
              const meta = slotLabels[index];
              return (
                <div 
                  key={index} 
                  className={`p-3.5 rounded-xl border-2 transition ${meta.color}`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700/80">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold text-xs">
                        {index + 1}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        {meta.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                      {meta.badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                    {/* ราคาต่อหน่วย (กี่บาท) */}
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ราคาต่อหน่วย (บาท) *</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        disabled={!isAdmin}
                        value={slot.unitPrice || ''}
                        onChange={e => handleSlotChange(index, 'unitPrice', Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold text-slate-900 dark:text-white"
                        required={index === 0}
                      />
                    </div>

                    {/* ซื้อจากร้านไหน */}
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-amber-600" />
                        <span>ซื้อจากร้านไหน *</span>
                      </label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={slot.supplier || ''}
                        onChange={e => handleSlotChange(index, 'supplier', e.target.value)}
                        placeholder="เช่น บจก. สารคามเครื่องเขียน"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                        required={index === 0 && Number(slot.unitPrice) > 0}
                      />
                    </div>

                    {/* วันที่ซื้อ */}
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>วันที่ซื้อ / รับเข้า</span>
                      </label>
                      <input
                        type="date"
                        disabled={!isAdmin}
                        value={slot.date || ''}
                        onChange={e => handleSlotChange(index, 'date', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* เลขที่เอกสาร / ใบสั่งซื้อ */}
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-purple-600" />
                        <span>เลขที่เอกสาร / PO</span>
                      </label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={slot.docNo || ''}
                        onChange={e => handleSlotChange(index, 'docNo', e.target.value)}
                        placeholder="เช่น PO-2568/042"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-400">
              {isAdmin ? 'คุณสามารถแก้ไขหรือปรับปรุงราคาซื้อและร้านค้าได้ตลอดเวลา' : 'ดูข้อมูลประวัติราคาซื้อ 3 ครั้งล่าสุด'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition cursor-pointer"
              >
                ปิด
              </button>

              {isAdmin && (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกราคาซื้อ 3 ครั้งล่าสุด'}</span>
                </button>
              )}
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
