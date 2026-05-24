import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Customer, InvoiceItem, CompanyInfo, Payment } from '../types';
import { api } from '../services/agent';
import { ToWords } from 'to-words';
import html2canvas from 'html2canvas';
import {
  buildHtml2CanvasOnClone,
  convertClonedImagesToDataUrls,
  inlineComputedColors,
} from '../utils/pdfCapture';
import jsPDF from 'jspdf';
import { Printer, Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDateFormat } from '../hooks/useDateFormat';
import { resolveAssetUrl } from '../utils/helpers';
import { calculateInvoiceTotals, normalizeInvoiceItemsForRender } from '../utils/invoiceCalculations';
import { InvoiceHierarchyRows } from './invoice/InvoiceHierarchyRows';

interface InvoicePreviewProps {
  customer: Customer | null;
  items: InvoiceItem[];
  invoiceDate: string;
  invoiceNumber: string;
  paymentStatus?: string;
  initialPayment?: number; // This is actually paidAmount from invoice
  waveAmount?: number; // Wave amount from invoice
  payments?: Payment[]; // Payments array for reference
  /** When viewing another user's invoice (e.g. admin views user's invoice), pass the invoice creator's company info */
  companyInfo?: CompanyInfo | null;
  /** When true, never fall back to logged-in user's profile - use only companyInfo */
  forceUseCompanyInfo?: boolean;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  customer,
  items,
  invoiceDate: invoiceDateProp,
  invoiceNumber,
  paymentStatus: _paymentStatus = 'Unpaid',
  initialPayment = 0, // This is paidAmount
  waveAmount = 0, // This is waveAmount from invoice
  payments: _payments = [], // For future use if needed
  companyInfo: companyInfoProp,
  forceUseCompanyInfo = false,
}) => {
  const { themeColors } = useTheme();
  const formatDate = useDateFormat();
  const [companyInfoFromApi, setCompanyInfoFromApi] = useState<CompanyInfo | null>(null);
  const companyInfo = companyInfoProp ?? (forceUseCompanyInfo ? null : companyInfoFromApi);
  const invoiceDate = invoiceDateProp || new Date().toISOString().split('T')[0];
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
    if (!companyInfoProp && !forceUseCompanyInfo) loadCompanyInfo();
  }, [companyInfoProp, forceUseCompanyInfo]);

  const loadCompanyInfo = async () => {
    try {
      const response = await api.user.getProfile();
      const userProfile = response.data;

      // Debug: Log the user profile to see what we're getting
      if (process.env.NODE_ENV === 'development') {
        console.log('User Profile Data:', userProfile);
        console.log('LogoUrl from API:', userProfile.logoUrl || userProfile.LogoUrl);
      }

      // Handle both camelCase and PascalCase property names
      let logoUrl = userProfile.logoUrl || userProfile.LogoUrl || null;

      // Process logoUrl to ensure it works in both development and Docker
      if (logoUrl && logoUrl.trim() !== '') {
        // Fix old HTTPS URLs to use HTTP (for development)
        if (logoUrl.includes('https://localhost:7001')) {
          logoUrl = logoUrl.replace('https://localhost:7001', 'http://localhost:5001');
        }
        // Also fix any other HTTPS localhost URLs
        if (logoUrl.includes('https://localhost')) {
          logoUrl = logoUrl.replace('https://localhost', 'http://localhost:5001');
        }

        // Handle relative paths
        if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://') && !logoUrl.startsWith('data:') && !logoUrl.startsWith('blob:')) {
          const apiBaseUrl = import.meta.env.VITE_API_URL || '';
          const isDockerMode = apiBaseUrl.startsWith('/'); // Docker mode: VITE_API_URL = "/api/"

          if (logoUrl.startsWith('/uploads/')) {
            // For /uploads/ paths, always use direct API port (5001) instead of nginx proxy
            // This works in both Docker and dev mode
            // Docker: http://localhost:5001/uploads/... (direct API access)
            // Dev: http://localhost:5001/uploads/... (direct API access)
            const directApiUrl = 'http://localhost:5001';
            logoUrl = `${directApiUrl}${logoUrl}`;
          } else if (logoUrl.startsWith('/')) {
            // Other relative paths - prepend API URL
            const baseUrl = apiBaseUrl || (import.meta.env.DEV ? 'http://localhost:5001' : '');
            // If Docker mode (relative /api/), use direct port for non-uploads paths too
            const finalBaseUrl = isDockerMode ? 'http://localhost:5001' : baseUrl;
            const cleanBaseUrl = finalBaseUrl.endsWith('/') ? finalBaseUrl.slice(0, -1) : finalBaseUrl;
            logoUrl = `${cleanBaseUrl}${logoUrl}`;
          } else {
            // Relative path without leading slash
            const baseUrl = apiBaseUrl || (import.meta.env.DEV ? 'http://localhost:5001' : '');
            const finalBaseUrl = isDockerMode ? 'http://localhost:5001' : baseUrl;
            const cleanBaseUrl = finalBaseUrl.endsWith('/') ? finalBaseUrl : `${finalBaseUrl}/`;
            logoUrl = `${cleanBaseUrl}${logoUrl}`;
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Final LogoUrl:', logoUrl);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('LogoUrl is empty or null in user profile');
        }
      }

      const companyData: CompanyInfo = {
        name: userProfile.name,
        email: userProfile.email,
        businessName: userProfile.businessName,
        gstNumber: userProfile.gstNumber,
        address: userProfile.address,
        bankName: userProfile.bankName,
        accountNumber: (userProfile as any).bankAccountNo || userProfile.accountNumber,
        ifscCode: userProfile.ifscCode,
        panNumber: userProfile.panNumber,
        membershipNo: userProfile.membershipNo,
        gstpNumber: userProfile.gstpNumber,
        City: userProfile.city,
        State: userProfile.state,
        Zip: userProfile.zip,
        phone: userProfile.phone,
        logoUrl: logoUrl,
        signatureUrl: userProfile.signatureUrl || (userProfile as any).SignatureUrl || undefined,
        includeSignatureOnInvoice: ((): boolean | undefined => {
          const v = userProfile.includeSignatureOnInvoice ?? (userProfile as any).IncludeSignatureOnInvoice;
          return v == null ? undefined : (v === true || v === 'true' || v === 1);
        })(),
      };

      setCompanyInfoFromApi(companyData);
    } catch (error) {
      console.error('Failed to load company info:', error);
      setCompanyInfoFromApi({
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

  const displayItems = useMemo(() => normalizeInvoiceItemsForRender(items), [items]);
  const invoiceTotals = useMemo(() => calculateInvoiceTotals(displayItems), [displayItems]);
  const totals = {
    totalAmount: invoiceTotals.totalAmount,
    totalGST: invoiceTotals.gstAmount,
    grandTotal: invoiceTotals.grandTotal,
  };

  // Use invoice's paidAmount and waveAmount directly (from database)
  const totalPaid = Number(initialPayment) || 0; // Actual payment received
  const totalWave = Number(waveAmount) || 0; // Total wave off amount

  const balanceAmount = Math.max(0, totals.grandTotal - totalPaid - totalWave);

  const currentCompany = companyInfo;

  const handlePrint = () => {
    if (!invoiceRef.current) return;

    // Create a new window for printing (only invoice content, no buttons)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the invoice');
      return;
    }

    // Clone the invoice content to preserve styles
    const invoiceClone = invoiceRef.current.cloneNode(true) as HTMLElement;

    // Get computed styles and inline them for better print compatibility
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch (e) {
          return '';
        }
      })
      .join('\n');

    // Write the content to the print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <style>
            /* Filter out oklch/oslch color functions from styles */
            ${styles.replace(/oklch\([^)]+\)/gi, 'rgb(128, 128, 128)').replace(/oslch\([^)]+\)/gi, 'rgb(128, 128, 128)').replace(/oklab\([^)]+\)/gi, 'rgb(128, 128, 128)')}
            @media print {
              @page {
                margin: 10mm;
                size: A4;
              }
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                font-size: 9px !important;
              }
              /* Scope font-size overrides to table only - preserve user font sizes in .header-logo and .invoice-address */
              .invoice-table h1, .invoice-table h2, .invoice-table h3 {
                font-size: 12px !important;
              }
              .invoice-header {
                padding-top: 0 !important;
              }
              .invoice-header h1 {
                margin: 0 0 4px 0 !important;
                padding: 0 !important;
              }
              .invoice-logo {
                min-height: 0 !important;
                height: 35mm !important;
                align-items: flex-start !important;
              }
              table:not(.invoice-description-table) {
                min-height: 0 !important;
                height: auto !important;
                font-size: 9px !important;
              }
              .invoice-description-table-wrap {
                min-height: 0 !important;
                height: auto !important;
              }
              tbody {
                min-height: 0 !important;
                height: auto !important;
              }
              tbody tr {
                vertical-align: top !important;
                height: auto !important;
              }
              tbody td {
                vertical-align: top !important;
              }
              .invoice-table .text-xs, .invoice-table .text-sm {
                font-size: 9px !important;
              }
              .invoice-signature {
                margin-bottom: 6mm !important;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: white;
              font-size: 10px;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${invoiceClone.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    const waitForPrintImages = () => {
      const images = Array.from(printWindow.document.querySelectorAll('img'));
      const imagePromises = images.map((img) => {
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }, 5000);

          const done = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          };

          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      });

      return Promise.all(imagePromises);
    };

    // Wait for content (especially logo) to load, then print
    setTimeout(async () => {
      await waitForPrintImages();
      printWindow.focus();
      printWindow.print();
      // Close window after printing (user can cancel)
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 300);
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) {
      alert('Invoice content not ready. Please try again.');
      return;
    }

    const invoiceElement = invoiceRef.current;
    invoiceElement.classList.add('pdf-export');

    // Show loading state
    const loadingMessage = document.createElement('div');
    loadingMessage.textContent = 'Generating PDF...';
    loadingMessage.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;';
    document.body.appendChild(loadingMessage);

    try {
      // Wait for all images to load before capturing
      const images = invoiceElement.querySelectorAll('img');
      const imagePromises = Array.from(images).map((img) => {
        // Check if image is already loaded
        if (img.complete && img.naturalHeight > 0 && img.naturalWidth > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Image already loaded:', img.src);
          }
          return Promise.resolve();
        }

        // Ensure crossOrigin is set for CORS
        if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
          if (!img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
          }
        }

        return new Promise((resolve) => {
          let resolved = false;

          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              if (process.env.NODE_ENV === 'development') {
                console.warn('Image load timeout:', img.src);
              }
              resolve(null); // Timeout - continue anyway
            }
          }, 10000); // Increased timeout to 10 seconds for logo

          const handleLoad = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              if (process.env.NODE_ENV === 'development') {
                console.log('Image loaded successfully:', img.src, img.naturalWidth, 'x', img.naturalHeight);
              }
              resolve(null);
            }
          };

          const handleError = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              if (process.env.NODE_ENV === 'development') {
                console.error('Image failed to load:', img.src);
              }
              // Don't hide the image, just continue - it might still render
              resolve(null);
            }
          };

          // If image is already complete, check dimensions
          if (img.complete) {
            if (img.naturalHeight > 0 && img.naturalWidth > 0) {
              handleLoad();
            } else {
              handleError();
            }
          } else {
            img.addEventListener('load', handleLoad, { once: true });
            img.addEventListener('error', handleError, { once: true });
          }
        });
      });
      await Promise.all(imagePromises);

      // Additional wait to ensure all images are fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Inline computed RGB colors before capture (Tailwind v4 uses oklab in stylesheets)
      inlineComputedColors(invoiceElement, invoiceElement);

      const invoicePdfOnClone = buildHtml2CanvasOnClone(invoiceElement, async (clonedDoc, element) => {
        const pdfRoot = element.querySelector('[data-pdf-root="true"]') as HTMLElement | null;
        const fontTarget = pdfRoot ?? element;
        fontTarget.style.fontSize = '1.15em';
        fontTarget.style.lineHeight = '1.3';
        await convertClonedImagesToDataUrls(invoiceElement, clonedDoc);
      });

      // Capture the invoice as canvas with high quality
      // Try with CORS first, fallback to allowTaint if CORS fails
      let canvas: HTMLCanvasElement;
      try {
        // First attempt: Try with CORS (for same-origin or CORS-enabled images)
        canvas = await html2canvas(invoiceElement, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: process.env.NODE_ENV === 'development',
          backgroundColor: '#ffffff',
          windowWidth: invoiceElement.scrollWidth,
          windowHeight: invoiceElement.scrollHeight,
          removeContainer: false,
          onclone: invoicePdfOnClone,
        });
      } catch (corsError) {
        // Fallback: If CORS fails, try with allowTaint (images may be tainted)
        if (process.env.NODE_ENV === 'development') {
          console.warn('CORS capture failed, trying with allowTaint:', corsError);
        }
        canvas = await html2canvas(invoiceElement, {
          scale: 2,
          useCORS: false,
          allowTaint: true,
          logging: process.env.NODE_ENV === 'development',
          backgroundColor: '#ffffff',
          windowWidth: invoiceElement.scrollWidth,
          windowHeight: invoiceElement.scrollHeight,
          removeContainer: false,
          onclone: invoicePdfOnClone,
        });
      }

      // Remove loading message
      if (document.body.contains(loadingMessage)) {
        document.body.removeChild(loadingMessage);
      }

      const imgData = canvas.toDataURL('image/png');

      // A4 dimensions in mm
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      const margin = 8; // Slightly tighter margin to fit footer on page
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);

      // Calculate dimensions to fit A4 while maintaining aspect ratio
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;

      let finalWidth = contentWidth;
      let finalHeight = contentWidth / ratio;

      // Create PDF in portrait mode
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // If content fits on one page
      if (finalHeight <= contentHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
      } else {
        // Content is taller than one page - split across multiple pages
        const totalPages = Math.ceil(finalHeight / contentHeight);
        const imgHeightPerPage = imgHeight / totalPages;
        const pdfHeightPerPage = finalHeight / totalPages;

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) {
            pdf.addPage();
          }

          // Create a canvas for this page slice
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = imgHeightPerPage;
          const pageCtx = pageCanvas.getContext('2d');

          if (pageCtx) {
            // Draw the portion of the image for this page
            pageCtx.drawImage(
              canvas,
              0, i * imgHeightPerPage, imgWidth, imgHeightPerPage,
              0, 0, imgWidth, imgHeightPerPage
            );

            const pageImgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(pageImgData, 'PNG', margin, margin, finalWidth, pdfHeightPerPage);
          }
        }
      }

      // Generate filename
      const fileName = `Invoice_${invoiceNumber}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Download PDF
      pdf.save(fileName);
    } catch (error: any) {
      // Remove loading message if still present
      if (document.body.contains(loadingMessage)) {
        document.body.removeChild(loadingMessage);
      }

      // Log detailed error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('Error generating PDF:', error);
        console.error('Error details:', {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
        });
      }

      // Show user-friendly error message with more details
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to generate PDF: ${errorMessage}\n\nPlease ensure:\n- All images are loaded\n- The invoice is fully displayed\n- Try refreshing the page and try again.`);
    } finally {
      invoiceElement.classList.remove('pdf-export');
    }
  };

  if (!currentCompany) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 md:p-8">
        <div className="border-2 border-[#1f2937] p-4 sm:p-6 md:p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563eb] mx-auto"></div>
          <p className="mt-4 text-[#4b5563]">Loading company information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-preview-container w-full h-full bg-white">
      {/* Print/Download Buttons - Hidden in print */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 print:hidden">
        <button
          onClick={handlePrint}
          className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 ${themeColors.info} ${themeColors.infoHover} text-white rounded-md transition-colors text-sm sm:text-base`}
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          onClick={handleDownloadPDF}
          className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 ${themeColors.success} ${themeColors.successHover} text-white rounded-md transition-colors text-sm sm:text-base`}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>
      <div ref={invoiceRef} data-pdf-root="true" className="print-area w-full h-full bg-white">
        <header className="invoice-header flex flex-col sm:flex-row justify-between items-stretch px-2 pt-2 bg-white">
          <div className="flex flex-col w-full sm:w-[50%] border-b-2 border-b-[#505050] pb-2">
            <h1 className="py-2 mb-2 text-lg sm:text-xl md:text-2xl"><strong>Invoice</strong></h1>
            <p className="text-xs sm:text-sm"><strong>Invoice No:  </strong> {invoiceNumber}</p>
            <p className="mb-2 text-xs sm:text-sm"><strong>Invoice Date:</strong> {formatDate(invoiceDate)}</p>
          </div>
          <div className="invoice-logo w-full sm:w-[50%] flex items-center justify-center border-b-[#505050] border-b-2 overflow-hidden bg-gray-600 min-h-[15vh]">
            {currentCompany.logoUrl && currentCompany.logoUrl.trim() !== '' ? (
              <>
                <img
                  key={currentCompany.logoUrl} // Force re-render if URL changes
                  className="h-full w-full max-h-[15vh] object-contain"
                  src={currentCompany.logoUrl}
                  alt={currentCompany.name || currentCompany.businessName || 'Company Logo'}
                  loading="eager"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (process.env.NODE_ENV === 'development') {
                      console.error('Logo image failed to load:', currentCompany.logoUrl);
                      console.error('Image src attribute:', img.src);
                      console.error('Image natural dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                      // Try to fetch the image to see the actual error
                      if (currentCompany.logoUrl) {
                        fetch(currentCompany.logoUrl, { method: 'HEAD' })
                          .then(response => {
                            console.log('Fetch HEAD response:', {
                              status: response.status,
                              statusText: response.statusText,
                              headers: Object.fromEntries(response.headers.entries())
                            });
                          })
                          .catch(err => console.error('Fetch error:', err));
                      }
                    }

                    // Try to reload the image once
                    if (!img.dataset.retried) {
                      img.dataset.retried = 'true';
                      const originalSrc = img.src;
                      img.src = '';
                      // Force a fresh load
                      setTimeout(() => {
                        img.src = originalSrc + '?t=' + Date.now();
                      }, 200);
                      return;
                    }

                    // Hide the broken image after retry failed
                    img.style.display = 'none';
                    // Show business name in white on gray background
                    if (!img.parentElement?.querySelector('.logo-placeholder')) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'logo-placeholder flex items-center justify-center h-full w-full';
                      const companyName = currentCompany.businessName || currentCompany.name || 'Company Name';
                      placeholder.innerHTML = `<strong class="text-sm font-bold text-white">${companyName}</strong>`;
                      img.parentElement?.appendChild(placeholder);
                    }
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    // Remove any placeholder when image loads successfully
                    const placeholder = img.parentElement?.querySelector('.logo-placeholder');
                    if (placeholder) {
                      placeholder.remove();
                    }
                    // Ensure image is visible
                    img.style.display = '';
                    if (process.env.NODE_ENV === 'development') {
                      console.log('✅ Logo image loaded successfully:', currentCompany.logoUrl);
                      console.log('Image dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                    }
                  }}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full w-full">
                <strong className="text-sm font-bold text-white">
                  {currentCompany.businessName || currentCompany.name || 'Company Name'}
                </strong>
              </div>
            )}
          </div>
        </header>
        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 px-0.5 pt-1">
          <div className="w-full sm:w-[48%] bg-[#e5e7eb] p-2 m-1 sm:m-2 rounded-lg shadow text-xs">
            <h2 className="mb-1 text-xs"><strong>Billed by</strong></h2>
            <p className="text-xs"><strong>{companyInfo.businessName}</strong></p>
            <p className="text-xs">{companyInfo.address}</p>
            <p className="text-xs">{companyInfo.City}, {companyInfo.State} {companyInfo.Zip}</p>
            <p className="text-xs"><strong>GSTIN</strong> {companyInfo.gstNumber}</p>
            <p className="text-xs"><strong>PAN</strong> {companyInfo.panNumber}</p>
          </div>
          <div className="w-full sm:w-[48%] bg-[#e5e7eb] p-2 m-1 sm:m-2 rounded-lg shadow text-xs">
            <h2 className="mb-1 text-xs"><strong>Billed to</strong></h2>
            {customer ? (

              <>
                <p className="text-xs"><strong>{customer.customerName}</strong></p>
                <p className="text-xs">{customer.billingAddress}</p>
                <p className="text-xs">{customer.city}, {customer.state} {customer.zip}</p>
                <p className="text-xs"><strong>GSTIN</strong> {customer.gstNumber}</p>
                <p className="text-xs"><strong>PAN</strong> {customer.gstNumber}</p>
                <div className="flex justify-between content-center text-center pr-10 text-xs">
                  <p><strong>State</strong> {customer.state}</p>
                  <p><strong>Code</strong> 27</p>
                </div>

              </>
            ) : (
              <p className="text-xs">No customer data available</p>
            )}
          </div>
        </div>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <div className="invoice-description-table-wrap invoice-hierarchy-table-wrap w-full rounded-lg overflow-hidden border border-[#d1d5db]">
            <table className="invoice-table invoice-description-table invoice-hierarchy-table w-full h-auto text-left border-collapse text-[10px] sm:text-xs md:text-sm table-fixed">
              <thead>
                <tr className="bg-[#d1d5dc]">
                  <th className="border px-1 py-1 w-[5%]">Index</th>
                  <th className="border px-1 sm:px-2 py-1">Particular</th>
                  <th className="border px-1 py-1 w-[15%] text-center">Amount</th>
                </tr>
              </thead>
              <tbody style={{ verticalAlign: 'top' }}>
                <InvoiceHierarchyRows
                  items={displayItems}
                  variant="preview"
                  emptyMessage="No items added yet. Add items in the form to see them here."
                  renderOptions={{ showSubItems: true, hideZeroCostSubs: false }}
                />
              </tbody>
              <tfoot>
                <tr className="bg-[#d1d5dc]">
                  <td className="border px-1 py-2" colSpan={2}><strong>Total</strong></td>
                  <td className="border px-1 py-2 text-center">
                    <strong>
                      ₹{(totals.grandTotal || 0).toFixed(2)}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="invoice-footer flex justify-between mt-4">
            <div className="account-details w-[50%]">
              {companyInfo && <span>
                <p className="text-xs mb-1 underline"><strong>Bank Account Details</strong></p>

                <table className="w-full text-xs">
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
              <div className="Signature invoice-signature mt-2 mb-[6vw]">
                {currentCompany.signatureUrl && currentCompany.includeSignatureOnInvoice !== false && (
                  <img
                    src={resolveAssetUrl(currentCompany.signatureUrl)}
                    alt="Authorised Signature"
                    className="max-h-12 max-w-[180px] object-contain mb-1"
                    crossOrigin="anonymous"
                  />
                )}
                <p className="text-xs"><strong>Signature</strong></p>
              </div>

            </div>

            <div className="invoice-summary  w-[50%]">
              <table className="w-full text-left text-xs">
                <tbody>
                  <tr>
                    <td className="py-1"><strong>Taxable Amount:</strong></td>
                    <td className="py-1">
                      ₹{(totals.totalAmount || 0).toFixed(2)}
                    </td>
                  </tr>
                  {totals.totalGST > 0 && (
                    <>
                      <tr>
                        <td className="py-1"><strong>CGST:</strong></td>
                        <td className="py-1">
                          ₹{invoiceTotals.cgst.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1"><strong>SGST:</strong></td>
                        <td className="py-1">
                          ₹{invoiceTotals.sgst.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1"><strong>Total GST:</strong></td>
                        <td className="py-1">
                          ₹{(totals.totalGST || 0).toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="font-bold">
                    <td className="py-1">Grand Total:</td>
                    <td className="py-1">
                      ₹{(totals.grandTotal || 0).toFixed(2)}
                    </td>
                  </tr>
                  {totalWave > 0 && (
                    <tr>
                      <td className="py-1"><strong>Discount:</strong></td>
                      <td className="py-1 text-[#16a34a]">
                        -₹{totalWave.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {(totalPaid > 0 || totalWave > 0) && (
                    <>
                      {totalPaid > 0 && (
                        <tr>
                          <td className="py-1"><strong>Paid Amount:</strong></td>
                          <td className="py-1 text-[#16a34a]">
                            ₹{totalPaid.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-1"><strong>Balance Due:</strong></td>
                        <td className={`py-1 ${balanceAmount > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                          ₹{balanceAmount.toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
                <tfoot className="amount-in-words">
                  <tr>
                    <td colSpan={2}>
                      <hr className="border-[#99a1af] my-4" />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-xs" colSpan={2}>
                      <strong>Amount in Words:</strong> {
                        totals.grandTotal > 0 && !isNaN(totals.grandTotal)
                          ? toWords.convert(totals.grandTotal)
                          : 'Zero Rupees Only'
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