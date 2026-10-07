import React, { useState } from 'react';
import Papa from 'papaparse';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Download, Check } from 'lucide-react';
import { bulkCreateLeads } from '../services/leadService';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedLeadRow {
  name: string;
  phone: string;
  consent: boolean;
  rawConsent: string;
  isValid: boolean;
  error?: string;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [parsedRows, setParsedRows] = useState<ParsedLeadRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setErrorMessage('CSV file appears to be empty.');
          return;
        }

        const rows: ParsedLeadRow[] = (results.data as any[]).map((row) => {
          // Normalize key names
          const name = row.name || row.Name || row.fullName || '';
          const phone = row.phone || row.Phone || row.phoneNumber || row.mobile || '';
          const consentVal = String(row.consent || row.Consent || '').trim().toLowerCase();

          const consent = consentVal === 'true' || consentVal === 'yes' || consentVal === '1';
          const isValid = Boolean(name.trim() && phone.trim());

          let error = '';
          if (!name.trim()) error = 'Missing name';
          else if (!phone.trim()) error = 'Missing phone';
          else if (!consent) error = 'No explicit consent (will not be called)';

          return {
            name: name.trim(),
            phone: phone.trim(),
            consent,
            rawConsent: row.consent || 'false',
            isValid,
            error,
          };
        });

        setParsedRows(rows);
      },
      error: (err) => {
        setErrorMessage(`CSV parsing error: ${err.message}`);
      },
    });
  };

  const handleDownloadSample = () => {
    const sampleCsv = `name,phone,consent\nRahul Sharma,+919876543210,true\nAmit Patel,+919811122233,true\nPriya Deshmukh,+919922334455,true\nVikram Malhotra,+919123456789,true\nNeha Kapoor,+919833445566,false`;
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'lyka_leads_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage('No valid rows found to import.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      await bulkCreateLeads(
        validRows.map((r) => ({
          name: r.name,
          phone: r.phone,
          consent: r.consent,
        }))
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import leads to Firestore');
    } finally {
      setIsUploading(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const consentedCount = parsedRows.filter((r) => r.isValid && r.consent).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Upload Lead CSV</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Instructions banner */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2">
            <div className="flex items-center justify-between font-semibold text-white">
              <span>Required CSV Columns:</span>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-amber-400 hover:underline flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV</span>
              </button>
            </div>
            <code className="block bg-slate-900 p-2 rounded text-amber-300 font-mono text-[11px]">
              name,phone,consent<br />
              Rahul,+919876543210,true<br />
              Amit,+919811122233,true<br />
              Priya,+919922334455,true
            </code>
            <p className="text-slate-400">
              Only leads with <strong className="text-emerald-400">consent = true</strong> and{' '}
              <strong className="text-slate-200">blocked = false</strong> will be eligible for autonomous outbound calls.
            </p>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 relative">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-white">
                {fileName ? fileName : 'Click or drag CSV file here'}
              </div>
              <p className="text-xs text-slate-400">Supported format: .csv</p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Preview ({validCount} Leads Found)
                </span>
                <span className="text-emerald-400 font-medium">
                  {consentedCount} with active calling consent
                </span>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Consent</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-medium text-white">{r.name || '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-300">{r.phone || '—'}</td>
                        <td className="px-3 py-2">
                          {r.consent ? (
                            <span className="text-emerald-400 font-semibold">true</span>
                          ) : (
                            <span className="text-slate-400">false</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.isValid ? (
                            <span className="text-emerald-400 flex items-center">
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Ready
                            </span>
                          ) : (
                            <span className="text-rose-400">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isUploading || validCount === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              validCount === 0 || isUploading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 active:scale-95'
            }`}
          >
            {isUploading ? 'Importing to Firestore...' : `Import ${validCount} Leads to Firestore`}
          </button>
        </div>
      </div>
    </div>
  );
};
