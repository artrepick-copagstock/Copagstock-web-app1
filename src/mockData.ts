import { Material, Order, StockIn, StockOut } from './types';

import { RAW_MATERIALS_367 } from './materials367Data';

export const INITIAL_MATERIALS: Material[] = RAW_MATERIALS_367;

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_STOCK_IN: StockIn[] = [];

export const INITIAL_STOCK_OUT: StockOut[] = [];

export const COPAG_DEPARTMENTS = [
  'สาขาวิชารัฐศาสตร์',
  'สาขาวิชารัฐประศาสนศาสตร์',
  'สาขาวิชาความสัมพันธ์ระหว่างประเทศ',
  'สำนักงานคณบดี (งานบริหารทั่วไป)',
  'กลุ่มงานการเงินและพัสดุ',
  'กลุ่มงานบริการการศึกษาและพัฒนาคุณภาพนิสิต',
  'กลุ่มงานนโยบาย แผน และประกันคุณภาพการศึกษา',
  'ศูนย์วิจัยและพัฒนาการเมืองท้องถิ่น'
];

export const MATERIAL_CATEGORIES = [
  'ทั้งหมด',
  'วัสดุสำนักงาน',
  'วัสดุคอมพิวเตอร์',
  'วัสดุงานบ้านและงานครัว',
  'วัสดุไฟฟ้าและวิทยุ',
  'วัสดุการศึกษา',
  'วัสดุก่อสร้าง',
  'วัสดุวิทยาศาสตร์หรือการแพทย์',
  'วัสดุการเกษตร',
  'วัสดุโฆษณาและเผยแพร่'
];
