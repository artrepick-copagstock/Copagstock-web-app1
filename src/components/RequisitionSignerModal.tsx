import { FC, useState, useEffect, FormEvent } from 'react';
import { AppUser } from '../types';
import { 
  X, 
  Check, 
  RotateCcw, 
  UserCheck, 
  User, 
  Briefcase, 
  Calendar,
  Sparkles,
  Users,
  Building2,
  FileText
} from 'lucide-react';

export interface RequisitionSigners {
  // 1. ผู้ขอเบิก
  requesterName: string;
  requesterPosition: string;
  requesterDepartment: string;
  requesterDate: string;
  // 2. เจ้าหน้าที่พัสดุ
  officerName: string;
  officerPosition: string;
  officerDate: string;
  // 3. หัวหน้าเจ้าหน้าที่พัสดุ
  headName: string;
  headPosition: string;
  headDate: string;
  // 4. ผู้ตัดบัญชีพัสดุ
  ledgerOfficerName: string;
  ledgerOfficerPosition: string;
  ledgerOfficerDate: string;
  // 5. ผู้จ่ายของ
  disburserName: string;
  disburserPosition: string;
  disburserDate: string;
}

interface RequisitionSignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  signers: RequisitionSigners;
  onSave: (newSigners: RequisitionSigners, saveAsDefault: boolean) => void;
  systemUsers?: AppUser[];
  defaultOrderValues: {
    requesterName: string;
    requesterPosition: string;
    requesterDepartment: string;
    requesterDate: string;
    defaultAdminName: string;
    disbursedDate?: string;
  };
  focusRole?: 'requester' | 'officer' | 'head' | 'ledger' | 'disburser' | null;
}

