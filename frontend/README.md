# ✈️ Travel Agents Suite (TAS) — Galileo Tools
> **Enterprise GDS Automation, Umrah Package Builder & Travel Office Management Platform**

---

## 🌟 Executive Summary & Client Overview

**Travel Agents Suite (TAS)** is a modern, cloud-enabled web platform engineered specifically for travel agencies, GDS ticketing desks, and Umrah tour operators. 

By combining **AI-powered optical scanning (Gemini AI)**, **automated GDS terminal command formatting**, **multi-hotel package engines**, and **instant PDF invoice generation**, TAS replaces slow, error-prone manual desk operations with a fast, 100% accurate, 1-click digital workflow.

---

## 🎯 Primary Benefits for Travel Agencies & Management

### 1. ⚡ 98% Faster Operations & Desk Efficiency
- **SSR DOCS Creation**: Converts passenger passport details into error-free Galileo/Sabre `SSRDOCS` terminal entries in under **5 seconds** (saving 15–20 minutes per booking).
- **Package Quotation Proposals**: Construct complex Umrah package proposals (flights, Makkah/Madina hotels, transport, visas) in under **2 minutes**.
- **Client Invoicing**: Generate client invoices with itemized pricing in **30 seconds**.

### 2. 🛡️ 100% Error Elimination in GDS Terminal Commands
- **Zero Syntax Typos**: Automatically formats passenger names, passport numbers, nationalities, and dates into standard GDS 3-letter month formats (`12MAY95`).
- **Prevents Airline Penalties**: Eliminates costly airline Debit Memos (ADMs) and ticket reissue fees caused by manual typing mistakes.

### 3. 🌍 Global Cross-Device Synchronization (Work Anywhere)
- **Centralized Database**: Powered by a Laravel REST API backend, enabling travel agents to log in from office PCs, home laptops, or mobile devices with 100% data consistency.
- **No Data Loss**: Data entered on any computer is saved centrally to the backend database.

### 4. 🎨 High-Impact Branded PDF Exports
- **Professional Itineraries**: Export high-DPI colored travel itineraries, standard black & white quotation sheets, and itemized customer invoices with agency logos, address headers, and custom terms.

### 5. 🤖 AI-Powered Passport & Package Sheet Scanner
- **Gemini AI Integration**: Upload passport photos or package sheets (or capture via live camera) to automatically extract data into form fields in seconds.

---

## 🛠️ Detailed Feature Breakdown

### 1. 📊 Interactive Dashboard & Analytics Hub
- **Client Analytics**: Live round graphs displaying Total Clients, Completed Vouchers, and Pending Bookings.
- **Quick Action Shortcuts**: 1-click navigation to create clients, view lists, and open directories.
- **Backup & Restore**: 1-click **Export / Import JSON** backup tool for easy offline data transfer.

### 2. 🆔 SSR Docs Automation & AI Passport Scanner
- **GDS Formatter**: Instant conversion of passenger data into Galileo/Sabre `SI.P1/SSRDOCS...` syntax.
- **AI Camera & Image OCR**: Upload images or capture passport pages using your webcam/phone camera.
- **Clipboard One-Touch Copy**: Copy formatted GDS strings to paste directly into Galileo Smartpoint / Sabre.

### 3. 📦 Umrah & Travel Package Creator
- **Multi-Hotel Management**: Support for multiple Makkah & Madina hotel legs with auto-calculating check-in, check-out, and night prices.
- **Flight & Transport Builder**: Multi-sector flight schedules and transport option breakdown (Private Car, GMC, Bus).
- **PDF & Print Controls**: Toggle company logo/details and item price breakups on demand.

### 4. 🧾 Invoice Generator
- **Itemized Billing**: Bill for flight tickets, visa processing, hotel accommodations, and travel insurance.
- **Auto Math Engine**: Real-time subtotal, discount, amount paid, and balance due calculations.
- **Saved Client Integration**: Auto-fills client details from saved client records with 1-click selection.

### 5. 🎫 Dummy Bookings Generator
- **Travelport & ViewTrip Style Vouchers**: Generate professional flight and hotel dummy reservation documents for visa applications and travel proofs.

### 6. 📇 Client Directory & Contacts Directory
- **Searchable Client Records**: Search by client name, PNR, status (`Pending` vs `Completed`), or date.
- **Contacts Directory**: Centralized address book for client phone numbers, WhatsApp contacts, and email addresses.

---

## 🏗️ Technical Architecture & Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Tabler Icons, html2pdf.js, Axios
- **Backend**: Laravel 11/13 (PHP 8.2+), REST API Controllers (`DataSyncController`, `SSRController`), Eloquent ORM
- **Database**: Dual Storage Architecture (MySQL / SQLite Backend Database + LocalStorage fallback)
- **DevOps**: Automated GitHub Actions CI/CD pipeline deploying to Hostinger production server with database protection (`--exclude='database/*.sqlite'`).

---

## 💻 Quick Start & Installation Guide

### Prerequisites
- Node.js (v18+)
- PHP (v8.2+) & XAMPP (for MySQL)
- Composer & npm

### Running Locally

1. **Backend Server**:
   ```bash
   cd D:\xampp\htdocs\tas\backend
   php artisan serve --port=8000
   ```

2. **Frontend Server**:
   ```bash
   cd D:\xampp\htdocs\tas\frontend
   npm run dev
   ```

3. **Open in Browser**:
   - **Frontend App**: `http://localhost:5173/`
   - **Backend API**: `http://127.0.0.1:8000/`
