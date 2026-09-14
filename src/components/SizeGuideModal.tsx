import React, { useState } from 'react';
import { X, Info } from 'lucide-react';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Gender = 'women' | 'men' | 'girls' | 'boys';
type Category = 'bottoms' | 'tops' | 'shoes' | 'belts';
type Unit = 'CM' | 'INCH';

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

const SizeGuideModal: React.FC<SizeGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [gender, setGender] = useState<Gender>('men');
  const [category, setCategory] = useState<Category>('tops');
  const [unit, setUnit] = useState<Unit>('CM');

  if (!isOpen) return null;

  const convertMeasurement = (value: number) => {
    if (unit === 'CM') return value;

    // centimetres → inches
    return Math.round((value / 2.54) * 10) / 10;
  };

  const formatMeasurement = (value: number) => {
    const converted = convertMeasurement(value);

    return unit === 'CM'
      ? `${converted} cm`
      : `${converted}"`;
  };

  const isTop = category === 'tops';

  return (
    <div
      className="fixed inset-0 z-[85] bg-white md:bg-black/70 md:backdrop-blur-sm md:flex md:items-center md:justify-center"
      onClick={onClose}
    >
      <div
        className="
          relative
          w-full
          h-full
          md:h-auto
          md:max-h-[92vh]
          md:max-w-2xl
          bg-white
          overflow-y-auto
          md:rounded-2xl
          md:shadow-2xl
          overscroll-contain
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================
            HEADER
        ========================================================= */}
        <header className="sticky top-0 z-30 h-[64px] bg-white border-b border-gray-100 flex items-center justify-center">
          <h2 className="text-[24px] leading-none font-bold lowercase tracking-tight text-black">
            size guide
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            className="
              absolute
              right-0
              top-0
              h-[64px]
              w-[58px]
              bg-black
              text-white
              flex
              items-center
              justify-center
              transition-colors
              hover:bg-gray-800
              active:bg-gray-900
            "
          >
            <X size={24} strokeWidth={1.8} />
          </button>
        </header>

        {/* =========================================================
            CONTENT
        ========================================================= */}
        <main className="pb-12">
          {/* =====================================================
              STEP 1 — GENDER
          ===================================================== */}
          <section className="border-b border-gray-100 px-5 py-5">
            <div className="flex items-start gap-5">
              <span className="w-5 shrink-0 text-[12px] font-bold text-black">
                1
              </span>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold lowercase text-gray-900">
                    gender:{' '}
                    <span className="font-bold">
                      {gender}
                    </span>
                  </h3>

                  <span className="text-gray-400 text-[16px]">
                    −
                  </span>
                </div>

                <div className="mt-5 flex flex-col items-center gap-4">
                  {(
                    [
                      ['women', 'Women'],
                      ['men', 'Men'],
                      ['girls', 'Girls'],
                      ['boys', 'Boys'],
                    ] as [Gender, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      className={`
                        text-[13px]
                        leading-none
                        transition-all
                        ${
                          gender === value
                            ? 'font-bold text-black underline underline-offset-4'
                            : 'font-normal text-gray-300 hover:text-gray-600'
                        }
                      `}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================
              STEP 2 — CATEGORY
          ===================================================== */}
          <section className="border-b border-gray-100 px-5 py-5">
            <div className="flex items-start gap-5">
              <span className="w-5 shrink-0 text-[12px] font-bold text-black">
                2
              </span>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold lowercase text-gray-900">
                    category:{' '}
                    <span className="font-bold">
                      {category}
                    </span>
                  </h3>

                  <span className="text-gray-400 text-[16px]">
                    −
                  </span>
                </div>

                <div className="mt-5 flex flex-col items-center gap-4">
                  {(
                    [
                      ['bottoms', 'Bottoms / Jeans'],
                      ['tops', 'Tops'],
                      ['shoes', 'Shoes'],
                      ['belts', 'Belts'],
                    ] as [Category, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategory(value)}
                      className={`
                        text-[13px]
                        leading-none
                        transition-all
                        ${
                          category === value
                            ? 'font-bold text-black underline underline-offset-4'
                            : 'font-normal text-gray-300 hover:text-gray-600'
                        }
                      `}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================
              STEP 3 — SIZE
          ===================================================== */}
          <section className="px-5 pt-5">
            <div className="flex items-start gap-5">
              <span className="w-5 shrink-0 text-[12px] font-bold text-black">
                3
              </span>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold lowercase text-gray-900">
                    your size
                  </h3>

                  <span className="text-gray-400 text-[16px]">
                    −
                  </span>
                </div>

                <button
                  type="button"
                  className="mt-4 text-[13px] font-bold text-black underline underline-offset-4"
                >
                  s, m, l, ...
                </button>

                {/* =================================================
                    SIZE SELECTOR
                ================================================= */}
                <div className="mt-6 grid grid-cols-3 gap-x-5 gap-y-3 max-w-[245px]">
                  {isTop
                    ? TOP_SIZES.map((item) => (
                        <button
                          key={item.size}
                          type="button"
                          className="flex items-center gap-2 text-left group"
                        >
                          <span className="h-[22px] w-[22px] bg-gray-200 group-hover:bg-gray-300 transition-colors" />

                          <span className="text-[12px] font-bold text-gray-700">
                            {item.size}
                          </span>
                        </button>
                      ))
                    : BOTTOM_SIZES.map((item) => (
                        <button
                          key={item.size}
                          type="button"
                          className="flex items-center gap-2 text-left group"
                        >
                          <span className="h-[22px] w-[22px] bg-gray-200 group-hover:bg-gray-300 transition-colors" />

                          <span className="text-[12px] font-bold text-gray-700">
                            {item.size}
                          </span>
                        </button>
                      ))}
                </div>
              </div>
            </div>

            {/* =====================================================
                BODY MEASUREMENT GUIDE
            ===================================================== */}
            <div className="mt-8 flex justify-center">
              <div className="relative w-[240px] h-[440px]">
                {/* Body silhouette */}
                <div className="absolute inset-x-0 top-0 flex justify-center">
                  <div className="relative w-[170px] h-[430px] opacity-[0.11]">
                    {/* Head */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[52px] h-[65px] rounded-[45%] bg-gray-400" />

                    {/* Neck */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-[55px] w-[35px] h-[35px] bg-gray-400" />

                    {/* Torso */}
                    <div
                      className="
                        absolute
                        left-1/2
                        -translate-x-1/2
                        top-[78px]
                        w-[105px]
                        h-[205px]
                        bg-gray-400
                        rounded-t-[48px]
                        rounded-b-[22px]
                      "
                    />

                    {/* Left arm */}
                    <div
                      className="
                        absolute
                        left-[15px]
                        top-[92px]
                        w-[38px]
                        h-[230px]
                        bg-gray-400
                        rounded-[25px]
                        rotate-[8deg]
                      "
                    />

                    {/* Right arm */}
                    <div
                      className="
                        absolute
                        right-[15px]
                        top-[92px]
                        w-[38px]
                        h-[230px]
                        bg-gray-400
                        rounded-[25px]
                        -rotate-[8deg]
                      "
                    />

                    {/* Left leg */}
                    <div
                      className="
                        absolute
                        left-[45px]
                        top-[260px]
                        w-[45px]
                        h-[170px]
                        bg-gray-400
                        rounded-b-[20px]
                      "
                    />

                    {/* Right leg */}
                    <div
                      className="
                        absolute
                        right-[45px]
                        top-[260px]
                        w-[45px]
                        h-[170px]
                        bg-gray-400
                        rounded-b-[20px]
                      "
                    />
                  </div>
                </div>

                {/* Chest measurement */}
                <div className="absolute top-[135px] left-[20px] right-[20px]">
                  <div className="h-px bg-gray-300" />

                  <div className="absolute left-1/2 -translate-x-1/2 -top-[9px] flex items-center gap-2 bg-white px-2">
                    <span className="w-[15px] h-[15px] rounded-full bg-black text-white flex items-center justify-center">
                      <Info size={9} />
                    </span>

                    <span className="text-[11px] font-bold text-gray-700">
                      chest
                    </span>
                  </div>
                </div>

                {/* Waist measurement */}
                <div className="absolute top-[225px] left-[20px] right-[20px]">
                  <div className="h-px bg-gray-300" />

                  <div className="absolute left-1/2 -translate-x-1/2 -top-[9px] flex items-center gap-2 bg-white px-2">
                    <span className="w-[15px] h-[15px] rounded-full bg-black text-white flex items-center justify-center">
                      <Info size={9} />
                    </span>

                    <span className="text-[11px] font-bold text-gray-700">
                      waist
                    </span>
                  </div>
                </div>

                {/* Hip measurement */}
                <div className="absolute top-[280px] left-[20px] right-[20px]">
                  <div className="h-px bg-gray-300" />

                  <div className="absolute left-1/2 -translate-x-1/2 -top-[9px] flex items-center gap-2 bg-white px-2">
                    <span className="w-[15px] h-[15px] rounded-full bg-black text-white flex items-center justify-center">
                      <Info size={9} />
                    </span>

                    <span className="text-[11px] font-bold text-gray-700">
                      hip
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* =====================================================
                UNIT SWITCH
            ===================================================== */}
            <div className="flex justify-center mt-2">
              <div className="inline-flex border border-gray-200">
                <button
                  type="button"
                  onClick={() => setUnit('CM')}
                  className={`
                    px-5
                    py-2.5
                    text-[11px]
                    font-bold
                    tracking-wide
                    transition-colors
                    ${
                      unit === 'CM'
                        ? 'bg-white text-black'
                        : 'bg-gray-200 text-white'
                    }
                  `}
                >
                  CM
                </button>

                <button
                  type="button"
                  onClick={() => setUnit('INCH')}
                  className={`
                    px-5
                    py-2.5
                    text-[11px]
                    font-bold
                    tracking-wide
                    transition-colors
                    ${
                      unit === 'INCH'
                        ? 'bg-white text-black'
                        : 'bg-gray-200 text-white'
                    }
                  `}
                >
                  INCH
                </button>
              </div>
            </div>
          </section>

          {/* =====================================================
              SIZE TABLE
          ===================================================== */}
          <section className="mt-8 bg-gray-50 px-5 pt-6 pb-10">
            <h2 className="text-[28px] leading-none font-bold lowercase text-black text-center mb-8">
              size table
            </h2>

            {isTop ? (
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="pb-4 pr-3 text-[10px] font-bold text-gray-700">
                        size
                      </th>

                      <th className="pb-4 px-2 text-[10px] font-bold text-gray-700">
                        chest
                      </th>

                      <th className="pb-4 px-2 text-[10px] font-bold text-gray-700">
                        waist
                      </th>

                      <th className="pb-4 pl-2 text-[10px] font-bold text-gray-700">
                        hip
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {TOP_SIZES.map((row) => (
                      <tr key={row.size}>
                        <td className="py-2.5 pr-3 align-top">
                          <span className="text-[11px] font-bold text-gray-800">
                            {row.size}
                          </span>
                        </td>

                        <td className="py-2.5 px-2 align-top">
                          <span className="block text-[11px] text-gray-400 leading-4">
                            {formatMeasurement(row.chest)}
                          </span>
                        </td>

                        <td className="py-2.5 px-2 align-top">
                          <span className="block text-[11px] text-gray-400 leading-4">
                            {formatMeasurement(row.waist)}
                          </span>
                        </td>

                        <td className="py-2.5 pl-2 align-top">
                          <span className="block text-[11px] text-gray-400 leading-4">
                            {formatMeasurement(row.hip)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="pb-4 pr-3 text-[10px] font-bold text-gray-700">
                        size
                      </th>

                      <th className="pb-4 px-2 text-[10px] font-bold text-gray-700">
                        waist
                      </th>

                      <th className="pb-4 px-2 text-[10px] font-bold text-gray-700">
                        hip
                      </th>

                      <th className="pb-4 pl-2 text-[10px] font-bold text-gray-700">
                        inseam
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {BOTTOM_SIZES.map((row) => (
                      <tr key={row.size}>
                        <td className="py-2.5 pr-3">
                          <span className="text-[11px] font-bold text-gray-800">
                            {row.size}
                          </span>
                        </td>

                        <td className="py-2.5 px-2">
                          <span className="text-[11px] text-gray-400">
                            {formatMeasurement(row.waist)}
                          </span>
                        </td>

                        <td className="py-2.5 px-2">
                          <span className="text-[11px] text-gray-400">
                            {formatMeasurement(row.hip)}
                          </span>
                        </td>

                        <td className="py-2.5 pl-2">
                          <span className="text-[11px] text-gray-400">
                            {formatMeasurement(row.inseam)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default SizeGuideModal;