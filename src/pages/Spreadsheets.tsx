import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Workbook, WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileSpreadsheet, Save, Upload, Download, CheckCircle2, CircleDot,
  Plus, ChevronLeft, Trash2, Loader2, Clock, FilePlus2
} from "lucide-react";
import {
  useSpreadsheets, useSpreadsheet, useCreateSpreadsheet,
  useSaveSpreadsheet, useDeleteSpreadsheet
} from "@/hooks/useSpreadsheets";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEFAULT_SHEETS = [{ name: "Sheet1", id: "sheet1", status: 1, order: 0, celldata: [], config: {} }];

// Fortune Sheet celldata → 2-D array for xlsx export
const toAoA = (sheets: any[]): Record<string, any[][]> => {
  const result: Record<string, any[][]> = {};
  for (const sheet of sheets) {
    const celldata: any[] = sheet.celldata || [];
    if (!celldata.length) { result[sheet.name] = [[]]; continue; }
    const maxR = Math.max(...celldata.map((c: any) => c.r)) + 1;
    const maxC = Math.max(...celldata.map((c: any) => c.c)) + 1;
    const aoa: any[][] = Array.from({ length: maxR }, () => Array(maxC).fill(""));
    for (const { r, c, v } of celldata) { aoa[r][c] = v?.v !== undefined ? v.v : (v?.m ?? ""); }
    result[sheet.name] = aoa;
  }
  return result;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

/* ─────────────────────────────────────────────
   File Manager (list view)
───────────────────────────────────────────── */
const FileManager = ({ onOpen }: { onOpen: (id: string) => void }) => {
  const { data: files = [], isLoading } = useSpreadsheets();
  const createMutation = useCreateSpreadsheet();
  const deleteMutation = useDeleteSpreadsheet();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled Spreadsheet";
    const record = await createMutation.mutateAsync(name);
    setCreating(false);
    setNewName("");
    onOpen(record.id);
  };

  return (
    <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col p-6 lg:p-8 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Spreadsheets</h1>
            <p className="text-sm text-muted-foreground">Your spreadsheets, saved to the database</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Spreadsheet
        </Button>
      </div>

      {/* Create inline */}
      {creating && (
        <div className="shrink-0 flex items-center gap-3 mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in slide-in-from-top-2">
          <FilePlus2 className="w-4 h-4 text-primary shrink-0" />
          <Input
            autoFocus
            placeholder="Spreadsheet name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            className="flex-1 h-8"
          />
          <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      {/* File grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 pb-16">
            <FileSpreadsheet className="w-16 h-16 opacity-20" />
            <p className="font-medium">No spreadsheets yet</p>
            <p className="text-sm">Click "New Spreadsheet" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => onOpen(file.id)}
                className="group relative bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <p className="font-semibold text-sm truncate pr-6">{file.name}</p>
                <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDate(file.updated_at)}
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(file.id); }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete spreadsheet?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the spreadsheet from the database. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Editor view
───────────────────────────────────────────── */
const Editor = ({ id, onBack }: { id: string; onBack: () => void }) => {
  const { data: record, isLoading } = useSpreadsheet(id);
  const saveMutation = useSaveSpreadsheet();
  const workbookRef = useRef<WorkbookInstance>(null);
  const [fileName, setFileName] = useState("");
  const [saved, setSaved] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync name from DB
  useEffect(() => { if (record?.name) setFileName(record.name); }, [record?.name]);

  const initialData = useMemo(() => {
    if (!record) return DEFAULT_SHEETS;
    return Array.isArray(record.data) && record.data.length > 0 ? record.data : DEFAULT_SHEETS;
  }, [record]);

  const handleChange = useCallback(() => setSaved(false), []);

  const handleSave = useCallback(() => {
    const wb = workbookRef.current;
    if (!wb || !record) return;
    saveMutation.mutate({ id: record.id, name: fileName, data: wb.getAllSheets() }, {
      onSuccess: () => setSaved(true),
    });
  }, [record, fileName, saveMutation]);

  const handleExportXlsx = useCallback(() => {
    const wb = workbookRef.current;
    if (!wb) return;
    const aoaMap = toAoA(wb.getAllSheets());
    const xlsxWb = XLSX.utils.book_new();
    for (const [sheetName, aoa] of Object.entries(aoaMap)) {
      XLSX.utils.book_append_sheet(xlsxWb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
    }
    XLSX.writeFile(xlsxWb, `${fileName}.xlsx`);
  }, [fileName]);

  const handleImport = useCallback(() => fileInputRef.current?.click(), []);

  const onFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const xlsxWb = XLSX.read(ev.target?.result, { type: "binary" });
        const fsSheets = xlsxWb.SheetNames.map((sName, idx) => {
          const ws = xlsxWb.Sheets[sName];
          const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          const celldata: any[] = [];
          aoa.forEach((row, r) => row.forEach((val, c) => {
            if (val !== "" && val != null) {
              celldata.push({ r, c, v: { v: val, m: String(val), t: typeof val === "number" ? "n" : "g" } });
            }
          }));
          return { name: sName, id: `sheet${idx + 1}`, status: idx === 0 ? 1 : 0, order: idx, celldata, config: {} };
        });
        // Save imported data immediately
        saveMutation.mutate({ id, name: fileName, data: fsSheets }, { onSuccess: () => { setSaved(true); window.location.reload(); } });
      } catch { alert("Could not read the file."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }, [id, fileName, saveMutation]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-theme(spacing.16))] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 lg:px-6 py-2.5 border-b border-border bg-card shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex flex-col min-w-0">
          <Input
            value={fileName}
            onChange={(e) => { setFileName(e.target.value); setSaved(false); }}
            className="h-6 text-sm font-semibold border-none shadow-none focus-visible:ring-0 p-0 bg-transparent w-48"
          />
          <div className="flex items-center gap-1 mt-0.5">
            {saved
              ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              : <CircleDot className="w-2.5 h-2.5 text-amber-500 animate-pulse" />}
            <span className="text-[10px] text-muted-foreground">{saved ? "Saved to database" : "Unsaved changes"}</span>
          </div>
        </div>

        <Separator orientation="vertical" className="h-7 mx-1" />

        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleImport}>
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Import .xlsx
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleExportXlsx}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export .xlsx
        </Button>

        <Separator orientation="vertical" className="h-7 mx-1" />

        <Button size="sm" className="h-8 text-xs min-w-[80px]"
          onClick={handleSave} variant={saved ? "outline" : "default"}
          disabled={saveMutation.isPending}>
          {saveMutation.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <><Save className="w-3.5 h-3.5 mr-1.5" />{saved ? "Saved" : "Save"}</>}
        </Button>

        <div className="ml-auto">
          <Badge variant="secondary" className="text-[10px] font-normal">Saved to database</Badge>
        </div>
      </div>

      {/* Workbook */}
      <div className="flex-1 min-h-0 fs-skin">
        {record && (
          <Workbook
            ref={workbookRef}
            data={initialData}
            onChange={handleChange}
            lang="en"
            showFormulaBar
            showToolbar
            showSheetTabs
            allowEdit
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileImport} />

      <style>{`
        .fs-skin .fortune-toolbar {
          background: #ffffff !important;
          border-bottom: 1px solid hsl(200 20% 90%) !important;
          padding: 2px 8px !important;
        }
        .fs-skin .fortune-toolbar .toolbar-button {
          border: none !important;
          border-radius: 6px !important;
          background: transparent !important;
          color: hsl(200 25% 30%) !important;
          transition: background 0.14s, color 0.14s !important;
        }
        .fs-skin .fortune-toolbar .toolbar-button:hover {
          background: hsl(197 54% 31% / 0.1) !important;
          color: hsl(197 54% 31%) !important;
        }
        .fs-skin .fortune-toolbar .toolbar-button.active {
          background: hsl(197 54% 31% / 0.15) !important;
          color: hsl(197 54% 31%) !important;
        }
        .fs-skin .fortune-toolbar select {
          border: 1px solid hsl(200 20% 88%) !important;
          border-radius: 6px !important;
          background: hsl(200 15% 97%) !important;
          color: hsl(200 25% 20%) !important;
          height: 26px !important;
          font-size: 12px !important;
          outline: none !important;
        }
        .fs-skin .fortune-toolbar select:focus {
          border-color: hsl(197 54% 31%) !important;
          box-shadow: 0 0 0 2px hsl(197 54% 31% / 0.18) !important;
        }
        .fs-skin .fortune-toolbar input[type="text"],
        .fs-skin .fortune-toolbar input[type="number"] {
          border: 1px solid hsl(200 20% 88%) !important;
          border-radius: 6px !important;
          background: hsl(200 15% 97%) !important;
          color: hsl(200 25% 20%) !important;
          height: 26px !important;
          font-size: 12px !important;
          outline: none !important;
          padding: 0 4px !important;
        }
        .fs-skin .fortune-toolbar .toolbar-separator {
          background: hsl(200 20% 88%) !important;
          margin: 3px 3px !important;
        }
        .fs-skin .fortune-formula-bar {
          background: hsl(200 15% 97%) !important;
          border-bottom: 1px solid hsl(200 20% 90%) !important;
          color: hsl(200 25% 20%) !important;
        }
        .fs-skin .fortune-formula-bar .cell-name-box {
          border: 1px solid hsl(200 20% 85%) !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          color: hsl(197 54% 31%) !important;
          font-weight: 600 !important;
          font-size: 12px !important;
        }
        .fs-skin .fortune-sheet-tab-container {
          background: hsl(200 15% 95%) !important;
          border-top: 1px solid hsl(200 20% 90%) !important;
        }
        .fs-skin .fortune-sheet-tab-container .sheet-tab {
          border-radius: 6px 6px 0 0 !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          border: 1px solid transparent !important;
          margin: 3px 2px 0 2px !important;
          transition: background 0.14s !important;
        }
        .fs-skin .fortune-sheet-tab-container .sheet-tab.active {
          background: #ffffff !important;
          color: hsl(197 54% 31%) !important;
          border-color: hsl(200 20% 88%) hsl(200 20% 88%) transparent !important;
          font-weight: 700 !important;
        }
        .fs-skin .fortune-sheet-tab-container .sheet-tab:not(.active):hover {
          background: hsl(197 54% 31% / 0.08) !important;
          color: hsl(197 54% 31%) !important;
        }
        .fortune-context-menu {
          background: #ffffff !important;
          border: 1px solid hsl(200 20% 90%) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px hsl(200 25% 15% / 0.14) !important;
          padding: 5px !important;
        }
        .fortune-context-menu .fortune-context-menu-item {
          border-radius: 6px !important;
          font-size: 12px !important;
          color: hsl(200 25% 20%) !important;
          padding: 6px 10px !important;
        }
        .fortune-context-menu .fortune-context-menu-item:hover {
          background: hsl(197 54% 31% / 0.1) !important;
          color: hsl(197 54% 31%) !important;
        }
        .fortune-context-menu .fortune-context-menu-item.disabled {
          color: hsl(200 10% 65%) !important;
        }
        .fortune-context-menu .fortune-context-menu-separator {
          background: hsl(200 20% 90%) !important;
          margin: 4px 0 !important;
        }
        .fortune-drop-down-content {
          background: #ffffff !important;
          border: 1px solid hsl(200 20% 90%) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px hsl(200 25% 15% / 0.14) !important;
        }
        .fortune-drop-down-content .fortune-drop-down-item:hover {
          background: hsl(197 54% 31% / 0.1) !important;
          color: hsl(197 54% 31%) !important;
          border-radius: 5px !important;
        }
        .fs-skin [class*="col-resize"],
        .fs-skin [class*="row-resize"],
        .fs-skin [class*="col-width-resize"],
        .fs-skin [class*="row-height-resize"] {
          pointer-events: auto !important;
          z-index: 10 !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        .fs-skin [class*="resize-line"],
        .fs-skin .fortune-col-resize-line,
        .fs-skin .fortune-row-resize-line {
          background: hsl(197 54% 31%) !important;
          opacity: 0.7 !important;
        }
        .fs-skin ::-webkit-scrollbar { width: 7px; height: 7px; }
        .fs-skin ::-webkit-scrollbar-track { background: hsl(200 15% 96%); }
        .fs-skin ::-webkit-scrollbar-thumb { background: hsl(200 20% 82%); border-radius: 4px; }
        .fs-skin ::-webkit-scrollbar-thumb:hover { background: hsl(197 54% 31% / 0.4); }
      `}</style>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Page root (switches between list & editor)
───────────────────────────────────────────── */
const Spreadsheets = () => {
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) {
    return <Editor id={openId} onBack={() => setOpenId(null)} />;
  }
  return <FileManager onOpen={setOpenId} />;
};

export default Spreadsheets;
