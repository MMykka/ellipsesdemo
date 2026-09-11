import { useState } from 'react'
import { CANONICAL_FIELDS, type CanonicalField, type FieldMappingEntry, type LegGroup } from '../../types/columnMapping'

interface ColumnMapperModalProps {
  headerRow: string[]
  initialFields: FieldMappingEntry[]
  initialHasTwoLegGroups: boolean
  onConfirm: (fields: FieldMappingEntry[], hasTwoLegGroups: boolean) => void
  onCancel: () => void
}

export function ColumnMapperModal({
  headerRow,
  initialFields,
  initialHasTwoLegGroups,
  onConfirm,
  onCancel,
}: ColumnMapperModalProps) {
  const [fields, setFields] = useState<FieldMappingEntry[]>(initialFields)
  const [hasTwoLegGroups, setHasTwoLegGroups] = useState(initialHasTwoLegGroups)

  function setField(index: number, patch: Partial<FieldMappingEntry>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Map Excel Columns</h2>
          <p className="mt-1 text-sm text-gray-500">
            Match each column from your file to a trip field. Columns set to "Ignore" are dropped.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hasTwoLegGroups}
              onChange={(e) => setHasTwoLegGroups(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            This file has two trip legs side by side per row (A / B)
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-4">Raw Column</th>
                <th className="pb-2 pr-4">Maps To</th>
                {hasTwoLegGroups && <th className="pb-2">Leg</th>}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.rawColumnKey} className="border-t border-gray-100">
                  <td className="py-2 pr-4 font-medium text-gray-800">{field.rawColumnLabel}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={field.canonicalField}
                      onChange={(e) =>
                        setField(index, { canonicalField: e.target.value as CanonicalField })
                      }
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {CANONICAL_FIELDS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {hasTwoLegGroups && (
                    <td className="py-2">
                      <select
                        value={field.legGroup}
                        onChange={(e) => setField(index, { legGroup: e.target.value as LegGroup })}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="A">Leg A</option>
                        <option value="B">Leg B</option>
                        <option value="shared">Shared</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(fields, hasTwoLegGroups)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Import {headerRow.length} Columns
          </button>
        </div>
      </div>
    </div>
  )
}
