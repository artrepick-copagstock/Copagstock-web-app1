export type RefillStatus = 'OK' | 'ใกล้หมด' | 'วัสดุหมด';
export type UsageStatus = 'ประจำ' | 'ครั้งคราว';
export type OrderStatus = 'รออนุมัติ' | 'อนุมัติแล้ว' | 'เบิกจ่ายแล้ว' | 'ยกเลิก';

export interface PurchasePriceRecord {
  date: string;
  unitPrice: number;
  supplier: string;
  docNo?: string;
  quantity?: number;
}

export interface Material {
  id: string; // e.g. 1ก01
  no?: number;
  name: string;
  category: string;
  unitPrice: number;
  purchaseQty: number;
  unit: string;
  minQty: number;
  maxQty: number;
  openingStock?: number; // ยอดยกมาตั้งต้น
  currentStock: number;
  refillStatus: RefillStatus;
  usageStatus: UsageStatus;
  totalPurchaseCost?: number;
  totalWithdrawn?: number;
  monthlyAverage?: number;
  imageUrl?: string;
  location?: string;
  lastUpdated?: string;
  updatedAt?: string;
  recentPurchases?: PurchasePriceRecord[]; // จดจำราคาซื้อ 3 ครั้งล่าสุดว่ากี่บาท ซื้อจากร้านไหน
}

export interface OrderItem {
  materialId: string;
  materialName: string;
  category: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  currentStockSnapshot?: number;
  note?: string;
}

export interface Order {
  id: string;
  docNo: string; // e.g. วก. 2568/042
  date: string; // YYYY-MM-DD
  requesterName: string;
  requesterEmail?: string;
  requesterPosition: string;
  department: string;
  purpose: string;
  requisitionType?: 'ประจำ' | 'ครั้งคราว';
  items: OrderItem[];
  totalItems: number;
  totalAmount: number;
  status: OrderStatus;
  approverName?: string;
  approverPosition?: string;
  disbursedDate?: string;
  disburserName?: string;
  driveFileId?: string;
  driveViewLink?: string;
  createdAt?: string;
  notes?: string;
}

export interface StockIn {
  id: string;
  date: string;
  docNo: string;
  materialId: string;
  materialName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  supplier: string;
  receiverName: string;
  note?: string;
  createdAt?: string;
  obligationNo?: string; // เลขใบผูกพัน
  budgetType?: 'เงินราย' | 'เงินแผ่นดิน' | string; // ประเภทงบประมาณ: เงินราย หรือ เงินแผ่นดิน
}

export interface StockOut {
  id: string;
  date: string;
  requisitionDocNo: string;
  materialId: string;
  materialName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  requesterName: string;
  department: string;
  disburserName: string;
  note?: string;
  createdAt?: string;
}

export type UserRole = 'admin' | 'user';

export interface AppUser {
  uid?: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  position: string;
  photoUrl?: string;
  lastLoginAt?: string;
  createdAt?: string;
  loginCount?: number;
  status?: 'active' | 'suspended';
}

export interface BatchStockInItem {
  materialId: string;
  materialName: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note?: string;
}

export type ActiveTab = 'dashboard' | 'requisition' | 'inventory' | 'ledger' | 'orders' | 'batch_stockin' | 'my_orders' | 'users';
