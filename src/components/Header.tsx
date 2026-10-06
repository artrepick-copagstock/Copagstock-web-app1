import { FC } from 'react';
import { ActiveTab, AppUser } from '../types';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Boxes, 
  BookOpenText, 
  ClipboardList, 
  Database,
  Building2,
  CheckCircle2,
  RefreshCw,
  PackagePlus,
  User,
  ShieldCheck,
  Users,
  LogOut
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  cartCount: number;
  pendingOrdersCount: number;
  onOpenDataModal: () => void;
  onRefreshData: () => void;
  isRefreshing?: boolean;
  currentUser: AppUser | null;
  onLogout?: () => void;
  onToggleRole?: () => void;
}

export const Header: FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  pendingOrdersCount,
  onOpenDataModal,
  onRefreshData,
  isRefreshing = false,
  currentUser,
  onLogout,
  onToggleRole
}) => {
  const isAdmin = currentUser?.role === 'admin';

  // All 7 Core System Navigation Tabs - fully clickable and functional
  const navItems: { id: ActiveTab; label: string; icon: typeof LayoutDashboard; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'ภาพรวมคลัง', icon: LayoutDashboard },
    { id: 'orders', label: 'ใบเบิกจ่ายพัสดุ', icon: ClipboardList, badge: pendingOrdersCount, badgeColor: 'bg-rose-500' },
    { id: 'inventory', label: 'ทะเบียนพัสดุ (เพิ่ม/ลบ)', icon: Boxes },
    { id: 'batch_stockin', label: 'รับพัสดุเข้าคลัง (ชุด)', icon: PackagePlus },
    { id: 'ledger', label: 'สมุดคุมบัญชีพัสดุ', icon: BookOpenText },
    { id: 'requisition', label: 'คีย์ใบเบิก', icon: ShoppingCart, badge: cartCount, badgeColor: 'bg-amber-500' },
    { id: 'users', label: 'จัดการผู้ใช้งาน', icon: Users }
  ];

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40 border-b border-slate-800">
      {/* Top institution bar */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 py-1 px-4 text-xs font-medium text-amber-50 flex items-center justify-between">
        <div className="flex items-center gap-2 w-full max-w-full mx-auto" style={{ width: '100%', maxWidth: '100%' }}>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>ระบบสารสนเทศงานพัสดุและคลังวัสดุภายใน — วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม (COPAG MSU)</span>
          <span className="hidden sm:inline-block ml-auto text-amber-200">ปีงบประมาณ 2568</span>
        </div>
      </div>

      <div className="w-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Institution title & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-md ring-2 ring-amber-400/40 shrink-0 overflow-hidden">
              <img
                src="/msu-logo.png"
                alt="ตรามหาวิทยาลัยมหาสารคาม"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  ระบบเบิกจ่ายวัสดุพัสดุ
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  COPAG MSU
                </span>
              </div>
              <p className="text-xs text-slate-300">
                วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม
              </p>
            </div>
          </div>

          {/* Quick utility action buttons & User Profile */}
          <div className="flex items-center gap-2.5 flex-wrap self-end md:self-center">
            
            {/* User Profile Badge (Always active, no login required) */}
            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  isAdmin ? 'bg-amber-500 text-slate-950' : 'bg-blue-600 text-white'
                }`}>
                  {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-100 max-w-[140px] truncate">
                      {currentUser.name}
                    </span>
                    {onToggleRole ? (
                      <button
                        type="button"
                        onClick={onToggleRole}
                        title="คลิกเพื่อสลับสิทธิ์การใช้งาน (แอดมินพัสดุ <-> ผู้ขอเบิก)"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 ${
                          isAdmin 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30'
                        }`}
                      >
                        <span>{isAdmin ? 'แอดมิน (พัสดุ)' : 'ผู้ขอเบิก'}</span>
                        <RefreshCw className="w-2.5 h-2.5 opacity-80" />
                      </button>
                    ) : (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {isAdmin ? 'แอดมิน (พัสดุ)' : 'ผู้ขอเบิก'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser.email}
                  </div>
                </div>

                {onLogout && (
                  <button
                    id="logout-btn"
                    onClick={onLogout}
                    title="ออกจากระบบ"
                    className="ml-1 p-1.5 hover:bg-rose-950/60 hover:text-rose-300 rounded-lg text-slate-400 border border-slate-700/60 hover:border-rose-500/50 transition cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline text-rose-300">ออก</span>
                  </button>
                )}
              </div>
            )}

            <button
              id="refresh-data-btn"
              onClick={onRefreshData}
              title="รีเฟรชข้อมูลล่าสุด"
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>

            <button
              id="data-management-btn"
              onClick={onOpenDataModal}
              title="จัดการและสำรองข้อมูล"
              className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-950/50 hover:bg-amber-900/50 border border-amber-800/60 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">จัดการข้อมูล / สำรอง</span>
            </button>
          </div>

        </div>

        {/* Navigation tabs */}
        <nav 
          className="flex items-center gap-1 sm:gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none border-t border-slate-800 pt-2"
          style={{ lineHeight: '21px' }}
        >
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isRequisitionBtn = item.id === 'requisition';

            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition cursor-pointer relative ${
                  isRequisitionBtn
                    ? isActive
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-xs hover:shadow-md'
                    : isActive 
                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400/50' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isRequisitionBtn ? 'stroke-[2.5]' : ''}`} />
                <span
                  style={{ fontSize: '18px', fontFamily: 'Sarabun', fontWeight: 'bold' }}
                >
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 text-[11px] font-bold rounded-full text-white ${
                    isRequisitionBtn ? 'bg-slate-900 text-amber-300' : (item.badgeColor || 'bg-amber-500')
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
