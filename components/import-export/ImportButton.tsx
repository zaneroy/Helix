"use client";

/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Shared Import Button
   ============================================================ */

import { useState } from "react";
import { Upload } from "lucide-react";

import type {
  ImportModule,
} from "@/lib/import-export/types";

import {
  getImportSchema,
} from "@/lib/import-export/schemas";

import ImportModal from "./ImportModal";

import type {
  ImportHandlerResult,
  ImportHandler,
} from "@/lib/import-export/parser/importRunner";

type Props = {

  module: ImportModule;

  importer: ImportHandler;

  label?: string;

  className?: string;

};

export default function ImportButton({

  module,

  importer,

  label,

  className,

}: Props) {

  const [open, setOpen] =
    useState(false);

  const schema =
    getImportSchema(module);

  return (
    <>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-teal-400/30 hover:bg-teal-400/10"
        }
      >
        <Upload className="h-4 w-4" />

        {label ??
          `Import ${schema.displayName}`}
      </button>

      <ImportModal
        open={open}
        schema={schema}
        onClose={() =>
          setOpen(false)
        }
        onImport={importer}
      />

    </>
  );

}