import React, { useState, useEffect, useRef } from 'react';
import type { Customer, InvoiceItem, CompanyInfo, PaymentStatus } from '../types';
import { formatDate, amountToWords } from '../utils/helpers';
import { api } from '../services/agent';
import { ToWords } from 'to-words';

interface InvoicePreviewProps {
  customer: Customer | null;
  items: InvoiceItem[];
  dueDate: string;
  invoiceNumber: string;
  paymentStatus?: PaymentStatus; // Use PaymentStatus type
  initialPayment?: number;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  customer,
  items,
  dueDate,
  invoiceNumber,
  paymentStatus = 'Unpaid',
  initialPayment = 0,
}) => {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const invoiceDate = new Date().toISOString().split('T')[0];
  const invoiceRef = useRef<HTMLDivElement>(null);
  const toWords = new ToWords({
    localeCode: 'en-IN',
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
      doNotAddOnly: false,
      currencyOptions: {
        name: 'Rupee',
        plural: 'Rupees',
        symbol: '₹',
        fractionalUnit: {
          name: 'Paisa',
          plural: 'Paise',
          symbol: '',
        },
      },
    },
  });
  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    console.error("cusrtomer Info`")
    console.log(customer)
    try {
      const response = await api.user.getProfile();
      const userProfile = response.data;


      const companyData: CompanyInfo = {
        name: userProfile.name,
        email: userProfile.email,
        businessName: userProfile.businessName,
        gstNumber: userProfile.gstNumber,
        address: userProfile.address,
        bankName: userProfile.bankName,
        accountNumber: userProfile.accountNumber,
        ifscCode: userProfile.ifscCode,
        panNumber: userProfile.panNumber,
        City: userProfile.city,
        State: userProfile.state,
        Zip: userProfile.zip,
        phone: userProfile.phone,
        logoUrl: userProfile.logoUrl,
      };

      setCompanyInfo(companyData);
    } catch (error) {
      console.error('Failed to load company info:', error);
      setCompanyInfo({
        name: 'LEAP NEXT',
        businessName: 'LEAP NEXT',
        address: 'Remula Gulmolar Phase 2, Behind City One Mall E Wing Hit No 002, Morwadi, Pune, Maharashtra 411017',
        gstNumber: '27BBPK5069A1ZW',
        panNumber: 'BBPK5069A',
        bankName: 'Kotak Mahindra Bank',
        accountNumber: '8350277598',
        ifscCode: 'KKBK0007798',
        phone: '0877411434',
      });
    }
  };

  const totals = items.reduce(
    (acc, item) => ({
      totalAmount: acc.totalAmount + item.amount,
      totalGST: acc.totalGST + item.gstAmount,
      grandTotal: acc.grandTotal + (item.amount + item.gstAmount),
    }),
    { totalAmount: 0, totalGST: 0, grandTotal: 0 }
  );

  const balanceAmount = totals.grandTotal - initialPayment;

  const currentCompany = companyInfo;

  if (!currentCompany) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="border-2 border-gray-800 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading company information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-preview-container w-full h-full bg-white">
      <div ref={invoiceRef} className="print-area w-full h-full bg-white">
        <header className="relative flex justify-between content-center px-2 pt-2 bg-white">
          <div className="flex flex-col w-[50%]  border-b-2
                   border-b-[#505050] ">
            <h1 className="py-2 mb-2 text-4xl"><strong>Invoice</strong></h1>
            <p><strong>Invoice No:  </strong> {invoiceNumber}</p>
            <p className="mb-2"><strong>Invoice Date:</strong> {invoiceDate}</p>
          </div>
          {/* <div className="bg-[#505050] w-[50%] flex items-center justify-center clip-diagonal z-0 px-14 ">
                        <img className="w-full object-cover " 
                            src={vendorDetails.logo} 
                            alt={vendorDetails.name}></img>
                    </div> */}
          <div className=" w-[50%] flex items-center 
                    justify-center border-b-[#505050] border-b-2 absolute right-0 bottom-0">
            <img className="w-full  object-cover fit-content"
              src={currentCompany.logoUrl}
              alt={currentCompany.name}></img>
          </div>
        </header>
        <div className="flex justify-between px-0.5 pt-1">
          <div className="w-[50%] bg-[#e5e7eb] p-2 m-2 rounded-lg shadow">
            <h2 className="mb-2"><strong>Billed by</strong></h2>
            <p><strong>{companyInfo.businessName}</strong></p>
            <p>{companyInfo.address}</p>
            <p>{companyInfo.City}, {companyInfo.State} {companyInfo.Zip}</p>
            <p><strong>GSTIN</strong> {companyInfo.gstNumber}</p>
            <p><strong>PAN</strong> {companyInfo.panNumber}</p>
          </div>
          <div className="w-[50%] bg-[#e5e7eb]  p-2 m-2 rounded-lg shadow">
            <h2 className="mb-2"><strong>Billed to</strong></h2>
            {customer ? (

              <>
                <p><strong>{customer.customerName}</strong></p>
                <p>{customer.billingAddress}</p>
                <p>{customer.city}, {customer.state} {customer.zip}</p>
                <p><strong>GSTIN</strong> {customer.gstNumber}</p>
                <p><strong>PAN</strong> {customer.gstNumber}</p>
                <div className="flex justify-between content-center text-center pr-10">
                  <p><strong>State</strong> {customer.state}</p>
                  <p><strong>Code</strong> 27</p>
                </div>

              </>
            ) : (
              <p>No customer data available</p>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#d1d5dc]">
                <th className="border px-2 py-1">Index</th>
                <th className="border px-2 py-1">Item description</th>
                <th className="border px-2 py-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="border px-2 py-1">{index + 1}</td>
                  <td className="border px-2 py-1">{item.productName}</td>
                  <td className="border px-2 py-1">{item.amount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#d1d5dc]">
                <td className="border px-2 py-1" colSpan={2}><strong>Total</strong></td>
                <td className="border px-2 py-1">
                  <strong>
                    {items.reduce((total, item) => total + item.amount, 0).toFixed(2)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="flex justify-between mt-4">
            <div className="account-details w-[50%]">
              {companyInfo && <span>
                <p className="text-sm mb-2 underline"><strong>Bank Account Details</strong></p>

                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td ><strong>Bank Name:</strong></td>
                      <td>{companyInfo.bankName}</td>
                    </tr>
                    <tr>
                      <td><strong>Account Name:</strong></td>
                      <td>{companyInfo.name}</td>
                    </tr>
                    <tr>
                      <td><strong>Mobile Number:</strong></td>
                      <td>{companyInfo.phone}</td>
                    </tr>
                    <tr>
                      <td><strong>Account Number:</strong></td>
                      <td>{companyInfo.accountNumber}</td>
                    </tr>
                    <tr>
                      <td><strong>IFSC Code:</strong></td>
                      <td> {companyInfo.ifscCode}</td>
                    </tr>
                    <tr>
                      <td><strong>Branch:</strong></td>
                      <td>{companyInfo.name}</td>
                    </tr>
                  </tbody>
                </table>
              </span>
              }
              <div className="Signature mt-2 mb-[6vw]">
                <p className="text-sm"><strong>Signature</strong></p>
              </div>

            </div>

            <div className="invoice-summary  w-[50%]">
              <table className="w-full text-left">
                <tbody>
                  <tr>
                    <td className="py-1"><strong>Taxable Amount:</strong></td>
                    <td className="py-1">
                      {items.reduce((total, item) => total + item.amount, 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1"><strong>Tax (18%):</strong></td>
                    <td className="py-1">
                      {(items.reduce((total, item) => total + item.amount, 0) * 0.18).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td className="py-1">Total:</td>
                    <td className="py-1">
                      {(items.reduce((total, item) => total + item.amount, 0) * 1.18).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="amount-in-words">
                  <tr>
                    <td colSpan={2}>
                      <hr className="border-[#99a1af] my-4" />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1" colSpan={2}>
                      <strong>Amount in Words:</strong> {
                        toWords.convert(totals.totalAmount)
                      }
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};