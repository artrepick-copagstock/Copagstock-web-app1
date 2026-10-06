import { FC, useState, useMemo, useRef, ChangeEvent, DragEvent } from 'react';
import { Material } from '../types';
import { StorageService } from '../services/storageService';
import { processAndCompressImage, formatBytes, estimateBase64Size } from '../utils/imageUtils';
import { 
  X, 
  Download, 
  Upload, 
  HardDrive, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Camera, 
  RefreshCw, 
  Trash2, 
  Sparkles,
  Layers,
  FileCheck,
  Eye,
  ArrowUpDown
} from 'lucide-react';

interface MaterialImageBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  onDataReload: () => Promise<void>;
  onOpenSingleImageModal: (material: Material) => void;
}

interface BatchMatchedItem {
  file: File;
  matchedMaterial: Material | null;
  detectedId: string;
  previewUrl: string;
  sizeBytes: number;
}

export const MaterialImageBackupModal: FC<MaterialImageBackupModalProps> = ({
  isOpen,
  onClose,
  materials,
  onDataReload,
  onOpenSingleImageModal
}) => {
  const [activeTab, setActiveTab] = useState<'vault' | 'batch' | 'gallery'>('vault');
  const [searchQuery, setSearchQuery] = useState('');
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'with_image' | 'no_image'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Status feedback
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Batch upload state
  const [batchItems, setBatchItems] = useState<BatchMatchedItem[]>([]);
  const [batchDragOver, setBatchDragOver] = useState(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // Restore file input
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [previewEnlargeMaterial, setPreviewEnlargeMaterial] = useState<Material | null>(null);
  const [photoToRemove, setPhotoToRemove] = useState<string | null>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [materials]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = materials.length;
    let withImage = 0;
    let totalSizeBytes = 0;

    materials.forEach(m => {
      if (m.imageUrl && m.imageUrl.trim().length > 0) {
        withImage++;
        totalSizeBytes += estimateBase64Size(m.imageUrl);
      }
    });

    const percent = total > 0 ? Math.round((withImage / total) * 100) : 0;
    return {
      total,
      withImage,
      withoutImage: total - withImage,
      percent,
      totalSizeBytes,
      formattedSize: formatBytes(totalSizeBytes)
    };
  }, [materials]);

  // Filtered gallery materials
  const galleryMaterials = useMemo(() => {
    return materials.filter(m => {
      // Filter by image status
      if (galleryFilter === 'with_image' && (!m.imageUrl || !m.imageUrl.trim())) return false;
      if (galleryFilter === 'no_image' && (m.imageUrl && m.imageUrl.trim().length > 0)) return false;

      // Filter by category
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = m.id.toLowerCase().includes(q);
        const matchName = m.name.toLowerCase().includes(q);
        const matchCat = m.category.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchCat) return false;
      }

      return true;
    });
  }, [materials, galleryFilter, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  // 1. Export Image Backup JSON
  const handleExportBackup = async () => {
    try {
      setIsProcessing(true);
      const backupData = await StorageService.exportImageBackup();
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COPAG_MSU_Material_Images_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage(`ส่งออกไฟล์สำรองรูปภาพพัสดุสำเร็จ (${backupData.materialsWithImages} รูปภาพ)`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage('ไม่สามารถส่งออกไฟล์สำรองได้: ' + err.message);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Restore Images from Backup JSON
  const handleRestoreFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsProcessing(true);
        const json = JSON.parse(event.target?.result as string);
        
        let restoreCount = 0;
        if (json.images && Array.isArray(json.images)) {
          restoreCount = await StorageService.restoreImageBackup(json.images);
        } else if (json.materials && Array.isArray(json.materials)) {
          // Backup file format that has materials array
          const cleanImages = json.materials
            .filter((m: any) => m.id && m.imageUrl)
            .map((m: any) => ({ materialId: m.id, imageUrl: m.imageUrl }));
          restoreCount = await StorageService.restoreImageBackup(cleanImages);
        } else {
          throw new Error('โครงสร้างไฟล์ไม่ตรงกับรูปแบบสำรองรูปภาพของระบบ');
        }

        await onDataReload();
        setStatusMessage(`กู้คืนและนำเข้ารูปภาพสำเร็จจำนวน ${restoreCount} รายการ พร้อมซิงค์ขึ้น Cloud`);
        setIsError(false);
      } catch (err: any) {
        setStatusMessage('เกิดข้อผิดพลาดในการกู้คืนรูปภาพ: ' + err.message);
        setIsError(true);
      } finally {
        setIsProcessing(false);
        if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // 3. Sync All Current Images to Cloud / Firestore
  const handleSyncToCloud = async () => {
    try {
      setIsProcessing(true);
      const materialsWithImg = materials.filter(m => m.imageUrl && m.imageUrl.trim());
      const updates = materialsWithImg.map(m => ({ id: m.id, imageUrl: m.imageUrl! }));
      const count = await StorageService.batchUpdateMaterialImages(updates);
      await onDataReload();
      setStatusMessage(`ซิงค์สำรองรูปภาพทั้งหมด ${count} รายการขึ้น Firestore และระบบจัดเก็บเรียบร้อยแล้ว`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage('เกิดข้อผิดพลาดในการซิงค์: ' + err.message);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Batch Multiple Images Upload
  const handleProcessBatchFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    setStatusMessage('กำลังตรวจจับรหัสพัสดุและบีบอัดรูปภาพ...');
    setIsError(false);

    const items: BatchMatchedItem[] = [];
    const matMap = new Map<string, Material>();
    materials.forEach(m => {
      matMap.set(m.id.toLowerCase().trim(), m);
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      // Extract filename without extension (e.g. "1ก01.jpg" -> "1ก01")
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const detectedId = baseName.trim();
      
      // Try to match material ID
      const matched = matMap.get(detectedId.toLowerCase()) || null;

      try {
        const compressed = await processAndCompressImage(file, 800, 800, 0.82);
        items.push({
          file,
          matchedMaterial: matched,
          detectedId,
          previewUrl: compressed.dataUrl,
          sizeBytes: compressed.sizeBytes
        });
      } catch (err) {
        console.warn('Failed to compress file', file.name, err);
      }
    }

    setBatchItems(prev => [...prev, ...items]);
    setIsProcessing(false);
    setStatusMessage(`เลือกและจับคู่รูปภาพเรียบร้อยแล้ว (${items.length} รูป)`);
  };

  const handleBatchDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBatchDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessBatchFiles(e.dataTransfer.files);
    }
  };

  // Apply batch updates
  const handleSaveBatchUpdates = async () => {
    const validUpdates = batchItems
      .filter(item => item.matchedMaterial)
      .map(item => ({
        id: item.matchedMaterial!.id,
        imageUrl: item.previewUrl
      }));

    if (validUpdates.length === 0) {
      setStatusMessage('ไม่มีรูปภาพที่จับคู่กับรหัสพัสดุในระบบ');
      setIsError(true);
      return;
    }

    setIsProcessing(true);
    try {
      const count = await StorageService.batchUpdateMaterialImages(validUpdates);
      await onDataReload();
      setStatusMessage(`บันทึกและอัปเดตรูปภาพพัสดุสำเร็จ ${count} รายการ`);
      setIsError(false);
      setBatchItems([]);
    } catch (err: any) {
      setStatusMessage('เกิดข้อผิดพลาดในการบันทึกรูปภาพ: ' + err.message);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove individual photo from gallery
  const handleRemovePhoto = (matId: string) => {
    setPhotoToRemove(matId);
  };

  const handleExecuteRemovePhoto = async (matId: string) => {
    setIsProcessing(true);
    setPhotoToRemove(null);
    try {
      await StorageService.updateMaterialImage(matId, '');
      await onDataReload();
      setStatusMessage(`ลบรูปภาพรหัส ${matId} เรียบร้อยแล้ว`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage('เกิดข้อผิดพลาด: ' + err.message);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-amber-600 via-amber-700 to-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20 shadow-xs">
              <HardDrive className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  พื้นที่สำรองข้อมูลรูปภาพและคลังสื่อพัสดุ
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  Image Vault 2.0
                </span>
              </div>
              <p className="text-xs text-amber-100/90">
                ระบบจัดการ อัปโหลด เปลี่ยนแปลง และสำรองข้อมูลรูปภาพพัสดุ วิทยาลัยการเมืองการปกครอง มมส.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Health & Statistics Dashboard Banner */}
        <div className="bg-amber-50/70 dark:bg-slate-850 border-b border-amber-200/60 dark:border-slate-700 px-5 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">รายการพัสดุทั้งหมด</span>
              <span className="text-lg font-extrabold text-slate-800 dark:text-white font-mono">{stats.total} รายการ</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>มีรูปภาพแล้ว</span>
              </span>
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {stats.withImage} <span className="text-xs font-normal">({stats.percent}%)</span>
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">ยังไม่มีรูปภาพ</span>
              <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {stats.withoutImage} <span className="text-xs font-normal">รายการ</span>
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block font-medium flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                <span>ขนาดข้อมูลรูปภาพรวม</span>
              </span>
              <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {stats.formattedSize}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-mono shrink-0">
              {stats.percent}% สมบูรณ์
            </span>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div className={`mx-5 mt-3 p-3 rounded-xl border text-xs flex items-center justify-between ${
            isError 
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300' 
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}>
            <div className="flex items-center gap-2">
              {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{statusMessage}</span>
            </div>
            <button 
              onClick={() => setStatusMessage('')} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-2 font-bold text-xs rounded-t-xl border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'vault'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-slate-750'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>พื้นที่สำรองและกู้คืน (Backup & Restore Vault)</span>
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-2 font-bold text-xs rounded-t-xl border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'batch'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-slate-750'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>อัปโหลดรูปภาพแบบชุดตามรหัส (Batch Upload)</span>
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 font-bold text-xs rounded-t-xl border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'gallery'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-slate-750'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>แกลเลอรีรูปภาพพัสดุ ({stats.total} รายการ)</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: VAULT & BACKUP */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Export Image Backup */}
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Download className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                        สำรองข้อมูลรูปภาพทั้งหมด (Export Backup)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                      ดาวน์โหลดแพ็กเกจสำรองข้อมูลรูปภาพพัสดุทั้งหมดในรูปแบบไฟล์ JSON พร้อมรหัสพัสดุและชื่อ เพื่อเก็บไว้เป็นหลักฐานหรือย้ายข้อมูลไปยังเครื่องอื่น
                    </p>
                    <div className="text-[11px] text-slate-500 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 mb-3 space-y-1">
                      <div>• จำนวนรูปภาพที่จะสำรอง: <span className="font-bold text-amber-600 dark:text-amber-400">{stats.withImage} รูปภาพ</span></div>
                      <div>• ประมาณการขนาดไฟล์สำรอง: <span className="font-bold font-mono">{stats.formattedSize}</span></div>
                    </div>
                  </div>

                  <button
                    onClick={handleExportBackup}
                    disabled={isProcessing || stats.withImage === 0}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดไฟล์สำรองรูปภาพ (JSON)</span>
                  </button>
                </div>

                {/* 2. Restore Image Backup */}
                <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Upload className="w-4 h-4" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                        กู้คืนและนำเข้ารูปภาพจากไฟล์สำรอง
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                      นำเข้าไฟล์สำรองรูปภาพพัสดุ (JSON) ที่เคยส่งออกไว้ เพื่ออัปเดตรูปภาพพัสดุทั้งหมดกลับคืนมา พร้อมซิงค์ขึ้น Cloud Database โดยอัตโนมัติ
                    </p>
                    <input
                      ref={restoreFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleRestoreFile}
                      className="hidden"
                    />
                  </div>

                  <button
                    onClick={() => restoreFileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>เลือกไฟล์สำรองรูปภาพ (.JSON) เพื่อกู้คืน</span>
                  </button>
                </div>

              </div>

              {/* Cloud Sync Tool */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-850 dark:to-slate-800 p-4 rounded-2xl border border-amber-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                        ซิงค์สำรองรูปภาพทั้งหมดขึ้น Firebase Cloud Storage
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ตรวจสอบความสอดคล้องของรูปภาพในเครื่องและบันทึกลงคอลเลกชันสำรองของ Firebase ให้ตรงกันทั้งหมด
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSyncToCloud}
                    disabled={isProcessing || stats.withImage === 0}
                    className="py-2 px-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-650 text-slate-800 dark:text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>ซิงค์รูปภาพขึ้น Cloud ทันที</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: BATCH UPLOAD BY MATERIAL ID */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-1">
                  <FileCheck className="w-4 h-4 text-amber-500" />
                  <span>ระบบจับคู่รูปภาพอัตโนมัติด้วยชื่อไฟล์ (Filename = Material ID)</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  เจ้าหน้าที่สามารถเลือกไฟล์ภาพพร้อมกันหลายๆ ไฟล์ โดยตั้งชื่อไฟล์เป็นรหัสพัสดุ เช่น <code className="px-1 py-0.5 bg-amber-100 dark:bg-slate-700 rounded text-amber-800 dark:text-amber-300 font-mono">1ก01.jpg</code>, <code className="px-1 py-0.5 bg-amber-100 dark:bg-slate-700 rounded text-amber-800 dark:text-amber-300 font-mono">1ก02.png</code>, <code className="px-1 py-0.5 bg-amber-100 dark:bg-slate-700 rounded text-amber-800 dark:text-amber-300 font-mono">1ข05.webp</code> ระบบจะค้นหารหัสพัสดุและบีบอัดรูปภาพให้พร้อมบันทึกในทันที
                </p>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setBatchDragOver(true); }}
                onDragLeave={() => setBatchDragOver(false)}
                onDrop={handleBatchDrop}
                onClick={() => batchFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  batchDragOver
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                    : 'border-slate-300 dark:border-slate-600 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-850'
                }`}
              >
                <input
                  ref={batchFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleProcessBatchFiles(e.target.files);
                    }
                  }}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    คลิกเพื่อเลือกไฟล์รูปภาพหลายๆ ไฟล์ หรือลากมาวางที่นี่
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ตั้งชื่อไฟล์ตรงกับรหัสพัสดุ เช่น 1ก01.jpg, 1ก02.png (เลือกได้หลายสิบรูปพร้อมกัน)
                  </p>
                </div>
              </div>

              {/* Matched Preview List */}
              {batchItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      รายการรูปภาพที่ตรวจพบ ({batchItems.length} ไฟล์):
                    </span>
                    <button
                      onClick={() => setBatchItems([])}
                      className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      ล้างรายการทั้งหมด
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-750">
                    {batchItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-800 text-xs">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 dark:text-white">
                                {item.file.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({formatBytes(item.sizeBytes)})
                              </span>
                            </div>
                            {item.matchedMaterial ? (
                              <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>จับคู่สำเร็จ: [{item.matchedMaterial.id}] {item.matchedMaterial.name}</span>
                              </div>
                            ) : (
                              <div className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[11px]">
                                <AlertTriangle className="w-3 h-3" />
                                <span>ไม่พบพัสดุรหัส "{item.detectedId}" ในระบบ</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setBatchItems(prev => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveBatchUpdates}
                      disabled={isProcessing || batchItems.filter(i => i.matchedMaterial).length === 0}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-xs transition flex items-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>บันทึกและซิงค์รูปภาพที่จับคู่ได้ ({batchItems.filter(i => i.matchedMaterial).length} รายการ)</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: GALLERY & QUICK EDIT */}
          {activeTab === 'gallery' && (
            <div className="space-y-3">
              
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหารหัสพัสดุ (เช่น 1ก01) หรือชื่อพัสดุ..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={galleryFilter}
                    onChange={(e) => setGalleryFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="all">ทั้งหมด ({materials.length})</option>
                    <option value="with_image">มีรูปแล้ว ({stats.withImage})</option>
                    <option value="no_image">ยังไม่มีรูป ({stats.withoutImage})</option>
                  </select>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none max-w-[150px]"
                  >
                    <option value="all">ทุกหมวดหมู่</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[52vh] overflow-y-auto pr-1">
                {galleryMaterials.map(mat => (
                  <div
                    key={mat.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs hover:shadow-sm transition flex flex-col group"
                  >
                    {/* Image Area — เต็มสัดส่วนแท้จริง ไม่บีบอัด ไม่ตัดขอบ ด้วย object-fit: contain */}
                    <div className="h-36 sm:h-44 bg-white dark:bg-slate-900 relative flex items-center justify-center overflow-hidden p-2 border-b border-slate-100 dark:border-slate-700/60">
                      {mat.imageUrl ? (
                        <>
                          <img
                            src={mat.imageUrl}
                            alt={mat.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                            style={{ objectFit: 'contain' }}
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={() => setPreviewEnlargeMaterial(mat)}
                            title="ดูภาพขยาย"
                            className="absolute top-1.5 right-1.5 p-1.5 bg-slate-900/60 hover:bg-slate-900/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="text-slate-400 flex flex-col items-center justify-center p-2 text-center">
                          <ImageIcon className="w-9 h-9 mb-1 text-slate-300 dark:text-slate-600" />
                          <span className="text-[10px]">ยังไม่มีรูป</span>
                        </div>
                      )}

                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-amber-300 font-mono font-bold text-[10px] rounded">
                        {mat.id}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        {/* ชื่อสินค้าใต้รูปภาพ: ตัวอักษรใหญ่ขึ้นชัดเจน 1.1rem / 18px ตัวหนา 600 สีเข้มชัดเจน */}
                        <h5 
                          className="text-[1.1rem] sm:text-[18px] font-semibold text-slate-950 dark:text-white line-clamp-2 leading-snug mb-1" 
                          style={{ fontSize: '1.1rem', fontWeight: 600 }}
                          title={mat.name}
                        >
                          {mat.name}
                        </h5>
                        <p className="text-[10px] text-slate-400 truncate">
                          {mat.category} • คงเหลือ {mat.currentStock} {mat.unit}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-750">
                        <button
                          onClick={() => onOpenSingleImageModal(mat)}
                          className="flex-1 py-1 px-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <Camera className="w-3 h-3" />
                          <span>{mat.imageUrl ? 'เปลี่ยนรูป' : 'อัปโหลด'}</span>
                        </button>
                        {mat.imageUrl && (
                          <button
                            onClick={() => handleRemovePhoto(mat.id)}
                            title="ลบรูปภาพ"
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {galleryMaterials.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                  <p className="text-xs">ไม่พบพัสดุที่ตรงกับเงื่อนไขการค้นหา</p>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            ระบบจัดเก็บรูปภาพพัสดุอัตโนมัติ วิทยาลัยการเมืองการปกครอง มมส.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>

      {/* Lightbox / Enlarged Preview Modal */}
      {previewEnlargeMaterial && (
        <div 
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setPreviewEnlargeMaterial(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-4 shadow-2xl border border-slate-700 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                  [{previewEnlargeMaterial.id}] {previewEnlargeMaterial.name}
                </h4>
                <p className="text-xs text-slate-500">
                  หมวดหมู่: {previewEnlargeMaterial.category} • คงเหลือ {previewEnlargeMaterial.currentStock} {previewEnlargeMaterial.unit}
                </p>
              </div>
              <button
                onClick={() => setPreviewEnlargeMaterial(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl p-2 min-h-[260px]">
              <img
                src={previewEnlargeMaterial.imageUrl}
                alt={previewEnlargeMaterial.name}
                className="max-h-[380px] w-auto max-w-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => {
                  const mat = previewEnlargeMaterial;
                  setPreviewEnlargeMaterial(null);
                  onOpenSingleImageModal(mat);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>เปลี่ยนรูปภาพนี้</span>
              </button>

              <button
                onClick={() => setPreviewEnlargeMaterial(null)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal for Removing Photo */}
      {photoToRemove && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  ยืนยันลบรูปภาพพัสดุ
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  คุณต้องการลบรูปภาพของพัสดุรหัส <strong className="font-mono text-slate-900 dark:text-white">{photoToRemove}</strong> ออกจากระบบใช่หรือไม่?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPhotoToRemove(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRemovePhoto(photoToRemove)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันลบรูปภาพ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
