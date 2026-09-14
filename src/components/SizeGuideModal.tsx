// src/components/SizeGuideModal.tsx
import React, { useState } from 'react';
import { X, Info } from 'lucide-react';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Gender = 'women' | 'men' | 'girls' | 'boys';
type Category = 'bottoms' | 'tops' | 'shoes' | 'belts';
type Unit = 'CM' | 'INCH';

const ACCENT = '#C44D2B';
const FONT = "'Helvetica Neue', Arial, sans-serif";

const TOP_SIZES = [
  { size: 'XXS', chest: 80, waist: 66, hip: 80 },
  { size: 'XS', chest: 86, waist: 72, hip: 86 },
  { size: 'S', chest: 92, waist: 78, hip: 92 },
  { size: 'M', chest: 98, waist: 84, hip: 98 },
  { size: 'L', chest: 104, waist: 90, hip: 104 },
  { size: 'XL', chest: 112, waist: 98, hip: 112 },
  { size: 'XXL', chest: 120, waist: 106, hip: 120 },
];

const BOTTOM_SIZES = [
  { size: '28', waist: 71, hip: 89, inseam: 78 },
  { size: '30', waist: 76, hip: 94, inseam: 79 },
  { size: '32', waist: 81, hip: 99, inseam: 80 },
  { size: '34', waist: 86, hip: 104, inseam: 81 },
  { size: '36', waist: 91, hip: 109, inseam: 82 },
];

const Segmented = <T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) => (
  <div className="inline-flex p-1 bg-gray-100 rounded-full">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`px-4 py-2 text-[11px] font-medium tracking-wide rounded-full transition-all duration-200 ${
          value === opt.value ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ isOpen, onClose }) => {
  const [gender, setGender] = useState<Gender>('men');
  const [category, setCategory] = useState<Category>('tops');
  const [unit, setUnit] = useState<Unit>('CM');

  if (!isOpen) return null;

  const toIn = (v: number) => Math.round((v / 2.54) * 10) / 10;
  const fmt = (v: number) => (unit === 'CM' ? `${v} cm` : `${toIn(v)}"`);
  const isTop = category === 'tops';

  return (
    <div
      className="fixed inset-x-0 top-0 h-[100dvh] z-[85] bg-black/40 backdrop-blur-sm flex items-end md:items-center md:justify-center"
      onClick={onClose}
      style={{ fontFamily: FONT }}
    >
      <div
        className="relative w-full md:max-w-xl bg-white rounded-t-[28px] md:rounded-2xl shadow-2xl max-h-[92vh] md:max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur px-6 pt-3 pb-5 flex items-start justify-between border-b border-gray-100">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400 mb-1">Notorious.Y2</p>
            <h2 className="text-2xl font-light tracking-tight">Size Guide</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close size guide"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-6 py-6 space-y-6">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Segmented
              value={gender}
              onChange={setGender}
              options={[
                { value: 'women', label: 'Women' },
                { value: 'men', label: 'Men' },
                { value: 'girls', label: 'Girls' },
                { value: 'boys', label: 'Boys' },
              ]}
            />
            <Segmented
              value={unit}
              onChange={setUnit}
              options={[{ value: 'CM', label: 'CM' }, { value: 'INCH', label: 'IN' }]}
            />
          </div>

          <Segmented
            value={category}
            onChange={setCategory}
            options={[
              { value: 'tops', label: 'Tops' },
              { value: 'bottoms', label: 'Bottoms' },
              { value: 'shoes', label: 'Shoes' },
              { value: 'belts', label: 'Belts' },
            ]}
          />

          {/* Body diagram */}
          <div className="flex justify-center py-4">
            <div className="relative w-[180px] h-[300px] opacity-[0.9]">
              <svg viewBox="0 0 180 300" className="w-full h-full">
                <ellipse cx="90" cy="30" rx="26" ry="30" fill="#f1f1f1" />
                <rect x="55" y="60" width="70" height="140" rx="30" fill="#f1f1f1" />
                <rect x="25" y="70" width="22" height="130" rx="11" fill="#f1f1f1" transform="rotate(6 36 135)" />
                <rect x="133" y="70" width="22" height="130" rx="11" fill="#f1f1f1" transform="rotate(-6 144 135)" />
                <rect x="60" y="195" width="26" height="95" rx="13" fill="#f1f1f1" />
                <rect x="94" y="195" width="26" height="95" rx="13" fill="#f1f1f1" />
                {(['Chest', 'Waist', 'Hip'] as const).map((label, i) => {
                  const y = 95 + i * 45;
                  return (
                    <g key={label}>
                      <line x1="20" y1={y} x2="160" y2={y} stroke={ACCENT} strokeWidth="1" strokeDasharray="3 3" />
                      <text x="90" y={y - 6} textAnchor="middle" fontSize="10" fill={ACCENT} fontWeight={600}>
                        {label.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Size cards */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-3">
              {category} size chart
            </p>
            <div className="space-y-2">
              {isTop
                ? TOP_SIZES.map(row => (
                    <div key={row.size} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span className="text-sm font-semibold w-12">{row.size}</span>
                      <div className="flex gap-6 text-xs text-gray-500">
                        <span>Chest {fmt(row.chest)}</span>
                        <span>Waist {fmt(row.waist)}</span>
                        <span>Hip {fmt(row.hip)}</span>
                      </div>
                    </div>
                  ))
                : BOTTOM_SIZES.map(row => (
                    <div key={row.size} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span className="text-sm font-semibold w-12">{row.size}</span>
                      <div className="flex gap-6 text-xs text-gray-500">
                        <span>Waist {fmt(row.waist)}</span>
                        <span>Hip {fmt(row.hip)}</span>
                        <span>Inseam {fmt(row.inseam)}</span>
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-gray-400 bg-gray-50 rounded-xl p-3">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>Measurements are body measurements, not garment measurements. If between sizes, size up for a relaxed streetwear fit.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SizeGuideModal;