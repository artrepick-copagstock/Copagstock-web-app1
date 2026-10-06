import { Material } from '../types';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * 1. Standard Category Codes according to COPAG MSU specifications:
 * 1 = วัสดุสำนักงาน
 * 2 = วัสดุการศึกษา
 * 3 = วัสดุคอมพิวเตอร์
 * 4 = วัสดุงานบ้านและงานครัว
 * 5 = วัสดุวิทยาศาสตร์หรือการแพทย์
 * 6 = วัสดุการเกษตร
 * 7 = วัสดุไฟฟ้าและวิทยุ
 * 8 = วัสดุก่อสร้าง
 * 9 = วัสดุโฆษณาและเผยแพร่
 */
export const STANDARD_CATEGORY_CODES: Record<string, number> = {
  'วัสดุสำนักงาน': 1,
  'วัสดุการศึกษา': 2,
  'วัสดุคอมพิวเตอร์': 3,
  'วัสดุงานบ้านและงานครัว': 4,
  'วัสดุวิทยาศาสตร์หรือการแพทย์': 5,
  'วัสดุการเกษตร': 6,
  'วัสดุไฟฟ้าและวิทยุ': 7,
  'วัสดุก่อสร้าง': 8,
  'วัสดุโฆษณาและเผยแพร่': 9
};

const CUSTOM_CATEGORIES_KEY = 'copag_custom_categories_v1';

/**
 * Get all custom categories saved by user
 */
export function getStoredCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(c => typeof c === 'string' && c.trim().length > 0);
      }
    }
  } catch {}
  return [];
}

/**
 * Save a new custom category (persisted to LocalStorage and Firestore earnest-region-mz37z)
 */
export function saveCustomCategory(categoryName: string): void {
  const trimmed = categoryName.trim();
  if (!trimmed || STANDARD_CATEGORY_CODES[trimmed]) return;
  const current = getStoredCustomCategories();
  if (!current.includes(trimmed)) {
    current.push(trimmed);
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(current));
  }
  if (db) {
    try {
      setDoc(doc(db, 'settings', 'categories'), {
        customCategories: current,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.warn('Firestore custom categories sync notice:', err);
      });
    } catch {}
  }
}

/**
 * Sync custom categories from Firestore
 */
export async function syncCustomCategoriesFromFirestore(): Promise<string[]> {
  const current = getStoredCustomCategories();
  if (!db) return current;
  try {
    const snap = await getDoc(doc(db, 'settings', 'categories'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.customCategories)) {
        const merged = Array.from(new Set<string>([...current, ...data.customCategories.filter(Boolean)]));
        localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (e) {
    console.warn('Sync custom categories notice:', e);
  }
  return current;
}

/**
 * Get dynamic category map including standard 1-9 and any custom categories starting from 10 onwards
 */
export function getAllCategoryCodeMap(existingMaterials: Material[] = []): Map<string, number> {
  const map = new Map<string, number>();

  // 1. Standard 1-9
  Object.entries(STANDARD_CATEGORY_CODES).forEach(([cat, code]) => {
    map.set(cat, code);
  });

  // 2. Discover custom categories from stored list and materials
  let nextCode = 10;
  const storedCustom = getStoredCustomCategories();
  storedCustom.forEach(cat => {
    if (!map.has(cat)) {
      map.set(cat, nextCode++);
    }
  });

  // Also check materials for any other categories
  existingMaterials.forEach(m => {
    const cat = (m.category || '').trim();
    if (cat && !map.has(cat) && !isDeprecatedCategory(cat)) {
      map.set(cat, nextCode++);
    }
  });

  return map;
}

function isDeprecatedCategory(cat: string): boolean {
  return [
    'ผลิตภัณฑ์ทำความสะอาด',
    'แฟ้มและอุปกรณ์จัดเก็บ',
    'เครื่องเขียน',
    'กระดาษและสิ่งพิมพ์'
  ].includes(cat);
}

/**
 * 2. Extract initial Thai consonant or English letter:
 * Handles leading vowels in Thai (เ, แ, โ, ใ, ไ) by skipping them to the actual consonant.
 * Example:
 * - "กบเหลาดินสอ" -> "ก"
 * - "เทป 2 หน้า" -> "ท"
 * - "แฟ้มแขวน" -> "ฟ"
 * - "ปากกา" -> "ป"
 */
export function extractInitialThaiChar(name: string): string {
  if (!name || !name.trim()) return 'ก';
  const clean = name.trim();

  const leadingVowels = new Set(['เ', 'แ', 'โ', 'ใ', 'ไ']);

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (leadingVowels.has(char)) {
      const nextChar = clean[i + 1];
      if (nextChar && isThaiConsonant(nextChar)) {
        return nextChar;
      }
    } else if (isThaiConsonant(char)) {
      return char;
    } else if (/[a-zA-Z]/.test(char)) {
      return char.toUpperCase();
    }
  }

  // Fallback to first non-space character
  return clean[0] || 'ก';
}

function isThaiConsonant(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0e01 && code <= 0x0e2e; // ก - ฮ
}

/**
 * 3. Generate automatic Material ID:
 * Format: {CategoryCode}{InitialChar}{Sequence2Digits}
 * e.g. 1ก01, 1ก19, 3ค04
 */
export function generateNextMaterialId(
  categoryName: string,
  materialName: string,
  materials: Material[]
): {
  id: string;
  categoryCode: number;
  initialChar: string;
  sequence: number;
  prefix: string;
} {
  const codeMap = getAllCategoryCodeMap(materials);
  const trimmedCat = categoryName.trim();
  let categoryCode = codeMap.get(trimmedCat);
  if (!categoryCode) {
    let max = 9;
    codeMap.forEach(code => {
      if (code > max) max = code;
    });
    categoryCode = max + 1;
  }
  const initialChar = extractInitialThaiChar(materialName);

  const prefix = `${categoryCode}${initialChar}`;
  const prefixRegex = new RegExp(`^${categoryCode}${initialChar}(\\d+)$`);

  let maxSeq = 0;
  materials.forEach(m => {
    if (!m.id) return;
    const match = m.id.trim().match(prefixRegex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(2, '0');
  const generatedId = `${prefix}${seqStr}`;

  return {
    id: generatedId,
    categoryCode,
    initialChar,
    sequence: nextSeq,
    prefix
  };
}
