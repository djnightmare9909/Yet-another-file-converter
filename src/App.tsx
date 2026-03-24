/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileType, Download, RefreshCw, AlertCircle, FileText, Image as ImageIcon, X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

console.log("Universal Local Converter: Initializing...");

// --- External Script Loaders ---
const loadScript = (url: string, globalVar: string) => {
  return new Promise((resolve, reject) => {
    if ((window as any)[globalVar]) return resolve((window as any)[globalVar]);
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve((window as any)[globalVar]);
    script.onerror = () => reject(new Error(`Failed to load ${globalVar}`));
    document.body.appendChild(script);
  });
};

const loadJsPDF = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
const loadMammoth = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth');
const loadSheetJS = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
const loadPdfJS = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib');

// --- Universal Conversion Engine ---

const ALL_FORMATS = ['PNG', 'JPG', 'WEBP', 'PDF', 'JSON', 'CSV', 'TXT', 'XML', 'HTML', 'MD', 'BASE64'];

const readFileAsText = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsText(file);
});

const readFileAsDataURL = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const loadImage = (dataUrl: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = dataUrl;
});

// Heuristic to parse standard text
const parseTextData = (text: string) => {
  // 1. Try JSON
  try {
    const parsed = JSON.parse(text);
    return { type: 'json', data: parsed };
  } catch (e) {}
  
  // 2. Try XML (Basic heuristic)
  if (text.trim().startsWith('<') && text.trim().endsWith('>')) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      if (!xmlDoc.getElementsByTagName("parsererror").length) {
        // Simple XML to JSON converter for internal processing
        const xmlToJson = (node: Node): any => {
          let obj: any = {};
          if (node.nodeType === 1) { // element
            const element = node as Element;
            if (element.attributes.length > 0) {
              obj["@attributes"] = {};
              for (let j = 0; j < element.attributes.length; j++) {
                const attribute = element.attributes.item(j);
                if (attribute) obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
              }
            }
          } else if (node.nodeType === 3) { // text
            obj = node.nodeValue;
          }
          if (node.hasChildNodes()) {
            for (let i = 0; i < node.childNodes.length; i++) {
              const item = node.childNodes.item(i);
              const nodeName = item.nodeName;
              if (typeof (obj[nodeName]) === "undefined") {
                obj[nodeName] = xmlToJson(item);
              } else {
                if (typeof (obj[nodeName].push) === "undefined") {
                  const old = obj[nodeName];
                  obj[nodeName] = [];
                  obj[nodeName].push(old);
                }
                obj[nodeName].push(xmlToJson(item));
              }
            }
          }
          return obj;
        };
        return { type: 'xml', data: xmlToJson(xmlDoc) };
      }
    } catch (e) {}
  }

  // 3. Try CSV
  const lines = text.trim().split('\n');
  if (lines.length > 1 && lines[0].includes(',')) {
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
      const obj: any = {};
      headers.forEach((h, i) => obj[h] = values[i] || "");
      return obj;
    });
    return { type: 'csv', data };
  }
  
  return { type: 'text', data: text };
};

