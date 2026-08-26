'use client'

/**
 * src/components/leads/import/ImportDropzone.tsx
 *
 * ImportDropzone
 *
 * Zonă de selecție a fișierului .xlsx pentru `/leads/import` — click pentru
 * a răsfoi sau drag & drop. Starea de „hover” la drag (`dragActive`) e
 * strict vizuală și locală componentei (nu are sens în pagina părinte);
 * fișierul selectat urcă în pagină prin `onFileSelected`, ca să poată fi
 * trimis la submit.
 */

import { useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react'

interface ImportDropzoneProps {
  selectedFile: File | null
  onFileSelected: (file: File | null) => void
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ImportDropzone({ selectedFile, onFileSelected, disabled }: ImportDropzoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(fileList: FileList | null) {
    const file = fileList?.[0]
    if (file) onFileSelected(file)
  }

  if (selectedFile) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
        <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{selectedFile.name}</p>
          <p className="text-xs text-slate-400">{formatSize(selectedFile.size)}</p>
        </div>
        {!disabled && (
          <button onClick={() => onFileSelected(null)} type="button"
            className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"
            title="Elimină fișierul">
            <X size={16} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragActive(true) }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        if (!disabled) pickFile(e.dataTransfer.files)
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 px-4 py-8 sm:py-10 border-2 border-dashed rounded-xl text-center transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700'
          : dragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 cursor-pointer'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'
      }`}
    >
      <UploadCloud size={28} className={dragActive ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'} />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        <span className="font-medium text-blue-600 dark:text-blue-400">Alege un fișier</span> sau trage-l aici
      </p>
      <p className="text-xs text-slate-400">Doar .xlsx, maxim 5 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        disabled={disabled}
        onChange={(e) => pickFile(e.target.files)}
        className="hidden"
      />
    </div>
  )
}
