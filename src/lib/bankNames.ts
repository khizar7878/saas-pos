// Predefined list of bank names with ability to add custom ones
export const defaultBankNames = [
  "Habib Bank Limited (HBL)",
  "MCB Bank Limited",
  "United Bank Limited (UBL)",
  "Allied Bank Limited (ABL)",
  "Bank Alfalah",
  "Meezan Bank",
  "Faysal Bank",
  "Standard Chartered Bank",
  "Askari Bank",
  "Bank of Punjab",
  "National Bank of Pakistan (NBP)",
  "JS Bank",
  "Silk Bank",
  "Summit Bank",
  "Soneri Bank",
];

// Bank account interface with full details
export interface BankAccountDetails {
  bankName: string;
  accountNumber: string;
  accountTitle: string;
  branchLocation?: string;
}
