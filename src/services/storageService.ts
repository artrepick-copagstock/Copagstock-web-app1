import { Material, Order, OrderItem, StockIn, StockOut, OrderStatus, RefillStatus, AppUser, BatchStockInItem, UserRole, PurchasePriceRecord } from '../types';
import { INITIAL_MATERIALS, INITIAL_ORDERS, INITIAL_STOCK_IN, INITIAL_STOCK_OUT } from '../mockData';
import { db, auth } from '../firebase';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { signOut as fbSignOut } from 'firebase/auth';

const STORAGE_KEYS = {
  MATERIALS: 'copag_msu_materials_v2',
  ORDERS: 'copag_msu_orders_v2',
  STOCK_IN: 'copag_msu_stock_in_v2',
  STOCK_OUT: 'copag_msu_stock_out_v2',
  AUTH_USER: 'copag_msu_auth_user_v1',
  INITIALIZED: 'copag_msu_initialized_v2',
  USERS: 'copag_msu_users_v1',
  DELETED_USERS: 'copag_msu_deleted_users_v1',
  STOCK_IN_PRESETS: 'copag_msu_stock_in_presets_v1'
};

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    ['copag_msu_materials_v1', 'copag_msu_orders_v1', 'copag_msu_stock_in_v1', 'copag_msu_stock_out_v1', 'copag_msu_initialized_v1'].forEach(k => {
      localStorage.removeItem(k);
    });
  }
} catch {}

export const PRESET_USERS: AppUser[] = [
  {
    email: 'kanjanapat.m@msu.ac.th',
    name: 'กานต์จนาภัทร (ผู้ดูแลระบบหลัก)',
    role: 'admin',
    department: 'วิทยาลัยการเมืองการปกครอง',
    position: 'ผู้ดูแลระบบสารสนเทศพัสดุ (Super Admin)',
    status: 'active',
    loginCount: 1,
    lastLoginAt: new Date().toISOString()
  },
  {
    email: 'artrepick@gmail.com',
    name: 'ผู้ดูแลระบบ (Artrepick)',
    role: 'admin',
    department: 'วิทยาลัยการเมืองการปกครอง',
    position: 'ผู้ดูแลระบบสารสนเทศพัสดุ (Admin)',
    status: 'active',
    loginCount: 1,
    lastLoginAt: new Date().toISOString()
  },
  {
    email: 'somchai.j@msu.ac.th',
    name: 'ดร.สมชาย ใจภักดี',
    role: 'user',
    department: 'สาขาวิชารัฐศาสตร์',
    position: 'อาจารย์ประจำสาขาวิชา',
    status: 'active',
    loginCount: 1,
    lastLoginAt: new Date().toISOString()
  },
  {
    email: 'kanokporn.s@msu.ac.th',
    name: 'นางสาวกนกพร สุทธิสาร',
    role: 'user',
    department: 'สำนักงานคณบดี',
    position: 'นักวิเคราะห์นโยบายและแผน',
    status: 'active',
    loginCount: 1,
    lastLoginAt: new Date().toISOString()
  },
  {
    email: 'copag.parcel@msu.ac.th',
    name: 'เจ้าหน้าที่พัสดุ',
    role: 'admin',
    department: 'งานพัสดุและอาคารสถานที่',
    position: 'นักวิชาการพัสดุชำนาญการ',
    status: 'active',
    loginCount: 1,
    lastLoginAt: new Date().toISOString()
  }
];

export function calculateRefillStatus(currentStock: number, minQty: number): RefillStatus {
  if (currentStock <= 0) return 'วัสดุหมด';
  if (currentStock <= minQty) return 'ใกล้หมด';
  return 'OK';
}

/**
 * Strict authorization check: Only emails ending with @msu.ac.th or @oas.msu.ac.th
 */
export function isAllowedMsuEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (clean === 'artrepick@gmail.com') return true;
  return clean.endsWith('@msu.ac.th') || clean.endsWith('@oas.msu.ac.th');
}

export function isMsuEmail(email: string): boolean {
  return isAllowedMsuEmail(email);
}

export function getThaiFiscalYear(dateStringOrDate?: string | Date): number {
  const d = dateStringOrDate ? new Date(dateStringOrDate) : new Date();
  const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const month = isNaN(d.getTime()) ? (new Date().getMonth() + 1) : (d.getMonth() + 1); // 1-12
  const buddhistYear = year + 543;
  return month >= 10 ? buddhistYear + 1 : buddhistYear;
}

