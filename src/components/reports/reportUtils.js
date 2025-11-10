import { startOfDay, endOfDay, subDays } from 'date-fns';

const MAX_RANGE_DAYS = 180;
const DEFAULT_RANGE_DAYS = 7;

const parseRangeDays = (value) => {
  if (!value) {
    return DEFAULT_RANGE_DAYS;
  }

  if (value === 'all') {
    return null;
  }

  const match = value.match(/(\d+)/);
  if (!match) {
    return DEFAULT_RANGE_DAYS;
  }

  const parsed = parseInt(match[1], 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_RANGE_DAYS;
  }

  return Math.min(parsed, MAX_RANGE_DAYS);
};

export const resolveDateRange = (rangeKey) => {
  const days = parseRangeDays(rangeKey);

  if (!days) {
    return {
      mode: 'all',
      days: null,
      currentStart: null,
      currentEnd: null,
      previousStart: null,
      previousEnd: null,
      fetchStart: null
    };
  }

  const now = new Date();
  const currentEnd = endOfDay(now);
  const currentStart = startOfDay(subDays(currentEnd, days - 1));
  const previousEnd = startOfDay(subDays(currentStart, 1));
  const previousStart = startOfDay(subDays(previousEnd, days - 1));

  return {
    mode: 'range',
    days,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    fetchStart: previousStart
  };
};

const normaliseDate = (value) => {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (error) {
      // fall back below
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
};

export const normaliseSaleRecord = (raw) => {
  const timestamp = normaliseDate(raw.timestamp);
  const quantity = Number(raw.quantity ?? raw.totalQuantity ?? 0) || 0;
  const unitPrice = Number(raw.unitPrice ?? raw.pricePerUnit ?? raw.price ?? 0) || 0;
  const providedTotal = Number(raw.total ?? raw.totalAmount ?? raw.amount ?? 0) || 0;
  const calculatedTotal = quantity * unitPrice;
  const finalTotal = providedTotal > 0 ? providedTotal : calculatedTotal;
  const customerName = (raw.customer || raw.customerName || '').trim();

  return {
    id: raw.id || raw.saleId || null,
    productId: raw.productId || raw.productRef || null,
    productName: raw.productName || raw.name || raw.product || 'Unknown Product',
    customer: customerName || 'N/A',
    quantity,
    unitPrice,
    price: unitPrice,
    total: finalTotal,
    timestamp,
    raw
  };
};

export const normaliseProductRecord = (raw) => {
  const stockQuantity = Number(raw.stockQuantity ?? raw.currentStock ?? raw.quantity ?? 0) || 0;
  const minStock = Number(raw.minStock ?? 0) || 0;
  const maxStock = Number(raw.maxStock ?? stockQuantity) || stockQuantity;
  const price = Number(raw.price ?? 0) || 0;
  const status = raw.status || 'active';
  const createdAt = raw.createdAt ? normaliseDate(raw.createdAt) : null;
  const lastUpdated = raw.lastUpdated ? normaliseDate(raw.lastUpdated) : null;
  const imageUrl = raw.imageUrl || '';

  return {
    id: raw.id,
    name: raw.name || 'Unnamed Product',
    type: raw.type || 'UNSPECIFIED',
    price,
    stockQuantity,
    minStock,
    maxStock,
    unit: raw.unit || '',
    description: raw.description || '',
    status,
    createdAt,
    lastUpdated,
    imageUrl,
    raw
  };
};

const isWithinRange = (date, start, end) => {
  if (!start || !end) {
    return true;
  }
  return date >= start && date <= end;
};

export const splitSalesByRange = (sales, rangeInfo) => {
  if (rangeInfo.mode === 'all') {
    return {
      currentSales: [...sales],
      previousSales: []
    };
  }

  const currentSales = [];
  const previousSales = [];

  sales.forEach((sale) => {
    if (isWithinRange(sale.timestamp, rangeInfo.currentStart, rangeInfo.currentEnd)) {
      currentSales.push(sale);
      return;
    }
    if (isWithinRange(sale.timestamp, rangeInfo.previousStart, rangeInfo.previousEnd)) {
      previousSales.push(sale);
    }
  });

  return { currentSales, previousSales };
};

const sumBy = (items, selector) => {
  return items.reduce((total, item) => total + selector(item), 0);
};

const calculateTrend = (current, previous) => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
};

