// PDF generation functionality
class PDFGenerator {
    // Generate PDF for printing
    static async generatePDF() {
        if (!Utils.validateForm()) {
            return;
        }

        const invoiceData = Utils.getFormData();
        await PDFGenerator.createPDFWindow(invoiceData, 'print');
    }


    // Add this method to get return details for PDF
    static async getReturnDetailsForPDF(invoiceNo) {
        try {
            const returns = await db.getReturnsByInvoice(invoiceNo);
            return returns;
        } catch (error) {
            console.error('Error getting return details for PDF:', error);
            return [];
        }
    }

    // Save as PDF file
    static async saveAsPDF() {
        if (!Utils.validateForm()) {
            return;
        }

        const invoiceData = Utils.getFormData();

        // Show loading indicator
        PDFGenerator.showLoading(true);

        try {
            // For Electron environment
            if (window.electronAPI) {
                const totalReturns = await Utils.calculateTotalReturns(invoiceData.invoiceNo);
                const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;
                const returnDetails = await PDFGenerator.getReturnDetailsForPDF(invoiceData.invoiceNo);
                const htmlContent = PDFGenerator.generateHTMLContent(invoiceData, totalReturns, adjustedBalanceDue, returnDetails);

                const result = await window.electronAPI.savePDF(htmlContent, `Invoice_${invoiceData.invoiceNo}.html`);

                if (result.success) {
                    PDFGenerator.showNotification('Invoice saved successfully! Open the file and use "Print > Save as PDF"', 'success');
                } else {
                    throw new Error(result.error || 'Failed to save invoice');
                }
            } else {
                // For browser environment - use the print dialog method
                await PDFGenerator.createPDFWindow(invoiceData, 'save');
            }
        } catch (error) {
            console.error('Save error:', error);
            PDFGenerator.showNotification('Error: ' + error.message, 'error');

            // Fallback to print method
            await PDFGenerator.createPDFWindow(invoiceData, 'save');
        } finally {
            PDFGenerator.showLoading(false);
        }
    }

    // Create PDF window for both print and save
    static async createPDFWindow(invoiceData, action = 'print') {
        const totalReturns = await Utils.calculateTotalReturns(invoiceData.invoiceNo);
        const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;

        // Get return details for the PDF
        const returnDetails = await PDFGenerator.getReturnDetailsForPDF(invoiceData.invoiceNo);

        // Create a new window for PDF
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            // If popup is blocked, show instructions
            PDFGenerator.showNotification('Popup blocked! Please allow popups and try again, or use Ctrl+P to print.', 'error');
            return;
        }

