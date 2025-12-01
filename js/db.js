// db.js - Firebase Compatibility Version
class Database {
    constructor() {
        this.dbName = 'BillingDB';
        this.version = 2;
        this.db = null;
        this.firestore = null;
        this.initialized = false;

        // Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
        this.firebaseConfig = {
            apiKey: "AIzaSyB4uggcqtYonFXSnl8rUGbsgkk-nqchuy8",
            authDomain: "prnogst.firebaseapp.com",
            projectId: "prnogst",
            storageBucket: "prnogst.firebasestorage.app",
            messagingSenderId: "517006377488",
            appId: "1:517006377488:web:a0465788b8bcb4cd7bc095",
            measurementId: "G-9D28MJCD8N"
        };
    }

    // Initialize Firebase
    async init() {
        try {
            // Initialize Firebase
            firebase.initializeApp(this.firebaseConfig);
            this.firestore = firebase.firestore();

            // Enable offline persistence
            this.firestore.enablePersistence()
                .then(() => {
                    console.log('Firebase persistence enabled');
                })
                .catch((err) => {
                    console.log('Firebase persistence error:', err);
                    if (err.code == 'failed-precondition') {
                        console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                    } else if (err.code == 'unimplemented') {
                        console.log('The current browser doesn\'t support persistence');
                    }
                });

            this.initialized = true;
            console.log('Firebase initialized successfully');
            return this.firestore;

        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    // Helper method to check initialization
    _checkInit() {
        if (!this.initialized) {
            throw new Error('Database not initialized. Call init() first.');
        }
    }

    // Save invoice to Firebase
    async saveInvoice(invoiceData) {
        this._checkInit();
        try {
            await this.firestore.collection('invoices').doc(invoiceData.invoiceNo).set({
                ...invoiceData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Invoice saved successfully to Firebase');
            return invoiceData.invoiceNo;
        } catch (error) {
            console.error('Error saving invoice to Firebase:', error);
            throw error;
        }
    }

    // Save customer to Firebase
    async saveCustomer(customerData) {
        this._checkInit();
        try {
            await this.firestore.collection('customers').doc(customerData.phone).set({
                ...customerData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Customer saved successfully to Firebase');
            return customerData.phone;
        } catch (error) {
            console.error('Error saving customer to Firebase:', error);
            throw error;
        }
    }

    // Get customer by phone number
    async getCustomer(phone) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('customers').doc(phone);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting customer from Firebase:', error);
            throw error;
        }
    }


    // Add this method to your Database class in db.js
    async ensureInitialized() {
        if (!this.initialized && !this.initializing) {
            await this.init();
        } else if (this.initializing) {
            // Wait for initialization to complete
            await new Promise(resolve => {
                const checkInitialized = () => {
                    if (this.initialized) {
                        resolve();
                    } else {
                        setTimeout(checkInitialized, 100);
                    }
                };
                checkInitialized();
            });
        }
    }

    // Get all customers
    async getAllCustomers() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('customers').get();
            const customers = [];
            querySnapshot.forEach((doc) => {
                customers.push(doc.data());
            });
            return customers;
        } catch (error) {
            console.error('Error getting all customers from Firebase:', error);
            throw error;
        }
    }

    // In your db.js - Update the deleteCustomer method
    async deleteCustomer(phone) {
        this._checkInit();
        try {
            // First, get all invoices for this customer
            const invoicesQuery = await this.firestore.collection('invoices')
                .where('customerPhone', '==', phone)
                .get();

            // Delete all related invoices and their payments/returns
            const deletePromises = [];
            invoicesQuery.forEach((doc) => {
                const invoiceNo = doc.id;
                // Delete invoice and its related data
                deletePromises.push(this.deleteInvoice(invoiceNo));
            });

            await Promise.all(deletePromises);

            // Finally delete the customer
            await this.firestore.collection('customers').doc(phone).delete();
            console.log(`Customer ${phone} and all related data deleted successfully`);

        } catch (error) {
            console.error('Error deleting customer from Firebase:', error);
            throw error;
        }
    }

    // Delete return by ID
    async deleteReturn(returnId) {
        this._checkInit();
        try {
            await this.firestore.collection('returns').doc(returnId.toString()).delete();
            console.log('Return deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting return from Firebase:', error);
            throw error;
        }
    }

    // In db.js - Update deletePayment method
    async deletePayment(paymentId) {
        this._checkInit();
        try {
            console.log('Attempting to delete payment with ID:', paymentId);

            // First, get the payment data to know which invoice it belongs to
            const paymentDoc = await this.firestore.collection('payments').doc(paymentId).get();

            if (!paymentDoc.exists) {
                console.log('Payment not found with ID:', paymentId);
                // Try alternative ID formats
                const alternativeIds = [
                    paymentId.toString(),
                    `payment_${paymentId}`,
                    paymentId
                ];

                for (const altId of alternativeIds) {
                    const altDoc = await this.firestore.collection('payments').doc(altId).get();
                    if (altDoc.exists) {
                        console.log('Found payment with alternative ID:', altId);
                        const paymentData = altDoc.data();
                        const invoiceNo = paymentData.invoiceNo;

                        // Delete with alternative ID
                        await this.firestore.collection('payments').doc(altId).delete();
                        console.log('Payment deleted successfully from Firebase with alternative ID');

                        // Update the invoice
                        if (invoiceNo) {
                            await this.updateInvoiceAfterPaymentDeletion(invoiceNo, paymentData.amount);
                        }
                        return;
                    }
                }

                throw new Error(`Payment not found with any ID format: ${paymentId}`);
            }

            const paymentData = paymentDoc.data();
            const invoiceNo = paymentData.invoiceNo;

            // Delete the payment
            await this.firestore.collection('payments').doc(paymentId).delete();
            console.log('Payment deleted successfully from Firebase');

            // Update the invoice to reflect the payment deletion
            if (invoiceNo) {
                await this.updateInvoiceAfterPaymentDeletion(invoiceNo, paymentData.amount);
            }

        } catch (error) {
            console.error('Error deleting payment from Firebase:', error);
            throw error;
        }
    }

    // Helper method to update invoice after payment deletion
    async updateInvoiceAfterPaymentDeletion(invoiceNo, paymentAmount) {
        try {
            const invoiceData = await this.getInvoice(invoiceNo);
            if (invoiceData) {
                // Update payment breakdown
                if (invoiceData.paymentBreakdown) {
                    const paymentMethod = invoiceData.paymentMethod || 'cash';
                    invoiceData.paymentBreakdown[paymentMethod] = Math.max(
                        0,
                        (invoiceData.paymentBreakdown[paymentMethod] || 0) - paymentAmount
                    );
                }

                // Update totals
                invoiceData.amountPaid = Math.max(0, invoiceData.amountPaid - paymentAmount);
                invoiceData.balanceDue = invoiceData.grandTotal - invoiceData.amountPaid;

                // Save updated invoice
                await this.saveInvoice(invoiceData);

                // Update subsequent invoices
                await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);
            }
        } catch (error) {
            console.error('Error updating invoice after payment deletion:', error);
            throw error;
        }
    }

    // Get all invoices
    async getAllInvoices() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('invoices').get();
            const invoices = [];
            querySnapshot.forEach((doc) => {
                invoices.push(doc.data());
            });

            // Sort by invoice date descending (newest first)
            return invoices.sort((a, b) => {
                const dateA = a.invoiceDate ? new Date(a.invoiceDate) : new Date(0);
                const dateB = b.invoiceDate ? new Date(b.invoiceDate) : new Date(0);
                return dateB - dateA;
            });
        } catch (error) {
            console.error('Error getting all invoices from Firebase:', error);
            throw error;
        }
    }

    // Get invoice by invoice number
    async getInvoice(invoiceNo) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('invoices').doc(invoiceNo);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting invoice from Firebase:', error);
            throw error;
        }
    }

    // In db.js - Update savePayment method
    async savePayment(paymentData) {
        this._checkInit();
        try {
            // Use the paymentData.id if provided, otherwise generate a proper ID
            const paymentId = paymentData.id || `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const paymentToSave = {
                ...paymentData,
                id: paymentId, // Ensure ID is stored
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.firestore.collection('payments').doc(paymentId).set(paymentToSave);
            console.log('Payment saved successfully to Firebase with ID:', paymentId);
            return paymentId;
        } catch (error) {
            console.error('Error saving payment to Firebase:', error);
            throw error;
        }
    }

    // Get all payments for an invoice
    async getPaymentsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('payments')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const payments = [];
            querySnapshot.forEach((doc) => {
                payments.push(doc.data());
            });
            return payments;
        } catch (error) {
            console.error('Error getting payments from Firebase:', error);
            return [];
        }
    }

    // In your db.js - Update the deleteInvoice method
    async deleteInvoice(invoiceNo) {
        this._checkInit();
        try {
            // First, get the invoice data to know the customer and other details
            const invoiceData = await this.getInvoice(invoiceNo);
            if (!invoiceData) {
                console.log('Invoice not found, nothing to delete');
                return;
            }

            const customerName = invoiceData.customerName;
            const customerPhone = invoiceData.customerPhone;

            // Delete the invoice
            await this.firestore.collection('invoices').doc(invoiceNo).delete();
            console.log('Invoice deleted successfully from Firebase');

            // Delete related payments
            await this.deletePaymentsByInvoice(invoiceNo);

            // Delete related returns
            await this.deleteReturnsByInvoice(invoiceNo);

            // Update customer data if needed (remove reference to this invoice)
            await this.updateCustomerAfterInvoiceDeletion(customerPhone, invoiceNo);

            // Update subsequent invoices for this customer
            await Utils.updateSubsequentInvoices(customerName, invoiceNo);

            console.log(`Invoice ${invoiceNo} and all related data deleted successfully`);

        } catch (error) {
            console.error('Error deleting invoice from Firebase:', error);
            throw error;
        }
    }


    // Update customer data after invoice deletion
    async updateCustomerAfterInvoiceDeletion(customerPhone, invoiceNo) {
        if (!customerPhone) return;

        try {
            const customer = await this.getCustomer(customerPhone);
            if (customer) {
                // You can add logic here to update customer statistics if needed
                // For example, if you store invoice references in customer data
                console.log(`Customer ${customerPhone} updated after invoice deletion`);
            }
        } catch (error) {
            console.error('Error updating customer after invoice deletion:', error);
            // Don't throw error here as it's not critical
        }
    }


    // Delete all payments for an invoice
    async deletePaymentsByInvoice(invoiceNo) {
        try {
            const paymentsQuery = await this.firestore.collection('payments')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const deletePromises = [];
            paymentsQuery.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            console.log(`Deleted ${deletePromises.length} payments for invoice ${invoiceNo}`);
        } catch (error) {
            console.error('Error deleting payments:', error);
            throw error;
        }
    }



    // Delete all returns for an invoice
    async deleteReturnsByInvoice(invoiceNo) {
        try {
            const returnsQuery = await this.firestore.collection('returns')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const deletePromises = [];
            returnsQuery.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            console.log(`Deleted ${deletePromises.length} returns for invoice ${invoiceNo}`);
        } catch (error) {
            console.error('Error deleting returns:', error);
            throw error;
        }
    }


    // Save return record
    async saveReturn(returnData) {
        this._checkInit();
        try {
            // Use auto-generated ID or provided ID
            const returnId = returnData.id || Date.now().toString();

            await this.firestore.collection('returns').doc(returnId).set({
                ...returnData,
                id: returnId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Return saved successfully to Firebase');
            return returnId;
        } catch (error) {
            console.error('Error saving return to Firebase:', error);
            throw error;
        }
    }

    // Get all returns for an invoice
    async getReturnsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('returns')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const returns = [];
            querySnapshot.forEach((doc) => {
                returns.push(doc.data());
            });
            return returns;
        } catch (error) {
            console.error('Error getting returns from Firebase:', error);
            return [];
        }
    }

    // Get all returns
    async getAllReturns() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('returns').get();
            const returns = [];
            querySnapshot.forEach((doc) => {
                returns.push(doc.data());
            });
            return returns;
        } catch (error) {
            console.error('Error getting all returns from Firebase:', error);
            return [];
        }
    }

    // Migration function to export existing IndexedDB data
    async exportIndexedDBData() {
        // This would export data from your old IndexedDB
        // You'll need to implement this based on your current IndexedDB structure
        console.log('Export IndexedDB data function');
        return null;
    }
    // In your db.js - Add these methods to the Database class

    // Move invoice to recycle bin instead of permanent deletion
    async moveInvoiceToRecycleBin(invoiceNo) {
        this._checkInit();
        try {
            // Get the invoice data first
            const invoiceData = await this.getInvoice(invoiceNo);
            if (!invoiceData) {
                console.log('Invoice not found, nothing to move to recycle bin');
                return;
            }

            // Get related payments and returns
            const payments = await this.getPaymentsByInvoice(invoiceNo);
            const returns = await this.getReturnsByInvoice(invoiceNo);

            // Create recycle bin entry
            const recycleBinEntry = {
                id: `invoice_${invoiceNo}_${Date.now()}`,
                type: 'invoice',
                originalId: invoiceNo,
                data: invoiceData,
                payments: payments,
                returns: returns,
                deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                customerName: invoiceData.customerName,
                customerPhone: invoiceData.customerPhone,
                invoiceDate: invoiceData.invoiceDate,
                grandTotal: invoiceData.grandTotal
            };

            // Save to recycle bin
            await this.firestore.collection('recycleBin').doc(recycleBinEntry.id).set(recycleBinEntry);
            console.log('Invoice moved to recycle bin:', invoiceNo);

            // Now delete the original invoice and related data
            await this.firestore.collection('invoices').doc(invoiceNo).delete();

            // Delete related payments
            await this.deletePaymentsByInvoice(invoiceNo);

            // Delete related returns
            await this.deleteReturnsByInvoice(invoiceNo);

            // Update subsequent invoices
            await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

            console.log(`Invoice ${invoiceNo} moved to recycle bin and original data deleted`);

        } catch (error) {
            console.error('Error moving invoice to recycle bin:', error);
            throw error;
        }
    }

    // Get all items from recycle bin
    async getRecycleBinItems() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('recycleBin')
                .orderBy('deletedAt', 'desc')
                .get();

            const items = [];
            querySnapshot.forEach((doc) => {
                items.push(doc.data());
            });
            return items;
        } catch (error) {
            console.error('Error getting recycle bin items:', error);
            return [];
        }
    }

    // Restore item from recycle bin
    async restoreFromRecycleBin(itemId) {
        this._checkInit();
        try {
            // Get the recycle bin item
            const docRef = this.firestore.collection('recycleBin').doc(itemId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                throw new Error('Recycle bin item not found');
            }

            const item = docSnap.data();

            if (item.type === 'invoice') {
                // Restore invoice
                await this.firestore.collection('invoices').doc(item.originalId).set(item.data);

                // Restore payments
                if (item.payments && item.payments.length > 0) {
                    for (const payment of item.payments) {
                        await this.savePayment(payment);
                    }
                }

                // Restore returns
                if (item.returns && item.returns.length > 0) {
                    for (const returnItem of item.returns) {
                        await this.saveReturn(returnItem);
                    }
                }

                // Update subsequent invoices
                await Utils.updateSubsequentInvoices(item.data.customerName, item.originalId);
            }

            // Remove from recycle bin
            await docRef.delete();
            console.log(`Item ${itemId} restored from recycle bin`);

            return item.originalId;

        } catch (error) {
            console.error('Error restoring from recycle bin:', error);
            throw error;
        }
    }

    // Permanently delete from recycle bin
    async permanentDeleteFromRecycleBin(itemId) {
        this._checkInit();
        try {
            await this.firestore.collection('recycleBin').doc(itemId).delete();
            console.log('Item permanently deleted from recycle bin:', itemId);
        } catch (error) {
            console.error('Error permanently deleting from recycle bin:', error);
            throw error;
        }
    }

    // Empty entire recycle bin
    async emptyRecycleBin() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('recycleBin').get();

            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            console.log(`Recycle bin emptied: ${deletePromises.length} items deleted`);

            return deletePromises.length;
        } catch (error) {
            console.error('Error emptying recycle bin:', error);
            throw error;
        }
    }

    // Update the deleteInvoice method to use recycle bin
    async deleteInvoice(invoiceNo) {
        // Use the new recycle bin method instead of permanent deletion
        await this.moveInvoiceToRecycleBin(invoiceNo);
    }
    // Migration function to import data to Firebase
    async importToFirebase(data) {
        this._checkInit();
        try {
            // Import invoices
            if (data.invoices) {
                for (const invoice of data.invoices) {
                    await this.saveInvoice(invoice);
                }
            }

            // Import customers
            if (data.customers) {
                for (const customer of data.customers) {
                    await this.saveCustomer(customer);
                }
            }

            console.log('Data imported successfully to Firebase');
        } catch (error) {
            console.error('Error importing data to Firebase:', error);
            throw error;
        }
    }
}

// Create a global database instance
const db = new Database();