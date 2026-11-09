import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, 
  IndianRupee, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Smartphone, 
  Plus, 
  User, 
  Building, 
  Lock, 
  Unlock, 
  X, 
  Check, 
  Calendar, 
  ArrowRight,
  ExternalLink,
  Download,
  FileText,
  Loader2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot 
} from 'firebase/firestore';

// -------------------------------------------------------------
// FIREBASE BACKEND SETUP
// -------------------------------------------------------------
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'rk-roadlines-hub';

// Starter mock biltis if collection is empty
const INITIAL_BILTIS = [
  {
    biltiNo: 'BLT-1024',
    date: '2026-11-09',
    rate: 2800,
    weight: 22,
    unit: 'MT',
    totalFreight: 61600,
    status: 'ADVANCE_REQUESTED', // 'POSTED' | 'ADVANCE_REQUESTED' | 'ADVANCE_PAID'
    advanceRequested: 18000,
    advancePaid: 0,
    upiApp: '',
    createdAt: Date.now()
  },
  {
    biltiNo: 'BLT-1025',
    date: '2026-11-09',
    rate: 1950,
    weight: 15,
    unit: 'MT',
    totalFreight: 29250,
    status: 'POSTED',
    advanceRequested: 0,
    advancePaid: 0,
    upiApp: '',
    createdAt: Date.now() - 3600000
  }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [biltis, setBiltis] = useState([]);
  const [role, setRole] = useState('driver'); // 'driver' or 'owner'
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Owner Form Modal: Post New Bilti
  const [showPostModal, setShowPostModal] = useState(false);
  const [newBilti, setNewBilti] = useState({
    biltiNo: '',
    date: new Date().toISOString().split('T')[0],
    rate: '',
    weight: ''
  });

  // Driver Advance Modal
  const [requestAdvanceTarget, setRequestAdvanceTarget] = useState(null);
  const [advanceInput, setAdvanceInput] = useState('');

  // Owner Pay Modal
  const [payTargetBilti, setPayTargetBilti] = useState(null);
  const [selectedApp, setSelectedApp] = useState('PhonePe');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Helper to dynamically load script for PDF generation without npm install breakages
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  };

  // Download PDF Report with Full Transaction Breakdown
  const handleDownloadLedgerPDF = async () => {
    if (biltis.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      // Load jsPDF and autotable dynamically from CDN
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'pt', 'a4');

      // --- Header Design ---
      doc.setFillColor(245, 158, 11); // Amber brand color
      doc.rect(0, 0, 595.28, 70, 'F');

      doc.setTextColor(15, 23, 42); // Slate 900
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('RK ROADLINES', 40, 38);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text('Consignment Bilti & Cash Advance Ledger Statement', 40, 54);

      // Statement Metadata
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const generatedDate = new Date().toLocaleString('en-IN');
      doc.text(`Generated On: ${generatedDate}`, 380, 42);
      doc.text(`Total Records: ${biltis.length}`, 380, 56);

      // Financial Aggregations
      const totalFreightSum = biltis.reduce((acc, b) => acc + (b.totalFreight || 0), 0);
      const totalAdvancePaidSum = biltis.reduce((acc, b) => acc + (b.advancePaid || 0), 0);
      const totalBalanceSum = totalFreightSum - totalAdvancePaidSum;

      // Summary Stats Cards (Drawing rounded boxes)
      const startY = 85;
      
      // Box 1: Total Freight
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(40, startY, 155, 46, 5, 5, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL FREIGHT BILLED', 48, startY + 16);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${totalFreightSum.toLocaleString('en-IN')}`, 48, startY + 36);

      // Box 2: Total Advance Paid
      doc.roundedRect(210, startY, 155, 46, 5, 5, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL ADVANCE PAID', 218, startY + 16);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(`Rs. ${totalAdvancePaidSum.toLocaleString('en-IN')}`, 218, startY + 36);

      // Box 3: Total Balance Due
      doc.roundedRect(380, startY, 175, 46, 5, 5, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('OUTSTANDING BALANCE DUE', 388, startY + 16);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text(`Rs. ${totalBalanceSum.toLocaleString('en-IN')}`, 388, startY + 36);

      // Prepare Rows for AutoTable
      const tableRows = biltis.map((item, index) => {
        const remainingDue = (item.totalFreight || 0) - (item.advancePaid || 0);
        
        let statusText = 'Available';
        if (item.status === 'ADVANCE_REQUESTED') statusText = 'Req Pending';
        if (item.status === 'ADVANCE_PAID') statusText = 'Advance Paid (OK)';

        return [
          index + 1,
          item.biltiNo,
          item.date,
          `${item.weight} MT`,
          `Rs. ${item.rate}`,
          `Rs. ${(item.totalFreight || 0).toLocaleString('en-IN')}`,
          item.advanceRequested ? `Rs. ${item.advanceRequested.toLocaleString('en-IN')}` : '-',
          item.advancePaid ? `Rs. ${item.advancePaid.toLocaleString('en-IN')}` : 'Rs. 0',
          `Rs. ${remainingDue.toLocaleString('en-IN')}`,
          item.upiApp || '-',
          statusText
        ];
      });

      // Render Clean, Readable AutoTable
      doc.autoTable({
        startY: 145,
        head: [[
          '#', 
          'Bilti No', 
          'Date', 
          'Weight', 
          'Rate/MT', 
          'Total Freight', 
          'Advance Req', 
          'Advance Paid', 
          'Balance Due', 
          'Paid Via', 
          'Status'
        ]],
        body: tableRows,
        theme: 'striped',
        styles: {
          fontSize: 7.5,
          font: 'helvetica',
          cellPadding: 4.5,
          valign: 'middle',
          textColor: [15, 23, 42]
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'left'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 16, halign: 'center' },
          1: { fontStyle: 'bold', cellWidth: 54 },
          2: { cellWidth: 48 },
          3: { cellWidth: 38 },
          4: { cellWidth: 44 },
          5: { cellWidth: 56, fontStyle: 'bold' },
          6: { cellWidth: 52 },
          7: { cellWidth: 54, textColor: [5, 150, 105], fontStyle: 'bold' },
          8: { cellWidth: 54, textColor: [180, 83, 9] },
          9: { cellWidth: 42 },
          10: { cellWidth: 60 }
        },
        didDrawPage: (data) => {
          // Footer
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'RK RoadLines • Confidential Consignment & Advance Cash Record • Computer Generated',
            40,
            doc.internal.pageSize.height - 20
          );
          const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
          doc.text(pageStr, doc.internal.pageSize.width - 65, doc.internal.pageSize.height - 20);
        }
      });

      const fileName = `RK_RoadLines_Ledger_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 1. Firebase Auth Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn("Auth initialization notice:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Sync
  useEffect(() => {
    if (!user) return;
    const biltisCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'bilties');

    const unsubscribe = onSnapshot(
      biltisCollectionRef,
      (snapshot) => {
        if (snapshot.empty) {
          INITIAL_BILTIS.forEach((item) => {
            addDoc(biltisCollectionRef, item).catch(() => {});
          });
        } else {
          const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setBiltis(list);
        }
      },
      (error) => {
        console.warn("Offline/local mode:", error);
        if (biltis.length === 0) {
          setBiltis(INITIAL_BILTIS.map((b, i) => ({ id: `mock-${i}`, ...b })));
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle Role Switch
  const handleSwitchToOwner = () => {
    if (isOwnerUnlocked) {
      setRole('owner');
    } else {
      setPinModalOpen(true);
    }
  };

  const handleVerifyPin = (e) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setIsOwnerUnlocked(true);
      setRole('owner');
      setPinModalOpen(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN (Default is 1234)');
    }
  };

  // Owner Posts Bilti
  const handlePostBilti = async (e) => {
    e.preventDefault();
    const rateNum = parseFloat(newBilti.rate);
    const weightNum = parseFloat(newBilti.weight);
    if (!newBilti.biltiNo || isNaN(rateNum) || isNaN(weightNum)) return;

    setIsSubmitting(true);
    const record = {
      biltiNo: newBilti.biltiNo.trim().toUpperCase(),
      date: newBilti.date,
      rate: rateNum,
      weight: weightNum,
      unit: 'MT',
      totalFreight: Math.round(rateNum * weightNum),
      status: 'POSTED',
      advanceRequested: 0,
      advancePaid: 0,
      upiApp: '',
      createdAt: Date.now()
    };

    try {
      if (user) {
        const biltisRef = collection(db, 'artifacts', appId, 'public', 'data', 'bilties');
        await addDoc(biltisRef, record);
      } else {
        setBiltis(prev => [{ id: `local-${Date.now()}`, ...record }, ...prev]);
      }
      setShowPostModal(false);
      setNewBilti({
        biltiNo: '',
        date: new Date().toISOString().split('T')[0],
        rate: '',
        weight: ''
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Driver Submits Advance Cash Required
  const handleSendAdvanceRequest = async () => {
    const amt = parseFloat(advanceInput);
    if (!requestAdvanceTarget || !amt || amt <= 0) return;

    setIsSubmitting(true);
    try {
      if (user && !requestAdvanceTarget.id.startsWith('local-') && !requestAdvanceTarget.id.startsWith('mock-')) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', requestAdvanceTarget.id);
        await updateDoc(docRef, {
          status: 'ADVANCE_REQUESTED',
          advanceRequested: amt
        });
      } else {
        setBiltis(prev => prev.map(b => b.id === requestAdvanceTarget.id ? {
          ...b,
          status: 'ADVANCE_REQUESTED',
          advanceRequested: amt
        } : b));
      }
      setRequestAdvanceTarget(null);
      setAdvanceInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Owner Disburses & Clicks "OK"
  const handleOwnerConfirmOk = async () => {
    if (!payTargetBilti) return;
    setIsSubmitting(true);

    try {
      if (user && !payTargetBilti.id.startsWith('local-') && !payTargetBilti.id.startsWith('mock-')) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bilties', payTargetBilti.id);
        await updateDoc(docRef, {
          status: 'ADVANCE_PAID',
          advancePaid: payTargetBilti.advanceRequested,
          upiApp: selectedApp,
          paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        setBiltis(prev => prev.map(b => b.id === payTargetBilti.id ? {
          ...b,
          status: 'ADVANCE_PAID',
          advancePaid: payTargetBilti.advanceRequested,
          upiApp: selectedApp,
          paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } : b));
      }
      setPayTargetBilti(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations for quick preview
  const previewFreight = (parseFloat(newBilti.rate) || 0) * (parseFloat(newBilti.weight) || 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex justify-center selection:bg-amber-100">
      {/* Mobile container - Max width 480px for a clean phone view, expands cleanly on desktop */}
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-xl border-x border-slate-200">
        
        {/* Simple Mobile Header */}
        <header className="p-4 border-b border-slate-200 bg-white sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight leading-tight text-slate-900">RK RoadLines</h1>
                <p className="text-[11px] text-slate-500 font-medium">Bilti & Advance Cash Portal</p>
              </div>
            </div>

            {/* Simple Role Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setRole('driver')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                  role === 'driver'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Driver</span>
              </button>

              <button
                onClick={handleSwitchToOwner}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                  role === 'owner'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isOwnerUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Owner</span>
              </button>
            </div>
          </div>
        </header>

        {/* Action Bar for Owner / Driver Info */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            {role === 'owner' ? '👑 Owner Mode (Publish & Pay)' : '🚛 Driver Mode (Request Advance)'}
          </span>
          {role === 'owner' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDownloadLedgerPDF}
                disabled={isGeneratingPdf || biltis.length === 0}
                title="Download all transactions as readable PDF statement"
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition active:scale-95 disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{isGeneratingPdf ? 'PDF...' : 'PDF'}</span>
              </button>

              <button
                onClick={() => setShowPostModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Post Bilti</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Feed: Clean List of Bilties */}
        <main className="p-4 space-y-3 flex-1 overflow-y-auto">
          {biltis.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              No bilties posted yet.
              {role === 'owner' && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowPostModal(true)}
                    className="text-amber-600 font-bold underline"
                  >
                    Post your first Bilti now
                  </button>
                </div>
              )}
            </div>
          ) : (
            biltis.map((b) => {
              const needsAdvanceAction = b.status === 'ADVANCE_REQUESTED';
              const isPaid = b.status === 'ADVANCE_PAID';

              return (
                <div 
                  key={b.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    needsAdvanceAction
                      ? 'border-amber-400 bg-amber-50/60 shadow-sm'
                      : isPaid
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Top Row: Bilti No and Date */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bilti Number</span>
                      <h3 className="text-base font-black font-mono text-slate-900">{b.biltiNo}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-medium">{b.date}</span>
                      <div className="mt-0.5">
                        {b.status === 'POSTED' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            Available
                          </span>
                        )}
                        {b.status === 'ADVANCE_REQUESTED' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                            Advance Requested
                          </span>
                        )}
                        {b.status === 'ADVANCE_PAID' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 inline-flex">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Settled OK
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Weight, Rate & Freight Grid */}
                  <div className="mt-3 grid grid-cols-3 gap-2 bg-slate-100/70 p-2.5 rounded-xl border border-slate-200/80 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Weight</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{b.weight} MT</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Rate</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">₹{b.rate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Freight</span>
                      <span className="text-xs font-extrabold text-slate-900 font-mono">₹{b.totalFreight?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Interactive Status & Action Section */}
                  <div className="mt-3 pt-3 border-t border-slate-200/80">
                    
                    {/* STATE 1: Bilti Posted - Driver Can Tap to Request Advance */}
                    {b.status === 'POSTED' && (
                      <div>
                        {role === 'driver' ? (
                          <button
                            onClick={() => {
                              setRequestAdvanceTarget(b);
                              setAdvanceInput(Math.round(b.totalFreight * 0.3).toString());
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <IndianRupee className="w-4 h-4" />
                            <span>Click to Request Cash Advance</span>
                          </button>
                        ) : (
                          <p className="text-xs text-center text-slate-400 py-1">
                            Waiting for driver to tap and enter advance amount.
                          </p>
                        )}
                      </div>
                    )}

                    {/* STATE 2: Driver Has Requested Advance */}
                    {b.status === 'ADVANCE_REQUESTED' && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-amber-900 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Advance Cash Needed:
                          </span>
                          <span className="text-base font-black font-mono text-amber-700">
                            ₹{b.advanceRequested?.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {role === 'owner' ? (
                          <button
                            onClick={() => setPayTargetBilti(b)}
                            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Smartphone className="w-4 h-4" />
                            <span>Pay via 3rd-Party & Click OK</span>
                          </button>
                        ) : (
                          <div className="text-[11px] text-center text-amber-800 bg-amber-100/80 py-2 rounded-xl">
                            Request sent to Owner. Waiting for advance payment.
                          </div>
                        )}
                      </div>
                    )}

                    {/* STATE 3: Owner Has Paid & Clicked OK */}
                    {b.status === 'ADVANCE_PAID' && (
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="text-emerald-800 font-bold block">
                            Advance Paid: ₹{b.advancePaid?.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            via {b.upiApp || 'UPI App'} {b.paidAt ? `at ${b.paidAt}` : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Remaining Due:</span>
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            ₹{(b.totalFreight - b.advancePaid).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })
          )}
        </main>

        {/* MODAL 1: Owner PIN Unlock (Default: 1234) */}
        {pinModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative border border-slate-200">
              <button 
                onClick={() => setPinModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2 font-black">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Owner Access</h3>
                <p className="text-xs text-slate-500">Enter PIN to publish bilties and approve payments</p>
              </div>

              <form onSubmit={handleVerifyPin} className="space-y-4">
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  placeholder="PIN: 1234"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center tracking-widest text-xl font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
                {pinError && <p className="text-xs text-red-500 text-center font-medium">{pinError}</p>}
                
                <button
                  type="submit"
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-sm"
                >
                  Unlock Owner Portal
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Owner Posts New Bilti (Simple: No, Rate, Weight, Date) */}
        {showPostModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <Truck className="w-5 h-5 text-amber-500" />
                  Post New Bilti
                </h3>
                <button 
                  onClick={() => setShowPostModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePostBilti} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Bilti Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BLT-7840"
                    value={newBilti.biltiNo}
                    onChange={(e) => setNewBilti({ ...newBilti, biltiNo: e.target.value })}
                    className="w-full mt-1 p-2.5 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Weight (MT / Tons)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="e.g. 24"
                      value={newBilti.weight}
                      onChange={(e) => setNewBilti({ ...newBilti, weight: e.target.value })}
                      className="w-full mt-1 p-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Rate / Ton (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 2500"
                      value={newBilti.rate}
                      onChange={(e) => setNewBilti({ ...newBilti, rate: e.target.value })}
                      className="w-full mt-1 p-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Date</label>
                  <input
                    type="date"
                    required
                    value={newBilti.date}
                    onChange={(e) => setNewBilti({ ...newBilti, date: e.target.value })}
                    className="w-full mt-1 p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Freight Calculation Preview */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
                  <span className="text-amber-900 font-semibold">Total Freight (Rate × Weight):</span>
                  <span className="text-sm font-extrabold text-amber-900 font-mono">
                    ₹{previewFreight.toLocaleString('en-IN')}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Bilti'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Driver Enters Cash Advance Required */}
        {requestAdvanceTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative border border-slate-200">
              <button 
                onClick={() => setRequestAdvanceTarget(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-4">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Driver Request</span>
                <h3 className="text-base font-extrabold text-slate-900">Advance Cash for {requestAdvanceTarget.biltiNo}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total freight is ₹{requestAdvanceTarget.totalFreight.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Enter Cash Needed (₹):</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-3 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      autoFocus
                      placeholder="20000"
                      value={advanceInput}
                      onChange={(e) => setAdvanceInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 text-base font-bold font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Quick percentage buttons */}
                <div className="flex gap-2">
                  {[0.2, 0.3, 0.5].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAdvanceInput(Math.round(requestAdvanceTarget.totalFreight * pct).toString())}
                      className="flex-1 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={isSubmitting || !advanceInput || parseFloat(advanceInput) <= 0}
                  onClick={handleSendAdvanceRequest}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Send Request to Owner'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: Owner Sends via 3rd-Party App and Clicks OK */}
        {payTargetBilti && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative border border-slate-200">
              <button 
                onClick={() => setPayTargetBilti(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Disbursal Confirmation</span>
                <h3 className="text-base font-black text-slate-900 mt-0.5">Pay Advance & Click OK</h3>
                <p className="text-xs text-slate-500">Send money via your UPI app, then confirm below</p>
              </div>

              {/* Amount Highlight */}
              <div className="p-4 bg-slate-100 rounded-2xl text-center border border-slate-200 my-3">
                <span className="text-[11px] text-slate-500 font-medium">Driver Requested Amount</span>
                <div className="text-2xl font-black font-mono text-emerald-700 mt-0.5">
                  ₹{payTargetBilti.advanceRequested?.toLocaleString('en-IN')}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Bilti: {payTargetBilti.biltiNo}</span>
              </div>

              {/* App selector */}
              <div className="space-y-2 mb-4">
                <label className="text-[11px] font-bold text-slate-600 block">3rd-Party App Used:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['PhonePe', 'GPay', 'Paytm'].map((app) => (
                    <button
                      key={app}
                      type="button"
                      onClick={() => setSelectedApp(app)}
                      className={`py-2 text-xs font-bold rounded-xl border text-center transition ${
                        selectedApp === app
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {app}
                    </button>
                  ))}
                </div>
              </div>

              {/* The "OK" Button */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleOwnerConfirmOk}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>CLICK OK (CONFIRM PAID)</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}