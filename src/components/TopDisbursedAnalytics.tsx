import { FC, useState, useMemo } from 'react';
import { Material, Order, StockOut } from '../types';
import { getThaiFiscalYear } from '../services/storageService';
import { 
  Trophy, 
  TrendingUp, 
  Calendar, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  PlusCircle, 
  Package, 
  Layers, 
  Building2, 
  Flame, 
  CheckCircle2,
  ChevronRight,
  ArrowUpDown,
  Coins,
  FileText
} from 'lucide-react';

interface TopDisbursedAnalyticsProps {
  materials: Material[];
  orders: Order[];
  stockOutLogs?: StockOut[];
  onSelectMaterialForLedger: (materialId: string) => void;
  onAddMaterialToCart: (material: Material) => void;
  onNavigateToRequisition?: () => void;
}

export type TimePreset = 
  | 'fy_to_date'     // ตั้งแต่ต้นปีงบถึงปัจจุบัน (ค่าเริ่มต้น)
  | 'select_fy'      // เลือกปีงบประมาณเฉพาะ (เช่น 2569, 2568)
  | 'this_month'     // เดือนปัจจุบัน
  | 'last_month'     // เดือนที่แล้ว
  | 'select_month'   // เลือกเดือนและปี
  | 'quarter'        // เลือกไตรมาสราชการ (Q1-Q4)
  | 'custom'         // กำหนดช่วงวันที่เอง
  | 'all_time';      // ทั้งหมด

