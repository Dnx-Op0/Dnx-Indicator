export type DividendCompany = {
  name: string;
  symbol: string;
  exchangeSymbol?: string;
  sourceExchange?: "NSE" | "BSE";
  sourceUpdatedAt?: string;
  sourceUrl?: string;
  sourceDescription?: string;
  yieldAsOf?: string;
  yieldPeriodStart?: string;
  yieldPriceExchange?: "NSE" | "BSE";
  sector: string;
  marketCap: number | null;
  yield: number | null;
  dividend: number | null;
  type: "Interim" | "Final" | "Special" | "Dividend";
  announcement: string;
  exDate: string;
  recordDate: string;
  paymentDate: string;
  payout: number | null;
  manualUpdateAt?: string;
  manualSourceUrl?: string;
};

export const companies: DividendCompany[] = [
  { name: "Coal India", symbol: "COALINDIA", sector: "Energy", marketCap: 289400, yield: 6.84, dividend: 15.25, type: "Interim", announcement: "12 Nov 2026", exDate: "27 Nov 2026", recordDate: "28 Nov 2026", paymentDate: "18 Dec 2026", payout: 46 },
  { name: "Power Finance Corporation", symbol: "PFC", sector: "Financials", marketCap: 142600, yield: 4.12, dividend: 12.35, type: "Interim", announcement: "10 Nov 2026", exDate: "25 Nov 2026", recordDate: "26 Nov 2026", paymentDate: "16 Dec 2026", payout: 31 },
  { name: "Indian Oil Corporation", symbol: "IOC", sector: "Energy", marketCap: 205300, yield: 3.92, dividend: 7.00, type: "Interim", announcement: "08 Nov 2026", exDate: "24 Nov 2026", recordDate: "25 Nov 2026", paymentDate: "14 Dec 2026", payout: 33 },
  { name: "Hindustan Zinc", symbol: "HINDZINC", sector: "Materials", marketCap: 196800, yield: 5.18, dividend: 10.00, type: "Special", announcement: "05 Nov 2026", exDate: "21 Nov 2026", recordDate: "22 Nov 2026", paymentDate: "12 Dec 2026", payout: 72 },
  { name: "ITC", symbol: "ITC", sector: "Consumer", marketCap: 538200, yield: 3.25, dividend: 7.50, type: "Final", announcement: "02 Nov 2026", exDate: "19 Nov 2026", recordDate: "20 Nov 2026", paymentDate: "10 Dec 2026", payout: 82 },
  { name: "Infosys", symbol: "INFY", sector: "Technology", marketCap: 780400, yield: 2.48, dividend: 21.00, type: "Interim", announcement: "30 Oct 2026", exDate: "17 Nov 2026", recordDate: "18 Nov 2026", paymentDate: "08 Dec 2026", payout: 59 },
  { name: "ONGC", symbol: "ONGC", sector: "Energy", marketCap: 319500, yield: 4.52, dividend: 6.00, type: "Interim", announcement: "28 Oct 2026", exDate: "14 Nov 2026", recordDate: "15 Nov 2026", paymentDate: "05 Dec 2026", payout: 39 },
  { name: "HDFC Bank", symbol: "HDFCBANK", sector: "Financials", marketCap: 1325000, yield: 1.18, dividend: 22.00, type: "Final", announcement: "24 Oct 2026", exDate: "11 Nov 2026", recordDate: "12 Nov 2026", paymentDate: "02 Dec 2026", payout: 21 },
  { name: "Tata Consultancy Services", symbol: "TCS", sector: "Technology", marketCap: 1432000, yield: 2.05, dividend: 30.00, type: "Interim", announcement: "21 Oct 2026", exDate: "08 Nov 2026", recordDate: "09 Nov 2026", paymentDate: "29 Nov 2026", payout: 68 },
  { name: "Bajaj Auto", symbol: "BAJAJ-AUTO", sector: "Automotive", marketCap: 284700, yield: 2.78, dividend: 80.00, type: "Final", announcement: "18 Oct 2026", exDate: "05 Nov 2026", recordDate: "06 Nov 2026", paymentDate: "26 Nov 2026", payout: 59 },
  { name: "REC Limited", symbol: "RECLTD", sector: "Financials", marketCap: 118900, yield: 4.66, dividend: 8.50, type: "Interim", announcement: "15 Oct 2026", exDate: "02 Nov 2026", recordDate: "03 Nov 2026", paymentDate: "23 Nov 2026", payout: 30 },
  { name: "Vedanta", symbol: "VEDL", sector: "Materials", marketCap: 164300, yield: 7.12, dividend: 11.00, type: "Special", announcement: "12 Oct 2026", exDate: "30 Oct 2026", recordDate: "31 Oct 2026", paymentDate: "20 Nov 2026", payout: 88 },
];

export const marketIndices = [
  { name: "NIFTY 50", value: "24,812.35", change: "+0.68%", up: true, points: [22, 26, 24, 35, 29, 42, 38, 48, 41, 58, 52, 66] },
  { name: "SENSEX", value: "81,506.72", change: "+0.54%", up: true, points: [25, 30, 27, 38, 34, 45, 40, 50, 44, 60, 55, 67] },
  { name: "NIFTY BANK", value: "52,184.90", change: "-0.21%", up: false, points: [61, 58, 64, 51, 56, 44, 49, 40, 45, 36, 40, 32] },
];

export const dashboardStats = {
  upcomingDividends: "28",
  exDatesToday: "03",
  exDatesThisWeek: "11",
  highestDividend: "₹80.00",
  highestYield: "7.12%",
};

export const reportTotals = {
  annualIncome: "₹72,400",
  monthlyAverage: "₹6,033",
  incomeSources: "12",
  energyShare: "32%",
  previousIncome: "₹65,400",
  olderIncome: "₹58,000",
  highestMonth: "May · ₹5,800",
};

export const dividendHistory = [
  { year: "2019", income: 24 }, { year: "2020", income: 32 }, { year: "2021", income: 28 },
  { year: "2022", income: 46 }, { year: "2023", income: 41 }, { year: "2024", income: 58 },
  { year: "2025", income: 65 }, { year: "2026", income: 72 },
];

export const monthlyDistribution = [
  { month: "Jan", amount: 18 }, { month: "Feb", amount: 26 }, { month: "Mar", amount: 42 },
  { month: "Apr", amount: 24 }, { month: "May", amount: 58 }, { month: "Jun", amount: 35 },
  { month: "Jul", amount: 22 }, { month: "Aug", amount: 48 }, { month: "Sep", amount: 31 },
  { month: "Oct", amount: 56 }, { month: "Nov", amount: 40 }, { month: "Dec", amount: 66 },
];

export const sectorDistribution = [
  { name: "Energy", value: 32, color: "#85d6a5" },
  { name: "Financials", value: 26, color: "#75a7ff" },
  { name: "Technology", value: 18, color: "#c5a5ff" },
  { name: "Consumer", value: 14, color: "#f1be71" },
  { name: "Other", value: 10, color: "#75909b" },
];

export const announcements = [
  { company: "Coal India", symbol: "COALINDIA", title: "Interim dividend declared", amount: "₹15.25 / share", date: "12 Nov 2026", tone: "mint" },
  { company: "Power Finance Corporation", symbol: "PFC", title: "Board approves interim dividend", amount: "₹12.35 / share", date: "10 Nov 2026", tone: "blue" },
  { company: "Indian Oil Corporation", symbol: "IOC", title: "Dividend record date announced", amount: "₹7.00 / share", date: "08 Nov 2026", tone: "amber" },
];
