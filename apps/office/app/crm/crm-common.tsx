"use client";
import type { ReactNode } from "react";
import { useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Info, Columns3, Rows3, ChevronLeft, ChevronRight } from "lucide-react";
export function Notice({ children }: { children: ReactNode }) {
  return (
    <Alert className="crm-notice">
      <Info aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={options[value] ?? label}>{options[value] ?? label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="crm-select-content">
        <SelectGroup>
          {Object.entries(options).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
export function DataTable<T>({
  data,
  columns,
  total,
  page = 1,
  onPage,
  toolbar,
  label = "data",
  footerLabel,
  busy = false,
  showColumns = true,
  formTable = false,
  pageSize = 20,
  densityControl = false,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  total: number;
  page?: number;
  onPage?: (page: number) => void;
  toolbar?: ReactNode;
  label?: string;
  footerLabel?: string;
  busy?: boolean;
  showColumns?: boolean;
  formTable?: boolean;
  pageSize?: number;
  densityControl?: boolean;
}) {
  const [visibility, setVisibility] = useState({});
  const [compact, setCompact] = useState(false);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: setVisibility,
  });
  return (
    <section
      className={`crm-table-panel ${compact ? "crm-table-compact" : ""}`}
      aria-label={label}
      aria-busy={busy}
    >
      {(toolbar || showColumns) && (
        <div className="crm-table-toolbar">
          {toolbar}
          {densityControl && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Tampilan tabel ringkas"
              aria-pressed={compact}
              onClick={() => setCompact((v) => !v)}
            >
              <Rows3 aria-hidden="true" />
            </Button>
          )}
          {showColumns && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="crm-columns-trigger">
                  <Columns3 aria-hidden="true" />
                  Kolom
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="crm-columns-menu">
                <DropdownMenuGroup>
                  {table.getAllLeafColumns().map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      disabled={column.getIsVisible() && table.getVisibleLeafColumns().length === 1}
                      onCheckedChange={(value) => column.toggleVisibility(value)}
                    >
                      {typeof column.columnDef.header === "string"
                        ? column.columnDef.header
                        : column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {formTable && typeof cell.column.columnDef.cell === "function"
                    ? cell.column.columnDef.cell(cell.getContext())
                    : flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Belum ada {label}</EmptyTitle>
            <EmptyDescription>Coba ubah pencarian atau filter yang dipilih.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <div className="crm-table-footer">
        <span>
          {footerLabel ??
            (onPage && data.length
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} dari ${total} ${label}`
              : `${total} ${label}`)}
          {total > pageSize ? ` · Halaman ${page}` : ""}
        </span>
        {onPage && (
          <div className="crm-actions">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || page === 1}
              onClick={() => onPage(page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || page * pageSize >= total}
              onClick={() => onPage(page + 1)}
            >
              Berikutnya
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
