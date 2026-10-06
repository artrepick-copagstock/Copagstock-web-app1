import { FC, useState } from 'react';
import { Order, OrderStatus, AppUser, Material } from '../types';
import { 
  ClipboardList, 
  Search, 
  FileText, 
  CheckCircle, 
  PackageCheck, 
  XCircle, 
  Calendar, 
  User, 
  Building,
  Eye,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Edit3,
  Trash2,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { EditOrderModal } from './EditOrderModal';
import { exportOrdersToExcel, exportSingleRequisitionToExcel } from '../utils/excelExport';

interface OrdersListViewProps {
  orders: Order[];
  materials: Material[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<{ success: boolean; error?: string }>;
  onEditOrder: (orderId: string, payload: any) => Promise<{ success: boolean; error?: string }>;
  onDeleteOrder: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  onPreviewOfficialDocument: (order: Order) => void;
  currentUser?: AppUser | null;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string;
  confirmText: string;
  confirmVariant: 'danger' | 'warning' | 'primary' | 'success';
  onConfirm: () => Promise<void>;
}

// Helper: match an order strictly to a user (by email or full/partial name)
export function isUserOrder(order: Order, user: AppUser | null | undefined): boolean {
  if (!user) return false;
  const userEmail = (user.email || '').trim().toLowerCase();
  const userName = (user.name || '').trim().toLowerCase();

  const orderEmail = (order.requesterEmail || '').trim().toLowerCase();
  const orderName = (order.requesterName || '').trim().toLowerCase();

  if (userEmail && orderEmail && userEmail === orderEmail) {
    return true;
  }
  if (userName && orderName) {
    if (orderName.includes(userName) || userName.includes(orderName)) {
      return true;
    }
  }
  return false;
}

export const OrdersListView: FC<OrdersListViewProps> = ({
  orders,
  materials,
  onUpdateOrderStatus,
  onEditOrder,
  onDeleteOrder,
  onPreviewOfficialDocument,
  currentUser
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [selectedStatus, setSelectedStatus] = useState<string>('ทั้งหมด');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterOnlyMyOrders, setFilterOnlyMyOrders] = useState<boolean>(false);

  // In-app confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'ยืนยัน',
    confirmVariant: 'primary',
    onConfirm: async () => {}
  });

  // Base orders: if user is not admin, strictly show ONLY their own orders
  const baseOrders = isAdmin
    ? (filterOnlyMyOrders ? orders.filter(o => isUserOrder(o, currentUser)) : orders)
    : orders.filter(o => isUserOrder(o, currentUser));

  // Filters by status and search query
  const filteredOrders = baseOrders.filter(o => {
    const matchStatus = selectedStatus === 'ทั้งหมด' || o.status === selectedStatus;
    const matchSearch = 
      o.docNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setActionError('');
    setIsProcessing(true);
    try {
      const res = await onUpdateOrderStatus(orderId, newStatus);
      if (!res.success && res.error) {
        setActionError(res.error);
      } else {
        if (selectedOrderForDetail && selectedOrderForDetail.id === orderId) {
          setSelectedOrderForDetail(prev => prev ? { ...prev, status: newStatus } : null);
        }
        if (newStatus === 'ยกเลิก') {
          setActionSuccess(`ยกเลิกใบเบิกและคืนพัสดุเข้าคลังเรียบร้อยแล้ว`);
        } else if (newStatus === 'เบิกจ่ายแล้ว') {
          setActionSuccess(`ตัดจ่ายพัสดุและบันทึกตัดจ่ายในสมุดคุมเรียบร้อยแล้ว`);
        } else if (newStatus === 'อนุมัติแล้ว') {
          setActionSuccess(`อนุมัติคำขอเบิกพัสดุเรียบร้อยแล้ว`);
        } else {
          setActionSuccess(`ปรับปรุงสถานะเป็น "${newStatus}" เรียบร้อยแล้ว`);
        }
        setTimeout(() => setActionSuccess(''), 4500);
      }
    } finally {
      setIsProcessing(false);
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setActionError('');
    setIsProcessing(true);
    try {
      const res = await onDeleteOrder(orderId);
      if (!res.success && res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess('ลบใบเบิกจ่ายที่ยกเลิกออกจากระบบเรียบร้อยแล้ว');
        setTimeout(() => setActionSuccess(''), 4500);
        if (selectedOrderForDetail?.id === orderId) {
          setSelectedOrderForDetail(null);
        }
      }
    } finally {
      setIsProcessing(false);
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-amber-500" />
            {isAdmin ? 'รายการคำขอเบิกวัสดุพัสดุ' : 'ติดตามใบเบิกของฉัน'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAdmin 
              ? 'ระบบตรวจสอบ อนุมัติ ตัดจ่าย และจัดการใบเบิกพัสดุทั้งหมดของวิทยาลัย'
              : `แสดงเฉพาะคำขอเบิกพัสดุของคุณ (${currentUser?.name || 'ผู้ขอเบิก'})`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportOrdersToExcel(filteredOrders.length > 0 ? filteredOrders : baseOrders)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="ส่งออกรายงานใบเบิกจ่ายพัสดุและรายการที่เบิกเป็นไฟล์ Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ส่งออก Excel</span>
          </button>
          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            พบ {filteredOrders.length} จาก {baseOrders.length} รายการ
          </span>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ใบเบิก, ผู้ขอเบิก, สาขา..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* Status Pills and My Orders toggle */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {isAdmin && currentUser && (
            <button
              onClick={() => setFilterOnlyMyOrders(!filterOnlyMyOrders)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                filterOnlyMyOrders
                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>เฉพาะของฉัน</span>
            </button>
          )}

          {['ทั้งหมด', 'รออนุมัติ', 'อนุมัติแล้ว', 'เบิกจ่ายแล้ว', 'ยกเลิก'].map(status => {
            const count = status === 'ทั้งหมด' ? baseOrders.length : baseOrders.filter(o => o.status === status).length;
            const isSelected = selectedStatus === status;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected 
                    ? 'bg-amber-600 text-white shadow-xs' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>{status}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-amber-800 text-amber-100' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List Cards / Table */}
      <div className="space-y-3">
        {filteredOrders.map(order => {
          const isPending = order.status === 'รออนุมัติ';
          const isApproved = order.status === 'อนุมัติแล้ว';
          const isDisbursed = order.status === 'เบิกจ่ายแล้ว';
          const isCancelled = order.status === 'ยกเลิก';

          return (
            <div
              key={order.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:border-amber-400/80 transition space-y-3"
            >
              {/* Order Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                        {order.docNo}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {order.date}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {order.requesterName} ({order.requesterPosition})
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500 font-normal">
                        {order.department}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="self-start sm:self-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                    isDisbursed 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : isApproved
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : isPending
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : isCancelled
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    <span>{isCancelled ? 'ยกเลิก / คืนสต็อกแล้ว' : order.status}</span>
                  </span>
                </div>
              </div>

              {/* Cancelled Notice Banner */}
              {isCancelled && (
                <div className="text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 p-2.5 rounded-xl flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>รายการใบเบิกนี้ถูกยกเลิกแล้ว โดยระบบได้คืนยอดพัสดุ ({order.totalItems} รายการ) กลับเข้าสู่สต็อกคลังและปรับปรุงสมุดคุมให้เรียบร้อยแล้ว</span>
                </div>
              )}

              {/* Purpose & Details */}
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                <span className="font-semibold text-slate-700 dark:text-slate-200">วัตถุประสงค์: </span>
                <span>{order.purpose}</span>
              </div>

              {/* Items preview preview chips */}
              <div className="flex flex-wrap gap-1.5">
                {order.items.map((item, idx) => (
                  <span 
                    key={idx} 
                    className="px-2.5 py-1 rounded-lg text-slate-800"
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      backgroundColor: '#ebf7d8'
                    }}
                  >
                    {item.materialName} ({item.quantity} {item.unit})
                  </span>
                ))}
              </div>

              {/* Footer Row: Summary and Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/80 text-xs">
                <div className="text-slate-500">
                  รวม <strong className="text-slate-800 dark:text-white font-bold">{order.totalItems} หน่วย</strong> (ประมาณการมูลค่า: <strong className="font-mono text-amber-600 font-bold">฿{(order.totalAmount || 0).toLocaleString()}</strong> บาท)
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Preview PDF */}
                  <button
                    onClick={() => onPreviewOfficialDocument(order)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    <span>พิมพ์ใบเบิก (PDF)</span>
                  </button>

                  {/* Export Single Order to Excel */}
                  <button
                    onClick={() => exportSingleRequisitionToExcel(order)}
                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/70 font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer text-xs"
                    title="ส่งออกใบเบิกนี้เป็นไฟล์ Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Excel</span>
                  </button>

                  {/* Workflow Transitions */}
                  {isAdmin ? (
                    <>
                      {/* Admin Edit / Adjust Button - available across all statuses */}
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/70 font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs"
                        title="แก้ไขข้อมูล ปรับยอดพัสดุ หรือเปลี่ยนสถานะ"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>แก้ไข / ปรับยอด</span>
                      </button>

                      {isPending && (
                        <>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleStatusChange(order.id, 'อนุมัติแล้ว')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer text-xs"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>อนุมัติคำขอ</span>
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'ปฏิเสธ / ยกเลิกคำขอใบเบิก',
                                description: `ยืนยันปฏิเสธหรือยกเลิกคำขอใบเบิกเลขที่ "${order.docNo}" หรือไม่?`,
                                details: `ผู้ขอเบิก (${order.requesterName}) จะเห็นสถานะยกเลิกในหน้ารายการของตนเองทันที`,
                                confirmText: 'ยืนยันยกเลิกคำขอ',
                                confirmVariant: 'danger',
                                onConfirm: async () => {
                                  await handleStatusChange(order.id, 'ยกเลิก');
                                }
                              });
                            }}
                            className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
                            title="ปฏิเสธ / ยกเลิกใบเบิก"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>ยกเลิกคำขอ</span>
                          </button>
                        </>
                      )}

                      {isApproved && (
                        <>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleStatusChange(order.id, 'เบิกจ่ายแล้ว')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>ตัดจ่ายพัสดุ (ส่งมอบ)</span>
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'ยกเลิกใบเบิกที่อนุมัติแล้ว',
                                description: `ยืนยันยกเลิกใบเบิกเลขที่ "${order.docNo}" หรือไม่?`,
                                details: 'ระบบจะเปลี่ยนสถานะเป็น "ยกเลิก" และแจ้งเตือนไปยังผู้ขอเบิก',
                                confirmText: 'ยืนยันยกเลิกใบเบิก',
                                confirmVariant: 'danger',
                                onConfirm: async () => {
                                  await handleStatusChange(order.id, 'ยกเลิก');
                                }
                              });
                            }}
                            className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
                            title="ยกเลิกใบเบิก"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>ยกเลิกใบเบิก</span>
                          </button>
                        </>
                      )}

                      {isDisbursed && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            ตัดจ่ายแล้วเมื่อ {order.disbursedDate}
                          </span>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'ยืนยันยกเลิกการจ่ายและคืนพัสดุเข้าสต็อกคลัง',
                                description: `คุณต้องการยกเลิกการจ่ายพัสดุสำหรับใบเบิก "${order.docNo}" หรือไม่?`,
                                details: `ระบบจะดำเนินการคืนยอดพัสดุทั้งหมด (${order.totalItems} หน่วย) กลับเข้าสู่คลัง และลบประวัติการตัดจ่ายออกจากสมุดคุมให้อัตโนมัติ โดยสถานะใบเบิกจะเปลี่ยนเป็น "ยกเลิก" และแสดงไปยังผู้ขอเบิกทันที`,
                                confirmText: 'ยืนยันยกเลิกและคืนสต็อก',
                                confirmVariant: 'danger',
                                onConfirm: async () => {
                                  await handleStatusChange(order.id, 'ยกเลิก');
                                }
                              });
                            }}
                            className="px-3 py-1.5 text-xs text-rose-600 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-700 border border-rose-300 dark:border-rose-800/80 rounded-lg transition cursor-pointer flex items-center gap-1.5 font-bold shadow-2xs active:scale-95"
                            title="ยกเลิกการจ่ายและคืนพัสดุเข้าคลัง"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>ยกเลิก/คืนสต็อก</span>
                          </button>
                        </div>
                      )}

                      {order.status === 'ยกเลิก' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'ยืนยันการลบใบเบิกจ่ายที่ยกเลิก',
                                description: `คุณต้องการลบใบเบิกเลขที่ "${order.docNo}" ออกจากรายการอย่างถาวรหรือไม่?`,
                                details: `ใบเบิกนี้ถูกยกเลิกแล้ว (ผู้ขอเบิก: ${order.requesterName}) การลบจะนำรายการนี้ออกจากฐานข้อมูลระบบอย่างถาวรและไม่สามารถกู้คืนได้`,
                                confirmText: 'ยืนยันลบใบเบิกถาวร',
                                confirmVariant: 'danger',
                                onConfirm: async () => {
                                  await handleDeleteOrder(order.id);
                                }
                              });
                            }}
                            className="px-3 py-1.5 text-xs text-rose-600 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-700 border border-rose-300 dark:border-rose-800 rounded-lg transition cursor-pointer flex items-center gap-1.5 font-bold shadow-2xs active:scale-95"
                            title="ลบใบเบิกจ่ายที่ยกเลิกออกจากระบบถาวร"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบใบเบิกที่ยกเลิก</span>
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'ย้อนสถานะเป็นรออนุมัติ',
                                description: `ต้องการนำใบเบิก "${order.docNo}" กลับสู่สถานะ "รออนุมัติ" เพื่อพิจารณาใหม่อีกครั้งหรือไม่?`,
                                confirmText: 'ย้อนกลับเป็นรออนุมัติ',
                                confirmVariant: 'warning',
                                onConfirm: async () => {
                                  await handleStatusChange(order.id, 'รออนุมัติ');
                                }
                              });
                            }}
                            className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1 font-medium"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>ย้อนเป็นรออนุมัติ</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Regular User Actions */
                    <>
                      {isPending && (
                        <>
                          <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            รอเจ้าหน้าที่พัสดุอนุมัติ
                          </span>
                          <button
                            disabled={isProcessing}
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'ยกเลิกคำขอเบิกพัสดุ',
                                description: `คุณต้องการยกเลิกคำขอเบิกพัสดุเลขที่ "${order.docNo}" หรือไม่?`,
                                confirmText: 'ยืนยันยกเลิกคำขอ',
                                confirmVariant: 'danger',
                                onConfirm: async () => {
                                  await handleStatusChange(order.id, 'ยกเลิก');
                                }
                              });
                            }}
                            className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>ยกเลิกคำขอ</span>
                          </button>
                        </>
                      )}

                      {isApproved && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          อนุมัติแล้ว • รอรับมอบพัสดุ
                        </span>
                      )}

                      {isDisbursed && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          รับมอบแล้ว ({order.disbursedDate})
                        </span>
                      )}

                      {order.status === 'ยกเลิก' && (
                        <span className="text-[11px] text-rose-500 font-semibold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md">
                          <XCircle className="w-3.5 h-3.5" />
                          ยกเลิกรายการแล้ว (คืนสต็อกเข้าคลังแล้ว)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="py-16 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <ClipboardList className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">ไม่พบรายการใบเบิกที่ตรงกับเงื่อนไข</p>
            <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
          </div>
        )}
      </div>

      {/* Edit Order Modal for Admin */}
      {isAdmin && editingOrder && (
        <EditOrderModal
          isOpen={!!editingOrder}
          order={editingOrder}
          materials={materials}
          onClose={() => setEditingOrder(null)}
          onSave={async (orderId, payload) => {
            const res = await onEditOrder(orderId, payload);
            if (res.success) {
              setEditingOrder(null);
            }
            return res;
          }}
        />
      )}

      {/* In-App Confirmation Modal (Works seamlessly without browser popup blocks) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmDialog.confirmVariant === 'danger'
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                  : confirmDialog.confirmVariant === 'warning'
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {confirmDialog.description}
                </p>
                {confirmDialog.details && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                    {confirmDialog.details}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => confirmDialog.onConfirm()}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 ${
                  confirmDialog.confirmVariant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmDialog.confirmVariant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isProcessing && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{confirmDialog.confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
