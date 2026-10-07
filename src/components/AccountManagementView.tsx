import { FC, useState, useEffect, useMemo, FormEvent } from 'react';
import { AppUser, UserRole } from '../types';
import { StorageService, isAllowedMsuEmail } from '../services/storageService';
import { COPAG_DEPARTMENTS } from '../mockData';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  Mail,
  User,
  Shield,
  KeyRound,
  X,
  Lock,
  Calendar
} from 'lucide-react';

interface AccountManagementViewProps {
  currentUser: AppUser | null;
}

export const AccountManagementView: FC<AccountManagementViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [domainFilter, setDomainFilter] = useState<'all' | 'msu.ac.th' | 'oas.msu.ac.th'>('all');

  // Modal State for adding/registering a user
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newDepartment, setNewDepartment] = useState(COPAG_DEPARTMENTS[0]);
  const [newPosition, setNewPosition] = useState('อาจารย์/บุคลากร');
  const [addError, setAddError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Confirmation modal state for deletion
  const [deleteTargetUser, setDeleteTargetUser] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await StorageService.getUsers();
      // Ensure unique list by email
      const uniqueMap = new Map<string, AppUser>();
      list.forEach(u => {
        if (u && u.email) uniqueMap.set(u.email.toLowerCase(), u);
      });
      setUsers(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
  };

  const handleRoleChange = async (email: string, newRole: UserRole) => {
    await StorageService.updateUserRole(email, newRole);
    setActionSuccess(`ปรับสิทธิ์ของ ${email} เป็น ${newRole === 'admin' ? 'แอดมิน' : 'ผู้ใช้งานทั่วไป'} เรียบร้อยแล้ว`);
    setTimeout(() => setActionSuccess(''), 4000);
    await loadUsers();
  };

  const handleDeleteUser = async (user: AppUser) => {
    try {
      setIsDeleting(true);
      await StorageService.deleteUser(user.email);
      setDeleteTargetUser(null);
      setActionSuccess(`ลบบัญชี ${user.email} ออกจากระบบและ Firebase เรียบร้อยแล้ว`);
      setTimeout(() => setActionSuccess(''), 4000);

      // If the deleted account is currently logged in, reload to return to login screen
      if (currentUser && currentUser.email.toLowerCase() === user.email.toLowerCase()) {
        window.location.reload();
        return;
      }
      await loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('เกิดข้อผิดพลาดในการลบบัญชีผู้ใช้');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setAddError('');

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setAddError('กรุณากรอกอีเมล');
      return;
    }

    if (!isAllowedMsuEmail(cleanEmail)) {
      setAddError('อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย @msu.ac.th หรือ @oas.msu.ac.th เท่านั้น');
      return;
    }

    if (!newName.trim()) {
      setAddError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    const newUserObj: AppUser = {
      email: cleanEmail,
      name: newName.trim(),
      role: cleanEmail === 'kanjanapat.m@msu.ac.th' ? 'admin' : newRole,
      department: newDepartment,
      position: newPosition.trim() || 'อาจารย์/บุคลากร',
      status: 'active',
      loginCount: 0,
      createdAt: new Date().toISOString()
    };

    await StorageService.saveOrUpdateUser(newUserObj);
    setIsAddModalOpen(false);
    setNewEmail('');
    setNewName('');
    setActionSuccess(`เพิ่มบัญชี ${cleanEmail} สำเร็จแล้ว`);
    setTimeout(() => setActionSuccess(''), 4000);
    await loadUsers();
  };

  // Filtered list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q) || 
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.position && u.position.toLowerCase().includes(q));

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;

      let matchesDomain = true;
      if (domainFilter === 'msu.ac.th') {
        matchesDomain = u.email.toLowerCase().endsWith('@msu.ac.th');
      } else if (domainFilter === 'oas.msu.ac.th') {
        matchesDomain = u.email.toLowerCase().endsWith('@oas.msu.ac.th');
      }

      return matchesSearch && matchesRole && matchesDomain;
    });
  }, [users, searchTerm, roleFilter, domainFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const regular = users.filter(u => u.role === 'user').length;
    const msuCount = users.filter(u => u.email.toLowerCase().endsWith('@msu.ac.th')).length;
    const oasCount = users.filter(u => u.email.toLowerCase().endsWith('@oas.msu.ac.th')).length;
    return { total, admins, regular, msuCount, oasCount };
  }, [users]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'ยังไม่เคยเข้าสู่ระบบ';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-12" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Header section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                การบริหารจัดการผู้ใช้งานระบบ (User Accounts)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                รายชื่อผู้ใช้งานที่ล็อกอินเข้าใช้งานผ่าน Google OAuth (@msu.ac.th / @oas.msu.ac.th) พร้อมการกำหนดสิทธิ์
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่ม/กำหนดสิทธิ์ล่วงหน้า</span>
          </button>
        </div>
      </div>

      {/* Security Domain Info Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>นโยบายความปลอดภัย Google OAuth Domain Authorization</span>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] rounded-md font-bold">
                ENFORCED
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              ระบบอนุญาตให้เฉพาะอีเมลที่ลงท้ายด้วย <strong className="text-amber-600 dark:text-amber-400">@msu.ac.th</strong> หรือ <strong className="text-amber-600 dark:text-amber-400">@oas.msu.ac.th</strong> เท่านั้น 
              หากใช้อีเมลอื่น (เช่น @gmail.com) ระบบจะแสดงข้อความแจ้งเตือน Error และตัดเซสชันทันที
            </p>
          </div>
        </div>

        <div className="shrink-0 bg-white dark:bg-slate-800 border border-amber-500/40 rounded-xl px-3 py-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <div>
            <div className="text-[10px] text-slate-400">Super Admin ประจำระบบ</div>
            <div className="font-bold font-mono text-slate-800 dark:text-slate-200">kanjanapat.m@msu.ac.th</div>
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>ผู้ใช้งานทั้งหมด</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.total} <span className="text-xs font-normal text-slate-400">บัญชี</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            @msu: {stats.msuCount} • @oas: {stats.oasCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-medium">
            <span>ผู้ดูแลระบบ (Admin)</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.admins} <span className="text-xs font-normal text-slate-400">คน</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            สิทธิ์อนุมัติ จัดการคลัง และสมุดคุม
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-medium">
            <span>ผู้ขอเบิกพัสดุ (User)</span>
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {stats.regular} <span className="text-xs font-normal text-slate-400">คน</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            อาจารย์และบุคลากรในสังกัด
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>การเข้าใช้งานเฉลี่ย</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {users.reduce((sum, u) => sum + (u.loginCount || 1), 0)} <span className="text-xs font-normal text-slate-400">ครั้ง</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            บันทึกสถิติการใช้งานจริง
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตามชื่อ-นามสกุล, อีเมล @msu.ac.th, สังกัด หรือตำแหน่ง..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              className="bg-transparent border-none outline-none text-xs font-medium cursor-pointer"
            >
              <option value="all">สิทธิ์ทั้งหมด</option>
              <option value="admin">แอดมิน (Admin)</option>
              <option value="user">ผู้ใช้งานทั่วไป (User)</option>
            </select>
          </div>

          {/* Domain Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value as any)}
              className="bg-transparent border-none outline-none text-xs font-medium cursor-pointer"
            >
              <option value="all">โดเมนทั้งหมด</option>
              <option value="msu.ac.th">@msu.ac.th</option>
              <option value="oas.msu.ac.th">@oas.msu.ac.th</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 min-w-[240px]">ผู้ใช้งาน / บัญชี Google</th>
                <th className="py-3 px-4 min-w-[180px]">สังกัด / หน่วยงาน</th>
                <th className="py-3 px-4 min-w-[140px]">ตำแหน่ง</th>
                <th className="py-3 px-4 w-36 text-center">สิทธิ์การเข้าถึง (Role)</th>
                <th className="py-3 px-4 w-40 text-center">เข้าใช้งานล่าสุด</th>
                <th className="py-3 px-4 w-20 text-center">ล็อกอิน</th>
                <th className="py-3 px-4 w-28 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>กำลังโหลดรายชื่อบัญชีผู้ใช้งาน...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600 stroke-1" />
                    <span>ไม่พบบัญชีผู้ใช้งานที่ตรงกับเงื่อนไข</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const isSuperAdmin = user.email.toLowerCase() === 'kanjanapat.m@msu.ac.th';
                  const isCurrent = currentUser?.email.toLowerCase() === user.email.toLowerCase();
                  const isAdmin = user.role === 'admin';

                  return (
                    <tr 
                      key={`${user.email}_${user.uid || index}`}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                        isCurrent ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center text-slate-400 font-medium">
                        {index + 1}
                      </td>

                      {/* User Profile info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                            isSuperAdmin 
                              ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 ring-2 ring-amber-400/50' 
                              : isAdmin 
                              ? 'bg-amber-500 text-slate-950' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}>
                            {user.name ? user.name.charAt(0) : 'U'}
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded">
                                  บัญชีคุณ
                                </span>
                              )}
                              {isSuperAdmin && (
                                <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold rounded border border-purple-500/30">
                                  Super Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{user.department || 'วิทยาลัยการเมืองการปกครอง'}</span>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <span className="truncate">{user.position || '-'}</span>
                      </td>

                      {/* Role display */}
                      <td className="py-3 px-4 text-center">
                        {isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 shadow-xs">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>แอดมิน (พัสดุ)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>ผู้ขอเบิกพัสดุ</span>
                          </span>
                        )}
                      </td>

                      {/* Last Login Date */}
                      <td className="py-3 px-4 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(user.lastLoginAt)}</span>
                        </div>
                      </td>

                      {/* Total Logins */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[11px]">
                          {user.loginCount || 1}
                        </span>
                      </td>

                      {/* Delete action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setDeleteTargetUser(user)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title={`ลบบัญชี ${user.name || user.email}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>แสดง {filteredUsers.length} จากทั้งหมด {users.length} บัญชี</span>
          <span className="text-[11px] text-slate-400">
            * เมื่อมีผู้ใช้งานล็อกอินด้วย Google (@msu.ac.th / @oas.msu.ac.th) ครั้งแรก ระบบจะสร้างบัญชีและบันทึกลงในหน้านี้โดยอัตโนมัติ
          </span>
        </div>
      </div>

      {/* Add / Pre-register Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  เพิ่มหรือกำหนดสิทธิ์บัญชีล่วงหน้า
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ต้องเป็นอีเมล @msu.ac.th หรือ @oas.msu.ac.th เท่านั้น
                </p>
              </div>
            </div>

            {addError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  อีเมลสถาบัน (@msu.ac.th หรือ @oas.msu.ac.th) *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="เช่น user.name@msu.ac.th"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อ-นามสกุล *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="เช่น อาจารย์ หรือ บุคลากร"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    บทบาท (Role)
                  </label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="user">👤 ผู้ใช้งานทั่วไป</option>
                    <option value="admin">🛡️ แอดมิน (พัสดุ)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ตำแหน่ง
                  </label>
                  <input
                    type="text"
                    value={newPosition}
                    onChange={e => setNewPosition(e.target.value)}
                    placeholder="เช่น อาจารย์ประจำ"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  สาขาวิชา / หน่วยงาน
                </label>
                <select
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {COPAG_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 transition font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs transition"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto ring-4 ring-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ยืนยันการลบบัญชีผู้ใช้?
            </h3>
            
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <p>
                คุณต้องการลบบัญชี <strong className="text-slate-800 dark:text-slate-200">{deleteTargetUser.name}</strong> ออกจากระบบใช่หรือไม่?
              </p>
              <div className="bg-slate-100 dark:bg-slate-800/80 p-2 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all border border-slate-200 dark:border-slate-700">
                {deleteTargetUser.email}
              </div>

              {currentUser && currentUser.email.toLowerCase() === deleteTargetUser.email.toLowerCase() && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] text-left">
                  ⚠️ <strong>คำเตือน:</strong> คุณกำลังจะลบบัญชีที่คุณกำลังใช้งานอยู่ ระบบจะนำคุณออกจากระบบทันทีหลังจากลบข้อมูล
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 transition font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteUser(deleteTargetUser)}
                className="px-4 py-2 text-xs bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'กำลังลบ...' : 'ลบบัญชีถาวร'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
