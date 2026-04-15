import { BarChart3, Presentation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BarDataSource, BarStyle } from '@/integrations/openalgo/types/option-chain'

interface BarSettingsDropdownProps {
  barDataSource: BarDataSource
  barStyle: BarStyle
  onBarDataSourceChange: (source: BarDataSource) => void
  onBarStyleChange: (style: BarStyle) => void
}

export function BarSettingsDropdown({
  barDataSource,
  barStyle,
  onBarDataSourceChange,
  onBarStyleChange,
}: BarSettingsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <BarChart3 className="h-4 w-4" />
          <span className="sr-only">Bar settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Data Source
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={barDataSource} onValueChange={(v) => onBarDataSourceChange(v as BarDataSource)}>
          <DropdownMenuRadioItem value="oi">Open Interest (OI)</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="volume">Volume</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator className="my-2" />
        
        <DropdownMenuLabel className="flex items-center gap-2">
          <Presentation className="h-4 w-4" />
          Bar Style
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={barStyle} onValueChange={(v) => onBarStyleChange(v as BarStyle)}>
          <DropdownMenuRadioItem value="gradient">Gradient</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="solid">Solid Color</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