export function generateNextRequisitionDocNo(orders: Order[], dateStringOrDate?: string | Date): string {
  const fiscalYear = getThaiFiscalYear(dateStringOrDate);
  const prefix = `COPAG-${fiscalYear}/`;
  
  let maxNumber = 0;
  const regex = new RegExp(`^COPAG-${fiscalYear}/(\\d+)`, 'i');
  
  for (const order of orders) {
    if (order.docNo) {
      const match = order.docNo.trim().match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  }

  const nextSeq = maxNumber + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

export class StorageService {
  // Authentication & Session
  static getCurrentUser(): AppUser | null {
    try {
      // Check session storage first (for active session in current tab/window)
      const stored = sessionStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (stored === 'logged_out' || !stored) {
        return null;
      }
      const u = JSON.parse(stored);
      if (u && u.email && isAllowedMsuEmail(u.email)) {
        if (u.email.toLowerCase() === 'kanjanapat.m@msu.ac.th' || u.email.toLowerCase() === 'artrepick@gmail.com') {
          u.role = 'admin';
        }
        return u;
      }
    } catch {
      // ignore
    }
    // Always return null by default so user must log in before entering the web app
    return null;
  }

  static setCurrentUser(user: AppUser | null): void {
    if (user) {
      if (user.email && (user.email.toLowerCase() === 'kanjanapat.m@msu.ac.th' || user.email.toLowerCase() === 'artrepick@gmail.com')) {
        user.role = 'admin';
      }
      sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, 'logged_out');
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, 'logged_out');
    }
  }

  static async signOut(): Promise<void> {
    try {
      if (auth) {
        await fbSignOut(auth);
      }
    } catch (err) {
      console.warn('Firebase signout note:', err);
    } finally {
      this.setCurrentUser(null);
    }
  }

  // Deleted User Accounts Tracking
  static getDeletedUserEmails(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_USERS);
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  }

  static addDeletedUserEmail(email: string): void {
    try {
      const set = this.getDeletedUserEmails();
      set.add(email.trim().toLowerCase());
      localStorage.setItem(STORAGE_KEYS.DELETED_USERS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  static removeDeletedUserEmail(email: string): void {
    try {
      const set = this.getDeletedUserEmails();
      set.delete(email.trim().toLowerCase());
      localStorage.setItem(STORAGE_KEYS.DELETED_USERS, JSON.stringify(Array.from(set)));
    } catch {}
  }

  // User Accounts Management (for Admin and tracking logins)
  static async getUsers(): Promise<AppUser[]> {
    const deletedEmails = this.getDeletedUserEmails();
    const userMap = new Map<string, AppUser>();

    const mergeUser = (u: AppUser) => {
      if (!u || !u.email) return;
      const clean = u.email.trim().toLowerCase();
      if (deletedEmails.has(clean)) return;

      const isAdminEmail = clean === 'kanjanapat.m@msu.ac.th' || clean === 'artrepick@gmail.com';
      if (userMap.has(clean)) {
        const existing = userMap.get(clean)!;
        userMap.set(clean, {
          ...existing,
          ...u,
          email: clean,
          uid: u.uid || existing.uid,
          photoUrl: u.photoUrl || existing.photoUrl,
          name: u.name || existing.name,
          role: isAdminEmail ? 'admin' : (u.role || existing.role || 'user'),
          lastLoginAt: u.lastLoginAt || existing.lastLoginAt,
          loginCount: Math.max(u.loginCount || 0, existing.loginCount || 0)
        });
      } else {
        userMap.set(clean, {
          ...u,
          email: clean,
          role: isAdminEmail ? 'admin' : (u.role || 'user')
        });
      }
    };

    try {
      if (db) {
        try {
          const snapshot = await getDocs(collection(db, 'users'));
          if (!snapshot.empty) {
            snapshot.forEach(docSnap => {
              const u = docSnap.data() as AppUser;
              mergeUser(u);
            });
          }
        } catch (e) {
          console.warn('Firestore users read error, using cache:', e);
        }
      }

      // Check local cache
      const cached = localStorage.getItem(STORAGE_KEYS.USERS);
      if (cached) {
        try {
          const parsed: AppUser[] = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.forEach(u => mergeUser(u));
          }
        } catch {}
      }

      // Merge preset users
      PRESET_USERS.forEach(preset => mergeUser(preset));

      const finalUsers = Array.from(userMap.values());
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(finalUsers));
      return finalUsers;
    } catch {
      PRESET_USERS.forEach(preset => mergeUser(preset));
      return Array.from(userMap.values());
    }
  }

  static async saveOrUpdateUser(user: AppUser): Promise<AppUser> {
    const cleanEmail = user.email.trim().toLowerCase();
    this.removeDeletedUserEmail(cleanEmail);
    const isSuperAdmin = cleanEmail === 'kanjanapat.m@msu.ac.th';
    const finalRole: UserRole = isSuperAdmin ? 'admin' : (user.role || 'user');

    const users = await this.getUsers();
    const existingIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    let updatedUser: AppUser;
    if (existingIndex >= 0) {
      const existing = users[existingIndex];
      updatedUser = {
        ...existing,
        ...user,
        email: cleanEmail,
        role: isSuperAdmin ? 'admin' : (user.role || existing.role || 'user'),
        department: user.department || existing.department || 'วิทยาลัยการเมืองการปกครอง',
        position: user.position || existing.position || (finalRole === 'admin' ? 'เจ้าหน้าที่พัสดุ' : 'อาจารย์/บุคลากร'),
        lastLoginAt: new Date().toISOString(),
        loginCount: (existing.loginCount || 0) + 1,
        status: existing.status || 'active'
      };
      users[existingIndex] = updatedUser;
    } else {
      updatedUser = {
        ...user,
        email: cleanEmail,
        role: finalRole,
        department: user.department || 'วิทยาลัยการเมืองการปกครอง',
        position: user.position || (finalRole === 'admin' ? 'เจ้าหน้าที่พัสดุ' : 'อาจารย์/บุคลากร'),
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        loginCount: 1,
        status: 'active'
      };
      users.push(updatedUser);
    }

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    if (db) {
      try {
        const safeDocId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        await setDoc(doc(db, 'users', safeDocId), updatedUser, { merge: true });
      } catch (e) {
        console.warn('Firestore user save error:', e);
      }
    }

    return updatedUser;
  }

  static async updateUserRole(email: string, newRole: UserRole): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();

    const users = await this.getUsers();
    const target = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (target) {
      target.role = newRole;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      if (db) {
        try {
          const safeDocId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
          await updateDoc(doc(db, 'users', safeDocId), { role: newRole });
        } catch (e) {
          console.warn('Firestore user role update error:', e);
        }
      }
    }
  }

  static async updateUserStatus(email: string, status: 'active' | 'suspended'): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();

    const users = await this.getUsers();
    const target = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (target) {
      target.status = status;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      if (db) {
        try {
          const safeDocId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
          await updateDoc(doc(db, 'users', safeDocId), { status });
        } catch (e) {
          console.warn('Firestore user status update error:', e);
        }
      }
    }
  }

  static async deleteUser(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    this.addDeletedUserEmail(cleanEmail);

    const users = (await this.getUsers()).filter(u => u.email.toLowerCase() !== cleanEmail);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    if (db) {
      try {
        const safeDocId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        await deleteDoc(doc(db, 'users', safeDocId));

        // Also query collection to delete any docs matching email
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', cleanEmail));
          const snap = await getDocs(q);
          const delPromises = snap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(delPromises);
        } catch (qErr) {
          console.warn('Firestore email query delete error:', qErr);
        }

        // Direct email docId check
        try {
          await deleteDoc(doc(db, 'users', cleanEmail));
        } catch {}
      } catch (e) {
        console.warn('Firestore user delete error:', e);
      }
    }

    // If currently logged in user is deleted, clear session
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.email.toLowerCase() === cleanEmail) {
      await this.signOut();
      if (auth && auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (authErr) {
          console.warn('Firebase auth delete error:', authErr);
        }
      }
    }
  }

  // Instant synchronous cache reader
  static getCachedMaterials(): Material[] {
    const normalizeMat = (m: Material): Material => {
      let cat = (m.category || '').trim();
      if (cat === 'กระดาษและสิ่งพิมพ์' || cat === 'เครื่องเขียน' || cat === 'แฟ้มและอุปกรณ์จัดเก็บ') {
        cat = 'วัสดุสำนักงาน';
      } else if (cat === 'ผลิตภัณฑ์ทำความสะอาด') {
        cat = 'วัสดุงานบ้านและงานครัว';
      }
      return { ...m, category: cat };
    };

    try {
      const cached = localStorage.getItem(STORAGE_KEYS.MATERIALS);
      if (cached) {
        const parsed: Material[] = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 300) {
          return parsed.map(normalizeMat);
        }
      }
    } catch {}
    try {
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(INITIAL_MATERIALS));
    } catch {}
    return [...INITIAL_MATERIALS];
  }

  // Seed Default Materials into Firestore and LocalStorage
  static async seedMaterialsIfEmpty(force = false): Promise<Material[]> {
    try {
      const existing = this.getCachedMaterials();
      const existingMap = new Map(existing.map(m => [m.id, m]));
      
      const mergedList: Material[] = INITIAL_MATERIALS.map(initMat => {
        const ex = existingMap.get(initMat.id);
        if (!ex) return initMat;
        return {
          ...initMat,
          imageUrl: ex.imageUrl || initMat.imageUrl || '',
          currentStock: ex.currentStock ?? initMat.currentStock,
          openingStock: ex.openingStock ?? initMat.openingStock,
          unitPrice: ex.unitPrice ?? initMat.unitPrice,
          location: ex.location || initMat.location,
          recentPurchases: ex.recentPurchases || initMat.recentPurchases
        };
      });

      // Preserve any custom items added by user
      const initIds = new Set(INITIAL_MATERIALS.map(m => m.id));
      existing.forEach(m => {
        if (!initIds.has(m.id)) {
          mergedList.push(m);
        }
      });

      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(mergedList));
      if (db) {
        const batchSize = 50;
        for (let i = 0; i < mergedList.length; i += batchSize) {
          const chunk = mergedList.slice(i, i + batchSize);
          await Promise.allSettled(chunk.map(mat => {
            return setDoc(doc(db, 'materials', mat.id), {
              ...mat,
              refillStatus: calculateRefillStatus(mat.currentStock, mat.minQty),
              lastUpdated: mat.lastUpdated || new Date().toISOString()
            }, { merge: true });
          }));
        }
        console.info(`Seeded ${mergedList.length} materials into Firestore.`);
      }
      return mergedList;
    } catch (e) {
      console.warn('Seeding materials notice:', e);
      return [...INITIAL_MATERIALS];
    }
  }

  // Helper to synchronize materials with full stock-in and stock-out ledger history
  static syncMaterialsWithLedger(
    materials: Material[], 
    stockInLogs: StockIn[] = [], 
    stockOutLogs: StockOut[] = []
  ): Material[] {
    if (!materials || materials.length === 0) return [];

    const stockInMap = new Map<string, StockIn[]>();
    (stockInLogs || []).forEach(entry => {
      if (!entry.materialId) return;
      const list = stockInMap.get(entry.materialId) || [];
      list.push(entry);
      stockInMap.set(entry.materialId, list);
    });

    const stockOutMap = new Map<string, StockOut[]>();
    (stockOutLogs || []).forEach(entry => {
      if (!entry.materialId) return;
      const list = stockOutMap.get(entry.materialId) || [];
      list.push(entry);
      stockOutMap.set(entry.materialId, list);
    });

    return materials.map(m => {
      const inEntries = stockInMap.get(m.id) || [];
      const outEntries = stockOutMap.get(m.id) || [];

      // Calculate total stock-in quantity & cost
      const totalInQty = inEntries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      const totalInCost = inEntries.reduce((sum, e) => sum + (Number(e.totalPrice) || (Number(e.quantity) || 0) * (Number(e.unitPrice) || 0)), 0);

      // Calculate total stock-out quantity
      const totalOutQty = outEntries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);

      // Determine opening balance (ยอดยกมา)
      let baseOpeningStock = 0;
      if (m.openingStock !== undefined && m.openingStock !== null) {
        baseOpeningStock = Number(m.openingStock) || 0;
      } else {
        // Derive opening stock so that currentStock = baseOpeningStock + totalInQty - totalOutQty
        baseOpeningStock = Math.max(0, (Number(m.currentStock) || 0) - totalInQty + totalOutQty);
      }

      // Reconcile currentStock mathematically: ยอดยกมา + รับเข้า - จ่ายออก
      const reconciledCurrentStock = Math.max(0, baseOpeningStock + totalInQty - totalOutQty);
      const refillStatus = calculateRefillStatus(reconciledCurrentStock, m.minQty);

      // Unit price and 3 recent purchases
      let latestUnitPrice = m.unitPrice;
      let recentPurchases = m.recentPurchases || [];

      if (inEntries.length > 0) {
        const sortedIn = [...inEntries].sort((a, b) => {
          const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (timeDiff !== 0) return timeDiff;
          return new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime();
        });

        const latestIn = sortedIn[0];
        if (latestIn.unitPrice > 0) {
          latestUnitPrice = latestIn.unitPrice;
        }

        const fromLogs: PurchasePriceRecord[] = sortedIn.map(e => ({
          date: e.date,
          unitPrice: e.unitPrice,
          supplier: e.supplier || 'ไม่ระบุร้านค้า',
          docNo: e.docNo,
          quantity: e.quantity
        }));

        const mergedList = [...fromLogs];
        (m.recentPurchases || []).forEach(existing => {
          const isDuplicate = mergedList.some(item => 
            (item.docNo && existing.docNo && item.docNo.toLowerCase() === existing.docNo.toLowerCase()) ||
            (item.date === existing.date && item.unitPrice === existing.unitPrice && item.supplier === existing.supplier)
          );
          if (!isDuplicate) {
            mergedList.push(existing);
          }
        });
        recentPurchases = mergedList.slice(0, 3);
      } else {
        if (!recentPurchases || recentPurchases.length === 0) {
          recentPurchases = [{
            date: 'รับเข้าตั้งต้น',
            unitPrice: m.unitPrice,
            supplier: 'ร้านค้าคู่สัญญา วก.มมส.',
            docNo: 'ยกยอดตั้งต้น'
          }];
        } else if (recentPurchases[0]?.unitPrice > 0 && (!m.unitPrice || m.unitPrice <= 0)) {
          latestUnitPrice = recentPurchases[0].unitPrice;
        }
      }

      return {
        ...m,
        openingStock: baseOpeningStock,
        currentStock: reconciledCurrentStock,
        purchaseQty: totalInQty,
        totalWithdrawn: totalOutQty,
        totalPurchaseCost: totalInCost,
        unitPrice: latestUnitPrice,
        refillStatus,
        recentPurchases
      };
    });
  }

  // Helper alias for backward compatibility
  static syncMaterialsWithStockIn(materials: Material[], stockInLogs: StockIn[]): Material[] {
    let outLogs: StockOut[] = [];
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.STOCK_OUT);
      if (cached) outLogs = JSON.parse(cached);
    } catch {}
    return this.syncMaterialsWithLedger(materials, stockInLogs, outLogs);
  }

  // Load Materials
  static async getMaterials(): Promise<Material[]> {
    const normalizeMat = (m: Material): Material => {
      let loc = m.location;
      if (!loc || loc === 'ตู้พัสดุ A1' || loc === 'ตู้พัสดุA1') {
        loc = 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง';
      }
      let cat = (m.category || '').trim();
      if (cat === 'กระดาษและสิ่งพิมพ์' || cat === 'เครื่องเขียน' || cat === 'แฟ้มและอุปกรณ์จัดเก็บ') {
        cat = 'วัสดุสำนักงาน';
      } else if (cat === 'ผลิตภัณฑ์ทำความสะอาด') {
        cat = 'วัสดุงานบ้านและงานครัว';
      }
      return { ...m, location: loc, category: cat };
    };

    const applyStockInSync = (mats: Material[]): Material[] => {
      try {
        const cachedStockIn = localStorage.getItem(STORAGE_KEYS.STOCK_IN);
        if (cachedStockIn) {
          const logs: StockIn[] = JSON.parse(cachedStockIn);
          if (Array.isArray(logs) && logs.length > 0) {
            return this.syncMaterialsWithStockIn(mats, logs);
          }
        }
      } catch {}
      return this.syncMaterialsWithStockIn(mats, []);
    };

    try {
      let firestoreMaterials: Material[] | null = null;

      if (db) {
        try {
          // Timeout protection: wait max 8000ms for large catalog
          const snapshotPromise = getDocs(collection(db, 'materials'));
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 8000)
          );
          const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);

          if (snapshot && !snapshot.empty) {
            const list: Material[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as Material;
              if (data && data.id && data.name) {
                list.push(normalizeMat(data));
              }
            });

            // CRITICAL: Preserve any locally saved materials that might not have reached Firestore yet
            const cachedRaw = localStorage.getItem(STORAGE_KEYS.MATERIALS);
            if (cachedRaw) {
              try {
                const cachedList: Material[] = JSON.parse(cachedRaw);
                if (Array.isArray(cachedList)) {
                  const firestoreIds = new Set(list.map(m => m.id));
                  cachedList.forEach(cMat => {
                    if (cMat && cMat.id && !firestoreIds.has(cMat.id)) {
                      list.push(normalizeMat(cMat));
                    }
                  });
                }
              } catch {}
            }

            // Merge missing items from full catalog
            const existingIds = new Set(list.map(m => m.id));
            INITIAL_MATERIALS.forEach(initMat => {
              if (!existingIds.has(initMat.id)) {
                list.push(normalizeMat(initMat));
              }
            });
            list.sort((a, b) => (a.no || 0) - (b.no || 0));
            const syncedList = applyStockInSync(list);
            localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(syncedList));
            firestoreMaterials = syncedList;
            return syncedList;
          }
        } catch (e) {
          console.warn('Firestore offline/permission notice, loading from local cache:', e);
        }
      }

      // Check local cache
      const cached = localStorage.getItem(STORAGE_KEYS.MATERIALS);
      if (cached) {
        try {
          const parsed: Material[] = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return applyStockInSync(parsed.map(normalizeMat));
          }
        } catch {}
      }

      // Fallback to initial 367 materials and cache them
      const normalizedInit = applyStockInSync(INITIAL_MATERIALS.map(normalizeMat));
      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(normalizedInit));
      return [...normalizedInit];
    } catch {
      return applyStockInSync(INITIAL_MATERIALS.map(normalizeMat));
    }
  }

  // Save or Update Material
  static async saveMaterial(material: Material): Promise<void> {
    const materials = await this.getMaterials();
    const index = materials.findIndex(m => m.id === material.id);
    
    // Normalize deprecated categories
    let cat = (material.category || '').trim();
    if (cat === 'กระดาษและสิ่งพิมพ์' || cat === 'เครื่องเขียน' || cat === 'แฟ้มและอุปกรณ์จัดเก็บ') {
      cat = 'วัสดุสำนักงาน';
    } else if (cat === 'ผลิตภัณฑ์ทำความสะอาด') {
      cat = 'วัสดุงานบ้านและงานครัว';
    }
    material.category = cat;

    // Ensure refill status is accurate
    material.refillStatus = calculateRefillStatus(material.currentStock, material.minQty);
    material.lastUpdated = new Date().toISOString();
    material.imageUrl = material.imageUrl || '';

    // Sanitize recent purchases (3 latest purchase price memory)
    if (material.recentPurchases && Array.isArray(material.recentPurchases)) {
      material.recentPurchases = material.recentPurchases
        .filter(p => p && (Number(p.unitPrice) > 0 || (p.supplier && p.supplier.trim().length > 0)))
        .map(p => ({
          date: p.date || new Date().toISOString().split('T')[0],
          unitPrice: Number(p.unitPrice) || 0,
          supplier: (p.supplier || 'ไม่ระบุร้านค้า').trim(),
          docNo: (p.docNo || '').trim(),
          quantity: p.quantity ? Number(p.quantity) : 0
        }))
        .slice(0, 3);
    }

    // Keep openingStock in sync with currentStock, purchaseQty, and totalWithdrawn
    if (material.currentStock !== undefined) {
      material.openingStock = Math.max(0, (Number(material.currentStock) || 0) - (Number(material.purchaseQty) || 0) + (Number(material.totalWithdrawn) || 0));
    }

    if (index >= 0) {
      materials[index] = { ...materials[index], ...material };
    } else {
      const maxNo = materials.reduce((max, m) => Math.max(max, m.no || 0), 0);
      material.no = material.no || (maxNo + 1);
      materials.push(material);
    }

    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));

    if (db) {
      try {
        const cleanPayload: Record<string, any> = {};
        Object.entries(material).forEach(([k, v]) => {
          if (v !== undefined) {
            cleanPayload[k] = v;
          }
        });
        await setDoc(doc(db, 'materials', material.id), cleanPayload, { merge: true });
      } catch (e) {
        console.warn('Firestore write notice (saved locally):', e);
      }
    }
  }

  // Delete Material
  static async deleteMaterial(id: string): Promise<void> {
    const materials = (await this.getMaterials()).filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));

    if (db) {
      try {
        await deleteDoc(doc(db, 'materials', id));
      } catch (e) {
        console.warn('Firestore delete notice (deleted locally):', e);
      }
    }
  }

  // Update a single material's image (Fast update & Cloud backup)
  static async updateMaterialImage(id: string, imageUrl: string): Promise<boolean> {
    try {
      const materials = await this.getMaterials();
      const index = materials.findIndex(m => m.id === id);
      if (index >= 0) {
        materials[index] = {
          ...materials[index],
          imageUrl: imageUrl.trim() || undefined,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));

        // Save to Firestore material doc
        if (db) {
          try {
            await setDoc(doc(db, 'materials', id), {
              imageUrl: imageUrl.trim() || '',
              lastUpdated: new Date().toISOString()
            }, { merge: true });

            // Also keep dedicated backup copy in 'material_images' collection
            if (imageUrl.trim()) {
              await setDoc(doc(db, 'material_images', id), {
                materialId: id,
                name: materials[index].name,
                category: materials[index].category,
                imageUrl: imageUrl.trim(),
                updatedAt: new Date().toISOString()
              }, { merge: true });
            } else {
              try {
                await deleteDoc(doc(db, 'material_images', id));
              } catch {}
            }
          } catch (e) {
            console.warn('Firestore material image write notice:', e);
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating material image:', err);
      return false;
    }
  }

  // Batch update material images (e.g. from multi-file upload matching material ID)
  static async batchUpdateMaterialImages(updates: { id: string; imageUrl: string }[]): Promise<number> {
    if (!updates || updates.length === 0) return 0;
    try {
      const materials = await this.getMaterials();
      const updateMap = new Map(updates.map(u => [u.id.toLowerCase().trim(), u.imageUrl]));
      let count = 0;

      const updatedMaterials = materials.map(m => {
        const newImg = updateMap.get(m.id.toLowerCase().trim());
        if (newImg !== undefined) {
          count++;
          return {
            ...m,
            imageUrl: newImg.trim() || undefined,
            lastUpdated: new Date().toISOString()
          };
        }
        return m;
      });

      localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(updatedMaterials));

      // Batch update in Firestore
      if (db) {
        const batchSize = 30;
        for (let i = 0; i < updates.length; i += batchSize) {
          const chunk = updates.slice(i, i + batchSize);
          await Promise.allSettled(chunk.map(async item => {
            const mat = materials.find(m => m.id === item.id);
            const promises = [
              setDoc(doc(db!, 'materials', item.id), {
                imageUrl: item.imageUrl.trim() || '',
                lastUpdated: new Date().toISOString()
              }, { merge: true })
            ];
            if (item.imageUrl.trim()) {
              promises.push(
                setDoc(doc(db!, 'material_images', item.id), {
                  materialId: item.id,
                  name: mat?.name || item.id,
                  category: mat?.category || '',
                  imageUrl: item.imageUrl.trim(),
                  updatedAt: new Date().toISOString()
                }, { merge: true })
              );
            }
            return Promise.all(promises);
          }));
        }
      }

      return count;
    } catch (err) {
      console.error('Error batch updating material images:', err);
      return 0;
    }
  }

  // Generate Image Backup Package
  static async exportImageBackup(): Promise<{
    app: string;
    version: string;
    exportedAt: string;
    totalMaterials: number;
    materialsWithImages: number;
    images: {
      materialId: string;
      materialName: string;
      category?: string;
      imageUrl: string;
      updatedAt?: string;
    }[];
  }> {
    const materials = await this.getMaterials();
    const imagesWithData = materials
      .filter(m => m.imageUrl && m.imageUrl.trim().length > 0)
      .map(m => ({
        materialId: m.id,
        materialName: m.name,
        category: m.category,
        imageUrl: m.imageUrl!,
        updatedAt: m.lastUpdated || new Date().toISOString()
      }));

    return {
      app: 'COPAG MSU Material Inventory System',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      totalMaterials: materials.length,
      materialsWithImages: imagesWithData.length,
      images: imagesWithData
    };
  }

  // Restore Images from Backup
  static async restoreImageBackup(backupImages: { materialId: string; imageUrl: string }[]): Promise<number> {
    if (!backupImages || !Array.isArray(backupImages)) return 0;
    const cleanList = backupImages
      .filter(item => item && item.materialId && item.imageUrl)
      .map(item => ({ id: item.materialId, imageUrl: item.imageUrl }));
    return await this.batchUpdateMaterialImages(cleanList);
  }

  // Load Orders
  static async getOrders(): Promise<Order[]> {
    let localOrders: Order[] = [];
    const cached = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (cached) {
      try {
        const parsed: Order[] = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          localOrders = parsed.filter(o => o.docNo !== 'COPAG-REQ-2570/001');
        }
      } catch {}
    }

    try {
      if (db) {
        try {
          const snapshotPromise = getDocs(collection(db, 'orders'));
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 3500)
          );
          const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);

          if (snapshot && !snapshot.empty) {
            const list: Order[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as Order;
              if (data && data.id && data.docNo !== 'COPAG-REQ-2570/001') {
                list.push(data);
              }
            });

            // Merge with local orders that may not be synced yet
            const fsIds = new Set(list.map(o => o.id));
            const unsyncedLocals = localOrders.filter(o => !fsIds.has(o.id));
            const merged = [...list, ...unsyncedLocals];

            merged.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(merged));
            return merged;
          } else if (localOrders.length > 0) {
            // Firestore returned empty, preserve local orders and upload to Firestore
            if (db) {
              Promise.allSettled(localOrders.map(o => setDoc(doc(db, 'orders', o.id), o))).catch(() => {});
            }
            return localOrders;
          }
        } catch (e) {
          console.warn('Firestore orders notice, using local cache:', e);
        }
      }

      if (localOrders.length > 0) {
        return localOrders;
      }

      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    } catch {
      return localOrders.length > 0 ? localOrders : INITIAL_ORDERS;
    }
  }

  // Save New Order
  static async createOrder(order: Order): Promise<void> {
    const orders = await this.getOrders();
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    if (db) {
      try {
        await setDoc(doc(db, 'orders', order.id), order);
      } catch (e) {
        console.warn('Firestore order save notice (saved locally):', e);
      }
    }
  }

  // Update Order Status (e.g. Approve, Disburse, Cancel)
  static async updateOrderStatus(
    orderId: string, 
    status: OrderStatus, 
    officerInfo?: { approverName?: string; approverPosition?: string; disburserName?: string }
  ): Promise<{ success: boolean; error?: string }> {
    const orders = await this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return { success: false, error: 'ไม่พบรายการคำขอนี้' };

    const targetOrder = orders[orderIndex];

    // If disbursing (เบิกจ่ายแล้ว), deduct inventory and add stock out entries
    if (status === 'เบิกจ่ายแล้ว' && targetOrder.status !== 'เบิกจ่ายแล้ว') {
      const materials = await this.getMaterials();
      
      // First check if sufficient stock exists
      for (const item of targetOrder.items) {
        const mat = materials.find(m => m.id === item.materialId);
        if (!mat) {
          return { success: false, error: `ไม่พบรหัสวัสดุ ${item.materialId} ในคลัง` };
        }
        if (mat.currentStock < item.quantity) {
          return { 
            success: false, 
            error: `วัสดุ "${mat.name}" คงเหลือ ${mat.currentStock} ${mat.unit} ไม่เพียงพอสำหรับการเบิกจ่าย (${item.quantity} ${mat.unit})` 
          };
        }
      }

      // Deduct stock and log stock out
      const today = new Date().toISOString().split('T')[0];
      for (const item of targetOrder.items) {
        const mat = materials.find(m => m.id === item.materialId)!;
        mat.currentStock -= item.quantity;
        mat.totalWithdrawn = (mat.totalWithdrawn || 0) + item.quantity;
        mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
        await this.saveMaterial(mat);

        // Record stock out log
        const stockOutEntry: StockOut = {
          id: `OUT-${Date.now()}-${item.materialId}`,
          date: today,
          requisitionDocNo: targetOrder.docNo,
          materialId: item.materialId,
          materialName: item.materialName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          requesterName: targetOrder.requesterName,
          department: targetOrder.department,
          disburserName: officerInfo?.disburserName || 'เจ้าหน้าที่พัสดุ วก.มมส.',
          note: `เบิกตามคำขอเลขที่ ${targetOrder.docNo}`
        };
        await this.addStockOut(stockOutEntry);
      }

      targetOrder.disbursedDate = today;
      targetOrder.disburserName = officerInfo?.disburserName || 'เจ้าหน้าที่พัสดุ วก.มมส.';
    }

    // If targetOrder was disbursed, but the new status is NOT disbursed (e.g. ยกเลิก, รออนุมัติ, อนุมัติแล้ว), RESTORE stock back to inventory and remove stock out logs
    if (targetOrder.status === 'เบิกจ่ายแล้ว' && status !== 'เบิกจ่ายแล้ว') {
      const materials = await this.getMaterials();
      for (const item of targetOrder.items) {
        const mat = materials.find(m => m.id === item.materialId);
        if (mat) {
          mat.currentStock += item.quantity;
          mat.totalWithdrawn = Math.max(0, (mat.totalWithdrawn || 0) - item.quantity);
          mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
          await this.saveMaterial(mat);
        }
      }

      // Remove the stock out logs for this order so stock card balances match reality
      const stockOuts = await this.getStockOutLogs();
      const removedStockOuts = stockOuts.filter(s => s.requisitionDocNo === targetOrder.docNo);
      const updatedStockOuts = stockOuts.filter(s => s.requisitionDocNo !== targetOrder.docNo);
      localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(updatedStockOuts));

      if (db) {
        for (const rem of removedStockOuts) {
          try {
            await deleteDoc(doc(db, 'stockOut', rem.id));
          } catch (e) {
            console.warn('Firestore stockOut delete notice:', e);
          }
        }
      }

      targetOrder.disbursedDate = undefined;
      targetOrder.disburserName = undefined;
    }

    if (status === 'อนุมัติแล้ว') {
      targetOrder.approverName = officerInfo?.approverName || 'คณบดีวิทยาลัยการเมืองการปกครอง';
      targetOrder.approverPosition = officerInfo?.approverPosition || 'คณบดีวิทยาลัยการเมืองการปกครอง';
    }

    targetOrder.status = status;
    orders[orderIndex] = targetOrder;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    if (db) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: targetOrder.status,
          approverName: targetOrder.approverName || null,
          approverPosition: targetOrder.approverPosition || null,
          disbursedDate: targetOrder.disbursedDate || null,
          disburserName: targetOrder.disburserName || null
        });
      } catch (e) {
        console.warn('Firestore update order notice (updated locally):', e);
      }
    }

    return { success: true };
  }

  // Edit Order Details & Quantities (ปรับยอดและแก้ไขคำขอเบิก)
  static async editOrder(
    orderId: string,
    payload: {
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
    }
  ): Promise<{ success: boolean; error?: string }> {
    const orders = await this.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return { success: false, error: 'ไม่พบรายการคำขอนี้' };

    const oldOrder = orders[orderIndex];
    const materials = await this.getMaterials();

    const wasDisbursed = oldOrder.status === 'เบิกจ่ายแล้ว';
    const willBeDisbursed = payload.status === 'เบิกจ่ายแล้ว';

    // Validate that there is at least 1 item
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'ต้องมีรายการพัสดุอย่างน้อย 1 รายการ' };
    }

    // 1. If it was disbursed, first temporarily restore previous items to material stock
    if (wasDisbursed) {
      for (const item of oldOrder.items) {
        const mat = materials.find(m => m.id === item.materialId);
        if (mat) {
          mat.currentStock += item.quantity;
          mat.totalWithdrawn = Math.max(0, (mat.totalWithdrawn || 0) - item.quantity);
        }
      }
    }

    // 2. If it will be disbursed, check if sufficient stock is available for the new items
    if (willBeDisbursed) {
      for (const item of payload.items) {
        const mat = materials.find(m => m.id === item.materialId);
        if (!mat) {
          // If failure, restore old state if needed
          if (wasDisbursed) {
            for (const oldItem of oldOrder.items) {
              const m = materials.find(x => x.id === oldItem.materialId);
              if (m) {
                m.currentStock -= oldItem.quantity;
                m.totalWithdrawn = (m.totalWithdrawn || 0) + oldItem.quantity;
              }
            }
          }
          return { success: false, error: `ไม่พบรหัสวัสดุ ${item.materialId} ในคลัง` };
        }

        if (mat.currentStock < item.quantity) {
          // Insufficient stock! Revert temporary restoration
          if (wasDisbursed) {
            for (const oldItem of oldOrder.items) {
              const m = materials.find(x => x.id === oldItem.materialId);
              if (m) {
                m.currentStock -= oldItem.quantity;
                m.totalWithdrawn = (m.totalWithdrawn || 0) + oldItem.quantity;
              }
            }
          }
          return {
            success: false,
            error: `วัสดุ "${mat.name}" มียอดคงเหลือ ${mat.currentStock} ${mat.unit} ไม่เพียงพอกับยอดที่ปรับใหม่ (${item.quantity} ${mat.unit})`
          };
        }
      }

      // Sufficient stock available! Deduct new items and save
      for (const item of payload.items) {
        const mat = materials.find(m => m.id === item.materialId)!;
        mat.currentStock -= item.quantity;
        mat.totalWithdrawn = (mat.totalWithdrawn || 0) + item.quantity;
        mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
        await this.saveMaterial(mat);
      }

      // Update Stock Out logs: remove old logs for oldOrder.docNo, insert new logs for payload.docNo
      const today = new Date().toISOString().split('T')[0];
      const stockOuts = await this.getStockOutLogs();
      const filteredStockOuts = stockOuts.filter(s => s.requisitionDocNo !== oldOrder.docNo);

      const newLogs: StockOut[] = payload.items.map(item => ({
        id: `OUT-${Date.now()}-${item.materialId}-${Math.random().toString(36).substring(2, 6)}`,
        date: oldOrder.disbursedDate || today,
        requisitionDocNo: payload.docNo,
        materialId: item.materialId,
        materialName: item.materialName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        requesterName: payload.requesterName,
        department: payload.department,
        disburserName: payload.disburserName || oldOrder.disburserName || 'เจ้าหน้าที่พัสดุ วก.มมส.',
        note: `เบิกตามคำขอเลขที่ ${payload.docNo}`
      }));

      const mergedStockOuts = [...newLogs, ...filteredStockOuts];
      localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(mergedStockOuts));

    } else if (wasDisbursed && !willBeDisbursed) {
      // Order was disbursed, but now status is changed to non-disbursed (e.g. ยกเลิก, รออนุมัติ, อนุมัติแล้ว)
      // Save the restored materials!
      for (const item of oldOrder.items) {
        const mat = materials.find(m => m.id === item.materialId);
        if (mat) {
          mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
          await this.saveMaterial(mat);
        }
      }

      // Remove stock out logs
      const stockOuts = await this.getStockOutLogs();
      const filteredStockOuts = stockOuts.filter(s => s.requisitionDocNo !== oldOrder.docNo);
      localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(filteredStockOuts));
    }

    // Recalculate totals
    const totalItems = payload.items.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = payload.items.reduce((s, i) => s + i.totalPrice, 0);

    const updatedOrder: Order = {
      ...oldOrder,
      docNo: payload.docNo,
      date: payload.date,
      requesterName: payload.requesterName,
      requesterEmail: payload.requesterEmail || oldOrder.requesterEmail,
      requesterPosition: payload.requesterPosition || oldOrder.requesterPosition,
      department: payload.department,
      purpose: payload.purpose,
      status: payload.status,
      items: payload.items,
      totalItems,
      totalAmount,
      approverName: payload.status === 'อนุมัติแล้ว' || payload.status === 'เบิกจ่ายแล้ว' 
        ? (payload.approverName || oldOrder.approverName || 'คณบดีวิทยาลัยการเมืองการปกครอง') 
        : oldOrder.approverName,
      approverPosition: payload.status === 'อนุมัติแล้ว' || payload.status === 'เบิกจ่ายแล้ว' 
        ? (payload.approverPosition || oldOrder.approverPosition || 'คณบดีวิทยาลัยการเมืองการปกครอง') 
        : oldOrder.approverPosition,
      disbursedDate: willBeDisbursed ? (oldOrder.disbursedDate || new Date().toISOString().split('T')[0]) : undefined,
      disburserName: willBeDisbursed ? (payload.disburserName || oldOrder.disburserName || 'เจ้าหน้าที่พัสดุ วก.มมส.') : undefined
    };

    orders[orderIndex] = updatedOrder;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    if (db) {
      try {
        await setDoc(doc(db, 'orders', orderId), updatedOrder);
      } catch (e) {
        console.warn('Firestore edit order notice (saved locally):', e);
      }
    }

    return { success: true };
  }

  // Delete Order (ลบใบเบิกถาวร)
  static async deleteOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, error: 'ไม่พบรายการคำขอ' };

    // If it was disbursed, restore stock
    if (order.status === 'เบิกจ่ายแล้ว') {
      const materials = await this.getMaterials();
      for (const item of order.items) {
        const mat = materials.find(m => m.id === item.materialId);
        if (mat) {
          mat.currentStock += item.quantity;
          mat.totalWithdrawn = Math.max(0, (mat.totalWithdrawn || 0) - item.quantity);
          mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
          await this.saveMaterial(mat);
        }
      }

      const stockOuts = await this.getStockOutLogs();
      const filtered = stockOuts.filter(s => s.requisitionDocNo !== order.docNo);
      localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(filtered));
    }

    const updatedOrders = orders.filter(o => o.id !== orderId);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    if (db) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
      } catch (e) {
        console.warn('Firestore delete order notice:', e);
      }
    }

    return { success: true };
  }

  // Stock In Input History Presets (จดจำประวัติการพิมพ์บันทึกข้อมูลใบสั่งซื้อก่อนหน้า)
  static getStockInPresets(): Array<{
    docNo: string;
    obligationNo?: string;
    budgetType: string;
    supplier: string;
    receiverName: string;
    note: string;
    date: string;
    timestamp: number;
  }> {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_IN_PRESETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  static saveStockInPreset(preset: {
    docNo: string;
    obligationNo?: string;
    budgetType?: string;
    supplier?: string;
    receiverName?: string;
    note?: string;
    date?: string;
  }): void {
    try {
      const cleanDocNo = (preset.docNo || '').trim();
      const cleanObligation = (preset.obligationNo || '').trim();
      if (!cleanDocNo && !cleanObligation) return;

      const presets = this.getStockInPresets();
      const newEntry = {
        docNo: cleanDocNo,
        obligationNo: cleanObligation,
        budgetType: preset.budgetType || 'เงินราย',
        supplier: (preset.supplier || '').trim(),
        receiverName: (preset.receiverName || '').trim(),
        note: (preset.note || '').trim(),
        date: preset.date || new Date().toISOString().split('T')[0],
        timestamp: Date.now()
      };

      // Filter duplicate docNo / obligationNo combinations
      const filtered = presets.filter(
        p => !(
          p.docNo.toLowerCase() === newEntry.docNo.toLowerCase() &&
          (p.obligationNo || '').toLowerCase() === newEntry.obligationNo.toLowerCase()
        )
      );

      filtered.unshift(newEntry);
      // Keep up to 30 recent presets
      const limited = filtered.slice(0, 30);
      localStorage.setItem(STORAGE_KEYS.STOCK_IN_PRESETS, JSON.stringify(limited));
    } catch (e) {
      console.warn('Error saving stock in preset history:', e);
    }
  }

  static clearStockInPresets(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.STOCK_IN_PRESETS);
    } catch {}
  }

  // Batch Stock In (รับเข้าได้หลายรายการในครั้งเดียว)
  static async addBatchStockIn(
    docNo: string,
    date: string,
    supplier: string,
    receiverName: string,
    note: string,
    items: BatchStockInItem[],
    obligationNo?: string,
    budgetType?: 'เงินราย' | 'เงินแผ่นดิน' | string
  ): Promise<void> {
    const materials = await this.getMaterials();
    const currentStockInLogs = await this.getStockInLogs();
    const newStockInEntries: StockIn[] = [];

    const normalizedBudgetType = budgetType || 'เงินราย';
    const normalizedObligation = obligationNo?.trim() || '';

    // Remember in input history
    this.saveStockInPreset({
      docNo,
      obligationNo: normalizedObligation,
      budgetType: normalizedBudgetType,
      supplier,
      receiverName,
      note,
      date
    });

    const updatedMaterials = [...materials];
    const touchedMaterials: Material[] = [];

    for (const item of items) {
      if (item.quantity <= 0) continue;
      const entry: StockIn = {
        id: `IN-${Date.now()}-${item.materialId}-${Math.random().toString(36).substring(2, 6)}`,
        date,
        docNo,
        obligationNo: normalizedObligation || undefined,
        budgetType: normalizedBudgetType,
        materialId: item.materialId,
        materialName: item.materialName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        supplier,
        receiverName,
        note: item.note || note,
        createdAt: new Date().toISOString()
      };

      newStockInEntries.unshift(entry);

      // Update material stock in local list
      const matIndex = updatedMaterials.findIndex(m => m.id === item.materialId);
      if (matIndex >= 0) {
        const mat = { ...updatedMaterials[matIndex] };
        mat.currentStock += item.quantity;
        mat.purchaseQty = (mat.purchaseQty || 0) + item.quantity;
        mat.totalPurchaseCost = (mat.totalPurchaseCost || 0) + item.totalPrice;
        mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
        if (item.unitPrice > 0) {
          mat.unitPrice = item.unitPrice; // อิงตามราคารับเข้าพัสดุล่าสุด
          const existingPurchases = mat.recentPurchases || [];
          mat.recentPurchases = [
            {
              date,
              unitPrice: item.unitPrice,
              supplier: supplier || 'ไม่ระบุร้านค้า',
              docNo,
              quantity: item.quantity
            },
            ...existingPurchases.filter(p => p.docNo !== docNo || p.date !== date)
          ].slice(0, 3);
        }
        mat.lastUpdated = new Date().toISOString();
        updatedMaterials[matIndex] = mat;
        touchedMaterials.push(mat);
      }
    }

    // IMMEDIATELY SAVE TO LOCAL STORAGE FIRST SO DATA IS NEVER LOST OR DISCONNECTED
    const mergedLogs = [...newStockInEntries, ...currentStockInLogs];
    localStorage.setItem(STORAGE_KEYS.STOCK_IN, JSON.stringify(mergedLogs));
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(updatedMaterials));

    // ASYNC CLOUD SYNC: persist new entries and modified materials to Firestore
    if (db) {
      try {
        const syncPromises: Promise<any>[] = [];
        for (const entry of newStockInEntries) {
          syncPromises.push(setDoc(doc(db, 'stockIn', entry.id), entry));
        }
        for (const mat of touchedMaterials) {
          syncPromises.push(setDoc(doc(db, 'materials', mat.id), mat));
        }
        await Promise.allSettled(syncPromises);
      } catch (e) {
        console.warn('Firestore batch stock in cloud sync notice:', e);
      }
    }
  }

  // Stock In Logs
  static async getStockInLogs(): Promise<StockIn[]> {
    let localLogs: StockIn[] = [];
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.STOCK_IN);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) localLogs = parsed;
      }
    } catch {}

    try {
      if (db) {
        try {
          const snapshotPromise = getDocs(collection(db, 'stockIn'));
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 3500)
          );
          const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);

          if (snapshot && !snapshot.empty) {
            const list: StockIn[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as StockIn;
              if (data && data.id) {
                list.push(data);
              }
            });

            // Merge with local logs that may not have reached Firestore yet
            const fsIds = new Set(list.map(l => l.id));
            const unsyncedLocals = localLogs.filter(l => !fsIds.has(l.id));
            const merged = [...list, ...unsyncedLocals];

            merged.sort((a, b) => new Date(b.date || b.createdAt || '').getTime() - new Date(a.date || a.createdAt || '').getTime());
            localStorage.setItem(STORAGE_KEYS.STOCK_IN, JSON.stringify(merged));
            return merged;
          } else if (localLogs.length > 0) {
            // Firestore returned empty, preserve local logs and upload to Firestore
            if (db) {
              Promise.allSettled(localLogs.map(l => setDoc(doc(db, 'stockIn', l.id), l))).catch(() => {});
            }
            return localLogs;
          }
        } catch (e) {
          console.warn('Firestore stockIn notice, using local cache:', e);
        }
      }

      if (localLogs.length > 0) return localLogs;

      localStorage.setItem(STORAGE_KEYS.STOCK_IN, JSON.stringify(INITIAL_STOCK_IN));
      return INITIAL_STOCK_IN;
    } catch {
      return localLogs.length > 0 ? localLogs : INITIAL_STOCK_IN;
    }
  }

  static async addStockIn(entry: StockIn, updateInventory = true): Promise<void> {
    const logs = await this.getStockInLogs();
    logs.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.STOCK_IN, JSON.stringify(logs));

    if (updateInventory) {
      const materials = await this.getMaterials();
      const mat = materials.find(m => m.id === entry.materialId);
      if (mat) {
        mat.currentStock += entry.quantity;
        mat.purchaseQty = (mat.purchaseQty || 0) + entry.quantity;
        mat.totalPurchaseCost = (mat.totalPurchaseCost || 0) + entry.totalPrice;
        if (entry.unitPrice > 0) {
          mat.unitPrice = entry.unitPrice; // อิงตามราคารับเข้าล่าสุด
          const existingPurchases = mat.recentPurchases || [];
          mat.recentPurchases = [
            {
              date: entry.date,
              unitPrice: entry.unitPrice,
              supplier: entry.supplier || 'ไม่ระบุร้านค้า',
              docNo: entry.docNo,
              quantity: entry.quantity
            },
            ...existingPurchases.filter(p => p.docNo !== entry.docNo || p.date !== entry.date)
          ].slice(0, 3);
        }
        mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
        await this.saveMaterial(mat);
      }
    }

    if (db) {
      try {
        await setDoc(doc(db, 'stockIn', entry.id), entry);
      } catch (e) {
        console.warn('Firestore stock in save notice:', e);
      }
    }
  }

  // Update Stock In Entry (แก้ไขรายการรับเข้าพัสดุ พร้อมปรับปรุงสต็อกและสมุดคุมสัมพันธ์กัน)
  static async updateStockIn(
    id: string,
    payload: {
      date: string;
      docNo: string;
      quantity: number;
      unitPrice: number;
      supplier: string;
      receiverName: string;
      note?: string;
      obligationNo?: string;
      budgetType?: 'เงินราย' | 'เงินแผ่นดิน' | string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const logs = await this.getStockInLogs();
    const index = logs.findIndex(l => l.id === id);
    if (index === -1) return { success: false, error: 'ไม่พบรายการรับเข้านี้ในระบบ' };

    const oldEntry = logs[index];
    const qtyDiff = payload.quantity - oldEntry.quantity;
    const oldTotalPrice = oldEntry.totalPrice || (oldEntry.quantity * oldEntry.unitPrice);
    const newTotalPrice = payload.quantity * payload.unitPrice;
    const costDiff = newTotalPrice - oldTotalPrice;

    // Reconcile material inventory
    const materials = await this.getMaterials();
    const matIndex = materials.findIndex(m => m.id === oldEntry.materialId);
    if (matIndex !== -1) {
      const mat = materials[matIndex];
      // If reducing received quantity, check if available stock is sufficient
      if (qtyDiff < 0 && mat.currentStock + qtyDiff < 0) {
        return {
          success: false,
          error: `ไม่สามารถลดยอดรับเข้าลง ${Math.abs(qtyDiff)} ${oldEntry.unit} ได้ เนื่องจากพัสดุคงเหลือในคลังมีเพียง ${mat.currentStock} ${oldEntry.unit} (มีการเบิกจ่ายไปแล้ว)`
        };
      }

      mat.currentStock += qtyDiff;
      mat.purchaseQty = Math.max(0, (mat.purchaseQty || 0) + qtyDiff);
      mat.totalPurchaseCost = Math.max(0, (mat.totalPurchaseCost || 0) + costDiff);
      if (payload.unitPrice > 0) {
        mat.unitPrice = payload.unitPrice; // อิงตามราคารับเข้าล่าสุด
        const existingPurchases = mat.recentPurchases || [];
        mat.recentPurchases = [
          {
            date: payload.date,
            unitPrice: payload.unitPrice,
            supplier: payload.supplier || 'ไม่ระบุร้านค้า',
            docNo: payload.docNo,
            quantity: payload.quantity
          },
          ...existingPurchases.filter(p => p.docNo !== payload.docNo)
        ].slice(0, 3);
      }
      mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
      await this.saveMaterial(mat);
    }

    const updatedEntry: StockIn = {
      ...oldEntry,
      date: payload.date,
      docNo: payload.docNo,
      obligationNo: payload.obligationNo !== undefined ? (payload.obligationNo.trim() || undefined) : oldEntry.obligationNo,
      budgetType: payload.budgetType || oldEntry.budgetType || 'เงินราย',
      quantity: payload.quantity,
      unitPrice: payload.unitPrice,
      totalPrice: newTotalPrice,
      supplier: payload.supplier,
      receiverName: payload.receiverName,
      note: payload.note || ''
    };

    // Also update history preset
    this.saveStockInPreset({
      docNo: payload.docNo,
      obligationNo: payload.obligationNo !== undefined ? payload.obligationNo : oldEntry.obligationNo,
      budgetType: payload.budgetType || oldEntry.budgetType || 'เงินราย',
      supplier: payload.supplier,
      receiverName: payload.receiverName,
      note: payload.note,
      date: payload.date
    });

    logs[index] = updatedEntry;
    localStorage.setItem(STORAGE_KEYS.STOCK_IN, JSON.stringify(logs));

    if (db) {
      try {
        await setDoc(doc(db, 'stockIn', id), updatedEntry);
      } catch (e) {
        console.warn('Firestore update stockIn notice:', e);
      }
    }

    return { success: true };
  }

  // Delete Stock In Entry (ลบรายการรับเข้าพัสดุ พร้อมคืนสต็อกและอัปเดตสมุดคุม)
  static async deleteStockIn(id: string): Promise<{ success: boolean; error?: string }> {
    const logs = await this.getStockInLogs();
    const entry = logs.find(l => l.id === id);
    if (!entry) return { success: false, error: 'ไม่พบรายการรับเข้านี้ในระบบ' };

    const materials = await this.getMaterials();
    const mat = materials.find(m => m.id === entry.materialId);
    if (mat) {
      if (mat.currentStock - entry.quantity < 0) {
        return {
          success: false,
          error: `ไม่สามารถลบรายการรับเข้านี้ได้ เนื่องจากพัสดุถูกตัดจ่ายไปแล้ว (คงเหลือในคลัง ${mat.currentStock} ${entry.unit} แต่รายการที่ต้องการลบมีจำนวน ${entry.quantity} ${entry.unit})`
        };
      }

      mat.currentStock -= entry.quantity;
      mat.purchaseQty = Math.max(0, (mat.purchaseQty || 0) - entry.quantity);
      const entryTotal = entry.totalPrice || (entry.quantity * entry.unitPrice);
      mat.totalPurchaseCost = Math.max(0, (mat.totalPurchaseCost || 0) - entryTotal);
      mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);

      // Re-evaluate latest stock-in unit price and recent purchases from remaining logs
      const remainingForMat = logs.filter(l => l.id !== id && l.materialId === entry.materialId);
      if (remainingForMat.length > 0) {
        remainingForMat.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        mat.unitPrice = remainingForMat[0].unitPrice;
        mat.recentPurchases = remainingForMat.slice(0, 3).map(l => ({
          date: l.date,
          unitPrice: l.unitPrice,
          supplier: l.supplier || 'ไม่ระบุร้านค้า',
          docNo: l.docNo,
          quantity: l.quantity
        }));
      }
      await this.saveMaterial(mat);
    }

    const updatedLogs = logs.filter(l => l.id !== id);
    localStorage.setItem(STORAGE_KEYS.STOCK_IN, JSON.stringify(updatedLogs));

    if (db) {
      try {
        await deleteDoc(doc(db, 'stockIn', id));
      } catch (e) {
        console.warn('Firestore delete stockIn notice:', e);
      }
    }

    return { success: true };
  }

  // Stock Out Logs
  static async getStockOutLogs(): Promise<StockOut[]> {
    let localLogs: StockOut[] = [];
    const cached = localStorage.getItem(STORAGE_KEYS.STOCK_OUT);
    if (cached) {
      try {
        const parsed: StockOut[] = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          localLogs = parsed.filter(s => s.id !== 'OUT-1789543996940-1' && s.requisitionDocNo !== 'COPAG-REQ-2570/001');
        }
      } catch {}
    }

    try {
      if (db) {
        try {
          const snapshotPromise = getDocs(collection(db, 'stockOut'));
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 3500)
          );
          const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);

          if (snapshot && !snapshot.empty) {
            const list: StockOut[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as StockOut;
              if (data && data.id && data.id !== 'OUT-1789543996940-1' && data.requisitionDocNo !== 'COPAG-REQ-2570/001') {
                list.push(data);
              }
            });

            // Merge with local logs that may not have synced to Firestore yet
            const fsIds = new Set(list.map(s => s.id));
            const unsyncedLocals = localLogs.filter(s => !fsIds.has(s.id));
            const merged = [...list, ...unsyncedLocals];

            merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(merged));
            return merged;
          } else if (localLogs.length > 0) {
            if (db) {
              Promise.allSettled(localLogs.map(s => setDoc(doc(db, 'stockOut', s.id), s))).catch(() => {});
            }
            return localLogs;
          }
        } catch (e) {
          console.warn('Firestore stockOut notice, using local cache:', e);
        }
      }

      if (localLogs.length > 0) return localLogs;

      localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(INITIAL_STOCK_OUT));
      return INITIAL_STOCK_OUT;
    } catch {
      return localLogs.length > 0 ? localLogs : INITIAL_STOCK_OUT;
    }
  }

  static async addStockOut(entry: StockOut): Promise<void> {
    const logs = await this.getStockOutLogs();
    logs.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(logs));

    if (db) {
      try {
        await setDoc(doc(db, 'stockOut', entry.id), entry);
      } catch (e) {
        console.warn('Firestore stock out save notice:', e);
      }
    }
  }

  // Delete Stock Out Entry (ลบรายการจ่ายออกพัสดุ พร้อมคืนสต็อกและอัปเดตสมุดคุม)
  static async deleteStockOut(id: string, restoreStock = true): Promise<{ success: boolean; error?: string }> {
    const logs = await this.getStockOutLogs();
    const entry = logs.find(l => l.id === id);
    if (!entry) return { success: false, error: 'ไม่พบรายการจ่ายออกนี้ในระบบ' };

    if (restoreStock) {
      const materials = await this.getMaterials();
      const mat = materials.find(m => m.id === entry.materialId);
      if (mat) {
        mat.currentStock += entry.quantity;
        mat.totalWithdrawn = Math.max(0, (mat.totalWithdrawn || 0) - entry.quantity);
        mat.refillStatus = calculateRefillStatus(mat.currentStock, mat.minQty);
        await this.saveMaterial(mat);
      }
    }

    const updatedLogs = logs.filter(l => l.id !== id);
    localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify(updatedLogs));

    if (db) {
      try {
        await deleteDoc(doc(db, 'stockOut', id));
      } catch (e) {
        console.warn('Firestore delete stockOut notice:', e);
      }
    }

    return { success: true };
  }

  // Reset all inventory to 0, clear requisitions and stock logs, sync with Firestore
  static async resetAllData(): Promise<void> {
    const existing = this.getCachedMaterials();
    const existingImageMap = new Map(existing.filter(m => m.imageUrl && m.imageUrl.trim()).map(m => [m.id, m.imageUrl!]));

    const zeroStockMaterials = INITIAL_MATERIALS.map(m => ({
      ...m,
      currentStock: 0,
      openingStock: 0,
      refillStatus: 'วัสดุหมด' as RefillStatus,
      purchaseQty: 0,
      totalPurchaseCost: 0,
      totalWithdrawn: 0,
      monthlyAverage: 0,
      imageUrl: existingImageMap.get(m.id) || m.imageUrl || '',
      lastUpdated: new Date().toISOString()
    }));

    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(zeroStockMaterials));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.STOCK_IN, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.STOCK_OUT, JSON.stringify([]));

    if (db) {
      try {
        const [ordersSnap, stockInSnap, stockOutSnap] = await Promise.all([
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'stockIn')),
          getDocs(collection(db, 'stockOut'))
        ]);

        const delPromises = [
          ...ordersSnap.docs.map(d => deleteDoc(d.ref)),
          ...stockInSnap.docs.map(d => deleteDoc(d.ref)),
          ...stockOutSnap.docs.map(d => deleteDoc(d.ref))
        ];
        await Promise.allSettled(delPromises);

        const batchSize = 40;
        for (let i = 0; i < zeroStockMaterials.length; i += batchSize) {
          const chunk = zeroStockMaterials.slice(i, i + batchSize);
          await Promise.allSettled(chunk.map(m => setDoc(doc(db, 'materials', m.id), m)));
        }
      } catch (e) {
        console.warn('Firestore reset notice:', e);
      }
    }
  }

  // Backup & sync all system data to Firebase Firestore (project copag)
  static async backupAllDataToFirebase(): Promise<{
    success: boolean;
    materialsCount: number;
    ordersCount: number;
    stockInCount: number;
    stockOutCount: number;
    error?: string;
  }> {
    if (!db) {
      return { 
        success: false, 
        materialsCount: 0, 
        ordersCount: 0, 
        stockInCount: 0, 
        stockOutCount: 0, 
        error: 'ยังไม่ได้เชื่อมต่อฐานข้อมูล Firebase กรุณาตรวจสอบการตั้งค่า' 
      };
    }

    try {
      const materials = this.getCachedMaterials();
      const orders = await this.getOrders();
      const stockIn = await this.getStockInLogs();
      const stockOut = await this.getStockOutLogs();
      const users = await this.getUsers();

      // 1. Upload materials in chunks
      const batchSize = 35;
      for (let i = 0; i < materials.length; i += batchSize) {
        const chunk = materials.slice(i, i + batchSize);
        await Promise.allSettled(chunk.map(m => setDoc(doc(db, 'materials', m.id), {
          ...m,
          refillStatus: calculateRefillStatus(m.currentStock, m.minQty),
          lastUpdated: m.lastUpdated || new Date().toISOString()
        })));
      }

      // 2. Upload orders
      if (orders.length > 0) {
        await Promise.allSettled(orders.map(o => setDoc(doc(db, 'orders', o.id), o)));
      }

      // 3. Upload stock in logs
      if (stockIn.length > 0) {
        await Promise.allSettled(stockIn.map(si => setDoc(doc(db, 'stockIn', si.id), si)));
      }

      // 4. Upload stock out logs
      if (stockOut.length > 0) {
        await Promise.allSettled(stockOut.map(so => setDoc(doc(db, 'stockOut', so.id), so)));
      }

      // 5. Upload users
      if (users.length > 0) {
        await Promise.allSettled(users.map(u => {
          const safeDocId = (u.email || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
          return setDoc(doc(db, 'users', safeDocId), u);
        }));
      }

      // 6. Record metadata in system_backup/copag
      const backupMeta = {
        projectId: 'copag',
        backedUpAt: new Date().toISOString(),
        totalMaterials: materials.length,
        totalOrders: orders.length,
        totalStockIn: stockIn.length,
        totalStockOut: stockOut.length,
        totalUsers: users.length,
        status: 'ACTIVE_AND_SYNCHRONIZED',
        targetFaculty: 'วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม (COPAG MSU)'
      };

      await Promise.allSettled([
        setDoc(doc(db, 'system_backup', 'copag'), backupMeta),
        setDoc(doc(db, 'system_backup', 'latest'), backupMeta)
      ]);

      return {
        success: true,
        materialsCount: materials.length,
        ordersCount: orders.length,
        stockInCount: stockIn.length,
        stockOutCount: stockOut.length
      };
    } catch (err: any) {
      console.error('Backup to Firebase error:', err);
      return {
        success: false,
        materialsCount: 0,
        ordersCount: 0,
        stockInCount: 0,
        stockOutCount: 0,
        error: err?.message || 'เกิดข้อผิดพลาดในการสำรองข้อมูลขึ้น Firebase'
      };
    }
  }
}
