import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import type { ColumnKey } from '@/integrations/aetherdesk/types/option-chain'
import { COLUMN_DEFINITIONS } from '@/integrations/aetherdesk/types/option-chain'

interface ColumnConfigDropdownProps {
  visibleColumns: ColumnKey[]
  onToggleColumn: (key: ColumnKey) => void
  onResetToDefaults: () => void
}

export function ColumnConfigDropdown({
  visibleColumns,
  onToggleColumn,
  onResetToDefaults,
}: ColumnConfigDropdownProps) {
  const ceColumns = COLUMN_DEFINITIONS.filter(c => c.side === 'ce')
  const peColumns = COLUMN_DEFINITIONS.filter(c => c.side === 'pe')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Configure columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Column Visibility
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-green-500 font-medium">Calls (CE)</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-48">
              {ceColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.includes(col.key)}
                  onCheckedChange={() => onToggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-red-500 font-medium">Puts (PE)</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-48">
              {peColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.includes(col.key)}
                  onCheckedChange={() => onToggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <Button
          variant="ghost"
          className="w-full justify-start font-normal text-xs"
          onClick={onResetToDefaults}
        >
          Reset to Defaults
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
