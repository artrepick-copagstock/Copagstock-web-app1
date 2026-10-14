import { FC, useState, useMemo, FormEvent } from 'react';
import { Material, StockIn, StockOut } from '../types';
import { getThaiFiscalYear } from '../services/storageService';
import { OfficialStockCardModal } from './OfficialStockCardModal';
import { 
  BookOpenText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Printer, 
  Search, 
  Calendar,
  Building2,
  FileText,
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { exportStockCardToExcel } from '../utils/excelExport';

interface StockLedgerViewProps {
  materials: Material[];
  selectedMaterialId: string;
  onSelectMaterial: (id: string) => void;
  stockInLogs: StockIn[];
  stockOutLogs: StockOut[];
  onAddStockIn: (entry: StockIn) => Promise<void>;
  onAddStockOut: (entry: StockOut) => Promise<void>;
  onDeleteStockIn?: (id: string) => Promise<void>;
  onDeleteStockOut?: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

const cleanOfficerName = (name?: string | null): string => {
  if (!name) return '-';
  return name.replace(/\s*\(?วก\.?\s*มมส\.?\)?/gi, '').trim() || '-';
};

export const StockLedgerView: FC<StockLedgerViewProps> = ({
  materials,
  selectedMaterialId,
  onSelectMaterial,
  stockInLogs,
  stockOutLogs,
  onAddStockIn,
  onAddStockOut,
  onDeleteStockIn,
  onDeleteStockOut,
  isAdmin = true
}) => {
  const [isOfficialPdfModalOpen, setIsOfficialPdfModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; type: 'IN' | 'OUT'; docNo: string; desc: string; qty?: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stock In Form
  const getTodayStr = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };
  const today = getTodayStr();
  const [inDate, setInDate] = useState(today);
  const [inDocNo, setInDocNo] = useState(`PO-COPAG-2568/${String(Math.floor(Math.random() * 90) + 10)}`);
  const [inQty, setInQty] = useState(10);
  const [inUnitPrice, setInUnitPrice] = useState(100);
  const [inSupplier, setInSupplier] = useState('บจก. สารคามเครื่องเขียน');
  const [inReceiver, setInReceiver] = useState('เจ้าหน้าที่พัสดุ วก.มมส.');
  const [inNote, setInNote] = useState('จัดซื้อตามงบประมาณประจำปี 2568');

  // Stock Out Form
  const [outDate, setOutDate] = useState(today);
  const [outDocNo, setOutDocNo] = useState(`วก. 2568/${String(Math.floor(Math.random() * 900) + 100)}`);
  const [outQty, setOutQty] = useState(1);
  const [outRequester, setOutRequester] = useState('');
  const [outDept, setOutDept] = useState('สาขาวิชารัฐศาสตร์');
  const [outDisburser, setOutDisburser] = useState('เจ้าหน้าที่พัสดุ วก.มมส.');
  const [outNote, setOutNote] = useState('เบิกใช้ในงานสำนักงาน');

  // Date Range state
  const [dateFilterPreset, setDateFilterPreset] = useState<'all' | 'today' | 'this_month' | 'last_month' | 'fiscal_year' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('all');

  // Calculate current Thai fiscal year
  const currentThaiFY = useMemo(() => getThaiFiscalYear(new Date()), []);

  // Dynamically generate list of Thai Fiscal Years
  const fiscalYearsList = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentThaiFY + 1);
    yearsSet.add(currentThaiFY);
    yearsSet.add(2568);
    yearsSet.add(2567);
    yearsSet.add(2566);
    yearsSet.add(2565);

    stockInLogs.forEach(s => {
      if (s.date) {
        const fy = getThaiFiscalYear(s.date);
        if (fy) yearsSet.add(fy);
      }
    });
    stockOutLogs.forEach(s => {
      if (s.date) {
        const fy = getThaiFiscalYear(s.date);
        if (fy) yearsSet.add(fy);
      }
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [stockInLogs, stockOutLogs, currentThaiFY]);

  // Handle selecting a Fiscal Year directly from dropdown
  const handleFiscalYearChange = (fyValue: string) => {
    setSelectedFiscalYear(fyValue);
    if (!fyValue || fyValue === 'all') {
      setDateFilterPreset('all');
      setStartDate('');
      setEndDate('');
    } else {
      const fyNum = parseInt(fyValue, 10);
      const startAD = fyNum - 543 - 1;
      const endAD = fyNum - 543;
      setStartDate(`${startAD}-10-01`);
      setEndDate(`${endAD}-09-30`);
      setDateFilterPreset('fiscal_year');
    }
  };

  // Handle Preset Changes
  const handlePresetChange = (preset: 'all' | 'today' | 'this_month' | 'last_month' | 'fiscal_year' | 'custom') => {
    setDateFilterPreset(preset);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    if (preset === 'all') {
      setSelectedFiscalYear('all');
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setSelectedFiscalYear('custom');
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'this_month') {
      setSelectedFiscalYear('custom');
      setStartDate(`${currentYear}-${currentMonth}-01`);
      setEndDate(today);
    } else if (preset === 'last_month') {
      setSelectedFiscalYear('custom');
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmYear = lastMonthDate.getFullYear();
      const lmMonth = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(lmYear, lastMonthDate.getMonth() + 1, 0).getDate();
      setStartDate(`${lmYear}-${lmMonth}-01`);
      setEndDate(`${lmYear}-${lmMonth}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'fiscal_year') {
      const targetFY = (selectedFiscalYear !== 'all' && selectedFiscalYear !== 'custom')
        ? parseInt(selectedFiscalYear, 10)
        : currentThaiFY;
      setSelectedFiscalYear(String(targetFY));
      const startAD = targetFY - 543 - 1;
      const endAD = targetFY - 543;
      setStartDate(`${startAD}-10-01`);
      setEndDate(`${endAD}-09-30`);
    }
  };

  // Current active material
  const currentMaterial = materials.find(m => m.id === selectedMaterialId) || materials[0];

  // Combined ledger entries sorted chronologically
  const currentIn = stockInLogs.filter(item => item.materialId === currentMaterial?.id);
  const currentOut = stockOutLogs.filter(item => item.materialId === currentMaterial?.id);

  interface LedgerRow {
    id: string;
    date: string;
    type: 'IN' | 'OUT' | 'BALANCE_FORWARD';
    docNo: string;
    description: string;
    inQty?: number;
    inPrice?: number;
    inTotal?: number;
    outQty?: number;
    outPrice?: number;
    outTotal?: number;
    balanceQty: number;
    balanceValuation: number;
    officer: string;
    note?: string;
  }

  // Total of all historical in and out for this material
  const totalAllInQty = currentIn.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalAllOutQty = currentOut.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const materialCurrentStock = currentMaterial?.currentStock ?? 0;

  // Derive initial stock before all logged transactions so everything is mathematically grounded
  const initialOpeningStock = Math.max(0, materialCurrentStock - totalAllInQty + totalAllOutQty);

  // Raw Events
  const rawEvents = [
    ...currentIn.map(item => ({
      date: item.date,
      createdAt: item.createdAt || item.date,
      type: 'IN' as const,
      docNo: item.docNo,
      description: `รับเข้าจาก: ${item.supplier}`,
      qty: item.quantity,
      unitPrice: item.unitPrice,
      total: item.totalPrice,
      officer: cleanOfficerName(item.receiverName),
      note: item.note,
      id: item.id
    })),
    ...currentOut.map(item => ({
      date: item.date,
      createdAt: item.createdAt || item.date,
      type: 'OUT' as const,
      docNo: item.requisitionDocNo,
      description: `จ่ายออกให้: ${item.requesterName} (${item.department})`,
      qty: item.quantity,
      unitPrice: item.unitPrice,
      total: item.totalPrice,
      officer: cleanOfficerName(item.disburserName),
      note: item.note,
      id: item.id
    }))
  ];

  // Sort ascending by date and realistic timeline:
  // 1. If date is the same: IN comes before OUT (Receive goods before issuing them)
  // 2. If an IN was created before an OUT in the system, IN comes before OUT
  rawEvents.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    const createdA = new Date(a.createdAt || a.date).getTime();
    const createdB = new Date(b.createdAt || b.date).getTime();

    // Same date: IN comes before OUT
    if (a.date === b.date) {
      if (a.type === 'IN' && b.type === 'OUT') return -1;
      if (a.type === 'OUT' && b.type === 'IN') return 1;
      return createdA - createdB;
    }

    // If an IN was created before an OUT in real time (e.g. user received PO, then disbursed from it)
    if (a.type === 'IN' && b.type === 'OUT' && createdA <= createdB) {
      return -1;
    }
    if (a.type === 'OUT' && b.type === 'IN' && createdB <= createdA) {
      return 1;
    }

    return timeA - timeB;
  });

  // Calculate prior events (before startDate) to calculate Brought Forward (ยอดยกมา)
  let priorInQty = 0;
  let priorOutQty = 0;
  const inRangeEvents: typeof rawEvents = [];

  rawEvents.forEach(e => {
    if (startDate && e.date < startDate) {
      if (e.type === 'IN') {
        priorInQty += e.qty;
      } else {
        priorOutQty += e.qty;
      }
    } else if (!endDate || e.date <= endDate) {
      inRangeEvents.push(e);
    }
  });

  const broughtForwardQty = initialOpeningStock + priorInQty - priorOutQty;
  let runningBalance = broughtForwardQty;
  const ledgerRows: LedgerRow[] = [];

  // If date filter is active or there is an opening stock, display Brought Forward
  if (startDate || initialOpeningStock > 0) {
    const isFYSelected = selectedFiscalYear !== 'all' && selectedFiscalYear !== 'custom';
    const bfDescription = isFYSelected
      ? `ยอดยกมาจากปีงบประมาณก่อนหน้า (ณ 1 ต.ค. ${Number(selectedFiscalYear) - 1})`
      : startDate
        ? `ยอดยกมาก่อนวันที่ ${startDate}`
        : 'ยอดยกมาต้นงวด (สต็อกเริ่มต้น)';

    ledgerRows.push({
      id: 'brought-forward',
      date: startDate || (rawEvents[0]?.date || today),
      type: 'BALANCE_FORWARD',
      docNo: 'ยอดยกมา',
      description: bfDescription,
      balanceQty: broughtForwardQty,
      balanceValuation: broughtForwardQty * (currentMaterial?.unitPrice || 0),
      officer: 'ระบบสารสนเทศพัสดุ',
      note: isFYSelected ? `ยอดยกมาต้นปีงบประมาณ ${selectedFiscalYear}` : 'ยกยอดคงเหลือสะสม'
    });
  }

  // Calculate in-range rows with true addition and subtraction (บวกลบตามความเป็นจริง)
  inRangeEvents.forEach(e => {
    if (e.type === 'IN') {
      runningBalance += e.qty;
      ledgerRows.push({
        id: e.id,
        date: e.date,
        type: 'IN',
        docNo: e.docNo,
        description: e.description,
        inQty: e.qty,
        inPrice: e.unitPrice,
        inTotal: e.total,
        balanceQty: runningBalance,
        balanceValuation: runningBalance * (currentMaterial?.unitPrice || 0),
        officer: e.officer,
        note: e.note
      });
    } else {
      runningBalance -= e.qty;
      ledgerRows.push({
        id: e.id,
        date: e.date,
        type: 'OUT',
        docNo: e.docNo,
        description: e.description,
        outQty: e.qty,
        outPrice: e.unitPrice,
        outTotal: e.total,
        balanceQty: runningBalance,
        balanceValuation: runningBalance * (currentMaterial?.unitPrice || 0),
        officer: e.officer,
        note: e.note
      });
    }
  });

  // Period stats for display
  const periodInQty = inRangeEvents.filter(e => e.type === 'IN').reduce((sum, e) => sum + e.qty, 0);
  const periodOutQty = inRangeEvents.filter(e => e.type === 'OUT').reduce((sum, e) => sum + e.qty, 0);


  // Handle Submit Stock In
  const handleStockInSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentMaterial) return;

    const entry: StockIn = {
      id: `IN-${Date.now()}`,
      date: inDate,
      docNo: inDocNo.trim(),
      materialId: currentMaterial.id,
      materialName: currentMaterial.name,
      category: currentMaterial.category,
      quantity: Number(inQty),
      unit: currentMaterial.unit,
      unitPrice: Number(inUnitPrice),
      totalPrice: Number(inQty) * Number(inUnitPrice),
      supplier: inSupplier.trim(),
      receiverName: inReceiver.trim(),
      note: inNote.trim(),
      createdAt: new Date().toISOString()
    };

    await onAddStockIn(entry);
    setIsStockInModalOpen(false);
  };

  // Handle Submit Stock Out
  const handleStockOutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentMaterial) return;
    if (outQty > currentMaterial.currentStock) {
      alert(`ไม่สามารถจ่ายออกเกินสต็อกคงเหลือ (${currentMaterial.currentStock} ${currentMaterial.unit}) ได้`);
      return;
    }

    const entry: StockOut = {
      id: `OUT-${Date.now()}`,
      date: outDate,
      requisitionDocNo: outDocNo.trim(),
      materialId: currentMaterial.id,
      materialName: currentMaterial.name,
      category: currentMaterial.category,
      quantity: Number(outQty),
      unit: currentMaterial.unit,
      unitPrice: currentMaterial.unitPrice,
      totalPrice: Number(outQty) * currentMaterial.unitPrice,
      requesterName: outRequester.trim(),
      department: outDept.trim(),
      disburserName: outDisburser.trim(),
      note: outNote.trim(),
      createdAt: new Date().toISOString()
    };

    await onAddStockOut(entry);
    setIsStockOutModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 
            className="font-bold text-slate-800 dark:text-white flex items-center gap-2"
            style={{ fontSize: '29px', fontFamily: 'Sarabun' }}
          >
            <BookOpenText className="w-7 h-7 text-amber-500" />
            สมุดคุมบัญชีพัสดุ (Stock Card)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            แบบพิมพ์มาตรฐานงานพัสดุและระเบียนคุม บัญชีรับ-จ่าย-คงเหลือ {selectedFiscalYear !== 'all' && selectedFiscalYear !== 'custom' ? `ประจำปีงบประมาณ พ.ศ. ${selectedFiscalYear}` : 'ทุกปีงบประมาณ'}
          </p>
        </div>
      </div>

      {currentMaterial && (
        <>
          {/* Official Stock Card Top Profile Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-base font-mono shrink-0">
                  {currentMaterial.id}
                </div>
                <div>
                  <h3 
                    className="font-bold text-slate-900 dark:text-white"
                    style={{ fontSize: '25px', lineHeight: '31px', fontFamily: 'Sarabun', width: '550px' }}
                  >
                    {currentMaterial.name}
                  </h3>
                  <div 
                    className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5"
                    style={{ width: '501px', height: '21px' }}
                  >
                    <span style={{ height: '20px', width: '150px' }}>หมวดหมู่: {currentMaterial.category}</span>
                    <span>•</span>
                    <span style={{ width: '150px' }}>หน่วยนับ: {currentMaterial.unit}</span>
                    <span>•</span>
                    <span style={{ width: '150px' }}>ราคาต่อหน่วย: ฿{(currentMaterial?.unitPrice || 0).toLocaleString()} บาท</span>
                  </div>
                </div>
              </div>

              {/* Material Selector & Print PDF Actions (ย้ายแผงควบคุม เลือกพัสดุ มาแทนที่ตรง บันทึกรับเข้า และบันทึกจ่ายออก) */}
              <div 
                className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end"
                style={{ lineHeight: '19px' }}
              >
                <div className="flex items-center gap-2" style={{ width: '358.922px' }}>
                  <label 
                    htmlFor="ledger-material-select" 
                    className="text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0"
                    style={{ fontFamily: 'Sarabun', width: '53.4219px', height: '32px' }}
                  >
                    เลือกพัสดุ:
                  </label>
                  <select
                    id="ledger-material-select"
                    value={currentMaterial?.id || ''}
                    onChange={e => onSelectMaterial(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs max-w-xs cursor-pointer text-slate-800 dark:text-slate-100"
                    style={{ fontFamily: 'Sarabun', width: '300px' }}
                  >
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        [{m.id}] {m.name} (คงเหลือ: {m.currentStock} {m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (currentMaterial) {
                      exportStockCardToExcel(currentMaterial, ledgerRows, selectedFiscalYear);
                    }
                  }}
                  title="ส่งออกสมุดคุมบัญชีพัสดุนี้เป็นไฟล์ Excel (.xlsx)"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  style={{ fontFamily: 'Sarabun', width: '117.484px' }}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>ส่งออก Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOfficialPdfModalOpen(true)}
                  title="พิมพ์ / ดาวน์โหลดสมุดคุมบัญชีพัสดุเป็นไฟล์ PDF"
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  style={{ fontFamily: 'Sarabun' }}
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์เป็นไฟล์ PDF</span>
                </button>
              </div>
            </div>

            {/* Official Stock Card Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[11px]">สถานที่จัดเก็บ:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {currentMaterial.location && currentMaterial.location !== 'ตู้พัสดุ A1' && currentMaterial.location !== 'ตู้พัสดุA1'
                    ? currentMaterial.location
                    : 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">ปริมาณต่ำสุด-สูงสุด:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {currentMaterial.minQty} - {currentMaterial.maxQty} {currentMaterial.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">ยอดคงเหลือปัจจุบัน:</span>
                <span className="font-bold text-amber-600 text-sm">
                  {currentMaterial.currentStock} {currentMaterial.unit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">มูลค่าคงเหลือในคลัง:</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm font-mono">
                  ฿{(((currentMaterial?.currentStock || 0) * (currentMaterial?.unitPrice || 0)) || 0).toLocaleString()}
                </span>
              </div>
            </div>

          </div>

          {/* Date Range Filter Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  เลือกปีงบประมาณและช่วงเวลา:
                </span>
                {/* Year indicator badge */}
                {selectedFiscalYear !== 'all' && selectedFiscalYear !== 'custom' && (
                  <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-full text-[11px] font-bold">
                    ปีงบประมาณ {selectedFiscalYear} (1 ต.ค. {Number(selectedFiscalYear) - 1} - 30 ก.ย. {selectedFiscalYear})
                  </span>
                )}
              </div>

              {/* Fiscal Year quick dropdown + Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  id="filter-fiscal-year-select"
                  value={selectedFiscalYear}
                  onChange={e => handleFiscalYearChange(e.target.value)}
                  className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="all">ทุกปีงบประมาณ (ทั้งหมด)</option>
                  {fiscalYearsList.map(fy => (
                    <option key={fy} value={String(fy)}>
                      ปีงบประมาณ {fy}
                    </option>
                  ))}
                </select>

                {[
                  { key: 'all', label: 'ทั้งหมด' },
                  { key: 'today', label: 'วันนี้' },
                  { key: 'this_month', label: 'เดือนนี้' },
                  { key: 'last_month', label: 'เดือนที่แล้ว' },
                  { key: 'custom', label: 'กำหนดช่วงวันเอง' }
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePresetChange(p.key as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      dateFilterPreset === p.key
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Dates & Period Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/80 items-center text-xs">
              <div className="md:col-span-5 flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 block mb-0.5">ตั้งแต่วันที่:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      setDateFilterPreset('custom');
                    }}
                    className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 block mb-0.5">ถึงวันที่:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      setDateFilterPreset('custom');
                    }}
                    className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => handlePresetChange('all')}
                    className="mt-3 px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-500 rounded-lg text-xs"
                    title="ล้างตัวกรองวันที่"
                  >
                    ล้าง
                  </button>
                )}
              </div>

              {/* Summary of this period */}
              <div className="md:col-span-7 grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">ยอดยกมา:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {broughtForwardQty}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 block">รับเข้า:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    +{periodInQty}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 block">จ่ายออก:</span>
                  <span className="font-bold text-rose-600 font-mono">
                    -{periodOutQty}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 block">ยอดคงเหลือ:</span>
                  <span className="font-bold text-amber-600 font-mono">
                    {runningBalance} {currentMaterial.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                ตารางบันทึกการรับ - จ่าย - คงเหลือ (สมุดคุมพัสดุ)
              </h4>
              <span className="text-xs text-slate-400">
                รวม {ledgerRows.length} รายการ (ตามช่วงเวลาที่เลือก)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3">วัน/เดือน/ปี</th>
                    <th className="py-2.5 px-3">เลขที่เอกสาร</th>
                    <th className="py-2.5 px-3">รายการ / แหล่งที่มา-ผู้เบิก</th>
                    <th className="py-2.5 px-3 text-center bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                      รับ (จำนวน)
                    </th>
                    <th className="py-2.5 px-3 text-center bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300">
                      จ่าย (จำนวน)
                    </th>
                    <th className="py-2.5 px-3 text-center bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 font-bold">
                      คงเหลือ ({currentMaterial.unit})
                    </th>
                    <th className="py-2.5 px-3 text-right">มูลค่ารวม (บาท)</th>
                    <th className="py-2.5 px-3">ผู้บันทึก / เจ้าหน้าที่</th>
                    <th className="py-2.5 px-3">หมายเหตุ</th>
                    {isAdmin && (
                      <th className="py-2.5 px-3 text-center w-16">จัดการ</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {ledgerRows.map(row => {
                    if (row.type === 'BALANCE_FORWARD') {
                      return (
                        <tr key={row.id} className="bg-amber-50/60 dark:bg-amber-950/30 font-semibold border-b border-amber-200 dark:border-amber-800">
                          <td className="py-2.5 px-3 whitespace-nowrap text-amber-900 dark:text-amber-300">
                            {row.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            [ยอดยกมา]
                          </td>
                          <td className="py-2.5 px-3 text-amber-900 dark:text-amber-200">
                            {row.description}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                          <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-700 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-900/30">
                            {row.balanceQty}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-700 dark:text-amber-300">
                            ฿{(row.balanceValuation || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {row.officer}
                          </td>
                          <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400 italic text-[11px]">
                            {row.note}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-center text-slate-300 dark:text-slate-600">-</td>
                          )}
                        </tr>
                      );
                    }

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          {row.docNo}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {row.description}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/10">
                          {row.inQty != null && Number(row.inQty) > 0 ? `+${row.inQty}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-rose-600 bg-rose-50/30 dark:bg-rose-950/10">
                          {row.outQty != null && Number(row.outQty) > 0 ? `-${row.outQty}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white bg-amber-50/30 dark:bg-amber-950/10">
                          {row.balanceQty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          ฿{(row.balanceValuation || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {cleanOfficerName(row.officer)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 italic text-[11px]">
                          {row.note || '-'}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setEntryToDelete({
                                id: row.id,
                                type: row.type as 'IN' | 'OUT',
                                docNo: row.docNo,
                                desc: row.description,
                                qty: row.inQty || row.outQty
                              })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md transition cursor-pointer"
                              title="ลบรายการนี้ออกจากระบบและปรับปรุงสต็อก"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>ลบ</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {ledgerRows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="py-8 text-center text-slate-400">
                        ยังไม่มีประวัติการรับเข้าหรือจ่ายออกสำหรับพัสดุรายการนี้
                      </td>
                    </tr>
                  )}
                </tbody>

                {ledgerRows.length > 0 && (
                  <tfoot className="bg-slate-100/90 dark:bg-slate-750 font-semibold border-t-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                        สรุปยอดสุทธิ ({startDate || endDate ? 'ตามช่วงเวลาที่เลือก' : 'ยอดสะสม'}):
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-bold bg-emerald-50/50 dark:bg-emerald-950/20">
                        +{periodInQty}
                      </td>
                      <td className="py-2.5 px-3 text-center text-rose-600 font-bold bg-rose-50/50 dark:bg-rose-950/20">
                        -{periodOutQty}
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-600 dark:text-amber-400 font-bold bg-amber-50/50 dark:bg-amber-950/20">
                        {runningBalance} {currentMaterial.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ฿{Math.max(0, runningBalance * (currentMaterial?.unitPrice || 0)).toLocaleString()}
                      </td>
                      <td colSpan={isAdmin ? 3 : 2} className="py-2.5 px-3 text-slate-400 text-[11px] italic">
                        บวกลบตรงตามความเป็นจริง
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal: Stock In (รับเข้า) */}
      {isStockInModalOpen && currentMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                บันทึกรับเข้าพัสดุ (Stock In)
              </h3>
              <button 
                onClick={() => setIsStockInModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl text-xs text-emerald-800 dark:text-emerald-200">
              วัสดุ: <span className="font-bold">{currentMaterial.name} ({currentMaterial.id})</span>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    วันที่รับเข้า *
                  </label>
                  <input
                    type="date"
                    value={inDate}
                    onChange={e => setInDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    เลขที่ใบส่งของ / PO *
                  </label>
                  <input
                    type="text"
                    value={inDocNo}
                    onChange={e => setInDocNo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    จำนวนที่รับเข้า ({currentMaterial.unit}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={inQty}
                    onChange={e => setInQty(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    required
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
                    value={inUnitPrice}
                    onChange={e => setInUnitPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  บริษัท / ร้านค้าผู้จัดส่ง *
                </label>
                <input
                  type="text"
                  value={inSupplier}
                  onChange={e => setInSupplier(e.target.value)}
                  placeholder="เช่น บจก. สารคามเครื่องเขียน"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เจ้าหน้าที่ผู้รับพัสดุ *
                </label>
                <input
                  type="text"
                  value={inReceiver}
                  onChange={e => setInReceiver(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={inNote}
                  onChange={e => setInNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsStockInModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  บันทึกรับเข้าคลัง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Stock Out (จ่ายออก) */}
      {isStockOutModalOpen && currentMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-600" />
                บันทึกจ่ายออกพัสดุ (Stock Out)
              </h3>
              <button 
                onClick={() => setIsStockOutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex justify-between items-center">
              <span>วัสดุ: <strong className="font-bold">{currentMaterial.name}</strong></span>
              <span>คงเหลือ: <strong className="font-bold">{currentMaterial.currentStock} {currentMaterial.unit}</strong></span>
            </div>

            <form onSubmit={handleStockOutSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    วันที่จ่ายออก *
                  </label>
                  <input
                    type="date"
                    value={outDate}
                    onChange={e => setOutDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    เลขที่ใบเบิก *
                  </label>
                  <input
                    type="text"
                    value={outDocNo}
                    onChange={e => setOutDocNo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  จำนวนที่จ่ายออก ({currentMaterial.unit}) * (สูงสุด {currentMaterial.currentStock})
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentMaterial.currentStock}
                  value={outQty}
                  onChange={e => setOutQty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อผู้รับพัสดุ *
                  </label>
                  <input
                    type="text"
                    value={outRequester}
                    onChange={e => setOutRequester(e.target.value)}
                    placeholder="เช่น ดร.สมชาย ใจภักดี"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    สังกัด / สาขาวิชา *
                  </label>
                  <input
                    type="text"
                    value={outDept}
                    onChange={e => setOutDept(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เจ้าหน้าที่ผู้จ่ายพัสดุ *
                </label>
                <input
                  type="text"
                  value={outDisburser}
                  onChange={e => setOutDisburser(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={outNote}
                  onChange={e => setOutNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsStockOutModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  ตัดจ่ายพัสดุ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Entry */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  ยืนยันการลบรายการสมุดคุม
                </h3>
                <p className="text-xs text-slate-500">
                  {entryToDelete.type === 'IN' ? 'รายการรับเข้าพัสดุ (Stock In)' : 'รายการจ่ายออกพัสดุ (Stock Out)'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">เลขที่เอกสาร:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{entryToDelete.docNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">รายการ/ผู้รับ:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{entryToDelete.desc}</span>
              </div>
              {entryToDelete.qty && (
                <div className="flex justify-between">
                  <span className="text-slate-500">จำนวน:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{entryToDelete.qty} {currentMaterial?.unit || 'หน่วย'}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {entryToDelete.type === 'OUT' 
                ? 'ระบบจะลบรายการนี้ออกจากสมุดคุม และคืนยอดสต็อกคงเหลือกลับเข้าคลังให้ถูกต้องโดยอัตโนมัติ' 
                : 'ระบบจะลบรายการรับเข้านี้ออกจากสมุดคุม และปรับลดยอดสต็อกคงเหลือ'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!entryToDelete) return;
                  try {
                    setIsDeleting(true);
                    if (entryToDelete.type === 'IN') {
                      await onDeleteStockIn?.(entryToDelete.id);
                    } else {
                      await onDeleteStockOut?.(entryToDelete.id);
                    }
                  } catch (e) {
                    console.error('Delete error:', e);
                  } finally {
                    setIsDeleting(false);
                    setEntryToDelete(null);
                  }
                }}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'กำลังลบ...' : 'ยืนยันลบรายการ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Stock Card Print / PDF Modal */}
      {isOfficialPdfModalOpen && currentMaterial && (
        <OfficialStockCardModal
          isOpen={isOfficialPdfModalOpen}
          onClose={() => setIsOfficialPdfModalOpen(false)}
          material={currentMaterial}
          ledgerRows={ledgerRows as any}
          fiscalYear={selectedFiscalYear}
          startDate={startDate}
          endDate={endDate}
          broughtForwardQty={broughtForwardQty}
          periodInQty={periodInQty}
          periodOutQty={periodOutQty}
          runningBalance={runningBalance}
          adminName="กาญจนภาษณ์ มาตบุรม"
          isAdmin={isAdmin}
        />
      )}

    </div>
  );
};
