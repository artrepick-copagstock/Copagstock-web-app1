import { FC, useState, useEffect, FormEvent } from 'react';
import { Order, OrderItem, Material, OrderStatus } from '../types';
import { COPAG_DEPARTMENTS } from '../mockData';
import { 
  X, 
  Save, 
  Trash2, 
  Plus, 
  AlertCircle, 
  AlertTriangle,
  Info,
  Package,
  Layers,
  Building,
  User,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';

interface EditOrderModalProps {
  isOpen: boolean;
  order: Order | null;
  materials: Material[];
  onClose: () => void;
  onSave: (orderId: string, payload: {
    docNo: string;
    date: string;
    requesterName: string;
    requesterEmail?: string;
    requesterPosition?: string;
    department: string;
    purpose: string;
    status: OrderStatus;
    items: OrderItem[];
    approverName?: string;
    approverPosition?: string;
    disburserName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const EditOrderModal: FC<EditOrderModalProps> = ({
  isOpen,
  order,
  materials,
  onClose,
  onSave
}) => {
  const [docNo, setDocNo] = useState(order?.docNo || '');
  const [date, setDate] = useState(order?.date || '');
  const [requesterName, setRequesterName] = useState(order?.requesterName || '');
  const [requesterEmail, setRequesterEmail] = useState(order?.requesterEmail || '');
  const [requesterPosition, setRequesterPosition] = useState(order?.requesterPosition || '');
  const [department, setDepartment] = useState(order?.department || '');
  const [purpose, setPurpose] = useState(order?.purpose || '');
  const [status, setStatus] = useState<OrderStatus>(order?.status || 'รอดำเนินการ');
  const [items, setItems] = useState<OrderItem[]>(() => order ? JSON.parse(JSON.stringify(order.items)) : []);

  // Add item selector state
  const [selectedMatIdToAdd, setSelectedMatIdToAdd] = useState<string>(materials[0]?.id || '');
  const [addQuantity, setAddQuantity] = useState<number>(1);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Re-sync when order changes
  useEffect(() => {
    if (order) {
      setDocNo(order.docNo || '');
      setDate(order.date || '');
      setRequesterName(order.requesterName || '');
      setRequesterEmail(order.requesterEmail || '');
      setRequesterPosition(order.requesterPosition || '');
      setDepartment(order.department || '');
      setPurpose(order.purpose || '');
      setStatus(order.status || 'รอดำเนินการ');
      setItems(order.items ? JSON.parse(JSON.stringify(order.items)) : []);
      setErrorMessage('');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  // Adjust item quantity
  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        quantity: newQty,
        totalPrice: newQty * item.unitPrice
      };
    }));
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('ใบเบิกต้องมีรายการพัสดุอย่างน้อย 1 รายการ');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Add new item to order
  const handleAddItem = () => {
    const mat = materials.find(m => m.id === selectedMatIdToAdd);
    if (!mat) return;

    if (addQuantity <= 0) {
      alert('กรุณากรอกจำนวนที่ถูกต้อง (มากกว่า 0)');
      return;
    }

    // Check if already in order
    const existingIndex = items.findIndex(i => i.materialId === mat.id);
    if (existingIndex >= 0) {
      handleUpdateItemQty(existingIndex, items[existingIndex].quantity + addQuantity);
    } else {
      const newItem: OrderItem = {
        materialId: mat.id,
        materialName: mat.name,
        category: mat.category,
        quantity: addQuantity,
        unit: mat.unit,
        unitPrice: mat.unitPrice,
        totalPrice: addQuantity * mat.unitPrice,
        currentStockSnapshot: mat.currentStock
      };
      setItems(prev => [...prev, newItem]);
    }
    setAddQuantity(1);
  };

  // Total summary
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Submit edits
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!docNo.trim()) {
      setErrorMessage('กรุณาระบุเลขที่ใบเบิก');
      return;
    }
    if (!requesterName.trim()) {
      setErrorMessage('กรุณาระบุชื่อผู้ขอเบิก');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('กรุณาระบุรายการพัสดุอย่างน้อย 1 รายการ');
      return;
    }

    try {
      setIsSaving(true);
      const res = await onSave(order.id, {
        docNo,
        date,
        requesterName,
        requesterEmail,
        requesterPosition,
        department,
        purpose,
        status,
        items
      });

      if (!res.success) {
        setErrorMessage(res.error || 'ไม่สามารถบันทึกการแก้ไขได้');
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const wasDisbursed = order.status === 'เบิกจ่ายแล้ว';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">แก้ไขใบเบิกจ่ายพัสดุ & ปรับยอดสต็อก</h3>
                <span className="px-2 py-0.5 bg-slate-700 text-amber-300 font-mono text-xs rounded-md">
                  {order.docNo}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                เจ้าหน้าที่พัสดุสามารถแก้ไขรายการ จำนวน และสถานะได้ แม้จะอนุมัติหรือเบิกจ่ายแล้ว โดยระบบจะปรับปรุงสต็อกและสมุดคุมให้อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Real-time sync explanation banner */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-bold">การปรับยอดสัมพันธ์กันทั้งระบบ: </span>
              {wasDisbursed ? (
                <span>
                  ใบเบิกนี้อยู่ในสถานะ <strong>"เบิกจ่ายแล้ว"</strong> หากปรับลด/เพิ่มจำนวน หรือเปลี่ยนสถานะเป็น <strong>"ยกเลิก" / "รออนุมัติ"</strong> ระบบจะคืนยอดคงเหลือเข้าคลังและปรับปรุงสมุดคุมพัสดุให้ตรงตามจริงทันที
                </span>
              ) : (
                <span>
                  ใบเบิกนี้ยังไม่ได้ตัดจ่ายพัสดุจริง (สถานะ: {order.status}) หากบันทึกเป็น <strong>"เบิกจ่ายแล้ว"</strong> ระบบจะตัดจ่ายพัสดุจากคลังจริงตามรายการที่ปรับใหม่
                </span>
              )}
            </div>
          </div>

          {/* Form Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                เลขที่เอกสาร
              </label>
              <input
                type="text"
                value={docNo}
                onChange={e => setDocNo(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-medium text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                วันที่ขอเบิก
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                สถานะใบเบิก (Status)
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as OrderStatus)}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-bold transition ${
                  status === 'เบิกจ่ายแล้ว'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                    : status === 'อนุมัติแล้ว'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-700 dark:text-blue-300'
                    : status === 'ยกเลิก'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-700 dark:text-rose-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-300'
                }`}
              >
                <option value="รออนุมัติ">รออนุมัติ (Pending)</option>
                <option value="อนุมัติแล้ว">อนุมัติแล้ว (Approved - ยังไม่ตัดจ่าย)</option>
                <option value="เบิกจ่ายแล้ว">เบิกจ่ายแล้ว (Disbursed - ตัดจ่ายพัสดุจริง)</option>
                <option value="ยกเลิก">ยกเลิก (Cancelled - คืนสต็อกเข้าคลัง)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                ชื่อ-สกุล ผู้ขอเบิก
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={e => setRequesterName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                หน่วยงาน / สาขาวิชา
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
              >
                {COPAG_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                ตำแหน่งผู้ขอเบิก
              </label>
              <input
                type="text"
                value={requesterPosition}
                onChange={e => setRequesterPosition(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                เพื่อนำไปใช้ในราชการงานใด (วัตถุประสงค์)
              </label>
              <input
                type="text"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="ระบุงานราชการ โครงการ หรือการเรียนการสอน..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>รายการพัสดุที่ขอเบิก ({items.length} รายการ)</span>
              </h4>
              <span className="text-xs text-slate-500">
                รวม {totalItemsCount} ชิ้น • มูลค่ารวม ฿{totalAmount.toLocaleString()}
              </span>
            </div>

            {/* Items Table / List */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">รหัสและรายการพัสดุ</th>
                      <th className="py-2.5 px-3 text-center w-28">คงเหลือในคลัง</th>
                      <th className="py-2.5 px-3 text-center w-40">จำนวนที่เบิก</th>
                      <th className="py-2.5 px-3 text-right w-24">ราคา/หน่วย</th>
                      <th className="py-2.5 px-3 text-right w-24">รวมเงิน</th>
                      <th className="py-2.5 px-3 text-center w-12">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                    {items.map((item, idx) => {
                      const mat = materials.find(m => m.id === item.materialId);
                      // If order was already disbursed, current stock in warehouse plus this item's quantity is the available headroom
                      const effectiveStock = mat 
                        ? (wasDisbursed ? mat.currentStock + (order.items.find(i => i.materialId === item.materialId)?.quantity || 0) : mat.currentStock)
                        : item.currentStockSnapshot;

                      const isExceedingStock = item.quantity > effectiveStock;

                      return (
                        <tr key={`${item.materialId}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-750">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {mat?.imageUrl ? (
                                <img 
                                  src={mat.imageUrl} 
                                  alt={item.materialName} 
                                  className="w-9 h-9 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 shrink-0"
                                  style={{ objectFit: 'contain' }}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {item.materialId}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white" style={{ fontWeight: 600 }}>
                                  {item.materialName}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                  <span className="font-mono text-amber-600 dark:text-amber-400">{item.materialId}</span>
                                  <span>•</span>
                                  <span>{item.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                              effectiveStock <= 0 
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' 
                                : effectiveStock < 5 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                              {effectiveStock} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, item.quantity - 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md font-bold text-sm cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                                className={`w-14 text-center py-1 bg-white dark:bg-slate-900 border rounded-md font-mono font-bold text-xs ${
                                  isExceedingStock
                                    ? 'border-rose-400 text-rose-600 bg-rose-50 dark:bg-rose-950/30'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, item.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md font-bold text-sm cursor-pointer"
                              >
                                +
                              </button>
                              <span className="text-slate-400 text-[11px] ml-1">{item.unit}</span>
                            </div>
                            {isExceedingStock && (
                              <p className="text-[10px] text-rose-600 text-center mt-1">
                                ยอดเบิกเกินยอดสต็อกคงเหลือ!
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            ฿{item.unitPrice.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            ฿{item.totalPrice.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition cursor-pointer"
                              title="ลบรายการนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add Item Row */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  เพิ่มพัสดุในใบเบิก:
                </span>
                <select
                  value={selectedMatIdToAdd}
                  onChange={e => setSelectedMatIdToAdd(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      [{m.id}] {m.name} (คงเหลือ: {m.currentStock} {m.unit} • ฿{m.unitPrice})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">จำนวน:</span>
                  <input
                    type="number"
                    min="1"
                    value={addQuantity}
                    onChange={e => setAddQuantity(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1.5 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มรายการ</span>
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                ยอดรวมสุทธิ: <strong className="text-slate-800 dark:text-white font-mono text-sm">{totalItemsCount}</strong> ชิ้น | <strong className="text-amber-600 dark:text-amber-400 font-mono text-sm">฿{totalAmount.toLocaleString()}</strong> บาท
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึกและปรับสต็อก...' : 'บันทึกการแก้ไข & ปรับสต็อก'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
