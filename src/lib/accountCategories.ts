export interface AccountSubcategory {
  id: string;
  name: string;
  description: string;
}

export interface AccountCategory {
  id: string;
  name: string;
  description: string;
  subcategories: AccountSubcategory[];
}

export const accountCategories: AccountCategory[] = [
  {
    id: "assets",
    name: "Assets",
    description: "What you own",
    subcategories: [
      { id: "bank_accounts", name: "Bank Accounts", description: "Cash in bank" },
      { id: "accounts_receivable", name: "Accounts Receivable", description: "Money customers owe you" },
      { id: "inventory", name: "Inventory", description: "Unstitched fabric in stock" },
      { id: "fixed_assets", name: "Fixed Assets", description: "Furniture, computers, vehicles" },
    ],
  },
  {
    id: "liabilities",
    name: "Liabilities",
    description: "What you owe",
    subcategories: [
      { id: "accounts_payable", name: "Accounts Payable", description: "Money owed to suppliers" },
      { id: "loans", name: "Loans", description: "Bank loans or credit lines" },
      { id: "sales_tax_payable", name: "Sales Tax Payable", description: "Tax collected but unpaid" },
    ],
  },
  {
    id: "equity",
    name: "Equity",
    description: "What you truly own",
    subcategories: [
      { id: "owners_capital", name: "Owner's Capital", description: "Personal investment" },
      { id: "retained_earnings", name: "Retained Earnings", description: "Cumulative profit kept" },
    ],
  },
  {
    id: "revenue",
    name: "Revenue / Income",
    description: "What you earn",
    subcategories: [
      { id: "sales_income", name: "Sales Income", description: "Revenue from fabric sales" },
      { id: "service_income", name: "Service Income", description: "Delivery or cutting charges" },
      { id: "interest_income", name: "Interest Income", description: "Bank interest earned" },
    ],
  },
  {
    id: "expenses",
    name: "Expenses",
    description: "What you spend",
    subcategories: [
      { id: "cogs", name: "Cost of Goods Sold", description: "Direct cost of fabric sold" },
      { id: "operating_expenses", name: "Operating Expenses", description: "Rent, utilities, salaries" },
      { id: "bank_fees", name: "Bank Fees", description: "Transaction charges" },
    ],
  },
];

export function getCategoryById(categoryId: string): AccountCategory | undefined {
  return accountCategories.find((cat) => cat.id === categoryId);
}

export function getSubcategoryById(
  categoryId: string,
  subcategoryId: string
): AccountSubcategory | undefined {
  const category = getCategoryById(categoryId);
  return category?.subcategories.find((sub) => sub.id === subcategoryId);
}

export function getFullCategoryLabel(categoryId: string, subcategoryId: string): string {
  const category = getCategoryById(categoryId);
  const subcategory = getSubcategoryById(categoryId, subcategoryId);
  if (category && subcategory) {
    return `${category.name} > ${subcategory.name}`;
  }
  return "";
}
