import { ToWords } from 'to-words';

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

export const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString('en-IN');
};

export const generateInvoiceNumber = (prefix: string, number: number): string => {
    return `${prefix}${number.toString().padStart(5, '0')}`;
};

export const amountToWords = (amount: number): string => {
    const toWords = new ToWords({
        localeCode: 'en-IN',
        converterOptions: {
            currency: true,
            ignoreDecimal: false,
            ignoreZeroCurrency: false,
        },
    });
    return toWords.convert(amount);
};

export const calculateGST = (amount: number, gstPercentage: number) => {
    const gstAmount = amount * (gstPercentage / 100);
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    const total = amount + gstAmount;

    return {
        gstAmount,
        cgst,
        sgst,
        total,
    };
};