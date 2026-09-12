import React from 'react';
import { X } from 'lucide-react';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOP_SIZES = [
  { size: 'SMALL', chest: '96-101cm', length: '68cm' },
  { size: 'MEDIUM', chest: '102-107cm', length: '70cm' },
  { size: 'LARGE', chest: '108-113cm', length: '72cm' },
];

const BOTTOM_SIZES = [
  { size: '28', waist: '71cm', inseam: '78cm' },
  { size: '30', waist: '76cm', inseam: '79cm' },
  { size: '32', waist: '81cm', inseam: '80cm' },
  { size: '34', waist: '86cm', inseam: '81cm' },
  { size: '36', waist: '91cm', inseam: '82cm' },
];

const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[85] flex items-center justify-center p-4 transition-opacity duration-300" 
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl border border-gray-100 transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur flex items-center justify-between px-6 py-5 border-b border-gray-100 z-10">
          <div>
            <h2 className="text-base font-semibold tracking-wider uppercase text-gray-900">Size Guide</h2>
            <p className="text-xs text-gray-500 mt-0.5">All measurements are provided in centimeters (cm)</p>
          </div>
          <button 
            onClick={onClose} 
            aria-label="Close size guide"
            className="p-2 text-gray-400 hover:text-black rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-8">
          {/* Tops Section */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-gray-900 mb-3 uppercase">Tops & Outerwear</h3>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-medium">
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Chest</th>
                    <th className="px-4 py-3">Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {TOP_SIZES.map(row => (
                    <tr key={row.size} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{row.size}</td>
                      <td className="px-4 py-3">{row.chest}</td>
                      <td className="px-4 py-3">{row.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottoms Section */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-gray-900 mb-3 uppercase">Bottoms & Pants</h3>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-medium">
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Waist</th>
                    <th className="px-4 py-3">Inseam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {BOTTOM_SIZES.map(row => (
                    <tr key={row.size} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{row.size}</td>
                      <td className="px-4 py-3">{row.waist}</td>
                      <td className="px-4 py-3">{row.inseam}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SizeGuideModal;