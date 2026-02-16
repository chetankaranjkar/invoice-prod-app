import type { CompanyInfo } from '../../../../types';

interface BankDetailsProps {
  company: CompanyInfo | null;
}

function BankDetails({ company }: BankDetailsProps) {
  return (
    <div className="w-full text-sm">
      <p className="font-semibold underline mb-2">Bank Account Details</p>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="py-0.5 font-semibold">Account Name:</td>
            <td className="py-0.5">{company?.name}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-semibold">PAN Number:</td>
            <td className="py-0.5">{company?.panNumber}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-semibold">Bank Name:</td>
            <td className="py-0.5">{company?.bankName}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-semibold">Account Number:</td>
            <td className="py-0.5">{company?.accountNumber}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-semibold">IFSC Code:</td>
            <td className="py-0.5">{company?.ifscCode}</td>
          </tr>
          <tr>
            <td className="py-0.5 font-semibold">GPay Number:</td>
            <td className="py-0.5">{company?.gpayNumber}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default BankDetails;
