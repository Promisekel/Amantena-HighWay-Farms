import feedImage from '../../Placeholders/feed.jpeg';
import pureShellsImage from '../../Placeholders/Pure Shells.jpg';
import maizeImage from '../../Placeholders/Maize (Ungrinded).jpg';
import pkcCopraImage from '../../Placeholders/PKC_Copra.avif';
import wheatBranImage from '../../Placeholders/Wheat Bran (25 kg).jpeg';
import riceBranImage from '../../Placeholders/Rice Bran (50 kg).webp';
import meatBoneImage from '../../Placeholders/Meat & Bone (60% Protein).png';
import farmwaySoyaImage from '../../Placeholders/Farmway Soya.jpg';
import eggCrateImage from '../../Placeholders/Egg Crate (Small, Medium, Large).jpeg';
import additechConcentrateImage from '../../Placeholders/Additech Layer Concentrate.png';
import champrixConcentrateImage from '../../Placeholders/Champrix Concentrate (Layer 5%, Intraco Layer 5%).jpg';
import koudjisProductsImage from '../../Placeholders/Koudjis Products.webp';
import layerConcentrateImage from '../../Placeholders/Layer Concentrate (KLC 5%, KLC 25%).png';
import broilerConcentrateImage from '../../Placeholders/Broiler Concentrate (All Variants).jpg';
import fishMealImage from '../../Placeholders/Fish Meal (Local “One Man Thousand”).png';

const defaultPlaceholder = feedImage;

export const productCatalog = [
  {
    value: 'PURE_SHELLS',
    label: 'Pure Shells',
    placeholder: pureShellsImage,
    variants: [
      { value: 'Pure Shells', label: 'Pure Shells' }
    ]
  },
  {
    value: 'MAIZE',
    label: 'Maize',
    placeholder: maizeImage,
    variants: [
      { value: 'Maize Ungrinded', label: 'Maize Ungrinded' }
    ]
  },
  {
    value: 'PKC_COPRA',
    label: 'PKC / Copra',
    placeholder: pkcCopraImage,
    variants: [
      { value: 'PKC / Copra', label: 'PKC / Copra' }
    ]
  },
  {
    value: 'WHEAT_BRAN',
    label: 'Wheat Bran',
    placeholder: wheatBranImage,
    variants: [
      { value: 'Wheat Bran', label: 'Wheat Bran', size: '25 kg' }
    ]
  },
  {
    value: 'RICE_BRAN',
    label: 'Rice Bran',
    placeholder: riceBranImage,
    variants: [
      { value: 'Rice Bran', label: 'Rice Bran', size: '50 kg' }
    ]
  },
  {
    value: 'MEAT_AND_BONE',
    label: 'Meat & Bone',
    placeholder: meatBoneImage,
    variants: [
      { value: 'Meat & Bone', label: 'Meat & Bone', size: '60% Protein' }
    ]
  },
  {
    value: 'SOYA',
    label: 'Soya',
    placeholder: farmwaySoyaImage,
    variants: [
      { value: 'Farmway Soya', label: 'Farmway Soya' },
      { value: 'Sonal Soya (Foreign)', label: 'Sonal Soya (Foreign)' }
    ]
  },
  {
    value: 'EGG_CRATE',
    label: 'Egg Crate',
    placeholder: eggCrateImage,
    variants: [
      { value: 'Egg Crate - Small', label: 'Egg Crate - Small' },
      { value: 'Egg Crate - Medium', label: 'Egg Crate - Medium' },
      { value: 'Egg Crate - Large', label: 'Egg Crate - Large' }
    ]
  },
  {
    value: 'CONCENTRATE',
    label: 'Concentrate',
    placeholder: additechConcentrateImage,
    variants: [
      { value: 'Additech Layer Concentrate', label: 'Additech Layer Concentrate' }
    ]
  },
  {
    value: 'CHAMPRIX_CONCENTRATE',
    label: 'Champrix Concentrate',
    placeholder: champrixConcentrateImage,
    variants: [
      { value: 'Champrix Layer 5%', label: 'Layer 5%' },
      { value: 'Champrix Intraco Layer 5%', label: 'Intraco Layer 5%' }
    ]
  },
  {
    value: 'KOUDJIS_PRODUCTS',
    label: 'Koudjis Products',
    placeholder: koudjisProductsImage,
    variants: [
    { value: 'Broiler Starter KBSC 35%', label: 'Starter KBSC 35%' },
      { value: 'Broiler KBC', label: 'KBC' },
      { value: 'Magic Feed (Galdus)', label: 'Magic Feed (Galdus)', size: '25 kg' },
      { value: 'Romelko (Piglet Feed)', label: 'Romelko (Piglet Feed)' },
      { value: 'All Purpose Pig Feed', label: 'All Purpose Pig Feed' },
      { value: 'Pig Grow-Finisher Concentrate', label: 'Pig Grow-Finisher Concentrate', size: '30%' },
      { value: 'Pig Sow Concentrate', label: 'Pig Sow Concentrate' }
    ]
  },
  {
    value: 'LAYER_CONCENTRATE',
    label: 'Layer Concentrate',
    placeholder: layerConcentrateImage,
    variants: [
      { value: 'Layer KLC 5%', label: 'Layer KLC 5%', size: '50 kg' },
      { value: 'Layer KLC 25%', label: 'Layer KLC 25%' }
    ]
  },
  {
    value: 'BROILER_CONCENTRATE',
    label: 'Broiler Concentrate',
    placeholder: broilerConcentrateImage,
    variants: [
      { value: 'Broiler Starter KBSC 35%', label: 'Starter KBSC 35%' },
      { value: 'Broiler KBC', label: 'KBC' },
      { value: 'Magic Feed (Galdus)', label: 'Magic Feed (Galdus)', size: '25 kg' },
      { value: 'Romelko (Piglet Feed)', label: 'Romelko (Piglet Feed)' },
      { value: 'All Purpose Pig Feed', label: 'All Purpose Pig Feed' },
      { value: 'Pig Grow-Finisher Concentrate', label: 'Pig Grow-Finisher Concentrate', size: '30%' },
      { value: 'Pig Sow Concentrate', label: 'Pig Sow Concentrate' }
    ]
  },
  {
    value: 'FISH_MEAL',
    label: 'Fish Meal',
    placeholder: fishMealImage,
    variants: [
      { value: 'Local "One Man Thousand"', label: 'Local "One Man Thousand"' }
    ]
  }
];

