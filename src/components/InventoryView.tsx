import { FC, useState, FormEvent, useMemo } from 'react';
import { Material, RefillStatus, UsageStatus, PurchasePriceRecord, StockIn, StockOut, Order, AppUser } from '../types';
import { MATERIAL_CATEGORIES } from '../mockData';
import { StorageService } from '../services/storageService';
import { getCategoryBadgeStyle } from '../utils/categoryColors';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  FileSpreadsheet, 
  SlidersHorizontal, 
  X, 
  Check, 
  AlertTriangle, 
  Boxes, 
  MapPin, 
  Image as ImageIcon, 
  RotateCcw, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Camera, 
  Upload, 
  FolderTree, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2,
  Tag,
  Store,
  Layers,
  Receipt,
  PackagePlus,
  ClipboardList,
  ArrowDownRight,
  ArrowUpRight,
  ShoppingCart,
  TrendingUp
} from 'lucide-react';
import { MaterialImageModal } from './MaterialImageModal';
import { MaterialImageBackupModal } from './MaterialImageBackupModal';
import { MaterialPriceHistoryModal } from './MaterialPriceHistoryModal';
import { MaterialTraceabilityModal } from './MaterialTraceabilityModal';
import { processAndCompressImage, formatBytes } from '../utils/imageUtils';
import { exportMaterialsToExcel } from '../utils/excelExport';
import { 
  generateNextMaterialId, 
  getAllCategoryCodeMap, 
  saveCustomCategory, 
  extractInitialThaiChar 
} from '../utils/materialIdGenerator';

interface InventoryViewProps {
  materials: Material[];
  onSaveMaterial: (material: Material) => Promise<void>;
  onDeleteMaterial: (id: string) => Promise<void>;
  onSelectMaterialForLedger: (materialId: string) => void;
  onAddMaterialToCart: (material: Material) => void;
  onReloadData?: () => Promise<void>;
  onUpdateMaterialImage?: (materialId: string, imageUrl: string) => Promise<void>;
  stockInLogs?: StockIn[];
  stockOutLogs?: StockOut[];
  orders?: Order[];
  onPreviewOfficialDocument?: (order: Order) => void;
  currentUser?: AppUser | null;
}

