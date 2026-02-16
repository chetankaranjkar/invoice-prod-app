import type { CompanyInfo } from '../../../../types';
import BankDetails from './bankdetails';
import StaticInvoiceTotals from './StaticInvoiceTotals';

interface BankAndCostProps {
  company: CompanyInfo | null;
  totalAmount: number;
  totalGST: number;
  grandTotal: number;
  showTotalGst?: boolean;
  totalPaid: number;
  totalWave: number;
  balanceAmount: number;
  amountInWords: string;
}

function BankandCost({
  company,
  totalAmount,
  totalGST,
  grandTotal,
  showTotalGst = true,
  totalPaid,
  totalWave,
  balanceAmount,
  amountInWords,
}: BankAndCostProps) {
  return (
    <div className="w-full mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="w-full sm:w-1/2">
        <BankDetails company={company} />
      </div>
      <div className="w-full sm:w-1/2">
        <StaticInvoiceTotals
          totalAmount={totalAmount}
          totalGST={totalGST}
          grandTotal={grandTotal}
          showTotalGst={showTotalGst}
          totalPaid={totalPaid}
          totalWave={totalWave}
          balanceAmount={balanceAmount}
          amountInWords={amountInWords}
        />
      </div>
    </div>
  );
}

export default BankandCost;