export type SortMetric = 'quantity' | 'amount' | 'frequency';

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const TopDisbursedAnalytics: FC<TopDisbursedAnalyticsProps> = ({
  materials,
  orders,
  stockOutLogs = [],
  onSelectMaterialForLedger,
  onAddMaterialToCart,
  onNavigateToRequisition
}) => {
  // Current time calculations
  const now = new Date();
  const currentThaiFY = useMemo(() => getThaiFiscalYear(now), [now]);
  
  const getTodayStr = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };
  const todayStr = getTodayStr();

  // State
  const [timePreset, setTimePreset] = useState<TimePreset>('fy_to_date');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(currentThaiFY);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [selectedMonthYear, setSelectedMonthYear] = useState<number>(now.getFullYear() + 543);
  
  // Custom date range
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Filters & Sorting recommendations
  const [sortMetric, setSortMetric] = useState<SortMetric>('quantity');
  const [topLimit, setTopLimit] = useState<number>(10);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ทั้งหมด');
  const [viewStyle, setViewStyle] = useState<'ranking_table' | 'podium_cards'>('ranking_table');

  // Available Fiscal Years for selection
  const availableFiscalYears = useMemo(() => {
    const set = new Set<number>();
    set.add(currentThaiFY + 1);
    set.add(currentThaiFY);
    set.add(2569);
    set.add(2568);
    set.add(2567);
    set.add(2566);

    stockOutLogs.forEach(s => {
      if (s.date) set.add(getThaiFiscalYear(s.date));
    });
    orders.forEach(o => {
      const d = o.disbursedDate || o.date;
      if (d) set.add(getThaiFiscalYear(d));
    });

    return Array.from(set).sort((a, b) => b - a);
  }, [currentThaiFY, stockOutLogs, orders]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [materials]);

  // Departments list from orders and stockOutLogs
  const departments = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.department) set.add(o.department);
    });
    stockOutLogs.forEach(s => {
      if (s.department) set.add(s.department);
    });
    return ['ทั้งหมด', ...Array.from(set)];
  }, [orders, stockOutLogs]);

  // Calculate Active Date Range & Descriptive Label
  const { dateRange, periodLabel } = useMemo(() => {
    let start = '';
    let end = '';
    let label = '';

    if (timePreset === 'fy_to_date') {
      const startAD = selectedFiscalYear - 543 - 1;
      start = `${startAD}-10-01`;
      end = todayStr;
      label = `ต้นปีงบประมาณ ${selectedFiscalYear} ถึงปัจจุบัน (1 ต.ค. ${selectedFiscalYear - 1} - ${formatThaiDate(todayStr)})`;
    } else if (timePreset === 'select_fy') {
      const startAD = selectedFiscalYear - 543 - 1;
      const endAD = selectedFiscalYear - 543;
      start = `${startAD}-10-01`;
      end = `${endAD}-09-30`;
      label = `ปีงบประมาณ ${selectedFiscalYear} เต็มปี (1 ต.ค. ${selectedFiscalYear - 1} - 30 ก.ย. ${selectedFiscalYear})`;
    } else if (timePreset === 'this_month') {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      start = `${y}-${String(m).padStart(2, '0')}-01`;
      end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      label = `เดือนปัจจุบัน (${THAI_MONTHS_FULL[m - 1]} ${y + 543})`;
    } else if (timePreset === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      start = `${y}-${String(m).padStart(2, '0')}-01`;
      end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      label = `เดือนที่แล้ว (${THAI_MONTHS_FULL[m - 1]} ${y + 543})`;
    } else if (timePreset === 'select_month') {
      const yAD = selectedMonthYear - 543;
      const m = selectedMonth;
      const lastDay = new Date(yAD, m, 0).getDate();
      start = `${yAD}-${String(m).padStart(2, '0')}-01`;
      end = `${yAD}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      label = `ประจำเดือน ${THAI_MONTHS_FULL[m - 1]} ${selectedMonthYear}`;
    } else if (timePreset === 'quarter') {
      const fyAD = selectedFiscalYear - 543;
      if (selectedQuarter === 1) {
        start = `${fyAD - 1}-10-01`;
        end = `${fyAD - 1}-12-31`;
        label = `ไตรมาสที่ 1 ปีงบประมาณ ${selectedFiscalYear} (ต.ค. - ธ.ค. ${selectedFiscalYear - 1})`;
      } else if (selectedQuarter === 2) {
        start = `${fyAD}-01-01`;
        end = `${fyAD}-03-31`;
        label = `ไตรมาสที่ 2 ปีงบประมาณ ${selectedFiscalYear} (ม.ค. - มี.ค. ${selectedFiscalYear})`;
      } else if (selectedQuarter === 3) {
        start = `${fyAD}-04-01`;
        end = `${fyAD}-06-30`;
        label = `ไตรมาสที่ 3 ปีงบประมาณ ${selectedFiscalYear} (เม.ย. - มิ.ย. ${selectedFiscalYear})`;
      } else {
        start = `${fyAD}-07-01`;
        end = `${fyAD}-09-30`;
        label = `ไตรมาสที่ 4 ปีงบประมาณ ${selectedFiscalYear} (ก.ค. - ก.ย. ${selectedFiscalYear})`;
      }
    } else if (timePreset === 'custom') {
      start = customStartDate;
      end = customEndDate;
      label = customStartDate && customEndDate 
        ? `ช่วงวันที่ ${formatThaiDate(customStartDate)} ถึง ${formatThaiDate(customEndDate)}`
        : 'กำหนดช่วงวันที่เอง';
    } else {
      label = 'ประวัติการเบิกจ่ายทั้งหมดในระบบ (All Time)';
    }

    return {
      dateRange: { start, end },
      periodLabel: label
    };
  }, [timePreset, selectedFiscalYear, selectedQuarter, selectedMonth, selectedMonthYear, customStartDate, customEndDate, todayStr, now]);

  // Consolidate Disbursement Data from StockOutLogs + Disbursed Orders
  const consolidatedDisbursements = useMemo(() => {
    interface DisbursedRecord {
      materialId: string;
      materialName: string;
      category: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalPrice: number;
      date: string;
      department: string;
      docNo: string;
      requesterName: string;
    }

    const records: DisbursedRecord[] = [];
    const recordedDocNos = new Set<string>();

    // 1. Stock Out Logs
    stockOutLogs.forEach(log => {
      if (log.requisitionDocNo) {
        recordedDocNos.add(log.requisitionDocNo.trim());
      }
      records.push({
        materialId: log.materialId,
        materialName: log.materialName,
        category: log.category || '',
        quantity: Number(log.quantity) || 0,
        unit: log.unit || 'หน่วย',
        unitPrice: Number(log.unitPrice) || 0,
        totalPrice: Number(log.totalPrice) || (Number(log.quantity) * Number(log.unitPrice)) || 0,
        date: log.date || '',
        department: log.department || 'ไม่ระบุหน่วยงาน',
        docNo: log.requisitionDocNo || '-',
        requesterName: log.requesterName || '-'
      });
    });

    // 2. Disbursed Orders (Include only if not already covered in stockOutLogs to prevent duplicate counting)
    orders
      .filter(o => o.status === 'เบิกจ่ายแล้ว')
      .forEach(order => {
        const docTrimmed = order.docNo?.trim();
        if (docTrimmed && recordedDocNos.has(docTrimmed)) {
          return; // Already accounted for in stockOutLogs
        }

        const date = order.disbursedDate || order.date || '';
        order.items?.forEach(item => {
          records.push({
            materialId: item.materialId,
            materialName: item.materialName,
            category: item.category || '',
            quantity: Number(item.quantity) || 0,
            unit: item.unit || 'หน่วย',
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || (Number(item.quantity) * Number(item.unitPrice)) || 0,
            date: date,
            department: order.department || 'ไม่ระบุหน่วยงาน',
            docNo: order.docNo || '-',
            requesterName: order.requesterName || '-'
          });
        });
      });

    return records;
  }, [stockOutLogs, orders]);

  // Filter and Aggregate Disbursed Items for the Selected Timeframe
  const { rankedMaterials, totalDisbursedQty, totalDisbursedVal, uniqueRequisitionCount } = useMemo(() => {
    const { start, end } = dateRange;

    // Filter by Date, Category, and Department
    const filteredRecords = consolidatedDisbursements.filter(record => {
      // Date filter
      if (start && record.date && record.date < start) return false;
      if (end && record.date && record.date > end) return false;

      // Category filter
      if (selectedCategory !== 'ทั้งหมด' && record.category !== selectedCategory) return false;

      // Department filter
      if (selectedDepartment !== 'ทั้งหมด' && record.department !== selectedDepartment) return false;

      return true;
    });

    // Group by materialId
    const map = new Map<string, {
      materialId: string;
      materialName: string;
      category: string;
      totalQty: number;
      totalValue: number;
      frequency: number;
      unit: string;
      departments: Set<string>;
      uniqueDocs: Set<string>;
    }>();

    let sumQty = 0;
    let sumVal = 0;
    const allUniqueDocs = new Set<string>();

    filteredRecords.forEach(rec => {
      sumQty += rec.quantity;
      sumVal += rec.totalPrice;
      if (rec.docNo && rec.docNo !== '-') {
        allUniqueDocs.add(rec.docNo);
      }

      const existing = map.get(rec.materialId);
      if (existing) {
        existing.totalQty += rec.quantity;
        existing.totalValue += rec.totalPrice;
        existing.frequency += 1;
        if (rec.department) existing.departments.add(rec.department);
        if (rec.docNo && rec.docNo !== '-') existing.uniqueDocs.add(rec.docNo);
      } else {
        const depts = new Set<string>();
        if (rec.department) depts.add(rec.department);
        const docs = new Set<string>();
        if (rec.docNo && rec.docNo !== '-') docs.add(rec.docNo);

        map.set(rec.materialId, {
          materialId: rec.materialId,
          materialName: rec.materialName,
          category: rec.category,
          totalQty: rec.quantity,
          totalValue: rec.totalPrice,
          frequency: 1,
          unit: rec.unit,
          departments: depts,
          uniqueDocs: docs
        });
      }
    });

    // Enrich with Material master catalog (photos, safety stock, latest master name)
    const list = Array.from(map.values()).map(item => {
      const mat = materials.find(m => m.id === item.materialId);
      return {
        ...item,
        material: mat,
        name: mat?.name || item.materialName,
        category: mat?.category || item.category,
        unit: mat?.unit || item.unit,
        unitPrice: mat?.unitPrice || 0,
        imageUrl: mat?.imageUrl || '',
        currentStock: mat?.currentStock ?? 0,
        minQty: mat?.minQty ?? 5,
        refillStatus: mat?.refillStatus || 'OK'
      };
    });

    // Sort by chosen metric
    list.sort((a, b) => {
      if (sortMetric === 'quantity') {
        return b.totalQty - a.totalQty || b.totalValue - a.totalValue;
      }
      if (sortMetric === 'amount') {
        return b.totalValue - a.totalValue || b.totalQty - a.totalQty;
      }
      return b.frequency - a.frequency || b.totalQty - a.totalQty;
    });

    return {
      rankedMaterials: list,
      totalDisbursedQty: sumQty,
      totalDisbursedVal: sumVal,
      uniqueRequisitionCount: allUniqueDocs.size
    };
  }, [consolidatedDisbursements, dateRange, selectedCategory, selectedDepartment, materials, sortMetric]);

  // Max values for relative percentage progress bars
  const maxDisbursedQty = rankedMaterials.length > 0 ? rankedMaterials[0].totalQty : 1;
  const maxDisbursedVal = rankedMaterials.length > 0 ? Math.max(...rankedMaterials.map(m => m.totalValue)) : 1;

  // Sliced Top N items
  const displayMaterials = useMemo(() => {
    return rankedMaterials.slice(0, topLimit);
  }, [rankedMaterials, topLimit]);

  // Export to CSV Function
  const handleExportCSV = () => {
    if (displayMaterials.length === 0) return;

    const headers = [
      'อันดับ',
      'รหัสพัสดุ',
      'ชื่อพัสดุ',
      'หมวดหมู่',
      'จำนวนที่เบิกจ่าย',
      'หน่วยนับ',
      'มูลค่าเบิกจ่ายรวม (บาท)',
      'จำนวนครั้งที่เบิก',
      'สต็อกคงเหลือปัจจุบัน',
      'หน่วยงานที่เบิก'
    ];

    const rows = displayMaterials.map((item, idx) => [
      idx + 1,
      `"${item.materialId}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      item.totalQty,
      `"${item.unit}"`,
      item.totalValue.toFixed(2),
      item.frequency,
      item.currentStock,
      `"${Array.from(item.departments).join(', ')}"`
    ]);

    const csvContent = '\uFEFF' + [
      `"รายงานสถิติการเบิกจ่ายพัสดุ ${periodLabel}"`,
      `"จัดอันดับตาม: ${sortMetric === 'quantity' ? 'จำนวนชิ้นที่เบิกจ่าย' : sortMetric === 'amount' ? 'มูลค่าเบิกจ่ายรวม' : 'ความถี่ในการเบิก'}"`,
      `"ส่งออกเมื่อ: ${new Date().toLocaleString('th-TH')}"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `COPAG_Top_Disbursed_${timePreset}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
      
      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">
              สถิติการเบิกจ่ายวัสดุยอดนิยม {topLimit} ลำดับแรก (Top Disbursed Materials)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
              วิทยาลัยการเมืองการปกครอง
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>แสดงข้อมูล:</span>
            <strong className="text-amber-700 dark:text-amber-300">{periodLabel}</strong>
          </p>
        </div>

        {/* Action Controls: Export CSV & View Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl text-xs">
            <button
              onClick={() => setViewStyle('ranking_table')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                viewStyle === 'ranking_table' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-300'
              }`}
            >
              ตารางพร้อมกราฟ
            </button>
            <button
              onClick={() => setViewStyle('podium_cards')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                viewStyle === 'podium_cards' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-300'
              }`}
            >
              การ์ดโพเดียม
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={displayMaterials.length === 0}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            title="ส่งออกรายงานสถิติเป็นไฟล์ CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Timeframe Controls (Comprehensive Selector Bar) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3.5">
        
        {/* Row 1: Timeframe Selection Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-500 font-semibold mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>ช่วงเวลา:</span>
          </span>

          <button
            onClick={() => setTimePreset('fy_to_date')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'fy_to_date'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            ⭐ ต้นปีงบฯ ถึงปัจจุบัน
          </button>

          <button
            onClick={() => setTimePreset('select_fy')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'select_fy'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            เลือกปีงบประมาณ
          </button>

          <button
            onClick={() => setTimePreset('this_month')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'this_month'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            เดือนนี้
          </button>

          <button
            onClick={() => setTimePreset('last_month')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'last_month'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            เดือนที่แล้ว
          </button>

          <button
            onClick={() => setTimePreset('select_month')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'select_month'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            เลือกรายเดือน
          </button>

          <button
            onClick={() => setTimePreset('quarter')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'quarter'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            ไตรมาสราชการ
          </button>

          <button
            onClick={() => setTimePreset('custom')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'custom'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            กำหนดวันเอง
          </button>

          <button
            onClick={() => setTimePreset('all_time')}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
              timePreset === 'all_time'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            ทั้งหมด
          </button>
        </div>

        {/* Row 2: Secondary Contextual Selectors based on Timeframe */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          
          {/* If selecting FY or FY to Date */}
          {(timePreset === 'select_fy' || timePreset === 'fy_to_date' || timePreset === 'quarter') && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 font-medium">ปีงบประมาณ:</span>
              <select
                value={selectedFiscalYear}
                onChange={e => setSelectedFiscalYear(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer"
              >
                {availableFiscalYears.map(fy => (
                  <option key={fy} value={fy}>พ.ศ. {fy}</option>
                ))}
              </select>
            </div>
          )}

          {/* If selecting Quarter */}
          {timePreset === 'quarter' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 font-medium">ไตรมาส:</span>
              <select
                value={selectedQuarter}
                onChange={e => setSelectedQuarter(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value={1}>ไตรมาส 1 (ต.ค. - ธ.ค.)</option>
                <option value={2}>ไตรมาส 2 (ม.ค. - มี.ค.)</option>
                <option value={3}>ไตรมาส 3 (เม.ย. - มิ.ย.)</option>
                <option value={4}>ไตรมาส 4 (ก.ค. - ก.ย.)</option>
              </select>
            </div>
          )}

          {/* If selecting Specific Month */}
          {timePreset === 'select_month' && (
            <>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">เดือน:</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer"
                >
                  {THAI_MONTHS_FULL.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">ปี พ.ศ.:</span>
                <select
                  value={selectedMonthYear}
                  onChange={e => setSelectedMonthYear(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer"
                >
                  {availableFiscalYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* If Custom Date Range */}
          {timePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-slate-500">ตั้งแต่วันที่:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              />
              <span className="text-slate-400">ถึง:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              />
            </div>
          )}

          {/* Sort By Metric */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">จัดอันดับตาม:</span>
            <select
              value={sortMetric}
              onChange={e => setSortMetric(e.target.value as SortMetric)}
              className="bg-transparent font-bold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer"
            >
              <option value="quantity">จำนวนชิ้นที่เบิกจ่าย (มากที่สุด)</option>
              <option value="amount">มูลค่าเบิกจ่ายรวม (บาท)</option>
              <option value="frequency">ความถี่ในการขอเบิก (จำนวนครั้ง)</option>
            </select>
          </div>

          {/* Top Limit (5, 10, 15, 20) */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-medium">แสดง:</span>
            <select
              value={topLimit}
              onChange={e => setTopLimit(Number(e.target.value))}
              className="bg-transparent font-bold text-amber-600 dark:text-amber-400 focus:outline-hidden cursor-pointer"
            >
              <option value={5}>Top 5 ลำดับ</option>
              <option value={10}>Top 10 ลำดับ</option>
              <option value={15}>Top 15 ลำดับ</option>
              <option value={20}>Top 20 ลำดับ</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">หมวดหมู่:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer max-w-[140px] truncate"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          {departments.length > 2 && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">หน่วยงาน:</span>
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 dark:text-white focus:outline-hidden cursor-pointer max-w-[150px] truncate"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* 3. Summary Metric Cards for the Selected Period */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-semibold">
            <Flame className="w-4 h-4" />
            <span>ยอดเบิกจ่ายรวม</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {totalDisbursedQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">ชิ้น</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            จาก {rankedMaterials.length} รายการพัสดุ
          </div>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <Coins className="w-4 h-4" />
            <span>มูลค่าเบิกจ่ายรวม</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1">
            ฿{totalDisbursedVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            ตามราคามาตรฐานพัสดุ
          </div>
        </div>

        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/40">
          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 text-xs font-semibold">
            <FileText className="w-4 h-4" />
            <span>ใบเบิกที่จ่ายแล้ว</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white mt-1">
            {uniqueRequisitionCount} <span className="text-xs font-normal text-slate-500">ฉบับ</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            อนุมัติและตัดยอดเรียบร้อย
          </div>
        </div>

        <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/40">
          <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 text-xs font-semibold">
            <Trophy className="w-4 h-4" />
            <span>อันดับ 1 เบิกสูงสุด</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-white mt-1 truncate" title={displayMaterials[0]?.name || '-'}>
            {displayMaterials[0] ? displayMaterials[0].name : '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {displayMaterials[0] ? `${displayMaterials[0].totalQty} ${displayMaterials[0].unit} (${totalDisbursedQty > 0 ? ((displayMaterials[0].totalQty / totalDisbursedQty) * 100).toFixed(1) : 0}%)` : 'ยังไม่มีข้อมูล'}
          </div>
        </div>
      </div>

      {/* 4. Main Ranking Content */}
      {displayMaterials.length === 0 ? (
        <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
              ไม่พบประวัติการเบิกจ่ายพัสดุในช่วงเวลาที่เลือก
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              {periodLabel} ยังไม่มีรายการตัดจ่ายหรือใบเบิกที่ได้รับสถานะ "เบิกจ่ายแล้ว" คุณสามารถเลือกช่วงเวลาอื่น หรือสร้างใบเบิกใหม่
            </p>
          </div>
          {onNavigateToRequisition && (
            <button
              onClick={onNavigateToRequisition}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>สร้างใบเบิกพัสดุใหม่</span>
            </button>
          )}
        </div>
      ) : viewStyle === 'podium_cards' ? (
        /* Podium View: Top 3 Highlight Cards followed by 4-10 */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {displayMaterials.slice(0, 3).map((item, idx) => {
              const medalInfo = [
                { badge: '🥇 อันดับ 1', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-800 dark:text-amber-200' },
                { badge: '🥈 อันดับ 2', bg: 'bg-slate-100 dark:bg-slate-800/80', border: 'border-slate-300 dark:border-slate-600', text: 'text-slate-700 dark:text-slate-200' },
                { badge: '🥉 อันดับ 3', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-300 dark:border-orange-800', text: 'text-orange-800 dark:text-orange-200' }
              ][idx];

              const percentOfTotal = totalDisbursedQty > 0 ? (item.totalQty / totalDisbursedQty) * 100 : 0;

              return (
                <div 
                  key={item.materialId}
                  className={`p-4 rounded-2xl border ${medalInfo.border} ${medalInfo.bg} shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden transition-all hover:shadow-md`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 dark:bg-slate-900/90 shadow-2xs">
                      {medalInfo.badge}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                      {item.materialId}
                    </span>
                  </div>

                  {/* Product Photo & Details complying with UI Styling Rule */}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.imageUrl && item.imageUrl.trim() ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Package className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {item.category}
                      </div>
                      {/* Product Name styled strictly per rule: 18px / 1.1rem, font-weight 600, dark clear text */}
                      <h4 
                        className="font-semibold text-slate-900 dark:text-white line-clamp-2 mt-0.5 leading-snug"
                        style={{ fontSize: '18px', fontWeight: 600 }}
                        title={item.name}
                      >
                        {item.name}
                      </h4>
                    </div>
                  </div>

                  {/* Quantity and Value Stats */}
                  <div className="bg-white/80 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-100 dark:border-slate-700/80 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">ยอดเบิกจ่าย:</span>
                      <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                        {item.totalQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>มูลค่ารวม:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        ฿{item.totalValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                      <div 
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(8, percentOfTotal))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{percentOfTotal.toFixed(1)}% ของยอดรวม</span>
                      <span>เบิก {item.frequency} ครั้ง</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => onSelectMaterialForLedger(item.materialId)}
                      className="text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>ดู Stock Card</span>
                    </button>
                    {item.material && item.currentStock > 0 && (
                      <button
                        onClick={() => onAddMaterialToCart(item.material!)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition cursor-pointer text-xs"
                      >
                        เบิกเพิ่ม
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ranks 4-10 in table format below podium */}
          {displayMaterials.length > 3 && (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="pb-3 px-3 text-center">อันดับ</th>
                    <th className="pb-3 px-3">พัสดุ</th>
                    <th className="pb-3 px-3">หมวดหมู่</th>
                    <th className="pb-3 px-3 text-right">ยอดเบิกจ่าย</th>
                    <th className="pb-3 px-3 text-right">มูลค่ารวม</th>
                    <th className="pb-3 px-3 text-center">สต็อกปัจจุบัน</th>
                    <th className="pb-3 px-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {displayMaterials.slice(3).map((item, idx) => (
                    <tr key={item.materialId} className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition">
                      <td className="py-3 px-3 text-center">
                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs inline-flex items-center justify-center">
                          {idx + 4}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                            {item.imageUrl && item.imageUrl.trim() ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold">
                              {item.materialId}
                            </div>
                            <div 
                              className="font-semibold text-slate-800 dark:text-white leading-tight"
                              style={{ fontSize: '18px', fontWeight: 600 }}
                            >
                              {item.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500">
                        {item.category}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-slate-800 dark:text-white">
                          {item.totalQty.toLocaleString()}
                        </span>{' '}
                        <span className="text-xs text-slate-500">{item.unit}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        ฿{item.totalValue.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.currentStock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}>
                          {item.currentStock} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onSelectMaterialForLedger(item.materialId)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                          title="ดูบัญชีคุมพัสดุ"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Ranking Table View with Progress Bars */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="pb-3 px-3 text-center w-14">อันดับ</th>
                <th className="pb-3 px-3 min-w-[260px]">ข้อมูลพัสดุ</th>
                <th className="pb-3 px-3 min-w-[130px]">หมวดหมู่</th>
                <th className="pb-3 px-3 text-right min-w-[180px]">
                  {sortMetric === 'quantity' ? 'ยอดเบิกจ่าย (ชิ้น)' : sortMetric === 'amount' ? 'มูลค่ารวม (บาท)' : 'จำนวนครั้งที่เบิก'}
                </th>
                <th className="pb-3 px-3 text-right min-w-[110px]">มูลค่ารวม (บาท)</th>
                <th className="pb-3 px-3 text-center min-w-[100px]">คงเหลือปัจจุบัน</th>
                <th className="pb-3 px-3 text-right min-w-[100px]">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {displayMaterials.map((item, idx) => {
                const rank = idx + 1;
                const isTop1 = rank === 1;
                const isTop2 = rank === 2;
                const isTop3 = rank === 3;

                const percentOfMax = maxDisbursedQty > 0 
                  ? (sortMetric === 'amount' 
                      ? (item.totalValue / maxDisbursedVal) * 100 
                      : (item.totalQty / maxDisbursedQty) * 100) 
                  : 0;

                const percentOfTotal = totalDisbursedQty > 0 
                  ? ((item.totalQty / totalDisbursedQty) * 100).toFixed(1) 
                  : '0';

                return (
                  <tr 
                    key={item.materialId}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-750 transition ${
                      isTop1 ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    {/* Rank Number Badge */}
                    <td className="py-3.5 px-3 text-center">
                      {isTop1 ? (
                        <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center justify-center shadow-xs">
                          🥇 1
                        </span>
                      ) : isTop2 ? (
                        <span className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs inline-flex items-center justify-center">
                          🥈 2
                        </span>
                      ) : isTop3 ? (
                        <span className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold text-xs inline-flex items-center justify-center">
                          🥉 3
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold text-xs inline-flex items-center justify-center">
                          {rank}
                        </span>
                      )}
                    </td>

                    {/* Product Master Info: Image & Name complying with UI Styling Rule */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.imageUrl && item.imageUrl.trim() ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                              {item.materialId}
                            </span>
                            {isTop1 && (
                              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-[10px] font-bold">
                                ยอดนิยม #1
                              </span>
                            )}
                          </div>
                          {/* Product name styled per rule: 18px (1.1rem), font-weight: 600, clear dark text */}
                          <div 
                            className="font-semibold text-slate-900 dark:text-white leading-tight mt-0.5"
                            style={{ fontSize: '18px', fontWeight: 600 }}
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            เบิกโดย: {Array.from(item.departments).slice(0, 2).join(', ') || 'ทั่วไป'}
                            {item.departments.size > 2 && ` และอื่นๆ (${item.departments.size})`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                      <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-[11px]">
                        {item.category}
                      </span>
                    </td>

                    {/* Disbursement Metric + Visual Progress Bar */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="space-y-1">
                        <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                          {item.totalQty.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex justify-end">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isTop1 ? 'bg-amber-500' : isTop2 ? 'bg-amber-400' : 'bg-slate-400 dark:bg-slate-500'
                            }`}
                            style={{ width: `${Math.max(percentOfMax, 4)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span>{item.frequency} ครั้ง</span>
                          <span>{percentOfTotal}% ของยอดรวม</span>
                        </div>
                      </div>
                    </td>

                    {/* Total Disbursed Value */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      ฿{item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>

                    {/* Current Stock */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          item.currentStock === 0
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : item.currentStock <= item.minQty
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {item.currentStock} {item.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          เตือนที่ {item.minQty}
                        </span>
                      </div>
                    </td>

                    {/* Quick Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectMaterialForLedger(item.materialId)}
                          title="เปิดสมุดคุมบัญชีพัสดุ (Stock Card)"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        {item.material && item.currentStock > 0 && (
                          <button
                            onClick={() => onAddMaterialToCart(item.material!)}
                            title="เพิ่มเข้าใบเบิก"
                            className="px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition cursor-pointer"
                          >
                            เบิก
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Footer Recommendation / Insights Callout */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            คำแนะนำพัสดุ: รายการพัสดุที่มีอัตราการเบิกจ่ายสูง ควรตั้งค่าระดับ Safety Stock เพิ่มเติม และวางแผนจัดซื้อในงวดงบประมาณถัดไป
          </span>
        </div>
        <div className="font-mono text-[11px] shrink-0">
          อัปเดตสถิติล่าสุด: {formatThaiDate(todayStr)}
        </div>
      </div>

    </div>
  );
};

// Helper: Format Thai Date string
function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10) + 543;
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const mName = THAI_MONTHS_SHORT[monthIndex] || parts[1];
      return `${day} ${mName} ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}