export const computeAnalytics = (sales, products, rangeInfo) => {
  const { currentSales, previousSales } = splitSalesByRange(sales, rangeInfo);

  const totalSales = currentSales.length;
  const totalRevenue = sumBy(currentSales, (sale) => sale.total);
  const totalQuantitySold = sumBy(currentSales, (sale) => sale.quantity);
  const highestSingleSale = currentSales.reduce((max, sale) => Math.max(max, sale.total), 0);

  const uniqueCustomers = new Set(
    currentSales
      .map((sale) => sale.customer)
      .filter((customer) => customer && customer !== 'Unknown' && customer !== 'N/A')
  ).size;

  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const averageQuantityPerSale = totalSales > 0 ? totalQuantitySold / totalSales : 0;

  const salesTrend = rangeInfo.mode === 'range'
    ? calculateTrend(totalSales, previousSales.length)
    : 0;

  const revenueTrend = rangeInfo.mode === 'range'
  ? calculateTrend(totalRevenue, sumBy(previousSales, (sale) => sale.total))
    : 0;

  const productIndexById = new Map();
  const productIndexByName = new Map();

  products.forEach((product) => {
    if (product.id) {
      productIndexById.set(product.id, product);
    }
    if (product.name) {
      productIndexByName.set(product.name.toLowerCase(), product);
    }
  });

  const productAggregation = new Map();

  currentSales.forEach((sale) => {
    const key = sale.productId || sale.productName.toLowerCase();
    if (!key) {
      return;
    }

    const entry = productAggregation.get(key) || {
      id: sale.productId || null,
      name: sale.productName,
      revenue: 0,
      quantity: 0,
      transactions: 0,
      lastUnitPrice: sale.unitPrice,
      lastSaleAt: sale.timestamp
    };

  entry.revenue += sale.total;
    entry.quantity += sale.quantity;
    entry.transactions += 1;
    entry.lastUnitPrice = sale.unitPrice;
    entry.lastSaleAt = sale.timestamp;

    productAggregation.set(key, entry);
  });

  const topProducts = Array.from(productAggregation.values())
    .map((entry) => {
      const relatedProduct = entry.id
        ? productIndexById.get(entry.id)
        : productIndexByName.get(entry.name.toLowerCase());

      return {
        ...entry,
        type: relatedProduct?.type || 'UNSPECIFIED',
        stockQuantity: relatedProduct?.stockQuantity ?? null,
        minStock: relatedProduct?.minStock ?? null,
        maxStock: relatedProduct?.maxStock ?? null,
        currentPrice: relatedProduct?.price ?? entry.lastUnitPrice
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const recentSales = currentSales
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map((sale) => ({
      id: sale.id,
      productName: sale.productName,
      customer: sale.customer,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      total: sale.total,
      timestamp: sale.timestamp
    }));

  const inventoryValue = sumBy(products, (product) => product.stockQuantity * product.price);
  const lowStockCount = products.filter((product) => product.stockQuantity <= product.minStock).length;

  return {
    totalSales,
    totalRevenue,
    totalCustomers: uniqueCustomers,
    avgOrderValue,
    salesTrend,
    revenueTrend,
    topProducts,
    recentSales,
    inventoryMetrics: {
      totalValue: inventoryValue,
      lowStockCount,
      productCount: products.length
    },
    salesMetrics: {
      averageQuantityPerSale,
      highestSingleSale,
      totalQuantitySold
    },
    period: rangeInfo,
    currentSales,
    previousSales,
    generatedAt: new Date()
  };
};
