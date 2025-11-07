import React, { useState, useEffect, useRef } from 'react';
import type { Customer, InvoiceItem, CompanyInfo, PaymentStatus } from '../types';
import { formatDate, amountToWords } from '../utils/helpers';
import { api } from '../services/agent';

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
  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
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
                        <p><strong>Vname</strong></p>
                        <p>Vname</p>
                        <p>Vname.city, Vname.state 411018</p>
                        <p><strong>GSTIN</strong> gstNumber</p>
                        <p><strong>PAN</strong> panNumber</p>
                    </div>
                    <div className="w-[50%] bg-[#e5e7eb]  p-2 m-2 rounded-lg shadow">
                        <h2 className="mb-2"><strong>Billed to</strong></h2>
                        {customer ? (
                            <>
                                <p><strong>{customer.customerName}</strong></p>
                                <p>{customer.billingAddress}</p>
                                <p>city, state zip</p>
                                <p><strong>GSTIN</strong> {customer.gstNumber}</p>
                                <p><strong>PAN</strong> {customer.gstNumber}</p>
                                <div className="flex justify-between content-center text-center pr-10">
                                    <p><strong>State</strong> state</p>
                                    <p><strong>Code</strong> 27</p>
                                </div>

                            </>
                        ) : (
                            <p>No customer data available</p>
                        )}
                    </div>
          </div>
          </div>
     
   </div>
  );
};