export const RequisitionSignerModal: FC<RequisitionSignerModalProps> = ({
  isOpen,
  onClose,
  signers: initialSigners,
  onSave,
  systemUsers = [],
  defaultOrderValues,
  focusRole
}) => {
  const [formData, setFormData] = useState<RequisitionSigners>({ ...initialSigners });
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'requester' | 'supply'>('all');

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...initialSigners });
      if (focusRole === 'requester') {
        setActiveTab('requester');
      } else if (focusRole) {
        setActiveTab('supply');
      } else {
        setActiveTab('all');
      }
    }
  }, [isOpen, initialSigners, focusRole]);

  if (!isOpen) return null;

  // Thai Date formatting helper
  const getTodayThaiDateText = () => {
    try {
      const now = new Date();
      const monthsThai = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const day = now.getDate();
      const month = monthsThai[now.getMonth()];
      const year = now.getFullYear() + 543;
      return `${day} ${month} พ.ศ. ${year}`;
    } catch {
      return 'วันที่ ......../......../............';
    }
  };

  const handleResetToOrderDefault = () => {
    setFormData({
      requesterName: defaultOrderValues.requesterName,
      requesterPosition: defaultOrderValues.requesterPosition || 'อาจารย์/บุคลากร',
      requesterDepartment: defaultOrderValues.requesterDepartment || 'วิทยาลัยการเมืองการปกครอง',
      requesterDate: defaultOrderValues.requesterDate,
      officerName: defaultOrderValues.defaultAdminName,
      officerPosition: 'เจ้าหน้าที่พัสดุ',
      officerDate: 'วันที่ ......../......../............',
      headName: '........................................................',
      headPosition: 'หัวหน้าเจ้าหน้าที่พัสดุ',
      headDate: 'วันที่ ......../......../............',
      ledgerOfficerName: defaultOrderValues.defaultAdminName,
      ledgerOfficerPosition: 'ผู้ตัดบัญชีพัสดุ',
      ledgerOfficerDate: 'วันที่ ......../......../............',
      disburserName: defaultOrderValues.defaultAdminName,
      disburserPosition: 'ผู้จ่ายของ',
      disburserDate: defaultOrderValues.disbursedDate 
        ? `จ่ายแล้วเมื่อ ${defaultOrderValues.disbursedDate}` 
        : 'วันที่ ......../......../............'
    });
  };

  const handleFillAllSupplyRoles = (name: string, title?: string) => {
    setFormData(prev => ({
      ...prev,
      officerName: name,
      officerPosition: title || 'เจ้าหน้าที่พัสดุ',
      ledgerOfficerName: name,
      ledgerOfficerPosition: 'ผู้ตัดบัญชีพัสดุ',
      disburserName: name,
      disburserPosition: 'ผู้จ่ายของ'
    }));
  };

  const handleApplyUserToRole = (user: AppUser, roleKey: keyof RequisitionSigners) => {
    if (roleKey === 'requesterName') {
      setFormData(prev => ({
        ...prev,
        requesterName: user.name,
        requesterPosition: user.position || 'อาจารย์/บุคลากร',
        requesterDepartment: user.department || prev.requesterDepartment
      }));
    } else if (roleKey === 'officerName') {
      setFormData(prev => ({
        ...prev,
        officerName: user.name,
        officerPosition: user.position || 'เจ้าหน้าที่พัสดุ'
      }));
    } else if (roleKey === 'headName') {
      setFormData(prev => ({
        ...prev,
        headName: user.name,
        headPosition: user.position || 'หัวหน้าเจ้าหน้าที่พัสดุ'
      }));
    } else if (roleKey === 'ledgerOfficerName') {
      setFormData(prev => ({
        ...prev,
        ledgerOfficerName: user.name,
        ledgerOfficerPosition: user.position || 'ผู้ตัดบัญชีพัสดุ'
      }));
    } else if (roleKey === 'disburserName') {
      setFormData(prev => ({
        ...prev,
        disburserName: user.name,
        disburserPosition: user.position || 'ผู้จ่ายของ'
      }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(formData, saveAsDefault);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                บริหารจัดการผู้ลงนาม — ใบเบิกวัสดุ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                กำหนดหรือเปลี่ยนชื่อและตำแหน่งของผู้ขอเบิก และเจ้าหน้าที่ทุกฝ่ายให้เป็นใครก็ได้ตามต้องการ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Filters */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/30 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              แสดงทั้งหมด (5 ฝ่าย)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('requester')}
              className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'requester' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              ฝ่ายผู้ขอเบิก
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('supply')}
              className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'supply' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              ฝ่ายเจ้าหน้าที่พัสดุและคลัง
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetToOrderDefault}
            className="text-xs text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            รีเซ็ตเป็นค่าเริ่มต้น
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Quick Shortcuts Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              กำหนดข้อมูลเจ้าหน้าที่พัสดุด่วน:
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleFillAllSupplyRoles('กาญจนภาษณ์ มาตบุรม', 'เจ้าหน้าที่พัสดุ')}
                className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-amber-500 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition"
              >
                ใส่ชื่อ "กาญจนภาษณ์ มาตบุรม" ในทุกช่องงานพัสดุ
              </button>
              {defaultOrderValues.defaultAdminName && defaultOrderValues.defaultAdminName !== 'กาญจนภาษณ์ มาตบุรม' && (
                <button
                  type="button"
                  onClick={() => handleFillAllSupplyRoles(defaultOrderValues.defaultAdminName)}
                  className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-amber-500 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition"
                >
                  ใส่ชื่อฉัน ({defaultOrderValues.defaultAdminName}) ในทุกช่องงานพัสดุ
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    officerDate: `วันที่ ${getTodayThaiDateText()}`,
                    ledgerOfficerDate: `วันที่ ${getTodayThaiDateText()}`,
                    disburserDate: `วันที่ ${getTodayThaiDateText()}`
                  }));
                }}
                className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-amber-500 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition"
              >
                ใส่วันที่ปัจจุบันในช่องพัสดุ
              </button>
            </div>
          </div>

          {/* Role 1: ผู้ขอเบิก (Requester) */}
          {(activeTab === 'all' || activeTab === 'requester') && (
            <div className={`p-4 rounded-xl border transition ${
              focusRole === 'requester'
                ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-500/5'
                : 'border-amber-200 dark:border-amber-900/50 bg-amber-50/10 dark:bg-amber-950/10'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  ผู้ขอเบิกพัสดุ (Requester)
                  <span className="text-[11px] font-normal text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
                    แสดงทั้งในเนื้อหาข้อความและช่องลงนาม
                  </span>
                </span>

                {systemUsers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      onChange={(e) => {
                        const u = systemUsers.find(x => x.email === e.target.value);
                        if (u) handleApplyUserToRole(u, 'requesterName');
                      }}
                      defaultValue=""
                      className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="" disabled>เลือกผู้ขอเบิกจากระบบ...</option>
                      {systemUsers.map(u => (
                        <option key={`req-${u.email}`} value={u.email}>
                          {u.name} ({u.department || u.position || u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    ชื่อ-นามสกุล ผู้ขอเบิก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.requesterName}
                    onChange={(e) => setFormData(prev => ({ ...prev, requesterName: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                    ตำแหน่ง ผู้ขอเบิก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.requesterPosition}
                    onChange={(e) => setFormData(prev => ({ ...prev, requesterPosition: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                    สังกัด / สาขาวิชา
                  </label>
                  <input
                    type="text"
                    value={formData.requesterDepartment}
                    onChange={(e) => setFormData(prev => ({ ...prev, requesterDepartment: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    วันที่ขอเบิก (แสดงในช่องลงนามผู้ขอเบิก)
                  </label>
                  <input
                    type="text"
                    value={formData.requesterDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, requesterDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Supply Section Roles */}
          {(activeTab === 'all' || activeTab === 'supply') && (
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                ฝ่ายเจ้าหน้าที่พัสดุและคลัง (Supply & Inventory Officers)
              </div>

              {/* Role 2: เจ้าหน้าที่พัสดุ */}
              <div className={`p-4 rounded-xl border transition ${
                focusRole === 'officer'
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-700 mb-3">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                      2
                    </span>
                    เจ้าหน้าที่พัสดุ
                  </span>
                  {systemUsers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const u = systemUsers.find(x => x.email === e.target.value);
                        if (u) handleApplyUserToRole(u, 'officerName');
                      }}
                      defaultValue=""
                      className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300"
                    >
                      <option value="" disabled>เลือกบุคลากร...</option>
                      {systemUsers.map(u => (
                        <option key={`off-${u.email}`} value={u.email}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ชื่อ-นามสกุล</label>
                    <input
                      type="text"
                      value={formData.officerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, officerName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ตำแหน่ง</label>
                    <input
                      type="text"
                      value={formData.officerPosition}
                      onChange={(e) => setFormData(prev => ({ ...prev, officerPosition: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันที่</label>
                    <input
                      type="text"
                      value={formData.officerDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, officerDate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Role 3: หัวหน้าเจ้าหน้าที่พัสดุ */}
              <div className={`p-4 rounded-xl border transition ${
                focusRole === 'head'
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-700 mb-3">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                      3
                    </span>
                    หัวหน้าเจ้าหน้าที่พัสดุ
                  </span>
                  {systemUsers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const u = systemUsers.find(x => x.email === e.target.value);
                        if (u) handleApplyUserToRole(u, 'headName');
                      }}
                      defaultValue=""
                      className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300"
                    >
                      <option value="" disabled>เลือกบุคลากร...</option>
                      {systemUsers.map(u => (
                        <option key={`head-${u.email}`} value={u.email}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      ชื่อ-นามสกุล (เว้นว่างไว้เพื่อแสดงจุดประลงนาม)
                    </label>
                    <input
                      type="text"
                      value={formData.headName}
                      onChange={(e) => setFormData(prev => ({ ...prev, headName: e.target.value }))}
                      placeholder="ใส่ชื่อ หรือเว้นว่างให้ลงนามด้วยมือ"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ตำแหน่ง</label>
                    <input
                      type="text"
                      value={formData.headPosition}
                      onChange={(e) => setFormData(prev => ({ ...prev, headPosition: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันที่</label>
                    <input
                      type="text"
                      value={formData.headDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, headDate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Role 4: ผู้ตัดบัญชีพัสดุ */}
              <div className={`p-4 rounded-xl border transition ${
                focusRole === 'ledger'
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-700 mb-3">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                      4
                    </span>
                    ผู้ตัดบัญชีพัสดุ (Stock Ledger Officer)
                  </span>
                  {systemUsers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const u = systemUsers.find(x => x.email === e.target.value);
                        if (u) handleApplyUserToRole(u, 'ledgerOfficerName');
                      }}
                      defaultValue=""
                      className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300"
                    >
                      <option value="" disabled>เลือกบุคลากร...</option>
                      {systemUsers.map(u => (
                        <option key={`ledg-${u.email}`} value={u.email}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ชื่อ-นามสกุล</label>
                    <input
                      type="text"
                      value={formData.ledgerOfficerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, ledgerOfficerName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ตำแหน่ง</label>
                    <input
                      type="text"
                      value={formData.ledgerOfficerPosition}
                      onChange={(e) => setFormData(prev => ({ ...prev, ledgerOfficerPosition: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันที่</label>
                    <input
                      type="text"
                      value={formData.ledgerOfficerDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, ledgerOfficerDate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Role 5: ผู้จ่ายของ */}
              <div className={`p-4 rounded-xl border transition ${
                focusRole === 'disburser'
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-700 mb-3">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                      5
                    </span>
                    ผู้จ่ายของ (Disburser)
                  </span>
                  {systemUsers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const u = systemUsers.find(x => x.email === e.target.value);
                        if (u) handleApplyUserToRole(u, 'disburserName');
                      }}
                      defaultValue=""
                      className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300"
                    >
                      <option value="" disabled>เลือกบุคลากร...</option>
                      {systemUsers.map(u => (
                        <option key={`disb-${u.email}`} value={u.email}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ชื่อ-นามสกุล</label>
                    <input
                      type="text"
                      value={formData.disburserName}
                      onChange={(e) => setFormData(prev => ({ ...prev, disburserName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">ตำแหน่ง</label>
                    <input
                      type="text"
                      value={formData.disburserPosition}
                      onChange={(e) => setFormData(prev => ({ ...prev, disburserPosition: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันที่</label>
                    <input
                      type="text"
                      value={formData.disburserDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, disburserDate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Remember as default checkbox */}
          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="saveRequisitionDefault"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="saveRequisitionDefault" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              บันทึกชื่อ-ตำแหน่งของฝ่ายเจ้าหน้าที่พัสดุและคลังเป็นค่าเริ่มต้นสำหรับใบเบิกถัดไป
            </label>
          </div>
        </form>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>บันทึกและนำไปใช้</span>
          </button>
        </div>
      </div>
    </div>
  );
};
