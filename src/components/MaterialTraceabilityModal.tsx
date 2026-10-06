import { FC, useState, useMemo } from 'react';
import { Material, StockIn, StockOut, Order } from '../types';
import { 
  X, 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  FileText, 
  Store, 
  User, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  FileSpreadsheet, 
  Tag, 
  Search,
  ExternalLink,
  DollarSign
} from 'lucide-react';

interface MaterialTraceabilityModalProps {
  isOpen: boolean;
  material: Material | null;
  stockInLogs: StockIn[];
  stockOutLogs: StockOut[];
  orders: Order[];
  onClose: () => void;
  onOpenLedger: (materialId: string) => void;
  onPreviewOrder?: (order: Order) => void;
}

export const MaterialTraceabilityModal: FC<MaterialTraceabilityModalProps> = ({
  isOpen,
  material,
  stockInLogs,
  stockOutLogs,
  orders,
  onClose,
  onOpenLedger,
  onPreviewOrder
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'stockin' | 'stockout' | 'cancellations'>('overview');
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Stock-in logs for this material (ที่มาของพัสดุ)
  const matchedInLogs = useMemo(() => {
    if (!material) return [];
    return stockInLogs
      .filter(l => l.materialId === material.id)
      .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime());
  }, [stockInLogs, material?.id]);

  // 2. Stock-out logs for this material (ที่ไปของพัสดุ)
  const matchedOutLogs = useMemo(() => {
    if (!material) return [];
    return stockOutLogs
      .filter(l => l.materialId === material.id)
      .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime());
  }, [stockOutLogs, material?.id]);

  // 3. Orders containing this material
  const matchedOrders = useMemo(() => {
    if (!material) return [];
    return orders
      .filter(o => o.items && o.items.some(i => i.materialId === material.id))
      .sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime());
  }, [orders, material?.id]);

  // 4. Cancelled orders (ประวัติการยกเลิก/คืนสต็อก)
  const cancelledOrders = useMemo(() => {
    return matchedOrders.filter(o => o.status === 'ยกเลิก');
  }, [matchedOrders]);

  if (!isOpen || !material) return null;

  // Totals
  const totalInQty = matchedInLogs.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const totalInAmount = matchedInLogs.reduce((sum, l) => sum + (l.totalPrice || l.quantity * l.unitPrice || 0), 0);
  const totalOutQty = matchedOutLogs.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const totalOutAmount = matchedOutLogs.reduce((sum, l) => sum + (l.totalPrice || l.quantity * l.unitPrice || 0), 0);

  // Recent 3 purchases
  const recentPurchases = material.recentPurchases || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col text-slate-900 dark:text-white my-auto max-h-[94vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/90 dark:bg-slate-900/70 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-sm font-mono shrink-0 shadow-xs">
              {material.id}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  {material.category}
                </span>
                <span className="text-xs text-slate-400">หน่วยนับ: {material.unit}</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  ราคาล่าสุด: ฿{(material.unitPrice || 0).toLocaleString()}
                </span>
              </div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white mt-0.5">
                ความสัมพันธ์และที่มาที่ไปของพัสดุ — {material.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLedger(material.id);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>เปิดสมุดคุม (Stock Card)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-900/40 px-4 pt-2 gap-1 sm:gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ภาพรวมและความสัมพันธ์</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stockin')}
            className={`px-3 py-2 font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'stockin'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>ที่มา: รับเข้า ({matchedInLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stockout')}
            className={`px-3 py-2 font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'stockout'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            <span>ที่ไป: เบิกจ่าย ({matchedOutLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancellations')}
            className={`px-3 py-2 font-bold rounded-t-lg transition flex items-center gap-1.5 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'cancellations'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            <span>ยกเลิก / ปรับปรุง ({cancelledOrders.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px]">คงเหลือปัจจุบัน</span>
                  <div className="font-bold text-base sm:text-lg text-slate-900 dark:text-white mt-0.5">
                    <span className={material.currentStock === 0 ? 'text-rose-600' : 'text-amber-600'}>
                      {material.currentStock}
                    </span>{' '}
                    <span className="text-xs font-normal text-slate-400">{material.unit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    จุดปลอดภัย: {material.minQty} - {material.maxQty} {material.unit}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">ราคารับเข้าล่าสุด</span>
                  <div className="font-bold text-base sm:text-lg text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                    ฿{(material.unitPrice || 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
                    ร้าน: {recentPurchases[0]?.supplier || 'ร้านค้าคู่สัญญา วก.มมส.'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px]">รับเข้าสะสมทั้งหมด</span>
                  <div className="font-bold text-base sm:text-lg text-slate-900 dark:text-white font-mono mt-0.5">
                    +{totalInQty} <span className="text-xs font-normal text-slate-400">{material.unit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                    รวม ฿{totalInAmount.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block text-[11px]">เบิกจ่ายสะสมทั้งหมด</span>
                  <div className="font-bold text-base sm:text-lg text-slate-900 dark:text-white font-mono mt-0.5">
                    -{totalOutQty} <span className="text-xs font-normal text-slate-400">{material.unit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                    รวม ฿{totalOutAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 3 Recent Purchases Card */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      การจดจำราคาซื้อ 3 ครั้งล่าสุด (กี่บาท ซื้อจากร้านไหน)
                    </h4>
                  </div>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    อิงตามราคารับเข้าพัสดุล่าสุด
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {[0, 1, 2].map(idx => {
                    const record = recentPurchases[idx];
                    const isLatest = idx === 0;
                    return (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          isLatest 
                            ? 'bg-white dark:bg-slate-800 border-amber-300 dark:border-amber-700 shadow-2xs' 
                            : 'bg-white/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                            {idx === 0 ? 'ครั้งที่ 1 (ล่าสุด)' : idx === 1 ? 'ครั้งที่ 2' : 'ครั้งที่ 3'}
                          </span>
                          {record && (
                            <span className="text-[10px] text-slate-400">{record.date}</span>
                          )}
                        </div>
                        {record && record.unitPrice > 0 ? (
                          <>
                            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                              ฿{record.unitPrice.toLocaleString()}{' '}
                              <span className="text-[11px] font-normal text-slate-400">/ {material.unit}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1 truncate" title={record.supplier}>
                              <Store className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">{record.supplier || 'ไม่ระบุร้านค้า'}</span>
                            </div>
                            {record.docNo && (
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                                PO/เอกสาร: {record.docNo}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-slate-400 italic text-[11px] py-2 text-center">
                            ยังไม่มีข้อมูลในรอบนี้
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Flow & Traceability Explanation */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>ความเชื่อมโยงของข้อมูลในระบบพัสดุ วก.มมส.</span>
                </h4>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300 pl-4 list-disc text-[11.5px] leading-relaxed">
                  <li><strong>ที่มา (การรับเข้า):</strong> เมื่อพัสดุถูกรับเข้าทางหน้า "รับเข้าพัสดุ" หรือ "สมุดคุม" ระบบจะบันทึกเลขที่เอกสาร ร้านค้า วันที่ และอัปเดตราคาต่อหน่วยเป็นราคารับเข้าล่าสุดทันที</li>
                  <li><strong>ที่ไป (การเบิกจ่าย):</strong> เมื่อผู้ใช้ยื่นใบเบิกและได้รับการอนุมัติจนตัดจ่ายแล้ว ยอดจะถูกหักออกจากคลังและบันทึกตัดจ่ายไปยังผู้ขอเบิกในสมุดคุมอัตโนมัติ</li>
                  <li><strong>การยกเลิก/แก้ไข:</strong> หากมีการยกเลิกใบเบิก ระบบจะคืนยอดสต็อกกลับเข้าสู่คลังทันที โดยยอดรวมและสมุดคุมจะเชื่อมโยงกันอย่างโปร่งใสและถูกต้องตามความเป็นจริง 100%</li>
                </ul>
              </div>

            </div>
          )}

          {/* TAB 2: STOCK IN (ที่มาของพัสดุ) */}
          {activeTab === 'stockin' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ประวัติการรับเข้าทั้งหมด {matchedInLogs.length} รายการ</span>
                <span className="font-mono text-emerald-600 font-bold">ยอดรับสะสม +{totalInQty} {material.unit}</span>
              </div>

              {matchedInLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  ยังไม่มีประวัติการรับเข้าพัสดุรายการนี้ในระบบ
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                        <th className="py-2.5 px-3">วันที่</th>
                        <th className="py-2.5 px-3">เลขที่เอกสาร / PO</th>
                        <th className="py-2.5 px-3">ร้านค้า / ผู้จัดจำหน่าย</th>
                        <th className="py-2.5 px-3 text-center">ประเภทงบ</th>
                        <th className="py-2.5 px-3 text-center">จำนวนรับ</th>
                        <th className="py-2.5 px-3 text-right">ราคา/หน่วย</th>
                        <th className="py-2.5 px-3 text-right">มูลค่ารวม</th>
                        <th className="py-2.5 px-3">ผู้รับพัสดุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {matchedInLogs.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-750 transition">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono">
                            {item.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                            <div>{item.docNo}</div>
                            {item.obligationNo && (
                              <div className="text-[10px] text-slate-400 font-normal">ผูกพัน: {item.obligationNo}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.supplier || 'ไม่ระบุร้านค้า'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {item.budgetType || 'เงินราย'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-600 font-mono">
                            +{item.quantity} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            ฿{(item.unitPrice || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            ฿{(item.totalPrice || item.quantity * item.unitPrice || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {item.receiverName || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STOCK OUT / REQUISITIONS (ที่ไปของพัสดุ) */}
          {activeTab === 'stockout' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ประวัติคำขอเบิกจ่าย {matchedOrders.length} รายการ (ตัดจ่ายจริง {matchedOutLogs.length} รายการ)</span>
                <span className="font-mono text-rose-600 font-bold">ยอดจ่ายสะสม -{totalOutQty} {material.unit}</span>
              </div>

              {matchedOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  ยังไม่มีประวัติการขอเบิกจ่ายพัสดุรายการนี้
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                        <th className="py-2.5 px-3">วันที่</th>
                        <th className="py-2.5 px-3">เลขที่ใบเบิก</th>
                        <th className="py-2.5 px-3">ผู้ขอเบิก / สังกัด</th>
                        <th className="py-2.5 px-3">วัตถุประสงค์</th>
                        <th className="py-2.5 px-3 text-center">จำนวนขอเบิก</th>
                        <th className="py-2.5 px-3 text-center">สถานะ</th>
                        <th className="py-2.5 px-3 text-center">การดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {matchedOrders.map(order => {
                        const orderItem = order.items.find(i => i.materialId === material.id);
                        const isDisbursed = order.status === 'เบิกจ่ายแล้ว';
                        const isCancelled = order.status === 'ยกเลิก';

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-750 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono">
                              {order.date}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                              {order.docNo}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{order.requesterName}</div>
                              <div className="text-[10px] text-slate-400">{order.department} ({order.requesterPosition})</div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={order.purpose}>
                              {order.purpose}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold font-mono">
                              <span className={isDisbursed ? 'text-rose-600' : isCancelled ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}>
                                {orderItem?.quantity || 0} {material.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDisbursed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : isCancelled
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : order.status === 'อนุมัติแล้ว'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {isCancelled ? 'ยกเลิก (คืนสต็อก)' : order.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {onPreviewOrder && (
                                <button
                                  type="button"
                                  onClick={() => onPreviewOrder(order)}
                                  className="p-1 text-slate-500 hover:text-amber-600 transition cursor-pointer inline-flex items-center gap-1 text-[11px]"
                                  title="ดูใบเบิกทางการ (Official PDF)"
                                >
                                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                                  <span>พิมพ์</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CANCELLATIONS & ADJUSTMENTS */}
          {activeTab === 'cancellations' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ประวัติรายการที่ถูกยกเลิกและคืนสต็อก ({cancelledOrders.length} รายการ)</span>
              </div>

              {cancelledOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  ไม่มีประวัติการยกเลิกหรือคืนสต็อกสำหรับพัสดุรายการนี้
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cancelledOrders.map(order => {
                    const item = order.items.find(i => i.materialId === material.id);
                    return (
                      <div 
                        key={order.id}
                        className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <RotateCcw className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-rose-800 dark:text-rose-300">
                                {order.docNo}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-500">{order.date}</span>
                              <span className="px-2 py-0.2 bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 font-bold rounded-full text-[10px]">
                                ยกเลิก / คืนสต็อกแล้ว
                              </span>
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 mt-1">
                              ผู้ขอเบิก: <strong>{order.requesterName}</strong> ({order.department}) • วัตถุประสงค์: {order.purpose}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
                          <span className="text-[10px] text-slate-400 block">คืนสต็อกเข้าคลัง</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{item?.quantity || 0} {material.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between rounded-b-2xl text-xs">
          <span className="text-slate-400">
            ระบบสารสนเทศคลังพัสดุ วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
