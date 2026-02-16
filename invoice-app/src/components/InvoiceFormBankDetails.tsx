import type { CompanyInfo } from '../types';

interface InvoiceFormBankDetailsProps {
  companyInfo: CompanyInfo | null;
}

export const InvoiceFormBankDetails = ({ companyInfo }: InvoiceFormBankDetailsProps) => {
  return (
    <div className="account-details">
      <p className="text-xs mb-1 underline">
        <strong>Bank Account Details</strong>
      </p>
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td><strong>Bank Name:</strong></td>
            <td>{companyInfo?.bankName || '-'}</td>
          </tr>
          <tr>
            <td><strong>Account Name:</strong></td>
            <td>{companyInfo?.name || '-'}</td>
          </tr>
          <tr>
            <td><strong>Mobile Number:</strong></td>
            <td>{companyInfo?.phone || '-'}</td>
          </tr>
          <tr>
            <td><strong>Account Number:</strong></td>
            <td>{companyInfo?.accountNumber || '-'}</td>
          </tr>
          <tr>
            <td><strong>IFSC Code:</strong></td>
            <td>{companyInfo?.ifscCode || '-'}</td>
          </tr>
          <tr>
            <td><strong>Branch:</strong></td>
            <td>{companyInfo?.name || '-'}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-2 text-xs">
        <strong>Signature</strong>
      </div>
    </div>
  );
};