export const InventoryView: FC<InventoryViewProps> = ({
  materials,
  onSaveMaterial,
  onDeleteMaterial,
  onSelectMaterialForLedger,
  onAddMaterialToCart,
  onReloadData,
  onUpdateMaterialImage,
  stockInLogs = [],
  stockOutLogs = [],
  orders = [],
  onPreviewOfficialDocument,
  currentUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedStatus, setSelectedStatus] = useState<string>('ทั้งหมด');
  const [selectedUsage, setSelectedUsage] = useState<string>('ทั้งหมด');
  const [isRestoring, setIsRestoring] = useState(false);

  // Auto-ID & Custom Category States
  const [isAutoIdEnabled, setIsAutoIdEnabled] = useState(true);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
  const [customCategoryTrigger, setCustomCategoryTrigger] = useState(0);

  // Category Code Map (1-9 standard, 10+ custom)
  const categoryCodeMap = useMemo(() => {
    return getAllCategoryCodeMap(materials);
  }, [materials, customCategoryTrigger]);

  const categoryListWithCodes = useMemo(() => {
    const list: { name: string; code: number }[] = [];
    categoryCodeMap.forEach((code, name) => {
      list.push({ name, code });
    });
    list.sort((a, b) => a.code - b.code);
    return list;
  }, [categoryCodeMap]);

  const nextAvailableCategoryCode = useMemo(() => {
    let max = 9;
    categoryCodeMap.forEach(code => {
      if (code > max) max = code;
    });
    return max + 1;
  }, [categoryCodeMap]);

  // System Categories from actual data and standard list (excluding removed categories)
  const systemCategories = useMemo(() => {
    const deprecated = new Set([
      'ผลิตภัณฑ์ทำความสะอาด',
      'แฟ้มและอุปกรณ์จัดเก็บ',
      'เครื่องเขียน',
      'กระดาษและสิ่งพิมพ์'
    ]);
    const cats = new Set<string>();
    cats.add('ทั้งหมด');
    categoryListWithCodes.forEach(c => {
      if (!deprecated.has(c.name)) cats.add(c.name);
    });
    materials.forEach(m => {
      const cat = (m.category || '').trim();
      if (cat && !deprecated.has(cat)) {
        cats.add(cat);
      }
    });
    return Array.from(cats);
  }, [materials, categoryListWithCodes]);

  // Image Modals State
  const [isSingleImageModalOpen, setIsSingleImageModalOpen] = useState(false);
  const [singleImageMaterial, setSingleImageMaterial] = useState<Material | null>(null);
  const [isImageBackupModalOpen, setIsImageBackupModalOpen] = useState(false);
  const [formImageCompressing, setFormImageCompressing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Form State
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('วัสดุสำนักงาน');
  const [unit, setUnit] = useState('รีม');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [minQty, setMinQty] = useState<number>(5);
  const [maxQty, setMaxQty] = useState<number>(50);
  const [usageStatus, setUsageStatus] = useState<UsageStatus>('ประจำ');
  const [location, setLocation] = useState('ห้องพัสดุวิทยาลัยการเมืองการปกครอง');
  const [imageUrl, setImageUrl] = useState('');

  // 3 Recent Purchases memory for Add/Edit Modal (ราคาซื้อ 3 ครั้งล่าสุดว่ากี่บาท ซื้อจากร้านไหน)
  const [recentPurchases, setRecentPurchases] = useState<PurchasePriceRecord[]>([
    { date: '', unitPrice: 0, supplier: '', docNo: '' },
    { date: '', unitPrice: 0, supplier: '', docNo: '' },
    { date: '', unitPrice: 0, supplier: '', docNo: '' }
  ]);

  // Dedicated Price History & Traceability Modals State
  const [priceHistoryModalMaterial, setPriceHistoryModalMaterial] = useState<Material | null>(null);
  const [traceabilityModalMaterial, setTraceabilityModalMaterial] = useState<Material | null>(null);

  // Quick stock adjustment inline modal or state
  const [adjustingMaterial, setAdjustingMaterial] = useState<Material | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [deleteConfirmMaterial, setDeleteConfirmMaterial] = useState<Material | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // Overall inventory and movement statistics
  const inventoryStats = useMemo(() => {
    let totalStockQty = 0;
    let totalValuation = 0;
    let totalReceivedQty = 0;
    let totalDisbursedQty = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let regularCount = 0;

    materials.forEach(m => {
      const stock = m.currentStock || 0;
      totalStockQty += stock;
      totalValuation += stock * (m.unitPrice || 0);
      totalReceivedQty += (m.purchaseQty || 0);
      totalDisbursedQty += (m.totalWithdrawn || 0);
      if (stock === 0) outOfStockCount++;
      else if (stock <= m.minQty) lowStockCount++;
      if (m.usageStatus === 'ประจำ') regularCount++;
    });

    return {
      totalStockQty,
      totalValuation,
      totalReceivedQty,
      totalDisbursedQty,
      outOfStockCount,
      lowStockCount,
      regularCount
    };
  }, [materials]);

  // Filtered materials
  const filtered = materials.filter(m => {
    const matchCat = selectedCategory === 'ทั้งหมด' || m.category === selectedCategory;
    const matchStatus = selectedStatus === 'ทั้งหมด' || m.refillStatus === selectedStatus;
    const matchUsage = selectedUsage === 'ทั้งหมด' || m.usageStatus === selectedUsage;
    const matchSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.location && m.location.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchStatus && matchUsage && matchSearch;
  });

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filtered.length / (pageSize as number)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedList = pageSize === 'all'
    ? filtered
    : filtered.slice((safeCurrentPage - 1) * (pageSize as number), safeCurrentPage * (pageSize as number));

  const openAddModal = () => {
    setEditingMaterial(null);
    const defaultCat = 'วัสดุสำนักงาน';
    setCategory(defaultCat);
    setName('');
    const autoGen = generateNextMaterialId(defaultCat, '', materials);
    setId(autoGen.id);
    setIsAutoIdEnabled(true);
    setIsCreatingNewCategory(false);
    setNewCategoryNameInput('');
    setUnit('หน่วย');
    setUnitPrice(50);
    setCurrentStock(10);
    setMinQty(5);
    setMaxQty(50);
    setUsageStatus('ประจำ');
    setLocation('ห้องพัสดุวิทยาลัยการเมืองการปกครอง');
    setImageUrl('');
    // Initialize 3 purchase records
    setRecentPurchases([
      { date: new Date().toISOString().split('T')[0], unitPrice: 50, supplier: 'ร้านค้าคู่สัญญา วก.มมส.', docNo: '' },
      { date: '', unitPrice: 0, supplier: '', docNo: '' },
      { date: '', unitPrice: 0, supplier: '', docNo: '' }
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (mat: Material) => {
    setEditingMaterial(mat);
    setId(mat.id);
    setName(mat.name);
    setCategory(mat.category);
    setUnit(mat.unit);
    setUnitPrice(mat.unitPrice);
    setCurrentStock(mat.currentStock);
    setMinQty(mat.minQty);
    setMaxQty(mat.maxQty);
    setUsageStatus(mat.usageStatus);
    setLocation(
      mat.location && mat.location !== 'ตู้พัสดุ A1' && mat.location !== 'ตู้พัสดุA1'
        ? mat.location
        : 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง'
    );
    setImageUrl(mat.imageUrl || '');
    setIsAutoIdEnabled(false);
    setIsCreatingNewCategory(false);
    // Populate 3 recent purchases memory
    const existing = mat.recentPurchases || [];
    setRecentPurchases([
      existing[0] ? { ...existing[0] } : { date: new Date().toISOString().split('T')[0], unitPrice: mat.unitPrice, supplier: 'ร้านค้าคู่สัญญา วก.มมส.', docNo: '' },
      existing[1] ? { ...existing[1] } : { date: '', unitPrice: 0, supplier: '', docNo: '' },
      existing[2] ? { ...existing[2] } : { date: '', unitPrice: 0, supplier: '', docNo: '' }
    ]);
    setIsModalOpen(true);
  };

  // Save Notification & Submitting State
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<{ id: string; name: string } | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingForm) return;

    // 1. If user typed a new category in the inline input, auto-save and apply it
    let finalCategory = category;
    if (isCreatingNewCategory && newCategoryNameInput.trim()) {
      const customCat = newCategoryNameInput.trim();
      saveCustomCategory(customCat);
      finalCategory = customCat;
      setCategory(customCat);
      setCustomCategoryTrigger(prev => prev + 1);
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('กรุณาระบุชื่อพัสดุ');
      return;
    }

    // 2. Ensure ID is present or auto-generate
    let finalId = id.trim();
    if (!finalId) {
      const autoGen = generateNextMaterialId(finalCategory, trimmedName, materials);
      finalId = autoGen.id;
      setId(finalId);
    }

    setIsSubmittingForm(true);

    try {
      let refillStatus: RefillStatus = 'OK';
      const stockNum = Number(currentStock) || 0;
      const minNum = Number(minQty) || 0;
      if (stockNum <= 0) refillStatus = 'วัสดุหมด';
      else if (stockNum <= minNum) refillStatus = 'ใกล้หมด';

      const nextNo = editingMaterial?.no || (materials.length > 0 ? Math.max(...materials.map(m => m.no || 0)) + 1 : 1);

      // Clean non-empty 3 recent purchases
      const cleanPurchases: PurchasePriceRecord[] = recentPurchases
        .filter(p => (Number(p.unitPrice) > 0 || (p.supplier && p.supplier.trim().length > 0)))
        .map(p => ({
          date: p.date || new Date().toISOString().split('T')[0],
          unitPrice: Math.max(0, Number(p.unitPrice) || 0),
          supplier: (p.supplier || 'ไม่ระบุร้านค้า').trim(),
          docNo: (p.docNo || '').trim(),
          quantity: p.quantity ? Number(p.quantity) : undefined
        }))
        .slice(0, 3);

      // Ground unit price in latest purchase price (slot 1) if available
      const effectiveUnitPrice = cleanPurchases[0]?.unitPrice && cleanPurchases[0].unitPrice > 0 
        ? cleanPurchases[0].unitPrice 
        : (Number(unitPrice) || 0);

      const materialData: Material = {
        id: finalId,
        no: nextNo,
        name: trimmedName,
        category: finalCategory,
        unitPrice: effectiveUnitPrice,
        purchaseQty: editingMaterial ? editingMaterial.purchaseQty : stockNum,
        unit: (unit || 'หน่วย').trim(),
        minQty: minNum,
        maxQty: Number(maxQty) || 50,
        currentStock: stockNum,
        refillStatus,
        usageStatus: usageStatus || 'ประจำ',
        totalPurchaseCost: effectiveUnitPrice * stockNum,
        totalWithdrawn: editingMaterial?.totalWithdrawn || 0,
        monthlyAverage: editingMaterial?.monthlyAverage || 5,
        location: (location || 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง').trim(),
        imageUrl: imageUrl.trim() || '',
        recentPurchases: cleanPurchases.length > 0 ? cleanPurchases : undefined
      };

      await onSaveMaterial(materialData);
      setIsModalOpen(false);
      setIsCreatingNewCategory(false);
      setNewCategoryNameInput('');

      // Auto-filter and show the newly added material right on row 1!
      setSelectedCategory('ทั้งหมด');
      setSelectedStatus('ทั้งหมด');
      setSelectedUsage('ทั้งหมด');
      setSearchQuery(finalId);
      setCurrentPage(1);

      // Notification banner
      setSaveSuccessNotification({ id: finalId, name: trimmedName });
      setTimeout(() => setSaveSuccessNotification(null), 8000);
    } catch (err) {
      console.error('Error saving material:', err);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleQuickAdjustStock = async () => {
    if (!adjustingMaterial) return;
    const newStock = Math.max(0, adjustingMaterial.currentStock + adjustQty);
    let refillStatus: RefillStatus = 'OK';
    if (newStock <= 0) refillStatus = 'วัสดุหมด';
    else if (newStock <= adjustingMaterial.minQty) refillStatus = 'ใกล้หมด';

    const updated: Material = {
      ...adjustingMaterial,
      currentStock: newStock,
      refillStatus
    };
    await onSaveMaterial(updated);
    setAdjustingMaterial(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-500" />
            ทะเบียนคลังพัสดุและวัสดุคงคลัง
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ระบบตรวจสอบข้อมูลสต็อก จุดสั่งซื้อขั้นต่ำ (Safety Stock) และควบคุมปริมาณคงคลัง
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {materials.length === 0 && (
            <button
              onClick={async () => {
                try {
                  setIsRestoring(true);
                  await StorageService.seedMaterialsIfEmpty(true);
                  if (onReloadData) await onReloadData();
                } finally {
                  setIsRestoring(false);
                }
              }}
              disabled={isRestoring}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              <span>กู้คืนพัสดุเริ่มต้น วก.มมส.</span>
            </button>
          )}

          <button
            id="open-image-backup-vault-btn"
            onClick={() => setIsImageBackupModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-amber-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer border border-amber-500/30"
          >
            <Camera className="w-4 h-4 text-amber-400" />
            <span>คลังและสำรองรูปภาพ</span>
          </button>

          <button
            id="export-inventory-excel-btn"
            onClick={() => exportMaterialsToExcel(filtered.length > 0 ? filtered : materials)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="ส่งออกรายการทะเบียนพัสดุและยอดคงคลังเป็นไฟล์ Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ส่งออก Excel</span>
          </button>

          <button
            id="add-new-material-btn"
            onClick={openAddModal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มวัสดุเข้าทะเบียน</span>
          </button>
        </div>
      </div>

      {/* Real-time Movement & Inventory Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Total Catalog Items */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">พัสดุในทะเบียนทั้งหมด</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{materials.length}</span>
              <span className="text-xs text-slate-400">รายการ</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-medium">ประจำ {inventoryStats.regularCount}</span>
              <span>•</span>
              <span className="text-purple-600 dark:text-purple-400 font-medium">ครั้งคราว {materials.length - inventoryStats.regularCount}</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* 2. Total Stock-In (รับเข้าสะสม) */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">ยอดรับเข้าสะสม (Stock In)</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                +{inventoryStats.totalReceivedQty.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">หน่วย</span>
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
              บันทึกแล้ว {stockInLogs.length} รายการรับเข้า
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PackagePlus className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* 3. Total Stock-Out (เบิกจ่ายสะสม) */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-blue-200 dark:border-blue-800/60 shadow-2xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">ยอดเบิกจ่ายสะสม (Disbursed)</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">
                -{inventoryStats.totalDisbursedQty.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">หน่วย</span>
            </div>
            <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
              เบิกจ่ายแล้ว {stockOutLogs.length} รายการจ่ายออก
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>

        {/* 4. Total On-hand Stock Valuation */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">มูลค่าคงคลังสุทธิ</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                ฿{inventoryStats.totalValuation.toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
              <span>คงเหลือรวม: <strong className="font-mono text-slate-700 dark:text-slate-300">{inventoryStats.totalStockQty.toLocaleString()}</strong></span>
              {inventoryStats.lowStockCount > 0 && (
                <span className="text-amber-600 font-bold">เตือน {inventoryStats.lowStockCount}</span>
              )}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Zero Materials Alert Banner */}
      {materials.length === 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                ยังไม่พบข้อมูลพัสดุในทะเบียน (0 รายการ)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                คุณสามารถกดปุ่ม "กู้คืนพัสดุเริ่มต้น" เพื่อโหลดรายการวัสดุมาตรฐานของวิทยาลัยการเมืองการปกครอง (Double A, ตราม้า, MAX, หมึกพิมพ์ HP ฯลฯ) พร้อมซิงค์เข้า Firebase
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                setIsRestoring(true);
                await StorageService.seedMaterialsIfEmpty(true);
                if (onReloadData) await onReloadData();
              } finally {
                setIsRestoring(false);
              }
            }}
            disabled={isRestoring}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            <span>กู้คืนรายการพัสดุเริ่มต้น</span>
          </button>
        </div>
      )}

      {/* Top Notification when a material is freshly added */}
      {saveSuccessNotification && (
        <div className="bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 px-4 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">บันทึกพัสดุเข้าทะเบียนสำเร็จ:</span>{' '}
              <span className="font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 dark:text-emerald-300">
                {saveSuccessNotification.id}
              </span>{' '}
              <span className="font-semibold">{saveSuccessNotification.name}</span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 block sm:inline sm:ml-2">
                (กรองแสดงรายการนี้ให้อัตโนมัติในตารางด้านล่าง)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSaveSuccessNotification(null);
              setSearchQuery('');
            }}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0 cursor-pointer self-end sm:self-center"
          >
            ✕ ล้างการค้นหา / แสดงทั้งหมด
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหารหัส, ชื่อวัสดุ หรือที่เก็บ..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-500"
            style={{ 
              borderColor: '#fef9f9', 
              backgroundColor: '#dae3ed',
              color: '#0f172a'
            }}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* ปุ่มเลือกแสดงผล การใช้งาน: ทั้งหมด / ประจำ / ครั้งคราว */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <span 
              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-2 shrink-0" 
              style={{ fontFamily: 'Sarabun' }}
            >
              การใช้งาน:
            </span>
            {(['ทั้งหมด', 'ประจำ', 'ครั้งคราว'] as const).map(u => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setSelectedUsage(u);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedUsage === u
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                style={{ fontFamily: 'Sarabun' }}
              >
                {u}
              </button>
            ))}
          </div>

          {/* เลือกจากหมวดหมู่ที่มีในระบบ */}
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <FolderTree className="w-3.5 h-3.5 text-amber-500" />
            <span style={{ fontFamily: 'Sarabun' }}>เลือกจากหมวดหมู่ที่มีในระบบ:</span>
          </div>

          <select
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
            style={{ fontFamily: 'Sarabun' }}
          >
            {systemCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
            style={{ fontFamily: 'Sarabun' }}
          >
            <option value="ทั้งหมด">สถานะทั้งหมด</option>
            <option value="OK">ปกติ (OK)</option>
            <option value="ใกล้หมด">ใกล้หมด</option>
            <option value="วัสดุหมด">หมดสต็อก</option>
          </select>

          <span className="text-xs text-slate-400 shrink-0 ml-1">
            ({filtered.length} รายการ)
          </span>
        </div>

      </div>

      {/* Materials Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-3">รูป/รหัส</th>
                <th className="py-3.5 px-3">ชื่อวัสดุ / รายละเอียด</th>
                <th className="py-3.5 px-3">หมวดหมู่</th>
                <th className="py-3.5 px-3 text-right">ราคาล่าสุด</th>
                <th className="py-3.5 px-3 text-center bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center justify-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                    <span>รับเข้าสะสม</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">
                  <div className="flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    <span>เบิกจ่ายสะสม</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center font-bold text-slate-800 dark:text-slate-100">คงเหลือสุทธิ</th>
                <th className="py-3.5 px-3 text-center">สถานะ</th>
                <th className="py-3.5 px-3 text-center">การใช้งาน</th>
                <th className="py-3.5 px-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <Boxes className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                    <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                      {materials.length === 0 ? 'ยังไม่มีข้อมูลพัสดุในระบบ' : 'ไม่พบรายการพัสดุที่ตรงกับเงื่อนไขการค้นหา'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {materials.length === 0 
                        ? 'คุณสามารถกู้คืนพัสดุมาตรฐานของ วก.มมส. เพื่อเริ่มต้นใช้งานได้ทันที'
                        : 'ลองตรวจสอบตัวสะกด หรือเปลี่ยนหมวดหมู่และสถานะเป็น "ทั้งหมด"'}
                    </p>
                    {materials.length === 0 && (
                      <button
                        onClick={async () => {
                          try {
                            setIsRestoring(true);
                            await StorageService.seedMaterialsIfEmpty(true);
                            if (onReloadData) await onReloadData();
                          } finally {
                            setIsRestoring(false);
                          }
                        }}
                        disabled={isRestoring}
                        className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        <span>กู้คืนรายการพัสดุเริ่มต้น วก.มมส.</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedList.map(mat => (
                <tr key={mat.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition">
                  {/* Photo & Code */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={() => {
                          setSingleImageMaterial(mat);
                          setIsSingleImageModalOpen(true);
                        }}
                        className="relative group/img cursor-pointer shrink-0"
                        title="คลิกเพื่ออัปโหลดหรือเปลี่ยนรูปภาพ"
                      >
                        {mat.imageUrl ? (
                          <img 
                            src={mat.imageUrl} 
                            alt={mat.name} 
                            className="w-12 h-12 rounded-lg object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 group-hover/img:brightness-95 transition"
                            style={{ objectFit: 'contain' }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center group-hover/img:bg-amber-100 group-hover/img:text-amber-600 transition">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-slate-900/50 rounded-lg opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition">
                          <Camera className="w-3.5 h-3.5" style={{ height: '25px', width: '16px' }} />
                        </div>
                      </div>
                      <div>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs block">
                          {mat.id}
                        </span>
                        {mat.location && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {mat.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Name */}
                  <td className="py-3 px-3">
                    <div 
                      className="text-[1.1rem] sm:text-[18px] font-semibold text-slate-900 dark:text-white max-w-sm"
                      style={{ fontSize: '1.1rem', fontWeight: 600 }}
                    >
                      {mat.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ใช้เฉลี่ย ~{mat.monthlyAverage || 0} {mat.unit}/เดือน
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3">
                    {(() => {
                      const catStyle = getCategoryBadgeStyle(mat.category);
                      return (
                        <span 
                          className="px-2.5 py-1 rounded-md text-xs font-semibold border shadow-2xs inline-block"
                          style={{
                            backgroundColor: catStyle.bg,
                            color: catStyle.text,
                            borderColor: catStyle.border,
                            fontFamily: 'Sarabun'
                          }}
                        >
                          {mat.category}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Price (อิงตามราคารับเข้าพัสดุล่าสุด) */}
                  <td className="py-3 px-3 text-right">
                    <div className="font-mono font-bold text-slate-800 dark:text-white">
                      ฿{(mat.unitPrice || 0).toLocaleString()}
                    </div>
                    {mat.recentPurchases && mat.recentPurchases.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPriceHistoryModalMaterial(mat)}
                        title="คลิกดูประวัติการจดจำราคาซื้อ 3 ครั้งล่าสุด"
                        className="text-[10.5px] text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5 mt-0.5 justify-end cursor-pointer max-w-[130px] truncate"
                      >
                        <Tag className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                        <span className="truncate">ร้าน: {mat.recentPurchases[0].supplier}</span>
                      </button>
                    )}
                  </td>

                  {/* 5. รับเข้าสะสม (Stock-In) */}
                  <td className="py-3 px-3 text-center bg-emerald-50/30 dark:bg-emerald-950/10">
                    <div className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                      +{(mat.purchaseQty || 0).toLocaleString()} {mat.unit}
                    </div>
                    {(mat.totalPurchaseCost || 0) > 0 && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        ฿{(mat.totalPurchaseCost || 0).toLocaleString()}
                      </div>
                    )}
                  </td>

                  {/* 6. เบิกจ่ายสะสม (Stock-Out) */}
                  <td className="py-3 px-3 text-center bg-blue-50/30 dark:bg-blue-950/10">
                    <div className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400">
                      -{(mat.totalWithdrawn || 0).toLocaleString()} {mat.unit}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      จ่ายแล้ว
                    </div>
                  </td>

                  {/* 7. คงเหลือสุทธิ (Current Stock) */}
                  <td 
                    className="py-3 px-3 text-center transition-colors"
                    style={mat.currentStock > 0 ? {
                      backgroundColor: '#aef68d',
                      borderColor: '#1ade62',
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    } : undefined}
                  >
                    <div 
                      className="font-bold text-sm text-slate-900"
                      style={{ fontSize: '18px' }}
                    >
                      <span 
                        className={mat.currentStock === 0 ? 'text-rose-600' : 'text-slate-900 font-bold'}
                        style={{ fontSize: '18px', fontFamily: 'system-ui' }}
                      >
                        {mat.currentStock.toLocaleString()}
                      </span>{' '}
                      <span 
                        className="text-xs font-normal"
                        style={{ color: mat.currentStock > 0 ? '#47494f' : undefined }}
                      >
                        {mat.unit}
                      </span>
                    </div>
                    <div 
                      className="text-[10px] font-mono"
                      style={{ color: mat.currentStock > 0 ? '#1f1d1d' : undefined }}
                    >
                      (Min {mat.minQty} - Max {mat.maxQty})
                    </div>
                    <button
                      onClick={() => {
                        setAdjustingMaterial(mat);
                        setAdjustQty(0);
                      }}
                      className={`text-[10px] hover:underline cursor-pointer font-medium mt-0.5 ${
                        mat.currentStock > 0 ? 'text-emerald-950 font-bold' : 'text-amber-600'
                      }`}
                    >
                      ปรับยอดด่วน
                    </button>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      mat.refillStatus === 'วัสดุหมด'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : mat.refillStatus === 'ใกล้หมด'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}>
                      {mat.refillStatus}
                    </span>
                  </td>

                  {/* Usage */}
                  <td className="py-3 px-3 text-center">
                    <span 
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-block border ${
                        mat.usageStatus === 'ประจำ'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800'
                          : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
                      }`}
                      style={{ fontFamily: 'Sarabun' }}
                    >
                      {mat.usageStatus || 'ประจำ'}
                    </span>
                  </td>

                  {/* Actions (ตรงจัดการ) */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* 1. Camera */}
                      <button
                        onClick={() => {
                          setSingleImageMaterial(mat);
                          setIsSingleImageModalOpen(true);
                        }}
                        title={mat.imageUrl ? "เปลี่ยนรูปภาพพัสดุ" : "อัปโหลดรูปภาพพัสดุ"}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                      </button>

                      {/* 2. จดจำราคาซื้อ 3 ครั้งล่าสุด */}
                      <button
                        type="button"
                        onClick={() => setPriceHistoryModalMaterial(mat)}
                        title="จดจำราคาซื้อ 3 ครั้งล่าสุดว่ากี่บาท ซื้อจากร้านไหน"
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                      >
                        <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </button>

                      {/* 3. ความสัมพันธ์และที่มาที่ไปของพัสดุ */}
                      <button
                        type="button"
                        onClick={() => setTraceabilityModalMaterial(mat)}
                        title="ดูความสัมพันธ์และที่มาที่ไปของรายการพัสดุ (รับเข้า-เบิกจ่าย-ยกเลิก)"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </button>

                      {/* 4. Stock Card */}
                      <button
                        onClick={() => onSelectMaterialForLedger(mat.id)}
                        title="เปิดสมุดคุมบัญชีพัสดุ (Stock Card)"
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>

                      {/* 5. Edit */}
                      <button
                        onClick={() => openEditModal(mat)}
                        title="แก้ไขข้อมูลพัสดุ"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* 6. Delete */}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmMaterial(mat)}
                        title="ลบพัสดุ"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))) }
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span>
                แสดง <strong className="text-slate-700 dark:text-slate-200 font-semibold">{pageSize === 'all' ? 1 : (safeCurrentPage - 1) * (pageSize as number) + 1}</strong> ถึง <strong className="text-slate-700 dark:text-slate-200 font-semibold">{pageSize === 'all' ? filtered.length : Math.min(safeCurrentPage * (pageSize as number), filtered.length)}</strong> จาก <strong className="text-amber-600 dark:text-amber-400 font-bold">{filtered.length}</strong> รายการ
                {materials.length !== filtered.length && (
                  <span className="text-slate-400 text-[11px] ml-1">(จากทั้งหมดในคลัง {materials.length} รายการ)</span>
                )}
              </span>

              <div className="flex items-center gap-1.5 ml-1 sm:ml-3 border-l border-slate-200 dark:border-slate-700 pl-3">
                <span className="text-slate-400">หน้าละ:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value={25}>25 รายการ</option>
                  <option value={50}>50 รายการ</option>
                  <option value={100}>100 รายการ</option>
                  <option value="all">แสดงทั้งหมด ({filtered.length})</option>
                </select>
              </div>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    let pageNum = idx + 1;
                    if (totalPages > 5) {
                      if (safeCurrentPage <= 3) {
                        pageNum = idx + 1;
                      } else if (safeCurrentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + idx;
                      } else {
                        pageNum = safeCurrentPage - 2 + idx;
                      }
                    }
                    const isActive = pageNum === safeCurrentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && safeCurrentPage < totalPages - 2 && (
                    <span className="text-slate-400 px-1">...</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Material Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingMaterial ? 'แก้ไขข้อมูลพัสดุ' : 'เพิ่มวัสดุใหม่เข้าทะเบียนคลัง'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* รหัสพัสดุ */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      รหัสพัสดุ (เช่น 1ก01) *
                    </label>
                    {!editingMaterial && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                        {isAutoIdEnabled ? 'รันอัตโนมัติ' : 'ปรับเอง'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={id}
                      onChange={e => {
                        setId(e.target.value);
                        setIsAutoIdEnabled(false);
                      }}
                      disabled={!!editingMaterial}
                      className="w-full px-3 py-1.5 pr-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-amber-600 dark:text-amber-400"
                      placeholder="เช่น 1ก01"
                      required
                    />
                    {!editingMaterial && (
                      <button
                        type="button"
                        onClick={() => {
                          const autoGen = generateNextMaterialId(category, name, materials);
                          setId(autoGen.id);
                          setIsAutoIdEnabled(true);
                        }}
                        className="absolute right-1 top-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-200 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-amber-300 dark:border-amber-700"
                        title="คำนวณรหัสพัสดุตามหมวดหมู่และชื่อใหม่อัตโนมัติ"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>รันใหม่</span>
                      </button>
                    )}
                  </div>

                  {!editingMaterial && (
                    <div className="mt-1.5 text-[10.5px] text-slate-500 dark:text-slate-400 bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 space-y-0.5">
                      <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>ที่มาของรหัสอัตโนมัติ:</span>
                      </div>
                      <div>
                        1. เลขหมวด = <strong>{categoryCodeMap.get(category) || 1}</strong> ({category})
                      </div>
                      <div>
                        2. ตัวอักษร = <strong>[{extractInitialThaiChar(name)}]</strong> (จากชื่อพัสดุ)
                      </div>
                      <div>
                        3. ลำดับ = <strong>[{id.slice(String(categoryCodeMap.get(category) || 1).length + extractInitialThaiChar(name).length) || '01'}]</strong> (ลำดับในหมวดนี้)
                      </div>
                    </div>
                  )}
                </div>

                {/* หมวดหมู่ */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      หมวดหมู่ *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewCategory(!isCreatingNewCategory)}
                      className="text-[11px] text-amber-600 hover:text-amber-700 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isCreatingNewCategory ? 'ปิด' : 'สร้างหมวดใหม่'}</span>
                    </button>
                  </div>

                  <select
                    value={category}
                    onChange={e => {
                      const newCat = e.target.value;
                      setCategory(newCat);
                      if (!editingMaterial && isAutoIdEnabled) {
                        const autoGen = generateNextMaterialId(newCat, name, materials);
                        setId(autoGen.id);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer font-medium"
                  >
                    {categoryListWithCodes.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.code} = {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Form to create a new category */}
                  {isCreatingNewCategory && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-300 dark:border-amber-700 space-y-1.5">
                      <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                        สร้างหมวดใหม่ (จะได้รับรหัสเลข: {nextAvailableCategoryCode})
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="ชื่อหมวดหมู่ใหม่..."
                          value={newCategoryNameInput}
                          onChange={e => {
                            const val = e.target.value;
                            setNewCategoryNameInput(val);
                            if (val.trim() && !editingMaterial && isAutoIdEnabled) {
                              const autoGen = generateNextMaterialId(val.trim(), name, materials);
                              setId(autoGen.id);
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = newCategoryNameInput.trim();
                              if (!trimmed) return;
                              saveCustomCategory(trimmed);
                              setCategory(trimmed);
                              setCustomCategoryTrigger(prev => prev + 1);
                              setIsCreatingNewCategory(false);
                              setNewCategoryNameInput('');
                              if (!editingMaterial && isAutoIdEnabled) {
                                const autoGen = generateNextMaterialId(trimmed, name, materials);
                                setId(autoGen.id);
                              }
                            }
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newCategoryNameInput.trim();
                            if (!trimmed) return;
                            saveCustomCategory(trimmed);
                            setCategory(trimmed);
                            setCustomCategoryTrigger(prev => prev + 1);
                            setIsCreatingNewCategory(false);
                            setNewCategoryNameInput('');
                            if (!editingMaterial && isAutoIdEnabled) {
                              const autoGen = generateNextMaterialId(trimmed, name, materials);
                              setId(autoGen.id);
                            }
                          }}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shrink-0 cursor-pointer shadow-xs"
                        >
                          บันทึกหมวด
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ชื่อวัสดุ */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อวัสดุ (ระบุยี่ห้อ ขนาด สเปก) *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    const newName = e.target.value;
                    setName(newName);
                    if (!editingMaterial && isAutoIdEnabled) {
                      const autoGen = generateNextMaterialId(category, newName, materials);
                      setId(autoGen.id);
                    }
                  }}
                  placeholder="เช่น กบเหลาดินสอ (เล็ก)"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หน่วยนับ *
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="เช่น รีม, ด้าม, กล่อง"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
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
                    value={unitPrice}
                    onChange={e => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    สต็อกปัจจุบัน *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentStock}
                    onChange={e => setCurrentStock(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    required
                  />
                </div>
              </div>

              {/* จดจำราคาซื้อ 3 ครั้งล่าสุดว่ากี่บาท ซื้อจากร้านไหน (อิงตามราคารับเข้าล่าสุด) */}
              <div className="border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      จดจำราคาซื้อ 3 ครั้งล่าสุด (กี่บาท ซื้อจากร้านไหน)
                    </span>
                  </div>
                  <span className="text-[10.5px] text-amber-700 dark:text-amber-300 font-medium">
                    ราคาต่อหน่วยจะอิงตามครั้งที่ 1 (ล่าสุด)
                  </span>
                </div>

                <div className="space-y-2">
                  {[0, 1, 2].map((slotIdx) => (
                    <div key={slotIdx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          {slotIdx === 0 ? 'ครั้งที่ 1 (ล่าสุด) - บาท' : slotIdx === 1 ? 'ครั้งที่ 2 - บาท' : 'ครั้งที่ 3 - บาท'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={recentPurchases[slotIdx]?.unitPrice || ''}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setRecentPurchases(prev => {
                              const arr = [...prev];
                              arr[slotIdx] = { ...arr[slotIdx], unitPrice: val };
                              return arr;
                            });
                            if (slotIdx === 0 && val > 0) {
                              setUnitPrice(val);
                            }
                          }}
                          placeholder="0.00"
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-slate-400 block font-semibold">ซื้อจากร้านไหน (ร้านค้า / บริษัท)</span>
                        <input
                          type="text"
                          value={recentPurchases[slotIdx]?.supplier || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setRecentPurchases(prev => {
                              const arr = [...prev];
                              arr[slotIdx] = { ...arr[slotIdx], supplier: val };
                              return arr;
                            });
                          }}
                          placeholder="เช่น บจก. สารคามเครื่องเขียน..."
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">วันที่ซื้อ / รับเข้า</span>
                        <input
                          type="date"
                          value={recentPurchases[slotIdx]?.date || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setRecentPurchases(prev => {
                              const arr = [...prev];
                              arr[slotIdx] = { ...arr[slotIdx], date: val };
                              return arr;
                            });
                          }}
                          className="w-full px-1.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    จุดสั่งซื้อขั้นต่ำ (Min Safety Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minQty}
                    onChange={e => setMinQty(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ความจุสต็อกสูงสุด (Max Limit)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={maxQty}
                    onChange={e => setMaxQty(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ที่จัดเก็บ / ตู้พัสดุ
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="เช่น ตู้พัสดุ A1-01"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ลักษณะการใช้งาน
                  </label>
                  <select
                    value={usageStatus}
                    onChange={e => setUsageStatus(e.target.value as UsageStatus)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="ประจำ">ประจำ</option>
                    <option value="ครั้งคราว">ครั้งคราว</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 dark:border-slate-750 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    รูปภาพพัสดุ (อัปโหลดไฟล์ / ถ่ายรูป หรือวาง URL)
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-[11px] text-rose-500 hover:text-rose-600 font-medium cursor-pointer"
                    >
                      ลบรูปภาพ
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <label className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1.5 transition shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{formImageCompressing ? 'กำลังปรับภาพ...' : 'เลือกไฟล์ภาพ'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setFormImageCompressing(true);
                            const processed = await processAndCompressImage(file, 800, 800, 0.82);
                            setImageUrl(processed.dataUrl);
                          } catch (err: any) {
                            alert(err.message || 'ไม่สามารถประมวลผลรูปภาพได้');
                          } finally {
                            setFormImageCompressing(false);
                          }
                        }
                      }}
                    />
                  </label>
                  <input
                    type="url"
                    value={imageUrl.startsWith('data:') ? 'รูปภาพที่อัปโหลด (Base64)' : imageUrl}
                    onChange={e => {
                      if (!imageUrl.startsWith('data:')) {
                        setImageUrl(e.target.value);
                      }
                    }}
                    readOnly={imageUrl.startsWith('data:')}
                    placeholder="หรือวาง URL รูปภาพ https://..."
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                {imageUrl && (
                  <div className="mt-2 flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-750">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-16 h-16 object-contain bg-white dark:bg-slate-900 p-1 rounded-md border border-slate-200 shrink-0"
                      style={{ objectFit: 'contain' }}
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-[11px] text-slate-500">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">ตัวอย่างรูปภาพพัสดุ</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-medium">✓ พร้อมบันทึกเข้าสู่ระบบ</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{isSubmittingForm ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูล'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustingMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">
              ปรับปรุงยอดคงเหลือ: {adjustingMaterial.name}
            </h3>
            <p className="text-xs text-slate-500">
              ปัจจุบันคงเหลือ: <span className="font-bold text-amber-600">{adjustingMaterial.currentStock} {adjustingMaterial.unit}</span>
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdjustQty(prev => prev - 1)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold text-base cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                value={adjustQty}
                onChange={e => setAdjustQty(Number(e.target.value))}
                className="flex-1 text-center py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold font-mono"
              />
              <button
                onClick={() => setAdjustQty(prev => prev + 1)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold text-base cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="text-xs text-center text-slate-400">
              ยอดใหม่หลังปรับ: <span className="font-bold text-slate-900 dark:text-white">{Math.max(0, adjustingMaterial.currentStock + adjustQty)} {adjustingMaterial.unit}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setAdjustingMaterial(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleQuickAdjustStock}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer"
              >
                ยืนยันปรับยอด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Single Image Upload / Change Modal */}
      <MaterialImageModal
        material={singleImageMaterial}
        isOpen={isSingleImageModalOpen}
        onClose={() => {
          setIsSingleImageModalOpen(false);
          setSingleImageMaterial(null);
        }}
        onSaveImage={async (matId, newImg) => {
          if (onUpdateMaterialImage) {
            await onUpdateMaterialImage(matId, newImg);
          } else {
            await StorageService.updateMaterialImage(matId, newImg);
            if (onReloadData) await onReloadData();
          }
        }}
      />

      {/* Material Image Backup & Media Center Vault Modal */}
      <MaterialImageBackupModal
        isOpen={isImageBackupModalOpen}
        onClose={() => setIsImageBackupModalOpen(false)}
        materials={materials}
        onDataReload={async () => {
          if (onReloadData) await onReloadData();
        }}
        onOpenSingleImageModal={(mat) => {
          setSingleImageMaterial(mat);
          setIsSingleImageModalOpen(true);
        }}
      />

      {/* Delete Confirmation In-App Dialog */}
      {deleteConfirmMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  ยืนยันลบพัสดุออกจากระบบ
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  คุณต้องการลบพัสดุ <strong className="text-slate-900 dark:text-white">"{deleteConfirmMaterial.name}"</strong> (รหัส: <span className="font-mono">{deleteConfirmMaterial.id}</span>) ออกจากทะเบียนพัสดุใช่หรือไม่?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDeleteConfirmMaterial(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteConfirmMaterial.id;
                  setDeleteConfirmMaterial(null);
                  onDeleteMaterial(id);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 Recent Purchases Price History Modal (จดจำราคาซื้อ 3 ครั้งล่าสุด) */}
      {priceHistoryModalMaterial && (
        <MaterialPriceHistoryModal
          isOpen={!!priceHistoryModalMaterial}
          material={priceHistoryModalMaterial}
          onClose={() => setPriceHistoryModalMaterial(null)}
          onSavePriceHistory={onSaveMaterial}
          isAdmin={currentUser?.role === 'admin'}
        />
      )}

      {/* Material Traceability & Linkages Modal (ความสัมพันธ์และที่มาที่ไป รับเข้า-เบิกจ่าย-ยกเลิก) */}
      {traceabilityModalMaterial && (
        <MaterialTraceabilityModal
          isOpen={!!traceabilityModalMaterial}
          material={traceabilityModalMaterial}
          stockInLogs={stockInLogs}
          stockOutLogs={stockOutLogs}
          orders={orders}
          onClose={() => setTraceabilityModalMaterial(null)}
          onOpenLedger={onSelectMaterialForLedger}
          onPreviewOrder={onPreviewOfficialDocument}
        />
      )}

    </div>
  );
};
