import { FC, useState, useEffect, FormEvent } from 'react';
import { AppUser } from '../types';
import { 
  X, 
  Check, 
  RotateCcw, 
  UserCheck, 
  Save, 
  User, 
  Briefcase, 
  Calendar,
  Sparkles,
  Users
} from 'lucide-react';

export interface StockCardSigners {
  recorderName: string;
  recorderPosition: string;
  recorderDate: string;
  checkerName: string;
  checkerPosition: string;
  checkerDate: string;
}

interface StockCardSignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  signers: StockCardSigners;
  onSave: (newSigners: StockCardSigners, saveAsDefault: boolean) => void;
  systemUsers?: AppUser[];
  defaultAdminName?: string;
  focusRole?: 'recorder' | 'checker' | null;
}

export const StockCardSignerModal: FC<StockCardSignerModalProps> = ({
  isOpen,
  onClose,
  signers: initialSigners,
  onSave,
  systemUsers = [],
  defaultAdminName = 'กาญจนภาษณ์ มาตบุรม',
  focusRole
}) => {
  const [formData, setFormData] = useState<StockCardSigners>({ ...initialSigners });
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...initialSigners });
    }
  }, [isOpen, initialSigners]);

  if (!isOpen) return null;

  // Thai Date formatting helper
  const getTodayThaiDateText = () => {
    try {
      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth() + 1;
      const year = (now.getFullYear() + 543).toString().slice(-2);
      return `วันที่ ${day}/${month}/${year}`;
    } catch {
      return 'วันที่ ........./........./............';
    }
  };

  const handleResetToSystemDefault = () => {
    setFormData({
      recorderName: defaultAdminName,
      recorderPosition: 'เจ้าหน้าที่พัสดุ',
      recorderDate: 'วันที่ ........./........./............',
      checkerName: '..............................................................',
      checkerPosition: 'หัวหน้างานพัสดุและคลัง',
      checkerDate: 'วันที่ ........./........./............'
    });
  };

  const handleFillKanjanapat = () => {
    setFormData(prev => ({
      ...prev,
      recorderName: 'กาญจนภาษณ์ มาตบุรม',
      recorderPosition: 'เจ้าหน้าที่พัสดุ'
    }));
  };

  const handleApplyUser = (user: AppUser, targetRole: 'recorder' | 'checker') => {
    if (targetRole === 'recorder') {
      setFormData(prev => ({
        ...prev,
        recorderName: user.name,
        recorderPosition: user.position || (user.role === 'admin' ? 'เจ้าหน้าที่พัสดุ' : 'บุคลากร')
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        checkerName: user.name,
        checkerPosition: user.position || 'หัวหน้างานพัสดุและคลัง'
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                บริหารจัดการผู้ลงนาม — สมุดคุมบัญชีพัสดุ (Stock Card)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                กำหนดหรือเปลี่ยนชื่อและตำแหน่งของผู้บันทึกและผู้ตรวจสอบให้เป็นใครก็ได้ตามต้องการ
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

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Quick Presets / Shortcuts */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                ทางลัดกำหนดข้อมูลด่วน:
              </span>
              <button
                type="button"
                onClick={handleResetToSystemDefault}
                className="text-xs text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 font-semibold transition"
              >
                <RotateCcw className="w-3 h-3" />
                รีเซ็ตเป็นค่าเริ่มต้น
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleFillKanjanapat}
                className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-amber-500 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition"
              >
                ผู้บันทึก: กาญจนภาษณ์ มาตบุรม (จนท.พัสดุ)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    recorderDate: getTodayThaiDateText(),
                    checkerDate: getTodayThaiDateText()
                  }));
                }}
                className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-amber-500 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition"
              >
                ลงวันที่วันนี้อัตโนมัติ
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    recorderDate: 'วันที่ ........./........./............',
                    checkerDate: 'วันที่ ........./........./............'
                  }));
                }}
                className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-amber-500 rounded-lg font-medium text-slate-700 dark:text-slate-200 transition"
              >
                เว้นจุดประ (ลงวันที่ด้วยลายมือ)
              </button>
            </div>
          </div>

          {/* Section 1: ผู้บันทึก */}
          <div className={`p-4 rounded-xl border transition ${
            focusRole === 'recorder' 
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-500/5' 
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-3">
              <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                  1
                </span>
                ผู้บันทึก (Recorder)
              </span>

              {/* System User Picker */}
              {systemUsers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    onChange={(e) => {
                      const u = systemUsers.find(x => x.email === e.target.value);
                      if (u) handleApplyUser(u, 'recorder');
                    }}
                    defaultValue=""
                    className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="" disabled>เลือกจากรายชื่อในระบบ...</option>
                    {systemUsers.map(u => (
                      <option key={`rec-${u.email}`} value={u.email}>
                        {u.name} ({u.position || u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-500" />
                  ชื่อ-นามสกุล ผู้บันทึก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.recorderName}
                  onChange={(e) => setFormData(prev => ({ ...prev, recorderName: e.target.value }))}
                  placeholder="เช่น กาญจนภาษณ์ มาตบุรม"
                  required
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                  ตำแหน่ง ผู้บันทึก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.recorderPosition}
                  onChange={(e) => setFormData(prev => ({ ...prev, recorderPosition: e.target.value }))}
                  placeholder="เช่น เจ้าหน้าที่พัสดุ"
                  required
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  ข้อความวันที่ลงนาม
                </label>
                <input
                  type="text"
                  value={formData.recorderDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, recorderDate: e.target.value }))}
                  placeholder="เช่น วันที่ ........./........./............ หรือ วันที่ 15/09/68"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: ผู้ตรวจสอบ */}
          <div className={`p-4 rounded-xl border transition ${
            focusRole === 'checker' 
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-500/5' 
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-3">
              <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-xs">
                  2
                </span>
                ผู้ตรวจสอบ (Checker / Auditor)
              </span>

              {/* System User Picker */}
              {systemUsers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    onChange={(e) => {
                      const u = systemUsers.find(x => x.email === e.target.value);
                      if (u) handleApplyUser(u, 'checker');
                    }}
                    defaultValue=""
                    className="text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="" disabled>เลือกจากรายชื่อในระบบ...</option>
                    {systemUsers.map(u => (
                      <option key={`chk-${u.email}`} value={u.email}>
                        {u.name} ({u.position || u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  ชื่อ-นามสกุล ผู้ตรวจสอบ
                </label>
                <input
                  type="text"
                  value={formData.checkerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkerName: e.target.value }))}
                  placeholder="เช่น ระบุชื่อ หรือใส่จุดประสำหรับเซ็นมือ"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  * หากเว้นว่างไว้ ระบบจะแสดงเส้นประ (..............................................................) ให้ลงนามด้วยลายมือ
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  ตำแหน่ง ผู้ตรวจสอบ
                </label>
                <input
                  type="text"
                  value={formData.checkerPosition}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkerPosition: e.target.value }))}
                  placeholder="เช่น หัวหน้างานพัสดุและคลัง"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  ข้อความวันที่ลงนาม
                </label>
                <input
                  type="text"
                  value={formData.checkerDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkerDate: e.target.value }))}
                  placeholder="เช่น วันที่ ........./........./............ หรือ วันที่ 15/09/68"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Remember as default checkbox */}
          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="saveStockCardDefault"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="saveStockCardDefault" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              บันทึกชื่อและตำแหน่งนี้เป็นค่าเริ่มต้นสำหรับพิมพ์หรือดาวน์โหลด Stock Card ในครั้งต่อไป
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