export const productTypePlaceholders = productCatalog.reduce((acc, item) => {
  acc[item.value] = item.placeholder || defaultPlaceholder;
  return acc;
}, {});

export const productTypes = productCatalog.map(({ value, label }) => ({ value, label }));

export const productVariantsByType = productCatalog.reduce((acc, item) => {
  acc[item.value] = item.variants;
  return acc;
}, {});

const startCase = (value = '') => {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (match) => match.toUpperCase());
};

export const getProductTypeLabel = (value) => {
  const record = productCatalog.find((item) => item.value === value);
  if (record) {
    return record.label;
  }
  return startCase(value);
};

export const getProductTypeStyles = (value) => {
  const label = getProductTypeLabel(value) || '';
  const normalised = label.toLowerCase();

  if (normalised.includes('concentrate')) {
    return { badgeClass: 'bg-blue-100 text-blue-800' };
  }
  if (normalised.includes('egg')) {
    return { badgeClass: 'bg-amber-100 text-amber-800' };
  }
  if (normalised.includes('fish')) {
    return { badgeClass: 'bg-indigo-100 text-indigo-800' };
  }
  if (normalised.includes('soya')) {
    return { badgeClass: 'bg-purple-100 text-purple-800' };
  }
  return { badgeClass: 'bg-emerald-100 text-emerald-700' };
};

export const getProductVariantMeta = (typeValue, variantValue) => {
  const variants = productVariantsByType[typeValue] || [];
  return variants.find((variant) => variant.value === variantValue);
};

export const getProductTypePlaceholder = (value) => {
  return productTypePlaceholders[value] || defaultPlaceholder;
};