const convertFile = async (file: File, targetFormat: string) => {
  const isImage = file.type && file.type.startsWith('image/');
  const filename = file.name.toLowerCase();
  const target = targetFormat.toUpperCase();
  
  // 1. SMART INPUT READING
  let inputDataUrl: string | null = null;
  let inputText = '';
  let parsedData: any = null;
  
  if (isImage) {
    inputDataUrl = await readFileAsDataURL(file);
  } else if (filename.endsWith('.docx')) {
    // Actually parse the DOCX XML
    const arrayBuffer = await file.arrayBuffer();
    const mammoth: any = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer });
    inputText = result.value || "No text found in document.";
    parsedData = { type: 'text', data: inputText };
  } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
    // Actually parse the Spreadsheet or CSV
    const arrayBuffer = await file.arrayBuffer();
    const XLSX: any = await loadSheetJS();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
    inputText = JSON.stringify(jsonData, null, 2);
    parsedData = { type: 'json', data: jsonData };
  } else if (filename.endsWith('.pdf')) {
    // Actually parse the PDF text
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib: any = await loadPdfJS();
    // Set worker source for pdf.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    inputText = fullText || "No text found in PDF.";
    parsedData = { type: 'text', data: inputText };
  } else {
    // Standard flat files (TXT, CSV, JSON, etc)
    inputText = await readFileAsText(file);
    parsedData = parseTextData(inputText);
  }

  // 2. ROUTE TO OUTPUT
  
  // --- Target: IMAGE (PNG, JPG, WEBP) ---
  if (['PNG', 'JPG', 'WEBP'].includes(target)) {
    const mime = target === 'JPG' ? 'image/jpeg' : `image/${target.toLowerCase()}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    
    if (isImage && inputDataUrl) {
      const img = await loadImage(inputDataUrl);
      canvas.width = img.width;
      canvas.height = img.height;
      if (target === 'JPG') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
    } else {
      // Text to Image
      canvas.width = 800;
      const lines = inputText.split('\n');
      canvas.height = Math.max(600, lines.length * 24 + 40);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = '16px monospace';
      lines.forEach((line, i) => ctx.fillText(line.substring(0, 90), 20, 40 + (i * 24)));
    }
    
    const dataUrl = canvas.toDataURL(mime, 0.9);
    return { type: 'image', content: dataUrl, ext: target.toLowerCase(), mime };
  }

  // --- Target: PDF ---
  if (target === 'PDF') {
    const jspdf: any = await loadJsPDF();
    const doc = new jspdf.jsPDF();
    
    if (isImage && inputDataUrl) {
      const imgProps = doc.getImageProperties(inputDataUrl);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      const imgType = (file.type.split('/')[1] || 'JPEG').toUpperCase();
      const safeImgType = ['JPEG', 'PNG', 'WEBP'].includes(imgType) ? imgType : 'JPEG';
      
      doc.addImage(inputDataUrl, safeImgType, 0, 0, pdfWidth, pdfHeight);
    } else {
      const lines = doc.splitTextToSize(inputText, 180);
      let yOffset = 20;
      // Basic pagination if text is too long
      lines.forEach((line: string) => {
        if (yOffset > 280) {
          doc.addPage();
          yOffset = 20;
        }
        doc.text(line, 10, yOffset);
        yOffset += 7;
      });
    }
    
    const dataUrl = doc.output('datauristring');
    return { type: 'pdf', content: dataUrl, ext: 'pdf', mime: 'application/pdf' };
  }

  // --- Target: TEXT-BASED ---
  let outText = '';
  
  if (isImage && inputDataUrl) {
    if (target === 'BASE64') outText = inputDataUrl;
    else if (target === 'JSON') outText = JSON.stringify({ filename: file.name, image: inputDataUrl }, null, 2);
    else if (target === 'HTML') outText = `<img src="${inputDataUrl}" alt="${file.name}" />`;
    else if (target === 'MD') outText = `![${file.name}](${inputDataUrl})`;
    else outText = `[Image data converted to ${target}]\n\n${inputDataUrl}`;
  } else {
    // Text to Text
    const isStructured = ['json', 'csv', 'xml'].includes(parsedData.type);
    const rawObj = isStructured ? parsedData.data : { content: parsedData.data };
    const arrObj = Array.isArray(rawObj) ? rawObj : [rawObj];
    
    if (target === 'JSON') {
      outText = JSON.stringify(rawObj, null, 2);
    } else if (target === 'CSV') {
      if (arrObj.length === 0) outText = '';
      else {
        const headers = Array.from(new Set(arrObj.flatMap(obj => typeof obj === 'object' && obj !== null ? Object.keys(obj) : ['value'])));
        outText = headers.join(',') + '\n' + arrObj.map(row => headers.map(h => {
          const val = typeof row === 'object' && row !== null ? row[h] : row;
          return `"${('' + (val ?? '')).replace(/"/g, '""')}"`;
        }).join(',')).join('\n');
      }
    } else if (target === 'XML') {
      const toXml = (obj: any, name: string = 'item'): string => {
        if (typeof obj !== 'object' || obj === null) return `<${name}>${obj}</${name}>`;
        let xml = `<${name}>`;
        for (let prop in obj) {
          const safeProp = prop.replace(/[^a-zA-Z0-9]/g, '') || 'prop';
          xml += toXml(obj[prop], safeProp);
        }
        xml += `</${name}>`;
        return xml;
      };
      outText = `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(rawObj, 'root')}`;
    } else if (target === 'HTML') {
      if (isStructured) {
        const headers = Array.from(new Set(arrObj.flatMap(obj => typeof obj === 'object' && obj !== null ? Object.keys(obj) : ['value'])));
        outText = `<!DOCTYPE html><html><head><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#f2f2f2}</style></head><body>\n` +
          `<table border="1">\n<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>\n<tbody>` +
          arrObj.map(row => `<tr>${headers.map(h => {
            const val = typeof row === 'object' && row !== null ? row[h] : row;
            return `<td>${typeof val === 'object' ? JSON.stringify(val) : (val ?? '')}</td>`;
          }).join('')}</tr>`).join('\n') +
          `\n</tbody></table>\n</body></html>`;
      } else {
        outText = `<!DOCTYPE html><html><body><pre>${inputText}</pre></body></html>`;
      }
    } else if (target === 'MD') {
      if (isStructured) {
        const headers = Array.from(new Set(arrObj.flatMap(obj => typeof obj === 'object' && obj !== null ? Object.keys(obj) : ['value'])));
        if(headers.length > 0) {
          outText = `| ${headers.join(' | ')} |\n| ${headers.map(()=>'---').join(' | ')} |\n` +
            arrObj.map(row => `| ${headers.map(h => {
              const val = typeof row === 'object' && row !== null ? row[h] : row;
              return typeof val === 'object' ? JSON.stringify(val) : (val ?? '');
            }).join(' | ')} |`).join('\n');
        } else {
           outText = `\`\`\`json\n${JSON.stringify(rawObj, null, 2)}\n\`\`\``;
        }
      } else {
        outText = inputText;
      }
    } else if (target === 'BASE64') {
      outText = btoa(unescape(encodeURIComponent(inputText)));
    } else {
      // Default TXT
      outText = typeof rawObj === 'object' ? JSON.stringify(rawObj, null, 2) : String(rawObj);
      if (parsedData.type === 'text') outText = parsedData.data; // Keep natural text clean
    }
  }

  const base64Text = btoa(unescape(encodeURIComponent(outText)));
  const dataUrl = `data:text/plain;base64,${base64Text}`;
  
  return { type: 'text', content: outText, dataUrl: dataUrl, ext: target.toLowerCase(), mime: 'text/plain' };
};

