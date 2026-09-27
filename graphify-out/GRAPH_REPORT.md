# Graph Report - Website  (2026-09-27)

## Corpus Check
- Large corpus: 95 files · ~1,979,184 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 504 nodes · 842 edges · 50 communities (33 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 170,443 input · 0 output

## Community Hubs (Navigation)
- SMS Database Cleanup Functions
- Dashboard Core UI
- Jobsheet Module Core
- Inventory Management Module
- PDF Report Generation
- SMS Inbox Interface
- Invoice Export (Excel)
- Repair Checklist & Parts
- Kanban Board Job Movement
- AI Note Improvement (LLM)
- Job Table Rendering & Filters
- Jobsheet Detail Panel
- Technocity Device Lookup
- Netlify Label Numbering Function
- Auth & Session Security
- Data Sync & Scroll UI
- Photo Module (Job Photos)
- Receipt PDF & QR Generation
- Zoho Invoice & Save Sheet
- PWA Manifest Config
- Zoho Invoice API Backend
- SMS Module (Detail Panel)
- Comms Actions & Toasts
- New Job Photo Capture
- Comms Thread & Templates
- Shipping Label PDF
- Static Site Build Script
- SMS Conversation Thread
- QR Photo Upload Flow
- Cin7 Parts Orders
- Parts Stock Badges
- Twilio SMS Receive Webhook
- VoIP Call Initiate
- Job Status Pill Flow
- Twilio SMS Send Webhook
- Photo Upload Stage Tabs
- SMS Inbox Duality
- Roborock Product Carousel
- Formspree Contact Form
- Segway Product Carousel
- SMS Inbox Polling
- Zoho Books Actions
- Marketing Site Home Page
- Customer Repair Status Page

## God Nodes (most connected - your core abstractions)
1. `jsOpenJob()` - 17 edges
2. `showToast()` - 13 edges
3. `jsLoadFromData()` - 13 edges
4. `db` - 13 edges
5. `renderAll()` - 12 edges
6. `showDetail()` - 12 edges
7. `submitNewJob()` - 11 edges
8. `jsResetEditableFields()` - 10 edges
9. `invLoadItems()` - 9 edges
10. `handler()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `sha256() (login)` --semantically_similar_to--> `sha256() (job-status)`  [INFERRED] [semantically similar]
  login.html → job-status.html
- `Netlify Identity login redirect` --semantically_similar_to--> `lo_authed session cookie gate`  [INFERRED] [semantically similar]
  index.html → login.html
- `jsCommsSend() hook` --semantically_similar_to--> `sendMessage()`  [INFERRED] [semantically similar]
  dashboard.html → sms.html
- `Embedded SMS Inbox view` --semantically_similar_to--> `Standalone SMS Inbox App`  [INFERRED] [semantically similar]
  dashboard.html → sms.html
- `jsShowQrModal() hook` --references--> `Mobile Photo/Video Upload Page`  [INFERRED]
  dashboard.html → photo-upload.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **QR-Code Mobile Photo Upload Flow** — job_status_gotophotoupload, dashboard_jsshowqrmodal, photo_upload_verify, photo_upload_init [INFERRED 0.85]
- **Shared Repair Status Vocabulary** — dashboard_jobsheet_status_flow, job_status_stages, job_status_renderjob [INFERRED 0.85]
- **Parallel SMS Messaging Implementation** — dashboard_sms_inbox_view, dashboard_jscommssend, sms_page, sms_sendmessage [INFERRED 0.75]

## Communities (50 total, 17 thin omitted)

### Community 0 - "SMS Database Cleanup Functions"
Cohesion: 0.06
Nodes (25): { db }, handler(), isPhoneKeyed(), { db }, admin, db, { db }, { db } (+17 more)

### Community 1 - "Dashboard Core UI"
Cohesion: 0.07
Nodes (25): ACCESSORIES_BY_TYPE, cfg, COLS, DEMO, _dPhotoCache, HMAP, jobs, mTabGo() (+17 more)

### Community 2 - "Jobsheet Module Core"
Cohesion: 0.08
Nodes (24): JS_ACCESSORIES, JS_NAV_SECTIONS, JS_STAGE_NOTE_FIELDS, jsApplySentToggles(), jsCin7Orders, jsCloseQrModal(), jsCloseSheet(), jsCopyTimeouts (+16 more)

### Community 3 - "Inventory Management Module"
Cohesion: 0.14
Nodes (26): fsInventory(), invBuildUI(), invClearFlag(), invCloseAdjustModal(), invCloseItemModal(), invDeleteItem(), invFilterStock(), invFlagOrder() (+18 more)

### Community 4 - "PDF Report Generation"
Cohesion: 0.14
Nodes (22): buildFilename(), buildModal(), buildPdfBlob(), ensureLibs(), fetchPhotoBase64s(), fetchPhotoList(), heicToJpegBase64(), init() (+14 more)

### Community 5 - "SMS Inbox Interface"
Cohesion: 0.15
Nodes (21): closeSidebar(), escHtmlSms(), jsUploadSmsMedia(), smsApplyFilter(), smsComposeKeydown(), smsFilterConvs(), smsFmtTime(), smsInboxInit() (+13 more)

### Community 6 - "Invoice Export (Excel)"
Cohesion: 0.16
Nodes (16): applyRepairLevelCosts(), buildModal(), buildMonthOptions(), buildXlsx(), enrichJobs(), ensureXlsx(), escVerify(), filteredJobs() (+8 more)

### Community 7 - "Repair Checklist & Parts"
Cohesion: 0.16
Nodes (19): jsAddOrderNum(), jsAddPart(), jsBuildChecklist(), jsCalcCost(), jsClearNoteImproveState(), jsClearScooterChecklist(), jsEnsureInvDatalist(), jsLatestStatusFromTimestamps() (+11 more)

### Community 8 - "Kanban Board Job Movement"
Cohesion: 0.12
Nodes (17): buildBoard(), callScript(), checkForDuplicateJob(), closeModal(), dLoadPhotoTab(), dRenderPhotoGrid(), fmtTimestamp(), genId() (+9 more)

### Community 9 - "AI Note Improvement (LLM)"
Cohesion: 0.24
Nodes (16): buildCompletenessRetryPrompt(), buildUserPrompt(), canonicalActionStem(), cleanModelOutput(), extractApiError(), extractRequiredActionStems(), extractResponseText(), getSourceLines() (+8 more)

### Community 10 - "Job Table Rendering & Filters"
Cohesion: 0.23
Nodes (16): buildSmsTemplates(), dLoadJobsheetExtras(), filtered(), fmtDate(), fmtDateTime(), getTotalDays(), handleSearch(), kFilterByStatus() (+8 more)

### Community 11 - "Jobsheet Detail Panel"
Cohesion: 0.15
Nodes (14): fsJobsheet(), jsApplyCostsData(), jsHideLoadingOverlay(), jsInitials(), jsLoadCosts(), jsOpenJob(), jsOpenJobFromDetail(), jsPopulateIntake() (+6 more)

### Community 12 - "Technocity Device Lookup"
Cohesion: 0.31
Nodes (12): escHtml(), inferBrand(), inferDeviceType(), tcApplyOrder(), tcFetchOrders(), tcHideDropdown(), tcInit(), tcInjectUI() (+4 more)

### Community 13 - "Netlify Label Numbering Function"
Cohesion: 0.18
Nodes (11): admin, currentQuarterKey(), db, formatNumber(), handler(), dependencies, firebase-admin, name (+3 more)

### Community 14 - "Auth & Session Security"
Cohesion: 0.22
Nodes (11): doLogout(), Repair Dashboard App Shell, Netlify Identity login redirect, sha256() (job-status), TOKEN_SECRET shared-secret constraint, verifyToken(), attemptLogin(), lo_authed session cookie gate (+3 more)

### Community 15 - "Data Sync & Scroll UI"
Cohesion: 0.22
Nodes (11): fetchSheet(), kScroll(), kUpdateScrollBtns(), loadData(), loadSmsSentStatus(), markSmsTemplateSent(), refreshData(), renderAll() (+3 more)

### Community 16 - "Photo Module (Job Photos)"
Cohesion: 0.29
Nodes (10): formatBytes(), jsPhotoHandleFiles(), jsPhotoLoadTab(), jsPhotoRenderGrid(), jsPhotoShowGridLoading(), jsPhotoUpdateTabCounts(), jsPhotoUploadFile(), _photoFolderIds (+2 more)

### Community 17 - "Receipt PDF & QR Generation"
Cohesion: 0.31
Nodes (7): buildReceiptPdf(), ensureJsPDF(), ensureQRLib(), fmtDateTime(), generateQRDataUrl(), loadLogo(), loadScript()

### Community 18 - "Zoho Invoice & Save Sheet"
Cohesion: 0.20
Nodes (10): jsCollectData(), jsCreateZohoInvoice(), jsCreateZohoQuote(), jsDeductInventoryForParts(), jsExportCSV(), jsSaveOverlayHide(), jsSaveOverlayShow(), jsSaveSheet() (+2 more)

### Community 19 - "PWA Manifest Config"
Cohesion: 0.20
Nodes (9): background_color, display, icons, name, orientation, scope, short_name, start_url (+1 more)

### Community 20 - "Zoho Invoice API Backend"
Cohesion: 0.42
Nodes (8): createContact(), createEstimate(), createInvoice(), createTechnocityInvoice(), findContact(), getAccessToken(), handler(), resolveContact()

### Community 21 - "SMS Module (Detail Panel)"
Cohesion: 0.36
Nodes (6): appendOutboundToInbox(), escHtml(), fmtMsgTime(), loadInboxPanel(), IMPORTANT: scope this to the detail modal's own panel (#dSmsTemplatePanel)., renderInbox()

### Community 22 - "Comms Actions & Toasts"
Cohesion: 0.29
Nodes (8): copySms(), createZohoInvoice(), jsResizeImageForMms(), reprintLabels(), reprintReceipt(), showToast(), smsNewMsgHandleImage(), smsThreadHandleImage()

### Community 23 - "New Job Photo Capture"
Cohesion: 0.32
Nodes (8): njAddCustomSlot(), njCurrentSlotLabels(), njEscHtml(), njHandleFiles(), njRemovePhoto(), njRenderSlots(), njToggleCapture(), njWireInputs()

### Community 24 - "Comms Thread & Templates"
Cohesion: 0.29
Nodes (8): jsCommsKeydown(), jsCommsSend(), jsEsc(), jsFmtCommsTime(), jsLoadComms(), jsRenderCommsThread(), jsRenderSmsTemplates(), jsSendSmsTemplate()

### Community 25 - "Shipping Label PDF"
Cohesion: 0.39
Nodes (6): buildLabelsPdf(), ensureJsPDF(), fetchLabelNumber(), getLabelParts(), loadScript(), IMPORTANT: the PDF page itself is built as LABEL_H x LABEL_W (17x54,

### Community 26 - "Static Site Build Script"
Cohesion: 0.33
Nodes (5): dashboard, fs, smsPage, statusPage, ref_fs

### Community 27 - "SMS Conversation Thread"
Cohesion: 0.33
Nodes (5): jsCommsSend() hook, loadThread(), QUICK_REPLIES templates, renderThread(), sendMessage()

### Community 28 - "QR Photo Upload Flow"
Cohesion: 0.33
Nodes (4): jsShowQrModal() hook, goToPhotoUpload(), Mobile Photo/Video Upload Page, verify()

### Community 29 - "Cin7 Parts Orders"
Cohesion: 0.53
Nodes (6): fsPartsOrders(), jsClearCin7Flag(), jsFlagCin7Order(), jsLoadCin7Orders(), jsRenderCin7Orders(), jsToggleCin7Received()

### Community 31 - "Parts Stock Badges"
Cohesion: 0.40
Nodes (5): jsPartAvailableStock(), jsPartsNameChanged(), jsPartsQtyChanged(), jsPartStockBadgeHTML(), jsRefreshPartsStockBadges()

### Community 32 - "Twilio SMS Receive Webhook"
Cohesion: 0.60
Nodes (4): crypto, handler(), normalisePhone(), validateTwilioSignature()

### Community 33 - "VoIP Call Initiate"
Cohesion: 1.00
Nodes (3): handler(), normalisePhone(), parseSipOrPhone()

## Ambiguous Edges - Review These
- `TOKEN_SECRET shared-secret constraint` → `receipt-module.js TOKEN_SECRET (external reference)`  [AMBIGUOUS]
  job-status.html · relation: references

## Knowledge Gaps
- **84 isolated node(s):** `fs`, `dashboard`, `statusPage`, `smsPage`, `COLS` (+79 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 145 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `TOKEN_SECRET shared-secret constraint` and `receipt-module.js TOKEN_SECRET (external reference)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `firebase-admin` connect `Netlify Label Numbering Function` to `SMS Database Cleanup Functions`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `callScript()` connect `Kanban Board Job Movement` to `Dashboard Core UI`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `fs`, `dashboard`, `statusPage` to the rest of the system?**
  _84 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SMS Database Cleanup Functions` be split into smaller, more focused modules?**
  _Cohesion score 0.06105457909343201 - nodes in this community are weakly interconnected._
- **Should `Dashboard Core UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07130124777183601 - nodes in this community are weakly interconnected._
- **Should `Jobsheet Module Core` be split into smaller, more focused modules?**
  _Cohesion score 0.08172043010752689 - nodes in this community are weakly interconnected._