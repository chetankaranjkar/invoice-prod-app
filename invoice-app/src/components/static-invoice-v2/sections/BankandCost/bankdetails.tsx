import type { CompanyInfo } from '../../../../types';

interface BankDetailsProps {
  company: CompanyInfo | null;
}

function BankDetails({ company }: BankDetailsProps) {
  const rows: { label: string; value?: string | null }[] = [
    { label: 'Account Name', value: company?.name },
    { label: 'Bank Name', value: company?.bankName },
    { label: 'Account Number', value: company?.accountNumber },
    { label: 'IFSC Code', value: company?.ifscCode },
    { label: 'PAN Number', value: company?.panNumber },
    { label: 'GPay Number', value: company?.gpayNumber },
  ];

  return (
    <div className="w-full h-full text-xs bg-[#f9fafb] rounded-lg border border-[#e5e7eb] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-2 pb-1 border-b border-[#e5e7eb]">
        Bank Account Details
      </p>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label}>
              <td className="py-0.5 font-semibold text-[#1f2937] pr-2 whitespace-nowrap">
                {label}
              </td>
              <td className="py-0.5 text-[#374151] tabular-nums">{value || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BankDetails;