        const htmlContent = PDFGenerator.generateHTMLContent(invoiceData, totalReturns, adjustedBalanceDue, returnDetails);

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load
        setTimeout(() => {
            if (action === 'print') {
                printWindow.print();
            } else {
                // For browser save as PDF
                printWindow.document.title = `Invoice_${invoiceData.invoiceNo}`;
                printWindow.print();
            }

            // Close window after print dialog (with delay)
            setTimeout(() => {
                if (!printWindow.closed) {
                    printWindow.close();
                }
            }, 1000);
        }, 1000);
    }

    // Show loading indicator
    static showLoading(show) {
        let loader = document.getElementById('pdfLoading');
        if (!loader && show) {
            loader = document.createElement('div');
            loader.id = 'pdfLoading';
            loader.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;">
                    <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="margin-bottom: 10px;">Generating Invoice...</div>
                        <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            document.body.appendChild(loader);
        } else if (loader && !show) {
            loader.remove();
        }
    }

    // Show notification
    static showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.pdf-notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = 'pdf-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 400px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }


    // Add this method to PDFGenerator class
    static getImageBase64() {
        // Replace this with your actual base64 encoded image
        return 'data:image/png;base64,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'; // Your full base64 string here
    }


    // Update the generateHTMLContent method - REPLACE the entire method with this:
    static generateHTMLContent(invoiceData, totalReturns = 0, adjustedBalanceDue = 0, returnDetails = []) {
        // Convert image to base64 or use simple text replacement
        const hasImage = PDFGenerator.checkImageExists();

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>RSK ${invoiceData.invoiceNo}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 40px;
                    background: #fff;
                    position: relative;
                    color: #333;
                }
                .invoice-container {
                    position: relative;
                    z-index: 2;
                }
                /* Watermark */
                body::before {
                    content: "RSK ENTERPRISES";
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 100px;
                    color: rgba(200, 200, 200, 0.15);
                    font-weight: 900;
                    white-space: nowrap;
                    pointer-events: none;
                    z-index: 0;
                }
                /* Header */
                .invoice-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 2px solid #444;
                    padding-bottom: 15px;
                    margin-bottom: 25px;
                    text-align: left;
                }
                .company-info {
                    flex: 1;
                }
                .logo-placeholder {
                    width: 90px;
                    height: 90px;
                    background: #f0f0f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #ccc;
                    font-size: 12px;
                    color: #666;
                }
                .invoice-title {
                    text-align: right;
                }
                .company-details h2 {
                    margin: 0;
                    color: #2c3e50;
                    font-size: 26px;
                }
                .company-details p {
                    margin: 3px 0;
                    font-size: 13px;
                }
                .invoice-title h2 {
                    margin: 0;
                    color: #2c3e50;
                    font-size: 24px;
                    text-transform: uppercase;
                }
                .invoice-title div {
                    font-size: 14px;
                    margin-top: 4px;
                }
                /* Billing Info */
                .billing-info {
                    margin-bottom: 20px;
                }
                .bill-to {
                    border: 1px solid #555;
                    padding: 6px 10px;
                    border-radius: 6px;
                    background: #f4f4f4;
                    font-weight: 600;
                    color: #222;
                    line-height: 1.3;
                }
                .bill-to h3 {
                    margin: 0 0 5px 0;
                    color: #111;
                    font-size: 14px;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .bill-to p {
                    margin: 2px 0;
                    font-size: 13px;
                    color: #111;
                    font-weight: 600;
                }
                /* Table */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #ccc;
                    text-align: center;
                    padding: 8px;
                    font-size: 13px;
                }
                th {
                    background: wheat;
                    color: #1c1b1bff;
                }
                /* Return Table */
                .return-table {
                    margin-top: 20px;
                }
                .return-table h4 {
                    margin: 0 0 10px 0;
                    color: #2c3e50;
                    font-size: 14px;
                    text-align: center;
                    background: #fff4e6;
                    padding: 8px;
                    border-radius: 4px;
                    border-left: 4px solid #f39c12;
                }
                /* Payment Summary */
                .calculation-section {
                    margin-top: 25px;
                    display: flex;
                    justify-content: flex-end;
                }
                .payment-calculation {
                    width: 300px;
                    border: 1px solid #ccc;
                    padding: 10px 15px;
                    border-radius: 8px;
                    background: #fdfdfd;
                }
                .payment-calculation h3 {
                    margin-top: 0;
                    text-align: center;
                    font-size: 15px;
                    background: #2c3e50;
                    color: #fff;
                    padding: 5px 0;
                    border-radius: 6px;
                }
                .payment-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 6px 0;
                    font-size: 13px;
                }
                .payment-row.total {
                    font-weight: bold;
                    border-top: 1px solid #333;
                    padding-top: 6px;
                }
                .amount-return {
                    color: #e74c3c;
                    font-weight: bold;
                }
                .amount-negative {
                    color: #111;
                    font-weight: bold;
                }
                .amount-positive {
                    color: #27ae60;
                    font-weight: bold;
                }
                /* Return Info Box */
                .return-box {
                    margin-top: 20px;
                    padding: 10px 15px;
                    background: #fff4e6;
                    border-left: 4px solid #f39c12;
                    font-size: 13px;
                    border-radius: 5px;
                }
                /* Signature Section */
                .signature-section {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 50px;
                    font-size: 12px;
                }
                /* Print-specific developer credit */
                .developer-credit-print {
                    text-align: center;
                    margin: 20px 0 10px;
                    font-size: 11px;
                    color: #666;
                    page-break-inside: avoid;
                }

                @media print {
                    .developer-credit-print {
                        position: relative;
                        bottom: auto;
                        right: auto;
                    }
                    
                    /* Hide the floating version in print */
                    .developer-credit {
                        display: none !important;
                    }
                }

                @media screen {
                    .developer-credit-print {
                        display: none;
                    }
                }
                .signature-line {
                    border-top: 1px solid #333;
                    margin: 25px 0 5px;
                    width: 160px;
                }
                .declaration {
                    flex: 1;
                }
                .customer-signature, .company-signature {
                    text-align: center;
                    flex: 1;
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 20px;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <!-- Header Section -->
                <div class="invoice-header">
                    <div class="company-info">
                        <div class="company-details">
                            <h2>RSK ENTERPRISES</h2>
                            <p>76(3) PADMAVATHIPURAM, ANGERIPALAYAM ROAD,</p>
                            <p>TIRUPUR 641-602 | CELL: 8608127349</p>
                            <p>GSTIN: <b>33EQEPR2516A1ZB    </b></p>
                        </div>
                    </div>
        
                    <div class="invoice-title">
                        <h2>INVOICE DETAILS</h2>
                        <div><strong>Invoice No:</strong> ${invoiceData.invoiceNo}</div>
                        <div><strong>Date:</strong> ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</div>
                    </div>
                </div>

                <!-- Billing Information -->
                <div class="billing-info">
                    <div class="bill-to">
                        <h3>BILL TO</h3>
                        <p>Name: ${invoiceData.customerName}</p>
                        <p>Address: ${invoiceData.customerAddress || '-'}</p>
                    </div>
                </div>

                <!-- Products Table -->
                <table>
                    <thead>
                        <tr>
                            <th style="width: 8%">S.No.</th>
                            <th style="width: 52%">Product Description</th>
                            <th style="width: 10%">Qty</th>
                            <th style="width: 15%">Rate (₹)</th>
                            <th style="width: 15%">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceData.products.map(product => `
                            <tr>
                                <td>${product.sno}</td>
                                <td>${product.description}</td>
                                <td>${product.qty}</td>
                                <td>${Utils.formatCurrency(product.rate)}</td>
                                <td>${Utils.formatCurrency(product.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${totalReturns > 0 && returnDetails.length > 0 ? `
                <!-- Return Information Table -->
                <div class="return-table">
                    <h4>RETURN INFORMATION</h4>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%">Date</th>
                                <th style="width: 45%">Product</th>
                                <th style="width: 10%">Qty</th>
                                <th style="width: 15%">Rate (₹)</th>
                                <th style="width: 15%">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${returnDetails.map(returnItem => `
                                <tr>
                                    <td>${new Date(returnItem.returnDate).toLocaleDateString('en-IN')}</td>
                                    <td>${returnItem.description}</td>
                                    <td>${returnItem.qty}</td>
                                    <td>${Utils.formatCurrency(returnItem.rate)}</td>
                                    <td>${Utils.formatCurrency(returnItem.returnAmount)}</td>
                                </tr>
                            `).join('')}
                            <!-- Total Return Row -->
                            <tr style="background: #fff4e6; font-weight: bold;">
                                <td colspan="4" style="text-align: right;">Total Return Amount:</td>
                                <td>₹${Utils.formatCurrency(totalReturns)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                ` : ''}

                <!-- Calculation Section -->
                <div class="calculation-section">
                    <div class="payment-calculation">
                        <h3>PAYMENT SUMMARY</h3>
                        <div class="payment-row">
                            <label>Subtotal:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.subtotal)}</span>
                        </div>
                        <div class="payment-row">
                            <label>Previous Balance:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.previousBalance || 0)}</span>
                        </div>
                        <div class="payment-row total">
                            <label>Total Amount:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.grandTotal)}</span>
                        </div>
                        
                        ${invoiceData.paymentBreakdown ? `
                        <!-- Multiple Payment Methods Breakdown -->
                        <div class="payment-row">
                            <label>Cash Paid:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.paymentBreakdown.cash || 0)}</span>
                        </div>
                        <div class="payment-row">
                            <label>UPI Paid:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.paymentBreakdown.upi || 0)}</span>
                        </div>
                        <div class="payment-row">
                            <label>Account Paid:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.paymentBreakdown.account || 0)}</span>
                        </div>
                        <div class="payment-row total-paid">
                            <label>Total Amount Paid:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.amountPaid)}</span>
                        </div>
                        ` : `
                        <!-- Fallback for old invoices without paymentBreakdown -->
                        <div class="payment-row">
                            <label>Amount Paid:</label>
                            <span>₹${Utils.formatCurrency(invoiceData.amountPaid)}</span>
                        </div>
                        <div class="payment-row">
                            <label>Payment Method:</label>
                            <span style="font-weight: bold; ${invoiceData.paymentMethod === 'cash' ? 'color: #27ae60;' : 'color: #3498db;'}">
                                ${invoiceData.paymentMethod === 'cash' ? 'CASH' : (invoiceData.paymentMethod === 'gpay' ? 'GPAY' : 'ACCOUNT')}
                            </span>
                        </div>
                        `}
                        
                        ${totalReturns > 0 ? `
                        <div class="payment-row">
                            <label>Return Amount:</label>
                            <span class="amount-return">-₹${Utils.formatCurrency(totalReturns)}</span>
                        </div>
                        ` : ''}
                        
                        <div class="payment-row" style="border-bottom: none;">
                            <label>${totalReturns > 0 ? 'Adjusted Balance Due:' : 'Balance Due:'}</label>
                            <span class="${adjustedBalanceDue > 0 ? 'amount-negative' : 'amount-positive'}">
                                ₹${Utils.formatCurrency(totalReturns > 0 ? adjustedBalanceDue : invoiceData.balanceDue)}
                            </span>
                        </div>
                    </div>
                </div>

                ${totalReturns > 0 ? `
                <!-- Return Information Box -->
                <div class="return-box">
                    <strong>RETURN INFORMATION:</strong> This invoice has processed returns amounting to ₹${Utils.formatCurrency(totalReturns)}. 
                    The balance due has been adjusted accordingly.
                </div>
                ` : ''}

                <!-- Signature Section -->
                <div class="signature-section">
                    <div class="declaration">
                        <p>Certified that the particulars given above are true and correct</p>
                        <p>**TERMS & CONDITIONS APPLY</p>
                        <p>**E. & O.E.</p>
                    </div>
                    <div class="customer-signature">
                        <p>Agreed and accepted</p>
                        <p class="signature-line"></p>
                        <p>CUSTOMER SIGNATURE</p>
                    </div>
                    <div class="company-signature">
                        <p>For RSK ENTERPRISES</p>
                        <p class="signature-line"></p>
                        <p>AUTHORIZED SIGNATORY</p>
                    </div>
                </div>

                <!-- Developer Credit - Now part of the main flow -->
<div class="developer-credit-print">
    <p style="text-align: center; margin: 20px 0 10px; font-size: 11px; color: #666;">
        Software created by <strong>Sabarish R</strong>. For custom billing solutions, contact: 
        <span style="color: #007BFF; font-weight: bold;">7845081278</span>
    </p>
</div>

                <!-- Print Instructions -->
                <div class="no-print" style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #007bff;">
                    <h4 style="margin: 0 0 10px 0; color: #007bff;">Instructions:</h4>
                    <p style="margin: 5px 0; font-size: 12px;">• Press <strong>Ctrl+P</strong> to print this invoice</p>
                    <p style="margin: 5px 0; font-size: 12px;">• Choose <strong>"Save as PDF"</strong> as destination to save as PDF file</p>
                    <p style="margin: 5px 0; font-size: 12px;">• Make sure <strong>"Background graphics"</strong> is enabled in print settings</p>
                </div>
            </div>
        </body>
        </html>
    `;
    }

    // Check if image exists
    static checkImageExists() {
        // Simple check - you can implement actual image checking if needed
        return false; // For now, we'll use placeholder
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    const generatePDFBtn = document.getElementById('generatePDF');
    const saveAsPDFBtn = document.getElementById('saveAsPDF');

    if (generatePDFBtn) {
        generatePDFBtn.addEventListener('click', PDFGenerator.generatePDF);
    }

    if (saveAsPDFBtn) {
        saveAsPDFBtn.addEventListener('click', PDFGenerator.saveAsPDF);
    }
});