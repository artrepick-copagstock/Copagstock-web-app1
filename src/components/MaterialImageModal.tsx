import { FC, useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Material } from '../types';
import { processAndCompressImage, formatBytes, estimateBase64Size } from '../utils/imageUtils';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Link as LinkIcon, 
  Check, 
  AlertCircle, 
  Sparkles,
  Camera
} from 'lucide-react';

interface MaterialImageModalProps {
  material: Material | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveImage: (materialId: string, imageUrl: string) => Promise<void>;
}

export const MaterialImageModal: FC<MaterialImageModalProps> = ({
  material,
  isOpen,
  onClose,
  onSaveImage
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [imageStats, setImageStats] = useState<{ size: number; width?: number; height?: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when opened with material
  useState(() => {
    if (material?.imageUrl) {
      setPreviewUrl(material.imageUrl);
      setUrlInput(material.imageUrl);
      setImageStats({ size: estimateBase64Size(material.imageUrl) });
    } else {
      setPreviewUrl('');
      setUrlInput('');
      setImageStats(null);
    }
  });

  if (!isOpen || !material) return null;

  // Handle local file selection and automatic compression
  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPEG, PNG, WebP)');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // Compress to max 800x800 webp/jpeg for ultra-fast load and small DB footprint
      const processed = await processAndCompressImage(file, 800, 800, 0.82);
      setPreviewUrl(processed.dataUrl);
      setImageStats({
        size: processed.sizeBytes,
        width: processed.width,
        height: processed.height
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    } finally {
      setIsProcessing(false);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      setErrorMessage('กรุณากรอกลิงก์รูปภาพ');
      return;
    }
    setPreviewUrl(urlInput.trim());
    setImageStats({ size: estimateBase64Size(urlInput.trim()) });
    setErrorMessage('');
  };

  const handleClearImage = () => {
    setPreviewUrl('');
    setUrlInput('');
    setImageStats(null);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveImage(material.id, previewUrl);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'ไม่สามารถบันทึกรูปภาพได้');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                อัปโหลด / เปลี่ยนรูปภาพพัสดุ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                รหัส <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{material.id}</span> • {material.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>อัปโหลดจากไฟล์ / ถ่ายรูป</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>ใช้ลิงก์ URL รูปภาพ</span>
            </button>
          </div>

          {/* Tab 1: Upload from local/camera */}
          {activeTab === 'upload' && (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  dragOver
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                    : 'border-slate-300 dark:border-slate-600 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-100/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileInputChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    คลิกเพื่อเลือกรูปภาพ หรือลากไฟล์มาวางที่นี่
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    รองรับไฟล์ JPG, PNG, WebP (บีบอัดอัตโนมัติให้คมชัดแต่ขนาดเล็ก)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Image URL */}
          {activeTab === 'url' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                วางลิงก์ URL รูปภาพพัสดุ:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/... หรือ URL รูปภาพ"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3 py-2 bg-slate-800 text-white dark:bg-slate-700 rounded-xl text-xs font-bold hover:bg-slate-900 transition cursor-pointer"
                >
                  นำมาใช้
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Preview Area */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/70 dark:bg-slate-900/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                <span>ตัวอย่างรูปภาพพัสดุ</span>
              </span>
              {previewUrl && (
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบรูปภาพ</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-center min-h-[160px] bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2 overflow-hidden relative">
              {isProcessing ? (
                <div className="text-center py-6 text-slate-400">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">กำลังปรับขนาดและบีบอัดรูปภาพให้เหมาะสม...</p>
                </div>
              ) : previewUrl ? (
                <div className="relative group flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt={material.name}
                    className="max-h-[180px] w-auto max-w-full object-contain rounded-md shadow-xs"
                    referrerPolicy="no-referrer"
                    onError={() => setErrorMessage('ไม่สามารถโหลดตัวอย่างรูปภาพจาก URL ที่ระบุได้')}
                  />
                  {imageStats && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-750 px-2 py-0.5 rounded-md">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>ขนาด: {formatBytes(imageStats.size)}</span>
                      {imageStats.width && imageStats.height && (
                        <span>• {imageStats.width}x{imageStats.height}px</span>
                      )}
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ ปรับให้เหมาะกับระบบแล้ว</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                  <p className="text-xs">ยังไม่มีรูปภาพพัสดุนี้</p>
                  <p className="text-[11px] text-slate-400">เลือกอัปโหลดไฟล์หรือวาง URL ด้านบน</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition text-xs font-semibold cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isProcessing}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow transition text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>กำลังบันทึกและซิงค์...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>บันทึกรูปภาพ</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
