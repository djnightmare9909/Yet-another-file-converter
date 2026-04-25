
# 🛠️ Yet Another File Converter (YAFC)
**The last file converter you'll ever need—because it's the only one that doesn't steal your data.**
Most "free" online file converters are data-harvesting traps. They upload your private documents to their servers, process them, and keep a copy for "analytics" or training. **YAFC is different.** It is 100% client-side. Your files never leave your browser. Your CPU does the work, not a shadowy server.
## ✨ Why YAFC?
 * **Privacy First:** No accounts, no cookies, no tracking, and zero data uploads.
 * **Instant Processing:** Since it runs locally, there's no waiting in a "conversion queue."
 * **Universal Support:**
   * **Images:** PNG, JPG, WEBP, and Base64.
   * **Documents:** PDF, DOCX, XLSX (Excel).
   * **Data:** CSV, JSON, XML, HTML, Markdown, and TXT.
 * **Power Features:** Batch processing to ZIP, combining multiple CSVs into one, and merging diverse file types into a single text document.
## 🚀 Run it Locally
If you don't want to use the AI Studio environment and want to run this as a standalone app on your own machine, follow these steps.
### Prerequisites
 * Node.js (Version 18 or higher)
 * npm (comes with Node)
### Installation
 1. **Clone the Repository**
   ```bash
   git clone https://github.com/djnightmare9909/Yet-another-file-converter
   cd universal-file-converter
   
   ```
 2. **Install Dependencies**
   ```bash
   npm install
   
   ```
 3. **Setup Environment (Optional)**
   If you plan on extending the AI features, create a .env.local file:
   ```bash
   touch .env.local
   # Add your key if you use the AI Studio hooks:
   # VITE_GEMINI_API_KEY=your_key_here
   
   ```
 4. **Launch the App**
   ```bash
   npm run dev
   
   ```
 5. **Access the App**
   Open your browser to http://localhost:3000. You are now running a private, local conversion station.
## 🛠️ Technical Specs
 * **Framework:** React 19 + Vite
 * **Styling:** Tailwind CSS 4.0
 * **Core Libraries:** * JSZip for local compression.
   * pdfjs-dist for client-side PDF parsing.
   * Tesseract.js for local OCR.
   * Mammoth for DOCX to HTML/Text conversion.
## 📜 Philosophy
Built on the principle of **Vibe Coding**. The UI was built by AI, the logic was dictated by a human who values digital ownership.
**Stop uploading your life to the cloud. Convert locally.**
### How do you feel about adding a "Nuclear Option" button to the UI that just wipes the browser's IndexedDB and cache in one click? It would fit that high-security vibe you're going for.
