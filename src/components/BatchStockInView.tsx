import { FC, useState, useMemo, FormEvent } from 'react';
import { Material, BatchStockInItem, StockIn } from '../types';
import { SearchableMaterialSelect } from './SearchableMaterialSelect';
import { StorageService } from '../services/storageService';
import { 
  PackagePlus, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  FileText, 
  Calendar, 
  User, 
  Truck,
  DollarSign,
  Search,
  Edit,
  History,
  Boxes,
  ArrowRight,
  X,
  RefreshCw,
  PackageCheck,
  BookmarkCheck,
  Clock,
  ChevronDown,
  Coins,
  Landmark,
  Check,
  FileSpreadsheet,
  BookOpenText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { exportBatchStockInToExcel, exportBatchEntryDraftToExcel } from '../utils/excelExport';

interface BatchStockInViewProps {
  materials: Material[];
  stockInLogs?: StockIn[];
  currentUserName: string;
  onAddBatchStockIn: (
    docNo: string,
    date: string,
    supplier: string,
    receiverName: string,
    note: string,
    items: BatchStockInItem[],
    obligationNo?: string,
    budgetType?: 'เงินราย' | 'เงินแผ่นดิน' | string
  ) => Promise<void>;
  onUpdateStockIn?: (logId: string, updatedData: Partial<StockIn>) => Promise<{ success: boolean; error?: string }>;
  onDeleteStockIn?: (logId: string) => Promise<{ success: boolean; error?: string }>;
  onNavigateToLedger: (materialId?: string) => void;
}

export const BatchStockInView: FC<BatchStockInViewProps> = ({
  materials,
  stockInLogs = [],
  currentUserName,
  onAddBatchStockIn,
  onUpdateStockIn,
  onDeleteStockIn,
  onNavigateToLedger
}) => {
  const today = new Date().toISOString().split('T')[0];

  // Active Sub-Tab: 'entry' (New Batch) | 'history' (View & Edit received items)
  const [activeSubTab, setActiveSubTab] = useState<'entry' | 'history'>('entry');

  // Document Info for Batch Entry
  const [docNo, setDocNo] = useState(`PO-COPAG-2568/${String(Math.floor(Math.random() * 900) + 100)}`);
  const [obligationNo, setObligationNo] = useState('');
  const [budgetType, setBudgetType] = useState<'เงินราย' | 'เงินแผ่นดิน'>(() => {
    try {
      const saved = localStorage.getItem('copag_stockin_last_budget_type');
      return (saved === 'เงินแผ่นดิน' || saved === 'เงินราย') ? saved : 'เงินราย';
    } catch {
      return 'เงินราย';
    }
  });
  const [date, setDate] = useState(today);
  const [supplier, setSupplier] = useState('บจก. สารคามเครื่องเขียนและครุภัณฑ์');
  const [receiverName, setReceiverName] = useState(currentUserName || 'เจ้าหน้าที่พัสดุ วก.มมส.');
  const [note, setNote] = useState('จัดซื้อตามแผนจัดสรรงบประมาณเงินรายได้ ประจำปีงบประมาณ 2568');

  // Presets and History state
  const [presets, setPresets] = useState<Array<{
    docNo: string;
    obligationNo?: string;
    budgetType: string;
    supplier: string;
    receiverName: string;
    note: string;
    date: string;
    timestamp: number;
  }>>(() => StorageService.getStockInPresets());
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Compute suggestions for datalists based on history of typing/records
  const obligationSuggestions = useMemo(() => {
    const set = new Set<string>();
    presets.forEach(p => { if (p.obligationNo) set.add(p.obligationNo.trim()); });
    stockInLogs.forEach(l => { if (l.obligationNo) set.add(l.obligationNo.trim()); });
    return Array.from(set).filter(Boolean);
  }, [presets, stockInLogs]);

  const supplierSuggestions = useMemo(() => {
    const set = new Set<string>();
    presets.forEach(p => { if (p.supplier) set.add(p.supplier.trim()); });
    stockInLogs.forEach(l => { if (l.supplier) set.add(l.supplier.trim()); });
    set.add('บจก. สารคามเครื่องเขียนและครุภัณฑ์');
    set.add('หจก. มหาสารคามพัสดุภัณฑ์');
    set.add('ร้านศึกษาภัณฑ์ มหาสารคาม');
    return Array.from(set).filter(Boolean);
  }, [presets, stockInLogs]);

  const receiverSuggestions = useMemo(() => {
    const set = new Set<string>();
    if (currentUserName) set.add(currentUserName.trim());
    presets.forEach(p => { if (p.receiverName) set.add(p.receiverName.trim()); });
    stockInLogs.forEach(l => { if (l.receiverName) set.add(l.receiverName.trim()); });
    set.add('เจ้าหน้าที่พัสดุ วก.มมส.');
    return Array.from(set).filter(Boolean);
  }, [currentUserName, presets, stockInLogs]);

  const docNoSuggestions = useMemo(() => {
    const set = new Set<string>();
    presets.forEach(p => { if (p.docNo) set.add(p.docNo.trim()); });
    stockInLogs.forEach(l => { if (l.docNo) set.add(l.docNo.trim()); });
    return Array.from(set).slice(0, 20);
  }, [presets, stockInLogs]);

  const noteSuggestions = useMemo(() => {
    const set = new Set<string>();
    presets.forEach(p => { if (p.note) set.add(p.note.trim()); });
    stockInLogs.forEach(l => { if (l.note) set.add(l.note.trim()); });
    set.add('จัดซื้อตามแผนจัดสรรงบประมาณเงินรายได้ ประจำปีงบประมาณ 2568');
    set.add('จัดซื้อวัสดุสำนักงานประจำปีงบประมาณแผ่นดิน');
    set.add('จัดซื้อวัสดุสำหรับการเรียนการสอนและกิจกรรมนิสิต');
    return Array.from(set).filter(Boolean);
  }, [presets, stockInLogs]);

  // Apply selected historical preset
  const handleApplyPreset = (preset: typeof presets[0]) => {
    if (preset.docNo) setDocNo(preset.docNo);
    if (preset.obligationNo !== undefined) setObligationNo(preset.obligationNo);
    if (preset.budgetType === 'เงินแผ่นดิน' || preset.budgetType === 'เงินราย') {
      setBudgetType(preset.budgetType);
      try { localStorage.setItem('copag_stockin_last_budget_type', preset.budgetType); } catch {}
    }
    if (preset.supplier) setSupplier(preset.supplier);
    if (preset.receiverName) setReceiverName(preset.receiverName);
    if (preset.note) setNote(preset.note);
    setIsPresetsOpen(false);
    setSuccessMessage(`โหลดข้อมูลประวัติใบสั่งซื้อ/ใบผูกพัน "${preset.obligationNo || preset.docNo}" เรียบร้อยแล้ว`);
  };

  // Rows of items for Batch Entry
  const [items, setItems] = useState<BatchStockInItem[]>([
    {
      materialId: materials[0]?.id || '1ก01',
      materialName: materials[0]?.name || 'กระดาษถ่ายเอกสาร A4 Double A',
      category: materials[0]?.category || 'วัสดุสำนักงาน',
      unit: materials[0]?.unit || 'รีม',
      quantity: 50,
      unitPrice: materials[0]?.unitPrice || 135,
      totalPrice: 50 * (materials[0]?.unitPrice || 135),
      note: ''
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // History Search & Filter State
  const [historySearch, setHistorySearch] = useState('');
  const [historyCategory, setHistoryCategory] = useState('ทั้งหมด');
  const [historyBudgetTypeFilter, setHistoryBudgetTypeFilter] = useState<'ทั้งหมด' | 'เงินราย' | 'เงินแผ่นดิน'>('ทั้งหมด');

  // Edit Stock-In Modal State
  const [editingLog, setEditingLog] = useState<StockIn | null>(null);
  const [editDocNo, setEditDocNo] = useState('');
  const [editObligationNo, setEditObligationNo] = useState('');
  const [editBudgetType, setEditBudgetType] = useState<'เงินราย' | 'เงินแผ่นดิน'>('เงินราย');
  const [editDate, setEditDate] = useState('');
  const [editQuantity, setEditQuantity] = useState(0);
  const [editUnitPrice, setEditUnitPrice] = useState(0);
  const [editSupplier, setEditSupplier] = useState('');
  const [editReceiver, setEditReceiver] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Delete Stock-In Confirmation Modal State
  const [deletingLog, setDeletingLog] = useState<StockIn | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Open Edit Modal
  const handleOpenEdit = (log: StockIn) => {
    setEditingLog(log);
    setEditDocNo(log.docNo);
    setEditObligationNo(log.obligationNo || '');
    setEditBudgetType((log.budgetType as any) === 'เงินแผ่นดิน' ? 'เงินแผ่นดิน' : 'เงินราย');
    setEditDate(log.date);
    setEditQuantity(log.quantity);
    setEditUnitPrice(log.unitPrice);
    setEditSupplier(log.supplier);
    setEditReceiver(log.receiverName);
    setEditNote(log.note || '');
    setErrorMessage('');
  };

  // Save Edit Stock-In
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingLog || !onUpdateStockIn) return;

    if (editQuantity <= 0) {
      setErrorMessage('จำนวนรับเข้าต้องมากกว่า 0');
      return;
    }

    try {
      setIsEditSaving(true);
      const res = await onUpdateStockIn(editingLog.id, {
        docNo: editDocNo.trim(),
        obligationNo: editObligationNo.trim(),
        budgetType: editBudgetType,
        date: editDate,
        quantity: Number(editQuantity),
        unitPrice: Number(editUnitPrice),
        supplier: editSupplier.trim(),
        receiverName: editReceiver.trim(),
        note: editNote.trim()
      });

      if (res.success) {
        setSuccessMessage(`แก้ไขรายการรับเข้าเอกสาร "${editDocNo}" สำเร็จแล้ว ระบบปรับยอดสต็อกและสมุดคุมให้สัมพันธ์กันเรียบร้อย`);
        setEditingLog(null);
        setPresets(StorageService.getStockInPresets());
      } else {
        setErrorMessage(res.error || 'เกิดข้อผิดพลาดในการแก้ไขรายการ');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการแก้ไขรายการ');
    } finally {
      setIsEditSaving(false);
    }
  };

  // Confirm Delete Stock-In
  const handleConfirmDelete = async () => {
    if (!deletingLog || !onDeleteStockIn) return;

    try {
      setIsDeleting(true);
      const res = await onDeleteStockIn(deletingLog.id);
      if (res && res.success) {
        setSuccessMessage(`ลบรายการรับเข้า "${deletingLog.docNo}" สำเร็จ และหักสต็อกพัสดุคืน ${deletingLog.quantity} ${deletingLog.unit} อัตโนมัติ`);
      } else {
        setErrorMessage(res?.error || 'เกิดข้อผิดพลาดในการลบรายการ');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการลบรายการ');
    } finally {
      setIsDeleting(false);
      setDeletingLog(null);
    }
  };

  // Add new item row to batch
  const handleAddRow = () => {
    const defaultMat = materials[0];
    if (!defaultMat) return;

    setItems(prev => [
      ...prev,
      {
        materialId: defaultMat.id,
        materialName: defaultMat.name,
        category: defaultMat.category,
        unit: defaultMat.unit,
        quantity: 10,
        unitPrice: defaultMat.unitPrice,
        totalPrice: 10 * defaultMat.unitPrice,
        note: ''
      }
    ]);
  };

  // Remove row from batch
  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage('ต้องมีรายการพัสดุอย่างน้อย 1 รายการ');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Handle Material Selection change
  const handleMaterialChange = (index: number, materialId: string) => {
    const selectedMat = materials.find(m => m.id === materialId);
    if (!selectedMat) return;

    setItems(prev => {
      const copy = [...prev];
      const target = copy[index];
      target.materialId = selectedMat.id;
      target.materialName = selectedMat.name;
      target.category = selectedMat.category;
      target.unit = selectedMat.unit;
      target.unitPrice = selectedMat.unitPrice;
      target.totalPrice = target.quantity * selectedMat.unitPrice;
      return copy;
    });
  };

  // Handle Quantity Change
  const handleQuantityChange = (index: number, qty: number) => {
    const cleanQty = Math.max(1, qty);
    setItems(prev => {
      const copy = [...prev];
      const target = copy[index];
      target.quantity = cleanQty;
      target.totalPrice = cleanQty * target.unitPrice;
      return copy;
    });
  };

  // Handle Unit Price Change
  const handleUnitPriceChange = (index: number, price: number) => {
    const cleanPrice = Math.max(0, price);
    setItems(prev => {
      const copy = [...prev];
      const target = copy[index];
      target.unitPrice = cleanPrice;
      target.totalPrice = target.quantity * cleanPrice;
      return copy;
    });
  };

  // Handle Note Change
  const handleNoteChange = (index: number, rowNote: string) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index].note = rowNote;
      return copy;
    });
  };

  // Calculations for batch
  const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  // Submit batch
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!docNo.trim()) {
      setErrorMessage('กรุณาระบุเลขที่ใบส่งของ / PO');
      return;
    }
    if (!supplier.trim()) {
      setErrorMessage('กรุณาระบุชื่อบริษัท / ร้านค้าผู้จัดส่ง');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('กรุณาเพิ่มรายการพัสดุอย่างน้อย 1 รายการ');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddBatchStockIn(
        docNo.trim(),
        date,
        supplier.trim(),
        receiverName.trim(),
        note.trim(),
        items,
        obligationNo.trim(),
        budgetType
      );

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });

      setSuccessMessage(`บันทึกรับเข้าพัสดุสำเร็จ ${items.length} รายการ (รวม ${totalUnits} หน่วย มูลค่า ฿${totalAmount.toLocaleString()} บาท) ข้อมูลถูกเพิ่มลงสต็อกและสมุดคุมบัญชีเรียบร้อยแล้ว`);
      
      // Automatically switch to history tab so the newly added records are immediately visible
      setActiveSubTab('history');

      // Update local presets
      setPresets(StorageService.getStockInPresets());
      try {
        localStorage.setItem('copag_stockin_last_budget_type', budgetType);
      } catch {}

      // Reset to fresh docNo and clear obligation
      setDocNo(`PO-COPAG-2568/${String(Math.floor(Math.random() * 900) + 100)}`);
      setObligationNo('');
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered History
  const filteredHistory = stockInLogs.filter(log => {
    const q = historySearch.toLowerCase().trim();
    const matchesSearch = !q ||
      log.docNo.toLowerCase().includes(q) ||
      (log.obligationNo && log.obligationNo.toLowerCase().includes(q)) ||
      log.materialName.toLowerCase().includes(q) ||
      log.materialId.toLowerCase().includes(q) ||
      log.supplier.toLowerCase().includes(q) ||
      log.receiverName.toLowerCase().includes(q) ||
      (log.budgetType && log.budgetType.toLowerCase().includes(q));
    
    const matchesCat = historyCategory === 'ทั้งหมด' || log.category === historyCategory;
    const matchesBudget = historyBudgetTypeFilter === 'ทั้งหมด' || (log.budgetType || 'เงินราย') === historyBudgetTypeFilter;

    return matchesSearch && matchesCat && matchesBudget;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id.localeCompare(a.id));

  // History KPIs
  const totalHistoryQty = stockInLogs.reduce((sum, log) => sum + (log.quantity || 0), 0);
  const totalHistoryAmount = stockInLogs.reduce((sum, log) => sum + (log.totalPrice || 0), 0);

  // Material associated with currently editing log
  const editingMaterial = editingLog ? materials.find(m => m.id === editingLog.materialId) : null;
  const qtyDiff = editingLog ? editQuantity - editingLog.quantity : 0;
  const newStockPreview = editingMaterial ? editingMaterial.currentStock + qtyDiff : 0;

  return (
    <div className="space-y-6">
      
      {/* Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-amber-500" />
            ระบบรับเข้าพัสดุและประวัติการรับเข้า (Stock-In Management)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ลงทะเบียนรับเข้าพัสดุใหม่พร้อมกันหลายรายการ หรือตรวจสอบ/แก้ไขข้อมูลรายการที่เคยรับเข้าแล้ว โดยยอดจะสัมพันธ์กับสต็อกและสมุดคุมทั้งหมด
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateToLedger()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <Boxes className="w-3.5 h-3.5 text-amber-500" />
            <span>สมุดคุมพัสดุ (Stock Card)</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => { setActiveSubTab('entry'); setErrorMessage(''); setSuccessMessage(''); }}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeSubTab === 'entry'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          <span>บันทึกรับเข้าพัสดุใหม่ (Batch Stock-In)</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('history'); setErrorMessage(''); setSuccessMessage(''); }}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeSubTab === 'history'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>ประวัติรายการที่รับเข้าแล้ว</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
            {stockInLogs.length}
          </span>
        </button>
      </div>

      {/* Status Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-700 dark:text-rose-300 font-bold hover:underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BATCH ENTRY FORM */}
      {/* ========================================================================= */}
      {activeSubTab === 'entry' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Document Header Card */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            
            {/* Header Title & Presets Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>ข้อมูลใบสั่งซื้อ / ใบส่งของ (Purchase Order & Delivery)</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    exportBatchEntryDraftToExcel(docNo, date, supplier, receiverName, obligationNo, budgetType, note, items);
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800/70 flex items-center gap-2 transition cursor-pointer shadow-2xs"
                  title="ส่งออกรายการรับเข้าชุดที่กำลังกรอกเป็นไฟล์ Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>ส่งออก Excel รายการนี้</span>
                </button>
              </div>
            </div>

            {/* Datalists for historical typing auto-complete */}
            <datalist id="stockin-docno-list">
              {docNoSuggestions.map(d => <option key={d} value={d} />)}
            </datalist>
            <datalist id="stockin-obligation-list">
              {obligationSuggestions.map(o => <option key={o} value={o} />)}
            </datalist>
            <datalist id="stockin-supplier-list">
              {supplierSuggestions.map(s => <option key={s} value={s} />)}
            </datalist>
            <datalist id="stockin-receiver-list">
              {receiverSuggestions.map(r => <option key={r} value={r} />)}
            </datalist>
            <datalist id="stockin-note-list">
              {noteSuggestions.map(n => <option key={n} value={n} />)}
            </datalist>

            {/* Row 1: Document No, Obligation No, Budget Type, Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* 1. Doc No */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เลขที่ใบสั่งซื้อ / ใบส่งของ *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    list="stockin-docno-list"
                    value={docNo}
                    onChange={e => setDocNo(e.target.value)}
                    placeholder="เช่น PO-COPAG-2568/105"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold text-amber-600 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. Obligation No (เลขใบผูกพัน) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span>เลขใบผูกพัน</span>
                  </label>
                  <span className="text-[10px] text-slate-400">(งบประมาณ)</span>
                </div>
                <div className="relative">
                  <BookmarkCheck className="w-4 h-4 absolute left-3 top-2.5 text-amber-500" />
                  <input
                    type="text"
                    list="stockin-obligation-list"
                    value={obligationNo}
                    onChange={e => setObligationNo(e.target.value)}
                    placeholder="เช่น PO-68-00123 / ใบผูกพัน 68/045"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
                {/* Clickable Quick Obligation Chips */}
                {obligationSuggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-medium">เคยใช้:</span>
                    {obligationSuggestions.slice(0, 3).map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setObligationNo(item)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 dark:bg-slate-750 dark:hover:bg-amber-950 dark:text-slate-300 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        title={`คลิกเพื่อใส่ "${item}"`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Budget Type (เงินราย vs เงินแผ่นดิน) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ประเภทงบประมาณ *
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetType('เงินราย');
                      try { localStorage.setItem('copag_stockin_last_budget_type', 'เงินราย'); } catch {}
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      budgetType === 'เงินราย'
                        ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-600/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🪙 เงินราย</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBudgetType('เงินแผ่นดิน');
                      try { localStorage.setItem('copag_stockin_last_budget_type', 'เงินแผ่นดิน'); } catch {}
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      budgetType === 'เงินแผ่นดิน'
                        ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-700/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🏛️ เงินแผ่นดิน</span>
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 pl-1">
                  {budgetType === 'เงินราย' ? '• งบประมาณเงินรายได้ส่วนงาน' : '• งบประมาณแผ่นดินประจำปี'}
                </div>
              </div>

              {/* 4. Date */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  วันที่รับเข้า *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Supplier, Receiver, Purpose */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  บริษัท / ร้านค้าผู้จัดส่ง *
                </label>
                <div className="relative">
                  <Truck className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    list="stockin-supplier-list"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    placeholder="เช่น บจก. สารคามเครื่องเขียนและครุภัณฑ์"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ผู้ตรวจรับพัสดุ
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    list="stockin-receiver-list"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    placeholder="ชื่อผู้รับพัสดุ"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                  วัตถุประสงค์ / หมายเหตุการจัดซื้อ
                </label>
                <input
                  type="text"
                  list="stockin-note-list"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="เช่น จัดซื้อตามแผนจัดสรรงบประมาณเงินรายได้ ประจำปีงบประมาณ 2568"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
                <PackagePlus className="w-4 h-4 text-amber-500" />
                <span>รายการพัสดุที่รับเข้า ({items.length} รายการ)</span>
              </div>
              <span className="text-xs text-slate-400">
                เพิ่มแถวเพื่อบันทึกพัสดุหลายรายการพร้อมกันในใบส่งของใบนี้
              </span>
            </div>

            <div className="overflow-x-auto min-h-[340px] pb-32">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-bold">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[320px]">รายการพัสดุ (พิมพ์ค้นหาได้)</th>
                    <th className="py-2.5 px-3 w-28 text-center">จำนวนรับ</th>
                    <th className="py-2.5 px-3 w-20 text-center">หน่วยนับ</th>
                    <th className="py-2.5 px-3 w-28 text-right">ราคา/หน่วย</th>
                    <th className="py-2.5 px-3 w-32 text-right">ราคารวม (฿)</th>
                    <th className="py-2.5 px-3 min-w-[150px]">หมายเหตุย่อย</th>
                    <th className="py-2.5 px-3 w-12 text-center">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>

                      {/* Material Select with Search */}
                      <td className="py-2.5 px-3 min-w-[320px]">
                        <SearchableMaterialSelect
                          materials={materials}
                          selectedId={row.materialId}
                          onSelect={selectedId => handleMaterialChange(idx, selectedId)}
                          placeholder="พิมพ์ชื่อ หรือรหัส เช่น 1ก01, กบเหลา, Double A..."
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={e => handleQuantityChange(idx, Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                        {row.unit}
                      </td>

                      {/* Unit Price */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.unitPrice}
                          onChange={e => handleUnitPriceChange(idx, Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-right focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </td>

                      {/* Total Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        ฿{(row.totalPrice || 0).toLocaleString()}
                      </td>

                      {/* Note */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="เฉพาะรายการนี้"
                          value={row.note || ''}
                          onChange={e => handleNoteChange(idx, e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </td>

                      {/* Delete Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                          title="ลบแถวนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grand Totals & Submit bar */}
            <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span>จำนวนรายการ: </span>
                  <strong className="text-slate-900 dark:text-white text-sm">{items.length} รายการ</strong>
                </div>
                <div>
                  <span>รวมทั้งสิ้น: </span>
                  <strong className="text-slate-900 dark:text-white text-sm">{totalUnits} หน่วย</strong>
                </div>
                <div>
                  <span>มูลค่ารวม: </span>
                  <strong className="text-amber-600 dark:text-amber-400 font-mono text-base font-bold">
                    ฿{totalAmount.toLocaleString()} บาท
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3.5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  + เพิ่มรายการ
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันบันทึกรับเข้าทั้งหมด'}</span>
                </button>
              </div>
            </div>

          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIVED ITEMS HISTORY & EDITING */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          
          {/* Summary KPIs Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ประวัติการรับเข้าทั้งหมด</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white font-mono">{stockInLogs.length} รายการ</p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 shrink-0">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">ปริมาณรับเข้ารวมสะสม</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">+{totalHistoryQty.toLocaleString()} หน่วย</p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">มูลค่าพัสดุรับเข้ารวม</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">฿{totalHistoryAmount.toLocaleString()} บาท</p>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="ค้นหาเลขที่เอกสาร PO/ใบส่งของ, ชื่อพัสดุ, รหัสพัสดุ, ผู้จัดจำหน่าย..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={historyBudgetTypeFilter}
                onChange={e => setHistoryBudgetTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="ทั้งหมด">💰 แหล่งเงินทั้งหมด</option>
                <option value="เงินราย">🪙 เงินราย</option>
                <option value="เงินแผ่นดิน">🏛️ เงินแผ่นดิน</option>
              </select>

              <select
                value={historyCategory}
                onChange={e => setHistoryCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="ทั้งหมด">หมวดหมู่ทั้งหมด</option>
                {Array.from(new Set<string>(materials.map(m => m.category)))
                  .filter((cat: string) => cat && !['ผลิตภัณฑ์ทำความสะอาด', 'แฟ้มและอุปกรณ์จัดเก็บ', 'เครื่องเขียน', 'กระดาษและสิ่งพิมพ์'].includes(cat))
                  .map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const matMap = new Map<string, Material>(materials.map(m => [m.id, m]));
                  exportBatchStockInToExcel(filteredHistory, matMap);
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="ส่งออกประวัติการรับเข้าพัสดุทั้งหมดเป็นไฟล์ Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>ส่งออก Excel</span>
              </button>

              <span className="text-xs text-slate-400 pl-1">
                พบ {filteredHistory.length} รายการ
              </span>
            </div>
          </div>

          {/* Received Items Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-bold">
                    <th className="py-3 px-3 w-24">วันที่รับ</th>
                    <th className="py-3 px-3 min-w-[150px]">เลขที่เอกสาร & เลขใบผูกพัน</th>
                    <th className="py-3 px-3 w-28 text-center">แหล่งเงิน</th>
                    <th className="py-3 px-3 min-w-[200px]">รหัส & ชื่อพัสดุ</th>
                    <th className="py-3 px-3 w-24 text-center">จำนวนที่รับ</th>
                    <th className="py-3 px-3 w-28 text-right">ราคา/หน่วย</th>
                    <th className="py-3 px-3 w-28 text-right">ราคารวม (฿)</th>
                    <th className="py-3 px-3 min-w-[150px]">ผู้จัดส่ง/ร้านค้า</th>
                    <th className="py-3 px-3 min-w-[120px]">ผู้ตรวจรับ</th>
                    <th className="py-3 px-3 w-28 text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredHistory.map(log => {
                    const currentMat = materials.find(m => m.id === log.materialId);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition">
                        {/* Date */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          {log.date}
                        </td>

                        {/* DocNo & Obligation No */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {log.docNo}
                          </div>
                          {log.obligationNo && (
                            <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                              <BookmarkCheck className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-200/60 dark:border-amber-800/60">
                                {log.obligationNo}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Budget Type Badge */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            log.budgetType === 'เงินแผ่นดิน'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                          }`}>
                            {log.budgetType === 'เงินแผ่นดิน' ? '🏛️ เงินแผ่นดิน' : '🪙 เงินราย'}
                          </span>
                        </td>

                        {/* Material Info */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            <span className="font-mono text-amber-600 dark:text-amber-400 mr-1.5 font-bold">
                              [{log.materialId}]
                            </span>
                            {log.materialName}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{log.category}</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              สต็อกคลังปัจจุบัน: {currentMat?.currentStock ?? '-'} {log.unit}
                            </span>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                            +{log.quantity} {log.unit}
                          </span>
                        </td>

                        {/* Unit Price */}
                        <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300 font-mono">
                          ฿{log.unitPrice.toLocaleString()}
                        </td>

                        {/* Total Price */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                          ฿{log.totalPrice.toLocaleString()}
                        </td>

                        {/* Supplier */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[160px]" title={log.supplier}>
                          {log.supplier}
                        </td>

                        {/* Receiver */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={log.receiverName}>
                          {log.receiverName}
                        </td>

                        {/* Actions: Stock Card, Edit & Delete */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onNavigateToLedger(log.materialId)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                              title="เปิดดูสมุดคุมบัญชีพัสดุ (Stock Card) ตรวจสอบที่มาที่ไปของพัสดุนี้"
                            >
                              <BookOpenText className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">สมุดคุม</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(log)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                              title="แก้ไขรายการนี้"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">แก้ไข</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingLog(log)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="ลบรายการนี้ (หักสต็อกคืนอัตโนมัติ)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Boxes className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">ไม่พบรายการประวัติที่ตรงกับคำค้นหา</p>
                        <p className="text-xs text-slate-400 mt-0.5">ลองตรวจสอบคำค้นหรือสลับกลับไปแท็บบันทึกรับเข้าพัสดุใหม่</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT MODAL */}
      {/* ========================================================================= */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-slate-800 dark:text-white">
                  แก้ไขข้อมูลรายการรับเข้าพัสดุ
                </h3>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 sm:p-5 space-y-4 text-xs">
              
              {/* Material Details Banner */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  [{editingLog.materialId}] {editingLog.materialName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  หมวดหมู่: {editingLog.category} | หน่วยนับ: {editingLog.unit}
                </div>
              </div>

              {/* Automatic Stock Reconciliation Preview */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  <span>การปรับปรุงยอดสต็อกจริงอัตโนมัติ:</span>
                </div>
                <div className="text-[11px] leading-relaxed">
                  ยอดที่เคยรับเข้า: <strong>{editingLog.quantity}</strong> {editingLog.unit} ➔ ยอดใหม่: <strong>{editQuantity}</strong> {editingLog.unit}
                  {qtyDiff !== 0 && (
                    <span className="ml-2 font-bold text-amber-700 dark:text-amber-300 font-mono">
                      ({qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff} {editingLog.unit})
                    </span>
                  )}
                </div>
                {editingMaterial && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-0.5">
                    สต็อกในคลังปัจจุบัน: {editingMaterial.currentStock} {editingLog.unit} ➔ 
                    สต็อกหลังบันทึก: <strong className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{newStockPreview}</strong> {editingLog.unit}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    เลขที่เอกสาร PO / ใบส่งของ *
                  </label>
                  <input
                    type="text"
                    required
                    list="stockin-docno-list"
                    value={editDocNo}
                    onChange={e => setEditDocNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    เลขใบผูกพัน (งบประมาณ)
                  </label>
                  <input
                    type="text"
                    list="stockin-obligation-list"
                    value={editObligationNo}
                    onChange={e => setEditObligationNo(e.target.value)}
                    placeholder="เช่น PO-68-00123"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ประเภทงบประมาณ *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setEditBudgetType('เงินราย')}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                        editBudgetType === 'เงินราย'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>🪙 เงินราย</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditBudgetType('เงินแผ่นดิน')}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                        editBudgetType === 'เงินแผ่นดิน'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>🏛️ เงินแผ่นดิน</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    วันที่รับเข้า *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    จำนวนที่รับเข้า *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editQuantity}
                    onChange={e => setEditQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาต่อหน่วย (บาท) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={editUnitPrice}
                    onChange={e => setEditUnitPrice(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between text-xs py-1 px-2 bg-slate-100 dark:bg-slate-900 rounded-lg">
                    <span className="text-slate-500">คำนวณมูลค่ารวมใหม่:</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                      ฿{(editQuantity * editUnitPrice).toLocaleString()} บาท
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ผู้จัดจำหน่าย / บริษัทผู้ส่ง
                  </label>
                  <input
                    type="text"
                    required
                    value={editSupplier}
                    onChange={e => setEditSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ผู้ตรวจรับพัสดุ
                  </label>
                  <input
                    type="text"
                    value={editReceiver}
                    onChange={e => setEditReceiver(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หมายเหตุ
                  </label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    placeholder="เหตุผลการแก้ไข หรือข้อมูลเพิ่มเติม"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold cursor-pointer transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isEditSaving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>{isEditSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไขและปรับสต็อก'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-white">
                  ยืนยันการลบรายการรับเข้าพัสดุ?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  เอกสาร: {deletingLog.docNo}
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs space-y-1">
              <p className="font-semibold">ผลกระทบต่อระบบสต็อก:</p>
              <p>
                • จะลบรายการรับพัสดุ <strong>"{deletingLog.materialName}"</strong> ออกจากประวัติ
              </p>
              <p>
                • <strong>จะหักสต็อกคงเหลือในคลังคืนออก {deletingLog.quantity} {deletingLog.unit}</strong> โดยอัตโนมัติ เพื่อให้ยอดสต็อกจริงและสมุดคุมบัญชีถูกต้องตรงกัน
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบและหักสต็อกคืน'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
