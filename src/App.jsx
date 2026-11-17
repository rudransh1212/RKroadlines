import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, CheckCircle2, Clock, IndianRupee, Lock, Unlock, 
  Smartphone, Check, X, ShieldCheck, AlertCircle,
  FileDown, Loader2, Ban, XCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, onSnapshot
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';

// ============================================================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ============================================================================
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
     apiKey: "AIzaSyD88QWhAdCaIHpYB0iTx8DsJi13OkQv68Q",
  authDomain: "rkroadlines-2036f.firebaseapp.com",
  projectId: "rkroadlines-2036f",
  storageBucket: "rkroadlines-2036f.firebasestorage.app",
  messagingSenderId: "214161588566",
  appId: "1:214161588566:web:e53d5d6113663c309a16f7"

    };

let app, auth, db;
let isFirebaseConfigured = false;

try {
  if (firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("DemoKey")) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseConfigured = true;
  }
} catch (err) {
  console.warn("Firebase falling back to local mode:", err);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'vahan-bilti-simple-v1';

// Owner Security PIN
const OWNER_PIN = '1234';

// ============================================================================
// MAIN APPLICATION
// ============================================================================
export default function App() {
  // User / Auth / Sync States
  const [user, setUser] = useState(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [biltis, setBiltis] = useState([]);

  // Role State ('staff' or 'owner')
  const [role, setRole] = useState('staff');
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);

  // PIN Unlock Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Owner Create Bilti Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    lrNo: '',
    truckNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    destination: '',
    weight: '',
    rate: '',
    ownerName: ''
  });
  const [staffToFillFields, setStaffToFillFields] = useState({
    lrNo: false,
    truckNo: false,
    date: false,
    partyName: false,
    destination: false,
    weight: false,
    rate: false,
    ownerName: false
  });

  // Staff Fill Pending Fields Modal
  const [fillFieldsTargetBilti, setFillFieldsTargetBilti] = useState(null);
  const [staffFieldValues, setStaffFieldValues] = useState({});

  // Staff Advance Modal
  const [advanceTargetBilti, setAdvanceTargetBilti] = useState(null);
  const [advanceInput, setAdvanceInput] = useState('');

  // Owner Approval Modal
  const [payTargetBilti, setPayTargetBilti] = useState(null);
  const [paymentType, setPaymentType] = useState('Partial Payment'); // 'No Payment' | 'Partial Payment' | 'Full Payment'
  const [paymentMode, setPaymentMode] = useState('Netbanking'); // 'Cash' | 'Netbanking'
  const [paymentLocation, setPaymentLocation] = useState('Allahabad'); // 'Allahabad' | 'Satna'
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Payment Done Modal (Actual Payment Settlement with Cash & Netbanking Split)
  const [markDoneBilti, setMarkDoneBilti] = useState(null);
  const [actualPaymentDate, setActualPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [donePaymentLocation, setDonePaymentLocation] = useState('Allahabad');
  const [cashPaidInput, setCashPaidInput] = useState('');
  const [netbankingPaidInput, setNetbankingPaidInput] = useState('');

  // Reject Payment Approval Modal
  const [rejectTargetBilti, setRejectTargetBilti] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Cancel Bilti Confirmation Modal
  const [cancelTargetBilti, setCancelTargetBilti] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Helper to dynamically load script for PDF generation
  const loadExternalScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Generate & Download PDF of All Transactions
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      // Load jsPDF and AutoTable plugin dynamically
      if (!window.jspdf) {
        await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      if (!window.jspdf?.jsPDF?.API?.autoTable) {
        await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      // Top Brand Header Banner
      doc.setFillColor(15, 23, 42); // Slate-900
      doc.rect(0, 0, pageWidth, 68, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('RK ROADLINES', 40, 32);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text('Bilti Consignment & Payment Approval Ledger', 40, 50);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(`Generated on: ${today}`, pageWidth - 40, 32, { align: 'right' });
      doc.text(`Total Records: ${biltis.length}`, pageWidth - 40, 48, { align: 'right' });

      // Calculate Ledger Summary Metrics
      const activeBiltis = biltis.filter(item => item.status !== 'CANCELLED');
      const totalFreightSum = activeBiltis.reduce((acc, item) => acc + (Number(item.totalFreight) || 0), 0);
      const totalApprovedSum = activeBiltis.reduce((acc, item) => acc + (Number(item.advanceApproved || item.advancePaid) || 0), 0);
      const totalCashPaidSum = activeBiltis.reduce((acc, item) => acc + (Number(item.cashPaid) || 0), 0);
      const totalNetbankingPaidSum = activeBiltis.reduce((acc, item) => acc + (Number(item.netbankingPaid) || 0), 0);
      const totalPaidSum = totalCashPaidSum + totalNetbankingPaidSum;
      const totalBalanceSum = totalFreightSum - (totalPaidSum > 0 ? totalPaidSum : totalApprovedSum);

      // Summary Box Strip
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.roundedRect(40, 82, pageWidth - 80, 42, 4, 4, 'FD');

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL FREIGHT', 52, 98);
      doc.text('ADV. APPROVED', 195, 98);
      doc.text('PAID IN CASH', 340, 98);
      doc.text('PAID IN NETBANKING', 485, 98);
      doc.text('BALANCE DUE', 655, 98);

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${totalFreightSum.toLocaleString('en-IN')}`, 52, 114);

      doc.setTextColor(217, 119, 6); // Amber-600
      doc.text(`Rs. ${totalApprovedSum.toLocaleString('en-IN')}`, 195, 114);

      doc.setTextColor(5, 150, 105); // Emerald-600
      doc.text(`Rs. ${totalCashPaidSum.toLocaleString('en-IN')}`, 340, 114);

      doc.setTextColor(37, 99, 235); // Blue-600
      doc.text(`Rs. ${totalNetbankingPaidSum.toLocaleString('en-IN')}`, 485, 114);

      doc.setTextColor(180, 83, 9);
      doc.text(`Rs. ${totalBalanceSum.toLocaleString('en-IN')}`, 655, 114);

      // Prepare Rows for AutoTable
      const tableRows = biltis.map((item, index) => {
        const isCancelled = item.status === 'CANCELLED';
        const isRejected = item.status === 'ADVANCE_REJECTED';
        const approvedAmt = Number(item.advanceApproved || item.advancePaid || 0);
        const cashPaid = Number(item.cashPaid || 0);
        const netbankingPaid = Number(item.netbankingPaid || 0);
        const isDone = item.status === 'PAYMENT_DONE';
        const effectivePaid = isDone ? (cashPaid + netbankingPaid) : approvedAmt;
        const remainingDue = isCancelled ? 0 : (Number(item.totalFreight) || 0) - effectivePaid;
        
        let statusText = 'Available';
        if (item.status === 'ADVANCE_REQUESTED') statusText = 'Approval Pending';
        if (item.status === 'ADVANCE_APPROVED' || item.status === 'ADVANCE_PAID') statusText = 'Approved';
        if (isDone) statusText = 'Payment Done';
        if (isRejected) statusText = 'Not Approved';
        if (isCancelled) statusText = 'Cancelled';

        return [
          index + 1,
          item.lrNo || item.biltiNo || '-',
          item.truckNo || '-',
          item.date || '-',
          item.partyName || '-',
          item.destination || '-',
          `${item.weight} MT`,
          `Rs. ${item.rate}`,
          `Rs. ${(item.totalFreight || 0).toLocaleString('en-IN')}`,
          `Rs. ${approvedAmt.toLocaleString('en-IN')}`,
          item.paymentType || '-',
          item.paymentLocation || '-',
          isDone ? `Rs. ${cashPaid.toLocaleString('en-IN')}` : '-',
          isDone ? `Rs. ${netbankingPaid.toLocaleString('en-IN')}` : '-',
          item.approvalDate || '-',
          item.paymentDate || '-',
          item.actualPaymentDate || '-',
          `Rs. ${remainingDue.toLocaleString('en-IN')}`,
          statusText
        ];
      });

      doc.autoTable({
        startY: 135,
        head: [[
          '#', 
          'LR No.', 
          'Truck No.', 
          'Inv. Date', 
          'Party Name', 
          'Dest.', 
          'Wt.', 
          'Rate', 
          'Freight', 
          'Approved', 
          'Pay Type',
          'Location',
          'Cash Paid',
          'Netbanking',
          'Approval Dt',
          'Set Pay Dt',
          'Actual Dt',
          'Balance', 
          'Status'
        ]],
        body: tableRows,
        theme: 'striped',
        styles: {
          fontSize: 5.3,
          font: 'helvetica',
          cellPadding: 2.2,
          valign: 'middle',
          textColor: [15, 23, 42]
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 5.3,
          halign: 'left'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { fontStyle: 'bold', cellWidth: 36 },
          2: { cellWidth: 44 },
          3: { cellWidth: 38 },
          4: { cellWidth: 48 },
          5: { cellWidth: 40 },
          6: { cellWidth: 28 },
          7: { cellWidth: 30 },
          8: { cellWidth: 42, fontStyle: 'bold' },
          9: { cellWidth: 42, fontStyle: 'bold' },
          10: { cellWidth: 40 },
          11: { cellWidth: 38, fontStyle: 'bold' },
          12: { cellWidth: 40, textColor: [5, 150, 105], fontStyle: 'bold' },
          13: { cellWidth: 42, textColor: [37, 99, 235], fontStyle: 'bold' },
          14: { cellWidth: 39 },
          15: { cellWidth: 39 },
          16: { cellWidth: 39, fontStyle: 'bold' },
          17: { cellWidth: 42, textColor: [180, 83, 9] },
          18: { cellWidth: 40 }
        },
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'RK RoadLines • Official Transport Consignment Ledger',
            40,
            doc.internal.pageSize.getHeight() - 20
          );
          doc.text(
            `Page ${doc.internal.getNumberOfPages()}`,
            pageWidth - 40,
            doc.internal.pageSize.getHeight() - 20,
            { align: 'right' }
          );
        }
      });

      const fileName = `RK_RoadLines_Transactions_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 1. Firebase Auth
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setIsFirebaseConnected(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Listener
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user) return;

    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'bilties');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setBiltis(items);
    }, (error) => {
      console.error("Firestore error:", error);
      setIsFirebaseConnected(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Role Switching Logic
  const handleSelectRole = (selectedRole) => {
    if (selectedRole === 'staff') {
      setRole('staff');
    } else if (selectedRole === 'owner') {
      if (isOwnerUnlocked) {
        setRole('owner');
      } else {
        setPinInput('');
        setPinError('');
        setShowPinModal(true);
      }
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === OWNER_PIN) {
      setIsOwnerUnlocked(true);
      setRole('owner');
      setShowPinModal(false);
      setPinError('');
    } else {
      setPinError('Wrong PIN (Hint: 1234)');
    }
  };

  // Owner Creates a New Bilti
  const handleCreateBilti = async (e) => {
    e.preventDefault();
    const pendingList = Object.keys(staffToFillFields).filter((k) => staffToFillFields[k]);

    // Validate all fields NOT delegated to staff
    if (!staffToFillFields.lrNo && !formData.lrNo.trim()) return;
    if (!staffToFillFields.truckNo && !formData.truckNo.trim()) return;
    if (!staffToFillFields.date && !formData.date) return;
    if (!staffToFillFields.partyName && !formData.partyName.trim()) return;
    if (!staffToFillFields.destination && !formData.destination.trim()) return;
    if (!staffToFillFields.ownerName && !formData.ownerName.trim()) return;

    const w = parseFloat(formData.weight);
    const r = parseFloat(formData.rate);
    if (!staffToFillFields.weight && (isNaN(w) || w <= 0)) return;
    if (!staffToFillFields.rate && (isNaN(r) || r <= 0)) return;

    setIsSubmitting(true);
    const finalWeight = staffToFillFields.weight ? 0 : w;
    const finalRate = staffToFillFields.rate ? 0 : r;
    const totalFreight = finalWeight > 0 && finalRate > 0 ? Math.round(finalWeight * finalRate) : 0;

    const newBilti = {
      lrNo: staffToFillFields.lrNo ? '' : formData.lrNo.trim().toUpperCase(),
      truckNo: staffToFillFields.truckNo ? '' : formData.truckNo.trim().toUpperCase(),
      date: staffToFillFields.date ? '' : formData.date,
      partyName: staffToFillFields.partyName ? '' : formData.partyName.trim(),
      destination: staffToFillFields.destination ? '' : formData.destination.trim(),
      ownerName: staffToFillFields.ownerName ? '' : formData.ownerName.trim(),
      weight: finalWeight,
      rate: finalRate,
      totalFreight,
      staffPendingFields: pendingList,
      status: 'AVAILABLE',
      advanceRequested: 0,
      advanceApproved: 0,
      cashPaid: 0,
      netbankingPaid: 0,
      paymentType: '',
      paymentMode: '',
      paymentLocation: '',
      approvalDate: '',
      paymentDate: '',
      actualPaymentDate: '',
      createdAt: Date.now()
    };

    try {
      if (isFirebaseConnected && db) {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'bilties');
        await addDoc(colRef, newBilti);
      } else {
        setBiltis(prev => [{ id: `local-${Date.now()}`, ...newBilti }, ...prev]);
      }
      setShowCreateModal(false);
      setFormData({
        lrNo: '',
        truckNo: '',
        date: new Date().toISOString().split('T')[0],
        partyName: '',
        destination: '',
        weight: '',
        rate: '',
        ownerName: ''
      });
      setStaffToFillFields({
        lrNo: false,
        truckNo: false,
        date: false,
        partyName: false,
        destination: false,
        weight: false,
        rate: false,
        ownerName: false
      });
    } catch (err) {
      console.error("Failed to create bilti:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Staff Submits Delegated Bilti Fields
  const handleStaffFillFieldsSubmit = async (e) => {
    e.preventDefault();
    if (!fillFieldsTargetBilti) return;
    const pending = fillFieldsTargetBilti.staffPendingFields || [];

    // Validate all requested fields are properly entered
    for (const field of pending) {
      const val = staffFieldValues[field];
      if (field === 'weight' || field === 'rate') {
        const num = parseFloat(val);
        if (isNaN(num) || num <= 0) return;
      } else {
        if (!val || !String(val).trim()) return;
      }
    }

    setIsSubmitting(true);
    const updatedWeight = pending.includes('weight')
      ? parseFloat(staffFieldValues.weight)
      : Number(fillFieldsTargetBilti.weight || 0);
    const updatedRate = pending.includes('rate')
      ? parseFloat(staffFieldValues.rate)
      : Number(fillFieldsTargetBilti.rate || 0);
    const updatedFreight =
      updatedWeight > 0 && updatedRate > 0 ? Math.round(updatedWeight * updatedRate) : 0;

    const updatePayload = {
      ...(pending.includes('lrNo') && { lrNo: staffFieldValues.lrNo.trim().toUpperCase() }),
      ...(pending.includes('truckNo') && { truckNo: staffFieldValues.truckNo.trim().toUpperCase() }),
      ...(pending.includes('date') && { date: staffFieldValues.date }),
      ...(pending.includes('partyName') && { partyName: staffFieldValues.partyName.trim() }),
      ...(pending.includes('destination') && { destination: staffFieldValues.destination.trim() }),
      ...(pending.includes('ownerName') && { ownerName: staffFieldValues.ownerName.trim() }),
      ...(pending.includes('weight') && { weight: updatedWeight }),
      ...(pending.includes('rate') && { rate: updatedRate }),
      totalFreight: updatedFreight,
      staffPendingFields: []
    };

    try {
      if (isFirebaseConnected && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', fillFieldsTargetBilti.id);
        await updateDoc(docRef, updatePayload);
      } else {
        setBiltis(prev =>
          prev.map(b => (b.id === fillFieldsTargetBilti.id ? { ...b, ...updatePayload } : b))
        );
      }
      setFillFieldsTargetBilti(null);
      setStaffFieldValues({});
    } catch (err) {
      console.error("Error saving staff bilti fields:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Staff Submits Payment Approval Request
  const handleSendAdvanceRequest = async (e) => {
    e.preventDefault();
    if (!advanceTargetBilti) return;
    const reqAmount = parseFloat(advanceInput);
    if (isNaN(reqAmount) || reqAmount <= 0 || reqAmount > advanceTargetBilti.totalFreight) return;

    setIsSubmitting(true);
    const updatePayload = {
      status: 'ADVANCE_REQUESTED',
      advanceRequested: reqAmount,
      requestedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      if (isFirebaseConnected && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', advanceTargetBilti.id);
        await updateDoc(docRef, updatePayload);
      } else {
        setBiltis(prev => prev.map(b => b.id === advanceTargetBilti.id ? { ...b, ...updatePayload } : b));
      }
      setAdvanceTargetBilti(null);
      setAdvanceInput('');
    } catch (err) {
      console.error("Error submitting advance request:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Owner Approves Advance & Sets Scheduled Payment Date, Type & Mode
  const handleOwnerConfirmOk = async () => {
    if (!payTargetBilti) return;
    if (paymentType !== 'No Payment' && !paymentDate) return;
    setIsSubmitting(true);

    const todayStr = new Date().toISOString().split('T')[0];
    const finalApprovedAmt =
      paymentType === 'No Payment'
        ? 0
        : paymentType === 'Full Payment'
        ? payTargetBilti.totalFreight
        : payTargetBilti.advanceRequested;

    const approvalData = {
      status: 'ADVANCE_APPROVED',
      advanceApproved: finalApprovedAmt,
      paymentType: paymentType,
      paymentMode: paymentType === 'No Payment' ? 'N/A' : paymentMode,
      paymentLocation: paymentType === 'No Payment' ? 'N/A' : paymentLocation,
      approvalDate: todayStr,
      paymentDate: paymentType === 'No Payment' ? '-' : paymentDate,
      approvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      if (isFirebaseConnected && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', payTargetBilti.id);
        await updateDoc(docRef, approvalData);
      } else {
        setBiltis(prev => prev.map(b => b.id === payTargetBilti.id ? { ...b, ...approvalData } : b));
      }
      setPayTargetBilti(null);
    } catch (err) {
      console.error("Error confirming payment approval:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Owner Marks Payment Done (Records Actual Payment Date & Cash vs Netbanking Split)
  const handleMarkPaymentDone = async (e) => {
    e.preventDefault();
    if (!markDoneBilti || !actualPaymentDate) return;

    const cashVal = parseFloat(cashPaidInput) || 0;
    const netbankingVal = parseFloat(netbankingPaidInput) || 0;
    const totalDisbursed = cashVal + netbankingVal;

    if (cashVal < 0 || netbankingVal < 0 || totalDisbursed > markDoneBilti.totalFreight) {
      return;
    }

    setIsSubmitting(true);
    const derivedMode =
      cashVal > 0 && netbankingVal > 0
        ? 'Cash + Netbanking'
        : cashVal > 0
        ? 'Cash'
        : netbankingVal > 0
        ? 'Netbanking'
        : 'N/A';

    const donePayload = {
      status: 'PAYMENT_DONE',
      actualPaymentDate,
      paymentLocation: donePaymentLocation,
      cashPaid: cashVal,
      netbankingPaid: netbankingVal,
      paymentMode: derivedMode,
      paidDoneAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      if (isFirebaseConnected && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', markDoneBilti.id);
        await updateDoc(docRef, donePayload);
      } else {
        setBiltis(prev => prev.map(b => b.id === markDoneBilti.id ? { ...b, ...donePayload } : b));
      }
      setMarkDoneBilti(null);
    } catch (err) {
      console.error("Error marking payment done:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Owner Rejects / Does Not Approve Payment Request
  const handleRejectPaymentRequest = async (e) => {
    e.preventDefault();
    if (!rejectTargetBilti) return;
    setIsSubmitting(true);

    const todayStr = new Date().toISOString().split('T')[0];
    const rejectPayload = {
      status: 'ADVANCE_REJECTED',
      advanceApproved: 0,
      rejectionReason: rejectReason.trim() || 'Not approved by Owner',
      rejectedDate: todayStr
    };

    try {
      if (isFirebaseConnected && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', rejectTargetBilti.id);
        await updateDoc(docRef, rejectPayload);
      } else {
        setBiltis(prev => prev.map(b => b.id === rejectTargetBilti.id ? { ...b, ...rejectPayload } : b));
      }
      setRejectTargetBilti(null);
      setRejectReason('');
    } catch (err) {
      console.error("Error rejecting payment approval:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Owner Cancels a Particular Bilti
  const handleCancelBilti = async (e) => {
    e.preventDefault();
    if (!cancelTargetBilti) return;
    setIsSubmitting(true);

    const todayStr = new Date().toISOString().split('T')[0];
    const cancelPayload = {
      status: 'CANCELLED',
      cancelReason: cancelReason.trim() || 'Cancelled by Owner',
      cancelledDate: todayStr
    };

    try {
      if (isFirebaseConnected && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', cancelTargetBilti.id);
        await updateDoc(docRef, cancelPayload);
      } else {
        setBiltis(prev => prev.map(b => b.id === cancelTargetBilti.id ? { ...b, ...cancelPayload } : b));
      }
      setCancelTargetBilti(null);
      setCancelReason('');
    } catch (err) {
      console.error("Error cancelling bilti:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pending Action Count for Owner Badge
  const pendingCount = biltis.filter(b => b.status === 'ADVANCE_REQUESTED').length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex justify-center">
      {/* Mobile-first Centered App Container */}
      <div className="w-full max-w-md bg-slate-50 min-h-screen shadow-xl flex flex-col relative border-x border-slate-200">
        
        {/* SIMPLE TOP HEADER */}
        <header className="bg-slate-900 text-white px-4 py-3.5 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-1.5 rounded-lg text-slate-950">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">RK RoadLines</h1>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Transport & Freight Portal
              </span>
            </div>
          </div>

          {/* Role Toggle Pill */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => handleSelectRole('staff')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                role === 'staff' 
                  ? 'bg-amber-500 text-slate-950 shadow' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Staff
            </button>
            <button
              onClick={() => handleSelectRole('owner')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition relative ${
                role === 'owner' 
                  ? 'bg-emerald-600 text-white shadow' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {isOwnerUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              <span>Owner</span>
              {pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>
          </div>
        </header>

        {/* OWNER ACTION BAR (Only visible to Owner) */}
        {role === 'owner' && (
          <div className="bg-emerald-950 text-white px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-300">Owner Mode Active</p>
              <p className="text-[11px] text-slate-400 truncate">Post bilti & export PDF</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf || biltis.length === 0}
                title="Download PDF Ledger of All Transactions"
                className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <FileDown className="w-4 h-4 text-emerald-400" />
                )}
                <span>PDF</span>
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Post Bilti</span>
              </button>
            </div>
          </div>
        )}

        {/* STAFF INSTRUCTION BAR (Only visible to Staff) */}
        {role === 'staff' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between">
            <span>Tap any Bilti below to send payment approval request.</span>
            <span className="font-bold text-amber-700">{biltis.length} Biltis</span>
          </div>
        )}

        {/* MAIN FEED OF BILTIS */}
        <main className="flex-1 p-4 space-y-3.5 overflow-y-auto pb-12">
          {biltis.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white rounded-2xl border border-slate-200">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Biltis Posted Yet</p>
              <p className="text-xs text-slate-500 mt-1">
                {role === 'owner' 
                  ? 'Tap "+ Post Bilti" above to create your first consignment.' 
                  : 'Waiting for Owner to publish a Bilti.'}
              </p>
            </div>
          ) : (
            biltis.map((b) => {
              const isRequested = b.status === 'ADVANCE_REQUESTED';
              const isApproved = b.status === 'ADVANCE_APPROVED' || b.status === 'ADVANCE_PAID';
              const isPaymentDone = b.status === 'PAYMENT_DONE';
              const isRejected = b.status === 'ADVANCE_REJECTED';
              const isCancelled = b.status === 'CANCELLED';
              const pendingFields = b.staffPendingFields || [];
              const hasPendingFields = pendingFields.length > 0;
              const approvedAmt = Number(b.advanceApproved || b.advancePaid || 0);
              const cashPaidAmt = Number(b.cashPaid || 0);
              const netbankingPaidAmt = Number(b.netbankingPaid || 0);
              const totalSettledAmt = isPaymentDone ? (cashPaidAmt + netbankingPaidAmt) : approvedAmt;

              return (
                <div 
                  key={b.id} 
                  className={`bg-white rounded-2xl p-4 border shadow-xs transition ${
                    isCancelled
                      ? 'border-slate-300 bg-slate-100/70 opacity-80'
                      : isRejected
                      ? 'border-rose-300 bg-rose-50/20'
                      : isRequested 
                      ? 'border-amber-400 ring-2 ring-amber-400/20' 
                      : isPaymentDone
                      ? 'border-blue-300 bg-blue-50/20'
                      : isApproved 
                      ? 'border-emerald-300 bg-emerald-50/20' 
                      : 'border-slate-200'
                  }`}
                >
                  {/* Card Top: LR No, Truck No, Date & Status Pill */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pendingFields.includes('lrNo') ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            LR No: Staff to fill
                          </span>
                        ) : (
                          <span className={`text-sm font-black tracking-tight ${isCancelled ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                            {b.lrNo || b.biltiNo}
                          </span>
                        )}
                        {pendingFields.includes('truckNo') ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Truck: Staff to fill
                          </span>
                        ) : (
                          b.truckNo && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {b.truckNo}
                            </span>
                          )
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Inv. Date:{' '}
                        {pendingFields.includes('date') ? (
                          <span className="font-semibold text-amber-700">Staff to fill</span>
                        ) : (
                          b.date || '-'
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Status Badge */}
                      {b.status === 'AVAILABLE' && (
                        hasPendingFields ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Staff Details Pending
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Available
                          </span>
                        )
                      )}
                      {isRequested && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-pulse" />
                          Approval Req
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Not Approved
                        </span>
                      )}
                      {isApproved && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Approved
                        </span>
                      )}
                      {isPaymentDone && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Payment Done
                        </span>
                      )}
                      {isCancelled && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          Cancelled
                        </span>
                      )}

                      {/* Owner Cancel Bilti Button (Available on non-cancelled, non-completed biltis) */}
                      {role === 'owner' && !isCancelled && !isPaymentDone && (
                        <button
                          onClick={() => {
                            setCancelReason('');
                            setCancelTargetBilti(b);
                          }}
                          title="Cancel Bilti"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Consignment Details (Party, Destination, Owner) */}
                  <div className="mb-3 px-2.5 py-2 bg-slate-50/80 rounded-xl border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Party:</span>
                      {pendingFields.includes('partyName') ? (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 rounded">Staff to fill</span>
                      ) : (
                        <span className="font-semibold text-slate-800 text-right truncate">{b.partyName || '-'}</span>
                      )}
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Destination:</span>
                      {pendingFields.includes('destination') ? (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 rounded">Staff to fill</span>
                      ) : (
                        <span className="font-semibold text-slate-800 text-right truncate">{b.destination || '-'}</span>
                      )}
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400">Owner:</span>
                      {pendingFields.includes('ownerName') ? (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 rounded">Staff to fill</span>
                      ) : (
                        <span className="font-semibold text-slate-800 text-right truncate">{b.ownerName || '-'}</span>
                      )}
                    </div>
                  </div>

                  {/* Card Middle: Weight, Rate & Total Freight */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Weight</span>
                      {pendingFields.includes('weight') ? (
                        <span className="text-[10px] font-bold text-amber-700">Staff to fill</span>
                      ) : (
                        <span className="text-xs font-bold text-slate-800">{b.weight} MT</span>
                      )}
                    </div>
                    <div className="border-x border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Rate/MT</span>
                      {pendingFields.includes('rate') ? (
                        <span className="text-[10px] font-bold text-amber-700">Staff to fill</span>
                      ) : (
                        <span className="text-xs font-bold text-slate-800">₹{b.rate}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Freight</span>
                      {pendingFields.includes('weight') || pendingFields.includes('rate') ? (
                        <span className="text-[10px] font-bold text-slate-400">Pending</span>
                      ) : (
                        <span className="text-xs font-black text-slate-900">
                          ₹{b.totalFreight?.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom: Role-specific Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    {/* Staff Pending Fields Action Banner */}
                    {hasPendingFields && !isCancelled && (
                      role === 'staff' ? (
                        <button
                          onClick={() => {
                            const initVals = {};
                            pendingFields.forEach((f) => {
                              initVals[f] = f === 'date' ? new Date().toISOString().split('T')[0] : '';
                            });
                            setStaffFieldValues(initVals);
                            setFillFieldsTargetBilti(b);
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <span>Fill Pending Bilti Details ({pendingFields.length})</span>
                        </button>
                      ) : (
                        <p className="text-[11px] text-center text-amber-700 bg-amber-50 py-1.5 px-2 rounded-xl border border-amber-200">
                          Waiting for staff to fill {pendingFields.length} delegated field(s)
                        </p>
                      )
                    )}
                    
                    {/* STATE 1: Available for Payment Approval Request */}
                    {b.status === 'AVAILABLE' && (
                      role === 'staff' ? (
                        <button
                          disabled={pendingFields.includes('weight') || pendingFields.includes('rate') || b.totalFreight <= 0}
                          onClick={() => {
                            setAdvanceTargetBilti(b);
                            setAdvanceInput('');
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {pendingFields.includes('weight') || pendingFields.includes('rate')
                              ? 'Fill Weight & Rate First to Request Advance'
                              : 'Request Payment Approval'}
                          </span>
                        </button>
                      ) : (
                        !hasPendingFields && (
                          <p className="text-[11px] text-center text-slate-400">
                            Waiting for staff to request payment approval
                          </p>
                        )
                      )
                    )}

                    {/* STATE 2: Staff Has Sent Payment Approval Request */}
                    {isRequested && (
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-xs bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                          <span className="text-amber-900 font-medium">Approval Requested:</span>
                          <span className="text-sm font-black font-mono text-amber-950">
                            ₹{b.advanceRequested?.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {role === 'owner' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setRejectReason('');
                                setRejectTargetBilti(b);
                              }}
                              className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 active:scale-[0.99] text-xs font-bold transition flex items-center justify-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Do Not Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setPaymentDate(new Date().toISOString().split('T')[0]);
                                const autoType = b.advanceRequested >= b.totalFreight ? 'Full Payment' : 'Partial Payment';
                                setPaymentType(autoType);
                                setPaymentMode('Netbanking');
                                setPaymentLocation('Allahabad');
                                setPayTargetBilti(b);
                              }}
                              className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 text-xs font-black transition flex items-center justify-center gap-1 shadow-sm"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-center text-amber-800 bg-amber-100/80 py-2 rounded-xl">
                            Approval request sent to Owner. Waiting for approval.
                          </div>
                        )}
                      </div>
                    )}

                    {/* STATE 2B: Owner Did Not Approve Request */}
                    {isRejected && (
                      <div className="space-y-2">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-rose-800">Payment Approval Rejected</span>
                            <span className="text-[10px] text-rose-600 font-mono">
                              Req: ₹{b.advanceRequested?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          {b.rejectionReason && (
                            <p className="text-[11px] text-rose-700 mt-1">Reason: {b.rejectionReason}</p>
                          )}
                        </div>
                        {role === 'staff' && (
                          <button
                            onClick={() => {
                              setAdvanceTargetBilti(b);
                              setAdvanceInput('');
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                          >
                            <IndianRupee className="w-3.5 h-3.5 text-amber-400" />
                            <span>Request Approval Again</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* STATE 5: Cancelled Bilti */}
                    {isCancelled && (
                      <div className="bg-slate-200/70 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-700 flex items-center justify-between">
                        <div>
                          <span className="font-bold block text-slate-800">Bilti Cancelled</span>
                          {b.cancelReason && (
                            <span className="text-[11px] text-slate-600">Note: {b.cancelReason}</span>
                          )}
                        </div>
                        {b.cancelledDate && (
                          <span className="text-[10px] font-mono text-slate-500">{b.cancelledDate}</span>
                        )}
                      </div>
                    )}

                    {/* STATE 3: Owner Has Approved & Scheduled Payment Date */}
                    {isApproved && (
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="text-emerald-800 font-bold block">
                              Advance Approved: ₹{approvedAmt.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-600 block mt-0.5">
                              Type: <span className="font-bold text-slate-800">{b.paymentType || 'Partial Payment'}</span> • Mode: <span className="font-bold text-slate-800">{b.paymentMode || 'Netbanking'}</span>
                            </span>
                            <span className="text-[10px] text-slate-600 block mt-0.5">
                              Location: <span className="font-bold text-slate-800">{b.paymentLocation || 'Allahabad'}</span>
                            </span>
                            <span className="text-[10px] text-slate-600 block mt-0.5">
                              Approval Dt: <span className="font-semibold">{b.approvalDate || '-'}</span> • Set Pay Dt: <span className="font-semibold text-emerald-700">{b.paymentDate || '-'}</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Remaining Balance:</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              ₹{(b.totalFreight - approvedAmt).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {role === 'owner' && (
                          <button
                            onClick={() => {
                              setActualPaymentDate(new Date().toISOString().split('T')[0]);
                              setDonePaymentLocation(b.paymentLocation && b.paymentLocation !== 'N/A' ? b.paymentLocation : 'Allahabad');
                              if (b.paymentType === 'No Payment' || approvedAmt === 0) {
                                setCashPaidInput('0');
                                setNetbankingPaidInput('0');
                              } else if (b.paymentMode === 'Cash') {
                                setCashPaidInput(approvedAmt.toString());
                                setNetbankingPaidInput('0');
                              } else {
                                setCashPaidInput('0');
                                setNetbankingPaidInput(approvedAmt.toString());
                              }
                              setMarkDoneBilti(b);
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Payment Done</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* STATE 4: Payment Done (Actual Date + Cash & Netbanking Split) */}
                    {isPaymentDone && (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-blue-900 font-bold block">
                              Total Paid: ₹{totalSettledAmt.toLocaleString('en-IN')}
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                                Cash: ₹{cashPaidAmt.toLocaleString('en-IN')}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                                Netbanking: ₹{netbankingPaidAmt.toLocaleString('en-IN')}
                              </span>
                              {b.paymentLocation && b.paymentLocation !== 'N/A' && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                  Loc: {b.paymentLocation}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Balance Due:</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              ₹{(b.totalFreight - totalSettledAmt).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 flex flex-wrap justify-between gap-1">
                          <span>Approval: <strong className="text-slate-800">{b.approvalDate || '-'}</strong></span>
                          <span>Set Date: <strong className="text-slate-800">{b.paymentDate || '-'}</strong></span>
                          <span>Actual Paid: <strong className="text-blue-700">{b.actualPaymentDate || '-'}</strong></span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })
          )}
        </main>

        {/* ====================================================================
            MODAL 1: Owner PIN Unlock
        ==================================================================== */}
        {showPinModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl relative">
              <button 
                onClick={() => setShowPinModal(false)}
                className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center mb-4">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Owner Access</h3>
                <p className="text-xs text-slate-500">Enter 4-digit PIN (Default: 1234)</p>
              </div>
              <form onSubmit={handlePinSubmit} className="space-y-3">
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  inputMode="numeric"
                  placeholder="• • • •"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center text-xl font-mono tracking-[0.5em] py-2.5 bg-slate-100 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                />
                {pinError && <p className="text-xs text-red-600 text-center font-medium">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition"
                >
                  Unlock Owner Mode
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 2: Owner Create New Bilti
        ==================================================================== */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-slate-900 mb-1">Fill Bilti Details</h3>
              <p className="text-xs text-slate-500 mb-4">
                Enter details or check <span className="font-semibold text-amber-700">"Staff to fill"</span> on any field
              </p>

              <form onSubmit={handleCreateBilti} className="space-y-3">
                {/* LR No. */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">LR No. *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.lrNo}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, lrNo: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required={!staffToFillFields.lrNo}
                    disabled={staffToFillFields.lrNo}
                    placeholder={staffToFillFields.lrNo ? 'Staff will fill after posting' : 'LR-105'}
                    value={staffToFillFields.lrNo ? '' : formData.lrNo}
                    onChange={(e) => setFormData({ ...formData, lrNo: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-amber-50/70 disabled:text-amber-700 disabled:border-amber-200"
                  />
                </div>

                {/* Truck No. */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Truck No. *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.truckNo}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, truckNo: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required={!staffToFillFields.truckNo}
                    disabled={staffToFillFields.truckNo}
                    placeholder={staffToFillFields.truckNo ? 'Staff will fill after posting' : 'UP-70-AB-1234'}
                    value={staffToFillFields.truckNo ? '' : formData.truckNo}
                    onChange={(e) => setFormData({ ...formData, truckNo: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-amber-50/70 disabled:text-amber-700 disabled:border-amber-200"
                  />
                </div>

                {/* Invoice Date */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Invoice Date *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.date}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, date: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  {staffToFillFields.date ? (
                    <div className="w-full p-2 text-xs bg-amber-50/70 text-amber-700 border border-amber-200 rounded-lg">
                      Staff will fill after posting
                    </div>
                  ) : (
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  )}
                </div>

                {/* Owner Name */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Owner Name *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.ownerName}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, ownerName: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required={!staffToFillFields.ownerName}
                    disabled={staffToFillFields.ownerName}
                    placeholder={staffToFillFields.ownerName ? 'Staff will fill after posting' : 'Rajesh Kumar'}
                    value={staffToFillFields.ownerName ? '' : formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-amber-50/70 disabled:text-amber-700 disabled:border-amber-200"
                  />
                </div>

                {/* Party Name */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Party Name *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.partyName}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, partyName: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required={!staffToFillFields.partyName}
                    disabled={staffToFillFields.partyName}
                    placeholder={staffToFillFields.partyName ? 'Staff will fill after posting' : 'ABC Traders'}
                    value={staffToFillFields.partyName ? '' : formData.partyName}
                    onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-amber-50/70 disabled:text-amber-700 disabled:border-amber-200"
                  />
                </div>

                {/* Destination */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Destination *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.destination}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, destination: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required={!staffToFillFields.destination}
                    disabled={staffToFillFields.destination}
                    placeholder={staffToFillFields.destination ? 'Staff will fill after posting' : 'Satna'}
                    value={staffToFillFields.destination ? '' : formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-amber-50/70 disabled:text-amber-700 disabled:border-amber-200"
                  />
                </div>

                {/* Weight (MT) */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Weight (MT) *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.weight}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, weight: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    required={!staffToFillFields.weight}
                    disabled={staffToFillFields.weight}
                    inputMode="decimal"
                    placeholder={staffToFillFields.weight ? 'Staff will fill after posting' : '20'}
                    value={staffToFillFields.weight ? '' : formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-amber-50/70 disabled:text-amber-700 disabled:border-amber-200"
                  />
                </div>

                {/* Rate / Ton */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Rate / Ton (₹) *</label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffToFillFields.rate}
                        onChange={(e) => setStaffToFillFields({ ...staffToFillFields, rate: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <span>To be filled by staff</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    required={!staffToFillFields.rate}
                    disabled={staffToFillFields.rate}
                    inputMode="numeric"
                    placeholder={staffToFillFields.rate ? 'Staff will fill after posting' : '2500'}
                    value={staffToFillFields.rate ? '' : formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-amber-50/70 disabled:text-amber-700 disabled:border-amber-200"
                  />
                </div>

                {/* Live Freight Calculation Preview */}
                {!staffToFillFields.weight && !staffToFillFields.rate && formData.weight && formData.rate && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-xs">
                    <span className="text-emerald-800 font-medium">Calculated Total Freight:</span>
                    <span className="text-base font-black text-emerald-950 font-mono">
                      ₹{Math.round(parseFloat(formData.weight || 0) * parseFloat(formData.rate || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition shadow-md mt-2"
                >
                  {isSubmitting ? 'Posting...' : 'Publish Bilti'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 2B: Staff Fills Delegated Bilti Fields
        ==================================================================== */}
        {fillFieldsTargetBilti && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setFillFieldsTargetBilti(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-bold text-amber-600 uppercase">
                {fillFieldsTargetBilti.lrNo || 'New Bilti'} {fillFieldsTargetBilti.truckNo ? `• ${fillFieldsTargetBilti.truckNo}` : ''}
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Complete Bilti Details</h3>
              <p className="text-xs text-slate-500 mb-4">Fill in the fields requested by the Owner</p>

              <form onSubmit={handleStaffFillFieldsSubmit} className="space-y-3">
                {(fillFieldsTargetBilti.staffPendingFields || []).includes('lrNo') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">LR No. *</label>
                    <input
                      type="text"
                      required
                      placeholder="LR-105"
                      value={staffFieldValues.lrNo || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, lrNo: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(fillFieldsTargetBilti.staffPendingFields || []).includes('truckNo') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Truck No. *</label>
                    <input
                      type="text"
                      required
                      placeholder="UP-70-AB-1234"
                      value={staffFieldValues.truckNo || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, truckNo: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(fillFieldsTargetBilti.staffPendingFields || []).includes('date') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Invoice Date *</label>
                    <input
                      type="date"
                      required
                      value={staffFieldValues.date || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, date: e.target.value })}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(fillFieldsTargetBilti.staffPendingFields || []).includes('ownerName') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Owner Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Rajesh Kumar"
                      value={staffFieldValues.ownerName || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, ownerName: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(fillFieldsTargetBilti.staffPendingFields || []).includes('partyName') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Party Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="ABC Traders"
                      value={staffFieldValues.partyName || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, partyName: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(fillFieldsTargetBilti.staffPendingFields || []).includes('destination') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Destination *</label>
                    <input
                      type="text"
                      required
                      placeholder="Satna"
                      value={staffFieldValues.destination || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, destination: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(fillFieldsTargetBilti.staffPendingFields || []).includes('weight') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Weight (MT) *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      inputMode="decimal"
                      placeholder="20"
                      value={staffFieldValues.weight || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, weight: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(fillFieldsTargetBilti.staffPendingFields || []).includes('rate') && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Rate / Ton (₹) *</label>
                    <input
                      type="number"
                      required
                      inputMode="numeric"
                      placeholder="2500"
                      value={staffFieldValues.rate || ''}
                      onChange={(e) => setStaffFieldValues({ ...staffFieldValues, rate: e.target.value })}
                      className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl transition shadow-md mt-2"
                >
                  {isSubmitting ? 'Saving...' : 'Save Bilti Details'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 3: Staff Enters Payment Approval Amount
        ==================================================================== */}
        {advanceTargetBilti && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative">
              <button 
                onClick={() => setAdvanceTargetBilti(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-bold text-amber-600 uppercase">
                {advanceTargetBilti.lrNo || advanceTargetBilti.biltiNo} {advanceTargetBilti.truckNo ? `• ${advanceTargetBilti.truckNo}` : ''}
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">Request Payment Approval</h3>
              <p className="text-xs text-slate-500 mb-4">
                Total Freight: ₹{advanceTargetBilti.totalFreight?.toLocaleString('en-IN')}
              </p>

              <form onSubmit={handleSendAdvanceRequest} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Advance Amount for Approval (₹)</label>
                  <input
                    type="number"
                    required
                    autoFocus
                    min={1}
                    max={advanceTargetBilti.totalFreight}
                    inputMode="numeric"
                    placeholder="e.g. 15000"
                    value={advanceInput}
                    onChange={(e) => setAdvanceInput(e.target.value)}
                    className={`w-full p-3 text-lg font-bold font-mono bg-slate-50 border rounded-xl focus:outline-none ${
                      parseFloat(advanceInput) > advanceTargetBilti.totalFreight
                        ? 'border-red-500 text-red-700 focus:border-red-600'
                        : 'border-slate-300 focus:border-amber-500'
                    }`}
                  />
                  {parseFloat(advanceInput) > advanceTargetBilti.totalFreight && (
                    <p className="text-[11px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Advance cannot exceed Total Freight (₹{advanceTargetBilti.totalFreight?.toLocaleString('en-IN')})</span>
                    </p>
                  )}
                </div>

                {/* Quick % Chips */}
                <div className="flex gap-2">
                  {[20, 30, 50].map(pct => (
                    <button
                      type="button"
                      key={pct}
                      onClick={() => setAdvanceInput(Math.round((advanceTargetBilti.totalFreight * pct) / 100).toString())}
                      className="flex-1 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition"
                    >
                      {pct}% (₹{Math.round((advanceTargetBilti.totalFreight * pct) / 100).toLocaleString('en-IN')})
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={
                    isSubmitting || 
                    !advanceInput || 
                    parseFloat(advanceInput) <= 0 || 
                    parseFloat(advanceInput) > advanceTargetBilti.totalFreight
                  }
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Approval Request'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 4: Owner Approves Advance & Sets Payment Terms
        ==================================================================== */}
        {payTargetBilti && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setPayTargetBilti(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <span className="text-[11px] font-bold text-emerald-700 uppercase">
                {payTargetBilti.lrNo || payTargetBilti.biltiNo}
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">Approve Payment Request</h3>
              <p className="text-xs text-slate-500 mb-4">
                Freight: ₹{payTargetBilti.totalFreight?.toLocaleString('en-IN')} • Requested: ₹{payTargetBilti.advanceRequested?.toLocaleString('en-IN')}
              </p>

              <div className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Payment Type</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['No Payment', 'Partial Payment', 'Full Payment'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPaymentType(t)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition ${
                          paymentType === t
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentType !== 'No Payment' && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1.5">Payment Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Cash', 'Netbanking'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMode(m)}
                            className={`py-2 rounded-xl text-xs font-bold border transition ${
                              paymentMode === m
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Payment Location</label>
                        <select
                          value={paymentLocation}
                          onChange={(e) => setPaymentLocation(e.target.value)}
                          className="w-full p-2.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                        >
                          <option value="Allahabad">Allahabad</option>
                          <option value="Satna">Satna</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Set Payment Date *</label>
                        <input
                          type="date"
                          required
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-emerald-800 font-semibold">Amount Approved:</span>
                  <span className="text-base font-black text-emerald-950 font-mono">
                    ₹{(
                      paymentType === 'No Payment'
                        ? 0
                        : paymentType === 'Full Payment'
                        ? payTargetBilti.totalFreight
                        : payTargetBilti.advanceRequested
                    )?.toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleOwnerConfirmOk}
                  disabled={isSubmitting || (paymentType !== 'No Payment' && !paymentDate)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Approving...' : 'Confirm Approval (OK)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 5: Owner Marks Payment Done (Actual Date + Cash/Netbanking)
        ==================================================================== */}
        {markDoneBilti && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
              <button
                onClick={() => setMarkDoneBilti(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <span className="text-[11px] font-bold text-blue-700 uppercase">
                {markDoneBilti.lrNo || markDoneBilti.biltiNo}
              </span>
              <h3 className="text-base font-black text-slate-900 mt-0.5">Mark Payment Done</h3>
              <p className="text-xs text-slate-500 mb-4">
                Approved: ₹{(markDoneBilti.advanceApproved || 0).toLocaleString('en-IN')} • Set Date: {markDoneBilti.paymentDate || '-'}
              </p>

              <form onSubmit={handleMarkPaymentDone} className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Actual Payment Date *</label>
                    <input
                      type="date"
                      required
                      value={actualPaymentDate}
                      onChange={(e) => setActualPaymentDate(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Payment Location</label>
                    <select
                      value={donePaymentLocation}
                      onChange={(e) => setDonePaymentLocation(e.target.value)}
                      className="w-full p-2.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    >
                      <option value="Allahabad">Allahabad</option>
                      <option value="Satna">Satna</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Paid in Cash (₹)</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={cashPaidInput}
                      onChange={(e) => setCashPaidInput(e.target.value)}
                      className="w-full p-2.5 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Paid in Netbanking (₹)</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={netbankingPaidInput}
                      onChange={(e) => setNetbankingPaidInput(e.target.value)}
                      className="w-full p-2.5 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center text-xs">
                  <span className="text-blue-900 font-semibold">Total Disbursed:</span>
                  <span className="text-sm font-black text-blue-950 font-mono">
                    ₹{((parseFloat(cashPaidInput) || 0) + (parseFloat(netbankingPaidInput) || 0)).toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (parseFloat(cashPaidInput) || 0) + (parseFloat(netbankingPaidInput) || 0) > markDoneBilti.totalFreight
                  }
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Payment Done'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 6: Owner Rejects / Does Not Approve Payment Request
        ==================================================================== */}
        {rejectTargetBilti && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative border border-slate-200">
              <button 
                onClick={() => setRejectTargetBilti(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-4">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">Do Not Approve Request</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  LR: {rejectTargetBilti.lrNo || rejectTargetBilti.biltiNo} • Requested: ₹{rejectTargetBilti.advanceRequested?.toLocaleString('en-IN')}
                </p>
              </div>

              <form onSubmit={handleRejectPaymentRequest} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Advance not required for this trip"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRejectTargetBilti(null)}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 7: Owner Cancels a Bilti
        ==================================================================== */}
        {cancelTargetBilti && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative border border-slate-200">
              <button 
                onClick={() => setCancelTargetBilti(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-4">
                <div className="w-10 h-10 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Ban className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">Cancel This Bilti?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  LR: <span className="font-bold text-slate-800">{cancelTargetBilti.lrNo || cancelTargetBilti.biltiNo}</span> ({cancelTargetBilti.partyName})
                </p>
              </div>

              <form onSubmit={handleCancelBilti} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Cancellation Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Trip cancelled / Wrong LR entry"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCancelTargetBilti(null)}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                  >
                    Keep Bilti
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? 'Cancelling...' : 'Cancel Bilti'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