// --- Main App Component ---

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState('PDF');
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeFile = (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    setError('');
    
    const name = selectedFile.name.toLowerCase();
    if (selectedFile.type?.startsWith('image/')) setTargetFormat('PDF');
    else if (name.endsWith('.docx')) setTargetFormat('TXT');
    else if (name.endsWith('.xlsx')) setTargetFormat('CSV');
    else if (name.endsWith('.json')) setTargetFormat('CSV');
    else if (name.endsWith('.csv')) setTargetFormat('JSON');
    else setTargetFormat('TXT');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) analyzeFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) analyzeFile(e.target.files[0]);
  };

  const handleConvert = async () => {
    if (!file || !targetFormat) return;
    setConverting(true);
    setError('');
    setCopied(false);
    
    try {
      const res = await convertFile(file, targetFormat);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'An error occurred during conversion.');
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopy = async () => {
    if (!result || result.type !== 'text') return;
    try {
      const textArea = document.createElement("textarea");
      textArea.value = result.content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImage = file?.type?.startsWith('image/');
  const isDocument = file?.name?.toLowerCase().endsWith('.docx') || file?.name?.toLowerCase().endsWith('.xlsx');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <RefreshCw className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-medium text-white">Universal Local Converter</h1>
              <p className="text-xs text-neutral-500">All formats. 100% Client-side.</p>
            </div>
          </div>
          {file && (
            <button onClick={reset} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          {!file ? (
            /* Upload Zone */
            <div 
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer ${
                dragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleChange} />
              <UploadCloud className={`w-14 h-14 mx-auto mb-5 ${dragActive ? 'text-indigo-400' : 'text-neutral-500'}`} />
              <p className="text-neutral-200 font-medium mb-2 text-lg">Click to upload or drag and drop</p>
              <p className="text-sm text-neutral-500 max-w-sm mx-auto">Supports converting Images, DOCX, XLSX, and Data files completely locally in your browser.</p>
            </div>
          ) : (
            /* File Processing UI */
            <div className="space-y-6">
              
              {/* File Info */}
              <div className="flex flex-col sm:flex-row gap-4 items-center p-5 bg-neutral-950/50 rounded-xl border border-neutral-800">
                <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                  <div className="p-3 bg-neutral-800 rounded-lg shrink-0">
                    {isImage ? <ImageIcon className="w-6 h-6 text-blue-400" /> : 
                     isDocument ? <FileType className="w-6 h-6 text-purple-400" /> :
                     <FileText className="w-6 h-6 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-neutral-500">{formatSize(file.size)}</p>
                  </div>
                </div>

                {!result && (
                  <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                    <span className="text-sm text-neutral-400">to</span>
                    <select 
                      value={targetFormat}
                      onChange={(e) => setTargetFormat(e.target.value)}
                      className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[100px]"
                    >
                      {ALL_FORMATS.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <button 
                      onClick={handleConvert}
                      disabled={converting}
                      className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
                    >
                      {converting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Convert'}
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Success Result & Live Preview */}
              {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-400">Ready: converted.{result.ext}</p>
                        <p className="text-xs text-emerald-400/80">Preview below. Use buttons to save.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {result.type === 'text' && (
                        <button onClick={handleCopy} className="flex-1 sm:flex-none px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors border border-neutral-700 flex items-center justify-center gap-2">
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      )}
                      <a 
                        href={result.type === 'text' ? result.dataUrl : result.content}
                        download={`converted.${result.ext}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Save File
                      </a>
                    </div>
                  </div>

                  {/* Preview Area */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden relative group">
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white/70 text-[10px] uppercase font-bold rounded tracking-wider backdrop-blur-sm pointer-events-none">
                      Live Preview
                    </div>
                    
                    {result.type === 'image' && (
                      <div className="p-4 flex justify-center bg-black/20">
                        <img src={result.content} alt="Converted" className="max-w-full h-auto max-h-[50vh] rounded shadow-lg object-contain" />
                      </div>
                    )}
                    
                    {result.type === 'pdf' && (
                      <iframe src={result.content} className="w-full h-[60vh] border-0 bg-white" title="PDF Preview" />
                    )}
                    
                    {result.type === 'text' && (
                      <textarea 
                        value={result.content} 
                        readOnly 
                        className="w-full h-[50vh] bg-neutral-950 text-neutral-300 p-4 font-mono text-xs focus:outline-none resize-none"
                        spellCheck="false"
                      />
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
