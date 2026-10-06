import { FC, useState, useEffect, FormEvent, Dispatch, SetStateAction } from 'react';
import { Material, Order, OrderItem, AppUser, StockIn, StockOut } from '../types';
import { MATERIAL_CATEGORIES } from '../mockData';
import { StorageService, generateNextRequisitionDocNo } from '../services/storageService';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  FileText, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  ShoppingBag,
  LayoutGrid,
  List,
  Check,
  Boxes,
  RotateCcw,
  Loader2,
  FolderTree,
  ChevronDown,
  X,
  FileSpreadsheet,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getCategoryBadgeStyle } from '../utils/categoryColors';

interface RequisitionViewProps {
  materials: Material[];
  orders?: Order[];
  cart: OrderItem[];
  setCart: Dispatch<SetStateAction<OrderItem[]>>;
  onSubmitOrder: (order: Order) => Promise<void>;
  onPreviewOfficialDocument: (order: Order) => void;
  currentUser?: AppUser | null;
  onReloadData?: () => Promise<void>;
  stockInLogs?: StockIn[];
  stockOutLogs?: StockOut[];
  onSelectMaterialForLedger?: (materialId: string) => void;
}

export const RequisitionView: FC<RequisitionViewProps> = ({
  materials,
  orders = [],
  cart,
  setCart,
  onSubmitOrder,
  onPreviewOfficialDocument,
  currentUser,
  onReloadData,
  stockInLogs = [],
  stockOutLogs = [],
  onSelectMaterialForLedger
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedUsage, setSelectedUsage] = useState<string>('ทั้งหมด');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  // Form State
  const today = new Date().toISOString().split('T')[0];

  const [docNo, setDocNo] = useState(() => generateNextRequisitionDocNo(orders, today));
  const [date, setDate] = useState(today);
  const [requesterName, setRequesterName] = useState(currentUser?.name || '');
  const [requesterEmail, setRequesterEmail] = useState(currentUser?.email || '');
  // ช่องตำแหน่ง: ให้เป็นช่องว่างให้กดเลือกเองตามสถานะ หากไม่เลือกไม่ให้กดส่งเบิก
  const [requesterPosition, setRequesterPosition] = useState('');
  const [department, setDepartment] = useState(currentUser?.department || 'วิทยาลัยการเมืองการปกครอง');
  const [purpose, setPurpose] = useState('');

  // Auto-generate next document number COPAG-[Year]/[Seq] whenever orders or date changes
  useEffect(() => {
    const nextDoc = generateNextRequisitionDocNo(orders, date);
    setDocNo(nextDoc);
  }, [orders, date]);

  // Sync if currentUser updates (ยกเว้นตำแหน่ง ให้คงเป็นช่องว่างเพื่อให้ผู้ใช้กดเลือกเองตามสถานะ)
  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setRequesterName(currentUser.name);
      if (currentUser.email) setRequesterEmail(currentUser.email);
      if (currentUser.department) setDepartment(currentUser.department);
    }
  }, [currentUser]);

  // Extract categories dynamically from materials, ordering real categories like วัสดุสำนักงาน first
  const deprecatedCategories = new Set<string>(['ผลิตภัณฑ์ทำความสะอาด', 'แฟ้มและอุปกรณ์จัดเก็บ', 'เครื่องเขียน', 'กระดาษและสิ่งพิมพ์']);
  const materialCategories = Array.from(new Set<string>(materials.map(m => m.category).filter(Boolean)))
    .filter((c: string) => !deprecatedCategories.has(c));
  const priorityOrder = [
    'วัสดุสำนักงาน',
    'วัสดุงานบ้านและงานครัว',
    'วัสดุคอมพิวเตอร์',
    'วัสดุไฟฟ้าและวิทยุ',
    'วัสดุการศึกษา',
    'วัสดุก่อสร้าง',
    'วัสดุวิทยาศาสตร์หรือการแพทย์',
    'วัสดุการเกษตร',
    'วัสดุโฆษณาและเผยแพร่'
  ];

  const sortedCategories = Array.from(
    new Set([
      ...priorityOrder.filter(c => materialCategories.includes(c)),
      ...materialCategories,
      ...MATERIAL_CATEGORIES.filter(c => c !== 'ทั้งหมด' && !deprecatedCategories.has(c))
    ])
  );

  const availableCategories = ['ทั้งหมด', ...sortedCategories];

  // Filter materials for selection
  const filteredMaterials = materials.filter(m => {
    const q = searchQuery.trim().toLowerCase();
    const matchesCategory = selectedCategory === 'ทั้งหมด' || m.category === selectedCategory;
    const matchesUsage = selectedUsage === 'ทั้งหมด' || m.usageStatus === selectedUsage;
    const matchesSearch = !q || 
      (m.name && m.name.toLowerCase().includes(q)) || 
      (m.id && m.id.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q));
    const matchesStock = onlyInStock ? m.currentStock > 0 : true;
    return matchesCategory && matchesUsage && matchesSearch && matchesStock;
  });

  // Cart operations
  const addToCart = (mat: Material) => {
    if (mat.currentStock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.materialId === mat.id);
      if (existing) {
        if (existing.quantity >= mat.currentStock) {
          setErrorMessage(`พัสดุ "${mat.name}" คงเหลือเพียง ${mat.currentStock} ${mat.unit}`);
          return prev;
        }
        return prev.map(item => 
          item.materialId === mat.id 
            ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
            : item
        );
      } else {
        return [
          ...prev,
          {
            materialId: mat.id,
            materialName: mat.name,
            category: mat.category,
            unit: mat.unit,
            unitPrice: mat.unitPrice,
            quantity: 1,
            totalPrice: mat.unitPrice,
            currentStockSnapshot: mat.currentStock
          }
        ];
      }
    });
    setErrorMessage('');
  };

  const updateQuantity = (materialId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.materialId === materialId) {
          const mat = materials.find(m => m.id === materialId);
          const maxAvailable = mat ? mat.currentStock : item.quantity;
          const newQty = item.quantity + delta;

          if (newQty <= 0) return item;
          if (newQty > maxAvailable) {
            setErrorMessage(`ไม่สามารถเบิกเกินยอดคงเหลือ (${maxAvailable} ${item.unit}) ได้`);
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitPrice
          };
        }
        return item;
      });
    });
  };

  const removeFromCart = (materialId: string) => {
    setCart(prev => prev.filter(item => item.materialId !== materialId));
  };

  // Calculations
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  // Build order object helper
  const constructOrderObject = (): Order => {
    return {
      id: `ORD-${Date.now()}`,
      docNo: docNo.trim(),
      date,
      requesterName: requesterName.trim(),
      requesterEmail: requesterEmail.trim() || undefined,
      requesterPosition: requesterPosition.trim(),
      department,
      purpose: purpose.trim() || 'เพื่อใช้ในงานราชการและการเรียนการสอนของวิทยาลัย',
      items: [...cart],
      totalItems: totalItemsCount,
      totalAmount: totalCartAmount,
      status: 'รออนุมัติ',
      createdAt: new Date().toISOString()
    };
  };

  // Preview official document before submitting
  const handlePreview = () => {
    if (!requesterName.trim()) {
      setErrorMessage('กรุณาระบุชื่อ-สกุล ผู้ขอเบิก ก่อนพิมพ์เอกสาร');
      return;
    }
    if (!requesterPosition.trim()) {
      setErrorMessage('กรุณาเลือกสถานะ / ตำแหน่งผู้ขอเบิก ก่อนพิมพ์เอกสาร');
      return;
    }
    if (cart.length === 0) {
      setErrorMessage('กรุณาเลือกรายการวัสดุที่ต้องการเบิกอย่างน้อย 1 รายการ');
      return;
    }
    setErrorMessage('');
    const orderPreview = constructOrderObject();
    onPreviewOfficialDocument(orderPreview);
  };

  // Submit Order
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!requesterName.trim()) {
      setErrorMessage('กรุณากรอกชื่อ-สกุล ผู้ขอเบิก');
      return;
    }
    if (!requesterPosition.trim()) {
      setErrorMessage('กรุณาเลือกสถานะ / ตำแหน่งผู้ขอเบิก');
      return;
    }
    if (cart.length === 0) {
      setErrorMessage('กรุณาเลือกรายการวัสดุเข้าใบเบิกอย่างน้อย 1 รายการ');
      return;
    }

    try {
      setIsSubmitting(true);
      const newOrder = constructOrderObject();
      await onSubmitOrder(newOrder);

      // Celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setSuccessMessage(`ยื่นใบเบิกเลขที่ ${newOrder.docNo} สำเร็จแล้ว! คุณสามารถพิมพ์ใบเบิกหรือติดตามสถานะได้ในแท็บ "รายการใบเบิก"`);
      setCart([]);
      setPurpose('');
      setDocNo(generateNextRequisitionDocNo([...orders, newOrder], date));
    } catch (err: any) {
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการส่งคำขอ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-full" style={{ width: '100%', maxWidth: '100%' }}>
      
      {/* Title & Banner */}
      <div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3"
        style={{ lineHeight: '20px' }}
      >
        <div>
          <h2 
            className="font-bold text-slate-800 dark:text-white flex items-center gap-2"
            style={{ fontSize: '26px', fontFamily: 'Sarabun' }}
          >
            <FileText className="w-8 h-8 text-amber-500 shrink-0" />
            เบิกวัสดุ วิทยาลัยการเมืองการปกครอง
          </h2>
          <p 
            className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1"
            style={{ fontFamily: 'Sarabun' }}
          >
            เลือกพัสดุจากรายการด้านซ้าย และตรวจสอบข้อมูลใบเบิกที่ด้านข้างเพื่อยื่นเอกสารขอเบิกได้ทันที
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-semibold">
            ในใบเบิก: {cart.length} ชนิด ({totalItemsCount} ชิ้น) • ฿{totalCartAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button 
            onClick={() => setSuccessMessage('')}
            className="text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* 2-COLUMN FULL-WIDTH LAYOUT: 
          - ฝั่ง 'เขียนใบเบิกวัสดุ' (ซ้าย) ขยายกว้างเต็มพื้นที่ที่เหลือทั้งหมด (1fr / flex: 1)
          - ฝั่ง 'ข้อมูลใบเบิกวัสดุ' (ขวา) ล็อกความกว้างไว้เท่าเดิม
      */}
      <div 
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start w-full"
        style={{ width: '100%', maxWidth: '100%' }}
      >
        
        {/* LEFT COLUMN: 'เขียนใบเบิกวัสดุ' (MATERIAL CATALOG) — ขยายกว้างเต็มพื้นที่ที่เหลือทั้งหมด (1fr) */}
        <div className="w-full min-w-0 space-y-4">
          <div 
            className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
            style={{ lineHeight: '21px' }}
          >
            
            {/* Search, Stock Filter & Mode Switcher */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500 pointer-events-none" />
                <input
                  id="material-search-input"
                  name="material-search"
                  type="text"
                  placeholder="พิมพ์ค้นหาชื่อพัสดุ หรือรหัส เช่น 1ก01, Double A, ปากกา..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:text-slate-500 cursor-text text-slate-900"
                  style={{ backgroundColor: '#e1e5eb', color: '#0f172a' }}
                  autoComplete="off"
                  spellCheck={false}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-300 text-slate-600 cursor-pointer"
                    title="ล้างคำค้นหา"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label 
                  className="flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer select-none px-2.5 py-2 rounded-lg border border-emerald-300 shadow-2xs font-semibold"
                  style={{ backgroundColor: '#a0f5aa' }}
                >
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={e => setOnlyInStock(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span style={{ fontSize: '16px', color: '#0f172a' }}>เฉพาะมีของ</span>
                </label>

                <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-2xs font-semibold'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="มุมมองการ์ด"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-2xs font-semibold'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="มุมมองรายการ"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter & Usage Filter */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-0.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <label 
                  htmlFor="material-category-select" 
                  className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0"
                  style={{ fontFamily: 'Sarabun' }}
                >
                  <FolderTree className="w-4 h-4 text-amber-500" />
                  <span>เลือกจากหมวดหมู่ที่มีในระบบ:</span>
                </label>
                <div className="relative flex-1 sm:w-72">
                  <select
                    id="material-category-select"
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer shadow-2xs appearance-none"
                    style={{ fontFamily: 'Sarabun' }}
                  >
                    {availableCategories.map(category => {
                      const count = category === 'ทั้งหมด'
                        ? materials.length
                        : materials.filter(m => m.category === category).length;
                      return (
                        <option key={category} value={category}>
                          {category === 'ทั้งหมด' ? `📁 ทุกหมวดหมู่ (${count} รายการ)` : `📦 ${category} (${count} รายการ)`}
                        </option>
                      );
                    })}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* ปุ่มเลือกแสดงผล การใช้งาน: ทั้งหมด / ประจำ / ครั้งคราว */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span 
                  className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 shrink-0"
                  style={{ fontFamily: 'Sarabun' }}
                >
                  การใช้งาน:
                </span>
                <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {(['ทั้งหมด', 'ประจำ', 'ครั้งคราว'] as const).map(usage => (
                    <button
                      key={usage}
                      type="button"
                      onClick={() => setSelectedUsage(usage)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        selectedUsage === usage
                          ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      style={{ fontFamily: 'Sarabun' }}
                    >
                      {usage}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results count banner */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
              <span style={{ fontFamily: 'Sarabun', fontSize: '15px' }}>แสดงพัสดุ {filteredMaterials.length} รายการ</span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">คลิก "+ ขอเบิก" เพื่อเพิ่มลงในใบเบิก</span>
            </div>

            {/* Material Catalog: Grid View — Responsive Adaptive Cards */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1900px]:grid-cols-5 gap-3.5 max-h-[820px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredMaterials.map(mat => {
                  const isOutOfStock = mat.currentStock <= 0;
                  const isLowStock = mat.currentStock > 0 && mat.currentStock <= 10;
                  const inCart = cart.find(item => item.materialId === mat.id);

                  return (
                    <div
                      key={mat.id}
                      className={`group relative bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col overflow-hidden ${
                        isOutOfStock
                          ? 'border-slate-200 dark:border-slate-800 opacity-65 bg-slate-50/60 dark:bg-slate-900/40'
                          : inCart
                          ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500'
                      }`}
                    >
                      {/* Product Image — เต็มสัดส่วนแท้จริง ไม่บีบอัด ไม่ตัดขอบ ด้วย object-fit: contain */}
                      <div className="relative h-36 sm:h-44 w-full bg-white dark:bg-slate-900/90 overflow-hidden flex items-center justify-center p-2 border-b border-slate-100 dark:border-slate-700/60">
                        {mat.imageUrl ? (
                          <img
                            src={mat.imageUrl}
                            alt={mat.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            style={{ objectFit: 'contain' }}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Boxes className="w-9 h-9 stroke-1 text-slate-300 dark:text-slate-600" />
                            <span className="text-[10px] mt-1 font-mono font-bold text-slate-400">{mat.id}</span>
                          </div>
                        )}

                        {/* Top-Left: Material Code Pill */}
                        <div 
                          className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/85 backdrop-blur-md text-amber-300 rounded font-mono font-bold shadow-xs"
                          style={{ fontSize: '16px' }}
                        >
                          {mat.id}
                        </div>

                        {/* Top-Right: Stock Status Pill */}
                        <div className="absolute top-2 right-2">
                          {isOutOfStock ? (
                            <span 
                              className="px-2 py-0.5 bg-rose-600 text-white rounded-md font-bold shadow-md"
                              style={{ fontSize: '25px', lineHeight: '1.2' }}
                            >
                              หมด
                            </span>
                          ) : isLowStock ? (
                            <span 
                              className="px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded-md font-extrabold shadow-md flex items-center gap-1"
                              style={{ fontSize: '25px', lineHeight: '1.2' }}
                            >
                              <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                              {mat.currentStock}
                            </span>
                          ) : (
                            <span 
                              className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-md font-extrabold shadow-md flex items-center gap-1"
                              style={{ fontSize: '25px', lineHeight: '1.2' }}
                            >
                              <Check className="w-5 h-5 stroke-[2.5]" />
                              {mat.currentStock}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content: รูปแบบการแสดงผลตามแบบ กบเหลาดินสอ (เล็ก) */}
                      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            {(() => {
                              const catStyle = getCategoryBadgeStyle(mat.category);
                              return (
                                <span 
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold border shadow-2xs truncate"
                                  style={{ 
                                    backgroundColor: catStyle.bg,
                                    color: catStyle.text,
                                    borderColor: catStyle.border,
                                    fontFamily: 'Sarabun'
                                  }}
                                  title={mat.category}
                                >
                                  {mat.category}
                                </span>
                              );
                            })()}
                            <span 
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded border shrink-0 ${
                                mat.usageStatus === 'ประจำ'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                                  : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800'
                              }`}
                              style={{ fontFamily: 'Sarabun' }}
                            >
                              {mat.usageStatus || 'ประจำ'}
                            </span>
                          </div>
                          <h4 
                            className="text-slate-950 dark:text-white line-clamp-2 min-h-[52px]" 
                            style={{ 
                              fontSize: '21.6px', 
                              fontWeight: 'bold', 
                              fontFamily: 'Sarabun',
                              lineHeight: '29.7px',
                              textAlign: 'left'
                            }}
                            title={mat.name}
                          >
                            {mat.name}
                          </h4>
                        </div>

                        {/* Stock Balance Box */}
                        <div className={`px-3 py-1.5 sm:py-2 rounded-xl border flex items-center justify-between transition-colors shadow-2xs ${
                          isOutOfStock 
                            ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60' 
                            : isLowStock 
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' 
                            : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/50'
                        }`}>
                          <span className="font-medium text-slate-600 dark:text-slate-300" style={{ fontSize: '14px', fontFamily: 'Sarabun' }}>
                            คงเหลือ:
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span 
                              className={`font-mono ${
                                isOutOfStock 
                                  ? 'text-rose-600 dark:text-rose-400' 
                                  : isLowStock 
                                  ? 'text-amber-600 dark:text-amber-400' 
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                              style={{ fontSize: '23px', fontWeight: 'bold', lineHeight: '30px' }}
                            >
                              {mat.currentStock.toLocaleString()}
                            </span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300" style={{ fontSize: '14px', fontFamily: 'Sarabun' }}>
                              {mat.unit}
                            </span>
                          </div>
                        </div>

                        {/* Real-time Movement Linkage (รับเข้า / เบิกจ่ายสะสม) */}
                        {((mat.purchaseQty || 0) > 0 || (mat.totalWithdrawn || 0) > 0) && (
                          <div className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5" title="ยอดรับเข้าพัสดุสะสม">
                              <ArrowDownRight className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>รับ: +{(mat.purchaseQty || 0).toLocaleString()}</span>
                            </span>
                            <span className="text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-0.5" title="ยอดเบิกจ่ายพัสดุสะสม">
                              <ArrowUpRight className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>จ่าย: -{(mat.totalWithdrawn || 0).toLocaleString()}</span>
                            </span>
                          </div>
                        )}

                        {/* Price & Action Button */}
                        <div 
                          className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/50 gap-1"
                          style={{ fontSize: '19px' }}
                        >
                          <div className="leading-none flex items-baseline">
                            <span className="font-bold text-slate-800 dark:text-slate-200" style={{ fontSize: '14px', fontFamily: 'Sarabun' }}>฿{mat.unitPrice}</span>
                            <span className="text-slate-400 ml-0.5" style={{ fontSize: '14px', fontFamily: 'Sarabun' }}>/{mat.unit}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isAdmin && onSelectMaterialForLedger && (
                              <button
                                type="button"
                                onClick={() => onSelectMaterialForLedger(mat.id)}
                                title="เปิดดูสมุดคุมบัญชีพัสดุ / ทะเบียนพัสดุรายการนี้"
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </button>
                            )}

                            {isOutOfStock ? (
                              <span className="font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs" style={{ fontFamily: 'Sarabun' }}>
                                หมด
                              </span>
                            ) : inCart ? (
                              <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-1 py-0.5 rounded-lg shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(mat.id, -1)}
                                  className="p-1 hover:bg-amber-200/70 dark:hover:bg-amber-900 rounded text-amber-900 dark:text-amber-200 transition cursor-pointer"
                                  title="ลดจำนวน"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-bold text-sm text-amber-900 dark:text-amber-100 font-mono">
                                  {inCart.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(mat.id, 1)}
                                  className="p-1 hover:bg-amber-200/70 dark:hover:bg-amber-900 rounded text-amber-900 dark:text-amber-200 transition cursor-pointer"
                                  title="เพิ่มจำนวน"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(mat)}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white rounded-lg font-bold transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span style={{ fontSize: '14px', fontFamily: 'Sarabun' }}>ขอเบิก</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredMaterials.map(mat => {
                  const isOutOfStock = mat.currentStock <= 0;
                  const isLowStock = mat.currentStock > 0 && mat.currentStock <= 10;
                  const inCart = cart.find(item => item.materialId === mat.id);

                  return (
                    <div
                      key={mat.id}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isOutOfStock
                          ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                          : inCart
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {mat.imageUrl ? (
                          <img
                            src={mat.imageUrl}
                            alt={mat.name}
                            className="w-16 h-16 rounded-xl object-contain bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                            style={{ objectFit: 'contain' }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-400 flex flex-col items-center justify-center text-xs font-bold shrink-0">
                            <Boxes className="w-6 h-6 stroke-1 text-slate-400 mb-0.5" />
                            <span className="font-mono text-[9px]">{mat.id}</span>
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-900 text-amber-300 dark:bg-slate-700 rounded">
                              {mat.id}
                            </span>
                            {(() => {
                              const catStyle = getCategoryBadgeStyle(mat.category);
                              return (
                                <span 
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold border shadow-2xs truncate"
                                  style={{ 
                                    backgroundColor: catStyle.bg,
                                    color: catStyle.text,
                                    borderColor: catStyle.border,
                                    fontFamily: 'Sarabun'
                                  }}
                                  title={mat.category}
                                >
                                  {mat.category}
                                </span>
                              );
                            })()}
                            <span 
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                mat.usageStatus === 'ประจำ'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                                  : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800'
                              }`}
                              style={{ fontFamily: 'Sarabun' }}
                            >
                              {mat.usageStatus || 'ประจำ'}
                            </span>
                          </div>

                          <h4 
                            className="text-slate-950 dark:text-white truncate"
                            style={{ 
                              fontSize: '21.6px', 
                              fontWeight: 'bold', 
                              fontFamily: 'Sarabun',
                              lineHeight: '29.7px',
                              textAlign: 'left'
                            }}
                            title={mat.name}
                          >
                            {mat.name}
                          </h4>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              <span>คงเหลือ:</span>
                              <strong className="text-base font-black font-mono tracking-tight" style={{ fontWeight: 800 }}>
                                {mat.currentStock.toLocaleString()}
                              </strong>
                              <span className="font-semibold">{mat.unit}</span>
                            </span>

                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              ราคา: ฿{mat.unitPrice} /{mat.unit}
                            </span>

                            {((mat.purchaseQty || 0) > 0 || (mat.totalWithdrawn || 0) > 0) && (
                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                                  <span>รับ: +{(mat.purchaseQty || 0).toLocaleString()}</span>
                                </span>
                                <span>•</span>
                                <span className="text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                                  <ArrowUpRight className="w-3 h-3 text-blue-600" />
                                  <span>จ่าย: -{(mat.totalWithdrawn || 0).toLocaleString()}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isAdmin && onSelectMaterialForLedger && (
                          <button
                            type="button"
                            onClick={() => onSelectMaterialForLedger(mat.id)}
                            title="เปิดดูสมุดคุมบัญชีพัสดุ (Stock Card)"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                        )}

                        {isOutOfStock ? (
                          <span className="px-3 py-1.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-medium">
                            หมดสต็อก
                          </span>
                        ) : inCart ? (
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-amber-400 shadow-xs">
                            <button
                              type="button"
                              onClick={() => updateQuantity(mat.id, -1)}
                              className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center font-bold text-xs text-amber-700 dark:text-amber-300 font-mono">
                              {inCart.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(mat.id, 1)}
                              className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(mat)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>ขอเบิก</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredMaterials.length === 0 && (
              <div className="py-16 text-center text-slate-400">
                <Boxes className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {materials.length === 0 ? 'ยังไม่มีข้อมูลพัสดุในระบบ (0 รายการ)' : 'ไม่พบรายการพัสดุที่ตรงกับเงื่อนไข'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {materials.length === 0 ? 'คลิกปุ่มด้านล่างเพื่อกู้คืนรายการพัสดุมาตรฐาน วก.มมส. พร้อมซิงค์ Firebase' : 'ลองเปลี่ยนหมวดหมู่หรือคำค้นหา'}
                </p>
                {materials.length === 0 && (
                  <button
                    type="button"
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
                    <span>กู้คืนรายการพัสดุ วก.มมส.</span>
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        {/* RIGHT COLUMN: 'ข้อมูลใบเบิกวัสดุ' — ล็อกความกว้างไว้เท่าเดิม (380px - 400px) */}
        <div className="w-full lg:w-[380px] xl:w-[400px] shrink-0 lg:sticky lg:top-20">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            
            {/* Header: Title & Doc Info */}
            <div className="p-3.5 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 
                    className="text-slate-800 dark:text-white leading-tight"
                    style={{ fontWeight: 'bold', fontSize: '23px', fontFamily: 'Sarabun' }}
                  >
                    ข้อมูลใบเบิกพัสดุ
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    วิทยาลัยการเมืองการปกครอง (COPAG MSU)
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span 
                  className="font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-800 block"
                  style={{ fontSize: '15px' }}
                >
                  {docNo}
                </span>
                <span 
                  className="text-slate-400 font-mono mt-0.5 block"
                  style={{ fontSize: '13px' }}
                >
                  {date}
                </span>
              </div>
            </div>

            {/* Compact Form Fields */}
            <div className="p-3 space-y-2.5 border-b border-slate-100 dark:border-slate-700/70 text-xs bg-white dark:bg-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  ชื่อ-สกุล ผู้ขอเบิก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น ผศ.ดร.สมชาย ใจภักดี"
                  value={requesterName}
                  onChange={e => setRequesterName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    ตำแหน่ง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="requester-position-select"
                    value={requesterPosition}
                    onChange={e => setRequesterPosition(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-amber-400 rounded-lg text-slate-950 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer shadow-2xs"
                    style={{ 
                      backgroundColor: '#e4ce15', 
                      fontSize: '12px', 
                      lineHeight: 'normal', 
                      fontFamily: 'Sarabun',
                      color: '#0f172a'
                    }}
                    required
                  >
                    <option value="">-- กรุณาเลือกตำแหน่ง --</option>
                    <option value="อาจารย์">อาจารย์</option>
                    <option value="บุคลากร">บุคลากร</option>
                    <option value="นิสิต">นิสิต</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    อีเมลติดต่อ
                  </label>
                  <input
                    type="email"
                    placeholder="example@msu.ac.th"
                    value={requesterEmail}
                    onChange={e => setRequesterEmail(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  สังกัด / หน่วยงาน
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none text-slate-600 dark:text-slate-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  วัตถุประสงค์ในการขอเบิก
                </label>
                <input
                  type="text"
                  placeholder="เช่น ใช้ในการเรียนการสอน หรือจัดประชุม"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Selected Items Section in Sidebar */}
            <div className="p-3 space-y-2 flex-1 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <span 
                    className="font-bold text-slate-800 dark:text-slate-200"
                    style={{ fontSize: '15px', fontFamily: 'Sarabun' }}
                  >
                    รายการที่ขอเบิก
                  </span>
                  <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-mono font-bold rounded-full text-[10px]">
                    {cart.length}
                  </span>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    title="ล้างรายการทั้งหมด"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>ล้าง</span>
                  </button>
                )}
              </div>

              {/* Scrollable Cart Items List */}
              <div className="max-h-60 sm:max-h-64 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
                {cart.map((item, idx) => (
                  <div
                    key={item.materialId}
                    className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                          <span>#{idx + 1}</span>
                          <span className="truncate">{item.category}</span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1 mt-0.5" title={item.materialName}>
                          {item.materialName}
                        </h5>
                        <div className="text-[10px] text-slate-400">
                          @฿{item.unitPrice}/{item.unit}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.materialId)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer shrink-0"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      {/* Stepper */}
                      <div className="flex items-center bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.materialId, -1)}
                          className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-amber-700 dark:text-amber-300 font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.materialId, 1)}
                          className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs">
                        ฿{item.totalPrice.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="py-7 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white/50 dark:bg-slate-850/50">
                    <ShoppingBag className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600 mb-1 stroke-1" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">ยังไม่มีรายการในใบเบิก</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">คลิกปุ่ม "+ ขอเบิก" จากพัสดุด้านข้าง</p>
                  </div>
                )}
              </div>
            </div>

            {/* Summary & Buttons Footer */}
            <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="space-y-1" style={{ fontSize: '20px' }}>
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
                  <span>รวมจำนวนพัสดุ:</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                    {totalItemsCount} ชิ้น ({cart.length} ชนิด)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-800 dark:text-white font-bold text-xs sm:text-sm pt-1 border-t border-slate-100 dark:border-slate-700">
                  <span>รวมเป็นเงินทั้งสิ้น:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-mono text-sm sm:text-base font-bold">
                    ฿{totalCartAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-0.5">
                <button
                  type="submit"
                  id="submit-order-btn"
                  disabled={isSubmitting || cart.length === 0 || !requesterPosition.trim()}
                  className={`w-full py-2.5 px-4 font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                    cart.length === 0 || !requesterPosition.trim()
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-75'
                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                  }`}
                  title={!requesterPosition.trim() ? 'กรุณาเลือกตำแหน่งก่อนส่งเบิก' : cart.length === 0 ? 'กรุณาเลือกรายการพัสดุ' : 'ยื่นใบเบิก'}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span style={{ fontSize: '16px', fontFamily: 'Sarabun' }}>
                    {isSubmitting ? 'กำลังส่งคำขอ...' : `ยื่นใบเบิก (${totalItemsCount} ชิ้น)`}
                  </span>
                </button>

                <button
                  type="button"
                  id="preview-official-doc-btn"
                  onClick={handlePreview}
                  className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>ดูแบบฟอร์มใบเบิกทางการ (PDF)</span>
                </button>
              </div>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
};
